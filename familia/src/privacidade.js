// Quem pode ver e mexer no quê dentro de uma família protegida. Usado pelo servidor (que decide de verdade)
// e pelo app (que limpa do aparelho o que não é dele). Em famílias sem conta ninguém é identificado, então nada disso vale.

// Dados de uma pessoa só: treino, preferências do radar e do início.
const PESSOAIS = new Set(['treinoPrograma', 'treinoSessao', 'treinoRascunho', 'treinoCardio', 'radarVisto', 'radarAviso', 'inicioPref'])

const sufixo = (id) => String(id || '').split('-').pop()

/** O único membro que pode ver o item (ou null se o item é de todos). */
export function dono(it) {
  if (PESSOAIS.has(it.type)) return it.memberId || it.createdBy || sufixo(it.id)
  if (it.type === 'notif') return it.to || '?'
  return null
}

/** Os dois membros de uma conversa privada (ou null se for o grupo da família). */
export function participantes(it) {
  return it.type === 'message' && typeof it.conv === 'string' && it.conv !== 'family' ? it.conv.split('|') : null
}

export function podeAcessar(it, me) {
  const d = dono(it)
  if (d != null) return !!me && d === me
  const ps = participantes(it)
  if (ps) return !!me && ps.includes(me)
  return true
}

// Itens apagados são só um aviso de "isto saiu" e não revelam conteúdo.
export const podeVer = (it, me) => it.deleted || podeAcessar(it, me)

/** O que muda no item para quem lê: o dono de um desejo não vê quem reservou o presente. */
export function redigir(it, me) {
  if (it.type === 'wish' && me && it.owner === me && it.reservedBy) {
    const { reservedBy, ...resto } = it
    return resto
  }
  return it
}

/**
 * Confere uma alteração vinda de `me` sobre o item `cur` (o que já existe, se existir).
 * Devolve a alteração (possivelmente ajustada) ou null se essa pessoa não pode fazê-la.
 */
export function ajustarEscrita(cur, c, me) {
  const ref = cur && !cur.deleted ? cur : c
  if (!podeAcessar(ref, me)) return null
  // O dono do desejo não enxerga a reserva: quando ele edita o desejo, a reserva existente é mantida.
  if (ref.type === 'wish' && me && ref.owner === me && cur) {
    const { reservedBy, ...resto } = c
    return cur.reservedBy ? { ...resto, reservedBy: cur.reservedBy } : resto
  }
  return c
}
