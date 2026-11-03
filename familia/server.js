// Servidor do Nosso Lar: guarda os dados de cada família e serve o app.
// Sem dependências: só Node 18+.  Uso: npm run serve  (porta 3001 ou $PORT)
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

fs.mkdirSync(DATA, { recursive: true })

const families = new Map()
const saveTimers = new Map()

// O código da família funciona como senha: o arquivo usa o hash dele.
const fileFor = (code) =>
  path.join(DATA, crypto.createHash('sha256').update(code).digest('hex').slice(0, 32) + '.json')

function loadFamily(code) {
  if (families.has(code)) return families.get(code)
  let fam = { rev: 0, items: {} }
  try {
    fam = JSON.parse(fs.readFileSync(fileFor(code), 'utf8'))
  } catch {}
  families.set(code, fam)
  return fam
}

function saveFamily(code) {
  clearTimeout(saveTimers.get(code))
  saveTimers.set(
    code,
    setTimeout(() => {
      const file = fileFor(code)
      fs.writeFileSync(file + '.tmp', JSON.stringify(families.get(code)))
      fs.renameSync(file + '.tmp', file)
    }, 300)
  )
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
  const fam = loadFamily(code)
  const changes = Array.isArray(body.changes) ? body.changes : []
  let changed = false
  for (const c of changes) {
    if (!c || typeof c.id !== 'string' || typeof c.type !== 'string') continue
    const cur = fam.items[c.id]
    if (!cur || (c.updatedAt || 0) >= (cur.updatedAt || 0)) {
      fam.rev += 1
      fam.items[c.id] = { ...c, rev: fam.rev }
      changed = true
    }
  }
  if (changed) saveFamily(code)
  const since = Number(body.since) || 0
  const items = Object.values(fam.items).filter((i) => i.rev > since)
  json(res, 200, { rev: fam.rev, items })
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
  .listen(PORT, () => console.log(`Nosso Lar rodando em http://localhost:${PORT}`))
