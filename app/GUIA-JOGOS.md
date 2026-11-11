# Guia para fazer um jogo

Leia isto antes de escrever qualquer jogo em `www/js/jogos/`. Todos os jogos têm de parecer parte da mesma app.

## Quem joga

Os jogos foram escritos para uma pessoa mais velha, com a vista cansada e as mãos pouco firmes, que se cansa depressa, não tem prática com tecnologia e só lê português. Uma pessoa assim é muitas vezes mais desperta do que os primeiros jogos supõem, por isso dê desafio a sério nos níveis mais altos. Desenhe para essa pessoa e cada jogo servirá à maior parte dos familiares mais velhos. O primeiro objetivo é um sorriso. Cada jogo deve pedir um pouco de memória, atenção, linguagem, números ou controlo dos dedos enquanto se joga, e nunca o dizer.

O tablet de referência: Alcatel 1T 7 (2023), 7 polegadas, 1024×600 a 160 dpi, Android 12 Go, WebView 105, 2 GB de RAM, um processador lento. As animações correm bem nele. As disposições usam unidades `vmin` e as ajudas de tamanho de `ui.js`, por isso ecrãs maiores ou mais nítidos não precisam de mudanças.

## Regras

1. Só português de Portugal (pt-PT, nunca pt-BR): "ecrã", "autocarro", "pequeno-almoço", tratamento por tu ("Toca", "Escolhe").
2. Tudo o que a pessoa toca tem pelo menos `ALVO_MIN` (113 px CSS, 1,8 cm). As casas de um tabuleiro podem descer até 100 px se o jogo não funcionar de outra maneira. Use `grelha()` e `cabem()` de `ui.js` para dar tamanho às peças; deixe o ecrã limitar o nível (menos peças num ecrã pequeno) em vez de encolher as peças.
3. Só toques, ou arrastos muito tolerantes. Sem toques duplos, toques longos, beliscões nem deslizes.
4. Sem relógios que castiguem a lentidão, sem vidas, sem "fim de jogo". Um erro tem um som suave e uma frase simpática (`som.quase()`), nunca uma buzina.
5. Jogos de cartas ou de tabuleiro contra o computador: os jogadores do computador são personagens simpáticas, jogam fraco nos níveis baixos e razoavelmente nos altos. Pode-se perder uma mão; acabar uma partida termina sempre com elogio e com o prémio.
6. Cada ronda acabada chama `premio()` (azulejo novo, confetes, "Outra vez" ou "Início"). As rondas duram 2 a 5 minutos. Sair a meio não faz perder nada.
7. Diga coisas curtas e carinhosas pela boca do gato: instruções no início, elogios muitas vezes (`som.elogio()`), uma pista depois de vários erros. Cada frase que a pessoa ouve aparece também no balão.
8. Cores vivas, contornos escuros e grossos, letras grandes e carregadas. Use as variáveis CSS de `css/app.css` (`--vermelho`, `--amarelo`, `--azul`, `--verde`, `--roxo`, `--rosa`, `--laranja`, `--branco`, `--linha`, `--borda`, `--raio`, `--sombra`, `--t-grande`, `--t-medio`). Os algarismos usam `font-family: var(--digitos)`.
9. Leve para o processador: transições e transformações CSS, sem ciclos de canvas sempre a correr, sem imagens grandes. Pare todos os temporizadores e ciclos quando o jogo acaba.
10. Dificuldade silenciosa: vários níveis (aponte para 5 ou mais onde fizer sentido), do muito fácil ao que é mesmo um desafio para uma pessoa mais velha e desperta. Leia o nível com `nivel(id)`; depois de cada ronda chame `ajustarNivel(id, NIVEIS_MAX, { completo, facil, dificil })`. A pessoa nunca vê o nível. A regra partilhada (`estado.js`, a pedido da família: pode subir depressa demais e voltar atrás; sem desafio fica fácil demais e a pessoa desiste): uma ronda completa que não foi difícil vale 1 ponto, uma claramente fácil vale 3 (sobe logo); 3 pontos sobem o nível um degrau; uma ronda claramente difícil desce um degrau; uma ronda deixada a meio não muda nada. Por isso `facil` deve querer dizer claramente fácil para a pessoa, e `dificil` claramente difícil demais, mais do que uns poucos erros. Dê a cada jogo níveis suficientes para uma pessoa desperta continuar a subir durante semanas (aponte para 8 ou mais onde o jogo deixar).
11. Sensação de jogo. O ecrã do prémio já mostra 1 a 3 estrelas (fácil 3, normal 2, difícil 1), festeja uma subida de nível, as vitórias seguidas e os marcos, tudo a partir de `ajustarNivel`; por isso chame `ajustarNivel` antes de `premio`. Dentro da ronda junte algumas destas coisas: um contador de acertos seguidos com sons a subir, um bónus de vez em quando, uma barra de progresso até ao fim da ronda, uma frase curta de "melhor do que da última vez" quando a pessoa faz melhor do que na ronda anterior (guarde a pontuação anterior com `ler` e `gravar`). A velocidade pode subir com o nível nos jogos de ação, desde que um erro custe só um instante, nunca a ronda.

