// Contas do Nosso Lar: e-mail e senha, login com Google e proteção das famílias.
// Não depende do servidor HTTP nem do banco: quem usa passa as funções de leitura e gravação.
import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(crypto.scrypt)
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const b64u = (s) => Buffer.from(s, 'base64url')

export const normEmail = (e) => String(e || '').trim().toLowerCase()
export const validEmail = (e) => e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)

// ---------- senhas (scrypt, com sal e comparação em tempo constante) ----------
const SC = { N: 16384, r: 8, p: 1 }
const KEYLEN = 64

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const h = await scrypt(password, salt, KEYLEN, { ...SC, maxmem: 64 * 1024 * 1024 })
  return ['scrypt', SC.N, SC.r, SC.p, salt.toString('base64'), h.toString('base64')].join('$')
}

export async function checkPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = String(stored || '').split('$')
  if (alg !== 'scrypt' || !hash) return false
  const want = Buffer.from(hash, 'base64')
  const got = await scrypt(password, Buffer.from(salt, 'base64'), want.length, { N: +N, r: +r, p: +p, maxmem: 64 * 1024 * 1024 })
  return got.length === want.length && crypto.timingSafeEqual(got, want)
}

let dummy
// Faz o mesmo trabalho quando a conta não existe, para o tempo da resposta não revelar quem tem conta.
const gastarTempo = async (password) => {
  dummy ||= await hashPassword('dummy-password')
  await checkPassword(password, dummy)
}

// ---------- limite de tentativas ----------
export function createLimiter() {
  const m = new Map()
  const recent = (key, windowMs) => {
    const now = Date.now()
    const arr = (m.get(key) || []).filter((t) => now - t < windowMs)
    m.set(key, arr)
    return arr
  }
  return {
    // Conta uma tentativa; false quando passou do limite.
    hit(key, max, windowMs) {
      const arr = recent(key, windowMs)
      if (arr.length >= max) return false
      arr.push(Date.now())
      return true
    },
    count: (key, windowMs) => recent(key, windowMs).length,
    add: (key, windowMs) => recent(key, windowMs).push(Date.now()),
    clear: (key) => m.delete(key),
    sweep(windowMs = 3600_000) {
      for (const k of m.keys()) if (!recent(k, windowMs).length) m.delete(k)
    },
  }
}

// ---------- login com Google ----------
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com'])

/** Confere o token do Google: assinatura, emissor, destinatário (nosso clientId), validade e e-mail verificado. */
export async function verifyGoogleToken(idToken, { clientId, getJwks, now = Date.now() }) {
  const parts = String(idToken || '').split('.')
  if (parts.length !== 3 || idToken.length > 4096 || !clientId) throw new Error('token')
  let header, payload
  try {
    header = JSON.parse(b64u(parts[0]).toString())
    payload = JSON.parse(b64u(parts[1]).toString())
  } catch {
    throw new Error('token')
  }
  if (header.alg !== 'RS256') throw new Error('token')
  let jwk = (await getJwks()).keys?.find((k) => k.kid === header.kid)
  if (!jwk) jwk = (await getJwks(true)).keys?.find((k) => k.kid === header.kid) // chaves novas
  if (!jwk) throw new Error('token')
  const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), crypto.createPublicKey({ key: jwk, format: 'jwk' }), b64u(parts[2]))
  if (!ok) throw new Error('token')
  if (!ISSUERS.has(payload.iss) || payload.aud !== clientId || !(payload.exp * 1000 > now - 60_000)) throw new Error('token')
  if (payload.email_verified !== true && payload.email_verified !== 'true') throw new Error('email_not_verified')
  const email = normEmail(payload.email)
  if (!payload.sub || !validEmail(email)) throw new Error('token')
  return { sub: String(payload.sub), email, name: String(payload.name || '').slice(0, 80) }
}

export function jwksFetcher(url, fetchImpl = fetch) {
  let cache = null
  return async (force) => {
    if (!force && cache && Date.now() - cache.at < 3600_000) return cache.v
    const r = await fetchImpl(url, { signal: AbortSignal.timeout(6000) })
    if (!r.ok) throw new Error('jwks')
    cache = { v: await r.json(), at: Date.now() }
    return cache.v
  }
}

