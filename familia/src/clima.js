// Previsão do tempo (Open-Meteo, gratuita), usada pela casa do Início e pelo radar.
// Só é consultada se alguém da família já compartilha a localização na tela Localizar;
// a posição vai arredondada (cerca de 10 km) e a resposta fica 45 min guardada no aparelho.
import { useEffect, useState } from 'react'
import { tipoDeTempo } from './casa.js'

const CHAVE = 'nosso-lar-clima-2'
const ler = () => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || null
  } catch {
    return null
  }
}

export const urlDaPrevisao = (lat, lng) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&daily=precipitation_probability_max&forecast_days=7&timezone=auto`

// Resposta da Open-Meteo → { 'aaaa-mm-dd': chance de chuva em % }.
export function chuvaPorDia(json) {
  const dias = {}
  const d = json?.daily
  if (d?.time) d.time.forEach((dia, i) => (dias[dia] = d.precipitation_probability_max?.[i] ?? null))
  return dias
}

// A casa e o radar pedem a previsão ao mesmo tempo: uma consulta só serve aos dois.
let emCurso = null
function buscar(lat, lng) {
  const chave = lat + ',' + lng
  if (emCurso?.chave === chave) return emCurso.promessa
  const promessa = fetch(urlDaPrevisao(lat, lng))
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j?.current) return null
      const novo = { at: Date.now(), lat, lng, tipo: tipoDeTempo(j.current.weather_code), temp: Math.round(j.current.temperature_2m), chuva: chuvaPorDia(j) }
      try {
        localStorage.setItem(CHAVE, JSON.stringify(novo))
      } catch {}
      return novo
    })
    .catch(() => null)
    .finally(() => setTimeout(() => emCurso?.promessa === promessa && (emCurso = null), 1000))
  emCurso = { chave, promessa }
  return promessa
}

export function useClima(membros, eu) {
  const [clima, setClima] = useState(ler)
  const local = (eu?.shareLocation && eu.location) || membros.find((m) => m.shareLocation && m.location)?.location
  const lat = local ? local.lat.toFixed(1) : null
  const lng = local ? local.lng.toFixed(1) : null
  useEffect(() => {
    if (lat == null) return
    const atual = ler()
    if (atual && atual.lat === lat && atual.lng === lng && Date.now() - atual.at < 45 * 60000) return setClima(atual)
    let vivo = true
    buscar(lat, lng).then((novo) => vivo && novo && setClima(novo))
    return () => {
      vivo = false
    }
  }, [lat, lng])
  return lat != null && clima && Date.now() - clima.at < 3 * 3600000 ? clima : null
}
