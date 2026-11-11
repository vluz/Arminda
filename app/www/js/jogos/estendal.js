// Estendal: estender a roupa numa corda ao sol. A pessoa arrasta uma peça para a corda, ou toca
// nela e depois toca na corda. Todos os níveis fazem pensar (veredicto da família: os níveis
// fáceis de antes não tinham desafio). Modos:
// - pedido: o gato pede peças com nome, por ordem; o recado dobra-se, para a pessoa as decorar.
// - padrao: há um padrão na corda; a pessoa continua-o, com peças parecidas no cesto.
// - falta: mostra-se uma corda, o vento leva uma ou duas peças; quais eram?
// - regra: cada corda já tem duas peças com uma coisa em comum (cor, tipo ou padrão); a pessoa
//   descobre a regra e só estende o que serve; as peças que não servem a nenhuma corda ficam no cesto.
// - encomenda: a encomenda dita pela vizinha ("as camisolas primeiro, depois as meias...").
// - copiar: o vento leva a corda inteira; a pessoa volta a estendê-la pela mesma ordem.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio, grelha, cabem, estilo, ALVO_MIN } from "../ui.js";
import { baralhar, escolher, animar, sinos, pegavel, tocavel, sobre, voar, barra, emblema, melhorQueAntes, estiloLida } from "./lida.js";
import { urlRoupa, CATALOGO, TIPOS, PADROES } from "./estendal-roupa.js";

const NIVEIS = [
  { modo: "pedido", itens: 2, cesto: 6, tarefas: 4 },
  { modo: "padrao", bases: ["AB"], vistos: 4, faltam: 2, distr: 3, tarefas: 3 },
  { modo: "pedido", itens: 3, cesto: 7, tarefas: 4 },
  { modo: "falta", itens: 4, somem: 1, distr: 3, tarefas: 4 },
  { modo: "regra", cordas: 1, exemplos: 2, cabem: 3, fora: 3, tarefas: 3 },
  { modo: "encomenda", grupos: [2, 2, 2], estranhos: 1, tarefas: 2 },
  { modo: "padrao", bases: ["ABC", "AAB", "ABB"], vistos: 5, faltam: 3, distr: 4, tarefas: 3 },
  { modo: "regra", cordas: 2, exemplos: 2, cabem: 3, fora: 3, tarefas: 2 },
  { modo: "falta", itens: 5, somem: 2, distr: 3, gemea: true, tarefas: 3 },
  { modo: "pedido", itens: 4, cesto: 9, tarefas: 3 },
  { modo: "encomenda", grupos: [2, 2, 1, 1], nao: 2, tarefas: 2 },
  { modo: "copiar", itens: 5, distr: 4, tarefas: 3 },
];

const CORES_ROUPA = ["azul", "vermelho", "amarelo", "verde", "rosa"];
const CARA_FELIZ = "img/noto/gato_feliz.svg";
const CARA_AMOR = "img/noto/gato_amor.svg";
// Uma ronda é rápida quando a mediana do tempo por peça fica abaixo disto.
const RAPIDO_MS = 8000;

const chaveDe = (p) => `${p.tipo}-${p.cor}-${p.padrao}`;
const nova = (tipo, cor, padrao, extra = {}) => ({ tipo, cor, padrao, chave: `${tipo}-${cor}-${padrao}`, ...extra });
const aoCalhas = () => nova(escolher(TIPOS), escolher(CORES_ROUPA), escolher(PADROES));

// Peças genéricas, todas diferentes, nunca mais de duas do mesmo tipo.
function variedade(n, evitar = []) {
  const usadas = new Set(evitar.map(chaveDe));
  const tiposUsados = new Map();
  const lista = [];
  let tentativas = 0;
  while (lista.length < n && tentativas++ < 500) {
    const p = aoCalhas();
    if (usadas.has(p.chave)) continue;
    if ((tiposUsados.get(p.tipo) || 0) >= 2) continue;
    usadas.add(p.chave);
    tiposUsados.set(p.tipo, (tiposUsados.get(p.tipo) || 0) + 1);
    lista.push(p);
  }
  return lista;
}

