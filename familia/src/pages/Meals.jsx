import { useState } from 'react'
import { list, remove, save, useStore } from '../store.js'
import { addDays, fmtDate, parseYmd, today } from '../utils.js'
import { Field, Modal, PageHeader } from '../ui.jsx'

const SLOTS = ['Café', 'Almoço', 'Jantar']

const weekStart = (d) => addDays(d, -((parseYmd(d).getDay() + 6) % 7)) // segunda-feira

export default function Meals() {
  const st = useStore()
  const [start, setStart] = useState(() => weekStart(today()))
  const [editing, setEditing] = useState(null)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const meals = list(st, 'meal')
  const recipes = list(st, 'recipe').sort((a, b) => a.title.localeCompare(b.title))
  const find = (date, slot) => meals.find((m) => m.date === date && m.slot === slot)

  const sendWeek = () => {
    const ing = meals.filter((m) => days.includes(m.date)).flatMap((m) => splitIng(m.ingredients))
    if (!ing.length) return alert('Nenhum ingrediente nas refeições desta semana.')
    const n = toShopping(st, ing)
    alert(`${n} ingrediente(s) enviado(s) para a lista de compras.`)
  }

  return (
    <div className="page">
      <PageHeader title="Refeições">
        <button className="btn ghost" onClick={sendWeek}>
          🛒 Ingredientes da semana
        </button>
      </PageHeader>
      <div className="cal-nav">
        <button className="icon-btn" onClick={() => setStart(addDays(start, -7))} aria-label="Semana anterior">
          ‹
        </button>
        <h2>
          {fmtDate(days[0], { day: 'numeric', month: 'short' })} – {fmtDate(days[6], { day: 'numeric', month: 'short' })}
        </h2>
        <button className="icon-btn" onClick={() => setStart(addDays(start, 7))} aria-label="Próxima semana">
          ›
        </button>
      </div>
      <div className="meal-week">
        {days.map((d) => (
          <div key={d} className={'card meal-day' + (d === today() ? ' today' : '')}>
            <h3>{fmtDate(d, { weekday: 'long', day: 'numeric' })}</h3>
            {SLOTS.map((slot) => {
              const m = find(d, slot)
              return (
                <button key={slot} className={'meal-slot' + (m ? ' filled' : '')} onClick={() => setEditing(m || { date: d, slot })}>
                  <small>{slot}</small>
                  <span>{m ? m.title : '+'}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <h3 className="section-title">📖 Receitas da família</h3>
      <div className="tiles">
        {recipes.map((r) => (
          <button key={r.id} className="card tile" onClick={() => setEditing({ recipe: r })}>
            <b>{r.title}</b>
            <span className="muted small">{splitIng(r.ingredients).length} ingredientes</span>
          </button>
        ))}
        <button className="card tile add" onClick={() => setEditing({ recipe: {} })}>
          + Receita
        </button>
      </div>
      {editing && (editing.recipe ? <RecipeForm initial={editing.recipe} onClose={() => setEditing(null)} /> : <MealForm initial={editing} recipes={recipes} onClose={() => setEditing(null)} />)}
    </div>
  )
}

const splitIng = (s) =>
  (s || '')
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean)

function toShopping(st, ingredients) {
  const lists = list(st, 'list')
  let shop = lists.find((l) => /compra/i.test(l.title)) || lists[0]
  if (!shop) shop = save('list', { title: 'Compras', icon: '🛒' })
  const existing = new Set(
    list(st, 'listItem')
      .filter((i) => i.listId === shop.id && !i.done)
      .map((i) => i.title.toLowerCase())
  )
  let n = 0
  for (const title of ingredients) {
    if (existing.has(title.toLowerCase())) continue
    existing.add(title.toLowerCase())
    save('listItem', { listId: shop.id, title, done: false })
    n++
  }
  return n
}

function MealForm({ initial, recipes, onClose }) {
  const st = useStore()
  const [m, setM] = useState({ title: '', ingredients: '', notes: '', ...initial })
  const set = (k) => (e) => setM({ ...m, [k]: e.target.value })
  const useRecipe = (id) => {
    const r = recipes.find((x) => x.id === id)
    if (r) setM({ ...m, title: r.title, ingredients: r.ingredients, recipeId: r.id })
  }
  const submit = (e) => {
    e.preventDefault()
    save('meal', m)
    onClose()
  }
  return (
    <Modal title={`${m.slot} · ${fmtDate(m.date)}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {recipes.length > 0 && (
          <Field label="Usar uma receita">
            <select value={m.recipeId || ''} onChange={(e) => useRecipe(e.target.value)}>
              <option value="">—</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Prato">
          <input value={m.title} onChange={set('title')} required autoFocus placeholder="Macarrão à bolonhesa" />
        </Field>
        <Field label="Ingredientes (um por linha ou separados por vírgula)">
          <textarea value={m.ingredients} onChange={set('ingredients')} rows={4} />
        </Field>
        <div className="row">
          {m.id && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                remove(m.id)
                onClose()
              }}
            >
              Apagar
            </button>
          )}
          {splitIng(m.ingredients).length > 0 && (
            <button type="button" className="btn ghost" onClick={() => alert(`${toShopping(st, splitIng(m.ingredients))} item(ns) enviado(s) para Compras.`)}>
              🛒 Para a lista
            </button>
          )}
          <span className="grow" />
          <button className="btn primary">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}

function RecipeForm({ initial, onClose }) {
  const [r, setR] = useState({ title: '', ingredients: '', steps: '', ...initial })
  const set = (k) => (e) => setR({ ...r, [k]: e.target.value })
  return (
    <Modal title={r.id ? r.title : 'Nova receita'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          save('recipe', r)
          onClose()
        }}
      >
        <Field label="Nome">
          <input value={r.title} onChange={set('title')} required autoFocus />
        </Field>
        <Field label="Ingredientes">
          <textarea value={r.ingredients} onChange={set('ingredients')} rows={5} />
        </Field>
        <Field label="Modo de preparo">
          <textarea value={r.steps} onChange={set('steps')} rows={6} />
        </Field>
        <div className="row">
          {r.id && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                remove(r.id)
                onClose()
              }}
            >
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
