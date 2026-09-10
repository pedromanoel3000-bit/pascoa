# Bancada Feynman PCPR

Ferramenta de memorização ativa para o concurso da Polícia Civil do Paraná
(Investigador e Escrivão). Você escolhe o tópico, explica em voz alta como se
estivesse ensinando alguém, e registra onde a explicação travou.

## Como funciona

1. **Escolha o tópico** na lista — o conteúdo programático já vem carregado,
   agrupado por matéria, com a referência legal de cada assunto.
2. **Explique em voz alta**, seguindo as quatro estações do roteiro:
   *Defina* → *Fundamento* → *Mecânica* → *Fronteira*. A ordem importa:
   é a sequência que separa quem entendeu de quem decorou.
3. **O aluno pergunta.** Um banco fixo de perguntas socráticas cobra exemplo
   concreto, prazo, quem decide e a diferença para o instituto vizinho.
   Com a capacidade `sample` disponível, o botão "Perguntas sob medida" gera
   perguntas específicas do tópico aberto.
4. **Registre o resultado**: anote onde travou e classifique a explicação em
   *Travei*, *Com esforço* ou *Dominei*. Da próxima vez que abrir o tópico,
   a anotação anterior aparece antes de você começar.

## Arquivo

`bancada-feynman.html` é o fonte de um Artifact do Claude — o arquivo é o
conteúdo do `<body>`, sem `<!doctype>`, `<html>`, `<head>` ou `<body>`, porque
esse esqueleto é adicionado na publicação. Para republicar mantendo a mesma
URL, publique este mesmo caminho de arquivo.

Capacidades declaradas:

- `db` — o progresso e os tópicos próprios ficam salvos em
  `estudo/progresso` e acompanham você entre aparelhos.
- `sample` — as perguntas sob medida do aluno.

Sem nenhuma das duas a página continua funcionando: o progresso cai para o
`localStorage` do navegador e o aluno usa o banco fixo de perguntas.

## Conteúdo

A lista-base cobre 167 tópicos em 12 matérias, montada a partir do conteúdo
programático típico de Investigador e Escrivão da PCPR. Confira o seu edital —
dá para acrescentar tópicos pela própria página, e eles ficam salvos junto
com o resto.
