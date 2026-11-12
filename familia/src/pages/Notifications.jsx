import { useEffect, useState } from 'react'
import { byId, getState, list, remove, update, useStore } from '../store.js'
import { fmtDate, timeAgo, today, ymd, addDays } from '../utils.js'
import { Icon } from '../icons.jsx'
import { Empty, PageHeader, Segmented } from '../ui.jsx'
import { Swipe, toast } from '../toast.jsx'

// Histórico de avisos: o servidor grava um item "notif" para cada pessoa sempre que algo acontece.
const CAT = {
  chat: ['chat', '#0090ff'],
  tasks: ['tasks', '#46a758'],
  events: ['calendar', '#3e63dd'],
  reminders: ['bell', '#f76b15'],
  lists: ['list', '#12a594'],
  posts: ['home', '#d6409f'],
  radar: ['spark', '#8e4ec6'],
}

export const myNotifs = (st) =>
  list(st, 'notif')
    .filter((n) => n.to === st.me)
    .sort((a, b) => b.createdAt - a.createdAt)

export const unreadNotifs = (st) => myNotifs(st).filter((n) => !n.read).length

// Marcar como lido ao tocar na notificação do celular. Se o aviso ainda não chegou
// por sincronização, guarda o pedido e marca quando chegar.
const pendingRead = new Set()
export function markNotifRead(id) {
  const n = getState().items[id]
  if (n && !n.deleted) {
    if (!n.read) update(id, { read: true })
  } else pendingRead.add(id)
}
;(() => {
  const params = new URLSearchParams(location.search)
  const n = params.get('n')
  if (!n) return
  pendingRead.add(n)
  history.replaceState(null, '', location.pathname + location.hash)
})()

export function usePendingReads() {
  const st = useStore()
  useEffect(() => {
    for (const id of [...pendingRead]) {
      const n = st.items[id]
      if (n && !n.deleted) {
        pendingRead.delete(id)
        if (!n.read) update(id, { read: true })
      }
    }
  }, [st])
}

export function NotifBell() {
  const st = useStore()
  const n = unreadNotifs(st)
  return (
    <a href="#notifications" className="icon-btn bell" aria-label={n ? `${n} notificações não lidas` : 'Notificações'}>
      <Icon name="bell" />
      {n > 0 && <b className="badge">{n > 99 ? '99+' : n}</b>}
    </a>
  )
}

export default function Notifications() {
  const st = useStore()
  const [filter, setFilter] = useState('all')
  const all = myNotifs(st)
  const shown = filter === 'unread' ? all.filter((n) => !n.read) : all
  const unread = all.filter((n) => !n.read)

  const groups = []
  for (const n of shown) {
    const day = ymd(new Date(n.createdAt))
    const label = day === today() ? 'Hoje' : day === addDays(today(), -1) ? 'Ontem' : fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' })
    if (!groups.length || groups[groups.length - 1][0] !== label) groups.push([label, []])
    groups[groups.length - 1][1].push(n)
  }

  const open = (n) => {
    if (!n.read) update(n.id, { read: true })
    if (n.url) location.hash = n.url.replace(/^\/?#?/, '')
  }
  const readAll = () => {
    unread.forEach((n) => update(n.id, { read: true }))
    toast('Tudo marcado como lido')
  }
  const clearRead = () => {
    const old = all.filter((n) => n.read)
    if (!old.length) return
    old.forEach((n) => remove(n.id))
    toast(old.length === 1 ? '1 aviso apagado' : `${old.length} avisos apagados`)
  }

  return (
    <div className="page">
      <PageHeader title="Notificações">
        <Segmented options={[['all', 'Todas'], ['unread', `Não lidas${unread.length ? ` (${unread.length})` : ''}`]]} value={filter} onChange={setFilter} />
      </PageHeader>
      {all.length > 0 && (
        <div className="row">
          <button className="btn ghost small" onClick={readAll} disabled={!unread.length}>
            Marcar todas como lidas
          </button>
          <span className="grow" />
          <button className="btn ghost small" onClick={clearRead}>
            Apagar lidas
          </button>
        </div>
      )}
      {shown.length === 0 && (
        <Empty icon="🔔" text={filter === 'unread' ? 'Nenhum aviso novo. Tudo em dia!' : 'Ainda não há avisos. Mensagens, tarefas, eventos e lembretes da família aparecem aqui.'} />
      )}
      {groups.map(([label, items]) => (
        <section key={label} className="notif-group">
          <h3 className="section-title">{label}</h3>
          <div className="notif-list">
            {items.map((n) => {
              const [ic, tint] = CAT[n.category] || ['bell', 'var(--primary)']
              return (
                <Swipe key={n.id} onLeft={() => remove(n.id)} onRight={() => update(n.id, { read: !n.read })} rightLabel={n.read ? 'Não lida' : 'Lida ✓'}>
                  <button className={'notif' + (n.read ? '' : ' unread')} onClick={() => open(n)}>
                    <span className="tile-ic notif-ic" style={{ '--t': tint }}>
                      <Icon name={ic} size={20} />
                    </span>
                    <span className="grow notif-text">
                      <b>{n.title}</b>
                      <span className="notif-body">{n.body}</span>
                      <small className="muted">
                        {timeAgo(n.createdAt)}
                        {n.count > 1 && ` · ${n.count} novas`}
                      </small>
                    </span>
                    {!n.read && <i className="notif-dot" aria-label="Não lida" />}
                  </button>
                </Swipe>
              )
            })}
          </div>
        </section>
      ))}
      {all.length > 0 && <p className="muted small center">Arraste para a direita para marcar como lida e para a esquerda para apagar. Ficam guardados os últimos 150 avisos.</p>}
    </div>
  )
}
