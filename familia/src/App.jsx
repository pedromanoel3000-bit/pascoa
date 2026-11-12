import { useEffect, useState } from 'react'
import { byId, familyCode, joinFamily, list, resetAll, save, setMe, useStore, useSyncStatus } from './store.js'
import { AVATARS, COLORS } from './utils.js'
import { Avatar, Field } from './ui.jsx'
import { Icon } from './icons.jsx'
import { Toaster } from './toast.jsx'
import { refreshPush } from './push.js'
import Home from './pages/Home.jsx'
import Calendar from './pages/Calendar.jsx'
import Lists from './pages/Lists.jsx'
import Tasks from './pages/Tasks.jsx'
import Meals from './pages/Meals.jsx'
import Chat from './pages/Chat.jsx'
import Photos from './pages/Photos.jsx'
import Contacts from './pages/Contacts.jsx'
import Budget from './pages/Budget.jsx'
import Locator from './pages/Locator.jsx'
import Notes from './pages/Notes.jsx'
import Wishes from './pages/Wishes.jsx'
import Treino from './pages/Treino.jsx'
import Magia from './pages/Magia.jsx'
import RadarPagina from './pages/Radar.jsx'
import Login from './pages/Login.jsx'
import { loadConfig, sair, useAuth } from './auth.js'
import Mural from './pages/Mural.jsx'
import Notifications, { NotifBell, unreadNotifs, usePendingReads } from './pages/Notifications.jsx'
import Settings from './pages/Settings.jsx'
import { unreadCount } from './pages/Chat.jsx'

export const PAGES = {
  home: { label: 'Início', ic: 'home', tint: '#5b4bdb', C: Home },
  notifications: { label: 'Notificações', ic: 'bell', tint: '#f76b15', C: Notifications },
  calendar: { label: 'Agenda', ic: 'calendar', tint: '#3e63dd', C: Calendar },
  lists: { label: 'Listas', ic: 'list', tint: '#12a594', C: Lists },
  tasks: { label: 'Tarefas', ic: 'tasks', tint: '#46a758', C: Tasks },
  treino: { label: 'Treino', ic: 'dumbbell', tint: '#e54d2e', C: Treino },
  chat: { label: 'Chat', ic: 'chat', tint: '#0090ff', C: Chat },
  mural: { label: 'Mural', ic: 'pin', tint: '#d6409f', C: Mural },
  meals: { label: 'Refeições', ic: 'meals', tint: '#f76b15', C: Meals },
  photos: { label: 'Fotos', ic: 'photos', tint: '#d6409f', C: Photos },
  radar: { label: 'Radar', ic: 'spark', tint: '#8e4ec6', C: RadarPagina },
  wishes: { label: 'Desejos', ic: 'gift', tint: '#e5484d', C: Wishes },
  contacts: { label: 'Contatos', ic: 'contacts', tint: '#8e4ec6', C: Contacts },
  budget: { label: 'Orçamento', ic: 'budget', tint: '#18794e', C: Budget },
  locator: { label: 'Localização', ic: 'locator', tint: '#e5484d', C: Locator },
  notes: { label: 'Notas', ic: 'notes', tint: '#ad7f00', C: Notes },
  settings: { label: 'Família', ic: 'settings', tint: '#6e6c80', C: Settings },
}
const BOTTOM = ['home', 'calendar', 'lists', 'chat']
const NOT_IN_MORE = ['notifications'] // fica no sino do topo

