// Receitas: ver (com porções ajustáveis), editar, importar e o modo cozinha.
import { useEffect, useRef, useState } from 'react'
import { list, remove, save, update, useStore } from '../store.js'
import { addDays, today } from '../utils.js'
import { Field, Modal } from '../ui.jsx'
import { toast, vibrate } from '../toast.jsx'
import { CATEGORIAS, duracao, escalar, juntarIngredientes, lerIngrediente, linhas, receitaDeTexto, REFEICOES, relogio, splitIng, tempoDoPasso, usoDasReceitas } from '../refeicoes.js'

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const dm = (d) => `${d.slice(8)}/${d.slice(5, 7)}`

// Manda itens para a lista de compras sem repetir o que já está pendente nela (compara pelo nome, sem a quantidade).
export function paraCompras(st, titulos) {
  const listas = list(st, 'list').sort((a, b) => a.createdAt - b.createdAt)
  let compras = listas.find((l) => /compra/i.test(l.title)) || listas[0]
  if (!compras) compras = save('list', { title: 'Compras', icon: '🛒' })
  const nomeDe = (t) => fold(lerIngrediente(t.replace(/\s*\(.*\)\s*$/, '')).nome)
  const ja = new Set(list(st, 'listItem').filter((i) => i.listId === compras.id && !i.done && !i.archived).map((i) => nomeDe(i.title)))
  const novos = []
  for (const t of titulos) {
    if (ja.has(nomeDe(t))) continue
    ja.add(nomeDe(t))
    novos.push(save('listItem', { listId: compras.id, title: t, done: false }))
  }
  return novos
}
export const jaNaLista = (st) => {
  const listas = list(st, 'list').sort((a, b) => a.createdAt - b.createdAt)
  const compras = listas.find((l) => /compra/i.test(l.title)) || listas[0]
  const nomes = new Set(compras ? list(st, 'listItem').filter((i) => i.listId === compras.id && !i.done && !i.archived).map((i) => fold(lerIngrediente(i.title.replace(/\s*\(.*\)\s*$/, '')).nome)) : [])
  return (nome) => nomes.has(fold(nome))
}

export const metaDaReceita = (r) => [r.tempo ? '⏱ ' + duracao(Number(r.tempo)) : null, r.porcoes ? `🍽 ${r.porcoes}` : null].filter(Boolean).join(' · ')

