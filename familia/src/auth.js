// Conta do aparelho: quem está conectado, e as chamadas ao servidor de contas.
// O token fica só neste aparelho; as senhas nunca são guardadas aqui.
import { useSyncExternalStore } from 'react'

const KEY = 'nosso-lar-auth'
const lerSalvo = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return v?.token ? v : {}
  } catch {
    return {}
  }
}
let saved = lerSalvo() // { token, email, name, hasPassword }
let need = null // { reason } quando o servidor pede login
let snap
const listeners = new Set()
const refresh = () => {
  snap = { token: saved.token || null, email: saved.email || '', name: saved.name || '', hasPassword: !!saved.hasPassword, need }
}
refresh()
const emit = () => {
  refresh()
  listeners.forEach((l) => l())
}
const sub = (l) => (listeners.add(l), () => listeners.delete(l))
export const useAuth = () => useSyncExternalStore(sub, () => snap)

export const getToken = () => saved.token || ''
export const authHeader = () => (saved.token ? { Authorization: 'Bearer ' + saved.token } : {})

function guardar(v) {
  saved = v
  try {
    v.token ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY)
  } catch {}
  emit()
}
// Avisa o resto do app (a sincronização tenta de novo na hora).
const aviso = () => window.dispatchEvent(new Event('nosso-lar-auth'))

export async function api(path, body, method = 'POST') {
  let res
  try {
    res = await fetch('/api/auth/' + path, { method, headers: { 'Content-Type': 'application/json', ...authHeader() }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) })
  } catch {
    throw Object.assign(new Error('Sem conexão com o servidor. Tente de novo.'), { code: 'network' })
  }
  const j = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && j.error === 'invalid_session' && saved.token) guardar({})
    throw Object.assign(new Error(j.message || 'Algo deu errado. Tente de novo.'), { code: j.error, status: res.status })
  }
  return j
}

let cfg
export const loadConfig = () =>
  (cfg ||= fetch('/api/auth/config')
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .catch(() => {
      cfg = null
      return { google: null, email: false, requireAccount: false }
    }))

function iniciar(j) {
  need = null
  guardar({ token: j.token, email: j.account.email, name: j.account.name, hasPassword: j.account.hasPassword })
  aviso()
  return j
}
export const entrar = (email, password) => api('login', { email, password }).then(iniciar)
export const criarConta = (email, password, name) =>
  api('register', { email, password, name }).then((j) => (j.token ? iniciar(j) : j))
export const entrarComGoogle = (credential) => api('google', { credential }).then(iniciar)
export const esqueciASenha = (email) => api('forgot', { email })
export const redefinirSenha = (token, password) => api('reset', { token, password })
export const confirmarEmail = (token) => api('verify', { token })
export const trocarSenha = (current, next) => api('password', { current, next }).then(iniciar)
export async function sair() {
  await api('logout').catch(() => {})
  guardar({})
  aviso()
}

// Baixa um arquivo com os dados ligados à conta (portabilidade).
export async function baixarMeusDados(family) {
  const dados = await api('export', { family })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' }))
  a.download = `nosso-lar-meus-dados-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
// Exclui a conta no servidor e esquece a sessão neste aparelho.
export async function excluirConta(body) {
  const j = await api('delete', body)
  guardar({})
  aviso()
  return j
}
export const infoFamilia = (family) => api('info', { family })
export const proteger = (family, member) => api('claim', { family, member })
export const gerenciar = (family, body) => api('manage', { family, ...body })
export const vincularMembro = (family, member) => (saved.token && family ? api('member', { family, member }).catch(() => {}) : null)

// ---------- respostas do servidor à sincronização ----------
export const clearNeed = () => {
  if (need) {
    need = null
    emit()
  }
}
const setNeed = (reason) => {
  need = { reason }
  emit()
}
let jaTentou = ''
export async function onSyncDenied(status, j, code) {
  if (status === 401) {
    if (saved.token && j.reason === 'session') guardar({}) // a sessão expirou ou foi derrubada
    return setNeed(j.reason || 'protected')
  }
  if (status === 403 && j.error === 'not_member') {
    if (j.removed) return setNeed('removed')
    if (!j.canJoin) return setNeed('closed')
    // Quem digitou o código e está conectado entra na família sozinho, uma vez.
    const k = code + '|' + saved.token
    if (jaTentou === k) return setNeed('noaccess')
    jaTentou = k
    try {
      await api('join', { family: code })
      return true // entrou: vale tentar sincronizar de novo já
    } catch (e) {
      setNeed(e.code === 'invites_closed' ? 'closed' : e.code === 'removed' ? 'removed' : 'noaccess')
    }
  }
}
