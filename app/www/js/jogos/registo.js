// Todos os jogos, pela ordem do ecrã inicial. A ordem tem de ser igual à de JOGOS em tools/falas.py.
// inicio: nível em que uma pessoa nova começa. Cada módulo exporta NIVEIS_MAX.
// oculto: true mantém um jogo acabado fora do ecrã inicial e da introdução até a família o
// experimentar (abre-se no PC com #jogo=<id>).

import * as fotos from "./fotos.js";
import * as musica from "./musica.js";
import * as casa from "./casa.js";
import * as passeios from "./passeios.js";
import * as pares from "./pares.js";
import * as jardim from "./jardim.js";
import * as loto from "./loto.js";
import * as ditados from "./ditados.js";
import * as domino from "./domino.js";
import * as cozinha from "./cozinha.js";
import * as aquario from "./aquario.js";
import * as sopa from "./sopa.js";
import * as palavras from "./palavras.js";
import * as sequencia from "./sequencia.js";
import * as diferencas from "./diferencas.js";
import * as puzzle from "./puzzle.js";
import * as bisca from "./bisca.js";
import * as sueca from "./sueca.js";
import * as paciencia from "./paciencia.js";
import * as damas from "./damas.js";
import * as galo from "./galo.js";
import * as feira from "./feira.js";
import * as sardinha from "./sardinha.js";
import * as montapratos from "./montapratos.js";
import * as gato from "./gato.js";
import * as cores from "./cores.js";
import * as intruso from "./intruso.js";
import * as adivinhas from "./adivinhas.js";
import * as sudoku from "./sudoku.js";
import * as labirinto from "./labirinto.js";
import * as estendal from "./estendal.js";
import * as mesa from "./mesa.js";
import * as pintar from "./pintar.js";
import * as quatro from "./quatro.js";
import * as saltos from "./saltos.js";
import * as quem from "./quem.js";

export const JOGOS = [
  { id: "fotos", nome: "Fotografias", cor: "cor-amarelo", figura: "img/jogos/fotos.svg", modulo: fotos, inicio: 1 },
  { id: "musica", nome: "Música", cor: "cor-roxo", figura: "img/jogos/musica.svg", modulo: musica, inicio: 1 },
  { id: "casa", nome: "A minha casa", cor: "cor-verde", figura: "img/jogos/casa.svg", modulo: casa, inicio: 1 },
  { id: "passeios", nome: "Passeios", cor: "cor-azul", figura: "img/jogos/passeios.svg", modulo: passeios, inicio: 1 },
  { id: "pares", nome: "Pares", cor: "cor-vermelho", figura: "img/proprio/cartas.svg", modulo: pares, inicio: 3 },
  { id: "jardim", nome: "Jardim", cor: "cor-verde", figura: "img/noto/girassol.svg", modulo: jardim, inicio: 1 },
  { id: "loto", nome: "Loto", cor: "cor-azul", figura: "img/proprio/bola.svg", modulo: loto, inicio: 2 },
  { id: "ditados", nome: "Ditados", cor: "cor-roxo", figura: "img/jogos/ditados.svg", modulo: ditados, inicio: 2 },
  { id: "domino", nome: "Dominó", cor: "cor-rosa", figura: "img/jogos/domino.svg", modulo: domino, inicio: 2 },
  { id: "cozinha", nome: "Cozinha", cor: "cor-laranja", figura: "img/jogos/cozinha.svg", modulo: cozinha, inicio: 2 },
  { id: "aquario", nome: "Aquário", cor: "cor-ceu", figura: "img/jogos/aquario.svg", modulo: aquario, inicio: 1 },
  { id: "sopa", nome: "Sopa de letras", cor: "cor-amarelo", figura: "img/jogos/sopa.svg", modulo: sopa, inicio: 2 },
  { id: "palavras", nome: "Palavras", cor: "cor-rosa", figura: "img/jogos/palavras.svg", modulo: palavras, inicio: 2 },
  { id: "sequencia", nome: "Sequência", cor: "cor-azul", figura: "img/jogos/sequencia.svg", modulo: sequencia, inicio: 2 },
  { id: "diferencas", nome: "Diferenças", cor: "cor-laranja", figura: "img/jogos/diferencas.svg", modulo: diferencas, inicio: 2 },
  { id: "puzzle", nome: "Puzzle", cor: "cor-rosa", figura: "img/jogos/puzzle.svg", modulo: puzzle, inicio: 2 },
  { id: "bisca", nome: "Bisca", cor: "cor-verde", figura: "img/jogos/bisca.svg", modulo: bisca, inicio: 2 },
  { id: "sueca", nome: "Sueca", cor: "cor-vermelho", figura: "img/jogos/sueca.svg", modulo: sueca, inicio: 2 },
  { id: "paciencia", nome: "Paciência", cor: "cor-azul", figura: "img/jogos/paciencia.svg", modulo: paciencia, inicio: 2 },
  { id: "damas", nome: "Damas", cor: "cor-amarelo", figura: "img/jogos/damas.svg", modulo: damas, inicio: 2 },
  { id: "galo", nome: "Jogo do galo", cor: "cor-roxo", figura: "img/jogos/galo.svg", modulo: galo, inicio: 2 },
  { id: "feira", nome: "Feira", cor: "cor-verde", figura: "img/jogos/feira.svg", modulo: feira, inicio: 2 },
  { id: "sardinha", nome: "Sardinhas", cor: "cor-azul", figura: "img/jogos/sardinha.svg", modulo: sardinha, inicio: 2 },
  { id: "montapratos", nome: "Monta-pratos", cor: "cor-laranja", figura: "img/jogos/montapratos.svg", modulo: montapratos, inicio: 1 },
  { id: "gato", nome: "Gato aventureiro", cor: "cor-verde", figura: "img/jogos/gato.svg", modulo: gato, inicio: 1 },
  { id: "cores", nome: "Cores", cor: "cor-vermelho", figura: "img/jogos/cores.svg", modulo: cores, inicio: 1 },
  { id: "intruso", nome: "O intruso", cor: "cor-amarelo", figura: "img/jogos/intruso.svg", modulo: intruso, inicio: 1 },
  { id: "adivinhas", nome: "Adivinhas", cor: "cor-roxo", figura: "img/jogos/adivinhas.svg", modulo: adivinhas, inicio: 1 },
  { id: "sudoku", nome: "Sudoku", cor: "cor-azul", figura: "img/jogos/sudoku.svg", modulo: sudoku, inicio: 1, oculto: true },
  { id: "labirinto", nome: "Labirinto", cor: "cor-verde", figura: "img/jogos/labirinto.svg", modulo: labirinto, inicio: 1 },
  { id: "estendal", nome: "Estendal", cor: "cor-ceu", figura: "img/jogos/estendal.svg", modulo: estendal, inicio: 1, oculto: true },
  { id: "mesa", nome: "Pôr a mesa", cor: "cor-laranja", figura: "img/jogos/mesa.svg", modulo: mesa, inicio: 1, oculto: true },
  { id: "pintar", nome: "Azulejos", cor: "cor-azul", figura: "img/jogos/pintar.svg", modulo: pintar, inicio: 1 },
  { id: "quatro", nome: "Quatro em linha", cor: "cor-vermelho", figura: "img/jogos/quatro.svg", modulo: quatro, inicio: 1 },
  { id: "saltos", nome: "Saltos", cor: "cor-rosa", figura: "img/jogos/saltos.svg", modulo: saltos, inicio: 1 },
  { id: "quem", nome: "Quem é quem", cor: "cor-amarelo", figura: "img/jogos/quem.svg", modulo: quem, inicio: 1, oculto: true },
];
