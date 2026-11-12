// Fotos e anexos: ficam no servidor (nome = resumo do conteúdo) e este aparelho guarda uma cópia no IndexedDB.
// Os dados da família só levam os nomes (ids), por isso continuam pequenos, por mais fotos que existam.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { authHeader } from './auth.js'
import { getState, update } from './store.js'

export const MAX_ARQUIVO = 4 * 1024 * 1024

// ---------- IndexedDB (com reserva na memória se o navegador não deixar) ----------
let dbp
const abrir = () =>
  (dbp ||= new Promise((ok, erro) => {
    const r = indexedDB.open('nosso-lar-fotos', 1)
    r.onupgradeneeded = () => {
      r.result.createObjectStore('cache') // id -> Blob
      r.result.createObjectStore('fila') // id -> { family }
    }
    r.onsuccess = () => ok(r.result)
    r.onerror = () => erro(r.error)
  }).catch(() => null))
const memoria = { cache: new Map(), fila: new Map() }
async function idb(store, modo, fn) {
  const d = await abrir()
  if (!d) return undefined
  return new Promise((ok) => {
    let rq
    try {
      const tx = d.transaction(store, modo)
      rq = fn(tx.objectStore(store))
      tx.oncomplete = () => ok(rq?.result)
      tx.onerror = tx.onabort = () => ok(undefined)
    } catch {
      ok(undefined)
    }
  })
}
const cacheGet = async (id) => memoria.cache.get(id) || (await idb('cache', 'readonly', (s) => s.get(id)))
const cachePut = async (id, blob) => {
  memoria.cache.set(id, blob)
  if (memoria.cache.size > 40) memoria.cache.delete(memoria.cache.keys().next().value) // só as mais recentes ficam na memória
  await idb('cache', 'readwrite', (s) => s.put(blob, id))
}
const cacheDel = async (id) => {
  memoria.cache.delete(id)
  await idb('cache', 'readwrite', (s) => s.delete(id))
}
const filaPut = async (id, v) => {
  memoria.fila.set(id, v)
  await idb('fila', 'readwrite', (s) => s.put(v, id))
}
const filaDel = async (id) => {
  memoria.fila.delete(id)
  await idb('fila', 'readwrite', (s) => s.delete(id))
}
const filaLer = async () => {
  const d = await abrir()
  if (!d) return [...memoria.fila.entries()]
  return new Promise((ok) => {
    try {
      const out = []
      const rq = d.transaction('fila', 'readonly').objectStore('fila').openCursor()
      rq.onsuccess = () => {
        const c = rq.result
        if (c) {
          out.push([c.key, c.value])
          c.continue()
        } else ok(out)
      }
      rq.onerror = () => ok([...memoria.fila.entries()])
    } catch {
      ok([...memoria.fila.entries()])
    }
  })
}

// ---------- preparar imagens ----------
export async function resumo(blob) {
  const h = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(h)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function carregarImagem(blob) {
  return new Promise((ok, erro) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => (URL.revokeObjectURL(url), ok(img))
    img.onerror = () => (URL.revokeObjectURL(url), erro(new Error('Não consegui abrir essa imagem.')))
    img.src = url
  })
}
async function paraJpeg(origem, max, qualidade) {
  const img = origem instanceof Blob ? await carregarImagem(origem) : origem
  const escala = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round((img.naturalWidth || img.width) * escala))
  c.height = Math.max(1, Math.round((img.naturalHeight || img.height) * escala))
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', qualidade))
  if (!blob) throw new Error('Não consegui preparar essa imagem.')
  return blob
}

/** Reduz a imagem, cria a miniatura e deixa os dois na fila de envio. Devolve os nomes e uma prévia. */
export async function novaFoto(file, { max = 1280 } = {}) {
  const img = await carregarImagem(file)
  const grande = await paraJpeg(img, max, 0.8)
  const mini = await paraJpeg(img, 400, 0.7)
  const [foto, miniId] = await Promise.all([resumo(grande), resumo(mini)])
  await Promise.all([enfileirar(foto, grande), enfileirar(miniId, mini)])
  return { foto, mini: miniId, previa: URL.createObjectURL(mini) }
}

