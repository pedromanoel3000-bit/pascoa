import { useState } from 'react'
import { byId, list, remove, save, update, useStore } from '../store.js'
import { addDays, eventsOn, fmtDate, parseYmd, resizeImage, timeAgo, today, WEEKDAYS, WEEKDAYS_LONG } from '../utils.js'
import { Avatar, Empty, useMembers } from '../ui.jsx'
import { Icon } from '../icons.jsx'
import { toast, vibrate } from '../toast.jsx'
import { PushBanner } from './PushSettings.jsx'

const QUICK = [
  ['#calendar/new', 'calendar', 'Evento', '#3e63dd'],
  ['#tasks/new', 'tasks', 'Tarefa', '#46a758'],
  ['#lists/new', 'list', 'Compras', '#12a594'],
  ['#chat', 'chat', 'Mensagem', '#0090ff'],
  ['#budget/new', 'budget', 'Gasto', '#18794e'],
]

export default function Home() {
  const st = useStore()
  const me = byId(st, st.me)
  const members = useMembers()
  const day = today()
  const people = [...list(st, 'member'), ...list(st, 'contact')]
  const allEvents = list(st, 'event')
  const events = eventsOn(allEvents, people, day)
  const myTasks = list(st, 'task')
    .filter((t) => !t.done && (!t.assignee || t.assignee === st.me))
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
  const meal = list(st, 'meal').filter((m) => m.date === day)
  const posts = list(st, 'post').sort((a, b) => b.createdAt - a.createdAt)
  const hour = new Date().getHours()
  const hello = hour < 5 ? 'Boa noite' : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i))

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-top">
          <div className="grow">
            <h1>
              {hello}, {me.name}!
            </h1>
            <p>
              {WEEKDAYS_LONG[new Date().getDay()]}, {fmtDate(day, { day: 'numeric', month: 'long' })}
            </p>
          </div>
          <a href="#settings" className="avatars hero-avatars" aria-label="Membros da família">
            {members.slice(0, 5).map((m) => (
              <Avatar key={m.id} member={m} size={34} />
            ))}
          </a>
        </div>
        <div className="week-strip">
          {week.map((d) => {
            const evs = eventsOn(allEvents, people, d)
            return (
              <a key={d} href="#calendar" className={'week-day' + (d === day ? ' on' : '')}>
                <small>{d === day ? 'hoje' : WEEKDAYS[parseYmd(d).getDay()]}</small>
                <b>{Number(d.slice(8))}</b>
                <span className="week-dots">
                  {evs.slice(0, 3).map((e) => (
                    <i key={e.id} />
                  ))}
                </span>
              </a>
            )
          })}
        </div>
      </section>

      <PushBanner />

      <div className="quick">
        {QUICK.map(([href, ic, label, tint]) => (
          <a key={label} href={href} className="quick-btn" style={{ '--t': tint }}>
            <span className="tile-ic">
              <Icon name={ic} />
            </span>
            {label}
          </a>
        ))}
      </div>

      <div className="dash">
        <section className="card dash-card">
          <a href="#calendar" className="dash-head">
            <h3>Hoje</h3>
            <span className="muted small">Agenda ›</span>
          </a>
          {events.length ? (
            events.slice(0, 5).map((e) => (
              <div key={e.id} className="timeline" style={{ '--c': byId(st, e.members?.[0])?.color || (e.birthday ? '#ffb224' : 'var(--muted)') }}>
                <b>{e.allDay ? 'Dia todo' : e.start}</b>
                <span>{e.title}</span>
              </div>
            ))
          ) : (
            <p className="muted">Dia livre ✨</p>
          )}
          {meal.length > 0 && (
            <a href="#meals" className="meal-today">
              🍽️ {meal.map((m) => `${m.slot}: ${m.title}`).join(' · ')}
            </a>
          )}
        </section>

        <ShoppingCard />

        <section className="card dash-card">
          <a href="#tasks" className="dash-head">
            <h3>Minhas tarefas</h3>
            <span className="muted small">Todas ›</span>
          </a>
          {myTasks.length ? (
            myTasks.slice(0, 5).map((t) => (
              <label key={t.id} className="mini-check">
                <input
                  type="checkbox"
                  onChange={() => {
                    vibrate()
                    update(t.id, { done: true, doneBy: st.me, doneAt: Date.now() })
                    toast(`“${t.title}” concluída 🎉`, { label: 'Desfazer', run: () => update(t.id, { done: false }) })
                  }}
                />
                <span className="grow">{t.title}</span>
                {t.due && <small className={t.due < day ? 'late' : 'muted'}>{fmtDate(t.due, { day: 'numeric', month: 'short' })}</small>}
              </label>
            ))
          ) : (
            <p className="muted">Tudo feito 🎉</p>
          )}
        </section>
      </div>

      <h2 className="section-title">Mural da família</h2>
      <Composer />

      {posts.length === 0 && <Empty icon="📌" text="O mural está vazio. Escreva um recado ou poste uma foto para a família." />}
      {posts.map((p) => (
        <Post key={p.id} post={p} />
      ))}
    </div>
  )
}

