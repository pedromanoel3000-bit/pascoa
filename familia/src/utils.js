export const COLORS = ['#5b4bdb', '#e5484d', '#12a594', '#f76b15', '#3e63dd', '#d6409f', '#8e4ec6', '#46a758', '#ffb224', '#0090ff']
export const AVATARS = ['👨', '👩', '👦', '👧', '👴', '👵', '🧑', '👶', '🐶', '🐱', '🦊', '🐻']

export const pad = (n) => String(n).padStart(2, '0')
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => ymd(new Date())
export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function addDays(s, n) {
  const d = parseYmd(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const WEEKDAYS_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export function fmtDate(s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!s) return ''
  return parseYmd(s).toLocaleDateString('pt-BR', opts)
}

export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  if (s < 7 * 86400) return `há ${Math.floor(s / 86400)} d`
  return new Date(ts).toLocaleDateString('pt-BR')
}

export const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ---------- repetição ----------
// Eventos e tarefas têm `repeat` e, quando personalizado, `rule`:
//   repeat: 'none' | 'daily' | 'workdays' | 'weekly' | 'monthly' | 'yearly' | 'custom'
//   rule:   { freq: 'day'|'week'|'month'|'year', interval, weekdays: [0-6],
//             monthMode: 'day' (no dia 15) | 'nth' (na 3ª quarta) | 'last' (na última quarta),
//             end: 'never'|'until'|'count', until: 'AAAA-MM-DD', count }
// A âncora é a data do evento (date) ou o prazo da tarefa (due). Em "depois de N vezes", o `until`
// é calculado ao salvar, para a conferência de cada dia continuar rápida.

