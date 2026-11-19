// Armazenamento de fotos e anexos fora dos dados da família.
// Cada arquivo tem como nome o resumo (SHA-256) do próprio conteúdo: o mesmo arquivo nunca é guardado duas vezes
// e ninguém consegue trocar o conteúdo de uma foto que já existe.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const MAX_ARQUIVO = 4 * 1024 * 1024
export const idValido = (id) => /^[a-f0-9]{32}$/.test(String(id || ''))
export const hashDe = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 32)

// O tipo vem do próprio conteúdo, nunca do que o aparelho disser.
export function tipoDe(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (b.length >= 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  if (b.length >= 4 && b.subarray(0, 4).toString() === '%PDF') return 'application/pdf'
  return 'application/octet-stream'
}

/**
 * Com Supabase, cada arquivo vira uma linha da tabela families (nome `__ph_<família>_<id>`, conteúdo em base64);
 * sem Supabase, um arquivo na pasta fotos/ de DATA_DIR.
 */
export function createFotos({ sb, useDb, dataDir }) {
  const nome = (key, id) => `__ph_${key}_${id}`
  const pasta = (key) => path.join(dataDir, 'fotos', key)
  return {
    async put(key, id, buf) {
      if (useDb) {
        await sb('families?on_conflict=family', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ family: nome(key, id), epoch: buf.toString('base64') }]) })
        return
      }
      fs.mkdirSync(pasta(key), { recursive: true })
      const f = path.join(pasta(key), id)
      fs.writeFileSync(f + '.tmp', buf)
      fs.renameSync(f + '.tmp', f)
    },
    async get(key, id) {
      if (useDb) {
        const rows = await sb(`families?family=eq.${nome(key, id)}&select=epoch`)
        return rows.length ? Buffer.from(rows[0].epoch, 'base64') : null
      }
      try {
        return fs.readFileSync(path.join(pasta(key), id))
      } catch {
        return null
      }
    },
    async has(key, id) {
      if (useDb) return (await sb(`families?family=eq.${nome(key, id)}&select=family`)).length > 0
      return fs.existsSync(path.join(pasta(key), id))
    },
    async del(key, id) {
      if (useDb) return void (await sb(`families?family=eq.${nome(key, id)}`, { method: 'DELETE' }))
      fs.rmSync(path.join(pasta(key), id), { force: true })
    },
    async delAll(key) {
      if (useDb) return void (await sb(`families?family=like.${encodeURIComponent(`__ph_${key}_*`)}`, { method: 'DELETE' }))
      fs.rmSync(pasta(key), { recursive: true, force: true })
    },
  }
}
