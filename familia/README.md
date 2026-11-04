# Nosso Lar — organizador da família

App para a família inteira organizar a rotina, inspirado nas funções do FamilyWall.
Funciona no navegador do celular e do computador, e pode ser instalado na tela inicial como um app.

## O que tem

| Tela | O que faz |
|---|---|
| **Mural** | Resumo do dia, contagens regressivas (eventos marcados e aniversários dos próximos 30 dias), recados, fotos e votações rápidas |
| **Agenda** | Calendário compartilhado com cor por pessoa, repetição (inclusive personalizada: a cada N dias/semanas/meses/anos, dias da semana, “3ª quarta do mês”, até uma data ou N vezes), filtro por membro e aniversários automáticos |
| **Listas** | Compras, afazeres, viagem… Itens marcados por quem fez; sugestões dos itens mais comprados enquanto digita |
| **Tarefas** | Responsável, prazo, repetição (com as mesmas opções personalizadas da agenda), escala (revezamento entre pessoas) e placar de pontos da semana |
| **Chat** | Grupo da família e conversas privadas, com fotos e aviso de mensagens não lidas |
| **Refeições** | Cardápio da semana (café, almoço, jantar), receitas da família e envio dos ingredientes para a lista de compras |
| **Fotos** | Álbuns compartilhados |
| **Desejos** | Lista de desejos de cada pessoa; os outros marcam “vou dar este” sem o dono ver |
| **Treino** | Programa de 8 semanas por pessoa (fila A → B → C → D), séries com carga, repetições e “sobraram quantas”, cronômetro de descanso, meta da próxima vez (dupla progressão), registro em texto para copiar e importar, histórico e plano |
| **Contatos** | Médico, escola, serviços… com botão de ligar e de WhatsApp |
| **Orçamento** | Gastos e entradas por mês, por categoria e por pessoa |
| **Localização** | Cada um escolhe compartilhar onde está; mapa, rota e check-in |
| **Notas** | Senha do Wi-Fi, documentos e anexos |
| **Família** | Convite por código, membros (cor, avatar, aniversário), cor do app, notificações, backup e restauração |
| **Notificações** | Histórico no sino do topo (últimos 150 por pessoa, agrupado por dia) e avisos no celular: mensagens, tarefas atribuídas, eventos novos, itens nas listas, recados, votações e lembretes |

Os dados ficam salvos no aparelho (funciona sem internet) e sincronizam com o servidor a cada poucos segundos.
Quem tiver o **código da família** entra nela, então trate o código como uma senha.

## Rodar no seu computador

Precisa do Node.js 18 ou mais novo.

```bash
cd familia
npm install
npm run serve
```

Abra http://localhost:3001. Para usar no celular na mesma rede Wi-Fi, abra `http://IP-DO-COMPUTADOR:3001`.

Para mexer no código com recarga automática, rode `npm start` num terminal e `npm run dev` em outro (abre em http://localhost:5173).

## Colocar na internet de graça (Render + Supabase)

O **Render** deixa o app no ar e o **Supabase** guarda os dados. Os dois têm plano grátis.

### 1. Supabase (banco de dados)

1. Crie uma conta em https://supabase.com e clique em **New project** (escolha a região São Paulo e anote a senha).
2. No menu da esquerda, abra **SQL Editor**, cole todo o conteúdo do arquivo `supabase.sql` e clique em **Run**.
3. Copie duas informações, que vão para o Render:
   - **Project URL** (fica em *Project Settings → Data API* ou no botão *Connect*), algo como `https://abcd1234.supabase.co`
   - a **chave secreta** (em *Project Settings → API Keys*: a *secret key* `sb_secret_…`, ou a `service_role` na aba de chaves antigas)

A chave secreta dá acesso total ao banco: coloque-a só no Render, nunca no código.

### 2. Render (o app no ar)

1. Em https://render.com clique em **New → Web Service** e escolha o repositório `pascoa`.
2. Preencha:
   - **Branch:** a branch onde está o app
   - **Root Directory:** `familia`
   - **Build Command:** `npm install --include=dev && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
3. Em **Environment Variables**, adicione:
   - `SUPABASE_URL` = o Project URL
   - `SUPABASE_KEY` = a chave secreta (também aceita o nome `SUPABASE_SERVICE_ROLE_KEY`)
4. Clique em **Deploy**. Quando terminar, o endereço `https://….onrender.com` é o app.
5. Confira abrindo `https://….onrender.com/api/health`: deve aparecer `"storage":"supabase"` e `"db":"ok"`. Se aparecer `"missing"`, falta a variável indicada; a tela **Família** do app mostra o mesmo aviso.

No plano grátis o Render "dorme" depois de 15 minutos sem uso; a primeira abertura depois disso demora cerca de um minuto. Os dados não se perdem, porque ficam no Supabase.

Sem `SUPABASE_URL` e `SUPABASE_KEY`, o servidor guarda os dados na pasta `data/` (ou em `DATA_DIR`).

## Notificações

- Cada pessoa ativa em **Família → Notificações neste aparelho** (ou no aviso da página inicial) e escolhe o que quer receber.
- **Android:** funciona no Chrome. **iPhone:** só com o app adicionado à tela de início (Safari → Compartilhar → Adicionar à Tela de Início), iOS 16.4 ou mais novo.
- Quem está com o app aberto na tela não recebe aviso repetido no celular, mas o aviso fica no histórico (sino 🔔 no topo).
- O histórico funciona mesmo para quem não ativou as notificações no celular. Mensagens seguidas da mesma conversa viram um item só.
- As chaves das notificações são criadas sozinhas e guardadas no Supabase (ou em `data/`). Se preferir, defina `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`.
- Se a inscrição de um aparelho se perder, o app refaz sozinho quando o navegador deixa. No iPhone, às vezes é preciso um toque em **Reativar**, e o aviso explica isso.
- Se o app pedir para reativar com frequência, abra **Família**: um aviso no topo diz se o servidor está sem banco de dados (ele esquece as chaves a cada reinício).

### Lembretes no plano grátis do Render

O Render grátis "dorme" depois de 15 minutos sem uso, e dormindo ele não envia lembretes de horário.
Para mantê-lo acordado de graça:

1. Crie uma conta em https://cron-job.org.
2. Clique em **Create cronjob**, cole o endereço do app com `/api/health` no final (ex.: `https://seu-app.onrender.com/api/health`) e escolha **a cada 10 minutos**.
3. Salve. Os 750 horas grátis do Render por mês cobrem o mês inteiro ligado.

Avisos de mensagens, tarefas e listas funcionam mesmo sem isso, porque acontecem enquanto alguém está usando o app.

## Como os dados são guardados

- No Supabase, cada registro é uma linha da tabela `items`; sem Supabase, cada família é um arquivo JSON em `data/`. Em ambos, a família é identificada por um hash do código, nunca pelo código em si.
- Se o servidor perder os dados, o primeiro aparelho que abrir o app reenvia tudo o que tem salvo.
- Cada registro tem `id`, `type` e `updatedAt`. Em caso de conflito, vale a alteração mais recente.
- Fotos são reduzidas antes de salvar (até 1280 px).
- Em **Família → Baixar backup** você salva tudo num arquivo `.json`.
