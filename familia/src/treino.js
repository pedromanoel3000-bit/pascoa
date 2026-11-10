// Treino: programa A–D, semanas do bloco, metas da próxima vez (dupla progressão)
// e o registro em texto. Só funções puras (sem React), usadas pela tela e pelos testes.
import { addDays, pad, today } from './utils.js'

export const BLOCO = 8 // semanas
export const LETRAS = ['A', 'B', 'C', 'D']
export const BARRA_PADRAO = 10 // kg; cada pessoa ajusta no Plano
export const proximaLetra = (l) => LETRAS[(LETRAS.indexOf(l) + 1) % LETRAS.length]

// Como a carga é anotada em cada equipamento.
export const EQUIP = {
  barra: 'kg total, contando a barra',
  halter: 'kg de cada halter',
  maquina: 'kg na máquina',
  polia: 'kg na polia',
  anilhas: 'kg de anilhas, sem o carrinho',
  corpo: 'peso do corpo',
}

const ex = (id, nome, series, faixa, desc, equip, inc, dica, extra = {}) => {
  const [min, max] = faixa.split('-').map(Number)
  const e = { id, nome, series, min, max, desc, equip, inc, dica, corpo: equip === 'corpo', semFalha: false, porPerna: false, lado: 'perna', ...extra }
  if (extra.lado) e.porPerna = true
  return e
}

const DICA = {
  extensora: 'Ajuste o encosto para o joelho ficar alinhado ao eixo da máquina. Estenda até o fim, segure 1 s e desça devagar.',
  lateral: 'Cotovelos levemente dobrados. Suba os braços até a altura dos ombros, sem impulso, e desça devagar.',
}

