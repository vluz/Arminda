// Pôr a mesa. A pessoa arrasta um prato, um garfo, uma faca, um copo para um lugar da mesa, ou toca
// na peça e depois toca no lugar. Todos os níveis fazem pensar (veredicto da família:
// os níveis fáceis de antes não tinham desafio). Nunca há contornos, e o lado conta sempre.
// Modos:
// - memoria: mostra-se uma mesa posta, tapa-se com uma toalha, e a pessoa volta a pô-la.
// - ordem: o gato diz a ordem (3 coisas, depois 4); o recado dobra-se.
// - erros: uma mesa posta com 1 a 3 erros; a pessoa toca na gaveta no que está mal (falta, está
//   fora do sítio, ou está a mais) e o gato põe certo.
// - contar: uma lista de família ("vêm o avô, a tia e os dois netos"); quantos lugares?
// - por: uma ocasião como regra, sem pistas: pequeno-almoço, jantar com um condutor (sem vinho),
//   Consoada com o bacalhau e a vela ao meio.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio, grelha, estilo, ALVO_MIN } from "../ui.js";
import { baralhar, escolher, animar, sinos, pegavel, tocavel, sobre, voar, barra, emblema, melhorQueAntes, estiloLida } from "./lida.js";

const P = "img/jogos/mesa-";
const N = "img/noto/";

export const COISAS = {
  prato: { src: `${P}prato.svg`, nome: "Prato" },
  garfo: { src: `${P}garfo.svg`, nome: "Garfo" },
  faca: { src: `${P}faca.svg`, nome: "Faca" },
  colher: { src: `${P}colher.svg`, nome: "Colher" },
  copo: { src: `${P}copo.svg`, nome: "Copo" },
  vinho: { src: `${N}vinho.svg`, nome: "Copo de vinho" },
  guardanapo: { src: `${P}guardanapo.svg`, nome: "Guardanapo" },
  chavena: { src: `${N}cafe.svg`, nome: "Chávena" },
  pao: { src: `${N}pao.svg`, nome: "Pão" },
  travessa: { src: `${P}travessa.svg`, nome: "Bacalhau" },
  vela: { src: `${N}vela.svg`, nome: "Vela" },
};
const ORDEM_GAVETA = ["prato", "garfo", "faca", "colher", "copo", "vinho", "guardanapo", "chavena", "pao", "travessa", "vela"];
const DO_CENTRO = new Set(["travessa", "vela"]);
const DO_LUGAR = ["prato", "garfo", "faca", "colher", "copo", "vinho", "guardanapo", "chavena", "pao"];

// Onde fica cada coisa num lugar da mesa, em % do lugar (centro x, centro y, largura, altura).
const ZONAS = {
  guardanapo: [10, 62, 15, 40],
  garfo: [23, 62, 9, 60],
  prato: [48, 61, 38, 70],
  faca: [72, 62, 7, 60],
  colher: [84, 62, 8, 60],
  copo: [85, 18, 12, 30],
  vinho: [70, 17, 13, 32],
  chavena: [84, 19, 22, 32],
  pao: [18, 18, 22, 30],
};
// A regra do lado, tolerante: fx é onde a pessoa largou ao longo do lugar, de 0 (esquerda) a 1 (direita).
const LADO = {
  prato: (fx) => fx >= 0.22 && fx <= 0.78,
  garfo: (fx) => fx < 0.46,
  guardanapo: (fx) => fx < 0.46,
  faca: (fx) => fx > 0.54,
  colher: (fx) => fx > 0.54,
  copo: (fx) => fx > 0.5,
  vinho: (fx) => fx > 0.45,
  chavena: (fx) => fx > 0.5,
  pao: (fx) => fx < 0.5,
};
const AVISO = {
  prato: "mesa.prato_meio", garfo: "mesa.garfo_esq", guardanapo: "mesa.guardanapo_esq", faca: "mesa.faca_dir",
  colher: "mesa.colher_dir", copo: "mesa.copo_dir", vinho: "mesa.copo_dir", chavena: "mesa.chavena_dir", pao: "mesa.pao_esq",
};

const BASE6 = ["prato", "garfo", "faca", "colher", "copo", "guardanapo"];
const JANTAR = ["prato", "garfo", "faca", "copo", "vinho", "guardanapo"];
const CONSOADA = ["prato", "garfo", "faca", "copo", "vinho"];

// Listas de família para contar: [id, lugares]. O patamar a é só somar; o patamar b tem um senão
// (alguém falta, um casal são dois, "e tu também").
const LISTAS = {
  a: [["c_a1", 4], ["c_a2", 3], ["c_a3", 4], ["c_a4", 4], ["c_a5", 4], ["c_a6", 5], ["c_a7", 6], ["c_a8", 3]],
  b: [["c_b1", 5], ["c_b2", 4], ["c_b3", 5], ["c_b4", 5], ["c_b5", 5], ["c_b6", 4], ["c_b7", 5], ["c_b8", 5]],
};
// Listas que acabam em "E tu também": esquecer-se de si dá um a menos.
const COM_ELA = new Set(["c_a2", "c_a4", "c_a8", "c_b1", "c_b5", "c_b8"]);

