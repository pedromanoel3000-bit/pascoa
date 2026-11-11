import { useEffect, useMemo, useRef, useState } from 'react'
import { byId, list, remove, save, useStore } from '../store.js'
import { describeRepeat, finalizeRepeat, fmtDate, money, today } from '../utils.js'
import { buscar, interpretar, separarItens } from '../magia.js'
import { Icon } from '../icons.jsx'
import { toast, vibrate } from '../toast.jsx'
import { Avatar, useMembers } from '../ui.jsx'
import { addItems } from './Lists.jsx'

// Barra mágica: a pessoa escreve (ou fala) do jeito que pensa e o app cria a coisa certa.
// Também busca em tudo. Abre pelo ✨ do topo, pela barra do Início ou com Ctrl/⌘ + K.

const TIPOS = {
  evento: ['📅', 'Evento'],
  tarefa: ['✅', 'Tarefa'],
  compras: ['🛒', 'Compras'],
  gasto: ['💰', 'Gasto'],
  recado: ['📌', 'Recado'],
  nota: ['📝', 'Nota'],
}
const EXEMPLOS = ['dentista amanhã às 15h', 'comprar leite, pão e ovos', 'pagar a luz dia 20 todo mês', 'gastei 35,90 no mercado', 'natação toda terça 17h', 'levar o lixo toda segunda para Ana', 'recado: chego mais tarde hoje']

export const abrirMagia = (texto = '') => window.dispatchEvent(new CustomEvent('abrir-magia', { detail: texto }))

const Reconhecimento = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

