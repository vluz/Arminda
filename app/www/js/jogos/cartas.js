// Cartas de jogar partilhadas pela Bisca, pela Sueca e pela Paciência: baralho, baralhar, nomes e
// faces de carta grandes e claras.
// Uma carta é { naipe, valor } com valor de 1 a 13 (1 = Ás, 11 = Valete, 12 = Dama, 13 = Rei).

import { el, img, estilo } from "../ui.js";

export const NAIPES = ["copas", "ouros", "espadas", "paus"];
export const vermelha = (c) => c.naipe === "copas" || c.naipe === "ouros";

// Baralho português de 40 cartas: sem 8, 9 nem 10.
export function baralho40() {
  const b = [];
  for (const naipe of NAIPES) for (const valor of [1, 2, 3, 4, 5, 6, 7, 11, 12, 13]) b.push({ naipe, valor });
  return b;
}

export function baralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CHAVES = ["", "as", "dois", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "valete", "dama", "rei"];
const ROTULOS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "V", "D", "R"];

// Chave do nome dito, por exemplo "copas_as" (as frases estão em tools/falas/bisca.json).
export const chave = (c) => `${c.naipe}_${CHAVES[c.valor]}`;
export const igual = (a, b) => a && b && a.naipe === b.naipe && a.valor === b.valor;

// Bisca e Sueca: ordem de força e pontos das cartas.
const ORDEM = [2, 3, 4, 5, 6, 12, 11, 13, 7, 1];
export const forca = (c) => ORDEM.indexOf(c.valor);
export const pontos = (c) => ({ 1: 11, 7: 10, 13: 4, 11: 3, 12: 2 })[c.valor] || 0;

// Símbolos dos naipes desenhados como traçados, para todos os tablets mostrarem a mesma forma e cor.
const NS = "http://www.w3.org/2000/svg";
const FORMAS = {
  copas: '<path d="M50 92C22 68 3 50 7 28C11 8 38 4 50 27C62 4 89 8 93 28C97 50 78 68 50 92Z"/>',
  ouros: '<path d="M50 3L89 50L50 97L11 50Z"/>',
  espadas: '<path d="M50 4C38 26 7 42 8 64C9 82 33 87 45 73C44 84 39 91 30 97H70C61 91 56 84 55 73C67 87 91 82 92 64C93 42 62 26 50 4Z"/>',
  paus: '<circle cx="50" cy="27" r="21"/><circle cx="25" cy="58" r="21"/><circle cx="75" cy="58" r="21"/>'
    + '<path d="M44 50H56V70C57 82 62 90 70 97H30C38 90 43 82 44 70Z"/><circle cx="50" cy="52" r="10"/>',
};

export function simbolo(naipe, classe = "") {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 100 100");
  s.setAttribute("class", `cj-simbolo ${classe}`);
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = FORMAS[naipe];
  return s;
}

const FIGURAS = { 11: "img/noto/principe.svg", 12: "img/noto/princesa.svg", 13: "img/noto/coroa.svg" };

// A face de uma carta. w e h em px CSS. Opções: tag ("div" ou "button"), classe.
export function carta(c, w, h, { tag = "div", classe = "" } = {}) {
  estilo("cartas");
  const centro = el("div", { class: "cj-centro" });
  if (FIGURAS[c.valor]) centro.append(img(FIGURAS[c.valor], ""));
  else centro.append(simbolo(c.naipe));
  const e = el(tag, {
    class: `cj ${vermelha(c) ? "cj-vermelha" : "cj-preta"} ${classe}`,
    style: { "--w": `${Math.round(w)}px`, "--h": `${Math.round(h)}px` },
  }, [
    el("div", { class: "cj-canto" }, [el("span", { class: "cj-valor" }, ROTULOS[c.valor]), simbolo(c.naipe)]),
    centro,
  ]);
  e.dataset.carta = chave(c);
  return e;
}

// As costas de uma carta.
export function verso(w, h, { tag = "div", classe = "" } = {}) {
  estilo("cartas");
  return el(tag, { class: `cj cj-verso ${classe}`, style: { "--w": `${Math.round(w)}px`, "--h": `${Math.round(h)}px` } });
}

// Um lugar vazio na mesa, com um símbolo de naipe ténue se se quiser.
export function lugar(w, h, naipe = null, classe = "") {
  estilo("cartas");
  return el("div", { class: `cj cj-lugar ${classe}`, style: { "--w": `${Math.round(w)}px`, "--h": `${Math.round(h)}px` } },
    naipe ? [simbolo(naipe, "cj-marca")] : []);
}
