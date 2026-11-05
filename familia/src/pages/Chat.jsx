import { useEffect, useRef, useState } from 'react'
import { byId, list, markRead, remove, save, useStore } from '../store.js'
import { fmtDate, fmtTime, resizeImage, ymd } from '../utils.js'
import { Avatar, PageHeader, useMembers } from '../ui.jsx'

// Conversa "family" é o grupo; conversas privadas usam os dois ids em ordem.
export const convKey = (a, b) => [a, b].sort().join('|')

export function unreadCount(st, conv) {
  return list(st, 'message').filter(
    (m) => m.createdBy !== st.me && (conv ? m.conv === conv : m.conv === 'family' || m.conv?.split('|').includes(st.me)) && m.createdAt > (st.lastRead['chat:' + m.conv] || 0)
  ).length
}

export default function Chat() {
  const st = useStore()
  const members = useMembers().filter((m) => m.id !== st.me)
  const [conv, setConv] = useState('family')
  const convs = [['family', '👨‍👩‍👧‍👦 Família', null], ...members.map((m) => [convKey(st.me, m.id), m.name, m])]

  return (
    <div className="page chat-page">
      <PageHeader title="Chat" />
      <div className="conv-tabs">
        {convs.map(([k, label, m]) => {
          const n = unreadCount(st, k)
          return (
            <button key={k} className={'chip' + (conv === k ? ' on' : '')} onClick={() => setConv(k)}>
              {m && <Avatar member={m} size={22} />} {label}
              {n > 0 && conv !== k && <b className="badge">{n}</b>}
            </button>
          )
        })}
      </div>
      <Conversation conv={conv} />
    </div>
  )
}

function Conversation({ conv }) {
  const st = useStore()
  const [text, setText] = useState('')
  const end = useRef(null)
  const msgs = list(st, 'message')
    .filter((m) => m.conv === conv)
    .sort((a, b) => a.createdAt - b.createdAt)
  const last = msgs[msgs.length - 1]?.id

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
    markRead('chat:' + conv)
  }, [conv, last])

  const send = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    save('message', { conv, text: text.trim() })
    setText('')
  }
  const sendPhoto = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    save('message', { conv, photo: await resizeImage(f, 1024) })
    e.target.value = ''
  }

  let lastDay = ''
  return (
    <>
      <div className="messages">
        {msgs.length === 0 && <p className="muted center">Nenhuma mensagem ainda. Diga oi! 👋</p>}
        {msgs.map((m) => {
          const mine = m.createdBy === st.me
          const day = ymd(new Date(m.createdAt))
          const sep = day !== lastDay
          lastDay = day
          const author = byId(st, m.createdBy)
          return (
            <div key={m.id}>
              {sep && <div className="day-sep">{fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' })}</div>}
              <div className={'msg' + (mine ? ' mine' : '')}>
                {!mine && <Avatar member={author} size={28} />}
                <div className="bubble" style={!mine ? { '--c': author?.color } : undefined}>
                  {!mine && conv === 'family' && <b className="msg-author">{author?.name}</b>}
                  {m.photo && <img src={m.photo} alt="" />}
                  {m.text && <span>{m.text}</span>}
                  <small>
                    {fmtTime(m.createdAt)}
                    {mine && (
                      <button className="link" onClick={() => confirm('Apagar mensagem?') && remove(m.id)}>
                        apagar
                      </button>
                    )}
                  </small>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      <form className="chat-input" onSubmit={send}>
        <label className="icon-btn" aria-label="Enviar foto">
          📷
          <input type="file" accept="image/*" hidden onChange={sendPhoto} />
        </label>
        <input className="grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem" />
        <button className="btn primary">Enviar</button>
      </form>
    </>
  )
}
