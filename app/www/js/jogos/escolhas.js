// Peças partilhadas pelos jogos de "tocar no certo" (Cores, O intruso, Adivinhas): a disposição
// dos botões grandes de opção, a espera pelo toque certo, a sensação de jogo (barra de progresso,
// emblema de acertos seguidos, sininho a subir) e a conferência de "melhor do que da última vez".

import * as som from "../som.js";
import { el, estilo, grelha, ALVO_MIN } from "../ui.js";
import { ler, gravar } from "../estado.js";

export function baralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const ao = (lista) => lista[Math.floor(Math.random() * lista.length)];

// Carrega os estilos partilhados e os do próprio jogo, e resolve quando os dois estão aplicados.
export function estilos(id) {
  return Promise.all([estilo("escolhas"), estilo(id)]);
}

export function abanar(b) {
  b.classList.remove("abana");
  void b.offsetWidth;
  b.classList.add("abana");
}

// Botões quadrados para n opções numa caixa: { cols, lado }, nunca acima de `teto` px.
export function quadrados(n, largura, altura, teto = 320) {
  const g = grelha(n, largura, altura, 0.88);
  return { cols: g.cols, lado: Math.max(ALVO_MIN, Math.min(teto, g.lado)) };
}

// Botões largos para palavras: { cols, larg, alt } com a largura cerca de `prop` vezes a altura.
export function retangulos(n, largura, altura, prop = 2.4, tetoAlt = 170) {
  let melhor = null;
  for (let cols = 1; cols <= n; cols++) {
    const linhas = Math.ceil(n / cols);
    const alt = Math.min(altura / linhas, largura / cols / prop) * 0.86;
    if (!melhor || alt > melhor.alt) melhor = { cols, alt };
  }
  const alt = Math.max(ALVO_MIN, Math.min(tetoAlt, Math.floor(melhor.alt)));
  const larg = Math.floor(Math.min(largura / melhor.cols * 0.92, alt * prop * 1.15));
  return { cols: melhor.cols, larg, alt };
}

// Encolhe o texto de um elemento até caber na sua caixa.
export function caberTexto(no, maximo, minimo = 18) {
  let t = maximo;
  no.style.fontSize = `${t}px`;
  while (t > minimo && (no.scrollWidth > no.clientWidth + 1 || no.scrollHeight > no.clientHeight + 1)) {
    t -= 2;
    no.style.fontSize = `${t}px`;
  }
  return t;
}

// Espera pelo botão certo. Um botão errado abana, esbate-se e toca o som suave; ao fim de
// `pistaApos` erros o certo pisca. Resolve com { erros, ms, pista, errados }.
export function esperarCerta(botoes, certa, { ativo, aoErrar, pistaApos = 2 } = {}) {
  return new Promise((fim) => {
    const t0 = Date.now();
    let erros = 0;
    let pista = false;
    let feito = false;
    const errados = [];
    for (const b of botoes) {
      b.addEventListener("click", () => {
        if (feito || (ativo && !ativo())) return;
        if (b === certa) {
          feito = true;
          b.classList.remove("pista");
          b.classList.add("certa");
          fim({ erros, ms: Date.now() - t0, pista, errados });
          return;
        }
        if (b.classList.contains("errada")) return;
        erros++;
        errados.push(b);
        b.classList.add("errada");
        abanar(b);
        som.efeito("quase", 0.4);
        if (aoErrar) aoErrar(b, erros);
        if (erros >= pistaApos && !pista) {
          pista = true;
          certa.classList.add("pista");
        }
      });
    }
  });
}

// Um sininho curto cujo tom sobe com os acertos seguidos (degraus pentatónicos, com limite).
let ctx = null;
const NOTAS = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
export function sino(passo) {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const f = NOTAS[Math.min(NOTAS.length - 1, Math.max(0, passo))];
    const t = ctx.currentTime;
    for (const [mult, vol] of [[1, 0.22], [2, 0.08]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f * mult;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.52);
    }
  } catch {
    // Não haver som nunca é um problema.
  }
}

// Sensação de jogo: uma barra de progresso em baixo, um emblema de acertos seguidos, um sininho a
// subir por cada resposta certa de seguida e uma festa a cada cinco.
export function criarRitmo(raiz, total) {
  const barra = el("div", { class: "esc-barra" }, [el("i")]);
  const selo = el("div", { class: "esc-selo" });
  raiz.append(barra, selo);
  let feitos = 0;
  let seguidas = 0;
  let melhorSeguidas = 0;
  return {
    avancar() {
      feitos++;
      barra.firstChild.style.width = `${Math.min(100, (feitos / total) * 100)}%`;
    },
    certo(primeira) {
      if (!primeira) { seguidas = 0; som.efeito("par", 0.6); return; }
      seguidas++;
      melhorSeguidas = Math.max(melhorSeguidas, seguidas);
      sino(seguidas - 1);
      if (seguidas % 5 === 0) setTimeout(() => som.efeito(seguidas % 10 === 0 ? "vitoria2" : "linha", 0.5), 250);
      if (seguidas >= 3) {
        selo.textContent = `${seguidas} certas seguidas!`;
        selo.classList.remove("mostra");
        void selo.offsetWidth;
        selo.classList.add("mostra");
      }
    },
    get seguidas() { return seguidas; },
    get melhorSeguidas() { return melhorSeguidas; },
    remover() { barra.remove(); selo.remove(); },
  };
}

// Verdadeiro quando esta ronda neste nível foi melhor do que a última no mesmo nível. Guarda esta.
export function melhorQueAntes(id, n, pontos) {
  const antes = ler(`${id}.ultima`, null);
  gravar(`${id}.ultima`, { nivel: n, pontos });
  return !!antes && antes.nivel === n && pontos > antes.pontos;
}
