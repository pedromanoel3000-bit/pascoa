// Radar: olha os dados da família e aponta o que merece atenção, do mais urgente ao menos.
// Função pura, usada pelo app (cartão do Início) e pelo servidor (um aviso por dia).
import { addDays, daysUntil, joinPt, money, nextBirthday, occursOn, weekdayOf, WEEKDAYS_LONG } from './utils.js'

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const AR_LIVRE = /\b(churrasco|praia|parque|piquenique|picnic|trilha|passeio|corrida|correr|caminhada|pedal|bike|bicicleta|futebol|jogo|piscina|clube|camping|acampamento|pescaria|feira|quintal|zoologico|sitio|chacara|fazenda|cachoeira|show|festival)\b/
const PRESENTE = /\b(presente|presentes|lembrancinha)\b/
const MERCADO = /\b(mercado|supermercado|compras|feira|atacado|atacadao)\b/
const minutos = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number)
  return Number.isFinite(h) ? h * 60 + (m || 0) : null
}
const semana = (dia) => Math.floor(Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8)) / 604800000)
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

// "hoje", "amanhã", "sábado" ou "dia 20/11".
export function quando(dia, hoje) {
  const d = daysUntil(dia, hoje)
  if (d === 0) return 'hoje'
  if (d === 1) return 'amanhã'
  if (d > 1 && d < 7) return WEEKDAYS_LONG[weekdayOf(dia)]
  return `dia ${dia.slice(8)}/${dia.slice(5, 7)}`
}
const Maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * @param itens     todos os itens da família (não apagados)
 * @param eu        id de quem vai ler
 * @param hoje      'aaaa-mm-dd'
 * @param agoraMin  minutos desde a meia-noite (para ignorar o que já passou hoje)
 * @param previsao  { 'aaaa-mm-dd': chance de chuva em % } ou null
 * @param vistos    { idDoAviso: quando foi dispensado }
 */
