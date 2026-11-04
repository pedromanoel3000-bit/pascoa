import { useEffect, useState } from 'react'
import { currentSubscription, disablePush, enablePush, isIos, isStandalone, loadPrefs, PUSH_CATEGORIES, pushSupported, testPush, updatePrefs } from '../push.js'
import { toast } from '../toast.jsx'

// Estado das notificações neste aparelho.
export function usePushState() {
  const [state, setState] = useState('loading')
  const refresh = async () => {
    if (isIos && !isStandalone()) return setState('ios-install')
    if (!pushSupported()) return setState('unsupported')
    if (Notification.permission === 'denied') return setState('denied')
    setState((await currentSubscription().catch(() => null)) ? 'on' : 'off')
  }
  useEffect(() => {
    refresh()
  }, [])
  return [state, refresh]
}

export function IosInstallHelp() {
  return (
    <ol className="steps">
      <li>
        Abra este app no <b>Safari</b>.
      </li>
      <li>
        Toque em <b>Compartilhar</b> (o quadrado com a seta para cima).
      </li>
      <li>
        Escolha <b>Adicionar à Tela de Início</b>.
      </li>
      <li>Abra o Nosso Lar pelo ícone novo e volte aqui.</li>
    </ol>
  )
}

export default function PushSettings() {
  const [state, refresh] = usePushState()
  const [prefs, setPrefs] = useState(loadPrefs)
  const [busy, setBusy] = useState(false)

  const run = (fn, ok) => async () => {
    setBusy(true)
    try {
      await fn()
      if (ok) toast(ok)
    } catch (err) {
      toast(err.message)
    }
    setBusy(false)
    refresh()
  }
  const toggle = (k) => {
    const next = { ...prefs, [k]: !prefs[k] }
    setPrefs(next)
    updatePrefs(next).catch(() => toast('Não consegui salvar. Tente de novo.'))
  }

  return (
    <div className="card stack" id="notificacoes">
      <h3>🔔 Notificações neste aparelho</h3>
      {state === 'loading' && <p className="muted">Verificando…</p>}
      {state === 'ios-install' && (
        <>
          <p className="muted small">No iPhone, as notificações só funcionam com o app instalado na tela de início (iOS 16.4 ou mais novo):</p>
          <IosInstallHelp />
        </>
      )}
      {state === 'unsupported' && <p className="muted small">Este navegador não aceita notificações. No Android, use o Chrome; no computador, Chrome, Edge ou Firefox.</p>}
      {state === 'denied' && (
        <p className="muted small">
          As notificações foram bloqueadas para este site. Libere nas configurações do navegador (no Chrome: cadeado ao lado do endereço → Permissões → Notificações) e
          recarregue a página.
        </p>
      )}
      {state === 'off' && (
        <>
          <p className="muted small">Receba avisos de mensagens, tarefas e lembretes mesmo com o app fechado.</p>
          <button className="btn primary" disabled={busy} onClick={run(enablePush, 'Notificações ativadas 🔔')}>
            {busy ? 'Ativando…' : 'Ativar notificações'}
          </button>
        </>
      )}
      {state === 'on' && (
        <>
          <p className="muted small">Escolha o que quer receber:</p>
          {PUSH_CATEGORIES.map(([k, label]) => (
            <label key={k} className="switch-row">
              <span className="grow">{label}</span>
              <input type="checkbox" role="switch" className="switch" checked={prefs[k] !== false} onChange={() => toggle(k)} />
            </label>
          ))}
          <div className="row">
            <button className="btn ghost" disabled={busy} onClick={run(testPush, 'Notificação de teste enviada')}>
              Enviar teste
            </button>
            <span className="grow" />
            <button className="btn danger" disabled={busy} onClick={run(disablePush, 'Notificações desativadas neste aparelho')}>
              Desativar
            </button>
          </div>
          <p className="muted small">Lembretes de eventos chegam no horário escolhido em cada evento (padrão: 30 minutos antes).</p>
        </>
      )}
    </div>
  )
}

// Convite discreto na página inicial para quem ainda não ativou.
export function PushBanner() {
  const [state, refresh] = usePushState()
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('nosso-lar-push-banner') === 'off'
    } catch {
      return false
    }
  })
  const [busy, setBusy] = useState(false)
  if (hidden || !['off', 'ios-install'].includes(state)) return null
  const close = () => {
    setHidden(true)
    try {
      localStorage.setItem('nosso-lar-push-banner', 'off')
    } catch {}
  }
  return (
    <div className="card push-banner">
      <span className="push-bell">🔔</span>
      <div className="grow">
        <b>Ative as notificações</b>
        <p className="muted small">Saiba na hora quando chegar mensagem, tarefa ou lembrete.</p>
        {state === 'ios-install' ? (
          <a href="#settings" className="btn ghost small">
            Como ativar no iPhone
          </a>
        ) : (
          <button
            className="btn primary small"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await enablePush()
                toast('Notificações ativadas 🔔')
              } catch (err) {
                toast(err.message)
              }
              setBusy(false)
              refresh()
            }}
          >
            {busy ? 'Ativando…' : 'Ativar'}
          </button>
        )}
      </div>
      <button className="icon-btn small" onClick={close} aria-label="Fechar">
        ✕
      </button>
    </div>
  )
}
