// Azulejos: os desenhos dos azulejos (desenhos nossos, em 100 x 100 unidades) e as suas cores clássicas.
// Cada desenho é uma lista de regiões que se podem pintar, desenhadas de baixo para cima; as formas
// "fixo" são decoração fixa desenhada por cima (nunca se tocam). Os tamanhos das regiões são
// conferidos por tools/testes/pintar.mjs.

export const CORES = {
  azul: "#0b3d91",
  amarelo: "#ffc21a",
  branco: "#ffffff",
  verde: "#2b9348",
  vermelho: "#e63946",
  celeste: "#6ec6ff",
  laranja: "#fb8500",
  preto: "#262626",
  rosa: "#ff6fa8",
};
export const POR_PINTAR = "#dcdcdc";

const r1 = (n) => Math.round(n * 10) / 10;
export const circ = (cx, cy, r) => `M${r1(cx - r)} ${r1(cy)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0Z`;
const poli = (pts) => `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L")}Z`;
function estrela(cx, cy, R, r, n = 8, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const k = i % 2 ? r : R;
    pts.push([cx + k * Math.cos(a), cy + k * Math.sin(a)]);
  }
  return poli(pts);
}
function sector(a1, a2, R) {
  const p = (a) => `${r1(50 + R * Math.cos((a * Math.PI) / 180))} ${r1(50 + R * Math.sin((a * Math.PI) / 180))}`;
  return `M50 50L${p(a1)}A${R} ${R} 0 0 1 ${p(a2)}Z`;
}
const cantos = (r, quais = [[0, 0], [100, 0], [100, 100], [0, 100]]) => quais.map(([x, y]) => circ(x, y, r)).join("");
const TUDO = "M0 0H100V100H0Z";
const coracao = (cx, cy, s) => {
  // Um coração com cerca de 72 s de largura, centrado em (cx, cy).
  const p = (x, y) => `${r1(cx + (x - 50) * s)} ${r1(cy + (y - 55) * s)}`;
  return `M${p(50, 88)}C${p(20, 66)} ${p(10, 50)} ${p(14, 36)}C${p(18, 22)} ${p(38, 18)} ${p(50, 34)}C${p(62, 18)} ${p(82, 22)} ${p(86, 36)}C${p(90, 50)} ${p(80, 66)} ${p(50, 88)}Z`;
};

