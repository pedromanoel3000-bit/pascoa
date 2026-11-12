// Notificações do Nosso Lar (Web Push): avisos quando algo acontece e lembretes de horário.
import crypto from 'node:crypto'
import webpush from 'web-push'
import { addDays, occursOn } from './src/utils.js'
import { radar } from './src/radar.js'

const ACTIVE_MS = 20_000 // aparelho com o app aberto agora não recebe aviso (ele já vê na tela)
const LIST_BATCH_MS = 30_000 // junta vários itens de lista num aviso só
const DEFAULT_TZ = 'America/Sao_Paulo'
const MORNING = 8 * 60 // aniversários e eventos de dia inteiro: 8h
const TASKS_TIME = 9 * 60 // tarefas do dia: 9h
const RADAR_TIME = 19 * 60 + 30 // radar: um aviso por pessoa, 19h30
const INBOX_MAX = 150
// Tipos que nunca geram aviso (ex.: o treino de cada pessoa).
const SEM_AVISO = new Set(['treinoPrograma', 'treinoSessao', 'treinoRascunho', 'treinoCardio', 'radarVisto', 'radarAviso', 'inicioPref']) // avisos guardados por pessoa no histórico do app

export const CATEGORIES = ['chat', 'tasks', 'events', 'reminders', 'lists', 'posts', 'radar']

