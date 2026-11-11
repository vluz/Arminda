// Gato aventureiro: um Frogger suave. Botões grandes de seta fazem o gato saltar uma casa de cada
// vez, a atravessar estradas com carros lentos e ribeiros com troncos a flutuar, até ao seu cesto.
// Um carro ou a água têm graça, nunca são um falhanço: "Miau!", uma nuvenzinha ou um chape, e o
// gato volta de um salto ao último passeio seguro. Uma ronda é levar o gato a casa umas vezes.
// Cada travessia escolhe um dos mapas do nível (estradas e ribeiros por ordens diferentes), com os
// sentidos e as velocidades das faixas um pouco baralhados, para cada travessia parecer diferente.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel, ler, gravar } from "../estado.js";
import { el, img, ecra, premio, estilo, confetes, ALVO_MIN } from "../ui.js";

const COLS = 5;
// Faixas a contar de baixo. I: passeio de partida; P: passeio do meio; C: casa.
// E(v, n): uma estrada, v casas por segundo, n veículos; carro: "trator" (lento e comprido) ou "bicicleta".
// Rio(v, n, w): um ribeiro com n troncos de w casas; afunda: um tronco afunda-se de vez em quando;
// tartarugas: filas de tartarugas que mergulham e voltam a subir.
const I = { t: "inicio" };
const P = { t: "passeio" };
const C = { t: "casa" };
const E = (v, n, o = {}) => ({ t: "estrada", v, n, ...o });
const Rio = (v, n, w, o = {}) => ({ t: "rio", v, n, w, ...o });
const TR = { carro: "trator" };
const BI = { carro: "bicicleta" };
const AF = { afunda: true };
const TA = { tartarugas: true };
// vezes: travessias por ronda; mapas: os mapas (o mesmo número de faixas dentro de um nível);
// peixe: um peixinho para apanhar no caminho, para uma festa a mais.
// O nível 1 fica uma só estrada calma; o ribeiro entra no nível 2 (a pedido da família).
const NIVEIS = [
  { vezes: 12, mapas: [[I, E(0.5, 2), C]] },
  { vezes: 8, mapas: [
    [I, E(0.55, 2), P, Rio(0.35, 2, 3), C],
    [I, Rio(0.35, 2, 3), P, E(0.55, 2), C],
  ] },
  { vezes: 6, mapas: [
    [I, E(0.6, 2), E(0.7, 2), P, Rio(0.4, 2, 3), C],
    [I, E(0.6, 2), P, Rio(0.4, 2, 3), Rio(0.45, 2, 3), C],
    [I, Rio(0.4, 2, 3), P, E(0.6, 2), E(0.7, 2), C],
  ] },
  { vezes: 4, mapas: [
    [I, E(0.75, 2), E(0.85, 2), P, Rio(0.5, 2, 2.6), Rio(0.55, 2, 2.6), C],
    [I, E(0.75, 2), P, Rio(0.5, 2, 2.6), P, E(0.85, 2), C],
    [I, E(0.75, 2), E(0.85, 2), E(0.7, 2), P, Rio(0.5, 2, 2.6), C],
  ] },
  { vezes: 4, mapas: [
    [I, E(0.85, 2), E(0.95, 3), E(0.8, 2), P, Rio(0.6, 2, 2.2), Rio(0.65, 2, 2.2), C],
    [I, E(0.85, 2), E(0.95, 3), P, Rio(0.6, 2, 2.2), P, E(0.8, 2), C],
    [I, Rio(0.55, 2, 2.4), Rio(0.6, 2, 2.2), P, E(0.85, 2), E(0.95, 3), E(0.8, 2), C],
  ] },
  { vezes: 4, mapas: [
    [I, E(0.9, 3), E(1, 2), E(0.85, 3), P, Rio(0.65, 2, 2, AF), Rio(0.7, 2, 2, AF), C],
    [I, E(0.9, 3), P, Rio(0.65, 2, 2, AF), Rio(0.7, 2, 2), P, E(1, 2), C],
    [I, E(0.9, 3), E(1, 2), P, Rio(0.65, 2, 2, AF), Rio(0.7, 2, 2, AF), Rio(0.6, 2, 2.4), C],
  ] },
  { vezes: 4, peixe: true, mapas: [
    [I, E(0.9, 3), E(0.4, 2, TR), E(1.2, 2, BI), P, Rio(0.6, 2, 2.4), Rio(0.55, 2, 3, TA), Rio(0.7, 2, 2.2), C],
    [I, E(0.4, 2, TR), E(1, 3), P, Rio(0.6, 2, 2.4), Rio(0.55, 2, 3, TA), P, E(1.2, 2, BI), C],
    [I, Rio(0.55, 2, 2.6), Rio(0.55, 2, 3, TA), P, E(0.95, 3), E(1.2, 2, BI), E(0.4, 2, TR), P, C],
  ] },
  { vezes: 4, peixe: true, mapas: [
    [I, E(1, 3), E(0.45, 2, TR), E(1.3, 2, BI), E(0.9, 3), P, Rio(0.65, 2, 2.2, AF), Rio(0.6, 2, 3, TA), Rio(0.7, 2, 2.2), C],
    [I, E(1, 3), E(1.3, 2, BI), P, Rio(0.65, 2, 2.2, AF), Rio(0.6, 2, 3, TA), P, E(0.45, 2, TR), E(0.95, 3), C],
    [I, Rio(0.6, 2, 2.4), Rio(0.6, 2, 3, TA), Rio(0.7, 2, 2.2, AF), P, E(0.45, 2, TR), E(1, 3), E(1.3, 2, BI), P, C],
  ] },
  { vezes: 3, peixe: true, mapas: [
    [I, E(1, 3), E(0.45, 2, TR), E(1.35, 2, BI), P, Rio(0.7, 2, 2.2, AF), Rio(0.6, 2, 3, TA), Rio(0.75, 2, 2), P, E(1.05, 3), C],
    [I, E(1.05, 3), E(1.35, 2, BI), E(0.45, 2, TR), E(0.95, 3), P, Rio(0.7, 2, 2.2, AF), Rio(0.6, 2, 2, TA), Rio(0.75, 2, 2), Rio(0.65, 2, 2.4), C],
    [I, Rio(0.65, 2, 2.4), Rio(0.6, 2, 3, TA), P, E(1, 3), E(1.35, 2, BI), P, Rio(0.7, 2, 2.2, AF), Rio(0.6, 2, 2, TA), P, C],
  ] },
  // Duas travessias, não três: cada travessia de 12 faixas aqui demora duas a três vezes mais do que
  // no nível 8, por isso com três a ronda passava dos cinco minutos para quem joga mais devagar.
  { vezes: 2, peixe: true, mapas: [
    [I, E(1.05, 3), E(0.5, 2, TR), E(1.4, 2, BI), E(1, 3), P, Rio(0.7, 2, 2.2, AF), Rio(0.6, 2, 2, TA), Rio(0.7, 2, 2.2), Rio(0.65, 2, 2, TA), P, C],
    [I, E(1.05, 3), E(1.4, 2, BI), P, Rio(0.7, 2, 2.2, AF), Rio(0.6, 2, 2, TA), P, E(0.5, 2, TR), E(1.1, 3), P, Rio(0.7, 2, 2.2, AF), C],
    [I, Rio(0.65, 2, 2.4), Rio(0.6, 2, 2, TA), Rio(0.7, 2, 2.2, AF), P, E(1.05, 3), E(1.4, 2, BI), E(0.5, 2, TR), E(1, 3), P, Rio(0.65, 2, 2, TA), C],
  ] },
];
export const NIVEIS_MAX = NIVEIS.length;

