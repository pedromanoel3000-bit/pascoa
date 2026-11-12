// Servidor do Nosso Lar: guarda os dados de cada família, serve o app e envia as notificações.
// Uso: npm run serve  (porta 3001 ou $PORT). Precisa de Node 18+.
// Com SUPABASE_URL e SUPABASE_KEY definidos, os dados vão para o Supabase; senão, para a pasta data/.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import dns from 'node:dns/promises'
import { receitaDeHtml } from './src/refeicoes.js'
import { createNotifier } from './notify.js'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(ROOT, 'dist')
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data')
const PORT = Number(process.env.PORT) || 3001
const MAX_BODY = 25 * 1024 * 1024

// Lê a variável aceitando também os nomes que o próprio Supabase usa, e tira aspas e espaços colados por engano.
const env = (...names) => {
  for (const n of names) {
    const v = (process.env[n] || '').trim().replace(/^["']+|["']+$/g, '').trim()
    if (v) return v
  }
  return ''
}
const SB_URL = env('SUPABASE_URL', 'SUPABASE_PROJECT_URL').replace(/\/+$/, '').replace(/\/rest\/v1$/, '')
const SB_KEY = env('SUPABASE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY')
const USE_DB = Boolean(SB_URL && SB_KEY)
const MISSING = [!SB_URL && 'SUPABASE_URL', !SB_KEY && 'SUPABASE_KEY'].filter(Boolean)

// A chave pública (publishable/anon) não serve: o banco bloqueia o acesso e nada é salvo.
function keyProblem() {
  if (SB_KEY.startsWith('sb_publishable_')) return 'A SUPABASE_KEY é a chave pública (publishable). Use a chave secreta (sb_secret_…).'
  if (SB_KEY.startsWith('eyJ')) {
    try {
      const role = JSON.parse(Buffer.from(SB_KEY.split('.')[1], 'base64url').toString()).role
      if (role !== 'service_role') return `A SUPABASE_KEY é a chave "${role}". Use a chave secreta (service_role ou sb_secret_…).`
    } catch {}
  }
  return null
}
// Sem Supabase e sem DATA_DIR (disco próprio), os dados ficam numa pasta que o Render grátis apaga ao reiniciar.
const PERSISTENT = USE_DB || Boolean(process.env.DATA_DIR)

if (!USE_DB) fs.mkdirSync(DATA, { recursive: true })

// As famílias são identificadas pelo hash do código (o código funciona como senha e nunca é guardado).
const families = new Map() // hash -> dados da família em memória
const loading = new Map() // hash -> carregamento em andamento
const saveTimers = new Map()
const dirty = new Map() // hash -> Map(id -> item) ainda não gravados no banco

const keyFor = (code) => crypto.createHash('sha256').update(code).digest('hex').slice(0, 32)
const fileFor = (key) => path.join(DATA, key + '.json')

// ---------- Supabase (API REST) ----------
async function sb(pathAndQuery, opts = {}) {
  const headers = { apikey: SB_KEY, 'Content-Type': 'application/json', ...opts.headers }
  if (SB_KEY.startsWith('eyJ')) headers.Authorization = 'Bearer ' + SB_KEY // chaves antigas (JWT)
  const res = await fetch(`${SB_URL}/rest/v1/${pathAndQuery}`, { ...opts, headers })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

async function dbLoad(key) {
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

async function dbFlush(key) {
  const pending = dirty.get(key)
  if (!pending || !pending.size) return
  dirty.delete(key)
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
    const again = dirty.get(key) || new Map()
    for (const r of rows) if (!again.has(r.id)) again.set(r.id, r.data)
    dirty.set(key, again)
    clearTimeout(saveTimers.get(key))
    saveTimers.set(key, setTimeout(() => dbFlush(key), 5000))
  }
}

// ---------- arquivo local (quando não há Supabase) ----------
function fileLoad(key) {
  // epoch muda quando o arquivo some (ex.: servidor reiniciado sem disco); o app então reenvia tudo.
  let fam = { rev: 0, items: {}, epoch: crypto.randomUUID() }
  try {
    fam = JSON.parse(fs.readFileSync(fileFor(key), 'utf8'))
    if (!fam.epoch) fam.epoch = crypto.randomUUID()
  } catch {}
  return fam
}

function fileSave(key) {
  const file = fileFor(key)
  fs.writeFileSync(file + '.tmp', JSON.stringify(families.get(key)))
  fs.renameSync(file + '.tmp', file)
}

// ---------- comum ----------
async function loadFamily(key) {
  if (families.has(key)) return families.get(key)
  if (!loading.has(key)) {
    const p = (USE_DB ? dbLoad(key) : Promise.resolve(fileLoad(key)))
      .then((fam) => {
        families.set(key, fam)
        if (!USE_DB && !fs.existsSync(fileFor(key))) fileSave(key)
        return fam
      })
      .finally(() => loading.delete(key))
    loading.set(key, p)
  }
  return loading.get(key)
}

function saveFamily(key, changedItems) {
  if (USE_DB) {
    const d = dirty.get(key) || new Map()
    for (const it of changedItems) d.set(it.id, it)
    dirty.set(key, d)
  }
  clearTimeout(saveTimers.get(key))
  saveTimers.set(key, setTimeout(() => (USE_DB ? dbFlush(key) : fileSave(key)), 300))
}

// Grava um item novo/alterado vindo do próprio servidor (ex.: cadastro de notificação).
function putItem(key, fam, item) {
  fam.rev += 1
  fam.items[item.id] = { ...item, updatedAt: Date.now(), rev: fam.rev }
  saveFamily(key, [fam.items[item.id]])
  return fam.items[item.id]
}

// Configurações do servidor (ex.: chaves das notificações). Ficam numa linha especial da tabela families.
async function getConfig(name) {
  if (USE_DB) {
    const rows = await sb(`families?family=eq.__cfg_${name}&select=epoch`)
    return rows.length ? JSON.parse(rows[0].epoch) : null
  }
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, `__cfg_${name}.json`), 'utf8'))
  } catch {
    return null
  }
}

