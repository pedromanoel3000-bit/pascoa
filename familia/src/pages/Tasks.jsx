import { useState } from 'react'
import { byId, list, remove, save, update, useStore } from '../store.js'
import { comResponsaveis, describeRepeat, finalizeRepeat, fmtDate, nextTaskDue, responsaveis, today } from '../utils.js'
import { Avatar, Empty, Fab, Field, MemberPicker, Modal, PageHeader, Segmented, useMembers, useNewIntent } from '../ui.jsx'
import { Swipe, toast, vibrate } from '../toast.jsx'
import RepeatField from './Repeat.jsx'

// Na escala, a próxima vez vai para a pessoa seguinte da lista.
export function nextAssignee(task) {
  const r = task.rotation || []
  const atual = responsaveis(task)[0] || null
  if (r.length < 2) return atual
  const i = r.indexOf(atual)
  return r[(i + 1) % r.length]
}

// Quem fica com a próxima vez de uma tarefa repetida: na escala, a pessoa seguinte; sem escala, os mesmos responsáveis.
const proximosResponsaveis = (task) => ((task.rotation || []).length > 1 ? [nextAssignee(task)] : responsaveis(task))

// Concluir (ou reabrir) uma tarefa. Se ela se repete, cria a próxima vez.
// Devolve o novo prazo, ou null quando a repetição terminou.
export function toggleTask(task, me) {
  let nextDue
  if (!task.done && task.repeat && task.repeat !== 'none') {
    nextDue = nextTaskDue(task)
    if (nextDue) save('task', { ...task, id: undefined, createdAt: undefined, createdBy: undefined, done: false, doneBy: null, doneAt: null, due: nextDue, ...comResponsaveis(proximosResponsaveis(task)) })
  }
  update(task.id, task.done ? { done: false } : { done: true, doneBy: me, doneAt: Date.now(), repeat: 'none', rule: null, rotation: [] })
  return nextDue
}

