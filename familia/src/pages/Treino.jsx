import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { byId, list, remove, save, update, useStore } from '../store.js'
import { today } from '../utils.js'
import { Empty, Field, Modal, PageHeader, Segmented } from '../ui.jsx'
import { Icon } from '../icons.jsx'
import { toast, vibrate } from '../toast.jsx'
import * as T from '../treino.js'

// Treino: o programa A–D de cada pessoa. Mostra sempre o treino de quem está usando (st.me).
// Tipos guardados: treinoPrograma (um por pessoa), treinoSessao (um por treino concluído)
// e treinoRascunho (o treino em andamento, salvo enquanto a pessoa digita).

const progId = (me) => `treino-programa-${me}`
const rascId = (me) => `treino-rascunho-${me}`
const minhasSessoes = (st, plano) => T.ordenar(list(st, 'treinoSessao').filter((s) => s.memberId === st.me && T.planoDaSessao(s) === plano.id))

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    toast('Registro copiado')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = texto
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      toast('Registro copiado')
    } catch {
      toast('Não consegui copiar. Segure o texto para copiar.')
    }
    ta.remove()
  }
}

// ---------- descanso (fica fora da tela para continuar contando se a pessoa sair dela) ----------
let descanso = null // { fim, total, nome, prox, acabou, agora }
let loop = null
const ouvintes = new Set()
const avisar = () => ouvintes.forEach((f) => f())
let audio = null

// O navegador só deixa tocar som depois de um toque: chamado ao marcar a série.
function liberarSom() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume()
  } catch {}
}

function alertarFim() {
  try {
    liberarSom()
    const t0 = audio.currentTime
    for (let i = 0; i < 3; i++) {
      const o = audio.createOscillator()
      const g = audio.createGain()
      const t = t0 + i * 0.35
      o.frequency.value = 880
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
      o.connect(g).connect(audio.destination)
      o.start(t)
      o.stop(t + 0.3)
    }
  } catch {}
  try {
    navigator.vibrate?.([300, 120, 300, 120, 300])
  } catch {}
}

function tick() {
  if (!descanso) {
    clearInterval(loop)
    loop = null
    return
  }
  const agora = Date.now()
  if (!descanso.acabou && agora >= descanso.fim) {
    descanso = { ...descanso, acabou: true, agora }
    alertarFim()
    const fim = descanso.fim
    setTimeout(() => {
      if (descanso?.acabou && descanso.fim === fim) {
        descanso = null
        avisar()
      }
    }, 6000)
  } else descanso = { ...descanso, agora }
  avisar()
}

function iniciarDescanso(seg, nome, prox) {
  descanso = { fim: Date.now() + seg * 1000, total: seg, nome, prox, acabou: false, agora: Date.now() }
  if (!loop) loop = setInterval(tick, 250)
  avisar()
}
function ajustarDescanso(delta) {
  if (!descanso || descanso.acabou) return
  descanso = { ...descanso, fim: Math.max(Date.now(), descanso.fim + delta * 1000), total: Math.max(1, descanso.total + Math.max(0, delta)) }
  avisar()
}
function pararDescanso() {
  descanso = null
  avisar()
}
const useDescanso = () => useSyncExternalStore((f) => (ouvintes.add(f), () => ouvintes.delete(f)), () => descanso)

function Descanso() {
  const t = useDescanso()
  if (!t) return null
  const resta = Math.max(0, Math.ceil((t.fim - t.agora) / 1000))
  const feito = Math.min(1, Math.max(0, 1 - resta / t.total))
  return (
    <div className={'tr-timer' + (t.acabou ? ' fim' : '')} role="timer" aria-live="polite">
      <div className="tr-timer-bar">
        <i style={{ width: `${(t.acabou ? 1 : feito) * 100}%` }} />
      </div>
      <div className="tr-timer-row">
        <div className="grow">
          <b className="tr-clock">{t.acabou ? 'Bora!' : T.mmss(resta)}</b>
          <small className="muted">{t.acabou ? t.prox : `Descanso · ${t.nome}`}</small>
        </div>
        {!t.acabou && (
          <>
            <button type="button" className="btn ghost small" onClick={() => ajustarDescanso(-15)}>
              −15 s
            </button>
            <button type="button" className="btn ghost small" onClick={() => ajustarDescanso(15)}>
              +15 s
            </button>
          </>
        )}
        <button type="button" className="btn small" onClick={pararDescanso}>
          {t.acabou ? 'OK' : 'Pular'}
        </button>
      </div>
    </div>
  )
}

// ---------- tela ----------
export default function Treino() {
  const st = useStore()
  return <TreinoDe key={st.me} />
}

function TreinoDe() {
  const st = useStore()
  const programa = byId(st, progId(st.me))
  const [aba, setAba] = useState('treinar')
  if (!programa) return <Ativar />
  const plano = T.planoDe(programa)
  return (
    <div className="page treino">
      <PageHeader title="Treino">
        <Segmented
          options={[
            ['treinar', 'Treinar'],
            ['historico', 'Histórico'],
            ['plano', 'Plano'],
          ]}
          value={aba}
          onChange={setAba}
        />
      </PageHeader>
      {aba === 'treinar' && <Sessao programa={programa} plano={plano} />}
      {aba === 'historico' && <Historico programa={programa} plano={plano} />}
      {aba === 'plano' && <Plano programa={programa} plano={plano} />}
    </div>
  )
}

