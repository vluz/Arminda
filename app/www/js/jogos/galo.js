// Jogo do Galo contra o galo de Barcelos.
// A pessoa é a cruz vermelha, o galo é o círculo azul. Uma partida tem até três jogos.
// Níveis baixos: 3x3, o galo joga ao acaso e a pessoa começa sempre.
// Níveis mais altos: um galo cuidadoso, depois tabuleiros maiores (4x4 com três em linha, 5x5 com quatro).

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio, estilo, ALVO_MIN } from "../ui.js";

// n: lado do tabuleiro, k: quantos em linha ganham, ia: força do galo (0 ao acaso .. 3 cuidadoso),
// sempreTu: a pessoa começa todos os jogos, pista: uma casa de bloqueio brilha quando o galo ameaça.
const NIVEIS = [
  { n: 3, k: 3, ia: 0, sempreTu: true, pista: true },
  { n: 3, k: 3, ia: 1, sempreTu: true, pista: true },
  { n: 3, k: 3, ia: 2, sempreTu: false, pista: false },
  { n: 4, k: 3, ia: 2, sempreTu: false, pista: false },
  { n: 5, k: 4, ia: 2, sempreTu: false, pista: false },
  { n: 5, k: 4, ia: 3, sempreTu: false, pista: false },
];
const JOGOS_PARTIDA = 3;
const TU = 1;
const GALO = 2;

const SVG_X = `<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke-linecap="round">
<path d="M22 22 L78 78 M78 22 L22 78" stroke="#111" stroke-width="26"/>
<path d="M22 22 L78 78 M78 22 L22 78" stroke="#e63946" stroke-width="15"/></g></svg>`;
const SVG_O = `<svg viewBox="0 0 100 100" aria-hidden="true">
<circle cx="50" cy="50" r="30" fill="none" stroke="#111" stroke-width="25"/>
<circle cx="50" cy="50" r="30" fill="none" stroke="#0a6fd6" stroke-width="14"/></svg>`;

// Todas as filas de k casas em linha reta: linhas, colunas e as duas diagonais.
function janelas(n, k) {
  const lista = [];
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      for (const [dr, dc] of dirs) {
        const er = r + dr * (k - 1);
        const ec = c + dc * (k - 1);
        if (er < 0 || er >= n || ec < 0 || ec >= n) continue;
        const j = [];
        for (let i = 0; i < k; i++) j.push((r + dr * i) * n + (c + dc * i));
        lista.push(j);
      }
    }
  }
  return lista;
}

function vencedor(t, jan) {
  for (const j of jan) {
    const v = t[j[0]];
    if (v && j.every((i) => t[i] === v)) return { quem: v, linha: j };
  }
  return null;
}

// Casas onde `quem` completaria uma linha agora mesmo.
function vitorias(t, jan, quem) {
  const s = new Set();
  for (const j of jan) {
    let meus = 0;
    let vazio = -1;
    let vazios = 0;
    for (const i of j) {
      if (t[i] === quem) meus++;
      else if (!t[i]) { vazios++; vazio = i; }
    }
    if (meus === j.length - 1 && vazios === 1) s.add(vazio);
  }
  return [...s];
}

// Valor de cada casa vazia para `quem`: linhas que constrói, linhas que bloqueia, proximidade do centro.
function pontuar(t, jan, n, quem, i) {
  const outro = quem === TU ? GALO : TU;
  let p = 0;
  for (const j of jan) {
    if (!j.includes(i)) continue;
    let meus = 0;
    let deles = 0;
    for (const x of j) {
      if (t[x] === quem) meus++;
      else if (t[x] === outro) deles++;
    }
    if (deles === 0) p += Math.pow(8, meus) * 1.1;
    if (meus === 0) p += Math.pow(8, deles);
  }
  const r = Math.floor(i / n);
  const c = i % n;
  const meio = (n - 1) / 2;
  p += (n - Math.abs(r - meio) - Math.abs(c - meio)) * 0.5;
  return p;
}

