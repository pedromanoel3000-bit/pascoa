import { useEffect, useState } from 'react'
import { byId, useStore } from '../store.js'
import { Field, Modal } from '../ui.jsx'
import { toast } from '../toast.jsx'
import { gerenciar, infoFamilia, proteger, sair, trocarSenha, useAuth } from '../auth.js'
import Login from './Login.jsx'

// Família → Conta e segurança: quem está conectado e quem pode entrar na família.
export default function Conta() {
  const st = useStore()
  const auth = useAuth()
  const [info, setInfo] = useState(null)
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [senha, setSenha] = useState(null) // { atual, nova } quando o formulário está aberto
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
            Sem conta, qualquer pessoa que descobrir o código da família consegue entrar. Com conta, só entra quem tiver e-mail e senha (ou Google) e o código.
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
        </>
      )}
      {entrando && (
        <Modal title="Entrar" onClose={() => setEntrando(false)}>
          <Login embutido onFeito={() => setEntrando(false)} />
        </Modal>
      )}
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
