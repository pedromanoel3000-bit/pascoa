import { useState } from 'react'
import { byId, list, remove, save, useStore } from '../store.js'
import { fmtDate, money, MONTHS, pad, today } from '../utils.js'
import { Avatar, Empty, Fab, Field, MemberPicker, Modal, PageHeader, Segmented } from '../ui.jsx'

const CATS = ['Mercado', 'Casa', 'Contas', 'Transporte', 'Saúde', 'Escola', 'Lazer', 'Roupas', 'Salário', 'Outros']

export default function Budget() {
  const st = useStore()
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const [editing, setEditing] = useState(null)
  const entries = list(st, 'expense')
    .filter((e) => e.date?.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const income = entries.filter((e) => e.kind === 'in').reduce((s, e) => s + Number(e.amount), 0)
  const spent = entries.filter((e) => e.kind !== 'in').reduce((s, e) => s + Number(e.amount), 0)
  const byCat = CATS.map((c) => [c, entries.filter((e) => e.kind !== 'in' && e.category === c).reduce((s, e) => s + Number(e.amount), 0)])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...byCat.map(([, v]) => v))

  const [y, m] = month.split('-').map(Number)
  const shift = (n) => {
    const d = new Date(y, m - 1 + n, 1)
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
  }

  return (
    <div className="page">
      <PageHeader title="Orçamento" />
      <div className="cal-nav">
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mês anterior">
          ‹
        </button>
        <h2>
          {MONTHS[m - 1]} {y}
        </h2>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Próximo mês">
          ›
        </button>
      </div>
      <div className="budget-sum">
        <div className="card">
          <small>Entradas</small>
          <b className="pos">{money(income)}</b>
        </div>
        <div className="card">
          <small>Gastos</small>
          <b className="neg">{money(spent)}</b>
        </div>
        <div className="card">
          <small>Saldo</small>
          <b className={income - spent >= 0 ? 'pos' : 'neg'}>{money(income - spent)}</b>
        </div>
      </div>
      {byCat.length > 0 && (
        <div className="card">
          <h3>Gastos por categoria</h3>
          {byCat.map(([c, v]) => (
            <div key={c} className="bar-row">
              <span>{c}</span>
              <div className="bar">
                <i style={{ width: `${(v / max) * 100}%` }} />
              </div>
              <b>{money(v)}</b>
            </div>
          ))}
        </div>
      )}
      <h3 className="section-title">Lançamentos</h3>
      {entries.length === 0 && <Empty icon="💰" text="Nenhum lançamento neste mês." />}
      {entries.map((e) => (
        <button key={e.id} className="card event-row" onClick={() => setEditing(e)}>
          <Avatar member={byId(st, e.member || e.createdBy)} size={30} />
          <div className="grow">
            <b>{e.title}</b>
            <div className="muted small">
              {fmtDate(e.date)} · {e.category}
            </div>
          </div>
          <b className={e.kind === 'in' ? 'pos' : 'neg'}>
            {e.kind === 'in' ? '+' : '−'} {money(e.amount)}
          </b>
        </button>
      ))}
      <Fab onClick={() => setEditing({})} label="Novo lançamento" />
      {editing && <EntryForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EntryForm({ initial, onClose }) {
  const st = useStore()
  const [e, setE] = useState({ kind: 'out', title: '', amount: '', date: today(), category: 'Mercado', member: st.me, ...initial })
  const set = (k) => (ev) => setE({ ...e, [k]: ev.target.value })
  return (
    <Modal title={e.id ? 'Editar lançamento' : 'Novo lançamento'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(ev) => {
          ev.preventDefault()
          save('expense', { ...e, amount: Number(String(e.amount).replace(',', '.')) || 0 })
          onClose()
        }}
      >
        <Segmented options={[['out', 'Gasto'], ['in', 'Entrada']]} value={e.kind} onChange={(kind) => setE({ ...e, kind })} />
        <Field label="Descrição">
          <input value={e.title} onChange={set('title')} required autoFocus />
        </Field>
        <div className="row2">
          <Field label="Valor (R$)">
            <input inputMode="decimal" value={e.amount} onChange={set('amount')} required placeholder="0,00" />
          </Field>
          <Field label="Data">
            <input type="date" value={e.date} onChange={set('date')} required />
          </Field>
        </div>
        <Field label="Categoria">
          <select value={e.category} onChange={set('category')}>
            {CATS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Quem">
          <MemberPicker single value={e.member ? [e.member] : []} onChange={(v) => setE({ ...e, member: v[0] || null })} />
        </Field>
        <div className="row">
          {e.id && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                remove(e.id)
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
