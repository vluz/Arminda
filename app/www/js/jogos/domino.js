// Dominó: dominó de duplo seis contra um ou dois amigos do café, o Joaquim e a Rosa.
// A pessoa toca numa peça da sua mão; ela vai para a ponta onde serve. Se serve nas duas pontas,
// as duas pontas grandes brilham e a pessoa toca numa. Ir ao monte e passar a vez são automáticos.
// Uma mão por ronda: acaba quando alguém joga todas as peças ou o jogo fica fechado.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio, estilo, ALVO_MIN } from "../ui.js";
import { svgPeca, svgCostas } from "./domino-pecas.js";

// rivais: amigos à mesa, mao: peças dadas a cada um, brilho: as peças que se podem jogar brilham,
// ia: como os amigos escolhem (0 ao acaso, 1 a mais pesada primeiro, 2 a mais pesada e guarda opções).
const NIVEIS = [
  { rivais: 1, mao: 5, brilho: true, ia: 0 },
  { rivais: 1, mao: 6, brilho: true, ia: 0 },
  { rivais: 1, mao: 7, brilho: false, ia: 1 },
  { rivais: 2, mao: 6, brilho: false, ia: 1 },
  { rivais: 2, mao: 7, brilho: false, ia: 2 },
  { rivais: 2, mao: 7, brilho: false, ia: 2 },
];

const AMIGOS = [
  { id: "joaquim", nome: "Joaquim", cara: "img/noto/idoso.svg" },
  { id: "rosa", nome: "Rosa", cara: "img/noto/idosa.svg" },
];

const RACIO = 1.75; // altura / largura de uma peça na mão da pessoa
const ESPACO = 12;

function baralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function todasAsPecas() {
  const p = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) p.push([a, b]);
  return p;
}

const pontos = (mao) => mao.reduce((s, [a, b]) => s + a + b, 0);

function cssPronto(id) {
  const l = document.querySelector(`link[data-jogo="${id}"]`);
  if (!l || l.sheet) return Promise.resolve();
  return new Promise((r) => {
    l.addEventListener("load", r, { once: true });
    l.addEventListener("error", r, { once: true });
    setTimeout(r, 2000);
  });
}