export function createNotifier({ families, loadFamily, putItem, getConfig, setConfig, familiesWithPush }) {
  const lastSeen = new Map() // dispositivo -> horário da última sincronização
  const listBatches = new Map()
  const sent = new Map() // lembretes já enviados -> horário
  let ready = null

  // Chaves VAPID: identificam o servidor junto ao Google/Apple. Geradas uma vez e guardadas.
  function setup() {
    if (!ready) {
      ready = (async () => {
        let keys =
          process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
            ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
            : await getConfig('vapid')
        if (!keys) {
          keys = await setConfig('vapid', webpush.generateVAPIDKeys())
          // Normal só na primeira vez. Se aparecer a cada reinício, o servidor está sem armazenamento permanente.
          console.warn('Chaves novas das notificações criadas. Aparelhos inscritos com chaves antigas precisam reativar.')
        }
        const subject = process.env.VAPID_SUBJECT || process.env.RENDER_EXTERNAL_URL || 'https://github.com/pedromanoel3000-bit/pascoa'
        webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey)
        return keys
      })().catch((err) => {
        ready = null
        throw err
      })
    }
    return ready
  }

  const members = (fam) => Object.values(fam.items).filter((i) => i.type === 'member' && !i.deleted)
  const nameOf = (fam, id) => fam.items[id]?.name || 'Alguém'
  const subs = (fam) => Object.values(fam.items).filter((i) => i.type === 'pushsub' && !i.deleted)
  const subId = (endpoint) => 'push-' + crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 20)

  async function sendTo(key, fam, sub, payload) {
    await setup()
    try {
      await webpush.sendNotification(sub.subscription, JSON.stringify(payload), { TTL: 6 * 3600, urgency: 'high' })
      return true
    } catch (err) {
      // 404/410: o aparelho cancelou a inscrição ou o navegador foi reinstalado.
      if (err.statusCode === 404 || err.statusCode === 410) putItem(key, fam, { id: sub.id, type: 'pushsub', deleted: true })
      else console.error('Falha ao enviar notificação:', err.statusCode || '', err.body || err.message)
      return false
    }
  }

  // Guarda o aviso no histórico do app de cada pessoa. Avisos seguidos com a mesma etiqueta
  // (ex.: mensagens da mesma conversa) que ainda não foram lidos viram um item só.
  function record(key, fam, memberIds, category, payload) {
    const ids = {}
    const now = Date.now()
    const inbox = Object.values(fam.items).filter((i) => i.type === 'notif' && !i.deleted)
    for (const m of new Set(memberIds)) {
      if (fam.items[m]?.type !== 'member' || fam.items[m].deleted) continue
      const same = payload.tag && inbox.find((n) => n.to === m && !n.read && n.tag === payload.tag)
      const item = putItem(key, fam, {
        id: same ? same.id : 'n-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
        type: 'notif',
        to: m,
        category,
        title: payload.title,
        body: payload.body,
        url: payload.url,
        tag: payload.tag || null,
        count: same ? (same.count || 1) + 1 : 1,
        read: false,
        createdAt: now,
      })
      ids[m] = item.id
      if (!same) {
        const mine = inbox.filter((n) => n.to === m).sort((a, b) => a.createdAt - b.createdAt)
        for (const old of mine.slice(0, Math.max(0, mine.length + 1 - INBOX_MAX))) putItem(key, fam, { id: old.id, type: 'notif', deleted: true })
      }
    }
    return ids
  }

  // Guarda no histórico e envia para os celulares, respeitando as preferências e pulando quem está com o app aberto.
  function notify(key, fam, memberIds, category, payload, { skipDevice } = {}) {
    const nids = record(key, fam, memberIds, category, payload)
    const now = Date.now()
    const targets = subs(fam).filter(
      (s) =>
        memberIds.includes(s.member) &&
        s.prefs?.[category] !== false &&
        s.device !== skipDevice &&
        !(category !== 'reminders' && now - (lastSeen.get(s.device) || 0) < ACTIVE_MS)
    )
    return Promise.all(targets.map((s) => sendTo(key, fam, s, { ...payload, nid: nids[s.member] })))
  }

  // ---------- avisos quando algo muda ----------
  function onChanges(key, fam, actor, device, events) {
    const everyone = members(fam).map((m) => m.id)
    const others = (ids) => [...new Set(ids)].filter((id) => id && id !== actor)
    const who = nameOf(fam, actor)
    for (const [prev, it] of events) {
      const isNew = !prev || prev.deleted
      if (it.deleted || SEM_AVISO.has(it.type)) continue
      if (it.type === 'message' && isNew) {
        const family = it.conv === 'family'
        const to = family ? others(everyone) : others(String(it.conv).split('|'))
        notify(key, fam, to, 'chat', { title: family ? `${who} · Família` : who, body: it.text || '📷 Foto', url: '/#chat', tag: 'chat-' + it.conv }, { skipDevice: device })
      } else if (it.type === 'task' && !it.done && it.assignee && it.assignee !== actor && (isNew || prev.assignee !== it.assignee)) {
        notify(key, fam, [it.assignee], 'tasks', { title: 'Nova tarefa para você', body: `${it.title}${it.due ? ' · até ' + fmtDay(it.due) : ''} — de ${who}`, url: '/#tasks', tag: 'task-' + it.id })
      } else if (it.type === 'event' && isNew) {
        const to = others(it.members?.length ? it.members : everyone)
        const when = `${fmtDay(it.date)}${it.allDay || !it.start ? '' : ' às ' + it.start}`
        notify(key, fam, to, 'events', { title: `📅 ${who} marcou um evento`, body: `${it.title} · ${when}`, url: '/#calendar', tag: 'event-' + it.id })
      } else if (it.type === 'post' && isNew) {
        const title = it.poll ? `📊 ${who} criou uma votação` : `${who} postou no mural`
        notify(key, fam, others(everyone), 'posts', { title, body: it.text || '📷 Nova foto', url: '/#home', tag: 'post-' + it.id })
      } else if (it.type === 'listItem' && isNew) {
        queueListItem(key, fam, actor, it)
      }
    }
  }

  function queueListItem(key, fam, actor, it) {
    const id = `${key}|${actor}|${it.listId}`
    const b = listBatches.get(id) || { titles: [] }
    b.titles.push(it.title)
    clearTimeout(b.timer)
    b.timer = setTimeout(() => {
      listBatches.delete(id)
      const list = fam.items[it.listId]
      const everyone = members(fam).map((m) => m.id)
      const t = b.titles
      const body = `${nameOf(fam, actor)} adicionou ${t.length > 3 ? `${t.slice(0, 3).join(', ')} e mais ${t.length - 3}` : joinPt(t)}`
      notify(key, fam, everyone.filter((m) => m !== actor), 'lists', { title: `${list?.icon || '🛒'} ${list?.title || 'Lista'}`, body, url: '/#lists', tag: 'list-' + it.listId })
    }, LIST_BATCH_MS)
    listBatches.set(id, b)
  }

  // ---------- lembretes (a cada minuto) ----------
  function tick() {
    const now = Date.now()
    for (const [id, at] of sent) if (now - at > 3 * 86400000) sent.delete(id)
    for (const [key, fam] of families) {
      const ss = subs(fam)
      const local = localNow(ss[0]?.tz || DEFAULT_TZ)
      checkFamily(key, fam, local)
    }
  }

  function once(id, fn) {
    if (sent.has(id)) return
    sent.set(id, Date.now())
    fn()
  }

  // Dispara quando o horário marcado chegou há menos de 5 minutos (tolera atrasos do servidor).
  const due = (local, day, minutes) => {
    const at = dayIndex(day) * 1440 + minutes
    const n = dayIndex(local.day) * 1440 + local.minutes
    return n >= at && n < at + 5
  }

  function checkFamily(key, fam, local) {
    const everyone = members(fam).map((m) => m.id)
    const today = local.day
    const tomorrow = addDays(today, 1)
    const items = Object.values(fam.items).filter((i) => !i.deleted)

    for (const ev of items.filter((i) => i.type === 'event')) {
      if (ev.remind === 'none') continue
      const r = Number(ev.remind ?? 30)
      const to = ev.members?.length ? ev.members : everyone
      for (const day of [today, tomorrow]) {
        if (!occursOn(ev, day)) continue
        // Já concluído (no dia, ou o evento todo, se ele não se repete): sem lembrete.
        if ((ev.concluidos || []).includes(ev.repeat && ev.repeat !== 'none' ? day : ev.date)) continue
        if (ev.allDay || !ev.start) {
          if (day === today && due(local, day, MORNING)) once(`ev:${ev.id}:${day}`, () => notify(key, fam, to, 'reminders', { title: `📅 Hoje: ${ev.title}`, body: ev.place || 'Dia inteiro', url: '/#calendar', tag: 'rem-' + ev.id }))
          continue
        }
        const [h, m] = ev.start.split(':').map(Number)
        const start = h * 60 + m
        if (!due(local, day, start - r)) continue
        const when = r === 0 ? 'Começando agora' : `${day === today ? 'Hoje' : 'Amanhã'} às ${ev.start}`
        once(`ev:${ev.id}:${day}`, () => notify(key, fam, to, 'reminders', { title: `⏰ ${ev.title}`, body: `${when}${ev.place ? ' · ' + ev.place : ''}`, url: '/#calendar', tag: 'rem-' + ev.id }))
      }
    }

    if (due(local, today, MORNING)) {
      for (const p of items.filter((i) => (i.type === 'member' || i.type === 'contact') && i.birthday)) {
        if (p.birthday.slice(5) !== today.slice(5)) continue
        const to = everyone.filter((m) => m !== p.id)
        once(`bday:${p.id}:${today}`, () => notify(key, fam, to, 'reminders', { title: '🎂 Aniversário hoje', body: `Hoje é aniversário de ${p.name}!`, url: '/#calendar', tag: 'bday-' + p.id }))
      }
    }

    if (due(local, today, RADAR_TIME)) once(`radar:${key}:${today}`, () => radarPush(key, fam, local).catch((err) => console.error('Radar:', err.message)))

    if (due(local, today, TASKS_TIME)) {
      const byPerson = new Map()
      for (const t of items.filter((i) => i.type === 'task' && !i.done && i.assignee && i.due && i.due <= today)) {
        byPerson.set(t.assignee, [...(byPerson.get(t.assignee) || []), t.title])
      }
      for (const [person, titles] of byPerson) {
        once(`tasks:${person}:${today}`, () => notify(key, fam, [person], 'reminders', { title: `✅ ${titles.length} tarefa${titles.length > 1 ? 's' : ''} para hoje`, body: joinPt(titles), url: '/#tasks', tag: 'tasks-today' }))
      }
    }
  }

  // Radar: o achado mais importante que a pessoa ainda não dispensou nem recebeu, uma vez por dia.
  async function radarPush(key, fam, local) {
    const comAviso = new Set(subs(fam).filter((s) => s.prefs?.radar !== false).map((s) => s.member))
    if (!comAviso.size) return
    const itens = Object.values(fam.items).filter((i) => !i.deleted)
    let previsao = null
    const lugar = members(fam).find((m) => m.shareLocation && m.location)?.location
    if (lugar) {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lugar.lat.toFixed(1)}&longitude=${lugar.lng.toFixed(1)}&daily=precipitation_probability_max&forecast_days=7&timezone=auto`, { signal: AbortSignal.timeout(6000) })
        const d = r.ok ? (await r.json()).daily : null
        if (d?.time) previsao = Object.fromEntries(d.time.map((dia, i) => [dia, d.precipitation_probability_max?.[i] ?? null]))
      } catch {}
    }
    const corte = Date.now() - 90 * 86400000
    for (const m of comAviso) {
      if (fam.items[m]?.type !== 'member' || fam.items[m].deleted) continue
      const avisados = Object.fromEntries(Object.entries(fam.items['radar-avisos-' + m]?.avisados || {}).filter(([, t]) => t > corte))
      const [achado] = radar({ itens, eu: m, hoje: local.day, agoraMin: local.minutes, previsao, vistos: { ...(fam.items['radar-' + m]?.vistos || {}), ...avisados }, adiados: fam.items['radar-' + m]?.adiados || {}, desligados: fam.items['radar-' + m]?.desligados || [] })
      if (!achado) continue
      putItem(key, fam, { id: 'radar-avisos-' + m, type: 'radarAviso', avisados: { ...avisados, [achado.id]: Date.now() } })
      notify(key, fam, [m], 'radar', { title: `${achado.icone} ${achado.titulo}`, body: achado.texto, url: '/#home', tag: 'radar' })
    }
  }

  return {
    publicKey: async () => (await setup()).publicKey,

    seen(key, device) {
      if (device) lastSeen.set(device, Date.now())
    },

    onChanges(key, fam, actor, device, events) {
      try {
        onChanges(key, fam, actor, device, events)
      } catch (err) {
        console.error('Falha ao preparar avisos:', err.message)
      }
    },

    async subscribe(key, fam, body) {
      await setup()
      const sub = body.subscription
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new Error('inscrição inválida')
      if (!fam.items[body.member] || fam.items[body.member].type !== 'member') throw new Error('membro inválido')
      const prefs = {}
      for (const c of CATEGORIES) prefs[c] = body.prefs?.[c] !== false
      const item = putItem(key, fam, {
        id: subId(sub.endpoint),
        type: 'pushsub',
        member: body.member,
        device: String(body.device || ''),
        subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        prefs,
        tz: typeof body.tz === 'string' && body.tz.length < 64 ? body.tz : DEFAULT_TZ,
        ua: String(body.ua || '').slice(0, 120),
      })
      return { ok: true, prefs: item.prefs }
    },

    unsubscribe(key, fam, body) {
      const id = subId(String(body.endpoint || ''))
      if (fam.items[id] && !fam.items[id].deleted) putItem(key, fam, { id, type: 'pushsub', deleted: true })
      return { ok: true }
    },

    async test(key, fam, body) {
      const sub = fam.items[subId(String(body.endpoint || ''))]
      if (!sub || sub.deleted) throw new Error('este aparelho não está cadastrado')
      const ok = await sendTo(key, fam, sub, { title: '🔔 Notificações ativadas!', body: `Tudo certo, ${nameOf(fam, sub.member)}. Você vai receber os avisos da família aqui.`, url: '/#settings', tag: 'test' })
      return { ok }
    },

    // Carrega as famílias com notificações (para os lembretes) e começa a conferir a cada minuto.
    start() {
      familiesWithPush()
        .then((keys) => Promise.all(keys.map((k) => loadFamily(k).catch(() => null))))
        .then((loaded) => loaded.length && console.log(`Lembretes ativos para ${loaded.filter(Boolean).length} família(s)`))
        .catch((err) => console.error('Falha ao carregar famílias com notificações:', err.message))
      setup().catch((err) => console.error('Notificações indisponíveis por enquanto:', err.message))
      setInterval(tick, 60_000)
      setTimeout(tick, 5_000)
    },

    _tick: tick, // para testes
    _radar: radarPush,
  }
}

// ---------- datas ----------
function localNow(tz) {
  let parts
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
  } catch {
    return localNow(DEFAULT_TZ)
  }
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) }
}

function dayIndex(day) {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
function fmtDay(day) {
  const [y, m, d] = day.split('-').map(Number)
  return `${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d}/${m}`
}

function joinPt(list) {
  return list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`
}
