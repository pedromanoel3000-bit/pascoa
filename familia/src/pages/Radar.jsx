import { useEffect, useState } from 'react'
import { byId, remove, save, update, useStore } from '../store.js'
import { today } from '../utils.js'
import { useMembers } from '../ui.jsx'
import { toast, vibrate } from '../toast.jsx'
import { radar } from '../radar.js'
import { useClima } from '../clima.js'

const GUARDAR_MS = 90 * 86400000

// O que cada pessoa já dispensou fica num item só dela, sincronizado entre os aparelhos.
function useVistos() {
  const st = useStore()
  const id = 'radar-' + st.me
  const vistos = byId(st, id)?.vistos || {}
  const gravar = (novo) => {
    const corte = Date.now() - GUARDAR_MS
    save('radarVisto', { id, vistos: Object.fromEntries(Object.entries(novo).filter(([, t]) => t > corte)) })
  }
  return [vistos, gravar]
}

export default function Radar() {
  const st = useStore()
  const membros = useMembers()
  const clima = useClima(membros, byId(st, st.me))
  const [vistos, gravar] = useVistos()
  const [aberto, setAberto] = useState(false)
  const [, setTic] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTic((n) => n + 1), 5 * 60000)
    return () => clearInterval(t)
  }, [])

  const agora = new Date()
  const achados = radar({
    itens: Object.values(st.items).filter((i) => !i.deleted),
    eu: st.me,
    hoje: today(),
    agoraMin: agora.getHours() * 60 + agora.getMinutes(),
    previsao: clima?.chuva || null,
    vistos,
  })
  if (!achados.length) return null

  const dispensar = (a, avisar = true) => {
    const antes = vistos
    gravar({ ...vistos, [a.id]: Date.now() })
    if (avisar) toast('Aviso dispensado', { label: 'Desfazer', run: () => gravar(antes) })
  }
  const agir = (a, acao) => {
    vibrate()
    if (acao.tipo === 'ir') return (location.hash = acao.ir)
    const antes = vistos
    if (acao.tipo === 'reagendar') {
      const tarefa = byId(st, acao.id)
      update(acao.id, { due: acao.due })
      dispensar(a, false)
      toast(`“${tarefa.title}” ficou para ${acao.due.slice(8)}/${acao.due.slice(5, 7)}`, { label: 'Desfazer', run: () => (update(acao.id, { due: tarefa.due }), gravar(antes)) })
    }
    if (acao.tipo === 'criarTarefa') {
      const nova = save('task', { title: acao.titulo, due: acao.due, assignee: st.me, repeat: 'none', points: 1, notes: '' })
      dispensar(a, false)
      toast(`Tarefa criada para ${acao.due.slice(8)}/${acao.due.slice(5, 7)}`, { label: 'Desfazer', run: () => (remove(nova.id), gravar(antes)) })
    }
  }

  const [primeiro, ...outros] = achados
  const Aviso = ({ a, menor }) => (
    <div className={'radar-aviso' + (menor ? ' menor' : '')}>
      <span className="radar-ic" aria-hidden="true">
        {a.icone}
      </span>
      <div className="grow">
        <b>{a.titulo}</b>
        <p>{a.texto}</p>
        <div className="radar-acoes">
          {a.acoes.map((ac, i) => (
            <button type="button" key={ac.rotulo} className={'btn' + (i === 0 ? '' : ' ghost')} onClick={() => agir(a, ac)}>
              {ac.rotulo}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="radar-x" aria-label={`Dispensar: ${a.titulo}`} onClick={() => dispensar(a)}>
        ×
      </button>
    </div>
  )

  return (
    <section className="card radar" aria-label="Radar">
      <div className="radar-topo">
        <span className="radar-pulso" aria-hidden="true" />
        <h3>Radar</h3>
        <span className="muted small">o que merece atenção</span>
      </div>
      <Aviso a={primeiro} />
      {outros.length > 0 && (
        <button type="button" className="radar-mais" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
          {aberto ? 'Mostrar menos' : `Mais ${outros.length} no radar`} <span aria-hidden="true">{aberto ? '⌃' : '⌄'}</span>
        </button>
      )}
      {aberto && outros.map((a) => <Aviso key={a.id} a={a} menor />)}
    </section>
  )
}
