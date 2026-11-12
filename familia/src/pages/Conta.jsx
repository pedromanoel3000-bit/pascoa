import { useEffect, useState } from 'react'
import { byId, resetAll, useStore } from '../store.js'
import { Field, Modal } from '../ui.jsx'
import { toast } from '../toast.jsx'
import { baixarMeusDados, excluirConta, gerenciar, infoFamilia, proteger, sair, trocarSenha, useAuth } from '../auth.js'
import Login from './Login.jsx'
import { PainelAssinatura } from './Assinatura.jsx'

// Família → Conta e segurança: quem está conectado e quem pode entrar na família.
export default function Conta() {
  const st = useStore()
  const auth = useAuth()
  const [info, setInfo] = useState(null)
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [senha, setSenha] = useState(null) // { atual, nova } quando o formulário está aberto
  const [excluindo, setExcluindo] = useState(null) // formulário de exclusão da conta
  const [ocupado, setOcupado] = useState(false)

  const carregar = () => {
    if (!auth.token) return setInfo(null)
    infoFamilia(st.family)
      .then((i) => (setInfo(i), setErro('')))
      .catch((e) => setErro(e.message))
  }
  useEffect(carregar, [auth.token, st.family])

  const agir = async (fn, ok) => {
    setOcupado(true)
    try {
      setInfo(await fn())
      if (ok) toast(ok)
    } catch (e) {
      toast(e.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="card" id="conta">
      <h3>Conta e segurança</h3>
      {!auth.token ? (
        <>
          <p className="muted small">
            Sem conta, qualquer pessoa que descobrir o código da família consegue entrar. Com conta, só entra quem tiver e-mail e senha (ou Google) e o código. Só em família protegida o treino, os avisos, as conversas privadas e as reservas de presentes de cada pessoa ficam realmente só com ela.
          </p>
          <button className="btn primary" onClick={() => setEntrando(true)}>
            Entrar ou criar conta
          </button>
        </>
      ) : (
        <>
          <p className="small">
            Conectado como <b>{auth.email}</b>
          </p>
          {erro && <p className="late small">{erro}</p>}
          {info && !info.protected && (
            <>
              <p className="muted small">Esta família ainda abre só com o código. Proteja-a: depois disso, todos precisam de conta para entrar (quem já usa o app entra de novo com e-mail e senha ou Google, usando o mesmo código).</p>
              <button className="btn primary" disabled={ocupado} onClick={() => agir(() => proteger(st.family, st.me), 'Família protegida 🔒')}>
                Proteger esta família
              </button>
            </>
          )}
          {info?.protected && (
            <>
              <p className="small">🔒 Família protegida. Você é {info.role === 'owner' ? 'o dono' : 'membro'}.</p>
              <p className="muted small">
                🔐 Privacidade ativa: seu treino, seus avisos, suas conversas privadas e as reservas de presente que você faz só chegam ao seu aparelho. Quem ganha o presente não vê quem o reservou.
              </p>
              {info.role === 'owner' && (
                <>
                  <label className="switch-row">
                    <div className="grow">
                      <b>Aceitar novas pessoas pelo código</b>
                      <div className="muted small">Desligue depois que todos entrarem. Quem já está dentro continua.</div>
                    </div>
                    <input type="checkbox" role="switch" className="switch" checked={info.joinOpen} disabled={ocupado} onChange={() => agir(() => gerenciar(st.family, { action: 'setOpen', open: !info.joinOpen }))} aria-label="Aceitar novas pessoas pelo código" />
                  </label>
                  <h4 className="conta-sub">Contas com acesso</h4>
                  {info.accounts.map((a) => (
                    <div key={a.id} className="conta-linha">
                      <div className="grow">
                        <b>{a.email}</b>
                        <div className="muted small">
                          {a.role === 'owner' ? 'Dono' : 'Membro'}
                          {byId(st, a.member) ? ` · ${byId(st, a.member).name}` : ''}
                        </div>
                      </div>
                      {a.role !== 'owner' && (
                        <button className="btn ghost small" disabled={ocupado} onClick={() => confirm(`Passar a propriedade da família para ${a.email}? Você vira membro.`) && agir(() => gerenciar(st.family, { action: 'transfer', account: a.id }), 'Propriedade passada')}>
                          Tornar dono
                        </button>
                      )}
                      {a.role !== 'owner' && (
                        <button
                          className="btn danger small"
                          disabled={ocupado}
                          onClick={() => confirm(`Tirar o acesso de ${a.email}? Os dados dela na família continuam.`) && agir(() => gerenciar(st.family, { action: 'remove', account: a.id }), 'Acesso removido')}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                  {info.removed?.length > 0 && (
                    <>
                      <h4 className="conta-sub">Removidas</h4>
                      {info.removed.map((a) => (
                        <div key={a.id} className="conta-linha">
                          <div className="grow muted">{a.email}</div>
                          <button className="btn ghost small" disabled={ocupado} onClick={() => agir(() => gerenciar(st.family, { action: 'allow', account: a.id }), 'Pode entrar de novo pelo código')}>
                            Permitir de novo
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </>
          )}
          <div className="row conta-acoes">
            {auth.hasPassword && (
              <button className="btn ghost" onClick={() => setSenha({ atual: '', nova: '' })}>
                Trocar senha
              </button>
            )}
            <button className="btn ghost" onClick={() => sair()}>
              Sair da conta
            </button>
          </div>
          {info?.protected && (
            <>
              <h4 className="conta-sub">Assinatura</h4>
              <PainelAssinatura family={st.family} />
            </>
          )}
          <h4 className="conta-sub">Seus dados</h4>
          <p className="muted small">Você pode baixar o que o app guarda sobre você ou apagar a sua conta quando quiser.</p>
          <div className="row conta-acoes">
            <button
              className="btn ghost"
              disabled={ocupado}
              onClick={async () => {
                try {
                  await baixarMeusDados(st.family)
                } catch (e) {
                  toast(e.message)
                }
              }}
            >
              Baixar meus dados
            </button>
            <button className="btn danger" onClick={() => setExcluindo({ confirm: '', password: '', deleteMine: false, deleteFamily: false, erro: '' })}>
              Excluir minha conta
            </button>
          </div>
        </>
      )}
      {entrando && (
        <Modal title="Entrar" onClose={() => setEntrando(false)}>
          <Login embutido onFeito={() => setEntrando(false)} />
        </Modal>
      )}
      {excluindo && <ExcluirConta f={excluindo} setF={setExcluindo} info={info} auth={auth} family={st.family} ocupado={ocupado} setOcupado={setOcupado} />}
      {senha && (
        <Modal title="Trocar senha" onClose={() => setSenha(null)}>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault()
              setOcupado(true)
              try {
                await trocarSenha(senha.atual, senha.nova)
                toast('Senha trocada. Os outros aparelhos precisam entrar de novo.')
                setSenha(null)
              } catch (err) {
                toast(err.message)
              } finally {
                setOcupado(false)
              }
            }}
          >
            <Field label="Senha atual">
              <input type="password" value={senha.atual} onChange={(e) => setSenha({ ...senha, atual: e.target.value })} required autoComplete="current-password" />
            </Field>
            <Field label="Nova senha (mínimo 8 caracteres)">
              <input type="password" value={senha.nova} onChange={(e) => setSenha({ ...senha, nova: e.target.value })} required minLength={8} autoComplete="new-password" />
            </Field>
            <button className="btn primary" disabled={ocupado}>
              Salvar
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function ExcluirConta({ f, setF, info, auth, family, ocupado, setOcupado }) {
  const protegida = !!info?.protected
  const dono = protegida && info.role === 'owner'
  const outras = dono ? info.accounts.length - 1 : 0
  const bloqueado = dono && outras > 0
  const precisaApagarFamilia = dono && outras === 0
  const podeEnviar = !bloqueado && f.confirm.trim() && (!auth.hasPassword || f.password) && (!precisaApagarFamilia || f.deleteFamily)
  const set = (k, v) => setF({ ...f, [k]: v, erro: '' })
  return (
    <Modal title="Excluir minha conta" onClose={() => setF(null)}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          setOcupado(true)
          try {
            await excluirConta({ family, confirm: f.confirm, password: f.password, deleteMine: f.deleteMine, deleteFamily: f.deleteFamily })
            resetAll() // some também a cópia dos dados que estava neste aparelho
            toast('Conta excluída.')
          } catch (err) {
            setF({ ...f, erro: err.message })
          } finally {
            setOcupado(false)
          }
        }}
      >
        <p className="small">
          Isso apaga a sua conta (e-mail, senha e acesso pelo Google) e <b>não dá para desfazer</b>. Este aparelho também deixa de ter os dados da família: baixe antes o que quiser guardar (“Baixar meus dados” ou, para a família inteira, “Baixar backup”).
        </p>
        {protegida && !dono && (
          <>
            <label className="check">
              <input type="checkbox" checked={f.deleteMine} onChange={(e) => set('deleteMine', e.target.checked)} /> Apagar também o meu perfil e tudo o que eu cadastrei nesta família
            </label>
            <p className="muted small">{f.deleteMine ? 'Suas tarefas, mensagens, fotos, treinos e desejos saem da família.' : 'Sem marcar, o que você cadastrou continua na família; só o seu acesso é removido.'}</p>
          </>
        )}
        {bloqueado && <p className="late small">Você é o dono desta família e há outras contas nela. Antes, toque em “Tornar dono” em outra pessoa (ou remova as outras contas).</p>}
        {precisaApagarFamilia && (
          <>
            <p className="small">Você é a única conta e a dona desta família. Sem você, ninguém mais poderia abri-la.</p>
            <label className="check">
              <input type="checkbox" checked={f.deleteFamily} onChange={(e) => set('deleteFamily', e.target.checked)} /> Apagar a família inteira, com os dados de todos os membros
            </label>
          </>
        )}
        <Field label={`Para confirmar, digite o seu e-mail (${auth.email})`}>
          <input value={f.confirm} onChange={(e) => set('confirm', e.target.value)} autoCapitalize="none" autoComplete="off" inputMode="email" required />
        </Field>
        {auth.hasPassword && (
          <Field label="Sua senha">
            <input type="password" value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="current-password" required />
          </Field>
        )}
        {f.erro && <p className="late" role="alert">{f.erro}</p>}
        <button className="btn danger" disabled={ocupado || !podeEnviar}>
          {ocupado ? 'Excluindo…' : 'Excluir para sempre'}
        </button>
      </form>
    </Modal>
  )
}
