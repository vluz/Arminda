// Puzzle: uma imagem cortada em peças quadradas, baralhadas. A pessoa toca em duas peças para as
// trocar, até a imagem ficar inteira. Fotografias da família quando há, senão as nossas cenas coloridas.
// As peças no sítio ganham uma moldura verde e ficam quietas. Os níveis baixos mostram uma pequena imagem de ajuda.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { ler, gravar, nivel, ajustarNivel } from "../estado.js";
import { el, ecra, espera, premio, estilo, ALVO_MIN } from "../ui.js";
import { fotosFamilia } from "../media.js";

// Nível: linhas x colunas (deitado; trocadas num ecrã ao alto) e a imagem de ajuda.
// Um nível que o ecrã não aguenta com peças de pelo menos ALVO_MIN desce para o nível abaixo.
const NIVEIS = [
  { l: 2, c: 2, previa: true },
  { l: 2, c: 3, previa: true },
  { l: 3, c: 3, previa: true },
  { l: 3, c: 4, previa: true },
  { l: 3, c: 4, previa: false },
  { l: 4, c: 4, previa: false },
  // A pedido da família: mais peças, até MIN_TOPO num ecrã de 7 polegadas.
  { l: 4, c: 5, previa: false, min: 80 },
  { l: 4, c: 6, previa: false, min: 80 },
  { l: 5, c: 6, previa: false, min: 80 },
  { l: 5, c: 7, previa: false, min: 80 },
  { l: 5, c: 8, previa: false, min: 80 },
  // Topo: algumas peças começam rodadas. Uma peça rodada que chega ao seu sítio mostra uma seta
  // redonda, e um toque nela roda-a um quarto de volta. As peças fora do sítio trocam-se como sempre.
  { l: 5, c: 8, previa: false, min: 80, rodar: 0.25 },
];

const CENAS = ["eletrico", "jardim", "azulejos", "praia", "cozinha"];
const GAP = 3; // linha fina entre as peças

export const NIVEIS_MAX = NIVEIS.length;

function cssPronto(id) {
  const link = document.querySelector(`link[data-jogo="${id}"]`);
  if (!link || link.sheet) return Promise.resolve();
  return new Promise((r) => {
    link.addEventListener("load", r, { once: true });
    link.addEventListener("error", r, { once: true });
    setTimeout(r, 1500);
  });
}

// Um baralhar em que nenhuma peça começa no seu próprio sítio.
function desarrumar(n) {
  let p;
  do {
    p = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
  } while (p.some((v, i) => v === i));
  return p;
}

function carregar(src) {
  return new Promise((ok, falha) => {
    const i = new Image();
    i.onload = () => ok({ w: i.naturalWidth || 400, h: i.naturalHeight || 400 });
    i.onerror = falha;
    i.src = src;
  });
}

// Imagem seguinte: uma fotografia da família quando há, senão uma cena que vem com o jogo; nunca a
// mesma duas vezes seguidas.
async function escolherImagem() {
  let fotos = [];
  try { fotos = await fotosFamilia(); } catch { fotos = []; }
  const lista = fotos.length
    ? fotos.map((src) => ({ src, foto: true, cena: null }))
    : CENAS.map((c) => ({ src: `img/jogos/puzzle-${c}.svg`, foto: false, cena: c }));
  const ultima = ler("puzzle.ultima", "");
  const k0 = Math.max(0, lista.findIndex((x) => x.src === ultima));
  const ordem = lista.length > 1 ? [...lista.slice(k0 + 1), ...lista.slice(0, k0 + 1)] : lista;
  for (const op of ordem) {
    try {
      const tam = await carregar(op.src);
      gravar("puzzle.ultima", op.src);
      return { ...op, ...tam };
    } catch {
      // Uma fotografia que não carrega é saltada.
    }
  }
  const c = CENAS[0];
  return { src: `img/jogos/puzzle-${c}.svg`, foto: false, cena: c, w: 400, h: 400 };
}