// Peças parecidas com as dadas: mesmo tipo e outra cor, mesma cor e outro tipo, ou mesmo tipo e
// cor com outro padrão. Nunca uma das peças de evitar.
function parecidas(base, n, evitar = []) {
  const usadas = new Set([...base, ...evitar].map(chaveDe));
  const lista = [];
  let tentativas = 0;
  while (lista.length < n && tentativas++ < 500) {
    const b = escolher(base);
    const r = Math.random();
    const p = r < 0.4 ? nova(b.tipo, escolher(CORES_ROUPA), b.padrao)
      : r < 0.7 ? nova(escolher(TIPOS), b.cor, b.padrao)
        : nova(b.tipo, b.cor, escolher(PADROES));
    if (usadas.has(p.chave)) continue;
    usadas.add(p.chave);
    lista.push(p);
  }
  return lista;
}

// Níveis de regra: a regra de cada corda é um atributo com um valor. Duas cordas usam dois
// atributos diferentes, por isso umas peças só servem a uma regra e outras a nenhuma.
const ATRIBUTOS = ["cor", "tipo", "padrao"];
const VALORES = { cor: CORES_ROUPA, tipo: TIPOS, padrao: ["riscas", "bolinhas"] };
const cumpre = (p, r) => p[r.atr] === r.val;
function comRegra(r) {
  const a = { tipo: escolher(TIPOS), cor: escolher(CORES_ROUPA), padrao: escolher(PADROES) };
  a[r.atr] = r.val;
  return nova(a.tipo, a.cor, a.padrao);
}
function gerarRegras(cfg) {
  for (let volta = 0; volta < 80; volta++) {
    const atrs = baralhar(ATRIBUTOS);
    const regras = Array.from({ length: cfg.cordas }, (_, k) => ({ atr: atrs[k], val: escolher(VALORES[atrs[k]]) }));
    const usadas = new Set();
    // Serve à regra k e a mais nenhuma (k = -1: não serve a nenhuma).
    const so = (p, k) => regras.every((r, j) => cumpre(p, r) === (j === k));
    const tirar = (gerar, aceita, n) => {
      const lista = [];
      for (let t = 0; t < 600 && lista.length < n; t++) {
        const p = gerar();
        if (usadas.has(p.chave) || !aceita(p, lista)) continue;
        usadas.add(p.chave);
        lista.push(p);
      }
      return lista;
    };
    // Os exemplos numa corda só partilham a regra: todos os outros atributos são diferentes.
    const linhas = regras.map((r, k) => ({
      regra: r,
      exemplos: tirar(() => comRegra(r), (p, l) => so(p, k) && l.every((q) => ATRIBUTOS.every((a) => a === r.atr || q[a] !== p[a])), cfg.exemplos),
    }));
    for (const [k, l] of linhas.entries()) l.cabem = tirar(() => comRegra(l.regra), (p) => so(p, k), cfg.cabem);
    const fora = tirar(aoCalhas, (p) => so(p, -1), cfg.fora);
    const ok = linhas.every((l) => l.exemplos.length === cfg.exemplos && l.cabem.length === cfg.cabem) && fora.length === cfg.fora;
    if (ok) return { linhas, fora };
  }
  return null;
}

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo("estendal");
  estiloLida();
  const ouvir = el("button", { class: "botao botao-ouvir est-ouvir", "aria-label": "Ouvir outra vez" }, [img("img/proprio/ouvir.svg", "")]);
  const e = ecra(() => terminar(false));
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  const toques = sinos();
  const temporizadores = [];
  let aoOuvir = null;
  ouvir.addEventListener("click", () => { if (aoOuvir && ativo) aoOuvir(); });

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
    await estilo("estendal");
    if (!ativo) return;
    const n = nivel("estendal");
    const cfg = NIVEIS[n - 1];
    const inicio = Date.now();
    const st = {
      certos: 0, errados: 0, ordem: 0, falhas: 0, pistas: 0, repeticoes: 0, tarefas: 0,
      arrastos: 0, toquesDuplos: 0, tempos: [], serie: 0, melhorSerie: 0, pontos: 0, passaros: 0, passarosApanhados: 0,
      memoria: 0, regras: [], sobras: 0, gemeas: 0,
    };
    aoOuvir = null;

    ronda = {
      registar(completo) {
        const erros = st.errados + st.ordem;
        const tent = st.certos + erros;
        const mediana = metricas.mediana(st.tempos);
        metricas.ronda("estendal", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: Date.now() - inicio,
          completed: completo,
          score: st.pontos,
          accuracy: tent ? Math.round((st.certos / tent) * 100) / 100 : null,
          mode: cfg.modo,
          tasks_done: st.tarefas,
          pieces_right: st.certos,
          wrong_choices: st.errados,
          order_errors: st.ordem,
          missed_drops: st.falhas,
          hints_needed: st.pistas,
          repeats_heard: st.repeticoes,
          drags: st.arrastos,
          tap_then_tap: st.toquesDuplos,
          ms_per_piece_median: mediana,
          longest_streak: st.melhorSerie,
          birds_shown: st.passaros,
          birds_caught: st.passarosApanhados,
          memory_items: st.memoria,
          rules_seen: st.regras.join(","),
          pieces_left_in_basket: st.sobras,
          still_on_line_picks: st.gemeas,
        });
        // Fácil: sem erros, sem ajuda, e rápido. Difícil: claramente difícil demais, não uns deslizes.
        const rapido = mediana == null || mediana <= RAPIDO_MS;
        const facil = completo && erros === 0 && st.pistas === 0 && st.repeticoes === 0 && st.falhas <= 2 && rapido;
        const dificil = completo && (st.pistas >= 3 || erros > Math.max(2, st.certos) || st.falhas > st.certos + 4);
        ajustarNivel("estendal", NIVEIS.length, { completo, facil, dificil });
      },
    };

    // O cenário fica a ronda toda: céu, sol, progresso, pontuação, cordas, cesto.
    const caixa = e.corpo.getBoundingClientRect();
    const paisagem = caixa.width > caixa.height * 1.1;
    const cena = el("div", { class: `est-cena ${paisagem ? "paisagem" : "retrato"}` });
    const progresso = barra();
    const placarN = el("span", {}, "0");
    const placar = el("div", { class: "est-pontos" }, [img("img/noto/estrela.svg", ""), placarN]);
    const sol = img("img/noto/sol.svg", "");
    sol.className = "est-sol";
    const cordasEl = el("div", { class: "est-cordas" });
    const cestoEl = el("div", { class: "est-cesto" });
    cena.append(progresso.raiz, sol, placar, cordasEl, cestoEl);
    if (cfg.modo === "pedido" || cfg.modo === "encomenda") cena.append(ouvir);
    e.corpo.replaceChildren(cena);
    const serieBadge = emblema(cena);
    progresso.por(0);

    function ganhar(p) {
      st.pontos += p;
      placarN.textContent = String(st.pontos);
      animar(placar, "salta");
    }
    function acertou() {
      st.certos++;
      st.serie++;
      st.melhorSerie = Math.max(st.melhorSerie, st.serie);
      toques.serie(st.serie);
      serieBadge(st.serie);
      ganhar(10 + (st.serie >= 3 ? 5 : 0));
    }
    function errou() {
      st.serie = 0;
      som.efeito("quase", 0.4);
    }

    // De vez em quando pousa um pássaro na corda; um toque nele vale pontos a mais.
    let passaroEl = null;
    function passaro() {
      if (!ativo || !cena.isConnected || cena.classList.contains("acabou")) return;
      if (passaroEl) { depois(passaro, 15000); return; }
      const cordas = cordasEl.querySelectorAll(".est-fio");
      if (!cordas.length) return;
      const fio = escolher([...cordas]);
      const rf = fio.getBoundingClientRect();
      const rc = cena.getBoundingClientRect();
      const b = el("button", { class: "est-passaro", "aria-label": "Passarinho" }, [img("img/noto/passaro.svg", "")]);
      const x = rf.left - rc.left + rf.width * (0.15 + Math.random() * 0.7);
      b.style.left = `${x}px`;
      b.style.top = `${rf.top - rc.top}px`;
      cena.append(b);
      passaroEl = b;
      st.passaros++;
      som.piu();
      b.addEventListener("click", () => {
        if (b.classList.contains("apanhado")) return;
        b.classList.add("apanhado");
        st.passarosApanhados++;
        som.piu();
        som.efeito("par", 0.5);
        ganhar(20);
        e.dizer("estendal.passaro_bonus", { cara: CARA_FELIZ });
        depois(() => { b.remove(); if (passaroEl === b) passaroEl = null; }, 700);
      });
      depois(() => {
        if (!b.isConnected) return;
        b.classList.add("vai");
        depois(() => { b.remove(); if (passaroEl === b) passaroEl = null; }, 900);
      }, 7000);
      depois(passaro, 30000 + Math.random() * 20000);
    }
    depois(passaro, 20000 + Math.random() * 10000);

    const total = cfg.tarefas;
    for (let t = 0; t < total && ativo; t++) {
      await tarefa(cfg, st, { cena, cordasEl, cestoEl, paisagem, acertou, errou, primeira: t === 0, progresso: (f) => progresso.por((t + f) / total) });
      if (!ativo) return;
      st.tarefas++;
      progresso.por((t + 1) / total);
    }
    if (!ativo) return;
    aoOuvir = null;
    await e.dizer("estendal.fim", { cara: CARA_AMOR });
    if (!ativo) return;
    if (melhorQueAntes("estendal", n, st.pontos)) {
      await e.dizer("estendal.melhor", { cara: CARA_FELIZ });
      if (!ativo) return;
    }
    ronda.registar(true);
    ronda = null;
    cena.classList.add("acabou");
    const r = await premio(e, e.raiz);
    if (r === "outra") comecar();
    else terminar(true);
  }

  // Um cesto: montar as cordas e o cesto para o modo, e jogá-lo até ao fim.
  async function tarefa(cfg, st, ctx) {
    const { cordasEl, cestoEl, acertou, errou, primeira } = ctx;
    cordasEl.replaceChildren();
    cestoEl.replaceChildren();
    for (const k of ["modo", "alvo", "grupos", "regras", "faltam"]) delete cordasEl.dataset[k];
    cordasEl.classList.remove("seca");
    let ocupado = true;
    let escolhida = null;
    let errosSeguidos = 0;
    let ultimo = Date.now();
    let acabar = null;
    const feito = new Promise((r) => { acabar = r; });

    // O que estender, e em que cordas.
    let pecas = [];       // peças no cesto; req: precisas para acabar
    let cordas = [];      // { vagas, ordem, regra, pre: peças já estendidas, por lugar }
    let alvo = null;      // níveis com ordem: as peças esperadas, por ordem
    let grupos = null;    // encomenda da vizinha: [{ tipo, n, feitos }]
    let recadoFalas = []; // pedido dito, repetido com "Ouvir"
    let recado = null;    // o recado escrito
    let vezRecado = 0;
    const req = (p) => ({ ...p, req: true });

    if (cfg.modo === "pedido") {
      const pedido = baralhar(CATALOGO).slice(0, cfg.itens);
      // Primeiro as peças a mais que se confundem: mesmo tipo ou mesma cor de alguma coisa pedida.
      const resto = CATALOGO.filter((c) => !pedido.includes(c));
      const perto = baralhar(resto.filter((c) => pedido.some((p) => p.tipo === c.tipo || p.cor === c.cor)));
      const longe = baralhar(resto.filter((c) => !perto.includes(c)));
      const extras = [...perto, ...longe].slice(0, cfg.cesto - cfg.itens);
      alvo = pedido.map((c) => nova(c.tipo, c.cor, c.padrao, { id: c.id }));
      pecas = [...alvo.map(req), ...extras.map((c) => nova(c.tipo, c.cor, c.padrao, { id: c.id }))];
      recadoFalas = pedido.map((c, k) => `estendal.${k === 0 ? "p" : "d"}_${c.id}`);
      cordas = [{ vagas: cfg.itens, ordem: true, numeros: true }];
      st.memoria += cfg.itens;
    } else if (cfg.modo === "padrao") {
      const base = escolher(cfg.bases);
      const letras = [...new Set(base)];
      const unidades = variedade(letras.length);
      const mapa = Object.fromEntries(letras.map((l, k) => [l, unidades[k]]));
      const seq = [];
      for (let i = 0; i < cfg.vistos + cfg.faltam; i++) seq.push(mapa[base[i % base.length]]);
      alvo = seq.slice(cfg.vistos);
      pecas = [...alvo.map(req), ...parecidas(unidades, cfg.distr)];
      cordas = [{ vagas: seq.length, ordem: true, pre: seq.slice(0, cfg.vistos), faltaDe: cfg.vistos }];
    } else if (cfg.modo === "copiar") {
      const modelo = variedade(cfg.itens);
      alvo = modelo;
      pecas = [...modelo.map(req), ...parecidas(modelo, cfg.distr)];
      cordas = [{ vagas: cfg.itens, ordem: true, pre: modelo, voam: modelo.map((_, k) => k) }];
      st.memoria += cfg.itens;
    } else if (cfg.modo === "falta") {
      const modelo = variedade(cfg.itens);
      const voam = baralhar(modelo.map((_, k) => k)).slice(0, cfg.somem).sort((a, b) => a - b);
      const foram = voam.map((k) => modelo[k]);
      const extras = parecidas(foram, cfg.distr, modelo);
      // Uma gémea de uma peça que ainda está na corda: a pessoa tem de reparar que essa nunca saiu.
      if (cfg.gemea) extras.push({ ...escolher(modelo.filter((_, k) => !voam.includes(k))) });
      pecas = [...foram.map(req), ...extras];
      cordas = [{ vagas: cfg.itens, ordem: true, pre: modelo, voam }];
      st.memoria += cfg.itens;
    } else if (cfg.modo === "regra") {
      const g = gerarRegras(cfg);
      cordas = g.linhas.map((l) => ({ vagas: l.exemplos.length + l.cabem.length, regra: l.regra, pre: l.exemplos }));
      pecas = [...g.linhas.flatMap((l) => l.cabem.map(req)), ...g.fora];
      for (const l of g.linhas) st.regras.push(`${l.regra.atr}:${l.regra.val}`);
    } else if (cfg.modo === "encomenda") {
      const tipos = baralhar(TIPOS);
      grupos = cfg.grupos.map((q, k) => ({ tipo: tipos[k], n: q, feitos: 0 }));
      const naoTipo = cfg.nao ? tipos[grupos.length] : null;
      const estranhoTipo = cfg.estranhos ? tipos[grupos.length + (naoTipo ? 1 : 0)] : null;
      const deTipo = (tipo, q) => baralhar(CORES_ROUPA.flatMap((c) => PADROES.map((p) => nova(tipo, c, p)))).slice(0, q);
      for (const gr of grupos) pecas.push(...deTipo(gr.tipo, gr.n).map(req));
      if (naoTipo) pecas.push(...deTipo(naoTipo, cfg.nao));
      if (estranhoTipo) pecas.push(...deTipo(estranhoTipo, cfg.estranhos));
      recadoFalas = grupos.map((gr, k) => `estendal.enc_${k === 0 ? "p" : k === grupos.length - 1 ? "f" : "d"}_${gr.tipo}`);
      if (naoTipo) recadoFalas.push(`estendal.enc_n_${naoTipo}`);
      cordas = [{ vagas: grupos.reduce((s, gr) => s + gr.n, 0), ordem: true }];
      st.memoria += recadoFalas.length;
    }

    // Cordas.
    const linhas = cordas.map((c) => {
      const vagas = [];
      const vagasEl = el("div", { class: "est-vagas" });
      for (let i = 0; i < c.vagas; i++) {
        const v = el("div", { class: "est-vaga" });
        if (c.numeros) v.append(el("span", { class: "est-num" }, String(i + 1)));
        vagasEl.append(v);
        vagas.push({ el: v, peca: null });
      }
      const raiz = el("div", { class: "est-corda" }, [
        el("div", { class: "est-poste esq" }), el("div", { class: "est-poste dir" }),
        el("div", { class: "est-fio" }), vagasEl,
      ]);
      raiz.style.setProperty("--vagas", c.vagas);
      cordasEl.append(raiz);
      return { ...c, raiz, vagas };
    });
    cordasEl.style.setProperty("--n", linhas.length);

    function pendurarEm(vaga, p, animado = true, origem = null) {
      vaga.peca = p;
      vaga.el.classList.remove("falta");
      const figura = img(urlRoupa(p.tipo, p.cor, p.padrao), "");
      figura.className = "est-roupa";
      const fazer = () => {
        if (!ativo) return;
        vaga.el.querySelector(".est-roupa")?.remove();
        vaga.el.append(figura);
        vaga.el.classList.add("cheia");
        if (animado) animar(vaga.el, "chega");
      };
      if (origem) voar(e.raiz, origem.querySelector("img"), origem, vaga.el, fazer, 380);
      else fazer();
      return figura;
    }
    function tirarDe(vaga) {
      vaga.el.querySelector(".est-roupa")?.remove();
      vaga.peca = null;
      vaga.el.classList.remove("cheia");
    }

    // O que já está na corda: o início do padrão, a corda a decorar, os exemplos da regra.
    for (const l of linhas) {
      (l.pre || []).forEach((p, k) => pendurarEm(l.vagas[k], p, false));
      l.vagas.forEach((v, k) => {
        if (v.peca) return;
        v.el.classList.add("ordem");
        if (l.faltaDe != null && k >= l.faltaDe) v.el.classList.add("falta");
      });
    }

    // Cesto: as peças como botões grandes, com tamanho para caberem; num ecrã pequeno, menos peças parecidas.
    const rc = cestoEl.getBoundingClientRect();
    const cabe = Math.max(4, cabem(rc.width, rc.height, 0.88));
    while (pecas.length > cabe && pecas.some((p) => !p.req)) pecas.splice(pecas.findLastIndex((p) => !p.req), 1);
    pecas = baralhar(pecas);
    const g = grelha(pecas.length, rc.width, rc.height, 0.88);
    const lado = Math.max(ALVO_MIN, Math.min(g.lado, 175));
    cestoEl.style.gridTemplateColumns = `repeat(${g.cols}, ${lado}px)`;
    const botoes = pecas.map((p) => {
      const b = el("button", { class: "est-peca", style: { "--lado": `${lado}px`, "--rot": `${Math.round(Math.random() * 12 - 6)}deg` } },
        [img(urlRoupa(p.tipo, p.cor, p.padrao), "")]);
      b.peca = p;
      // Dados simples na peça (usados pela jogada automática).
      b.dataset.chave = p.id || p.chave;
      b.dataset.tipo = p.tipo;
      b.dataset.cor = p.cor;
      b.dataset.padrao = p.padrao;
      cestoEl.append(b);
      pegavel(b, {
        camada: e.raiz,
        pode: () => !ocupado && ativo && !b.classList.contains("usada"),
        tocar: () => tocarPeca(b),
        largar: (x, y) => largarPeca(b, x, y),
      });
      return b;
    });
    linhas.forEach((l, k) => tocavel(l.raiz, (x) => tocarCorda(k, x)));

    const livres = () => botoes.filter((b) => !b.classList.contains("usada"));
    const proxVaga = (l) => l.vagas.find((v) => !v.peca);
    let feitas = 0;
    const precisas = linhas.reduce((s, l) => s + l.vagas.length - (l.pre ? l.pre.length : 0), 0) + (cfg.modo === "falta" || cfg.modo === "copiar" ? linhas[0].voam.length : 0);
    const encaixa = (p, l) => (l.regra ? cumpre(p, l.regra) : false);

    function marcarFeita() {
      feitas++;
      st.tempos.push(Date.now() - ultimo);
      ultimo = Date.now();
      ctx.progresso(feitas / precisas);
      if (feitas >= precisas) { ocupado = true; acabar(); }
    }

    function escolher_(b) {
      for (const x of botoes) x.classList.remove("escolhida");
      escolhida = b;
      if (b) b.classList.add("escolhida");
    }

    // Uma imagem ténue do que pertence a um lugar, por um momento.
    function espreitar(v, p) {
      const fantasma = img(urlRoupa(p.tipo, p.cor, p.padrao), "");
      fantasma.className = "est-espreita";
      v.el.append(fantasma);
      e.dizer("estendal.espreita");
      depois(() => fantasma.remove(), 1800);
    }

    async function pista() {
      st.pistas++;
      errosSeguidos = 0;
      const l = linhas[0];
      if (cfg.modo === "pedido" || cfg.modo === "encomenda") {
        st.repeticoes++;
        await dizerRecado();
        return;
      }
      if (cfg.modo === "copiar") {
        const v = proxVaga(l);
        if (v) espreitar(v, alvo[l.vagas.indexOf(v)]);
        return;
      }
      if (cfg.modo === "falta") {
        const v = l.vagas.find((x) => !x.peca && x.espera);
        if (v) espreitar(v, v.espera);
        return;
      }
      if (cfg.modo === "regra") {
        const b = livres().find((x) => linhas.some((m) => encaixa(x.peca, m)));
        if (b) {
          animar(b, "lida-pista");
          const m = linhas.find((x) => encaixa(b.peca, x));
          animar(m.raiz, "lida-pista");
        }
        return;
      }
      if (alvo) {
        const certo = livres().find((b) => b.peca.chave === alvo[feitas]?.chave);
        if (certo) animar(certo, "lida-pista");
      }
    }

    async function falhar(b, linha) {
      errosSeguidos++;
      errou();
      if (b) animar(b, "lida-abana");
      ocupado = true;
      await e.dizer(linha);
      ocupado = false;
      if (!ativo) return;
      if (errosSeguidos >= 2) await pista();
    }

    function tocarPeca(b) {
      if (ocupado || !ativo) return;
      som.efeito("toque", 0.4);
      escolher_(escolhida === b ? null : b);
    }

    function tocarCorda(k, x) {
      if (ocupado || !ativo) return;
      if (!escolhida) {
        if (livres().length) e.dizer("estendal.toca_roupa");
        return;
      }
      st.toquesDuplos++;
      const b = escolhida;
      escolher_(null);
      tentar(b, k, x);
    }

    function largarPeca(b, x, y) {
      if (ocupado || !ativo) return;
      st.arrastos++;
      escolher_(null);
      const k = sobre(linhas.map((l) => l.raiz), x, y, 0.08);
      if (k < 0) {
        st.falhas++;
        errosSeguidos++;
        som.efeito("quase", 0.3);
        if (errosSeguidos >= 2) { errosSeguidos = 0; e.dizer("estendal.na_corda"); for (const l of linhas) animar(l.raiz, "lida-pista"); }
        return;
      }
      tentar(b, k, x);
    }

    // O lugar vazio mais perto de onde a pessoa largou, entre os dados.
    function maisPerto(lista, x) {
      let melhor = Infinity;
      let vaga = null;
      for (const v of lista) {
        const r = v.el.getBoundingClientRect();
        const d = x == null ? 0 : Math.abs(x - (r.left + r.width / 2));
        if (d < melhor) { melhor = d; vaga = v; }
      }
      return vaga;
    }

    async function tentar(b, k, x) {
      const p = b.peca;
      const l = linhas[k];
      let vaga;
      if (cfg.modo === "regra") {
        if (!encaixa(p, l)) {
          st.errados++;
          const outra = linhas.some((m) => m !== l && encaixa(p, m));
          await falhar(b, outra ? "estendal.regra_outra" : "estendal.regra_nenhuma");
          return;
        }
        vaga = maisPerto(l.vagas.filter((v) => !v.peca), x);
      } else if (cfg.modo === "falta") {
        const certas = l.vagas.filter((v) => !v.peca && v.espera && v.espera.chave === p.chave);
        if (!certas.length) {
          st.errados++;
          const naCorda = l.vagas.some((v) => v.peca && v.peca.chave === p.chave);
          if (naCorda) st.gemeas++;
          await falhar(b, naCorda ? "estendal.falta_ainda" : "estendal.falta_nao");
          return;
        }
        vaga = maisPerto(certas, x);
      } else if (cfg.modo === "encomenda") {
        const atual = grupos.find((gr) => gr.feitos < gr.n);
        if (p.tipo !== atual.tipo) {
          if (grupos.some((gr) => gr.tipo === p.tipo)) { st.ordem++; await falhar(b, "estendal.enc_ainda"); }
          else { st.errados++; await falhar(b, "estendal.enc_nao"); }
          return;
        }
        atual.feitos++;
        vaga = proxVaga(l);
      } else {
        // Por ordem: as peças pedidas, o padrão, a corda inteira.
        vaga = proxVaga(l);
        const esperado = alvo[feitas];
        const certo = cfg.modo === "pedido" ? p.id === esperado.id : p.chave === esperado.chave;
        if (!certo) {
          // Pedida mas cedo demais conta como deslize de ordem; tudo o resto como peça errada.
          const mais = alvo.slice(feitas + 1).some((a) => (cfg.modo === "pedido" ? a.id === p.id : a.chave === p.chave));
          if (mais) { st.ordem++; await falhar(b, cfg.modo === "pedido" ? "estendal.depois" : cfg.modo === "padrao" ? "estendal.padrao_nao" : "estendal.copiar_nao"); return; }
          st.errados++;
          await falhar(b, cfg.modo === "pedido" ? "estendal.essa_nao" : cfg.modo === "padrao" ? "estendal.padrao_nao" : "estendal.copiar_nao");
          return;
        }
      }
      if (!vaga) { await falhar(b, "estendal.cheia"); return; }
      errosSeguidos = 0;
      b.classList.add("usada");
      b.classList.remove("escolhida");
      pendurarEm(vaga, p, true, b);
      acertou();
      som.efeito("marcar", 0.35);
      marcarFeita();
    }

    // Pedido dito (do gato ou da vizinha): dizer cada frase, mostrar o recado, dobrá-lo.
    async function dizerRecado() {
      ocupado = true;
      // O recado fica escondido enquanto as frases são ditas outra vez, para a pessoa ouvir.
      if (recado) recado.classList.add("escondido");
      for (const id of recadoFalas) {
        await e.dizer(id);
        if (!ativo) return;
      }
      if (!recado) {
        recado = el("ol", { class: `est-recado${cfg.modo === "encomenda" ? " vizinha" : ""}` });
        cordasEl.append(recado);
      }
      const texto = (id) => som.texto(id).replace(/^(Pendura|Depois,)\s*/, "").replace(/[.!]$/, "");
      recado.replaceChildren(...recadoFalas.map((id) => el("li", {}, cfg.modo === "pedido" ? texto(id) : som.texto(id).replace(/[.!]$/, ""))));
      recado.classList.remove("escondido");
      animar(recado, "chega");
      ocupado = false;
      const vez = ++vezRecado;
      depois(() => {
        if (vez !== vezRecado) return;
        recado.classList.add("escondido");
        e.balao.classList.add("vazio");
        som.efeito("virar", 0.4);
      }, 2500 + recadoFalas.length * 800);
    }

    // O vento leva algumas peças (falta) ou todas (copiar) da corda.
    async function vento(l) {
      await espera(2500 + l.vagas.length * 800);
      if (!ativo) return;
      som.efeito("baralhar", 0.6);
      cordasEl.classList.add("vento");
      for (const k of l.voam) l.vagas[k].el.querySelector(".est-roupa")?.classList.add("voa");
      await espera(1300);
      if (!ativo) return;
      cordasEl.classList.remove("vento");
      for (const k of l.voam) {
        const v = l.vagas[k];
        v.espera = v.peca;
        tirarDe(v);
        v.el.classList.add("ordem", "falta");
      }
    }

    // Frases de abertura para este cesto.
    if (primeira) {
      await e.dizer("estendal.ola", { cara: CARA_FELIZ });
      if (!ativo) return;
    }
    if (cfg.modo === "pedido") {
      if (primeira) await e.dizer("estendal.pedido_lembra");
      if (!ativo) return;
      aoOuvir = () => { if (!ocupado) { st.repeticoes++; dizerRecado(); } };
      await dizerRecado();
    } else if (cfg.modo === "encomenda") {
      await e.dizer(primeira ? "estendal.vizinha" : "estendal.vizinha_mais");
      if (!ativo) return;
      aoOuvir = () => { if (!ocupado) { st.repeticoes++; dizerRecado(); } };
      await dizerRecado();
    } else if (cfg.modo === "padrao") {
      await e.dizer(primeira ? "estendal.padrao" : "estendal.padrao_mais");
    } else if (cfg.modo === "regra") {
      await e.dizer(!primeira ? "estendal.regra_mais" : linhas.length > 1 ? "estendal.regra_duas" : "estendal.regra_uma");
    } else if (cfg.modo === "copiar" || cfg.modo === "falta") {
      await e.dizer("estendal.copiar");
      if (!ativo) return;
      await vento(linhas[0]);
      if (!ativo) return;
      await e.dizer(cfg.modo === "copiar" ? "estendal.vento" : linhas[0].voam.length > 1 ? "estendal.falta_2" : "estendal.falta_1");
    }
    if (!ativo) return;
    // Dados para a jogada automática: o que se espera, por ordem ou por regra.
    cordasEl.dataset.modo = cfg.modo;
    cordasEl.dataset.alvo = alvo ? alvo.map((a) => a.id || a.chave).join(",") : "";
    cordasEl.dataset.grupos = grupos ? grupos.map((gr) => `${gr.tipo}:${gr.n}`).join(",") : "";
    cordasEl.dataset.regras = linhas.map((l) => (l.regra ? `${l.regra.atr}:${l.regra.val}` : "")).join(",");
    cordasEl.dataset.faltam = cfg.modo === "falta" ? linhas[0].vagas.filter((v) => v.espera).map((v) => v.espera.chave).join(",") : "";
    ocupado = false;
    ultimo = Date.now();

    await feito;
    if (!ativo) return;
    aoOuvir = null;
    const sobram = livres().length;
    st.sobras += sobram;
    // Tudo estendido: a roupa balança ao sol.
    await espera(500);
    if (!ativo) return;
    cordasEl.classList.add("seca");
    toques.arpejo();
    cestoEl.classList.add("vazio");
    if (sobram && (cfg.modo === "regra" || cfg.modo === "encomenda")) await e.dizer("estendal.sobra", { cara: CARA_FELIZ });
    else await e.dizer(escolher(["estendal.seca", "estendal.cheira", som.elogio()]), { cara: CARA_AMOR });
    if (!ativo) return;
    await espera(1200);
    cestoEl.classList.remove("vazio");
  }

  comecar();
  return () => terminar(false);
}
