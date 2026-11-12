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
import { privacidadeHtml, termosHtml } from './legal.js'
import { ajustarEscrita, podeVer, redigir } from './src/privacidade.js'
import { createFotos, hashDe, idValido, MAX_ARQUIVO, tipoDe } from './fotos-server.js'
import { AuthError, createAuth, createMailer, jwksFetcher } from './auth.js'
import { AsaasError, createAsaas } from './asaas.js'
import { createBilling, LEITURA_MS, PLANOS, TESTE_MS } from './billing.js'

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
    if (!families.has(key)) return // a família foi apagada enquanto gravava
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

// Grava (criando ou substituindo) uma configuração. Usado pelas contas e sessões.
async function putConfig(name, value) {
  if (USE_DB) {
    await sb('families?on_conflict=family', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ family: `__cfg_${name}`, epoch: JSON.stringify(value) }]),
    })
    return
  }
  const file = path.join(DATA, `__cfg_${name}.json`)
  fs.writeFileSync(file + '.tmp', JSON.stringify(value))
  fs.renameSync(file + '.tmp', file)
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

// ---------- contas ----------
const APP_URL = env('APP_URL', 'RENDER_EXTERNAL_URL').replace(/\/+$/, '')
const mailer = createMailer({ apiKey: env('RESEND_API_KEY'), from: env('EMAIL_FROM'), apiUrl: env('EMAIL_API_URL') || undefined })
const GOOGLE_ID = env('GOOGLE_CLIENT_ID')
const authSvc = createAuth({
  read: getConfig,
  write: putConfig,
  clientId: GOOGLE_ID,
  getJwks: GOOGLE_ID ? jwksFetcher(env('GOOGLE_JWKS_URL') || 'https://www.googleapis.com/oauth2/v3/certs') : null,
  mailer,
  appUrl: APP_URL,
  requireAccount: !['0', 'false', 'nao', 'não', 'off'].includes(env('REQUIRE_ACCOUNT').toLowerCase()), // contas obrigatórias, a menos que REQUIRE_ACCOUNT=0
})
setInterval(() => authSvc.sweep(), 3600_000).unref()
// Atrás de um proxy (Render), o endereço de quem acessa vem no fim do X-Forwarded-For (PROXY_HOPS = quantos proxies há).
const clientIp = (req) => {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean)
  const hops = Math.max(1, Number(env('PROXY_HOPS')) || 1)
  return xff.length ? xff[Math.max(0, xff.length - hops)] : req.socket.remoteAddress || ''
}
const bearer = (req) => (/^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '') || [])[1] || ''

// ---------- assinatura (Asaas) ----------
// Sem ASAAS_API_KEY não há cobrança: tudo fica liberado, como antes. TEST_TIME_OFFSET_MS existe só para testes.
const ASAAS_KEY = env('ASAAS_API_KEY')
const WEBHOOK_TOKEN = env('ASAAS_WEBHOOK_TOKEN')
const agora = () => Date.now() + (Number(env('TEST_TIME_OFFSET_MS')) || 0)
const billing = createBilling({
  read: getConfig,
  write: putConfig,
  auth: authSvc,
  asaas: ASAAS_KEY ? createAsaas({ apiKey: ASAAS_KEY, baseUrl: env('ASAAS_URL') || undefined }) : null,
  gratis: env('BILLING_FREE_EMAILS').split(','),
  now: agora,
})

const notifier = createNotifier({ families, loadFamily, putItem, getConfig, setConfig, familiesWithPush })

