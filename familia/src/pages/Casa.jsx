import { useEffect, useState } from 'react'
import { byId, list, useStore } from '../store.js'
import { today } from '../utils.js'
import { useMembers } from '../ui.jsx'
import { astro, estadoDaCasa, tipoDeTempo } from '../casa.js'
import { activeItems } from './Lists.jsx'
import { unreadCount } from './Chat.jsx'

const CEU = {
  noite: ['#0d1033', '#27306b'],
  amanhecer: ['#f7a66b', '#f9d7a5'],
  dia: ['#3f9bf0', '#a9dcff'],
  entardecer: ['#5b3d9c', '#f58a5c'],
}
const CEU_NUBLADO = { dia: ['#7f93a8', '#c3ced8'], amanhecer: ['#a39288', '#d6c7b8'], entardecer: ['#54486e', '#a6808a'], noite: ['#0b0d24', '#232a4a'] }
const ESTRELAS = [[22, 22], [58, 48], [96, 18], [140, 40], [205, 16], [248, 44], [290, 22], [332, 52], [318, 12], [170, 10]]
const CLIMA_KEY = 'nosso-lar-clima'

// Previsão do tempo (Open-Meteo, gratuita). Só é consultada se alguém da família já compartilha a
// localização na tela Localizar; a posição vai arredondada (cerca de 10 km) e fica 45 min em cache.
function useClima(membros, eu) {
  const [clima, setClima] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CLIMA_KEY)) || null
    } catch {
      return null
    }
  })
  const local = (eu?.shareLocation && eu.location) || membros.find((m) => m.shareLocation && m.location)?.location
  const lat = local ? local.lat.toFixed(1) : null
  const lng = local ? local.lng.toFixed(1) : null
  useEffect(() => {
    if (lat == null) return
    if (clima && clima.lat === lat && clima.lng === lng && Date.now() - clima.at < 45 * 60000) return
    let vivo = true
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!vivo || !j?.current) return
        const novo = { at: Date.now(), lat, lng, tipo: tipoDeTempo(j.current.weather_code), temp: Math.round(j.current.temperature_2m) }
        try {
          localStorage.setItem(CLIMA_KEY, JSON.stringify(novo))
        } catch {}
        setClima(novo)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [lat, lng])
  return lat != null && clima && Date.now() - clima.at < 3 * 3600000 ? clima : null
}

const Nuvem = ({ x, y, s = 1, cor = '#fff', op = 0.9, classe = '' }) => (
  <g className={'casa-nuvem ' + classe} opacity={op} fill={cor}>
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0" rx="20" ry="9" />
      <ellipse cx="-12" cy="-6" rx="11" ry="8" />
      <ellipse cx="6" cy="-9" rx="13" ry="10" />
    </g>
  </g>
)

const Flor = ({ x, cor, estado }) =>
  estado === 'murchas' ? (
    <g stroke="#7a8a4a" strokeWidth="1.6" fill="none" strokeLinecap="round">
      <path d={`M${x} 203 q1 -6 5 -7`} />
      <circle cx={x + 5.5} cy="196.5" r="1.8" fill="#b9a67a" stroke="none" />
    </g>
  ) : (
    <g>
      <path d={`M${x} 203 v-9`} stroke="#2f8f4e" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx={x} cy="192" r="3.4" fill={cor} />
      <circle cx={x} cy="192" r="1.3" fill="#ffe27a" />
    </g>
  )

