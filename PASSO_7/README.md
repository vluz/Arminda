# Passo 7: afinar os jogos e o ecrã

No fim deste passo escolheu que jogos aparecem, em que nível começam, e confirmou que tudo tem o tamanho certo no ecrã do seu tablet. Se o tablet é de 7 a 11 polegadas e a pessoa é parecida com a nossa, pode saltar este passo: os valores do kit servem.

Tudo o que se muda aqui está no início de um ficheiro, com um comentário a dizer o que é. Depois de mudar, veja no browser (passo 3) e construa a app (passo 8).

## Que jogos aparecem

Ficheiro: `app/www/js/jogos/registo.js`. Uma linha por atividade, pela ordem do ecrã inicial. Em cada linha:

- `inicio`: o nível em que a pessoa começa. Os níveis sobem sozinhos quando as rondas são fáceis e descem quando são difíceis; a pessoa nunca vê um número. Com mãos pouco firmes ou vista cansada, deixe como está: 1 na maior parte, 2 ou 3 nos jogos de palavras e cartas. Para alguém mais desperto, suba os jogos de pensar (Sopa de letras, Palavras, Sudoku, Puzzle) para 3 ou 4.
- `oculto: true`: o jogo existe, mas não aparece no ecrã inicial nem na introdução. Apague a palavra para o mostrar, ou acrescente-a para esconder um jogo que não serve. Os quatro escondidos no kit são Sudoku, Estendal, Pôr a mesa e Quem é quem (este, mesmo sem `oculto`, só aparece quando há pelo menos quatro fotografias com nomes falsos, passo 6).

Para ver um jogo escondido no browser: `http://127.0.0.1:8765/#jogo=sudoku`.

## Tamanhos no ecrã

A app desenha-se em percentagem do ecrã, por isso adapta-se a tablets maiores e mais nítidos sem mudar nada. O que se pode afinar:

| O quê | Ficheiro e constante | Valor no kit |
| --- | --- | --- |
| Tamanho mínimo de tudo o que se toca | `app/www/js/ui.js`, `ALVO_MIN` | 113 (pixéis CSS, cerca de 1,8 cm em qualquer tablet). Os jogos preferem pôr menos peças no ecrã a fazê-las mais pequenas. Suba para 130 para dedos muito trémulos. |
| Quantos jogos por página no ecrã inicial | `app/www/js/main.js`, `POR_PAGINA` | 12 (três filas de quatro). Num tablet pequeno, 8 dá botões maiores. |
| Tamanho das letras e as cores | `app/www/css/app.css`, bloco `:root` | `--t-grande` e `--t-medio` são os dois tamanhos de letra; as cores têm nomes. |
| Minutos sem toque até o ecrã se apagar | `app/android/app/src/main/java/pt/mae/jogos/MainActivity.java`, `QUIETO_PADRAO` | 10 minutos. `APAGAR_NO_CARREGADOR` = `true` apaga também no carregador (poupa bateria; a pessoa acende com o botão); `false` só escurece quando está a carregar, para quem não encontra o botão. |
| Minutos sem toque dentro de um jogo até voltar ao início | `app/www/js/main.js`, `OCIOSO_MS` | 15 minutos. |
| Segundos a segurar no gato para abrir o ecrã da família | `app/www/js/main.js`, `SEGURAR_GATO_MS` | 15000 (15 segundos, em milissegundos). Comprido de propósito, para a pessoa não o abrir sem querer. |
| Quando a bateria avisa | `app/www/js/bateria.js`, `BAIXA` e `MUITO_BAIXA` | 20 % e 10 %. |
| A introdução (os ecrãs da primeira vez) | `app/www/data/intro.json` | Cada ecrã tem a frase (uma chave de `falas.json`) e a imagem. Um ecrã com `versao` mais alta passa uma vez sozinho depois de uma atualização. |

Os tamanhos mínimos de peças dentro de cada jogo (cartas, letras, peças de puzzle) estão no início do ficheiro de cada jogo em `app/www/js/jogos/`, e a regra geral em `app/GUIA-JOGOS.md`.

## Ver no tamanho do tablet

No browser do computador, ferramentas de programador (F12), modo de dispositivo, e escreva a resolução do seu tablet (está na ficha técnica: 1024 por 600 num tablet de 7 polegadas barato, 1280 por 800 num de 8 ou 10, 2000 por 1200 num de 11). Abra os jogos que a pessoa vai usar e veja se os botões são confortáveis.

Para quem gosta de automatizar: `app/tools/testes/` tem um teste por jogo, que joga uma ronda inteira em três tamanhos de ecrã e avisa de botões pequenos, e `app/tools/testar_tudo.ps1` corre todos (precisa do Playwright: na pasta `app/tools/testes`, `npm install` e depois `npx playwright install chromium`). São os testes que usamos; demoram horas.

## Como saber que ficou bem

No browser, no tamanho do seu tablet, os jogos que escolheu aparecem no ecrã inicial, os escondidos não, e nada fica cortado nem pequeno demais.