// ---------- ver uma receita ----------
export function VerReceita({ receita: inicial, onClose, onEditar, onPlanejar }) {
  const st = useStore()
  const r = st.items[inicial.id] && !st.items[inicial.id].deleted ? st.items[inicial.id] : inicial
  const base = Number(r.porcoes) || 0
  const [porcoes, setPorcoes] = useState(base || 1)
  const fator = base ? porcoes / base : porcoes
  const ings = splitIng(r.ingredients)
  const passos = linhas(r.steps)
  const [marcados, setMarcados] = useState(() => new Set(ings.map((_, i) => i)))
  const [cozinhando, setCozinhando] = useState(false)
  const [planejar, setPlanejar] = useState(null)
  const uso = usoDasReceitas(list(st, 'meal'), today())[r.id]
  const naLista = jaNaLista(st)

  const alternar = (i) => {
    const n = new Set(marcados)
    n.has(i) ? n.delete(i) : n.add(i)
    setMarcados(n)
  }
  const enviar = () => {
    const titulos = juntarIngredientes([{ ingredientes: ings.filter((_, i) => marcados.has(i)), fator }]).map((x) => x.titulo)
    const novos = paraCompras(st, titulos)
    vibrate()
    toast(novos.length ? `🛒 ${novos.length} ${novos.length === 1 ? 'item foi' : 'itens foram'} para as compras` : 'Tudo já estava na lista', novos.length ? { label: 'Desfazer', run: () => novos.forEach((n) => remove(n.id)) } : undefined)
  }

  if (cozinhando) return <ModoCozinha receita={r} fator={fator} porcoes={porcoes} onClose={() => setCozinhando(false)} />

  return (
    <Modal title={r.title} onClose={onClose}>
      <div className="rec">
        <div className="rec-meta">
          {r.categoria && <span className="chip">{r.categoria}</span>}
          {r.tempo ? <span className="chip">⏱ {duracao(Number(r.tempo))}</span> : null}
          {r.rapida && <span className="chip">⚡ Rápida</span>}
          <button type="button" className={'chip' + (r.favorita ? ' on' : '')} style={{ '--c': '#ffb224' }} onClick={() => update(r.id, { favorita: !r.favorita })} aria-pressed={!!r.favorita}>
            {r.favorita ? '⭐ Favorita' : '☆ Favoritar'}
          </button>
        </div>
        {uso && (
          <p className="muted small">
            Já esteve no cardápio {uso.vezes} {uso.vezes === 1 ? 'vez' : 'vezes'}; a última em {dm(uso.ultima)}.
          </p>
        )}
        {r.notes && <p className="rec-nota">{r.notes}</p>}

        {ings.length > 0 && (
          <>
            <div className="rec-titulo">
              <h3>Ingredientes</h3>
              <div className="rec-porcoes" aria-label="Porções">
                <button type="button" className="icon-btn" onClick={() => setPorcoes(Math.max(1, porcoes - 1))} aria-label="Menos porções">
                  −
                </button>
                <b>
                  {porcoes} {base ? (porcoes === 1 ? 'porção' : 'porções') : '×'}
                </b>
                <button type="button" className="icon-btn" onClick={() => setPorcoes(porcoes + 1)} aria-label="Mais porções">
                  +
                </button>
              </div>
            </div>
            {!base && <p className="muted small">Sem número de porções cadastrado: o + dobra, triplica… a receita inteira.</p>}
            <ul className="rec-ings">
              {ings.map((t, i) => (
                <li key={i}>
                  <label>
                    <input type="checkbox" checked={marcados.has(i)} onChange={() => alternar(i)} />
                    <span className="grow">{escalar(t, fator)}</span>
                    {naLista(lerIngrediente(t).nome) && <small className="muted">na lista</small>}
                  </label>
                </li>
              ))}
            </ul>
            <button type="button" className="btn" disabled={!marcados.size} onClick={enviar}>
              🛒 Pôr {marcados.size === ings.length ? 'tudo' : marcados.size} na lista de compras
            </button>
          </>
        )}

        {passos.length > 0 && (
          <>
            <div className="rec-titulo">
              <h3>Modo de preparo</h3>
            </div>
            <ol className="rec-passos">
              {passos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </>
        )}
        {r.link && (
          <a className="muted small rec-fonte" href={r.link} target="_blank" rel="noreferrer">
            Fonte: {r.link.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]} ↗
          </a>
        )}

        {planejar && (
          <div className="rec-planejar">
            <input type="date" value={planejar.date} min={today()} onChange={(e) => setPlanejar({ ...planejar, date: e.target.value })} aria-label="Dia" />
            <select value={planejar.slot} onChange={(e) => setPlanejar({ ...planejar, slot: e.target.value })} aria-label="Refeição">
              {REFEICOES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                onPlanejar(r, planejar.date, planejar.slot, porcoes)
                setPlanejar(null)
              }}
            >
              Pôr no cardápio
            </button>
          </div>
        )}
        <div className="row rec-acoes">
          {passos.length > 0 && (
            <button type="button" className="btn primary" onClick={() => setCozinhando(true)}>
              👩‍🍳 Modo cozinha
            </button>
          )}
          {!planejar && (
            <button type="button" className="btn" onClick={() => setPlanejar({ date: addDays(today(), 1), slot: 'Jantar' })}>
              📅 Planejar
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn ghost" onClick={onEditar}>
            Editar
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ---------- modo cozinha: um passo por vez, tela acesa, cronômetros ----------
function bip() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.setValueAtTime(0.25, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.26)
    })
  } catch {}
}

