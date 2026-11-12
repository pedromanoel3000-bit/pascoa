// Casa viva: transforma os dados da família no estado do desenho da casa.
// Função pura (sem store nem navegador) para poder ser testada sozinha.

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const ROUPA = /\b(roupa|roupas|varal|lavanderia|maquina de lavar)\b/
const LIXO = /\b(lixo|reciclavel|reciclaveis|reciclagem)\b/

// Fase do céu pela hora do dia.
export function faseDoDia(hora) {
  if (hora < 5 || hora >= 19) return 'noite'
  if (hora < 7) return 'amanhecer'
  if (hora < 17) return 'dia'
  return 'entardecer'
}

// Posição do sol (de dia) ou da lua (à noite) num arco sobre a casa (o canto esquerdo fica para a saudação).
export function astro(hora, minuto = 0) {
  const h = hora + minuto / 60
  const dia = h >= 6 && h < 18
  const t = dia ? (h - 6) / 12 : ((h + 6) % 24) / 12
  return { tipo: dia ? 'sol' : 'lua', x: Math.round(140 + 190 * t), y: Math.round(78 - Math.sin(Math.PI * t) * 50) }
}

// Código do tempo da Open-Meteo → o que desenhar.
export function tipoDeTempo(codigo) {
  if (codigo == null) return null
  if (codigo >= 51) return 'chuva'
  if (codigo >= 2) return 'nuvens'
  return 'sol'
}

export function estadoDaCasa({ tarefas = [], itensCompra = 0, membros = [], pessoas = [], refeicoesHoje = 0, naoLidas = 0, hoje, hora = 12 }) {
  const abertas = tarefas.filter((t) => !t.done && t.due && t.due <= hoje)
  const ehRoupa = (t) => ROUPA.test(fold(t.title))
  const ehLixo = (t) => LIXO.test(fold(t.title))
  const roupa = abertas.filter(ehRoupa)
  const lixo = abertas.filter(ehLixo)
  const atrasadas = abertas.filter((t) => t.due < hoje && !ehRoupa(t) && !ehLixo(t))

  const inicioDoDia = new Date(`${hoje}T00:00:00`).getTime()
  const janelas = membros.slice(0, 4).map((m) => {
    const pendentes = abertas.filter((t) => t.assignee === m.id).length
    const feitasHoje = tarefas.filter((t) => t.done && t.doneBy === m.id && t.doneAt >= inicioDoDia).length
    return { id: m.id, nome: m.name, emoji: m.emoji || m.name?.[0]?.toUpperCase() || '?', cor: m.color, pendentes, feitasHoje, acesa: pendentes === 0 }
  })

  const md = hoje.slice(5)
  const aniversariantes = pessoas.filter((p) => p.birthday && p.birthday.slice(5) === md).map((p) => p.name)

  // Geladeira: 6 prateleiras cheias com a lista vazia; cada 2 itens pendentes esvaziam uma.
  const geladeira = Math.max(0, 6 - Math.ceil(itensCompra / 2))
  const emDia = abertas.length === 0 && itensCompra < 8

  const avisos = []
  if (aniversariantes.length) avisos.push({ icone: '🎂', texto: `Aniversário de ${aniversariantes.join(' e ')}`, ir: '#calendar' })
  if (roupa.length) avisos.push({ icone: '🧺', texto: roupa.some((t) => t.due < hoje) ? 'Roupa atrasada' : 'Roupa para hoje', ir: '#tasks' })
  if (lixo.length) avisos.push({ icone: '🗑️', texto: lixo.some((t) => t.due < hoje) ? 'Lixo atrasado' : 'Lixo para hoje', ir: '#tasks' })
  if (atrasadas.length) avisos.push({ icone: '📦', texto: `${atrasadas.length} tarefa${atrasadas.length > 1 ? 's' : ''} atrasada${atrasadas.length > 1 ? 's' : ''}`, ir: '#tasks' })
  const paraHoje = abertas.filter((t) => t.due === hoje && !ehRoupa(t) && !ehLixo(t)).length
  if (paraHoje) avisos.push({ icone: '☑️', texto: `${paraHoje} tarefa${paraHoje > 1 ? 's' : ''} para hoje`, ir: '#tasks' })
  if (itensCompra >= 8) avisos.push({ icone: '🛒', texto: `Geladeira vazia: ${itensCompra} itens na lista`, ir: '#lists' })
  else if (itensCompra > 0) avisos.push({ icone: '🛒', texto: `${itensCompra} ite${itensCompra > 1 ? 'ns' : 'm'} na lista`, ir: '#lists' })
  if (naoLidas) avisos.push({ icone: '✉️', texto: `${naoLidas} mensage${naoLidas > 1 ? 'ns' : 'm'} nova${naoLidas > 1 ? 's' : ''}`, ir: '#chat' })
  if (emDia) avisos.unshift({ icone: '✨', texto: 'Casa em dia', ir: '#tasks' })

  return {
    fase: faseDoDia(hora),
    janelas,
    roupa: roupa.length,
    lixo: Math.min(3, lixo.length),
    caixas: Math.min(4, atrasadas.length),
    geladeira,
    itensCompra,
    aniversario: aniversariantes.length > 0,
    fumaca: refeicoesHoje > 0,
    correio: naoLidas > 0,
    flores: atrasadas.length >= 3 ? 'murchas' : emDia ? 'cheias' : 'normais',
    emDia,
    avisos,
  }
}
