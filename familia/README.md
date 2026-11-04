# Nosso Lar — organizador da família

App para a família inteira organizar a rotina, inspirado nas funções do FamilyWall.
Funciona no navegador do celular e do computador, e pode ser instalado na tela inicial como um app.

## O que tem

| Tela | O que faz |
|---|---|
| **Mural** | Resumo do dia (agenda, minhas tarefas, listas, cardápio) e recados/fotos com curtidas e comentários |
| **Agenda** | Calendário compartilhado com cor por pessoa, eventos que se repetem, filtro por membro e aniversários automáticos |
| **Listas** | Compras, afazeres, viagem… Itens marcados por quem fez; vários itens de uma vez separados por vírgula |
| **Tarefas** | Responsável, prazo, repetição e placar de pontos da semana |
| **Chat** | Grupo da família e conversas privadas, com fotos e aviso de mensagens não lidas |
| **Refeições** | Cardápio da semana (café, almoço, jantar), receitas da família e envio dos ingredientes para a lista de compras |
| **Fotos** | Álbuns compartilhados |
| **Contatos** | Médico, escola, serviços… com botão de ligar e de WhatsApp |
| **Orçamento** | Gastos e entradas por mês, por categoria e por pessoa |
| **Localização** | Cada um escolhe compartilhar onde está; mapa, rota e check-in |
| **Notas** | Senha do Wi-Fi, documentos e anexos |
| **Família** | Convite por código, membros (cor, avatar, aniversário), cor do app, notificações, backup e restauração |
| **Notificações** | Mensagens, tarefas atribuídas, eventos novos, itens nas listas, recados e lembretes (eventos, aniversários às 8h, tarefas do dia às 9h) |

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
   - `SUPABASE_KEY` = a chave secreta
4. Clique em **Deploy**. Quando terminar, o endereço `https://….onrender.com` é o app.

No plano grátis o Render "dorme" depois de 15 minutos sem uso; a primeira abertura depois disso demora cerca de um minuto. Os dados não se perdem, porque ficam no Supabase.

Sem `SUPABASE_URL` e `SUPABASE_KEY`, o servidor guarda os dados na pasta `data/` (ou em `DATA_DIR`).

## Notificações

- Cada pessoa ativa em **Família → Notificações neste aparelho** (ou no aviso da página inicial) e escolhe o que quer receber.
- **Android:** funciona no Chrome. **iPhone:** só com o app adicionado à tela de início (Safari → Compartilhar → Adicionar à Tela de Início), iOS 16.4 ou mais novo.
- Quem está com o app aberto na tela não recebe aviso repetido.
- As chaves das notificações são criadas sozinhas e guardadas no Supabase (ou em `data/`). Se preferir, defina `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`.

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
