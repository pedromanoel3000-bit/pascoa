import { useState } from 'react'
import { byId, list, remove, save, update, useStore } from '../store.js'
import { resizeImage, timeAgo } from '../utils.js'
import { Avatar, Empty, Modal, PageHeader } from '../ui.jsx'

export default function Photos() {
  const st = useStore()
  const photos = list(st, 'photo').sort((a, b) => b.createdAt - a.createdAt)
  const albums = [...new Set(photos.map((p) => p.album || 'Geral'))]
  const [album, setAlbum] = useState('all')
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(false)
  const shown = album === 'all' ? photos : photos.filter((p) => (p.album || 'Geral') === album)

  const upload = async (e) => {
    const files = [...e.target.files]
    if (!files.length) return
    const name = prompt('Álbum', album === 'all' ? 'Geral' : album)
    if (name === null) return
    setBusy(true)
    for (const f of files) save('photo', { src: await resizeImage(f), album: name.trim() || 'Geral', caption: '' })
    setBusy(false)
    e.target.value = ''
  }

  return (
    <div className="page">
      <PageHeader title="Fotos">
        <label className="btn primary">
          {busy ? 'Enviando…' : '+ Adicionar fotos'}
          <input type="file" accept="image/*" multiple hidden onChange={upload} />
        </label>
      </PageHeader>
      <div className="conv-tabs">
        {['all', ...albums].map((a) => (
          <button key={a} className={'chip' + (album === a ? ' on' : '')} onClick={() => setAlbum(a)}>
            {a === 'all' ? 'Todas' : a}
          </button>
        ))}
      </div>
      {shown.length === 0 && <Empty icon="📷" text="Nenhuma foto ainda." />}
      <div className="photo-grid">
        {shown.map((p) => (
          <button key={p.id} onClick={() => setOpen(p)}>
            <img src={p.src} alt={p.caption || ''} loading="lazy" />
          </button>
        ))}
      </div>
      {open && <Viewer photo={st.items[open.id]} onClose={() => setOpen(null)} />}
    </div>
  )
}

function Viewer({ photo, onClose }) {
  const st = useStore()
  const [caption, setCaption] = useState(photo.caption || '')
  return (
    <Modal title={photo.album || 'Foto'} onClose={onClose}>
      <img src={photo.src} alt="" className="viewer-img" />
      <div className="row">
        <Avatar member={byId(st, photo.createdBy)} size={24} />
        <span className="muted small grow">
          {byId(st, photo.createdBy)?.name} · {timeAgo(photo.createdAt)}
        </span>
        <a className="btn ghost small" href={photo.src} download={`foto-${photo.id}.jpg`}>
          Baixar
        </a>
        <button
          className="btn danger small"
          onClick={() => {
            if (confirm('Apagar foto?')) {
              remove(photo.id)
              onClose()
            }
          }}
        >
          Apagar
        </button>
      </div>
      <input value={caption} onChange={(e) => setCaption(e.target.value)} onBlur={() => caption !== photo.caption && update(photo.id, { caption })} placeholder="Legenda" />
    </Modal>
  )
}
