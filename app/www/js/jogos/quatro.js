// Quatro em linha contra o avô. A pessoa é o vermelho, ele é o amarelo.
// A pessoa toca numa coluna (a coluna inteira é o alvo) e a peça cai lá dentro.
// Uma partida é à melhor de três jogos e acaba sempre com elogio e com o prémio.
// Níveis baixos: um tabuleiro pequeno de 5x4 e um avô que joga quase ao acaso. Níveis mais altos:
// o tabuleiro normal de 7x6 (6 colunas quando 7 ficariam abaixo de 113 px) e um avô que bloqueia e
// olha à frente (minimax com alfa-beta, com a profundidade a subir com o nível e um limite de tempo
// por causa do tablet fraco).

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel, ler, gravar } from "../estado.js";
import { el, img, ecra, espera, premio, estilo, ALVO_MIN } from "../ui.js";

// ia: 0 quase ao acaso, 1 aproveita uma vitória e às vezes bloqueia, 2 ganha, bloqueia e evita
// armadilhas, 3 olha `prof` jogadas à frente; `erro` é a probabilidade de ele fazer antes uma
// jogada de nível 2 (mais simpático).
// pista: a coluna onde ele podia ganhar brilha. sempreTu: a pessoa começa todos os jogos.
const NIVEIS = [
  { cols: 5, linhas: 4, ia: 0, pista: true, sempreTu: true },
  { cols: 5, linhas: 4, ia: 1, pista: true, sempreTu: true },
  { cols: 6, linhas: 5, ia: 1, pista: true, sempreTu: true },
  { cols: 6, linhas: 5, ia: 2, pista: false, sempreTu: true },
  { cols: 7, linhas: 6, ia: 2, pista: false, sempreTu: false },
  { cols: 7, linhas: 6, ia: 3, prof: 2, erro: 0.25, sempreTu: false },
  { cols: 7, linhas: 6, ia: 3, prof: 3, erro: 0.15, sempreTu: false },
  { cols: 7, linhas: 6, ia: 3, prof: 4, erro: 0.08, sempreTu: false },
  { cols: 7, linhas: 6, ia: 3, prof: 5, erro: 0.04, sempreTu: false },
  { cols: 7, linhas: 6, ia: 3, prof: 6, erro: 0, sempreTu: false },
  { cols: 7, linhas: 6, ia: 3, prof: 8, erro: 0, sempreTu: false },
];
const JOGOS_PARTIDA = 3;
const TU = 1;
const AVO = 2;
// A procura para ao fim deste tempo e usa a resposta mais funda que acabou.
const TEMPO_MAX = 110;
const agora = () => (window.performance ? performance.now() : Date.now());

// Todas as filas de quatro casas num tabuleiro de C x R.
function janelas(C, R) {
  const lista = [];
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const er = r + dr * 3;
        const ec = c + dc * 3;
        if (er < 0 || er >= R || ec < 0 || ec >= C) continue;
        lista.push([0, 1, 2, 3].map((k) => (r + dr * k) * C + (c + dc * k)));
      }
    }
  }
  return lista;
}

// A peça acabada de pôr em (r, c) fez quatro?
function ganha(t, C, R, r, c, quem) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let n = 1;
    for (const s of [1, -1]) {
      let rr = r + dr * s;
      let cc = c + dc * s;
      while (rr >= 0 && rr < R && cc >= 0 && cc < C && t[rr * C + cc] === quem) {
        n++;
        rr += dr * s;
        cc += dc * s;
      }
    }
    if (n >= 4) return true;
  }
  return false;
}

// As quatro casas da linha vencedora que passa por (r, c), para o brilho.
function linhaVencedora(t, C, R, r, c, quem) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cel = [r * C + c];
    for (const s of [1, -1]) {
      let rr = r + dr * s;
      let cc = c + dc * s;
      while (rr >= 0 && rr < R && cc >= 0 && cc < C && t[rr * C + cc] === quem) {
        cel.push(rr * C + cc);
        rr += dr * s;
        cc += dc * s;
      }
    }
    if (cel.length >= 4) return cel;
  }
  return [r * C + c];
}

