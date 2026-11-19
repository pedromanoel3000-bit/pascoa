import { useEffect, useRef, useState } from 'react'
import { byId, save, update, useStore } from '../store.js'
import { timeAgo } from '../utils.js'
import { Avatar, PageHeader, useMembers } from '../ui.jsx'

// Cada membro escolhe compartilhar a localização. Ela fica salva no próprio registro do membro.
export default function Locator() {
  const st = useStore()
  const members = useMembers()
  const me = byId(st, st.me)
  const [err, setErr] = useState('')
  const [sel, setSel] = useState(null)
  const watch = useRef(null)
  const sharing = !!me.shareLocation

  const push = (pos) =>
    update(st.me, {
      location: { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy), at: Date.now() },
      shareLocation: true,
    })

  useEffect(() => {
    if (!sharing || !navigator.geolocation) return
    let last = 0
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - last > 60000) {
          last = Date.now()
          push(p)
        }
      },
      (e) => setErr(e.message),
      { enableHighAccuracy: true, maximumAge: 60000 }
    )
    return () => navigator.geolocation.clearWatch(watch.current)
  }, [sharing])

  const start = () => {
    if (!navigator.geolocation) return setErr('Este aparelho não informa a localização.')
    setErr('')
    navigator.geolocation.getCurrentPosition(push, (e) => setErr('Não consegui pegar sua localização: ' + e.message), { enableHighAccuracy: true })
  }
  const stop = () => update(st.me, { shareLocation: false, location: null })
  const checkIn = () => {
    const place = prompt('Onde você está? (ex.: Cheguei na escola)')
    if (place) save('post', { text: `📍 ${place}`, likes: [], comments: [] })
  }

  const located = members.filter((m) => m.shareLocation && m.location)
  const focus = located.find((m) => m.id === sel) || located[0]
  const bbox = focus && [focus.location.lng - 0.01, focus.location.lat - 0.006, focus.location.lng + 0.01, focus.location.lat + 0.006].join(',')

  return (
    <div className="page">
      <a href="#settings" className="voltar">‹ Configurações</a>
      <PageHeader title="Localização">
        <button className="btn ghost" onClick={checkIn}>
          Fazer check-in
        </button>
      </PageHeader>
      <div className="card row">
        <div className="grow">
          <b>{sharing ? 'Você está compartilhando sua localização' : 'Sua localização está oculta'}</b>
          <div className="muted small">Atualiza enquanto o app estiver aberto.</div>
        </div>
        {sharing ? (
          <button className="btn danger" onClick={stop}>
            Parar
          </button>
        ) : (
          <button className="btn primary" onClick={start}>
            Compartilhar
          </button>
        )}
      </div>
      {err && <p className="late">{err}</p>}
      {focus && (
        <iframe
          className="map"
          title="Mapa"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${focus.location.lat},${focus.location.lng}`}
        />
      )}
      {members.map((m) => (
        <button key={m.id} className={'card event-row' + (focus?.id === m.id ? ' sel' : '')} onClick={() => setSel(m.id)}>
          <Avatar member={m} />
          <div className="grow">
            <b>{m.name}</b>
            <div className="muted small">{m.shareLocation && m.location ? `Visto ${timeAgo(m.location.at)} · ±${m.location.acc} m` : 'Não compartilhando'}</div>
          </div>
          {m.location && m.shareLocation && (
            <a
              className="btn ghost small"
              href={`https://www.google.com/maps/dir/?api=1&destination=${m.location.lat},${m.location.lng}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Rota
            </a>
          )}
        </button>
      ))}
    </div>
  )
}
