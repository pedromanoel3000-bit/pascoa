import { useEffect, useState } from 'react'
import { Field, Modal } from '../ui.jsx'
import { toast } from '../toast.jsx'
import { baixarMeusDados, cobCancelar, cobCheckout, cobStatus, infoFamilia, recarregar, sair, useAuth } from '../auth.js'
import { useStore } from '../store.js'

const reais = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const data = (ts) => new Date(ts).toLocaleDateString('pt-BR')
const PLANOS = [
  ['mensal', 'Mensal', (p) => `${reais(p.mensal)} por mês`, null],
  ['anual', 'Anual', (p) => `${reais(p.anual)} por ano`, (p) => `Equivale a ${reais(p.anual / 12)} por mês: economia de ${reais(p.mensal * 12 - p.anual)} por ano`],
]

function frase(s) {
  switch (s.estado) {
    case 'cortesia':
      return 'Cortesia: esta família não é cobrada.'
    case 'teste':
      return `Teste grátis: ${s.dias === 1 ? 'falta 1 dia' : `faltam ${s.dias} dias`} (até ${data(s.fim)}).`
    case 'ativa':
      return s.assinatura === 'cancelada' ? `Assinatura paga até ${data(s.fim)}. Não renova depois dessa data.` : `Assinatura ativa até ${data(s.fim)}.`
    case 'leitura':
      return `${s.plano ? 'Assinatura vencida' : 'O teste grátis acabou'} em ${data(s.fim)}. Dá para ver tudo, mas não alterar, até ${data(s.bloqueioEm)}. Depois o acesso é bloqueado.`
    default:
      return `${s.plano ? 'Assinatura vencida' : 'O teste grátis acabou'} em ${data(s.fim)}. O acesso está bloqueado: os dados continuam guardados e voltam assim que a assinatura for paga.`
  }
}

/** Situação da assinatura, planos e botões. Usado em Conta e segurança e na tela de assinatura vencida. */
export function PainelAssinatura({ family }) {
  const [s, setS] = useState(null)
  const [erro, setErro] = useState('')
  const [escolha, setEscolha] = useState(null) // { plano, cpf, ocupado, erro }
  const [ocupado, setOcupado] = useState(false)

  const carregar = async (refresh = false) => {
    setOcupado(refresh)
    try {
      const novo = await cobStatus(family, refresh)
      setS(novo)
      setErro('')
      if (refresh) {
        toast(['ativa', 'teste', 'cortesia'].includes(novo.estado) ? 'Situação atualizada' : 'Ainda não identificamos o pagamento. Pode levar alguns minutos.')
        recarregar()
      }
    } catch (e) {
      setErro(e.message)
    }
    setOcupado(false)
  }
  useEffect(() => {
    carregar()
  }, [family])
  if (erro && !s) return <p className="late small">{erro}</p>
  if (!s || s.estado === 'desligada') return null
  const dono = s.role === 'owner'
  const assinante = s.assinatura === 'ativa'
  const pagar = ['teste', 'leitura', 'bloqueada'].includes(s.estado) || (s.estado === 'ativa' && s.assinatura !== 'ativa')

  const continuar = async (e) => {
    e.preventDefault()
    setEscolha({ ...escolha, ocupado: true, erro: '' })
    try {
      const { url } = await cobCheckout(family, escolha.plano, escolha.cpf)
      const janela = window.open(url, '_blank') // com 'noopener' o navegador devolve null mesmo abrindo, e não dá para saber se funcionou
      if (janela) janela.opener = null
      else location.href = url // o navegador bloqueou a nova aba: abre nesta mesma
      setEscolha(null)
      toast('Abri a página de pagamento. Depois de pagar, volte aqui e toque em “Já paguei”.')
      carregar()
    } catch (err) {
      setEscolha((x) => ({ ...x, ocupado: false, erro: err.message }))
    }
  }

  return (
    <div className="assin">
      <p className={'assin-estado ' + s.estado}>{frase(s)}</p>
      {erro && <p className="late small">{erro}</p>}
      {dono && s.estado !== 'cortesia' && pagar && (
        <div className="assin-planos">
          {PLANOS.map(([id, nome, preco, extra]) => (
            <button key={id} type="button" className="assin-plano" onClick={() => setEscolha({ plano: id, cpf: '', ocupado: false, erro: '' })} aria-label={`Assinar plano ${nome}`}>
              <b>{nome}</b>
              <span>{preco(s.precos)}</span>
              {extra && <small className="muted">{extra(s.precos)}</small>}
              <span className="btn primary small">Assinar</span>
            </button>
          ))}
        </div>
      )}
      {dono && s.estado !== 'cortesia' && (
        <div className="row assin-acoes">
          <button type="button" className="btn ghost" disabled={ocupado} onClick={() => carregar(true)}>
            {ocupado ? 'Conferindo…' : 'Já paguei, atualizar'}
          </button>
          {assinante && (
            <button
              type="button"
              className="btn ghost"
              disabled={ocupado}
              onClick={async () => {
                if (!confirm('Cancelar a renovação? Você continua com acesso até o fim do período já pago.')) return
                try {
                  setS(await cobCancelar(family))
                  toast('Renovação cancelada')
                } catch (e) {
                  toast(e.message)
                }
              }}
            >
              Cancelar renovação
            </button>
          )}
        </div>
      )}
      {!dono && s.estado !== 'cortesia' && pagar && <p className="muted small">Quem cuida da assinatura é o dono da família.</p>}
      {s.estado !== 'cortesia' && (
        <p className="muted small">
          A cobrança de cada período chega por e-mail, enviada pelo Asaas: pague por Pix, boleto ou cartão. Se não pagar, a família fica só em leitura por 3 dias e depois é bloqueada. Nada é apagado.
        </p>
      )}
      {escolha && s && (
        <Modal title={`Assinar o plano ${PLANOS.find((p) => p[0] === escolha.plano)[1].toLowerCase()}`} onClose={() => setEscolha(null)}>
          <form className="form" onSubmit={continuar}>
            <p className="small">
              <b>{PLANOS.find((p) => p[0] === escolha.plano)[2](s.precos)}</b>.{' '}
              {s.estado === 'teste' ? `Você não paga nada agora: a primeira cobrança vence em ${data(s.fim)}, quando o teste grátis acaba.` : 'A primeira cobrança vence hoje.'}
            </p>
            <Field label="CPF ou CNPJ de quem vai pagar (exigido para emitir a cobrança)">
              <input value={escolha.cpf} onChange={(e) => setEscolha({ ...escolha, cpf: e.target.value, erro: '' })} inputMode="numeric" autoComplete="off" required autoFocus placeholder="000.000.000-00" />
            </Field>
            {escolha.erro && <p className="late small" role="alert">{escolha.erro}</p>}
            <button className="btn primary" disabled={escolha.ocupado}>
              {escolha.ocupado ? 'Criando a cobrança…' : 'Continuar para o pagamento'}
            </button>
            <p className="muted small">Você será levado à página segura do Asaas para escolher Pix, boleto ou cartão. O Nosso Lar não guarda dados de cartão.</p>
          </form>
        </Modal>
      )}
    </div>
  )
}