// lugares: lugares; itens: o que cada lugar precisa; ocasiao: a toalha e a frase de abertura;
// condutor: um lugar não leva vinho; centro: coisas para o meio; distr: coisas que não fazem falta;
// memoria: lugares ao acaso com esse número de coisas, mostrados e depois tapados; mostrar: a mesa
// inteira mostrada e depois tapada; passos: coisas ditas por ordem; erros: erros por mesa;
// lista: patamar de contar.
const NIVEIS = [
  { modo: "memoria", lugares: 1, memoria: [4, 4], mesas: 3 },
  { modo: "ordem", lugares: 1, passos: 3, pool: BASE6, distr: ["chavena"], mesas: 3 },
  { modo: "erros", lugares: 1, erros: [1, 2], mesas: 3 },
  { modo: "contar", lista: "a", perguntas: 4 },
  { modo: "por", ocasiao: "pequeno", lugares: 2, itens: ["chavena", "prato", "faca", "pao"], distr: ["garfo", "vinho", "travessa"], mesas: 1 },
  { modo: "ordem", lugares: 1, passos: 4, pool: [...BASE6, "vinho", "pao"], mesas: 3 },
  { modo: "por", ocasiao: "jantar", lugares: 3, itens: CONSOADA, condutor: true, distr: ["chavena", "travessa"], mesas: 1 },
  { modo: "memoria", lugares: 2, memoria: [3, 5], mesas: 2 },
  { modo: "contar", lista: "b", perguntas: 4 },
  { modo: "erros", lugares: 2, erros: [2, 3], condutor: true, mesas: 2 },
  { modo: "por", ocasiao: "consoada", lugares: 3, itens: [...CONSOADA, "guardanapo"], condutor: true, centro: ["travessa", "vela"], distr: ["chavena"], mesas: 1 },
  { modo: "memoria", ocasiao: "consoada", mostrar: true, lugares: 4, itens: CONSOADA, condutor: true, centro: ["travessa", "vela"], distr: ["chavena"], mesas: 1 },
];

const CARA_FELIZ = "img/noto/gato_feliz.svg";
const CARA_AMOR = "img/noto/gato_amor.svg";
// Uma ronda é rápida quando a mediana do tempo por coisa (ou por resposta) fica abaixo disto.
const RAPIDO_MS = 7000;
const aoAcaso = (n) => Math.floor(Math.random() * n);

// Um lugar decorado: sempre um prato, depois mais umas coisas que nunca partilham um sítio.
function lugarAoCalhas(quantos) {
  const outros = baralhar(["garfo", "faca", "colher", "copo", "vinho", "guardanapo", "chavena", "pao"]);
  const lista = ["prato"];
  for (const x of outros) {
    if (lista.length >= quantos) break;
    if (x === "chavena" && lista.includes("copo")) continue;
    if (x === "copo" && lista.includes("chavena")) continue;
    lista.push(x);
  }
  return lista;
}