/** Anexo de nota: imagem vira foto reduzida com miniatura; outros arquivos sobem como estão (até 4 MB). */
export async function novoArquivo(file) {
  if (file.type.startsWith('image/')) {
    const { foto, mini } = await novaFoto(file, { max: 1600 })
    return { arquivo: foto, mini, arquivoTipo: 'image', arquivoNome: file.name }
  }
  if (file.size > MAX_ARQUIVO) throw new Error('Arquivo grande demais (máx. 4 MB).')
  const id = await resumo(file)
  await enfileirar(id, file)
  return { arquivo: id, mini: null, arquivoTipo: 'arquivo', arquivoNome: file.name }
}

// ---------- enviar ----------
const cab = (family) => ({ 'X-Family': family, ...authHeader() })

/** 'ok' | 'tentar' (rede, conta ou família ainda não prontas) | 'recusado' (nunca vai funcionar). */
async function enviar(id, blob, family) {
  try {
    const r = await fetch('/api/foto/' + id, { method: 'PUT', headers: cab(family), body: blob })
    if (r.ok) return 'ok'
    return r.status === 400 || r.status === 413 ? 'recusado' : 'tentar'
  } catch {
    return 'tentar'
  }
}

async function enfileirar(id, blob) {
  await cachePut(id, blob)
  await filaPut(id, { family: getState().family })
  drenar()
}

let drenando = false
export async function drenar() {
  if (drenando) return
  drenando = true
  try {
    for (const [id, v] of await filaLer()) {
      const blob = await cacheGet(id)
      if (!blob) {
        await filaDel(id)
        continue
      }
      const r = await enviar(id, blob, v.family)
      if (r !== 'tentar') await filaDel(id)
      else break // sem rede ou sem acesso agora: tenta tudo de novo depois
    }
  } finally {
    drenando = false
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', drenar)
  window.addEventListener('nosso-lar-auth', drenar)
  setInterval(drenar, 20000)
  setTimeout(drenar, 3000)
}

// ---------- baixar ----------
const ausentes = new Map() // id -> quando falhou (tenta de novo depois de um tempo)
const emVoo = new Map()
let ativos = 0
const espera = []
const vez = () =>
  new Promise((ok) => {
    if (ativos < 4) return ativos++, ok()
    espera.push(ok)
  })
const liberar = () => (espera.length ? espera.shift()() : ativos--)

export async function buscarFoto(id) {
  const guardada = await cacheGet(id)
  if (guardada) return guardada
  if (ausentes.get(id) > Date.now() - 15000) return null
  if (emVoo.has(id)) return emVoo.get(id)
  const p = (async () => {
    await vez()
    try {
      const r = await fetch('/api/foto/' + id, { headers: cab(getState().family) })
      if (!r.ok) throw new Error()
      const blob = await r.blob()
      await cachePut(id, blob)
      return blob
    } catch {
      ausentes.set(id, Date.now())
      return null
    } finally {
      liberar()
      emVoo.delete(id)
    }
  })()
  emVoo.set(id, p)
  return p
}

/**
 * Mostra uma foto: usa a cópia deste aparelho ou baixa só quando a imagem está perto da tela.
 * `antes` é a miniatura, exibida enquanto a foto grande chega; `legado` é o texto antigo (data:) das fotos ainda não convertidas.
 */
export function Foto({ id, antes, legado, alt = '', className, ...resto }) {
  const [src, setSrc] = useState(id ? null : legado || null)
  const [perto, setPerto] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    if (!id) return setSrc(legado || null)
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return setPerto(true)
    const o = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && (setPerto(true), o.disconnect()), { rootMargin: '400px' })
    o.observe(el)
    return () => o.disconnect()
  }, [id, legado])
  useEffect(() => {
    if (!id || !perto) return
    let vivo = true
    let usadas = []
    const mostrar = (b) => {
      const u = URL.createObjectURL(b)
      usadas.push(u)
      setSrc(u)
    }
    ;(async () => {
      if (antes && antes !== id) {
        const m = await cacheGet(antes) // só se já estiver neste aparelho; a miniatura é leve e costuma estar
        if (vivo && m) mostrar(m)
      }
      const b = await buscarFoto(id)
      if (!vivo) return
      if (b) mostrar(b)
      else if (antes && antes !== id) {
        const m = await buscarFoto(antes)
        if (vivo && m) mostrar(m)
      }
      if (vivo && !b && tentativa < 6) setTimeout(() => vivo && setTentativa((t) => t + 1), 5000 + tentativa * 5000)
    })()
    return () => {
      vivo = false
      usadas.forEach((u) => setTimeout(() => URL.revokeObjectURL(u), 1000))
    }
  }, [id, antes, perto, tentativa])
  return <img ref={ref} src={src || undefined} alt={alt} className={(className || '') + (src ? '' : ' foto-carregando')} {...resto} />
}