const dayNum = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}
const fromNum = (n) => {
  const d = new Date(n * 86400000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
const wdNum = (n) => (((n + 4) % 7) + 7) % 7 // 01/01/1970 foi quinta-feira
const ymdParts = (s) => s.split('-').map(Number)
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate() // m de 1 a 12
export const weekdayOf = (s) => wdNum(dayNum(s))
export const WEEKDAYS_FULL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

export function joinPt(list) {
  return list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`
}

const PRESETS = {
  daily: { freq: 'day' },
  workdays: { freq: 'week', weekdays: [1, 2, 3, 4, 5] },
  weekly: { freq: 'week' },
  monthly: { freq: 'month' },
  yearly: { freq: 'year' },
}

export function defaultRule(anchor, repeat) {
  const base = { freq: 'week', interval: 1, weekdays: [weekdayOf(anchor || today())], monthMode: 'day', end: 'never', until: '', count: 10 }
  return { ...base, ...(PRESETS[repeat] || {}) }
}

// "na terceira quarta-feira" só existe até a 4ª; a 5ª vira "na última".
const monthModeFor = (mode, anchor) => (mode === 'nth' && Math.ceil(ymdParts(anchor)[2] / 7) > 4 ? 'last' : mode || 'day')

// Regra normalizada do item, ou null se ele não repete.
export function ruleOf(item, anchor) {
  const rep = item.repeat
  if (!rep || rep === 'none' || !anchor) return null
  if (rep !== 'custom' && !PRESETS[rep]) return null
  const r = rep === 'custom' ? { ...defaultRule(anchor), ...(item.rule || {}) } : defaultRule(anchor, rep)
  const weekdays = Array.isArray(r.weekdays) && r.weekdays.length ? r.weekdays.map(Number) : [weekdayOf(anchor)]
  const until = rep === 'custom' ? (r.end !== 'never' && r.until ? r.until : null) : item.until || null
  const interval = Math.min(99, Math.max(1, Math.floor(Number(r.interval)) || 1))
  return { freq: r.freq, interval, weekdays, monthMode: monthModeFor(r.monthMode, anchor), until, anchor }
}

function matches(r, day) {
  if (day < r.anchor || (r.until && day > r.until)) return false
  const a = dayNum(r.anchor)
  const d = dayNum(day)
  if (r.freq === 'day') return (d - a) % r.interval === 0
  if (r.freq === 'week') return r.weekdays.includes(wdNum(d)) && Math.floor((d - (a - wdNum(a))) / 7) % r.interval === 0
  const [ya, ma, da] = ymdParts(r.anchor)
  const [yd, md, dd] = ymdParts(day)
  // Dia 29 a 31 em mês mais curto (ou 29/02 fora de ano bissexto): vale o último dia do mês.
  if (r.freq === 'year') return md === ma && dd === Math.min(da, daysInMonth(yd, md)) && (yd - ya) % r.interval === 0
  if (r.freq === 'month') {
    if (((yd - ya) * 12 + (md - ma)) % r.interval !== 0) return false
    if (r.monthMode === 'day') return dd === Math.min(da, daysInMonth(yd, md))
    if (wdNum(d) !== wdNum(a)) return false
    if (r.monthMode === 'last') return dd + 7 > daysInMonth(yd, md)
    return Math.ceil(dd / 7) === Math.ceil(da / 7)
  }
  return false
}

// A data da série dentro de um mês (ou null se o mês não tem esse dia).
function dateInMonth(r, y, m) {
  const da = ymdParts(r.anchor)[2]
  const dim = daysInMonth(y, m)
  const at = (d) => `${y}-${pad(m)}-${pad(d)}`
  if (r.monthMode === 'day') return at(Math.min(da, dim))
  const first = 1 + ((weekdayOf(r.anchor) - weekdayOf(at(1)) + 7) % 7)
  if (r.monthMode === 'last') return at(first + 7 * Math.floor((dim - first) / 7))
  const d = first + 7 * (Math.ceil(da / 7) - 1)
  return d <= dim ? at(d) : null
}

// Próxima data da série depois de `after`, ou null se a série já terminou.
export function nextAfter(r, after) {
  const from = after < r.anchor ? addDays(r.anchor, -1) : after
  let next = null
  if (r.freq === 'day') {
    const a = dayNum(r.anchor)
    const k = Math.floor((dayNum(from) - a) / r.interval) + 1
    next = fromNum(a + Math.max(0, k) * r.interval)
  } else if (r.freq === 'week') {
    for (let i = 1; i <= 7 * r.interval + 7 && !next; i++) {
      const d = addDays(from, i)
      if (matches(r, d)) next = d
    }
  } else if (r.freq === 'month') {
    let [y, m] = ymdParts(from)
    for (let i = 0; i <= 12 * r.interval + 24 && !next; i++) {
      const c = dateInMonth(r, y, m)
      if (c && c > from && matches(r, c)) next = c
      if (++m > 12) {
        m = 1
        y++
      }
    }
  } else if (r.freq === 'year') {
    const [, ma, da] = ymdParts(r.anchor)
    for (let y = ymdParts(from)[0], i = 0; i <= 2 * r.interval + 2 && !next; i++, y++) {
      const c = `${y}-${pad(ma)}-${pad(Math.min(da, daysInMonth(y, ma)))}`
      if (c > from && matches(r, c)) next = c
    }
  }
  return next && (!r.until || next <= r.until) ? next : null
}

// Data da N-ésima vez da série (para "depois de N vezes").
function nthOccurrence(r, count) {
  const free = { ...r, until: null }
  let d = matches(free, free.anchor) ? free.anchor : nextAfter(free, free.anchor)
  for (let i = 1; i < count && d; i++) d = nextAfter(free, d)
  return d
}

// Arruma a repetição antes de salvar: limites, dias da semana e a data final de "depois de N vezes".
export function finalizeRepeat(repeat, rule, anchor) {
  if (repeat !== 'custom') return { repeat: repeat || 'none', rule: null }
  const r = { ...defaultRule(anchor), ...(rule || {}) }
  r.interval = Math.min(99, Math.max(1, Math.floor(Number(r.interval)) || 1))
  r.weekdays = [...new Set((r.weekdays || []).map(Number))].sort((a, b) => a - b)
  if (!r.weekdays.length) r.weekdays = [weekdayOf(anchor)]
  r.monthMode = monthModeFor(r.monthMode, anchor)
  if (r.end === 'count') {
    r.count = Math.min(999, Math.max(1, Math.floor(Number(r.count)) || 1))
    r.until = nthOccurrence(ruleOf({ repeat: 'custom', rule: { ...r, end: 'never' } }, anchor), r.count) || anchor
  } else if (r.end === 'until') {
    if (!r.until || r.until < anchor) r.until = anchor
  } else {
    r.end = 'never'
    r.until = ''
  }
  return { repeat: 'custom', rule: r }
}

// Diz se um evento acontece no dia `day` (AAAA-MM-DD), considerando a repetição.
export function occursOn(ev, day) {
  if (!ev.date || day < ev.date) return false
  const r = ruleOf(ev, ev.date)
  if (!r) return day <= (ev.endDate && ev.endDate > ev.date ? ev.endDate : ev.date)
  return matches(r, day)
}

// Próximo prazo de uma tarefa repetida (ou null se a repetição acabou).
// Se a tarefa estava atrasada, pula para a próxima data a partir de hoje.
export function nextTaskDue(task) {
  const anchor = task.due || today()
  const r = ruleOf(task, anchor)
  if (!r) return null
  const yesterday = addDays(today(), -1)
  return nextAfter(r, anchor > yesterday ? anchor : yesterday)
}

const ORD = { f: ['primeira', 'segunda', 'terceira', 'quarta'], m: ['primeiro', 'segundo', 'terceiro', 'quarto'] }
export function monthPhrase(mode, anchor) {
  const da = ymdParts(anchor)[2]
  const w = weekdayOf(anchor)
  const masc = w === 0 || w === 6 // domingo e sábado
  const m = monthModeFor(mode, anchor)
  if (m === 'day') return da >= 29 ? `no dia ${da} (ou no último dia do mês)` : `no dia ${da}`
  const ord = m === 'last' ? (masc ? 'último' : 'última') : (masc ? ORD.m : ORD.f)[Math.ceil(da / 7) - 1]
  return `${masc ? 'no' : 'na'} ${ord} ${WEEKDAYS_FULL[w]}`
}

// Texto curto da repetição, ex.: "A cada 2 semanas: seg e qua, 10 vezes".
export function describeRepeat(item, anchor = item.date || item.due) {
  const rep = item.repeat
  if (!rep || rep === 'none') return ''
  if (rep === 'workdays') return 'Dias úteis (seg a sex)'
  if (rep !== 'custom') return { daily: 'Todo dia', weekly: 'Toda semana', monthly: 'Todo mês', yearly: 'Todo ano' }[rep] || ''
  const a = anchor || today()
  const r = ruleOf(item, a)
  if (!r) return ''
  const [one, many] = { day: ['Todo dia', 'dias'], week: ['Toda semana', 'semanas'], month: ['Todo mês', 'meses'], year: ['Todo ano', 'anos'] }[r.freq]
  let s = r.interval === 1 ? one : `A cada ${r.interval} ${many}`
  if (r.freq === 'week') {
    const days = [...r.weekdays].sort((x, y) => x - y)
    s += days.join() === '1,2,3,4,5' ? ', em dias úteis' : `: ${joinPt(days.map((d) => WEEKDAYS[d]))}`
  }
  if (r.freq === 'month') s += `, ${monthPhrase(r.monthMode, a)}`
  if (r.freq === 'year') s += `, em ${Number(a.slice(8))} de ${MONTHS[Number(a.slice(5, 7)) - 1]}`
  const rule = item.rule || {}
  const count = Math.floor(Number(rule.count)) || 0
  if (rule.end === 'count' && count) s += `, ${count} ${count === 1 ? 'vez' : 'vezes'}`
  else if (rule.end === 'until' && rule.until) s += `, até ${rule.until.split('-').reverse().join('/')}`
  return s
}

// Eventos do dia, incluindo aniversários dos membros e contatos.
export function eventsOn(events, people, day) {
  const list = events.filter((e) => occursOn(e, day))
  const md = day.slice(5)
  for (const p of people) {
    if (p.birthday && p.birthday.slice(5) === md) {
      const age = Number(day.slice(0, 4)) - Number(p.birthday.slice(0, 4))
      list.push({ id: 'bday-' + p.id, title: `🎂 Aniversário de ${p.name}${age > 0 && age < 130 ? ` (${age})` : ''}`, allDay: true, birthday: true, members: p.type === 'member' ? [p.id] : [] })
    }
  }
  return list.sort((x, y) => (x.allDay ? '' : x.start || '').localeCompare(y.allDay ? '' : y.start || ''))
}

// Reduz a foto antes de salvar, para caber no aparelho e sincronizar rápido.
export function resizeImage(file, max = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// Próximo dia (a partir de hoje) em que o evento acontece, procurando até ~1 ano à frente.
export function nextOccurrence(ev, from = today(), maxDays = 400) {
  if (!ev.date) return null
  if (!ev.repeat || ev.repeat === 'none') {
    const end = ev.endDate && ev.endDate > ev.date ? ev.endDate : ev.date
    if (end < from) return null
    return ev.date >= from ? ev.date : from
  }
  for (let i = 0; i < maxDays; i++) {
    const d = addDays(from, i)
    if (occursOn(ev, d)) return d
  }
  return null
}

// Quantos dias entre hoje e a data (0 = hoje).
export function daysUntil(day, from = today()) {
  return Math.round((parseYmd(day) - parseYmd(from)) / 86400000)
}

// Próximo aniversário (data deste ano ou do próximo).
export function nextBirthday(birthday, from = today()) {
  const year = Number(from.slice(0, 4))
  let d = `${year}${birthday.slice(4)}`
  if (d < from) d = `${year + 1}${birthday.slice(4)}`
  return d
}