function jogadaGalo(t, jan, n, ia) {
  const vazias = t.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  const acaso = () => vazias[Math.floor(Math.random() * vazias.length)];
  if (ia === 0) return acaso();
  const ganhar = vitorias(t, jan, GALO);
  if (ganhar.length) return ganhar[0];
  if (ia === 1) return acaso();
  const travar = vitorias(t, jan, TU);
  if (travar.length) return travar[Math.floor(Math.random() * travar.length)];
  // Uma jogada que faz duas ameaças de uma vez ganha, para um galo cuidadoso.
  if (ia >= 3) {
    for (const i of vazias) {
      t[i] = GALO;
      const ameacas = vitorias(t, jan, GALO).length;
      t[i] = 0;
      if (ameacas >= 2) return i;
    }
  }
  const notas = vazias.map((i) => ({ i, p: pontuar(t, jan, n, GALO, i) + (ia >= 3 ? 0 : Math.random() * 6) }));
  notas.sort((a, b) => b.p - a.p);
  return notas[0].i;
}

// Os tamanhos medem-se depois de a folha de estilos do jogo carregar, porque ela muda a disposição.
function cssPronto(id) {
  const l = document.querySelector(`link[data-jogo="${id}"]`);
  if (!l || l.sheet) return Promise.resolve();
  return new Promise((r) => {
    l.addEventListener("load", r, { once: true });
    l.addEventListener("error", r, { once: true });
    setTimeout(r, 2000);
  });
}

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo("galo");
  const placar = el("div", { class: "galo-placar" });
  const e = ecra(() => terminar(false), [placar]);
  e.raiz.classList.add("galo-ecra");
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let acordar = null;

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    if (!completo && ronda) ronda.registar(false);
    if (acordar) acordar(-1);
    e.raiz.remove();
    sair();
  }

  // O nível desce para o maior tabuleiro cujas casas ficam com pelo menos ALVO_MIN.
  function escolherNivel(n, caixa) {
    let k = n;
    while (k > 1) {
      const cfg = NIVEIS[k - 1];
      if (Math.min(caixa.width, caixa.height) * 0.98 / cfg.n >= ALVO_MIN) break;
      k--;
    }
    return k;
  }

  async function comecar() {
    await cssPronto("galo");
    if (!ativo) return;
    const nGuardado = nivel("galo");
    const caixa = e.corpo.getBoundingClientRect();
    const n = escolherNivel(nGuardado, caixa);
    const cfg = NIVEIS[n - 1];
    const jan = janelas(cfg.n, cfg.k);
    const lado = Math.floor(Math.min(caixa.width, caixa.height) * 0.98 / cfg.n);

    const inicio = Date.now();
    const reacoes = [];
    let ganhos = 0;
    let perdas = 0;
    let empates = 0;
    let jogos = 0;
    let ocupadas = 0;
    let falhouGanhar = 0;
    let falhouTravar = 0;
    let jogadas = 0;
    let pistas = 0;

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        metricas.ronda("galo", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: ganhos,
          board: `${cfg.n}x${cfg.n}-${cfg.k}`,
          games: jogos,
          wins: ganhos,
          losses: perdas,
          draws: empates,
          moves: jogadas,
          missed_wins: falhouGanhar,
          missed_blocks: falhouTravar,
          wrong_taps: ocupadas,
          hints_needed: pistas,
          reaction_ms_median: metricas.mediana(reacoes),
          accuracy: jogadas ? Math.round((1 - (falhouGanhar + falhouTravar) / jogadas) * 100) / 100 : null,
        });
        const facil = completo && ganhos > perdas && falhouGanhar + falhouTravar <= 1;
        const dificil = completo && ganhos === 0 && perdas >= 2;
        ajustarNivel("galo", NIVEIS.length, { completo, facil, dificil });
      },
    };

    function mostrarPlacar() {
      placar.replaceChildren(
        el("div", { class: "lado-placar tu" }, [el("span", { class: "peca-mini", html: SVG_X }), el("b", {}, String(ganhos))]),
        el("div", { class: "lado-placar galo" }, [img("img/proprio/galo.svg", ""), el("b", {}, String(perdas))]),
      );
    }
    mostrarPlacar();

    const tab = el("div", { class: "galo-tab", style: { "--lado": `${lado}px`, "--n": cfg.n } });
    e.corpo.replaceChildren(el("div", { class: "galo-mesa" }, [tab]));

    await e.dizer("galo.comecar");
    if (!ativo) return;
    await e.dizer(cfg.k === 4 ? "galo.instrucao_quatro" : cfg.n > 3 ? "galo.instrucao_maior" : "galo.instrucao");
    if (!ativo) return;

    let tuComecas = true;
    while (ativo && jogos < JOGOS_PARTIDA && ganhos < 2 && perdas < 2) {
      if (jogos > 0) {
        await e.dizer("galo.proximo");
        if (!ativo) return;
      }
      const t = new Array(cfg.n * cfg.n).fill(0);
      const casas = t.map((_, i) => {
        const b = el("button", { class: "galo-casa", "aria-label": `casa ${i + 1}` });
        b.dataset.i = i;
        b.addEventListener("click", () => { if (acordar) acordar(i); });
        return b;
      });
      tab.replaceChildren(...casas);
      let vez = tuComecas ? TU : GALO;
      if (jogos > 0 || !tuComecas) {
        await e.dizer(vez === TU ? "galo.comecas" : "galo.comeca_galo");
        if (!ativo) return;
      }
      let avisou = false;
      let fim = null;

      const por = (i, quem) => {
        t[i] = quem;
        casas[i].classList.add(quem === TU ? "tu" : "galo", "nova");
        casas[i].innerHTML = quem === TU ? SVG_X : SVG_O;
        som.efeito("marcar", quem === TU ? 0.7 : 0.45);
      };

      while (ativo && !fim) {
        if (vez === TU) {
          const podiaGanhar = vitorias(t, jan, TU);
          const ameacas = vitorias(t, jan, GALO);
          if (cfg.pista && ameacas.length && !podiaGanhar.length) {
            ameacas.forEach((i) => casas[i].classList.add("pista"));
            if (!avisou) {
              avisou = true;
              pistas++;
              e.dizer("galo.cuidado");
            }
          }
          const desde = Date.now();
          let i;
          for (;;) {
            i = await new Promise((r) => { acordar = r; });
            acordar = null;
            if (!ativo || i < 0) return;
            if (!t[i]) break;
            ocupadas++;
            som.efeito("quase", 0.4);
            e.dizer("galo.ocupada");
          }
          reacoes.push(Date.now() - desde);
          jogadas++;
          if (podiaGanhar.length && !podiaGanhar.includes(i)) falhouGanhar++;
          else if (!podiaGanhar.length && ameacas.length && !ameacas.includes(i)) falhouTravar++;
          casas.forEach((c) => c.classList.remove("pista"));
          por(i, TU);
          vez = GALO;
        } else {
          await espera(650);
          if (!ativo) return;
          por(jogadaGalo(t, jan, cfg.n, cfg.ia), GALO);
          vez = TU;
        }
        fim = vencedor(t, jan) || (t.every((v) => v) ? { quem: 0, linha: [] } : null);
      }
      if (!ativo) return;
      jogos++;
      fim.linha.forEach((i) => casas[i].classList.add("linha"));
      tab.classList.add("acabou");
      if (fim.quem === TU) {
        ganhos++;
        som.efeito("linha", 0.6);
        mostrarPlacar();
        await e.dizer("galo.ganhaste", { cara: "img/noto/gato_feliz.svg" });
      } else if (fim.quem === GALO) {
        perdas++;
        som.efeito("quase", 0.4);
        mostrarPlacar();
        await e.dizer("galo.galo_ganhou");
      } else {
        empates++;
        som.efeito("par", 0.5);
        await e.dizer("galo.empate", { cara: "img/noto/gato_feliz.svg" });
      }
      if (!ativo) return;
      await espera(900);
      tab.classList.remove("acabou");
      if (!cfg.sempreTu) tuComecas = !tuComecas;
    }
    if (!ativo) return;

    const fala = ganhos > perdas ? "galo.partida_tu" : perdas > ganhos ? "galo.partida_galo" : "galo.partida_empate";
    await e.dizer(fala, { cara: "img/noto/gato_amor.svg" });
    if (!ativo) return;
    ronda.registar(true);
    ronda = null;
    const r = await premio(e, e.raiz);
    if (r === "outra") comecar();
    else terminar(true);
  }

  comecar();
  return () => terminar(false);
}