// Colunas onde `quem` ganharia agora mesmo.
function vitorias(J, quem) {
  const lista = [];
  for (let c = 0; c < J.C; c++) {
    if (J.alt[c] >= J.R) continue;
    const r = J.R - 1 - J.alt[c];
    J.t[r * J.C + c] = quem;
    if (ganha(J.t, J.C, J.R, r, c, quem)) lista.push(c);
    J.t[r * J.C + c] = 0;
  }
  return lista;
}

// Valor do tabuleiro do ponto de vista de `quem`: filas abertas de duas e de três, e o centro.
function avaliar(t, C, jan, quem) {
  const outro = 3 - quem;
  let p = 0;
  for (const w of jan) {
    let a = 0;
    let b = 0;
    for (const i of w) {
      if (t[i] === quem) a++;
      else if (t[i] === outro) b++;
    }
    if (b === 0) p += a === 3 ? 5 : a === 2 ? 2 : 0;
    else if (a === 0) p -= b === 3 ? 6 : b === 2 ? 2 : 0;
  }
  const meio = Math.floor(C / 2);
  for (let i = meio; i < t.length; i += C) p += t[i] === quem ? 3 : t[i] === outro ? -3 : 0;
  return p;
}

// Negamax com alfa-beta e profundidade crescente. Devolve a melhor coluna, ou -1 se nenhuma
// profundidade acabou a tempo. Trabalha em cópias, por isso um fim de tempo nunca deixa o
// tabuleiro verdadeiro mudado.
function procurar(J, prof, rnd) {
  const { C, R, jan } = J;
  const t = J.t.slice();
  const alt = J.alt.slice();
  const meio = (C - 1) / 2;
  const ordem = [...Array(C).keys()].sort((a, b) => Math.abs(a - meio) - Math.abs(b - meio));
  const limite = agora() + TEMPO_MAX;
  const FORA = {};
  let nos = 0;
  let jogadas = alt.reduce((a, b) => a + b, 0);

  function nm(d, a, b, quem) {
    if ((++nos & 63) === 0 && agora() > limite) throw FORA;
    if (jogadas === C * R) return 0;
    if (d === 0) return avaliar(t, C, jan, quem);
    let melhor = -Infinity;
    for (const c of ordem) {
      if (alt[c] >= R) continue;
      const r = R - 1 - alt[c];
      const i = r * C + c;
      t[i] = quem;
      alt[c]++;
      jogadas++;
      const v = ganha(t, C, R, r, c, quem) ? 100000 + d : -nm(d - 1, -b, -a, 3 - quem);
      t[i] = 0;
      alt[c]--;
      jogadas--;
      if (v > melhor) melhor = v;
      if (v > a) a = v;
      if (a >= b) break;
    }
    return melhor;
  }

  let escolha = -1;
  try {
    for (let d = 1; d <= prof; d++) {
      let melhor = -Infinity;
      let col = -1;
      for (const c of ordem) {
        if (alt[c] >= R) continue;
        const r = R - 1 - alt[c];
        const i = r * C + c;
        t[i] = AVO;
        alt[c]++;
        jogadas++;
        let v;
        try {
          v = ganha(t, C, R, r, c, AVO) ? 100000 + d : -nm(d - 1, -Infinity, Infinity, TU);
        } finally {
          t[i] = 0;
          alt[c]--;
          jogadas--;
        }
        v += rnd() * 0.9;   // desfaz os empates, para os jogos serem diferentes
        if (v > melhor) { melhor = v; col = c; }
      }
      escolha = col;
      if (melhor > 50000) break;   // vitória certa: não é preciso olhar mais fundo
    }
  } catch (x) {
    if (x !== FORA) throw x;
  }
  return escolha;
}

