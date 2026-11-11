// Sudoku: um sudoku de imagens, como os das crianças, que cresce até um sudoku de números.
// Níveis baixos: 4x4 com frutas ou animais e muitas imagens já no sítio.
// Depois menos casas dadas, depois algarismos, depois 6x6 (caixas de 2 linhas por 3 colunas) no topo.
// A pessoa toca numa casa vazia e depois numa imagem da paleta, ou primeiro na imagem e depois nas casas.
// Os desafios são feitos em código a partir de uma semente e resolvem-se sempre por dedução simples (uma só resposta).

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel, ler, gravar } from "../estado.js";
import { el, img, ecra, espera, premio, estilo, ALVO_MIN } from "../ui.js";

// Imagens de cores bem diferentes, para não haver duas parecidas no tabuleiro.
const FRUTA = ["maca", "banana", "uvas", "pera", "laranja"];
const BICHOS = ["gato", "porco", "sapo", "galinha", "coelho", "pato"];

// n: lado do tabuleiro, tipo: o que são os símbolos, dadas: casas já preenchidas, puzzles: desafios por ronda.
const NIVEIS = [
  { n: 4, tipo: "fruta", dadas: 12, puzzles: 3 },
  { n: 4, tipo: "fruta", dadas: 10, puzzles: 3 },
  { n: 4, tipo: "bichos", dadas: 8, puzzles: 3 },
  { n: 4, tipo: "bichos", dadas: 6, puzzles: 3 },
  { n: 4, tipo: "numeros", dadas: 7, puzzles: 3 },
  { n: 4, tipo: "numeros", dadas: 5, puzzles: 3 },
  { n: 6, tipo: "numeros", dadas: 26, puzzles: 2 },
  { n: 6, tipo: "numeros", dadas: 22, puzzles: 2 },
  { n: 6, tipo: "numeros", dadas: 18, puzzles: 1 },
  { n: 6, tipo: "numeros", dadas: 15, puzzles: 1 },
  { n: 6, tipo: "numeros", dadas: 12, puzzles: 1 },
];
// Forma da caixa [linhas, colunas] para cada lado de tabuleiro.
const CAIXAS = { 4: [2, 2], 6: [2, 3] };
// A família só aceita casas de 90 px no tabuleiro de 6x6.
const MIN_6 = 90;

// Pequeno gerador de números ao acaso com semente (mulberry32), para um desafio se poder refazer a partir da semente.
function aleatorio(s) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function baralhar(lista, rnd) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Linhas, colunas e caixas como listas de índices de casas, e para cada casa as três unidades em que está.
function preparar(n) {
  const [br, bc] = CAIXAS[n];
  const unidades = [];
  for (let r = 0; r < n; r++) unidades.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) unidades.push(Array.from({ length: n }, (_, r) => r * n + c));
  for (let r0 = 0; r0 < n; r0 += br) {
    for (let c0 = 0; c0 < n; c0 += bc) {
      const q = [];
      for (let r = r0; r < r0 + br; r++) for (let c = c0; c < c0 + bc; c++) q.push(r * n + c);
      unidades.push(q);
    }
  }
  const daCasa = [];
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n);
    const c = i % n;
    daCasa.push([r, n + c, 2 * n + Math.floor(r / br) * (n / bc) + Math.floor(c / bc)]);
  }
  return { n, br, bc, unidades, daCasa };
}

// Um tabuleiro completo e válido: um padrão de base com linhas, colunas, faixas, pilhas e símbolos baralhados.
function solucao(P, rnd) {
  const { n, br, bc } = P;
  const grupos = (tam, quantos) => baralhar([...Array(quantos).keys()], rnd)
    .flatMap((g) => baralhar([...Array(tam).keys()], rnd).map((x) => g * tam + x));
  const linhas = grupos(br, n / br);
  const colunas = grupos(bc, n / bc);
  const simbolos = baralhar([...Array(n).keys()].map((x) => x + 1), rnd);
  const g = [];
  for (const r of linhas) {
    for (const c of colunas) g.push(simbolos[(bc * (r % br) + Math.floor(r / br) + c) % n]);
  }
  return g;
}

