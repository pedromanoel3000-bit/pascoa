// Radar: olha os dados da família e aponta o que merece atenção, do mais urgente ao menos.
// Função pura, usada pelo app (cartão do Início) e pelo servidor (um aviso por dia).
import { addDays, daysUntil, joinPt, money, nextBirthday, occursOn, weekdayOf, WEEKDAYS_LONG } from './utils.js'

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const AR_LIVRE = /\b(churrasco|praia|parque|piquenique|picnic|trilha|passeio|corrida|correr|caminhada|pedal|bike|bicicleta|futebol|jogo|piscina|clube|camping|acampamento|pescaria|feira|quintal|zoologico|sitio|chacara|fazenda|cachoeira|show|festival)\b/
const PRESENTE = /\b(presente|presentes|lembrancinha)\b/
const CONTA = /\b(pagar|pagamento|boleto|fatura|conta|contas|vencimento|aluguel|parcela|prestacao|iptu|ipva|condominio|mensalidade)\b/
const MERCADO = /\b(mercado|supermercado|compras|feira|atacado|atacadao)\b/
// Tipos de aviso que a pessoa pode ligar e desligar (tela Radar).
export const TIPOS = [
  ['agenda', '⚠️', 'Agenda', 'Compromissos no mesmo horário, amanhã cheio ou cedo, resumo da semana no domingo'],
  ['chuva', '🌧️', 'Chuva', 'Chuva prevista em programa ao ar livre'],
  ['aniversario', '🎁', 'Aniversários e presentes', 'Aniversário chegando sem presente, ou presente reservado para comprar'],
  ['tarefas', '🕰️', 'Tarefas', 'Atrasadas há uma semana ou mais, sem responsável, concentradas em uma pessoa'],
  ['contas', '🧾', 'Contas', 'Tarefa de pagamento que vence hoje ou amanhã'],
  ['compras', '🛒', 'Compras', 'Lista acumulando e itens que devem estar acabando'],
  ['refeicoes', '🍽️', 'Refeições', 'Jantar de amanhã sem plano'],
  ['dinheiro', '💸', 'Dinheiro', 'Categoria acima do mês passado e mês no vermelho'],
  ['voto', '📊', 'Votações', 'Votação esperando o seu voto'],
  ['treino', '🏋️', 'Treino', 'Vários dias sem treinar (só você vê)'],
  ['emdia', '🎉', 'Boas notícias', 'Quando a casa está em dia'],
]
const GRUPO = { conflito: 'agenda', ocupados: 'agenda', cheio: 'agenda', cedo: 'agenda', semana: 'agenda', reservado: 'aniversario', atrasada: 'tarefas', semdono: 'tarefas', divisao: 'tarefas', conta: 'contas', ritmo: 'compras', jantar: 'refeicoes', gasto: 'dinheiro', saldo: 'dinheiro' }
export const grupoDe = (tipo) => GRUPO[tipo] || tipo

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
 * @param adiados   { idDoAviso: até quando fica escondido (ms) }
 * @param desligados  tipos de aviso que a pessoa não quer (ver TIPOS)
 * @param agora     ms, para comparar com os adiados
 */
