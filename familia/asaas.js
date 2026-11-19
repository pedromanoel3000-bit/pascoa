// Conversa com a API do Asaas (cobrança). Tudo o que é específico do Asaas fica neste arquivo.
// Chave de teste (sandbox) contém "_hmlg_"; a de produção, "_prod_". O endereço pode ser trocado com ASAAS_URL.

export class AsaasError extends Error {
  constructor(status, message, corpo) {
    super(message)
    this.status = status
    this.corpo = corpo
  }
}

export const urlPadrao = (apiKey) => (String(apiKey).includes('_hmlg_') ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3')

export function createAsaas({ apiKey, baseUrl, fetchImpl = fetch }) {
  const base = (baseUrl || urlPadrao(apiKey)).replace(/\/+$/, '')
  async function chamar(metodo, caminho, corpo) {
    let r
    try {
      r = await fetchImpl(base + caminho, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', access_token: apiKey, 'User-Agent': 'NossoLar/1.0' },
        body: corpo ? JSON.stringify(corpo) : undefined,
        signal: AbortSignal.timeout(20000),
      })
    } catch (err) {
      throw new AsaasError(0, 'Não consegui falar com o Asaas agora. Tente de novo em instantes.')
    }
    const texto = await r.text()
    let dados = null
    try {
      dados = texto ? JSON.parse(texto) : null
    } catch {}
    if (!r.ok) {
      const detalhe = dados?.errors?.[0]?.description || texto.slice(0, 200)
      throw new AsaasError(r.status, `O Asaas recusou o pedido (${r.status}): ${detalhe}`, dados)
    }
    return dados
  }
  return {
    criarCliente: ({ name, email, cpfCnpj, externalReference }) => chamar('POST', '/customers', { name, email, cpfCnpj, externalReference }),
    // billingType UNDEFINED: quem paga escolhe Pix, boleto ou cartão na página da cobrança.
    criarAssinatura: ({ customer, value, nextDueDate, cycle, description, externalReference }) =>
      chamar('POST', '/subscriptions', { customer, billingType: 'UNDEFINED', value, nextDueDate, cycle, description, externalReference }),
    assinatura: (id) => chamar('GET', `/subscriptions/${encodeURIComponent(id)}`),
    pagamentosDaAssinatura: async (id) => (await chamar('GET', `/subscriptions/${encodeURIComponent(id)}/payments?limit=50`))?.data || [],
    cancelarAssinatura: (id) => chamar('DELETE', `/subscriptions/${encodeURIComponent(id)}`),
  }
}