export default function CasaViva({ saudacao, data }) {
  const st = useStore()
  const membros = useMembers()
  const eu = byId(st, st.me)
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60000)
    return () => clearInterval(t)
  }, [])
  const hoje = today()
  const listas = list(st, 'list').sort((a, b) => a.createdAt - b.createdAt)
  const compras = listas.find((l) => /compra/i.test(l.title)) || listas[0]
  const casa = estadoDaCasa({
    tarefas: list(st, 'task'),
    itensCompra: compras ? activeItems(st).filter((i) => i.listId === compras.id && !i.done).length : 0,
    membros,
    pessoas: [...membros, ...list(st, 'contact')],
    refeicoesHoje: list(st, 'meal').filter((m) => m.date === hoje).length,
    naoLidas: unreadCount(st),
    hoje,
    hora: agora.getHours(),
  })
  const clima = useClima(membros, eu)
  const tempo = clima?.tipo || 'sol'
  const noite = casa.fase === 'noite'
  const [c1, c2] = (tempo === 'sol' ? CEU : CEU_NUBLADO)[casa.fase]
  const a = astro(agora.getHours(), agora.getMinutes())
  const corNuvem = tempo === 'sol' ? '#fff' : noite ? '#3b4468' : '#e6ebf0'
  const n = casa.janelas.length
  const xJanela = (i) => 185 + (i - (n - 1) / 2) * (n > 3 ? 29 : 36) - 11
  const parede = noite ? '#c9b8a4' : '#fff3df'
  const telhado = noite ? '#8c3b3b' : '#e5484d'

  return (
    <section className={'casa fase-' + casa.fase + (casa.emDia ? ' em-dia' : '')}>
      <div className="casa-cena">
        <svg viewBox="0 0 360 232" role="img" aria-label={'Casa da família. ' + casa.avisos.map((v) => v.texto).join('. ')} preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="casa-ceu" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c1} />
              <stop offset="1" stopColor={c2} />
            </linearGradient>
            <radialGradient id="casa-brilho">
              <stop offset="0" stopColor="#ffe9a0" stopOpacity=".9" />
              <stop offset="1" stopColor="#ffe9a0" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="360" height="232" fill="url(#casa-ceu)" />

          {noite && ESTRELAS.map(([x, y], i) => <circle key={i} className="casa-estrela" style={{ animationDelay: `${(i % 5) * 0.6}s` }} cx={x} cy={y} r={i % 3 ? 1 : 1.5} fill="#fff" />)}

          {tempo !== 'chuva' &&
            (a.tipo === 'sol' ? (
              <g opacity={tempo === 'nuvens' ? 0.55 : 1}>
                <circle cx={a.x} cy={a.y} r="26" fill="url(#casa-brilho)" />
                <circle cx={a.x} cy={a.y} r="13" fill="#ffd43b" />
              </g>
            ) : (
              <g opacity={tempo === 'nuvens' ? 0.5 : 1}>
                <circle cx={a.x} cy={a.y} r="22" fill="url(#casa-brilho)" opacity=".5" />
                <circle cx={a.x} cy={a.y} r="11" fill="#f4f1de" />
                <circle cx={a.x + 5} cy={a.y - 3} r="9" fill={c1} />
              </g>
            ))}

          <Nuvem x={84} y={104} s={0.9} cor={corNuvem} op={tempo === 'sol' ? (noite ? 0.25 : 0.9) : 0.95} />
          <Nuvem x={285} y={36} s={0.8} cor={corNuvem} op={tempo === 'sol' ? (noite ? 0.2 : 0.8) : 0.95} classe="lenta" />
          {tempo !== 'sol' && (
            <>
              <Nuvem x={170} y={30} s={1.5} cor={corNuvem} op={0.95} classe="lenta" />
              <Nuvem x={235} y={58} s={1.1} cor={corNuvem} op={0.9} />
              <Nuvem x={40} y={92} s={1.1} cor={corNuvem} op={0.9} classe="lenta" />
            </>
          )}

          {/* morros e gramado */}
          <ellipse cx="70" cy="215" rx="150" ry="42" fill={noite ? '#1f4a3a' : '#7cc77d'} />
          <ellipse cx="310" cy="218" rx="140" ry="40" fill={noite ? '#1b4335' : '#6fbd72'} />
          <rect y="198" width="360" height="34" fill={noite ? '#1d4d38' : '#5fb567'} />

          {/* árvore */}
          <rect x="28" y="160" width="7" height="42" rx="2" fill="#8a5a3a" />
          <circle cx="31" cy="146" r="22" fill={noite ? '#1f5a3e' : '#3fa35a'} />
          <circle cx="18" cy="158" r="13" fill={noite ? '#1c5038' : '#379651'} />
          <circle cx="45" cy="157" r="14" fill={noite ? '#226145' : '#48ad63'} />

          {/* chaminé e fumaça */}
          <rect x="222" y="72" width="14" height="30" fill="#b5533c" />
          <rect x="220" y="69" width="18" height="5" rx="1.5" fill="#8f3f2d" />
          {casa.fumaca && (
            <g fill="#fff" opacity=".7">
              <circle className="casa-fumaca" cx="229" cy="62" r="4" />
              <circle className="casa-fumaca f2" cx="229" cy="62" r="5" />
              <circle className="casa-fumaca f3" cx="229" cy="62" r="6" />
            </g>
          )}

          {/* casa */}
          <rect x="120" y="110" width="130" height="92" fill={parede} />
          <rect x="120" y="150" width="130" height="3" fill="#000" opacity=".08" />
          <path d="M106 114 L185 60 L264 114 Z" fill={telhado} />
          <path d="M106 114 L185 60 L264 114 L256 114 L185 68 L114 114 Z" fill="#000" opacity=".15" />

          {/* janelas do andar de cima: uma por pessoa */}
          {casa.janelas.map((j, i) => {
            const x = xJanela(i)
            return (
              <a key={j.id} href="#tasks" aria-label={`${j.nome}: ${j.pendentes ? j.pendentes + ' tarefa(s) pendente(s)' : 'tudo feito'}`}>
                {j.acesa && noite && <circle cx={x + 11} cy="130" r="22" fill="url(#casa-brilho)" />}
                <rect x={x} y="118" width="22" height="25" rx="3" fill={j.acesa ? '#ffe08a' : noite ? '#2b3350' : '#9fb4c7'} stroke="#7a5a43" strokeWidth="2" />
                <text x={x + 11} y="136" textAnchor="middle" fontSize="13" opacity={j.acesa ? 1 : 0.55}>
                  {j.emoji}
                </text>
                <rect x={x - 2} y="143" width="26" height="3" rx="1.5" fill={j.cor || '#7a5a43'} />
                {j.pendentes > 0 && (
                  <g>
                    <circle cx={x + 21} cy="119" r="6.5" fill="#e5484d" />
                    <text x={x + 21} y="122.2" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#fff">
                      {j.pendentes > 9 ? '9+' : j.pendentes}
                    </text>
                  </g>
                )}
                {j.acesa && j.feitasHoje > 0 && (
                  <text className="casa-brilha" x={x + 21} y="121" textAnchor="middle" fontSize="9">
                    ⭐
                  </text>
                )}
              </a>
            )
          })}

          {/* cozinha: geladeira aberta, mais vazia quanto maior a lista de compras */}
          <a href="#lists" aria-label={`Geladeira: ${casa.itensCompra} itens na lista de compras`}>
            <rect x="128" y="160" width="38" height="30" rx="3" fill={noite ? '#3b3a52' : '#cfe6f5'} stroke="#7a5a43" strokeWidth="2" />
            <rect x="133" y="163" width="17" height="25" rx="2" fill="#f6fbff" stroke="#9db2c2" strokeWidth="1" />
            <path d="M133 171.3h17M133 179.6h17" stroke="#9db2c2" strokeWidth="1" />
            {[0, 1, 2, 3, 4, 5].map((k) =>
              k < casa.geladeira ? <circle key={k} cx={137.5 + (k % 2) * 8} cy={168 + Math.floor(k / 2) * 8.3} r="2.3" fill={['#e5484d', '#46a758', '#ffb224', '#3e63dd', '#f76b15', '#8e4ec6'][k]} /> : null
            )}
            <path d="M150 163 l9 -1.5 v28 l-9 -1.5 Z" fill="#dfe9f1" stroke="#9db2c2" strokeWidth="1" />
            {casa.itensCompra >= 8 && (
              <g>
                <circle cx="165" cy="161" r="7" fill="#e5484d" />
                <text x="165" y="164.4" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff">
                  {casa.itensCompra > 99 ? '99' : casa.itensCompra}
                </text>
              </g>
            )}
          </a>

          {/* porta */}
          <a href="#calendar" aria-label="Agenda">
            <rect x="175" y="162" width="22" height="40" rx="3" fill="#8a5a3a" />
            <rect x="178" y="166" width="16" height="12" rx="2" fill={noite ? '#ffd98a' : '#b98a63'} opacity={noite ? 0.9 : 1} />
            <circle cx="193" cy="184" r="1.6" fill="#ffd43b" />
          </a>

          {/* sala: bolo na janela em dia de aniversário */}
          <rect x="206" y="160" width="36" height="26" rx="3" fill={noite ? '#ffd98a' : '#bfe0f5'} stroke="#7a5a43" strokeWidth="2" />
          <path d="M224 160v26M206 173h36" stroke="#7a5a43" strokeWidth="1.5" opacity=".7" />
          {casa.aniversario && (
            <g>
              <rect x="214" y="175" width="20" height="10" rx="2" fill="#f7a1c4" />
              <rect x="214" y="175" width="20" height="4" rx="2" fill="#fff" />
              <path d="M219 175v-5M224 175v-6M229 175v-5" stroke="#3e63dd" strokeWidth="1.5" />
              <circle className="casa-brilha" cx="219" cy="168.5" r="1.4" fill="#ffb224" />
              <circle className="casa-brilha" cx="224" cy="167.5" r="1.4" fill="#ffb224" />
              <circle className="casa-brilha" cx="229" cy="168.5" r="1.4" fill="#ffb224" />
              <g className="casa-balao">
                <path d="M262 160 q-3 -20 -6 -34" stroke="#888" strokeWidth=".8" fill="none" />
                <ellipse cx="255" cy="118" rx="8" ry="10" fill="#e5484d" />
                <path d="M262 160 q4 -18 9 -28" stroke="#888" strokeWidth=".8" fill="none" />
                <ellipse cx="272" cy="124" rx="7.5" ry="9.5" fill="#3e63dd" />
              </g>
            </g>
          )}

          {/* caixa de correio: bandeira levantada com mensagem nova */}
          <a href="#chat" aria-label="Mensagens">
            <rect x="262" y="182" width="3" height="20" fill="#7a5a43" />
            <rect x="255" y="172" width="17" height="11" rx="4" fill="#3e63dd" />
            {casa.correio ? <path d="M272 177 v-10 h7 v5 h-7" fill="#e5484d" stroke="#e5484d" strokeWidth="1" strokeLinejoin="round" /> : <rect x="271" y="177" width="7" height="2.4" rx="1" fill="#9aa3b2" />}
          </a>

          {/* varal: roupa pendurada quando a tarefa de roupa está pendente */}
          <a href="#tasks" aria-label={casa.roupa ? 'Roupa pendente' : 'Varal vazio'}>
            <path d="M288 202v-44M348 202v-44" stroke="#8a5a3a" strokeWidth="3" strokeLinecap="round" />
            <path d="M288 162 q30 7 60 0" stroke="#d9d2c5" strokeWidth="1.3" fill="none" />
            {casa.roupa > 0 && (
              <g className="casa-roupa">
                <path d="M296 165 l4 -1.5 3 2 3 -2 4 1.5 -2 5 -2 -1 v10 h-6 v-10 l-2 1 Z" fill="#e5484d" />
                <path d="M315 167 h10 l1 16 h-4 l-2 -10 -2 10 h-4 Z" fill="#3e63dd" />
                <path d="M331 166.5 h5 v9 l4 3 v2.5 h-6 l-3 -3 Z" fill="#ffb224" />
              </g>
            )}
          </a>

          {/* sacos de lixo na porta */}
          {casa.lixo > 0 && (
            <a href="#tasks" aria-label="Lixo para tirar">
              {Array.from({ length: casa.lixo }, (_, i) => (
                <g key={i} transform={`translate(${98 + i * 9} ${i % 2 ? 2 : 0})`}>
                  <path d="M0 202 q-4 -12 3 -15 q7 -3 9 3 q4 10 -1 12 Z" fill="#30323d" />
                  <path d="M4 187 l2 -4 l2 4" stroke="#30323d" strokeWidth="2" fill="none" strokeLinecap="round" />
                </g>
              ))}
            </a>
          )}

          {/* caixas no quintal: tarefas atrasadas */}
          {casa.caixas > 0 && (
            <a href="#tasks" aria-label="Tarefas atrasadas">
              {Array.from({ length: casa.caixas }, (_, i) => {
                const x = 58 + (i % 2) * 17 + (i > 1 ? 8 : 0)
                const y = i > 1 ? 174 : 188
                return (
                  <g key={i}>
                    <rect x={x} y={y} width="16" height="14" rx="1.5" fill="#c99a62" stroke="#9b7341" strokeWidth="1" />
                    <path d={`M${x} ${y + 4}h16M${x + 8} ${y}v14`} stroke="#9b7341" strokeWidth="1" />
                  </g>
                )
              })}
            </a>
          )}

          {/* jardim */}
          {[134, 148, 162, 210, 224, 238]
            .filter((_, i) => casa.flores !== 'normais' || i % 2 === 0)
            .map((x, i) => (
              <Flor key={x} x={x} cor={['#f76b15', '#d6409f', '#ffb224', '#8e4ec6', '#e5484d', '#3e63dd'][i]} estado={casa.flores} />
            ))}

          {/* tudo em dia: brilhos */}
          {casa.emDia &&
            [[112, 96], [262, 88], [150, 58], [228, 52], [96, 150], [280, 140]].map(([x, y], i) => (
              <path key={i} className="casa-brilha" style={{ animationDelay: `${i * 0.35}s` }} d={`M${x} ${y - 6} l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6 Z`} fill="#fff6c9" />
            ))}

          {tempo === 'chuva' && (
            <g className="casa-chuva" stroke="#d6e6ff" strokeWidth="1.4" strokeLinecap="round" opacity=".7">
              {Array.from({ length: 26 }, (_, i) => (
                <path key={i} style={{ animationDelay: `${(i * 0.13) % 1}s` }} d={`M${8 + i * 14} ${(i * 37) % 90} l-4 12`} />
              ))}
            </g>
          )}
        </svg>
        <div className="casa-texto">
          <h1>{saudacao}</h1>
          <p>
            {data}
            {clima && ` · ${clima.temp}°`}
          </p>
        </div>
      </div>
      <div className="casa-avisos">
        {casa.avisos.map((v) => (
          <a key={v.texto} href={v.ir} className={'casa-aviso' + (v.icone === '✨' ? ' ok' : '')}>
            <span>{v.icone}</span>
            {v.texto}
          </a>
        ))}
      </div>
    </section>
  )
}