export const TREINOS = {
  A: {
    letra: 'A',
    nome: 'Inferior',
    foco: 'foco quadríceps',
    cardio: false,
    exercicios: [
      ex('agachamento-livre', 'Agachamento livre', 3, '6-10', 150, 'barra', 4, 'Pés na largura dos ombros, joelhos na direção da ponta dos pés e peito alto. Desça controlando e suba empurrando o chão; pare antes de perder a postura.', { semFalha: true }),
      ex('mesa-flexora', 'Mesa flexora', 3, '10-15', 90, 'maquina', 5, 'Quadril colado no banco e joelhos logo depois da borda. Suba até o fim e desça em 2–3 s, sem tirar o quadril do banco.'),
      ex('cadeira-extensora', 'Cadeira extensora', 3, '10-15', 90, 'maquina', 5, DICA.extensora),
      ex('bulgaro-halteres', 'Búlgaro com halteres', 3, '8-12', 90, 'halter', 2, 'Peito do pé de trás apoiado no banco e passo largo. Desça reto até o joelho de trás quase tocar o chão e suba pelo calcanhar da frente. Termine uma perna e depois faça a outra.', { porPerna: true }),
      ex('panturrilha-em-pe', 'Panturrilha em pé', 3, '10-15', 60, 'maquina', 5, 'Desça até alongar bem, pausa de 1 s embaixo e suba até a ponta dos pés. Joelhos estendidos, sem quicar.'),
      ex('abdominal-polia', 'Abdominal na polia', 3, '10-15', 60, 'polia', 2.5, 'De joelhos, corda ao lado da cabeça. Enrole o tronco levando o peito em direção ao quadril; o quadril fica parado e os braços só seguram.'),
    ],
  },
  B: {
    letra: 'B',
    nome: 'Superior',
    foco: 'foco costas + cardio',
    cardio: true,
    exercicios: [
      ex('barra-fixa', 'Barra fixa (ou graviton)', 3, '6-10', 150, 'corpo', 0, 'Pegada um pouco mais aberta que os ombros. Puxe levando o peito à barra e os cotovelos para baixo; desça até esticar os braços. No graviton, menos peso de ajuda deixa mais difícil.'),
      ex('supino-inclinado-halteres', 'Supino inclinado com halteres', 3, '8-12', 120, 'halter', 2, 'Banco a 30°, escápulas juntas e pés firmes. Desça os halteres ao lado do peito com os cotovelos a uns 45° do tronco e empurre para cima.'),
      ex('remada-baixa', 'Remada baixa', 3, '8-12', 120, 'maquina', 5, 'Peito alto e coluna reta. Puxe até o abdômen levando os cotovelos para trás e juntando as escápulas; não balance o tronco.'),
      ex('elevacao-lateral', 'Elevação lateral', 3, '12-20', 60, 'halter', 2, DICA.lateral),
      ex('rosca-banco-inclinado', 'Rosca no banco inclinado', 3, '10-15', 60, 'halter', 2, 'Banco a 45–60°, braços pendurados atrás do tronco. Suba sem levar os cotovelos para a frente e desça até esticar.'),
      ex('triceps-polia-corda', 'Tríceps na polia com corda', 2, '10-15', 60, 'polia', 2.5, 'Cotovelos colados ao corpo e parados. Estenda os braços abrindo a corda no final e volte devagar.'),
    ],
  },
  C: {
    letra: 'C',
    nome: 'Inferior',
    foco: 'foco posterior',
    cardio: false,
    exercicios: [
      ex('stiff-barra', 'Stiff com barra', 3, '8-12', 150, 'barra', 4, 'Joelhos levemente dobrados. Leve o quadril para trás com a barra rente às pernas e a coluna reta; desça até sentir a parte de trás da coxa alongar e suba contraindo o glúteo.', { semFalha: true }),
      ex('leg-press-45', 'Leg press 45°', 3, '10-15', 120, 'anilhas', 10, 'Lombar e quadril colados no encosto, pés na largura dos ombros. Desça até uns 90° sem o quadril sair do banco e não trave os joelhos no topo.'),
      ex('cadeira-flexora', 'Cadeira flexora', 3, '10-15', 90, 'maquina', 5, 'Joelho alinhado ao eixo da máquina e coxas presas pela almofada. Flexione até o fim e volte em 2–3 s.'),
      ex('cadeira-extensora', 'Cadeira extensora', 2, '12-15', 60, 'maquina', 5, DICA.extensora),
      ex('panturrilha-sentado', 'Panturrilha sentado', 3, '12-20', 60, 'maquina', 5, 'Almofada sobre as coxas, perto dos joelhos. Desça alongando bem, pausa embaixo e suba o máximo que der.'),
      ex('elevacao-pernas', 'Elevação de pernas (infra)', 3, '10-15', 60, 'corpo', 0, 'Lombar colada no chão ou no encosto. Suba as pernas devagar e desça sem deixar a lombar arquear; dobre os joelhos se ficar difícil.'),
    ],
  },
  D: {
    letra: 'D',
    nome: 'Superior',
    foco: 'foco peito + cardio',
    cardio: true,
    exercicios: [
      ex('supino-reto-barra', 'Supino reto com barra', 3, '6-10', 150, 'barra', 2, 'Escápulas juntas, pés firmes e glúteo no banco. Desça a barra até a linha do mamilo com os cotovelos a uns 45° e empurre. Se puder, peça para alguém ficar de olho nas últimas.'),
      ex('puxada-frente', 'Puxada na frente', 3, '8-12', 120, 'maquina', 5, 'Peito alto e leve inclinação para trás. Puxe a barra até o alto do peito levando os cotovelos para baixo; não jogue o tronco para puxar.'),
      ex('voador', 'Voador', 3, '12-15', 90, 'maquina', 5, 'Cotovelos levemente dobrados e fixos. Junte as mãos à frente do peito, segure 1 s e volte até sentir o peito alongar.'),
      ex('remada-serrote', 'Remada serrote', 3, '8-12', 120, 'halter', 2, 'Joelho e mão no banco, coluna reta. Puxe o halter em direção ao quadril com o cotovelo rente ao corpo; desça esticando o braço.'),
      ex('elevacao-lateral', 'Elevação lateral', 3, '12-20', 60, 'halter', 2, DICA.lateral),
      ex('triceps-frances', 'Tríceps francês', 3, '10-15', 60, 'halter', 2, 'Sentado, halter seguro com as duas mãos acima da cabeça. Cotovelos apontando para cima e parados; desça o halter atrás da cabeça e estenda.'),
    ],
  },
}

export const exercicioDe = (letra, id, plano = PLANO_PADRAO) => plano.treinos[letra]?.exercicios.find((e) => e.id === id) || null

// ---------- números e textos ----------
export const fmtKg = (n) => String(Math.round(n * 100) / 100).replace('.', ',')
export function lerKg(s) {
  const t = String(s ?? '').trim()
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}
export function lerReps(s) {
  const n = parseInt(String(s ?? '').trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}
export const mmss = (seg) => `${Math.floor(seg / 60)}:${pad(Math.max(0, Math.round(seg % 60)))}`
export const dataBR = (s) => s.split('-').reverse().join('/')

export function incTxt(e) {
  if (e.corpo) return 'peso do corpo'
  const n = fmtKg(e.inc)
  return { barra: `barra +${n} kg`, halter: `halter +${n}`, maquina: `máquina +${n}`, polia: `polia +${n}`, anilhas: `anilhas sem o carrinho +${n}` }[e.equip]
}

// ---------- semanas do bloco ----------
const dayNum = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}
export const semanaDe = (inicio, data = today()) => Math.max(1, Math.floor((dayNum(data) - dayNum(inicio)) / 7) + 1)
export function datasDaSemana(inicio, n) {
  const a = addDays(inicio, 7 * (n - 1))
  return [a, addDays(a, 6)]
}

