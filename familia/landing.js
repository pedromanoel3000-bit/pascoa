// Página de apresentação (landing page) para onde os anúncios levam: /comecar
// Os botões levam ao cadastro do app (/#cadastro) e mantêm os parâmetros do anúncio (utm_…) no endereço.
// Tudo o que a página afirma existe no app: ao mudar um recurso, confira o texto daqui também.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const reais = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ')

// Ícones de traço (24×24), desenhados em linha para não depender de nenhum arquivo externo.
const ICONES = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  agenda: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  carrinho: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H5.1"/>',
  tarefa: '<circle cx="12" cy="12" r="10"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  talheres: '<path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  foto: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  carteira: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3M3 5v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M21 12h-3a2 2 0 0 0 0 4h3Z"/>',
  presente: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  sino: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  brilho: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  cadeado: '<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  pessoas: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  celular: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  escudo: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"/><path d="m9 12 2 2 4-4"/>',
  baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  olho: '<path d="M9.9 9.9a3 3 0 1 0 4.2 4.2M10.7 5.1A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.7 2.7M6.6 6.6A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
  relogio: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  repetir: '<path d="m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  halter: '<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>',
  nota: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5ZM14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  contato: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  radar: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  paleta: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-.5-1.5-.5-2.5S14.5 15 16 15h2a3 3 0 0 0 3-3"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="8" r="1"/><circle cx="16" cy="10" r="1"/>',
  trofeu: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2-1.2.5-2 1.8-2 3.8M14 14.7V17c0 .6.5 1 1 1.2 1.2.5 2 1.8 2 3.8M18 2H6v7a6 6 0 0 0 12 0Z"/>',
  estrela: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1Z"/>',
  wifi: '<path d="M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 14 0M1.4 9a15 15 0 0 1 21.2 0"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
}
const ic = (nome, tam = 20) => `<svg class="ic" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome] || ''}</svg>`

const tela = (arquivo, alt, extra = '') => `<img src="/lp/${arquivo}.webp" width="660" height="1428" alt="${esc(alt)}" ${extra || 'loading="lazy" decoding="async"'}>`
const fone = (arquivo, alt, classe = '', extra = '') => `<div class="fone ${classe}">${tela(arquivo, alt, extra)}</div>`

