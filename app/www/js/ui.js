// Peças de ecrã partilhadas: elementos, a barra de cima com a casinha e o gato, as festas, o prémio.

import * as som from "./som.js";
import * as azulejos from "./azulejos.js";
import { ultimaRonda } from "./estado.js";

export function el(tag, atributos = {}, filhos = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos)) {
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "style") {
      // O setProperty também trata das variáveis CSS como --lado, que a atribuição simples ignora.
      for (const [p, val] of Object.entries(v)) {
        if (p.startsWith("--")) e.style.setProperty(p, val);
        else e.style[p] = val;
      }
    }
    else e.setAttribute(k, v);
  }
  for (const f of [].concat(filhos)) {
    if (f == null) continue;
    e.append(f instanceof Node ? f : document.createTextNode(f));
  }
  return e;
}

// Carrega css/jogos/<id>.css uma vez. Cada jogo tem lá os seus estilos.
// Devolve uma promessa que se cumpre quando os estilos estão aplicados, para os jogos que medem a sua disposição.
const estilos = new Map();
export function estilo(id) {
  if (estilos.has(id)) return estilos.get(id);
  const link = el("link", { rel: "stylesheet", href: `css/jogos/${id}.css`, "data-jogo": id });
  const pronto = new Promise((ok) => { link.onload = ok; link.onerror = ok; });
  document.head.append(link);
  estilos.set(id, pronto);
  return pronto;
}

export function img(src, alt = "") {
  return el("img", { src, alt, draggable: "false" });
}

export const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// A coisa mais pequena em que o dedo tem de acertar: 1,8 cm. O Android desenha a 160 px CSS por
// polegada, por isso 1,8 cm são cerca de 113 px CSS em qualquer tablet Android.
export const ALVO_MIN = 113;

// A melhor grelha para n peças quadradas iguais numa caixa: devolve { cols, linhas, lado } com o
// maior lado que cabe, usando `folga` (0..1) de cada casa para a peça em si.
export function grelha(n, largura, altura, folga = 0.86) {
  let melhor = null;
  for (let cols = 1; cols <= n; cols++) {
    const linhas = Math.ceil(n / cols);
    const lado = Math.floor(Math.min(largura / cols, altura / linhas) * folga);
    if (!melhor || lado > melhor.lado) melhor = { cols, linhas, lado };
  }
  return melhor;
}

// Quantas peças quadradas de pelo menos ALVO_MIN cabem numa caixa. Os jogos usam isto para limitar
// um nível num ecrã pequeno: um nível que precisaria de mais peças desce para o que cabe.
export function cabem(largura, altura, folga = 0.86, minimo = ALVO_MIN) {
  const porLado = minimo / folga;
  return Math.floor(largura / porLado) * Math.floor(altura / porLado);
}

// O gato pisca os olhos de vez em quando: troca para a imagem de olhos fechados por um instante, só
// enquanto mostra a cara simples a sorrir. Para sozinho quando o ecrã desaparece.
const OLHOS_ABERTOS = "img/noto/gato_sorri.svg";
const OLHOS_FECHADOS = "img/noto/gato_pisca.svg";
new Image().src = OLHOS_FECHADOS;
function piscar(mascote) {
  const proximo = () => setTimeout(passo, 3500 + Math.random() * 4000);
  function passo() {
    if (!mascote.isConnected) return;
    if (!document.hidden && mascote.getAttribute("src") === OLHOS_ABERTOS) {
      mascote.setAttribute("src", OLHOS_FECHADOS);
      setTimeout(() => {
        if (mascote.getAttribute("src") === OLHOS_FECHADOS) mascote.setAttribute("src", OLHOS_ABERTOS);
      }, 170);
    }
    proximo();
  }
  proximo();
}

