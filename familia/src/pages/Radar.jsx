import { useEffect, useState } from 'react'
import { byId, remove, save, update, useStore } from '../store.js'
import { addDays, today } from '../utils.js'
import { Empty, PageHeader, useMembers } from '../ui.jsx'
import { toast, vibrate } from '../toast.jsx'
import { radar, TIPOS } from '../radar.js'
import { useClima } from '../clima.js'
import { toggleTask } from './Tasks.jsx'
import { addItems } from './Lists.jsx'

const GUARDAR_MS = 90 * 86400000
const dm = (dia) => `${dia.slice(8)}/${dia.slice(5, 7)}`

// Tudo o que o radar precisa: os avisos de agora, os escondidos e as ações.
// O que cada pessoa dispensou, adiou ou desligou fica num item só dela, sincronizado entre os aparelhos.
function useRadar() {
  const st = useStore()
  const membros = useMembers()
  const clima = useClima(membros, byId(st, st.me))
  const [, setTic] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTic((n) => n + 1), 5 * 60000)
    return () => clearInterval(t)
  }, [])

  const id = 'radar-' + st.me
  const guardado = byId(st, id) || {}
  const estado = { vistos: guardado.vistos || {}, adiados: guardado.adiados || {}, desligados: guardado.desligados || [] }
  const gravar = (novo) => {
    const corte = Date.now() - GUARDAR_MS
    const e = { ...estado, ...novo }
    save('radarVisto', {
      id,
      vistos: Object.fromEntries(Object.entries(e.vistos).filter(([, t]) => t > corte)),
      adiados: Object.fromEntries(Object.entries(e.adiados).filter(([, t]) => t > Date.now())),
      desligados: e.desligados,
    })
  }

  const agora = new Date()
  const base = { itens: Object.values(st.items).filter((i) => !i.deleted), eu: st.me, hoje: today(), agoraMin: agora.getHours() * 60 + agora.getMinutes(), previsao: clima?.chuva || null, agora: agora.getTime() }
  const achados = radar({ ...base, ...estado })
  const todos = radar({ ...base, desligados: estado.desligados })
  const escondidos = todos.filter((a) => !achados.some((x) => x.id === a.id)).map((a) => ({ ...a, adiado: estado.adiados[a.id] > agora.getTime() }))

  const dispensar = (a, avisar = true) => {
    const antes = estado
    gravar({ vistos: { ...estado.vistos, [a.id]: Date.now() } })
    if (avisar) toast('Aviso dispensado', { label: 'Desfazer', run: () => gravar(antes) })
  }
  const adiar = (a) => {
    const antes = estado
    const ate = new Date(`${addDays(today(), 1)}T06:00:00`).getTime()
    gravar({ adiados: { ...estado.adiados, [a.id]: ate } })
    toast('Volta a aparecer amanhã', { label: 'Desfazer', run: () => gravar(antes) })
  }
  const trazer = (a) => {
    const { [a.id]: _v, ...vistos } = estado.vistos
    const { [a.id]: _a, ...adiados } = estado.adiados
    gravar({ vistos, adiados })
  }
  const alternarTipo = (tipo) => gravar({ desligados: estado.desligados.includes(tipo) ? estado.desligados.filter((t) => t !== tipo) : [...estado.desligados, tipo] })

  const agir = (a, acao) => {
    vibrate()
    if (acao.tipo === 'ir') return (location.hash = acao.ir)
    const antes = estado
    if (acao.tipo === 'reagendar') {
      const tarefa = byId(st, acao.id)
      update(acao.id, { due: acao.due })
      dispensar(a, false)
      toast(`“${tarefa.title}” ficou para ${dm(acao.due)}`, { label: 'Desfazer', run: () => (update(acao.id, { due: tarefa.due }), gravar(antes)) })
    }
    if (acao.tipo === 'criarTarefa') {
      const nova = save('task', { title: acao.titulo, due: acao.due, assignee: st.me, repeat: 'none', points: 1, notes: '' })
      dispensar(a, false)
      toast(`Tarefa criada para ${dm(acao.due)}`, { label: 'Desfazer', run: () => (remove(nova.id), gravar(antes)) })
    }
    if (acao.tipo === 'concluir') {
      const tarefa = byId(st, acao.id)
      toggleTask(tarefa, st.me)
      toast(`“${tarefa.title}” concluída 🎉`)
    }
    if (acao.tipo === 'adicionarCompras') {
      const novos = addItems(st, acao.listId, acao.titulos.join(', '))
      dispensar(a, false)
      toast(`${novos.length} ${novos.length === 1 ? 'item foi' : 'itens foram'} para a lista 🛒`, { label: 'Desfazer', run: () => (novos.forEach((i) => remove(i.id)), gravar(antes)) })
    }
  }
  return { achados, escondidos, estado, dispensar, adiar, trazer, alternarTipo, agir }
}

