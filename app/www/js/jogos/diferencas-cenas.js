// Diferenças: cenas feitas de partes. Cada cena tem um fundo desenhado e lugares onde ficam os
// objetos (x = centro, base = linha de baixo, s = tamanho, tudo numa imagem de 400x330).
// gerar() enche uma cena, copia-a e aplica diferenças ao acaso a uma cópia ou à outra.

export const LARGURA = 400;
export const ALTURA = 330;

const L = `stroke="#111111" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
const L3 = `stroke="#111111" stroke-width="3" stroke-linejoin="round"`;

// Objetos desenhados numa caixa de 100x100, assentes em y = 98. `c` é a cor principal.
const DESENHOS = {
  chavena: (c, d) => `<ellipse cx="50" cy="90" rx="44" ry="8" fill="#ffffff" ${L}/>
${d ? "" : `<path d="M76 48 Q96 46 92 64 Q88 78 70 76" fill="none" stroke="#111111" stroke-width="12"/>
<path d="M76 48 Q96 46 92 64 Q88 78 70 76" fill="none" stroke="${c}" stroke-width="5"/>`}
<path d="M16 40 H80 V60 Q80 86 48 86 Q16 86 16 60 Z" fill="${c}" ${L}/>
<ellipse cx="48" cy="40" rx="32" ry="7" fill="#6b3b1a" ${L}/>`,
  jarra: (c, d) => `<path d="M38 50 L30 18 M50 50 V12 M62 50 L70 20" stroke="#2b9348" stroke-width="5" stroke-linecap="round"/>
<circle cx="30" cy="18" r="10" fill="#ffffff" ${L}/><circle cx="30" cy="18" r="4" fill="#ffb703"/>
<circle cx="50" cy="12" r="10" fill="#ffffff" ${L}/><circle cx="50" cy="12" r="4" fill="#ffb703"/>
<circle cx="70" cy="20" r="10" fill="#ffffff" ${L}/><circle cx="70" cy="20" r="4" fill="#ffb703"/>
<path d="M38 44 H62 V54 Q82 66 72 96 H28 Q18 66 38 54 Z" fill="${c}" ${L}/>
${d ? "" : `<path d="M30 72 H70" stroke="#ffffff" stroke-width="5"/>`}`,
  vasoflor: (c, d) => `<path d="M50 70 V36" stroke="#2b9348" stroke-width="6"/>
${d ? "" : `<path d="M50 60 Q30 58 28 46 Q44 46 50 58 Z" fill="#2b9348" ${L3}/>`}
${[0, 1, 2, 3, 4, 5].map((k) => {
  const a = (k * Math.PI) / 3;
  return `<circle cx="${(50 + 15 * Math.cos(a)).toFixed(1)}" cy="${(28 + 15 * Math.sin(a)).toFixed(1)}" r="11" fill="${c}" ${L3}/>`;
}).join("")}
<circle cx="50" cy="28" r="9" fill="#6b3b1a" ${L3}/>
<path d="M26 66 H74 L66 97 H34 Z" fill="#c65a2e" ${L}/><rect x="22" y="62" width="56" height="10" rx="3" fill="#d9763f" ${L3}/>`,
  balde: (c, d) => `${d ? "" : `<path d="M24 44 Q50 4 76 44" fill="none" stroke="#111111" stroke-width="5"/>`}
<path d="M20 44 H80 L70 97 H30 Z" fill="${c}" ${L}/>
<ellipse cx="50" cy="44" rx="30" ry="6" fill="#ffffff" ${L3}/>
<path d="M27 70 H73" stroke="#ffffff" stroke-width="6"/>`,
  guardasol: (c, d) => `<rect x="47" y="34" width="6" height="64" fill="#8b5a2b" ${L3}/>
<path d="M4 46 Q50 -6 96 46 Q85 38 73 46 Q62 38 50 46 Q38 38 27 46 Q15 38 4 46 Z" fill="${c}" ${L}/>
${d ? "" : `<path d="M50 6 Q38 22 27 46 Q38 38 50 46 Z M50 6 Q62 22 73 46 Q62 38 50 46 Z" fill="#ffffff" ${L3}/>`}`,
  caixote: (c, d) => `<circle cx="30" cy="44" r="14" fill="#ffd23f" ${L3}/><circle cx="54" cy="40" r="14" fill="#ffd23f" ${L3}/><circle cx="74" cy="46" r="13" fill="#ffd23f" ${L3}/>