// Séries, RIR alvo, janela de RIR aceitável e cardio de cada semana (plano Hipertrofia).
function semanaHipertrofia(n) {
  const base = { semana: n, deload: false, fim: false, cardio: '20–30 min' }
  const todas = (k) => k
  if (n <= 2) return { ...base, fase: 'Retomada', series: (k) => Math.min(k, 2), seriesTxt: 'até 2 séries', rir: '3–4', janela: [3, 4], cardio: '20 min' }
  if (n === 3) return { ...base, fase: 'Progressão', series: todas, seriesTxt: '3 séries', rir: '3', janela: [2, 4] }
  if (n <= 5) return { ...base, fase: 'Progressão', series: todas, seriesTxt: '3 séries', rir: '2', janela: [1, 3] }
  if (n <= 7) return { ...base, fase: 'Progressão', series: todas, seriesTxt: '3 séries', rir: '1', janela: [0, 2] }
  if (n === 8) return { ...base, fase: 'Deload', deload: true, series: (k) => Math.ceil(k / 2), seriesTxt: 'metade das séries', rir: '3–4', janela: [3, 4] }
  // Depois do bloco: segue como na semana 3 até chegar o próximo programa.
  return { ...base, fase: 'Fim do bloco', fim: true, series: todas, seriesTxt: '3 séries', rir: '3', janela: [2, 4] }
}

// Aviso depois de cada série, pelo RIR (repetições que sobraram).
export function avaliarRir(e, rir, info) {
  if (rir == null) return null
  if (e.semFalha && rir === 0) return { tipo: 'falha', texto: 'Falha aqui não' }
  if (rir < info.janela[0]) return { tipo: 'pesado', texto: 'Pesado: baixe 5–10%' }
  if (!info.deload && rir > info.janela[1]) return { tipo: 'leve', texto: 'Leve: suba a carga' }
  return { tipo: 'ok', texto: 'Na medida' }
}

// ---------- meta da próxima vez (dupla progressão) ----------
const PASSO = { barra: (inc) => inc / 2, halter: () => 1, maquina: (inc) => inc, polia: (inc) => inc, anilhas: (inc) => inc }

// 10% a menos, arredondado ao passo do equipamento, sempre menor que a carga atual.
export function menos10(e, kg, barra = BARRA_PADRAO) {
  const passo = PASSO[e.equip]?.(e.inc) || 1
  let novo = Math.round((kg * 0.9) / passo) * passo
  if (novo >= kg) novo = kg - passo
  const minimo = e.equip === 'barra' ? barra : 0
  return Math.round(Math.max(minimo, novo) * 100) / 100
}

const validas = (e, series) => (series || []).filter((s) => s.reps > 0 && (e.corpo || s.kg != null))

// Séries feitas na carga da última série (é a carga que vale para a progressão).
function naUltimaCarga(e, series) {
  const feitas = validas(e, series)
  if (!feitas.length) return null
  const kg = e.corpo ? null : feitas[feitas.length - 1].kg
  return { kg, series: e.corpo ? feitas : feitas.filter((s) => s.kg === kg) }
}

export function abaixoDoMinimo(e, series) {
  const u = naUltimaCarga(e, series)
  return !!u && Math.min(...u.series.map((s) => s.reps)) < e.min
}

const carga = (kg) => (kg == null ? 'peso do corpo' : `${fmtKg(kg)} kg`)

// `series`: as séries de hoje. `anteriores`: as séries da última vez deste treino (para o "de novo").
export function calcProxima(e, series, info, anteriores, barra = BARRA_PADRAO) {
  const u = naUltimaCarga(e, series)
  if (!u) return null
  const { kg } = u
  const reps = u.series.map((s) => s.reps)
  const noTopo = reps.filter((r) => r >= e.max).length
  const rirBaixo = u.series.some((s) => s.rir != null && s.rir < info.janela[0])
  const estendido = Array.from({ length: e.series }, (_, i) => reps[Math.min(i, reps.length - 1)])
  const comMin = (acao, k, rotulo = carga(k)) => ({ acao, kg: k, min: e.min, reps: null, texto: `${rotulo} × ${e.min}+` })
  const comReps = (acao, lista) => ({ acao, kg, min: null, reps: lista, texto: `${carga(kg)} × ${lista.join(', ')}` })

  if (noTopo >= 2) {
    if (rirBaixo) return comReps('repetir', estendido)
    return e.corpo ? comMin('dificil', null, 'mais difícil') : comMin('subir', Math.round((kg + e.inc) * 100) / 100)
  }
  if (Math.min(...reps) < e.min) {
    if (!abaixoDoMinimo(e, anteriores)) return comMin('abaixo', kg)
    return e.corpo ? comMin('facilitar', null, 'mais fácil') : comMin('reduzir', menos10(e, kg, barra))
  }
  const alvo = [...estendido]
  const i = alvo.indexOf(Math.min(...alvo))
  if (alvo[i] < e.max) alvo[i] += 1
  return comReps('dentro', alvo)
}