function Ativar() {
  const st = useStore()
  const [inicio, setInicio] = useState(today())
  const [barra, setBarra] = useState(T.fmtKg(T.BARRA_PADRAO))
  const [planoId, setPlanoId] = useState(T.PLANO_PADRAO.id)
  const [proteina, setProteina] = useState('')
  const plano = T.PLANOS[planoId]
  const ativar = (e) => {
    e.preventDefault()
    save('treinoPrograma', { id: progId(st.me), memberId: st.me, plano: planoId, inicio, proximo: 'A', barra: T.lerKg(barra) ?? T.BARRA_PADRAO, proteina: T.lerReps(proteina) })
    toast('Programa ativado 💪')
  }
  return (
    <div className="page treino">
      <PageHeader title="Treino" />
      <section className="card stack">
        <h3>💪 Programa de {plano.bloco} semanas</h3>
        <p className="muted small">
          Quatro treinos em fila: A → B → C → D → A. Faltou um dia, faz o próximo. As semanas contam a partir da data de início e mudam as séries, o esforço (RIR) e o cardio.
        </p>
        <form className="form" onSubmit={ativar}>
          <div className="field">
            <span>Plano</span>
            <div className="tr-planos">
              {Object.values(T.PLANOS).map((p) => (
                <label key={p.id} className={'tr-plano-op' + (p.id === planoId ? ' on' : '')}>
                  <input type="radio" name="plano" checked={p.id === planoId} onChange={() => setPlanoId(p.id)} />
                  <span>
                    <b>{p.nome}</b>
                    <small className="muted">{p.descricao}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Field label="Data de início do programa">
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
          </Field>
          <Field label="Peso da barra da sua academia (kg)">
            <input inputMode="decimal" value={barra} onChange={(e) => setBarra(e.target.value)} />
          </Field>
          {plano.cardioSemanal && (
            <Field label="Meta de proteína por dia, em gramas (opcional)">
              <input inputMode="numeric" value={proteina} onChange={(e) => setProteina(e.target.value)} placeholder="ex.: 1,6 a 2 g por kg do peso-meta" />
            </Field>
          )}
          <button className="btn primary big">Ativar programa</button>
        </form>
      </section>
      <section className="card">
        <h3>Os treinos</h3>
        <ResumoTreinos plano={plano} barra={T.lerKg(barra) ?? T.BARRA_PADRAO} />
      </section>
    </div>
  )
}

const serieVazia = () => ({ kg: '', reps: '', feito: false, rir: null })
const novoRascunho = (me, letra) => ({ id: rascId(me), memberId: me, treino: letra, data: today(), aquecimento: [false, false], exercicios: {}, cardio: '', cardioFeito: false })
const temDados = (r) => !!(r.cardio || r.cardioFeito || Object.values(r.exercicios || {}).some((e) => e.series?.some((s) => s.feito || s.kg || s.reps)))

// Texto da meta de hoje, no topo de cada exercício.
function metaTexto(meta, e, info, n, barra) {
  const carga = (k) => (k == null ? 'peso do corpo' : `${T.fmtKg(k)} kg`)
  const comReps = (m) => `${carga(m.kg)} × ${m.reps.slice(0, n).join(', ')}`
  let t
  switch (meta?.acao) {
    case 'subir':
      t = `Meta: ${meta.texto} · subiu a carga!`
      break
    case 'dentro':
      t = `Meta: ${comReps(meta)}`
      break
    case 'repetir':
      t = `Meta: repetir ${comReps(meta)}`
      break
    case 'abaixo':
      t = `Meta: ${meta.texto} · chegue ao mínimo da faixa`
      break
    case 'reduzir':
      t = `Meta: ${meta.texto} · 10% a menos`
      break
    case 'dificil':
      t = `Meta: deixe mais difícil e faça ${meta.min ?? e.min}+ repetições`
      break
    case 'facilitar':
      t = `Meta: deixe mais fácil (ex.: mais ajuda no graviton) e faça ${meta.min ?? e.min}+`
      break
    case 'outro':
      t = `Meta: ${meta.texto}`
      break
    default:
      t = `Ache a carga: termine cada série com ${info.rir} sobrando`
      if (meta?.kg != null) t += ` · no treino ${meta.origem} você usou ${T.fmtKg(meta.kg)} kg`
  }
  if (info.deload && meta?.kg != null && meta.acao !== 'achar') t += ` · deload: mesma carga ou ${T.fmtKg(T.menos10(e, meta.kg, barra))} kg`
  return t
}

function Sessao({ programa, plano }) {
  const st = useStore()
  const me = st.me
  const sessoes = minhasSessoes(st, plano)
  const [d, setD] = useState(() => {
    const r = byId(st, rascId(me))
    if (!r) return novoRascunho(me, programa.proximo)
    // Rascunho de outro dia sem nada anotado: vira o treino de hoje.
    return r.data !== today() && !temDados(r) ? { ...r, data: today() } : r
  })
  const [resumo, setResumo] = useState(null)
  const atual = useRef(d)
  const pendente = useRef(null)
  const relogio = useRef(null)

  // Salva o rascunho ~700 ms depois da última mudança (e na hora, se o app for fechado).
  const gravar = () => {
    clearTimeout(relogio.current)
    if (pendente.current) {
      save('treinoRascunho', pendente.current)
      pendente.current = null
    }
  }
  const mudar = (fn) => {
    const next = fn(atual.current)
    atual.current = next
    setD(next)
    pendente.current = next
    clearTimeout(relogio.current)
    relogio.current = setTimeout(gravar, 700)
  }
  const recomecar = (r) => {
    clearTimeout(relogio.current)
    pendente.current = null
    atual.current = r
    setD(r)
  }
  useEffect(() => {
    const oculto = () => document.visibilityState === 'hidden' && gravar()
    window.addEventListener('pagehide', gravar)
    document.addEventListener('visibilitychange', oculto)
    return () => {
      gravar()
      window.removeEventListener('pagehide', gravar)
      document.removeEventListener('visibilitychange', oculto)
    }
  }, [])

  const atualSemana = T.semanaAtual(programa, plano, sessoes, d.data)
  const semana = atualSemana.semana
  const info = T.semanaInfo(semana, plano)
  const tr = plano.treinos[d.treino]
  const barra = programa.barra ?? T.BARRA_PADRAO
  const metas = Object.fromEntries(tr.exercicios.map((e) => [e.id, T.metaAtual(e, d.treino, sessoes, barra, plano)]))

  const seriesDe = (e, r = d) => {
    const arr = r.exercicios?.[e.id]?.series || []
    return Array.from({ length: info.series(e.series) }, (_, i) => arr[i] || serieVazia())
  }
  const mudarSerie = (e, i, campos) =>
    mudar((cur) => {
      const arr = seriesDe(e, cur)
      arr[i] = { ...arr[i], ...campos }
      return { ...cur, exercicios: { ...cur.exercicios, [e.id]: { series: arr } } }
    })

  // A carga sugerida de uma série é a da série anterior feita; na primeira, a da meta.
  const kgSugerido = (series, i, meta) => {
    for (let k = i - 1; k >= 0; k--) if (series[k].feito && series[k].kg !== '') return series[k].kg
    return meta?.kg != null ? T.fmtKg(meta.kg) : ''
  }

  const marcar = (e, idx, i) => {
    const series = seriesDe(e)
    const s = series[i]
    if (s.feito) return mudarSerie(e, i, { feito: false, rir: null })
    const meta = metas[e.id]
    const kg = e.corpo ? '' : s.kg.trim() || kgSugerido(series, i, meta)
    const reps = s.reps.trim() || String(T.lerReps(T.repsAlvo(meta, e, i)) ?? '')
    if (!e.corpo && T.lerKg(kg) == null) return toast('Coloque a carga desta série')
    if (!T.lerReps(reps)) return toast('Coloque as repetições')
    liberarSom()
    vibrate()
    mudarSerie(e, i, { kg, reps, feito: true, rir: null })
    const seguinte = tr.exercicios[idx + 1]
    if (i + 1 < series.length) iniciarDescanso(e.desc, e.nome, `Próxima: ${e.nome}, série ${i + 2} de ${series.length}`)
    else if (seguinte) iniciarDescanso(e.desc, e.nome, `Próximo exercício: ${seguinte.nome}`)
  }

  const trocar = (l) => {
    if (l === d.treino) return
    if (temDados(d) && !confirm(`Trocar para o treino ${l}? O que você anotou no treino ${d.treino} será descartado.`)) return
    pararDescanso()
    mudar(() => ({ ...novoRascunho(me, l), escolhido: true }))
  }

  // Enquanto nada foi anotado nem escolhido, o treino da tela acompanha a fila (ex.: depois de importar).
  useEffect(() => {
    const r = atual.current
    if (!temDados(r) && !r.escolhido && r.treino !== programa.proximo) recomecar(novoRascunho(me, programa.proximo))
  }, [programa.proximo])

  const descartar = () => {
    if (!confirm('Descartar o que foi anotado neste treino?')) return
    pararDescanso()
    remove(rascId(me))
    recomecar(novoRascunho(me, programa.proximo))
  }

  const concluir = () => {
    const exercicios = []
    let faltando = 0
    tr.exercicios.forEach((e) => {
      const series = seriesDe(e)
      faltando += series.filter((s) => !s.feito).length
      const feitas = series
        .filter((s) => s.feito)
        .map((s) => ({ kg: e.corpo ? null : T.lerKg(s.kg), reps: T.lerReps(s.reps), rir: s.rir ?? null }))
        .filter((s) => s.reps && (e.corpo || s.kg != null))
      if (!feitas.length) return
      const ant = T.anteriorDe(sessoes, d.treino, e.id)
      // Dia de pouca energia: a meta da próxima vez continua a mesma de hoje.
      const meta = metas[e.id]
      const proxima = d.diaLeve && meta && !['achar', 'outro'].includes(meta.acao) ? meta : T.calcProxima(e, feitas, info, ant?.series, barra)
      exercicios.push({ id: e.id, nome: e.nome, faixa: `${e.min}–${e.max}`, series: feitas, proxima })
    })
    if (!exercicios.length) return toast('Marque pelo menos uma série com ✓ antes de concluir')
    if (faltando && !confirm(`${faltando === 1 ? '1 série ficou' : `${faltando} séries ficaram`} sem ✓ e fica${faltando === 1 ? '' : 'm'} fora do registro. Concluir mesmo assim?`)) return
    const cardio = tr.cardio && d.cardioFeito ? T.lerReps(d.cardio) || T.lerReps(info.cardio) : null
    const sessao = { memberId: me, plano: plano.id, treino: d.treino, data: d.data, semana, fase: info.fase, exercicios, cardio, diaLeve: !!(plano.diaLeve && d.diaLeve) }
    sessao.registro = T.formatarRegistro(sessao, plano)
    const salva = save('treinoSessao', sessao)
    update(programa.id, { proximo: T.proximaLetra(d.treino) })
    remove(rascId(me))
    pararDescanso()
    recomecar(novoRascunho(me, T.proximaLetra(d.treino)))
    setResumo(salva)
    window.scrollTo(0, 0)
  }

  const velho = d.data !== today() && temDados(d)
  const total = tr.exercicios.reduce((n, e) => n + seriesDe(e).length, 0)
  const feitas = tr.exercicios.reduce((n, e) => n + seriesDe(e).filter((s) => s.feito).length, 0)

  return (
    <>
      <Descanso />
      <section className="card tr-top">
        <div className="tr-top-row">
          <b className="tr-sem">
            Semana {semana}
            {semana <= plano.bloco ? ` de ${plano.bloco}` : ''}
          </b>
          <span className="muted"> · {info.fase}</span>
          {atualSemana.ciclo && <span className="muted"> · treino {atualSemana.treino} de {T.TREINOS_POR_SEMANA}</span>}
          <span className="grow" />
          <span className="muted small">
            {feitas}/{total} séries
          </span>
        </div>
        <div className="tr-chips">
          <span>{info.seriesTxt}</span>
          <span>RIR {info.rir}</span>
          {tr.cardio && <span>cardio {info.cardio}</span>}
          {info.deload && <span>mesma carga ou −10%</span>}
        </div>
        <div className="tr-fila" role="group" aria-label="Fila de treinos">
          {T.LETRAS.map((l) => (
            <button key={l} type="button" className={'tr-fila-b' + (l === d.treino ? ' on' : '')} aria-pressed={l === d.treino} onClick={() => trocar(l)}>
              <b>{l}</b>
              <small>{l === programa.proximo ? 'próximo' : plano.treinos[l].nome}</small>
            </button>
          ))}
        </div>
        <h2 className="tr-titulo">
          Treino {d.treino} · {tr.nome}, {tr.foco}
        </h2>
      </section>

      {info.fim && (
        <div className="card warn">
          <b>Fim do bloco de {plano.bloco} semanas</b>
          <p className="small">Peça ao Claude o próximo bloco. {plano.fimTxt}</p>
        </div>
      )}
      {velho && (
        <div className="card warn">
          <b>Treino começado em {T.dataBR(d.data)} e não concluído</b>
          <p className="small">Se concluir agora, ele fica com a data de {T.dataBR(d.data)}.</p>
          <div className="row">
            <button className="btn ghost small" onClick={descartar}>
              Descartar e começar hoje
            </button>
          </div>
        </div>
      )}

      <section className="card tr-aquec">
        <h3>Aquecimento</h3>
        {['5 min de bike ou esteira', `Séries leves de ${tr.exercicios[0].nome.toLowerCase()}, sem contar no treino`].map((txt, i) => (
          <label key={i} className="check">
            <input
              type="checkbox"
              checked={!!d.aquecimento?.[i]}
              onChange={() =>
                mudar((cur) => {
                  const a = [...(cur.aquecimento || [false, false])]
                  a[i] = !a[i]
                  return { ...cur, aquecimento: a }
                })
              }
            />{' '}
            {txt}
          </label>
        ))}
      </section>

      {plano.diaLeve && (
        <label className={'card check tr-leve' + (d.diaLeve ? ' on' : '')}>
          <input type="checkbox" checked={!!d.diaLeve} onChange={() => mudar((cur) => ({ ...cur, diaLeve: !cur.diaLeve }))} />
          <span>
            <b>Dia de pouca energia</b>
            <small className="muted">Ex.: menstruação. Use a carga que der para cumprir o RIR; a meta da próxima vez não muda.</small>
          </span>
        </label>
      )}

      {tr.exercicios.map((e, idx) => {
        const series = seriesDe(e)
        const meta = metas[e.id]
        return (
          <Exercicio
            key={e.id}
            e={e}
            n={idx + 1}
            series={series}
            info={info}
            barra={barra}
            meta={metaTexto(meta, e, info, series.length, barra)}
            ultima={T.ultimaVez(sessoes, d.treino, e.id)}
            letra={d.treino}
            kgPh={(i) => kgSugerido(series, i, meta)}
            repsPh={(i) => T.repsAlvo(meta, e, i)}
            onCampo={(i, campos) => mudarSerie(e, i, campos)}
            onMarcar={(i) => marcar(e, idx, i)}
          />
        )
      })}

      {tr.cardio && (
        <section className={'card tr-cardio' + (d.cardioFeito ? ' completo' : '')}>
          <h3>Cardio · {info.cardio}</h3>
          <p className="muted small">Esteira, bike ou elíptico, num ritmo em que ainda dá para conversar.</p>
          <div className="tr-cardio-row">
            <input
              className="tr-in"
              inputMode="numeric"
              placeholder={String(T.lerReps(info.cardio))}
              value={d.cardio}
              onChange={(ev) => mudar((cur) => ({ ...cur, cardio: ev.target.value }))}
              aria-label="Minutos de cardio"
            />
            <span className="muted">min</span>
            <button
              type="button"
              className={'tr-ok' + (d.cardioFeito ? ' on' : '')}
              aria-label={d.cardioFeito ? 'Desmarcar cardio' : 'Marcar cardio feito'}
              onClick={() => mudar((cur) => ({ ...cur, cardioFeito: !cur.cardioFeito, cardio: cur.cardio || String(T.lerReps(info.cardio)) }))}
            >
              <Icon name="check" />
            </button>
          </div>
        </section>
      )}

      {plano.cardioSemanal && <CardioSemana programa={programa} plano={plano} sessoes={sessoes} semana={semana} />}

      <button className="btn primary big" onClick={concluir}>
        Concluir treino {d.treino}
      </button>
      <p className="muted small center">Salva o treino, mostra a meta da próxima vez e passa a fila para o treino {T.proximaLetra(d.treino)}.</p>

      {resumo && (
        <Modal title={`Treino ${resumo.treino} concluído 🎉`} onClose={() => setResumo(null)}>
          <p className="muted small">
            Semana {resumo.semana} · {resumo.fase} · próximo da fila: treino {T.proximaLetra(resumo.treino)}
          </p>
          <ul className="tr-resumo">
            {resumo.exercicios.map((e) => (
              <li key={e.id}>
                <b>{e.nome}</b>
                <span className="muted small">{T.formatarSeries(e.series)}</span>
                <span className="tr-prox">→ próximo: {e.proxima?.texto || '—'}</span>
              </li>
            ))}
          </ul>
          {resumo.cardio ? <p className="small">Cardio: {resumo.cardio} min</p> : null}
          <div className="row">
            <button className="btn primary" onClick={() => copiar(resumo.registro)}>
              Copiar registro
            </button>
            <span className="grow" />
            <button className="btn ghost" onClick={() => setResumo(null)}>
              Fechar
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function Exercicio({ e, n, series, info, barra, meta, ultima, letra, kgPh, repsPh, onCampo, onMarcar }) {
  const unidade = e.equip === 'barra' ? `${T.EQUIP.barra} (${T.fmtKg(barra)} kg)` : T.EQUIP[e.equip]
  const feitas = series.filter((s) => s.feito).length
  return (
    <section className={'card tr-ex' + (feitas === series.length ? ' completo' : '')}>
      <header className="tr-ex-head">
        <span className="tr-ex-n">{n}</span>
        <div className="grow">
          <h3>{e.nome}</h3>
          <div className="muted small">
            {series.length}×{e.min}–{e.max}
            {e.porPerna ? ` por ${e.lado}` : ''} · descanso {T.mmss(e.desc)} · {T.incTxt(e)}
          </div>
        </div>
        <span className="tr-count">
          {feitas}/{series.length}
        </span>
      </header>
      {e.semFalha && <span className="tr-tag">Nunca até a falha</span>}
      <p className="tr-meta">{meta}</p>
      <p className="tr-ultima">
        {ultima ? (
          <>
            <span className="muted">Última vez ({T.dataBR(ultima.data).slice(0, 5)}{ultima.treino !== letra ? `, treino ${ultima.treino}` : ''}{ultima.diaLeve ? ', dia leve' : ''}):</span> <b>{ultima.texto}</b>
          </>
        ) : (
          <span className="muted">Primeira vez neste exercício: ainda não há carga registrada.</span>
        )}
      </p>
      <details className="tr-dica">
        <summary>Como fazer</summary>
        <p>{e.dica}</p>
      </details>
      <div className="tr-sets">
        <div className="muted small">
          {unidade}
          {e.porPerna ? ` · repetições por ${e.lado}` : ''}
        </div>
        {series.map((s, i) => {
          const aviso = s.feito ? T.avaliarRir(e, s.rir, info) : null
          return (
            <div key={i} className={'tr-set' + (s.feito ? ' feito' : '')}>
              <span className="tr-set-n">{i + 1}</span>
              {e.corpo ? (
                <span className="tr-corpo">corpo</span>
              ) : (
                <input className="tr-in" inputMode="decimal" placeholder={kgPh(i)} value={s.kg} onChange={(ev) => onCampo(i, { kg: ev.target.value })} aria-label={`${e.nome}: carga da série ${i + 1}`} />
              )}
              <span className="tr-x">×</span>
              <input className="tr-in" inputMode="numeric" placeholder={repsPh(i)} value={s.reps} onChange={(ev) => onCampo(i, { reps: ev.target.value })} aria-label={`${e.nome}: repetições da série ${i + 1}`} />
              <button type="button" className={'tr-ok' + (s.feito ? ' on' : '')} onClick={() => onMarcar(i)} aria-label={s.feito ? `Desmarcar série ${i + 1}` : `Série ${i + 1} feita`}>
                <Icon name="check" />
              </button>
              {s.feito && s.rir == null && (
                <div className="tr-rir">
                  <span className="small">Sobraram quantas repetições?</span>
                  <div className="tr-rir-opts">
                    {[0, 1, 2, 3, 4, 5].map((v) => (
                      <button key={v} type="button" onClick={() => onCampo(i, { rir: v })}>
                        {v === 5 ? '5+' : v}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {aviso && (
                <div className={'tr-fb ' + aviso.tipo}>
                  <button type="button" className="tr-rir-chip" onClick={() => onCampo(i, { rir: null })} aria-label="Mudar quantas sobraram">
                    sobraram {s.rir >= 5 ? '5+' : s.rir}
                  </button>
                  <span>{aviso.texto}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---------- histórico ----------
function Historico({ programa, plano }) {
  const st = useStore()
  const sessoes = minhasSessoes(st, plano)
  const barra = programa.barra ?? T.BARRA_PADRAO
  const [aberta, setAberta] = useState(null)
  const [importando, setImportando] = useState(false)

  const apagar = (s) => {
    if (!confirm(`Apagar o treino ${s.treino} de ${T.dataBR(s.data)}?`)) return
    remove(s.id)
    toast('Treino apagado', { label: 'Desfazer', run: () => save('treinoSessao', { ...s, deleted: false }) })
  }

  return (
    <>
      <button className="btn ghost" onClick={() => setImportando(true)}>
        📥 Importar registro
      </button>

      <h3 className="section-title">Cargas atuais</h3>
      {T.LETRAS.map((l) => {
        const ultima = sessoes.find((s) => s.treino === l)
        return (
          <section key={l} className="card tr-cargas">
            <h3>
              Treino {l} · {plano.treinos[l].nome}
              <small className="muted"> · {ultima ? `último em ${T.dataBR(ultima.data)}` : 'ainda não feito'}</small>
            </h3>
            {plano.treinos[l].exercicios.map((e) => {
              const m = T.metaAtual(e, l, sessoes, barra, plano)
              return (
                <div key={e.id} className="tr-carga">
                  <span>{e.nome}</span>
                  <b>{m.acao === 'achar' ? (m.kg != null ? `~${T.fmtKg(m.kg)} kg (treino ${m.origem})` : '—') : m.texto}</b>
                </div>
              )
            })}
          </section>
        )
      })}

      <h3 className="section-title">Sessões ({sessoes.length})</h3>
      {sessoes.length === 0 && <Empty icon="🏋️" text="Nenhum treino concluído ainda. Termine o primeiro ou importe um registro." />}
      {sessoes.map((s) => {
        const texto = s.registro || T.formatarRegistro(s, plano)
        const open = aberta === s.id
        return (
          <section key={s.id} className="card tr-sessao">
            <button type="button" className="tr-sessao-head" onClick={() => setAberta(open ? null : s.id)} aria-expanded={open}>
              <span className="tr-letra">{s.treino}</span>
              <span className="grow">
                <b>{T.dataBR(s.data)}</b>
                <span className="muted small">
                  {' '}
                  · semana {s.semana} · {s.fase}
                  {s.importado ? ' · importado' : ''}
                </span>
              </span>
              <span className="muted">{open ? '▴' : '▾'}</span>
            </button>
            {open && (
              <>
                <pre className="tr-reg">{texto}</pre>
                <div className="row">
                  <button className="btn ghost small" onClick={() => copiar(texto)}>
                    Copiar
                  </button>
                  <span className="grow" />
                  <button className="btn danger small" onClick={() => apagar(s)}>
                    Apagar
                  </button>
                </div>
              </>
            )}
          </section>
        )
      })}
      {importando && <Importar programa={programa} plano={plano} sessoes={sessoes} onClose={() => setImportando(false)} />}
    </>
  )
}

// Cola um ou mais registros ("REGISTRO DE TREINO (...)") e transforma em sessões de quem está usando.
function Importar({ programa, plano, sessoes, onClose }) {
  const st = useStore()
  const [texto, setTexto] = useState('')
  const [avisos, setAvisos] = useState([])
  const barra = programa.barra ?? T.BARRA_PADRAO

  const importar = () => {
    const { sessoes: lidas, avisos: av } = T.lerRegistros(texto, plano)
    setAvisos(av)
    if (!lidas.length) return
    const todas = [...sessoes]
    const novas = []
    let repetidas = 0
    for (const l of [...lidas].sort((a, b) => a.data.localeCompare(b.data))) {
      if (todas.some((s) => s.treino === l.treino && s.data === l.data)) {
        repetidas++
        continue
      }
      const semana = l.semana || T.semanaDe(programa.inicio, l.data)
      const info = T.semanaInfo(semana, plano)
      const exercicios = l.exercicios.map(({ def, proximaTxt, ...e }) => {
        let proxima = proximaTxt ? T.lerProxima(proximaTxt, e.series) : null
        if (!proxima && def) proxima = T.calcProxima(def, e.series, info, T.anteriorDe(todas, l.treino, e.id, l.data)?.series, barra)
        return { ...e, proxima }
      })
      const salva = save('treinoSessao', { memberId: st.me, plano: plano.id, treino: l.treino, data: l.data, semana, fase: info.fase, exercicios, cardio: l.cardio, diaLeve: l.diaLeve, registro: l.registro, importado: true })
      todas.push(salva)
      novas.push(salva)
    }
    // A fila só anda se o treino importado for o mais recente.
    const maisNova = [...novas].sort((a, b) => b.data.localeCompare(a.data))[0]
    if (maisNova && (!sessoes[0] || maisNova.data >= sessoes[0].data)) update(programa.id, { proximo: T.proximaLetra(maisNova.treino) })
    const partes = novas.length ? [novas.length === 1 ? '1 treino importado' : `${novas.length} treinos importados`] : ['Nada novo para importar']
    if (maisNova && (!sessoes[0] || maisNova.data >= sessoes[0].data)) partes.push(`próximo: treino ${T.proximaLetra(maisNova.treino)}`)
    if (repetidas) partes.push(repetidas === 1 ? 'esse treino já estava no histórico' : `${repetidas} já estavam no histórico`)
    toast(partes.join(' · '))
    if (novas.length && !av.length) onClose()
  }

  return (
    <Modal title="Importar registro" onClose={onClose}>
      <p className="muted small">Cole um ou mais textos que começam com “REGISTRO DE TREINO (data) · Treino X”. Cada um vira uma sessão sua.</p>
      <textarea rows={9} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'REGISTRO DE TREINO (dd/mm/aaaa) · Treino A: Inferior · semana 1 de 8\nAgachamento livre: 20 kg × 8, 8 (RIR 4, 3) → próximo: 20 kg × 9, 8, 8'} />
      {avisos.length > 0 && (
        <ul className="tr-avisos">
          {avisos.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
      <div className="row">
        <span className="grow" />
        <button className="btn primary" onClick={importar} disabled={!texto.trim()}>
          Importar
        </button>
      </div>
    </Modal>
  )
}

// ---------- cardio da semana (planos com meta semanal) ----------
const TIPOS_CARDIO = ['Corrida', 'Caminhada', 'Esteira', 'Bike', 'Escada', 'Elíptico', 'Outro']

function CardioSemana({ programa, plano, sessoes, semana }) {
  const st = useStore()
  const [aberto, setAberto] = useState(false)
  const [min, setMin] = useState('')
  const [tipo, setTipo] = useState('Corrida')
  // A meta segue a semana do plano; os minutos contam nos 7 dias corridos desde a data de início.
  const [de, ate] = T.datasDaSemana(programa.inicio, T.semanaDe(programa.inicio, today()))
  const meta = T.semanaInfo(semana, plano).cardioSemana || 0
  const naSemana = (data) => data >= de && data <= ate
  const avulsos = list(st, 'treinoCardio')
    .filter((c) => c.memberId === st.me && naSemana(c.data))
    .sort((a, b) => a.data.localeCompare(b.data))
  const doTreino = sessoes.filter((s) => naSemana(s.data)).reduce((t, s) => t + (s.cardio || 0), 0)
  const total = doTreino + avulsos.reduce((t, c) => t + (c.minutos || 0), 0)
  const registrar = (e) => {
    e.preventDefault()
    const minutos = T.lerReps(min)
    if (!minutos) return toast('Coloque os minutos')
    save('treinoCardio', { memberId: st.me, data: today(), minutos, tipo })
    setMin('')
    setAberto(false)
    toast(`${tipo}: ${minutos} min registrados`)
  }
  return (
    <section className={'card tr-cardio-sem' + (total >= meta ? ' completo' : '')}>
      <div className="tr-top-row">
        <h3>Cardio da semana</h3>
        <span className="grow" />
        <b>
          {total} de {meta} min
        </b>
      </div>
      <div className="tr-timer-bar">
        <i style={{ width: `${Math.min(100, meta ? (total / meta) * 100 : 0)}%` }} />
      </div>
      <p className="muted small">
        Moderado: dá para falar frases curtas, mas não cantar. Conta o cardio dos treinos e o que você registrar aqui ({T.dataBR(de).slice(0, 5)} a {T.dataBR(ate).slice(0, 5)}). O jiu-jitsu não entra.
      </p>
      {avulsos.map((c) => (
        <div key={c.id} className="tr-carga">
          <span>
            {T.dataBR(c.data).slice(0, 5)} · {c.tipo}
          </span>
          <span>
            <b>{c.minutos} min</b>{' '}
            <button type="button" className="icon-btn small" onClick={() => remove(c.id)} aria-label={`Apagar ${c.tipo} de ${T.dataBR(c.data)}`}>
              ✕
            </button>
          </span>
        </div>
      ))}
      {aberto ? (
        <form className="tr-cardio-form" onSubmit={registrar}>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de cardio">
            {TIPOS_CARDIO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input className="tr-in" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} placeholder="min" aria-label="Minutos" autoFocus />
          <button className="btn primary">Salvar</button>
        </form>
      ) : (
        <button type="button" className="btn ghost small" onClick={() => setAberto(true)}>
          + Registrar cardio (corrida, bike…)
        </button>
      )}
    </section>
  )
}

// ---------- plano ----------
function ResumoTreinos({ plano, barra }) {
  return T.LETRAS.map((l) => {
    const t = plano.treinos[l]
    return (
      <details key={l} className="tr-plano-t">
        <summary>
          <b>Treino {l}</b> · {t.nome}, {t.foco}
        </summary>
        <ol>
          {t.exercicios.map((e) => (
            <li key={e.id}>
              <b>{e.nome}</b>{' '}
              <span className="muted small">
                {e.series}×{e.min}–{e.max}
                {e.porPerna ? ` por ${e.lado}` : ''} · descanso {T.mmss(e.desc)} · {T.incTxt(e)}
                {e.semFalha ? ' · nunca até a falha' : ''}
              </span>
              <p className="small">{e.dica}</p>
            </li>
          ))}
        </ol>
        {l === 'A' && <p className="muted small">Carga de barra = total, contando a barra ({T.fmtKg(barra)} kg). Halter = cada halter. Leg press: só as anilhas, sem o carrinho.</p>}
      </details>
    )
  })
}

function Plano({ programa, plano }) {
  const st = useStore()
  const sessoes = minhasSessoes(st, plano)
  const barra = programa.barra ?? T.BARRA_PADRAO
  const [barraTxt, setBarraTxt] = useState(T.fmtKg(barra))
  const [proteinaTxt, setProteinaTxt] = useState(programa.proteina ? String(programa.proteina) : '')
  const atual = T.semanaAtual(programa, plano, sessoes)
  const hoje = atual.semana
  const porCiclo = atual.ciclo
  const N = T.TREINOS_POR_SEMANA
  const curta = (s) => T.dataBR(s).slice(0, 5)
  const trocarPlano = (id) => {
    if (id === plano.id) return
    if (!confirm(`Trocar para o plano “${T.PLANOS[id].nome}”? A fila volta para o treino A. O histórico do plano atual continua guardado.`)) return
    update(programa.id, { plano: id, proximo: 'A' })
  }
  return (
    <>
      <section className="card form">
        <h3>Seu programa</h3>
        <Field label="Plano">
          <select value={plano.id} onChange={(e) => trocarPlano(e.target.value)}>
            {Object.values(T.PLANOS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data de início">
          <input type="date" value={programa.inicio} onChange={(e) => e.target.value && update(programa.id, { inicio: e.target.value })} />
        </Field>
        <Field label="Peso da barra da sua academia (kg)">
          <input
            inputMode="decimal"
            value={barraTxt}
            onChange={(e) => setBarraTxt(e.target.value)}
            onBlur={() => {
              const v = T.lerKg(barraTxt)
              if (v != null && v !== barra) update(programa.id, { barra: v })
            }}
          />
        </Field>
        {plano.cardioSemanal && (
          <Field label="Meta de proteína por dia (g)">
            <input
              inputMode="numeric"
              value={proteinaTxt}
              placeholder="ex.: 1,6 a 2 g por kg do peso-meta"
              onChange={(e) => setProteinaTxt(e.target.value)}
              onBlur={() => update(programa.id, { proteina: T.lerReps(proteinaTxt) })}
            />
          </Field>
        )}
        <Field label="Como contar as semanas">
          <select value={T.modoSemana(programa, plano)} onChange={(e) => update(programa.id, { semanaPor: e.target.value })}>
            <option value="ciclo">A cada {N} treinos concluídos (A, B, C e D)</option>
            <option value="data">Pela data de início (a cada 7 dias)</option>
          </select>
        </Field>
        <p className="muted small">
          Fila A → B → C → D → A: faltou um dia, faz o próximo. Agora é a vez do treino {programa.proximo}
          {porCiclo ? ` (treino ${atual.treino} de ${N} da semana ${hoje})` : ''}.
        </p>
      </section>

      <section className="card">
        <h3>Cronograma</h3>
        <div className="tr-crono">
          {Array.from({ length: plano.bloco }, (_, k) => k + 1).map((n) => {
            const i = T.semanaInfo(n, plano)
            const [a, b] = T.datasDaSemana(programa.inicio, n)
            return (
              <div key={n} className={'tr-crono-row' + (n === hoje ? ' on' : '')}>
                <b>Semana {n}</b>
                <span className="muted small">{porCiclo ? `treinos ${(n - 1) * N + 1} a ${n * N}` : `${curta(a)} a ${curta(b)}`}</span>
                <span className="small">
                  {i.fase} · {i.seriesTxt} · RIR {i.rir} · {i.cardioSemana ? `cardio ${i.cardioSemana} min na semana` : `cardio ${i.cardio}`}
                  {i.deload ? ' · mesma carga ou 10% menos' : ''}
                </span>
              </div>
            )
          })}
          <div className={'tr-crono-row' + (hoje > plano.bloco ? ' on' : '')}>
            <b>Depois</b>
            <span className="muted small">{porCiclo ? `a partir do treino ${plano.bloco * N + 1}` : `a partir de ${curta(T.datasDaSemana(programa.inicio, plano.bloco + 1)[0])}`}</span>
            <span className="small">Fim do bloco: peça ao Claude o próximo.</span>
          </div>
        </div>
      </section>

      <section className="card tr-regras">
        <h3>Regras</h3>
        <ul>
          {plano.regras.map((r) => (
            <li key={r}>{r}</li>
          ))}
          <li>Meta da próxima vez, pela carga da última série: 2 ou mais séries no topo da faixa, sem RIR abaixo da janela → sobe o incremento e volta ao começo da faixa. No topo, mas pesado → repete a carga. Dentro da faixa → mesma carga e +1 repetição na série mais baixa. Abaixo do mínimo → mesma carga; se acontecer de novo, 10% a menos.</li>
          <li>Carga de barra = total, contando a barra. Halter = cada halter.</li>
        </ul>
      </section>

      <section className="card">
        <h3>Os treinos</h3>
        <ResumoTreinos plano={plano} barra={barra} />
      </section>

      {plano.cardio && (
        <section className="card tr-regras">
          <h3>Cardio</h3>
          <ul>
            {plano.cardio.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card tr-regras">
        <h3>Alimentação</h3>
        <ul>
          {plano.alimentacao(programa).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="card warn tr-regras">
        <h3>Dor: quando parar</h3>
        <ul>
          {plano.dor.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
    </>
  )
}