async function baixarBlob(blob, nome) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
export async function baixarFoto(id, nome = `foto-${id.slice(0, 8)}.jpg`) {
  const b = await buscarFoto(id)
  if (!b) throw new Error('A foto ainda não chegou neste aparelho. Tente de novo em instantes.')
  return baixarBlob(b, nome)
}

// ---------- converter as fotos que ainda estão dentro dos dados ----------
const dataUrlGrande = (v, min) => typeof v === 'string' && v.startsWith('data:') && v.length > min
let mig = { rodando: false, total: 0, feitas: 0 }
const ouvintes = new Set()
const emitir = (m) => {
  mig = { ...mig, ...m }
  ouvintes.forEach((l) => l())
}
export const useMigracao = () => useSyncExternalStore((l) => (ouvintes.add(l), () => ouvintes.delete(l)), () => mig)

function candidatas() {
  const st = getState()
  const out = []
  for (const it of Object.values(st.items)) {
    if (it.deleted) continue
    if (it.type === 'photo' && dataUrlGrande(it.src, 1000)) out.push({ it, campo: 'src' })
    else if (it.type === 'post' && dataUrlGrande(it.photo, 20000)) out.push({ it, campo: 'photo' })
    else if (it.type === 'message' && dataUrlGrande(it.photo, 20000)) out.push({ it, campo: 'photo' })
    else if (it.type === 'note' && dataUrlGrande(it.file, 20000)) out.push({ it, campo: 'file' })
  }
  return out
}

async function converter({ it, campo }) {
  const family = getState().family
  let blob = await (await fetch(it[campo])).blob()
  const imagem = blob.type.startsWith('image/')
  if (blob.size > MAX_ARQUIVO) {
    if (!imagem) return false
    blob = await paraJpeg(blob, 1600, 0.8)
  }
  const id = await resumo(blob)
  let mini = null
  if (imagem) {
    const m = await paraJpeg(blob, 400, 0.7)
    mini = await resumo(m)
    if ((await enviar(mini, m, family)) !== 'ok') return false
    await cachePut(mini, m)
  }
  // Só mexe no item depois de o servidor confirmar que guardou o arquivo.
  if ((await enviar(id, blob, family)) !== 'ok') return false
  await cachePut(id, blob)
  const campos = it.type === 'note' ? { arquivo: id, mini, arquivoTipo: imagem ? 'image' : 'arquivo', arquivoNome: it.fileName || 'anexo', file: null } : { foto: id, mini, [campo]: null }
  update(it.id, campos)
  return true
}

export async function migrar() {
  if (mig.rodando || !getState().family) return 0
  const lista = candidatas()
  if (!lista.length) return 0
  emitir({ rodando: true, total: lista.length, feitas: 0 })
  let ok = 0
  try {
    for (const c of lista) {
      try {
        if (await converter(c)) ok++
      } catch {}
      emitir({ feitas: mig.feitas + 1 })
      await new Promise((r) => setTimeout(r, 50)) // deixa o app respirar entre uma foto e outra
    }
  } finally {
    emitir({ rodando: false })
  }
  return ok
}

