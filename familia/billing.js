// Assinatura do Nosso Lar: teste grátis, planos, estados de acesso e a ligação com os pagamentos do Asaas.
// Não depende do servidor HTTP: recebe as funções de leitura/gravação, a conta e o cliente do Asaas.
import { AuthError } from './auth.js'

export const PLANOS = {
  mensal: { id: 'mensal', nome: 'Mensal', valor: 9.9, ciclo: 'MONTHLY', meses: 1, descricao: 'Nosso Lar - assinatura mensal' },
  anual: { id: 'anual', nome: 'Anual', valor: 99, ciclo: 'YEARLY', meses: 12, descricao: 'Nosso Lar - assinatura anual' },
}
const DIA = 86400_000
export const TESTE_MS = 30 * DIA
export const LEITURA_MS = 3 * DIA

// ---------- datas ----------
/** Soma meses ao instante (em UTC), sem passar do fim do mês: 31/01 + 1 mês = 28/02 (ou 29). */
export function somarMeses(ts, meses) {
  const d = new Date(ts)
  const dia = d.getUTCDate()
  const alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()))
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(dia, ultimo))
  return alvo.getTime()
}
// O Asaas trabalha com datas do horário de Brasília (UTC-3, sem horário de verão).
export const dataBrasilia = (ts) => new Date(ts - 3 * 3600_000).toISOString().slice(0, 10)
const instanteDaData = (ymd) => (ymd ? Date.parse(ymd + 'T12:00:00-03:00') : NaN)

// ---------- estados ----------
/** teste | ativa | leitura | bloqueada | cortesia, conforme o que já foi pago ou concedido. */
export function estado(b, agora = Date.now()) {
  if (b.cortesia) return { estado: 'cortesia' }
  const fim = Math.max(b.trialEnd || 0, b.paidUntil || 0)
  if (agora < fim) return { estado: (b.paidUntil || 0) > agora ? 'ativa' : 'teste', fim }
  const bloqueioEm = fim + LEITURA_MS
  return { estado: agora < bloqueioEm ? 'leitura' : 'bloqueada', fim, bloqueioEm }
}

export function resumo(b, agora = Date.now()) {
  const e = estado(b, agora)
  return {
    estado: e.estado,
    fim: e.fim || null,
    dias: e.fim && agora < e.fim ? Math.ceil((e.fim - agora) / DIA) : 0,
    bloqueioEm: e.bloqueioEm || null,
    plano: b.plano || null,
    assinatura: b.subStatus || null, // 'ativa' | 'cancelada' | null
    precos: Object.fromEntries(Object.values(PLANOS).map((p) => [p.id, p.valor])),
  }
}

// ---------- CPF / CNPJ ----------
export function cpfCnpjValido(texto) {
  const d = String(texto || '').replace(/\D/g, '')
  if (/^(\d)\1+$/.test(d)) return false
  const digito = (base, pesos) => {
    const soma = [...base].reduce((t, n, i) => t + Number(n) * pesos[i], 0) % 11
    return soma < 2 ? 0 : 11 - soma
  }
  if (d.length === 11) {
    const p = [10, 9, 8, 7, 6, 5, 4, 3, 2]
    const a = digito(d.slice(0, 9), p)
    return a === Number(d[9]) && digito(d.slice(0, 9) + a, [11, ...p]) === Number(d[10])
  }
  if (d.length === 14) {
    const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const a = digito(d.slice(0, 12), p1)
    return a === Number(d[12]) && digito(d.slice(0, 12) + a, [6, ...p1]) === Number(d[13])
  }
  return false
}

const falha = (code, status = 400, extra) => {
  throw new AuthError(code, status, extra)
}

/**
 * @param read/write  leitura e gravação de registros de configuração (nome -> valor)
 * @param auth        serviço de contas (famAuth, accountById, trial)
 * @param asaas       cliente do Asaas (ou null: sem cobrança)
 * @param gratis      e-mails de contas que nunca são cobradas
 */