function jogadaAvo(J, cfg) {
  const livres = [];
  for (let c = 0; c < J.C; c++) if (J.alt[c] < J.R) livres.push(c);
  const acaso = () => livres[Math.floor(Math.random() * livres.length)];
  // Ao acaso, mas a puxar para as colunas do meio.
  const acasoMeio = () => {
    const meio = (J.C - 1) / 2;
    const pesos = livres.map((c) => J.C - Math.abs(c - meio));
    let x = Math.random() * pesos.reduce((a, b) => a + b, 0);
    for (let k = 0; k < livres.length; k++) { x -= pesos[k]; if (x <= 0) return livres[k]; }
    return livres[livres.length - 1];
  };
  const ganhar = vitorias(J, AVO);
  const travar = vitorias(J, TU);
  if (cfg.ia === 0) return ganhar.length && Math.random() < 0.4 ? ganhar[0] : acaso();
  if (ganhar.length) return ganhar[0];
  if (cfg.ia === 1) return travar.length && Math.random() < 0.5 ? travar[0] : acasoMeio();
  if (travar.length) return travar[0];
  if (cfg.ia === 3 && Math.random() >= (cfg.erro || 0)) {
    const c = procurar(J, cfg.prof, Math.random);
    if (c >= 0) return c;
  }
  // Nível 2: nunca jogar mesmo por baixo da casa onde a pessoa ganha; senão a coluna com melhor aspeto.
  const notas = livres.map((c) => {
    const r = J.R - 1 - J.alt[c];
    J.t[r * J.C + c] = AVO;
    J.alt[c]++;
    const perigo = vitorias(J, TU).length > 0;
    const p = avaliar(J.t, J.C, J.jan, AVO);
    J.t[r * J.C + c] = 0;
    J.alt[c]--;
    return { c, p: p + Math.random() * 4 - (perigo ? 1000 : 0) };
  });
  notas.sort((a, b) => b.p - a.p);
  return notas[0].c;
}

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  const pronto = estilo("quatro");
  const placar = el("div", { class: "q4-placar" });
  const e = ecra(() => terminar(false), [placar]);
  e.raiz.classList.add("q4-ecra");
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let acordar = null;

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    if (!completo && ronda) ronda.registar(false);
    if (acordar) acordar(-1);
    e.raiz.remove();
    sair();
  }

  async function comecar() {
    await pronto;
    if (!ativo) return;
    const n = nivel("quatro");
    const cfg = NIVEIS[n - 1];
    const caixa = e.corpo.getBoundingClientRect();
    // As colunas ficam com pelo menos ALVO_MIN de largura: 7 passam a 6 (ou 5) num ecrã pequeno.
    let C = cfg.cols;
    while (C > 5 && (caixa.width * 0.97) / C < ALVO_MIN) C--;
    const R = cfg.linhas;
    const largura = Math.min(170, Math.floor((caixa.width * 0.97) / C));
    const altura = Math.min(largura, Math.floor((caixa.height * 0.96) / R));
    const disco = Math.floor(Math.min(largura, altura) * 0.84);
    const jan = janelas(C, R);

    const inicio = Date.now();
    const reacoes = [];
    let ganhos = 0;
    let perdas = 0;
    let empates = 0;
    let jogos = 0;
    let cheias = 0;
    let falhouGanhar = 0;
    let falhouTravar = 0;
    let defesas = 0;
    let jogadas = 0;
    let pistas = 0;

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        metricas.ronda("quatro", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: ganhos,
          board: `${C}x${R}`,
          opponent: cfg.ia === 3 ? `depth${cfg.prof}` : `ia${cfg.ia}`,
          games: jogos,
          wins: ganhos,
          losses: perdas,
          draws: empates,
          moves: jogadas,
          missed_wins: falhouGanhar,
          missed_blocks: falhouTravar,
          blocks_made: defesas,
          wrong_taps: cheias,
          hints_needed: pistas,
          reaction_ms_median: metricas.mediana(reacoes),
          accuracy: jogadas ? Math.round((1 - (falhouGanhar + falhouTravar) / jogadas) * 100) / 100 : null,
        });
        const facil = completo && ganhos >= 2 && perdas === 0 && falhouGanhar + falhouTravar <= 1;
        const dificil = completo && ganhos === 0 && perdas >= 2;
        ajustarNivel("quatro", NIVEIS.length, { completo, facil, dificil });
      },
    };

    const discoMini = () => el("span", { class: "q4-disco tu mini" });
    function mostrarPlacar() {
      placar.replaceChildren(
        el("div", { class: "lado-placar tu" }, [discoMini(), el("b", {}, String(ganhos))]),
        el("div", { class: "lado-placar avo" }, [img("img/noto/avo_homem.svg", ""), el("b", {}, String(perdas))]),
      );
    }
    mostrarPlacar();

    const tab = el("div", { class: "q4-tab", style: { "--larg": `${largura}px`, "--alt": `${altura}px`, "--disco": `${disco}px`, "--c": C, "--r": R } });
    const colunas = [];
    for (let c = 0; c < C; c++) {
      const b = el("button", { class: "q4-coluna", "aria-label": `coluna ${c + 1}` });
      for (let r = 0; r < R; r++) b.append(el("i", { class: "q4-buraco" }));
      b.addEventListener("click", () => {
        if (!acordar) return;
        b.classList.remove("toque");
        void b.offsetWidth;
        b.classList.add("toque");
        acordar(c);
      });
      colunas.push(b);
      tab.append(b);
    }
    e.corpo.replaceChildren(el("div", { class: "q4-mesa" }, [tab]));

    await e.dizer("quatro.comecar");
    if (!ativo) return;
    await e.dizer("quatro.instrucao");
    if (!ativo) return;
    if (n >= 3) {
      await e.dizer("quatro.direcoes");
      if (!ativo) return;
    }

    let tuComecas = true;
    while (ativo && jogos < JOGOS_PARTIDA && ganhos < 2 && perdas < 2) {
      if (jogos > 0) {
        await e.dizer("quatro.proximo");
        if (!ativo) return;
      }
      const J = { C, R, jan, t: new Array(C * R).fill(0), alt: new Array(C).fill(0) };
      const discos = new Map();
      colunas.forEach((b) => b.querySelectorAll(".q4-disco").forEach((d) => d.remove()));
      tab.classList.remove("esvazia", "acabou");
      let vez = tuComecas ? TU : AVO;
      if (jogos > 0 || !tuComecas) {
        await e.dizer(vez === TU ? "quatro.comecas" : "quatro.comeca_avo");
        if (!ativo) return;
      }
      let avisou = false;
      let fim = null;

      // Deixa cair uma peça na coluna c e espera que ela pouse.
      const largar = async (c, quem) => {
        const r = R - 1 - J.alt[c];
        J.t[r * C + c] = quem;
        J.alt[c]++;
        const d = el("span", { class: `q4-disco ${quem === TU ? "tu" : "avo"}` });
        d.style.top = `${r * altura + (altura - disco) / 2}px`;
        d.style.transform = `translateY(${-(r + 1) * altura - disco}px)`;
        colunas[c].append(d);
        discos.set(r * C + c, d);
        void d.offsetWidth;
        const tempo = Math.round(220 + 55 * r);
        d.style.transition = `transform ${tempo}ms cubic-bezier(.55,0,1,.45)`;
        d.style.transform = "translateY(0)";
        await espera(tempo);
        d.classList.add("aterra");
        som.efeito("quatro-cai", quem === TU ? 0.7 : 0.5);
        return r;
      };

      while (ativo && !fim) {
        let c;
        if (vez === TU) {
          const podiaGanhar = vitorias(J, TU);
          const ameacas = vitorias(J, AVO);
          if (cfg.pista && ameacas.length && !podiaGanhar.length) {
            ameacas.forEach((x) => colunas[x].classList.add("pista"));
            if (!avisou) {
              avisou = true;
              pistas++;
              e.dizer("quatro.cuidado");
            }
          }
          tab.classList.add("tua-vez");
          const desde = Date.now();
          for (;;) {
            c = await new Promise((r) => { acordar = r; });
            acordar = null;
            if (!ativo || c < 0) return;
            if (J.alt[c] < R) break;
            cheias++;
            som.efeito("quase", 0.4);
            e.dizer("quatro.cheia");
          }
          tab.classList.remove("tua-vez");
          reacoes.push(Date.now() - desde);
          jogadas++;
          colunas.forEach((b) => b.classList.remove("pista"));
          let defendeu = false;
          if (podiaGanhar.length && !podiaGanhar.includes(c)) falhouGanhar++;
          else if (!podiaGanhar.length && ameacas.length) {
            if (ameacas.includes(c)) { defesas++; defendeu = true; } else falhouTravar++;
          }
          const r = await largar(c, TU);
          if (!ativo) return;
          if (ganha(J.t, C, R, r, c, TU)) fim = { quem: TU, linha: linhaVencedora(J.t, C, R, r, c, TU) };
          else if (defendeu) e.dizer("quatro.defesa", { cara: "img/noto/gato_feliz.svg" });
          vez = AVO;
        } else {
          await espera(650);
          if (!ativo) return;
          c = jogadaAvo(J, cfg);
          const r = await largar(c, AVO);
          if (!ativo) return;
          if (ganha(J.t, C, R, r, c, AVO)) fim = { quem: AVO, linha: linhaVencedora(J.t, C, R, r, c, AVO) };
          vez = TU;
        }
        if (!fim && J.alt.every((a) => a >= R)) fim = { quem: 0, linha: [] };
      }
      if (!ativo) return;
      jogos++;
      tab.classList.add("acabou");
      fim.linha.forEach((i) => discos.get(i)?.classList.add("linha"));
      if (fim.quem === TU) {
        ganhos++;
        som.efeito("linha", 0.6);
        mostrarPlacar();
        await e.dizer("quatro.ganhaste", { cara: "img/noto/gato_feliz.svg" });
      } else if (fim.quem === AVO) {
        perdas++;
        som.efeito("quase", 0.4);
        mostrarPlacar();
        await e.dizer("quatro.avo_ganhou");
      } else {
        empates++;
        som.efeito("par", 0.5);
        await e.dizer("quatro.empate", { cara: "img/noto/gato_feliz.svg" });
      }
      if (!ativo) return;
      await espera(700);
      if (!ativo) return;
      // As peças caem pelo fundo, prontas para o jogo seguinte.
      tab.classList.add("esvazia");
      som.efeito("baralhar", 0.4);
      await espera(650);
      if (!cfg.sempreTu) tuComecas = !tuComecas;
    }
    if (!ativo) return;

    const fala = ganhos > perdas ? "quatro.partida_tu" : perdas > ganhos ? "quatro.partida_avo" : "quatro.partida_empate";
    await e.dizer(fala, { cara: "img/noto/gato_amor.svg" });
    if (!ativo) return;
    ronda.registar(true);
    ronda = null;
    // Mais vitórias do que na última partida neste nível.
    const antes = ler("quatro.ultima", null);
    gravar("quatro.ultima", { nivel: n, ganhos });
    if (antes && antes.nivel === n && ganhos > antes.ganhos) {
      await e.dizer("quatro.recorde", { cara: "img/noto/gato_amor.svg" });
      if (!ativo) return;
    }
    const r = await premio(e, e.raiz);
    if (r === "outra") comecar();
    else terminar(true);
  }

  comecar();
  return () => terminar(false);
}