const CARROS = ["img/noto/carro.svg", "img/noto/taxi.svg", "img/noto/carrinha.svg", "img/noto/autocarro.svg"];
const VEICULO = { trator: { src: "img/noto/trator.svg", w: 1.5 }, bicicleta: { src: "img/noto/bicicleta.svg", w: 1 } };
const CARA_FELIZ = "img/noto/gato_feliz.svg";
const CARA_AMOR = "img/noto/gato_amor.svg";
const SETA = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 10 L90 54 H66 V90 H34 V54 H10 Z" fill="#fff" stroke="#111" stroke-width="7" stroke-linejoin="round"/></svg>';
const SALTO_MS = 230;

const mod = (a, b) => ((a % b) + b) % b;

export function abrir(app, sair) {
  const e = ecra(() => terminar(false));
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let raf = 0;
  const temporizadores = new Set();

  function depois(ms, fn) {
    const t = setTimeout(() => { temporizadores.delete(t); if (ativo) fn(); }, ms);
    temporizadores.add(t);
  }
  const esperar = (ms) => new Promise((r) => depois(ms, r));

  function pararLaco() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    pararLaco();
    for (const t of temporizadores) clearTimeout(t);
    temporizadores.clear();
    if (!completo && ronda) ronda.registar(false);
    e.raiz.remove();
    sair();
  }

  async function comecar() {
    await estilo("gato");
    if (!ativo) return;
    const n = nivel("gato");
    const cfg = NIVEIS[n - 1];
    const R = cfg.mapas[0].length;
    const inicio = Date.now();
    const st = { travessias: 0, carros: 0, agua: 0, toques: 0, ocupado: 0, tempos: [], seguidosCarro: 0, seguidosAgua: 0,
      peixes: 0, peixesVistos: 0, mapas: new Set(), melhorSerie: 0 };

    ronda = {
      registar(completo) {
        const tropecos = st.carros + st.agua;
        metricas.ronda("gato", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: Date.now() - inicio,
          completed: completo,
          score: st.travessias,
          accuracy: st.travessias + tropecos ? Math.round((st.travessias / (st.travessias + tropecos)) * 100) / 100 : null,
          crossings: st.travessias,
          bumps: st.carros,
          splashes: st.agua,
          crossing_ms_median: metricas.mediana(st.tempos),
          taps: st.toques,
          taps_while_busy: st.ocupado,
          lanes: R,
          layouts_seen: st.mapas.size,
          fish_shown: st.peixesVistos,
          fish_caught: st.peixes,
          best_streak: st.melhorSerie,
        });
        // Regra da família: fácil = claramente fácil (no máximo um encontrão a cada quatro travessias);
        // difícil = claramente difícil demais. Uma ronda deixada a meio não muda nada.
        const facil = completo && tropecos <= Math.floor(cfg.vezes / 4);
        const dificil = completo && tropecos >= cfg.vezes * 4;
        ajustarNivel("gato", NIVEIS.length, { completo, facil, dificil });
      },
    };

    // Disposição: o tabuleiro e os botões de seta partilham o espaço; as casas e os botões ficam grandes.
    // Quando não cabem todas as faixas, o tabuleiro desliza suavemente para manter à vista o gato e a
    // faixa à frente dele.
    const caixa = e.corpo.getBoundingClientRect();
    const W = caixa.width;
    const H = caixa.height;
    const deitado = W > H * 1.15;
    const folga = Math.round(Math.max(12, Math.min(W, H) * 0.03));
    let B;
    let areaW;
    let areaH;
    if (deitado) {
      B = Math.round(Math.max(ALVO_MIN + 7, Math.min(170, H * 0.4, (H - folga) / 2)));
      areaW = W - (2 * B + folga) - folga * 2;
      areaH = H;
    } else {
      B = Math.round(Math.max(ALVO_MIN + 7, Math.min(180, (W - 2 * folga) / 3, H * 0.18)));
      areaW = W;
      areaH = H - B - folga * 2;
    }
    const maxV = Math.max(3, Math.floor(areaH / ALVO_MIN));
    const cell = Math.floor(Math.min(170, areaW / COLS, areaH / Math.min(R, maxV)));
    const V = Math.min(R, Math.floor(areaH / cell));

    const mundo = el("div", { class: "gt-mundo", style: { width: `${COLS * cell}px`, height: `${R * cell}px` } });
    // A barra de progresso fica ao longo do cimo do tabuleiro: um passo por travessia até casa.
    const barra = el("i");
    const tabuleiro = el("div", { class: "gt-tabuleiro", style: { width: `${COLS * cell}px`, height: `${V * cell}px` } },
      [mundo, el("div", { class: "gt-progresso" }, [barra])]);

    // O gato.
    const sprite = img("img/noto/gato_corpo.svg", "");
    sprite.className = "gt-sprite";
    const corpo = el("div", { class: "gt-corpo" }, [sprite]); // vira-se para onde salta; abana
    const gatoEl = el("div", { class: "gt-gato", style: { width: `${cell}px`, height: `${cell}px` } }, [corpo]);
    mundo.append(gatoEl);
    const gato = { r: 0, x: 2, estado: "espera", tronco: null, seguro: 0, salto: null, olha: -1, inicio: 0 };

    // Faixas, refeitas em cada travessia a partir de um dos mapas do nível.
    let faixas = [];
    let seguros = [0];
    let mapaAtual = -1;
    let peixe = null; // { el, faixa, obj (tronco) ou x (casa do passeio) }

    function montar(m) {
      for (const f of faixas) f.linha.remove();
      mapaAtual = m;
      st.mapas.add(m);
      const mapa = cfg.mapas[m];
      faixas = mapa.map((f, r) => {
        const linha = el("div", { class: `gt-faixa gt-${f.t}`, style: { bottom: `${r * cell}px`, height: `${cell}px` } });
        mundo.insertBefore(linha, gatoEl);
        // O nível 1 mantém os seus sentidos fixos; acima dele, os sentidos e as velocidades mudam em cada travessia.
        const dir = n === 1 ? (r % 2 ? 1 : -1) : (Math.random() < 0.5 ? 1 : -1);
        const v = n === 1 || !f.v ? f.v : f.v * (0.9 + Math.random() * 0.2);
        const faixa = { ...f, v, r, linha, objs: [], dir };
        if (f.t === "estrada" || f.t === "rio") {
          const veic = f.carro ? VEICULO[f.carro] : null;
          const w = f.t === "rio" ? f.w : veic ? veic.w : 1;
          faixa.Lp = COLS + 4;
          const passo = faixa.Lp / f.n;
          const desvio = Math.random() * faixa.Lp;
          for (let i = 0; i < f.n; i++) {
            const o = { u: desvio + i * passo + (Math.random() - 0.5) * passo * 0.25, w, x: 0, fundo: false, aviso: false };
            if (f.t === "estrada") {
              o.el = el("div", { class: `gt-carro${veic ? ` gt-${f.carro}` : ""}`, style: { width: `${w * cell}px`, height: `${cell}px` } },
                [Object.assign(img(veic ? veic.src : CARROS[(r + i) % CARROS.length], ""), { className: dir > 0 ? "dir" : "" })]);
            } else if (f.tartarugas) {
              o.el = el("div", { class: "gt-tronco gt-tartarugas", style: { width: `${w * cell}px`, height: `${cell}px` } });
              for (let k = 0; k < Math.round(w); k++) {
                o.el.append(Object.assign(img("img/noto/tartaruga.svg", ""), { className: dir > 0 ? "dir" : "", style: `width:${cell}px;height:${cell}px` }));
              }
              // Cada fila de tartarugas mergulha à vez, nunca todas ao mesmo tempo.
              o.afunda = true;
              o.periodo = 7;
              o.fase = (i * o.periodo) / f.n + Math.random() * 0.6;
            } else {
              o.el = el("div", { class: "gt-tronco", style: { width: `${w * cell}px`, height: `${cell}px` } }, [el("i")]);
              o.afunda = !!f.afunda && i === 0;
              o.periodo = 8;
              o.fase = Math.random() * 7;
            }
            linha.append(o.el);
            faixa.objs.push(o);
          }
        }
        if (f.t === "casa") {
          const cesto = img("img/noto/cesto.svg", "");
          cesto.className = "gt-cesto";
          cesto.style.width = cesto.style.height = `${Math.round(cell * 0.9)}px`;
          cesto.style.left = `${Math.round(2 * cell + cell * 0.05)}px`;
          linha.append(
            Object.assign(img("img/noto/girassol.svg", ""), { className: "gt-flor", style: `left:${Math.round(cell * 0.15)}px;width:${Math.round(cell * 0.6)}px` }),
            Object.assign(img("img/noto/tulipa.svg", ""), { className: "gt-flor", style: `left:${Math.round(cell * 4.2)}px;width:${Math.round(cell * 0.6)}px` }),
            cesto,
          );
          faixa.cesto = cesto;
        }
        return faixa;
      });
      seguros = faixas.filter((f) => f.t === "inicio" || f.t === "passeio").map((f) => f.r);
      // O peixinho: num tronco que não se afunda, senão num passeio do meio.
      peixe = null;
      if (cfg.peixe && Math.random() < 0.8) {
        const troncos = faixas.filter((f) => f.t === "rio" && !f.tartarugas).flatMap((f) => f.objs.filter((o) => !o.afunda).map((o) => ({ f, o })));
        const passeios = faixas.filter((f) => f.t === "passeio");
        const p = Object.assign(img("img/noto/peixe.svg", ""), { className: "gt-peixe" });
        p.style.width = p.style.height = `${Math.round(cell * 0.55)}px`;
        if (troncos.length && (Math.random() < 0.7 || !passeios.length)) {
          const { f, o } = troncos[Math.floor(Math.random() * troncos.length)];
          p.style.left = `${Math.round((o.w / 2 - 0.275) * cell)}px`;
          o.el.append(p);
          o.peixe = true;
          peixe = { el: p, faixa: f.r, obj: o };
        } else if (passeios.length) {
          const f = passeios[Math.floor(Math.random() * passeios.length)];
          const x = Math.random() < 0.5 ? 0 : COLS - 1;
          p.style.left = `${Math.round((x + 0.225) * cell)}px`;
          f.linha.append(p);
          peixe = { el: p, faixa: f.r, x };
        }
        if (peixe) st.peixesVistos++;
      }
      camAtual = -1;
    }

    // Botões de seta.
    function botao(classe, dr, dx) {
      const b = el("button", { class: `gt-botao ${classe}`, style: { width: `${B}px`, height: `${B}px` }, html: SETA });
      b.addEventListener("pointerdown", (ev) => { ev.preventDefault(); mexer(dr, dx); b.classList.remove("carrega"); void b.offsetWidth; b.classList.add("carrega"); });
      return b;
    }
    const cima = botao("cima", 1, 0);
    const esq = botao("esq", 0, -1);
    const dir = botao("dir", 0, 1);
    const pad = deitado
      ? el("div", { class: "gt-pad deitado", style: { width: `${2 * B + folga}px`, gap: `${folga}px` } }, [cima, el("div", { class: "gt-lados", style: { gap: `${folga}px` } }, [esq, dir])])
      : el("div", { class: "gt-pad em-pe", style: { gap: `${folga}px` } }, [esq, cima, dir]);
    if (deitado) cima.style.width = `${2 * B + folga}px`;

    const cena = el("div", { class: `gt-cena ${deitado ? "deitado" : "em-pe"}`, style: { gap: `${folga}px` } }, [tabuleiro, pad]);
    e.corpo.replaceChildren(cena);

    let camAtual = -1;
    function camara(r) {
      const b = Math.max(0, Math.min(R - V, r - 1));
      if (b === camAtual) return;
      camAtual = b;
      mundo.style.transform = `translateY(${b * cell}px)`;
    }

    function desenharGato(r, x) {
      gatoEl.style.transform = `translate3d(${x * cell}px, ${-r * cell}px, 0)`;
    }

    function pularPara(r, x, dur, fim) {
      gato.salto = { de: { r: gato.r, x: gato.x }, para: { r, x }, t0: performance.now(), dur, fim };
      gato.estado = "salto";
      gato.tronco = null;
      sprite.classList.remove("salta");
      void sprite.offsetWidth;
      sprite.style.animationDuration = `${dur}ms`;
      sprite.classList.add("salta");
      camara(r);
    }

    function mexer(dr, dx) {
      if (!ativo) return;
      st.toques++;
      if (gato.estado !== "parado") { st.ocupado++; return; }
      const r = gato.r + dr;
      let x = gato.x + dx;
      if (r >= R) return;
      const destino = faixas[r];
      if (destino.t !== "rio") x = Math.round(x);
      if (x < -0.01 || x > COLS - 0.99) { som.efeito("toque", 0.3); return; }
      x = Math.max(0, Math.min(COLS - 1, x));
      if (dx) {
        gato.olha = dx;
        corpo.classList.toggle("vira", dx > 0);
      }
      som.efeito("gato-salto", 0.5);
      pularPara(r, x, SALTO_MS, aterrar);
    }

    function troncoDebaixo(f, x) {
      const c = x + 0.5;
      return f.objs.find((o) => !o.fundo && c >= o.x + 0.05 && c <= o.x + o.w - 0.05) || null;
    }

    async function apanharPeixe() {
      const p = peixe;
      peixe = null;
      if (p.obj) p.obj.peixe = false;
      st.peixes++;
      p.el.classList.add("apanhado");
      depois(700, () => p.el.remove());
      som.efeito("vitoria2", 0.5);
      confetes(tabuleiro, 30);
      e.dizer(`gato.peixe${1 + ((st.peixes - 1) % 3)}`, { cara: CARA_AMOR });
    }

    function aterrar() {
      const f = faixas[gato.r];
      gato.estado = "parado";
      if (f.t === "inicio" || f.t === "passeio") gato.seguro = gato.r;
      if (f.t === "rio") {
        const o = troncoDebaixo(f, gato.x);
        if (!o) { tropecar("agua"); return; }
        gato.tronco = o;
        if (o.peixe && peixe) apanharPeixe();
      }
      if (peixe && !peixe.obj && peixe.faixa === gato.r && Math.round(gato.x) === peixe.x) apanharPeixe();
      if (f.t === "casa") chegar();
    }

    async function tropecar(tipo) {
      if (gato.estado === "volta") return;
      gato.estado = "volta";
      gato.tronco = null;
      const r0 = gato.r;
      const x0 = gato.x;
      if (tipo === "carro") {
        st.carros++;
        st.seguidosCarro++;
        som.efeito("gato-bump", 0.8);
      } else {
        st.agua++;
        st.seguidosAgua++;
        som.agua();
      }
      const efeito = img(tipo === "carro" ? "img/noto/poeira.svg" : "img/noto/gotas.svg", "");
      efeito.className = `gt-efeito ${tipo}`;
      // A imagem das gotas inclina-se para cima e para a direita: desviá-la para o chape ficar em cima do gato.
      Object.assign(efeito.style, { width: `${cell}px`, height: `${cell}px`,
        transform: tipo === "carro" ? `translate(${x0 * cell}px, ${-r0 * cell}px)` : `translate(${(x0 - 0.3) * cell}px, ${(-r0 + 0.3) * cell}px)` });
      mundo.append(efeito);
      depois(1300, () => efeito.remove());
      corpo.classList.add(tipo === "carro" ? "tonto" : "molhado");
      let fala;
      if (st.seguidosCarro >= 3) { fala = "gato.dica_carro"; st.seguidosCarro = 0; }
      else if (st.seguidosAgua >= 3) { fala = "gato.dica_agua"; st.seguidosAgua = 0; }
      else fala = tipo === "carro" ? `gato.miau${1 + (st.carros % 3)}` : `gato.agua${1 + (st.agua % 3)}`;
      e.dizer(fala, { cara: CARA_FELIZ });
      await esperar(800);
      if (!ativo) return;
      const destino = seguros.filter((s) => s <= r0).pop() ?? 0;
      pularPara(destino, Math.round(Math.max(0, Math.min(COLS - 1, x0))), 520, () => {
        gato.estado = "parado";
        depois(500, () => corpo.classList.remove("tonto", "molhado"));
      });
      gato.estado = "volta";
    }

    // O que o gato explica da primeira vez que cada coisa aparece numa travessia.
    const explicado = new Set();
    async function explicar() {
      const tem = (p) => faixas.some(p);
      const novidades = [
        ["estrada", tem((f) => f.t === "estrada")],
        ["ribeiro", tem((f) => f.t === "rio")],
        ["afunda", tem((f) => f.afunda)],
        ["tartarugas", tem((f) => f.tartarugas)],
        ["trator", tem((f) => f.carro === "trator")],
        ["bicicleta", tem((f) => f.carro === "bicicleta")],
        ["peixe", !!peixe],
      ];
      for (const [id, sim] of novidades) {
        if (!sim || explicado.has(id)) continue;
        explicado.add(id);
        await e.dizer(`gato.${id}`);
        if (!ativo) return;
      }
    }

    let serie = 0;
    let tropecosAntes = 0;
    let fimRonda = null;
    const acabou = new Promise((r) => { fimRonda = r; });

    async function chegar() {
      gato.estado = "casa";
      st.travessias++;
      st.tempos.push(Date.now() - gato.inicio);
      st.seguidosCarro = 0;
      st.seguidosAgua = 0;
      // Saltar para dentro do cesto.
      pularPara(gato.r, 2, 380, () => { gato.estado = "casa"; });
      gato.estado = "casa";
      await esperar(400);
      if (!ativo) return;
      sprite.classList.add("dorme");
      faixas[R - 1].cesto.classList.add("feliz");
      barra.style.transform = `scaleX(${Math.min(1, st.travessias / cfg.vezes)})`;
      // Uma travessia sem um único encontrão aumenta a série, com um som mais vivo.
      const limpa = st.carros + st.agua === tropecosAntes;
      serie = limpa ? serie + 1 : 0;
      st.melhorSerie = Math.max(st.melhorSerie, serie);
      som.efeito("vitoria2", 0.6);
      if (serie >= 2) som.efeito("gato-serie", 0.6);
      confetes(tabuleiro, serie >= 2 ? 50 : 30);
      await e.dizer(serie >= 2 ? `gato.limpo${1 + (serie % 2)}` : `gato.casa${1 + ((st.travessias - 1) % 3)}`, { cara: CARA_AMOR });
      if (!ativo) return;
      sprite.classList.remove("dorme");
      faixas[R - 1].cesto.classList.remove("feliz");
      if (st.travessias >= cfg.vezes) { fimRonda(); return; }
      await novaTravessia(true);
    }

    // Um mapa novo em cada travessia, se o nível tiver mais de um, nunca o mesmo duas vezes seguidas.
    function escolherMapa() {
      const k = cfg.mapas.length;
      if (k === 1) return 0;
      let m;
      do { m = Math.floor(Math.random() * k); } while (m === mapaAtual);
      return m;
    }

    async function novaTravessia(falar) {
      const antes = mapaAtual;
      montar(escolherMapa());
      gato.r = 0;
      gato.x = 2;
      gato.seguro = 0;
      gato.tronco = null;
      gato.salto = null;
      gato.estado = "espera";
      gatoEl.classList.add("aparece");
      depois(600, () => gatoEl.classList.remove("aparece"));
      desenharGato(0, 2);
      camara(0);
      if (falar) {
        await e.dizer(antes !== mapaAtual ? "gato.caminho" : "gato.outra");
        if (!ativo) return;
        await explicar();
        if (!ativo) return;
      }
      gato.inicio = Date.now();
      tropecosAntes = st.carros + st.agua;
      gato.estado = "parado";
    }

    // Um só ciclo move os carros e os troncos, leva o gato num tronco e confere os encontrões.
    // Só as faixas perto da câmara são desenhadas de novo: as outras só mantêm as posições em dia.
    let antes = 0;
    let tempo = 0;
    function quadro(t) {
      raf = 0;
      if (!ativo) return;
      const dt = antes ? Math.min(0.05, (t - antes) / 1000) : 0;
      antes = t;
      tempo += dt;
      const baixo = camAtual - 1;
      const alto = camAtual + V;
      for (const f of faixas) {
        if (!f.objs.length) continue;
        const ver = f.r >= baixo && f.r <= alto;
        for (const o of f.objs) {
          o.u += f.v * f.dir * dt;
          o.x = mod(o.u, f.Lp) - (f.Lp - COLS);
          if (ver) o.el.style.transform = `translate3d(${o.x * cell}px, 0, 0)`;
          if (o.afunda) {
            const p = o.periodo;
            const fase = (tempo + o.fase) % p;
            const aviso = fase > p * 0.575 && fase <= p * 0.725;
            const fundo = fase > p * 0.725 && fase < p * 0.925;
            if (aviso !== o.aviso) { o.aviso = aviso; o.el.classList.toggle("aviso", aviso); }
            if (fundo !== o.fundo) { o.fundo = fundo; o.el.classList.toggle("fundo", fundo); }
          }
        }
      }
      const f = faixas[gato.r];
      if (gato.estado === "salto" || gato.estado === "volta" || gato.estado === "casa") {
        const s = gato.salto;
        if (s) {
          const p = Math.min(1, (t - s.t0) / s.dur);
          const k = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
          desenharGato(s.de.r + (s.para.r - s.de.r) * k, s.de.x + (s.para.x - s.de.x) * k);
          if (p >= 1) {
            gato.salto = null;
            gato.r = s.para.r;
            gato.x = s.para.x;
            s.fim();
          }
        }
      } else if (gato.estado === "parado" && f) {
        if (f.t === "rio") {
          const o = gato.tronco;
          if (o) gato.x = Math.max(0, Math.min(COLS - 1, gato.x + f.v * f.dir * dt));
          if (!o || o.fundo || troncoDebaixo(f, gato.x) !== o) tropecar("agua");
        } else if (f.t === "estrada") {
          const a = gato.x + 0.22;
          const b = gato.x + 0.78;
          if (f.objs.some((o) => o.x + 0.08 < b && o.x + o.w - 0.08 > a)) tropecar("carro");
        }
        desenharGato(gato.r, gato.x);
      }
      raf = requestAnimationFrame(quadro);
    }

    montar(escolherMapa());
    desenharGato(0, 2);
    camara(0);
    raf = requestAnimationFrame(quadro);
    // A pessoa pode começar a saltar com o gato ainda a explicar.
    gato.inicio = Date.now();
    gato.estado = "parado";

    await e.dizer("gato.instrucao");
    if (!ativo) return;
    await explicar();
    if (!ativo) return;
    pad.classList.add("convida");
    depois(2500, () => pad.classList.remove("convida"));

    await acabou;
    if (!ativo) return;
    pararLaco();
    await e.dizer("gato.fim", { cara: CARA_AMOR });
    if (!ativo) return;
    // Menos encontrões por travessia do que na última ronda neste nível? Dizê-lo.
    const porTravessia = (st.carros + st.agua) / cfg.vezes;
    const ultima = ler("gato.ultima", null);
    gravar("gato.ultima", { nivel: n, porTravessia });
    if (ultima && ultima.nivel === n && porTravessia < ultima.porTravessia - 0.01) {
      await e.dizer("gato.melhor", { cara: CARA_AMOR });
      if (!ativo) return;
    }
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