// Adicionar às compras direto da página inicial.
function ShoppingCard() {
  const st = useStore()
  const [text, setText] = useState('')
  const lists = list(st, 'list').sort((a, b) => a.createdAt - b.createdAt)
  const shop = lists.find((l) => /compra/i.test(l.title)) || lists[0]
  const items = shop ? list(st, 'listItem').filter((i) => i.listId === shop.id && !i.done).sort((a, b) => a.createdAt - b.createdAt) : []
  const add = (e) => {
    e.preventDefault()
    let target = shop
    if (!target) target = save('list', { title: 'Compras', icon: '🛒' })
    const names = text.split(/[,\n]/).map((t) => t.trim()).filter(Boolean)
    names.forEach((title) => save('listItem', { listId: target.id, title, done: false }))
    if (names.length) toast(`Adicionado às ${target.title.toLowerCase()} 🛒`)
    setText('')
  }
  return (
    <section className="card dash-card">
      <a href="#lists" className="dash-head">
        <h3>{shop?.icon || '🛒'} {shop?.title || 'Compras'}</h3>
        <span className="muted small">{items.length} pendente{items.length === 1 ? '' : 's'} ›</span>
      </a>
      <form className="quick-add" onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Adicionar item…" enterKeyHint="done" />
        <button className="icon-btn" aria-label="Adicionar" disabled={!text.trim()}>
          <Icon name="plus" />
        </button>
      </form>
      {items.slice(0, 6).map((i) => (
        <label key={i.id} className="mini-check">
          <input
            type="checkbox"
            onChange={() => {
              vibrate()
              update(i.id, { done: true, doneBy: st.me })
            }}
          />
          <span className="grow">{i.title}</span>
        </label>
      ))}
      {items.length > 6 && <a href="#lists" className="muted small">+ {items.length - 6} itens</a>}
    </section>
  )
}

function Composer() {
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const pick = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setBusy(true)
    setPhoto(await resizeImage(f))
    setBusy(false)
  }
  const post = (e) => {
    e.preventDefault()
    if (!text.trim() && !photo) return
    const p = save('post', { text: text.trim(), photo, likes: [], comments: [] })
    if (photo) save('photo', { src: photo, caption: text.trim(), album: 'Mural', postId: p.id })
    setText('')
    setPhoto(null)
  }
  return (
    <form className="card composer" onSubmit={post}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva um recado para a família…" rows={2} />
      {photo && (
        <div className="preview">
          <img src={photo} alt="" />
          <button type="button" className="icon-btn" onClick={() => setPhoto(null)}>
            ✕
          </button>
        </div>
      )}
      <div className="row">
        <label className="btn ghost">
          📷 Foto
          <input type="file" accept="image/*" hidden onChange={pick} />
        </label>
        <span className="grow" />
        <button className="btn primary" disabled={busy}>
          Publicar
        </button>
      </div>
    </form>
  )
}

function Post({ post }) {
  const st = useStore()
  const author = byId(st, post.createdBy)
  const [comment, setComment] = useState('')
  const likes = post.likes || []
  const liked = likes.includes(st.me)
  const toggleLike = () => update(post.id, { likes: liked ? likes.filter((l) => l !== st.me) : [...likes, st.me] })
  const addComment = (e) => {
    e.preventDefault()
    if (!comment.trim()) return
    update(post.id, { comments: [...(post.comments || []), { by: st.me, text: comment.trim(), at: Date.now() }] })
    setComment('')
  }
  const del = () => {
    if (!confirm('Apagar esta publicação?')) return
    remove(post.id)
    list(st, 'photo')
      .filter((ph) => ph.postId === post.id)
      .forEach((ph) => remove(ph.id))
  }
  return (
    <article className="card post">
      <header className="row">
        <Avatar member={author} />
        <div className="grow">
          <b>{author?.name || 'Alguém'}</b>
          <div className="muted small">{timeAgo(post.createdAt)}</div>
        </div>
        {post.createdBy === st.me && (
          <button className="icon-btn" onClick={del} aria-label="Apagar">
            🗑
          </button>
        )}
      </header>
      {post.text && <p className="post-text">{post.text}</p>}
      {post.photo && <img className="post-photo" src={post.photo} alt="" />}
      <div className="row post-actions">
        <button className={'btn ghost' + (liked ? ' liked' : '')} onClick={toggleLike}>
          {liked ? '❤️' : '🤍'} {likes.length || ''}
        </button>
        <span className="muted small">{likes.map((l) => byId(st, l)?.name).filter(Boolean).join(', ')}</span>
      </div>
      {(post.comments || []).map((c, i) => (
        <div key={i} className="comment">
          <Avatar member={byId(st, c.by)} size={24} />
          <div>
            <b>{byId(st, c.by)?.name}</b> {c.text}
          </div>
        </div>
      ))}
      <form className="row" onSubmit={addComment}>
        <input className="grow" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentar…" />
      </form>
    </article>
  )
}
