// Aquário: um ecrã calmo para os dias difíceis. Os peixes nadam devagar; um toque na água faz uma
// onda e deixa cair comida, e os peixes mais próximos vêm comer. De vez em quando uma bolha ou um
// cavalo-marinho para tocar. Sem níveis, sem objetivos, nada onde falhar. Ao fim de cerca de
// quatro minutos, um azulejo por visita.
// O movimento são transições CSS apontadas de novo por temporizadores ocasionais: não corre nenhum
// ciclo de animação em JavaScript.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { ajustarNivel } from "../estado.js";
import { el, img, ecra, premio, estilo } from "../ui.js";

export const NIVEIS_MAX = 1;

// As imagens olham para a direita, a não ser que `esquerda` diga que o desenho olha para a esquerda.
const PEIXES = [
  { src: "img/jogos/aquario-peixe1.svg", tam: 1 },
  { src: "img/noto/peixe_tropical.svg", tam: 1 },
  { src: "img/jogos/aquario-peixe2.svg", tam: 0.9 },
  { src: "img/noto/peixe.svg", tam: 0.95, esquerda: true },
  { src: "img/jogos/aquario-peixe3.svg", tam: 1.05 },
  { src: "img/noto/baiacu.svg", tam: 0.85, esquerda: true },
];

const PREMIO_MS = 4 * 60 * 1000;
const QUEDA_MS = 5000;      // tempo que a comida leva a afundar
const MAX_COMIDA = 9;       // bolinhas de comida na água de cada vez

const aoCalhas = (a, b) => a + Math.random() * (b - a);

// Os tamanhos leem-se na folha de estilos do jogo, por isso esperar que ela carregue.
function cssPronto(id) {
  const link = document.querySelector(`link[data-jogo="${id}"]`);
  if (!link || link.sheet) return Promise.resolve();
  return new Promise((r) => {
    link.addEventListener("load", r, { once: true });
    link.addEventListener("error", r, { once: true });
    setTimeout(r, 1500);
  });
}