// Sessões da pessoa, da mais nova para a mais antiga.
export const ordenar = (sessoes) => [...sessoes].sort((a, b) => b.data.localeCompare(a.data) || (b.createdAt || 0) - (a.createdAt || 0))

// O exercício na última vez deste treino (opcionalmente, antes de uma data).
export function anteriorDe(sessoes, letra, id, antesDe) {
  for (const s of ordenar(sessoes)) {
    if (s.treino !== letra || s.diaLeve || (antesDe && s.data >= antesDe)) continue
    const e = s.exercicios?.find((x) => x.id === id)
    if (e) return { ...e, semana: s.semana, data: s.data }
  }
  return null
}

// Meta de hoje: a "próxima" da última vez deste treino. Sem histórico, sugere a carga
// do mesmo exercício em outro treino, se houver.
export function metaAtual(e, letra, sessoes, barra = BARRA_PADRAO, plano = PLANO_PADRAO) {
  const ant = anteriorDe(sessoes, letra, e.id)
  if (ant) return ant.proxima || calcProxima(e, ant.series, semanaInfo(ant.semana || 1, plano), null, barra) || { acao: 'achar', kg: null, origem: null }
  for (const s of ordenar(sessoes)) {
    const o = s.exercicios?.find((x) => x.id === e.id)
    if (!o) continue
    const kg = o.proxima?.kg ?? [...(o.series || [])].reverse().find((x) => x.kg != null)?.kg ?? null
    return { acao: 'achar', kg: e.corpo ? null : kg, origem: s.treino }
  }
  return { acao: 'achar', kg: null, origem: null }
}

// O que aparece no campo de repetições antes de digitar.
export function repsAlvo(meta, e, i) {
  if (meta?.reps?.length) return String(meta.reps[Math.min(i, meta.reps.length - 1)])
  if (meta?.min) return `${meta.min}+`
  return `${e.min}–${e.max}`
}

// ---------- registro em texto ----------
export function formatarSeries(series) {
  let atual // carga da série anterior (undefined = ainda nenhuma escrita)
  return series
    .map((s) => {
      const k = s.kg ?? null
      const txt = k === atual ? String(s.reps) : `${carga(k)} × ${s.reps}`
      atual = k
      return txt
    })
    .join(', ')
}
const rirTxt = (r) => (r == null ? '-' : r >= 5 ? '5+' : String(r))

export function formatarRegistro(sessao, plano = PLANO_PADRAO) {
  const t = plano.treinos[sessao.treino]
  const linhas = [`REGISTRO DE TREINO (${dataBR(sessao.data)}) · Treino ${sessao.treino}: ${t?.nome || ''} · semana ${sessao.semana} de ${plano.bloco}`]
  if (sessao.diaLeve) linhas.push(DIA_LEVE_TXT)
  for (const e of sessao.exercicios || []) {
    if (!e.series?.length) continue
    let l = `${e.nome}: ${formatarSeries(e.series)}`
    if (e.series.some((s) => s.rir != null)) l += ` (RIR ${e.series.map((s) => rirTxt(s.rir)).join(', ')})`
    if (e.proxima?.texto) l += ` → próximo: ${e.proxima.texto}`
    linhas.push(l)
  }
  if (sessao.cardio) linhas.push(`Cardio: ${sessao.cardio} min`)
  return linhas.join('\n')
}

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// Acha o exercício pelo nome, primeiro no próprio treino e depois nos outros.
export function acharExercicio(nome, letra, plano = PLANO_PADRAO) {
  const n = norm(nome)
  if (!n) return null
  const ordem = [letra, ...LETRAS.filter((l) => l !== letra)]
  for (const l of ordem) {
    for (const e of plano.treinos[l]?.exercicios || []) {
      const m = norm(e.nome)
      if (m === n || m.startsWith(n + ' ') || n.startsWith(m + ' ')) return e
    }
  }
  return null
}

// Lê o "→ próximo: ..." de um registro.
export function lerProxima(txt, series) {
  const t = txt.trim()
  const ultimo = [...series].reverse().find((s) => s.kg != null)?.kg ?? null
  if (/^ache/i.test(t)) return { acao: 'achar', kg: null, min: null, reps: null, texto: t }
  let m = t.match(/^mais (dif[ií]cil|f[aá]cil)\s*[×x*]\s*(\d+)/i)
  if (m) return { acao: /dif/i.test(m[1]) ? 'dificil' : 'facilitar', kg: null, min: +m[2], reps: null, texto: t }
  m = t.match(/^(?:(peso do corpo)|([\d.,]+)\s*kg)\s*[×x*]\s*(.+)$/i)
  if (!m) return { acao: 'outro', kg: null, min: null, reps: null, texto: t }
  const kg = m[1] ? null : lerKg(m[2])
  const resto = m[3].trim()
  const mm = resto.match(/^(\d+)\s*\+$/)
  if (mm) {
    const acao = kg == null || ultimo == null || kg === ultimo ? 'abaixo' : kg > ultimo ? 'subir' : 'reduzir'
    return { acao, kg, min: +mm[1], reps: null, texto: t }
  }
  const reps = resto
    .split(/,\s*/)
    .map((x) => parseInt(x, 10))
    .filter(Number.isFinite)
  return { acao: 'dentro', kg, min: null, reps, texto: t }
}

