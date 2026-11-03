// Servidor do Nosso Lar: guarda os dados de cada família e serve o app.
// Sem dependências: só Node 18+.  Uso: npm run serve  (porta 3001 ou $PORT)
// Com SUPABASE_URL e SUPABASE_KEY definidos, os dados vão para o Supabase; senão, para a pasta data/.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(ROOT, 'dist')
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data')
const PORT = Number(process.env.PORT) || 3001
const MAX_BODY = 25 * 1024 * 1024

const SB_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')
const SB_KEY = (process.env.SUPABASE_KEY || '').trim()
const USE_DB = Boolean(SB_URL && SB_KEY)

if (!USE_DB) fs.mkdirSync(DATA, { recursive: true })

const families = new Map() // código -> dados da família em memória
const loading = new Map() // código -> carregamento em andamento
const saveTimers = new Map()
const dirty = new Map() // código -> Map(id -> item) ainda não gravados no banco

// O código da família funciona como senha: só o hash dele vai para o disco ou para o banco.
const keyFor = (code) => crypto.createHash('sha256').update(code).digest('hex').slice(0, 32)
const fileFor = (code) => path.join(DATA, keyFor(code) + '.json')

// ---------- Supabase (API REST, sem dependências) ----------
async function sb(pathAndQuery, opts = {}) {
  const headers = { apikey: SB_KEY, 'Content-Type': 'application/json', ...opts.headers }
  if (SB_KEY.startsWith('eyJ')) headers.Authorization = 'Bearer ' + SB_KEY // chaves antigas (JWT)
  const res = await fetch(`${SB_URL}/rest/v1/${pathAndQuery}`, { ...opts, headers })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

async function dbLoad(code) {
  const key = keyFor(code)
  let rows = await sb(`families?family=eq.${key}&select=epoch`)
  if (!rows.length) {
    await sb('families', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify([{ family: key, epoch: crypto.randomUUID() }]),
    })
    rows = await sb(`families?family=eq.${key}&select=epoch`)
  }
  const fam = { rev: 0, items: {}, epoch: rows[0].epoch }
  // O Supabase devolve no máximo 1000 linhas por vez.
  for (let offset = 0; ; offset += 1000) {
    const page = await sb(`items?family=eq.${key}&select=data&order=rev.asc&limit=1000&offset=${offset}`)
    for (const { data } of page) {
      fam.items[data.id] = data
      if (data.rev > fam.rev) fam.rev = data.rev
    }
    if (page.length < 1000) break
  }
  return fam
}

async function dbFlush(code) {
  const pending = dirty.get(code)
  if (!pending || !pending.size) return
  dirty.delete(code)
  const key = keyFor(code)
  const rows = [...pending.values()].map((data) => ({ family: key, id: data.id, rev: data.rev, data }))
  // Envia em lotes de até ~4 MB (fotos ocupam bastante).
  let batch = []
  let size = 0
  const send = async () => {
    if (!batch.length) return
    await sb('items?on_conflict=family,id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch),
    })
    batch = []
    size = 0
  }
  try {
    for (const r of rows) {
      const len = JSON.stringify(r.data).length
      if (size + len > 4_000_000) await send()
      batch.push(r)
      size += len
    }
    await send()
  } catch (err) {
    console.error('Falha ao gravar no Supabase, tentando de novo em 5 s:', err.message)
    const again = dirty.get(code) || new Map()
    for (const r of rows) if (!again.has(r.id)) again.set(r.id, r.data)
    dirty.set(code, again)
    clearTimeout(saveTimers.get(code))
    saveTimers.set(code, setTimeout(() => dbFlush(code), 5000))
  }
}

// ---------- arquivo local (quando não há Supabase) ----------
function fileLoad(code) {
  // epoch muda quando o arquivo some (ex.: servidor reiniciado sem disco); o app então reenvia tudo.
  let fam = { rev: 0, items: {}, epoch: crypto.randomUUID() }
  try {
    fam = JSON.parse(fs.readFileSync(fileFor(code), 'utf8'))
    if (!fam.epoch) fam.epoch = crypto.randomUUID()
  } catch {}
  return fam
}

function fileSave(code) {
  const file = fileFor(code)
  fs.writeFileSync(file + '.tmp', JSON.stringify(families.get(code)))
  fs.renameSync(file + '.tmp', file)
}

// ---------- comum ----------
async function loadFamily(code) {
  if (families.has(code)) return families.get(code)
  if (!loading.has(code)) {
    const p = (USE_DB ? dbLoad(code) : Promise.resolve(fileLoad(code)))
      .then((fam) => {
        families.set(code, fam)
        if (!USE_DB && !fs.existsSync(fileFor(code))) fileSave(code)
        return fam
      })
      .finally(() => loading.delete(code))
    loading.set(code, p)
  }
  return loading.get(code)
}

function saveFamily(code, changedItems) {
  if (USE_DB) {
    const d = dirty.get(code) || new Map()
    for (const it of changedItems) d.set(it.id, it)
    dirty.set(code, d)
  }
  clearTimeout(saveTimers.get(code))
  saveTimers.set(code, setTimeout(() => (USE_DB ? dbFlush(code) : fileSave(code)), 300))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

// Sincronização: o app manda o que mudou e recebe tudo que mudou desde a última revisão que viu.
// Conflito: vence a alteração mais recente (updatedAt).
async function handleSync(req, res) {
  let body
  try {
    body = JSON.parse(await readBody(req))
  } catch {
    return json(res, 400, { error: 'invalid body' })
  }
  const code = String(body.family || '').trim().toUpperCase()
  if (!/^[A-Z0-9-]{6,40}$/.test(code)) return json(res, 400, { error: 'invalid family code' })
  let fam
  try {
    fam = await loadFamily(code)
  } catch (err) {
    console.error('Falha ao carregar a família:', err.message)
    return json(res, 503, { error: 'storage unavailable' })
  }
  const changes = Array.isArray(body.changes) ? body.changes : []
  const changed = []
  for (const c of changes) {
    if (!c || typeof c.id !== 'string' || typeof c.type !== 'string') continue
    const cur = fam.items[c.id]
    if (!cur || (c.updatedAt || 0) >= (cur.updatedAt || 0)) {
      fam.rev += 1
      fam.items[c.id] = { ...c, rev: fam.rev }
      changed.push(fam.items[c.id])
    }
  }
  if (changed.length) saveFamily(code, changed)
  const since = body.epoch === fam.epoch ? Number(body.since) || 0 : 0
  const items = Object.values(fam.items).filter((i) => i.rev > since)
  json(res, 200, { rev: fam.rev, epoch: fam.epoch, items })
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let file = path.normalize(path.join(DIST, urlPath))
  if (!file.startsWith(DIST)) return json(res, 403, { error: 'forbidden' })
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
  if (!fs.existsSync(file)) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    return res.end('Rode "npm run build" antes de iniciar o servidor.')
  }
  const ext = path.extname(file)
  res.writeHead(200, {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': urlPath.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  fs.createReadStream(file).pipe(res)
}

http
  .createServer((req, res) => {
    if (req.url.startsWith('/api/sync') && req.method === 'POST') return handleSync(req, res).catch(() => json(res, 500, { error: 'server error' }))
    if (req.url.startsWith('/api/health')) return json(res, 200, { ok: true })
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res)
    json(res, 404, { error: 'not found' })
  })
  .listen(PORT, () => console.log(`Nosso Lar rodando em http://localhost:${PORT} — dados ${USE_DB ? 'no Supabase' : 'em ' + DATA}`))