export function radar({ itens = [], eu, hoje, agoraMin = 0, previsao = null, vistos = {}, adiados = {}, desligados = [], agora = Date.now() }) {
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
      texto: `Ainda não há presente planejado.${desejos ? (p.type === 'contact' ? ` Vocês anotaram ${plural(desejos, 'ideia', 'ideias')} para ${p.name}.` : ` Há ${plural(desejos, 'desejo', 'desejos')} na lista de ${p.name}.`) : ''}`,
      acoes: [{ tipo: 'ir', rotulo: desejos ? (p.type === 'contact' ? 'Ver ideias' : 'Ver desejos') : p.type === 'contact' ? 'Anotar presente' : 'Ver a lista', ir: '#wishes/' + p.id }, { tipo: 'criarTarefa', rotulo: 'Criar tarefa', titulo: `Comprar presente para ${p.name}`, due: limite }],
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

  // 10. Votação aberta esperando o voto de quem está lendo.
  const votos = de('vote').filter((v) => v.option)
  const quinzena = new Date(`${addDays(hoje, -14)}T00:00:00`).getTime()
  for (const p of de('post').filter((p) => p.poll && !p.closed && (p.createdAt || 0) >= quinzena)) {
    const doPost = votos.filter((v) => v.postId === p.id)
    if (doPost.some((v) => v.createdBy === eu)) continue
    add({ id: `voto:${p.id}`, icone: '📊', peso: 65, para: [eu], titulo: 'Votação esperando seu voto', texto: `“${p.text || 'Votação'}”${doPost.length ? ` — ${plural(doPost.length, 'pessoa já votou', 'pessoas já votaram')}.` : '.'}`, acoes: [{ tipo: 'ir', rotulo: 'Votar', ir: '#mural' }] })
  }

  // 11. Conta com vencimento hoje ou amanhã.
  for (const t of abertas.filter((t) => (t.due === hoje || t.due === amanha) && CONTA.test(fold(t.title)) && (!t.assignee || t.assignee === eu))) {
    const eHoje = t.due === hoje
    add({ id: `conta:${t.id}:${t.due}`, icone: '🧾', peso: eHoje ? 98 : 80, para: t.assignee ? [t.assignee] : null, titulo: eHoje ? 'Vence hoje' : 'Vence amanhã', texto: `“${t.title}” está marcada para ${eHoje ? 'hoje' : 'amanhã'}.`, acoes: [{ tipo: 'concluir', rotulo: 'Já paguei', id: t.id }, { tipo: 'ir', rotulo: 'Abrir', ir: '#tasks' }] })
  }

  // 12. Presente que quem está lendo reservou e o aniversário está chegando.
  for (const w of de('wish').filter((w) => w.reservedBy === eu && !w.received && w.owner !== eu)) {
    const dono = [...membros, ...de('contact')].find((m) => m.id === w.owner)
    if (!dono?.birthday) continue
    const dia = nextBirthday(dono.birthday, hoje)
    const d = daysUntil(dia, hoje)
    if (d < 0 || d > 5) continue
    add({ id: `reservado:${w.id}:${dia.slice(0, 4)}`, icone: '🎀', peso: 76 - d, para: [eu], titulo: `Presente de ${dono.name}: já comprou?`, texto: `Você reservou “${w.title}” e o aniversário é ${d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`}.`, acoes: [{ tipo: 'ir', rotulo: 'Ver desejos', ir: '#wishes/' + w.owner }] })
  }

  // 13. Ritmo de compra: itens que costumam voltar para a lista e já passaram do prazo de costume.
  if (compras) {
    const doMeio = new Date(`${hoje}T12:00:00`).getTime()
    const grupos = {}
    for (const i of de('listItem').filter((i) => i.listId === compras.id && i.createdAt)) (grupos[fold(i.title).trim()] = grupos[fold(i.title).trim()] || []).push(i)
    const acabando = []
    for (const g of Object.values(grupos)) {
      if (g.length < 3 || g.some((i) => !i.done && !i.archived)) continue
      g.sort((x, y) => x.createdAt - y.createdAt)
      const saltos = g.slice(1).map((i, k) => (i.createdAt - g[k].createdAt) / 86400000).filter((x) => x >= 1).sort((x, y) => x - y)
      if (saltos.length < 2) continue
      const costume = saltos[Math.floor(saltos.length / 2)]
      const faz = (doMeio - g[g.length - 1].createdAt) / 86400000
      if (costume >= 2 && faz >= costume * 1.25 && faz <= costume * 4) acabando.push({ titulo: g[g.length - 1].title, costume: Math.round(costume), faz: Math.round(faz), atraso: faz / costume })
    }
    acabando.sort((x, y) => y.atraso - x.atraso)
    if (acabando.length) {
      const top = acabando.slice(0, 4)
      const um = top.length === 1
      add({
        id: `ritmo:${semana(hoje)}:${top.map((x) => fold(x.titulo)).join('+')}`,
        icone: '🔮',
        peso: 44,
        titulo: 'Deve estar acabando',
        texto: um ? `${Maiuscula(top[0].titulo)} costuma entrar na lista a cada ${top[0].costume} dias e já faz ${top[0].faz}.` : `${Maiuscula(joinPt(top.map((x) => x.titulo)))} costumam voltar para a lista e já passaram do prazo de costume.`,
        acoes: [{ tipo: 'adicionarCompras', rotulo: um ? 'Pôr na lista' : `Pôr os ${top.length} na lista`, listId: compras.id, titulos: top.map((x) => x.titulo) }, { tipo: 'ir', rotulo: 'Ver a lista', ir: '#lists' }],
      })
    }
  }

  // 14. Mês no vermelho (só se a família registra as entradas).
  if (diaDoMes >= 10) {
    const mes = hoje.slice(0, 7)
    const doMes = de('expense').filter((g) => g.date?.slice(0, 7) === mes)
    const entrou = doMes.filter((g) => g.kind === 'in').reduce((t, g) => t + (Number(g.amount) || 0), 0)
    const saiu = doMes.filter((g) => g.kind !== 'in').reduce((t, g) => t + (Number(g.amount) || 0), 0)
    if (entrou > 0 && saiu > entrou) add({ id: `saldo:${mes}`, icone: '📉', peso: 39, titulo: 'O mês está no vermelho', texto: `Saíram ${money(saiu)} e entraram ${money(entrou)} até agora: ${money(saiu - entrou)} a mais do que entrou.`, acoes: [{ tipo: 'ir', rotulo: 'Ver o orçamento', ir: '#budget' }] })
  }

  // 15. Muitas tarefas sem responsável.
  const semDono = abertas.filter((t) => !t.assignee)
  if (todos.length > 1 && semDono.length >= 5) add({ id: `semdono:${semana(hoje)}`, icone: '🙋', peso: 28, titulo: `${semDono.length} tarefas sem responsável`, texto: `Tarefa sem dono costuma ficar para depois. Exemplos: ${joinPt(semDono.slice(0, 2).map((t) => `“${t.title}”`))}.`, acoes: [{ tipo: 'ir', rotulo: 'Dividir tarefas', ir: '#tasks' }] })

  // 16. Treino: quem vinha treinando e parou (só a própria pessoa vê).
  const sessoes = de('treinoSessao').filter((x) => x.memberId === eu && x.data && x.data <= hoje).sort((a, b) => b.data.localeCompare(a.data))
  if (sessoes.length) {
    const ultima = sessoes[0]
    const parado = daysUntil(hoje, ultima.data)
    const ritmo = sessoes.filter((x) => daysUntil(ultima.data, x.data) <= 21).length
    if (parado >= 5 && parado <= 30 && ritmo >= 3) add({ id: `treino:${eu}:${ultima.data}:${Math.floor(parado / 5)}`, icone: '🏋️', peso: 50, para: [eu], titulo: `${parado} dias sem treinar`, texto: `O último foi em ${ultima.data.slice(8)}/${ultima.data.slice(5, 7)}${ultima.treino ? ` (treino ${ultima.treino})` : ''}. Você vinha num bom ritmo.`, acoes: [{ tipo: 'ir', rotulo: 'Abrir o treino', ir: '#treino' }] })
  }

  // 17. Amanhã começa cedo.
  const cedo = doDia(amanha).filter((e) => !e.allDay && minutos(e.start) != null && minutos(e.start) <= 450 && quemVai(e).includes(eu)).sort((a, b) => a.start.localeCompare(b.start))[0]
  if (cedo) add({ id: `cedo:${amanha}:${cedo.id}`, icone: '⏰', peso: 52, para: [eu], titulo: 'Amanhã começa cedo', texto: `“${cedo.title}” às ${cedo.start}${cedo.place ? `, em ${cedo.place}` : ''}.`, acoes: [{ tipo: 'ir', rotulo: 'Abrir a agenda', ir: '#calendar' }] })

  // 18. Domingo: resumo da semana que vem.
  if (weekdayOf(hoje) === 0) {
    const porDia = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dia: addDays(hoje, d), n: doDia(addDays(hoje, d)).filter((e) => quemVai(e).includes(eu)).length }))
    const comp = porDia.reduce((t, x) => t + x.n, 0)
    const tar = abertas.filter((t) => t.due && t.due > hoje && t.due <= addDays(hoje, 7) && (!t.assignee || t.assignee === eu)).length
    const pico = [...porDia].sort((a, b) => b.n - a.n)[0]
    if (comp + tar > 0) add({ id: `semana:${semana(hoje)}:${eu}`, icone: '🧭', peso: 36, para: [eu], titulo: 'Sua semana', texto: `${plural(comp, 'compromisso', 'compromissos')} e ${plural(tar, 'tarefa', 'tarefas')} nos próximos 7 dias.${pico.n >= 2 ? ` O dia mais cheio é ${WEEKDAYS_LONG[weekdayOf(pico.dia)]}, com ${pico.n}.` : ''}`, acoes: [{ tipo: 'ir', rotulo: 'Abrir a agenda', ir: '#calendar' }] })
  }

  // 19. Boa notícia: nada atrasado e uma semana produtiva.
  const seteDias = new Date(`${addDays(hoje, -7)}T00:00:00`).getTime()
  const feitas7 = tarefas.filter((t) => t.done && t.doneAt >= seteDias).length
  if (feitas7 >= 5 && !abertas.some((t) => t.due && t.due < hoje) && !achados.some((a) => a.id.startsWith('divisao:'))) add({ id: `emdia:${semana(hoje)}`, icone: '🎉', peso: 12, bom: true, titulo: 'Casa em dia', texto: `${feitas7} tarefas concluídas nos últimos 7 dias e nada atrasado. Bom trabalho${todos.length > 1 ? ' de equipe' : ''}!`, acoes: [] })

  return achados
    .map((a) => ({ ...a, tipo: a.id.split(':')[0] }))
    .filter((a) => (!a.para || a.para.includes(eu)) && !vistos[a.id] && !(adiados[a.id] > agora) && !desligados.includes(GRUPO[a.tipo] || a.tipo))
    .sort((a, b) => b.peso - a.peso)
}
