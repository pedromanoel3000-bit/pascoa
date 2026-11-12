import { useEffect, useState } from 'react'
import { byId, list, remove, save, update, useStore } from '../store.js'
import { money } from '../utils.js'
import { Avatar, Empty, Fab, Field, Modal, PageHeader, useMembers } from '../ui.jsx'
import { toast, vibrate } from '../toast.jsx'

// Lista de desejos: cada pessoa tem a sua. Quem vai dar um presente marca "vou dar este",
// e o dono da lista não vê essa marcação, para não estragar a surpresa.
export default function Wishes() {
  const st = useStore()
  const members = useMembers()
  const [owner, setOwner] = useState(st.me)
  const [editing, setEditing] = useState(null)

  // #wishes/<id> abre a lista de uma pessoa (ex.: vindo do aniversário no início).
  useEffect(() => {
    const id = location.hash.split('/')[1]
    if (id && byId(st, id)) {
      setOwner(id)
      history.replaceState(null, '', '#wishes')
    }
  }, [])

  const person = byId(st, owner) || byId(st, st.me)
  const mineList = person.id === st.me
  const contato = person.type === 'contact'
  // Contatos entram como abas quando têm aniversário, já têm ideias de presente ou foram abertos agora.
  const todosDesejos = list(st, 'wish')
  const contatos = list(st, 'contact').sort((a, b) => a.name.localeCompare(b.name))
  const abas = contatos.filter((c) => c.id === person.id || c.birthday || todosDesejos.some((w) => w.owner === c.id))
  const fora = contatos.filter((c) => !abas.includes(c))
  const wishes = list(st, 'wish')
    .filter((w) => w.owner === person.id)
    .sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0) || a.createdAt - b.createdAt)
  const open = wishes.filter((w) => !w.received)
  const received = wishes.filter((w) => w.received)
  const myGifts = list(st, 'wish').filter((w) => w.reservedBy === st.me && !w.received && w.owner !== st.me)

  return (
    <div className="page">
      <PageHeader title="Lista de desejos" />
      <div className="conv-tabs">
        {members.map((m) => (
          <button key={m.id} className={'chip' + (m.id === person.id ? ' on' : '')} style={{ '--c': m.color }} onClick={() => setOwner(m.id)}>
            <Avatar member={m} size={22} /> {m.id === st.me ? 'Minha' : m.name}
          </button>
        ))}
        {abas.map((c) => (
          <button key={c.id} className={'chip' + (c.id === person.id ? ' on' : '')} onClick={() => setOwner(c.id)}>
            🎁 {c.name}
          </button>
        ))}
        {fora.length > 0 && (
          <select className="chip wish-outro" value="" onChange={(e) => e.target.value && setOwner(e.target.value)} aria-label="Outro contato">
            <option value="">+ Contato…</option>
            {fora.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {contato ? (
        <p className="muted small">
          Ideias de presente para {person.name}
          {person.birthday ? ` (aniversário em ${person.birthday.slice(8)}/${person.birthday.slice(5, 7)})` : ''}. Toque no + para anotar e em “Vou dar este” para ninguém comprar repetido.
        </p>
      ) : mineList ? (
        <p className="muted small">Coloque o que você gostaria de ganhar. Ninguém te conta quem vai dar o quê 🤫</p>
      ) : (
        <p className="muted small">Marque “Vou dar este” para ninguém comprar repetido. {person.name} não vê essa marcação.</p>
      )}

      {open.length === 0 && <Empty icon="🎁" text={contato ? `Nenhuma ideia de presente para ${person.name} ainda. Toque no + para anotar.` : mineList ? 'Sua lista está vazia. Toque no + para adicionar um desejo.' : `${person.name} ainda não colocou desejos.`} />}
      {open.map((w) => (
        <WishCard key={w.id} wish={w} mineList={mineList} onEdit={() => setEditing(w)} />
      ))}

      {received.length > 0 && <h3 className="section-title">{contato ? 'Já demos' : 'Já ganhou'}</h3>}
      {received.map((w) => (
        <WishCard key={w.id} wish={w} mineList={mineList} onEdit={() => setEditing(w)} />
      ))}

      {myGifts.length > 0 && (
        <div className="card">
          <h3>🎁 Presentes que você vai dar</h3>
          {myGifts.map((w) => (
            <div key={w.id} className="row gift-row">
              <Avatar member={byId(st, w.owner)} size={24} />
              <span className="grow">{w.title}</span>
              {w.price ? <small className="muted">{money(w.price)}</small> : null}
            </div>
          ))}
        </div>
      )}

      {(mineList || contato) && <Fab onClick={() => setEditing({ owner: person.id })} label={contato ? 'Nova ideia de presente' : 'Novo desejo'} />}
      {editing && <WishForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function WishCard({ wish, mineList, onEdit }) {
  const st = useStore()
  const reserver = byId(st, wish.reservedBy)
  const host = wish.link ? hostOf(wish.link) : null

  const reserve = () => {
    vibrate()
    update(wish.id, { reservedBy: st.me })
    toast('Combinado! Só você sabe 🤫')
  }
  return (
    <div className={'card wish' + (wish.received ? ' received' : '')}>
      <div className="row">
        <button className="grow task-main" onClick={onEdit}>
          <b>
            {wish.starred && '⭐ '}
            {wish.title}
          </b>
          <span className="muted small">
            {[wish.price ? money(wish.price) : null, wish.notes].filter(Boolean).join(' · ')}
          </span>
        </button>
        {host && (
          <a className="btn ghost small" href={wish.link} target="_blank" rel="noreferrer">
            {host} ↗
          </a>
        )}
      </div>
      {mineList ? (
        !wish.received && (
          <button className="link wish-action" onClick={() => update(wish.id, { received: true })}>
            Já ganhei ✓
          </button>
        )
      ) : wish.received ? (
        <span className="muted small">{byId(st, wish.owner)?.type === 'contact' ? 'Presente dado 🎉' : 'Já ganhou 🎉'}</span>
      ) : reserver ? (
        <div className="row wish-reserved">
          <Avatar member={reserver} size={22} />
          <span className="grow small">{wish.reservedBy === st.me ? 'Você vai dar este presente' : `${reserver.name} vai dar este`}</span>
          {wish.reservedBy === st.me && (
            <button className="link" onClick={() => update(wish.id, { reservedBy: null })}>
              desistir
            </button>
          )}
          {wish.reservedBy === st.me && byId(st, wish.owner)?.type === 'contact' && (
            <button className="link" onClick={() => update(wish.id, { received: true })}>
              já dei ✓
            </button>
          )}
        </div>
      ) : (
        <button className="btn primary small wish-action" onClick={reserve}>
          🎁 Vou dar este
        </button>
      )}
    </div>
  )
}

function hostOf(url) {
  try {
    return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function WishForm({ initial, onClose }) {
  const st = useStore()
  const [w, setW] = useState({ title: '', link: '', price: '', notes: '', starred: false, ...initial })
  const set = (k) => (e) => setW({ ...w, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const owner = byId(st, w.owner)
  const contato = owner?.type === 'contact'
  return (
    <Modal title={contato ? `Presente para ${owner.name}` : w.id ? 'Editar desejo' : owner?.id === st.me ? 'Novo desejo' : `Desejo de ${owner?.name}`} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          const link = w.link.trim() && !/^https?:\/\//.test(w.link.trim()) ? 'https://' + w.link.trim() : w.link.trim()
          save('wish', { ...w, link, price: Number(String(w.price).replace(',', '.')) || '' })
          onClose()
        }}
      >
        <Field label={contato ? 'Ideia de presente' : 'O que você quer ganhar'}>
          <input value={w.title} onChange={set('title')} required autoFocus placeholder={contato ? 'Perfume, livro, flores…' : 'Fone de ouvido sem fio'} />
        </Field>
        <Field label="Link da loja (opcional)">
          <input type="text" inputMode="url" autoCapitalize="none" value={w.link} onChange={set('link')} placeholder="https://…" />
        </Field>
        <div className="row2">
          <Field label="Preço aproximado (R$)">
            <input inputMode="decimal" value={w.price} onChange={set('price')} placeholder="0,00" />
          </Field>
          <Field label="Detalhes">
            <input value={w.notes} onChange={set('notes')} placeholder="Tamanho, cor…" />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={!!w.starred} onChange={set('starred')} /> {contato ? '⭐ Melhor ideia' : '⭐ Quero muito'}
        </label>
        {w.received && (
          <label className="check">
            <input type="checkbox" checked={!w.received} onChange={(e) => setW({ ...w, received: !e.target.checked })} /> {contato ? 'Voltar para a lista (ainda não demos)' : 'Voltar para a lista (ainda não ganhei)'}
          </label>
        )}
        <div className="row">
          {w.id && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                remove(w.id)
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
