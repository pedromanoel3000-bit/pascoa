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
| **Família** | Convite por código, membros (cor, avatar, aniversário), backup e restauração |

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

## Colocar na internet (para a família usar de qualquer lugar)

O servidor é um único arquivo (`server.js`) sem dependências. Em qualquer serviço que rode Node
(Render, Railway, Fly.io, uma VPS…):

- **Comando de build:** `npm install && npm run build`
- **Comando de início:** `npm start`
- **Variáveis:** `PORT` (normalmente o serviço define sozinho) e `DATA_DIR` (pasta onde salvar os dados; use um disco persistente)

Use HTTPS (esses serviços já dão), senão a localização e a instalação na tela inicial não funcionam no celular.

## Como os dados são guardados

- Cada família é um arquivo JSON em `data/` (o nome do arquivo é um hash do código).
- Cada registro tem `id`, `type` e `updatedAt`. Em caso de conflito, vale a alteração mais recente.
- Fotos são reduzidas antes de salvar (até 1280 px).
- Em **Família → Baixar backup** você salva tudo num arquivo `.json`.
