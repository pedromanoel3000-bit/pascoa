// Refeições: funções puras (ingredientes, porções, cronômetros, importação e sugestão da semana).
// Usadas pela tela e, na importação por link, também pelo servidor.

export const REFEICOES = ['Café', 'Almoço', 'Lanche', 'Jantar']
export const CATEGORIAS = ['Prato principal', 'Acompanhamento', 'Massa', 'Sopa', 'Salada', 'Café da manhã', 'Lanche', 'Sobremesa', 'Bebida', 'Outros']

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Entidades HTML mais comuns em receitas em português (sites de receitas costumam mandar "&eacute;", "&ordm;"…).
const ENTIDADES = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ordm: 'º', ordf: 'ª', deg: '°', frac12: '½', frac14: '¼', frac34: '¾',
  aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', auml: 'ä', eacute: 'é', egrave: 'è', ecirc: 'ê', iacute: 'í', icirc: 'î',
  oacute: 'ó', ocirc: 'ô', otilde: 'õ', uacute: 'ú', ucirc: 'û', uuml: 'ü', ccedil: 'ç', ntilde: 'ñ',
  Aacute: 'Á', Agrave: 'À', Acirc: 'Â', Atilde: 'Ã', Eacute: 'É', Ecirc: 'Ê', Iacute: 'Í', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Uacute: 'Ú', Ccedil: 'Ç',
  ndash: '–', mdash: '—', hellip: '…', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', bull: '•', times: '×', middot: '·',
}

/** Limpa o texto de um passo/ingrediente: entidades HTML, marcas de negrito/itálico (**x**, __x__) e caracteres invisíveis. */
export const limparTexto = (s) =>
  String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => (+('0x' + n) < 0x110000 ? String.fromCodePoint(parseInt(n, 16)) : m))
    .replace(/&#(\d+);/g, (m, n) => (+n < 0x110000 ? String.fromCodePoint(+n) : m))
    .replace(/&([a-z0-9]+);/gi, (m, n) => ENTIDADES[n] ?? m)
    .replace(/[​-‍⁠﻿­]/g, '') // espaço de largura zero, hífen invisível
    .replace(/[  ]/g, ' ')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^\s*_][^*_\n]*?)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/[ \t]{2,}/g, ' ')

// Passos colados numa linha só ("1. Misture 2. Asse") viram um por linha.
const separarNumerados = (l) => (/^\s*1[.)]\s+.+\s2[.)]\s+/.test(l) ? l.split(/\s+(?=\d{1,2}[.)]\s+\S)/) : [l])

