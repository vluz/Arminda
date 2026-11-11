// Azulejos desenhados a partir de um número, e a coleção que a pessoa enche com um azulejo por ronda.

import { ler, gravar } from "./estado.js";

export const POR_PAINEL = 12;

const PALETAS = [
  { fundo: "#ffffff", a: "#0b3d91", b: "#2a7de1", c: "#ffb703" },
  { fundo: "#fffbea", a: "#0b3d91", b: "#ffb703", c: "#2b9348" },
  { fundo: "#ffffff", a: "#2b9348", b: "#ffb703", c: "#0b3d91" },
  { fundo: "#fff4f4", a: "#e63946", b: "#0b3d91", c: "#ffb703" },
  { fundo: "#ffffff", a: "#7b2cbf", b: "#ff4d8d", c: "#ffb703" },
  { fundo: "#f2fbff", a: "#0a6fd6", b: "#fb8500", c: "#0b3d91" },
];

// Pequeno gerador de números ao acaso mas repetível, para o azulejo n ter sempre o mesmo aspeto.
function aleatorio(semente) {
  let s = (semente * 2654435761) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// Um quarto do motivo, desenhado nos 50x50 de cima à esquerda e espelhado nas quatro direções.
function quarto(tipo, p) {
  switch (tipo) {
    case 0: // flor ao centro, pétalas para os cantos
      return `<circle cx="50" cy="50" r="12" fill="${p.c}"/>
        <ellipse cx="34" cy="34" rx="16" ry="7" transform="rotate(45 34 34)" fill="${p.a}"/>
        <circle cx="0" cy="0" r="16" fill="${p.b}"/><circle cx="0" cy="0" r="8" fill="${p.c}"/>`;
    case 1: // estrela e arcos nos cantos
      return `<path d="M50 22 L56 44 L50 50 L44 44 Z" fill="${p.a}"/>
        <path d="M0 30 Q30 30 30 0" fill="none" stroke="${p.b}" stroke-width="7"/>
        <circle cx="12" cy="12" r="6" fill="${p.c}"/>`;
    case 2: // rede de losangos
      return `<path d="M50 14 L50 50 L14 50 Z" fill="${p.a}"/>
        <path d="M0 0 L22 0 L0 22 Z" fill="${p.b}"/>
        <circle cx="50" cy="50" r="8" fill="${p.c}"/>
        <circle cx="26" cy="26" r="5" fill="${p.c}"/>`;
    case 3: // folhas e anel ao centro
      return `<circle cx="50" cy="50" r="16" fill="none" stroke="${p.a}" stroke-width="6"/>
        <path d="M8 8 Q30 12 34 34 Q12 30 8 8 Z" fill="${p.b}"/>
        <circle cx="50" cy="50" r="6" fill="${p.c}"/>`;
    default: // quadrifólio
      return `<circle cx="50" cy="32" r="11" fill="${p.a}"/>
        <circle cx="32" cy="50" r="11" fill="${p.a}"/>
        <circle cx="50" cy="50" r="9" fill="${p.c}"/>
        <path d="M0 0 L18 0 Q18 18 0 18 Z" fill="${p.b}"/>`;
  }
}

export function svgAzulejo(n) {
  const r = aleatorio(n + 7);
  const p = PALETAS[Math.floor(r() * PALETAS.length)];
  const tipo = Math.floor(r() * 5);
  const q = quarto(tipo, p);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${p.fundo}"/>
    <g>${q}</g>
    <g transform="translate(100 0) scale(-1 1)">${q}</g>
    <g transform="translate(0 100) scale(1 -1)">${q}</g>
    <g transform="translate(100 100) scale(-1 -1)">${q}</g>
    <rect width="100" height="100" fill="none" stroke="${p.a}" stroke-width="3"/>
  </svg>`;
}

export function total() {
  return ler("azulejos", 0);
}

// Acrescenta um azulejo e devolve o seu número (a começar em 0).
export function ganhar() {
  const n = total();
  gravar("azulejos", n + 1);
  return n;
}
