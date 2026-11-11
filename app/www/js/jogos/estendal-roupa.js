// Estendal: roupa desenhada como imagens SVG de traço forte (desenhos nossos), e as peças com nome que o gato pede.
// Cada imagem é um endereço de dados, por isso os ids dos padrões lá dentro nunca chocam com os de outra imagem.

export const CORES = {
  azul: "#1f6fe0",
  vermelho: "#e63946",
  amarelo: "#ffc21a",
  verde: "#2b9348",
  rosa: "#ff6fa8",
  laranja: "#fb8500",
  roxo: "#8e44c9",
};

const LINHA = "#111111";

// Contornos numa caixa de 100 x 100; a borda de cima é onde a mola a segura.
const FORMAS = {
  camisola: "M32 10 L42 6 Q50 15 58 6 L68 10 L94 30 L82 47 L72 39 L72 94 L28 94 L28 39 L18 47 L6 30 Z",
  toalha: "M12 8 H88 V84 H12 Z",
  avental: "M35 8 H65 V28 Q81 30 85 38 L81 94 H19 L15 38 Q19 30 35 28 Z",
  calcas: "M20 8 H80 L86 94 H59 L50 40 L41 94 H14 Z",
  vestido: "M37 6 H63 L64 28 Q70 30 72 36 L88 94 H12 L28 36 Q30 30 36 28 Z",
};
const MEIA = "M18 6 H42 V56 Q42 62 48 66 L62 74 Q72 82 64 92 Q58 97 48 92 L26 80 Q18 75 18 66 Z";

function enchimento(cor, padrao, clip) {
  const base = `<rect x="0" y="0" width="100" height="100" fill="${cor}"/>`;
  let extra = "";
  if (padrao === "riscas") {
    for (let y = 12; y < 100; y += 17) extra += `<rect x="-2" y="${y}" width="104" height="7" fill="#ffffff" stroke="${LINHA}" stroke-width="1.6"/>`;
  } else if (padrao === "bolinhas") {
    let fila = 0;
    for (let y = 14; y < 100; y += 16, fila++) {
      for (let x = fila % 2 ? 18 : 10; x < 100; x += 16) extra += `<circle cx="${x}" cy="${y}" r="4.6" fill="#ffffff" stroke="${LINHA}" stroke-width="1.6"/>`;
    }
  }
  return `<g clip-path="url(#${clip})">${base}${extra}</g>`;
}

function peca(d, cor, padrao, id, transform = "") {
  return `<g${transform ? ` transform="${transform}"` : ""}><clipPath id="${id}"><path d="${d}"/></clipPath>` +
    enchimento(cor, padrao, id) +
    `<path d="${d}" fill="none" stroke="${LINHA}" stroke-width="4.5" stroke-linejoin="round"/></g>`;
}

// Pequenos pormenores desenhados por cima: franja da toalha, bolso do avental, cós.
function detalhes(tipo) {
  const s = `stroke="${LINHA}" stroke-width="3.5" stroke-linecap="round" fill="none"`;
  switch (tipo) {
    case "toalha":
      return `<path d="M20 84 V94 M30 84 V94 M40 84 V94 M50 84 V94 M60 84 V94 M70 84 V94 M80 84 V94" ${s}/>` +
        `<path d="M12 70 H88" ${s}/>`;
    case "avental":
      return `<rect x="38" y="58" width="24" height="17" rx="3" fill="#ffffff" stroke="${LINHA}" stroke-width="3.5"/>` +
        `<path d="M15 40 Q6 44 4 54 M85 40 Q94 44 96 54" ${s}/>`;
    case "calcas":
      return `<path d="M20 18 H80" ${s}/>`;
    case "vestido":
      return `<path d="M29 40 H71" ${s}/>`;
    case "camisola":
      return `<path d="M42 6 Q50 15 58 6" ${s}/>`;
    default:
      return "";
  }
}

// tipo: camisola, meias (um par), meia (uma só), toalha, avental, calcas, vestido.
export function svgRoupa(tipo, cor, padrao = "lisa") {
  const c = CORES[cor] || cor;
  let corpo;
  if (tipo === "meias") {
    corpo = peca(MEIA, c, padrao, "a", "translate(0 4) scale(0.9)") + peca(MEIA, c, padrao, "b", "translate(34 0) scale(0.9)");
  } else if (tipo === "meia") {
    corpo = peca(MEIA, c, padrao, "a", "translate(8 0)");
  } else {
    corpo = peca(FORMAS[tipo], c, padrao, "a") + detalhes(tipo);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${corpo}</svg>`;
}

export function urlRoupa(tipo, cor, padrao) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgRoupa(tipo, cor, padrao))}`;
}

// As peças que o gato pode pedir pelo nome (ditas como estendal.p_<id> e estendal.d_<id>).
// Os pares que diferem numa só coisa (cor, tipo ou padrão) tornam os níveis de pedidos mais difíceis.
export const CATALOGO = [
  { id: "camisola_azul", tipo: "camisola", cor: "azul", padrao: "lisa" },
  { id: "camisola_vermelha", tipo: "camisola", cor: "vermelho", padrao: "lisa" },
  { id: "camisola_verde_riscas", tipo: "camisola", cor: "verde", padrao: "riscas" },
  { id: "camisola_amarela", tipo: "camisola", cor: "amarelo", padrao: "lisa" },
  { id: "camisola_azul_riscas", tipo: "camisola", cor: "azul", padrao: "riscas" },
  { id: "meias_azuis", tipo: "meias", cor: "azul", padrao: "lisa" },
  { id: "meias_vermelhas", tipo: "meias", cor: "vermelho", padrao: "lisa" },
  { id: "meias_riscadas", tipo: "meias", cor: "vermelho", padrao: "riscas" },
  { id: "meias_amarelas_bolinhas", tipo: "meias", cor: "amarelo", padrao: "bolinhas" },
  { id: "toalha_amarela", tipo: "toalha", cor: "amarelo", padrao: "lisa" },
  { id: "toalha_azul", tipo: "toalha", cor: "azul", padrao: "lisa" },
  { id: "toalha_rosa_riscas", tipo: "toalha", cor: "rosa", padrao: "riscas" },
  { id: "avental_vermelho_bolinhas", tipo: "avental", cor: "vermelho", padrao: "bolinhas" },
  { id: "avental_azul", tipo: "avental", cor: "azul", padrao: "lisa" },
  { id: "avental_verde", tipo: "avental", cor: "verde", padrao: "lisa" },
  { id: "calcas_azuis", tipo: "calcas", cor: "azul", padrao: "lisa" },
  { id: "vestido_rosa", tipo: "vestido", cor: "rosa", padrao: "lisa" },
  { id: "vestido_amarelo_bolinhas", tipo: "vestido", cor: "amarelo", padrao: "bolinhas" },
];

export const TIPOS = ["camisola", "meias", "toalha", "avental", "calcas", "vestido"];
export const PADROES = ["lisa", "riscas", "bolinhas"];