// ---------- e-mail (opcional; sem isso não há verificação nem recuperação de senha) ----------
export function createMailer({ apiKey, from, apiUrl = 'https://api.resend.com/emails', fetchImpl = fetch }) {
  if (!apiKey || !from) return null
  return {
    async send({ to, subject, text }) {
      const r = await fetchImpl(apiUrl, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, text }), signal: AbortSignal.timeout(10000) })
      if (!r.ok) throw new Error('email ' + r.status)
    },
  }
}

export class AuthError extends Error {
  constructor(code, status = 400, extra = {}) {
    super(code)
    this.code = code
    this.status = status
    this.extra = extra
  }
}
const fail = (code, status, extra) => {
  throw new AuthError(code, status, extra)
}

const SESSION_MS = 180 * 86400_000
const TOKEN_MS = 3600_000
const CACHE_MS = 60_000

/**
 * @param read   async (nome) => valor | null
 * @param write  async (nome, valor) => void   (cria ou substitui)
 */
export function createAuth({ read, write, clientId = '', getJwks = null, mailer = null, appUrl = '', requireAccount = false, limiter = createLimiter() }) {
  const cache = new Map()
  const locks = new Map()
  const get = async (name) => {
    const c = cache.get(name)
    if (c && Date.now() - c.at < CACHE_MS) return c.v
    const v = await read(name)
    cache.set(name, { v, at: Date.now() })
    return v
  }
  const put = async (name, v) => {
    await write(name, v)
    cache.set(name, { v, at: Date.now() })
    return v
  }
  // Uma alteração por vez em cada registro (ler → mudar → gravar sem outra no meio).
  const lock = (name, fn) => {
    const prev = locks.get(name) || Promise.resolve()
    const next = prev.then(fn, fn)
    locks.set(name, next.catch(() => {}))
    return next
  }

  const accountId = (email) => sha(email).slice(0, 32)
  const acctName = (id) => 'acct-' + id
  const publicAccount = (a) => ({ email: a.email, name: a.name || '', hasPassword: !!a.pass, google: !!a.google, verified: !!a.verified })
  const emailOn = !!(mailer && appUrl)

  // Lista (no registro da conta) as famílias de que ela participa, para exportar e excluir os dados depois.
  const indexFam = (id, key) =>
    lock(acctName(id), async () => {
      const cur = await get(acctName(id))
      if (cur && !cur.fams?.includes(key)) await put(acctName(id), { ...cur, fams: [...(cur.fams || []), key] })
    })

  async function newSession(a, device = '') {
    const token = crypto.randomBytes(32).toString('base64url')
    await put('sess-' + sha(token).slice(0, 40), { a: a.id, v: a.sv || 0, exp: Date.now() + SESSION_MS, at: Date.now(), device: String(device).slice(0, 60) })
    return token
  }

  async function sessionAccount(token) {
    if (typeof token !== 'string' || token.length < 30 || token.length > 100) return null
    const s = await get('sess-' + sha(token).slice(0, 40))
    if (!s || s.exp < Date.now()) return null
    const a = await get(acctName(s.a))
    if (!a || (a.sv || 0) !== s.v) return null
    return a
  }

  async function newToken(a, kind) {
    const token = crypto.randomBytes(32).toString('base64url')
    await put('tok-' + sha(token).slice(0, 40), { a: a.id, kind, exp: Date.now() + TOKEN_MS })
    return token
  }
  async function useToken(token, kind) {
    const name = 'tok-' + sha(String(token || '')).slice(0, 40)
    return lock(name, async () => {
      const t = await get(name)
      if (!t || t.kind !== kind || t.exp < Date.now()) fail('invalid_token', 400)
      await put(name, { ...t, exp: 0 }) // vale uma vez só
      const a = await get(acctName(t.a))
      if (!a) fail('invalid_token', 400)
      return a
    })
  }

  const tooMany = (ip, key = 'auth', max = 60) => {
    if (!limiter.hit(`${key}:ip:${ip}`, max, 10 * 60_000)) fail('rate_limited', 429)
  }

  const api = {
    config: () => ({ google: clientId || null, email: emailOn, requireAccount }),

    async register({ email, password, name }, { ip = '', device } = {}) {
      tooMany(ip)
      email = normEmail(email)
      password = String(password || '')
      if (!validEmail(email)) fail('invalid_email')
      if (password.length < 8 || password.length > 200) fail('weak_password')
      const id = accountId(email)
      const a = await lock(acctName(id), async () => {
        if (await get(acctName(id))) fail('exists', 409)
        return put(acctName(id), { id, email, name: String(name || '').trim().slice(0, 80), pass: await hashPassword(password), google: null, verified: false, sv: 0, at: Date.now() })
      })
      if (emailOn) {
        await mailer.send({ to: email, subject: 'Confirme seu e-mail no Nosso Lar', text: `Olá${a.name ? ', ' + a.name : ''}!\n\nPara ativar sua conta, abra este link (vale por 1 hora):\n${appUrl}/#verify/${await newToken(a, 'verify')}\n\nSe não foi você, ignore esta mensagem.` }).catch(() => {})
        return { pendingVerify: true }
      }
      return { token: await newSession(a, device), account: publicAccount(a) }
    },

    async login({ email, password }, { ip = '', device } = {}) {
      tooMany(ip)
      email = normEmail(email)
      password = String(password || '').slice(0, 200)
      const lockKey = 'fail:' + email
      if (limiter.count(lockKey, 15 * 60_000) >= 8) fail('rate_limited', 429)
      const a = validEmail(email) ? await get(acctName(accountId(email))) : null
      if (!a || !a.pass) {
        await gastarTempo(password)
        limiter.add(lockKey, 15 * 60_000)
        fail('invalid_credentials', 401)
      }
      if (!(await checkPassword(password, a.pass))) {
        limiter.add(lockKey, 15 * 60_000)
        fail('invalid_credentials', 401)
      }
      if (emailOn && !a.verified) fail('unverified', 403)
      limiter.clear(lockKey)
      return { token: await newSession(a, device), account: publicAccount(a) }
    },

    async google({ credential }, { ip = '', device } = {}) {
      tooMany(ip)
      if (!clientId || !getJwks) fail('google_off', 400)
      let g
      try {
        g = await verifyGoogleToken(credential, { clientId, getJwks })
      } catch (err) {
        fail(err.message === 'email_not_verified' ? 'email_not_verified' : 'invalid_google', 401)
      }
      const id = accountId(g.email)
      const a = await lock(acctName(id), async () => {
        const cur = await get(acctName(id))
        if (!cur) return put(acctName(id), { id, email: g.email, name: g.name, pass: null, google: g.sub, verified: true, sv: 0, at: Date.now() })
        if (cur.google && cur.google !== g.sub) fail('conflict', 409)
        // Quem abriu a conta com senha mas nunca confirmou o e-mail pode não ser o dono dele: a senha é descartada.
        const limpar = cur.pass && !cur.verified
        return put(acctName(id), { ...cur, google: g.sub, verified: true, name: cur.name || g.name, pass: limpar ? null : cur.pass, sv: limpar ? (cur.sv || 0) + 1 : cur.sv || 0 })
      })
      return { token: await newSession(a, device), account: publicAccount(a) }
    },

    async verify({ token }) {
      const a = await useToken(token, 'verify')
      await lock(acctName(a.id), async () => put(acctName(a.id), { ...(await get(acctName(a.id))), verified: true }))
      return { ok: true }
    },

    async forgot({ email }, { ip = '' } = {}) {
      tooMany(ip, 'forgot', 20)
      if (!emailOn) fail('email_off', 400)
      email = normEmail(email)
      const a = validEmail(email) ? await get(acctName(accountId(email))) : null
      if (a) await mailer.send({ to: email, subject: 'Nova senha do Nosso Lar', text: `Para escolher uma nova senha, abra este link (vale por 1 hora):\n${appUrl}/#reset/${await newToken(a, 'reset')}\n\nSe não foi você que pediu, ignore esta mensagem: sua senha continua a mesma.` }).catch(() => {})
      return { ok: true } // a resposta é a mesma exista a conta ou não
    },

    async reset({ token, password }, { ip = '' } = {}) {
      tooMany(ip, 'reset', 20)
      password = String(password || '')
      if (password.length < 8 || password.length > 200) fail('weak_password')
      const a = await useToken(token, 'reset')
      await lock(acctName(a.id), async () => {
        const cur = await get(acctName(a.id))
        await put(acctName(a.id), { ...cur, pass: await hashPassword(password), verified: true, sv: (cur.sv || 0) + 1 }) // desconecta os outros aparelhos
      })
      return { ok: true }
    },

    async changePassword(a, { current, next }) {
      next = String(next || '')
      if (next.length < 8 || next.length > 200) fail('weak_password')
      if (a.pass && !(await checkPassword(String(current || ''), a.pass))) fail('invalid_credentials', 401)
      if (!a.pass && !emailOn) fail('email_off', 400)
      await lock(acctName(a.id), async () => {
        const cur = await get(acctName(a.id))
        await put(acctName(a.id), { ...cur, pass: await hashPassword(next), sv: (cur.sv || 0) + 1 })
      })
      const fresh = await get(acctName(a.id))
      return { token: await newSession(fresh), account: publicAccount(fresh) }
    },

    session: sessionAccount,
    publicAccount,

    async logout(token) {
      const name = 'sess-' + sha(String(token)).slice(0, 40)
      const s = await get(name)
      if (s) await put(name, { ...s, exp: 0 })
      return { ok: true }
    },

    // ---------- famílias protegidas ----------
    famAuth: (key) => get('fam-' + key),

    /** Decide se este pedido pode usar a família. Devolve { ok, ... } ou { status, error, ... }. */
    async authorize({ token, key, famRev, create, me }) {
      const fa = await get('fam-' + key)
      const a = token ? await sessionAccount(token) : null
      if (!fa) {
        if (a && create && famRev === 0) {
          await api.claim(a, key, me, { force: true })
          return { ok: true, account: a.id, role: 'owner', member: me || null }
        }
        if (requireAccount && famRev === 0) return a ? { ok: true, readOnly: true } : { status: 401, error: 'auth_required', reason: 'account_required' }
        return { ok: true }
      }
      if (!a) return { status: 401, error: 'auth_required', reason: token ? 'session' : 'protected' }
      const e = fa.accounts[a.id]
      if (e && !a.fams?.includes(key)) indexFam(a.id, key).catch(() => {}) // contas antigas passam a ser indexadas no primeiro acesso
      if (!e) return fa.banned?.[a.id] ? { status: 403, error: 'not_member', canJoin: false, removed: true } : { status: 403, error: 'not_member', canJoin: !!fa.joinOpen }
      return { ok: true, account: a.id, role: e.role, member: e.member || null }
    },

    // Passa a família a exigir conta. Só quem já tem acesso (pelo código) pode fazer isso.
    claim: (a, key, member) =>
      lock('fam-' + key, async () => {
        const cur = await get('fam-' + key)
        if (cur) {
          if (cur.accounts[a.id]) return cur
          fail('already_protected', 409)
        }
        await indexFam(a.id, key)
        return put('fam-' + key, { owner: a.id, joinOpen: true, at: Date.now(), accounts: { [a.id]: { role: 'owner', member: member || null, email: a.email, name: a.name || '', at: Date.now() } } })
      }),

    // Entra numa família protegida (quem tem o código é considerado convidado, enquanto os convites estiverem abertos).
    join(a, key, { ip = '' } = {}) {
      if (!limiter.hit(`join:${a.id}`, 10, 3600_000)) fail('rate_limited', 429)
      return lock('fam-' + key, async () => {
        const cur = await get('fam-' + key)
        if (!cur) fail('not_protected', 404)
        if (cur.accounts[a.id]) return cur
        if (cur.banned?.[a.id]) fail('removed', 403) // quem o dono removeu não volta sozinho pelo código
        if (!cur.joinOpen) fail('invites_closed', 403)
        await indexFam(a.id, key)
        return put('fam-' + key, { ...cur, accounts: { ...cur.accounts, [a.id]: { role: 'member', member: null, email: a.email, name: a.name || '', at: Date.now() } } })
      })
    },

    async info(a, key) {
      const fa = await get('fam-' + key)
      if (!fa) return { protected: false }
      const me = fa.accounts[a.id]
      if (!me) fail('not_member', 403)
      return { protected: true, role: me.role, joinOpen: !!fa.joinOpen, member: me.member || null, accounts: me.role === 'owner' ? Object.entries(fa.accounts).map(([id, x]) => ({ id, email: x.email, name: x.name, role: x.role, member: x.member })) : undefined, removed: me.role === 'owner' ? Object.entries(fa.banned || {}).map(([id, x]) => ({ id, email: x.email })) : undefined }
    },

    setMember: (a, key, member) =>
      lock('fam-' + key, async () => {
        const cur = await get('fam-' + key)
        if (!cur?.accounts[a.id]) fail('not_member', 403)
        if (member && Object.entries(cur.accounts).some(([id, x]) => id !== a.id && x.member === member)) fail('member_taken', 409)
        return put('fam-' + key, { ...cur, accounts: { ...cur.accounts, [a.id]: { ...cur.accounts[a.id], member: member || null } } })
      }),

    manage: (a, key, { action, account, open }) =>
      lock('fam-' + key, async () => {
        const cur = await get('fam-' + key)
        if (!cur?.accounts[a.id]) fail('not_member', 403)
        if (cur.accounts[a.id].role !== 'owner') fail('not_owner', 403)
        if (action === 'setOpen') return put('fam-' + key, { ...cur, joinOpen: !!open })
        if (action === 'remove') {
          if (!cur.accounts[account] || account === a.id) fail('invalid', 400)
          const { [account]: gone, ...rest } = cur.accounts
          return put('fam-' + key, { ...cur, accounts: rest, banned: { ...(cur.banned || {}), [account]: { email: gone.email, at: Date.now() } } })
        }
        if (action === 'transfer') {
          const alvo = cur.accounts[account]
          if (!alvo || account === a.id) fail('invalid', 400)
          return put('fam-' + key, { ...cur, owner: account, accounts: { ...cur.accounts, [a.id]: { ...cur.accounts[a.id], role: 'member' }, [account]: { ...alvo, role: 'owner' } } })
        }
        if (action === 'allow') {
          const { [account]: _x, ...rest } = cur.banned || {}
          return put('fam-' + key, { ...cur, banned: rest })
        }
        fail('invalid', 400)
      }),

    // ---------- exportar e excluir ----------
    /** Famílias protegidas de que a conta participa (já conferindo que ainda existem e que ela ainda é membro). */
    async myFamilies(a, extraKeys = []) {
      const out = []
      for (const key of new Set([...(a.fams || []), ...extraKeys])) {
        const fa = await get('fam-' + key)
        const me = fa?.accounts?.[a.id]
        if (me) out.push({ key, role: me.role, member: me.member || null, others: Object.keys(fa.accounts).length - 1 })
      }
      return out
    },

    // Confere quem está pedindo a exclusão: o e-mail digitado e, para quem tem senha, a senha.
    async confirmDelete(a, { password, confirm }) {
      if (!limiter.hit(`del:${a.id}`, 6, 3600_000)) fail('rate_limited', 429)
      if (normEmail(confirm) !== a.email) fail('confirm_mismatch', 400)
      if (a.pass && !(await checkPassword(String(password || ''), a.pass))) fail('invalid_credentials', 401)
    },

    // Tira a conta da família (e libera o membro) sem apagar o que ela cadastrou.
    leaveFamily: (a, key) =>
      lock('fam-' + key, async () => {
        const cur = await get('fam-' + key)
        if (!cur?.accounts[a.id]) return
        const { [a.id]: _x, ...rest } = cur.accounts
        await put('fam-' + key, { ...cur, accounts: rest })
      }),
    dropFamilyAuth: (key) => lock('fam-' + key, () => put('fam-' + key, null)),
    eraseAccount: (a) => lock(acctName(a.id), () => put(acctName(a.id), null)), // as sessões deixam de valer junto

    // ---------- apoio à cobrança ----------
    accountById: (id) => get(acctName(id)),
    /** Início do teste grátis da conta: definido uma vez só, na primeira vez em que a conta precisa dele. */
    trial: (id, ms) =>
      lock(acctName(id), async () => {
        const cur = await get(acctName(id))
        if (!cur) return null
        if (cur.trialEnd) return cur.trialEnd
        const fim = Date.now() + ms
        await put(acctName(id), { ...cur, trialEnd: fim })
        return fim
      }),

    sweep: () => limiter.sweep(),
  }
  return api
}
