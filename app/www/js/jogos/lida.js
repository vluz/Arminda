// Peças partilhadas pelos jogos da lida da casa (Estendal, Pôr a mesa, Azulejos):
// um arrastar tolerante que também funciona como tocar e depois tocar, notas a subir para uma
// série de acertos, uma barra de progresso, um emblema de série e "melhor do que da última vez".

import { el } from "../ui.js";
import { ler, gravar } from "../estado.js";

export function baralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const escolher = (lista) => lista[Math.floor(Math.random() * lista.length)];

// Recomeça num elemento uma classe de animação CSS que corre uma vez.
export function animar(alvo, classe) {
  if (!alvo) return;
  alvo.classList.remove(classe);
  void alvo.offsetWidth;
  alvo.classList.add(classe);
}

// Contexto de som próprio para pequenas notas de sino, fechado quando o jogo acaba.
export function sinos() {
  let ctx = null;
  let fechado = false;
  function audio() {
    if (fechado) return null;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  }
  function tom(freq, dur = 0.35, vol = 0.22) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const o2 = a.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2;
    const g2 = a.createGain();
    g2.gain.value = 0.15;
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(a.destination);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }
  // Dó maior, uma oitava e pouco: cada resposta certa de seguida toca um degrau acima.
  const ESCALA = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5, 1174.66, 1318.51];
  return {
    tom,
    serie(k) { tom(ESCALA[Math.max(0, Math.min(k - 1, ESCALA.length - 1))], 0.4); },
    arpejo() {
      [0, 2, 4, 7].forEach((i, j) => setTimeout(() => tom(ESCALA[i], 0.5, 0.18), j * 110));
    },
    fechar() {
      fechado = true;
      try { if (ctx) ctx.close(); } catch { /* já está fechado*/ }
      ctx = null;
    },
  };
}

// Faz com que uma peça se possa agarrar. Um toque (o dedo mexeu menos de TREME px) chama tocar();
// um arrastar mostra uma cópia por baixo do dedo e chama largar(x, y) onde foi largada.
// Um arrastar largado ainda por cima da própria peça (um toque a tremer)
// também conta como toque, nunca como uma largada falhada.
// camada: o elemento onde vive a cópia que flutua (removido com o ecrã do jogo).
const TREME = 24;
export function pegavel(peca, { tocar, largar, pode = () => true, camada }) {
  let ini = null;
  let fantasma = null;
  peca.style.touchAction = "none";
  peca.addEventListener("pointerdown", (ev) => {
    if (!pode() || ini) return;
    ini = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, arrasta: false };
    try { peca.setPointerCapture(ev.pointerId); } catch { /* não é suportado*/ }
  });
  peca.addEventListener("pointermove", (ev) => {
    if (!ini || ev.pointerId !== ini.id) return;
    const dx = ev.clientX - ini.x;
    const dy = ev.clientY - ini.y;
    if (!ini.arrasta && Math.hypot(dx, dy) > TREME) {
      ini.arrasta = true;
      const r = peca.getBoundingClientRect();
      const figura = peca.querySelector("img, svg");
      fantasma = el("div", { class: "lida-fantasma" });
      fantasma.append(figura ? figura.cloneNode(true) : peca.cloneNode(true));
      Object.assign(fantasma.style, { width: `${r.width}px`, height: `${r.height}px`, left: `${r.left}px`, top: `${r.top}px` });
      ini.ox = r.left;
      ini.oy = r.top;
      (camada || document.body).append(fantasma);
      peca.classList.add("lida-levantada");
    }
    if (fantasma) fantasma.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
  });
  const fim = (ev, cancelado) => {
    if (!ini || ev.pointerId !== ini.id) return;
    const era = ini;
    ini = null;
    if (fantasma) { fantasma.remove(); fantasma = null; }
    peca.classList.remove("lida-levantada");
    if (cancelado) return;
    if (era.arrasta && !dentro(peca, ev.clientX, ev.clientY, 0.3)) largar(ev.clientX, ev.clientY);
    else tocar();
  };
  peca.addEventListener("pointerup", (ev) => fim(ev, false));
  peca.addEventListener("pointercancel", (ev) => fim(ev, true));
  peca.addEventListener("lostpointercapture", (ev) => fim(ev, true));
}

// Um toque num alvo de largada, por eventos de ponteiro (sem atraso de clique, nunca dispara durante um arrastar).
// Um dedo a tremer pode escorregar até 32 px; o toque conta onde pousou primeiro.
export function tocavel(alvo, fn) {
  let ini = null;
  alvo.style.touchAction = "none";   // senão o browser cancela o ponteiro ao fim de 8 px de deslize
  alvo.addEventListener("pointerdown", (ev) => { ini = { x: ev.clientX, y: ev.clientY, id: ev.pointerId }; });
  alvo.addEventListener("pointerup", (ev) => {
    if (!ini || ev.pointerId !== ini.id) return;
    const de = ini;
    ini = null;
    if (Math.hypot(ev.clientX - de.x, ev.clientY - de.y) > 32) return;
    fn(de.x, de.y);
  });
  alvo.addEventListener("pointercancel", () => { ini = null; });
}