// ---------- HTTP ----------
function readBody(req, max = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > max) {
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

// Confere o código da família e se este pedido pode usá-la (famílias protegidas só abrem para contas autorizadas).
async function checkFamily(req, res, rawCode, { create = false, me = null, needExisting = false, cobrar = true } = {}) {
  const code = String(rawCode || '').trim().toUpperCase()
  if (!/^[A-Z0-9-]{6,40}$/.test(code)) {
    json(res, 400, { error: 'invalid family code' })
    return null
  }
  const key = keyFor(code)
  try {
    const fam = await loadFamily(key)
    const gate = await authSvc.authorize({ token: bearer(req), key, famRev: fam.rev, create, me })
    if (!gate.ok) {
      json(res, gate.status, { error: gate.error, reason: gate.reason, canJoin: gate.canJoin, removed: gate.removed })
      return null
    }
    // Assinatura: teste e período pago liberam tudo; vencida, só leitura por 3 dias e depois bloqueada.
    if (billing.enabled && gate.account && cobrar) {
      const c = await billing.avaliar(key)
      if (c) {
        gate.cobranca = c.resumo
        if (c.est.estado === 'bloqueada') {
          json(res, 402, { error: 'payment_required', billing: c.resumo })
          return null
        }
        if (c.est.estado === 'leitura') gate.readOnly = true
      }
    }
    if (needExisting && fam.rev === 0) {
      json(res, 404, { error: 'family not found' })
      return null
    }
    return { key, fam, gate }
  } catch (err) {
    console.error('Falha ao carregar a família:', err.message)
    json(res, 503, { error: 'storage unavailable' })
    return null
  }
}

// Lê o corpo JSON, valida o código da família e carrega os dados dela.
async function openFamily(req, res) {
  let body
  try {
    body = JSON.parse(await readBody(req))
  } catch {
    json(res, 400, { error: 'invalid body' })
    return null
  }
  const ctx = await checkFamily(req, res, body.family, { create: body.create === true, me: typeof body.me === 'string' ? body.me : null })
  return ctx && { body, ...ctx }
}

// ---------- fotos e anexos ----------
const fotos = createFotos({ sb, useDb: USE_DB, dataDir: DATA })

function readRaw(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > max) {
        reject(new Error('too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// PUT /api/foto/<id> (envia), GET (baixa), DELETE (apaga). A família vai no cabeçalho X-Family.
async function handleFoto(req, res, id) {
  if (!idValido(id)) return json(res, 400, { error: 'invalid id' })
  const ctx = await checkFamily(req, res, req.headers['x-family'], { needExisting: true })
  if (!ctx) return
  const { key, gate } = ctx
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const buf = await fotos.get(key, id)
      if (!buf) return json(res, 404, { error: 'not found' })
      const tipo = tipoDe(buf)
      res.writeHead(200, {
        'Content-Type': tipo,
        'Content-Length': buf.length,
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        ...(tipo.startsWith('image/') ? {} : { 'Content-Disposition': 'attachment' }), // só imagens abrem na tela
      })
      return res.end(req.method === 'HEAD' ? undefined : buf)
    }
    if (gate.readOnly) return json(res, 403, { error: 'read only' })
    if (req.method === 'PUT') {
      const buf = await readRaw(req, MAX_ARQUIVO)
      if (!buf.length) return json(res, 400, { error: 'empty' })
      if (hashDe(buf) !== id) return json(res, 400, { error: 'hash mismatch' }) // o nome é o resumo do conteúdo
      await fotos.put(key, id, buf)
      return json(res, 200, { ok: true })
    }
    if (req.method === 'DELETE') {
      await fotos.del(key, id)
      return json(res, 200, { ok: true })
    }
    json(res, 405, { error: 'method not allowed' })
  } catch (err) {
    if (err.message === 'too large') return json(res, 413, { error: 'too large' })
    console.error('Falha em /api/foto:', err.message)
    json(res, 500, { error: 'server error' })
  }
}

// Fotos que ficaram sem uso (o item que as citava foi apagado) saem do armazenamento.
const idsDeFotos = (it) => [it.foto, it.mini, it.arquivo].filter(idValido)
async function limparFotosSemUso(key, fam, candidatos) {
  const emUso = new Set()
  for (const it of Object.values(fam.items)) if (!it.deleted) idsDeFotos(it).forEach((id) => emUso.add(id))
  for (const id of new Set(candidatos)) if (!emUso.has(id)) await fotos.del(key, id).catch(() => {})
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
  const { body, key, fam, gate } = ctx
  // Numa família protegida, cada conta age como o membro ligado a ela, e a privacidade entre as pessoas vale.
  const protegida = !!gate.account
  let yo = gate.member
  // Aparelho que já sabia quem é (antes da conta existir): liga a conta a esse membro, se ele ainda não for de outra conta.
  if (protegida && !yo && typeof body.me === 'string' && fam.items[body.me]?.type === 'member' && !fam.items[body.me].deleted) {
    try {
      await authSvc.setMember({ id: gate.account }, key, body.me)
      yo = body.me
    } catch {}
  }
  if (yo) body.me = yo
  notifier.seen(key, body.device)
  const changes = Array.isArray(body.changes) && !gate.readOnly ? body.changes : []
  const changed = []
  const events = []
  for (const c of changes) {
    if (!c || typeof c.id !== 'string' || typeof c.type !== 'string' || PRIVATE_TYPES.has(c.type)) continue
    const cur = fam.items[c.id]
    const novo = protegida ? ajustarEscrita(cur, c, yo) : c
    if (!novo) continue // essa pessoa não pode mexer nesse item (é de outra pessoa)
    if (!cur || (novo.updatedAt || 0) >= (cur.updatedAt || 0)) {
      fam.rev += 1
      fam.items[c.id] = { ...novo, rev: fam.rev }
      changed.push(fam.items[c.id])
      events.push([cur, fam.items[c.id]])
    }
  }
  if (changed.length) saveFamily(key, changed)
  const since = body.epoch === fam.epoch ? Number(body.since) || 0 : 0
  const items = Object.values(fam.items)
    .filter((i) => i.rev > since && !PRIVATE_TYPES.has(i.type) && (!protegida || podeVer(i, yo)))
    .map((i) => (protegida ? redigir(i, yo) : i))
  json(res, 200, { rev: fam.rev, epoch: fam.epoch, items, acct: protegida ? { role: gate.role, member: yo || null } : undefined, billing: gate.cobranca, somenteLeitura: gate.readOnly || undefined })
  // Avisa a família depois de responder, para não atrasar a sincronização.
  if (events.length && body.me) notifier.onChanges(key, fam, body.me, body.device, events)
  // Foto que deixou de ser citada por qualquer item (apagada, trocada) sai do armazenamento.
  const soltas = events.flatMap(([antes, depois]) => (antes ? idsDeFotos(antes).filter((id) => !idsDeFotos(depois).includes(id)) : []))
  if (soltas.length) limparFotosSemUso(key, fam, soltas).catch(() => {})
}

// ---------- /api/billing/* ----------
const BILLING_MSG = {
  invalid_plan: 'Plano inválido.',
  invalid_cpf: 'CPF ou CNPJ inválido. Confira os números.',
  courtesy: 'Esta família não é cobrada.',
  already_subscribed: 'Você já tem uma assinatura de outro plano. Cancele a renovação antes de trocar.',
  no_invoice: 'Criei a assinatura, mas o Asaas ainda não gerou a cobrança. Tente de novo em instantes.',
  no_subscription: 'Não há assinatura ativa para cancelar.',
  billing_off: 'A cobrança ainda não está ligada neste servidor.',
  not_owner: 'Só o dono da família pode fazer isso.',
}

const mesmoToken = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))