// grupo: "baixo" (regiões grandes, primeiros níveis), "medio", "alto" (galo, coração de Viana),
// "painel" (um quarto, espelhado nas quatro direções num painel de 2 x 2; o canto de baixo à
// direita é o centro do painel).
// esquemas: cores clássicas, uma cor por região.
export const MOTIVOS = [
  {
    id: "cata_vento", grupo: "baixo",
    regioes: [TUDO, "M50 50L0 0L50 0ZM50 50L100 100L50 100Z", "M50 50L100 0L100 50ZM50 50L0 100L0 50Z", circ(50, 50, 14)],
    esquemas: [["branco", "azul", "celeste", "amarelo"], ["amarelo", "azul", "branco", "vermelho"], ["branco", "verde", "amarelo", "azul"]],
  },
  {
    id: "losango", grupo: "baixo",
    regioes: ["M0 0L50 0L0 50ZM100 100L50 100L100 50Z", "M100 0L100 50L50 0ZM0 100L0 50L50 100Z", "M50 0L100 50L50 100L0 50Z", circ(50, 50, 17)],
    esquemas: [["azul", "azul", "branco", "amarelo"], ["amarelo", "verde", "branco", "azul"], ["celeste", "azul", "amarelo", "branco"]],
  },
  {
    id: "coracao", grupo: "baixo", fundo: "branco",
    regioes: [cantos(34, [[0, 0], [100, 100]]), cantos(34, [[100, 0], [0, 100]]), coracao(50, 52, 1.05)],
    esquemas: [["azul", "azul", "vermelho"], ["amarelo", "verde", "vermelho"], ["celeste", "celeste", "rosa"]],
  },
  {
    id: "quatro_folhas", grupo: "baixo", fundo: "branco",
    regioes: [cantos(34, [[0, 0], [100, 100]]), cantos(34, [[100, 0], [0, 100]]),
      circ(50, 25, 19) + circ(75, 50, 19) + circ(50, 75, 19) + circ(25, 50, 19), circ(50, 50, 15)],
    esquemas: [["azul", "azul", "celeste", "amarelo"], ["verde", "amarelo", "vermelho", "amarelo"], ["azul", "amarelo", "azul", "branco"]],
  },
  {
    id: "estrela", grupo: "medio", fundo: "branco",
    regioes: [cantos(32, [[0, 0], [100, 100]]), cantos(32, [[100, 0], [0, 100]]), estrela(50, 50, 50, 25, 4, -90), circ(50, 50, 14)],
    esquemas: [["azul", "celeste", "azul", "amarelo"], ["verde", "amarelo", "azul", "vermelho"], ["celeste", "celeste", "azul", "laranja"]],
  },
  {
    id: "flor_grande", grupo: "medio", fundo: "branco",
    regioes: [cantos(30, [[0, 0], [100, 100]]), cantos(30, [[100, 0], [0, 100]]),
      circ(50, 22, 18) + circ(78, 50, 18) + circ(50, 78, 18) + circ(22, 50, 18),
      circ(30, 30, 12) + circ(70, 30, 12) + circ(70, 70, 12) + circ(30, 70, 12), circ(50, 50, 16)],
    esquemas: [["azul", "azul", "celeste", "verde", "amarelo"], ["verde", "verde", "amarelo", "laranja", "azul"], ["azul", "celeste", "vermelho", "verde", "amarelo"]],
  },
  {
    id: "roda", grupo: "medio",
    regioes: ["M0 0H50V50H0ZM50 50H100V100H50Z", "M50 0H100V50H50ZM0 50H50V100H0Z",
      sector(-135, -45, 37) + sector(45, 135, 37), sector(-45, 45, 37) + sector(135, 225, 37), circ(50, 50, 13)],
    esquemas: [["azul", "celeste", "amarelo", "branco", "vermelho"], ["verde", "amarelo", "branco", "azul", "laranja"], ["celeste", "azul", "branco", "amarelo", "azul"]],
  },
  {
    id: "galo", grupo: "alto",
    regioes: [
      TUDO,
      // leque da cauda, por trás do corpo
      "M38 46Q20 42 10 26Q6 16 13 12Q20 22 27 24Q22 12 29 5Q36 18 39 28Q40 18 47 13Q48 28 46 40Z",
      // corpo, pescoço e cabeça
      "M22 64Q20 48 34 43Q46 40 54 31Q55 20 63 16Q73 13 76 23Q77 31 71 38Q67 45 71 53Q75 66 64 73Q52 81 36 77Q24 73 22 64Z",
      // crista
      "M55 21Q47 9 57 4Q60 -4 70 0Q79 -5 84 4Q94 5 89 18Q77 11 55 21Z",
      // coração no peito
      coracao(46, 60, 0.4),
      // chão
      "M16 80H84V100H16Z",
    ],
    fixo: [
      { d: "M75 22L88 27L76 31Z", cor: "#ffc21a" },
      { d: circ(68, 22, 2.6), cor: "#111111" },
      { d: "M42 77L40 81M58 76L60 81", cor: "none", traco: "#111111", largura: 3.5 },
    ],
    esquemas: [["branco", "verde", "preto", "vermelho", "amarelo", "azul"], ["amarelo", "azul", "preto", "vermelho", "branco", "verde"]],
  },
  {
    id: "viana", grupo: "alto",
    regioes: [
      TUDO,
      cantos(26),
      coracao(50, 58, 0.92),
      coracao(50, 64, 0.42),
      "M50 32Q36 24 42 9Q46 16 49 14Q50 4 58 -2Q59 10 64 14Q70 24 60 31Q55 35 50 32Z",
      "M18 94Q-2 80 6 54Q20 68 36 74Q32 90 18 94ZM82 94Q102 80 94 54Q80 68 64 74Q68 90 82 94Z",
    ],
    esquemas: [["branco", "azul", "vermelho", "amarelo", "laranja", "verde"], ["celeste", "amarelo", "vermelho", "rosa", "amarelo", "verde"]],
  },
  {
    id: "arco", grupo: "painel",
    regioes: [TUDO, circ(100, 100, 57), circ(0, 0, 51)],
    esquemas: [["branco", "azul", "amarelo"], ["amarelo", "azul", "branco"], ["branco", "verde", "vermelho"]],
  },
  {
    id: "folhas", grupo: "painel",
    regioes: [TUDO, circ(100, 100, 54), circ(100, 0, 45), circ(0, 100, 45)],
    esquemas: [["branco", "azul", "amarelo", "celeste"], ["celeste", "azul", "branco", "amarelo"], ["branco", "vermelho", "verde", "amarelo"]],
  },
];

// O azulejo como texto SVG. cores: uma chave de cor (ou null para ainda não pintado) por região.
// interativo: as regiões levam data-r para os toques.
export function svgAzulejo(m, cores, { interativo = false, classe = "" } = {}) {
  const partes = [];
  if (m.fundo) partes.push(`<path d="${TUDO}" fill="${CORES[m.fundo]}"/>`);
  m.regioes.forEach((d, i) => {
    const c = cores[i] ? CORES[cores[i]] : POR_PINTAR;
    partes.push(`<path d="${d}" fill="${c}" stroke="#1b2a4a" stroke-width="1.3" stroke-linejoin="round"${interativo ? ` data-r="${i}"` : ""}/>`);
  });
  for (const f of m.fixo || []) {
    partes.push(`<path d="${f.d}" fill="${f.cor}" stroke="${f.traco || "#1b2a4a"}" stroke-width="${f.largura || 1.2}" stroke-linecap="round" pointer-events="none"/>`);
  }
  partes.push(`<rect x="0.8" y="0.8" width="98.4" height="98.4" fill="none" stroke="#1b2a4a" stroke-width="1.6" pointer-events="none"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${classe ? ` class="${classe}"` : ""}>${partes.join("")}</svg>`;
}

// Um painel de 2 x 2 de um desenho de um quarto, espelhado, como um só SVG pequeno (para a parede).
export function svgPainel(m, quatro) {
  const t = ["", "translate(200 0) scale(-1 1)", "translate(0 200) scale(1 -1)", "translate(200 200) scale(-1 -1)"];
  const dentro = quatro.map((cores, k) => `<g transform="${t[k]}">${svgAzulejo(m, cores).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${dentro}</svg>`;
}
