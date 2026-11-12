import { useEffect, useRef, useState } from 'react'
import { Field } from '../ui.jsx'
import { confirmarEmail, criarConta, entrar, entrarComGoogle, esqueciASenha, loadConfig, redefinirSenha, sair, useAuth } from '../auth.js'

const MOTIVOS = {
  protected: 'Esta família é protegida. Entre com a sua conta para continuar.',
  session: 'Sua sessão terminou. Entre de novo para continuar.',
  legacy: 'Esta família agora exige conta. Entre com e-mail e senha ou Google. A primeira conta que entrar vira a dona; as outras entram depois, usando o mesmo código.',
  account_required: 'Para criar uma família é preciso ter uma conta. Entre ou crie a sua.',
  closed: 'Os convites desta família estão fechados. Peça ao dono para abri-los em Família → Conta e segurança.',
  removed: 'O dono da família removeu o acesso desta conta. Fale com ele se foi engano.',
  noaccess: 'Esta conta não tem acesso a essa família. Entre com outra conta ou confira o código.',
}

// Carrega o botão do Google uma vez só.
let gsi
const carregarGoogle = () =>
  (gsi ||= new Promise((ok, erro) => {
    if (window.google?.accounts?.id) return ok()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => ok()
    s.onerror = () => {
      gsi = null
      erro(new Error('google'))
    }
    document.head.appendChild(s)
  }))

function BotaoGoogle({ clientId, onCredencial, onErro }) {
  const ref = useRef(null)
  const cb = useRef(onCredencial)
  cb.current = onCredencial
  useEffect(() => {
    let vivo = true
    carregarGoogle()
      .then(() => {
        if (!vivo || !ref.current) return
        window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential), ux_mode: 'popup' })
        window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: 'pt-BR', width: 280 })
      })
      .catch(() => onErro('Não consegui carregar o login do Google. Use e-mail e senha.'))
    return () => {
      vivo = false
    }
  }, [clientId])
  return <div ref={ref} className="login-google" />
}

/**
 * Entrar, criar conta, recuperar a senha e confirmar o e-mail.
 * `modoInicial`: 'entrar' | 'criar' | 'redefinir' | 'verificar'; `token` vem do link do e-mail.
 */
export default function Login({ motivo, intro, onVoltar, onFeito, embutido = false, modoInicial = 'entrar', token = '' }) {
  const auth = useAuth()
  const [cfg, setCfg] = useState(null)
  const [modo, setModo] = useState(modoInicial)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    loadConfig().then(setCfg)
  }, [])
  useEffect(() => {
    if (modoInicial !== 'verificar') return
    confirmarEmail(token)
      .then(() => setAviso('E-mail confirmado! Agora é só entrar.'))
      .catch((e) => setErro(e.message))
      .finally(() => setModo('entrar'))
  }, [])

  const trocar = (m) => {
    setModo(m)
    setErro('')
    setAviso('')
  }
  const rodar = async (fn) => {
    setErro('')
    setAviso('')
    setOcupado(true)
    try {
      await fn()
    } catch (e) {
      setErro(e.message)
    } finally {
      setOcupado(false)
    }
  }

  const enviar = (e) => {
    e.preventDefault()
    rodar(async () => {
      if (modo === 'entrar') {
        await entrar(email, senha)
        onFeito?.()
      } else if (modo === 'criar') {
        const j = await criarConta(email, senha, nome)
        if (j.pendingVerify) {
          setAviso(`Enviamos um link para ${email.trim()}. Abra-o para ativar a conta e depois volte aqui para entrar.`)
          setModo('entrar')
          setSenha('')
        } else onFeito?.()
      } else if (modo === 'esqueci') {
        await esqueciASenha(email)
        setAviso('Se existir uma conta com esse e-mail, enviamos um link para escolher uma nova senha. Ele vale por 1 hora.')
        setModo('entrar')
      } else if (modo === 'redefinir') {
        await redefinirSenha(token, senha)
        setAviso('Senha trocada! Entre com a nova senha.')
        setSenha('')
        setModo('entrar')
        history.replaceState(null, '', '#home')
      }
    })
  }

  const titulo = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Recuperar senha', redefinir: 'Nova senha', verificar: 'Confirmando…' }[modo]
  const mostraGoogle = cfg?.google && (modo === 'entrar' || modo === 'criar')

  const corpo = (
    <>
      {motivo && <p className="login-motivo">{MOTIVOS[motivo] || MOTIVOS.protected}</p>}
      {!motivo && intro && <p className="muted">{intro}</p>}
      {aviso && <p className="login-aviso" role="status">{aviso}</p>}
      <form className="card form" onSubmit={enviar}>
        <h2>{titulo}</h2>
        {modo === 'criar' && (
          <Field label="Seu nome">
            <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" placeholder="Como a família te chama" />
          </Field>
        )}
        {modo !== 'redefinir' && modo !== 'verificar' && (
          <Field label="E-mail">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoCapitalize="none" inputMode="email" placeholder="voce@email.com" />
          </Field>
        )}
        {(modo === 'entrar' || modo === 'criar' || modo === 'redefinir') && (
          <Field label={modo === 'entrar' ? 'Senha' : 'Senha (mínimo 8 caracteres)'}>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={modo === 'entrar' ? undefined : 8} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
          </Field>
        )}
        {erro && <p className="late" role="alert">{erro}</p>}
        <button className="btn primary" disabled={ocupado || modo === 'verificar'}>
          {ocupado ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : modo === 'esqueci' ? 'Enviar link' : 'Salvar nova senha'}
        </button>
        {mostraGoogle && (
          <>
            <div className="login-ou">
              <span>ou</span>
            </div>
            <BotaoGoogle clientId={cfg.google} onCredencial={(c) => rodar(async () => (await entrarComGoogle(c), onFeito?.()))} onErro={setErro} />
          </>
        )}
        <div className="login-links">
          {modo === 'entrar' && (
            <>
              <button type="button" className="link" onClick={() => trocar('criar')}>
                Criar conta
              </button>
              {cfg?.email && (
                <button type="button" className="link" onClick={() => trocar('esqueci')}>
                  Esqueci a senha
                </button>
              )}
            </>
          )}
          {(modo === 'criar' || modo === 'esqueci') && (
            <button type="button" className="link" onClick={() => trocar('entrar')}>
              Já tenho conta
            </button>
          )}
        </div>
      </form>
      <p className="muted small login-lgpd">
        Ao continuar, você concorda com os{' '}
        <a href="/termos" target="_blank" rel="noreferrer">
          Termos de Uso
        </a>{' '}
        e a{' '}
        <a href="/privacidade" target="_blank" rel="noreferrer">
          Política de Privacidade
        </a>
        .
      </p>
      {auth.token && !embutido && (
        <button type="button" className="btn ghost" onClick={() => sair()}>
          Sair de {auth.email} e usar outra conta
        </button>
      )}
      {onVoltar && (
        <button type="button" className="btn ghost" onClick={onVoltar}>
          Voltar
        </button>
      )}
    </>
  )
  if (embutido) return <div className="login-embutido">{corpo}</div>
  return (
    <div className="welcome">
      <img src="/icon.svg" alt="" className="welcome-logo" />
      <h1>Nosso Lar</h1>
      {corpo}
    </div>
  )
}