export function radar({ itens = [], eu, hoje, agoraMin = 0, previsao = null, vistos = {} }) {
  const de = (tipo) => itens.filter((i) => i.type === tipo && !i.deleted)
  const membros = de('member')
  const todos = membros.map((m) => m.id)
  const nome = (id) => membros.find((m) => m.id === id)?.name || 'Alguém'
  const eventos = de('event')
  const tarefas = de('task')
  const abertas = tarefas.filter((t) => !t.done)
  const achados = []
  const add = (a) => achados.push({ ir: '#home', para: null, acoes: [], ...a })

  const quemVai = (ev) => (ev.members?.length ? ev.members.filter((m) => todos.includes(m)) : todos)
  const feito = (ev, dia) => (ev.concluidos || []).includes(ev.repeat && ev.repeat !== 'none' ? dia : ev.date)
  const doDia = (dia) => eventos.filter((e) => occursOn(e, dia) && !feito(e, dia))

  // 1. Compromissos no mesmo horário (próximos 7 dias).
  let conflitos = 0
  for (let d = 0; d <= 7 && conflitos < 2; d++) {
    const dia = addDays(hoje, d)
    const comHora = doDia(dia)
      .filter((e) => !e.allDay && minutos(e.start) != null)
      .map((e) => ({ e, ini: minutos(e.start), fim: minutos(e.end) > minutos(e.start) ? minutos(e.end) : minutos(e.start) + 60, quem: quemVai(e) }))
      .filter((x) => d > 0 || x.ini > agoraMin)
      .sort((a, b) => a.ini - b.ini)
    for (let i = 0; i < comHora.length && conflitos < 2; i++) {
      for (let j = i + 1; j < comHora.length && conflitos < 2; j++) {
        const [a, b] = [comHora[i], comHora[j]]
        if (b.ini >= a.fim) break
        if (a.e.id === b.e.id) continue
        const iguais = a.quem.filter((m) => b.quem.includes(m))
        const acoes = [{ tipo: 'ir', rotulo: 'Abrir a agenda', ir: '#calendar' }]
        if (iguais.length) {
          conflitos++
          const quem = iguais.length === 1 && iguais[0] === eu ? 'você tem' : iguais.length === todos.length && todos.length > 1 ? 'vocês têm' : `${joinPt(iguais.map(nome))} ${iguais.length > 1 ? 'têm' : 'tem'}`
          add({ id: `conflito:${dia}:${a.e.id}:${b.e.id}`, icone: '⚠️', peso: 100 - d * 3, para: iguais, titulo: 'Dois compromissos no mesmo horário', texto: `${Maiuscula(quando(dia, hoje))}, ${quem} “${a.e.title}” às ${a.e.start} e “${b.e.title}” às ${b.e.start}.`, acoes })
        } else if (todos.length > 1 && new Set([...a.quem, ...b.quem]).size === todos.length) {
          conflitos++
          add({ id: `ocupados:${dia}:${a.e.id}:${b.e.id}`, icone: '👥', peso: 72 - d * 3, titulo: 'Todo mundo ocupado ao mesmo tempo', texto: `${Maiuscula(quando(dia, hoje))}, ${joinPt(a.quem.map(nome))} tem “${a.e.title}” às ${a.e.start} e ${joinPt(b.quem.map(nome))} tem “${b.e.title}” às ${b.e.start}. Ninguém fica livre nesse horário.`, acoes })
        }
      }
    }
  }

  // 2. Chuva em programa ao ar livre.
  if (previsao) {
    for (let d = 0; d <= 6; d++) {
      const dia = addDays(hoje, d)
      const chance = previsao[dia]
      if (!(chance >= 60)) continue
      for (const e of doDia(dia).filter((e) => AR_LIVRE.test(fold(e.title)))) {
        if (d === 0 && !e.allDay && minutos(e.start) != null && minutos(e.start) < agoraMin) continue
        add({ id: `chuva:${dia}:${e.id}`, icone: '🌧️', peso: 88 - d * 3, para: quemVai(e), titulo: `Pode chover ${quando(dia, hoje)}`, texto: `${chance}% de chance de chuva e está marcado “${e.title}”${e.allDay || !e.start ? '' : ' às ' + e.start}.`, acoes: [{ tipo: 'ir', rotulo: 'Abrir a agenda', ir: '#calendar' }] })
      }
    }
  }

  // 3. Aniversário chegando sem presente planejado (não aparece para o aniversariante).
  const temPresente = (p) => {
    const primeiro = fold(p.name).split(' ')[0]
    const fala = (t) => PRESENTE.test(fold(t)) && fold(t).includes(primeiro)
    return (
      de('wish').some((w) => w.owner === p.id && w.reservedBy && !w.received) ||
      abertas.some((t) => fala(t.title)) ||
      de('listItem').some((i) => !i.done && !i.archived && fala(i.title)) ||
      eventos.some((e) => fala(e.title))
    )
  }
  for (const p of [...membros, ...de('contact')].filter((p) => p.birthday && p.id !== eu)) {
    const dia = nextBirthday(p.birthday, hoje)
    const d = daysUntil(dia, hoje)
    if (d < 1 || d > 10 || temPresente(p)) continue
    const desejos = de('wish').filter((w) => w.owner === p.id && !w.received && !w.reservedBy).length
    const limite = addDays(dia, -2) > hoje ? addDays(dia, -2) : hoje
    add({
      id: `aniversario:${p.id}:${dia.slice(0, 4)}`,
      icone: '🎁',
      peso: 82 - d * 2,
      para: todos.filter((m) => m !== p.id),
      titulo: `Aniversário de ${p.name} ${d === 1 ? 'amanhã' : `em ${d} dias`}`,
      texto: `Ainda não há presente planejado.${desejos ? ` Há ${plural(desejos, 'desejo', 'desejos')} na lista de ${p.name}.` : ''}`,
      acoes: [...(desejos ? [{ tipo: 'ir', rotulo: 'Ver desejos', ir: '#wishes' }] : []), { tipo: 'criarTarefa', rotulo: 'Criar tarefa', titulo: `Comprar presente para ${p.name}`, due: limite }],
    })
  }

  // 4. Tarefa parada há uma semana ou mais.
  const sabado = addDays(hoje, ((6 - weekdayOf(hoje) + 7) % 7) || 7)
  abertas
    .filter((t) => t.due && daysUntil(hoje, t.due) >= 7)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 3)
    .forEach((t) => {
      const dias = daysUntil(hoje, t.due)
      const sem = Math.floor(dias / 7)
      add({
        id: `atrasada:${t.id}:${sem}`,
        icone: '🕰️',
        peso: 60 + Math.min(sem, 6) * 2,
        para: t.assignee ? [t.assignee] : null,
        titulo: `Atrasada há ${plural(sem, 'semana', 'semanas')}`,
        texto: `“${t.title}” era para ${t.due.slice(8)}/${t.due.slice(5, 7)}${t.assignee && t.assignee !== eu ? ` (${nome(t.assignee)})` : ''}. Quer marcar uma nova data?`,
        acoes: [
          { tipo: 'reagendar', rotulo: 'Fica para hoje', id: t.id, due: hoje },
          { tipo: 'reagendar', rotulo: 'Fica para sábado', id: t.id, due: sabado },
          { tipo: 'ir', rotulo: 'Abrir', ir: '#tasks' },
        ],
      })
    })

  // 5. Amanhã cheio para quem está lendo.
  const amanha = addDays(hoje, 1)
  const meus = doDia(amanha).filter((e) => quemVai(e).includes(eu))
  if (meus.length >= 4) {
    const primeiro = meus.filter((e) => !e.allDay && e.start).sort((a, b) => a.start.localeCompare(b.start))[0]
    add({ id: `cheio:${amanha}:${eu}`, icone: '🗓️', peso: 55, para: [eu], titulo: 'Amanhã está cheio', texto: `${meus.length} compromissos${primeiro ? `, o primeiro às ${primeiro.start} (“${primeiro.title}”)` : ''}.`, acoes: [{ tipo: 'ir', rotulo: 'Abrir a agenda', ir: '#calendar' }] })
  }

  // 6. Lista de compras grande e parada, sem ida ao mercado marcada.
  const listas = de('list').sort((a, b) => a.createdAt - b.createdAt)
  const compras = listas.find((l) => /compra/i.test(l.title)) || listas[0]
  if (compras) {
    const pend = de('listItem').filter((i) => i.listId === compras.id && !i.done && !i.archived)
    const maisAntigo = Math.min(...pend.map((i) => i.createdAt || Infinity))
    const dias = Math.floor((new Date(`${hoje}T12:00:00`).getTime() - maisAntigo) / 86400000)
    const marcado = abertas.some((t) => MERCADO.test(fold(t.title)) && (!t.due || daysUntil(t.due, hoje) <= 3)) || [0, 1, 2, 3].some((d) => doDia(addDays(hoje, d)).some((e) => MERCADO.test(fold(e.title))))
    if (pend.length >= 10 && dias >= 5 && !marcado) {
      add({ id: `compras:${semana(hoje)}`, icone: '🛒', peso: 45, titulo: 'A lista de compras está acumulando', texto: `São ${pend.length} itens e o mais antigo espera há ${dias} dias.`, acoes: [{ tipo: 'criarTarefa', rotulo: 'Marcar mercado', titulo: 'Ir ao mercado', due: sabado }, { tipo: 'ir', rotulo: 'Ver a lista', ir: '#lists' }] })
    }
  }

  // 7. Jantar de amanhã sem plano (só para quem costuma planejar as refeições).
  const refeicoes = de('meal')
  const usa = refeicoes.filter((m) => m.date >= addDays(hoje, -14) && m.date <= hoje).length >= 4
  if (usa && !refeicoes.some((m) => m.date === amanha && m.slot === 'Jantar')) {
    add({ id: `jantar:${amanha}`, icone: '🍽️', peso: 30, titulo: 'Jantar de amanhã sem plano', texto: 'Vocês costumam planejar as refeições, mas o jantar de amanhã está em branco.', acoes: [{ tipo: 'ir', rotulo: 'Planejar', ir: '#meals' }] })
  }

  // 8. Categoria de gasto bem acima do mesmo período do mês passado.
  const diaDoMes = Number(hoje.slice(8))
  if (diaDoMes >= 8) {
    const mes = hoje.slice(0, 7)
    const d0 = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5)) - 2, 1)
    const mesAnt = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}`
    const soma = {}
    for (const g of de('expense').filter((g) => g.kind !== 'in' && g.date && g.category)) {
      const m = g.date.slice(0, 7)
      if (Number(g.date.slice(8)) > diaDoMes || (m !== mes && m !== mesAnt)) continue
      soma[g.category] = soma[g.category] || { agora: 0, antes: 0 }
      soma[g.category][m === mes ? 'agora' : 'antes'] += Number(g.amount) || 0
    }
    const pior = Object.entries(soma)
      .filter(([, v]) => v.agora >= 100 && v.antes >= 50 && v.agora >= v.antes * 1.4)
      .sort((a, b) => b[1].agora - b[1].antes - (a[1].agora - a[1].antes))[0]
    if (pior) {
      const [cat, v] = pior
      add({ id: `gasto:${cat}:${mes}`, icone: '💸', peso: 40, titulo: `${cat} acima do mês passado`, texto: `${money(v.agora)} até hoje, ${Math.round((v.agora / v.antes - 1) * 100)}% a mais que no mesmo período do mês passado (${money(v.antes)}).`, acoes: [{ tipo: 'ir', rotulo: 'Ver o orçamento', ir: '#budget' }] })
    }
  }

  // 9. Tarefas concentradas em uma pessoa nas últimas duas semanas.
  if (todos.length > 1) {
    const desde = new Date(`${addDays(hoje, -14)}T00:00:00`).getTime()
    const feitas = tarefas.filter((t) => t.done && t.doneAt >= desde && todos.includes(t.doneBy))
    const por = {}
    for (const t of feitas) por[t.doneBy] = (por[t.doneBy] || 0) + 1
    const [quem, n] = Object.entries(por).sort((a, b) => b[1] - a[1])[0] || []
    if (feitas.length >= 8 && n / feitas.length >= 0.75) {
      add({ id: `divisao:${semana(hoje)}`, icone: '⚖️', peso: 25, titulo: 'Tarefas concentradas', texto: `Nas últimas duas semanas, ${nome(quem)} concluiu ${n} das ${feitas.length} tarefas da casa. Vale rever a divisão?`, acoes: [{ tipo: 'ir', rotulo: 'Ver tarefas', ir: '#tasks' }] })
    }
  }

  return achados.filter((a) => (!a.para || a.para.includes(eu)) && !vistos[a.id]).sort((a, b) => b.peso - a.peso)
}
