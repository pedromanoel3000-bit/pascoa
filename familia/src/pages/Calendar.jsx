import { useRef, useState } from 'react'
import { byId, list, remove, save, useStore } from '../store.js'
import { addDays, eventsOn, fmtDate, MONTHS, pad, today, WEEKDAYS, ymd } from '../utils.js'
import { Avatar, Fab, Field, MemberPicker, Modal, PageHeader, Segmented, useNewIntent } from '../ui.jsx'

const REPEAT = { none: 'Não repete', daily: 'Todo dia', weekly: 'Toda semana', monthly: 'Todo mês', yearly: 'Todo ano' }
const REMIND = [['none', 'Sem lembrete'], [0, 'Na hora'], [10, '10 minutos antes'], [30, '30 minutos antes'], [60, '1 hora antes'], [120, '2 horas antes'], [1440, '1 dia antes']]

export default function Calendar() {
  const st = useStore()
  const [sel, setSel] = useState(today())
  const [view, setView] = useState('month')
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState([])
  const touch = useRef(null)
  useNewIntent(() => setEditing({ date: today() }))

  const people = [...list(st, 'member'), ...list(st, 'contact')]
  let events = list(st, 'event')
  if (filter.length) events = events.filter((e) => !e.members?.length || e.members.some((m) => filter.includes(m)))
  const dayEvents = (d) => eventsOn(events, people, d)

  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const start = addDays(ymd(first), -first.getDay())
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const shift = (n) => {
    const d = new Date(y, m - 1 + n, 1)
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
  }
  const goToday = () => {
    setSel(today())
    setMonth(today().slice(0, 7))
  }

  return (
    <div className="page">
      <PageHeader title="Agenda">
        <Segmented options={[['month', 'Mês'], ['agenda', 'Próximos']]} value={view} onChange={setView} />
      </PageHeader>
      <MemberPicker value={filter} onChange={setFilter} />

      {view === 'month' ? (
        <>
          <div className="cal-nav">
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mês anterior">
              ‹
            </button>
            <h2>
              {MONTHS[m - 1]} {y}
            </h2>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Próximo mês">
              ›
            </button>
            <button className="btn ghost small" onClick={goToday}>
              Hoje
            </button>
          </div>
          <div
            className="cal-grid"
            onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              const dx = e.changedTouches[0].clientX - (touch.current ?? e.changedTouches[0].clientX)
              if (Math.abs(dx) > 60) shift(dx < 0 ? 1 : -1)
              touch.current = null
            }}
          >
            {WEEKDAYS.map((w) => (
              <div key={w} className="cal-wd">
                {w}
              </div>
            ))}
            {cells.map((d) => {
              const evs = dayEvents(d)
              return (
                <button
                  key={d}
                  className={'cal-cell' + (d.slice(0, 7) !== month ? ' out' : '') + (d === today() ? ' today' : '') + (d === sel ? ' sel' : '')}
                  onClick={() => setSel(d)}
                  onDoubleClick={() => setEditing({ date: d })}
                >
                  <span className="cal-num">{Number(d.slice(8))}</span>
                  <span className="cal-dots">
                    {evs.slice(0, 3).map((e) => (
                      <i key={e.id} style={{ background: colorOf(st, e) }} title={e.title}>
                        <span>{e.title}</span>
                      </i>
                    ))}
                    {evs.length > 3 && <small>+{evs.length - 3}</small>}
                  </span>
                </button>
              )
            })}
          </div>
          <h3 className="section-title">{fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
          <DayList events={dayEvents(sel)} onOpen={setEditing} />
        </>
      ) : (
        <Upcoming dayEvents={dayEvents} onOpen={setEditing} />
      )}

      <Fab onClick={() => setEditing({ date: sel })} label="Novo evento" />
      {editing && <EventForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function colorOf(st, e) {
  if (e.birthday) return '#ffb224'
  return byId(st, e.members?.[0])?.color || '#8b8d98'
}

function DayList({ events, onOpen }) {
  const st = useStore()
  if (!events.length) return <p className="muted">Nenhum evento. Toque no + para adicionar.</p>
  return events.map((e) => (
    <button key={e.id} className="card event-row" style={{ borderLeftColor: colorOf(st, e) }} onClick={() => !e.birthday && onOpen(st.items[e.id])}>
      <div className="event-time">{e.allDay ? 'Dia todo' : `${e.start || ''}${e.end ? '–' + e.end : ''}`}</div>
      <div className="grow">
        <b>{e.title}</b>
        {e.place && <div className="muted small">📍 {e.place}</div>}
        {e.repeat && e.repeat !== 'none' && <div className="muted small">🔁 {REPEAT[e.repeat]}</div>}
      </div>
      <span className="avatars">
        {(e.members || []).map((id) => (
          <Avatar key={id} member={byId(st, id)} size={24} />
        ))}
      </span>
    </button>
  ))
}

function Upcoming({ dayEvents, onOpen }) {
  const days = Array.from({ length: 60 }, (_, i) => addDays(today(), i))
    .map((d) => [d, dayEvents(d)])
    .filter(([, evs]) => evs.length)
  if (!days.length) return <p className="muted">Nada nos próximos 60 dias.</p>
  return days.map(([d, evs]) => (
    <div key={d}>
      <h3 className="section-title">{d === today() ? 'Hoje' : fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
      <DayList events={evs} onOpen={onOpen} />
    </div>
  ))
}

function EventForm({ initial, onClose }) {
  const st = useStore()
  const [ev, setEv] = useState({ title: '', allDay: false, start: '09:00', end: '10:00', repeat: 'none', members: [st.me], place: '', notes: '', ...initial })
  const set = (k) => (e) => setEv({ ...ev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const submit = (e) => {
    e.preventDefault()
    save('event', ev)
    onClose()
  }
  const del = () => {
    if (confirm('Apagar este evento?')) {
      remove(ev.id)
      onClose()
    }
  }
  return (
    <Modal title={ev.id ? 'Editar evento' : 'Novo evento'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Título">
          <input value={ev.title} onChange={set('title')} required autoFocus placeholder="Consulta no dentista" />
        </Field>
        <div className="row2">
          <Field label="Data">
            <input type="date" value={ev.date} onChange={set('date')} required />
          </Field>
          <Field label="Até (opcional)">
            <input type="date" value={ev.endDate || ''} min={ev.date} onChange={set('endDate')} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={ev.allDay} onChange={set('allDay')} /> Dia inteiro
        </label>
        {!ev.allDay && (
          <div className="row2">
            <Field label="Início">
              <input type="time" value={ev.start} onChange={set('start')} />
            </Field>
            <Field label="Fim">
              <input type="time" value={ev.end} onChange={set('end')} />
            </Field>
          </div>
        )}
        <Field label="Repetir">
          <select value={ev.repeat} onChange={set('repeat')}>
            {Object.entries(REPEAT).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label={ev.allDay ? 'Lembrete (dia inteiro: às 8h do dia)' : 'Lembrete'}>
          <select value={String(ev.remind ?? 30)} onChange={(e) => setEv({ ...ev, remind: e.target.value === 'none' ? 'none' : Number(e.target.value) })}>
            {REMIND.map(([v, l]) => (
              <option key={v} value={String(v)}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Local">
          <input value={ev.place} onChange={set('place')} />
        </Field>
        <Field label="Quem participa">
          <MemberPicker value={ev.members} onChange={(members) => setEv({ ...ev, members })} />
        </Field>
        <Field label="Observações">
          <textarea value={ev.notes} onChange={set('notes')} rows={2} />
        </Field>
        <div className="row">
          {ev.id && (
            <button type="button" className="btn danger" onClick={del}>
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
