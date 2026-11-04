import { useId } from 'react'
import { addDays, defaultRule, describeRepeat, monthPhrase, today, WEEKDAYS_FULL } from '../utils.js'
import { Field } from '../ui.jsx'

const OPTIONS = [
  ['none', 'Não repete'],
  ['daily', 'Todo dia'],
  ['workdays', 'Dias úteis (seg a sex)'],
  ['weekly', 'Toda semana'],
  ['monthly', 'Todo mês'],
  ['yearly', 'Todo ano'],
  ['custom', 'Personalizado…'],
]
const LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const UNITS = [
  ['day', 'dia', 'dias'],
  ['week', 'semana', 'semanas'],
  ['month', 'mês', 'meses'],
  ['year', 'ano', 'anos'],
]
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Campo "Repetir" de eventos e tarefas, com a opção Personalizado.
// `anchor` é a data de início (evento) ou o prazo (tarefa).
export default function RepeatField({ repeat = 'none', rule, anchor, onChange }) {
  const a = anchor || today()
  const choose = (value) => {
    if (value !== 'custom') return onChange(value, rule)
    // Ao abrir o Personalizado, começa pelo que estava escolhido (ex.: "Toda semana" → semanas).
    onChange('custom', rule ? { ...defaultRule(a), ...rule } : defaultRule(a, repeat))
  }
  return (
    <>
      <Field label="Repetir">
        <select value={repeat} onChange={(e) => choose(e.target.value)}>
          {OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      {repeat === 'custom' && <CustomRule rule={{ ...defaultRule(a), ...(rule || {}) }} anchor={a} onChange={(r) => onChange('custom', r)} />}
    </>
  )
}

function CustomRule({ rule: r, anchor, onChange }) {
  const id = useId()
  const set = (patch) => onChange({ ...r, ...patch })
  const [y, m, d] = anchor.split('-').map(Number)
  const nth = Math.ceil(d / 7)
  const isLast = d + 7 > new Date(y, m, 0).getDate()
  const interval = Math.max(1, Number(r.interval) || 1)
  const untilDefault = r.until || addDays(anchor, 30)

  const toggleDay = (i) => {
    const on = r.weekdays.includes(i)
    if (on && r.weekdays.length === 1) return // pelo menos um dia
    set({ weekdays: on ? r.weekdays.filter((x) => x !== i) : [...r.weekdays, i].sort((a, b) => a - b) })
  }

  return (
    <div className="rule-box">
      <div className="rule-row">
        <span>A cada</span>
        <input
          className="num"
          type="number"
          inputMode="numeric"
          min="1"
          max="99"
          value={r.interval}
          onChange={(e) => set({ interval: e.target.value })}
          onBlur={() => set({ interval: Math.min(99, interval) })}
          aria-label="Intervalo"
        />
        <select value={r.freq} onChange={(e) => set({ freq: e.target.value })} aria-label="Unidade">
          {UNITS.map(([v, one, many]) => (
            <option key={v} value={v}>
              {interval === 1 ? one : many}
            </option>
          ))}
        </select>
      </div>

      {r.freq === 'week' && (
        <div className="weekday-picker" role="group" aria-label="Dias da semana">
          {LETTERS.map((l, i) => (
            <button type="button" key={i} className={'wd' + (r.weekdays.includes(i) ? ' on' : '')} aria-pressed={r.weekdays.includes(i)} aria-label={WEEKDAYS_FULL[i]} onClick={() => toggleDay(i)}>
              {l}
            </button>
          ))}
        </div>
      )}

      {r.freq === 'month' && (
        <div className="rule-options">
          <label className="check">
            <input type="radio" name={id + 'm'} checked={r.monthMode === 'day' || (r.monthMode === 'nth' && nth > 4) || (r.monthMode === 'last' && !isLast)} onChange={() => set({ monthMode: 'day' })} />{' '}
            {cap(monthPhrase('day', anchor))}
          </label>
          {nth <= 4 && (
            <label className="check">
              <input type="radio" name={id + 'm'} checked={r.monthMode === 'nth'} onChange={() => set({ monthMode: 'nth' })} /> {cap(monthPhrase('nth', anchor))}
            </label>
          )}
          {isLast && (
            <label className="check">
              <input type="radio" name={id + 'm'} checked={r.monthMode === 'last' || (r.monthMode === 'nth' && nth > 4)} onChange={() => set({ monthMode: 'last' })} />{' '}
              {cap(monthPhrase('last', anchor))}
            </label>
          )}
        </div>
      )}

      <div className="rule-options">
        <span className="rule-label">Termina</span>
        <label className="check">
          <input type="radio" name={id + 'e'} checked={r.end === 'never'} onChange={() => set({ end: 'never' })} /> Nunca
        </label>
        <label className="check rule-inline">
          <input type="radio" name={id + 'e'} checked={r.end === 'until'} onChange={() => set({ end: 'until', until: untilDefault })} /> Em
          <input
            type="date"
            value={r.end === 'until' ? r.until || '' : untilDefault}
            min={anchor}
            onFocus={() => r.end !== 'until' && set({ end: 'until', until: untilDefault })}
            onChange={(e) => set({ end: 'until', until: e.target.value })}
            aria-label="Data final"
          />
        </label>
        <label className="check rule-inline">
          <input type="radio" name={id + 'e'} checked={r.end === 'count'} onChange={() => set({ end: 'count', count: r.count || 10 })} /> Depois de
          <input
            className="num"
            type="number"
            inputMode="numeric"
            min="1"
            max="999"
            value={r.count ?? 10}
            onFocus={() => r.end !== 'count' && set({ end: 'count', count: r.count || 10 })}
            onChange={(e) => set({ end: 'count', count: e.target.value })}
            aria-label="Quantidade de vezes"
          />{' '}
          vezes
        </label>
      </div>

      <p className="rule-summary">🔁 {describeRepeat({ repeat: 'custom', rule: r }, anchor)}</p>
    </div>
  )
}