// A maior largura de peça para `quantas` peças caberem na zona da mão, numa ou mais filas.
function dispor(quantas, largura, altura) {
  let melhor = null;
  for (let linhas = 1; linhas <= 4; linhas++) {
    const cols = Math.ceil(quantas / linhas);
    const porAltura = (altura - (linhas - 1) * ESPACO) / linhas / RACIO;
    const porLargura = (largura - (cols - 1) * ESPACO) / cols;
    const w = Math.floor(Math.min(porAltura, porLargura, 170));
    if (!melhor || w > melhor.w) {
      const colsReais = Math.max(cols, Math.floor((largura + ESPACO) / (w + ESPACO)));
      melhor = { w, linhas, cols: colsReais };
    }
  }
  return melhor;
}

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo("domino");
  const e = ecra(() => terminar(false));
  e.raiz.classList.add("domino-ecra");
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let acordar = null;

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    if (!completo && ronda) ronda.registar(false);
    if (acordar) acordar(null);
    e.raiz.remove();
    sair();
  }

  // Mostra várias frases como uma só no balão e di-las uma a seguir à outra.
  let fala = 0; // uma frase mais nova para o resto de uma mais antiga
  async function dizerVarios(ids) {
    const minha = ++fala;
    e.mostrar(ids.map((id) => som.texto(id)).join(" ") + ".");
    e.mascote.src = "img/noto/gato_sorri.svg";
    for (const id of ids) {
      await som.falar(id);
      if (!ativo || minha !== fala) return;
    }
  }
  function calar() {
    fala++;
    som.calar();
  }

  async function comecar() {
    await cssPronto("domino");
    if (!ativo) return;
    const n = nivel("domino");
    const cfg = NIVEIS[n - 1];

    // Disposição: a fila dos amigos, a linha com as suas duas pontas grandes, a mão da pessoa.
    const rivaisEl = el("div", { class: "dom-rivais" });
    const pontaEsq = el("button", { class: "dom-ponta esq vazia", "data-lado": "esq" });
    const pontaDir = el("button", { class: "dom-ponta dir vazia", "data-lado": "dir" });
    const cadeia = el("div", { class: "dom-cadeia" });
    const fita = el("div", { class: "dom-fita" }, [cadeia]);
    const linhaEl = el("div", { class: "dom-linha" }, [pontaEsq, fita, pontaDir]);
    const maoEl = el("div", { class: "dom-mao" });
    const mesa = el("div", { class: "dom-mesa" }, [rivaisEl, linhaEl, maoEl]);
    e.corpo.replaceChildren(mesa);

    const caixa = e.corpo.getBoundingClientRect();
    const retrato = caixa.height > caixa.width;
    const rivaisH = rivaisEl.getBoundingClientRect().height || 80;
    const pontaH = Math.round(Math.max(ALVO_MIN, Math.min(160, caixa.height * 0.2)));
    const fitaH = retrato ? Math.round(pontaH * 0.6) : 0;
    mesa.style.setProperty("--ponta", `${pontaH}px`);
    mesa.style.setProperty("--fita", `${retrato ? fitaH : pontaH}px`);
    const alturaMao = caixa.height - rivaisH - pontaH - fitaH - ESPACO * (retrato ? 3 : 2) - 16;

    // Quantas peças cabem na mão neste ecrã: nem a distribuição nem as idas ao monte passam disso.
    let lugares = cfg.mao + 2;
    let d = dispor(lugares, caixa.width, alturaMao);
    while (d.w < ALVO_MIN && lugares > 3) {
      lugares--;
      d = dispor(lugares, caixa.width, alturaMao);
    }
    const maoMax = Math.max(lugares, d.cols * d.linhas);
    const tamanhoMao = Math.min(cfg.mao, maoMax - 1);
    maoEl.style.setProperty("--w", `${Math.max(d.w, ALVO_MIN)}px`);
    maoEl.style.maxWidth = `${Math.min(d.cols, maoMax) * (Math.max(d.w, ALVO_MIN) + ESPACO)}px`;

    // Dar as peças.
    let monte = baralhar(todasAsPecas());
    const jogadores = [{ tu: true, mao: [] }];
    for (let i = 0; i < cfg.rivais; i++) jogadores.push({ tu: false, ...AMIGOS[i], mao: [] });
    for (const j of jogadores) j.mao = monte.splice(0, tamanhoMao);

    const linha = []; // peças da esquerda para a direita, cada uma [a, b] com b a tocar no a da peça seguinte
    const pontas = () => (linha.length ? [linha[0][0], linha[linha.length - 1][1]] : null);
    const serveEsq = (p) => !linha.length || p[0] === linha[0][0] || p[1] === linha[0][0];
    const serveDir = (p) => !linha.length || p[0] === linha.at(-1)[1] || p[1] === linha.at(-1)[1];
    const serve = (p) => serveEsq(p) || serveDir(p);

    const inicio = Date.now();
    const reacoes = [];
    let erros = 0;
    let pistas = 0;
    let jogadas = 0;
    let compradas = 0;
    let ganhou = null;

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        metricas.ronda("domino", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: jogadas,
          opponents: cfg.rivais,
          won: ganhou === 0,
          pieces_played: jogadas,
          pieces_drawn: compradas,
          pips_left: pontos(jogadores[0].mao),
          wrong_taps: erros,
          hints_needed: pistas,
          reaction_ms_median: metricas.mediana(reacoes),
          accuracy: jogadas + erros ? Math.round((jogadas / (jogadas + erros)) * 100) / 100 : null,
        });
        const facil = completo && ganhou === 0 && erros <= 1;
        // Só uma ronda acabada pode ser "difícil": uma ronda deixada a meio não muda nada (regra 10).
        const dificil = completo && (erros >= 5 || pistas >= 3);
        ajustarNivel("domino", NIVEIS.length, { completo, facil, dificil });
      },
    };

    // ---- Desenhar a mesa ----

    const rivaisVista = jogadores.slice(1).map((j) => {
      const contas = el("div", { class: "dom-costas" });
      const num = el("b", {});
      const caixaR = el("div", { class: "dom-rival" }, [img(j.cara, j.nome), el("div", { class: "dom-nome" }, [j.nome, contas]), num]);
      rivaisEl.append(caixaR);
      return { caixa: caixaR, contas, num };
    });
    const monteContas = el("b", {});
    rivaisEl.append(el("div", { class: "dom-monte" }, [el("span", { class: "dom-costa1", html: svgCostas() }), el("div", { class: "dom-nome" }, "Monte"), monteContas]));

    function mostrarRivais(vez) {
      jogadores.slice(1).forEach((j, i) => {
        const v = rivaisVista[i];
        v.num.textContent = String(j.mao.length);
        v.contas.innerHTML = svgCostas().repeat(Math.min(j.mao.length, 8));
        v.caixa.classList.toggle("vez", vez === i + 1);
      });
      monteContas.textContent = String(monte.length);
    }

    function desenharLinha(nova) {
      cadeia.replaceChildren(...linha.map((p, i) => {
        const dobre = p[0] === p[1];
        const s = el("span", { class: `dom-peq${dobre ? " dobre" : ""}${i === nova ? " nova" : ""}`, html: svgPeca(p[0], p[1], { vertical: dobre }) });
        return s;
      }));
      // Encolher a linha para caber; as duas pontas grandes ficam sempre no tamanho inteiro.
      cadeia.style.transform = "none";
      const larg = cadeia.scrollWidth;
      const disp = fita.clientWidth - 8;
      const esc = larg > disp ? Math.max(0.2, disp / larg) : 1;
      cadeia.style.transform = `scale(${esc})`;
      if (!linha.length) {
        pontaEsq.className = "dom-ponta esq vazia";
        pontaDir.className = "dom-ponta dir vazia";
        pontaEsq.innerHTML = "";
        pontaDir.innerHTML = "";
        return;
      }
      const [pe, pd] = [linha[0], linha.at(-1)];
      pontaEsq.className = "dom-ponta esq";
      pontaDir.className = "dom-ponta dir";
      pontaEsq.dataset.n = pe[0];
      pontaDir.dataset.n = pd[1];
      pontaEsq.innerHTML = svgPeca(pe[0], pe[1], { apagar: pe[0] === pe[1] ? "" : "b" });
      pontaDir.innerHTML = svgPeca(pd[0], pd[1], { apagar: pd[0] === pd[1] ? "" : "a" });
      if (nova === 0) pontaEsq.classList.add("nova");
      if (nova === linha.length - 1) pontaDir.classList.add("nova");
    }

    function desenharMao() {
      const mao = jogadores[0].mao;
      maoEl.replaceChildren(...mao.map((p, i) => {
        const b = el("button", { class: "dom-peca", html: svgPeca(p[0], p[1], { vertical: true }), "aria-label": `${p[0]} e ${p[1]}` });
        b.dataset.i = i;
        b.dataset.a = p[0];
        b.dataset.b = p[1];
        b.addEventListener("click", () => { if (acordar) acordar({ peca: i }); });
        return b;
      }));
    }

    pontaEsq.addEventListener("click", () => { if (acordar) acordar({ ponta: "esq" }); });
    pontaDir.addEventListener("click", () => { if (acordar) acordar({ ponta: "dir" }); });

    // Põe uma peça numa ponta, virada para os números iguais se tocarem.
    function pousar(p, lado) {
      let novaI;
      if (!linha.length) { linha.push([p[0], p[1]]); novaI = 0; }
      else if (lado === "esq") {
        const x = linha[0][0];
        linha.unshift(p[1] === x ? [p[0], p[1]] : [p[1], p[0]]);
        novaI = 0;
      } else {
        const x = linha.at(-1)[1];
        linha.push(p[0] === x ? [p[0], p[1]] : [p[1], p[0]]);
        novaI = linha.length - 1;
      }
      som.efeito("virar", 0.7);
      desenharLinha(novaI);
    }

    // Frases que dizem os números de que a pessoa precisa: "Procura o três ou o cinco."
    function idsProcura() {
      const [x, y] = pontas();
      return x === y ? ["domino.procura", `domino.n${x}`] : ["domino.procura", `domino.n${x}`, "domino.ou", `domino.n${y}`];
    }

    function aceso(sim) {
      maoEl.querySelectorAll(".dom-peca").forEach((b) => {
        const p = jogadores[0].mao[Number(b.dataset.i)];
        b.classList.toggle("serve", sim && serve(p));
      });
    }

    // ---- As vezes ----

    async function vezDela() {
      const eu = jogadores[0];
      if (!eu.mao.some(serve)) {
        let comprou = false;
        while (monte.length && eu.mao.length < maoMax && !eu.mao.some(serve)) {
          if (!comprou) {
            comprou = true;
            await e.dizer("domino.compra");
            if (!ativo) return "fim";
          }
          eu.mao.push(monte.shift());
          compradas++;
          som.efeito("toque", 0.6);
          desenharMao();
          maoEl.lastChild.classList.add("nova");
          mostrarRivais(0);
          await espera(700);
          if (!ativo) return "fim";
        }
        if (!eu.mao.some(serve)) {
          await e.dizer("domino.passas");
          return "passou";
        }
      }

      let errosVez = 0;
      let brilho = cfg.brilho;
      aceso(brilho);
      if (linha.length && cfg.brilho) dizerVarios(idsProcura());
      else if (linha.length) e.dizer("domino.tua_vez");
      const desde = Date.now();

      let escolhida = null;
      for (;;) {
        const t = await new Promise((r) => { acordar = r; });
        acordar = null;
        if (!ativo || !t) return "fim";
        if (t.peca !== undefined) {
          const p = eu.mao[t.peca];
          if (!serve(p)) {
            erros++;
            errosVez++;
            escolhida = null;
            pontaEsq.classList.remove("escolha");
            pontaDir.classList.remove("escolha");
            maoEl.querySelectorAll(".dom-peca").forEach((b) => b.classList.remove("escolhida"));
            som.efeito("quase", 0.4);
            if (errosVez >= 2 && !brilho) {
              brilho = true;
              pistas++;
              aceso(true);
            }
            await dizerVarios(["domino.nao_serve", ...idsProcura()]);
            if (!ativo) return "fim";
            continue;
          }
          const ambos = linha.length && serveEsq(p) && serveDir(p) && pontas()[0] !== pontas()[1];
          if (!ambos) {
            reacoes.push(Date.now() - desde);
            eu.mao.splice(t.peca, 1);
            pousar(p, !linha.length ? "dir" : serveDir(p) ? "dir" : "esq");
            break;
          }
          // Serve nas duas pontas: a pessoa escolhe a ponta.
          escolhida = t.peca;
          maoEl.querySelectorAll(".dom-peca").forEach((b) => b.classList.toggle("escolhida", Number(b.dataset.i) === t.peca));
          pontaEsq.classList.add("escolha");
          pontaDir.classList.add("escolha");
          som.efeito("toque", 0.5);
          calar();
          e.dizer("domino.duas_pontas");
        } else if (t.ponta && escolhida !== null) {
          const p = eu.mao[escolhida];
          reacoes.push(Date.now() - desde);
          eu.mao.splice(escolhida, 1);
          pontaEsq.classList.remove("escolha");
          pontaDir.classList.remove("escolha");
          pousar(p, t.ponta);
          break;
        }
      }
      calar();
      jogadas++;
      desenharMao();
      return "jogou";
    }

    function escolherRival(j) {
      const podem = j.mao.map((p, i) => ({ p, i })).filter(({ p }) => serve(p));
      if (!podem.length) return null;
      if (cfg.ia === 0) return podem[Math.floor(Math.random() * podem.length)];
      const contar = (x) => j.mao.filter((q) => q[0] === x || q[1] === x).length;
      const nota = ({ p }) => {
        let s = p[0] + p[1] + (p[0] === p[1] ? 4 : 0);
        if (cfg.ia >= 2) s += 2 * Math.max(contar(p[0]), contar(p[1]));
        return s + Math.random();
      };
      return podem.sort((a, b) => nota(b) - nota(a))[0];
    }

    async function vezRival(k) {
      const j = jogadores[k];
      await espera(900);
      if (!ativo) return "fim";
      let escolha = escolherRival(j);
      if (!escolha && monte.length) {
        await e.dizer(`domino.${j.id}_compra`);
        if (!ativo) return "fim";
        while (!escolha && monte.length) {
          j.mao.push(monte.shift());
          som.efeito("toque", 0.4);
          mostrarRivais(k);
          await espera(450);
          if (!ativo) return "fim";
          escolha = escolherRival(j);
        }
      }
      if (!escolha) {
        await e.dizer(`domino.${j.id}_passa`);
        return "passou";
      }
      j.mao.splice(escolha.i, 1);
      const p = escolha.p;
      let lado = "dir";
      if (linha.length) {
        const e1 = serveEsq(p);
        const d1 = serveDir(p);
        lado = e1 && d1 ? (Math.random() < 0.5 ? "esq" : "dir") : d1 ? "dir" : "esq";
      }
      pousar(p, lado);
      mostrarRivais(k);
      await espera(600);
      return "jogou";
    }

    // ---- A mão ----

    desenharMao();
    desenharLinha(-1);
    mostrarRivais(-1);

    // Começa o duplo mais alto. Se for da pessoa, ela começa com a peça que quiser.
    let vez = 0;
    for (let d2 = 6; d2 >= 0; d2--) {
      const k = jogadores.findIndex((j) => j.mao.some((p) => p[0] === d2 && p[1] === d2));
      if (k >= 0) { vez = k; break; }
    }

    await e.dizer("domino.comecar");
    if (!ativo) return;
    await e.dizer("domino.instrucao");
    if (!ativo) return;

    if (vez !== 0) {
      const j = jogadores[vez];
      await e.dizer(`domino.comeca_${j.id}`);
      if (!ativo) return;
      // Abre com o duplo.
      const i = j.mao.reduce((m, p, idx) => (p[0] === p[1] && (m < 0 || p[0] > j.mao[m][0]) ? idx : m), -1);
      const [p] = j.mao.splice(i, 1);
      mostrarRivais(vez);
      await espera(700);
      pousar(p, "dir");
      mostrarRivais(vez);
      await espera(700);
      vez = (vez + 1) % jogadores.length;
    } else {
      await e.dizer("domino.comecas");
      if (!ativo) return;
      if (cfg.brilho) await e.dizer("domino.brilham");
      if (!ativo) return;
    }

    let passesSeguidos = 0;
    while (ativo) {
      mostrarRivais(vez);
      const r = vez === 0 ? await vezDela() : await vezRival(vez);
      if (!ativo || r === "fim") return;
      aceso(false);
      if (r === "passou") passesSeguidos++;
      else passesSeguidos = 0;
      if (!jogadores[vez].mao.length) { ganhou = vez; break; }
      if (passesSeguidos >= jogadores.length) break;
      if (vez === 0 && r === "jogou" && jogadores[0].mao.length === 1) {
        await e.dizer("domino.ultima", { cara: "img/noto/gato_feliz.svg" });
        if (!ativo) return;
      } else if (vez === 0 && r === "jogou" && Math.random() < 0.3) {
        await e.dizer(som.elogio(), { cara: "img/noto/gato_feliz.svg" });
        if (!ativo) return;
      }
      vez = (vez + 1) % jogadores.length;
    }
    if (!ativo) return;
    mostrarRivais(-1);

    if (ganhou === null) {
      // Fechado: ganha quem tem menos pintas; um empate vai para a pessoa.
      await e.dizer("domino.fechado");
      if (!ativo) return;
      const contas = jogadores.map((j) => pontos(j.mao));
      const menor = Math.min(...contas);
      ganhou = contas[0] === menor ? 0 : contas.indexOf(menor);
    }
    if (ganhou === 0) {
      som.efeito("vitoria2", 0.6);
      await e.dizer(jogadores[0].mao.length ? "domino.fechado_tu" : "domino.ganhaste", { cara: "img/noto/gato_amor.svg" });
    } else {
      await e.dizer(`domino.ganhou_${jogadores[ganhou].id}`, { cara: "img/noto/gato_amor.svg" });
    }
    if (!ativo) return;
    ronda.registar(true);
    ronda = null;
    const res = await premio(e, e.raiz);
    if (res === "outra") comecar();
    else terminar(true);
  }

  comecar();
  return () => terminar(false);
}