function Aviso({ a, r, menor }) {
  return (
    <div className={'radar-aviso' + (menor ? ' menor' : '') + (a.bom ? ' bom' : '')}>
      <span className="radar-ic" aria-hidden="true">
        {a.icone}
      </span>
      <div className="grow">
        <b>{a.titulo}</b>
        <p>{a.texto}</p>
        <div className="radar-acoes">
          {a.acoes.map((ac, i) => (
            <button type="button" key={ac.rotulo} className={'btn' + (i === 0 ? '' : ' ghost')} onClick={() => r.agir(a, ac)}>
              {ac.rotulo}
            </button>
          ))}
          {!a.bom && (
            <button type="button" className="radar-depois" onClick={() => r.adiar(a)} aria-label={`Lembrar amanhã: ${a.titulo}`}>
              Amanhã
            </button>
          )}
        </div>
      </div>
      <button type="button" className="radar-x" aria-label={`Dispensar: ${a.titulo}`} onClick={() => r.dispensar(a)}>
        ×
      </button>
    </div>
  )
}

// Cartão do Início: o aviso mais urgente à vista, os outros recolhidos.
export function RadarCartao() {
  const r = useRadar()
  const [aberto, setAberto] = useState(false)
  if (!r.achados.length) return null
  const [primeiro, ...outros] = r.achados
  return (
    <section className="card radar" aria-label="Radar">
      <div className="radar-topo">
        <span className="radar-pulso" aria-hidden="true" />
        <h3>Radar</h3>
        <span className="muted small grow">o que merece atenção</span>
        <a href="#radar" className="muted small">
          Tudo ›
        </a>
      </div>
      <Aviso a={primeiro} r={r} />
      {outros.length > 0 && (
        <button type="button" className="radar-mais" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
          {aberto ? 'Mostrar menos' : `Mais ${outros.length} no radar`} <span aria-hidden="true">{aberto ? '⌃' : '⌄'}</span>
        </button>
      )}
      {aberto && outros.map((a) => <Aviso key={a.id} a={a} r={r} menor />)}
    </section>
  )
}

// Tela Radar: todos os avisos, os escondidos e o que o radar observa.
export default function RadarPagina() {
  const r = useRadar()
  return (
    <div className="page">
      <a href="#settings" className="voltar">‹ Configurações</a>
      <PageHeader title="Radar" />
      {r.achados.length === 0 && <Empty icon="📡" text="Nada pedindo atenção agora. O radar avisa quando notar alguma coisa." />}
      {r.achados.length > 0 && (
        <section className="card radar" aria-label="Avisos de agora">
          {r.achados.map((a, i) => (
            <Aviso key={a.id} a={a} r={r} menor={i > 0} />
          ))}
        </section>
      )}

      {r.escondidos.length > 0 && (
        <>
          <h3 className="section-title">Adiados e dispensados</h3>
          <section className="card radar-lista">
            {r.escondidos.map((a) => (
              <div key={a.id} className="radar-linha">
                <span aria-hidden="true">{a.icone}</span>
                <div className="grow">
                  <b>{a.titulo}</b>
                  <small className="muted">{a.adiado ? 'Volta amanhã' : 'Dispensado'}</small>
                </div>
                <button type="button" className="btn ghost" onClick={() => r.trazer(a)} aria-label={`Trazer de volta: ${a.titulo}`}>
                  Trazer de volta
                </button>
              </div>
            ))}
          </section>
        </>
      )}

      <h3 className="section-title">O que o radar observa</h3>
      <section className="card radar-lista">
        {TIPOS.map(([tipo, icone, nome, desc]) => {
          const ligado = !r.estado.desligados.includes(tipo)
          return (
            <label key={tipo} className="radar-linha">
              <span aria-hidden="true">{icone}</span>
              <div className="grow">
                <b>{nome}</b>
                <small className="muted">{desc}</small>
              </div>
              <input type="checkbox" className="switch" checked={ligado} onChange={() => r.alternarTipo(tipo)} aria-label={nome} />
            </label>
          )
        })}
      </section>
      <p className="muted small">Estas escolhas valem só para você, em todos os seus aparelhos. Às 19h30 o radar manda no máximo um aviso por dia para o celular; isso se desliga em Notificações.</p>
    </div>
  )
}
