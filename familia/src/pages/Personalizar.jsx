import { byId, save, useStore } from '../store.js'
import { Modal } from '../ui.jsx'
import { Icon } from '../icons.jsx'
import { vibrate } from '../toast.jsx'
import { ATALHOS, lerInicio, MAX_ATALHOS, mover, SECOES } from '../inicio.js'

export const idInicio = (me) => 'inicio-' + me

// Personalizar o Início: atalhos rápidos e blocos. Cada mudança já vale na hora.
export default function Personalizar({ onClose }) {
  const st = useStore()
  const id = idInicio(st.me)
  const pref = lerInicio(byId(st, id))
  const gravar = (novo) => {
    vibrate()
    save('inicioPref', { id, ...pref, ...novo })
  }
  const fora = Object.keys(ATALHOS).filter((a) => !pref.atalhos.includes(a))
  const cheio = pref.atalhos.length >= MAX_ATALHOS

  return (
    <Modal title="Personalizar o Início" onClose={onClose}>
      <div className="pers">
        <h3>Atalhos rápidos</h3>
        <p className="muted small">
          Toque em um atalho de baixo para colocar. Use as setas para mudar a ordem e o × para tirar. Até {MAX_ATALHOS}.
        </p>
        <div className="pers-lista">
          {pref.atalhos.length === 0 && <p className="muted small">Nenhum atalho. Escolha abaixo.</p>}
          {pref.atalhos.map((a, i) => {
            const [, ic, nome, cor] = ATALHOS[a]
            return (
              <div key={a} className="pers-linha">
                <span className="tile-ic pers-ic" style={{ '--t': cor }}>
                  <Icon name={ic} size={18} />
                </span>
                <b className="grow">{nome}</b>
                <button type="button" className="icon-btn" disabled={i === 0} onClick={() => gravar({ atalhos: mover(pref.atalhos, i, -1) })} aria-label={`Subir ${nome}`}>
                  ↑
                </button>
                <button type="button" className="icon-btn" disabled={i === pref.atalhos.length - 1} onClick={() => gravar({ atalhos: mover(pref.atalhos, i, 1) })} aria-label={`Descer ${nome}`}>
                  ↓
                </button>
                <button type="button" className="icon-btn" onClick={() => gravar({ atalhos: pref.atalhos.filter((x) => x !== a) })} aria-label={`Tirar ${nome}`}>
                  ×
                </button>
              </div>
            )
          })}
        </div>
        {['Criar', 'Abrir'].map((grupo) => {
          const itens = fora.filter((a) => ATALHOS[a][4] === grupo)
          if (!itens.length) return null
          return (
            <div key={grupo}>
              <small className="muted pers-grupo">{grupo === 'Criar' ? 'Criar algo novo' : 'Abrir uma tela'}</small>
              <div className="pers-opcoes">
                {itens.map((a) => {
                  const [, ic, nome, cor] = ATALHOS[a]
                  return (
                    <button type="button" key={a} className="chip" disabled={cheio} style={{ '--c': cor }} onClick={() => gravar({ atalhos: [...pref.atalhos, a] })} aria-label={`Adicionar ${nome}`}>
                      <span style={{ color: cor, display: 'flex' }}>
                        <Icon name={ic} size={16} />
                      </span>
                      {nome}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        <h3 className="pers-sep">Blocos da página</h3>
        <p className="muted small">Desligue o que não usa e mude a ordem com as setas.</p>
        <div className="pers-lista">
          {pref.secoes.map((s, i) => {
            const [nome, desc] = SECOES[s]
            const visivel = !pref.ocultas.includes(s)
            return (
              <div key={s} className={'pers-linha' + (visivel ? '' : ' off')}>
                <div className="grow">
                  <b>{nome}</b>
                  <small className="muted">{desc}</small>
                </div>
                <button type="button" className="icon-btn" disabled={i === 0} onClick={() => gravar({ secoes: mover(pref.secoes, i, -1) })} aria-label={`Subir bloco ${nome}`}>
                  ↑
                </button>
                <button type="button" className="icon-btn" disabled={i === pref.secoes.length - 1} onClick={() => gravar({ secoes: mover(pref.secoes, i, 1) })} aria-label={`Descer bloco ${nome}`}>
                  ↓
                </button>
                <input type="checkbox" role="switch" className="switch" checked={visivel} onChange={() => gravar({ ocultas: visivel ? [...pref.ocultas, s] : pref.ocultas.filter((x) => x !== s) })} aria-label={`Mostrar ${nome}`} />
              </div>
            )
          })}
        </div>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => gravar({ atalhos: null, secoes: null, ocultas: null })}>
            Voltar ao padrão
          </button>
          <span className="grow" />
          <button type="button" className="btn primary" onClick={onClose}>
            Pronto
          </button>
        </div>
      </div>
    </Modal>
  )
}