function useHashPage() {
  const get = () => {
    const p = location.hash.slice(1).split('/')[0]
    return PAGES[p] || p === 'more' ? p : 'home'
  }
  const [page, setPage] = useState(get)
  useEffect(() => {
    const h = () => setPage(get())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  return page
}

export const go = (p) => (location.hash = p)

export default function App() {
  const st = useStore()
  const page = useHashPage()
  const me = byId(st, st.me)
  usePendingReads()
  const brand = byId(st, 'family')?.color
  const auth = useAuth()
  // Links dos e-mails: #reset/<código> (nova senha) e #verify/<código> (confirmar e-mail).
  const lerLink = () => {
    const m = /^#(reset|verify)\/([\w-]{20,100})$/.exec(location.hash)
    return m ? { modo: m[1] === 'reset' ? 'redefinir' : 'verificar', token: m[2] } : null
  }
  const [link, setLink] = useState(lerLink)
  useEffect(() => {
    const h = () => setLink((atual) => lerLink() || atual)
    window.addEventListener('hashchange', h) // o link do e-mail pode abrir com o app já aberto
    return () => window.removeEventListener('hashchange', h)
  }, [])

  // Cor escolhida pela família (Família → Cor do app).
  useEffect(() => {
    const c = brand || '#5b4bdb'
    document.documentElement.style.setProperty('--brand', c)
    if (!document.documentElement.dataset.tema) document.querySelector('meta[name=theme-color]')?.setAttribute('content', c)
  }, [brand])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [page])
  // Barra mágica: abre pelo ✨, pela barra do Início ou com Ctrl/⌘ + K.
  const [magia, setMagia] = useState(null)
  useEffect(() => {
    const abrir = (e) => setMagia({ texto: typeof e.detail === 'string' ? e.detail : '' })
    const tecla = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setMagia((m) => (m ? null : { texto: '' }))
      }
    }
    window.addEventListener('abrir-magia', abrir)
    window.addEventListener('keydown', tecla)
    return () => {
      window.removeEventListener('abrir-magia', abrir)
      window.removeEventListener('keydown', tecla)
    }
  }, [])
  // Mantém o cadastro de notificações deste aparelho ligado à pessoa certa.
  useEffect(() => {
    if (st.family && st.me) refreshPush()
  }, [st.family, st.me])

  const fecharLink = () => {
    history.replaceState(null, '', '#home')
    setLink(null)
  }
  if (link) return <Login modoInicial={link.modo} token={link.token} onVoltar={fecharLink} onFeito={fecharLink} />
  if (!st.family) return <Welcome />
  if (auth.need) return <Login motivo={auth.need.reason} onVoltar={() => resetAll()} />
  if (!me) return <PickMe />

  const unread = unreadCount(st)
  const notifCount = unreadNotifs(st)
  const Page = page === 'more' ? More : PAGES[page].C
  const famName = byId(st, 'family')?.name || 'Nosso Lar'

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="/icon.svg" alt="" /> {famName}
        </div>
        {Object.entries(PAGES).map(([k, p]) => (
          <a key={k} href={'#' + k} className={'side-link' + (page === k ? ' on' : '')}>
            <Icon name={p.ic} size={20} /> {p.label}
            {k === 'chat' && unread > 0 && <b className="badge">{unread}</b>}
            {k === 'notifications' && notifCount > 0 && <b className="badge">{notifCount}</b>}
          </a>
        ))}
        <SyncBadge />
      </aside>
      <main className="content">
        <div className="topbar">
          <span className="brand">
            <img src="/icon.svg" alt="" /> {famName}
          </span>
          <SyncBadge />
          <button type="button" className="icon-btn magia-btn" onClick={() => setMagia({ texto: '' })} aria-label="Barra mágica: criar ou buscar">
            <Icon name="spark" />
          </button>
          <NotifBell />
          <a href="#settings">
            <Avatar member={me} size={32} />
          </a>
        </div>
        <Page key={page} />
      </main>
      {magia && <Magia paginas={PAGES} textoInicial={magia.texto} onClose={() => setMagia(null)} />}
      <Toaster />
      <nav className="bottom-nav">
        {BOTTOM.map((k) => (
          <a key={k} href={'#' + k} className={page === k ? 'on' : ''}>
            <span className="nav-ic">
              <Icon name={PAGES[k].ic} />
            </span>
            {PAGES[k].label}
            {k === 'chat' && unread > 0 && <b className="badge">{unread}</b>}
          </a>
        ))}
        <a href="#more" className={page === 'more' || !BOTTOM.includes(page) ? 'on' : ''}>
          <span className="nav-ic">
            <Icon name="menu" />
          </span>
          Mais
        </a>
      </nav>
    </div>
  )
}

function More() {
  return (
    <div className="page">
      <div className="more-grid">
        {Object.entries(PAGES)
          .filter(([k]) => !BOTTOM.includes(k) && !NOT_IN_MORE.includes(k))
          .map(([k, p]) => (
            <a key={k} href={'#' + k} className="more-tile" style={{ '--t': p.tint }}>
              <span className="tile-ic">
                <Icon name={p.ic} size={24} />
              </span>
              {p.label}
            </a>
          ))}
      </div>
    </div>
  )
}

function SyncBadge() {
  const s = useSyncStatus()
  const map = {
    online: ['●', 'Sincronizado', 'ok'],
    syncing: ['●', 'Sincronizando…', 'ok'],
    idle: ['○', 'Conectando…', ''],
    offline: ['○', 'Sem internet — salvo no aparelho', 'warn'],
    error: ['○', 'Servidor indisponível — salvo no aparelho', 'warn'],
  }
  const [dot, label, cls] = map[s] || map.idle
  return (
    <span className={'sync ' + cls} title={label}>
      {dot} <small>{label}</small>
    </span>
  )
}