function candidatos(P, g, i) {
  const usados = new Set();
  for (const u of P.daCasa[i]) for (const j of P.unidades[u]) if (g[j]) usados.add(g[j]);
  const lista = [];
  for (let v = 1; v <= P.n; v++) if (!usados.has(v)) lista.push(v);
  return lista;
}

// A casa seguinte que a dedução simples consegue preencher: uma casa com um só candidato, ou o
// único sítio para um símbolo numa linha, coluna ou caixa. Devolve { i, v } ou null.
function deducao(P, g, rnd) {
  const vazias = [];
  for (let i = 0; i < g.length; i++) if (!g[i]) vazias.push(i);
  for (const i of rnd ? baralhar(vazias, rnd) : vazias) {
    const c = candidatos(P, g, i);
    if (c.length === 1) return { i, v: c[0] };
  }
  for (const u of P.unidades) {
    for (let v = 1; v <= P.n; v++) {
      if (u.some((j) => g[j] === v)) continue;
      const onde = u.filter((j) => !g[j] && candidatos(P, g, j).includes(v));
      if (onde.length === 1) return { i: onde[0], v };
    }
  }
  return null;
}

// Verdadeiro quando a dedução sozinha enche o tabuleiro; um desafio assim tem exatamente uma resposta.
function resolve(P, g) {
  const t = g.slice();
  for (;;) {
    const d = deducao(P, t, null);
    if (!d) return t.every((v) => v);
    t[d.i] = d.v;
  }
}

