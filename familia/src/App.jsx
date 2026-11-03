import { useEffect, useState } from 'react'
import { byId, familyCode, joinFamily, list, save, setMe, useStore, useSyncStatus } from './store.js'
import { AVATARS, COLORS } from './utils.js'
import { Avatar, Field } from './ui.jsx'
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
import Settings from './pages/Settings.jsx'
import { unreadCount } from './pages/Chat.jsx'

export const PAGES = {
  home: { label: 'Mural', icon: '🏠', C: Home },
  calendar: { label: 'Agenda', icon: '📅', C: Calendar },
  lists: { label: 'Listas', icon: '🛒', C: Lists },
  tasks: { label: 'Tarefas', icon: '✅', C: Tasks },
  chat: { label: 'Chat', icon: '💬', C: Chat },
  meals: { label: 'Refeições', icon: '🍽️', C: Meals },
  photos: { label: 'Fotos', icon: '📷', C: Photos },
  contacts: { label: 'Contatos', icon: '📇', C: Contacts },
  budget: { label: 'Orçamento', icon: '💰', C: Budget },
  locator: { label: 'Localização', icon: '📍', C: Locator },
  notes: { label: 'Notas', icon: '📝', C: Notes },
  settings: { label: 'Família', icon: '⚙️', C: Settings },
}
const BOTTOM = ['home', 'calendar', 'lists', 'chat']

function useHashPage() {
  const get = () => {
    const p = location.hash.slice(1)
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

  if (!st.family) return <Welcome />
  if (!me) return <PickMe />

  const unread = unreadCount(st)
  const Page = page === 'more' ? More : PAGES[page].C

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="/icon.svg" alt="" /> {byId(st, 'family')?.name || 'Nosso Lar'}
        </div>
        {Object.entries(PAGES).map(([k, p]) => (
          <a key={k} href={'#' + k} className={'side-link' + (page === k ? ' on' : '')}>
            <span>{p.icon}</span> {p.label}
            {k === 'chat' && unread > 0 && <b className="badge">{unread}</b>}
          </a>
        ))}
        <SyncBadge />
      </aside>
      <main className="content">
        <div className="topbar">
          <span className="brand">
            <img src="/icon.svg" alt="" /> {byId(st, 'family')?.name || 'Nosso Lar'}
          </span>
          <SyncBadge />
          <a href="#settings">
            <Avatar member={me} size={32} />
          </a>
        </div>
        <Page />
      </main>
      <nav className="bottom-nav">
        {BOTTOM.map((k) => (
          <a key={k} href={'#' + k} className={page === k ? 'on' : ''}>
            <span>{PAGES[k].icon}</span>
            {PAGES[k].label}
            {k === 'chat' && unread > 0 && <b className="badge">{unread}</b>}
          </a>
        ))}
        <a href="#more" className={page === 'more' || !BOTTOM.includes(page) ? 'on' : ''}>
          <span>☰</span>Mais
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
          .filter(([k]) => !BOTTOM.includes(k))
          .map(([k, p]) => (
            <a key={k} href={'#' + k} className="more-tile">
              <span>{p.icon}</span>
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
  const [mode, setMode] = useState(null)
  const [famName, setFamName] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const create = (e) => {
    e.preventDefault()
    joinFamily(familyCode())
    save('family', { id: 'family', name: famName.trim() || 'Minha família' })
    const m = save('member', { name: name.trim(), color: COLORS[0], emoji: AVATARS[0], role: 'admin' })
    setMe(m.id)
    for (const [title, icon] of [['Compras', '🛒'], ['Afazeres da casa', '🧹']]) save('list', { title, icon })
  }
  const join = (e) => {
    e.preventDefault()
    joinFamily(code.trim().toUpperCase())
  }

  return (
    <div className="welcome">
      <img src="/icon.svg" alt="" className="welcome-logo" />
      <h1>Nosso Lar</h1>
      <p className="muted">Agenda, listas, tarefas, chat e fotos da família num só lugar.</p>
      {!mode && (
        <div className="welcome-actions">
          <button className="btn primary big" onClick={() => setMode('create')}>Criar a minha família</button>
          <button className="btn big" onClick={() => setMode('join')}>Entrar com um código</button>
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
    </div>
  )
}

function PickMe() {
  const st = useStore()
  const status = useSyncStatus()
  const members = list(st, 'member')
  const [name, setName] = useState('')
  const add = (e) => {
    e.preventDefault()
    const m = save('member', { name: name.trim(), color: COLORS[members.length % COLORS.length], emoji: AVATARS[members.length % AVATARS.length] })
    setMe(m.id)
  }
  return (
    <div className="welcome">
      <h1>Quem é você?</h1>
      <p className="muted">{byId(st, 'family')?.name || (status === 'online' ? 'Família encontrada' : 'Buscando a família…')}</p>
      <div className="pick-list">
        {members.map((m) => (
          <button key={m.id} className="pick" onClick={() => setMe(m.id)}>
            <Avatar member={m} size={56} />
            {m.name}
          </button>
        ))}
      </div>
      <form className="card form" onSubmit={add}>
        <Field label="Não está na lista? Digite seu nome">
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <button className="btn primary">Entrar como novo membro</button>
      </form>
    </div>
  )
}