// Se o ponto está dentro da caixa do elemento, aumentada de uma fração do seu tamanho de cada lado.
export function dentro(alvo, x, y, margem = 0) {
  const r = alvo.getBoundingClientRect();
  if (!r.width) return false;
  return x > r.left - r.width * margem && x < r.right + r.width * margem &&
    y > r.top - r.height * margem && y < r.bottom + r.height * margem;
}

// Índice do elemento por baixo do ponto (com folga), o de centro mais próximo primeiro; -1 se não há nenhum.
export function sobre(lista, x, y, margem = 0.15) {
  let melhor = -1;
  let dist = Infinity;
  lista.forEach((a, k) => {
    if (!dentro(a, x, y, margem)) return;
    const r = a.getBoundingClientRect();
    const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    if (d < dist) { dist = d; melhor = k; }
  });
  return melhor;
}

// Faz voar uma cópia de uma imagem de um elemento para outro, e depois chama fim.
export function voar(camada, figura, de, para, fim, dur = 450) {
  const a = de.getBoundingClientRect();
  const b = para.getBoundingClientRect();
  const c = figura.cloneNode(true);
  const v = el("div", { class: "lida-fantasma" }, [c]);
  Object.assign(v.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
  camada.append(v);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const s = Math.max(0.3, Math.min(1.4, b.width / Math.max(1, a.width)));
  const anim = v.animate([
    { transform: "translate(0, 0) scale(1)" },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(${(1 + s) / 2})`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
  ], { duration: dur, easing: "ease-in-out", fill: "forwards" });
  anim.onfinish = () => { v.remove(); if (fim) fim(); };
}

// Uma barra de progresso fina: por(0..1).
export function barra() {
  const enche = el("div", { class: "lida-enche" });
  const raiz = el("div", { class: "lida-barra" }, [enche]);
  return { raiz, por(f) { enche.style.width = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`; } };
}

// Um emblema que salta numa série de acertos: "3 seguidas!".
export function emblema(onde) {
  const b = el("div", { class: "lida-serie" });
  onde.append(b);
  return (k) => {
    if (k < 3) return;
    b.textContent = `${k} seguidas!`;
    animar(b, "mostra");
  };
}

// "Melhor do que da última vez": compara a pontuação com a da última ronda no mesmo nível.
// Devolve verdadeiro quando é mais alta, e guarda esta para a próxima vez.
export function melhorQueAntes(jogo, nivel, pontos) {
  const antes = ler(`${jogo}.ultima`, null);
  gravar(`${jogo}.ultima`, { nivel, pontos });
  return !!antes && antes.nivel === nivel && pontos > antes.pontos;
}

// Estilos partilhados das peças acima, escritos uma vez na página.
let estilado = false;
export function estiloLida() {
  if (estilado) return;
  estilado = true;
  document.head.append(el("style", { "data-lida": "1" }, `
.lida-fantasma { position: fixed; z-index: 40; pointer-events: none; display: grid; place-items: center; filter: drop-shadow(0 1.6vmin 0 rgba(0,0,0,.3)); }
.lida-fantasma > img, .lida-fantasma > svg { width: 100%; height: 100%; object-fit: contain; }
.lida-levantada { opacity: 0.35; }
.lida-barra { position: absolute; left: 0; right: 0; top: 0; height: 2.2vmin; min-height: 12px; border: 3px solid var(--linha); border-radius: 999px; background: var(--branco); overflow: hidden; z-index: 3; }
.lida-enche { height: 100%; width: 0; background: linear-gradient(90deg, var(--amarelo), var(--verde)); transition: width 0.6s ease; }
.lida-serie { position: absolute; left: 50%; top: 18%; transform: translateX(-50%); z-index: 30; pointer-events: none; opacity: 0;
  background: var(--amarelo); border: var(--borda) solid var(--linha); border-radius: 999px; padding: 1vmin 3vmin; font-size: var(--t-medio); font-weight: 800; white-space: nowrap; }
.lida-serie.mostra { animation: lida-serie 1.4s ease; }
@keyframes lida-serie { 0% { opacity: 0; transform: translateX(-50%) scale(0.4); } 20% { opacity: 1; transform: translateX(-50%) scale(1.15); } 35% { transform: translateX(-50%) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateX(-50%) translateY(-4vmin); } }
@keyframes lida-abana { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-2vmin); } 40% { transform: translateX(2vmin); } 60% { transform: translateX(-1.2vmin); } 80% { transform: translateX(1.2vmin); } }
.lida-abana { animation: lida-abana 0.5s ease; }
.lida-pista { animation: pisca 0.6s ease 4; }
`));
}
