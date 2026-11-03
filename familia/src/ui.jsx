import { useEffect } from 'react'
import { byId, list, useStore } from './store.js'

export function Avatar({ member, size = 36 }) {
  if (!member) return <span className="avatar" style={{ width: size, height: size, background: '#999' }}>?</span>
  return (
    <span className="avatar" title={member.name} style={{ width: size, height: size, background: member.color, fontSize: size * 0.5 }}>
      {member.photo ? <img src={member.photo} alt="" /> : member.emoji || member.name?.[0]?.toUpperCase()}
    </span>
  )
}

export function MemberAvatar({ id, size }) {
  const st = useStore()
  return <Avatar member={byId(st, id)} size={size} />
}

export function useMembers() {
  const st = useStore()
  return list(st, 'member').sort((a, b) => a.createdAt - b.createdAt)
}

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function MemberPicker({ value = [], onChange, single = false }) {
  const members = useMembers()
  const toggle = (id) => {
    if (single) onChange(value[0] === id ? [] : [id])
    else onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }
  return (
    <div className="member-picker">
      {members.map((m) => (
        <button type="button" key={m.id} className={'chip' + (value.includes(m.id) ? ' on' : '')} style={{ '--c': m.color }} onClick={() => toggle(m.id)}>
          <Avatar member={m} size={22} /> {m.name}
        </button>
      ))}
    </div>
  )
}

export function Empty({ icon, text, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <p>{text}</p>
      {children}
    </div>
  )
}

export function PageHeader({ title, children }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      <div className="page-actions">{children}</div>
    </div>
  )
}

export function Fab({ onClick, label = 'Adicionar' }) {
  return (
    <button className="fab" onClick={onClick} aria-label={label}>
      +
    </button>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented">
      {options.map(([v, label]) => (
        <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}
