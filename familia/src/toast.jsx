// Avisos curtos no rodapé, com ação opcional (ex.: "Desfazer").
import { useRef, useState, useSyncExternalStore } from 'react'

let current = null
let timer
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())

export function toast(text, action) {
  clearTimeout(timer)
  current = { text, action, id: Date.now() }
  emit()
  timer = setTimeout(() => {
    current = null
    emit()
  }, action ? 5000 : 2500)
}

export function vibrate(ms = 12) {
  try {
    navigator.vibrate?.(ms)
  } catch {}
}

export function Toaster() {
  const t = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current
  )
  if (!t) return null
  return (
    <div className="toast" key={t.id} role="status">
      <span>{t.text}</span>
      {t.action && (
        <button
          onClick={() => {
            t.action.run()
            current = null
            emit()
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  )
}

// Arrastar para o lado no celular: direita conclui, esquerda apaga.
export function Swipe({ as: Tag = 'div', className = '', onRight, onLeft, rightLabel = 'Concluir', leftLabel = 'Apagar', children }) {
  const [dx, setDx] = useState(0)
  const s = useRef(null)
  const moved = useRef(false)
  const dxRef = useRef(0)
  const setD = (v) => {
    dxRef.current = v
    setDx(v)
  }
  const LIMIT = 90

  const down = (e) => {
    if (e.pointerType === 'mouse') return
    s.current = { x: e.clientX, y: e.clientY, axis: null }
    moved.current = false
  }
  const move = (e) => {
    const st = s.current
    if (!st) return
    const ddx = e.clientX - st.x
    const ddy = e.clientY - st.y
    if (!st.axis && Math.hypot(ddx, ddy) > 8) st.axis = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y'
    if (st.axis !== 'x') return
    moved.current = true
    const v = (ddx > 0 && !onRight) || (ddx < 0 && !onLeft) ? ddx / 5 : ddx
    setD(Math.max(-160, Math.min(160, v)))
  }
  const up = () => {
    if (!s.current) return
    const d = dxRef.current
    s.current = null
    setD(0)
    if (d > LIMIT && onRight) onRight()
    else if (d < -LIMIT && onLeft) onLeft()
  }

  return (
    <Tag className={'swipe ' + className}>
      {dx !== 0 && (
        <div className={'swipe-bg ' + (dx > 0 ? 'right' : 'left') + (Math.abs(dx) > LIMIT ? ' ready' : '')}>
          <span>{dx > 0 ? rightLabel : leftLabel}</span>
        </div>
      )}
      <div
        className="swipe-fg"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: s.current ? 'none' : undefined }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => ((s.current = null), setD(0))}
        onClickCapture={(e) => {
          if (moved.current) {
            e.stopPropagation()
            e.preventDefault()
            moved.current = false
          }
        }}
      >
        {children}
      </div>
    </Tag>
  )
}
