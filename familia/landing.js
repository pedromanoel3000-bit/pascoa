// Página de apresentação (landing page) para onde os anúncios levam: /comecar
// Os botões levam ao cadastro do app (/#cadastro) e mantêm os parâmetros do anúncio (utm_…) no endereço.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const reais = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function landingHtml({ precos = { mensal: 9.9, anual: 99 }, testeDias = 7, leituraDias = 3, contato = '', empresa = '', cnpj = '' } = {}) {
  const mensal = reais(precos.mensal)
  const anual = reais(precos.anual)
  const porMes = reais(precos.anual / 12)
  const economia = reais(precos.mensal * 12 - precos.anual)
  const titulo = 'Nosso Lar: a agenda, as compras e as tarefas da família no mesmo lugar'
  const desc = `Agenda, lista de compras, tarefas, cardápio, fotos e recados para casais e famílias. Teste grátis por ${testeDias} dias, sem cartão.`
  const rodape = [empresa && esc(empresa), cnpj && 'CNPJ ' + esc(cnpj), contato && `<a href="mailto:${esc(contato)}">${esc(contato)}</a>`].filter(Boolean).join(' · ')
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#5b4bdb">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="/lp/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
:root { --bg: #f7f6fd; --card: #fff; --text: #1c1b29; --muted: #5f5d73; --brand: #5b4bdb; --brand-d: #4a3bc4; --teal: #12a594; --line: #e6e4f3; --r: 20px; }
* { box-sizing: border-box; } html { scroll-behavior: smooth; }
body { margin: 0; background: var(--bg); color: var(--text); font: 17px/1.55 Nunito, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
img { max-width: 100%; display: block; } a { color: inherit; }
.wrap { max-width: 1040px; margin: 0 auto; padding: 0 20px; }
h1, h2, h3 { line-height: 1.15; margin: 0; letter-spacing: -.01em; } h1 { font-size: clamp(2rem, 6.4vw, 3.2rem); font-weight: 800; } h2 { font-size: clamp(1.55rem, 4.4vw, 2.2rem); font-weight: 800; } h3 { font-size: 1.1rem; font-weight: 700; }
p { margin: 0; } .muted { color: var(--muted); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; padding: 0 26px; border-radius: 999px; background: var(--brand); color: #fff; font-weight: 800; font-size: 1.05rem; text-decoration: none; box-shadow: 0 8px 22px -8px rgb(91 75 219 / 70%); transition: transform .12s ease, background .2s; }
.btn:hover { background: var(--brand-d); } .btn:active { transform: scale(.98); } .btn.alt { background: transparent; color: var(--brand); box-shadow: inset 0 0 0 2px var(--brand); }
.topo { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; }
.logo { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 1.15rem; text-decoration: none; } .logo img { width: 36px; height: 36px; border-radius: 10px; }
.topo .entrar { font-weight: 700; color: var(--muted); text-decoration: none; font-size: .95rem; }
.hero { display: grid; gap: 28px; padding: 18px 0 56px; align-items: center; }
.hero p.lead { font-size: 1.15rem; color: var(--muted); margin: 16px 0 24px; max-width: 34em; }
.hero .nota { margin-top: 12px; font-size: .92rem; color: var(--muted); }
.selo { display: inline-block; background: color-mix(in srgb, var(--teal) 16%, #fff); color: #0b6e62; font-weight: 800; font-size: .85rem; padding: 6px 12px; border-radius: 999px; margin-bottom: 14px; }
.fone { width: min(280px, 72vw); margin: 0 auto; border-radius: 38px; border: 9px solid #1c1b29; background: #1c1b29; box-shadow: 0 30px 60px -24px rgb(28 27 41 / 55%); overflow: hidden; }
.fone img { width: 100%; height: auto; aspect-ratio: 1/2; object-fit: cover; object-position: top; border-radius: 28px; }
section { padding: 56px 0; } .sec-t { text-align: center; max-width: 36em; margin: 0 auto 32px; } .sec-t p { margin-top: 10px; color: var(--muted); }
.dores { display: grid; gap: 14px; }
.dor { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); padding: 22px; } .dor b { display: block; font-size: 1.12rem; margin-bottom: 6px; } .dor span { font-size: 1.8rem; display: block; margin-bottom: 8px; }
.dor p { color: var(--muted); }
.recursos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.rec { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 16px; } .rec span { font-size: 1.5rem; display: block; margin-bottom: 6px; } .rec b { display: block; margin-bottom: 2px; } .rec p { font-size: .93rem; color: var(--muted); line-height: 1.4; }
.telas { background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--brand) 8%, var(--bg)) 20%, color-mix(in srgb, var(--brand) 8%, var(--bg)) 80%, transparent); }
.carrossel { display: flex; gap: 22px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 6px 20px 26px; margin: 0 -20px; -webkit-overflow-scrolling: touch; }
.carrossel figure { margin: 0; flex: 0 0 auto; scroll-snap-align: center; text-align: center; width: min(260px, 70vw); } .carrossel figcaption { margin-top: 12px; font-weight: 700; }
.fone.p { width: 100%; }
.dois { display: grid; gap: 14px; }
.perfil { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); padding: 26px; } .perfil h3 { font-size: 1.3rem; margin-bottom: 10px; } .perfil ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; } .perfil li { padding-left: 28px; position: relative; color: var(--muted); } .perfil li::before { content: '✓'; position: absolute; left: 0; color: var(--teal); font-weight: 800; }
.privado { background: #1c1b29; color: #edecf5; border-radius: 28px; padding: 36px 24px; display: grid; gap: 22px; } .privado h2 { color: #fff; } .privado p { color: #bdbbd2; } .privado ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 12px; } .privado li { padding-left: 30px; position: relative; } .privado li::before { content: '🔒'; position: absolute; left: 0; font-size: .95rem; }
.planos { display: grid; gap: 14px; max-width: 760px; margin: 0 auto; }
.plano { background: var(--card); border: 2px solid var(--line); border-radius: var(--r); padding: 24px; text-align: center; } .plano.dest { border-color: var(--brand); position: relative; } .plano .etq { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); background: var(--brand); color: #fff; font-size: .8rem; font-weight: 800; padding: 4px 12px; border-radius: 999px; white-space: nowrap; }
.plano .preco { font-size: 2.3rem; font-weight: 800; margin: 6px 0 2px; } .plano .preco small { font-size: 1rem; font-weight: 600; color: var(--muted); } .plano p { color: var(--muted); font-size: .95rem; }
.garantias { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 22px; margin-top: 22px; color: var(--muted); font-weight: 700; font-size: .95rem; }
.faq { max-width: 740px; margin: 0 auto; display: grid; gap: 10px; } details { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 16px 18px; } summary { cursor: pointer; font-weight: 800; list-style: none; display: flex; justify-content: space-between; gap: 12px; } summary::after { content: '+'; color: var(--brand); font-size: 1.4rem; line-height: 1; } details[open] summary::after { content: '−'; } details p { margin-top: 10px; color: var(--muted); }
.final { text-align: center; background: linear-gradient(135deg, var(--brand), #7a5af0); color: #fff; border-radius: 30px; padding: 44px 22px; } .final p { margin: 12px auto 24px; max-width: 28em; opacity: .92; } .final .btn { background: #fff; color: var(--brand); box-shadow: none; }
footer { padding: 36px 0 110px; text-align: center; color: var(--muted); font-size: .9rem; } footer nav { display: flex; justify-content: center; gap: 18px; margin-bottom: 10px; } footer a { text-decoration: underline; }
.fixo { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: rgb(247 246 253 / 92%); backdrop-filter: blur(10px); border-top: 1px solid var(--line); transform: translateY(110%); transition: transform .25s ease; } .fixo.on { transform: none; } .fixo .btn { width: 100%; }
@media (min-width: 760px) { .hero { grid-template-columns: 1.15fr .85fr; padding-bottom: 80px; } .hero .fone { width: 290px; } .dores { grid-template-columns: repeat(3, 1fr); } .recursos { grid-template-columns: repeat(4, 1fr); } .dois { grid-template-columns: 1fr 1fr; } .planos { grid-template-columns: 1fr 1fr; } .privado { grid-template-columns: 1fr 1fr; padding: 48px; align-items: center; } .carrossel { justify-content: center; overflow: visible; } .fixo { display: none; } footer { padding-bottom: 40px; } }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { transition: none !important; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="topo">
    <a class="logo" href="/comecar"><img src="/icon.svg" alt="">Nosso Lar</a>
    <a class="entrar" href="/" data-cta="entrar">Já tenho conta</a>
  </header>

  <div class="hero">
    <div>
      <span class="selo">Teste grátis por ${testeDias} dias</span>
      <h1>A casa organizada.<br>A família no mesmo lugar.</h1>
      <p class="lead">Agenda, lista de compras, tarefas, cardápio, fotos e recados num único app, para casais e famílias que querem parar de perguntar “quem vai fazer isso?”.</p>
      <a class="btn" href="/#cadastro" data-cta>Começar meu teste grátis</a>
      <p class="nota">Não pede cartão para testar. Funciona no celular e no computador.</p>
    </div>
    <div class="fone"><img src="/lp/inicio.webp" width="780" height="1560" alt="Tela inicial do Nosso Lar com a agenda do dia, a semana e a barra para escrever ou falar"></div>
  </div>
</div>

<section>
  <div class="wrap">
    <div class="sec-t"><h2>O dia a dia da casa, sem bagunça</h2><p>Três perguntas que toda família faz todos os dias. Agora todo mundo vê a resposta.</p></div>
    <div class="dores">
      <div class="dor"><span>🛒</span><b>“O que falta em casa?”</b><p>Uma lista de compras que todos editam ao mesmo tempo. Quem está no mercado vê tudo na hora e vai marcando o que já pegou.</p></div>
      <div class="dor"><span>📅</span><b>“Quem leva e quem busca?”</b><p>Uma agenda da família com os compromissos de cada um, em cores. Consultas, escola, jogos e aniversários num só calendário.</p></div>
      <div class="dor"><span>🍽️</span><b>“O que tem para o jantar?”</b><p>Monte o cardápio da semana, guarde suas receitas e mande os ingredientes direto para a lista de compras.</p></div>
    </div>
  </div>
</section>

<section class="telas">
  <div class="wrap">
    <div class="sec-t"><h2>Veja como é por dentro</h2><p>Telas reais do app, com uma família de exemplo.</p></div>
    <div class="carrossel">
      <figure><div class="fone p"><img src="/lp/agenda.webp" width="780" height="1560" alt="Agenda com os compromissos e tarefas da família" loading="lazy"></div><figcaption>Agenda de todos</figcaption></figure>
      <figure><div class="fone p"><img src="/lp/compras.webp" width="780" height="1560" alt="Lista de compras compartilhada" loading="lazy"></div><figcaption>Compras em tempo real</figcaption></figure>
      <figure><div class="fone p"><img src="/lp/inicio.webp" width="780" height="1560" alt="Tela inicial com o resumo do dia" loading="lazy"></div><figcaption>O dia num relance</figcaption></figure>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-t"><h2>Tudo o que a família precisa</h2><p>Sem juntar dez aplicativos diferentes.</p></div>
    <div class="recursos">
      <div class="rec"><span>✨</span><b>Escreva do seu jeito</b><p>Digite ou fale “dentista amanhã às 15h” e o app cria o compromisso.</p></div>
      <div class="rec"><span>📅</span><b>Agenda</b><p>Compromissos com lembrete, repetição e quem participa.</p></div>
      <div class="rec"><span>🛒</span><b>Listas</b><p>Compras e afazeres, com sugestão do que você costuma repor.</p></div>
      <div class="rec"><span>✅</span><b>Tarefas da casa</b><p>Divida o que é de cada um e acompanhe o que foi feito.</p></div>
      <div class="rec"><span>🍽️</span><b>Cardápio e receitas</b><p>Planeje a semana, importe receitas de sites e vá passo a passo na cozinha.</p></div>
      <div class="rec"><span>💬</span><b>Chat e mural</b><p>Recados, enquetes e conversas da família num lugar só.</p></div>
      <div class="rec"><span>📷</span><b>Fotos</b><p>Álbuns da família, guardados com segurança.</p></div>
      <div class="rec"><span>💸</span><b>Orçamento</b><p>Registre os gastos da casa e veja para onde vai o dinheiro.</p></div>
      <div class="rec"><span>🎁</span><b>Lista de desejos</b><p>Cada um guarda o que gostaria de ganhar. Quem reserva o presente continua em segredo.</p></div>
      <div class="rec"><span>🔔</span><b>Avisos</b><p>Notificações no celular só do que importa para você.</p></div>
      <div class="rec"><span>📡</span><b>Radar da casa</b><p>O app avisa quando algo está pedindo atenção, como tarefa atrasada.</p></div>
      <div class="rec"><span>📱</span><b>Funciona como app</b><p>Abra no navegador e coloque na tela inicial do celular. Não precisa de loja.</p></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap dois">
    <div class="perfil"><h3>💑 Para casais</h3><ul><li>Dividam as tarefas da casa de forma justa</li><li>Uma lista de compras que os dois veem na hora</li><li>Datas importantes e compromissos dos dois no mesmo calendário</li><li>Lista de desejos para acertar no presente</li></ul></div>
    <div class="perfil"><h3>👨‍👩‍👧 Para famílias</h3><ul><li>Agenda com escola, consultas e atividades dos filhos</li><li>Tarefas por pessoa, com combinados claros</li><li>Cardápio e receitas da semana</li><li>Fotos e recados para avós, tios e todo mundo da casa</li></ul></div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="privado">
      <div><h2>Juntos, mas cada um com o seu espaço</h2><p style="margin-top:12px">A família compartilha o que importa e mantém privado o que é pessoal.</p></div>
      <ul>
        <li><b>Entrada protegida:</b> só entra quem tem conta e o código da família. O dono vê e remove quem tem acesso.</li>
        <li><b>Coisas pessoais ficam pessoais:</b> o treino de cada um, por exemplo, só aparece para quem o criou.</li>
        <li><b>Surpresas continuam surpresas:</b> quem ganha o presente não vê quem o reservou.</li>
        <li><b>Seus dados são seus:</b> baixe tudo ou exclua sua conta quando quiser.</li>
      </ul>
    </div>
  </div>
</section>

<section id="planos">
  <div class="wrap">
    <div class="sec-t"><h2>Comece grátis, decida depois</h2><p>Um único plano vale para a família inteira. Pague por Pix, boleto ou cartão.</p></div>
    <div class="planos">
      <div class="plano"><h3>Mensal</h3><div class="preco">${mensal}<small> /mês</small></div><p>Cancele quando quiser.</p></div>
      <div class="plano dest"><span class="etq">Melhor valor</span><h3>Anual</h3><div class="preco">${anual}<small> /ano</small></div><p>Equivale a ${porMes} por mês. Você economiza ${economia} por ano.</p></div>
    </div>
    <div class="garantias"><span>✓ ${testeDias} dias grátis</span><span>✓ Sem cartão para testar</span><span>✓ Cancele quando quiser</span></div>
    <p style="text-align:center;margin-top:26px"><a class="btn" href="/#cadastro" data-cta>Começar meu teste grátis</a></p>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-t"><h2>Perguntas frequentes</h2></div>
    <div class="faq">
      <details><summary>Preciso de cartão de crédito para testar?</summary><p>Não. Você cria a conta e usa por ${testeDias} dias sem informar nenhum dado de pagamento.</p></details>
      <details><summary>O que acontece quando o teste acaba?</summary><p>Se você não assinar, a família passa ${leituraDias} dias só em modo leitura (dá para ver tudo, mas não alterar). Depois o acesso fica bloqueado. Nada é apagado: assim que a assinatura for paga, tudo volta.</p></details>
      <details><summary>Funciona no iPhone e no Android?</summary><p>Sim. O Nosso Lar abre no navegador do celular e do computador. Você pode adicionar à tela inicial para usar como um aplicativo.</p></details>
      <details><summary>Quantas pessoas da família podem usar?</summary><p>Quem você convidar com o código da família. A assinatura vale para a família toda, e cada pessoa entra com a própria conta.</p></details>
      <details><summary>Como funciona o pagamento?</summary><p>A cobrança é feita pelo Asaas, com Pix, boleto ou cartão. O Nosso Lar não guarda dados de cartão.</p></details>
      <details><summary>Como cancelo?</summary><p>Dentro do app, em Configurações → Conta e segurança → Assinatura. O acesso continua até o fim do período pago, sem multa.</p></details>
      <details><summary>Meus dados estão seguros?</summary><p>Cada família só vê os próprios dados, e as contas são protegidas por senha ou login do Google. Você pode baixar seus dados ou excluir a conta quando quiser. Leia a <a href="/privacidade">Política de Privacidade</a>.</p></details>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="final">
      <h2>Comece hoje. Leva poucos minutos.</h2>
      <p>Crie a conta, convide a família e veja a casa se organizar. São ${testeDias} dias grátis.</p>
      <a class="btn" href="/#cadastro" data-cta>Começar meu teste grátis</a>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <nav><a href="/termos">Termos de Uso</a><a href="/privacidade">Política de Privacidade</a></nav>
    <p>© ${new Date().getFullYear()} Nosso Lar${rodape ? ' · ' + rodape : ''}</p>
  </div>
</footer>

<div class="fixo" id="fixo"><a class="btn" href="/#cadastro" data-cta>Começar teste grátis de ${testeDias} dias</a></div>

<script>
// Mantém os parâmetros do anúncio (utm_source, fbclid…) ao ir para o cadastro.
(function () {
  var q = location.search || ''
  document.querySelectorAll('a[data-cta]').forEach(function (a) {
    var entrar = a.getAttribute('data-cta') === 'entrar'
    a.href = '/' + q + (entrar ? '' : '#cadastro')
  })
  var fixo = document.getElementById('fixo'), hero = document.querySelector('.hero .btn')
  if (fixo && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { fixo.classList.toggle('on', !e[0].isIntersecting) }).observe(hero)
  }
})()
</script>
</body>
</html>`
}
