// Sequência: um jogo de memória do género "o mestre manda". Botões grandes e coloridos, cada um
// com a sua imagem e a sua nota musical, acendem-se numa sequência; depois a pessoa repete-a,
// tocando. Cada repetição certa junta mais um passo. Um erro nunca é castigado: a sequência é
// mostrada outra vez, devagar. Ao fim de dois erros no mesmo comprimento a ronda acaba em festa,
// com a sequência mais comprida que a pessoa repetiu.
// Nível de topo: a pessoa repete a sequência ao contrário.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel } from "../estado.js";
import { el, ecra, espera, premio, estilo, grelha } from "../ui.js";

const ID = "sequencia";

// Imagens brancas simples com contorno escuro, desenhadas numa caixa de 100x100.
const TRACO = `fill="#ffffff" stroke="#111111" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;
function estrela() {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 18 : 42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    p.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(54 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${p.join(" ")}" ${TRACO}/>`;
}
function sol() {
  let raios = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x1 = 50 + 29 * Math.cos(a);
    const y1 = 50 + 29 * Math.sin(a);
    const x2 = 50 + 43 * Math.cos(a);
    const y2 = 50 + 43 * Math.sin(a);
    raios += `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} `;
  }
  return `<path d="${raios}" stroke="#111111" stroke-width="14" stroke-linecap="round"/>
<path d="${raios}" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
<circle cx="50" cy="50" r="21" ${TRACO}/>`;
}
const DESENHOS = {
  coracao: `<path d="M50 86 C22 66 8 48 13 31 C18 14 42 11 50 30 C58 11 82 14 87 31 C92 48 78 66 50 86 Z" ${TRACO}/>`,
  gota: `<path d="M50 10 C62 32 78 48 78 64 A28 28 0 0 1 22 64 C22 48 38 32 50 10 Z" ${TRACO}/>`,
  folha: `<path d="M50 8 C82 30 84 64 50 92 C16 64 18 30 50 8 Z" ${TRACO}/><path d="M50 26 V80" stroke="#111111" stroke-width="5" stroke-linecap="round"/>`,
  sol: sol(),
  lua: `<path d="M60 12 A40 40 0 1 0 90 66 A31 31 0 1 1 60 12 Z" ${TRACO}/>`,
  estrela: estrela(),
};

// Cor, imagem e nota de cada botão. As três primeiras fazem um acorde maior.
const BOTOES = [
  { cor: "#e63946", fig: "coracao", nota: 523.25 }, // vermelho, dó 5
  { cor: "#0a6fd6", fig: "gota", nota: 659.25 },    // azul, mi 5
  { cor: "#2b9348", fig: "folha", nota: 783.99 },   // verde, sol 5
  { cor: "#ffb703", fig: "sol", nota: 587.33 },     // amarelo, ré 5
  { cor: "#7b2cbf", fig: "lua", nota: 880.0 },      // roxo, lá 5
  { cor: "#fb8500", fig: "estrela", nota: 1046.5 }, // laranja, dó 6
];