<rect x="8" y="50" width="84" height="47" rx="4" fill="${c}" ${L}/>
${d ? "" : `<path d="M8 66 H92 M8 81 H92" stroke="#111111" stroke-width="3"/>`}`,
  candeeiro: (c, d) => `<rect x="46" y="40" width="8" height="52" fill="#555555" ${L3}/>
<ellipse cx="50" cy="94" rx="24" ry="5" fill="#444444" ${L3}/>
<path d="M30 6 H70 L86 44 H14 Z" fill="${c}" ${L}/>
${d ? "" : `<path d="M22 32 H78" stroke="#ffffff" stroke-width="4"/>`}`,
  almofada: (c, d) => `<path d="M14 36 Q50 26 86 36 Q94 66 86 96 Q50 88 14 96 Q6 66 14 36 Z" fill="${c}" ${L}/>
${d ? "" : `<circle cx="50" cy="64" r="6" fill="#ffffff" ${L3}/>`}
<path d="M30 50 Q50 64 70 50 M30 80 Q50 64 70 80" fill="none" stroke="#111111" stroke-width="2.5"/>`,
  quadro: (c, d) => `<path d="M30 16 L50 4 L70 16" fill="none" stroke="#111111" stroke-width="3"/>
<rect x="6" y="16" width="88" height="74" rx="3" fill="${c}" ${L}/>
<rect x="18" y="28" width="64" height="50" fill="#8ed1fc" ${L3}/>
<path d="M18 78 V64 Q36 50 52 62 Q66 54 82 64 V78 Z" fill="#7ccf4f" ${L3}/>
${d ? "" : `<circle cx="66" cy="42" r="7" fill="#ffd23f" ${L3}/>`}`,
};

const CORES = ["#e63946", "#ffb703", "#0a6fd6", "#2b9348", "#7b2cbf", "#ff4d8d", "#fb8500"];
// Cores próximas de cada uma, para os níveis subtis.
const VIZINHAS = {
  "#e63946": ["#ff4d8d", "#fb8500"],
  "#ffb703": ["#fb8500"],
  "#0a6fd6": ["#7b2cbf", "#2b9348"],
  "#2b9348": ["#0a6fd6"],
  "#7b2cbf": ["#0a6fd6", "#ff4d8d"],
  "#ff4d8d": ["#e63946", "#7b2cbf"],
  "#fb8500": ["#e63946", "#ffb703"],
};

// Objetos. As imagens são Noto Emoji (n) ou desenhos nossos (p); `matiz` marca as imagens com
// uma cor forte, que podem mudar de cor com uma rotação de matiz.
const OBJ = {};
const n = (id, matiz = false) => { OBJ[id] = { id, src: `img/noto/${id}.svg`, matiz }; };
const p = (id, matiz = false) => { OBJ[id] = { id, src: `img/proprio/${id}.svg`, matiz }; };
["pao", "queijo", "laranja", "banana", "pera", "uvas", "bolo", "tomate", "croissant", "limao", "melancia",
  "ananas", "cafe", "leite", "cha", "mel", "ovo", "cebola", "alho", "cenoura", "couve", "batata", "pepino",
  "milho", "cogumelo", "cereja", "morango", "castanha", "azeitonas", "maca_verde", "gato", "cao", "cesto",
  "girassol", "malmequer", "coelho", "caracol", "galinha", "pato", "ovelha", "joaninha", "sapo", "sol", "nuvem",
  "passaro", "abelha", "arco_iris", "aviao", "barco", "peixe", "polvo", "baiacu", "caranguejo", "concha",
  "coral", "relogio", "janela", "sofa", "cadeira", "telefone", "vela", "urso"].forEach((id) => n(id));
["maca", "tulipa", "rosa", "chapeu", "livro", "guarda_chuva", "coracao", "pimento", "peixe_tropical", "borboleta"]
  .forEach((id) => n(id, true));
["sardinha", "galo", "pastel_nata", "regador", "margarida", "cravo", "guitarra", "cartas"].forEach((id) => p(id));
for (const id of Object.keys(DESENHOS)) OBJ[id] = { id, desenho: DESENHOS[id] };

// Objetos que ficam diferentes ao espelho (olham para um lado), para a diferença "espelho".
const ASSIMETRICOS = new Set(["gato", "cao", "coelho", "caracol", "galinha", "pato", "ovelha", "passaro", "peixe",
  "baiacu", "aviao", "barco", "banana", "cenoura", "milho", "pepino", "cereja", "queijo", "cafe", "cadeira", "abelha",
  "limao", "galo", "sardinha", "guitarra", "regador", "peixe_tropical", "chavena", "croissant", "chapeu",
  "guarda_chuva"]);

function azulejos() {
  let s = "";
  for (let y = 0; y < 120; y += 40) {
    for (let x = 0; x < 400; x += 40) {
      s += `<rect x="${x}" y="${y}" width="40" height="40" fill="#f4f8ff" stroke="#9cbbe6" stroke-width="2"/>`;
      s += `<path d="M${x + 20} ${y + 7} L${x + 33} ${y + 20} L${x + 20} ${y + 33} L${x + 7} ${y + 20} Z" fill="#5b8fd6"/>`;
    }
  }
  return s;
}
function toalhaMesa() {
  let s = "";
  for (let x = 0; x < 400; x += 20) {
    s += `<rect x="${x}" y="214" width="20" height="9" fill="${(x / 20) % 2 ? "#ffffff" : "#e63946"}"/>`;
    s += `<rect x="${x}" y="223" width="20" height="9" fill="${(x / 20) % 2 ? "#e63946" : "#ffffff"}"/>`;
  }
  return s + `<rect x="0" y="214" width="400" height="18" fill="none" ${L3}/>`;
}
function toldo() {
  let s = "";
  for (let i = 0; i < 10; i++) {
    const c = i % 2 ? "#ffffff" : "#e63946";
    s += `<path d="M${i * 40} 0 H${i * 40 + 40} V28 A20 16 0 0 1 ${i * 40} 28 Z" fill="${c}" ${L3}/>`;
  }
  return s;
}
function cerca() {
  let s = `<rect x="0" y="150" width="400" height="8" fill="#ffffff" ${L3}/><rect x="0" y="176" width="400" height="8" fill="#ffffff" ${L3}/>`;
  for (let x = 4; x < 400; x += 30) s += `<path d="M${x} 196 V140 L${x + 7} 130 L${x + 14} 140 V196 Z" fill="#ffffff" stroke="#111111" stroke-width="2.5"/>`;
  return s;
}