export function abrir(app, sair) {
  estilo("aquario");
  const e = ecra(() => terminar());
  app.append(e.raiz);
  let ativo = true;
  const inicio = Date.now();
  let ultimoToque = Date.now();
  let ultimaFala = 0;
  let premiado = false;
  let avisosFome = 0;
  const temporizadores = new Set();
  const stats = { toques: 0, comida: 0, comidos: 0, bolhas: 0, bolhasTocadas: 0, cavalos: 0, cavalosTocados: 0, caranguejo: 0 };
  const reacoesBolha = [];

  function depois(ms, f) {
    const t = setTimeout(() => { temporizadores.delete(t); if (ativo) f(); }, ms);
    temporizadores.add(t);
    return t;
  }
  function cancelar(t) { clearTimeout(t); temporizadores.delete(t); }

  function terminar() {
    if (!ativo) return;
    ativo = false;
    temporizadores.forEach(clearTimeout);
    temporizadores.clear();
    metricas.ronda("aquario", {
      level: 1,
      started_at: new Date(inicio).toISOString(),
      duration_ms: Date.now() - inicio,
      completed: true,
      score: stats.comidos,
      accuracy: null,
      taps: stats.toques,
      food_drops: stats.comida,
      fish_fed: stats.comidos,
      bubbles_shown: stats.bolhas,
      bubbles_popped: stats.bolhasTocadas,
      bubble_reaction_ms_median: metricas.mediana(reacoesBolha),
      seahorses_shown: stats.cavalos,
      seahorses_tapped: stats.cavalosTocados,
      crab_taps: stats.caranguejo,
      reward_given: premiado,
    });
    ajustarNivel("aquario", NIVEIS_MAX, { completo: true, facil: false, dificil: false });
    e.raiz.remove();
    sair();
  }

  // Fala de vez em quando, nunca por cima de outra frase e nunca vezes demais.
  function talvezDizer(id, intervalo = 20000, cara = "img/noto/gato_feliz.svg") {
    if (Date.now() - ultimaFala < intervalo) return;
    ultimaFala = Date.now();
    e.dizer(id, { cara });
  }

  // Cenário
  const agua = el("div", { class: "aquario" });
  const fundo = el("div", { class: "areia" });
  agua.append(fundo);
  for (const [cls, src] of [["alga a1", "img/jogos/aquario-alga.svg"], ["alga a2", "img/jogos/aquario-alga.svg"],
    ["alga a3", "img/jogos/aquario-alga.svg"], ["coral", "img/noto/coral.svg"], ["concha", "img/noto/concha.svg"]]) {
    const i = img(src);
    i.className = cls;
    agua.append(i);
  }
  const caranguejo = el("button", { class: "caranguejo", "aria-label": "Caranguejo" }, [img("img/noto/caranguejo.svg")]);
  agua.append(caranguejo);
  e.corpo.append(agua);

  const caixa = () => agua.getBoundingClientRect();
  const topoAreia = () => caixa().height * 0.84;

  // Peixe: a caixa de fora move-se (transição longa), a do meio balança (animação CSS), a imagem vira-se.
  const peixes = PEIXES.map((p, k) => {
    const foto = img(p.src);
    const nada = el("div", { class: "nada", style: { animationDelay: `${-k * 0.7}s` } }, [foto]);
    const raiz = el("div", { class: `peixe${p.esquerda ? " nativo-esq" : ""}`, style: { "--t": `${p.tam}` } }, [nada]);
    agua.append(raiz);
    return { raiz, foto, tam: p.tam, x: 0, y: 0, ocupado: false, timer: null };
  });

  function lado(p) { return p.raiz.offsetWidth || 100; }

  function posAtual(p) {
    const m = new DOMMatrixReadOnly(getComputedStyle(p.raiz).transform);
    return { x: m.m41, y: m.m42 };
  }

  function mover(p, x, y, dur) {
    const atual = posAtual(p);
    if (Math.abs(x - atual.x) > 4) p.raiz.classList.toggle("esq", x < atual.x);
    p.raiz.style.transitionDuration = `${dur}ms`;
    p.raiz.style.transform = `translate(${x}px, ${y}px)`;
    p.x = x;
    p.y = y;
  }

  function vaguear(p) {
    if (!ativo) return;
    const c = caixa();
    const s = lado(p);
    const x = aoCalhas(0, Math.max(1, c.width - s));
    const y = aoCalhas(c.height * 0.04, Math.max(c.height * 0.05, topoAreia() - s * 0.9));
    const atual = posAtual(p);
    const dist = Math.hypot(x - atual.x, y - atual.y);
    const dur = Math.max(4000, Math.min(14000, dist * 28));
    mover(p, x, y, dur);
    p.timer = depois(dur + aoCalhas(500, 3500), () => vaguear(p));
  }

  // Pôr os peixes logo no sítio, depois pô-los a nadar em momentos diferentes.
  function colocar() {
    const c = caixa();
    peixes.forEach((p, k) => {
      const s = lado(p);
      p.raiz.style.transitionDuration = "0ms";
      const x = ((k + 0.5) / peixes.length) * (c.width - s);
      const y = c.height * (0.1 + 0.55 * ((k * 37) % 100) / 100);
      p.raiz.style.transform = `translate(${x}px, ${y}px)`;
      p.raiz.classList.toggle("esq", k % 2 === 1);
      p.timer = depois(300 + k * 900, () => vaguear(p));
    });
  }

  // Tocar na água: onda, comida, os peixes vêm.
  agua.addEventListener("pointerdown", (ev) => {
    if (!ativo || ev.target.closest("button")) return;
    stats.toques++;
    ultimoToque = Date.now();
    const c = caixa();
    const x = ev.clientX - c.left;
    const y = Math.min(ev.clientY - c.top, topoAreia() - 40);
    const onda = el("div", { class: "onda", style: { left: `${x}px`, top: `${ev.clientY - c.top}px` } });
    agua.append(onda);
    depois(1300, () => onda.remove());
    som.agua();
    largarComida(x, y);
  });

  function largarComida(x, y) {
    if (agua.querySelectorAll(".comida").length >= MAX_COMIDA) return;
    stats.comida++;
    const fim = Math.min(y + 150, topoAreia() + 6);
    const graos = [-22, 0, 20].map((dx) => {
      const g = el("div", { class: "comida", style: { left: `${x + dx}px`, top: `${y}px` } });
      agua.append(g);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        g.style.transform = `translateY(${fim - y + dx * 0.3}px)`;
      }));
      const d = { g, x: x + dx, y0: y, y1: fim + dx * 0.3, t0: Date.now(), comido: false };
      depois(14000, () => { if (!d.comido) { d.g.classList.add("some"); depois(800, () => d.g.remove()); } });
      return d;
    });
    // Os peixes livres mais próximos vão cada um a uma bolinha.
    const livres = peixes.filter((p) => !p.ocupado);
    for (const d of graos) {
      if (!livres.length) break;
      livres.sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y));
      irComer(livres.shift(), d);
    }
  }

  function irComer(p, d) {
    p.ocupado = true;
    cancelar(p.timer);
    const s = lado(p);
    const atual = posAtual(p);
    const vaiDireita = d.x > atual.x + s / 2;
    const dist = Math.hypot(d.x - atual.x, d.y1 - atual.y);
    const dur = Math.max(1500, Math.min(4500, dist * 9));
    const decorrido = Date.now() - d.t0 + dur;
    const yChegada = d.y0 + (d.y1 - d.y0) * Math.min(1, decorrido / QUEDA_MS);
    const x = vaiDireita ? d.x - s * 0.92 : d.x - s * 0.08;
    mover(p, x, yChegada - s * 0.5, dur);
    p.timer = depois(dur, () => {
      if (!d.comido) {
        d.comido = true;
        d.g.classList.add("comido");
        depois(400, () => d.g.remove());
        stats.comidos++;
        som.efeito("aquario-comida", 0.25);
        p.raiz.classList.remove("come");
        void p.raiz.offsetWidth;
        p.raiz.classList.add("come");
        talvezDizer(Math.random() < 0.5 ? "aquario.comem" : "aquario.gostam", 25000);
      }
      p.timer = depois(1200, () => { p.ocupado = false; p.raiz.classList.remove("come"); vaguear(p); });
    });
  }

  // De vez em quando sobe uma bolha; um toque rebenta-a.
  function bolha() {
    const c = caixa();
    const tam = Math.max(120, Math.min(c.width, c.height) * 0.26);
    const b = el("button", { class: "bolha", "aria-label": "Bolha", style: { width: `${tam}px`, height: `${tam}px` } },
      [img("img/jogos/aquario-bolha.svg")]);
    b.style.left = `${aoCalhas(0.08, 0.8) * (c.width - tam)}px`;
    b.style.top = `${c.height}px`;
    agua.append(b);
    stats.bolhas++;
    const nasceu = Date.now();
    if (stats.bolhas <= 2) talvezDizer("aquario.bolha", 8000, "img/noto/gato_sorri.svg");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      b.style.transform = `translateY(${-(c.height + tam * 1.2)}px)`;
    }));
    b.addEventListener("pointerdown", () => {
      if (b.classList.contains("estoura")) return;
      ultimoToque = Date.now();
      stats.toques++;
      stats.bolhasTocadas++;
      reacoesBolha.push(Date.now() - nasceu);
      // Pará-la onde está, depois rebentá-la.
      const m = new DOMMatrixReadOnly(getComputedStyle(b).transform);
      b.style.transition = "none";
      b.style.transform = `translateY(${m.m42}px)`;
      void b.offsetWidth;
      b.classList.add("estoura");
      som.efeito("aquario-bolha", 0.5);
      if (Math.random() < 0.35) talvezDizer(som.elogio(), 15000);
      depois(500, () => b.remove());
    });
    depois(16500, () => b.remove());
  }

  // Um cavalo-marinho atravessa devagar; um toque fá-lo rodopiar.
  function cavalo() {
    const c = caixa();
    const tam = Math.max(130, Math.min(c.width, c.height) * 0.32);
    const daEsquerda = Math.random() < 0.5;
    const b = el("button", { class: `cavalo${daEsquerda ? "" : " esq"}`, "aria-label": "Cavalo-marinho",
      style: { width: `${tam}px`, height: `${tam}px` } }, [el("div", { class: "nada" }, [img("img/jogos/aquario-cavalo.svg")])]);
    b.style.top = `${aoCalhas(0.1, 0.4) * c.height}px`;
    b.style.left = daEsquerda ? `${-tam}px` : `${c.width}px`;
    agua.append(b);
    stats.cavalos++;
    talvezDizer("aquario.olha_cavalo", 5000, "img/noto/gato_sorri.svg");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      b.style.transform = `translateX(${(daEsquerda ? 1 : -1) * (c.width + tam)}px)`;
    }));
    let tocado = false;
    b.addEventListener("pointerdown", () => {
      ultimoToque = Date.now();
      stats.toques++;
      b.classList.remove("gira");
      void b.offsetWidth;
      b.classList.add("gira");
      som.efeito("par", 0.4);
      if (!tocado) {
        tocado = true;
        stats.cavalosTocados++;
        talvezDizer("aquario.cavalo", 3000, "img/noto/gato_amor.svg");
      }
    });
    depois(26000, () => b.remove());
  }

  caranguejo.addEventListener("pointerdown", () => {
    if (caranguejo.classList.contains("anda")) return;
    ultimoToque = Date.now();
    stats.toques++;
    stats.caranguejo++;
    caranguejo.classList.add("anda");
    som.efeito("toque", 0.4);
    if (stats.caranguejo === 1) talvezDizer("aquario.caranguejo", 3000);
    depois(2600, () => caranguejo.classList.remove("anda"));
  });

  // Visitas: quase sempre bolhas, às vezes o cavalo-marinho.
  function visita() {
    if (Math.random() < 0.3) cavalo();
    else bolha();
    depois(aoCalhas(22000, 40000), visita);
  }

  // De poucos em poucos segundos: o azulejo ao fim de quatro minutos de uso, um empurrãozinho se a pessoa está parada.
  function vigiar() {
    const agora = Date.now();
    const parada = agora - ultimoToque;
    if (!premiado && agora - inicio >= PREMIO_MS && parada > 2500 && parada < 90000) {
      premiado = true;
      darPremio();
      return;
    }
    if (parada > 45000 && avisosFome < 2 && agora - ultimaFala > 30000) {
      avisosFome++;
      talvezDizer("aquario.fome", 30000, "img/noto/gato_sorri.svg");
    } else if (parada > 20000 && Math.random() < 0.08) {
      talvezDizer("aquario.calma", 60000, "img/noto/gato_sorri.svg");
    }
    depois(5000, vigiar);
  }

  async function darPremio() {
    ultimaFala = Date.now();
    await e.dizer("aquario.presente", { cara: "img/noto/gato_amor.svg" });
    if (!ativo) return;
    const r = await premio(e, e.raiz);
    if (!ativo) return;
    if (r === "casa") { terminar(); return; }
    ultimoToque = Date.now();
    e.dizer("aquario.continua", { cara: "img/noto/gato_feliz.svg" });
    depois(5000, vigiar);
  }

  (async () => {
    await cssPronto("aquario");
    if (!ativo) return;
    colocar();
  })();
  (async () => {
    ultimaFala = Date.now();
    await e.dizer("aquario.ola");
    if (!ativo) return;
    depois(12000, visita);
    depois(5000, vigiar);
  })();

  return () => terminar();
}
