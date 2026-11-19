import { useState } from 'react'
import { byId, list, remove, save, update, useStore } from '../store.js'
import { addDays, eventsOn, fmtDate, parseYmd, today } from '../utils.js'
import { Avatar, Empty, Field, MemberPicker, Modal, PageHeader, Segmented } from '../ui.jsx'
import { toast, vibrate } from '../toast.jsx'
import { juntarIngredientes, REFEICOES, splitIng, sugerirSemana, usoDasReceitas } from '../refeicoes.js'
import { FormReceita, ImportarReceita, jaNaLista, metaDaReceita, paraCompras, VerReceita } from './Receitas.jsx'

export const SLOTS = REFEICOES

const weekStart = (d) => addDays(d, -((parseYmd(d).getDay() + 6) % 7)) // segunda-feira
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const dm = (d) => `${d.slice(8)}/${d.slice(5, 7)}`

export default function Meals() {
  const st = useStore()
  const [aba, setAba] = useState('cardapio')
  const [start, setStart] = useState(() => weekStart(today()))
  const [refeicao, setRefeicao] = useState(null) // refeição em edição
  const [receita, setReceita] = useState(null) // { ver } | { editar } | { importar: true }
  const [compras, setCompras] = useState(false)

  const hoje = today()
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const meals = list(st, 'meal')
  const recipes = list(st, 'recipe').sort((a, b) => a.title.localeCompare(b.title))
  const find = (date, slot) => meals.find((m) => m.date === date && m.slot === slot)
  const daSemana = meals.filter((m) => days.includes(m.date))

  const desfazerCriadas = (criadas) => ({ label: 'Desfazer', run: () => criadas.forEach((m) => remove(m.id)) })
  const planejar = (r, date, slot, porcoes) => {
    const antiga = find(date, slot)
    const nova = save('meal', { ...(antiga || {}), date, slot, title: r.title, ingredients: r.ingredients || '', recipeId: r.id, porcoes: porcoes || r.porcoes || '' })
    vibrate()
    toast(`“${r.title}” no ${slot.toLowerCase()} de ${fmtDate(date, { weekday: 'long' })}`, antiga ? undefined : desfazerCriadas([nova]))
  }

  const sugerir = () => {
    if (!recipes.length) return toast('Cadastre algumas receitas primeiro, na aba Receitas.')
    const people = [...list(st, 'member'), ...list(st, 'contact')]
    const eventos = list(st, 'event')
    const futuros = days.filter((d) => d >= hoje)
    const plano = sugerirSemana({ dias: futuros.length ? futuros : days, receitas: recipes, refeicoes: meals, hoje, diasCheios: days.filter((d) => eventsOn(eventos, people, d).filter((e) => !e.birthday).length >= 3) })
    if (!plano.length) return toast('Nada para sugerir: a semana já está preenchida ou faltam receitas diferentes.')
    const criadas = plano.map((p) => save('meal', { date: p.date, slot: p.slot, title: p.receita.title, ingredients: p.receita.ingredients || '', recipeId: p.receita.id, porcoes: p.receita.porcoes || '', sugerida: true }))
    vibrate()
    toast(`✨ ${criadas.length} ${criadas.length === 1 ? 'refeição sugerida' : 'refeições sugeridas'}`, desfazerCriadas(criadas))
  }
  const copiarAnterior = () => {
    const antes = meals.filter((m) => m.date >= addDays(start, -7) && m.date < start)
    const criadas = antes.filter((m) => !find(addDays(m.date, 7), m.slot)).map(({ id, createdAt, updatedAt, createdBy, feito, ...m }) => save('meal', { ...m, date: addDays(m.date, 7) }))
    toast(criadas.length ? `📋 ${criadas.length} ${criadas.length === 1 ? 'refeição copiada' : 'refeições copiadas'} da semana anterior` : 'Nada para copiar da semana anterior.', criadas.length ? desfazerCriadas(criadas) : undefined)
  }
  const limpar = () => {
    if (!daSemana.length || !confirm(`Apagar as ${daSemana.length} refeições desta semana?`)) return
    const antes = [...daSemana]
    antes.forEach((m) => remove(m.id))
    toast('Semana limpa', { label: 'Desfazer', run: () => antes.forEach((m) => save('meal', { ...m, deleted: false })) })
  }

  return (
    <div className="page">
      <PageHeader title="Refeições">
        <Segmented options={[['cardapio', 'Cardápio'], ['receitas', `Receitas${recipes.length ? ' · ' + recipes.length : ''}`]]} value={aba} onChange={setAba} />
      </PageHeader>

      {aba === 'cardapio' ? (
        <>
          <div className="cal-nav">
            <button className="icon-btn" onClick={() => setStart(addDays(start, -7))} aria-label="Semana anterior">
              ‹
            </button>
            <h2>
              {fmtDate(days[0], { day: 'numeric', month: 'short' })} – {fmtDate(days[6], { day: 'numeric', month: 'short' })}
            </h2>
            <button className="icon-btn" onClick={() => setStart(addDays(start, 7))} aria-label="Próxima semana">
              ›
            </button>
          </div>
          <div className="meal-acoes">
            <button type="button" className="chip" onClick={sugerir}>
              ✨ Sugerir a semana
            </button>
            <button type="button" className="chip" onClick={() => (daSemana.some((m) => splitIng(m.ingredients).length) ? setCompras(true) : toast('Nenhum ingrediente nas refeições desta semana.'))}>
              🛒 Lista de compras
            </button>
            <button type="button" className="chip" onClick={copiarAnterior}>
              📋 Copiar semana anterior
            </button>
            {daSemana.length > 0 && (
              <button type="button" className="chip" onClick={limpar}>
                Limpar
              </button>
            )}
          </div>
          <div className="meal-week">
            {days.map((d) => (
              <div key={d} className={'card meal-day' + (d === hoje ? ' today' : '')}>
                <h3>
                  {fmtDate(d, { weekday: 'long', day: 'numeric' })}
                  {d === hoje && <small className="meal-hoje">hoje</small>}
                </h3>
                {SLOTS.map((slot) => {
                  const m = find(d, slot)
                  const r = m?.recipeId && byId(st, m.recipeId)
                  return (
                    <div key={slot} className={'meal-slot' + (m ? ' filled' : '') + (m?.feito ? ' feito' : '')}>
                      <button type="button" className="meal-slot-main" onClick={() => setRefeicao(m || { date: d, slot })} aria-label={`${slot} de ${fmtDate(d, { weekday: 'long' })}: ${m ? m.title : 'vazio'}`}>
                        <small>{slot}</small>
                        <span className="grow">{m ? m.title : '+'}</span>
                        {m?.feito && <i aria-label="feito">✓</i>}
                        {m?.cozinha && byId(st, m.cozinha) && <Avatar member={byId(st, m.cozinha)} size={20} />}
                      </button>
                      {r && !r.deleted && (
                        <button type="button" className="meal-ver" onClick={() => setReceita({ ver: r })} aria-label={`Ver a receita de ${r.title}`}>
                          📖
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      ) : (
        <LivroDeReceitas recipes={recipes} meals={meals} onVer={(r) => setReceita({ ver: r })} onNova={() => setReceita({ editar: {} })} onImportar={() => setReceita({ importar: true })} />
      )}

      {refeicao && <FormRefeicao initial={refeicao} recipes={recipes} onClose={() => setRefeicao(null)} onVerReceita={(r) => (setRefeicao(null), setReceita({ ver: r }))} />}
      {receita?.ver && <VerReceita receita={receita.ver} onClose={() => setReceita(null)} onEditar={() => setReceita({ editar: byId(st, receita.ver.id) || receita.ver })} onPlanejar={planejar} />}
      {receita?.editar && <FormReceita initial={receita.editar} onClose={() => setReceita(null)} />}
      {receita?.importar && <ImportarReceita onClose={() => setReceita(null)} onPronta={(r) => setReceita({ editar: r })} />}
      {compras && <ComprasDaSemana refeicoes={daSemana} onClose={() => setCompras(false)} />}
    </div>
  )
}

// ---------- livro de receitas ----------
function LivroDeReceitas({ recipes, meals, onVer, onNova, onImportar }) {
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const uso = usoDasReceitas(meals, today())
  const categorias = [...new Set(recipes.map((r) => r.categoria).filter(Boolean))]
  const filtros = [['todas', 'Todas'], ...(recipes.some((r) => r.favorita) ? [['favoritas', '⭐ Favoritas']] : []), ...(recipes.some((r) => r.rapida) ? [['rapidas', '⚡ Rápidas']] : []), ...(recipes.length > 3 ? [['esquecidas', '🕰 Faz tempo']] : []), ...categorias.map((c) => [c, c])]
  let lista = recipes.filter((r) => !q || fold(`${r.title} ${r.ingredients}`).includes(fold(q)))
  if (filtro === 'favoritas') lista = lista.filter((r) => r.favorita)
  else if (filtro === 'rapidas') lista = lista.filter((r) => r.rapida)
  else if (filtro === 'esquecidas') lista = [...lista].sort((a, b) => (uso[a.id]?.ultima || '').localeCompare(uso[b.id]?.ultima || ''))
  else if (filtro !== 'todas') lista = lista.filter((r) => r.categoria === filtro)

  return (
    <>
      <div className="row">
        <button type="button" className="btn primary" onClick={onNova}>
          + Receita
        </button>
        <button type="button" className="btn" onClick={onImportar}>
          🔗 Importar
        </button>
      </div>
      {recipes.length === 0 ? (
        <Empty icon="📖" text="Nenhuma receita ainda. Crie uma, cole o texto ou importe pelo link de um site." />
      ) : (
        <>
          <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou ingrediente…" />
          {filtros.length > 1 && (
            <div className="conv-tabs">
              {filtros.map(([k, nome]) => (
                <button type="button" key={k} className={'chip' + (filtro === k ? ' on' : '')} onClick={() => setFiltro(k)}>
                  {nome}
                </button>
              ))}
            </div>
          )}
          {lista.length === 0 && <p className="muted center">Nenhuma receita com esse filtro.</p>}
          <div className="rec-lista">
            {lista.map((r) => (
              <button type="button" key={r.id} className="card rec-item" onClick={() => onVer(r)}>
                <b>
                  {r.favorita && '⭐ '}
                  {r.title}
                </b>
                <span className="muted small">{[r.categoria, metaDaReceita(r), r.rapida ? '⚡' : null].filter(Boolean).join(' · ') || `${splitIng(r.ingredients).length} ingredientes`}</span>
                <span className="muted small">{uso[r.id] ? `No cardápio ${uso[r.id].vezes}×, última em ${dm(uso[r.id].ultima)}` : 'Ainda não entrou no cardápio'}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}

// ---------- uma refeição do cardápio ----------
function FormRefeicao({ initial, recipes, onClose, onVerReceita }) {
  const st = useStore()
  const [m, setM] = useState({ title: '', ingredients: '', notes: '', porcoes: '', cozinha: null, ...initial })
  const set = (k) => (e) => setM({ ...m, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const [busca, setBusca] = useState('')
  const r = m.recipeId && byId(st, m.recipeId)
  const sugestoes = !m.recipeId && busca.trim() ? recipes.filter((x) => fold(x.title).includes(fold(busca))).slice(0, 5) : []
  const usar = (x) => {
    setM({ ...m, title: x.title, ingredients: x.ingredients || '', recipeId: x.id, porcoes: x.porcoes || '' })
    setBusca('')
  }
  const ocupado = (date, slot) => list(st, 'meal').some((x) => x.date === date && x.slot === slot && x.id !== m.id)
  const submit = (e) => {
    e.preventDefault()
    if (ocupado(m.date, m.slot)) return toast(`Já existe ${m.slot.toLowerCase()} nesse dia.`)
    save('meal', { ...m, title: m.title.trim(), porcoes: parseInt(m.porcoes) || '' })
    onClose()
  }
  const repetir = () => {
    const destino = addDays(m.date, 1)
    const slot = m.slot === 'Jantar' ? 'Almoço' : m.slot
    if (ocupado(destino, slot)) return toast(`O ${slot.toLowerCase()} de ${fmtDate(destino, { weekday: 'long' })} já está ocupado.`)
    const { id, createdAt, updatedAt, createdBy, feito, ...resto } = m
    const nova = save('meal', { ...resto, date: destino, slot, notes: m.slot === 'Jantar' ? 'Sobras de ontem' : resto.notes })
    toast(`Repetido no ${slot.toLowerCase()} de ${fmtDate(destino, { weekday: 'long' })}`, { label: 'Desfazer', run: () => remove(nova.id) })
  }
  const ings = splitIng(m.ingredients)

  return (
    <Modal title={`${m.slot} · ${fmtDate(m.date)}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Prato">
          <input
            value={m.title}
            onChange={(e) => {
              setM({ ...m, title: e.target.value, recipeId: r && e.target.value !== r.title ? null : m.recipeId })
              setBusca(e.target.value)
            }}
            required
            autoFocus={!m.id}
            placeholder={recipes.length ? 'Digite o prato ou o nome de uma receita' : 'Macarrão à bolonhesa'}
          />
        </Field>
        {sugestoes.length > 0 && (
          <div className="meal-sug">
            {sugestoes.map((x) => (
              <button type="button" key={x.id} className="chip" onClick={() => usar(x)}>
                📖 {x.title}
              </button>
            ))}
          </div>
        )}
        {r && !r.deleted && (
          <button type="button" className="meal-receita" onClick={() => onVerReceita(r)}>
            📖 Receita: <b>{r.title}</b> <span className="muted">· {metaDaReceita(r) || 'abrir'} ›</span>
          </button>
        )}
        <div className="row2">
          <Field label="Dia">
            <input type="date" value={m.date} onChange={set('date')} required />
          </Field>
          <Field label="Refeição">
            <select value={m.slot} onChange={set('slot')}>
              {SLOTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Quem cozinha">
          <MemberPicker single value={m.cozinha ? [m.cozinha] : []} onChange={(v) => setM({ ...m, cozinha: v[0] || null })} />
        </Field>
        <div className="row2">
          <Field label="Porções">
            <input inputMode="numeric" value={m.porcoes ?? ''} onChange={set('porcoes')} placeholder={r?.porcoes ? String(r.porcoes) : '—'} />
          </Field>
          <Field label="Observação">
            <input value={m.notes || ''} onChange={set('notes')} placeholder="Sobras, visita…" />
          </Field>
        </div>
        <Field label="Ingredientes (um por linha)">
          <textarea value={m.ingredients} onChange={set('ingredients')} rows={4} />
        </Field>
        {m.id && (
          <label className="check">
            <input type="checkbox" checked={!!m.feito} onChange={set('feito')} /> Já foi feita
          </label>
        )}
        <div className="row">
          {m.id && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                const antes = byId(st, m.id)
                remove(m.id)
                toast('Refeição apagada', { label: 'Desfazer', run: () => save('meal', { ...antes, deleted: false }) })
                onClose()
              }}
            >
              Apagar
            </button>
          )}
          {m.id && (
            <button type="button" className="btn ghost" onClick={repetir}>
              Repetir amanhã
            </button>
          )}
          {ings.length > 0 && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                const fator = r?.porcoes && parseInt(m.porcoes) ? parseInt(m.porcoes) / Number(r.porcoes) : 1
                const novos = paraCompras(st, juntarIngredientes([{ ingredientes: ings, fator }]).map((x) => x.titulo))
                toast(novos.length ? `🛒 ${novos.length} ${novos.length === 1 ? 'item foi' : 'itens foram'} para as compras` : 'Tudo já estava na lista')
              }}
            >
              🛒 Para a lista
            </button>
          )}
          <span className="grow" />
          <button className="btn primary">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- lista de compras da semana: junta, soma e deixa escolher ----------
function ComprasDaSemana({ refeicoes, onClose }) {
  const st = useStore()
  const itens = juntarIngredientes(
    refeicoes
      .filter((m) => !m.feito)
      .map((m) => {
        const r = m.recipeId && byId(st, m.recipeId)
        return { ingredientes: splitIng(m.ingredients), fator: r?.porcoes && parseInt(m.porcoes) ? parseInt(m.porcoes) / Number(r.porcoes) : 1, de: m.title }
      })
  )
  const naLista = jaNaLista(st)
  const [fora, setFora] = useState(() => new Set())
  const escolhidos = itens.filter((i) => !fora.has(i.nome) && !naLista(i.nome))
  const alternar = (nome) => {
    const n = new Set(fora)
    n.has(nome) ? n.delete(nome) : n.add(nome)
    setFora(n)
  }
  return (
    <Modal title="Compras da semana" onClose={onClose}>
      <div className="form">
        <p className="muted small">Juntei os ingredientes das refeições que ainda não foram feitas e somei os repetidos. Desmarque o que você já tem em casa.</p>
        <ul className="rec-ings">
          {itens.map((i) => {
            const ja = naLista(i.nome)
            return (
              <li key={i.nome}>
                <label className={ja ? 'ja' : ''}>
                  <input type="checkbox" disabled={ja} checked={!ja && !fora.has(i.nome)} onChange={() => alternar(i.nome)} />
                  <span className="grow">
                    {i.nome}
                    {i.qtd && <b> · {i.qtd}</b>}
                    <small className="muted rec-de">{i.de.join(', ')}</small>
                  </span>
                  {ja && <small className="muted">na lista</small>}
                </label>
              </li>
            )
          })}
        </ul>
        <div className="row">
          <span className="grow" />
          <button
            type="button"
            className="btn primary"
            disabled={!escolhidos.length}
            onClick={() => {
              const novos = paraCompras(st, escolhidos.map((i) => i.titulo))
              vibrate()
              toast(`🛒 ${novos.length} ${novos.length === 1 ? 'item foi' : 'itens foram'} para as compras`, { label: 'Desfazer', run: () => novos.forEach((n) => remove(n.id)) })
              onClose()
            }}
          >
            Enviar {escolhidos.length} para a lista
          </button>
        </div>
      </div>
    </Modal>
  )
}
