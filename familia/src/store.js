// Dados do app: ficam salvos no aparelho e sincronizam com o servidor da família.
// Cada registro é { id, type, updatedAt, deleted?, ...campos }.
import { useSyncExternalStore } from 'react'

const KEY = 'nosso-lar-v1'
const POLL_MS = 4000

const blank = () => ({ family: null, me: null, rev: 0, items: {}, pending: {}, lastRead: {} })

let state = (() => {
  try {
    return { ...blank(), ...JSON.parse(localStorage.getItem(KEY)) }
  } catch {
    return blank()
  }
})()
let status = navigator.onLine ? 'idle' : 'offline'
const listeners = new Set()
let saveTimer

function emit() {
  listeners.forEach((l) => l())
}

function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      console.warn('Armazenamento local cheio')
    }
  }, 150)
}

function setState(next) {
  state = { ...state, ...next }
  persist()
  emit()
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function familyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${part()}-${part()}`
}

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore() {
  return useSyncExternalStore(subscribe, () => state)
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribe, () => status)
}

export function getState() {
  return state
}

// ---------- leitura ----------
export function list(st, type) {
  return Object.values(st.items).filter((i) => i.type === type && !i.deleted)
}

export function byId(st, id) {
  const i = st.items[id]
  return i && !i.deleted ? i : null
}

// ---------- escrita ----------
export function save(type, data) {
  const item = { ...data, type, id: data.id || uid(), updatedAt: Date.now() }
  if (!item.createdAt) item.createdAt = item.updatedAt
  if (!item.createdBy && state.me) item.createdBy = state.me
  setState({ items: { ...state.items, [item.id]: item }, pending: { ...state.pending, [item.id]: item } })
  scheduleSync(300)
  return item
}

export function update(id, fields) {
  const cur = state.items[id]
  if (!cur) return
  return save(cur.type, { ...cur, ...fields })
}

export function remove(id) {
  const cur = state.items[id]
  if (!cur) return
  save(cur.type, { id, deleted: true, createdAt: cur.createdAt })
}

export function setMe(me) {
  setState({ me })
}

export function markRead(key) {
  setState({ lastRead: { ...state.lastRead, [key]: Date.now() } })
}

export function joinFamily(code) {
  setState({ family: code, rev: 0 })
  scheduleSync(0)
}

export function resetAll() {
  localStorage.removeItem(KEY)
  state = blank()
  emit()
}

export function exportBackup() {
  return JSON.stringify({ app: 'nosso-lar', version: 1, items: state.items }, null, 1)
}

export function importBackup(text) {
  const data = JSON.parse(text)
  if (!data || typeof data.items !== 'object') throw new Error('Arquivo inválido')
  const items = { ...state.items }
  const pending = { ...state.pending }
  for (const it of Object.values(data.items)) {
    const cur = items[it.id]
    if (!cur || (it.updatedAt || 0) > (cur.updatedAt || 0)) {
      const copy = { ...it, updatedAt: Date.now() }
      items[it.id] = copy
      pending[it.id] = copy
    }
  }
  setState({ items, pending })
  scheduleSync(0)
}

// ---------- sincronização ----------
let syncTimer
let syncing = false

function setStatus(s) {
  if (s !== status) {
    status = s
    emit()
  }
}

export function scheduleSync(delay = POLL_MS) {
  clearTimeout(syncTimer)
  syncTimer = setTimeout(syncNow, delay)
}

export async function syncNow() {
  clearTimeout(syncTimer)
  if (!state.family || syncing) return scheduleSync()
  syncing = true
  const sent = Object.values(state.pending)
  try {
    setStatus('syncing')
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ family: state.family, since: state.rev, changes: sent }),
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = await res.json()
    const items = { ...state.items }
    for (const it of data.items) {
      const cur = items[it.id]
      if (!cur || (it.updatedAt || 0) >= (cur.updatedAt || 0)) items[it.id] = it
    }
    // Só tira da fila o que não mudou de novo enquanto a requisição estava no ar.
    const pending = { ...state.pending }
    for (const s of sent) if (pending[s.id] && pending[s.id].updatedAt === s.updatedAt) delete pending[s.id]
    setState({ items, pending, rev: data.rev })
    setStatus('online')
  } catch {
    setStatus(navigator.onLine ? 'error' : 'offline')
  } finally {
    syncing = false
    scheduleSync(document.hidden ? POLL_MS * 5 : POLL_MS)
  }
}

window.addEventListener('online', () => scheduleSync(0))
window.addEventListener('offline', () => setStatus('offline'))
document.addEventListener('visibilitychange', () => !document.hidden && scheduleSync(0))
scheduleSync(0)
// Garante que nada se perde se o app for fechado logo após uma alteração.
window.addEventListener('pagehide', () => {
  clearTimeout(saveTimer)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {}
})

// Se o app estiver aberto em outra aba do mesmo aparelho, adota os dados dela.
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  try {
    state = e.newValue ? { ...blank(), ...JSON.parse(e.newValue) } : blank()
    emit()
  } catch {}
})