function lerLinha(linha, letra, plano) {
  const m = linha.match(/^([^:]+):\s*(.+)$/)
  if (!m) return null
  const nome = m[1].trim()
  let resto = m[2].trim()
  let proximaTxt = null
  const p = resto.split(/\s*(?:→|->)\s*pr[oó]ximo\s*:\s*/i)
  if (p.length > 1) {
    resto = p[0].trim()
    proximaTxt = p.slice(1).join(' ').trim()
  }
  let rirs = []
  const r = resto.match(/\(\s*RIR\s*([^)]*)\)\s*$/i)
  if (r) {
    rirs = r[1].split(/,\s*/).map((x) => x.trim())
    resto = resto.slice(0, r.index).trim()
  }
  const series = []
  let kg // undefined até aparecer a primeira carga
  for (const tok of resto.split(/,\s+/)) {
    const t = tok.trim()
    const mm = t.match(/^(?:(peso do corpo)|([\d.,]+)\s*kg)\s*[×xX*]\s*(\d+)$/i)
    if (mm) {
      kg = mm[1] ? null : lerKg(mm[2])
      series.push({ kg, reps: +mm[3] })
    } else if (/^\d+$/.test(t)) {
      series.push({ kg: kg ?? null, reps: +t })
    } else return null
  }
  series.forEach((s, i) => {
    const v = parseInt(rirs[i], 10)
    s.rir = Number.isFinite(v) ? v : null
  })
  const def = acharExercicio(nome, letra, plano)
  return {
    def,
    id: def?.id || 'x-' + norm(nome).replace(/ /g, '-'),
    nome: def?.nome || nome,
    faixa: def ? `${def.min}–${def.max}` : '',
    series,
    proximaTxt,
  }
}

const RE_CABECALHO = /REGISTRO DE TREINO\s*\(\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*\)\s*·?\s*Treino\s+([ABCD])\b[^\n]*?(?:semana\s+(\d+))?\s*(?:de\s+\d+)?\s*$/i

// Lê um ou mais registros colados. Devolve as sessões (sem calcular metas) e avisos.
export function lerRegistros(texto, plano = PLANO_PADRAO) {
  const blocos = String(texto || '')
    .split(/(?=REGISTRO DE TREINO)/i)
    .map((b) => b.trim())
    .filter((b) => /^REGISTRO DE TREINO/i.test(b))
  const sessoes = []
  const avisos = []
  if (!blocos.length) avisos.push('Não achei nenhum texto começando com “REGISTRO DE TREINO”.')
  for (const bloco of blocos) {
    const [cab, ...linhas] = bloco.split(/\r?\n/)
    const m = cab.trim().match(RE_CABECALHO)
    if (!m) {
      avisos.push(`Não entendi o cabeçalho: “${cab.slice(0, 70)}”`)
      continue
    }
    const data = `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`
    const letra = m[4].toUpperCase()
    const exercicios = []
    let cardio = null
    let diaLeve = false
    for (const linha of linhas.map((l) => l.trim()).filter(Boolean)) {
      if (/^dia de pouca energia/i.test(linha)) {
        diaLeve = true
        continue
      }
      const c = linha.match(/^cardio\s*:\s*(\d+)/i)
      if (c) {
        cardio = +c[1]
        continue
      }
      const e = lerLinha(linha, letra, plano)
      if (e && e.series.length) exercicios.push(e)
      else avisos.push(`Linha ignorada: “${linha.slice(0, 70)}”`)
    }
    if (!exercicios.length) {
      avisos.push(`Treino de ${dataBR(data)} sem exercícios reconhecidos.`)
      continue
    }
    sessoes.push({ treino: letra, data, semana: m[5] ? +m[5] : null, exercicios, cardio, diaLeve, registro: bloco })
  }
  return { sessoes, avisos }
}

// ---------- planos ----------
// Cada pessoa escolhe um plano ao ativar o programa. Os planos não guardam dados pessoais
// (peso, idade, metas em kg): isso fica no programa da pessoa, no banco.

const DIA_LEVE_TXT = 'Dia de pouca energia: este treino não mudou a meta.'