// Tira casas por ordem ao acaso enquanto o desafio ainda se resolve por dedução, até ficarem `dadas`.
function gerar(P, dadas, semente) {
  const rnd = aleatorio(semente);
  const sol = solucao(P, rnd);
  let melhor = null;
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const g = sol.slice();
    let cheias = g.length;
    for (const i of baralhar([...g.keys()], rnd)) {
      if (cheias <= dadas) break;
      const v = g[i];
      g[i] = 0;
      if (resolve(P, g)) cheias--;
      else g[i] = v;
    }
    if (!melhor || cheias < melhor.cheias) melhor = { g, cheias };
    if (cheias <= dadas) break;
  }
  return { sol, g: melhor.g };
}

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  const pronto = estilo("sudoku");
  const enche = el("div", { class: "sdk-enche" });
  const selo = el("div", { class: "sdk-serie" });
  const progresso = el("div", { class: "sdk-progresso" }, [el("div", { class: "sdk-barra" }, [enche]), selo]);
  const e = ecra(() => terminar(false), [progresso]);
  e.raiz.classList.add("sdk-ecra");
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let temporizadores = [];

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    temporizadores.forEach(clearTimeout);
    if (!completo && ronda) ronda.registar(false);
    e.raiz.remove();
    sair();
  }
  const depois = (ms, f) => temporizadores.push(setTimeout(() => { if (ativo) f(); }, ms));

  // Tamanho da casa para um tabuleiro de n x n com a paleta ao lado (ecrã largo) ou por baixo (ao alto).
  function medir(n, caixa) {
    const deitado = caixa.width >= caixa.height;
    const fator = n + 1.2;
    const lado = deitado
      ? Math.min(caixa.width / fator, caixa.height / n)
      : Math.min(caixa.width / n, caixa.height / fator);
    return { deitado, lado: Math.min(170, Math.floor(lado * 0.95)) };
  }

  async function comecar() {
    await pronto;
    if (!ativo) return;
    const caixa = e.corpo.getBoundingClientRect();
    // O ecrã limita o nível: um tabuleiro de 6x6 cujas casas ficariam abaixo de 90 px desce para 4x4.
    let n = nivel("sudoku");
    while (n > 1 && NIVEIS[n - 1].n === 6 && medir(6, caixa).lado < MIN_6) n--;
    const cfg = NIVEIS[n - 1];
    const P = preparar(cfg.n);
    const { deitado, lado } = medir(cfg.n, caixa);

    const inicio = Date.now();
    const sementes = [];
    let certas = 0;
    let erros = 0;
    let errosVisiveis = 0;
    let pistas = 0;
    let feitos = 0;
    let vaziasTotal = 0;
    let serie = 0;
    let melhorSerie = 0;
    const tempos = [];
    const planos = [];

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        const mediana = metricas.mediana(tempos);
        metricas.ronda("sudoku", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: certas,
          board: `${cfg.n}x${cfg.n}-${cfg.tipo}`,
          puzzles: cfg.puzzles,
          puzzles_done: feitos,
          givens: planos.length ? Math.round(cfg.n * cfg.n - vaziasTotal / planos.length) : null,
          empty_cells: vaziasTotal,
          wrong_placements: erros,
          visible_clashes: errosVisiveis,
          hints_needed: pistas,
          best_streak: melhorSerie,
          ms_per_cell_median: mediana,
          cell_px: lado,
          seeds: sementes.join(","),
          accuracy: certas + erros ? Math.round((certas / (certas + erros)) * 100) / 100 : null,
        });
        // Claramente fácil: no máximo um deslize, nenhuma pista, e casas rápidas. Claramente difícil:
        // muitas pistas, ou mais símbolos postos errados do que casas vazias.
        const rapido = cfg.n === 4 ? 9000 : 15000;
        const facil = completo && erros <= 1 && pistas === 0 && mediana != null && mediana <= rapido;
        const dificil = completo && (pistas >= 3 || erros >= Math.max(8, vaziasTotal));
        ajustarNivel("sudoku", NIVEIS.length, { completo, facil, dificil });
      },
    };

    // Símbolos: imagens nos níveis baixos, algarismos mais acima.
    const figuras = cfg.tipo === "numeros" ? null
      : baralhar(cfg.tipo === "fruta" ? FRUTA : BICHOS, Math.random).slice(0, cfg.n);
    const desenho = (v) => figuras
      ? img(`img/noto/${figuras[v - 1]}.svg`, "")
      : el("span", { class: "sdk-num" }, String(v));

    const mostrarProgresso = (feitas, total) => {
      enche.style.width = `${Math.round((feitas / total) * 100)}%`;
    };

    // Planear primeiro a ronda inteira, para a barra mostrar a ronda e não um só desafio.
    for (let k = 0; k < cfg.puzzles; k++) {
      const s = (Math.random() * 4294967296) >>> 0;
      sementes.push(s);
      planos.push(gerar(P, cfg.dadas, s));
    }
    vaziasTotal = planos.reduce((a, p) => a + p.g.filter((v) => !v).length, 0);
    let preenchidas = 0;
    mostrarProgresso(0, vaziasTotal);
    selo.textContent = "";

    await e.dizer(cfg.n === 6 ? "sudoku.comecar_grande" : figuras ? "sudoku.comecar_figuras" : "sudoku.comecar_numeros");
    if (!ativo) return;

    for (let k = 0; k < planos.length && ativo; k++) {
      if (k > 0) {
        await e.dizer("sudoku.outro");
        if (!ativo) return;
      }
      await jogar(planos[k], k);
      if (!ativo) return;
      feitos++;
      if (k < planos.length - 1) {
        await e.dizer("sudoku.feito", { cara: "img/noto/gato_feliz.svg" });
        if (!ativo) return;
      }
    }
    if (!ativo) return;

    await e.dizer("sudoku.todos", { cara: "img/noto/gato_amor.svg" });
    if (!ativo) return;
    ronda.registar(true);
    ronda = null;
    // Melhor do que na última ronda acabada neste nível: menos deslizes, ou claramente mais rápido.
    const mediana = metricas.mediana(tempos);
    const antes = ler("sudoku.ultima", null);
    gravar("sudoku.ultima", { nivel: n, erros, mediana });
    if (antes && antes.nivel === n && (erros < antes.erros
      || (erros === antes.erros && mediana != null && antes.mediana != null && mediana < antes.mediana * 0.85))) {
      await e.dizer("sudoku.recorde", { cara: "img/noto/gato_amor.svg" });
      if (!ativo) return;
    }
    const r = await premio(e, e.raiz);
    if (r === "outra") comecar();
    else terminar(true);

    // Um desafio. Resolve quando o tabuleiro está cheio.
    function jogar(plano, k) {
      return new Promise(async (acabar) => {
        const { sol } = plano;
        const g = plano.g.slice();
        const N = cfg.n;
        let casa = null;      // casa vazia escolhida (primeiro a casa)
        let simbolo = null;   // símbolo da paleta escolhido (primeiro a imagem)
        let bloqueado = false;
        let errosSeguidos = 0;
        let ultimo = Date.now();
        let pistaCasa = null;

        const tab = el("div", { class: `sdk-tab n${N}`, style: { "--lado": `${lado}px`, "--n": N } });
        const casas = g.map((v, i) => {
          const r = Math.floor(i / N);
          const c = i % N;
          const b = el("button", { class: "sdk-casa", "aria-label": `casa ${i + 1}` });
          if ((c + 1) % P.bc === 0 && c < N - 1) b.classList.add("bd");
          if ((r + 1) % P.br === 0 && r < N - 1) b.classList.add("bb");
          if (v) { b.classList.add("dada"); b.append(desenho(v)); }
          b.addEventListener("click", () => tocarCasa(i));
          return b;
        });
        tab.append(...casas);
        const paleta = el("div", { class: "sdk-paleta", style: { "--lado": `${lado}px`, "--n": N } });
        const botoes = [];
        for (let v = 1; v <= N; v++) {
          const b = el("button", { class: "sdk-escolha", "aria-label": `escolha ${v}` }, [desenho(v)]);
          b.addEventListener("click", () => tocarPaleta(v));
          botoes.push(b);
          paleta.append(b);
        }
        e.corpo.replaceChildren(el("div", { class: `sdk-mesa ${deitado ? "deitado" : "em-pe"}` }, [tab, paleta]));
        tab.classList.add("entra");
        atualizar();

        if (k === 0) {
          await e.dizer(figuras ? "sudoku.como" : "sudoku.como_numero");
          if (!ativo) return;
          if (n >= 3) await e.dizer("sudoku.quadrados");
          if (!ativo) return;
        }

        function atualizar() {
          casas.forEach((b, i) => {
            b.classList.toggle("escolhida", i === casa);
            b.classList.toggle("zona", casa !== null && i !== casa && P.daCasa[i].some((u) => P.daCasa[casa].includes(u)));
          });
          botoes.forEach((b, j) => {
            b.classList.toggle("escolhida", simbolo === j + 1);
            b.classList.toggle("esgotada", g.filter((v) => v === j + 1).length >= N);
          });
        }

        function tocarCasa(i) {
          if (bloqueado || !ativo || g[i]) return;
          if (simbolo) { colocar(i, simbolo); return; }
          som.efeito("toque", 0.4);
          casa = casa === i ? null : i;
          atualizar();
        }

        function tocarPaleta(v) {
          if (bloqueado || !ativo) return;
          if (casa !== null) { colocar(casa, v); return; }
          som.efeito("toque", 0.4);
          simbolo = simbolo === v ? null : v;
          atualizar();
        }

        function colocar(i, v) {
          const b = casas[i];
          const agora = Date.now();
          if (v === sol[i]) {
            g[i] = v;
            certas++;
            preenchidas++;
            errosSeguidos = 0;
            tempos.push(agora - ultimo);
            ultimo = agora;
            b.replaceChildren(desenho(v));
            b.classList.remove("pista");
            b.classList.add("certa");
            if (pistaCasa === i) pistaCasa = null;
            // Cada jogada começa do zero: uma imagem nunca fica escolhida para a casa vazia seguinte (a pedido da família).
            casa = null;
            simbolo = null;
            atualizar();
            mostrarProgresso(preenchidas, vaziasTotal);
            // Notas a subir para respostas certas de seguida.
            serie++;
            melhorSerie = Math.max(melhorSerie, serie);
            som.efeito(`sudoku-serie${Math.min(serie, 5)}`, 0.6);
            if (serie >= 3) {
              selo.textContent = String(serie);
              selo.classList.remove("viva");
              void selo.offsetWidth;
              selo.classList.add("viva");
            }
            // Uma linha, coluna ou caixa completa brilha.
            const completas = P.daCasa[i].filter((u) => P.unidades[u].every((j) => g[j]));
            if (completas.length) {
              depois(250, () => som.efeito("linha", 0.45));
              for (const u of completas) {
                for (const j of P.unidades[u]) {
                  casas[j].classList.remove("brilha");
                  void casas[j].offsetWidth;
                  casas[j].classList.add("brilha");
                }
              }
            }
            if (g.every((x) => x)) {
              bloqueado = true;
              som.efeito("vitoria2", 0.5);
              tab.classList.add("completo");
              depois(900, () => acabar());
              return;
            }
            if (serie === 5) e.dizer("sudoku.serie5", { cara: "img/noto/gato_feliz.svg" });
            else if (serie === 10) e.dizer("sudoku.serie10", { cara: "img/noto/gato_amor.svg" });
            else if (Math.random() < 0.18) e.dizer(som.elogio(), { cara: "img/noto/gato_feliz.svg" });
            return;
          }
          // Errado: o símbolo aparece por um momento, abana, e volta atrás.
          erros++;
          errosSeguidos++;
          serie = 0;
          selo.textContent = "";
          bloqueado = true;
          b.replaceChildren(desenho(v));
          b.classList.add("errada");
          som.efeito("quase", 0.45);
          // Apontar para o choque que a pessoa consegue ver, se houver.
          let fala = "sudoku.nao_da";
          const nomes = ["sudoku.fila", "sudoku.coluna", "sudoku.quadrado"];
          for (let t = 0; t < 3; t++) {
            const j = P.unidades[P.daCasa[i][t]].find((x) => g[x] === v);
            if (j !== undefined) {
              fala = nomes[t];
              casas[j].classList.remove("conflito");
              void casas[j].offsetWidth;
              casas[j].classList.add("conflito");
              break;
            }
          }
          if (fala !== "sudoku.nao_da") errosVisiveis++;
          const pedirPista = errosSeguidos >= (N === 6 ? 3 : 2);
          if (!pedirPista) e.dizer(errosSeguidos === 1 ? fala : som.quase());
          depois(900, () => {
            b.classList.remove("errada");
            b.replaceChildren();
            casa = null;
            simbolo = null;
            bloqueado = false;
            if (pedirPista) mostrarPista();
            atualizar();
          });
        }

        // O gato aponta para uma casa que só tem uma resposta possível.
        function mostrarPista() {
          errosSeguidos = 0;
          pistas++;
          const d = deducao(P, g, Math.random) || { i: g.findIndex((x) => !x) };
          if (pistaCasa !== null) casas[pistaCasa].classList.remove("pista");
          pistaCasa = d.i;
          casas[d.i].classList.add("pista");
          simbolo = null;
          casa = d.i;
          atualizar();
          e.dizer(figuras ? "sudoku.pista" : "sudoku.pista_numero");
        }
      });
    }
  }

  comecar();
  return () => terminar(false);
}
