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

// Diz se um evento (com repetição) acontece no dia `day` (YYYY-MM-DD).
export function occursOn(ev, day) {
  if (!ev.date || day < ev.date) return false
  if (ev.until && day > ev.until) return false
  const endDate = ev.endDate && ev.endDate > ev.date ? ev.endDate : ev.date
  if (!ev.repeat || ev.repeat === 'none') return day <= endDate
  const a = parseYmd(ev.date)
  const b = parseYmd(day)
  switch (ev.repeat) {
    case 'daily':
      return true
    case 'weekly':
      return a.getDay() === b.getDay()
    case 'monthly':
      return a.getDate() === b.getDate()
    case 'yearly':
      return a.getDate() === b.getDate() && a.getMonth() === b.getMonth()
    default:
      return false
  }
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
