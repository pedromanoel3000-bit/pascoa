// Dados do app: ficam salvos no aparelho e sincronizam com o servidor da família.
// Cada registro é { id, type, updatedAt, deleted?, ...campos }.
import { useSyncExternalStore } from 'react'
import { authHeader, clearNeed, onSyncDenied, setBilling, vincularMembro } from './auth.js'
import { podeVer, redigir } from './privacidade.js'

const KEY = 'nosso-lar-v1'
const POLL_MS = 4000

const newDevice = () => 'dev-' + Math.random().toString(36).slice(2, 12)
const blank = () => ({ family: null, me: null, rev: 0, items: {}, pending: {}, lastRead: {}, device: newDevice() })

let state = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return { ...blank(), ...saved, device: saved?.device || newDevice() }
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

// Código da família: 12 caracteres sorteados de forma segura (sem 0, O, 1, I, para não confundir).
export function familyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const part = (o) => Array.from(bytes.slice(o, o + 4), (b) => chars[b % chars.length]).join('')
  return `${part(0)}-${part(4)}-${part(8)}`
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
  vincularMembro(state.family, me) // numa família protegida, liga a conta a esta pessoa
}

export function markRead(key) {
  setState({ lastRead: { ...state.lastRead, [key]: Date.now() } })
}

export function joinFamily(code, { create = false } = {}) {
  setState({ family: code, rev: 0, epoch: null, criando: create })
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
let denied = false
let delay = null

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
  denied = false
  delay = null
  const sent = Object.values(state.pending)
  try {
    setStatus('syncing')
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ family: state.family, since: state.rev, epoch: state.epoch, changes: sent, me: state.me, device: document.hidden ? null : state.device, create: state.criando || undefined }),
    })
    if (res.status === 401 || res.status === 402 || res.status === 403) {
      // A família é protegida: o app pede login (ou entra sozinho, se já estiver conectado e puder).
      const entrou = await onSyncDenied(res.status, await res.json().catch(() => ({})), state.family)
      denied = !entrou
      if (entrou) delay = 200
      setStatus('error')
      return
    }
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = await res.json()
    if (state.epoch && data.epoch !== state.epoch && Object.keys(state.items).length) {
      // O servidor perdeu os dados (ex.: reiniciou no plano grátis). Reenvia tudo o que este aparelho tem.
      setState({ epoch: data.epoch, rev: 0, pending: { ...state.items } })
      syncing = false
      return syncNow()
    }
    const items = { ...state.items }
    for (const it of data.items) {
      const cur = items[it.id]
      if (!cur || (it.updatedAt || 0) >= (cur.updatedAt || 0)) items[it.id] = it
    }
    // Família protegida: tira deste aparelho o que é de outra pessoa (cópias de antes da proteção) e esconde reservas de presente.
    // Só apaga aqui, sem avisar o servidor, e só quando ele já sabe quem é a conta.
    const sozinho = data.acct?.member
    const pending0 = { ...state.pending }
    if (sozinho) {
      for (const [id, it] of Object.entries(items)) {
        if (!podeVer(it, sozinho)) {
          delete items[id]
          delete pending0[id]
        } else if (redigir(it, sozinho) !== it) items[id] = redigir(it, sozinho)
      }
    }
    // Só tira da fila o que não mudou de novo enquanto a requisição estava no ar.
    const pending = pending0
    // Em modo só leitura (assinatura vencida) o servidor não grava nada: as alterações continuam na fila até a renovação.
    if (!data.somenteLeitura) for (const s of sent) if (pending[s.id] && pending[s.id].updatedAt === s.updatedAt) delete pending[s.id]
    const meuMembro = data.acct?.member
    setState({ items, pending, rev: data.rev, epoch: data.epoch, criando: false, ...(!state.me && meuMembro && items[meuMembro] ? { me: meuMembro } : {}) })
    clearNeed()
    setBilling(data.billing || null)
    setStatus('online')
  } catch {
    setStatus(navigator.onLine ? 'error' : 'offline')
  } finally {
    syncing = false
    scheduleSync(delay ?? (denied ? 15000 : document.hidden ? POLL_MS * 5 : POLL_MS))
  }
}

window.addEventListener('online', () => scheduleSync(0))
window.addEventListener('nosso-lar-auth', () => scheduleSync(0))
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