export default function Magia({ paginas, textoInicial = '', onClose }) {
  const st = useStore()
  const membros = useMembers()
  const [texto, setTexto] = useState(textoInicial)
  const [tipoEscolhido, setTipoEscolhido] = useState(null)
  const [feitos, setFeitos] = useState([]) // o que já foi criado nesta abertura
  const [ouvindo, setOuvindo] = useState(false)
  const campo = useRef(null)
  const voz = useRef(null)

  const lido = useMemo(() => interpretar(texto, { membros }), [texto, membros.length])
  const tipo = tipoEscolhido || lido.tipo
  const achados = useMemo(() => buscar(st, texto, paginas), [st, texto])
  const vazio = !texto.trim()

  useEffect(() => {
    campo.current?.focus()
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => {
      window.removeEventListener('keydown', k)
      voz.current?.abort?.()
    }
  }, [])
  useEffect(() => {
    if (vazio) setTipoEscolhido(null)
  }, [vazio])

  const lista = () => {
    const todas = list(st, 'list').sort((a, b) => a.createdAt - b.createdAt)
    return todas.find((l) => /compra/i.test(l.title)) || todas[0]
  }

  // O que falta para poder criar (ex.: gasto sem valor).
  const falta = tipo === 'gasto' && lido.valor == null ? 'Diga o valor, por exemplo “35 reais”.' : !lido.titulo && tipo !== 'compras' ? 'Escreva o que é.' : tipo === 'compras' && !lido.itens.length ? 'Escreva os itens.' : null

  const criar = () => {
    if (vazio || falta) return
    const ids = []
    let resumo = ''
    const rep = (ancora) => finalizeRepeat(lido.repeat, lido.rule, ancora)
    if (tipo === 'evento') {
      const date = lido.data || today()
      const ev = save('event', { title: lido.titulo, date, allDay: !lido.hora, start: lido.hora || '09:00', end: lido.fim || '10:00', members: [...new Set([st.me, ...lido.pessoas])], place: '', notes: '', remind: 30, ...rep(date) })
      ids.push(ev.id)
      resumo = `📅 ${lido.titulo} · ${fmtDate(date)}${lido.hora ? ' às ' + lido.hora : ''}`
    } else if (tipo === 'tarefa') {
      const due = lido.data || (lido.repeat !== 'none' ? today() : '')
      const t = save('task', { title: lido.titulo, due, assignee: lido.responsavel || lido.pessoas[0] || null, points: 1, notes: '', ...rep(due || today()) })
      ids.push(t.id)
      resumo = `✅ ${lido.titulo}${due ? ' · ' + fmtDate(due) : ''}`
    } else if (tipo === 'compras') {
      let l = lista()
      if (!l) l = save('list', { title: 'Compras', icon: '🛒' })
      const antes = new Set(list(st, 'listItem').map((i) => i.id))
      const novos = addItems(st, l.id, lido.itens.join(', '))
      resumo = novos.length ? `🛒 ${novos.join(', ')} → ${l.title}` : '🛒 Já estava na lista'
      ids.push({ lista: l.id, titulos: novos, antes })
    } else if (tipo === 'gasto') {
      const g = save('expense', { kind: lido.entrada ? 'in' : 'out', title: lido.titulo || (lido.entrada ? 'Entrada' : 'Gasto'), amount: lido.valor, date: lido.data || today(), category: lido.categoria || 'Outros', member: st.me })
      ids.push(g.id)
      resumo = `💰 ${lido.entrada ? '+' : '−'} ${money(lido.valor)} · ${g.title}`
    } else if (tipo === 'recado') {
      ids.push(save('post', { text: lido.titulo, likes: [], comments: [] }).id)
      resumo = `📌 ${lido.titulo}`
    } else {
      const curto = lido.titulo.length <= 60
      ids.push(save('note', { title: curto ? lido.titulo : lido.titulo.slice(0, 57) + '…', body: curto ? '' : lido.titulo, pinned: false }).id)
      resumo = `📝 ${lido.titulo.slice(0, 60)}`
    }
    vibrate()
    setFeitos((f) => [{ resumo, ids, tipo }, ...f].slice(0, 5))
    setTexto('')
    setTipoEscolhido(null)
    campo.current?.focus()
  }

  const desfazer = (item) => {
    for (const id of item.ids) {
      if (typeof id === 'string') remove(id)
      else list(st, 'listItem').filter((i) => i.listId === id.lista && !id.antes.has(i.id) && id.titulos.includes(i.title)).forEach((i) => remove(i.id))
    }
    setFeitos((f) => f.filter((x) => x !== item))
    toast('Desfeito')
  }

  const falar = () => {
    if (!Reconhecimento) return
    if (ouvindo) return voz.current?.stop()
    const r = new Reconhecimento()
    voz.current = r
    r.lang = 'pt-BR'
    r.interimResults = true
    r.onresult = (e) => setTexto([...e.results].map((x) => x[0].transcript).join(' '))
    r.onend = () => setOuvindo(false)
    r.onerror = (e) => {
      setOuvindo(false)
      if (e.error === 'not-allowed') toast('Libere o microfone para falar com o app.')
    }
    setOuvindo(true)
    try {
      r.start()
    } catch {
      setOuvindo(false)
    }
  }

  const ir = (pagina) => {
    location.hash = pagina
    onClose()
  }

  // Uma palavra solta que já existe no app: é mais provável que a pessoa esteja procurando.
  const buscaPrimeiro = achados.length > 0 && !tipoEscolhido && !lido.data && !lido.hora && lido.valor == null && lido.repeat === 'none'
  const blocoPrevia = (
      <section className="magia-previa">
        <div className="magia-tipos" role="group" aria-label="Criar como">
          {Object.entries(TIPOS).map(([k, [emoji, nome]]) => (
            <button key={k} type="button" className={'chip' + (k === tipo ? ' on' : '')} aria-pressed={k === tipo} onClick={() => setTipoEscolhido(k)}>
              {emoji} {k === 'gasto' && lido.entrada ? 'Entrada' : nome}
            </button>
          ))}
        </div>
        <Previa tipo={tipo} lido={lido} listaNome={lista()?.title || 'Compras'} />
        {falta && <p className="late small">{falta}</p>}
        <button type="button" className="btn primary big" onClick={criar} disabled={!!falta}>
          Criar {TIPOS[tipo][1].toLowerCase()} <span className="magia-enter">Enter ↵</span>
        </button>
      </section>
  )
  const blocoAchados = achados.length > 0 && (
        <section className="magia-achados">
          <h3 className="section-title">Já existe no app</h3>
          {achados.map((a, i) => (
            <button key={i} type="button" className="magia-achado" onClick={() => ir(a.ir)}>
              <span>{a.icone}</span>
              <span className="grow">
                <b>{a.titulo}</b>
                <small className="muted">{a.sub}</small>
              </span>
              <span className="muted">›</span>
            </button>
          ))}
        </section>
      )

  return (
    <div className="overlay magia-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="magia" role="dialog" aria-label="Barra mágica">
        <form
          className={'magia-campo' + (ouvindo ? ' ouvindo' : '')}
          onSubmit={(e) => {
            e.preventDefault()
            criar()
          }}
        >
          <span className="magia-ic">
            <Icon name="spark" />
          </span>
          <input ref={campo} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={ouvindo ? 'Pode falar…' : 'Escreva do seu jeito…'} enterKeyHint="done" aria-label="O que você precisa?" autoComplete="off" />
          {Reconhecimento && (
            <button type="button" className={'icon-btn' + (ouvindo ? ' gravando' : '')} onClick={falar} aria-label={ouvindo ? 'Parar de ouvir' : 'Falar'}>
              <Icon name="mic" />
            </button>
          )}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </form>

        <div className="magia-corpo">
          {feitos.map((f, i) => (
            <div key={i} className="magia-feito">
              <span className="grow">{f.resumo}</span>
              <button type="button" className="link" onClick={() => desfazer(f)}>
                desfazer
              </button>
            </div>
          ))}

          {vazio ? (
            <div className="magia-exemplos">
              <p className="muted small">Escreva ou fale e eu entendo se é evento, tarefa, compra, gasto ou recado. Também procuro em tudo. Experimente:</p>
              {EXEMPLOS.map((e) => (
                <button key={e} type="button" className="chip" onClick={() => (setTexto(e), campo.current?.focus())}>
                  {e}
                </button>
              ))}
            </div>
          ) : (
            <>
              {buscaPrimeiro && blocoAchados}
              {blocoPrevia}
              {!buscaPrimeiro && blocoAchados}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Mostra como o app entendeu a frase.
function Previa({ tipo, lido, listaNome }) {
  const st = useStore()
  const rep = lido.repeat !== 'none' ? describeRepeat(finalizeRepeat(lido.repeat, lido.rule, lido.data || today()), lido.data || today()) : null
  const Pessoas = ({ ids }) =>
    ids.map((id) => (
      <span key={id} className="magia-tag">
        <Avatar member={byId(st, id)} size={18} /> {byId(st, id)?.name}
      </span>
    ))
  if (tipo === 'compras')
    return (
      <div className="magia-card">
        <b>Para a lista {listaNome}</b>
        <div className="magia-tags">
          {(lido.itens.length ? lido.itens : separarItens(lido.titulo)).map((i) => (
            <span key={i} className="magia-tag">
              + {i}
            </span>
          ))}
        </div>
      </div>
    )
  if (tipo === 'gasto')
    return (
      <div className="magia-card">
        <b>{lido.titulo || (lido.entrada ? 'Entrada' : 'Gasto')}</b>
        <div className="magia-tags">
          <span className={'magia-tag ' + (lido.entrada ? 'pos' : 'neg')}>{lido.valor != null ? `${lido.entrada ? '+' : '−'} ${money(lido.valor)}` : 'sem valor'}</span>
          <span className="magia-tag">{lido.categoria || 'Outros'}</span>
          <span className="magia-tag">📅 {fmtDate(lido.data || today())}</span>
        </div>
      </div>
    )
  if (tipo === 'recado' || tipo === 'nota')
    return (
      <div className="magia-card">
        <b>{tipo === 'recado' ? 'No mural da família' : 'Nas notas'}</b>
        <p>{lido.titulo}</p>
      </div>
    )
  const quem = tipo === 'tarefa' ? (lido.responsavel ? [lido.responsavel] : lido.pessoas.slice(0, 1)) : lido.pessoas
  return (
    <div className="magia-card">
      <b>{lido.titulo || '…'}</b>
      <div className="magia-tags">
        {tipo === 'evento' ? (
          <>
            <span className="magia-tag">📅 {fmtDate(lido.data || today(), { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            <span className="magia-tag">🕒 {lido.hora ? `${lido.hora}${lido.fim ? '–' + lido.fim : ''}` : 'dia inteiro'}</span>
          </>
        ) : (
          <span className="magia-tag">📅 {lido.data ? fmtDate(lido.data, { weekday: 'short', day: 'numeric', month: 'short' }) : 'sem prazo'}</span>
        )}
        {rep && <span className="magia-tag">🔁 {rep}</span>}
        <Pessoas ids={quem} />
      </div>
    </div>
  )
}