export const linhas = (s) =>
  String(s || '')
    .split(/\n/)
    .flatMap(separarNumerados)
    .map((x) => limparTexto(x).replace(/^\s*(?:[-•*–]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)

// Ingredientes aceitam um por linha; se vier tudo numa linha só, separa por vírgula.
export const splitIng = (s) => {
  const l = linhas(s)
  return l.length === 1 && l[0].includes(',') && !/\d,\d/.test(l[0]) ? l[0].split(',').map((x) => x.trim()).filter(Boolean) : l
}

const FRACOES = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }
const UNIDADES = 'kg|g|gramas?|quilos?|mg|l|ml|litros?|xicaras?|xic|colher(?:es)?(?: de (?:sopa|cha|sobremesa|cafe))?|cs|cc|copos?|latas?|caixas?|caixinhas?|pacotes?|dentes?|fatias?|unidades?|un|pitadas?|ramos?|macos?|folhas?|tabletes?|sache|saches|envelopes?|potes?|garrafas?|duzias?|punhados?|cubos?|pedacos?|bandejas?|file|files'
const RE_ING = new RegExp(`^\\s*((?:\\d+(?:[.,]\\d+)?(?:\\s*/\\s*\\d+)?(?:\\s+\\d+\\s*/\\s*\\d+)?\\s*[½¼¾⅓⅔]?|[½¼¾⅓⅔])(?:\\s*(?:a|-|ou)\\s*\\d+(?:[.,]\\d+)?)?)\\s*((?:${UNIDADES})\\b\\.?)?\\s*(?:\\(.*?\\)\\s*)?(?:de\\s+|do\\s+|da\\s+)?(.*)$`, 'i')

const numero = (t) => {
  let s = t.trim()
  let extra = 0
  const f = s.match(/[½¼¾⅓⅔]/)
  if (f) {
    extra = FRACOES[f[0]]
    s = s.replace(f[0], '').trim()
  }
  s = s.replace(/\s*(?:a|-|ou)\s*\d+(?:[.,]\d+)?$/, '') // "2 a 3" → 2
  const misto = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (misto) return +misto[1] + +misto[2] / +misto[3]
  const fr = s.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (fr) return +fr[1] / +fr[2]
  return (s ? parseFloat(s.replace(',', '.')) : 0) + extra
}

// "2 xícaras de arroz" → { qtd: 2, unidade: 'xícaras', nome: 'arroz' }. Sem número: só o nome.
export function lerIngrediente(texto) {
  const t = String(texto || '').trim()
  const m = fold(t).match(RE_ING)
  if (!m || !m[3]) return { qtd: null, unidade: '', nome: t, texto: t }
  // Recorta do texto original (com acentos) pelos mesmos tamanhos; fold() preserva o comprimento.
  const ini = fold(t).indexOf(m[3], m[0].length - m[3].length)
  const nome = t.slice(ini).trim()
  const unidade = m[2] ? t.slice(fold(t).indexOf(m[2], m[1].length), fold(t).indexOf(m[2], m[1].length) + m[2].length).replace(/\.$/, '') : ''
  const qtd = numero(m[1])
  return Number.isFinite(qtd) && qtd > 0 && nome ? { qtd, unidade, nome, texto: t } : { qtd: null, unidade: '', nome: t, texto: t }
}

export function formatarQtd(n) {
  if (n == null) return ''
  const inteiro = Math.floor(n + 1e-9)
  const resto = n - inteiro
  const fr = [[0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']].find(([v]) => Math.abs(resto - v) < 0.04)
  if (Math.abs(resto) < 0.04) return String(inteiro)
  if (fr && inteiro < 20) return (inteiro ? inteiro + ' ' : '') + fr[1]
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10).replace('.', ',')
}

// Ajusta a quantidade do ingrediente para outro número de porções.
export function escalar(texto, fator) {
  const i = lerIngrediente(texto)
  if (i.qtd == null || !fator || Math.abs(fator - 1) < 0.001) return i.texto
  return `${formatarQtd(i.qtd * fator)}${i.unidade ? ' ' + i.unidade + ' de ' : ' '}${i.nome}`
}

// "xícara" → "xícaras" quando a soma passa de 1 (abreviações ficam como estão).
const pluralUn = (u, qtd) => {
  if (qtd <= 1 || u.length <= 3 || /s$/i.test(u.split(' ')[0])) return u
  const [primeira, ...resto] = u.split(' ')
  return [primeira + (/r$/i.test(primeira) ? 'es' : 's'), ...resto].join(' ')
}

// Junta os ingredientes de várias refeições: mesmo nome e mesma unidade somam.
export function juntarIngredientes(listas) {
  const mapa = new Map()
  for (const { ingredientes, fator = 1, de } of listas) {
    for (const t of ingredientes) {
      const i = lerIngrediente(t)
      const chave = fold(i.nome).replace(/\s+/g, ' ').replace(/s$/, '')
      const item = mapa.get(chave) || { nome: i.nome, partes: [], de: new Set() }
      const parte = item.partes.find((p) => fold(p.unidade).replace(/s$/, '') === fold(i.unidade).replace(/s$/, '') && (p.qtd == null) === (i.qtd == null))
      if (parte && i.qtd != null) parte.qtd += i.qtd * fator
      else if (!parte) item.partes.push({ qtd: i.qtd == null ? null : i.qtd * fator, unidade: i.unidade })
      if (de) item.de.add(de)
      mapa.set(chave, item)
    }
  }
  return [...mapa.values()].map((x) => {
    const qtd = x.partes.filter((p) => p.qtd != null).map((p) => `${formatarQtd(p.qtd)}${p.unidade ? ' ' + pluralUn(p.unidade, p.qtd) : ''}`).join(' + ')
    return { nome: x.nome, qtd, titulo: qtd ? `${x.nome} (${qtd})` : x.nome, de: [...x.de] }
  })
}

// Tempo citado num passo ("cozinhe por 15 minutos", "1 hora e 30") → segundos, ou null.
export function tempoDoPasso(texto) {
  const t = fold(texto)
  const h = t.match(/(\d+(?:[.,]\d+)?)\s*(?:h\b|hora)/)
  const m = t.match(/(\d+)\s*(?:a\s*\d+\s*)?(?:min\b|minuto)/) || (h && t.slice(h.index + h[0].length).match(/^s?\s*e\s*(\d+)\b/))
  const s = t.match(/(\d+)\s*(?:seg\b|segundo)/)
  const total = (h ? parseFloat(h[1].replace(',', '.')) * 3600 : 0) + (m ? +m[1] * 60 : 0) + (!h && !m && s ? +s[1] : 0)
  return total > 0 ? Math.round(total) : null
}

export const relogio = (seg) => {
  const s = Math.max(0, Math.round(seg))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')
  return `${h ? h + ':' : ''}${mm}:${String(s % 60).padStart(2, '0')}`
}
export const duracao = (min) => (!min ? '' : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ' ' + (min % 60) : ''}`)

// Quantas vezes cada receita já entrou no cardápio e quando foi a última.
export function usoDasReceitas(refeicoes, hoje) {
  const uso = {}
  for (const m of refeicoes) {
    if (!m.recipeId || m.date > hoje) continue
    const u = (uso[m.recipeId] = uso[m.recipeId] || { vezes: 0, ultima: '' })
    u.vezes++
    if (m.date > u.ultima) u.ultima = m.date
  }
  return uso
}

const paraRefeicao = (r, slot) => {
  const c = r.categoria || 'Prato principal'
  if (slot === 'Café') return c === 'Café da manhã'
  if (slot === 'Lanche') return c === 'Lanche' || c === 'Café da manhã'
  return !['Café da manhã', 'Lanche', 'Sobremesa', 'Bebida', 'Acompanhamento'].includes(c)
}

/**
 * Preenche as casas vazias da semana com receitas da família.
 * Evita repetir, prefere favoritas e as que não aparecem há mais tempo, e põe receita rápida em dia cheio.
 * @returns [{ date, slot, receita }]
 */
export function sugerirSemana({ dias, receitas, refeicoes, slots = ['Almoço', 'Jantar'], diasCheios = [], hoje }) {
  const uso = usoDasReceitas(refeicoes, hoje)
  const usadas = new Set(refeicoes.filter((m) => dias.includes(m.date) && m.recipeId).map((m) => m.recipeId))
  const diasSem = (r) => (uso[r.id]?.ultima ? Math.max(0, Math.round((new Date(hoje) - new Date(uso[r.id].ultima)) / 86400000)) : 60)
  const plano = []
  for (const date of dias) {
    for (const slot of slots) {
      if (refeicoes.some((m) => m.date === date && m.slot === slot)) continue
      const cheio = diasCheios.includes(date)
      const nota = (r) => Math.min(diasSem(r), 60) + (r.favorita ? 15 : 0) + (cheio && (r.rapida || (r.tempo && r.tempo <= 30)) ? 40 : 0) - (cheio && r.tempo > 60 ? 70 : 0)
      const candidatas = receitas.filter((r) => paraRefeicao(r, slot) && !usadas.has(r.id)).sort((a, b) => nota(b) - nota(a) || a.title.localeCompare(b.title))
      if (!candidatas.length) continue
      usadas.add(candidatas[0].id)
      plano.push({ date, slot, receita: candidatas[0] })
    }
  }
  return plano
}

// ---------- importação ----------
const semTags = (s) =>
  limparTexto(
    String(s ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|div)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  ).trim()

// Duração ISO 8601 ("PT1H30M") → minutos.
const minutosIso = (d) => {
  const m = String(d || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/)
  return m && (m[1] || m[2] || m[3]) ? (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0) : null
}

const passosDe = (inst) => {
  if (!inst) return []
  if (typeof inst === 'string') return linhas(semTags(inst))
  if (Array.isArray(inst)) return inst.flatMap(passosDe)
  if (inst.itemListElement) return passosDe(inst.itemListElement)
  return linhas(semTags(inst.text || inst.name || ''))
}

// Procura uma receita nos dados estruturados (schema.org/Recipe) de uma página.
export function receitaDeHtml(html) {
  const blocos = [...String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
  const achar = (no) => {
    if (!no || typeof no !== 'object') return null
    if (Array.isArray(no)) return no.map(achar).find(Boolean) || null
    const tipo = [].concat(no['@type'] || [])
    if (tipo.includes('Recipe')) return no
    return achar(no['@graph']) || achar(no.mainEntity) || null
  }
  for (const b of blocos) {
    let dados
    try {
      dados = JSON.parse(b.trim())
    } catch {
      continue
    }
    const r = achar(dados)
    if (!r) continue
    const ingredientes = [].concat(r.recipeIngredient || r.ingredients || []).map(semTags).filter(Boolean)
    const passos = passosDe(r.recipeInstructions)
    if (!r.name || (!ingredientes.length && !passos.length)) continue
    const rende = [].concat(r.recipeYield || [])[0]
    const tempo = minutosIso(r.totalTime) || (minutosIso(r.prepTime) || 0) + (minutosIso(r.cookTime) || 0) || null
    return {
      title: semTags(r.name).slice(0, 120),
      ingredients: ingredientes.slice(0, 80).join('\n'),
      steps: passos.slice(0, 60).join('\n'),
      porcoes: parseInt(String(rende ?? '').match(/\d+/)?.[0]) || null,
      tempo: tempo && tempo < 2880 ? tempo : null,
    }
  }
  return null
}

// Receita colada como texto: separa título, ingredientes e modo de preparo pelos subtítulos comuns.
export function receitaDeTexto(texto) {
  const ls = String(texto || '').split(/\n/).map((l) => l.trim())
  const eIng = (l) => /^ingredientes?\b/i.test(fold(l).replace(/[:*#-]/g, '').trim())
  const ePrep = (l) => /^(modo de (preparo|fazer)|preparo|como fazer|preparacao|instrucoes)\b/i.test(fold(l).replace(/[:*#-]/g, '').trim())
  const iIng = ls.findIndex(eIng)
  const iPrep = ls.findIndex(ePrep)
  const titulo = ls.find((l, i) => l && i !== iIng && i !== iPrep && (iIng < 0 || i < iIng)) || ''
  if (iIng < 0 && iPrep < 0) return { title: ls.find(Boolean) || '', ingredients: '', steps: ls.filter(Boolean).slice(1).join('\n') }
  const fimIng = iPrep > iIng ? iPrep : ls.length
  const ing = iIng >= 0 ? ls.slice(iIng + 1, fimIng) : iPrep > 0 ? ls.slice(ls.indexOf(titulo) + 1, iPrep) : []
  const prep = iPrep >= 0 ? ls.slice(iPrep + 1, iIng > iPrep ? iIng : ls.length) : []
  const rende = fold(texto).match(/(?:rende|rendimento|porcoes|serve)\D{0,12}(\d+)/)
  return { title: titulo.replace(/^[#*\s]+|[*\s]+$/g, ''), ingredients: linhas(ing.join('\n')).join('\n'), steps: linhas(prep.join('\n')).join('\n'), porcoes: rende ? +rende[1] : null }
}