function ModoCozinha({ receita, fator, porcoes, onClose }) {
  const passos = linhas(receita.steps)
  const ings = splitIng(receita.ingredients)
  const [i, setI] = useState(0)
  const [verIng, setVerIng] = useState(false)
  const [relogios, setRelogios] = useState([]) // { id, nome, fim, acabou }
  const [, setTic] = useState(0)
  const trava = useRef(null)

  // Mantém a tela acesa enquanto cozinha (onde o navegador permite).
  useEffect(() => {
    const pedir = () => navigator.wakeLock?.request('screen').then((t) => (trava.current = t)).catch(() => {})
    pedir()
    const voltar = () => document.visibilityState === 'visible' && pedir()
    document.addEventListener('visibilitychange', voltar)
    return () => {
      document.removeEventListener('visibilitychange', voltar)
      trava.current?.release?.().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!relogios.some((r) => !r.acabou)) return
    const t = setInterval(() => {
      setTic((n) => n + 1)
      setRelogios((rs) =>
        rs.map((r) => {
          if (r.acabou || Date.now() < r.fim) return r
          bip()
          vibrate([300, 150, 300, 150, 300])
          toast(`⏰ Tempo! ${r.nome}`)
          return { ...r, acabou: true }
        })
      )
    }, 500)
    return () => clearInterval(t)
  }, [relogios])

  const seg = tempoDoPasso(passos[i])
  const iniciar = () => {
    vibrate()
    setRelogios((rs) => [...rs.filter((r) => r.id !== i), { id: i, nome: `Passo ${i + 1}`, fim: Date.now() + seg * 1000, acabou: false }])
  }
  const ultimo = i === passos.length - 1

  return (
    <div className="cozinha" role="dialog" aria-label={`Modo cozinha: ${receita.title}`}>
      <div className="cozinha-topo">
        <div className="grow">
          <b>{receita.title}</b>
          <small>
            Passo {i + 1} de {passos.length}
            {porcoes ? ` · ${porcoes} ${Number(receita.porcoes) ? (porcoes === 1 ? 'porção' : 'porções') : '×'}` : ''}
          </small>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Sair do modo cozinha">
          ×
        </button>
      </div>
      <div className="cozinha-barra">
        <i style={{ width: `${((i + 1) / passos.length) * 100}%` }} />
      </div>
      {relogios.length > 0 && (
        <div className="cozinha-relogios">
          {relogios.map((r) => (
            <button type="button" key={r.id} className={'cozinha-relogio' + (r.acabou ? ' fim' : '')} onClick={() => setRelogios((rs) => rs.filter((x) => x.id !== r.id))} aria-label={`${r.nome}: ${r.acabou ? 'tempo esgotado' : relogio((r.fim - Date.now()) / 1000)}. Toque para tirar`}>
              ⏱ {r.nome} · <b>{r.acabou ? 'pronto!' : relogio((r.fim - Date.now()) / 1000)}</b> ×
            </button>
          ))}
        </div>
      )}
      <div className="cozinha-passo">
        {verIng ? (
          <ul className="cozinha-ings">
            {ings.map((t, k) => (
              <li key={k}>{escalar(t, fator)}</li>
            ))}
          </ul>
        ) : (
          <>
            <p>{passos[i]}</p>
            {seg && (
              <button type="button" className="btn cozinha-timer" onClick={iniciar}>
                ⏱ Iniciar {relogio(seg)}
              </button>
            )}
          </>
        )}
      </div>
      <div className="cozinha-base">
        <button type="button" className="btn ghost" disabled={i === 0 || verIng} onClick={() => setI(i - 1)}>
          ‹ Anterior
        </button>
        {ings.length > 0 && (
          <button type="button" className={'btn ghost' + (verIng ? ' on' : '')} onClick={() => setVerIng(!verIng)}>
            {verIng ? 'Voltar ao passo' : 'Ingredientes'}
          </button>
        )}
        <button type="button" className="btn primary" disabled={verIng} onClick={() => (ultimo ? (toast('Bom apetite! 🍽️'), onClose()) : setI(i + 1))}>
          {ultimo ? 'Concluir ✓' : 'Próximo ›'}
        </button>
      </div>
    </div>
  )
}

