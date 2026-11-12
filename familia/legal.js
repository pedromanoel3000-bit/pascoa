// Página de Política de Privacidade (exigida pelo Google para o login e pela lei de proteção de dados).
// O e-mail de contato vem da variável CONTACT_EMAIL do servidor, para não ficar escrito no código.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])


// Esqueleto comum das páginas legais.
function pagina(titulo, corpo, extraHead = '') {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)} · Nosso Lar</title>
<style>
:root { color-scheme: light dark; --bg: #f5f4fb; --card: #fff; --text: #1c1b29; --muted: #6e6c80; --brand: #5b4bdb; }
@media (prefers-color-scheme: dark) { :root { --bg: #121118; --card: #1d1c26; --text: #edecf5; --muted: #9c9ab0; --brand: #9d93ff; } }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 24px 18px 56px; }
.card { background: var(--card); border-radius: 16px; padding: 22px 20px; }
h1 { margin: 0 0 4px; font-size: 1.6rem; } h2 { font-size: 1.1rem; margin: 26px 0 6px; }
p, li { margin: 6px 0; } ul { padding-left: 20px; } a { color: var(--brand); } .muted { color: var(--muted); font-size: .9rem; }
.topo { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; font-weight: 700; } .topo a { text-decoration: none; color: inherit; }
.aviso-revisao { background: #fff3cd; color: #5c4400; border-radius: 12px; padding: 12px 14px; margin: 0 0 16px; font-size: .92rem; } @media (prefers-color-scheme: dark) { .aviso-revisao { background: #3d3300; color: #ffe08a; } } .links { margin-top: 24px; font-size: .9rem; }</style>
${extraHead}</head>
<body>
<main>
<div class="topo"><a href="/">🏠 Nosso Lar</a></div>
<div class="card">
${corpo}
</div>
</main>
</body>
</html>`
}

export function privacidadeHtml({ contato = '', atualizada = '12/11/2026' } = {}) {
  const mail = contato ? `<a href="mailto:${esc(contato)}">${esc(contato)}</a>` : '<em>(e-mail de contato ainda não configurado neste servidor)</em>'
  return pagina('Política de Privacidade', `<h1>Política de Privacidade</h1>
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
<p>Enquanto sua conta e sua família existirem. Você mesmo pode excluir a sua conta no aplicativo (Configurações → Conta e segurança → Excluir minha conta): a conta é apagada na hora e você escolhe se o que cadastrou na família também sai. Quem é a única dona de uma família pode apagá-la inteira. Pedidos feitos por e-mail também são atendidos, exceto o que formos obrigados a manter por lei.</p>

<h2>6. Seus direitos</h2>
<p>Você pode, a qualquer momento: confirmar que tratamos seus dados, acessá-los, corrigi-los, pedir a exclusão, pedir a portabilidade, saber com quem compartilhamos e revogar consentimentos. Dentro do app, Configurações → Conta e segurança → Baixar meus dados gera um arquivo com os dados ligados a você, e Configurações → Baixar backup gera um arquivo com os dados da família inteira. Para exercer qualquer direito, escreva para ${mail}.</p>

<h2>7. Segurança</h2>
<p>Usamos conexão criptografada (HTTPS), senhas protegidas por algoritmo próprio para isso, limite de tentativas de acesso e separação dos dados de cada família. Nenhum sistema é totalmente imune a falhas; em caso de incidente relevante, avisaremos os afetados.</p>

<h2>8. Mudanças nesta política</h2>
<p>Podemos atualizar esta página. A data no topo mostra a última revisão.</p>
<p class="links"><a href="/termos">Ver os Termos de Uso</a></p>`)
}

/**
 * Termos de Uso. É um texto-base escrito a partir do que o app faz hoje: precisa de revisão jurídica antes de valer.
 * Dados de quem opera vêm do servidor (CONTACT_EMAIL, COMPANY_NAME, COMPANY_CNPJ), não ficam no código.
 * A faixa amarela de "versão para revisão" some quando TERMOS_REVISADOS=1.
 */
export function termosHtml({ contato = '', empresa = '', cnpj = '', atualizada = '12/11/2026', revisado = false, precos = { mensal: 9.9, anual: 99 }, testeDias = 30, leituraDias = 3 } = {}) {
  const mail = contato ? `<a href="mailto:${esc(contato)}">${esc(contato)}</a>` : '<em>(e-mail de contato ainda não configurado neste servidor)</em>'
  const reais = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const operador = empresa ? `${esc(empresa)}${cnpj ? `, inscrita no CNPJ sob o nº ${esc(cnpj)}` : ''}` : '<em>(razão social ainda não configurada neste servidor)</em>'
  const aviso = revisado ? '' : '<p class="aviso-revisao"><b>Versão para revisão.</b> Este texto ainda não foi revisado por um advogado e não deve ser tratado como definitivo.</p>'
  return pagina(
    'Termos de Uso',
    `${aviso}<h1>Termos de Uso</h1>
<p class="muted">Atualizados em ${esc(atualizada)}</p>
<p>Estes termos regulam o uso do <b>Nosso Lar</b>, aplicativo de organização familiar (agenda, tarefas, listas, chat, fotos, refeições, orçamento, treino e outras funções), oferecido por ${operador} (“nós”). Ao criar uma conta ou usar o aplicativo, você concorda com eles e com a <a href="/privacidade">Política de Privacidade</a>.</p>

<h2>1. Quem pode usar</h2>
<p>O uso é destinado a maiores de 18 anos. Crianças e adolescentes só aparecem no aplicativo como membros cadastrados por seus responsáveis legais, que respondem por esses dados.</p>

<h2>2. Conta e família</h2>
<ul>
<li>Para usar o aplicativo é preciso ter uma conta (e-mail e senha, ou Google). Você é responsável por manter a senha em segredo e pelo que for feito com a sua conta.</li>
<li>Cada pessoa deve ter a sua conta. As famílias são grupos de contas: quem cria a família é o <b>dono</b> e pode convidar pessoas pelo código, fechar os convites, passar a propriedade e remover contas.</li>
<li>Quem entra numa família passa a ver o que a família compartilha (agenda, tarefas, listas, mural, fotos, orçamento, contatos e demais áreas comuns). Algumas informações são pessoais e só chegam a quem pertencem, como o treino e as notificações de cada pessoa e as conversas privadas.</li>
<li>Você pode excluir a sua conta a qualquer momento, em Configurações → Conta e segurança.</li>
</ul>

<h2>3. Teste grátis e assinatura</h2>
<ul>
<li>Cada conta tem <b>${testeDias} dias de teste grátis</b>, com todas as funções liberadas. O teste é por conta: criar outra família na mesma conta não renova o prazo.</li>
<li>Depois do teste, o uso continua mediante assinatura: <b>${reais(precos.mensal)} por mês</b> ou <b>${reais(precos.anual)} por ano</b>. Os valores podem mudar; uma mudança só vale para períodos ainda não contratados e será avisada com antecedência.</li>
<li>Os pagamentos são processados pelo <b>Asaas</b>. A cobrança de cada período é emitida e enviada por e-mail, e você paga por Pix, boleto ou cartão. <b>Não guardamos dados de cartão.</b> Para emitir a cobrança, pedimos o CPF ou CNPJ de quem paga.</li>
<li>Quem assina durante o teste não paga nada até o fim dele: a primeira cobrança vence no último dia do teste e o período pago começa depois dele, sem perda de dias.</li>
</ul>

<h2>4. Se a assinatura vencer</h2>
<p>Quando o período pago (ou o teste) termina sem renovação, a família fica <b>${leituraDias} dias em modo de leitura</b>: todos continuam vendo tudo, mas não é possível alterar. Passados esses dias, o acesso é <b>bloqueado</b> até a assinatura ser paga. Enquanto isso, não apagamos os dados por causa da falta de pagamento, e é possível baixar os seus dados em Conta e segurança. O que alguém editar no aparelho durante a leitura é enviado depois da renovação.</p>

<h2>5. Cancelamento e reembolso</h2>
<ul>
<li>Você pode cancelar a renovação quando quiser, em Configurações → Conta e segurança → Assinatura. O acesso continua até o fim do período já pago. Não há multa.</li>
<li><b>Arrependimento:</b> em até 7 dias corridos depois da primeira cobrança paga, você pode pedir o reembolso integral escrevendo para ${mail}, conforme o art. 49 do Código de Defesa do Consumidor.</li>
<li>Fora esse prazo, não há reembolso proporcional do período em curso, salvo falha do nosso serviço ou obrigação legal.</li>
</ul>

<h2>6. O que é seu e o que não pode</h2>
<ul>
<li>O conteúdo que você cadastra (textos, fotos, mensagens, arquivos) continua sendo seu. Você nos autoriza apenas a guardá-lo, processá-lo e exibi-lo para a sua família, na medida necessária para o aplicativo funcionar.</li>
<li>Você é responsável pelo que cadastra e por ter o direito de compartilhar o que pertence a outras pessoas, inclusive fotos e a localização de familiares.</li>
<li>Não é permitido usar o aplicativo para fins ilícitos, para violar direitos de terceiros, para enviar vírus ou conteúdo ofensivo, para tentar acessar dados de outras famílias ou contas, nem para sobrecarregar o serviço de forma abusiva.</li>
</ul>

<h2>7. Disponibilidade e seus dados</h2>
<ul>
<li>Trabalhamos para manter o aplicativo no ar, mas não garantimos funcionamento ininterrupto: pode haver manutenções, falhas e mudanças.</li>
<li>Recomendamos baixar cópias periódicas. O arquivo de backup (Configurações → Baixar backup) guarda os dados da família e os nomes das fotos, <b>mas não os arquivos das fotos</b>.</li>
</ul>

<h2>8. Saúde, alimentação e treino</h2>
<p>As funções de treino, refeições e receitas servem para organização pessoal e não substituem orientação de médico, nutricionista ou educador físico. Use por sua conta e risco e consulte um profissional antes de iniciar ou mudar uma rotina de exercícios ou de alimentação.</p>

<h2>9. Limitação de responsabilidade</h2>
<p>No limite permitido pela lei, não respondemos por danos indiretos, lucros cessantes ou perda de dados causados por fatos fora do nosso controle, como falhas de provedores de internet ou de hospedagem. Isso não afasta direitos que a lei garante ao consumidor.</p>

<h2>10. Encerramento pelo serviço</h2>
<p>Podemos suspender ou encerrar contas que violem estes termos ou a lei, avisando sempre que possível. Em caso de encerramento do serviço, avisaremos com antecedência razoável e daremos a oportunidade de baixar os dados.</p>

<h2>11. Mudanças nestes termos</h2>
<p>Podemos atualizar estes termos. Mudanças relevantes serão avisadas no aplicativo ou por e-mail. Continuar usando depois do aviso significa que você concorda com a nova versão.</p>

<h2>12. Lei aplicável e contato</h2>
<p>Estes termos seguem as leis do Brasil. Fica eleito o foro do domicílio do consumidor para resolver qualquer disputa. Dúvidas, pedidos de reembolso e solicitações sobre dados: ${mail}.</p>
<p class="links"><a href="/privacidade">Ver a Política de Privacidade</a></p>`
  )
}