async function setConfig(name, value) {
  if (USE_DB) {
    await sb('families', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify([{ family: `__cfg_${name}`, epoch: JSON.stringify(value) }]),
    })
    return getConfig(name) // se outra instância gravou antes, vale a dela
  }
  fs.writeFileSync(path.join(DATA, `__cfg_${name}.json`), JSON.stringify(value))
  return value
}

// Famílias que têm algum aparelho cadastrado para notificações (para os lembretes funcionarem após reiniciar).
async function familiesWithPush() {
  if (USE_DB) {
    const rows = await sb('items?select=family&data->>type=eq.pushsub&limit=10000')
    return [...new Set(rows.map((r) => r.family))]
  }
  return fs
    .readdirSync(DATA)
    .filter((f) => f.endsWith('.json') && !f.startsWith('__'))
    .map((f) => f.slice(0, -5))
    .filter((key) => Object.values(fileLoad(key).items).some((i) => i.type === 'pushsub' && !i.deleted))
}

const notifier = createNotifier({ families, loadFamily, putItem, getConfig, setConfig, familiesWithPush })

// ---------- HTTP ----------
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

// Lê o corpo, valida o código da família e carrega os dados dela.
async function openFamily(req, res) {
  let body
  try {
    body = JSON.parse(await readBody(req))
  } catch {
    json(res, 400, { error: 'invalid body' })
    return null
  }
  const code = String(body.family || '').trim().toUpperCase()
  if (!/^[A-Z0-9-]{6,40}$/.test(code)) {
    json(res, 400, { error: 'invalid family code' })
    return null
  }
  const key = keyFor(code)
  try {
    return { body, key, fam: await loadFamily(key) }
  } catch (err) {
    console.error('Falha ao carregar a família:', err.message)
    json(res, 503, { error: 'storage unavailable' })
    return null
  }
}

// ---------- importar receita por link ----------
// O servidor busca a página e devolve só a receita (dados estruturados schema.org). Exige o código de uma
// família que já existe, só aceita endereços públicos, limita tamanho, tempo e redirecionamentos.
const ipPrivado = (ip) => {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase()
    if (v.startsWith('::ffff:')) return ipPrivado(v.slice(7))
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb')
  }
  const [a, b] = ip.split('.').map(Number)
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

async function buscarPagina(endereco, saltos = 0) {
  const u = new URL(endereco)
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('endereco')
  if (u.username || u.password || (u.port && !['80', '443'].includes(u.port))) throw new Error('endereco')
  const ips = net.isIP(u.hostname) ? [{ address: u.hostname }] : await dns.lookup(u.hostname, { all: true })
  if (!ips.length || ips.some((i) => ipPrivado(i.address))) throw new Error('endereco')
  const r = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(9000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; receitas/1.0)', Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'pt-BR,pt;q=0.9' } })
  if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
    if (saltos >= 4) throw new Error('redirecionamentos')
    return buscarPagina(new URL(r.headers.get('location'), u).href, saltos + 1)
  }
  if (!r.ok) throw new Error('status ' + r.status)
  if (!/html|xml/i.test(r.headers.get('content-type') || '')) throw new Error('tipo')
  const partes = []
  let total = 0
  for await (const c of r.body) {
    total += c.length
    if (total > 3_000_000) break
    partes.push(c)
  }
  return Buffer.concat(partes).toString('utf8')
}