export function abrir(app, sair) {
  estilo("puzzle");
  const e = ecra(() => terminar(false));
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    if (!completo && ronda) ronda.registar(false);
    e.raiz.remove();
    sair();
  }

  // O maior nível até n que cabe; devolve também a disposição.
  function medir(n, caixa) {
    const paisagem = caixa.width >= caixa.height;
    for (let k = n; k >= 1; k--) {
      const cfg = NIVEIS[k - 1];
      const linhas = paisagem ? cfg.l : cfg.c;
      const cols = paisagem ? cfg.c : cfg.l;
      let bw = caixa.width;
      let bh = caixa.height;
      let previa = 0;
      if (cfg.previa) {
        if (paisagem) { previa = Math.min(caixa.width * 0.27, caixa.height * 0.62); bw -= previa + 24; }
        else { previa = Math.min(caixa.height * 0.22, caixa.width * 0.5); bh -= previa + 24; }
      }
      const lado = Math.floor(Math.min(bw / cols, bh / linhas) - GAP);
      if (lado >= (cfg.min || ALVO_MIN) || k === 1) return { k, cfg, linhas, cols, lado, previa, paisagem };
    }
    return null;
  }

  async function comecar() {
    await cssPronto("puzzle");
    if (!ativo) return;
    const n = nivel("puzzle");
    const imagem = await escolherImagem();
    if (!ativo) return;
    const zona = el("div", { class: "puzzle" });
    // Uma barra de progresso fina no intervalo por cima do tabuleiro.
    const enchimento = el("i");
    e.corpo.replaceChildren(zona, el("div", { class: "pz-barra" }, [enchimento]));
    const caixa = e.corpo.getBoundingClientRect();
    const m = medir(n, caixa);
    const { linhas, cols, lado } = m;
    const total = linhas * cols;
    const passo = lado + GAP;
    const BW = cols * passo - GAP;
    const BH = linhas * passo - GAP;
    // Cortar a imagem para encher o tabuleiro, centrada.
    const escala = Math.max(BW / imagem.w, BH / imagem.h);
    const iw = imagem.w * escala;
    const ih = imagem.h * escala;
    const ox = (iw - BW) / 2;
    const oy = (ih - BH) / 2;

    zona.classList.toggle("vertical", !m.paisagem);
    const tabuleiro = el("div", { class: "tabuleiro", style: { width: `${BW}px`, height: `${BH}px` } });
    zona.append(tabuleiro);
    if (m.previa) {
      const pw = m.paisagem ? m.previa : (m.previa * BW) / BH;
      const ph = m.paisagem ? (m.previa * BH) / BW : m.previa;
      zona.append(el("div", { class: "previa", style: {
        width: `${pw}px`, height: `${ph}px`, backgroundImage: `url("${imagem.src}")`,
      } }));
    }

    const lugar = desarrumar(total); // lugar[peça] = lugar onde ela está agora
    // rodado[peça]: graus que está rodada (90, 180, 270; cresce para lá de 360 para rodar sempre para a frente).
    const rodado = Array(total).fill(0);
    if (m.cfg.rodar) {
      const quantas = Math.round(total * m.cfg.rodar);
      for (const p of desarrumar(total).slice(0, quantas)) rodado[p] = 90 * (1 + Math.floor(Math.random() * 3));
    }
    const direita = (p) => rodado[p] % 360 === 0;
    const xy = (slot) => [(slot % cols) * passo, Math.floor(slot / cols) * passo];
    const pecas = [];
    for (let p = 0; p < total; p++) {
      const [cx, cy] = xy(p);
      const b = el("button", { class: "peca", style: {
        width: `${lado}px`, height: `${lado}px`,
        backgroundImage: `url("${imagem.src}")`,
        backgroundSize: `${iw}px ${ih}px`,
        backgroundPosition: `${-(cx + ox)}px ${-(cy + oy)}px`,
      } });
      b.addEventListener("click", () => tocar(p));
      tabuleiro.append(b);
      pecas.push(b);
    }
    function pousar(p) {
      const [x, y] = xy(lugar[p]);
      pecas[p].style.transform = `translate(${x}px, ${y}px)${rodado[p] ? ` rotate(${rodado[p]}deg)` : ""}`;
      pecas[p].dataset.rodado = rodado[p] % 360;
    }
    pecas.forEach((_, p) => pousar(p));

    const inicio = Date.now();
    let trocas = 0;
    let trocasInuteis = 0;
    let seguidasInuteis = 0;
    let pistas = 0;
    let certas = 0;
    let rodadelas = 0;
    let serie = 0;
    let melhorSerie = 0;
    let avisouRodar = false;
    const rodadasInicio = rodado.filter((r) => r).length;
    let escolhida = null;
    let bloqueado = true;
    const tempos = [];
    let ultimoMov = Date.now();

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        metricas.ronda("puzzle", {
          level: n,
          level_shown: m.k,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: certas,
          pieces: total,
          swaps: trocas,
          useless_swaps: trocasInuteis,
          hints_needed: pistas,
          preview: !!m.previa,
          photo: imagem.foto,
          accuracy: trocas ? Math.round(((trocas - trocasInuteis) / trocas) * 100) / 100 : null,
          ms_per_swap_median: metricas.mediana(tempos),
          best_streak: melhorSerie,
          turned_pieces: rodadasInicio,
          turns: rodadelas,
        });
        // Claramente fácil: sem pista, quase todas as trocas puseram uma peça no sítio, e com ritmo (9 s por peça).
        const facil = completo && pistas === 0 && trocasInuteis <= total / 5 && dur < total * 9000;
        const dificil = completo && (pistas >= 3 || trocasInuteis > total * 1.5);
        ajustarNivel("puzzle", NIVEIS.length, { completo, facil, dificil });
      },
    };

    function marcarCerta(p) {
      pecas[p].classList.remove("torta");
      pecas[p].classList.add("certa");
      certas++;
      enchimento.style.width = `${(certas / total) * 100}%`;
    }

    // Uma peça no seu sítio: direita, ou rodada (aí espera pelos toques que a rodam).
    function chegou(p) {
      if (direita(p)) marcarCerta(p);
      else pecas[p].classList.add("torta");
    }

    async function rodar(p) {
      bloqueado = true;
      rodadelas++;
      rodado[p] += 90;
      pousar(p);
      som.efeito("virar", 0.4);
      await espera(380);
      if (!ativo) return;
      if (direita(p)) {
        marcarCerta(p);
        som.efeito("par", 0.6);
        if (certas === total) {
          await acabar();
          return;
        }
      }
      bloqueado = false;
    }

    async function tocar(p) {
      if (!ativo || bloqueado) return;
      const b = pecas[p];
      if (b.classList.contains("certa")) {
        som.efeito("toque", 0.3);
        return;
      }
      if (b.classList.contains("torta")) {
        pecas.forEach((x) => x.classList.remove("pista"));
        await rodar(p);
        return;
      }
      if (escolhida === null) {
        escolhida = p;
        b.classList.add("escolhida");
        som.efeito("toque", 0.5);
        return;
      }
      if (escolhida === p) {
        escolhida = null;
        b.classList.remove("escolhida");
        som.efeito("toque", 0.3);
        return;
      }
      // Trocar as duas peças.
      const a = escolhida;
      escolhida = null;
      bloqueado = true;
      trocas++;
      tempos.push(Date.now() - ultimoMov);
      [lugar[a], lugar[p]] = [lugar[p], lugar[a]];
      pecas.forEach((x) => x.classList.remove("pista"));
      pecas[a].classList.remove("escolhida");
      pecas[a].classList.add("a-mover");
      pecas[p].classList.add("a-mover");
      pousar(a);
      pousar(p);
      som.efeito("virar", 0.5);
      await espera(380);
      if (!ativo) return;
      pecas[a].classList.remove("a-mover");
      pecas[p].classList.remove("a-mover");
      ultimoMov = Date.now();
      const novas = [a, p].filter((x) => lugar[x] === x);
      novas.forEach(chegou);
      const novaTorta = novas.some((x) => !direita(x));
      if (novas.length) {
        seguidasInuteis = 0;
        // Trocas úteis seguidas: cada uma com um som um pouco mais agudo.
        serie++;
        melhorSerie = Math.max(melhorSerie, serie);
        som.efeito(serie >= 2 ? `puzzle-serie${Math.min(serie - 1, 4)}` : "par", 0.6);
      } else {
        serie = 0;
        trocasInuteis++;
        seguidasInuteis++;
      }

      if (certas === total) {
        await acabar();
        return;
      }
      if (novaTorta && !avisouRodar) {
        // A primeira peça rodada no seu sítio: explicar a seta redonda uma vez.
        avisouRodar = true;
        await e.dizer("puzzle.rodar");
      } else if (novas.length) {
        if (serie === 3 || serie === 6) await e.dizer(`puzzle.serie_${serie}`, { cara: "img/noto/gato_feliz.svg" });
        else if (certas && certas === novas.length) await e.dizer("puzzle.certa", { cara: "img/noto/gato_feliz.svg" });
        else if (total - certas <= 2 && total > 4) await e.dizer("puzzle.falta_pouco", { cara: "img/noto/gato_feliz.svg" });
        else if (Math.random() < 0.4) await e.dizer(som.elogio(), { cara: "img/noto/gato_feliz.svg" });
      } else if (seguidasInuteis >= (m.k <= 2 ? 2 : 3) && lugar.some((s, x) => s !== x)) {
        // Mostrar discretamente duas peças que pertencem ao sítio uma da outra, ou uma peça e o seu sítio.
        seguidasInuteis = 0;
        pistas++;
        const fora = [...Array(total).keys()].filter((x) => lugar[x] !== x);
        const x = fora.find((q) => lugar[lugar[q]] === q) ?? fora[0];
        const ocupante = lugar.indexOf(x);
        for (const q of [x, ocupante]) {
          pecas[q].classList.remove("pista");
          void pecas[q].offsetWidth;
          pecas[q].classList.add("pista");
        }
        await e.dizer("puzzle.pista");
      } else if (trocasInuteis === 2 && m.previa) {
        await e.dizer("puzzle.olha");
      }
      bloqueado = false;
    }

    async function acabar() {
      tabuleiro.classList.add("completo");
      som.efeito("vitoria2", 0.5);
      await espera(600);
      if (!ativo) return;
      await e.dizer("puzzle.feito", { cara: "img/noto/gato_amor.svg" });
      if (!ativo) return;
      await e.dizer(imagem.foto ? "puzzle.foto_bonita" : `puzzle.${imagem.cena}`, { cara: "img/noto/gato_amor.svg" });
      if (!ativo) return;
      // Mais rápido por peça do que na última ronda neste nível: dizê-lo à pessoa.
      const porPeca = (Date.now() - inicio) / total;
      const antes = ler("puzzle.anterior", null);
      if (antes && antes.nivel === n && porPeca < antes.porPeca) {
        await e.dizer("puzzle.melhor", { cara: "img/noto/gato_amor.svg" });
        if (!ativo) return;
      }
      gravar("puzzle.anterior", { nivel: n, porPeca });
      ronda.registar(true);
      ronda = null;
      const r = await premio(e, e.raiz);
      if (r === "outra") comecar();
      else terminar(true);
    }

    if (imagem.foto) await e.dizer("puzzle.foto", { cara: "img/noto/gato_amor.svg" });
    if (!ativo) return;
    await e.dizer("puzzle.instrucao");
    if (!ativo) return;
    if (rodadasInicio) await e.dizer("puzzle.viradas");
    if (!ativo) return;
    bloqueado = false;
  }

  comecar();
  return () => terminar(false);
}
