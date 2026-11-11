// Damas: damas portuguesas contra o Joaquim, um vizinho simpático.
// A pessoa toca numa das suas peças (amarelas), depois numa casa a brilhar. Quando tem de comer,
// as peças que podem comer brilham a vermelho. Tabuleiro de 6x6 em ecrãs pequenos; 8x8 nos níveis
// mais altos, onde cada casa fica com pelo menos 100 px. O tabuleiro usa a altura toda do ecrã: a
// casinha, o gato e o balão ficam numa coluna à esquerda num ecrã largo.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio, estilo } from "../ui.js";
import { inicial, jogadas, aplicar, escolher } from "./damas-regras.js";

// grande: usar 8x8 quando cabe; prof: até onde o Joaquim olha à frente; ruido: os erros dele.
const NIVEIS = [
  { grande: false, prof: 0, ruido: 0 },
  { grande: false, prof: 1, ruido: 160 },
  { grande: false, prof: 2, ruido: 60 },
  { grande: true, prof: 3, ruido: 30 },
  { grande: true, prof: 4, ruido: 10 },
  { grande: true, prof: 5, ruido: 0 },
];
const CASA_MIN = 100; // as casas do tabuleiro podem descer até 100 px (GUIA-JOGOS.md)

const COROA = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M14 74 L10 30 L32 50 L50 20 L68 50 L90 30 L86 74 Z" fill="#ffffff" stroke="#111" stroke-width="8" stroke-linejoin="round"/><rect x="14" y="74" width="72" height="12" rx="4" fill="#ffffff" stroke="#111" stroke-width="8"/></svg>`;

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
  estilo("damas");
  const placar = el("div", { class: "damas-placar" });
  const e = ecra(() => terminar(false), [placar]);
  e.raiz.classList.add("damas-ecra");
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

  async function comecar() {
    await cssPronto("damas");
    if (!ativo) return;
    const n = nivel("damas");
    const cfg = NIVEIS[n - 1];
    const caixa = e.corpo.getBoundingClientRect();
    const menor = Math.min(caixa.width, caixa.height);
    const N = cfg.grande && Math.floor(menor / 8) >= CASA_MIN ? 8 : 6;
    const lado = Math.floor(menor / N);
    const maxJogadas = N === 6 ? 70 : 100; // meias jogadas até o jogo se decidir pelo material

    let t = inicial(N);
    const inicio = Date.now();
    const reacoes = [];
    let movimentos = 0;
    let comidasTu = 0;
    let erros = 0;
    let avisos = 0;
    let resultado = null; // 1 ganhou a pessoa, -1 ganhou o Joaquim, 0 empate

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        const tuas = t.filter((v) => v > 0).length;
        const dele = t.filter((v) => v < 0).length;
        metricas.ronda("damas", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: comidasTu,
          board: N,
          result: resultado,
          moves: movimentos,
          captured: comidasTu,
          pieces_left: tuas,
          opponent_left: dele,
          wrong_taps: erros,
          capture_reminders: avisos,
          reaction_ms_median: metricas.mediana(reacoes),
          accuracy: movimentos + erros ? Math.round((movimentos / (movimentos + erros)) * 100) / 100 : null,
        });
        const facil = completo && resultado === 1 && erros <= 3;
        const dificil = completo && resultado === -1 && (tuas <= 1 || erros >= 8);
        ajustarNivel("damas", NIVEIS.length, { completo, facil, dificil });
      },
    };

    // ---- Tabuleiro ----
    const tab = el("div", { class: "damas-tab", style: { "--lado": `${lado}px`, "--n": N } });
    e.corpo.replaceChildren(el("div", { class: "damas-mesa" }, [tab]));
    const casas = [];
    for (let i = 0; i < N * N; i++) {
      const r = Math.floor(i / N);
      const c = i % N;
      if ((r + c) % 2) {
        casas.push(null);
        tab.append(el("div", { class: "damas-casa clara" }));
      } else {
        const b = el("button", { class: "damas-casa escura", "aria-label": `casa ${i}` });
        b.dataset.i = i;
        b.addEventListener("click", () => { if (acordar) acordar(i); });
        casas.push(b);
        tab.append(b);
      }
    }

    function desenhar({ nova = -1, comidas = [] } = {}) {
      casas.forEach((b, i) => {
        if (!b) return;
        const v = t[i];
        b.classList.remove("destino", "escolhida", "obrigatoria", "pode");
        if (!v) { b.replaceChildren(); return; }
        const p = el("div", {
          class: `damas-peca ${v > 0 ? "tua" : "dele"}${Math.abs(v) === 2 ? " dama" : ""}${i === nova ? " nova" : ""}${comidas.includes(i) ? " comida" : ""}`,
          html: Math.abs(v) === 2 ? COROA : "",
        });
        b.replaceChildren(p);
      });
      const tuas = t.filter((v) => v > 0).length;
      const dele = t.filter((v) => v < 0).length;
      placar.replaceChildren(
        el("div", { class: "lado-placar" }, [el("span", { class: "damas-mini tua" }), el("b", {}, String(tuas))]),
        el("div", { class: "lado-placar" }, [img("img/noto/idoso.svg", "Joaquim"), el("span", { class: "damas-mini dele" }), el("b", {}, String(dele))]),
      );
    }

    // ---- A vez da pessoa ----
    let avisouCaptura = false;
    async function vezDela() {
      const ms = jogadas(t, N, 1);
      if (!ms.length) return false;
      const captura = ms[0].comidas.length > 0;
      const deOrigens = new Set(ms.map((m) => m.de));
      const marcarOrigens = () => deOrigens.forEach((i) => casas[i].classList.add(captura ? "obrigatoria" : "pode"));
      marcarOrigens();
      if (captura && (!avisouCaptura || n <= 2)) {
        avisouCaptura = true;
        avisos++;
        e.dizer("damas.obrigatoria");
      }
      const desde = Date.now();
      let sel = -1;
      let passos = [];
      let possiveis = [];

      const mostrarDestinos = () => {
        casas.forEach((b) => b && b.classList.remove("destino", "escolhida"));
        if (sel < 0) return;
        const atual = passos.length ? passos[passos.length - 1] : sel;
        casas[atual].classList.add("escolhida");
        const prox = new Set(possiveis.map((m) => m.passos[passos.length]));
        prox.forEach((i) => casas[i].classList.add("destino"));
      };

      for (;;) {
        const i = await new Promise((r) => { acordar = r; });
        acordar = null;
        if (!ativo || i < 0) return null;
        if (sel >= 0 && possiveis.some((m) => m.passos[passos.length] === i)) {
          // Um passo da jogada.
          passos.push(i);
          possiveis = possiveis.filter((m) => m.passos[passos.length - 1] === i);
          const feito = possiveis.find((m) => m.passos.length === passos.length);
          som.efeito("marcar", 0.6);
          if (feito) {
            reacoes.push(Date.now() - desde);
            return feito;
          }
          // Uma captura em cadeia continua: mostrar a peça a caminho, com as comidas a desaparecer.
          const parcial = [...t];
          const comidas = possiveis[0].comidas.slice(0, passos.length);
          parcial[passos[passos.length - 1]] = parcial[sel];
          parcial[sel] = 0;
          const guardado = t;
          t = parcial;
          desenhar({ nova: passos[passos.length - 1], comidas });
          t = guardado;
          mostrarDestinos();
          e.dizer("damas.continua");
          continue;
        }
        if (passos.length) {
          // A meio de uma captura em cadeia só contam as casas a brilhar.
          erros++;
          som.efeito("quase", 0.4);
          e.dizer("damas.continua");
          continue;
        }
        if (t[i] > 0) {
          if (deOrigens.has(i)) {
            sel = i;
            possiveis = ms.filter((m) => m.de === i);
            som.efeito("toque", 0.5);
            mostrarDestinos();
          } else {
            erros++;
            som.efeito("quase", 0.4);
            e.dizer(captura ? "damas.obrigatoria" : "damas.nao_pode");
          }
          continue;
        }
        erros++;
        som.efeito("quase", 0.4);
        if (sel >= 0) e.dizer("damas.outra_casa");
        else e.dizer("damas.instrucao");
      }
    }

    // Faz uma jogada passo a passo, para a pessoa a conseguir seguir.
    async function mostrarJogada(m) {
      const v = t[m.de];
      let onde = m.de;
      const base = [...t];
      for (let k = 0; k < m.passos.length; k++) {
        const b = [...base];
        b[m.de] = 0;
        b[m.passos[k]] = v;
        t = b;
        desenhar({ nova: m.passos[k], comidas: m.comidas.slice(0, k + 1) });
        onde = m.passos[k];
        som.efeito("marcar", 0.5);
        if (k < m.passos.length - 1) await espera(550);
        if (!ativo) return;
      }
      t = base;
      return onde;
    }

    desenhar();
    await e.dizer("damas.comecar");
    if (!ativo) return;
    await e.dizer("damas.instrucao");
    if (!ativo) return;

    let meias = 0;
    let semAvanco = 0; // jogadas de dama seguidas sem captura e sem mexer uma pedra
    let dissePrimeiraDama = false;
    while (ativo) {
      // A jogada da pessoa.
      const m = await vezDela();
      if (!ativo) return;
      if (!m) { resultado = -1; break; }
      movimentos++;
      const eraHomem = Math.abs(t[m.de]) === 1;
      t = aplicar(t, N, m);
      desenhar({ nova: m.passos[m.passos.length - 1] });
      meias++;
      semAvanco = m.comidas.length || eraHomem ? 0 : semAvanco + 1;
      const virouDama = eraHomem && t[m.passos[m.passos.length - 1]] === 2;
      if (m.comidas.length) {
        comidasTu += m.comidas.length;
        som.efeito("par", 0.6);
        await e.dizer(m.comidas.length > 1 ? "damas.comeste_varias" : "damas.comeste", { cara: "img/noto/gato_feliz.svg" });
        if (!ativo) return;
      }
      if (virouDama) {
        som.efeito("linha", 0.6);
        await e.dizer("damas.dama", { cara: "img/noto/gato_feliz.svg" });
        if (!ativo) return;
        if (!dissePrimeiraDama) {
          dissePrimeiraDama = true;
          await e.dizer("damas.dama_anda");
          if (!ativo) return;
        }
      } else if (!m.comidas.length && Math.random() < 0.15) {
        e.dizer(som.elogio(), { cara: "img/noto/gato_feliz.svg" });
      }
      if (!t.some((v) => v < 0) || !jogadas(t, N, -1).length) { resultado = 1; break; }
      if (meias >= maxJogadas || semAvanco >= 40) break;

      // A jogada do Joaquim.
      await espera(500);
      if (!ativo) return;
      if (meias <= 2) {
        await e.dizer("damas.vez_joaquim");
        if (!ativo) return;
      }
      await espera(400);
      const j = escolher(t, N, cfg.prof, cfg.ruido);
      if (!ativo) return;
      if (!j) { resultado = 1; break; }
      const homemDele = Math.abs(t[j.de]) === 1;
      await mostrarJogada(j);
      if (!ativo) return;
      t = aplicar(t, N, j);
      desenhar({ nova: j.passos[j.passos.length - 1] });
      meias++;
      semAvanco = j.comidas.length || homemDele ? 0 : semAvanco + 1;
      if (j.comidas.length) {
        som.efeito("quase", 0.35);
        await e.dizer("damas.comeu");
        if (!ativo) return;
      }
      if (homemDele && t[j.passos[j.passos.length - 1]] === -2) {
        await e.dizer("damas.dama_dele");
        if (!ativo) return;
      }
      if (!t.some((v) => v > 0)) { resultado = -1; break; }
      if (meias >= maxJogadas || semAvanco >= 40) break;
    }
    if (!ativo) return;

    if (resultado === null) {
      // Um jogo comprido decide-se com bondade pelo material: uma dama conta por duas.
      const valor = (s) => t.reduce((a, v) => a + (Math.sign(v) === s ? Math.abs(v) : 0), 0);
      const d = valor(1) - valor(-1);
      resultado = d > 0 ? 1 : d < 0 ? -1 : 0;
    }
    casas.forEach((b) => b && b.classList.remove("destino", "escolhida", "obrigatoria", "pode"));
    if (resultado === 1) {
      som.efeito("vitoria2", 0.6);
      await e.dizer("damas.ganhaste", { cara: "img/noto/gato_amor.svg" });
    } else if (resultado === -1) {
      await e.dizer("damas.ganhou", { cara: "img/noto/gato_amor.svg" });
    } else {
      await e.dizer("damas.empate", { cara: "img/noto/gato_amor.svg" });
    }
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
