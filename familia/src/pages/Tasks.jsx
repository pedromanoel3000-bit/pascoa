import { useState } from 'react'
import { byId, list, remove, save, update, useStore } from '../store.js'
import { addDays, fmtDate, parseYmd, today, ymd } from '../utils.js'
import { Avatar, Empty, Fab, Field, MemberPicker, Modal, PageHeader, Segmented, useMembers, useNewIntent } from '../ui.jsx'
import { Swipe, toast, vibrate } from '../toast.jsx'

const REPEAT = { none: 'Não repete', daily: 'Todo dia', weekly: 'Toda semana', monthly: 'Todo mês' }

function nextDue(due, repeat) {
  const base = due || today()
  if (repeat === 'daily') return addDays(base, 1)
  if (repeat === 'weekly') return addDays(base, 7)
  const d = parseYmd(base)
  d.setMonth(d.getMonth() + 1)
  return ymd(d)
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
  const toggle = () => {
    if (!task.done && task.repeat && task.repeat !== 'none') {
      save('task', { ...task, id: undefined, createdAt: undefined, done: false, due: nextDue(task.due, task.repeat) })
    }
    update(task.id, { done: !task.done, doneBy: st.me, doneAt: Date.now(), repeat: task.done ? task.repeat : 'none' })
    if (!task.done) {
      vibrate()
      toast(`“${task.title}” concluída 🎉`)
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
            {task.due && `📅 ${fmtDate(task.due)}`} {task.repeat && task.repeat !== 'none' && `🔁 ${REPEAT[task.repeat]}`} {task.points > 1 && `⭐ ${task.points}`}
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
  const submit = (e) => {
    e.preventDefault()
    save('task', t)
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
        <Field label="Repetir">
          <select value={t.repeat} onChange={set('repeat')}>
            {Object.entries(REPEAT).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
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
