// Barra mágica: entende uma frase em português ("dentista amanhã às 15h", "comprar leite e pão",
// "gastei 35,90 no mercado") e devolve o que criar. Funções puras, sem React e sem internet.
import { addDays, pad, today, weekdayOf } from './utils.js'

const WD = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
const MES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const DIA = `(?:${WD.join('|')})(?:-feira)?s?`
const HORA = '(\\d{1,2})(?::(\\d{2})|h(\\d{2})?(?![a-z])|\\s*(?:hrs|hr|horas|hora)\\b)' // 15:30, 15h, 15h30, 15 horas
const PERIODO = '(?:\\s*(?:da|de)\\s+(manha|tarde|noite|madrugada))?'

// Palavras que terminam como verbo no infinitivo, mas são coisas (para não virar tarefa).
const NAO_VERBO = new Set(
  'jantar lugar celular familiar lazer computador aspirador liquidificador ventilador cobertor colher mulher flor amor doutor professor motor acucar colar hamburguer sueter popular escolar cantor ator valor calor favor trator elevador carregador secador refrigerador abajur bazar radar mar bar lar par dor cor'.split(' ')
)
const EVENTOS = /\b(reuniao|consulta|dentista|medico|medica|pediatra|aniversario|festa|jantar|almoco|churrasco|aula|prova|jogo|viagem|show|cinema|missa|culto|casamento|exame|entrevista|apresentacao|passeio|encontro|visita|vacina|formatura|batizado|natal|feriado|ferias|voo|treino|natacao|futebol|ingles|academia)\b/

const CATEGORIAS = [
  ['Salário', /salario|pagamento|decimo|freela/],
  ['Mercado', /mercado|supermercado|feira|padaria|acougue|hortifruti|atacad/],
  ['Contas', /\bluz\b|agua|internet|aluguel|condominio|\bgas\b|telefone|boleto|fatura|iptu|ipva|conta/],
  ['Transporte', /uber|99|gasolina|combustivel|onibus|metro|estacionamento|pedagio|taxi|passagem/],
  ['Saúde', /farmacia|remedio|medico|dentista|consulta|exame|plano de saude|academia/],
  ['Escola', /escola|mensalidade|material|curso|livro|uniforme|faculdade/],
  ['Lazer', /cinema|restaurante|pizza|lanche|ifood|bar\b|sorvete|passeio|viagem|show|jogo|streaming|netflix|hamburguer/],
  ['Roupas', /roupa|tenis|sapato|camisa|calca|vestido/],
  ['Casa', /casa|movel|reforma|conserto|limpeza|ferramenta|eletro/],
]

