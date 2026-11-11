// Desenho das peças de dominó em SVG. Cada número tem a sua cor de pintas, por isso números iguais
// também têm cor igual. O zero ("branco") é uma metade vazia.

const COR = ["#111111", "#0a6fd6", "#2b9348", "#e63946", "#7b2cbf", "#c25e00", "#111111"];

// Posições das pintas numa grelha de 3x3 dentro de uma metade de 100x100.
const POS = {
  0: [],
  1: [[50, 50]],
  2: [[26, 26], [74, 74]],
  3: [[24, 24], [50, 50], [76, 76]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[27, 22], [73, 22], [27, 50], [73, 50], [27, 78], [73, 78]],
};

function metade(n, dx, dy, rodar, apagada) {
  const r = n === 1 ? 15 : n >= 6 ? 10.5 : 11.5;
  const pts = POS[n].map(([x, y]) => (rodar ? [y, x] : [x, y]));
  const bolas = pts.map(([x, y]) => `<circle cx="${x + dx}" cy="${y + dy}" r="${r}" fill="${COR[n]}"/>`).join("");
  const veu = apagada ? `<rect x="${dx}" y="${dy}" width="100" height="100" fill="#ffffff" opacity="0.62"/>` : "";
  return bolas + veu;
}

// a é a metade esquerda (ou de cima), b a direita (ou de baixo). apagar: "a" ou "b" esbate essa metade.
export function svgPeca(a, b, { vertical = false, apagar = "" } = {}) {
  const w = vertical ? 100 : 200;
  const h = vertical ? 200 : 100;
  const [bx, by] = vertical ? [0, 100] : [100, 0];
  const linha = vertical
    ? `<line x1="12" y1="100" x2="88" y2="100" stroke="#111" stroke-width="5" stroke-linecap="round"/>`
    : `<line x1="100" y1="12" x2="100" y2="88" stroke="#111" stroke-width="5" stroke-linecap="round"/>`;
  return `<svg viewBox="-4 -4 ${w + 8} ${h + 8}" aria-hidden="true">`
    + `<rect x="0" y="0" width="${w}" height="${h}" rx="14" fill="#fffdf6" stroke="#111" stroke-width="6"/>`
    + metade(a, 0, 0, !vertical, apagar === "a") + metade(b, bx, by, !vertical, apagar === "b") + linha
    + `</svg>`;
}

// As costas de uma peça, para as mãos dos amigos e para o monte.
export function svgCostas() {
  return `<svg viewBox="-3 -3 56 106" aria-hidden="true"><rect x="0" y="0" width="50" height="100" rx="9" fill="#0b3d91" stroke="#111" stroke-width="5"/>`
    + `<circle cx="25" cy="50" r="9" fill="#ffb703"/></svg>`;
}