function semanaRecomposicao(n) {
  const base = { semana: n, deload: false, fim: false, cardio: '20–30 min' }
  const todas = (k) => k
  if (n <= 2) return { ...base, fase: 'Retomada', series: (k) => Math.min(k, 2), seriesTxt: 'até 2 séries', rir: '3–4', janela: [3, 4], cardioSemana: 90 }
  if (n === 3) return { ...base, fase: 'Progressão', series: todas, seriesTxt: '3 séries', rir: '3', janela: [2, 4], cardioSemana: 120 }
  if (n === 4) return { ...base, fase: 'Progressão', series: todas, seriesTxt: '3 séries', rir: '2', janela: [1, 3], cardioSemana: 120 }
  if (n <= 6) return { ...base, fase: 'Progressão', series: todas, seriesTxt: '3 séries', rir: '1', janela: [0, 2], cardioSemana: 150 }
  if (n <= 8) return { ...base, fase: 'Intensificação', series: todas, seriesTxt: '3 séries', rir: '0–1', janela: [0, 1], cardioSemana: 150 }
  // Depois do bloco: segue como na semana 4 até chegar o próximo programa.
  return { ...base, fase: 'Fim do bloco', fim: true, series: todas, seriesTxt: '3 séries', rir: '2', janela: [1, 3], cardioSemana: 150 }
}

const DICA_R = {
  abdutora: 'Tronco levemente inclinado à frente para pegar mais glúteo. Abra as pernas, segure 1 s e volte devagar, sem deixar o peso bater.',
  unilateral: 'Comece pelo lado mais fraco e faça o mesmo número de repetições do outro lado.',
}