async function handleReceita(req, res) {
  const ctx = await openFamily(req, res)
  if (!ctx) return
  if (!Object.values(ctx.fam.items).some((i) => i.type === 'member' && !i.deleted)) return json(res, 403, { error: 'family not found' })
  let endereco = String(ctx.body.url || '').trim()
  if (endereco && !/^https?:\/\//i.test(endereco)) endereco = 'https://' + endereco
  let html
  try {
    html = await buscarPagina(endereco)
  } catch (err) {
    return json(res, 200, { ok: false, motivo: err.message === 'endereco' || err instanceof TypeError ? 'endereco' : 'site' })
  }
  const receita = receitaDeHtml(html)
  json(res, 200, receita ? { ok: true, receita } : { ok: false, motivo: 'sem-receita' })
}

// Itens só do servidor (cadastros de notificação) não vão para os aparelhos.
const PRIVATE_TYPES = new Set(['pushsub'])

// Sincronização: o app manda o que mudou e recebe tudo que mudou desde a última revisão que viu.
// Conflito: vence a alteração mais recente (updatedAt).
async function handleSync(req, res) {
  const ctx = await openFamily(req, res)
  if (!ctx) return
  const { body, key, fam } = ctx
  notifier.seen(key, body.device)
  const changes = Array.isArray(body.changes) ? body.changes : []
  const changed = []
  const events = []
  for (const c of changes) {
    if (!c || typeof c.id !== 'string' || typeof c.type !== 'string' || PRIVATE_TYPES.has(c.type)) continue
    const cur = fam.items[c.id]
    if (!cur || (c.updatedAt || 0) >= (cur.updatedAt || 0)) {
      fam.rev += 1
      fam.items[c.id] = { ...c, rev: fam.rev }
      changed.push(fam.items[c.id])
      events.push([cur, fam.items[c.id]])
    }
  }
  if (changed.length) saveFamily(key, changed)
  const since = body.epoch === fam.epoch ? Number(body.since) || 0 : 0
  const items = Object.values(fam.items).filter((i) => i.rev > since && !PRIVATE_TYPES.has(i.type))
  json(res, 200, { rev: fam.rev, epoch: fam.epoch, items })
  // Avisa a família depois de responder, para não atrasar a sincronização.
  if (events.length && body.me) notifier.onChanges(key, fam, body.me, body.device, events)
}

async function handlePush(req, res, action) {
  if (action === 'key') {
    try {
      return json(res, 200, { key: await notifier.publicKey() })
    } catch (err) {
      console.error('Falha ao preparar as notificações:', err.message)
      return json(res, 503, { error: 'push unavailable' })
    }
  }
  const ctx = await openFamily(req, res)
  if (!ctx) return
  const { body, key, fam } = ctx
  try {
    if (action === 'subscribe') return json(res, 200, await notifier.subscribe(key, fam, body))
    if (action === 'unsubscribe') return json(res, 200, notifier.unsubscribe(key, fam, body))
    if (action === 'test') return json(res, 200, await notifier.test(key, fam, body))
  } catch (err) {
    return json(res, 400, { error: err.message })
  }
  json(res, 404, { error: 'not found' })
}

// Diz onde os dados estão sendo guardados e se o banco responde (sem expor chaves).
async function handleHealth(res) {
  if (!USE_DB) return json(res, 200, { ok: true, storage: 'file', persistent: PERSISTENT, missing: MISSING })
  const problem = keyProblem()
  if (problem) return json(res, 200, { ok: false, storage: 'supabase', db: problem, persistent: true })
  try {
    await sb('families?select=family&limit=1')
    json(res, 200, { ok: true, storage: 'supabase', db: 'ok', persistent: true })
  } catch (err) {
    json(res, 200, { ok: false, storage: 'supabase', db: err.message.slice(0, 200), persistent: true })
  }
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
    const url = req.url.split('?')[0]
    if (url === '/api/sync' && req.method === 'POST') return handleSync(req, res).catch(() => json(res, 500, { error: 'server error' }))
    if (url.startsWith('/api/push/')) return handlePush(req, res, url.slice(10)).catch(() => json(res, 500, { error: 'server error' }))
    if (url === '/api/receita' && req.method === 'POST') return handleReceita(req, res).catch(() => json(res, 500, { error: 'server error' }))
    if (url === '/api/health') return handleHealth(res)
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res)
    json(res, 404, { error: 'not found' })
  })
  .listen(PORT, () => {
    console.log(`Nosso Lar rodando em http://localhost:${PORT} — dados ${USE_DB ? 'no Supabase' : 'em ' + DATA}`)
    if (!PERSISTENT)
      console.warn(`ATENÇÃO: falta ${MISSING.join(' e ')} no ambiente. Os dados e as chaves das notificações se perdem quando o servidor reinicia.`)
    if (USE_DB && keyProblem()) console.warn('ATENÇÃO: ' + keyProblem())
    notifier.start()
  })