// botoes: quantos botões; inicio: comprimento da primeira sequência; alvo: comprimento que acaba a
// ronda com nota máxima; luz/pausa: ms que cada luz fica acesa e o intervalo a seguir; contrario:
// ao contrário.
const NIVEIS = [
  { botoes: 3, inicio: 2, alvo: 6, luz: 950, pausa: 450, repetidos: false },
  { botoes: 4, inicio: 2, alvo: 7, luz: 850, pausa: 400, repetidos: false },
  { botoes: 4, inicio: 3, alvo: 8, luz: 750, pausa: 350, repetidos: false },
  { botoes: 6, inicio: 3, alvo: 8, luz: 700, pausa: 330, repetidos: false },
  { botoes: 6, inicio: 3, alvo: 9, luz: 480, pausa: 260, repetidos: true },
  { botoes: 6, inicio: 3, alvo: 8, luz: 650, pausa: 320, repetidos: true, contrario: true },
];
const LENTO = 1.5; // a repetição depois de um erro é este tanto mais lenta
const LEMBRETE_MS = 15000; // sem toque durante este tempo: mostrar a sequência outra vez
// Depois deste número de lembretes sem nenhum toque, o gato espera em silêncio (um jogo deixado
// aberto em cima da mesa não pode falar de 20 em 20 segundos até a app voltar ao início).
const LEMBRETES_MAX = 3;

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo(ID);
  const e = ecra(() => terminar(false));
  e.raiz.classList.add("seq-ecra");
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let acordar = null; // resolve a espera pela vez da pessoa
  let lembrete = null;

  // Contexto de som próprio para as notas, fechado quando o jogo acaba.
  let ctx = null;
  function audio() {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  }
  // Um sino suave: uma onda simples com uma oitava baixinha, ataque rápido, final suave.
  function tom(freq, dur) {
    const a = audio();
    if (!a || !ativo) return;
    const t = a.currentTime;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o1 = a.createOscillator();
    o1.type = "sine";
    o1.frequency.value = freq;
    const o2 = a.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2;
    const g2 = a.createGain();
    g2.gain.value = 0.18;
    o1.connect(g);
    o2.connect(g2).connect(g);
    g.connect(a.destination);
    o1.start(t);
    o2.start(t);
    o1.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    if (!completo && ronda) ronda.registar(false);
    clearTimeout(lembrete);
    if (acordar) acordar("fim");
    if (ctx) ctx.close().catch(() => {});
    e.raiz.remove();
    sair();
  }

  let primeiraVez = true;

  async function comecar() {
    const n = nivel(ID);
    const cfg = NIVEIS[n - 1];

    // Disposição: uma fila de pontos dos passos por cima de uma grelha de botões grandes.
    const passos = el("div", { class: "seq-passos" });
    const grade = el("div", { class: "seq-grelha" });
    const jogo = el("div", { class: "seq-jogo" }, [passos, grade]);
    e.corpo.replaceChildren(jogo);
    const caixa = e.corpo.getBoundingClientRect();
    const altPassos = Math.max(36, Math.min(caixa.width, caixa.height) * 0.09);
    const { cols, lado } = grelha(cfg.botoes, caixa.width, caixa.height - altPassos, 0.86);
    const espaco = Math.round(lado * 0.14);
    grade.style.setProperty("--lado", `${lado}px`);
    grade.style.gap = `${espaco}px`;
    grade.style.width = `${cols * lado + (cols - 1) * espaco + 2}px`;

    const botoes = BOTOES.slice(0, cfg.botoes).map((b, i) => {
      const bt = el("button", {
        class: "seq-botao",
        style: { "--cor": b.cor },
        "aria-label": b.fig,
        html: `<svg viewBox="0 0 100 100" aria-hidden="true">${DESENHOS[b.fig]}</svg>`,
      });
      bt.dataset.i = i;
      bt.addEventListener("pointerdown", (ev) => { ev.preventDefault(); tocar(i); });
      grade.append(bt);
      return bt;
    });

    const inicio = Date.now();
    let seq = [];
    let melhor = 0;
    let erros = 0;
    let falhasAqui = 0;
    let lembretes = 0;
    let toquesCertos = 0;
    let toquesTotal = 0;
    const reacoes = [];
    const intervalos = [];

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        metricas.ronda(ID, {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: melhor,
          longest_sequence: melhor,
          start_length: cfg.inicio,
          target_length: cfg.alvo,
          buttons: cfg.botoes,
          backwards: !!cfg.contrario,
          errors: erros,
          hints_needed: lembretes,
          taps: toquesTotal,
          accuracy: toquesTotal ? Math.round((toquesCertos / toquesTotal) * 100) / 100 : null,
          reaction_ms_median: metricas.mediana(reacoes),
          tap_interval_ms_median: metricas.mediana(intervalos),
        });
        const facil = completo && (melhor >= cfg.alvo || (melhor >= cfg.alvo - 1 && erros <= 1));
        const dificil = completo && melhor < cfg.inicio;
        ajustarNivel(ID, NIVEIS.length, { completo, facil, dificil });
      },
    };

    function novoPasso() {
      let x;
      let tentativas = 0;
      do {
        x = Math.floor(Math.random() * cfg.botoes);
        tentativas++;
        const ultimo = seq.at(-1);
        const repete = x === ultimo;
        // Os níveis baixos nunca repetem um botão duas vezes seguidas; os altos nunca três vezes.
        if (!repete) break;
        if (cfg.repetidos && seq.at(-2) !== x && Math.random() < 0.5) break;
      } while (tentativas < 50);
      return x;
    }

    function desenharPassos(feitos) {
      passos.replaceChildren(...seq.map((_, k) => el("span", { class: k < feitos ? "feito" : "" })));
    }

    function acender(i, ms) {
      const b = botoes[i];
      b.classList.add("acesa");
      tom(BOTOES[i].nota, Math.max(0.45, ms / 1000 + 0.25));
      setTimeout(() => b.classList.remove("acesa"), ms);
    }

    // Mostra a sequência inteira, uma luz de cada vez.
    async function mostrar(lento) {
      const f = lento ? LENTO : 1;
      grade.classList.add("demo");
      desenharPassos(0);
      await espera(500);
      for (let k = 0; k < seq.length; k++) {
        if (!ativo) return;
        acender(seq[k], cfg.luz * f);
        passos.children[k]?.classList.add("feito");
        await espera((cfg.luz + cfg.pausa) * f);
      }
      if (!ativo) return;
      grade.classList.remove("demo");
      desenharPassos(0);
    }

    // A vez da pessoa: resolve com "certo", "errado", "lembrar" ou "fim".
    let vez = null;
    let lembretesSeguidos = 0;
    function suaVez() {
      return new Promise((resolver) => {
        vez = { k: 0, inicio: Date.now(), ultimo: 0 };
        acordar = (r) => { clearTimeout(lembrete); vez = null; acordar = null; resolver(r); };
        if (lembretesSeguidos < LEMBRETES_MAX) lembrete = setTimeout(() => { if (acordar) acordar("lembrar"); }, LEMBRETE_MS);
      });
    }

    function tocar(i) {
      if (!ativo || !vez) return;
      const agora = Date.now();
      // Um dedo a tremer pode pousar duas vezes: ignorar um segundo toque em menos de 220 ms.
      if (agora - vez.ultimo < 220) return;
      lembretesSeguidos = 0;
      clearTimeout(lembrete);
      lembrete = setTimeout(() => { if (acordar) acordar("lembrar"); }, LEMBRETE_MS);
      if (vez.k === 0) reacoes.push(agora - vez.inicio);
      else intervalos.push(agora - vez.ultimo);
      vez.ultimo = agora;
      toquesTotal++;
      acender(i, 320);
      const esperado = cfg.contrario ? seq[seq.length - 1 - vez.k] : seq[vez.k];
      if (i !== esperado) {
        acordar("errado");
        return;
      }
      toquesCertos++;
      // Ao contrário, os pontos enchem-se a partir da direita, a acompanhar a ordem dos toques.
      passos.children[cfg.contrario ? seq.length - 1 - vez.k : vez.k]?.classList.add("feito");
      vez.k++;
      if (vez.k === seq.length) acordar("certo");
    }

    while (seq.length < cfg.inicio) seq.push(novoPasso());
    desenharPassos(0);

    if (primeiraVez) {
      await e.dizer("sequencia.instrucao");
      primeiraVez = false;
    }
    if (!ativo) return;
    if (cfg.contrario) {
      await e.dizer("sequencia.contrario");
      if (!ativo) return;
    }

    let lento = false;
    let primeira = true;
    for (;;) {
      if (primeira) await e.dizer("sequencia.olha");
      else e.mostrar(som.texto("sequencia.olha"));
      primeira = false;
      if (!ativo) return;
      await mostrar(lento);
      if (!ativo) return;
      e.dizer(cfg.contrario ? "sequencia.agora_tu_contrario" : "sequencia.agora_tu", { cara: "img/noto/gato_feliz.svg" });
      const r = await suaVez();
      if (!ativo || r === "fim") return;

      if (r === "lembrar") {
        lembretes++;
        lembretesSeguidos++;
        await e.dizer("sequencia.lembrar");
        if (!ativo) return;
        lento = true;
        continue;
      }
      if (r === "certo") {
        melhor = seq.length;
        falhasAqui = 0;
        lento = false;
        await espera(350);
        if (!ativo) return;
        if (seq.length >= cfg.alvo) break;
        som.efeito("par", 0.5);
        await e.dizer(Math.random() < 0.5 ? "sequencia.mais_uma" : som.elogio(), { cara: "img/noto/gato_feliz.svg" });
        if (!ativo) return;
        seq.push(novoPasso());
        continue;
      }
      // Um erro: palavras simpáticas, depois a mesma sequência outra vez, devagar. Dois erros acabam a ronda.
      erros++;
      falhasAqui++;
      som.efeito("quase", 0.4);
      if (falhasAqui >= 2) break;
      await e.dizer(erros % 2 ? "sequencia.devagar" : "sequencia.com_calma");
      if (!ativo) return;
      lento = true;
    }

    // Fim da ronda: elogiar sempre o que a pessoa conseguiu.
    grade.classList.add("fim");
    const fala = melhor >= 2 ? `sequencia.fim_${Math.min(melhor, 10)}` : "sequencia.fim_pouco";
    if (melhor >= cfg.alvo) {
      som.efeito("vitoria2", 0.5);
      await e.dizer("sequencia.topo", { cara: "img/noto/gato_amor.svg" });
      if (!ativo) return;
    }
    await e.dizer(fala, { cara: "img/noto/gato_amor.svg" });
    if (!ativo) return;
    ronda.registar(true);
    ronda = null;
    const r = await premio(e, e.raiz);
    if (!ativo) return;
    if (r === "outra") comecar();
    else terminar(true);
  }

  comecar();
  return () => terminar(false);
}