const TREINOS_RECOMPOSICAO = {
  A: {
    letra: 'A',
    nome: 'Inferior',
    foco: 'foco glúteo',
    cardio: true,
    exercicios: [
      ex('elevacao-pelvica-barra', 'Elevação pélvica com barra', 3, '8-12', 120, 'barra', 4, 'Costas apoiadas no banco na altura das escápulas e pés firmes no chão. Suba empurrando pelos calcanhares até o quadril alinhar, contraia o glúteo 1 s no topo e desça controlando. Use uma almofada na barra.'),
      ex('leg-press-pes-altos', 'Leg press 45° (pés altos)', 3, '10-15', 120, 'anilhas', 10, 'Pés mais altos e um pouco mais abertos na plataforma, para puxar mais glúteo. Lombar colada no encosto; desça até onde o quadril não sai do banco.'),
      ex('cadeira-abdutora', 'Cadeira abdutora', 3, '12-20', 60, 'maquina', 5, DICA_R.abdutora),
      ex('coice-polia', 'Coice na polia', 3, '10-15', 60, 'polia', 2.5, `Tornozeleira no pé e tronco firme. Leve a perna para trás e para cima contraindo o glúteo, sem arquear a lombar. ${DICA_R.unilateral}`, { lado: 'perna' }),
      ex('mesa-flexora', 'Mesa flexora', 3, '10-15', 90, 'maquina', 5, 'Quadril colado no banco e joelhos logo depois da borda. Suba até o fim e desça em 2–3 s, sem tirar o quadril do banco.'),
      ex('abdominal-polia', 'Abdominal na polia', 3, '10-15', 60, 'polia', 2.5, 'De joelhos, corda ao lado da cabeça. Enrole o tronco levando o peito em direção ao quadril; o quadril fica parado e os braços só seguram.'),
    ],
  },
  B: {
    letra: 'B',
    nome: 'Superior',
    foco: 'foco costas e ombros',
    cardio: true,
    exercicios: [
      ex('puxada-frente', 'Puxada na frente', 3, '8-12', 120, 'maquina', 5, 'Peito alto e leve inclinação para trás. Puxe a barra até o alto do peito levando os cotovelos para baixo; não jogue o tronco para puxar.'),
      ex('supino-inclinado-halteres', 'Supino inclinado com halteres', 3, '8-12', 120, 'halter', 2, 'Banco a 30°, escápulas juntas e pés firmes. Desça os halteres ao lado do peito com os cotovelos a uns 45° do tronco e empurre para cima.'),
      ex('remada-baixa', 'Remada baixa', 3, '8-12', 120, 'maquina', 5, 'Peito alto e coluna reta. Puxe até o abdômen levando os cotovelos para trás e juntando as escápulas; não balance o tronco.'),
      ex('elevacao-lateral', 'Elevação lateral', 3, '12-20', 60, 'halter', 1, 'Cotovelos levemente dobrados. Suba os braços até a altura dos ombros, sem impulso, e desça devagar.'),
      ex('triceps-polia-corda', 'Tríceps na polia com corda', 2, '10-15', 60, 'polia', 2.5, 'Cotovelos colados ao corpo e parados. Estenda os braços abrindo a corda no final e volte devagar.'),
      ex('elevacao-pernas', 'Elevação de pernas (infra)', 3, '10-15', 60, 'corpo', 0, 'Lombar colada no chão ou no encosto. Suba as pernas devagar e desça sem deixar a lombar arquear; dobre os joelhos se ficar difícil.'),
    ],
  },
  C: {
    letra: 'C',
    nome: 'Inferior',
    foco: 'foco posterior e glúteo',
    cardio: true,
    exercicios: [
      ex('terra-sumo', 'Levantamento terra sumô', 3, '6-10', 150, 'barra', 4, 'Pés bem afastados com as pontas para fora e mãos por dentro das pernas. Peito alto e barra colada ao corpo; empurre o chão e estenda quadril e joelhos juntos. Coluna sempre neutra.', { semFalha: true }),
      ex('hack', 'Agachamento no hack (ou smith)', 3, '8-12', 120, 'maquina', 5, 'Pés um pouco à frente na plataforma. Desça controlando sem tirar o quadril do encosto. Estalo no joelho sem dor é comum; se doer, inchar ou travar, troque pelo leg press.'),
      ex('stiff-halteres', 'Stiff com halteres', 3, '8-12', 120, 'halter', 2, 'Joelhos levemente dobrados. Leve o quadril para trás com os halteres rentes às pernas e a coluna reta; desça até alongar a parte de trás da coxa e suba contraindo o glúteo.'),
      ex('cadeira-flexora', 'Cadeira flexora', 3, '10-15', 90, 'maquina', 5, 'Joelho alinhado ao eixo da máquina e coxas presas pela almofada. Flexione até o fim e volte em 2–3 s.'),
      ex('elevacao-pelvica-unilateral', 'Elevação pélvica unilateral', 3, '10-15', 60, 'corpo', 0, `Costas no banco, um pé no chão e a outra perna no ar. Suba pelo calcanhar e contraia o glúteo no topo. ${DICA_R.unilateral}`, { lado: 'perna' }),
      ex('abdominal-maquina', 'Abdominal na máquina', 3, '10-15', 60, 'maquina', 5, 'Enrole o tronco levando as costelas em direção ao quadril; não puxe com os braços. Volte devagar.'),
    ],
  },
  D: {
    letra: 'D',
    nome: 'Corpo inteiro',
    foco: 'foco glúteo e abdômen',
    cardio: true,
    exercicios: [
      ex('leg-press-unilateral', 'Leg press unilateral', 3, '10-15', 90, 'anilhas', 5, `Um pé no centro da plataforma. Desça controlando sem o quadril sair do banco. ${DICA_R.unilateral}`, { lado: 'perna' }),
      ex('supino-reto-halteres', 'Supino reto com halteres', 3, '8-12', 120, 'halter', 2, 'Escápulas juntas e pés firmes. Desça os halteres ao lado do peito com os cotovelos a uns 45° e empurre para cima.'),
      ex('remada-serrote', 'Remada serrote', 3, '8-12', 120, 'halter', 2, 'Joelho e mão no banco, coluna reta. Puxe o halter em direção ao quadril com o cotovelo rente ao corpo; desça esticando o braço.'),
      ex('cadeira-abdutora', 'Cadeira abdutora', 3, '12-20', 60, 'maquina', 5, DICA_R.abdutora),
      ex('desenvolvimento-halteres', 'Desenvolvimento com halteres', 3, '8-12', 90, 'halter', 2, 'Sentada com encosto. Suba os halteres acima da cabeça sem arquear a lombar e desça até a altura das orelhas.'),
      ex('abdominal-obliquo-polia', 'Abdominal oblíquo na polia', 3, '10-15', 60, 'polia', 2.5, 'De lado para a polia, braços estendidos à frente. Gire o tronco para o lado oposto sem mexer o quadril e volte devagar.', { lado: 'lado' }),
    ],
  },
}

const DOR = [
  'Pontada, dor na articulação ou formigamento: pare a série e troque o exercício.',
  'Dor no peito, falta de ar ou tontura forte: pare o treino e ligue 192.',
]

