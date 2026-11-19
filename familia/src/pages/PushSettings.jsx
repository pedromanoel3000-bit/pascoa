import { useEffect, useState } from 'react'
import { BANNER_KEY, disablePush, enablePush, isIos, isStandalone, loadPrefs, PUSH_CATEGORIES, pushSupported, quickState, refreshPush, testPush, updatePrefs } from '../push.js'
import { toast } from '../toast.jsx'

// Estado das notificações neste aparelho:
// loading | on | off | lost (parou e precisa de um toque) | denied | unsupported | ios-install
export function usePushState() {
  const [state, setState] = useState('loading')
  const refresh = async () => {
    if (isIos && !isStandalone()) return setState('ios-install')
    if (!pushSupported()) return setState('unsupported')
    if (Notification.permission === 'denied') return setState('denied')
    // Mostra "ativo" na hora se o aparelho tem inscrição; a conferência com o servidor vem em seguida.
    if ((await quickState()) === 'on') setState('on')
    setState(await refreshPush())
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

// Aviso quando o servidor não guarda os dados de forma permanente (ex.: Render sem o Supabase).
// Nesse caso ele esquece tudo ao reiniciar, inclusive as chaves das notificações.
export function ServerWarning() {
  const [health, setHealth] = useState(null)
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {})
  }, [])
  const local = /^(localhost|127\.|10\.|192\.168\.|\[?::1\]?$)/.test(location.hostname)
  if (!health || local) return null
  if (health.ok === false)
    return (
      <div className="card warn">
        <b>⚠️ O servidor não está conseguindo falar com o Supabase</b>
        <p className="small">
          Os dados ficam só na memória do servidor e se perdem quando ele reinicia. Confira no Render as variáveis SUPABASE_URL e SUPABASE_KEY.
        </p>
        {health.db && <p className="muted small">Erro: {health.db}</p>}
      </div>
    )
  if (health.persistent === false)
    return (
      <div className="card warn">
        <b>⚠️ O servidor está sem banco de dados</b>
        <p className="small">
          Ele esquece tudo sempre que reinicia (no Render grátis, depois de 15 minutos sem uso). Por isso as notificações param e o app pede para ativar de novo.
          Coloque no Render as variáveis SUPABASE_URL e SUPABASE_KEY do seu projeto no Supabase.
        </p>
        {health.missing?.length > 0 && (
          <p className="small">
            <b>Falta no Render:</b> {health.missing.join(' e ')}
          </p>
        )}
      </div>
    )
  return null
}

export default function PushSettings() {
  const [state, refresh] = usePushState()
  const [prefs, setPrefs] = useState(loadPrefs)
  const [busy, setBusy] = useState(false)

  // #settings/notificacoes: rola até este cartão (vindo do aviso do início).
  useEffect(() => {
    if (location.hash === '#settings/notificacoes') {
      history.replaceState(null, '', '#settings')
      setTimeout(() => document.getElementById('notificacoes')?.scrollIntoView({ block: 'center' }), 100)
    }
  }, [])

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
          <p className="muted small">No iPhone, as notificações só funcionam com o app aberto pelo ícone da tela de início (iOS 16.4 ou mais novo). Se você já tem o ícone, abra o app por ele.</p>
          <IosInstallHelp />
        </>
      )}
      {state === 'unsupported' && <p className="muted small">Este navegador não aceita notificações. No Android, use o Chrome; no computador, Chrome, Edge ou Firefox.</p>}
      {state === 'denied' && (
        <p className="muted small">
          As notificações foram bloqueadas para este app. No iPhone: Ajustes → Notificações → Nosso Lar → Permitir Notificações. No Chrome: cadeado ao lado do endereço →
          Permissões → Notificações. Depois, feche e abra o app de novo.
        </p>
      )}
      {(state === 'off' || state === 'lost') && (
        <>
          <p className="muted small">
            {state === 'lost'
              ? 'As notificações deste aparelho pararam de funcionar. Toque para reativar — não precisa dar permissão de novo.'
              : 'Receba avisos de mensagens, tarefas e lembretes mesmo com o app fechado.'}
          </p>
          <button className="btn primary" disabled={busy} onClick={run(enablePush, 'Notificações ativadas 🔔')}>
            {busy ? 'Ativando…' : state === 'lost' ? 'Reativar notificações' : 'Ativar notificações'}
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

const BANNER_TEXT = {
  off: ['Ative as notificações', 'Saiba na hora quando chegar mensagem, tarefa ou lembrete.'],
  lost: ['As notificações pararam', 'Este aparelho deixou de receber os avisos. Toque em Reativar — não precisa dar permissão de novo.'],
  'ios-install': ['Notificações no iPhone', 'Elas só funcionam com o app aberto pelo ícone da tela de início.'],
}

// Aviso na página inicial: convite para ativar (some de vez no ✕) ou alerta de que parou (volta enquanto não for resolvido).
export function PushBanner() {
  const [state, refresh] = usePushState()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(BANNER_KEY) === 'off'
    } catch {
      return false
    }
  })
  const [closedNow, setClosedNow] = useState(false)
  const [busy, setBusy] = useState(false)
  const show = !closedNow && (state === 'lost' || (!dismissed && (state === 'off' || state === 'ios-install')))
  if (!show) return null
  const close = () => {
    setClosedNow(true)
    if (state !== 'lost') {
      setDismissed(true)
      try {
        localStorage.setItem(BANNER_KEY, 'off')
      } catch {}
    }
  }
  const [title, text] = BANNER_TEXT[state]
  return (
    <div className={'card push-banner' + (state === 'lost' ? ' lost' : '')}>
      <span className="push-bell">🔔</span>
      <div className="grow">
        <b>{title}</b>
        <p className="muted small">{text}</p>
        {state === 'ios-install' ? (
          <a href="#settings/notificacoes" className="btn ghost small">
            Como instalar
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
            {busy ? 'Ativando…' : state === 'lost' ? 'Reativar' : 'Ativar'}
          </button>
        )}
      </div>
      <button className="icon-btn small" onClick={close} aria-label="Fechar">
        ✕
      </button>
    </div>
  )
}