export function landingHtml({ precos = { mensal: 9.9, anual: 99 }, testeDias = 7, leituraDias = 3, contato = '', empresa = '', cnpj = '', base = '' } = {}) {
  const mensal = reais(precos.mensal)
  const anual = reais(precos.anual)
  const porMes = reais(precos.anual / 12)
  const economia = reais(precos.mensal * 12 - precos.anual)
  const pct = Math.round((1 - precos.anual / (precos.mensal * 12)) * 100)
  const titulo = 'Nosso Lar · Agenda, compras e tarefas da família no mesmo lugar'
  const desc = `O app que organiza a casa: agenda, lista de compras, tarefas, cardápio, receitas, chat e fotos para casais e famílias. Teste grátis por ${testeDias} dias, sem cartão.`
  const url = base ? base + '/comecar' : ''
  const imagem = (base || '') + '/lp/og.jpg'
  const mail = contato ? `<a href="mailto:${esc(contato)}">${esc(contato)}</a>` : ''

  const faq = [
    ['Preciso de cartão de crédito para testar?', `Não. Você cria a conta e usa tudo por ${testeDias} dias sem informar nenhum dado de pagamento.`],
    ['O que acontece quando o teste acaba?', `Se você não assinar, a família fica ${leituraDias} dias em modo leitura: dá para ver tudo, mas não alterar. Depois disso o acesso é bloqueado. Nada é apagado: quando a assinatura é paga, tudo volta como estava.`],
    ['Preciso instalar alguma coisa? Funciona no iPhone e no Android?', 'Não precisa de loja de aplicativos. O Nosso Lar abre no navegador do celular, do tablet e do computador, e você pode adicioná-lo à tela inicial para usar como um app.'],
    ['Quantas pessoas da família podem usar?', 'Todas as que você convidar com o código da família. A assinatura é uma só e vale para a família inteira. Cada pessoa entra com a própria conta.'],
    ['Funciona sem internet?', 'Você continua vendo e anotando no aparelho. Quando a internet volta, as alterações são enviadas e aparecem para o resto da família.'],
    ['Como funciona o pagamento?', 'A cobrança é feita pelo Asaas, com Pix, boleto ou cartão. A cada período você recebe a cobrança por e-mail. O Nosso Lar não guarda dados de cartão.'],
    ['Como cancelo? Tem reembolso?', 'Você cancela dentro do app, em Configurações → Conta e segurança, sem multa, e continua com acesso até o fim do período pago. Em até 7 dias corridos depois da primeira cobrança paga, você pode pedir o reembolso integral.'],
    ['Meus dados estão seguros?', 'Cada família só vê os próprios dados, e as contas são protegidas por senha ou pelo login do Google. Não vendemos seus dados nem os usamos para publicidade. Você pode baixar tudo ou excluir a conta quando quiser.'],
  ]
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Nosso Lar',
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web, Android, iOS',
      inLanguage: 'pt-BR',
      description: desc,
      ...(url ? { url } : {}),
      offers: [
        { '@type': 'Offer', name: 'Plano mensal', price: String(precos.mensal), priceCurrency: 'BRL' },
        { '@type': 'Offer', name: 'Plano anual', price: String(precos.anual), priceCurrency: 'BRL' },
      ],
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ]
  const ldJson = JSON.stringify(ld).replace(/</g, '\\u003c')

  const cta = (texto, classe = '') => `<a class="btn ${classe}" href="/#cadastro" data-cta>${texto} ${ic('seta', 18)}</a>`
  const ticks = (itens) => `<ul class="ticks">${itens.map(([i, t]) => `<li><span class="tk">${ic(i, 16)}</span><span>${t}</span></li>`).join('')}</ul>`

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#fbfaf7">
${url ? `<link rel="canonical" href="${esc(url)}">\n<meta property="og:url" content="${esc(url)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Nosso Lar">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(imagem)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" as="image" href="/lp/inicio.webp" fetchpriority="high">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500..700;1,9..144,500..700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${ldJson}</script>
<style>
:root {
  color-scheme: light;
  --ink: #16142a; --ink-2: #55526b; --ink-3: #8a87a3;
  --paper: #fbfaf7; --paper-2: #f4f1ea; --surface: #fff; --line: #e9e5ee;
  --brand: #5b4bdb; --brand-d: #4636c2; --brand-soft: #efedff;
  --teal: #12a594; --teal-d: #0b7d70; --teal-soft: #e0f5f1;
  --sun: #f5a524; --sun-d: #8a5a00; --sun-soft: #fff1d2;
  --coral: #ef5f45; --coral-d: #b63a24; --coral-soft: #ffe8e2;
  --serif: 'Fraunces', 'Iowan Old Style', Georgia, serif;
  --sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --sh-1: 0 1px 2px rgb(22 20 42 / 6%), 0 4px 14px -6px rgb(22 20 42 / 10%);
  --sh-2: 0 2px 4px rgb(22 20 42 / 5%), 0 18px 40px -18px rgb(22 20 42 / 28%);
  --sh-3: 0 40px 80px -36px rgb(40 30 110 / 45%), 0 12px 28px -14px rgb(22 20 42 / 22%);
}
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
body { position: relative; margin: 0; background: var(--paper); color: var(--ink); font: 400 17px/1.6 var(--sans); -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; overflow-x: hidden; }
img, svg { display: block; } img { max-width: 100%; height: auto; }
a { color: inherit; text-decoration: none; }
h1, h2, h3, p, ul, figure { margin: 0; } ul { padding: 0; list-style: none; }
h1, h2, .serif { font-family: var(--serif); font-weight: 600; letter-spacing: -.025em; line-height: 1.04; font-optical-sizing: auto; }
h1 { font-size: clamp(2.55rem, 9.4vw, 4.6rem); }
h2 { font-size: clamp(1.95rem, 5.6vw, 3.1rem); line-height: 1.08; }
h3 { font-size: 1.12rem; font-weight: 600; letter-spacing: -.01em; line-height: 1.3; }
em { font-style: italic; color: var(--brand); }
:focus-visible { outline: 3px solid color-mix(in srgb, var(--brand) 55%, white); outline-offset: 3px; border-radius: 8px; }
.wrap { width: 100%; max-width: 1180px; margin: 0 auto; padding: 0 22px; }
.pular { position: absolute; left: -999px; top: 8px; background: var(--ink); color: #fff; padding: 10px 14px; border-radius: 10px; z-index: 100; } .pular:focus { left: 12px; }
section { padding: 76px 0; scroll-margin-top: 70px; }
.ic { flex: none; }

/* botões */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 54px; padding: 0 26px; border-radius: 16px; font: 600 1.02rem/1 var(--sans); color: #fff; background: linear-gradient(180deg, #6c5cea, #5141d2); box-shadow: inset 0 1px 0 rgb(255 255 255 / 28%), 0 1px 2px rgb(22 20 42 / 30%), 0 14px 28px -12px rgb(81 65 210 / 75%); transition: transform .15s ease, box-shadow .2s ease, filter .2s ease; white-space: nowrap; }
.btn .ic { transition: transform .2s ease; }
.btn:hover { filter: brightness(1.07); box-shadow: inset 0 1px 0 rgb(255 255 255 / 28%), 0 1px 2px rgb(22 20 42 / 30%), 0 18px 34px -12px rgb(81 65 210 / 85%); } .btn:hover .ic { transform: translateX(3px); }
.btn:active { transform: translateY(1px) scale(.99); }
.btn.claro { background: var(--surface); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line), var(--sh-1); } .btn.claro:hover { filter: none; box-shadow: inset 0 0 0 1px #d4cfe0, var(--sh-1); }
.btn.branco { background: #fff; color: var(--brand-d); box-shadow: 0 14px 30px -14px rgb(0 0 0 / 55%); }
.btn.p { min-height: 44px; padding: 0 18px; border-radius: 12px; font-size: .95rem; }

/* topo */
.nav { position: sticky; top: 0; z-index: 40; transition: background .25s ease, box-shadow .25s ease; }
.nav.rolou { background: rgb(251 250 247 / 82%); -webkit-backdrop-filter: saturate(1.6) blur(14px); backdrop-filter: saturate(1.6) blur(14px); box-shadow: 0 1px 0 var(--line); }
.nav-in { display: flex; align-items: center; gap: 14px; height: 68px; }
.logo { display: flex; align-items: center; gap: 10px; white-space: nowrap; font: 600 1.28rem/1 var(--serif); letter-spacing: -.02em; } .logo img { width: 34px; height: 34px; border-radius: 10px; }
.nav-links { display: none; gap: 30px; margin-left: 38px; font-size: .95rem; font-weight: 500; color: var(--ink-2); } .nav-links a:hover { color: var(--ink); }
.nav-fim { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.entrar { font-size: .95rem; font-weight: 600; color: var(--ink-2); padding: 10px 12px; border-radius: 10px; } .entrar:hover { color: var(--ink); }

/* herói */
.heroi { position: relative; padding: 26px 0 40px; overflow: hidden; overflow: clip; }
.fundo { position: absolute; inset: 0 0 auto; height: 1040px; z-index: -1; pointer-events: none; overflow: hidden; }
.fundo::before { content: ''; position: absolute; inset: 0; background: radial-gradient(620px 420px at 88% 8%, rgb(91 75 219 / 17%), transparent 70%), radial-gradient(520px 400px at 0% 34%, rgb(18 165 148 / 13%), transparent 70%), radial-gradient(460px 320px at 62% 78%, rgb(245 165 36 / 12%), transparent 70%); -webkit-mask-image: linear-gradient(#000 70%, transparent); mask-image: linear-gradient(#000 70%, transparent); }
.fundo::after { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgb(22 20 42 / 9%) 1px, transparent 1.4px); background-size: 22px 22px; -webkit-mask-image: radial-gradient(ellipse 60% 60% at 72% 34%, #000 10%, transparent 72%); mask-image: radial-gradient(ellipse 60% 60% at 72% 34%, #000 10%, transparent 72%); }
.heroi-grade { display: grid; gap: 44px; align-items: center; }
.selo { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px 6px 6px; border-radius: 999px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line), var(--sh-1); font-size: .86rem; font-weight: 500; color: var(--ink-2); margin-bottom: 22px; }
.selo b { background: var(--teal-soft); color: var(--teal-d); font-weight: 600; padding: 3px 10px; border-radius: 999px; }
.lead { font-size: clamp(1.08rem, 2.6vw, 1.26rem); line-height: 1.55; color: var(--ink-2); max-width: 33em; margin: 22px 0 30px; }
.cta-linha { display: flex; flex-wrap: wrap; gap: 12px; }
.garantias { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-top: 22px; font-size: .92rem; color: var(--ink-2); font-weight: 500; } .garantias li { display: flex; align-items: center; gap: 7px; } .garantias .ic { color: var(--teal); }

.fone { position: relative; border-radius: 13.5% / 6.4%; padding: 3.2%; background: linear-gradient(145deg, #2b2942, #0e0d18); box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 10%), var(--sh-3); }
.fone img { width: 100%; border-radius: 10.8% / 5%; background: #f5f4fb; }
.arte { position: relative; height: 560px; width: 100%; max-width: 440px; margin: 0 auto; }
.arte .fone { position: absolute; top: 0; left: 50%; }
.arte .frente { width: 250px; margin-left: -168px; z-index: 2; }
.arte .tras { width: 218px; margin-left: 6px; top: 46px; filter: saturate(.92) brightness(.985); }
.boia { position: absolute; z-index: 3; display: flex; align-items: center; gap: 10px; padding: 10px 14px 10px 10px; border-radius: 16px; background: rgb(255 255 255 / 94%); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); box-shadow: inset 0 0 0 1px rgb(22 20 42 / 5%), var(--sh-2); font-size: .8rem; line-height: 1.3; animation: boiar 6s ease-in-out infinite alternate; }
.boia b { display: block; font-weight: 600; font-size: .84rem; } .boia small { color: var(--ink-2); font-size: .78rem; }
.boia .q { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; }
.q.t { background: var(--teal-soft); color: var(--teal-d); } .q.b { background: var(--brand-soft); color: var(--brand); } .q.s { background: var(--sun-soft); color: var(--sun-d); } .q.c { background: var(--coral-soft); color: var(--coral-d); }
.b1 { left: -6px; top: 92px; } .b2 { right: -8px; top: 300px; animation-delay: -2s; } .b3 { left: 2px; bottom: 46px; animation-delay: -4s; padding: 8px 14px 8px 8px; }
.caras { display: flex; } .caras i { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-style: normal; font-size: 16px; box-shadow: 0 0 0 2px #fff; margin-left: -8px; } .caras i:first-child { margin-left: 0; }
@keyframes boiar { from { transform: translateY(-5px); } to { transform: translateY(6px); } }

/* faixa de fatos */
.fatos { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line); border-radius: 22px; overflow: hidden; box-shadow: inset 0 0 0 1px var(--line), var(--sh-1); margin-top: 26px; }
.fato { background: var(--surface); padding: 18px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
.fato .q { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; flex: none; }
.fato b { display: block; font-weight: 600; font-size: .98rem; line-height: 1.3; } .fato span { font-size: .86rem; color: var(--ink-2); line-height: 1.35; display: block; margin-top: 2px; }

/* cabeçalhos de seção */
.cab { max-width: 44rem; margin: 0 auto 48px; text-align: center; }
.cab.esq { margin-left: 0; text-align: left; }
.olho { display: inline-flex; align-items: center; gap: 8px; font-size: .78rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--brand); margin-bottom: 16px; }
.olho::before { content: ''; width: 22px; height: 2px; border-radius: 2px; background: currentColor; }
.cab p { margin-top: 18px; font-size: 1.1rem; color: var(--ink-2); }

/* antes e depois */
.troca { display: grid; gap: 16px; }
.lado { border-radius: 28px; padding: 28px 24px; }
.lado h3 { font: 600 1.4rem/1.2 var(--serif); letter-spacing: -.02em; margin-bottom: 18px; }
.lado li { display: flex; gap: 12px; align-items: flex-start; padding: 11px 0; border-top: 1px solid rgb(22 20 42 / 7%); line-height: 1.45; } .lado li:first-child { border-top: 0; }
.lado .m { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; flex: none; margin-top: 1px; }
.antes { background: var(--paper-2); color: var(--ink-2); } .antes h3 { color: var(--ink); } .antes .m { background: rgb(22 20 42 / 8%); color: var(--ink-3); }
.depois { background: var(--surface); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--brand) 35%, var(--line)), var(--sh-2); position: relative; } .depois .m { background: var(--teal); color: #fff; } .depois li { font-weight: 500; }
.depois h3 { display: flex; align-items: center; gap: 10px; } .depois h3 img { width: 28px; height: 28px; border-radius: 8px; }

/* recursos em destaque */
.rec { display: grid; gap: 30px; align-items: center; padding: 34px 0; }
.rec h3 { font: 600 clamp(1.7rem, 4.4vw, 2.5rem)/1.1 var(--serif); letter-spacing: -.025em; margin: 14px 0 16px; }
.rec p { color: var(--ink-2); font-size: 1.08rem; max-width: 30em; }
.etq { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 8px; border-radius: 999px; font-size: .85rem; font-weight: 600; }
.etq.b { background: var(--brand-soft); color: var(--brand-d); } .etq.t { background: var(--teal-soft); color: var(--teal-d); } .etq.s { background: var(--sun-soft); color: var(--sun-d); } .etq.c { background: var(--coral-soft); color: var(--coral-d); }
.ticks { margin-top: 24px; display: grid; gap: 14px; } .ticks li { display: flex; gap: 12px; align-items: flex-start; font-weight: 500; line-height: 1.45; }
.tk { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; flex: none; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line), var(--sh-1); color: var(--brand); margin-top: -3px; }
.rec .palco { order: 2; }
.palco { position: relative; height: 470px; border-radius: 34px; overflow: hidden; display: flex; justify-content: center; padding-top: 44px; }
.palco::after { content: ''; position: absolute; inset: auto 0 0; height: 90px; background: linear-gradient(transparent, rgb(22 20 42 / 10%)); pointer-events: none; }
.palco .fone { width: 262px; flex: none; align-self: flex-start; }
.palco.b { background: linear-gradient(160deg, #e9e6ff, #d3ccff); } .palco.t { background: linear-gradient(160deg, #dcf5f0, #b5e8df); } .palco.s { background: linear-gradient(160deg, #fff3d8, #ffdf9e); } .palco.c { background: linear-gradient(160deg, #ffece7, #ffcfc3); }
.palco.duo { padding-top: 54px; } .palco.duo .fone { width: 178px; } .palco.duo .fone:first-child { transform: translateX(5px) rotate(-3deg); z-index: 2; } .palco.duo .fone:last-child { transform: translate(-5px, 30px) rotate(3deg); }

/* barra mágica */
.magia { position: relative; border-radius: 36px; padding: 44px 24px; background: var(--ink); color: #fff; overflow: hidden; display: grid; gap: 34px; align-items: center; }
.magia::before { content: ''; position: absolute; inset: 0; background: radial-gradient(500px 300px at 90% 0%, rgb(124 102 255 / 45%), transparent 70%), radial-gradient(420px 300px at 0% 100%, rgb(245 110 60 / 22%), transparent 70%); }
.magia > * { position: relative; }
.magia .olho { color: #b8adff; } .magia h2 em { color: #b8adff; } .magia p { color: #c5c2dc; margin-top: 16px; font-size: 1.08rem; max-width: 30em; }
.campo { border-radius: 20px; padding: 2px; background: linear-gradient(90deg, #7c66ff, #d6409f, #f76b15); box-shadow: 0 24px 60px -24px rgb(124 102 255 / 80%); }
.campo-in { display: flex; align-items: center; gap: 12px; background: #fff; color: var(--ink); border-radius: 18px; padding: 0 18px; min-height: 62px; font-size: 1.06rem; font-weight: 500; }
.campo-in .ic { color: var(--brand); } .campo-in .mic { color: var(--ink-3); margin-left: auto; }
.digita { white-space: nowrap; overflow: hidden; } .digita::after { content: ''; display: inline-block; width: 2px; height: 1.1em; background: var(--brand); margin-left: 2px; vertical-align: -3px; animation: pisca 1s steps(2) infinite; }
@keyframes pisca { 50% { opacity: 0; } }
.resultado { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding: 12px 16px; border-radius: 16px; background: rgb(255 255 255 / 9%); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 12%); font-size: .95rem; min-height: 62px; transition: opacity .3s ease, transform .3s ease; }
.resultado.some { opacity: 0; transform: translateY(6px); }
.resultado .q { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; background: rgb(255 255 255 / 12%); color: #fff; flex: none; }
.resultado b { display: block; font-weight: 600; } .resultado small { color: #c5c2dc; font-size: .86rem; }
.resultado .ok { margin-left: auto; color: #6ee7c8; }

/* mosaico */
.mosaico { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.peca { background: var(--surface); border-radius: 26px; box-shadow: inset 0 0 0 1px var(--line), var(--sh-1); padding: 24px; display: flex; flex-direction: column; overflow: hidden; transition: transform .25s ease, box-shadow .25s ease; }
.peca p { color: var(--ink-2); font-size: .95rem; line-height: 1.5; margin-top: 6px; } .peca.g p { margin-bottom: 22px; }
.peca .q { width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; margin-bottom: 16px; }
.peca.g { grid-column: 1 / -1; padding-bottom: 0; } .peca.g h3 { font-size: 1.25rem; } .peca:not(.g) { padding: 18px; } .peca:not(.g) p { font-size: .88rem; }
.peca .recorte { margin: auto -4px 0; height: 300px; overflow: hidden; display: flex; justify-content: center; border-radius: 22px 22px 0 0; padding-top: 22px; }
.peca .recorte .fone { width: 232px; flex: none; align-self: flex-start; box-shadow: 0 20px 44px -20px rgb(22 20 42 / 45%); }
.recorte.b { background: linear-gradient(160deg, #eeebff, #dcd6ff); } .recorte.t { background: linear-gradient(160deg, #e4f7f3, #c4ece5); } .recorte.s { background: linear-gradient(160deg, #fff5df, #ffe5ae); }
@media (hover: hover) { .peca:hover { transform: translateY(-3px); box-shadow: inset 0 0 0 1px #d9d4e6, var(--sh-2); } }

/* telas grandes */
.janela { border-radius: 18px; background: #fff; box-shadow: inset 0 0 0 1px var(--line), var(--sh-3); overflow: hidden; }
.janela-barra { display: flex; align-items: center; gap: 7px; padding: 12px 14px; background: #f3f1f7; border-bottom: 1px solid var(--line); }
.janela-barra i { width: 11px; height: 11px; border-radius: 50%; background: #d9d5e3; } .janela-barra span { margin: 0 auto; font-size: .76rem; color: var(--ink-3); background: #fff; padding: 4px 16px; border-radius: 8px; box-shadow: inset 0 0 0 1px var(--line); max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.telas { position: relative; padding-bottom: 30px; } .telas .fone { position: absolute; right: 2%; bottom: 0; width: 26%; min-width: 96px; z-index: 2; }

/* passos */
.passos { display: grid; gap: 16px; counter-reset: p; }
.passo { position: relative; background: var(--surface); border-radius: 26px; padding: 26px 24px 28px; box-shadow: inset 0 0 0 1px var(--line), var(--sh-1); counter-increment: p; }
.passo::before { content: counter(p); font: 600 3.4rem/1 var(--serif); color: var(--brand); opacity: .9; display: block; margin-bottom: 14px; letter-spacing: -.04em; }
.passo p { color: var(--ink-2); margin-top: 8px; font-size: .98rem; }

/* privacidade */
.cofre { position: relative; border-radius: 36px; padding: 44px 24px; background: linear-gradient(160deg, #1d1a38, #121024); color: #fff; overflow: hidden; display: grid; gap: 34px; }
.cofre::before { content: ''; position: absolute; inset: 0; background: radial-gradient(520px 340px at 100% 0%, rgb(18 165 148 / 28%), transparent 70%); }
.cofre > * { position: relative; } .cofre .olho { color: #6ee7c8; } .cofre h2 em { color: #6ee7c8; } .cofre > div > p { color: #c5c2dc; margin-top: 16px; font-size: 1.08rem; max-width: 28em; }
.chaves { display: grid; gap: 12px; }
.chave { display: flex; gap: 14px; padding: 18px; border-radius: 20px; background: rgb(255 255 255 / 6%); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 10%); }
.chave .q { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: rgb(110 231 200 / 14%); color: #6ee7c8; flex: none; }
.chave b { display: block; font-weight: 600; } .chave span { color: #c5c2dc; font-size: .93rem; line-height: 1.45; display: block; margin-top: 3px; }

/* planos */
.planos { display: grid; gap: 16px; max-width: 860px; margin: 0 auto; }
.plano { position: relative; border-radius: 28px; padding: 30px 26px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line), var(--sh-1); display: flex; flex-direction: column; }
.plano h3 { font-size: 1.05rem; color: var(--ink-2); font-weight: 600; }
.preco { font: 600 3.3rem/1 var(--serif); letter-spacing: -.04em; margin: 14px 0 6px; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; } .preco small { font: 500 1rem/1 var(--sans); letter-spacing: 0; color: var(--ink-2); }
.plano .sub { color: var(--ink-2); font-size: .95rem; }
.plano ul { margin: 22px 0 26px; display: grid; gap: 12px; font-size: .97rem; } .plano li { display: flex; gap: 10px; align-items: flex-start; line-height: 1.4; } .plano li .ic { color: var(--teal); margin-top: 2px; }
.plano .btn { margin-top: auto; }
.plano.top { background: linear-gradient(165deg, #2a2360, #17142e); color: #fff; box-shadow: var(--sh-3); }
.plano.top h3, .plano.top .sub, .plano.top .preco small { color: #c9c4ee; } .plano.top li .ic { color: #6ee7c8; }
.fita { position: absolute; top: 22px; right: 22px; background: linear-gradient(90deg, #f5a524, #f76b15); color: #2a1500; font-size: .76rem; font-weight: 700; padding: 5px 11px; border-radius: 999px; }
.nota-planos { text-align: center; margin-top: 26px; color: var(--ink-2); font-size: .93rem; }

/* dúvidas */
.duvidas { display: grid; gap: 34px; }
.faq { display: grid; gap: 10px; }
details { background: var(--surface); border-radius: 20px; box-shadow: inset 0 0 0 1px var(--line); transition: box-shadow .2s ease; } details[open] { box-shadow: inset 0 0 0 1px #d6d0e6, var(--sh-1); }
summary { cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 22px; font-weight: 600; line-height: 1.35; } summary::-webkit-details-marker { display: none; }
summary .ic { color: var(--brand); transition: transform .25s ease; } details[open] summary .ic { transform: rotate(45deg); }
details p { padding: 0 22px 22px; color: var(--ink-2); margin-top: -4px; }
.ajuda { color: var(--ink-2); margin-top: 16px; } .ajuda a { color: var(--brand); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }

/* chamada final */
.final { position: relative; overflow: hidden; border-radius: 40px; padding: 60px 24px; text-align: center; color: #fff; background: linear-gradient(135deg, #5b4bdb 0%, #6f4fe6 45%, #8a4fd8 100%); }
.final::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgb(255 255 255 / 16%) 1px, transparent 1.4px); background-size: 22px 22px; -webkit-mask-image: radial-gradient(ellipse 70% 80% at 50% 0%, #000, transparent 75%); mask-image: radial-gradient(ellipse 70% 80% at 50% 0%, #000, transparent 75%); }
.final::after { content: ''; position: absolute; width: 520px; height: 520px; border-radius: 50%; right: -180px; bottom: -300px; background: radial-gradient(circle, rgb(245 165 36 / 45%), transparent 65%); }
.final > * { position: relative; z-index: 1; } .final h2 em { color: #ffe2a8; } .final p { margin: 18px auto 30px; max-width: 30em; color: rgb(255 255 255 / 88%); font-size: 1.1rem; }
.final .garantias { justify-content: center; color: rgb(255 255 255 / 85%); } .final .garantias .ic { color: #a8f5e0; }

/* rodapé */
footer { padding: 26px 0 120px; color: var(--ink-2); font-size: .93rem; }
.rod { display: grid; gap: 30px; padding: 34px 0; border-top: 1px solid var(--line); }
.rod p { max-width: 24em; margin-top: 12px; } .rod h4 { margin: 0 0 12px; font-size: .78rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); font-weight: 700; }
.rod ul { display: grid; gap: 9px; } .rod li a:hover { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.rod-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; }
.fim { border-top: 1px solid var(--line); padding-top: 20px; font-size: .86rem; color: var(--ink-3); }

/* botão fixo no celular */
.fixo { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; padding: 10px 14px calc(10px + env(safe-area-inset-bottom)); background: rgb(251 250 247 / 88%); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); box-shadow: 0 -1px 0 var(--line); transform: translateY(110%); transition: transform .3s ease; }
.fixo.on { transform: none; } .fixo .btn { width: 100%; }

/* entrada suave ao rolar (só com JavaScript ligado) */
.js [data-r] { opacity: 0; transform: translateY(22px); transition: opacity .7s cubic-bezier(.2, .7, .2, 1), transform .7s cubic-bezier(.2, .7, .2, 1); transition-delay: var(--d, 0s); }
.js [data-r].viu { opacity: 1; transform: none; }

@media (min-width: 560px) {
  .wrap { padding: 0 30px; }
  .arte { height: 600px; } .arte .frente { width: 268px; margin-left: -190px; } .arte .tras { width: 234px; margin-left: 14px; }
  .b1 { left: -10px; } .b2 { right: -14px; }
  .palco { height: 520px; } .palco .fone { width: 280px; } .palco.duo .fone { width: 232px; } .palco.duo .fone:first-child { transform: translateX(-4px) rotate(-3deg); } .palco.duo .fone:last-child { transform: translate(4px, 34px) rotate(3deg); }
}
@media (min-width: 760px) {
  section { padding: 104px 0; }
  .fatos { grid-template-columns: repeat(4, 1fr); margin-top: 40px; } .fato { padding: 22px; flex-direction: row; }
  .troca { grid-template-columns: 1fr 1fr; gap: 20px; } .lado { padding: 36px 34px; }
  .mosaico { grid-template-columns: repeat(12, 1fr); gap: 16px; } .peca, .peca:not(.g) { grid-column: span 3; padding: 24px; } .peca:not(.g) p { font-size: .95rem; } .peca.g { grid-column: span 4; padding-bottom: 0; }
  .passos { grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .planos { grid-template-columns: 1fr 1fr; gap: 20px; } .plano .sub { min-height: 3.3em; }
  .chaves { grid-template-columns: 1fr 1fr; }
  .magia, .cofre { padding: 64px 56px; }
  .final { padding: 88px 40px; }
  .rod { grid-template-columns: 1.3fr 1fr; } .rod-cols { grid-template-columns: repeat(3, auto); justify-content: space-between; }
}
@media (min-width: 960px) {
  .nav-links { display: flex; } .nav-in { height: 76px; }
  .heroi { padding: 44px 0 30px; }
  .heroi-grade { grid-template-columns: 1.08fr .92fr; gap: 30px; }
  .arte { height: 690px; max-width: 520px; } .arte .frente { width: 306px; margin-left: -226px; } .arte .tras { width: 266px; margin-left: 30px; top: 58px; }
  .b1 { left: -34px; top: 120px; } .b2 { right: -22px; top: 380px; } .b3 { left: -8px; bottom: 60px; }
  .boia { font-size: .86rem; padding: 12px 18px 12px 12px; } .boia b { font-size: .92rem; } .boia small { font-size: .82rem; }
  .rec { grid-template-columns: 1fr 1fr; gap: 84px; padding: 50px 0; } .rec .palco { order: 0; } .rec.inv .palco { order: 2; }
  .palco { height: 600px; padding-top: 56px; } .palco .fone { width: 316px; } .palco.duo .fone { width: 226px; }
  .magia { grid-template-columns: 1fr 1fr; gap: 64px; padding: 76px 72px; }
  .cofre { grid-template-columns: .9fr 1.1fr; gap: 56px; padding: 76px 72px; align-items: center; }
  .duvidas { grid-template-columns: .8fr 1.2fr; gap: 70px; align-items: start; } .duvidas .cab { position: sticky; top: 110px; margin-bottom: 0; }
  .telas-grade { display: grid; grid-template-columns: .8fr 1.2fr; gap: 64px; align-items: center; } .telas-grade .cab { margin-bottom: 0; }
  .fixo { display: none; } footer { padding-bottom: 44px; }
}
@media (max-width: 559px) { .entrar { display: none; } .cta-linha .btn { width: 100%; } .cta-linha .claro, .heroi .garantias { display: none; } .heroi-grade { gap: 38px; } .lead { margin: 18px 0 24px; } }
@media (max-width: 380px) { .b2 { top: 318px; } .boia { font-size: .74rem; } .arte .frente { margin-left: -160px; } .garantias { font-size: .88rem; } }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation: none !important; transition: none !important; }
  .js [data-r] { opacity: 1; transform: none; }
}
</style>
</head>
<body>
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<div class="fundo" aria-hidden="true"></div>

<header class="nav" id="nav">
  <div class="wrap nav-in">
    <a class="logo" href="/comecar" aria-label="Nosso Lar, início"><img src="/icon.svg" alt="" width="34" height="34">Nosso Lar</a>
    <nav class="nav-links" aria-label="Seções">
      <a href="#recursos">Recursos</a><a href="#como-funciona">Como funciona</a><a href="#planos">Planos</a><a href="#duvidas">Dúvidas</a>
    </nav>
    <div class="nav-fim">
      <a class="entrar" href="/" data-cta="entrar">Entrar</a>
      <a class="btn p" href="/#cadastro" data-cta>Testar grátis</a>
    </div>
  </div>
</header>

<main id="conteudo">
<div class="heroi">
  <div class="wrap heroi-grade">
    <div>
      <span class="selo" data-r><b>${testeDias} dias grátis</b> Sem cartão de crédito</span>
      <h1 data-r style="--d:.05s">A casa organizada. A família <em>no mesmo lugar.</em></h1>
      <p class="lead" data-r style="--d:.12s">Agenda, compras, tarefas, cardápio e recados num único app. Cada um sabe o que precisa fazer, e ninguém precisa perguntar duas vezes.</p>
      <div class="cta-linha" data-r style="--d:.18s">
        ${cta('Começar meu teste grátis')}
        <a class="btn claro" href="#recursos">Ver como funciona</a>
      </div>
      <ul class="garantias" data-r style="--d:.24s">
        <li>${ic('check', 17)} Uma assinatura para a família inteira</li>
        <li>${ic('check', 17)} Celular e computador</li>
        <li>${ic('check', 17)} Cancele quando quiser</li>
      </ul>
    </div>
    <div class="arte" data-r style="--d:.2s">
      ${fone('agenda', '', 'tras', 'loading="eager" decoding="async" aria-hidden="true"')}
      ${fone('inicio', 'Tela inicial do Nosso Lar: a casa da família, o resumo do dia, a semana e a barra para escrever ou falar', 'frente', 'loading="eager" fetchpriority="high" decoding="async"')}
      <div class="boia b1" aria-hidden="true"><span class="q t">${ic('carrinho', 18)}</span><span><b>Compras</b><small>Rafa adicionou Iogurte</small></span></div>
      <div class="boia b2" aria-hidden="true"><span class="q b">${ic('sino', 18)}</span><span><b>Dentista da Lia</b><small>15:30 · Clínica Sorriso</small></span></div>
      <div class="boia b3" aria-hidden="true"><span class="caras"><i style="background:#5b4bdb">👩</i><i style="background:#12a594">👨</i><i style="background:#f76b15">👧</i><i style="background:#3e63dd">👦</i></span><span><b>Família Lima</b><small>4 pessoas conectadas</small></span></div>
    </div>
  </div>
  <div class="wrap">
    <div class="fatos" data-r>
      <div class="fato"><span class="q t">${ic('presente')}</span><div><b>${testeDias} dias grátis</b><span>Sem informar cartão</span></div></div>
      <div class="fato"><span class="q b">${ic('pessoas')}</span><div><b>Uma assinatura</b><span>Vale para a família toda</span></div></div>
      <div class="fato"><span class="q s">${ic('celular')}</span><div><b>Em qualquer tela</b><span>Sem loja de aplicativos</span></div></div>
      <div class="fato"><span class="q c">${ic('cadeado')}</span><div><b>Privado</b><span>Seus dados não são vendidos</span></div></div>
    </div>
  </div>
</div>

<section>
  <div class="wrap">
    <div class="cab" data-r>
      <span class="olho">O problema</span>
      <h2>A rotina da casa não cabe num <em>grupo de mensagens.</em></h2>
      <p>O recado some na conversa, a lista fica em casa e ninguém lembra de quem era a vez. O Nosso Lar dá um lugar certo para cada coisa.</p>
    </div>
    <div class="troca">
      <div class="lado antes" data-r>
        <h3>Do jeito de sempre</h3>
        <ul>
          ${['A lista de compras num papel que ficou em casa', 'Compromissos espalhados em vários calendários', '“Mas não era a sua vez de levar o lixo?”', 'Recado importante perdido no meio da conversa', '“O que tem para o jantar?”, todos os dias'].map((t) => `<li><span class="m">${ic('x', 13)}</span><span>${t}</span></li>`).join('')}
        </ul>
      </div>
      <div class="lado depois" data-r style="--d:.1s">
        <h3><img src="/icon.svg" alt="" width="28" height="28">Com o Nosso Lar</h3>
        <ul>
          ${['Uma lista que todos veem e editam do próprio celular', 'Uma agenda só, com a cor de cada pessoa', 'Tarefas com responsável, prazo e rodízio', 'Mural e chat só da família, sem distração', 'O cardápio da semana pronto e à vista'].map((t) => `<li><span class="m">${ic('check', 13)}</span><span>${t}</span></li>`).join('')}
        </ul>
      </div>
    </div>
  </div>
</section>

<section id="recursos" style="padding-top:20px">
  <div class="wrap">
    <div class="cab" data-r>
      <span class="olho">Recursos</span>
      <h2>Tudo o que a família usa, <em>num lugar só.</em></h2>
      <p>As telas abaixo são do próprio app, com uma família de exemplo.</p>
    </div>

    <div class="rec">
      <div class="palco b" data-r>${fone('agenda', 'Agenda do Nosso Lar com os compromissos e tarefas da família, cada pessoa com a sua cor')}</div>
      <div data-r style="--d:.08s">
        <span class="etq b">${ic('agenda', 16)} Agenda</span>
        <h3>Todo mundo sabe o que vem pela frente.</h3>
        <p>Consulta, escola, natação, aniversário. Os compromissos de todos num calendário só, e dá para ver de quem é cada um num relance.</p>
        ${ticks([['pessoas', 'Cada pessoa com a sua cor, e filtro por pessoa'], ['sino', 'Lembrete no celular antes do horário'], ['repetir', 'Eventos que se repetem e aniversários automáticos']])}
      </div>
    </div>

    <div class="rec inv">
      <div class="palco t" data-r>${fone('compras', 'Lista de compras compartilhada, mostrando quem adicionou cada item')}</div>
      <div data-r style="--d:.08s">
        <span class="etq t">${ic('carrinho', 16)} Compras e listas</span>
        <h3>A lista de compras que nunca fica em casa.</h3>
        <p>Acabou o café? Qualquer um coloca na lista. Quem está no mercado vê na hora e vai marcando o que já pegou.</p>
        ${ticks([['pessoas', 'Todos adicionam e marcam; atualiza em segundos'], ['sino', 'Aviso quando alguém coloca um item'], ['brilho', 'Sugestão do que você costuma comprar de novo']])}
      </div>
    </div>

    <div class="rec">
      <div class="palco s duo" data-r>${fone('cardapio', 'Cardápio da semana com as refeições de cada dia')}${fone('cozinha', 'Modo cozinha: um passo da receita por vez, com cronômetro')}</div>
      <div data-r style="--d:.08s">
        <span class="etq s">${ic('talheres', 16)} Cardápio e receitas</span>
        <h3>“O que tem para o jantar?” já está respondido.</h3>
        <p>Planeje a semana em minutos, guarde as receitas da família e cozinhe com o passo a passo na tela.</p>
        ${ticks([['brilho', 'Sugestão automática do cardápio da semana'], ['carrinho', 'Ingredientes vão direto para a lista de compras'], ['relogio', 'Modo cozinha: um passo por vez, com cronômetro'], ['link', 'Importe receitas de sites colando o link']])}
      </div>
    </div>

    <div class="rec inv">
      <div class="palco c" data-r>${fone('tarefas', 'Tarefas da casa com responsável, prazo e os pontos da semana de cada pessoa')}</div>
      <div data-r style="--d:.08s">
        <span class="etq c">${ic('tarefa', 16)} Tarefas da casa</span>
        <h3>Tarefas divididas, sem precisar cobrar.</h3>
        <p>Cada tarefa tem dono e prazo. Quem conclui ganha pontos, e a casa inteira vê quem está ajudando.</p>
        ${ticks([['pessoas', 'Responsável e prazo em cada tarefa'], ['repetir', 'Rodízio automático entre as pessoas'], ['trofeu', 'Pontos da semana para animar as crianças']])}
      </div>
    </div>
  </div>
</section>

<section style="padding-top:20px">
  <div class="wrap">
    <div class="magia" data-r>
      <div>
        <span class="olho">Barra mágica</span>
        <h2>Escreva ou fale <em>do seu jeito.</em></h2>
        <p>Você não precisa abrir menus. Diga o que precisa numa frase, e o Nosso Lar entende se é um compromisso, uma compra ou um gasto.</p>
      </div>
      <div aria-hidden="true">
        <div class="campo"><div class="campo-in">${ic('brilho', 22)}<span class="digita" id="digita">dentista amanhã às 15h</span><span class="mic">${ic('mic', 20)}</span></div></div>
        <div class="resultado" id="resultado"><span class="q" id="res-ic">${ic('agenda')}</span><span><b id="res-t">Evento criado</b><small id="res-d">Dentista · amanhã, 15:00</small></span><span class="ok">${ic('check', 20)}</span></div>
      </div>
    </div>
  </div>
</section>

<section style="padding-top:20px">
  <div class="wrap">
    <div class="cab" data-r>
      <span class="olho">E tem mais</span>
      <h2>Um app no lugar de <em>dez.</em></h2>
      <p>Tudo incluído na mesma assinatura, sem pagar nada a mais por recurso.</p>
    </div>
    <div class="mosaico">
      <div class="peca g" data-r><h3>Chat da família</h3><p>Conversa em grupo e mensagens entre duas pessoas, sem misturar com o resto.</p><div class="recorte b">${fone('chat', 'Chat da família no Nosso Lar')}</div></div>
      <div class="peca g" data-r style="--d:.08s"><h3>Mural e votações</h3><p>Recados, fotos e enquetes. “Cinema ou parque no sábado?” se resolve em um toque.</p><div class="recorte t">${fone('mural', 'Mural da família com uma votação')}</div></div>
      <div class="peca g" data-r style="--d:.16s"><h3>Orçamento da casa</h3><p>Entradas, gastos e saldo do mês, com o total por categoria.</p><div class="recorte s">${fone('orcamento', 'Orçamento do mês com gastos por categoria')}</div></div>
      <div class="peca" data-r><span class="q b">${ic('foto')}</span><h3>Fotos</h3><p>Álbuns da família, guardados em um lugar só de vocês.</p></div>
      <div class="peca" data-r style="--d:.06s"><span class="q c">${ic('presente')}</span><h3>Lista de desejos</h3><p>Cada um diz o que quer ganhar. Quem reserva o presente fica em segredo.</p></div>
      <div class="peca" data-r style="--d:.12s"><span class="q t">${ic('radar')}</span><h3>Radar da casa</h3><p>O app percebe o que está pedindo atenção e avisa antes de virar problema.</p></div>
      <div class="peca" data-r style="--d:.18s"><span class="q s">${ic('sino')}</span><h3>Avisos</h3><p>Notificações no celular. Cada pessoa escolhe o que quer receber.</p></div>
      <div class="peca" data-r><span class="q t">${ic('nota')}</span><h3>Notas</h3><p>Senha do wi-fi, medidas, lembretes. O que a família sempre procura.</p></div>
      <div class="peca" data-r style="--d:.06s"><span class="q b">${ic('contato')}</span><h3>Contatos</h3><p>Do pediatra à escola: os telefones úteis ao alcance de todos.</p></div>
      <div class="peca" data-r style="--d:.12s"><span class="q c">${ic('halter')}</span><h3>Treino</h3><p>Seu plano de treino e suas cargas, visíveis só para você.</p></div>
      <div class="peca" data-r style="--d:.18s"><span class="q s">${ic('paleta')}</span><h3>Com a sua cara</h3><p>Quatro visuais e a cor da família, para o app ficar do seu jeito.</p></div>
    </div>
  </div>
</section>

<section style="padding-top:20px">
  <div class="wrap telas-grade">
    <div class="cab esq" data-r>
      <span class="olho">Em qualquer tela</span>
      <h2>No celular, no tablet e <em>no computador.</em></h2>
      <p>Abra no navegador ou coloque na tela inicial do celular para usar como um app. Não precisa de loja nem de atualização.</p>
      ${ticks([['wifi', 'Sem internet? Anote mesmo assim; envia quando voltar'], ['celular', 'Funciona no iPhone, no Android e no computador']])}
    </div>
    <div class="telas" data-r style="--d:.1s">
      <div class="janela"><div class="janela-barra"><i></i><i></i><i></i><span>Nosso Lar · Agenda</span></div><img src="/lp/desktop.webp" width="1760" height="1100" alt="Nosso Lar no computador, com a agenda do mês e os compromissos de cada pessoa" loading="lazy" decoding="async"></div>
      ${fone('inicio', '', '', 'loading="lazy" decoding="async" aria-hidden="true"')}
    </div>
  </div>
</section>

<section id="como-funciona" style="padding-top:20px">
  <div class="wrap">
    <div class="cab" data-r>
      <span class="olho">Como funciona</span>
      <h2>Pronto em <em>poucos minutos.</em></h2>
    </div>
    <div class="passos">
      <div class="passo" data-r><h3>Crie a sua conta</h3><p>Com e-mail e senha ou com o Google. Você não informa cartão para começar.</p></div>
      <div class="passo" data-r style="--d:.08s"><h3>Convide a família</h3><p>Envie o código da família pelo WhatsApp. Cada pessoa entra com a própria conta.</p></div>
      <div class="passo" data-r style="--d:.16s"><h3>Organizem juntos</h3><p>Coloquem os compromissos, a lista de compras e as tarefas. O que um faz, todos veem.</p></div>
    </div>
  </div>
</section>

<section style="padding-top:20px">
  <div class="wrap">
    <div class="cofre" data-r>
      <div>
        <span class="olho">Privacidade</span>
        <h2>Juntos, mas cada um com <em>o seu espaço.</em></h2>
        <p>A família compartilha o que importa e mantém privado o que é pessoal. E os dados de vocês continuam sendo de vocês.</p>
      </div>
      <div class="chaves">
        <div class="chave"><span class="q">${ic('cadeado')}</span><div><b>Entrada protegida</b><span>Só entra quem tem conta e o código. O dono vê e remove acessos.</span></div></div>
        <div class="chave"><span class="q">${ic('olho')}</span><div><b>O pessoal fica pessoal</b><span>Treino e conversas a dois só aparecem para quem participa.</span></div></div>
        <div class="chave"><span class="q">${ic('presente')}</span><div><b>Surpresa é surpresa</b><span>Quem vai ganhar o presente não vê quem o reservou.</span></div></div>
        <div class="chave"><span class="q">${ic('baixar')}</span><div><b>Seus dados são seus</b><span>Baixe tudo ou exclua a conta quando quiser. Não vendemos dados.</span></div></div>
      </div>
    </div>
  </div>
</section>

<section id="planos" style="padding-top:20px">
  <div class="wrap">
    <div class="cab" data-r>
      <span class="olho">Planos</span>
      <h2>Comece grátis. <em>Decida depois.</em></h2>
      <p>Um preço só para a família inteira, com tudo incluído.</p>
    </div>
    <div class="planos">
      <div class="plano" data-r>
        <h3>Mensal</h3>
        <div class="preco">${mensal}<small>por mês</small></div>
        <p class="sub">Para ir no seu ritmo. Cancele quando quiser.</p>
        <ul>
          <li>${ic('check', 18)} Todos os recursos do app</li>
          <li>${ic('check', 18)} Para todas as pessoas da família</li>
          <li>${ic('check', 18)} Pix, boleto ou cartão</li>
        </ul>
        <a class="btn claro" href="/#cadastro" data-cta>Começar teste grátis</a>
      </div>
      <div class="plano top" data-r style="--d:.1s">
        <span class="fita">Economize ${pct}%</span>
        <h3>Anual</h3>
        <div class="preco">${anual}<small>por ano</small></div>
        <p class="sub">Equivale a ${porMes} por mês. São ${economia} a menos por ano.</p>
        <ul>
          <li>${ic('check', 18)} Todos os recursos do app</li>
          <li>${ic('check', 18)} Para todas as pessoas da família</li>
          <li>${ic('check', 18)} Pix, boleto ou cartão</li>
        </ul>
        <a class="btn branco" href="/#cadastro" data-cta>Começar teste grátis ${ic('seta', 18)}</a>
      </div>
    </div>
    <p class="nota-planos" data-r>Os ${testeDias} primeiros dias são grátis nos dois planos. Você só escolhe o plano se quiser continuar.</p>
  </div>
</section>

<section id="duvidas" style="padding-top:20px">
  <div class="wrap duvidas">
    <div class="cab esq" data-r>
      <span class="olho">Dúvidas</span>
      <h2>Perguntas <em>frequentes</em></h2>
      ${mail ? `<p class="ajuda">Não achou a resposta? Escreva para ${mail}.</p>` : ''}
    </div>
    <div class="faq" data-r style="--d:.08s">
      ${faq.map(([q, a]) => `<details><summary>${esc(q)}${ic('mais', 20)}</summary><p>${esc(a)}</p></details>`).join('\n      ')}
    </div>
  </div>
</section>

<section style="padding-top:20px">
  <div class="wrap">
    <div class="final" data-r>
      <h2>A casa de vocês, <em>mais leve</em> a partir de hoje.</h2>
      <p>Crie a conta, convide a família e veja a rotina se organizar. São ${testeDias} dias grátis, sem cartão.</p>
      ${cta('Começar meu teste grátis', 'branco')}
      <ul class="garantias" style="margin-top:26px">
        <li>${ic('check', 17)} Sem cartão para testar</li>
        <li>${ic('check', 17)} Cancele quando quiser</li>
        <li>${ic('check', 17)} Nada é apagado</li>
      </ul>
    </div>
  </div>
</section>
</main>

<footer>
  <div class="wrap">
    <div class="rod">
      <div>
        <a class="logo" href="/comecar"><img src="/icon.svg" alt="" width="34" height="34">Nosso Lar</a>
        <p>O app que organiza a casa e deixa a família no mesmo lugar.</p>
      </div>
      <div class="rod-cols">
        <div><h4>Produto</h4><ul><li><a href="#recursos">Recursos</a></li><li><a href="#como-funciona">Como funciona</a></li><li><a href="#planos">Planos</a></li><li><a href="#duvidas">Dúvidas</a></li></ul></div>
        <div><h4>Conta</h4><ul><li><a href="/#cadastro" data-cta>Criar conta</a></li><li><a href="/" data-cta="entrar">Entrar</a></li></ul></div>
        <div><h4>Legal</h4><ul><li><a href="/termos">Termos de Uso</a></li><li><a href="/privacidade">Privacidade</a></li>${mail ? `<li>${mail}</li>` : ''}</ul></div>
      </div>
    </div>
    <p class="fim">© ${new Date().getFullYear()} Nosso Lar${empresa ? ' · ' + esc(empresa) : ''}${cnpj ? ' · CNPJ ' + esc(cnpj) : ''}</p>
  </div>
</footer>

<div class="fixo" id="fixo"><a class="btn" href="/#cadastro" data-cta>Começar grátis · ${testeDias} dias ${ic('seta', 18)}</a></div>

<script>
(function () {
  var d = document, html = d.documentElement
  html.classList.add('js')
  // Mantém os parâmetros do anúncio (utm_source, fbclid…) ao ir para o cadastro.
  var q = location.search || ''
  d.querySelectorAll('a[data-cta]').forEach(function (a) {
    a.href = '/' + q + (a.getAttribute('data-cta') === 'entrar' ? '' : '#cadastro')
  })
  // Topo com fundo ao rolar.
  var nav = d.getElementById('nav')
  var aoRolar = function () { nav.classList.toggle('rolou', window.scrollY > 8) }
  aoRolar(); window.addEventListener('scroll', aoRolar, { passive: true })
  var semIO = !('IntersectionObserver' in window)
  // O topo aparece logo ao abrir, sem depender da rolagem.
  requestAnimationFrame(function () { d.querySelectorAll('.heroi [data-r]').forEach(function (e) { e.classList.add('viu') }) })
  // Entrada suave das seções.
  var itens = d.querySelectorAll('[data-r]')
  if (semIO) itens.forEach(function (e) { e.classList.add('viu') })
  else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('viu'); io.unobserve(e.target) } })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    itens.forEach(function (e) { io.observe(e) })
    // Botão fixo no celular: aparece quando o botão do topo sai da tela.
    var fixo = d.getElementById('fixo'), alvo = d.querySelector('.cta-linha .btn')
    if (fixo && alvo) new IntersectionObserver(function (e) { fixo.classList.toggle('on', !e[0].isIntersecting && window.scrollY > 200) }).observe(alvo)
  }
  // Barra mágica: digita exemplos reais do que o app entende.
  var campo = d.getElementById('digita'), res = d.getElementById('resultado')
  var calmo = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!campo || !res || calmo || semIO) return
  var icones = { e: ${JSON.stringify(ic('agenda'))}, c: ${JSON.stringify(ic('carrinho'))}, g: ${JSON.stringify(ic('carteira'))}, t: ${JSON.stringify(ic('tarefa'))} }
  var exemplos = [
    ['dentista amanhã às 15h', 'e', 'Evento criado', 'Dentista · amanhã, 15:00'],
    ['comprar leite e pão', 'c', 'Lista de compras', '2 itens adicionados: leite e pão'],
    ['gastei 35,90 no mercado', 'g', 'Gasto registrado', 'R$ 35,90 · Mercado'],
    ['levar o lixo para fora', 't', 'Tarefa criada', 'Levar o lixo para fora'],
  ]
  var n = 0, rodando = false, visivel = false
  var mostrar = function (ex) {
    d.getElementById('res-ic').innerHTML = icones[ex[1]]
    d.getElementById('res-t').textContent = ex[2]
    d.getElementById('res-d').textContent = ex[3]
    res.classList.remove('some')
  }
  var ciclo = function () {
    if (!visivel) { rodando = false; return }
    rodando = true
    var ex = exemplos[n % exemplos.length], i = 0
    res.classList.add('some'); campo.textContent = ''
    var t = setInterval(function () {
      campo.textContent = ex[0].slice(0, ++i)
      if (i >= ex[0].length) { clearInterval(t); setTimeout(function () { mostrar(ex) }, 350); n++; setTimeout(ciclo, 3400) }
    }, 55)
  }
  new IntersectionObserver(function (e) { visivel = e[0].isIntersecting; if (visivel && !rodando) { n = n || 1; setTimeout(ciclo, 2200) } }, { threshold: 0.4 }).observe(res)
})()
</script>
</body>
</html>`
}
