import { useState } from 'react'
import { list, remove, save, useStore } from '../store.js'
import { Empty, Fab, Field, Modal, PageHeader } from '../ui.jsx'

const CATS = ['Família', 'Amigos', 'Saúde', 'Escola', 'Serviços', 'Emergência', 'Outros']

export default function Contacts() {
  const st = useStore()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const contacts = list(st, 'contact')
    .filter((c) => !q || `${c.name} ${c.phone} ${c.category}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
  const groups = CATS.map((cat) => [cat, contacts.filter((c) => (c.category || 'Outros') === cat)]).filter(([, l]) => l.length)

  return (
    <div className="page">
      <PageHeader title="Contatos" />
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar contato…" />
      {contacts.length === 0 && <Empty icon="📇" text="Guarde aqui o pediatra, a escola, o encanador, a vovó…" />}
      {groups.map(([cat, cs]) => (
        <div key={cat}>
          <h3 className="section-title">{cat}</h3>
          {cs.map((c) => (
            <div key={c.id} className="card contact-row">
              <button className="grow task-main" onClick={() => setEditing(c)}>
                <b>{c.name}</b>
                <span className="muted small">{[c.phone, c.email].filter(Boolean).join(' · ')}</span>
                {c.address && <span className="muted small">📍 {c.address}</span>}
                {c.birthday && <span className="muted small">🎂 {c.birthday.slice(8)}/{c.birthday.slice(5, 7)}</span>}
              </button>
              <a className="icon-btn" href={`#wishes/${c.id}`} aria-label={`Presentes para ${c.name}`}>
                🎁
              </a>
              {c.phone && (
                <>
                  <a className="icon-btn" href={`tel:${c.phone}`} aria-label="Ligar">
                    📞
                  </a>
                  <a className="icon-btn" href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                    💬
                  </a>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
      <Fab onClick={() => setEditing({})} label="Novo contato" />
      {editing && <ContactForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ContactForm({ initial, onClose }) {
  const [c, setC] = useState({ name: '', phone: '', email: '', address: '', category: 'Família', birthday: '', notes: '', ...initial })
  const set = (k) => (e) => setC({ ...c, [k]: e.target.value })
  return (
    <Modal title={c.id ? 'Editar contato' : 'Novo contato'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          save('contact', c)
          onClose()
        }}
      >
        <Field label="Nome">
          <input value={c.name} onChange={set('name')} required autoFocus />
        </Field>
        <div className="row2">
          <Field label="Telefone">
            <input type="tel" value={c.phone} onChange={set('phone')} placeholder="+55 11 99999-9999" />
          </Field>
          <Field label="Categoria">
            <select value={c.category} onChange={set('category')}>
              {CATS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="E-mail">
          <input type="email" value={c.email} onChange={set('email')} />
        </Field>
        <Field label="Endereço">
          <input value={c.address} onChange={set('address')} />
        </Field>
        <Field label="Aniversário (aparece na agenda)">
          <input type="date" value={c.birthday} onChange={set('birthday')} />
        </Field>
        <Field label="Observações">
          <textarea value={c.notes} onChange={set('notes')} rows={2} />
        </Field>
        <div className="row">
          {c.id && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                remove(c.id)
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
