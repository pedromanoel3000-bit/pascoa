// Notificações neste aparelho: ativar, desativar, testar e manter o cadastro em dia.
import { getState } from './store.js'

export const PUSH_CATEGORIES = [
  ['chat', 'Mensagens do chat'],
  ['tasks', 'Tarefas para mim'],
  ['reminders', 'Lembretes: eventos, aniversários e tarefas do dia'],
  ['events', 'Eventos novos na agenda'],
  ['lists', 'Itens novos nas listas'],
  ['posts', 'Recados no mural'],
]

const PREFS_KEY = 'nosso-lar-push-prefs'

export const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function loadPrefs() {
  try {
    return { ...Object.fromEntries(PUSH_CATEGORIES.map(([k]) => [k, true])), ...JSON.parse(localStorage.getItem(PREFS_KEY)) }
  } catch {
    return Object.fromEntries(PUSH_CATEGORIES.map(([k]) => [k, true]))
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {}
}

async function registration() {
  const reg = await Promise.race([
    navigator.serviceWorker.getRegistration().then((r) => r || navigator.serviceWorker.register('/sw.js')).then(() => navigator.serviceWorker.ready),
    new Promise((_, rej) => setTimeout(() => rej(new Error('O app ainda não terminou de carregar. Tente de novo em alguns segundos.')), 10000)),
  ])
  return reg
}

async function api(path, body) {
  const st = getState()
  const res = await fetch('/api/push/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify({ family: st.family, ...body }) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Servidor indisponível')
  return data
}

const b64ToBytes = (b64) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}
const sameKey = (buf, b64) => {
  if (!buf) return false
  const a = new Uint8Array(buf)
  const b = b64ToBytes(b64)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export async function currentSubscription() {
  if (!pushSupported() || Notification.permission !== 'granted') return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

async function register(sub, prefs) {
  const st = getState()
  return api('subscribe', {
    member: st.me,
    device: st.device,
    subscription: sub.toJSON(),
    prefs,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ua: navigator.userAgent,
  })
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Este navegador não aceita notificações.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Permissão negada. Libere as notificações nas configurações do navegador.')
  const reg = await registration()
  const { key } = await api('key')
  let sub = await reg.pushManager.getSubscription()
  if (sub && !sameKey(sub.options?.applicationServerKey, key)) {
    await sub.unsubscribe()
    sub = null
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) })
  const prefs = loadPrefs()
  await register(sub, prefs)
  return sub
}

export async function updatePrefs(prefs) {
  savePrefs(prefs)
  const sub = await currentSubscription()
  if (sub) await register(sub, prefs)
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await api('unsubscribe', { endpoint: sub.endpoint }).catch(() => {})
  await sub.unsubscribe()
}

export async function testPush() {
  const sub = await currentSubscription()
  if (!sub) throw new Error('As notificações não estão ativas neste aparelho.')
  const r = await api('test', { endpoint: sub.endpoint })
  if (!r.ok) throw new Error('O envio falhou. Desative e ative de novo.')
}

// Ao abrir o app: confirma o cadastro (pessoa, fuso horário) e renova se as chaves do servidor mudaram.
export async function refreshPush() {
  try {
    const sub = await currentSubscription()
    if (!sub) return
    const { key } = await api('key')
    if (!sameKey(sub.options?.applicationServerKey, key)) return enablePush()
    await register(sub, loadPrefs())
  } catch {}
}
