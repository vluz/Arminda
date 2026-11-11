// Loto: um número é cantado em voz alta; a pessoa toca nele no seu cartão. Uma linha cheia é
// "Linha!", um cartão cheio ganha.
// Quem canta espera pela pessoa. Se o número está no cartão e ela não o encontra, ele pisca.
// Níveis de topo: dois cartões e números só de ouvido (a bola só mostra os algarismos depois de marcados).

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { ler, gravar, nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio, estilo } from "../ui.js";

// Nível: linhas x colunas do cartão, número mais alto, segundos até uma pista (0 = logo),
// e quantos cartões se jogam de uma vez. Um cartão cheio ganha, como no jogo a sério.
// O ecrã limita as colunas para as casas ficarem com pelo menos CASA_MIN.
const NIVEIS = [
  { linhas: 2, colunas: 3, max: 20, pista: 0 },
  { linhas: 3, colunas: 3, max: 30, pista: 5 },
  { linhas: 3, colunas: 3, max: 60, pista: 8 },
  { linhas: 3, colunas: 4, max: 90, pista: 10 },
  { linhas: 3, colunas: 5, max: 90, pista: 12 },
  { linhas: 3, colunas: 5, max: 90, pista: 20 },
  { linhas: 3, colunas: 3, max: 90, pista: 15, cartoes: 2 },
  { linhas: 3, colunas: 4, max: 90, pista: 20, cartoes: 2 },
  // Níveis de topo: a bola não mostra algarismos, por isso é preciso saber o número de ouvido (o
  // balão continua a mostrar as palavras que se ouvem). O último também canta mais depressa quando
  // o número não é do cartão.
  { linhas: 3, colunas: 4, max: 90, pista: 25, cartoes: 2, palavras: true },
  { linhas: 3, colunas: 5, max: 90, pista: 25, cartoes: 2, palavras: true, rapido: true },
];
const ESPERA_FORA = 3500; // pausa depois de um número que não está no cartão
const ESPERA_FORA_RAPIDO = 1600;
const CASA_MIN = 100;     // as casas do tabuleiro podem descer até 100 px (GUIA-JOGOS.md)

function baralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cssPronto(id) {
  const link = document.querySelector(`link[data-jogo="${id}"]`);
  if (!link || link.sheet) return Promise.resolve();
  return new Promise((r) => {
    link.addEventListener("load", r, { once: true });
    link.addEventListener("error", r, { once: true });
    setTimeout(r, 1500);
  });
}

// Lado da casa para `cartoes` cartões de linhas x colunas numa caixa, contando com a margem de
// dentro do cartão, a borda e os intervalos (2vmin, borda, 1.6vmin, de app.css).
function ladoCasa(cartoes, linhas, colunas, w, h, vertical) {
  const vmin = Math.min(innerWidth, innerHeight) / 100;
  const borda = Math.max(4, 0.7 * vmin);
  const extra = (n) => 2 * 2 * vmin + 2 * borda + (n - 1) * 1.6 * vmin;
  const entre = 3 * vmin;
  const cw = vertical ? w : (w - entre * (cartoes - 1)) / cartoes;
  const ch = vertical ? (h - entre * (cartoes - 1)) / cartoes : h;
  return Math.floor(Math.min((cw - extra(colunas)) / colunas, (ch - extra(linhas)) / linhas, 25 * vmin));
}

function idNumero(n) {
  const sec = n <= 30 ? "numeros1" : n <= 60 ? "numeros2" : "numeros3";
  return `${sec}.${n}`;
}

function sortear(quantos, max) {
  const s = new Set();
  while (s.size < quantos) s.add(1 + Math.floor(Math.random() * max));
  return [...s].sort((a, b) => a - b);
}

