// Visual do app, escolhido por aparelho (Configurações → Aparência).
const CHAVE = 'nosso-lar-tema'
export const TEMAS = [
  { id: 'padrao', nome: 'Original', desc: 'O visual de sempre', cores: ['#f5f4fb', '#5b4bdb', '#ffffff'], barra: null },
  { id: 'claro', nome: 'Claro', desc: 'Branco, limpo e discreto', cores: ['#ffffff', '#111111', '#f3f3f1'], barra: '#ffffff' },
  { id: 'noite', nome: 'Noite', desc: 'Escuro com dourado', cores: ['#0d0d12', '#d9b872', '#191921'], barra: '#0d0d12' },
  { id: 'festa', nome: 'Festa', desc: 'Colorido e divertido', cores: ['#fff4d6', '#ff5d8f', '#7ad7c1'], barra: '#fff4d6' },
]

export function temaAtual() {
  try {
    const t = localStorage.getItem(CHAVE)
    return TEMAS.some((x) => x.id === t) ? t : 'padrao'
  } catch {
    return 'padrao'
  }
}

export function aplicarTema(id = temaAtual()) {
  const tema = TEMAS.find((t) => t.id === id) || TEMAS[0]
  if (tema.id === 'padrao') delete document.documentElement.dataset.tema
  else document.documentElement.dataset.tema = tema.id
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema.barra || '#5b4bdb')
  try {
    if (tema.id === 'padrao') localStorage.removeItem(CHAVE)
    else localStorage.setItem(CHAVE, tema.id)
  } catch {}
  return tema.id
}
