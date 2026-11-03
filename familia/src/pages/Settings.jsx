import { useState } from 'react'
import { byId, exportBackup, getState, importBackup, remove, resetAll, save, setMe, syncNow, useStore } from '../store.js'
import { AVATARS, COLORS, resizeImage } from '../utils.js'
import { Avatar, Field, Modal, PageHeader, useMembers } from '../ui.jsx'

export default function Settings() {
  const st = useStore()
  const members = useMembers()
  const family = byId(st, 'family')
  const [editing, setEditing] = useState(null)
  const [famName, setFamName] = useState(family?.name || '')
  const invite = `${location.origin}/  —  código: ${st.family}`

  const share = async () => {
    const text = `Entre na nossa família no Nosso Lar!\nAbra ${location.origin} e use o código ${st.family}`
    if (navigator.share) navigator.share({ title: 'Nosso Lar', text }).catch(() => {})
    else {
      await navigator.clipboard?.writeText(text)
      alert('Convite copiado!')
    }
  }
  const download = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `nosso-lar-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }
  const upload = (e) => {
    const f = e.target.files[0]
    if (!f) return
    f.text().then((t) => {
      try {
        importBackup(t)
        alert('Backup importado.')
      } catch (err) {
        alert('Não foi possível importar: ' + err.message)
      }
    })
  }

  return (
    <div className="page">
      <PageHeader title="Família" />

      <div className="card form">
        <Field label="Nome da família">
          <input value={famName} onChange={(e) => setFamName(e.target.value)} onBlur={() => famName.trim() && save('family', { ...family, id: 'family', name: famName.trim() })} />
        </Field>
      </div>

      <div className="card">
        <h3>Convidar</h3>
        <p className="muted small">Quem abrir o app e digitar este código entra na família. Trate como uma senha.</p>
        <div className="code">{st.family}</div>
        <p className="muted small">{invite}</p>
        <button className="btn primary" onClick={share}>
          Enviar convite
        </button>
      </div>

      <h3 className="section-title">Membros</h3>
      {members.map((m) => (
        <button key={m.id} className="card event-row" onClick={() => setEditing(m)}>
          <Avatar member={m} />
          <div className="grow">
            <b>{m.name}</b> {m.id === st.me && <span className="muted small">(você)</span>}
            <div className="muted small">{m.birthday ? `🎂 ${m.birthday.split('-').reverse().join('/')}` : ''}</div>
          </div>
          ✏️
        </button>
      ))}
      <button className="btn ghost" onClick={() => setEditing({})}>
        + Adicionar membro (ex.: criança sem celular)
      </button>

      <h3 className="section-title">Aparelho</h3>
      <div className="card stack">
        <button className="btn ghost" onClick={() => setMe(null)}>
          Trocar de usuário neste aparelho
        </button>
        <button className="btn ghost" onClick={syncNow}>
          Sincronizar agora
        </button>
        <button className="btn ghost" onClick={download}>
          Baixar backup (.json)
        </button>
        <label className="btn ghost">
          Restaurar backup
          <input type="file" accept="application/json" hidden onChange={upload} />
        </label>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Sair da família neste aparelho? Os dados continuam no servidor para os outros membros.')) resetAll()
          }}
        >
          Sair da família neste aparelho
        </button>
      </div>
      <p className="muted small center">
        {Object.keys(getState().pending).length} alteração(ões) aguardando envio
      </p>
      {editing && <MemberForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function MemberForm({ initial, onClose }) {
  const st = useStore()
  const [m, setM] = useState({ name: '', color: COLORS[1], emoji: AVATARS[2], birthday: '', phone: '', ...initial })
  const set = (k) => (e) => setM({ ...m, [k]: e.target.value })
  const photo = async (e) => {
    const f = e.target.files[0]
    if (f) setM({ ...m, photo: await resizeImage(f, 256) })
  }
  return (
    <Modal title={m.id ? m.name : 'Novo membro'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          save('member', m)
          onClose()
        }}
      >
        <div className="center">
          <Avatar member={m} size={72} />
        </div>
        <Field label="Nome">
          <input value={m.name} onChange={set('name')} required autoFocus />
        </Field>
        <Field label="Cor">
          <div className="emoji-row">
            {COLORS.map((c) => (
              <button type="button" key={c} className={'swatch' + (m.color === c ? ' on' : '')} style={{ background: c }} onClick={() => setM({ ...m, color: c })} aria-label={c} />
            ))}
          </div>
        </Field>
        <Field label="Avatar">
          <div className="emoji-row">
            {AVATARS.map((a) => (
              <button type="button" key={a} className={'emoji' + (m.emoji === a && !m.photo ? ' on' : '')} onClick={() => setM({ ...m, emoji: a, photo: null })}>
                {a}
              </button>
            ))}
            <label className="emoji">
              📷
              <input type="file" accept="image/*" hidden onChange={photo} />
            </label>
          </div>
        </Field>
        <div className="row2">
          <Field label="Aniversário">
            <input type="date" value={m.birthday} onChange={set('birthday')} />
          </Field>
          <Field label="Telefone">
            <input type="tel" value={m.phone} onChange={set('phone')} />
          </Field>
        </div>
        <div className="row">
          {m.id && m.id !== st.me && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                if (confirm(`Remover ${m.name} da família?`)) {
                  remove(m.id)
                  onClose()
                }
              }}
            >
              Remover
            </button>
          )}
          <span className="grow" />
          <button className="btn primary">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}
