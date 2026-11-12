// Página de Política de Privacidade (exigida pelo Google para o login e pela lei de proteção de dados).
// O e-mail de contato vem da variável CONTACT_EMAIL do servidor, para não ficar escrito no código.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export function privacidadeHtml({ contato = '', atualizada = '12/11/2026' } = {}) {
  const mail = contato ? `<a href="mailto:${esc(contato)}">${esc(contato)}</a>` : '<em>(e-mail de contato ainda não configurado neste servidor)</em>'
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Política de Privacidade · Nosso Lar</title>
<style>
:root { color-scheme: light dark; --bg: #f5f4fb; --card: #fff; --text: #1c1b29; --muted: #6e6c80; --brand: #5b4bdb; }
@media (prefers-color-scheme: dark) { :root { --bg: #121118; --card: #1d1c26; --text: #edecf5; --muted: #9c9ab0; --brand: #9d93ff; } }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 24px 18px 56px; }
.card { background: var(--card); border-radius: 16px; padding: 22px 20px; }
h1 { margin: 0 0 4px; font-size: 1.6rem; } h2 { font-size: 1.1rem; margin: 26px 0 6px; }
p, li { margin: 6px 0; } ul { padding-left: 20px; } a { color: var(--brand); } .muted { color: var(--muted); font-size: .9rem; }
.topo { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; font-weight: 700; } .topo a { text-decoration: none; color: inherit; }
</style>
</head>
<body>
<main>
<div class="topo"><a href="/">🏠 Nosso Lar</a></div>
<div class="card">
<h1>Política de Privacidade</h1>
<p class="muted">Atualizada em ${esc(atualizada)}</p>
<p>O <b>Nosso Lar</b> é um aplicativo de organização familiar (agenda, tarefas, listas, chat, fotos, refeições, orçamento e treino). Esta página explica quais dados ele guarda, para quê, com quem são compartilhados e como você controla tudo isso, de acordo com a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).</p>

<h2>1. Quem é o responsável</h2>
<p>O responsável pelo serviço é o operador do Nosso Lar. Para qualquer assunto sobre seus dados, escreva para ${mail}.</p>

<h2>2. Quais dados guardamos</h2>
<ul>
<li><b>Conta:</b> seu e-mail e nome. Se você entra com e-mail e senha, a senha é guardada apenas de forma irreversível (nem nós conseguimos lê-la). Se entra com o Google, recebemos somente o seu <b>e-mail, nome</b> e um identificador da conta Google. Não acessamos seus e-mails, contatos, arquivos nem qualquer outro dado do Google.</li>
<li><b>Dados da família</b> que você mesmo cadastra: eventos, tarefas, listas, mensagens, fotos, contatos, notas, receitas, refeições, gastos, desejos e presentes, e registros de treino.</li>
<li><b>Assinatura e pagamento:</b> o CPF ou CNPJ informado por quem assina, usado apenas para emitir a cobrança, e o histórico de pagamentos da família. Os dados de cartão, Pix e boleto ficam com o Asaas (instituição de pagamento) e <b>nunca passam pelo Nosso Lar</b>.</li>
<li><b>Localização:</b> somente se você ativar o compartilhamento na tela Localização. Ela fica visível aos membros da sua família e pode ser desligada a qualquer momento.</li>
<li><b>Dados técnicos:</b> o nome do navegador (para identificar suas sessões de acesso), o cadastro do aparelho para receber notificações, e o endereço de rede (IP), usado apenas na hora para limitar tentativas de acesso abusivas.</li>
</ul>

<h2>2.1 Menores de idade</h2>
<p>O app permite que responsáveis cadastrem filhos e outros familiares. Os dados de menores são inseridos e controlados pelos responsáveis legais da família.</p>

<h2>3. Para que usamos</h2>
<ul>
<li>Fazer o aplicativo funcionar e manter os dados sincronizados entre os aparelhos da família.</li>
<li>Autenticar você, proteger a família e evitar acessos indevidos.</li>
<li>Enviar as notificações e lembretes que você ativar e, se configurado, e-mails de confirmação de conta e recuperação de senha.</li>
</ul>
<p><b>Não vendemos seus dados, não mostramos anúncios e não usamos seus dados para publicidade.</b></p>

<h2>4. Quem vê seus dados</h2>
<ul>
<li><b>Sua família:</b> os membros da sua família veem os dados cadastrados nela. Famílias protegidas só abrem para contas autorizadas pelo dono.</li>
<li><b>Serviços que fazem o app funcionar:</b> hospedagem do servidor (Render), banco de dados (Supabase), pagamentos (Asaas), login (Google, se você escolher esse caminho), envio de e-mails (Resend, quando ativado), previsão do tempo (Open-Meteo, que recebe apenas uma posição aproximada, de cerca de 10 km, e só se a localização estiver compartilhada) e os serviços de notificação do seu navegador ou celular (Apple, Google, Mozilla).</li>
<li>Ao importar uma receita por link, o servidor acessa o endereço que você informou para ler a receita.</li>
</ul>
<p>Não compartilhamos seus dados com terceiros para outros fins, salvo obrigação legal.</p>

<h2>5. Por quanto tempo guardamos</h2>
<p>Enquanto sua conta e sua família existirem. Você mesmo pode excluir a sua conta no aplicativo (Família → Conta e segurança → Excluir minha conta): a conta é apagada na hora e você escolhe se o que cadastrou na família também sai. Quem é a única dona de uma família pode apagá-la inteira. Pedidos feitos por e-mail também são atendidos, exceto o que formos obrigados a manter por lei.</p>

<h2>6. Seus direitos</h2>
<p>Você pode, a qualquer momento: confirmar que tratamos seus dados, acessá-los, corrigi-los, pedir a exclusão, pedir a portabilidade, saber com quem compartilhamos e revogar consentimentos. Dentro do app, Família → Conta e segurança → Baixar meus dados gera um arquivo com os dados ligados a você, e Família → Baixar backup gera um arquivo com os dados da família inteira. Para exercer qualquer direito, escreva para ${mail}.</p>

<h2>7. Segurança</h2>
<p>Usamos conexão criptografada (HTTPS), senhas protegidas por algoritmo próprio para isso, limite de tentativas de acesso e separação dos dados de cada família. Nenhum sistema é totalmente imune a falhas; em caso de incidente relevante, avisaremos os afetados.</p>

<h2>8. Mudanças nesta política</h2>
<p>Podemos atualizar esta página. A data no topo mostra a última revisão.</p>
</div>
</main>
</body>
</html>`
}
