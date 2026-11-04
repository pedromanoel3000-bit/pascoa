import { useState } from 'react'
import { byId, list, remove, save, update, useStore } from '../store.js'
import { describeRepeat, finalizeRepeat, fmtDate, nextTaskDue, today } from '../utils.js'
import { Avatar, Empty, Fab, Field, MemberPicker, Modal, PageHeader, Segmented, useMembers, useNewIntent } from '../ui.jsx'
import { Swipe, toast, vibrate } from '../toast.jsx'
import RepeatField from './Repeat.jsx'

// Na escala, a próxima vez vai para a pessoa seguinte da lista.
export function nextAssignee(task) {
  const r = task.rotation || []
  if (r.length < 2) return task.assignee
  const i = r.indexOf(task.assignee)
  return r[(i + 1) % r.length]
}

// Concluir (ou reabrir) uma tarefa. Se ela se repete, cria a próxima vez.
// Devolve o novo prazo, ou null quando a repetição terminou.
export function toggleTask(task, me) {
  let nextDue
  if (!task.done && task.repeat && task.repeat !== 'none') {
    nextDue = nextTaskDue(task)
    if (nextDue) save('task', { ...task, id: undefined, createdAt: undefined, createdBy: undefined, done: false, doneBy: null, doneAt: null, due: nextDue, assignee: nextAssignee(task) })
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
  if (filter === 'mine') tasks = tasks.filter((t) => t.assignee === st.me)
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
        {task.assignee && <Avatar member={byId(st, task.assignee)} size={30} />}
      </div>
    </Swipe>
  )
}

function TaskForm({ initial, onClose }) {
  const [t, setT] = useState({ title: '', due: '', assignee: null, repeat: 'none', points: 1, notes: '', ...initial })
  const set = (k) => (e) => setT({ ...t, [k]: e.target.value })
  const rotating = t.repeat !== 'none'
  const submit = (e) => {
    e.preventDefault()
    const rotation = rotating ? t.rotation || [] : []
    const assignee = rotation.length > 1 && !rotation.includes(t.assignee) ? rotation[0] : t.assignee
    // Tarefa repetida precisa de um prazo para saber quando é a próxima vez.
    const due = t.repeat !== 'none' && !t.due ? today() : t.due
    save('task', { ...t, rotation, assignee, due, ...finalizeRepeat(t.repeat, t.rule, due) })
    onClose()
  }
  return (
    <Modal title={t.id ? 'Editar tarefa' : 'Nova tarefa'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="O que precisa ser feito">
          <input value={t.title} onChange={set('title')} required autoFocus placeholder="Levar o lixo para fora" />
        </Field>
        <Field label="Responsável">
          <MemberPicker single value={t.assignee ? [t.assignee] : []} onChange={(v) => setT({ ...t, assignee: v[0] || null })} />
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
            <MemberPicker value={t.rotation || []} onChange={(rotation) => setT({ ...t, rotation, assignee: t.assignee && rotation.includes(t.assignee) ? t.assignee : rotation[0] || t.assignee })} />
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