// Erros para uma mesa de jantar posta. teclas: o que a pessoa toca na gaveta para o encontrar
// (nunca partilhado por dois erros); usa: as coisas em que mexe no seu lugar (nunca partilhadas
// num mesmo lugar).
function gerarErros(cfg, lugares) {
  const quantos = cfg.erros[0] + aoAcaso(cfg.erros[1] - cfg.erros[0] + 1);
  const teclas = new Set();
  const usa = lugares.map(() => new Set());
  const lista = [];
  for (let t = 0; t < 300 && lista.length < quantos; t++) {
    const k = aoAcaso(lugares.length);
    const tipo = escolher(["troca", "falta", "falta", "vinho", "copo_esq", "chavena"]);
    let m;
    if (tipo === "troca") m = { tipo, teclas: ["garfo", "faca"], usa: ["garfo", "faca"] };
    else if (tipo === "falta") { const x = escolher(["garfo", "faca", "copo", "guardanapo"]); m = { tipo, x, teclas: [x], usa: [x] }; }
    else if (tipo === "vinho") { if (!lugares[k].condutor) continue; m = { tipo, teclas: ["vinho"], usa: ["vinho"] }; }
    else if (tipo === "copo_esq") m = { tipo, teclas: ["copo"], usa: ["copo"] };
    else m = { tipo, teclas: ["chavena"], usa: ["copo", "chavena"] };
    if (m.teclas.some((x) => teclas.has(x)) || m.usa.some((x) => usa[k].has(x))) continue;
    m.k = k;
    m.feito = false;
    lista.push(m);
    m.teclas.forEach((x) => teclas.add(x));
    m.usa.forEach((x) => usa[k].add(x));
  }
  return lista;
}

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo("mesa");
  estiloLida();
  const e = ecra(() => terminar(false));
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  const toques = sinos();
  const temporizadores = [];

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    temporizadores.forEach(clearTimeout);
    toques.fechar();
    if (!completo && ronda) ronda.registar(false);
    e.raiz.remove();
    sair();
  }
  const depois = (fn, ms) => temporizadores.push(setTimeout(() => { if (ativo) fn(); }, ms));

  async function comecar() {
    await estilo("mesa");
    if (!ativo) return;
    const n = nivel("mesa");
    const cfg = NIVEIS[n - 1];
    const inicio = Date.now();
    const st = {
      certos: 0, errados: 0, lado: 0, ordem: 0, falhas: 0, pistas: 0, repeticoes: 0, mesas: 0,
      arrastos: 0, toquesDuplos: 0, tempos: [], serie: 0, melhorSerie: 0, pontos: 0, joaninhas: 0, joaninhasApanhadas: 0,
      achados: 0, falsos: 0, contasCertas: 0, contasErradas: 0, esquecidaEla: 0, lembrar: 0,
    };

    ronda = {
      registar(completo) {
        const erros = st.errados + st.lado + st.ordem;
        const tent = st.certos + erros;
        const mediana = metricas.mediana(st.tempos);
        metricas.ronda("mesa", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: Date.now() - inicio,
          completed: completo,
          score: st.pontos,
          accuracy: tent ? Math.round((st.certos / tent) * 100) / 100 : null,
          mode: cfg.modo,
          places: cfg.lugares || 0,
          occasion: cfg.ocasiao || cfg.modo,
          tables_done: st.mesas,
          items_right: st.certos,
          wrong_items: st.errados,
          side_errors: st.lado,
          order_errors: st.ordem,
          missed_drops: st.falhas,
          hints_needed: st.pistas,
          repeats_heard: st.repeticoes,
          drags: st.arrastos,
          tap_then_tap: st.toquesDuplos,
          ms_per_item_median: mediana,
          longest_streak: st.melhorSerie,
          bonus_shown: st.joaninhas,
          bonus_caught: st.joaninhasApanhadas,
          memory_items: st.lembrar,
          mistakes_found: st.achados,
          false_alarms: st.falsos,
          counts_right: st.contasCertas,
          counts_wrong: st.contasErradas,
          forgot_herself: st.esquecidaEla,
        });
        // Fácil: sem erros, sem ajuda, e rápido. Difícil: claramente difícil demais, não uns deslizes.
        const rapido = mediana == null || mediana <= RAPIDO_MS;
        const facil = completo && erros === 0 && st.pistas === 0 && st.repeticoes === 0 && st.falhas <= 2 && rapido;
        const dificil = completo && (st.pistas >= 3 || erros > Math.max(3, st.certos / 2) || st.falhas > st.certos + 4);
        ajustarNivel("mesa", NIVEIS.length, { completo, facil, dificil });
      },
    };

    const caixa = e.corpo.getBoundingClientRect();
    const paisagem = caixa.width > caixa.height * 1.1;
    const cena = el("div", { class: `pm-cena ${paisagem ? "paisagem" : "retrato"}` });
    const progresso = barra();
    const placarN = el("span", {}, "0");
    const placar = el("div", { class: "pm-pontos" }, [img("img/noto/estrela.svg", ""), placarN]);
    const mesaEl = el("div", { class: "pm-mesa" });
    const gaveta = el("div", { class: "pm-gaveta" });
    cena.append(progresso.raiz, placar, mesaEl, gaveta);
    e.corpo.replaceChildren(cena);
    const serieBadge = emblema(cena);
    progresso.por(0);

    function ganhar(p) {
      st.pontos += p;
      placarN.textContent = String(st.pontos);
      animar(placar, "salta");
    }
    const jogo = {
      acertou() {
        st.certos++;
        st.serie++;
        st.melhorSerie = Math.max(st.melhorSerie, st.serie);
        toques.serie(st.serie);
        serieBadge(st.serie);
        ganhar(10 + (st.serie >= 3 ? 5 : 0));
      },
      errou() { st.serie = 0; som.efeito("quase", 0.4); },
    };

    // De vez em quando uma joaninha atravessa a toalha: um toque vale pontos a mais (e sorte).
    function joaninha() {
      if (!ativo || !cena.isConnected || cena.classList.contains("acabou")) return;
      const rm = mesaEl.getBoundingClientRect();
      const rc = cena.getBoundingClientRect();
      if (!rm.width) return;
      const b = el("button", { class: "pm-joaninha", "aria-label": "Joaninha" }, [img("img/noto/joaninha.svg", "")]);
      const y0 = rm.top - rc.top + rm.height * (0.2 + Math.random() * 0.6);
      const y1 = rm.top - rc.top + rm.height * (0.2 + Math.random() * 0.6);
      b.style.left = `${rm.left - rc.left + 20}px`;
      b.style.top = `${y0}px`;
      cena.append(b);
      st.joaninhas++;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        b.style.left = `${rm.right - rc.left - 20}px`;
        b.style.top = `${y1}px`;
      }));
      b.addEventListener("click", () => {
        if (b.classList.contains("apanhada")) return;
        b.classList.add("apanhada");
        st.joaninhasApanhadas++;
        som.efeito("par", 0.5);
        toques.arpejo();
        ganhar(20);
        e.dizer("mesa.joaninha", { cara: CARA_FELIZ });
        depois(() => b.remove(), 700);
      });
      depois(() => b.remove(), 11000);
      depois(joaninha, 30000 + Math.random() * 20000);
    }
    depois(joaninha, 18000 + Math.random() * 10000);

    const ctxBase = { cena, mesaEl, gaveta, paisagem };
    if (cfg.modo === "contar") {
      const listas = baralhar(LISTAS[cfg.lista]).slice(0, cfg.perguntas);
      for (let q = 0; q < listas.length && ativo; q++) {
        await contar(cfg, st, jogo, { ...ctxBase, lista: listas[q], primeira: q === 0 });
        if (!ativo) return;
        st.mesas++;
        progresso.por((q + 1) / listas.length);
      }
    } else {
      for (let m = 0; m < cfg.mesas && ativo; m++) {
        await porMesa(cfg, st, jogo, { ...ctxBase, primeira: m === 0, progresso: (f) => progresso.por((m + f) / cfg.mesas) });
        if (!ativo) return;
        st.mesas++;
        progresso.por((m + 1) / cfg.mesas);
      }
    }
    if (!ativo) return;
    await e.dizer("mesa.fim", { cara: CARA_AMOR });
    if (!ativo) return;
    if (melhorQueAntes("mesa", n, st.pontos)) {
      await e.dizer("mesa.melhor", { cara: CARA_FELIZ });
      if (!ativo) return;
    }
    ronda.registar(true);
    ronda = null;
    cena.classList.add("acabou");
    const r = await premio(e, e.raiz);
    if (r === "outra") comecar();
    else terminar(true);
  }

  // Os lugares na toalha, dispostos na melhor grelha para um lugar de 1,6 : 1.
  function porLugares(mesaEl, grelhaEl, quantos, comFaixa) {
    const rm = mesaEl.getBoundingClientRect();
    const altura = rm.height * (comFaixa ? 0.72 : 1);
    // Três ou mais lugares ficam sempre dois a dois (três a dois a partir de cinco).
    let melhor = { cols: quantos > 4 ? 3 : 2, filas: Math.ceil(quantos / (quantos > 4 ? 3 : 2)), d: 0 };
    if (quantos <= 2) {
      melhor = { cols: 1, filas: 1, d: Infinity };
      for (let cols = 1; cols <= quantos; cols++) {
        const filas = Math.ceil(quantos / cols);
        const d = Math.abs(Math.log((rm.width / cols) / (altura / filas) / 1.6));
        if (d < melhor.d) melhor = { cols, filas, d };
      }
    }
    grelhaEl.style.setProperty("--cols", melhor.cols);
    grelhaEl.style.setProperty("--filas", melhor.filas);
  }

  function zona(figura, item) {
    const [x, y, w, h] = ZONAS[item];
    figura.style.setProperty("--x", x);
    figura.style.setProperty("--y", y);
    figura.style.setProperty("--w", w);
    figura.style.setProperty("--h", h);
  }

  // A gaveta com tamanho para caber: uma coluna ao lado num ecrã deitado, uma faixa em baixo ao alto.
  function medirGaveta(ctx, quantos, maximo = 150) {
    const rc = ctx.cena.getBoundingClientRect();
    const rg = ctx.paisagem ? { w: rc.width * 0.36, h: rc.height - 50 } : { w: rc.width - 30, h: rc.height * 0.3 };
    const g = grelha(quantos, rg.w, rg.h, 0.9);
    const lado = Math.max(ALVO_MIN, Math.min(g.lado, maximo));
    ctx.gaveta.style.gridTemplateColumns = `repeat(${g.cols}, ${lado}px)`;
    return lado;
  }

  // Contar: o gato diz quem vem; a pessoa escolhe quantos lugares.
  async function contar(cfg, st, jogo, ctx) {
    const { mesaEl, gaveta, primeira } = ctx;
    const [id, certo] = ctx.lista;
    mesaEl.replaceChildren();
    gaveta.replaceChildren();
    delete mesaEl.dataset.resposta;
    mesaEl.className = "pm-mesa simples contar";
    let ocupado = true;
    let errosSeguidos = 0;
    let ultimo = Date.now();
    let acabar = null;
    const feito = new Promise((r) => { acabar = r; });

    const grelhaEl = el("div", { class: "pm-lugares" });
    const pergunta = el("div", { class: "pm-pergunta" }, "?");
    const ouvir = el("button", { class: "botao botao-ouvir pm-ouvir-conta", "aria-label": "Ouvir outra vez" }, [img("img/proprio/ouvir.svg", "")]);
    mesaEl.append(grelhaEl, pergunta, ouvir);
    // Quatro números à volta do certo.
    const perto = baralhar([-2, -1, 1, 2].map((d) => certo + d).filter((x) => x >= 2 && x <= 8));
    const opcoes = [certo, ...perto.slice(0, 3)].sort((a, b) => a - b);
    const lado = medirGaveta(ctx, opcoes.length, 160);
    const botoes = opcoes.map((x) => {
      const b = el("button", { class: "pm-coisa pm-numero", style: { "--lado": `${lado}px` } }, [el("b", {}, String(x))]);
      b.dataset.n = x;
      gaveta.append(b);
      b.addEventListener("click", () => responder(b, x));
      return b;
    });

    async function dizerLista() {
      ocupado = true;
      await e.dizer(`mesa.${id}`);
      ocupado = false;
    }
    ouvir.addEventListener("click", () => { if (!ocupado && ativo) { st.repeticoes++; dizerLista(); } });

    async function responder(b, x) {
      if (ocupado || !ativo) return;
      som.efeito("toque", 0.4);
      st.toquesDuplos++;
      if (x !== certo) {
        st.errados++;
        st.contasErradas++;
        errosSeguidos++;
        jogo.errou();
        animar(b, "lida-abana");
        const esqueceuEla = COM_ELA.has(id) && x === certo - 1;
        if (esqueceuEla) st.esquecidaEla++;
        ocupado = true;
        await e.dizer(esqueceuEla ? "mesa.contar_tu" : "mesa.contar_nao");
        if (!ativo) return;
        ocupado = false;
        if (errosSeguidos >= 2) {
          errosSeguidos = 0;
          st.pistas++;
          st.repeticoes++;
          await dizerLista();
        }
        return;
      }
      ocupado = true;
      st.contasCertas++;
      st.tempos.push(Date.now() - ultimo);
      jogo.acertou();
      b.classList.add("escolhida");
      pergunta.remove();
      ouvir.remove();
      // Os lugares aparecem, cada um com o seu prato.
      porLugares(mesaEl, grelhaEl, certo, false);
      for (let k = 0; k < certo; k++) {
        const l = el("div", { class: "pm-lugar" });
        grelhaEl.append(l);
        const f = img(COISAS.prato.src, "");
        f.className = "pm-posto c-prato";
        zona(f, "prato");
        l.append(f);
        animar(f, "chega");
        toques.serie(k + 1);
        await espera(220);
        if (!ativo) return;
      }
      acabar();
    }

    if (primeira) {
      await e.dizer("mesa.ola", { cara: CARA_FELIZ });
      if (!ativo) return;
      await e.dizer("mesa.contar");
    } else {
      await e.dizer("mesa.contar_mais");
    }
    if (!ativo) return;
    await dizerLista();
    if (!ativo) return;
    mesaEl.dataset.resposta = String(certo);
    ocupado = false;
    ultimo = Date.now();
    await feito;
    if (!ativo) return;
    mesaEl.classList.add("pronta");
    som.efeito("vitoria2", 0.5);
    await e.dizer(som.elogio(), { cara: CARA_AMOR });
    if (!ativo) return;
    await espera(800);
    for (const b of botoes) b.remove();
  }

  // Uma mesa, da toalha vazia até ao "Bom apetite!".
  async function porMesa(cfg, st, jogo, ctx) {
    const { mesaEl, gaveta, primeira } = ctx;
    mesaEl.replaceChildren();
    gaveta.replaceChildren();
    for (const k of ["precisa", "sequencia", "centro", "erros"]) delete mesaEl.dataset[k];
    mesaEl.className = `pm-mesa ${cfg.ocasiao || "simples"}`;
    let ocupado = true;
    let escolhida = null;
    let errosSeguidos = 0;
    let ultimo = Date.now();
    let acabar = null;
    const feito = new Promise((r) => { acabar = r; });
    const memoria = cfg.modo === "memoria";
    const erros = cfg.modo === "erros";

    // O que cada lugar precisa.
    const condutor = cfg.condutor ? aoAcaso(cfg.lugares) : -1;
    const sequencia = cfg.modo === "ordem" ? baralhar(cfg.pool).slice(0, cfg.passos) : null;
    const lugares = [];
    for (let k = 0; k < cfg.lugares; k++) {
      let precisa;
      if (cfg.memoria) precisa = lugarAoCalhas(cfg.memoria[0] + aoAcaso(cfg.memoria[1] - cfg.memoria[0] + 1));
      else if (sequencia) precisa = sequencia;
      else if (erros) precisa = JANTAR;
      else precisa = cfg.itens;
      precisa = precisa.filter((x) => !(k === condutor && x === "vinho"));
      lugares.push({ precisa: new Set(precisa), postos: new Map(), condutor: k === condutor });
    }
    // Dois lugares decorados devem ser diferentes.
    if (cfg.memoria && lugares.length === 2) {
      let tent = 0;
      while ([...lugares[0].precisa].sort().join() === [...lugares[1].precisa].sort().join() && tent++ < 20) {
        lugares[1].precisa = new Set(lugarAoCalhas(cfg.memoria[1]));
      }
    }
    const centro = cfg.centro ? { precisa: new Set(cfg.centro), postos: new Map() } : null;
    const falhasMesa = erros ? gerarErros(cfg, lugares) : null;
    if (memoria) st.lembrar += lugares.reduce((s, l) => s + l.precisa.size, 0) + (centro ? centro.precisa.size : 0);
    if (sequencia) st.lembrar += sequencia.length;

    // Mesa: uma faixa opcional (o meio da mesa, ou o recado dito), depois os lugares.
    const faixa = centro || sequencia ? el("div", { class: centro ? "pm-centro" : "pm-faixa" }) : null;
    if (centro) faixa.append(el("span", { class: "pm-centro-nome" }, "Meio da mesa"));
    const grelhaEl = el("div", { class: "pm-lugares" });
    if (faixa) { mesaEl.classList.add("com-faixa"); mesaEl.append(faixa); }
    mesaEl.append(grelhaEl);
    porLugares(mesaEl, grelhaEl, cfg.lugares, !!faixa);
    for (const [k, l] of lugares.entries()) {
      l.el = el("div", { class: "pm-lugar" });
      l.el.dataset.k = k;
      if (l.condutor) l.el.append(el("div", { class: "pm-condutor" }, [img(`${N}carro.svg`, "")]));
      grelhaEl.append(l.el);
    }
    // Erros encontrados até agora, como anéis que se enchem.
    const marcas = erros ? el("div", { class: "pm-marcas" }, falhasMesa.map(() => el("i", {}, "?"))) : null;
    if (marcas) mesaEl.append(marcas);

    function pousar(onde, item, origem, sitio = item) {
      const f = img(COISAS[item].src, "");
      f.className = `pm-posto c-${item}`;
      if (onde !== faixa) zona(f, sitio);
      onde.append(f);
      const fazer = () => {
        if (!ativo) return;
        f.classList.remove("a-caminho");
        animar(f, "chega");
      };
      if (origem) {
        f.classList.add("a-caminho");
        voar(e.raiz, origem.querySelector("img"), origem, f, fazer, 380);
      } else fazer();
      return f;
    }

    // Gaveta: um botão por tipo; nunca se esgota.
    let tipos;
    if (erros) tipos = [...JANTAR, "chavena"];
    else if (cfg.memoria) tipos = DO_LUGAR;
    else if (sequencia) tipos = [...cfg.pool, ...(cfg.distr || [])];
    else tipos = [...lugares.flatMap((l) => [...l.precisa]), ...(cfg.centro || []), ...(cfg.distr || [])];
    tipos = ORDEM_GAVETA.filter((x) => tipos.includes(x));
    const lado = medirGaveta(ctx, tipos.length);
    const botoes = tipos.map((x) => {
      const b = el("button", { class: "pm-coisa", style: { "--lado": `${lado}px` } }, [img(COISAS[x].src, ""), el("span", {}, COISAS[x].nome)]);
      b.dataset.item = x;
      gaveta.append(b);
      pegavel(b, {
        camada: e.raiz,
        pode: () => !ocupado && ativo,
        tocar: () => (erros ? apontar(b) : tocarCoisa(b)),
        largar: (px, py) => (erros ? largarApontar(b, px, py) : largarCoisa(b, px, py)),
      });
      return b;
    });
    const alvos = () => [...lugares.map((l) => l.el), ...(centro ? [faixa] : [])];
    if (!erros) for (const a of alvos()) tocavel(a, (px, py) => tocarAlvo(a, px, py));

    const total = erros ? falhasMesa.length : lugares.reduce((s, l) => s + l.precisa.size, 0) + (centro ? centro.precisa.size : 0);
    let postos = 0;

    function escolher_(b) {
      for (const x of botoes) x.classList.remove("escolhida");
      escolhida = b;
      if (b) b.classList.add("escolhida");
    }
    function tocarCoisa(b) {
      if (ocupado || !ativo) return;
      som.efeito("toque", 0.4);
      escolher_(escolhida === b ? null : b);
    }
    function tocarAlvo(a, px, py) {
      if (ocupado || !ativo) return;
      if (!escolhida) { e.dizer("mesa.toca_coisa"); return; }
      st.toquesDuplos++;
      colocar(escolhida, a, px, py);
    }
    function largarCoisa(b, px, py) {
      if (ocupado || !ativo) return;
      st.arrastos++;
      escolher_(null);
      const lista = alvos();
      const k = sobre(lista, px, py, 0.06);
      if (k < 0) {
        st.falhas++;
        errosSeguidos++;
        som.efeito("quase", 0.3);
        if (errosSeguidos >= 2) { errosSeguidos = 0; e.dizer("mesa.na_mesa"); for (const a of lista) animar(a, "lida-pista"); }
        return;
      }
      colocar(b, lista[k], px, py);
    }

    // Contornos do que ainda falta, por um momento.
    function espreitar() {
      const lista = [];
      const contorno = (onde, item) => {
        const f = img(COISAS[item].src, "");
        f.className = `pm-contorno pm-espreita c-${item}`;
        if (onde !== faixa) zona(f, item);
        onde.append(f);
        lista.push(f);
      };
      for (const l of lugares) for (const x of l.precisa) if (!l.postos.has(x)) contorno(l.el, x);
      if (centro) for (const x of centro.precisa) if (!centro.postos.has(x)) contorno(faixa, x);
      depois(() => lista.forEach((f) => f.remove()), 2200);
    }
    async function pista() {
      st.pistas++;
      errosSeguidos = 0;
      if (sequencia) { st.repeticoes++; await dizerRecado(); return; }
      if (erros) {
        const m = falhasMesa.find((x) => !x.feito);
        if (m) animar(lugares[m.k].el, "lida-pista");
        await e.dizer("mesa.erros_pista");
        return;
      }
      espreitar();
      e.dizer("mesa.espreita");
    }
    async function falhar(b, linha, tipo) {
      st[tipo]++;
      errosSeguidos++;
      jogo.errou();
      animar(b, "lida-abana");
      ocupado = true;
      await e.dizer(linha);
      ocupado = false;
      if (!ativo) return;
      if (errosSeguidos >= 2) await pista();
    }

    async function colocar(b, alvo, px, py) {
      const item = b.dataset.item;
      if (alvo === faixa) {
        if (!centro || !DO_CENTRO.has(item)) { await falhar(b, "mesa.lugar_nao", "errados"); return; }
        if (centro.postos.has(item)) { await falhar(b, "mesa.ja_tem", "errados"); return; }
        certo(b, centro, faixa, item);
        return;
      }
      const l = lugares[Number(alvo.dataset.k)];
      if (DO_CENTRO.has(item)) { await falhar(b, centro ? "mesa.centro_meio" : "mesa.nao_precisa", "errados"); return; }
      if (l.postos.has(item)) { await falhar(b, "mesa.ja_tem", "errados"); return; }
      if (!l.precisa.has(item)) {
        const linha = l.condutor && item === "vinho" ? "mesa.nao_bebe"
          : cfg.ocasiao === "pequeno" && item === "vinho" ? "mesa.pequeno_vinho"
            : sequencia ? "mesa.ordem_fora" : memoria ? "mesa.memoria_nao" : "mesa.nao_precisa";
        await falhar(b, linha, "errados");
        return;
      }
      if (sequencia && item !== sequencia[postos]) { await falhar(b, "mesa.ordem_nao", "ordem"); return; }
      const r = alvo.getBoundingClientRect();
      const fx = (px - r.left) / r.width;
      if (!LADO[item](fx)) { await falhar(b, AVISO[item], "lado"); return; }
      certo(b, l, l.el, item);
    }

    function certo(b, sitio, onde, item) {
      errosSeguidos = 0;
      escolher_(null);
      sitio.postos.set(item, pousar(onde, item, b));
      jogo.acertou();
      som.efeito("marcar", 0.35);
      st.tempos.push(Date.now() - ultimo);
      ultimo = Date.now();
      postos++;
      ctx.progresso(postos / total);
      if (postos >= total) { ocupado = true; acabar(); }
    }

    // "O que está mal": um toque (ou uma largada na mesa) numa coisa da gaveta aponta para ela.
    function largarApontar(b, px, py) {
      if (ocupado || !ativo) return;
      st.arrastos++;
      if (sobre([mesaEl], px, py, 0.02) < 0) {
        st.falhas++;
        som.efeito("quase", 0.3);
        return;
      }
      apontar(b, true);
    }
    async function apontar(b, arrastado = false) {
      if (ocupado || !ativo) return;
      if (!arrastado) st.toquesDuplos++;
      const item = b.dataset.item;
      som.efeito("toque", 0.4);
      const m = falhasMesa.find((x) => !x.feito && x.teclas.includes(item));
      if (!m) {
        st.falsos++;
        await falhar(b, "mesa.erros_bem", "errados");
        return;
      }
      m.feito = true;
      errosSeguidos = 0;
      st.achados++;
      st.tempos.push(Date.now() - ultimo);
      ultimo = Date.now();
      jogo.acertou();
      ocupado = true;
      const l = lugares[m.k];
      animar(l.el, "lida-pista");
      // O gato põe certo.
      let linha = "mesa.fix_falta";
      if (m.tipo === "troca") {
        zona(l.postos.get("garfo"), "garfo");
        zona(l.postos.get("faca"), "faca");
        linha = "mesa.fix_troca";
      } else if (m.tipo === "falta") {
        l.postos.set(m.x, pousar(l.el, m.x, b));
      } else if (m.tipo === "vinho") {
        l.postos.get("vinho").classList.add("sai");
        linha = "mesa.nao_bebe";
      } else if (m.tipo === "copo_esq") {
        zona(l.postos.get("copo"), "copo");
        linha = "mesa.copo_dir";
      } else if (m.tipo === "chavena") {
        l.postos.get("chavena").classList.add("sai");
        l.postos.set("copo", pousar(l.el, "copo", botoes.find((x) => x.dataset.item === "copo")));
        linha = "mesa.fix_chavena";
      }
      som.efeito("marcar", 0.35);
      const marca = marcas.children[falhasMesa.filter((x) => x.feito).length - 1];
      if (marca) { marca.classList.add("achada"); marca.textContent = "✓"; animar(marca, "chega"); }
      postos++;
      ctx.progresso(postos / total);
      mesaEl.dataset.erros = falhasMesa.filter((x) => !x.feito).map((x) => x.teclas[0]).join(",");
      await e.dizer(linha, { cara: CARA_FELIZ });
      if (!ativo) return;
      if (postos >= total) { acabar(); return; }
      ocupado = false;
    }

    // Ordem dita: dita uma vez, escrita num recado na faixa, e depois dobrada.
    let recado = null;
    let vezRecado = 0;
    const ouvir = sequencia ? el("button", { class: "botao botao-ouvir pm-ouvir", "aria-label": "Ouvir outra vez" }, [img("img/proprio/ouvir.svg", "")]) : null;
    if (sequencia) {
      recado = el("ol", { class: `pm-recado${sequencia.length > 3 ? " dois" : ""}` });
      faixa.append(ouvir, recado);
      ouvir.addEventListener("click", () => { if (!ocupado && ativo) { st.repeticoes++; dizerRecado(); } });
    }
    async function dizerRecado() {
      const ids = sequencia.map((x, k) => `mesa.${k === 0 ? "primeiro" : "depois"}_${x}`);
      recado.classList.add("escondido");
      ocupado = true;
      for (const id of ids) {
        await e.dizer(id);
        if (!ativo) return;
      }
      recado.replaceChildren(...ids.map((id) => el("li", {}, som.texto(id).replace(/^(Primeiro|Depois),\s*/, "").replace(/[.!]$/, ""))));
      recado.classList.remove("escondido");
      animar(recado, "chega");
      ocupado = false;
      const vez = ++vezRecado;
      depois(() => {
        if (vez !== vezRecado) return;
        recado.classList.add("escondido");
        e.balao.classList.add("vazio");
        som.efeito("virar", 0.4);
      }, 2500 + ids.length * 800);
    }

    // A mesa posta: tudo no sítio (níveis de memória), ou com erros (o que está mal).
    function porTudo(comErros) {
      for (const [k, l] of lugares.entries()) {
        const meus = comErros ? falhasMesa.filter((m) => m.k === k) : [];
        const tem = (t) => meus.find((m) => m.tipo === t);
        for (const x of l.precisa) {
          if (meus.some((m) => m.tipo === "falta" && m.x === x)) continue;
          if (x === "copo" && tem("chavena")) continue;
          let sitio = x;
          if (tem("troca") && x === "garfo") sitio = "faca";
          if (tem("troca") && x === "faca") sitio = "garfo";
          if (tem("copo_esq") && x === "copo") sitio = "pao";
          l.postos.set(x, pousar(l.el, x, null, sitio));
        }
        if (tem("vinho")) l.postos.set("vinho", pousar(l.el, "vinho"));
        if (tem("chavena")) l.postos.set("chavena", pousar(l.el, "chavena"));
      }
      if (centro && !comErros) for (const x of centro.precisa) centro.postos.set(x, pousar(faixa, x));
    }

    // Frases de abertura.
    if (primeira) {
      await e.dizer("mesa.ola", { cara: CARA_FELIZ });
      if (!ativo) return;
    }
    if (memoria) {
      if (cfg.ocasiao && primeira) await e.dizer(`mesa.${cfg.ocasiao}`, { cara: CARA_FELIZ });
      if (!ativo) return;
      // A mesa é mostrada posta, e depois tapada com a toalha.
      porTudo(false);
      await e.dizer("mesa.memoria");
      if (!ativo) return;
      await espera(2500 + total * 700);
      if (!ativo) return;
      const pano = el("div", { class: "pm-pano" });
      mesaEl.append(pano);
      som.efeito("virar", 0.6);
      await espera(900);
      if (!ativo) return;
      for (const sitio of [...lugares, ...(centro ? [centro] : [])]) { for (const f of sitio.postos.values()) f.remove(); sitio.postos.clear(); }
      pano.classList.add("sai");
      await espera(700);
      pano.remove();
      if (!ativo) return;
      await e.dizer("mesa.memoria_agora");
    } else if (erros) {
      porTudo(true);
      if (primeira) await e.dizer("mesa.erros", { cara: CARA_FELIZ });
      else await e.dizer("mesa.outra_mesa");
      if (!ativo) return;
      await e.dizer(`mesa.erros_n${falhasMesa.length}`);
      if (!ativo) return;
      if (primeira) await e.dizer("mesa.erros_como");
    } else if (sequencia) {
      if (primeira) await e.dizer("mesa.ordem_lembra");
      if (!ativo) return;
      await dizerRecado();
    } else if (cfg.ocasiao) {
      // A ocasião é a regra: sem lista do que pôr.
      await e.dizer(cfg.ocasiao === "pequeno" ? "mesa.pequeno_so" : `mesa.${cfg.ocasiao}`, { cara: CARA_FELIZ });
      if (!ativo) return;
      if (cfg.lugares > 1 && primeira) await e.dizer(`mesa.lugares_${cfg.lugares}`);
      if (!ativo) return;
      if (cfg.condutor && primeira) await e.dizer("mesa.carro");
    }
    if (!ativo) return;
    // Dados para a jogada automática: o que cada lugar precisa, a ordem, os erros.
    mesaEl.dataset.precisa = JSON.stringify(lugares.map((l) => [...l.precisa]));
    mesaEl.dataset.sequencia = sequencia ? sequencia.join(",") : "";
    mesaEl.dataset.centro = centro ? [...centro.precisa].join(",") : "";
    mesaEl.dataset.erros = erros ? falhasMesa.map((x) => x.teclas[0]).join(",") : "";
    mesaEl.dataset.modo = cfg.modo;
    ocupado = false;
    ultimo = Date.now();

    await feito;
    if (!ativo) return;
    await espera(500);
    if (!ativo) return;
    mesaEl.classList.add("pronta");
    toques.arpejo();
    som.efeito("vitoria2", 0.5);
    await e.dizer(escolher(["mesa.pronto", "mesa.bom_apetite"]), { cara: CARA_AMOR });
    if (!ativo) return;
    await espera(1000);
  }

  comecar();
  return () => terminar(false);
}
