import { useRef, useState } from 'react'
import { byId, list, remove, save, update, useStore } from '../store.js'
import { Avatar, Empty, Field, Modal, PageHeader, useNewIntent } from '../ui.jsx'
import { Swipe, toast, vibrate } from '../toast.jsx'
import { separarLista } from '../utils.js'

const ICONS = ['🛒', '🧹', '🎁', '🧳', '💊', '📚', '🔧', '🎉', '📝', '🐾']

// Itens limpos com "Limpar" ficam arquivados: somem da lista, mas servem de histórico para as sugestões.
export const activeItems = (st) => list(st, 'listItem').filter((i) => !i.archived)
const norm = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

// Ordem dos itens: a escolhida ao arrastar (`ordem`) ou, sem ela, a de quando foi adicionado.
export const ordemDe = (i) => (typeof i.ordem === 'number' ? i.ordem : i.createdAt || 0)
export const porOrdem = (a, b) => ordemDe(a) - ordemDe(b)

// Leva o item da posição `de` para a posição `para`. Só o item movido é gravado (com um número entre os
// vizinhos), para duas pessoas mexendo na lista ao mesmo tempo não desfazerem a ordem uma da outra.
export function moverItem(lista, de, para) {
  if (de === para || de < 0 || para < 0 || para >= lista.length) return
  const sem = lista.filter((_, k) => k !== de)
  const antes = sem[para - 1]
  const depois = sem[para]
  if (antes && depois && ordemDe(depois) - ordemDe(antes) < 1e-6) {
    // Sem espaço entre os vizinhos (depois de muitas trocas no mesmo lugar): renumera a lista toda.
    const nova = [...sem.slice(0, para), lista[de], ...sem.slice(para)]
    const base = ordemDe(nova[0])
    nova.forEach((i, k) => update(i.id, { ordem: base + k * 1000 }))
    return
  }
  const ordem = antes && depois ? (ordemDe(antes) + ordemDe(depois)) / 2 : antes ? ordemDe(antes) + 1000 : ordemDe(depois) - 1000
  update(lista[de].id, { ordem })
}

// Arrastar pela alça para reordenar. Devolve o `ref` da lista, o estilo de cada linha e os eventos da alça.
function useArrastar(lista) {
  const ul = useRef(null)
  const [arr, setArrEstado] = useState(null) // { de, para, dy, y0, alturas, centros }
  // A posição fica também num ref: o "soltar" pode chegar antes de a tela redesenhar o último movimento.
  const atual = useRef(null)
  const setArr = (v) => {
    atual.current = v
    setArrEstado(v)
  }
  const inicio = (k) => (e) => {
    e.stopPropagation()
    if (e.button > 0) return
    const rects = [...ul.current.children].map((li) => li.getBoundingClientRect())
    try {
      e.currentTarget.setPointerCapture(e.pointerId) // o dedo continua "preso" à alça mesmo saindo dela
    } catch {}
    setArr({ de: k, para: k, dy: 0, y0: e.clientY, alturas: rects.map((r) => r.height), centros: rects.map((r) => r.top + r.height / 2) })
    vibrate(15)
  }
  const mover = (e) => {
    e.stopPropagation()
    const a = atual.current
    if (!a) return
    const dy = e.clientY - a.y0
    const centro = a.centros[a.de] + dy
    const para = a.centros.filter((c, k) => k !== a.de && c < centro).length
    if (para !== a.para) vibrate(8)
    setArr({ ...a, dy, para })
  }
  const fim = (e) => {
    e.stopPropagation()
    const a = atual.current
    if (!a) return
    moverItem(lista, a.de, a.para)
    setArr(null)
  }
  const teclas = (k) => (e) => {
    const alvo = e.key === 'ArrowUp' ? k - 1 : e.key === 'ArrowDown' ? k + 1 : null
    if (alvo === null) return
    e.preventDefault()
    moverItem(lista, k, alvo)
  }
  const estilo = (k) => {
    if (!arr) return undefined
    if (k === arr.de) return { transform: `translateY(${arr.dy}px)`, transition: 'none', zIndex: 3 }
    const h = arr.alturas[arr.de]
    if (arr.de < arr.para && k > arr.de && k <= arr.para) return { transform: `translateY(${-h}px)` }
    if (arr.de > arr.para && k >= arr.para && k < arr.de) return { transform: `translateY(${h}px)` }
    return undefined
  }
  const alca = (k) => ({ onPointerDown: inicio(k), onPointerMove: mover, onPointerUp: fim, onPointerCancel: () => setArr(null), onKeyDown: teclas(k) })
  return { ul, estilo, alca, arrastando: arr ? arr.de : null }
}