export default function Tasks() {
  const st = useStore()
  const members = useMembers()
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  useNewIntent(() => setEditing({}))
  let tasks = list(st, 'task')
  if (filter === 'mine') tasks = tasks.filter((t) => responsaveis(t).includes(st.me))
  const open = tasks.filter((t) => !t.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
  const done = tasks
    .filter((t) => t.done)
    .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0))
    .slice(0, 20)

  // Placar: tarefas concluídas por pessoa nos últimos 7 dias.
  const week = Date.now() - 7 * 86400000
  const score = members
    .map((m) => ({ m, n: list(st, 'task').filter((t) => t.done && t.doneBy === m.id && t.doneAt > week).reduce((s, t) => s + (Number(t.points) || 1), 0) }))
    .sort((a, b) => b.n - a.n)

  return (
    <div className="page">
      <PageHeader title="Tarefas">
        <Segmented options={[['all', 'Todas'], ['mine', 'Minhas']]} value={filter} onChange={setFilter} />
      </PageHeader>

      <div className="card score">
        <h3>🏆 Pontos da semana</h3>
        <div className="score-row">
          {score.map(({ m, n }) => (
            <div key={m.id} className="score-item">
              <Avatar member={m} size={40} />
              <b>{n}</b>
              <small>{m.name}</small>
            </div>
          ))}
        </div>
      </div>

      {open.length === 0 && <Empty icon="✅" text="Nenhuma tarefa pendente." />}
      {open.map((t) => (
        <TaskRow key={t.id} task={t} onOpen={() => setEditing(t)} />
      ))}
      {done.length > 0 && <h3 className="section-title">Concluídas</h3>}
      {done.map((t) => (
        <TaskRow key={t.id} task={t} onOpen={() => setEditing(t)} />
      ))}
      <Fab onClick={() => setEditing({})} label="Nova tarefa" />
      {editing && <TaskForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function TaskRow({ task, onOpen }) {
  const st = useStore()
  const late = !task.done && task.due && task.due < today()
  const next = !task.done && task.rotation?.length > 1 ? byId(st, nextAssignee(task)) : null
  const toggle = () => {
    const nextDue = toggleTask(task, st.me)
    if (!task.done) {
      vibrate()
      toast(nextDue === null ? `“${task.title}” concluída 🎉 Era a última vez da repetição.` : `“${task.title}” concluída 🎉`)
    }
  }
  const del = () => {
    const before = task
    remove(task.id)
    toast('Tarefa apagada', { label: 'Desfazer', run: () => save('task', { ...before, deleted: false }) })
  }
  return (
    <Swipe className="task-swipe" onRight={toggle} onLeft={del} rightLabel={task.done ? 'Reabrir' : 'Concluir'}>
      <div className={'card task-row' + (task.done ? ' done' : '')}>
        <input type="checkbox" checked={!!task.done} onChange={toggle} aria-label={task.title} />
        <button className="grow task-main" onClick={onOpen}>
          <b>{task.title}</b>
          <span className={'small ' + (late ? 'late' : 'muted')}>
            {task.due && `📅 ${fmtDate(task.due)}`} {task.repeat && task.repeat !== 'none' && `🔁 ${describeRepeat(task)}`} {task.points > 1 && `⭐ ${task.points}`} {next && `🔄 depois: ${next.name}`}
          </span>
        </button>
        <Responsaveis ids={responsaveis(task)} size={30} />
      </div>
    </Swipe>
  )
}

/** Fotos dos responsáveis, uma sobre a outra (até 3; depois mostra +N). */
export function Responsaveis({ ids, size = 24 }) {
  const st = useStore()
  const pessoas = ids.map((id) => byId(st, id)).filter(Boolean)
  if (!pessoas.length) return null
  const nomes = pessoas.map((m) => m.name).join(', ')
  const extra = pessoas.length > 3 ? pessoas.length - 2 : 0
  return (
    <span className="avatars resp" title={nomes} aria-label={`Responsáveis: ${nomes}`}>
      {pessoas.slice(0, extra ? 2 : 3).map((m) => (
        <Avatar key={m.id} member={m} size={size} />
      ))}
      {extra > 0 && (
        <span className="resp-mais" style={{ width: size, height: size }}>
          +{extra}
        </span>
      )}
    </span>
  )
}

function TaskForm({ initial, onClose }) {
  const [t, setT] = useState(() => {
    const base = { title: '', due: '', repeat: 'none', points: 1, notes: '', ...initial }
    return { ...base, assignees: responsaveis(base) }
  })
  const set = (k) => (e) => setT({ ...t, [k]: e.target.value })
  const rotating = t.repeat !== 'none'
  const escala = rotating && (t.rotation || []).length > 1
  const submit = (e) => {
    e.preventDefault()
    const rotation = rotating ? t.rotation || [] : []
    // Com escala, cada vez é de uma pessoa só: a que está na vez (ou a primeira da escala).
    const quem = rotation.length > 1 ? [t.assignees.find((id) => rotation.includes(id)) || rotation[0]] : t.assignees
    // Tarefa repetida precisa de um prazo para saber quando é a próxima vez.
    const due = t.repeat !== 'none' && !t.due ? today() : t.due
    save('task', { ...t, rotation, ...comResponsaveis(quem), due, ...finalizeRepeat(t.repeat, t.rule, due) })
    onClose()
  }
  return (
    <Modal title={t.id ? 'Editar tarefa' : 'Nova tarefa'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="O que precisa ser feito">
          <input value={t.title} onChange={set('title')} required autoFocus placeholder="Levar o lixo para fora" />
        </Field>
        <Field label={escala ? 'Responsável desta vez' : 'Responsáveis (toque em quantas pessoas quiser)'}>
          <MemberPicker single={escala} value={escala ? t.assignees.slice(0, 1) : t.assignees} onChange={(assignees) => setT({ ...t, assignees })} />
        </Field>
        <div className="row2">
          <Field label="Prazo">
            <input type="date" value={t.due} onChange={set('due')} />
          </Field>
          <Field label="Pontos">
            <input type="number" min="1" max="100" value={t.points} onChange={set('points')} />
          </Field>
        </div>
        <RepeatField repeat={t.repeat} rule={t.rule} anchor={t.due || today()} onChange={(repeat, rule) => setT({ ...t, repeat, rule })} />
        {rotating && (
          <Field label="Escala: revezar entre (toque na ordem do revezamento)">
            <MemberPicker
              value={t.rotation || []}
              onChange={(rotation) => {
                const naVez = t.assignees.find((id) => rotation.includes(id))
                setT({ ...t, rotation, assignees: rotation.length > 1 ? [naVez || rotation[0]] : t.assignees })
              }}
            />
            {(t.rotation || []).length > 1 && <RotationPreview rotation={t.rotation} />}
          </Field>
        )}
        <Field label="Observações">
          <textarea value={t.notes} onChange={set('notes')} rows={2} />
        </Field>
        <div className="row">
          {t.id && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                remove(t.id)
                onClose()
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

function RotationPreview({ rotation }) {
  const st = useStore()
  return (
    <p className="muted small rotation">
      Ordem: {rotation.map((id) => byId(st, id)?.name).filter(Boolean).join(' → ')} → de novo
    </p>
  )
}