## O que se aprendeu com o primeiro uso a sério

A pessoa era mais desperta do que os primeiros níveis supunham, sobretudo com palavras e com dinheiro. Todos os jogos devem continuar a subir depressa (ver a regra 10). Os jogos que tocam num ponto forte (Sopa de letras, Feira, Palavras) precisam de desafio a sério no topo. A família aceitou peças mais pequenas onde o jogo precisa delas, desde que cada nível continue claro:

| Jogo | Peça mais pequena permitida nos níveis de topo |
| --- | --- |
| Pares | cerca de um terço de um botão do ecrã inicial: 55 px num ecrã de 1024×600 |
| Sopa de letras | casas de letra de 72 px |
| Palavras | letras de 90 px |
| Puzzle | peças de 80 px |
| Sudoku | casas e botões de imagem de 90 px nos tabuleiros de 6x6 |
| Labirinto | corredores de 60 px (a pessoa arrasta o gato; a zona de agarrar fica com 150 px ou mais) |
| Azulejos (pintar) | regiões de 70 px nos níveis de topo |
| Tudo o resto | 113 px (sem mudança) |

Mantenha os níveis que existem como níveis de baixo; acrescente os novos por cima. Mantenha estáveis os campos dos registos; acrescente novos se for preciso.

## O contrato de um módulo

Ficheiro `www/js/jogos/<id>.js`:

```js
export const NIVEIS_MAX = 6;
export function abrir(app, sair) {
  // construir o ecrã dentro de app, começar o jogo
  // chamar sair() quando a pessoa sai (botão da casinha ou "Início" depois do prémio)
  return parar; // função que para tudo (botão de voltar do Android); tem de poder ser chamada duas vezes
}
```

Um jogo que precisa de conteúdos da família (como `quem.js`) pode também exportar `async function disponivel()`: enquanto ela der falso, o jogo fica fora do ecrã inicial, e se for aberto di-lo com simpatia e volta ao início.

Copie a estrutura de `pares.js` ou de `loto.js`: `const e = ecra(() => terminar(false)); app.append(e.raiz);`, e um `terminar(completo)` que regista uma ronda abandonada, remove `e.raiz` e chama `sair()`.

## Ajudas

| Módulo | Para quê |
| --- | --- |
| `ui.js` | `el(tag, attrs, children)`, `img(src)`, `ecra(onCasa)` devolve `{ raiz, corpo, dizer(id, {cara}), mostrar(texto), balao, mascote }`, `espera(ms)`, `premio(e, e.raiz)` resolve com `"outra"` ou `"casa"`, `confetes(el)`, `ALVO_MIN`, `grelha(n, w, h)`, `cabem(w, h)`, `estilo(id)` carrega `css/jogos/<id>.css` e devolve uma promessa que se cumpre quando o estilo está aplicado (`await estilo(id)` antes de medir a disposição) |
| `som.js` | `efeito(nome)`, `falar(id)` (pode esperar-se por ela), `texto(id)`, `elogio()`, `quase()`, `preCarregar(ids)`, `agua()`, `piu()` |
| `estado.js` | `ler(chave, omissão)`, `gravar(chave, valor)` (comece as chaves pelo id do jogo), `nivel(id)`, `ajustarNivel(...)` |
| `metricas.js` | `ronda(id, campos)`, `mediana(lista)` |

Cada jogo tem também de aparecer em `www/js/jogos/registo.js` e na lista `JOGOS` de `tools/falas.py`, pela mesma ordem; um jogo novo leva `oculto: true` até a família o experimentar. Todos os módulos exportam `NIVEIS_MAX`; os jogos têm entre 5 e 23 níveis.

