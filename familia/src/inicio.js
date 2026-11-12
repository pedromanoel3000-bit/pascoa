// Personalização do Início: quais atalhos aparecem e quais blocos, em que ordem. Uma escolha por pessoa.

// id → [destino, ícone, nome, cor, grupo]
export const ATALHOS = {
  evento: ['#calendar/new', 'calendar', 'Evento', '#3e63dd', 'Criar'],
  tarefa: ['#tasks/new', 'tasks', 'Tarefa', '#46a758', 'Criar'],
  compras: ['#lists/new', 'list', 'Compras', '#12a594', 'Criar'],
  gasto: ['#budget/new', 'budget', 'Gasto', '#18794e', 'Criar'],
  nota: ['#notes/new', 'notes', 'Nota', '#ad7f00', 'Criar'],
  magia: ['magia', 'spark', 'Mágica', '#8e4ec6', 'Criar'],
  mensagem: ['#chat', 'chat', 'Mensagem', '#0090ff', 'Abrir'],
  agenda: ['#calendar', 'calendar', 'Agenda', '#3e63dd', 'Abrir'],
  listas: ['#lists', 'list', 'Listas', '#12a594', 'Abrir'],
  tarefas: ['#tasks', 'tasks', 'Tarefas', '#46a758', 'Abrir'],
  mural: ['#mural', 'pin', 'Mural', '#d6409f', 'Abrir'],
  treino: ['#treino', 'dumbbell', 'Treino', '#e54d2e', 'Abrir'],
  refeicoes: ['#meals', 'meals', 'Refeições', '#f76b15', 'Abrir'],
  fotos: ['#photos', 'photos', 'Fotos', '#d6409f', 'Abrir'],
  radar: ['#radar', 'spark', 'Radar', '#8e4ec6', 'Abrir'],
  desejos: ['#wishes', 'gift', 'Desejos', '#e5484d', 'Abrir'],
  contatos: ['#contacts', 'contacts', 'Contatos', '#8e4ec6', 'Abrir'],
  orcamento: ['#budget', 'budget', 'Orçamento', '#18794e', 'Abrir'],
  localizacao: ['#locator', 'locator', 'Localização', '#e5484d', 'Abrir'],
  notas: ['#notes', 'notes', 'Notas', '#ad7f00', 'Abrir'],
  familia: ['#settings', 'settings', 'Família', '#6e6c80', 'Abrir'],
  avisos: ['#notifications', 'bell', 'Notificações', '#f76b15', 'Abrir'],
}
export const ATALHOS_PADRAO = ['evento', 'tarefa', 'compras', 'mensagem', 'gasto']
export const MAX_ATALHOS = 10

// id → [nome, o que é]
export const SECOES = {
  casa: ['Casa viva', 'O desenho da casa com a saudação'],
  radar: ['Radar', 'O que merece atenção'],
  semana: ['Semana', 'Os próximos 7 dias'],
  magia: ['Barra mágica', 'Escrever ou falar para criar'],
  contagens: ['Contagens regressivas', 'Eventos marcados para contar os dias'],
  atalhos: ['Atalhos rápidos', 'Os botões que você escolher'],
  hoje: ['Hoje', 'Agenda e refeições do dia'],
  compras: ['Compras', 'A lista, com campo para adicionar'],
  tarefas: ['Minhas tarefas', 'O que está com você'],
  mural: ['Mural da família', 'Os recados mais recentes, resumidos'],
}
export const SECOES_PADRAO = Object.keys(SECOES)
export const EM_GRADE = ['hoje', 'compras', 'tarefas'] // lado a lado em telas largas

// Lê o que foi guardado, descartando o que não existe mais e incluindo blocos novos no fim.
export function lerInicio(item) {
  const atalhos = Array.isArray(item?.atalhos) ? [...new Set(item.atalhos)].filter((a) => ATALHOS[a]).slice(0, MAX_ATALHOS) : ATALHOS_PADRAO
  const guardadas = Array.isArray(item?.secoes) ? [...new Set(item.secoes)].filter((s) => SECOES[s]) : []
  const secoes = [...guardadas, ...SECOES_PADRAO.filter((s) => !guardadas.includes(s))]
  const ocultas = Array.isArray(item?.ocultas) ? item.ocultas.filter((s) => SECOES[s]) : []
  return { atalhos, secoes, ocultas }
}

export const mover = (lista, i, passo) => {
  const j = i + passo
  if (j < 0 || j >= lista.length) return lista
  const nova = [...lista]
  ;[nova[i], nova[j]] = [nova[j], nova[i]]
  return nova
}
