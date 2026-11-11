// Saltos: um jogo de corrida muito simples, visto de lado. O coelho corre sozinho; pelo chão vêm
// pedras e troncos (salta-se por cima com "Salta") e à altura da cabeça vêm ramos e pássaros
// (passa-se por baixo com "Baixa"). Dois botões enormes, e um toque na metade de cima ou de baixo
// do cenário faz o mesmo. Um encontrão só faz o coelho tropeçar e abrandar um instante, com um som
// suave: sem vidas, sem fim de jogo. Uma ronda é uma distância fixa (60 a 90 s) com uma barra de
// progresso até à bandeira da meta. A velocidade sobe dentro da ronda e de nível para nível; os
// níveis de topo trazem pares de obstáculos juntos, pássaros que voam contra o coelho, e moedas
// para apanhar a saltar.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel, ler, gravar } from "../estado.js";
import { el, img, ecra, premio, estilo, confetes, ALVO_MIN } from "../ui.js";

// v0: velocidade de partida em unidades por segundo (uma unidade é um décimo da largura do cenário);
// ramp: quanto mais rápido fica até à meta (0.2 = 20%); seg: duração pretendida da ronda em segundos;
// gap: segundos, em média, entre obstáculos; tipos: os tipos que aparecem; par: probabilidade de um
// obstáculo vir com outro logo atrás, parGap segundos depois; moedas: probabilidade de uma moeda;
// voa: os pássaros voam contra o coelho com esta velocidade a mais.
const BAIXOS = ["pedra", "tronco"];
const NIVEIS = [
  { v0: 2.6, ramp: 0.15, seg: 60, gap: 3.4, tipos: BAIXOS },
  { v0: 2.8, ramp: 0.18, seg: 65, gap: 3.1, tipos: [...BAIXOS, "ramo"] },
  { v0: 3.1, ramp: 0.2, seg: 70, gap: 2.8, tipos: [...BAIXOS, "ramo", "passaro"] },
  { v0: 3.4, ramp: 0.22, seg: 70, gap: 2.5, tipos: [...BAIXOS, "ramo", "passaro"] },
  { v0: 3.7, ramp: 0.25, seg: 75, gap: 2.3, tipos: [...BAIXOS, "ramo", "passaro"], moedas: 0.35 },
  { v0: 4.0, ramp: 0.25, seg: 75, gap: 2.1, tipos: [...BAIXOS, "ramo", "passaro"], moedas: 0.35, par: 0.25, parGap: 1.3 },
  { v0: 4.3, ramp: 0.28, seg: 80, gap: 1.95, tipos: [...BAIXOS, "ramo", "passaro"], moedas: 0.4, par: 0.35, parGap: 1.2, voa: 0.6 },
  { v0: 4.6, ramp: 0.3, seg: 80, gap: 1.8, tipos: [...BAIXOS, "ramo", "passaro"], moedas: 0.4, par: 0.45, parGap: 1.1, voa: 0.8 },
  { v0: 4.9, ramp: 0.3, seg: 85, gap: 1.65, tipos: [...BAIXOS, "ramo", "passaro"], moedas: 0.45, par: 0.5, parGap: 1, voa: 1 },
  { v0: 5.2, ramp: 0.32, seg: 90, gap: 1.5, tipos: [...BAIXOS, "ramo", "passaro"], moedas: 0.5, par: 0.55, parGap: 0.95, voa: 1.2 },
];
export const NIVEIS_MAX = NIVEIS.length;