export const PLANOS = {
  hipertrofia: {
    id: 'hipertrofia',
    nome: 'Hipertrofia A–D',
    descricao: 'Quatro treinos (2 inferiores, 2 superiores), retomada nas 2 primeiras semanas e deload na 8ª.',
    bloco: BLOCO,
    treinos: TREINOS,
    semana: semanaHipertrofia,
    semanaPor: 'data',
    fimTxt: 'Até lá, os treinos seguem como na semana 3 (3 séries, RIR 3).',
    cardioSemanal: false,
    diaLeve: false,
    regras: [
      'Semanas 1–2 (retomada): no máximo 2 séries por exercício, RIR 3–4, cardio 20 min.',
      'Semana 3: 3 séries, RIR 3. Semanas 4–5: RIR 2. Semanas 6–7: RIR 1. Cardio 20–30 min.',
      'Semana 8 (deload): metade das séries (arredonda para cima), RIR 3–4, mesma carga ou 10% menos.',
      'RIR = repetições que sobraram. Fora da janela da semana, o app avisa: “Pesado: baixe 5–10%” ou “Leve: suba a carga”. No deload, só avisa se estiver pesado.',
      'Agachamento livre e stiff: nunca até a falha.',
    ],
    alimentacao: () => ['Cerca de 160 g de proteína por dia, divididos nas refeições.', 'Perder de 0,4 a 0,8 kg por semana. Pese-se nas mesmas condições e olhe a média da semana.'],
    dor: DOR,
  },
  recomposicao: {
    id: 'recomposicao',
    nome: 'Recomposição · glúteo e abdômen',
    descricao: 'Quatro treinos com glúteo em três deles, retomada leve nas 2 primeiras semanas, esforço subindo até o limite, sem deload e com meta semanal de cardio.',
    bloco: BLOCO,
    treinos: TREINOS_RECOMPOSICAO,
    semana: semanaRecomposicao,
    semanaPor: 'ciclo',
    fimTxt: 'Até lá, os treinos seguem como na semana 4 (3 séries, RIR 2).',
    cardioSemanal: true,
    diaLeve: true,
    regras: [
      'Cada semana do plano = 4 treinos concluídos (A, B, C e D), não importa em quantos dias.',
      'Semanas 1–2 (retomada): no máximo 2 séries por exercício, RIR 3–4.',
      'Semana 3: 3 séries, RIR 3. Semana 4: RIR 2. Semanas 5–6: RIR 1. Semanas 7–8: RIR 0–1, até o limite.',
      'Sem semana de deload. Em dias de pouca energia (ex.: menstruação), marque “dia de pouca energia” no treino: use a carga que der para cumprir o RIR e a meta da próxima vez não muda.',
      'RIR = repetições que sobraram. Fora da janela da semana, o app avisa: “Pesado: baixe 5–10%” ou “Leve: suba a carga”.',
      'Levantamento terra sumô: nunca até a falha.',
      'Exercícios de uma perna: comece pelo lado mais fraco e repita o mesmo número de repetições do outro lado.',
      'Glúteo em três dos quatro treinos (A, C e D) e abdômen em todos.',
    ],
    alimentacao: (programa) => [
      programa?.proteina
        ? `Proteína: cerca de ${programa.proteina} g por dia, divididos nas refeições.`
        : 'Proteína: de 1,6 a 2 g por kg do seu peso-meta por dia, divididos nas refeições. Coloque a sua meta em gramas acima.',
      'Perder de 0,4 a 0,7 kg por semana, que ajuda a manter a massa muscular. Pese-se nas mesmas condições e olhe a média da semana.',
      'Na semana da menstruação o peso costuma subir por retenção de líquido; compare com o mesmo período do mês anterior.',
    ],
    cardio: [
      'Meta de cardio moderado por semana: 90 min nas semanas 1–2, 120 min nas 3–4 e 150 min da 5 em diante.',
      'Moderado = dá para falar frases curtas, mas não cantar. Vale esteira, bike, escada, elíptico e corrida. O jiu-jitsu não entra na conta.',
      'Jeito mais fácil: 20–30 min depois de cada musculação. Corridas em outros dias entram em “Registrar cardio”.',
      'Para começar a correr: alterne 1 min correndo e 2 min andando, 8 vezes. A cada semana, aumente um pouco o tempo correndo.',
    ],
    dor: [...DOR, 'Estalo no joelho sem dor é comum. Se doer, inchar ou travar, troque o exercício (ex.: hack pelo leg press) e procure um médico se continuar.'],
  },
}
export const PLANO_PADRAO = PLANOS.hipertrofia
export const planoDe = (programa) => PLANOS[programa?.plano] || PLANO_PADRAO
export const planoDaSessao = (s) => s.plano || PLANO_PADRAO.id
export const semanaInfo = (n, plano = PLANO_PADRAO) => plano.semana(n)

// Como as semanas contam: 'data' (7 dias a partir do início) ou 'ciclo' (a cada 4 treinos concluídos).
export const TREINOS_POR_SEMANA = 4
export const modoSemana = (programa, plano = PLANO_PADRAO) => programa?.semanaPor || plano.semanaPor || 'data'

// Semana em que a pessoa está. `sessoes` = as sessões dela neste plano.
export function semanaAtual(programa, plano, sessoes, data = today()) {
  if (modoSemana(programa, plano) === 'ciclo') {
    const feitos = sessoes.filter((s) => s.data >= programa.inicio).length
    return { semana: Math.floor(feitos / TREINOS_POR_SEMANA) + 1, treino: (feitos % TREINOS_POR_SEMANA) + 1, ciclo: true }
  }
  return { semana: semanaDe(programa.inicio, data), treino: null, ciclo: false }
}
