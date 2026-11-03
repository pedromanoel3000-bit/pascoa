import { useState } from 'react'
import { byId, list, remove, save, update, useStore } from '../store.js'
import { eventsOn, fmtDate, resizeImage, timeAgo, today, WEEKDAYS_LONG } from '../utils.js'
import { Avatar, Empty } from '../ui.jsx'

export default function Home() {
  const st = useStore()
  const me = byId(st, st.me)
  const day = today()
  const people = [...list(st, 'member'), ...list(st, 'contact')]
  const events = eventsOn(list(st, 'event'), people, day)
  const myTasks = list(st, 'task').filter((t) => !t.done && (!t.assignee || t.assignee === st.me))
  const shopping = list(st, 'listItem').filter((i) => !i.done)
  const meal = list(st, 'meal').filter((m) => m.date === day)
  const posts = list(st, 'post').sort((a, b) => b.createdAt - a.createdAt)
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="page">
      <h1 className="greet">
        {hello}, {me.name}!
      </h1>
      <p className="muted">
        {WEEKDAYS_LONG[new Date().getDay()]}, {fmtDate(day, { day: 'numeric', month: 'long' })}
      </p>

      <div className="dash">
        <a href="#calendar" className="card dash-card">
          <h3>📅 Hoje</h3>
          {events.length ? (
            events.slice(0, 4).map((e) => (
              <div key={e.id} className="dash-line">
                <b>{e.allDay ? 'Dia todo' : e.start}</b> {e.title}
              </div>
            ))
          ) : (
            <p className="muted">Nada na agenda</p>
          )}
        </a>
        <a href="#tasks" className="card dash-card">
          <h3>✅ Minhas tarefas</h3>
          {myTasks.length ? (
            myTasks.slice(0, 4).map((t) => (
              <div key={t.id} className="dash-line">
                {t.title} {t.due && <small className="muted">· {fmtDate(t.due)}</small>}
              </div>
            ))
          ) : (
            <p className="muted">Tudo feito 🎉</p>
          )}
        </a>
        <a href="#lists" className="card dash-card">
          <h3>🛒 Listas</h3>
          <p>
            <b className="big-num">{shopping.length}</b> itens pendentes
          </p>
        </a>
        <a href="#meals" className="card dash-card">
          <h3>🍽️ Cardápio de hoje</h3>
          {meal.length ? (
            meal.map((m) => (
              <div key={m.id} className="dash-line">
                <b>{m.slot}</b> {m.title}
              </div>
            ))
          ) : (
            <p className="muted">Ainda não planejado</p>
          )}
        </a>
      </div>

      <Composer />

      {posts.length === 0 && <Empty icon="📌" text="O mural está vazio. Escreva um recado ou poste uma foto para a família." />}
      {posts.map((p) => (
        <Post key={p.id} post={p} />
      ))}
    </div>
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