async function handleBilling(req, res, action) {
  if (req.method !== 'POST') return json(res, 404, { error: 'not found' })
  if (action === 'webhook') {
    // O Asaas manda o token combinado no cabeçalho asaas-access-token (não há assinatura do conteúdo).
    if (!billing.enabled || !WEBHOOK_TOKEN) return json(res, 503, { error: 'webhook off' })
    if (!mesmoToken(String(req.headers['asaas-access-token'] || ''), WEBHOOK_TOKEN)) return json(res, 401, { error: 'invalid token' })
    let corpo
    try {
      corpo = JSON.parse((await readBody(req, 512 * 1024)) || '{}')
    } catch {
      return json(res, 400, { error: 'invalid body' })
    }
    try {
      json(res, 200, { ok: true, resultado: await billing.webhook(corpo) })
    } catch (err) {
      console.error('Falha ao processar aviso do Asaas:', err.message)
      json(res, 500, { error: 'server error' }) // o Asaas tenta de novo
    }
    return
  }
  let body
  try {
    body = JSON.parse((await readBody(req, 64 * 1024)) || '{}')
  } catch {
    return json(res, 400, { error: 'invalid body' })
  }
  try {
    const acct = await authSvc.session(bearer(req))
    if (!acct) return json(res, 401, { error: 'invalid_session' })
    const code = String(body.family || '').trim().toUpperCase()
    if (!/^[A-Z0-9-]{6,40}$/.test(code)) return json(res, 400, { error: 'invalid family code' })
    const key = keyFor(code)
    const info = await authSvc.info(acct, key) // só quem é da família
    if (!billing.enabled) return json(res, 200, { estado: 'desligada', role: info.role })
    if (action === 'status') {
      if (body.refresh === true && info.role === 'owner') await billing.sincronizar(key).catch((err) => console.error('Falha ao conferir pagamentos:', err.message))
      const c = await billing.avaliar(key)
      return json(res, 200, { ...c.resumo, role: info.role })
    }
    if (info.role !== 'owner') throw new AuthError('not_owner', 403)
    if (action === 'checkout') return json(res, 200, await billing.checkout(key, { plano: body.plano, cpfCnpj: body.cpfCnpj }))
    if (action === 'cancel') {
      await billing.cancelar(key)
      return json(res, 200, { ...(await billing.avaliar(key)).resumo, role: info.role })
    }
    json(res, 404, { error: 'not found' })
  } catch (err) {
    if (err instanceof AuthError) return json(res, err.status, { error: err.code, message: BILLING_MSG[err.code] || AUTH_MSG[err.code], ...err.extra })
    if (err instanceof AsaasError) {
      console.error('Asaas:', err.status, err.message)
      return json(res, 502, { error: 'asaas_error', message: err.message })
    }
    console.error('Falha em /api/billing/' + action + ':', err.message)
    json(res, 500, { error: 'server error' })
  }
}

