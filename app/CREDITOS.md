# Créditos e licenças

O nosso código, os desenhos e os textos desta pasta são dedicados ao domínio público com a licença [CC0 1.0](LICENSE). Os ficheiros de terceiros mantêm as suas licenças, listadas abaixo. Todos os ficheiros foram conferidos com a pasta a 19 de outubro de 2026. O pormenor por jogo (uma linha por ficheiro, com o endereço de origem) está em `tools/creditos/*.txt`; as primeiras 31 imagens, 15 sons e o tipo de letra estão listados em `tools/preparar_recursos.py`.

## Imagens

| Ficheiros | Origem | Licença |
| --- | --- | --- |
| `www/img/noto/*.svg` (225 ficheiros) | [Noto Emoji](https://github.com/googlefonts/noto-emoji), Google, pasta `2D/svg`. `gato_pisca.svg` é o `gato_sorri.svg` com os olhos redesenhados fechados. | Apache 2.0 para os ficheiros de imagem, segundo o README do repositório ("Tools and most image resources are under the Apache license, version 2.0"). O ficheiro `LICENSE` na raiz do repositório é a SIL Open Font License 1.1 (conferido a 19 de outubro de 2026), por isso os dois textos vêm aqui: `www/img/noto/LICENSE-Apache-2.0.txt` e `www/img/noto/LICENSE-OFL.txt`. O repositório não tem ficheiro NOTICE. |
| `www/img/jogos/casa.svg`, `fotos.svg`, `passeios.svg` | Cópias de `casa`, `coracao` e `sol` do Noto Emoji (botões das atividades de recordações no ecrã inicial) | Apache 2.0, como acima |
| `www/img/jogos/intruso.svg`, `www/img/jogos/puzzle-*.svg` | Desenhados para este projeto; têm dentro imagens do Noto Emoji (listadas em `tools/creditos/intruso.txt` e `puzzle.txt`) | CC0 para o desenho, Apache 2.0 para as imagens que têm dentro |
| `www/img/jogos/cores-splat*.png` (12 ficheiros) | [Kenney Splat Pack](https://kenney.nl/assets/splat-pack), reduzidos a 384 px | CC0 |
| Os outros `www/img/jogos/*.svg` (botões do ecrã inicial e peças dos jogos) | Desenhados para este projeto | CC0 |
| `www/img/proprio/*.svg`, `www/img/fundo/azulejo.svg` | Desenhados para este projeto | CC0 |
| Azulejos | Desenhados por código em `www/js/azulejos.js` | CC0 |

## Sons

| Ficheiros | Origem | Licença |
| --- | --- | --- |
| `www/snd/*.ogg` (70 ficheiros) | Kenney: [Casino Audio](https://kenney.nl/assets/casino-audio), [Interface Sounds](https://kenney.nl/assets/interface-sounds), [Music Jingles](https://kenney.nl/assets/music-jingles), [Impact Sounds](https://kenney.nl/assets/impact-sounds). Convertidos para mono e nivelados; os ficheiros `*-serie*.ogg` e `saltos-n*.ogg` são cópias de um mesmo efeito em tons diferentes. | CC0. Não é preciso dar crédito ([kenney.nl/support](https://kenney.nl/support)). |
| `www/snd/musica/caixa-ternura.ogg`, `caixa-polca.ogg` | ["4 Music Box Tracks"](https://opengameart.org/node/136996) de Aureolus_Omicron, OpenGameArt | CC0 (página conferida a 19 de outubro de 2026) |
| `www/snd/musica/guitarra.ogg` | ["Etirwer"](https://opengameart.org/content/etirwer) de Kistol, OpenGameArt | CC0 (página conferida a 19 de outubro de 2026) |
| `www/snd/musica/palmas.ogg` | ["Happy Clappy Loop"](https://opengameart.org/content/happy-clappy-loop) de OwlishMedia, OpenGameArt | CC0 (página conferida a 19 de outubro de 2026) |
| Água, canto de pássaros, tons da Sequência | Sintetizados em `www/js/som.js` | CC0 |

## Tipo de letra

| Ficheiros | Origem | Licença |
| --- | --- | --- |
| `www/fonts/AtkinsonHyperlegibleNext-*.woff2` | [Atkinson Hyperlegible Next](https://github.com/googlefonts/atkinson-hyperlegible-next), Braille Institute | SIL Open Font License 1.1, `www/fonts/OFL.txt` |

## Biblioteca

| Ficheiros | Origem | Licença |
| --- | --- | --- |
| `www/lib/pannellum/pannellum.js`, `pannellum.css` | [Pannellum](https://github.com/mpetroff/pannellum) 2.5.7, Matthew Petroff. Visor de 360 graus para A minha casa e os Passeios. | MIT, `www/lib/pannellum/COPYING.txt` |
| A "casca" Android da app (`@capacitor/core`, `@capacitor/android` 8.5.3, `@capacitor/app` 8.1.2) | [Capacitor](https://github.com/ionic-team/capacitor), Drifty Co. e Ionic | MIT, segundo o `package.json` e o `LICENSE` de cada pacote em `node_modules/@capacitor/` (conferido a 28 de outubro de 2026) |

## Textos

| Conteúdo | Origem | Licença |
| --- | --- | --- |
| Os ditados do jogo Ditados | Provérbios tradicionais portugueses, conferidos com o [Wikiquote](https://pt.wikiquote.org/wiki/Prov%C3%A9rbios_portugueses) a 18 de outubro de 2026 | Ditos populares, domínio público |
| As adivinhas do jogo Adivinhas | Adivinhas tradicionais portuguesas contadas de memória, e adivinhas escritas para este projeto | Domínio público e CC0 |
| Todas as outras palavras que os jogos mostram ou dizem | Escritas para este projeto | CC0 |

## Voz

| Ficheiros | Origem | Licença |
| --- | --- | --- |
| `www/voz/tts/` | Voz do computador: [Piper](https://github.com/OHF-Voice/piper1-gpl) com a voz pt_PT "tugão" medium ([ficha do modelo](https://huggingface.co/rhasspy/piper-voices/tree/main/pt/pt_PT/tug%C3%A3o/medium)). Conjunto de dados CC0; afinada a partir da voz inglesa "lessac", cujos dados de origem podem ter condições de uso não comercial. | Só para uso privado. Fica fora de qualquer cópia pública. O programa Piper (GPL-3.0-or-later) só corre no computador de quem faz os ficheiros; não faz parte da app. |
| `www/voz/familia/` | Gravadas pela família | Privadas. Ficam fora de qualquer cópia pública. |

## Fotografias da família

| Ficheiros | Origem | Licença |
| --- | --- | --- |
| Pacotes de fotografias de `<kit>/media/fotos` | A família | Privadas. Nunca fazem parte do código da app nem de qualquer cópia pública. |