// ---------- criar e editar ----------
export function FormReceita({ initial, onClose }) {
  const [r, setR] = useState({ title: '', categoria: 'Prato principal', porcoes: '', tempo: '', ingredients: '', steps: '', link: '', notes: '', rapida: false, favorita: false, ...initial })
  const set = (k) => (e) => setR({ ...r, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  return (
    <Modal title={r.id ? 'Editar receita' : 'Nova receita'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          const tempo = parseInt(r.tempo) || ''
          save('recipe', { ...r, title: r.title.trim(), porcoes: parseInt(r.porcoes) || '', tempo, rapida: r.rapida || (tempo && tempo <= 30) || false })
          onClose()
        }}
      >
        <Field label="Nome">
          <input value={r.title} onChange={set('title')} required autoFocus={!r.title} placeholder="Estrogonofe de frango" />
        </Field>
        <div className="row2">
          <Field label="Tipo">
            <select value={r.categoria || 'Prato principal'} onChange={set('categoria')}>
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Rende (porções)">
            <input inputMode="numeric" value={r.porcoes ?? ''} onChange={set('porcoes')} placeholder="4" />
          </Field>
        </div>
        <div className="row2">
          <Field label="Tempo (minutos)">
            <input inputMode="numeric" value={r.tempo ?? ''} onChange={set('tempo')} placeholder="40" />
          </Field>
          <label className="check rec-check">
            <input type="checkbox" checked={!!r.favorita} onChange={set('favorita')} /> ⭐ Favorita
          </label>
        </div>
        <Field label="Ingredientes (um por linha, com a quantidade na frente)">
          <textarea value={r.ingredients} onChange={set('ingredients')} rows={6} placeholder={'500 g de frango\n1 lata de creme de leite\n2 colheres de sopa de ketchup'} />
        </Field>
        <Field label="Modo de preparo (um passo por linha)">
          <textarea value={r.steps} onChange={set('steps')} rows={6} placeholder={'Doure o frango.\nJunte o molho e cozinhe por 10 minutos.'} />
        </Field>
        <Field label="Observações (opcional)">
          <input value={r.notes || ''} onChange={set('notes')} placeholder="Fica melhor com batata palha" />
        </Field>
        <Field label="Link de origem (opcional)">
          <input type="text" inputMode="url" autoCapitalize="none" value={r.link || ''} onChange={set('link')} placeholder="https://…" />
        </Field>
        <div className="row">
          {r.id && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                const antes = { ...r }
                remove(r.id)
                toast('Receita apagada', { label: 'Desfazer', run: () => save('recipe', { ...antes, deleted: false }) })
                onClose(true)
              }}
            >
              Apagar
            </button>
          )}
          <span className="grow" />
          <button className="btn primary">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- importar por link ou por texto colado ----------
export function ImportarReceita({ onClose, onPronta }) {
  const st = useStore()
  const [modo, setModo] = useState('link')
  const [url, setUrl] = useState('')
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState(null) // 'buscando' | mensagem de erro

  const porLink = async (e) => {
    e.preventDefault()
    setEstado('buscando')
    try {
      const resp = await fetch('/api/receita', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ family: st.family, url: url.trim() }) })
      const j = await resp.json()
      if (j.ok) return onPronta({ ...j.receita, porcoes: j.receita.porcoes || '', tempo: j.receita.tempo || '', link: /^https?:\/\//.test(url.trim()) ? url.trim() : 'https://' + url.trim() })
      setEstado(j.motivo === 'sem-receita' ? 'Abri a página, mas não encontrei a receita nela de um jeito que eu consiga ler. Copie o texto da receita e use a aba “Colar texto”.' : j.motivo === 'endereco' ? 'Esse endereço não parece válido. Confira o link.' : 'O site não respondeu ou não deixou ler a página. Copie o texto da receita e use a aba “Colar texto”.')
    } catch {
      setEstado('Sem conexão com o servidor agora. Tente de novo em instantes.')
    }
  }
  const porTexto = (e) => {
    e.preventDefault()
    const r = receitaDeTexto(texto)
    onPronta({ ...r, porcoes: r.porcoes || '' })
  }

  return (
    <Modal title="Importar receita" onClose={onClose}>
      <div className="form">
        <div className="segmented" role="tablist">
          <button type="button" className={modo === 'link' ? 'on' : ''} onClick={() => setModo('link')}>
            Por link
          </button>
          <button type="button" className={modo === 'texto' ? 'on' : ''} onClick={() => setModo('texto')}>
            Colar texto
          </button>
        </div>
        {modo === 'link' ? (
          <form className="form" onSubmit={porLink}>
            <Field label="Endereço da receita">
              <input type="text" inputMode="url" autoCapitalize="none" value={url} onChange={(e) => setUrl(e.target.value)} required autoFocus placeholder="https://www.site.com.br/receita/…" />
            </Field>
            <p className="muted small">Funciona nos sites que publicam a receita de forma organizada, o que inclui a maioria dos grandes. Você confere e ajusta antes de salvar.</p>
            {estado && estado !== 'buscando' && <p className="late small">{estado}</p>}
            <button className="btn primary" disabled={estado === 'buscando'}>
              {estado === 'buscando' ? 'Buscando…' : 'Buscar receita'}
            </button>
          </form>
        ) : (
          <form className="form" onSubmit={porTexto}>
            <Field label="Cole a receita inteira">
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={10} required autoFocus placeholder={'Bolo de cenoura\n\nIngredientes\n3 cenouras\n2 xícaras de açúcar\n\nModo de preparo\nBata tudo…'} />
            </Field>
            <p className="muted small">Eu separo título, ingredientes e modo de preparo pelas palavras “Ingredientes” e “Modo de preparo”. Você confere antes de salvar.</p>
            <button className="btn primary">Continuar</button>
          </form>
        )}
      </div>
    </Modal>
  )
}
