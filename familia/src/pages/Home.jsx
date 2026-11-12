import { useState } from 'react'
import { byId, list, remove, save, update, useStore } from '../store.js'
import { addDays, daysUntil, eventsOn, fmtDate, nextBirthday, nextOccurrence, parseYmd, resizeImage, timeAgo, today, WEEKDAYS, WEEKDAYS_LONG } from '../utils.js'
import { Avatar, Empty, useMembers } from '../ui.jsx'
import { Icon } from '../icons.jsx'
import { toast, vibrate } from '../toast.jsx'
import { PushBanner } from './PushSettings.jsx'
import { abrirMagia } from './Magia.jsx'
import CasaViva from './Casa.jsx'
import { toggleTask } from './Tasks.jsx'
import { SLOTS } from './Meals.jsx'
import { activeItems, addItems, ItemSuggestions } from './Lists.jsx'

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
  const meal = list(st, 'meal')
    .filter((m) => m.date === day)
    .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot))
  const posts = list(st, 'post').sort((a, b) => b.createdAt - a.createdAt)
  const hour = new Date().getHours()
  const hello = hour < 5 ? 'Boa noite' : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i))

  return (
    <div className="page">
      <CasaViva saudacao={`${hello}, ${me.name}!`} data={`${WEEKDAYS_LONG[new Date().getDay()]}, ${fmtDate(day, { day: 'numeric', month: 'long' })}`} />

      <section className="hero hero-semana">
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

      <button type="button" className="magia-barra" onClick={() => abrirMagia()}>
        <Icon name="spark" />
        <span className="grow">Escreva ou fale: “dentista amanhã às 15h”</span>
        <Icon name="mic" size={20} />
      </button>

      <PushBanner />
      <Countdowns />

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
                    toggleTask(t, st.me)
                    toast(`“${t.title}” concluída 🎉`)
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
  const items = shop ? activeItems(st).filter((i) => i.listId === shop.id && !i.done).sort((a, b) => a.createdAt - b.createdAt) : []
  const add = (e) => {
    e.preventDefault()
    let target = shop
    if (!target) target = save('list', { title: 'Compras', icon: '🛒' })
    const added = addItems(st, target.id, text)
    toast(added.length ? `Adicionado às ${target.title.toLowerCase()} 🛒` : 'Já estava na lista')
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
      {shop && text.trim() && (
        <ItemSuggestions
          listId={shop.id}
          text={text}
          max={5}
          onPick={(title, rest) => {
            addItems(st, shop.id, title)
            vibrate()
            setText(rest ? rest + ', ' : '')
          }}
        />
      )}
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
  const [poll, setPoll] = useState(null) // lista de opções quando é votação
  const pick = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setBusy(true)
    setPhoto(await resizeImage(f))
    setBusy(false)
  }
  const post = (e) => {
    e.preventDefault()
    if (poll) {
      const options = poll.map((o) => o.trim()).filter(Boolean)
      if (!text.trim()) return toast('Escreva a pergunta da votação')
      if (options.length < 2) return toast('Coloque pelo menos 2 opções')
      save('post', { text: text.trim(), poll: { options: options.map((t, i) => ({ id: 'o' + i, text: t })) }, likes: [], comments: [] })
      setText('')
      setPoll(null)
      return
    }
    if (!text.trim() && !photo) return
    const p = save('post', { text: text.trim(), photo, likes: [], comments: [] })
    if (photo) save('photo', { src: photo, caption: text.trim(), album: 'Mural', postId: p.id })
    setText('')
    setPhoto(null)
  }
  return (
    <form className="card composer" onSubmit={post}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={poll ? 'Qual a pergunta? Ex.: Pizza ou hambúrguer no sábado?' : 'Escreva um recado para a família…'} rows={2} />
      {poll && (
        <div className="poll-edit">
          {poll.map((o, i) => (
            <div key={i} className="row">
              <input
                className="grow"
                value={o}
                onChange={(e) => setPoll(poll.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`Opção ${i + 1}`}
                autoFocus={i === poll.length - 1 && i > 1}
              />
              {poll.length > 2 && (
                <button type="button" className="icon-btn small" onClick={() => setPoll(poll.filter((_, j) => j !== i))} aria-label="Tirar opção">
                  ✕
                </button>
              )}
            </div>
          ))}
          {poll.length < 6 && (
            <button type="button" className="btn ghost small" onClick={() => setPoll([...poll, ''])}>
              + Opção
            </button>
          )}
        </div>
      )}
      {photo && (
        <div className="preview">
          <img src={photo} alt="" />
          <button type="button" className="icon-btn" onClick={() => setPhoto(null)}>
            ✕
          </button>
        </div>
      )}
      <div className="row">
        {!poll && (
          <label className="btn ghost">
            📷 Foto
            <input type="file" accept="image/*" hidden onChange={pick} />
          </label>
        )}
        <button
          type="button"
          className={'btn ghost' + (poll ? ' on' : '')}
          onClick={() => {
            setPoll(poll ? null : ['', ''])
            setPhoto(null)
          }}
        >
          {poll ? '✕ Cancelar votação' : '📊 Votação'}
        </button>
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
    list(st, 'vote')
      .filter((v) => v.postId === post.id)
      .forEach((v) => remove(v.id))
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
      {post.poll && <Poll post={post} />}
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

// Votação: cada pessoa tem um voto por votação (registro próprio, para votos simultâneos não se perderem).
function Poll({ post }) {
  const st = useStore()
  const members = useMembers()
  const votes = list(st, 'vote').filter((v) => v.postId === post.id && v.option)
  const myId = `vote-${post.id}-${st.me}`
  const mine = votes.find((v) => v.id === myId)?.option
  const total = votes.length
  const counts = Object.fromEntries(post.poll.options.map((o) => [o.id, votes.filter((v) => v.option === o.id)]))
  const top = Math.max(0, ...Object.values(counts).map((v) => v.length))
  const missing = members.filter((m) => !votes.some((v) => v.createdBy === m.id))
  const closed = !!post.closed
  const vote = (id) => {
    if (closed) return
    vibrate()
    save('vote', { id: myId, postId: post.id, option: mine === id ? null : id, createdBy: st.me })
  }
  return (
    <div className={'poll' + (closed ? ' closed' : '')}>
      {post.poll.options.map((o) => {
        const vs = counts[o.id]
        const pct = total ? Math.round((vs.length / total) * 100) : 0
        const win = closed && vs.length === top && top > 0
        return (
          <button key={o.id} type="button" className={'poll-opt' + (mine === o.id ? ' mine' : '') + (win ? ' win' : '')} onClick={() => vote(o.id)} disabled={closed}>
            <i style={{ width: pct + '%' }} />
            <span className="grow">
              {mine === o.id && '✓ '}
              {win && '🏆 '}
              {o.text}
            </span>
            <span className="avatars">
              {vs.slice(0, 4).map((v) => (
                <Avatar key={v.id} member={byId(st, v.createdBy)} size={20} />
              ))}
            </span>
            <b>{pct}%</b>
          </button>
        )
      })}
      <div className="row muted small">
        <span className="grow">
          {closed ? 'Votação encerrada' : total ? `${total} voto${total > 1 ? 's' : ''}` : 'Toque numa opção para votar'}
          {!closed && missing.length > 0 && total > 0 && ` · falta: ${missing.map((m) => m.name).join(', ')}`}
        </span>
        {post.createdBy === st.me && (
          <button type="button" className="link" onClick={() => update(post.id, { closed: !closed })}>
            {closed ? 'reabrir' : 'encerrar'}
          </button>
        )}
      </div>
    </div>
  )
}

// Contagens regressivas: eventos marcados e aniversários dos próximos 30 dias.
function Countdowns() {
  const st = useStore()
  const day = today()
  const cards = []
  for (const ev of list(st, 'event')) {
    if (!ev.countdown) continue
    const d = nextOccurrence(ev, day)
    if (d) cards.push({ id: ev.id, title: ev.title, date: d, n: daysUntil(d, day), href: '#calendar', color: byId(st, ev.members?.[0])?.color })
  }
  for (const p of [...list(st, 'member'), ...list(st, 'contact')]) {
    if (!p.birthday) continue
    const d = nextBirthday(p.birthday, day)
    const n = daysUntil(d, day)
    if (n > 30) continue
    const age = Number(d.slice(0, 4)) - Number(p.birthday.slice(0, 4))
    cards.push({
      id: 'bday-' + p.id,
      title: `Aniversário de ${p.name}${age > 0 && age < 130 ? ` (${age})` : ''}`,
      date: d,
      n,
      emoji: '🎂',
      href: p.type === 'member' ? '#wishes/' + p.id : '#calendar',
      action: p.type === 'member' && p.id !== st.me ? 'Ver lista de desejos ›' : null,
      color: p.color || '#ffb224',
    })
  }
  cards.sort((a, b) => a.n - b.n)
  if (!cards.length) return null
  return (
    <div className="countdowns">
      {cards.slice(0, 6).map((c) => (
        <a key={c.id} href={c.href} className="card countdown" style={{ '--c': c.color || 'var(--primary)' }}>
          <div className="cd-num">
            {c.n === 0 ? (
              <b>{c.emoji || '🎉'}</b>
            ) : (
              <>
                <b>{c.n}</b>
                <small>{c.n === 1 ? 'dia' : 'dias'}</small>
              </>
            )}
          </div>
          <div className="grow cd-text">
            <span className="small muted">{c.n === 0 ? 'É hoje!' : c.n === 1 ? 'Amanhã' : `Faltam ${c.n} dias`}</span>
            <b>
              {c.emoji && c.n > 0 ? c.emoji + ' ' : ''}
              {c.title}
            </b>
            <span className="small muted">{c.action || fmtDate(c.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </div>
        </a>
      ))}
    </div>
  )
}