Efeitos em `www/snd/`: `toque`, `virar`, `baralhar`, `par`, `quase`, `vitoria`, `vitoria2`, `linha`, `bola`, `marcar`, `azulejo`, `abrir`, `voltar`, `crescer`, `colher`.

Caras do gato para `dizer(id, { cara })`: `img/noto/gato_sorri.svg`, `gato_feliz.svg`, `gato_amor.svg`.

## Registos

Chame `metricas.ronda("<id>", {...})` uma vez por ronda, acabada ou abandonada, com pelo menos: `level`, `started_at` (ISO), `duration_ms`, `completed`, `score`, `accuracy` (0 a 1 ou null), mais as medidas próprias do jogo que mostrem memória, atenção, tempo de reação ou precisão (por exemplo `reaction_ms_median`, `wrong_taps`, `hints_needed`). Só números, verdadeiro ou falso, e códigos curtos fixos (como `kind: "palavras"` ou `board: "6x6"`). Sem nomes, sem texto livre, nada tirado do nome de um ficheiro ou de uma legenda. Os nomes dos campos estão em inglês e não mudam: são o formato dos dados.

## Ficheiros que pode criar ou mudar

Só estes, para o seu jogo `<id>`:

- `www/js/jogos/<id>.js`, e módulos de ajuda `www/js/jogos/<id>-*.js` (uma ajuda partilhada por uma família de jogos, como um baralho de cartas, pode ter o nome da família, por exemplo `www/js/jogos/cartas.js`)
- `www/css/jogos/<id>.css`
- `www/img/jogos/<id>.svg` (a imagem do botão no ecrã inicial; substitua a provisória) e `www/img/jogos/<id>-*.svg`
- `www/img/noto/<nome>.svg`: mais imagens do Noto Emoji, descarregadas de `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/svg/emoji_u<código>.svg` (Apache 2.0)
- `www/snd/<id>-<nome>.ogg`: mais sons do Kenney (CC0), dos pacotes descarregados para `<kit>/downloads/kenney/`. Converta com `ffmpeg -i in.ogg -ac 1 -ar 44100 -af loudnorm=I=-20:TP=-2 -c:a libvorbis -q:a 4 out.ogg`
- `tools/falas/<id>.json`: as frases ditas, `{"linhas": [["chave", "texto"], ...]}`. Os ids ficam `<id>.<chave>`. A primeira linha tem de ser `["intro", "<uma frase que apresenta o jogo na introdução>"]`. Frases curtas e carinhosas. Os nomes das cartas, os números e as palavras que a pessoa tem de ouvir também vão aqui.
- `tools/creditos/<id>.txt`: uma linha por cada ficheiro de terceiros que acrescentou: caminho, endereço de origem, licença.
- `tools/testes/<id>.mjs`: uma jogada automática, opcional.

Não mude mais nada (`main.js`, `ui.js`, `som.js`, `app.css`, `registo.js`, outros jogos) sem pensar no efeito em todos os jogos.

Depois de mudar `tools/falas/<id>.json`, corra `python tools/falas.py` para o balão mostrar o texto. A voz faz-se no fim com `gerar_voz.py`; até lá, `falar()` espera cerca de um segundo em vez de falar.

## Testar

1. Arranque um servidor numa porta sua: `python -m http.server <porta> --bind 127.0.0.1 --directory www` (na pasta da app, noutra janela).
2. Em `tools/testes` (depois de `npm install` e `npx playwright install chromium` nessa pasta, uma vez) corra `node lib/testar_jogo.mjs <id> <porta> 8`. Abre `http://127.0.0.1:<porta>/#jogo=<id>` a 1024×600, 1280×800 e 800×1280, guarda capturas de ecrã em `test-shots/jogos/` e avisa de erros de script e de botões com menos de 105 px.
3. Veja as capturas. Escreva uma jogada em `tools/testes/<id>.mjs` (corra-a a partir dessa pasta) que jogue uma ronda inteira num nível baixo e num alto até ao ecrã do prémio, sem erros. Fixe os níveis com `localStorage.setItem("mae.v1", JSON.stringify({"intro.vista": 99, "migracao.niveis2": true, "nivel.<id>": 4}))` em `addInitScript`.
4. Pare o servidor no fim.
