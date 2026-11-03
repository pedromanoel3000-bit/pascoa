import { useState } from 'react'
import { byId, list, remove, save, update, useStore } from '../store.js'
import { Avatar, Empty, Field, Modal, PageHeader, useNewIntent } from '../ui.jsx'
import { Swipe, toast, vibrate } from '../toast.jsx'

const ICONS = ['🛒', '🧹', '🎁', '🧳', '💊', '📚', '🔧', '🎉', '📝', '🐾']

export default function Lists() {
  const st = useStore()
  const lists = list(st, 'list').sort((a, b) => a.createdAt - b.createdAt)
  const [openId, setOpenId] = useState(null)
  const [editing, setEditing] = useState(null)
  useNewIntent(() => setOpenId((lists.find((l) => /compra/i.test(l.title)) || lists[0])?.id || null))
  const current = lists.find((l) => l.id === openId) || null
  const items = list(st, 'listItem')

  if (current) return <ListDetail lst={current} onBack={() => setOpenId(null)} onEdit={() => setEditing(current)} editing={editing} setEditing={setEditing} />

  return (
    <div className="page">
      <PageHeader title="Listas">
        <button className="btn primary" onClick={() => setEditing({})}>
          + Nova lista
        </button>
      </PageHeader>
      {lists.length === 0 && <Empty icon="🛒" text="Crie uma lista de compras, de afazeres ou de viagem." />}
      <div className="tiles">
        {lists.map((l) => {
          const its = items.filter((i) => i.listId === l.id)
          const left = its.filter((i) => !i.done).length
          return (
            <button key={l.id} className="card tile" onClick={() => setOpenId(l.id)}>
              <span className="tile-icon">{l.icon || '📝'}</span>
              <b>{l.title}</b>
              <span className="muted small">{left ? `${left} pendente${left > 1 ? 's' : ''}` : its.length ? 'Tudo feito ✔' : 'Vazia'}</span>
            </button>
          )
        })}
      </div>
      {editing && <ListForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ListDetail({ lst, onBack, onEdit, editing, setEditing }) {
  const st = useStore()
  const [text, setText] = useState('')
  const items = list(st, 'listItem')
    .filter((i) => i.listId === lst.id)
    .sort((a, b) => a.createdAt - b.createdAt)
  const pending = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)

  const add = (e) => {
    e.preventDefault()
    // Aceita vários itens separados por vírgula ou quebra de linha.
    text
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((title) => save('listItem', { listId: lst.id, title, done: false }))
    setText('')
  }
  const clearDone = () => {
    const before = done
    before.forEach((i) => remove(i.id))
    toast(`${before.length} item(ns) limpo(s)`, { label: 'Desfazer', run: () => before.forEach((i) => save('listItem', { ...i, deleted: false })) })
  }

  return (
    <div className="page">
      <PageHeader title={`${lst.icon || ''} ${lst.title}`}>
        <button className="btn ghost" onClick={onBack}>
          ‹ Listas
        </button>
        <button className="icon-btn" onClick={onEdit} aria-label="Editar lista">
          ✏️
        </button>
      </PageHeader>
      <form className="row add-row" onSubmit={add}>
        <input className="grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Adicionar item (ex.: leite, pão, ovos)" autoFocus />
        <button className="btn primary">Adicionar</button>
      </form>
      {items.length === 0 && <Empty icon="📝" text="Lista vazia." />}
      <ul className="checklist">
        {pending.map((i) => (
          <Item key={i.id} item={i} />
        ))}
      </ul>
      {done.length > 0 && (
        <>
          <div className="row section-title">
            <h3 className="grow">Concluídos ({done.length})</h3>
            <button className="btn ghost small" onClick={clearDone}>
              Limpar
            </button>
          </div>
          <ul className="checklist done">
            {done.map((i) => (
              <Item key={i.id} item={i} />
            ))}
          </ul>
        </>
      )}
      {editing && <ListForm initial={editing} onClose={() => setEditing(null)} onDeleted={onBack} />}
    </div>
  )
}

function Item({ item }) {
  const st = useStore()
  const [edit, setEdit] = useState(false)
  const [title, setTitle] = useState(item.title)
  const who = byId(st, item.doneBy || item.createdBy)
  const toggle = () => {
    if (!item.done) vibrate()
    update(item.id, { done: !item.done, doneBy: item.done ? null : st.me })
  }
  const del = () => {
    const before = item
    remove(item.id)
    toast(`“${item.title}” removido`, { label: 'Desfazer', run: () => save('listItem', { ...before, deleted: false }) })
  }
  const finish = () => {
    if (title.trim() && title !== item.title) update(item.id, { title: title.trim() })
    setEdit(false)
  }
  return (
    <Swipe as="li" onRight={toggle} onLeft={del} rightLabel={item.done ? 'Voltar' : 'Pegou ✓'}>
      <input type="checkbox" checked={!!item.done} onChange={toggle} aria-label={item.title} />
      {edit ? (
        <form
          className="grow"
          onSubmit={(e) => {
            e.preventDefault()
            finish()
          }}
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={finish} autoFocus />
        </form>
      ) : (
        <span className="grow item-title" onClick={() => setEdit(true)}>
          {item.title}
        </span>
      )}
      <Avatar member={who} size={22} />
      <button className="icon-btn small" onClick={del} aria-label="Remover">
        ✕
      </button>
    </Swipe>
  )
}

function ListForm({ initial, onClose, onDeleted }) {
  const st = useStore()
  const [l, setL] = useState({ title: '', icon: '🛒', ...initial })
  const submit = (e) => {
    e.preventDefault()
    save('list', l)
    onClose()
  }
  const del = () => {
    if (!confirm('Apagar a lista e todos os itens?')) return
    list(st, 'listItem')
      .filter((i) => i.listId === l.id)
      .forEach((i) => remove(i.id))
    remove(l.id)
    onClose()
    onDeleted?.()
  }
  return (
    <Modal title={l.id ? 'Editar lista' : 'Nova lista'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Nome">
          <input value={l.title} onChange={(e) => setL({ ...l, title: e.target.value })} required autoFocus />
        </Field>
        <div className="emoji-row">
          {ICONS.map((i) => (
            <button type="button" key={i} className={'emoji' + (l.icon === i ? ' on' : '')} onClick={() => setL({ ...l, icon: i })}>
              {i}
            </button>
          ))}
        </div>
        <div className="row">
          {l.id && (
            <button type="button" className="btn danger" onClick={del}>
              Apagar
            </button>
          )}
          <span className="grow" />
          <button className="btn primary">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}