// Um ecrã com a barra de cima. onCasa é chamado pelo botão grande da casinha (não existe no ecrã inicial).
export function ecra(onCasa, extraTopo = []) {
  const balao = el("div", { class: "balao vazio" });
  const mascote = img("img/noto/gato_sorri.svg", "");
  mascote.className = "mascote";
  const topo = el("div", { class: "topo" }, [
    onCasa
      ? el("button", {
          class: "botao-casa",
          "aria-label": "Início",
          onclick: () => { som.calar(); som.efeito("voltar"); onCasa(); },
        }, [img("img/noto/casa.svg", "Início")])
      : null,
    mascote,
    balao,
    ...extraTopo,
  ]);
  const corpo = el("div", { class: "corpo" });
  const raiz = el("div", { class: "ecra" }, [topo, corpo]);
  piscar(mascote);

  // Mostra a frase no balão e di-la.
  async function dizer(id, { cara } = {}) {
    escrever(som.texto(id));
    mascote.src = cara || "img/noto/gato_sorri.svg";
    mascote.classList.remove("salta");
    void mascote.offsetWidth;
    mascote.classList.add("salta");
    await som.falar(id);
  }

  function mostrar(textoLivre) {
    escrever(textoLivre);
  }

  // O balão tem altura fixa (duas linhas). Uma frase mais comprida (o título de uma música, uma
  // adivinha longa) encolhe aos poucos, até 65 %, em vez de ficar cortada em cima e em baixo.
  function escrever(texto) {
    balao.textContent = texto;
    balao.classList.remove("vazio");
    balao.style.fontSize = "";
    if (balao.scrollHeight <= balao.clientHeight) return;
    const base = parseFloat(getComputedStyle(balao).fontSize);
    for (let escala = 0.95; escala >= 0.65; escala -= 0.05) {
      balao.style.fontSize = `${Math.round(base * escala)}px`;
      if (balao.scrollHeight <= balao.clientHeight) return;
    }
  }

  return { raiz, corpo, dizer, mostrar, balao, mascote };
}

const CORES = ["#e63946", "#ffb703", "#0a6fd6", "#2b9348", "#7b2cbf", "#ff4d8d", "#fb8500"];

export function confetes(onde, quantos = 60) {
  const camada = el("div", { class: "confete" });
  for (let i = 0; i < quantos; i++) {
    camada.append(el("i", {
      style: {
        left: `${Math.random() * 100}%`,
        background: CORES[i % CORES.length],
        animationDuration: `${2 + Math.random() * 2}s`,
        animationDelay: `${Math.random() * 0.8}s`,
      },
    }));
  }
  onde.append(camada);
  setTimeout(() => camada.remove(), 5000);
}

// Fim de uma ronda: confetes, um azulejo novo, elogio, e depois "outra vez" ou "início".
// Resolve com "outra" ou "casa".
export function premio(e, onde) {
  return new Promise(async (resolver) => {
    const n = azulejos.ganhar();
    const r = ultimaRonda();
    const camada = el("div", { class: "premio" });
    const estrelas = el("div", { class: "estrelas" });
    const grande = el("div", { class: "azulejo-grande", html: azulejos.svgAzulejo(n) });
    const frase = el("div", { class: "frase" }, som.texto("geral.azulejo_novo"));
    const acoes = el("div", { class: "acoes" });
    if (r) camada.append(estrelas);
    camada.append(grande, frase, acoes);
    onde.append(camada);
    confetes(onde);
    som.efeito("vitoria", 0.6);
    // As estrelas aparecem uma a uma: 3 numa ronda claramente fácil, 1 numa difícil, nunca nenhuma.
    if (r) {
      for (let i = 0; i < 3; i++) {
        await espera(350);
        if (!camada.isConnected) return;
        const s = img("img/noto/estrela.svg", "");
        s.className = i < r.estrelas ? "ganha" : "apagada";
        estrelas.append(s);
        if (i < r.estrelas) som.efeito("marcar", 0.5);
      }
    }
    await espera(500);
    if (!camada.isConnected) return;   // a pessoa saiu (botão de voltar do Android): ficar em silêncio
    som.efeito("azulejo");
    await som.falar("geral.azulejo_novo");
    if (!camada.isConnected) return;
    // No máximo uma festa a mais, a mais especial primeiro.
    const marco = r && [100, 50, 25, 10].find((m) => r.vitorias === m);
    const extra = !r ? null
      : marco ? `geral.marco_${marco}`
      : r.subiu ? "geral.subiu"
      : r.estrelas === 3 ? "geral.tres_estrelas"
      : r.seguidas >= 3 && r.seguidas % 3 === 0 ? "geral.sequencia_vitorias"
      : null;
    if (extra) {
      frase.textContent = som.texto(extra);
      if (marco || r.subiu) confetes(onde, 90);
      await som.falar(extra);
    } else if (Math.random() < 0.15) await som.falar("geral.gosto");
    if (!camada.isConnected) return;
    const fechar = (r) => { camada.remove(); resolver(r); };
    acoes.append(
      el("button", { class: "botao cor-verde", onclick: () => { som.efeito("toque"); fechar("outra"); } }, "Outra vez"),
      el("button", { class: "botao cor-amarelo", onclick: () => { som.efeito("voltar"); fechar("casa"); } },
        [img("img/noto/casa.svg", ""), "Início"]),
    );
    await som.falar("geral.outra_vez");
  });
}
