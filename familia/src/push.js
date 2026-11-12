// Notificações neste aparelho: ativar, desativar, testar e manter o cadastro em dia.
import { getState } from './store.js'
import { authHeader } from './auth.js'

export const PUSH_CATEGORIES = [
  ['chat', 'Mensagens do chat'],
  ['tasks', 'Tarefas para mim'],
  ['reminders', 'Lembretes: eventos, aniversários e tarefas do dia'],
  ['radar', 'Radar: no máximo um aviso por dia do que merece atenção'],
  ['events', 'Eventos novos na agenda'],
  ['lists', 'Itens novos nas listas'],
  ['posts', 'Recados no mural'],
]

const PREFS_KEY = 'nosso-lar-push-prefs'
const WANTED_KEY = 'nosso-lar-push-wanted' // '1' = a pessoa ativou neste aparelho; '0' = desativou
const KEY_CACHE = 'nosso-lar-push-key' // chave pública do servidor, para ativar sem esperar a internet
export const BANNER_KEY = 'nosso-lar-push-banner'

const ls = {
  get(k) {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v)
    } catch {}
  },
}

export const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function loadPrefs() {
  try {
    return { ...Object.fromEntries(PUSH_CATEGORIES.map(([k]) => [k, true])), ...JSON.parse(ls.get(PREFS_KEY)) }
  } catch {
    return Object.fromEntries(PUSH_CATEGORIES.map(([k]) => [k, true]))
  }
}

async function registration() {
  return Promise.race([
    navigator.serviceWorker
      .getRegistration()
      .then((r) => r || navigator.serviceWorker.register('/sw.js'))
      .then(() => navigator.serviceWorker.ready),
    new Promise((_, rej) => setTimeout(() => rej(new Error('O app ainda não terminou de carregar. Tente de novo em alguns segundos.')), 10000)),
  ])
}

async function existingSubscription() {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    return reg ? await reg.pushManager.getSubscription() : null
  } catch {
    return null
  }
}

async function api(path, body) {
  const st = getState()
  const res = await fetch('/api/push/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: body ? JSON.stringify({ family: st.family, ...body }) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Servidor indisponível')
  return data
}

async function serverKey() {
  const { key } = await api('key')
  ls.set(KEY_CACHE, key)
  return key
}

const b64ToBytes = (b64) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

// true = mesma chave; false = chave diferente; null = o navegador não informa a chave.
function sameKey(buf, b64) {
  if (!buf || !b64) return null
  const a = new Uint8Array(buf)
  const b = b64ToBytes(b64)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

const subscribe = (reg, key) => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) })

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

// Estado rápido, sem internet: 'on' se este aparelho tem inscrição ativa.
export async function quickState() {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (await existingSubscription()) return 'on'
  return ls.get(WANTED_KEY) === '1' ? 'lost' : 'off'
}

// Confere a inscrição com o servidor e conserta sozinho quando dá. Devolve:
// 'on'   — tudo certo
// 'off'  — nunca ativou neste aparelho, ou desativou
// 'lost' — estava ativo, mas a inscrição se perdeu e o navegador só deixa refazer com um toque
let inflight = null
export function refreshPush() {
  if (!inflight) {
    inflight = check().catch(() => 'off')
    inflight.finally(() => setTimeout(() => (inflight = null), 3000))
  }
  return inflight
}

async function check() {
  if (!pushSupported() || Notification.permission === 'denied') return 'off'
  let sub = await existingSubscription()
  const wanted = ls.get(WANTED_KEY) === '1'
  const st = getState()
  if (!st.family || !st.me) return sub ? 'on' : 'off'
  if (!sub && !wanted) return 'off'

  let key
  try {
    key = await serverKey()
  } catch {
    return sub ? 'on' : 'lost' // servidor fora do ar: confere de novo na próxima abertura
  }

  // O servidor trocou as chaves (ex.: reiniciou sem o banco de dados): a inscrição antiga parou de funcionar.
  // Só cancela quando o navegador informa a chave e ela é diferente; "não sei" não conta como diferente.
  if (sub && sameKey(sub.options?.applicationServerKey, key) === false) {
    await sub.unsubscribe().catch(() => {})
    sub = null
  }
  if (!sub) {
    if (Notification.permission !== 'granted') return 'lost'
    try {
      sub = await subscribe(await registration(), key)
    } catch {
      return 'lost' // alguns navegadores (iPhone) só deixam refazer com um toque
    }
  }
  ls.set(WANTED_KEY, '1')
  await register(sub, loadPrefs()).catch(() => {})
  return 'on'
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Este navegador não aceita notificações.')
  inflight = null
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Permissão negada. Libere as notificações nas configurações do navegador.')
  const reg = await registration()
  // Usa a chave já conhecida para se inscrever logo, ainda dentro do toque (o iPhone exige isso).
  let key = ls.get(KEY_CACHE) || (await serverKey())
  let sub = await reg.pushManager.getSubscription()
  if (sub && sameKey(sub.options?.applicationServerKey, key) === false) {
    await sub.unsubscribe()
    sub = null
  }
  if (!sub) sub = await subscribe(reg, key)
  // Confere se a chave guardada ainda é a do servidor.
  const fresh = await serverKey().catch(() => key)
  if (fresh !== key) {
    await sub.unsubscribe()
    sub = await subscribe(reg, fresh)
  }
  ls.set(WANTED_KEY, '1')
  await register(sub, loadPrefs())
  inflight = null
  return sub
}

export async function updatePrefs(prefs) {
  ls.set(PREFS_KEY, JSON.stringify(prefs))
  const sub = await existingSubscription()
  if (sub) await register(sub, prefs)
}

export async function disablePush() {
  inflight = null
  ls.set(WANTED_KEY, '0')
  ls.set(BANNER_KEY, 'off') // quem desativou não deve ver o convite para ativar de novo
  const sub = await existingSubscription()
  if (!sub) return
  await api('unsubscribe', { endpoint: sub.endpoint }).catch(() => {})
  await sub.unsubscribe()
}

export async function testPush() {
  const sub = await existingSubscription()
  if (!sub) throw new Error('As notificações não estão ativas neste aparelho.')
  const r = await api('test', { endpoint: sub.endpoint })
  if (!r.ok) throw new Error('O envio falhou. Desative e ative de novo.')
}