function Welcome() {
  const auth = useAuth()
  const [cfg, setCfg] = useState(null)
  useEffect(() => {
    loadConfig().then(setCfg)
  }, [])
  const [mode, setMode] = useState(null)
  const [famName, setFamName] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const create = (e) => {
    e.preventDefault()
    joinFamily(familyCode(), { create: !!auth.token }) // conectado: a família já nasce protegida pela conta
    save('family', { id: 'family', name: famName.trim() || 'Minha família' })
    const m = save('member', { name: name.trim(), color: COLORS[0], emoji: AVATARS[0], role: 'admin' })
    setMe(m.id)
    for (const [title, icon] of [['Compras', '🛒'], ['Afazeres da casa', '🧹']]) save('list', { title, icon })
  }
  const join = (e) => {
    e.preventDefault()
    joinFamily(code.trim().toUpperCase())
  }

  if (mode === 'conta') return <Login intro="Entre ou crie a sua conta." onVoltar={() => setMode(null)} onFeito={() => setMode(null)} />
  if (cfg?.requireAccount && !auth.token) return <Login intro="Para começar, entre ou crie a sua conta." />

  return (
    <div className="welcome">
      <img src="/icon.svg" alt="" className="welcome-logo" />
      <h1>Nosso Lar</h1>
      <p className="muted">Agenda, listas, tarefas, chat e fotos da família num só lugar.</p>
      {!mode && (
        <div className="welcome-actions">
          <button className="btn primary big" onClick={() => setMode('create')}>Criar a minha família</button>
          <button className="btn big" onClick={() => setMode('join')}>Entrar com um código</button>
          {auth.token ? (
            <p className="muted small">
              Conectado como {auth.email}.{' '}
              <button type="button" className="link" onClick={() => sair()}>
                Sair
              </button>
            </p>
          ) : (
            <button type="button" className="link" onClick={() => setMode('conta')}>
              Tenho uma conta
            </button>
          )}
        </div>
      )}
      {mode === 'create' && (
        <form className="card form" onSubmit={create}>
          <Field label="Nome da família">
            <input value={famName} onChange={(e) => setFamName(e.target.value)} placeholder="Família Silva" autoFocus />
          </Field>
          <Field label="Seu nome">
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Pedro" />
          </Field>
          <button className="btn primary">Começar</button>
          <button type="button" className="btn ghost" onClick={() => setMode(null)}>Voltar</button>
        </form>
      )}
      {mode === 'join' && (
        <form className="card form" onSubmit={join}>
          <Field label="Código da família (está em Família → Convidar, no aparelho de quem criou)">
            <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="ABCD-1234" autoFocus style={{ textTransform: 'uppercase' }} />
          </Field>
          <button className="btn primary">Entrar</button>
          <button type="button" className="btn ghost" onClick={() => setMode(null)}>Voltar</button>
        </form>
      )}
      <p className="muted small">
        <a href="/privacidade" target="_blank" rel="noreferrer" className="link">
          Política de Privacidade
        </a>
      </p>
    </div>
  )
}

function PickMe() {
  const st = useStore()
  const status = useSyncStatus()
  const members = list(st, 'member')
  const family = byId(st, 'family')
  const [name, setName] = useState('')
  const add = (e) => {
    e.preventDefault()
    const m = save('member', { name: name.trim(), color: COLORS[members.length % COLORS.length], emoji: AVATARS[members.length % AVATARS.length] })
    setMe(m.id)
  }
  // O servidor respondeu e não há nada com esse código: provavelmente foi digitado errado.
  const notFound = status === 'online' && !family && members.length === 0
  const waiting = !family && members.length === 0 && !notFound
  const back = () => resetAll()

  return (
    <div className="welcome">
      <h1>Quem é você?</h1>
      <p className="muted">
        Código: <b>{st.family}</b>
        {family && <> · {family.name}</>}
      </p>
      {waiting && (
        <div className="card">
          {status === 'error' ? (
            <p className="late">Não consegui falar com o servidor. Tentando de novo…</p>
          ) : status === 'offline' ? (
            <p className="late">Sem internet. Conecte-se para buscar a família.</p>
          ) : (
            <p>Buscando a família… Se o servidor estava dormindo, isso pode levar até 1 minuto.</p>
          )}
        </div>
      )}
      {notFound && (
        <div className="card">
          <p className="late">Não encontrei nenhuma família com o código {st.family}.</p>
          <p className="muted small">Confira o código em Família → Convidar, no aparelho onde a família foi criada.</p>
        </div>
      )}
      {members.length > 0 && <p className="muted">Toque no seu nome:</p>}
      <div className="pick-list">
        {members.map((m) => (
          <button key={m.id} className="pick" onClick={() => setMe(m.id)}>
            <Avatar member={m} size={56} />
            {m.name}
          </button>
        ))}
      </div>
      {family && (
        <form className="card form" onSubmit={add}>
          <Field label="Não está na lista? Digite seu nome">
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <button className="btn primary">Entrar como novo membro</button>
        </form>
      )}
      <button className="btn ghost" onClick={back}>
        Voltar e digitar outro código
      </button>
    </div>
  )
}