// ---------- /api/auth/* ----------
const AUTH_MSG = {
  invalid_email: 'Esse e-mail não parece válido.',
  weak_password: 'A senha precisa ter pelo menos 8 caracteres.',
  exists: 'Já existe uma conta com esse e-mail. Entre com ela.',
  invalid_credentials: 'E-mail ou senha incorretos.',
  unverified: 'Confirme seu e-mail primeiro: enviamos um link para a sua caixa de entrada.',
  rate_limited: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
  invalid_token: 'Esse link já foi usado ou expirou. Peça um novo.',
  email_off: 'A recuperação por e-mail ainda não está ligada neste servidor.',
  google_off: 'O login com Google não está ligado neste servidor.',
  invalid_google: 'Não consegui confirmar a sua conta do Google. Tente de novo.',
  email_not_verified: 'O Google diz que esse e-mail ainda não foi confirmado.',
  conflict: 'Esse e-mail já está ligado a outra conta do Google.',
  already_protected: 'Essa família já é protegida por outra conta. Entre nela pelo código.',
  removed: 'O dono da família removeu o acesso desta conta.',
  invites_closed: 'Os convites dessa família estão fechados. Peça ao dono para abri-los.',
  not_member: 'Essa conta não faz parte da família.',
  confirm_mismatch: 'Digite o seu e-mail exatamente como está na conta para confirmar.',
  owner_has_members: 'Você é o dono de uma família com outras contas. Torne outra pessoa dona (ou remova as contas) antes de excluir a sua.',
  owner_alone: 'Você é a única conta e dona da família. Marque "apagar a família inteira" para continuar, ou convide alguém e passe a propriedade antes.',
  not_owner: 'Só o dono da família pode fazer isso.',
  member_taken: 'Essa pessoa já está ligada a outra conta.',
}

// Apaga (marca como removido) o que é de uma pessoa dentro da família: o perfil e o que ela cadastrou.
async function eraseMemberData(key, fam, memberId) {
  let n = 0
  const fotosDele = []
  for (const it of Object.values(fam.items)) {
    if (it.deleted) continue
    if (it.id === memberId || it.createdBy === memberId || it.memberId === memberId || it.to === memberId || it.owner === memberId || it.member === memberId) {
      fotosDele.push(...idsDeFotos(it))
      putItem(key, fam, { id: it.id, type: it.type, deleted: true, createdAt: it.createdAt })
      n++
    }
  }
  await limparFotosSemUso(key, fam, fotosDele)
  return n
}

// Apaga a família inteira do servidor (memória, banco ou arquivo).
async function deleteFamilyData(key) {
  clearTimeout(saveTimers.get(key))
  saveTimers.delete(key)
  dirty.delete(key)
  families.delete(key)
  if (USE_DB) await sb(`families?family=eq.${key}`, { method: 'DELETE' }) // os itens saem junto
  else fs.rmSync(fileFor(key), { force: true })
  await fotos.delAll(key).catch((err) => console.error('Falha ao apagar as fotos:', err.message))
  await authSvc.dropFamilyAuth(key)
}