/** Tela inteira quando a assinatura venceu e o acesso foi bloqueado. */
export function TelaBloqueada() {
  const st = useStore()
  const auth = useAuth()
  const [papel, setPapel] = useState(null)
  useEffect(() => {
    infoFamilia(st.family).then((i) => setPapel(i.role)).catch(() => {})
  }, [st.family])
  return (
    <div className="welcome">
      <img src="/icon.svg" alt="" className="welcome-logo" />
      <h1>{auth.need?.billing?.plano ? 'Assinatura vencida' : 'Teste grátis encerrado'}</h1>
      <p className="muted">Os dados da família continuam guardados e voltam a abrir assim que a assinatura for paga.</p>
      <div className="card form">
        <PainelAssinatura family={st.family} />
        {papel === 'member' && <p className="small">Peça ao dono da família para renovar a assinatura.</p>}
      </div>
      <button type="button" className="btn ghost" onClick={() => baixarMeusDados(st.family).catch((e) => toast(e.message))}>
        Baixar meus dados
      </button>
      <button type="button" className="btn ghost" onClick={() => sair()}>
        Sair de {auth.email}
      </button>
    </div>
  )
}

/** Faixa no topo: teste acabando, renovação cancelada ou assinatura vencida (só leitura). */
export function AvisoAssinatura() {
  const { billing: b } = useAuth()
  if (!b) return null
  let texto = null
  let grave = false
  if (b.estado === 'teste' && b.dias <= 7) texto = `Teste grátis: ${b.dias <= 1 ? 'termina hoje ou amanhã' : `faltam ${b.dias} dias`}.`
  else if (b.estado === 'ativa' && b.assinatura === 'cancelada' && b.dias <= 7) texto = `Sua assinatura termina em ${b.dias <= 1 ? 'menos de 1 dia' : `${b.dias} dias`} e não renova.`
  else if (b.estado === 'leitura') {
    texto = `${b.plano ? 'Assinatura vencida' : 'Teste grátis encerrado'}: você só pode ver, não alterar. Bloqueio em ${data(b.bloqueioEm)}.`
    grave = true
  }
  if (!texto) return null
  return (
    <a href="#settings" className={'assin-faixa' + (grave ? ' grave' : '')} role="status">
      {texto} <b>{grave ? 'Renovar' : 'Ver planos'} ›</b>
    </a>
  )
}