// Minúsculas e sem acento, mantendo o mesmo tamanho do texto (para poder recortar o original).
const fold = (s) => {
  let out = ''
  for (let i = 0; i < s.length; i++) out += (s[i].normalize('NFD')[0].toLowerCase()[0] || s[i])
  return out
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function numero(txt) {
  let t = txt
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const dataValida = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null
}

export function categoriaDe(titulo) {
  const f = fold(titulo)
  return CATEGORIAS.find(([, re]) => re.test(f))?.[0] || 'Outros'
}

export const separarItens = (txt) =>
  txt
    .split(/\s*[,;\n]\s*|\s+e\s+/)
    .map((t) => t.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean)

const capitalizar = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

// Devolve { tipo, titulo, data, hora, fim, repeat, rule, valor, entrada, itens, pessoas, responsavel, categoria }.
// tipo: 'evento' | 'tarefa' | 'compras' | 'gasto' | 'recado' | 'nota'
export function interpretar(texto, { hoje = today(), membros = [] } = {}) {
  const orig = String(texto || '').normalize('NFC')
  let n = fold(orig)
  const cortes = []
  // Procura no texto; o que achar é "apagado" para não ser lido duas vezes. `manter` deixa no título.
  const pega = (re, manter = false) => {
    const m = re.exec(n)
    if (!m) return null
    if (!manter) cortes.push([m.index, m.index + m[0].length])
    n = n.slice(0, m.index) + ' '.repeat(m[0].length) + n.slice(m.index + m[0].length)
    return m
  }
  const mais = (k) => addDays(hoje, k)
  let m

  // ---------- "tarefa: ...", "recado: ..." ----------
  let forcado = null
  if ((m = pega(/^\s*(tarefa|evento|compromisso|compras|compra|lista|gasto|despesa|recado|aviso|nota|anotacao)\s*:\s*/))) {
    forcado = { tarefa: 'tarefa', evento: 'evento', compromisso: 'evento', compras: 'compras', compra: 'compras', lista: 'compras', gasto: 'gasto', despesa: 'gasto', recado: 'recado', aviso: 'recado', nota: 'nota', anotacao: 'nota' }[m[1]]
  }
  const semPrefixo = orig.slice(cortes[0]?.[1] || 0).trim()

  // ---------- dinheiro ----------
  const NUM = '(\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)'
  let valor = null
  let entrada = false
  let verboGasto = false
  if ((m = pega(new RegExp(`\\b(gastei|paguei|comprei|custou|recebi|ganhei)\\s+(?:r\\$\\s*)?${NUM}(?:\\s*(?:reais|real)\\b)?`)))) {
    valor = numero(m[2])
    entrada = /recebi|ganhei/.test(m[1])
    verboGasto = true
  } else if ((m = pega(new RegExp(`r\\$\\s*${NUM}`))) || (m = pega(new RegExp(`\\b${NUM}\\s*(?:reais|real|conto|contos|pila|pilas)\\b`)))) {
    valor = numero(m[1])
    if ((m = pega(/\b(gastei|paguei|comprei|custou|recebi|ganhei)\b/))) {
      entrada = /recebi|ganhei/.test(m[1])
      verboGasto = true
    }
  }

  // ---------- repetição ----------
  let repeat = 'none'
  let rule = null
  let dias = null
  if (pega(/\b(?:dias uteis|de segunda a sexta|de seg a sex)\b/)) repeat = 'workdays'
  else if ((m = pega(/\ba cada (\d+) (dia|semana|mes|ano)(?:s|es)?\b/))) {
    repeat = 'custom'
    rule = { freq: { dia: 'day', semana: 'week', mes: 'month', ano: 'year' }[m[2]], interval: +m[1] }
  } else if ((m = pega(new RegExp(`\\btod[ao]s?\\s+(?:[ao]s\\s+)?(${DIA}(?:(?:\\s*,\\s*|\\s+e\\s+)${DIA})*)`)))) {
    dias = [...new Set(WD.map((w, i) => (new RegExp(`\\b${w}`).test(m[1]) ? i : -1)).filter((i) => i >= 0))]
    repeat = dias.length > 1 ? 'custom' : 'weekly'
    if (dias.length > 1) rule = { freq: 'week', interval: 1, weekdays: dias }
  } else if (pega(/\btodos?\s+(?:os\s+)?dias?\b|\bdiariamente\b/)) repeat = 'daily'
  else if (pega(/\btodas?\s+(?:as\s+)?semanas?\b|\bsemanalmente\b/)) repeat = 'weekly'
  else if (pega(/\btodos?\s+(?:os\s+)?mes(?:es)?\b|\bmensalmente\b/)) repeat = 'monthly'
  else if (pega(/\btodos?\s+(?:os\s+)?anos?\b|\banualmente\b/)) repeat = 'yearly'

  // ---------- hora ----------
  let hora = null
  let fim = null
  let horaVaga = false // "de manhã", "à noite": só uma noção
  const hhmm = (h, min, periodo) => {
    h = +h
    min = +(min || 0)
    if ((periodo === 'tarde' || periodo === 'noite') && h < 12) h += 12
    else if (!periodo && h >= 1 && h <= 6) h += 12 // "às 3" quase sempre é da tarde
    return h <= 23 && min <= 59 ? `${pad(h)}:${pad(min)}` : null
  }
  if ((m = pega(new RegExp(`\\b(?:das?|de)\\s+(\\d{1,2})(?::(\\d{2})|h(\\d{2})?)?\\s*(?:as|ate|a)\\s+${HORA}${PERIODO}`)))) {
    hora = hhmm(m[1], m[2] || m[3], m[7])
    fim = hhmm(m[4], m[5] || m[6], m[7])
  } else if (pega(/\bmeio[- ]dia\b/)) hora = '12:00'
  else if (pega(/\bmeia[- ]noite\b/)) hora = '00:00'
  else if ((m = pega(new RegExp(`\\b(?:as\\s+)?${HORA}${PERIODO}`)))) hora = hhmm(m[1], m[2] || m[3], m[4])
  else if ((m = pega(/\bas\s+(\d{1,2})\b(?:\s*(?:da|de)\s+(manha|tarde|noite))?(?=\s*(?:$|[,.]|da |de |hoje|amanha|depois|n[ao] |com |para |pra |tod|dia ))/))) hora = hhmm(m[1], 0, m[2])
  else if ((m = pega(/\b(\d{1,2})\s+(?:da|de)\s+(manha|tarde|noite)\b/))) hora = hhmm(m[1], 0, m[2])
  else if ((m = pega(/\b(?:de|pela|a|na)\s+(manha|tarde|noite)\b/))) {
    hora = { manha: '09:00', tarde: '15:00', noite: '20:00' }[m[1]]
    horaVaga = true
  }

  // ---------- data ----------
  let data = null
  const [ay, am, ad] = hoje.split('-').map(Number)
  const diaMes = (d, mes, ano) => {
    const y = ano ? (+ano < 100 ? 2000 + +ano : +ano) : ay
    let r = dataValida(y, mes, d)
    if (r && !ano && r < hoje && valor == null) r = dataValida(y + 1, mes, d) // sem ano e já passou: é do ano que vem
    return r
  }
  const proximoDiaDoMes = (d) => {
    let y = ay
    let mes = d >= ad ? am : am + 1
    if (mes > 12) {
      mes = 1
      y++
    }
    return dataValida(y, mes, Math.min(d, new Date(Date.UTC(y, mes, 0)).getUTCDate()))
  }
  const proximoDiaSemana = (alvos, depoisDeHoje = false) => {
    for (let k = depoisDeHoje ? 1 : 0; k < 8; k++) if (alvos.includes(weekdayOf(mais(k)))) return mais(k)
    return null
  }
  if (pega(/\bdepois de amanha\b/)) data = mais(2)
  else if (pega(/\bamanha\b/)) data = mais(1)
  else if (pega(/\bhoje\b/)) data = hoje
  else if (pega(/\bontem\b/)) data = mais(-1)
  else if ((m = pega(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) data = diaMes(+m[1], +m[2], m[3])
  else if ((m = pega(new RegExp(`\\b(?:dia\\s+)?(\\d{1,2})\\s+de\\s+(${MES.join('|')})(?:\\s+de\\s+(\\d{4}))?\\b`)))) data = diaMes(+m[1], MES.indexOf(m[2]) + 1, m[3])
  else if ((m = pega(/\bdia\s+(\d{1,2})\b/))) data = +m[1] >= 1 && +m[1] <= 31 ? proximoDiaDoMes(+m[1]) : null
  else if ((m = pega(/\bdaqui\s+(?:a\s+)?(\d+)\s+(dia|semana)s?\b/)) || (m = pega(/\bem\s+(\d+)\s+(dia|semana)s?\b/))) data = mais(+m[1] * (m[2] === 'semana' ? 7 : 1))
  else if (pega(/\bsemana que vem\b|\bproxima semana\b/)) data = mais(7)
  else if (pega(/\bmes que vem\b|\bproximo mes\b/)) {
    const y = am === 12 ? ay + 1 : ay
    const mes = am === 12 ? 1 : am + 1
    data = dataValida(y, mes, Math.min(ad, new Date(Date.UTC(y, mes, 0)).getUTCDate()))
  }
  else if (pega(/\b(?:n?o\s+)?fim de semana\b/)) data = proximoDiaSemana([6])
  else if ((m = pega(new RegExp(`\\b(?:(proxim[ao]|n[ao]|nest[ae]|ess[ae])\\s+)?(${WD.join('|')})(?:-feira)?(\\s+que vem)?\\b`)))) {
    data = proximoDiaSemana([WD.indexOf(m[2])], /^proxim/.test(m[1] || '') || !!m[3])
  }
  if (!data && dias) data = proximoDiaSemana(dias)
  if (!data && repeat !== 'none') data = repeat === 'workdays' ? proximoDiaSemana([1, 2, 3, 4, 5]) : hoje

  // ---------- pessoas ----------
  const pessoas = []
  let responsavel = null
  for (const mb of membros) {
    const nome = fold((mb.name || '').trim().split(/\s+/)[0] || '')
    if (nome.length < 2) continue
    if (pega(new RegExp(`(?:\\b(?:para|pra|pro)\\s+(?:[ao]\\s+)?|@)${esc(nome)}\\b`))) {
      responsavel = responsavel || mb.id
      pessoas.push(mb.id)
    } else if (pega(new RegExp(`\\b(?:com|d[oa])\\s+(?:[ao]\\s+)?${esc(nome)}\\b`), true)) pessoas.push(mb.id)
  }

  // ---------- título: o que sobrou ----------
  let titulo = ''
  let pos = 0
  for (const [a, b] of cortes.sort((x, y) => x[0] - y[0])) {
    if (a > pos) titulo += orig.slice(pos, a) + ' '
    pos = Math.max(pos, b)
  }
  titulo += orig.slice(pos)
  titulo = titulo.replace(/\s+/g, ' ').replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, '')
  const SOLTAS = '(?:de|do|da|no|na|em|as|às|a|o|e|para|pra|dia|com|por)'
  for (let i = 0; i < 3; i++) titulo = titulo.replace(new RegExp(`\\s+${SOLTAS}$`, 'i'), '').replace(/[\s,.;:–-]+$/, '')
  titulo = titulo.replace(/^(?:lembrar de|lembrar|lembrete de|lembrete|marcar|agendar|anotar)\s+/i, '')
  if (valor != null) titulo = titulo.replace(new RegExp(`^${SOLTAS}\\s+`, 'i'), '').replace(/^(?:a|o|as|os)\s+/i, '')

  // ---------- que tipo de coisa é ----------
  const f = fold(titulo)
  const primeiro = f.split(/\s+/)[0] || ''
  const verbo = /^[a-z]{3,}(?:ar|er|ir|or)$/.test(primeiro) && !NAO_VERBO.has(primeiro)
  const evento = EVENTOS.test(f)
  const quando = !!(data || hora || repeat !== 'none')
  const paraLista = f.match(/^(?:comprar|adicionar|colocar|botar)\s+(.+?)(?:\s+(?:na|a|pra|para a)\s+lista(?:\s+de\s+compras)?)?$/) || f.match(/^(.+?)\s+na\s+lista(?:\s+de\s+compras)?$/)
  const palavras = f.split(/\s+/).filter(Boolean).length

  let tipo = forcado
  if (!tipo) {
    if (valor != null && (verboGasto || !verbo)) tipo = 'gasto'
    else if (paraLista && !quando) tipo = 'compras'
    else if (hora && !horaVaga) tipo = 'evento'
    else if (quando) tipo = evento && !verbo ? 'evento' : verbo || !hora ? 'tarefa' : 'evento'
    else if (/^(?:avisar|aviso|recado|pessoal|gente|familia)\b/.test(f)) tipo = 'recado'
    else if (verbo) tipo = 'tarefa'
    else tipo = /[,;]/.test(titulo) || palavras <= 3 ? 'compras' : 'tarefa'
  }

  // Itens de compra: tira o "comprar" do começo e o "na lista" do fim.
  const semComprar = titulo.replace(/^(?:comprar|adicionar|colocar|botar)\s+/i, '').replace(/\s+(?:na|a|pra|para a)\s+lista(?:\s+de\s+compras)?$/i, '')
  const itens = separarItens(semComprar)

  if (tipo === 'recado' || tipo === 'nota') titulo = semPrefixo
  if (tipo === 'evento' && hora && !fim) {
    const [h, mi] = hora.split(':').map(Number)
    fim = h < 23 ? `${pad(h + 1)}:${pad(mi)}` : null
  }

  return {
    tipo,
    titulo: capitalizar(titulo),
    data,
    hora: tipo === 'tarefa' && horaVaga ? null : hora,
    fim,
    repeat,
    rule,
    valor,
    entrada,
    itens,
    pessoas: [...new Set(pessoas)],
    responsavel,
    categoria: valor != null ? categoriaDe(titulo) : null,
  }
}

// ---------- busca em tudo ----------
const contem = (texto, q) => fold(String(texto || '')).includes(q)

// `st.items` é o estado do app. Devolve [{ icone, titulo, sub, ir }] (ir = página para abrir).
export function buscar(st, consulta, paginas = {}) {
  const q = fold(consulta.trim())
  if (q.length < 2) return []
  const out = []
  const itens = Object.values(st.items || {}).filter((i) => !i.deleted)
  const listas = Object.fromEntries(itens.filter((i) => i.type === 'list').map((l) => [l.id, l.title]))
  const nomes = Object.fromEntries(itens.filter((i) => i.type === 'member').map((mb) => [mb.id, mb.name]))
  const br = (d) => (d ? d.split('-').reverse().slice(0, 2).join('/') : '')
  for (const [id, p] of Object.entries(paginas)) if (contem(p.label, q)) out.push({ icone: '➡️', titulo: `Abrir ${p.label}`, sub: 'Tela do app', ir: id, peso: 3 })
  for (const i of itens) {
    switch (i.type) {
      case 'event':
        if (contem(i.title, q) || contem(i.place, q)) out.push({ icone: '📅', titulo: i.title, sub: `Agenda · ${br(i.date)}${i.allDay || !i.start ? '' : ' às ' + i.start}`, ir: 'calendar', quando: i.updatedAt })
        break
      case 'task':
        if (contem(i.title, q)) out.push({ icone: i.done ? '✅' : '⬜', titulo: i.title, sub: `Tarefa${i.due ? ' · ' + br(i.due) : ''}${i.assignee ? ' · ' + (nomes[i.assignee] || '') : ''}`, ir: 'tasks', quando: i.updatedAt })
        break
      case 'listItem':
        if (!i.archived && contem(i.title, q)) out.push({ icone: '🛒', titulo: i.title, sub: `Lista ${listas[i.listId] || ''}${i.done ? ' · já pego' : ''}`, ir: 'lists', quando: i.updatedAt })
        break
      case 'note':
        if (contem(i.title, q) || contem(i.body, q)) out.push({ icone: '📝', titulo: i.title, sub: `Nota · ${String(i.body || '').slice(0, 50)}`, ir: 'notes', quando: i.updatedAt })
        break
      case 'contact':
        if (contem(i.name, q) || contem(i.phone, q) || contem(i.category, q)) out.push({ icone: '📇', titulo: i.name, sub: `Contato · ${i.phone || i.category || ''}`, ir: 'contacts', quando: i.updatedAt })
        break
      case 'recipe':
        if (contem(i.title, q) || contem(i.ingredients, q)) out.push({ icone: '📖', titulo: i.title, sub: 'Receita', ir: 'meals', quando: i.updatedAt })
        break
      case 'wish':
        if (contem(i.title, q)) out.push({ icone: '🎁', titulo: i.title, sub: `Desejo de ${nomes[i.owner] || ''}`, ir: 'wishes', quando: i.updatedAt })
        break
      case 'expense':
        if (contem(i.title, q)) out.push({ icone: '💰', titulo: i.title, sub: `Orçamento · ${br(i.date)} · R$ ${Number(i.amount || 0).toFixed(2).replace('.', ',')}`, ir: 'budget', quando: i.updatedAt })
        break
      case 'message':
        if ((i.conv === 'family' || String(i.conv).split('|').includes(st.me)) && contem(i.text, q)) out.push({ icone: '💬', titulo: i.text, sub: `Mensagem de ${nomes[i.createdBy] || ''}`, ir: 'chat', quando: i.createdAt })
        break
      case 'post':
        if (contem(i.text, q)) out.push({ icone: '📌', titulo: i.text, sub: `Mural · ${nomes[i.createdBy] || ''}`, ir: 'mural', quando: i.createdAt })
        break
    }
  }
  return out.sort((a, b) => (b.peso || 0) - (a.peso || 0) || (b.quando || 0) - (a.quando || 0)).slice(0, 8)
}