// Adiciona um ou vários itens, sem repetir o que já está pendente. `text` pode ser uma lista de títulos
// ou o texto digitado (separado por vírgula ou linha; vírgula de preço e parênteses não separam).
export function addItems(st, listId, text) {
  const pending = new Set(activeItems(st).filter((i) => i.listId === listId && !i.done).map((i) => norm(i.title)))
  const added = []
  for (const title of (Array.isArray(text) ? text : separarLista(text)).map((t) => String(t).trim()).filter(Boolean)) {
    if (pending.has(norm(title))) continue
    pending.add(norm(title))
    save('listItem', { listId, title, done: false })
    added.push(title)
  }
  return added
}

// O que mais aparece nesta lista ao longo do tempo.
export function frequentItems(st, listId) {
  const map = new Map()
  for (const i of list(st, 'listItem')) {
    if (i.listId !== listId || !i.title) continue
    const k = norm(i.title)
    const cur = map.get(k) || { key: k, title: i.title, n: 0, last: 0 }
    cur.n += 1
    if ((i.createdAt || 0) >= cur.last) {
      cur.last = i.createdAt || 0
      cur.title = i.title
    }
    map.set(k, cur)
  }
  return [...map.values()].sort((a, b) => b.n - a.n || b.last - a.last)
}

// Sugestões enquanto digita (ou os mais comprados, com o campo vazio).
export function ItemSuggestions({ listId, text, onPick, max = 8, emptyLabel = 'Comprar de novo' }) {
  const st = useStore()
  const pending = new Set(activeItems(st).filter((i) => i.listId === listId && !i.done).map((i) => norm(i.title)))
  const typed = norm(separarLista(text).pop() || '')
  let options = frequentItems(st, listId).filter((f) => !pending.has(f.key))
  if (typed) options = options.filter((f) => f.key.includes(typed) && f.key !== typed).sort((a, b) => b.key.startsWith(typed) - a.key.startsWith(typed))
  else if (text.trim()) options = []
  options = options.slice(0, max)
  if (!options.length) return null
  const pick = (title) => {
    const parts = separarLista(text)
    parts.pop()
    onPick(title, parts.map((p) => p.trim()).filter(Boolean).join(', '))
  }
  return (
    <div className="suggest">
      {!typed && <small className="muted">{emptyLabel}:</small>}
      {options.map((f) => (
        <button type="button" key={f.key} className="chip suggest-chip" onClick={() => pick(f.title)}>
          + {f.title}
          {f.n > 1 && <small className="muted"> {f.n}×</small>}
        </button>
      ))}
    </div>
  )
}

export default function Lists() {
  const st = useStore()
  const lists = list(st, 'list').sort((a, b) => a.createdAt - b.createdAt)
  const [openId, setOpenId] = useState(null)
  const [editing, setEditing] = useState(null)
  useNewIntent(() => setOpenId((lists.find((l) => /compra/i.test(l.title)) || lists[0])?.id || null))
  const current = lists.find((l) => l.id === openId) || null
  const items = activeItems(st)

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
  const items = activeItems(st)
    .filter((i) => i.listId === lst.id)
    .sort(porOrdem)
  const pending = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)
  const arrastar = useArrastar(pending)

  const add = (e) => {
    e.preventDefault()
    addItems(st, lst.id, text)
    setText('')
  }
  const pick = (title, rest) => {
    addItems(st, lst.id, title)
    vibrate()
    setText(rest ? rest + ', ' : '')
  }
  const clearDone = () => {
    const before = done
    before.forEach((i) => update(i.id, { archived: true }))
    toast(before.length === 1 ? '1 item limpo' : `${before.length} itens limpos`, { label: 'Desfazer', run: () => before.forEach((i) => update(i.id, { archived: false })) })
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
      <ItemSuggestions listId={lst.id} text={text} onPick={pick} max={text.trim() ? 6 : 12} emptyLabel={/compra/i.test(lst.title) ? 'Comprar de novo' : 'Usados antes'} />
      {items.length === 0 && <Empty icon="📝" text="Lista vazia." />}
      <ul className={'checklist' + (arrastar.arrastando !== null ? ' reordenando' : '')} ref={arrastar.ul}>
        {pending.map((i, k) => (
          <Item key={i.id} item={i} style={arrastar.estilo(k)} arrastando={arrastar.arrastando === k} alca={pending.length > 1 ? arrastar.alca(k) : null} />
        ))}
      </ul>
      {pending.length > 1 && <p className="muted small dica-ordem">Segure ⋮⋮ e arraste para mudar a ordem.</p>}
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

function Item({ item, style, arrastando, alca }) {
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
    <Swipe as="li" className={arrastando ? 'arrastando' : ''} style={style} onRight={toggle} onLeft={del} rightLabel={item.done ? 'Voltar' : 'Pegou ✓'}>
      {alca && (
        <button type="button" className="alca" aria-label={`Mover “${item.title}” (setas para cima e para baixo)`} {...alca}>
          <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden="true">
            {[4, 10, 16].map((y) => [4, 10].map((x) => <circle key={x + '-' + y} cx={x} cy={y} r="1.7" fill="currentColor" />))}
          </svg>
        </button>
      )}
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