export function createBilling({ read, write, auth, asaas, gratis = [], now = Date.now }) {
  const cache = new Map()
  const locks = new Map()
  const get = async (nome) => {
    const c = cache.get(nome)
    if (c && now() - c.at < 30_000) return c.v
    const v = await read(nome)
    cache.set(nome, { v, at: now() })
    return v
  }
  const put = async (nome, v) => {
    await write(nome, v)
    cache.set(nome, { v, at: now() })
    return v
  }
  const lock = (nome, fn) => {
    const prev = locks.get(nome) || Promise.resolve()
    const next = prev.then(fn, fn)
    locks.set(nome, next.catch(() => {}))
    return next
  }
  const livres = new Set(gratis.map((e) => String(e).trim().toLowerCase()).filter(Boolean))
  const enabled = !!asaas

  /** O registro de cobrança da família (criado, com o teste grátis, na primeira vez em que é consultado). */
  async function registro(key) {
    const fa = await auth.famAuth(key)
    if (!fa) return null
    const dono = await auth.accountById(fa.owner)
    if (!dono) return null
    let b = await get('bill-' + key)
    if (!b) {
      b = await lock('bill-' + key, async () => {
        const atual = await get('bill-' + key)
        if (atual) return atual
        // O teste é por conta: abrir outra família não ganha outros 30 dias.
        return put('bill-' + key, { trialEnd: await auth.trial(dono.id, TESTE_MS), at: now() })
      })
    }
    return { ...b, cortesia: livres.has(dono.email), dono }
  }

  async function avaliar(key) {
    const b = await registro(key)
    if (!b) return null
    return { b, est: estado(b, now()), resumo: resumo(b, now()) }
  }

  // ---------- pagamentos ----------
  const planoDe = (b, pay) => PLANOS[b.plano] || (Number(pay?.value) >= 50 ? PLANOS.anual : PLANOS.mensal)

  /** Conta um pagamento confirmado (uma vez só, mesmo que o aviso chegue repetido). */
  function aplicarPagamento(key, pay) {
    return lock('bill-' + key, async () => {
      const b = await get('bill-' + key)
      if (!b || !pay?.id || b.pagamentos?.[pay.id]) return false
      const venc = instanteDaData(pay.dueDate) || 0
      const pago = instanteDaData(pay.paymentDate || pay.confirmedDate || pay.clientPaymentDate) || now()
      // A cobertura começa no vencimento (pagou antes: não perde dias), ou na data do pagamento se foi depois de vencer.
      const inicio = Math.max(venc, b.paidUntil || 0, b.trialEnd || 0, Math.min(pago, now()))
      const ate = somarMeses(inicio, planoDe(b, pay).meses)
      const pagamentos = { ...(b.pagamentos || {}), [pay.id]: { de: b.paidUntil || 0, ate } }
      for (const id of Object.keys(pagamentos).slice(0, -60)) delete pagamentos[id] // guarda só os últimos
      await put('bill-' + key, { ...b, paidUntil: ate, pagamentos })
      return true
    })
  }

  function estornarPagamento(key, pay) {
    return lock('bill-' + key, async () => {
      const b = await get('bill-' + key)
      const p = b?.pagamentos?.[pay?.id]
      if (!p || p.estornado) return false
      await put('bill-' + key, { ...b, paidUntil: b.paidUntil === p.ate ? p.de : b.paidUntil, pagamentos: { ...b.pagamentos, [pay.id]: { ...p, estornado: true } } })
      return true
    })
  }

  const marcarSubscricao = (key, status) =>
    lock('bill-' + key, async () => {
      const b = await get('bill-' + key)
      if (b && b.subStatus !== status) await put('bill-' + key, { ...b, subStatus: status })
    })

  /** Confere no Asaas o que já foi pago (os avisos automáticos podem ter se perdido). */
  async function sincronizar(key) {
    const b = await get('bill-' + key)
    if (!asaas || !b?.subId) return
    const pagos = (await asaas.pagamentosDaAssinatura(b.subId)).filter((p) => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status))
    for (const p of pagos.sort((x, y) => String(x.dueDate).localeCompare(String(y.dueDate)))) await aplicarPagamento(key, p)
    const s = await asaas.assinatura(b.subId).catch(() => null)
    if (s && (s.deleted || ['INACTIVE', 'EXPIRED'].includes(s.status))) await marcarSubscricao(key, 'cancelada')
  }

  // ---------- ações do dono ----------
  async function checkout(key, { plano, cpfCnpj }) {
    if (!asaas) falha('billing_off', 503)
    const p = PLANOS[plano]
    if (!p) falha('invalid_plan')
    if (!cpfCnpjValido(cpfCnpj)) falha('invalid_cpf')
    const reg = await registro(key)
    if (!reg) falha('not_found', 404)
    if (reg.cortesia) falha('courtesy', 409)
    const cpf = String(cpfCnpj).replace(/\D/g, '')
    return lock('bill-' + key, async () => {
      let b = await get('bill-' + key)
      if (b.subId && b.subStatus === 'ativa') {
        if (b.plano === plano) return { url: await linkPendente(b.subId) }
        falha('already_subscribed', 409)
      }
      if (!b.customerId) {
        const c = await asaas.criarCliente({ name: reg.dono.name || reg.dono.email, email: reg.dono.email, cpfCnpj: cpf, externalReference: key })
        b = await put('bill-' + key, { ...b, customerId: c.id })
        await put('asaascus-' + c.id, key)
      }
      const e = estado(b, now())
      // Durante o teste, a primeira cobrança vence no último dia do teste; depois dele, vence hoje.
      const vence = e.estado === 'teste' || e.estado === 'ativa' ? Math.max(e.fim, now()) : now()
      const s = await asaas.criarAssinatura({ customer: b.customerId, value: p.valor, nextDueDate: dataBrasilia(vence), cycle: p.ciclo, description: p.descricao, externalReference: key })
      await put('bill-' + key, { ...b, subId: s.id, plano, subStatus: 'ativa' })
      await put('asaassub-' + s.id, key)
      return { url: await linkPendente(s.id) }
    })
  }

  // Link da primeira cobrança ainda em aberto (a página onde a pessoa escolhe Pix, boleto ou cartão).
  async function linkPendente(subId) {
    const pagamentos = await asaas.pagamentosDaAssinatura(subId)
    const aberto = pagamentos.filter((p) => ['PENDING', 'OVERDUE', 'AWAITING_RISK_ANALYSIS'].includes(p.status) && p.invoiceUrl).sort((x, y) => String(x.dueDate).localeCompare(String(y.dueDate)))[0] || pagamentos.find((p) => p.invoiceUrl)
    if (!aberto) falha('no_invoice', 502)
    return aberto.invoiceUrl
  }

  async function cancelar(key) {
    const b = await get('bill-' + key)
    if (!b?.subId || b.subStatus !== 'ativa') falha('no_subscription', 409)
    await asaas.cancelarAssinatura(b.subId)
    await marcarSubscricao(key, 'cancelada')
  }

  // ---------- avisos do Asaas ----------
  /** @returns 'ok' | 'ignorado' */
  async function webhook(corpo) {
    const evento = String(corpo?.event || '')
    const pay = corpo?.payment
    const sub = corpo?.subscription
    const subId = pay?.subscription || sub?.id
    const key = (subId && (await get('asaassub-' + subId))) || (pay?.customer && (await get('asaascus-' + pay.customer))) || null
    if (!key) return 'ignorado'
    if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(evento) && pay) {
      if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(pay.status)) await aplicarPagamento(key, pay)
      return 'ok'
    }
    if (['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_DELETED'].includes(evento) && pay) {
      await estornarPagamento(key, pay)
      return 'ok'
    }
    if (['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED'].includes(evento)) {
      await marcarSubscricao(key, 'cancelada')
      return 'ok'
    }
    return 'ignorado'
  }

  return { enabled, registro, avaliar, checkout, cancelar, sincronizar, webhook, aplicarPagamento, estornarPagamento }
}