// Enfeites para os níveis de topo: coisas pequenas desenhadas no fundo, iguais nas duas imagens,
// para o olho ter mais onde procurar. Uma sequência fixa de números mantém-nas nos mesmos sítios.
function sorteio(semente) {
  let x = semente;
  return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
}
function espalhar(semente, quantos, x0, y0, x1, y1, desenho) {
  const r = sorteio(semente);
  let s = "";
  for (let i = 0; i < quantos; i++) s += desenho(Math.round(x0 + r() * (x1 - x0)), Math.round(y0 + r() * (y1 - y0)), i, r);
  return s;
}
const ENFEITES = {
  cozinha: () => {
    let s = `<path d="M14 124 H386" stroke="#555555" stroke-width="3"/>`;
    for (let x = 30; x < 380; x += 34) {
      s += (x / 34) % 2 < 1
        ? `<path d="M${x} 124 V150" stroke="#777777" stroke-width="3"/><ellipse cx="${x}" cy="155" rx="7" ry="5" fill="#9a9a9a" stroke="#333333" stroke-width="1.5"/>`
        : `<path d="M${x} 124 V146" stroke="#8b5a2b" stroke-width="3"/><rect x="${x - 5}" y="146" width="10" height="14" rx="2" fill="#c98f5a" stroke="#333333" stroke-width="1.5"/>`;
    }
    for (let y = 262; y < 330; y += 17) {
      for (let x = ((y - 262) / 17) % 2 ? 25 : 0; x < 400; x += 50) s += `<rect x="${x}" y="${y}" width="25" height="17" fill="#cfa877"/>`;
    }
    return s + espalhar(7, 26, 10, 12, 390, 92, (x, y, i) =>
      `<circle cx="${x}" cy="${y}" r="3" fill="${["#e63946", "#ffb703", "#2b9348"][i % 3]}"/>`);
  },
  jardim: () =>
    espalhar(11, 9, 10, 116, 390, 126, (x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="#3f8f2a"/>`) +
    espalhar(12, 44, 6, 202, 394, 326, (x, y) =>
      `<path d="M${x - 5} ${y} L${x - 3} ${y - 9} M${x} ${y} V${y - 11} M${x + 5} ${y} L${x + 3} ${y - 9}" stroke="#3f8f2a" stroke-width="2" stroke-linecap="round"/>`) +
    espalhar(13, 34, 6, 204, 394, 326, (x, y, i) =>
      `<circle cx="${x}" cy="${y}" r="4" fill="${["#ffffff", "#ff4d8d", "#ffb703"][i % 3]}" stroke="#111111" stroke-width="1"/><circle cx="${x}" cy="${y}" r="1.6" fill="#fb8500"/>`),
  praia: () =>
    espalhar(21, 8, 20, 18, 380, 70, (x, y) =>
      `<path d="M${x - 8} ${y} Q${x - 4} ${y - 5} ${x} ${y} Q${x + 4} ${y - 5} ${x + 8} ${y}" fill="none" stroke="#333333" stroke-width="2"/>`) +
    espalhar(22, 6, 10, 132, 390, 168, (x, y) =>
      `<path d="M${x - 12} ${y} Q${x - 6} ${y - 4} ${x} ${y} T${x + 12} ${y}" fill="none" stroke="#ffffff" stroke-width="2.5"/>`) +
    espalhar(23, 46, 8, 182, 392, 326, (x, y, i, r) =>
      i % 3 === 0
        ? `<path d="M${x - 6} ${y + 3} Q${x} ${y - 9} ${x + 6} ${y + 3} Z" fill="#ffd0b5" stroke="#8a5a3a" stroke-width="1.2"/>`
        : `<ellipse cx="${x}" cy="${y}" rx="${3 + Math.round(r() * 3)}" ry="3" fill="${["#b9a07a", "#9c8f80", "#d9c2a0"][i % 3]}"/>`),
  mercado: () => {
    let s = "";
    for (let i = 0; i < 20; i++) {
      s += `<path d="M${i * 20} 30 H${i * 20 + 20} L${i * 20 + 10} 46 Z" fill="${["#ffb703", "#2b9348", "#0a6fd6", "#ff4d8d"][i % 4]}" stroke="#111111" stroke-width="1.5"/>`;
    }
    for (const y of [141, 243]) {
      for (let x = 24; x < 390; x += 38) s += `<rect x="${x}" y="${y}" width="16" height="10" rx="2" fill="#ffffff" stroke="#111111" stroke-width="1.5"/><path d="M${x + 3} ${y + 5} H${x + 13}" stroke="#e63946" stroke-width="2"/>`;
    }
    return s + espalhar(31, 16, 14, 258, 386, 326, (x, y) => `<circle cx="${x}" cy="${y}" r="${5}" fill="#b9b0a2"/>`);
  },
  sala: () => {
    let s = "";
    for (let y = 20; y < 205; y += 36) {
      for (let x = 19; x < 400; x += 40) {
        s += `<circle cx="${x}" cy="${y}" r="5" fill="#e6a96b"/><circle cx="${x}" cy="${y}" r="2" fill="#c65a2e"/>`;
      }
    }
    return s + espalhar(41, 10, 60, 280, 340, 304, (x, y, i) =>
      `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" transform="rotate(45 ${x} ${y})" fill="${["#ffffff", "#ffb703", "#0a6fd6"][i % 3]}"/>`);
  },
};

// Filas mais cheias de objetos um pouco mais pequenos para os níveis de topo (s = 76 são cerca de
// 1,5 cm num ecrã de 7 polegadas).
const fila = (xs, base, s, tipo) => xs.map((x) => ({ x, base, s, tipo, margem: 10 }));
const DENSAS = {
  cozinha: [...fila([40, 120, 200, 280, 360], 98, 76, "prateleira"), ...fila([40, 120, 200, 280, 360], 214, 76, "mesa"),
    ...fila([90, 170, 250, 330], 328, 76, "chao")],
  jardim: [...fila([50, 150, 250, 350], 100, 76, "ceu"), ...fila([40, 120, 200, 280, 360], 226, 76, "chao"),
    ...fila([40, 120, 200, 280, 360], 328, 76, "chao")],
  praia: [...fila([50, 150, 250, 350], 92, 76, "ceu"), ...fila([110, 290], 162, 76, "mar"),
    ...fila([40, 120, 200, 280, 360], 252, 76, "areia"), ...fila([40, 120, 200, 280, 360], 329, 76, "areia")],
  mercado: [...fila([50, 125, 200, 275, 350], 130, 74, "banca"), ...fila([50, 125, 200, 275, 350], 228, 74, "banca"),
    ...fila([65, 155, 245, 335], 328, 76, "chao")],
  sala: [...fila([50, 150, 250, 350], 112, 76, "parede"), ...fila([40, 120, 200, 280, 360], 240, 76, "chao"),
    ...fila([40, 120, 200, 280, 360], 329, 76, "chao")],
};

const CENAS = [
  {
    id: "cozinha",
    fundo: `<rect width="400" height="330" fill="#fff3d6"/>${azulejos()}
<rect x="0" y="262" width="400" height="68" fill="#e0c39a"/>
<path d="M0 290 H400 M100 262 V330 M200 262 V330 M300 262 V330" stroke="#c9a77c" stroke-width="2"/>
<rect x="6" y="98" width="388" height="11" rx="3" fill="#b5652b" ${L3}/>
<rect x="22" y="232" width="16" height="98" fill="#8b5a2b" ${L3}/><rect x="362" y="232" width="16" height="98" fill="#8b5a2b" ${L3}/>
${toalhaMesa()}`,
    slots: [
      ...[50, 150, 250, 350].map((x) => ({ x, base: 98, s: 94, tipo: "prateleira" })),
      ...[50, 150, 250, 350].map((x) => ({ x, base: 215, s: 96, tipo: "mesa" })),
      ...[120, 280].map((x) => ({ x, base: 328, s: 92, tipo: "chao" })),
    ],
    pools: {
      prateleira: ["jarra", "chavena", "vasoflor", "galo", "mel", "leite", "cha", "cafe", "relogio", "livro", "coracao"],
      mesa: ["pao", "queijo", "maca", "laranja", "banana", "pera", "uvas", "bolo", "tomate", "pastel_nata", "croissant",
        "limao", "melancia", "ananas", "chavena", "jarra", "cafe", "leite", "cebola", "pimento", "castanha"],
      chao: ["gato", "cao", "cesto", "balde", "caixote", "regador", "vasoflor"],
    },
  },
  {
    id: "jardim",
    fundo: `<rect width="400" height="330" fill="#8ed1fc"/>
<ellipse cx="90" cy="168" rx="170" ry="50" fill="#5fb83a"/><ellipse cx="320" cy="172" rx="160" ry="44" fill="#68c043"/>
${cerca()}
<rect x="0" y="196" width="400" height="134" fill="#7ccf4f"/>
<path d="M150 330 Q190 260 200 196 H214 Q214 260 260 330 Z" fill="#e8d3a2"/>
<path d="M0 196 H400" stroke="#111111" stroke-width="3"/>`,
    slots: [
      ...[62, 200, 338].map((x) => ({ x, base: 102, s: 94, tipo: "ceu" })),
      ...[50, 150, 250, 350].map((x) => ({ x, base: 226, s: 96, tipo: "chao" })),
      ...[90, 200, 310].map((x) => ({ x, base: 328, s: 96, tipo: "chao" })),
    ],
    pools: {
      ceu: ["sol", "nuvem", "passaro", "borboleta", "abelha", "arco_iris", "aviao"],
      chao: ["girassol", "tulipa", "rosa", "malmequer", "margarida", "cravo", "coelho", "gato", "cao", "caracol",
        "cogumelo", "regador", "vasoflor", "balde", "galinha", "pato", "ovelha", "joaninha", "sapo", "cesto"],
    },
  },
  {
    id: "praia",
    fundo: `<rect width="400" height="116" fill="#8ed1fc"/>
<rect x="0" y="110" width="400" height="64" fill="#2a7de1"/>
<path d="M0 128 Q25 120 50 128 T100 128 T150 128 T200 128 T250 128 T300 128 T350 128 T400 128 M0 150 Q25 142 50 150 T100 150 T150 150 T200 150 T250 150 T300 150 T350 150 T400 150" fill="none" stroke="#bfe3ff" stroke-width="3"/>
<path d="M0 170 Q100 160 200 168 T400 166 V330 H0 Z" fill="#f6d58e" ${L3}/>
<g fill="#e0b866"><circle cx="40" cy="200" r="3"/><circle cx="130" cy="290" r="3"/><circle cx="230" cy="250" r="3"/><circle cx="340" cy="300" r="3"/><circle cx="380" cy="210" r="3"/><circle cx="20" cy="310" r="3"/></g>`,
    slots: [
      ...[62, 338].map((x) => ({ x, base: 96, s: 92, tipo: "ceu" })),
      { x: 200, base: 160, s: 94, tipo: "mar" },
      ...[50, 150, 250, 350].map((x) => ({ x, base: 252, s: 94, tipo: "areia" })),
      ...[90, 200, 310].map((x) => ({ x, base: 329, s: 92, tipo: "areia" })),
    ],
    pools: {
      ceu: ["sol", "nuvem", "passaro", "aviao", "arco_iris"],
      mar: ["barco", "peixe", "polvo", "baiacu", "peixe_tropical"],
      areia: ["sardinha", "caranguejo", "concha", "guardasol", "balde", "chapeu", "melancia", "guarda_chuva",
        "coral", "cesto", "polvo", "peixe"],
    },
  },
  {
    id: "mercado",
    fundo: `<rect width="400" height="330" fill="#fff3d6"/>
<rect x="0" y="240" width="400" height="90" fill="#cfc6b8"/>
<g fill="#b9b0a2"><circle cx="30" cy="300" r="10"/><circle cx="150" cy="320" r="9"/><circle cx="250" cy="296" r="10"/><circle cx="370" cy="316" r="9"/></g>
<rect x="0" y="28" width="10" height="302" fill="#8b5a2b" ${L3}/><rect x="390" y="28" width="10" height="302" fill="#8b5a2b" ${L3}/>
<rect x="6" y="130" width="388" height="10" rx="3" fill="#b5652b" ${L3}/>
<rect x="6" y="228" width="388" height="14" rx="3" fill="#b5652b" ${L3}/>
${toldo()}`,
    slots: [
      ...[55, 152, 248, 345].map((x) => ({ x, base: 130, s: 92, tipo: "banca" })),
      ...[55, 152, 248, 345].map((x) => ({ x, base: 228, s: 94, tipo: "banca" })),
      ...[100, 200, 300].map((x) => ({ x, base: 328, s: 92, tipo: "chao" })),
    ],
    pools: {
      banca: ["maca", "maca_verde", "laranja", "banana", "pera", "uvas", "melancia", "ananas", "cenoura", "couve",
        "batata", "cebola", "alho", "tomate", "pimento", "pepino", "milho", "cogumelo", "limao", "cereja", "morango",
        "castanha", "ovo", "queijo", "pao", "azeitonas"],
      chao: ["cesto", "caixote", "galinha", "balde", "gato", "cao", "melancia", "couve", "pato"],
    },
  },
  {
    id: "sala",
    fundo: `<rect width="400" height="330" fill="#f9e4c8"/>
<g fill="#f2d4ac">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<rect x="${k * 40 + 10}" y="0" width="18" height="216"/>`).join("")}</g>
<rect x="0" y="220" width="400" height="110" fill="#c98f5a"/>
<path d="M0 252 H400 M0 286 H400 M0 316 H400" stroke="#a8713f" stroke-width="2"/>
<rect x="0" y="212" width="400" height="10" fill="#8b5a2b" ${L3}/>
<ellipse cx="200" cy="292" rx="175" ry="32" fill="#e63946" ${L3}/>
<ellipse cx="200" cy="292" rx="150" ry="22" fill="none" stroke="#ffb703" stroke-width="4" stroke-dasharray="10 8"/>`,
    slots: [
      ...[62, 200, 338].map((x) => ({ x, base: 112, s: 94, tipo: "parede" })),
      ...[50, 150, 250, 350].map((x) => ({ x, base: 240, s: 96, tipo: "chao" })),
      ...[90, 200, 310].map((x) => ({ x, base: 329, s: 92, tipo: "chao" })),
    ],
    pools: {
      parede: ["quadro", "relogio", "janela", "galo", "guitarra", "coracao"],
      chao: ["sofa", "cadeira", "candeeiro", "almofada", "gato", "cao", "livro", "telefone", "vela", "vasoflor",
        "jarra", "cesto", "urso", "cartas", "chapeu", "guitarra"],
    },
  },
];

export const NOMES_CENAS = CENAS.map((c) => c.id);

const acaso = (lista) => lista[Math.floor(Math.random() * lista.length)];
function baralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function outraCor(c, subtil) {
  if (subtil) return acaso(VIZINHAS[c]);
  const longe = CORES.filter((x) => x !== c && !VIZINHAS[c].includes(x));
  return acaso(longe);
}

function zona(slot) {
  return { x: slot.x, y: slot.base - slot.s / 2, r: slot.s / 2 + (slot.margem ?? 18), s: slot.s };
}

const enfeitesFeitos = {};
function enfeites(id) {
  enfeitesFeitos[id] ??= ENFEITES[id]();
  return enfeitesFeitos[id];
}

// Uma tentativa de cena com `quantas` diferenças dos tipos dados.
// op.densa: as filas mais cheias de objetos mais pequenos; op.enfeites: enfeites no fundo.
function tentar(cena, quantas, tipos, subtil, op = {}) {
  const base = op.densa ? DENSAS[cena.id] : cena.slots;
  const slots = base.map((s, i) => ({ ...s, i, x: s.x + Math.round(Math.random() * (op.densa ? 4 : 8) - (op.densa ? 2 : 4)) }));
  const usados = new Set();
  function novoObjeto(tipo) {
    const livres = cena.pools[tipo].filter((id) => !usados.has(id));
    if (!livres.length) return null;
    // Os objetos desenhados (que podem mudar de cor) um pouco mais vezes.
    const desenhos = livres.filter((id) => OBJ[id].desenho);
    const id = desenhos.length && Math.random() < 0.35 ? acaso(desenhos) : acaso(livres);
    usados.add(id);
    return OBJ[id];
  }
  function novoItem(slot) {
    const obj = novoObjeto(slot.tipo);
    if (!obj) return null;
    // Nas filas cheias os objetos mantêm o tamanho inteiro, para cada mudança ter pelo menos 1,4 cm.
    const escala = subtil && !op.densa && Math.random() < 0.35 ? 0.82 : 1;
    return { slot, obj, cor: obj.desenho ? acaso(CORES) : null, matiz: 0, escala, espelho: false, semDetalhe: false };
  }

  const ocupar = Math.round(slots.length * (op.densa ? 0.8 : 0.68));
  const ordem = baralhar(slots);
  const itens = [];
  for (const s of ordem.slice(0, ocupar)) {
    const it = novoItem(s);
    if (it) itens.push(it);
  }
  const ocupados = new Set(itens.map((it) => it.slot.i));
  const A = itens.map((it) => ({ ...it }));
  const B = itens.map((it) => ({ ...it }));
  const tocados = new Set();
  const difs = [];

  const livreOcupado = () => baralhar(slots.filter((s) => ocupados.has(s.i) && !tocados.has(s.i)));
  const livreVazio = () => baralhar(slots.filter((s) => !ocupados.has(s.i) && !tocados.has(s.i)));

  const aplicar = {
    falta(alvo) {
      const s = livreOcupado()[0];
      if (!s) return null;
      alvo.splice(alvo.findIndex((it) => it.slot.i === s.i), 1);
      return { slots: [s] };
    },
    extra(alvo) {
      for (const s of livreVazio()) {
        const it = novoItem(s);
        if (!it) continue;
        alvo.push(it);
        return { slots: [s] };
      }
      return null;
    },
    cor(alvo) {
      for (const s of livreOcupado()) {
        const it = alvo.find((x) => x.slot.i === s.i);
        if (it.obj.desenho) it.cor = outraCor(it.cor, subtil);
        else if (it.obj.matiz) it.matiz = subtil ? 70 : 160;
        else continue;
        return { slots: [s] };
      }
      return null;
    },
    troca(alvo) {
      for (const s of livreOcupado()) {
        const obj = novoObjeto(s.tipo);
        if (!obj) continue;
        const k = alvo.findIndex((x) => x.slot.i === s.i);
        alvo[k] = { ...alvo[k], obj, cor: obj.desenho ? acaso(CORES) : null, matiz: 0, espelho: false, semDetalhe: false };
        return { slots: [s] };
      }
      return null;
    },
    // Tipos mais subtis para os níveis de topo: o objeto olha para o outro lado, perde uma parte
    // pequena, ou é mais pequeno.
    espelho(alvo) {
      for (const s of livreOcupado()) {
        const it = alvo.find((x) => x.slot.i === s.i);
        if (!ASSIMETRICOS.has(it.obj.id)) continue;
        it.espelho = !it.espelho;
        return { slots: [s] };
      }
      return null;
    },
    detalhe(alvo) {
      for (const s of livreOcupado()) {
        const it = alvo.find((x) => x.slot.i === s.i);
        if (!it.obj.desenho) continue;
        it.semDetalhe = true;
        return { slots: [s] };
      }
      return null;
    },
    tamanho(alvo) {
      const s = livreOcupado()[0];
      if (!s) return null;
      const it = alvo.find((x) => x.slot.i === s.i);
      it.escala = it.escala < 1 ? 1 : 0.68;
      return { slots: [s] };
    },
    move(alvo) {
      for (const s of livreOcupado()) {
        const destino = livreVazio().find((v) => v.tipo === s.tipo);
        if (!destino) continue;
        const k = alvo.findIndex((x) => x.slot.i === s.i);
        alvo[k] = { ...alvo[k], slot: destino };
        return { slots: [s, destino] };
      }
      return null;
    },
  };

  for (let k = 0; k < quantas; k++) {
    let feito = null;
    let tipoFeito = null;
    for (const tipo of baralhar(tipos)) {
      const alvo = Math.random() < 0.5 ? A : B;
      feito = aplicar[tipo](alvo);
      if (feito) { tipoFeito = tipo; break; }
    }
    if (!feito) return null;
    feito.slots.forEach((s) => tocados.add(s.i));
    difs.push({ tipo: tipoFeito, zonas: feito.slots.map(zona), achada: false });
  }
  const fundo = op.enfeites ? cena.fundo + enfeites(cena.id) : cena.fundo;
  return { cena: cena.id, fundo, A, B, difs };
}

// Um desafio novo: uma cena (que não `evitar`), as suas duas imagens e a lista das diferenças.
export function gerar(quantas, tipos, subtil, evitar, op = {}) {
  const escolha = baralhar(CENAS.filter((c) => c.id !== evitar));
  for (let tent = 0; tent < 40; tent++) {
    const r = tentar(escolha[tent % escolha.length], quantas, tipos, subtil, op);
    if (r) return r;
  }
  // Muito improvável: voltar aos tipos mais simples.
  return tentar(escolha[0], quantas, ["falta", "extra"], false, op);
}

function desenharItem(it, pref) {
  const s = it.slot.s * it.escala;
  const x = (it.slot.x - s / 2).toFixed(1);
  const y = (it.slot.base - s).toFixed(1);
  let fig;
  if (it.obj.desenho) {
    fig = `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 100 100" overflow="visible">${it.obj.desenho(it.cor, it.semDetalhe)}</svg>`;
  } else {
    const filtro = it.matiz ? ` filter="url(#${pref}m${it.matiz})"` : "";
    fig = `<image href="${it.obj.src}" x="${x}" y="${y}" width="${s}" height="${s}" preserveAspectRatio="xMidYMax meet"${filtro}/>`;
  }
  // Espelhado em torno da linha central do próprio objeto.
  return it.espelho ? `<g transform="translate(${2 * it.slot.x} 0) scale(-1 1)">${fig}</g>` : fig;
}

// O SVG de uma imagem. `pref` mantém separados os ids dos filtros das duas imagens.
export function svgImagem(fundo, itens, pref) {
  const matizes = [...new Set(itens.filter((it) => it.matiz).map((it) => it.matiz))];
  const defs = matizes.map((m) => `<filter id="${pref}m${m}" color-interpolation-filters="sRGB"><feColorMatrix type="hueRotate" values="${m}"/></filter>`).join("");
  const objetos = [...itens].sort((a, b) => a.slot.base - b.slot.base).map((it) => desenharItem(it, pref)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA} ${ALTURA}" preserveAspectRatio="xMidYMid meet"><defs>${defs}</defs>${fundo}${objetos}<g class="dif-marcas"></g></svg>`;
}