// Os tamanhos são em alturas de coelho (R). w, h: tamanho desenhado; alto: tipo por baixo do qual
// se passa, com a imagem a descer até fundo da sua altura (o resto é margem vazia na imagem).
const TIPOS = {
  pedra: { src: "img/noto/pedra.svg", w: 0.8, h: 0.62 },
  tronco: { src: "img/noto/tronco.svg", w: 0.7, h: 0.78 },
  ramo: { src: "img/jogos/saltos-ramo.svg", w: 1.6, h: 1, alto: true, fundo: 0.8 },
  passaro: { src: "img/noto/passaro.svg", w: 0.85, h: 0.66, alto: true, fundo: 0.85 },
};
const CARA_FELIZ = "img/noto/gato_feliz.svg";
const CARA_AMOR = "img/noto/gato_amor.svg";
const SETA = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 10 L90 54 H66 V90 H34 V54 H10 Z" fill="#fff" stroke="#111" stroke-width="7" stroke-linejoin="round"/></svg>';
const SALTO_U = 3.5;    // um salto cobre este número de unidades de chão, seja qual for a velocidade
const BAIXO_U = 3.6;    // baixar-se também
const ALTURA = 1.3;     // altura do salto, em alturas de coelho
const ESPACO_ALTO = 0.6; // um ramo ou um pássaro deixa este espaço acima do chão (em alturas de coelho)
const AGACHADO = 0.45;  // altura de um coelho baixado
const DESCE_S = 0.15;   // "Baixa" no ar: volta ao chão assim depressa, e depois baixa-se
const TROPECA_S = 0.8;  // segundos a abrandar depois de um encontrão
const LENTO = 0.4;      // velocidade a tropeçar

const sortear = (a) => a[Math.floor(Math.random() * a.length)];

