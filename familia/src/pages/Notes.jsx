import { useState } from 'react'
import { byId, list, remove, save, useStore } from '../store.js'
import { timeAgo } from '../utils.js'
import { Empty, Fab, Field, Modal, PageHeader } from '../ui.jsx'

// Notas e documentos importantes: senha do Wi-Fi, plano de saúde, documentos escaneados…
export default function Notes() {
  const st = useStore()
  const [editing, setEditing] = useState(null)
  const notes = list(st, 'note').sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt)
  return (
    <div className="page">
      <PageHeader title="Notas e documentos" />
      {notes.length === 0 && <Empty icon="📝" text="Senha do Wi-Fi, carteirinha do plano de saúde, documentos das crianças…" />}
      <div className="notes-grid">
        {notes.map((n) => (
          <button key={n.id} className="card note" onClick={() => setEditing(n)}>
            <b>
              {n.pinned && '📌 '}
              {n.title}
            </b>
            {n.file && (n.file.startsWith('data:image') ? <img src={n.file} alt="" /> : <span>📎 {n.fileName}</span>)}
            <p>{n.body}</p>
            <small className="muted">
              {byId(st, n.createdBy)?.name} · {timeAgo(n.updatedAt)}
            </small>
          </button>
        ))}
      </div>
      <Fab onClick={() => setEditing({})} label="Nova nota" />
      {editing && <NoteForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function NoteForm({ initial, onClose }) {
  const [n, setN] = useState({ title: '', body: '', pinned: false, ...initial })
  const attach = (e) => {
    const f = e.target.files[0]
    if (!f) return
    if (f.size > 4 * 1024 * 1024) return alert('Arquivo grande demais (máx. 4 MB).')
    const r = new FileReader()
    r.onload = () => setN({ ...n, file: r.result, fileName: f.name })
    r.readAsDataURL(f)
  }
  return (
    <Modal title={n.id ? 'Editar nota' : 'Nova nota'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          save('note', n)
          onClose()
        }}
      >
        <Field label="Título">
          <input value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} required autoFocus />
        </Field>
        <Field label="Texto">
          <textarea value={n.body} onChange={(e) => setN({ ...n, body: e.target.value })} rows={6} />
        </Field>
        <div className="row">
          <label className="btn ghost">
            📎 {n.file ? 'Trocar anexo' : 'Anexar arquivo'}
            <input type="file" hidden onChange={attach} />
          </label>
          {n.file && (
            <a className="btn ghost" href={n.file} download={n.fileName}>
              Abrir {n.fileName}
            </a>
          )}
        </div>
        <label className="check">
          <input type="checkbox" checked={n.pinned} onChange={(e) => setN({ ...n, pinned: e.target.checked })} /> Fixar no topo
        </label>
        <div className="row">
          {n.id && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                remove(n.id)
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