// Dados ligados à pessoa, para ela baixar (portabilidade). Não inclui a lista de outros membros nem as mensagens dos outros.
async function exportAccount(acct, extraKey) {
  const out = { geradoEm: new Date().toISOString(), conta: { email: acct.email, nome: acct.name || '', criadaEm: acct.at ? new Date(acct.at).toISOString() : null, entraComSenha: !!acct.pass, entraComGoogle: !!acct.google }, familias: [] }
  for (const f of await authSvc.myFamilies(acct, extraKey ? [extraKey] : [])) {
    const fam = await loadFamily(f.key)
    const m = f.member
    const meus = m ? Object.values(fam.items).filter((it) => !it.deleted && it.type !== 'pushsub' && (it.id === m || it.createdBy === m || it.memberId === m || it.to === m || it.owner === m)) : []
    out.familias.push({ nome: fam.items.family?.name || '', papel: f.role === 'owner' ? 'dono' : 'membro', membro: m ? fam.items[m]?.name || '' : '', itens: meus })
  }
  return out
}

async function handleAuth(req, res, action) {
  if (action === 'config') return req.method === 'GET' ? json(res, 200, authSvc.config()) : json(res, 404, { error: 'not found' })
  if (req.method !== 'POST') return json(res, 404, { error: 'not found' })
  let body
  try {
    body = JSON.parse((await readBody(req, 64 * 1024)) || '{}')
  } catch {
    return json(res, 400, { error: 'invalid body' })
  }
  const ctx = { ip: clientIp(req), device: String(req.headers['user-agent'] || '') }
  const token = bearer(req)
  try {
    const open = { register: 'register', login: 'login', google: 'google', verify: 'verify', forgot: 'forgot', reset: 'reset' }
    if (open[action]) return json(res, 200, await authSvc[open[action]](body, ctx))
    // Daqui para a frente é preciso estar conectado.
    const acct = await authSvc.session(token)
    if (!acct) return json(res, 401, { error: 'invalid_session' })
    if (action === 'me') return json(res, 200, { account: authSvc.publicAccount(acct) })
    if (action === 'logout') return json(res, 200, await authSvc.logout(token))
    const codeOf = (c) => (/^[A-Z0-9-]{6,40}$/.test(String(c || '').trim().toUpperCase()) ? keyFor(String(c).trim().toUpperCase()) : null)
    if (action === 'export') {
      res.setHeader('Content-Disposition', 'attachment; filename="nosso-lar-meus-dados.json"')
      return json(res, 200, await exportAccount(acct, codeOf(body.family)))
    }
    if (action === 'delete') {
      await authSvc.confirmDelete(acct, body)
      const fams = await authSvc.myFamilies(acct, codeOf(body.family) ? [codeOf(body.family)] : [])
      // Primeiro confere tudo, depois apaga: assim nada fica pela metade.
      for (const f of fams) {
        if (f.role === 'owner' && f.others > 0) throw new AuthError('owner_has_members', 409)
        if (f.role === 'owner' && body.deleteFamily !== true) throw new AuthError('owner_alone', 409)
      }
      const feito = { familiasApagadas: 0, familiasDeixadas: 0 }
      for (const f of fams) {
        if (f.role === 'owner') {
          await deleteFamilyData(f.key)
          feito.familiasApagadas++
          continue
        }
        if (body.deleteMine === true && f.member) await eraseMemberData(f.key, await loadFamily(f.key), f.member)
        await authSvc.leaveFamily(acct, f.key)
        feito.familiasDeixadas++
      }
      await authSvc.eraseAccount(acct)
      return json(res, 200, { ok: true, ...feito })
    }
    if (action === 'password') return json(res, 200, await authSvc.changePassword(acct, body))
    // Ações de família: o código identifica a família.
    const code = String(body.family || '').trim().toUpperCase()
    if (!/^[A-Z0-9-]{6,40}$/.test(code)) return json(res, 400, { error: 'invalid family code' })
    const key = keyFor(code)
    if (action === 'claim') {
      const fam = await loadFamily(key)
      if (fam.rev === 0) return json(res, 404, { error: 'family_not_found' })
      await authSvc.claim(acct, key, typeof body.member === 'string' ? body.member : null)
      return json(res, 200, await authSvc.info(acct, key))
    }
    if (action === 'join') {
      await authSvc.join(acct, key, ctx)
      return json(res, 200, await authSvc.info(acct, key))
    }
    if (action === 'info') return json(res, 200, await authSvc.info(acct, key))
    if (action === 'member') {
      await authSvc.setMember(acct, key, typeof body.member === 'string' ? body.member : null)
      return json(res, 200, await authSvc.info(acct, key))
    }
    if (action === 'manage') {
      await authSvc.manage(acct, key, body)
      return json(res, 200, await authSvc.info(acct, key))
    }
    json(res, 404, { error: 'not found' })
  } catch (err) {
    if (err instanceof AuthError) return json(res, err.status, { error: err.code, message: AUTH_MSG[err.code], ...err.extra })
    console.error('Falha em /api/auth/' + action + ':', err.message)
    json(res, 500, { error: 'server error' })
  }
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
// Diz se a cobrança está ligada, sem mostrar chaves (ajuda a descobrir o que falta configurar).
const infoCobranca = () => ({ cobranca: billing.enabled ? (String(ASAAS_KEY).includes('_hmlg_') ? 'sandbox' : 'producao') : 'desligada', webhook: billing.enabled ? !!WEBHOOK_TOKEN : undefined })

async function handleHealth(res) {
  if (!USE_DB) return json(res, 200, { ok: true, storage: 'file', persistent: PERSISTENT, missing: MISSING, ...infoCobranca() })
  const problem = keyProblem()
  if (problem) return json(res, 200, { ok: false, storage: 'supabase', db: problem, persistent: true })
  try {
    await sb('families?select=family&limit=1')
    json(res, 200, { ok: true, storage: 'supabase', db: 'ok', persistent: true, ...infoCobranca() })
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

// Ao desligar (a cada deploy do Render, por exemplo), grava o que ainda estava esperando os 300 ms de espera.
async function gravarTudo() {
  for (const key of saveTimers.keys()) {
    clearTimeout(saveTimers.get(key))
    try {
      if (USE_DB) await dbFlush(key)
      else if (families.has(key)) fileSave(key)
    } catch (err) {
      console.error('Falha ao gravar ao desligar:', err.message)
    }
  }
}
for (const sinal of ['SIGTERM', 'SIGINT']) process.on(sinal, () => Promise.race([gravarTudo(), new Promise((r) => setTimeout(r, 4000))]).finally(() => process.exit(0)))

http
  .createServer((req, res) => {
    const url = req.url.split('?')[0]
    if (url === '/api/sync' && req.method === 'POST') return handleSync(req, res).catch(() => json(res, 500, { error: 'server error' }))
    if (url.startsWith('/api/billing/')) return handleBilling(req, res, url.slice(13)).catch(() => json(res, 500, { error: 'server error' }))
    if (url.startsWith('/api/foto/')) return handleFoto(req, res, url.slice(10)).catch(() => json(res, 500, { error: 'server error' }))
    if (url.startsWith('/api/auth/')) return handleAuth(req, res, url.slice(10)).catch(() => json(res, 500, { error: 'server error' }))
    if (url.startsWith('/api/push/')) return handlePush(req, res, url.slice(10)).catch(() => json(res, 500, { error: 'server error' }))
    if (url === '/api/receita' && req.method === 'POST') return handleReceita(req, res).catch(() => json(res, 500, { error: 'server error' }))
    if (url === '/termos' && (req.method === 'GET' || req.method === 'HEAD')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
      return res.end(termosHtml({ contato: env('CONTACT_EMAIL'), empresa: env('COMPANY_NAME'), cnpj: env('COMPANY_CNPJ'), revisado: ['1', 'true', 'sim'].includes(env('TERMOS_REVISADOS').toLowerCase()), precos: { mensal: PLANOS.mensal.valor, anual: PLANOS.anual.valor }, testeDias: TESTE_MS / 86400000, leituraDias: LEITURA_MS / 86400000 }))
    }
    if (url === '/privacidade' && (req.method === 'GET' || req.method === 'HEAD')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
      return res.end(privacidadeHtml({ contato: env('CONTACT_EMAIL') }))
    }
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
    console.log(authSvc.config().requireAccount ? 'Contas obrigatórias: toda família exige e-mail e senha ou Google.' : 'ATENÇÃO: REQUIRE_ACCOUNT=0, famílias podem abrir só com o código.')
    if (GOOGLE_ID) console.log('Login com Google ligado.')
    if (billing.enabled) console.log('Cobrança ligada (Asaas ' + (String(ASAAS_KEY).includes('_hmlg_') ? 'sandbox' : 'produção') + ').')
    if (billing.enabled && !WEBHOOK_TOKEN) console.warn('ATENÇÃO: falta ASAAS_WEBHOOK_TOKEN. Sem ele os avisos de pagamento do Asaas são recusados; pagamentos só entram quando o dono toca em "Já paguei".')
    if (mailer && !APP_URL) console.warn('ATENÇÃO: RESEND_API_KEY definido, mas falta APP_URL (o endereço do app). Verificação e recuperação por e-mail ficam desligadas.')
  })