// Sensação de jogo: uma barra de progresso ao longo da borda de baixo (o cartão mais cheio) e um
// emblema de série, com uma festa a cada três números encontrados depressa de seguida.
function criarRitmo(raiz) {
  const barra = el("div", { class: "loto-barra" }, [el("i")]);
  const selo = el("div", { class: "loto-selo" });
  raiz.append(barra, selo);
  let seguidas = 0;
  return {
    progresso(f) { barra.firstChild.style.width = `${Math.min(100, f * 100)}%`; },
    certo() {
      seguidas++;
      if (seguidas >= 3 && seguidas % 3 === 0) {
        selo.textContent = `${seguidas} seguidos!`;
        selo.classList.remove("mostra");
        void selo.offsetWidth;
        selo.classList.add("mostra");
        som.efeito(seguidas % 6 === 0 ? "vitoria2" : "linha", 0.45);
      }
    },
    errado() { seguidas = 0; },
    remover() { barra.remove(); selo.remove(); },
  };
}
const RAPIDO_MS = 5000; // encontrar assim depressa mantém a série

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo("loto");
  const e = ecra(() => terminar(false));
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let ritmo = null;
  let acordar = null; // resolve a espera por um toque

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    if (!completo && ronda) ronda.registar(false);
    if (acordar) acordar();
    e.raiz.remove();
    sair();
  }

  async function comecar() {
    await cssPronto("loto");
    if (!ativo) return;
    const n = nivel("loto");
    const cfg = { ...NIVEIS[n - 1] };
    const nCartoes = cfg.cartoes || 1;
    if (ritmo) ritmo.remover();
    ritmo = criarRitmo(e.raiz);

    const bola = el("div", { class: "bola" }, [el("span", {}, "")]);
    const zona = el("div", { class: `loto${nCartoes > 1 ? " dois" : ""}` }, [bola]);
    e.corpo.replaceChildren(zona);
    const caixa = e.corpo.getBoundingClientRect();
    const paisagem = caixa.width > caixa.height;
    let lado;
    let empilhar = false;
    if (nCartoes === 1) {
      const espacoCartao = paisagem
        ? { w: caixa.width - caixa.height * 0.75, h: caixa.height }
        : { w: caixa.width, h: caixa.height * 0.6 };
      const medir = () => Math.min(espacoCartao.w / cfg.colunas, espacoCartao.h / cfg.linhas) * 0.78;
      lado = medir();
      while (lado < CASA_MIN && cfg.colunas > 3) { cfg.colunas--; lado = medir(); }
    } else {
      // Dois cartões lado a lado, com uma bola mais pequena ao lado (ou por cima, ao alto).
      const b = bola.getBoundingClientRect();
      const vmin = Math.min(innerWidth, innerHeight) / 100;
      const w = paisagem ? caixa.width - b.width - 4 * vmin : caixa.width;
      const h = paisagem ? caixa.height : caixa.height - b.height - 4 * vmin;
      // Lado a lado ou um por cima do outro, o que der casas maiores.
      const medir = () => Math.max(ladoCasa(2, cfg.linhas, cfg.colunas, w, h, false),
        ladoCasa(2, cfg.linhas, cfg.colunas, w, h, true));
      lado = medir();
      while (lado < CASA_MIN && cfg.colunas > 3) { cfg.colunas--; lado = medir(); }
      empilhar = ladoCasa(2, cfg.linhas, cfg.colunas, w, h, true) > ladoCasa(2, cfg.linhas, cfg.colunas, w, h, false);
    }
    const total = cfg.linhas * cfg.colunas; // casas por cartão
    // Os números do cartão espalhados pelas colunas, dos mais pequenos para os maiores, como num cartão de papel.
    const sorteados = baralhar(sortear(total * nCartoes, cfg.max));
    const cartoes = Array.from({ length: nCartoes }, (_, k) =>
      sorteados.slice(k * total, (k + 1) * total).sort((a, b) => a - b));

    const inicio = Date.now();
    const reacoes = [];
    let chamadas = 0;
    let errados = 0;
    let pistas = 0;
    let linhasFeitas = new Set();
    let marcadas = 0;

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        metricas.ronda("loto", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: marcadas,
          card_size: total,
          cards: nCartoes,
          calls: chamadas,
          words_only: !!cfg.palavras,
          wrong_taps: errados,
          hints_needed: pistas,
          reaction_ms_median: metricas.mediana(reacoes),
          accuracy: marcadas + errados ? Math.round((marcadas / (marcadas + errados)) * 100) / 100 : null,
        });
        const med = metricas.mediana(reacoes) || 0;
        // Claramente fácil: sem toques errados, sem pistas, respostas rápidas. Uma boa ronda sem isso vale 1 ponto.
        const facil = completo && errados === 0 && pistas === 0 && med < (cfg.palavras ? 6000 : 4000);
        const dificil = completo && (pistas > total / 2 || errados > total);
        ajustarNivel("loto", NIVEIS.length, { completo, facil, dificil });
      },
    };

    const casasPorCartao = cartoes.map((numeros) => {
      const cartao = el("div", { class: "cartao" });
      cartao.style.gridTemplateColumns = `repeat(${cfg.colunas}, auto)`;
      return numeros.map((num) => {
        const b = el("button", { class: "casa-num", style: { "--lado": `${lado}px` } }, String(num));
        b.dataset.n = num;
        b.addEventListener("click", () => tocarCasa(b));
        cartao.append(b);
        return b;
      });
    });
    const folhas = casasPorCartao.map((cs) => cs[0].parentElement);
    if (nCartoes === 1) zona.append(folhas[0]);
    else zona.append(el("div", { class: `cartoes${empilhar ? " empilhados" : ""}` }, folhas));
    const casas = casasPorCartao.flat();
    const cheio = () => casasPorCartao.some((cs) => cs.every((c) => c.classList.contains("marcada")));

    let atual = null;
    let chamadoEm = 0;
    const saidos = new Set();

    function tocarCasa(b) {
      if (!ativo || b.classList.contains("marcada")) return;
      const num = Number(b.dataset.n);
      if (num === atual) {
        const ms = Date.now() - chamadoEm;
        reacoes.push(ms);
        if (ms < RAPIDO_MS && !b.classList.contains("pista")) ritmo.certo();
        else ritmo.errado();
        b.classList.remove("pista");
        b.classList.add("marcada");
        marcadas++;
        som.efeito("marcar");
        mostrarProgresso();
        if (acordar) acordar();
      } else if (saidos.has(num)) {
        // Um número anterior que escapou: marcá-lo também, com simpatia.
        b.classList.remove("pista");
        b.classList.add("marcada");
        marcadas++;
        som.efeito("marcar");
        mostrarProgresso();
        verificarLinhas();
      } else {
        ritmo.errado();
        errados++;
        som.efeito("quase", 0.4);
        e.dizer("loto.nao_saiu");
      }
    }

    function mostrarProgresso() {
      ritmo.progresso(Math.max(...casasPorCartao.map((cs) => cs.filter((c) => c.classList.contains("marcada")).length / cs.length)));
    }

    // Devolve verdadeiro quando uma linha nova fica completa.
    function verificarLinhas() {
      let nova = false;
      casasPorCartao.forEach((cs, k) => {
        for (let r = 0; r < cfg.linhas; r++) {
          const fila = cs.slice(r * cfg.colunas, (r + 1) * cfg.colunas);
          if (!linhasFeitas.has(`${k}-${r}`) && fila.every((c) => c.classList.contains("marcada"))) {
            linhasFeitas.add(`${k}-${r}`);
            fila.forEach((c) => c.classList.add("linha"));
            nova = true;
          }
        }
      });
      return nova;
    }

    // Ordem de saída: cerca de metade dos números cantados estão no cartão, para o jogo andar.
    function proximo() {
      const porMarcar = cartoes.flat().filter((x) => !saidos.has(x));
      if (porMarcar.length && Math.random() < 0.55) return porMarcar[Math.floor(Math.random() * porMarcar.length)];
      let x;
      let tentativas = 0;
      do { x = 1 + Math.floor(Math.random() * cfg.max); tentativas++; } while (saidos.has(x) && tentativas < 200);
      return saidos.has(x) ? porMarcar[0] : x;
    }

    function mostrarOuvir() {
      const s = bola.querySelector("span");
      s.replaceChildren(img("img/proprio/ouvir.svg", ""));
    }
    if (cfg.palavras) { bola.classList.add("ouvir"); mostrarOuvir(); }

    await e.dizer("loto.comecar");
    if (!ativo) return;
    await e.dizer("loto.instrucao");
    if (ativo && nCartoes > 1) await e.dizer("loto.dois");
    if (ativo && cfg.palavras) await e.dizer("loto.ouvido");

    while (ativo && !cheio()) {
      atual = proximo();
      saidos.add(atual);
      chamadas++;
      som.efeito("bola", 0.5);
      // A bola e o balão mudam juntos, para nunca mostrarem números diferentes.
      // Nos níveis "de ouvido" a bola mostra um altifalante até a pessoa encontrar o número.
      bola.dataset.n = atual;
      if (cfg.palavras) mostrarOuvir();
      else bola.querySelector("span").textContent = String(atual);
      e.mostrar(som.texto(idNumero(atual)));
      bola.classList.remove("nova");
      void bola.offsetWidth;
      bola.classList.add("nova");
      await espera(cfg.rapido ? 300 : 700);
      if (!ativo) return;
      chamadoEm = Date.now();
      await som.falar(idNumero(atual));
      if (!ativo) return;

      const casa = casas.find((c) => Number(c.dataset.n) === atual);
      if (casa && !casa.classList.contains("marcada")) {
        // Esperar pela pessoa, com um piscar depois da espera do nível e o número dito outra vez.
        let precisouPista = false;
        await new Promise((acorda) => {
          acordar = acorda;
          const mostrarPista = () => {
            if (casa.classList.contains("marcada") || !ativo) return;
            casa.classList.add("pista");
            // No nível 1 o piscar é automático, por isso não conta como pista de que a pessoa precisou.
            if (!precisouPista && cfg.pista > 0) { pistas++; precisouPista = true; }
          };
          if (cfg.pista === 0) mostrarPista();
          else setTimeout(mostrarPista, cfg.pista * 1000);
          setTimeout(() => {
            if (!casa.classList.contains("marcada") && ativo) som.falar(idNumero(atual));
          }, (cfg.pista + 6) * 1000);
        });
        acordar = null;
        if (!ativo) return;
        if (cfg.palavras) bola.querySelector("span").textContent = String(atual);
        if (verificarLinhas() && !cheio()) {
          som.efeito("linha", 0.6);
          await e.dizer("loto.linha", { cara: "img/noto/gato_feliz.svg" });
        } else if (!cheio() && Math.random() < 0.35) {
          await e.dizer(reacoes.at(-1) < 2500 ? "geral.rapidez" : som.elogio(), { cara: "img/noto/gato_feliz.svg" });
        }
      } else {
        await espera(cfg.rapido ? ESPERA_FORA_RAPIDO : ESPERA_FORA);
        if (!ativo) return;
        if (Math.random() < 0.3) await e.dizer("loto.proximo");
      }
    }
    if (!ativo) return;

    verificarLinhas();
    await e.dizer("loto.cheio", { cara: "img/noto/gato_amor.svg" });
    if (!ativo) return;
    // Mais rápido do que da última vez neste nível: dizê-lo.
    const med = metricas.mediana(reacoes) || 0;
    const antes = ler("loto.ultima", null);
    gravar("loto.ultima", { nivel: n, med });
    if (antes && antes.nivel === n && med && med < antes.med * 0.9) {
      await e.dizer("loto.melhor", { cara: "img/noto/gato_feliz.svg" });
      if (!ativo) return;
    }
    ronda.registar(true);
    ronda = null;
    const r = await premio(e, e.raiz);
    if (r === "outra") comecar();
    else terminar(true);
  }

  comecar();
  return () => terminar(false);
}