export function abrir(app, sair) {
  const e = ecra(() => terminar(false));
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let raf = 0;
  let pausado = false;
  let correndo = false;
  let retomar = null;
  const temporizadores = new Set();

  function depois(ms, fn) {
    const t = setTimeout(() => { temporizadores.delete(t); if (ativo) fn(); }, ms);
    temporizadores.add(t);
  }

  function pararLaco() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // Ecrã apagado ou app escondida: a corrida fica parada e continua de onde estava.
  function visibilidade() {
    if (document.visibilityState === "hidden") {
      if (raf) { pararLaco(); pausado = true; }
    } else if (pausado && correndo && ativo && retomar) {
      pausado = false;
      raf = requestAnimationFrame(retomar);
    }
  }
  document.addEventListener("visibilitychange", visibilidade);

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    correndo = false;
    pararLaco();
    document.removeEventListener("visibilitychange", visibilidade);
    for (const t of temporizadores) clearTimeout(t);
    temporizadores.clear();
    if (!completo && ronda) ronda.registar(false);
    e.raiz.remove();
    sair();
  }

  async function comecar() {
    await estilo("saltos");
    if (!ativo) return;
    const n = nivel("saltos");
    const cfg = NIVEIS[n - 1];
    const inicio = Date.now();
    const st = {
      obstaculos: 0, passados: 0, toques: 0, toquesBaixo: 0, toquesAlto: 0,
      moedas: 0, moedasVistas: 0, carregos: 0, errados: 0, reacoes: [],
      seguidos: 0, melhor: 0, seguidosBaixo: 0, seguidosAlto: 0, vMax: 0,
    };
    const ultimo = ler("saltos.ultimo", 0);

    ronda = {
      registar(completo) {
        const total = st.passados + st.toques;
        const acerto = total ? st.passados / total : null;
        metricas.ronda("saltos", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: Date.now() - inicio,
          completed: completo,
          score: st.passados + st.moedas,
          accuracy: acerto === null ? null : Math.round(acerto * 100) / 100,
          obstacles: st.obstaculos,
          clears: st.passados,
          hits: st.toques,
          hits_low: st.toquesBaixo,
          hits_high: st.toquesAlto,
          coins: st.moedas,
          coins_shown: st.moedasVistas,
          presses: st.carregos,
          wrong_presses: st.errados,
          reaction_ms_median: metricas.mediana(st.reacoes),
          best_streak: st.melhor,
          speed_start: cfg.v0,
          speed_max: Math.round(st.vMax * 100) / 100,
        });
        // Fácil: quase todos os obstáculos passados. Difícil: encontrões em metade deles ou mais.
        const facil = completo && (acerto ?? 0) >= 0.9;
        const dificil = completo && (acerto ?? 1) < 0.5;
        ajustarNivel("saltos", NIVEIS.length, { completo, facil, dificil });
      },
    };

    // Disposição: o cenário e dois botões grandes, à direita (deitado) ou por baixo (ao alto).
    const caixa = e.corpo.getBoundingClientRect();
    const W = caixa.width;
    const H = caixa.height;
    const deitado = W > H;
    const folga = Math.round(Math.max(8, Math.min(W, H) * 0.02));
    let cenaW;
    let cenaH;
    let botaoW;
    let botaoH;
    if (deitado) {
      botaoW = Math.round(Math.max(ALVO_MIN + 27, Math.min(220, W * 0.2)));
      botaoH = Math.round((H - folga) / 2);
      cenaW = W - botaoW - folga;
      cenaH = H;
    } else {
      botaoH = Math.round(Math.max(ALVO_MIN + 27, Math.min(220, H * 0.17)));
      botaoW = Math.round((W - folga) / 2);
      cenaW = W;
      // Um cenário alto seria quase só céu: mantê-lo mais perto da forma deitada.
      cenaH = Math.min(H - botaoH - folga, Math.round(W * 0.95));
    }
    const U = cenaW / 10;                                    // px por unidade
    const R = Math.round(Math.min(U * (deitado ? 1.35 : 1.5), cenaH * 0.26)); // tamanho do coelho
    const chaoY = Math.round(cenaH * 0.84);                  // linha do chão, a contar de cima
    const coelhoX = Math.round(U * 2.2);                     // centro do coelho, a contar da esquerda

    // Cenário: céu, nuvens, montes, o chão a deslizar, barra de progresso, contadores.
    const mundo = el("div", { class: "sl-mundo" });
    const chaoTira = el("div", { class: "sl-chao", style: { top: `${chaoY}px`, width: `${cenaW + 400}px` } });
    const montes = el("div", { class: "sl-montes", style: { top: `${chaoY - R * 0.9}px`, height: `${R * 0.9}px`, width: `${cenaW + 600}px` } });
    const nuvens = [0, 1, 2].map((i) => {
      const nv = Object.assign(img("img/noto/nuvem.svg", ""), { className: "sl-nuvem" });
      nv.style.width = `${Math.round(R * (1 + i * 0.25))}px`;
      nv.style.top = `${Math.round(cenaH * (0.12 + i * 0.1))}px`;
      return { el: nv, x: (i + 0.3) * cenaW / 3 };
    });
    const figura = Object.assign(img("img/noto/coelho.svg", ""), { className: "sl-corre" });
    const pose = el("div", { class: "sl-pose" }, [figura]);
    const coelho = el("div", { class: "sl-coelho", style: { width: `${R}px`, height: `${R}px`, left: `${coelhoX - R / 2}px`, top: `${chaoY - R}px` } }, [pose]);
    const marca = Object.assign(img("img/noto/coelho.svg", ""), { className: "sl-marca" });
    const progresso = el("div", { class: "sl-progresso" }, [el("i"), el("b"), marca,
      Object.assign(img("img/noto/bandeira_xadrez.svg", ""), { className: "sl-bandeira" })]);
    const enchido = progresso.querySelector("b");
    const contaMoedas = el("b", {}, "0");
    const moedasCaixa = el("div", { class: "sl-moedas" }, [img("img/noto/moeda.svg", ""), contaMoedas]);
    const sequencia = el("div", { class: "sl-seq" });
    const cena = el("div", { class: "sl-cena", style: { width: `${cenaW}px`, height: `${cenaH}px` } },
      [...nuvens.map((c) => c.el), montes, chaoTira, mundo, coelho, progresso, sequencia]);
    if (cfg.moedas) cena.append(moedasCaixa);

    const botaoSalta = el("button", { class: "sl-botao salta", style: { width: `${botaoW}px`, height: `${botaoH}px` }, html: `${SETA}<span>Salta</span>` });
    const botaoBaixa = el("button", { class: "sl-botao baixa", style: { width: `${botaoW}px`, height: `${botaoH}px` }, html: `${SETA}<span>Baixa</span>` });
    const botoes = el("div", { class: `sl-botoes ${deitado ? "deitado" : "em-pe"}`, style: { gap: `${folga}px` } },
      deitado ? [botaoSalta, botaoBaixa] : [botaoBaixa, botaoSalta]);
    const raiz = el("div", { class: `sl-raiz ${deitado ? "deitado" : "em-pe"}`, style: { gap: `${folga}px` } }, [cena, botoes]);
    e.corpo.replaceChildren(raiz);
    const progressoW = () => progresso.getBoundingClientRect().width;
    let barraW = progressoW();

    // ----- O percurso -----
    const media = cfg.v0 * (1 + cfg.ramp / 2);
    const L = Math.round(media * cfg.seg);   // linha da meta, em unidades
    const velocidade = (s) => cfg.v0 * (1 + cfg.ramp * Math.max(0, Math.min(1, s / L)));
    const objs = [];   // { tipo, s, el, w, h, y, estado, alto, moeda, tAp, agiu }
    function novo(tipo, s) {
      const t = TIPOS[tipo];
      const w = Math.round(t.w * R);
      const h = Math.round(t.h * R);
      // As coisas do chão assentam no chão; os ramos ficam pendurados acima do espaço deixado para um
      // coelho baixado; os pássaros voam à altura da cabeça do coelho.
      const y = t.alto ? chaoY - ESPACO_ALTO * R - h * t.fundo : chaoY - h;
      const o = { tipo, s, w, h, y, alto: !!t.alto, estado: "vem", ve: false, tAp: 0, vs: tipo === "passaro" ? cfg.voa || 0 : 0 };
      o.el = el("div", { class: `sl-obj sl-${tipo}`, style: { width: `${w}px`, height: `${h}px`, top: `${y}px`, visibility: "hidden" } },
        [Object.assign(img(t.src, ""), { className: "sl-img" })]);
      mundo.append(o.el);
      objs.push(o);
      return o;
    }
    function moeda(s, altura) {
      const m = Math.round(R * 0.55);
      const o = { tipo: "moeda", s, w: m, h: m, y: chaoY - altura - m / 2, moeda: true, estado: "vem", ve: false, vs: 0 };
      o.el = el("div", { class: "sl-obj sl-moeda", style: { width: `${m}px`, height: `${m}px`, top: `${o.y}px`, visibility: "hidden" } },
        [Object.assign(img("img/noto/moeda.svg", ""), { className: "sl-img" })]);
      mundo.append(o.el);
      objs.push(o);
      st.moedasVistas++;
    }
    // O primeiro obstáculo vem ao fim de uns segundos de corrida; nenhum no último troço.
    let s = cfg.v0 * 3.5;
    let ultimoTipo = null;
    while (s < L - 4) {
      const tipo = sortear(cfg.tipos.filter((t) => t !== ultimoTipo || Math.random() < 0.4));
      ultimoTipo = tipo;
      novo(tipo, s);
      st.obstaculos++;
      const v = velocidade(s);
      // Uma moeda: por cima de um obstáculo do chão (apanha-se ao saltar por cima) ou sozinha no ar.
      if (cfg.moedas && Math.random() < cfg.moedas) {
        if (!TIPOS[tipo].alto) moeda(s, ALTURA * R * 0.85 + R * 0.5);
        else moeda(s + v * cfg.gap * 0.5, ALTURA * R * 0.85 + R * 0.5);
      }
      if (cfg.par && Math.random() < cfg.par && s + v * cfg.parGap < L - 4) {
        s += v * cfg.parGap;
        const t2 = sortear(cfg.tipos);
        novo(t2, s);
        st.obstaculos++;
        ultimoTipo = t2;
      }
      s += velocidade(s) * cfg.gap * (0.85 + Math.random() * 0.45);
    }
    const meta = el("div", { class: "sl-obj sl-meta", style: { width: `${Math.round(R * 0.35)}px`, height: `${chaoY}px`, top: "0", visibility: "hidden" } });
    const bandeira = Object.assign(img("img/noto/bandeira_xadrez.svg", ""), { className: "sl-bandeira-meta" });
    bandeira.style.width = bandeira.style.height = `${Math.round(R * 1.2)}px`;
    meta.append(bandeira);
    mundo.append(meta);
    const metaObj = { s: L, w: Math.round(R * 0.35), el: meta, ve: false, fixo: true };

    // ----- O coelho -----
    const coelhoEstado = { pos: 0, salto: 0, baixo: 0, desce: 0, desceH: 0, lentoAte: 0 }; // salto/baixo/desce: segundos que faltam
    let tempo = 0;
    let saltoDur = 1;
    let baixoDur = 1;

    function realcar(b) {
      b.classList.remove("carrega");
      void b.offsetWidth;
      b.classList.add("carrega");
    }

    // O próximo obstáculo ainda à frente do coelho, por que ele ainda não passou.
    function proximo() {
      let melhor = null;
      for (const o of objs) {
        if (o.moeda || o.estado !== "vem") continue;
        if (!melhor || o.s < melhor.s) melhor = o;
      }
      return melhor;
    }

    function registarAcao(alto) {
      st.carregos++;
      const o = proximo();
      if (!o || !o.ve) return;
      if (o.alto === alto) {
        if (!o.agiu) { o.agiu = true; st.reacoes.push(Math.round((tempo - o.tAp) * 1000)); }
      } else if ((o.s - coelhoEstado.pos) < 4) {
        st.errados++;
      }
    }

    function saltar() {
      if (!correndo) return;
      realcar(botaoSalta);
      registarAcao(false);
      if (coelhoEstado.salto > 0) return;
      coelhoEstado.baixo = 0;
      coelhoEstado.desce = 0;
      pose.classList.remove("baixo");
      saltoDur = SALTO_U / velocidade(coelhoEstado.pos);
      coelhoEstado.salto = saltoDur;
      som.efeito("saltos-salta", 0.4);
    }
    function baixar() {
      if (!correndo) return;
      realcar(botaoBaixa);
      registarAcao(true);
      // No ar: descer depressa, depois baixar-se.
      const ce = coelhoEstado;
      if (ce.salto > 0) {
        const p = 1 - ce.salto / saltoDur;
        ce.desceH = ALTURA * R * 4 * p * (1 - p);
        ce.desce = DESCE_S;
        ce.salto = 0;
      }
      if (coelhoEstado.baixo > 0) { coelhoEstado.baixo = Math.max(coelhoEstado.baixo, baixoDur * 0.5); return; }
      baixoDur = BAIXO_U / velocidade(coelhoEstado.pos);
      coelhoEstado.baixo = baixoDur;
      pose.classList.add("baixo");
      som.efeito("saltos-baixa", 0.4);
    }
    for (const [b, fn] of [[botaoSalta, saltar], [botaoBaixa, baixar]]) {
      b.addEventListener("pointerdown", (ev) => { ev.preventDefault(); fn(); });
    }
    // Toques no cenário: a metade de cima salta, a de baixo baixa.
    cena.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      const r = cena.getBoundingClientRect();
      if (ev.clientY - r.top < r.height / 2) saltar();
      else baixar();
    });

    let ultimaFala = 0;
    function comentar(id, cara) {
      if (Date.now() - ultimaFala < 3000) return;
      ultimaFala = Date.now();
      e.dizer(id, { cara });
    }

    function mostrarSequencia() {
      if (st.seguidos >= 3) {
        sequencia.textContent = `×${st.seguidos}`;
        sequencia.classList.remove("pop");
        void sequencia.offsetWidth;
        sequencia.classList.add("pop", "ve");
      } else sequencia.classList.remove("ve");
    }

    function passou(o) {
      o.estado = "passou";
      st.passados++;
      st.seguidos++;
      st.melhor = Math.max(st.melhor, st.seguidos);
      if (o.alto) st.seguidosAlto = 0;
      else st.seguidosBaixo = 0;
      if (st.seguidos >= 3) som.efeito(`saltos-n${Math.min(5, st.seguidos - 2)}`, 0.45);
      mostrarSequencia();
      if (st.seguidos % 10 === 0) { ultimaFala = 0; comentar(som.elogio(), CARA_AMOR); }
      else if (st.seguidos === 5) comentar("saltos.seguidos", CARA_FELIZ);
    }

    function bateu(o) {
      o.estado = "bateu";
      st.toques++;
      st.seguidos = 0;
      mostrarSequencia();
      if (o.alto) { st.toquesAlto++; st.seguidosAlto++; } else { st.toquesBaixo++; st.seguidosBaixo++; }
      coelhoEstado.lentoAte = tempo + TROPECA_S;
      coelhoEstado.baixo = 0;
      pose.classList.remove("baixo", "tropeca");
      void pose.offsetWidth;
      pose.classList.add("tropeca");
      depois(TROPECA_S * 1000, () => pose.classList.remove("tropeca"));
      o.el.classList.add("caiu");
      som.efeito("saltos-bump", 0.6);
      if (st.seguidosBaixo >= 3) { st.seguidosBaixo = 0; ultimaFala = 0; comentar("saltos.dica_salta"); }
      else if (st.seguidosAlto >= 3) { st.seguidosAlto = 0; ultimaFala = 0; comentar("saltos.dica_baixa"); }
      else if (Math.random() < 0.5) comentar(`saltos.ui${1 + (st.toques % 3)}`, CARA_FELIZ);
    }

    function apanhou(o) {
      o.estado = "apanhada";
      st.moedas++;
      contaMoedas.textContent = String(st.moedas);
      o.el.classList.add("apanhada");
      moedasCaixa.classList.remove("recebe");
      void moedasCaixa.offsetWidth;
      moedasCaixa.classList.add("recebe");
      som.efeito("saltos-moeda", 0.6);
      if (st.moedas === 1 || st.moedas % 5 === 0) comentar(st.moedas === 1 ? "saltos.moeda1" : "saltos.moeda2", CARA_AMOR);
    }

    let fimRonda = null;
    const acabou = new Promise((r) => { fimRonda = r; });
    let metadeDita = false;
    let retaDita = false;
    let antes = 0;

    function quadro(t) {
      raf = 0;
      if (!ativo || !correndo) return;
      const dt = antes ? Math.min(0.05, (t - antes) / 1000) : 0;
      antes = t;
      tempo += dt;
      const ce = coelhoEstado;
      const vBase = velocidade(ce.pos);
      st.vMax = Math.max(st.vMax, vBase);
      const v = tempo < ce.lentoAte ? vBase * LENTO : vBase;
      ce.pos += v * dt;

      // O corpo do coelho: altura dos pés acima do chão, e a altura dele.
      let alturaPes = 0;
      if (ce.salto > 0) {
        ce.salto = Math.max(0, ce.salto - dt);
        const p = 1 - ce.salto / saltoDur;
        alturaPes = ALTURA * R * 4 * p * (1 - p);
      } else if (ce.desce > 0) {
        ce.desce = Math.max(0, ce.desce - dt);
        alturaPes = ce.desceH * (ce.desce / DESCE_S);
      }
      if (ce.baixo > 0) {
        ce.baixo = Math.max(0, ce.baixo - dt);
        if (ce.baixo === 0) pose.classList.remove("baixo");
      }
      const altura = ce.baixo > 0 && alturaPes === 0 ? AGACHADO * R : 0.95 * R;
      coelho.style.transform = `translate3d(0, ${-Math.round(alturaPes)}px, 0)`;
      const pesY = chaoY - alturaPes;
      const cabecaY = pesY - altura;
      const esq = coelhoX - R * 0.22;
      const dir = coelhoX + R * 0.22;

      for (const o of objs) {
        if (o.estado === "fora") continue;
        if (o.vs) o.s -= o.vs * dt;
        const x = coelhoX + (o.s - ce.pos) * U - o.w / 2;
        const ve = x < cenaW + 4 && x + o.w > -4;
        if (ve !== o.ve) {
          o.ve = ve;
          o.el.style.visibility = ve ? "" : "hidden";
          if (ve && !o.tAp) o.tAp = tempo;
          if (!ve && x < 0) { o.estado = o.estado === "vem" && !o.moeda ? o.estado : "fora"; }
        }
        if (ve) o.el.style.transform = `translate3d(${Math.round(x)}px, 0, 0)`;
        if (o.estado !== "vem") continue;
        // Caixas de choque tolerantes: metade da largura do obstáculo, os 70% de baixo de um obstáculo do chão.
        const oe = x + o.w * 0.25;
        const od = x + o.w * 0.75;
        if (od < esq) {
          if (o.moeda) o.estado = "fora";
          else passou(o);
          continue;
        }
        if (oe > dir) continue;
        if (o.moeda) {
          const my = o.y + o.h / 2;
          if (my > cabecaY - o.h * 0.3 && my < pesY + o.h * 0.3) apanhou(o);
        } else if (o.alto) {
          if (cabecaY < chaoY - (ESPACO_ALTO + 0.03) * R) bateu(o);
        } else if (pesY > chaoY - o.h * 0.7) {
          bateu(o);
        }
      }
      // A bandeira da meta, o chão e os montes deslizam; as nuvens passam devagar.
      const mx = coelhoX + (L - ce.pos) * U;
      const mve = mx < cenaW + 4 && mx > -metaObj.w - 4;
      if (mve !== metaObj.ve) { metaObj.ve = mve; meta.style.visibility = mve ? "" : "hidden"; }
      if (mve) meta.style.transform = `translate3d(${Math.round(mx)}px, 0, 0)`;
      chaoTira.style.transform = `translate3d(${-Math.round((ce.pos * U) % 200)}px, 0, 0)`;
      montes.style.transform = `translate3d(${-Math.round((ce.pos * U * 0.3) % 300)}px, 0, 0)`;
      for (const c of nuvens) {
        const cx = ((c.x - ce.pos * U * 0.08) % (cenaW + 200) + cenaW + 200) % (cenaW + 200) - 150;
        c.el.style.transform = `translate3d(${Math.round(cx)}px, 0, 0)`;
      }
      const p = Math.min(1, ce.pos / L);
      enchido.style.transform = `scaleX(${p.toFixed(3)})`;
      marca.style.transform = `translate3d(${Math.round(p * (barraW - marca.offsetWidth * 1.4))}px, 0, 0)`;
      if (!metadeDita && p >= 0.5) { metadeDita = true; ultimaFala = 0; comentar("saltos.metade"); }
      if (!retaDita && p >= 0.85) { retaDita = true; ultimaFala = 0; comentar("saltos.quase"); }

      if (ce.pos >= L + 1.5) {
        correndo = false;
        fimRonda();
        return;
      }
      raf = requestAnimationFrame(quadro);
    }
    retomar = (t) => { antes = 0; quadro(t); };

    // ----- A ronda -----
    // Desenhar a primeira imagem (só as posições), depois esperar pelas instruções.
    pose.classList.add("parado");
    correndo = true;
    antes = 0;
    quadro(performance.now());
    pararLaco();
    correndo = false;

    await e.dizer("saltos.instrucao");
    if (!ativo) return;
    if (cfg.tipos.includes("ramo")) { await e.dizer("saltos.instrucao_baixa"); if (!ativo) return; }
    if (cfg.tipos.includes("passaro")) { await e.dizer("saltos.passaro"); if (!ativo) return; }
    if (cfg.moedas) { await e.dizer("saltos.moedas"); if (!ativo) return; }
    if (cfg.par) { await e.dizer("saltos.pares"); if (!ativo) return; }
    await e.dizer("saltos.partida");
    if (!ativo) return;
    pose.classList.remove("parado");
    barraW = progressoW();
    correndo = true;
    antes = 0;
    raf = requestAnimationFrame(quadro);
    botoes.classList.add("convida");
    depois(2500, () => botoes.classList.remove("convida"));

    await acabou;
    if (!ativo) return;
    pararLaco();
    pose.classList.add("parado", "festa");
    som.efeito("vitoria2", 0.6);
    confetes(cena, 40);
    const pontos = st.passados + st.moedas;
    await e.dizer("saltos.fim", { cara: CARA_AMOR });
    if (!ativo) return;
    if (ultimo > 0 && pontos > ultimo) {
      await e.dizer("saltos.recorde", { cara: CARA_AMOR });
      if (!ativo) return;
    }
    gravar("saltos.ultimo", pontos);
    ronda.registar(true);
    ronda = null;
    const r = await premio(e, e.raiz);
    if (!ativo) return;
    if (r === "outra") comecar();
    else terminar(true);
  }

  comecar();
  return () => terminar(false);
}
