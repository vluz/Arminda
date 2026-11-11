// Azulejos: pintar azulejos tradicionais portugueses. Tocar num pote de cor, depois numa parte do azulejo.
// Níveis: pintar à vontade azulejos grandes e simples (sempre elogiado); copiar um modelo mostrado
// ao lado; um painel de 2 x 2 em que um azulejo está feito e a pessoa o repete, espelhado, nos
// outros três; depois um azulejo mostrado e escondido, pintado de memória, até ao galo de Barcelos
// e ao coração de Viana.
// Cada azulejo acabado vai para a parede da pessoa (ficam os últimos 24).

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { ler, gravar, nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio, grelha, estilo, ALVO_MIN } from "../ui.js";
import { baralhar, escolher, animar, sinos, barra, emblema, melhorQueAntes, estiloLida } from "./lida.js";
import { MOTIVOS, CORES, POR_PINTAR, svgAzulejo, svgPainel } from "./pintar-motivos.js";

// modo: livre (à vontade), copiar (modelo ao lado), painel (2 x 2, repetir o azulejo feito), memoria
// (mostrado, escondido, de memória). cores: potes na paleta. azulejos: azulejos (ou painéis) por ronda.
const NIVEIS = [
  { modo: "livre", grupos: ["baixo"], cores: 4, azulejos: 2 },
  { modo: "livre", grupos: ["baixo"], cores: 6, azulejos: 2 },
  { modo: "copiar", grupos: ["baixo"], cores: 4, azulejos: 3 },
  { modo: "copiar", grupos: ["baixo"], cores: 6, azulejos: 3 },
  { modo: "copiar", grupos: ["medio"], cores: 6, azulejos: 3 },
  { modo: "painel", motivos: ["arco"], cores: 4, azulejos: 2 },
  { modo: "painel", motivos: ["folhas"], cores: 5, azulejos: 2 },
  { modo: "memoria", grupos: ["baixo", "medio"], cores: 6, azulejos: 3 },
  { modo: "memoria", grupos: ["medio"], cores: 7, azulejos: 3 },
  { modo: "memoria", grupos: ["alto"], cores: 6, azulejos: 2 },
  { modo: "memoria", grupos: ["alto"], cores: 8, azulejos: 2, curto: true },
];
const LIVRES = [
  ["azul", "amarelo", "vermelho", "verde"],
  ["azul", "amarelo", "vermelho", "verde", "celeste", "rosa"],
];
const TODAS = ["azul", "amarelo", "branco", "verde", "vermelho", "celeste", "laranja", "rosa", "preto"];
const PAREDE_MAX = 24;
const CARA_FELIZ = "img/noto/gato_feliz.svg";
const CARA_AMOR = "img/noto/gato_amor.svg";

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo("pintar");
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
    await estilo("pintar");
    if (!ativo) return;
    const n = nivel("pintar");
    const cfg = NIVEIS[n - 1];
    const inicio = Date.now();
    const st = {
      certos: 0, errados: 0, pistas: 0, espreitas: 0, trocasCor: 0, azulejos: 0, tempos: [],
      serie: 0, melhorSerie: 0, pontos: 0,
    };
    const novos = [];
    ronda = {
      registar(completo) {
        const tent = st.certos + st.errados;
        metricas.ronda("pintar", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: Date.now() - inicio,
          completed: completo,
          score: st.pontos,
          accuracy: cfg.modo === "livre" ? null : tent ? Math.round((st.certos / tent) * 100) / 100 : null,
          mode: cfg.modo,
          tiles_done: st.azulejos,
          regions_right: st.certos,
          wrong_colour: st.errados,
          hints_needed: st.pistas,
          peeks: st.espreitas,
          colour_changes: st.trocasCor,
          ms_per_region_median: metricas.mediana(st.tempos),
          longest_streak: st.melhorSerie,
        });
        const facil = completo && st.errados === 0 && st.pistas === 0;
        const dificil = completo && (st.pistas >= 3 || st.errados > Math.max(3, st.certos / 2));
        ajustarNivel("pintar", NIVEIS.length, { completo, facil, dificil });
      },
    };

    const caixa = e.corpo.getBoundingClientRect();
    const paisagem = caixa.width > caixa.height * 1.1;
    const cena = el("div", { class: `pz-cena ${paisagem ? "paisagem" : "retrato"} pz-m-${cfg.modo}` });
    const progresso = barra();
    const placarN = el("span", {}, "0");
    const placar = el("div", { class: "pz-pontos" }, [img("img/noto/estrela.svg", ""), placarN]);
    const obra = el("div", { class: "pz-obra" });
    const paleta = el("div", { class: "pz-paleta" });
    cena.append(progresso.raiz, placar, obra, paleta);
    e.corpo.replaceChildren(cena);
    const serieBadge = emblema(cena);
    progresso.por(0);

    const ganhar = (p) => {
      st.pontos += p;
      placarN.textContent = String(st.pontos);
      animar(placar, "salta");
    };
    const ctx = { cena, obra, paleta, paisagem, ganhar, novos, serieBadge };

    // Nunca o mesmo desenho duas vezes seguidas.
    const lista = cfg.motivos ? MOTIVOS.filter((m) => cfg.motivos.includes(m.id)) : MOTIVOS.filter((m) => cfg.grupos.includes(m.grupo));
    let fila = baralhar(lista);
    const ultimo = ler("pintar.ultimo", "");
    if (fila.length > 1 && fila[0].id === ultimo) fila.push(fila.shift());
    for (let t = 0; t < cfg.azulejos && ativo; t++) {
      if (!fila.length) fila = baralhar(lista);
      const m = fila.shift();
      gravar("pintar.ultimo", m.id);
      await azulejo(cfg, st, m, { ...ctx, primeiro: t === 0, progresso: (f) => progresso.por((t + f) / cfg.azulejos) });
      if (!ativo) return;
      st.azulejos++;
      progresso.por((t + 1) / cfg.azulejos);
    }
    if (!ativo) return;
    await parede(novos);
    if (!ativo) return;
    await e.dizer("pintar.fim", { cara: CARA_AMOR });
    if (!ativo) return;
    if (cfg.modo !== "livre" && melhorQueAntes("pintar", n, st.pontos)) {
      await e.dizer("pintar.melhor", { cara: CARA_FELIZ });
      if (!ativo) return;
    }
    ronda.registar(true);
    ronda = null;
    const r = await premio(e, e.raiz);
    if (r === "outra") comecar();
    else terminar(true);
  }

  // Cada azulejo acabado vai logo para a parede, por isso sair a meio não o perde.
  function guardarNaParede(svg) {
    gravar("pintar.parede", [...ler("pintar.parede", []), svg].slice(-PAREDE_MAX));
  }

  // A parede de azulejos da pessoa: os novos entram com um saltinho.
  async function parede(novos) {
    const todos = ler("pintar.parede", []);
    const grade = el("div", { class: "pz-grade" });
    const k0 = todos.length - Math.min(novos.length, todos.length);
    todos.forEach((svg, k) => {
      const c = el("div", { class: `pz-mini${k >= k0 ? " novo" : ""}`, html: svg });
      if (k >= k0) c.style.animationDelay = `${0.3 + (k - k0) * 0.4}s`;
      grade.append(c);
    });
    // Poucos azulejos aparecem grandes; uma parede cheia, com 24, ainda cabe no ecrã.
    const caixa = e.corpo.getBoundingClientRect();
    const deitado = caixa.width > caixa.height;
    const cols = todos.length <= 4 ? todos.length : todos.length <= 8 ? 4 : deitado ? 8 : 4;
    const filas = Math.ceil(todos.length / cols);
    const lado = Math.floor(Math.min((caixa.width - 40) / cols, (caixa.height - 40) / filas, deitado ? 230 : 260) - 10);
    grade.style.setProperty("--mini", `${lado}px`);
    grade.style.maxWidth = `${cols * (lado + 12)}px`;
    const vista = el("div", { class: "pz-parede" }, [grade]);
    e.corpo.replaceChildren(vista);
    som.efeito("azulejo", 0.6);
    await e.dizer("pintar.parede", { cara: CARA_AMOR });
    if (!ativo) return;
    await espera(1800 + novos.length * 400);
  }

  // Um azulejo (ou um painel), do cinzento até pronto.
  async function azulejo(cfg, st, m, ctx) {
    const { obra, paleta, paisagem, ganhar, primeiro, serieBadge } = ctx;
    obra.replaceChildren();
    paleta.replaceChildren();
    obra.classList.remove("feito");
    let ocupado = true;
    let errosSeguidos = 0;
    let ultimo = Date.now();
    let acabar = null;
    const feito = new Promise((r) => { acabar = r; });

    const esquema = escolher(m.esquemas);
    const nReg = m.regioes.length;
    // Paleta: as cores de que o desenho precisa (níveis de copiar) mais outras, até cfg.cores.
    let pots;
    if (cfg.modo === "livre") pots = LIVRES[Math.min(cfg.cores > 4 ? 1 : 0, LIVRES.length - 1)];
    else {
      const precisas = [...new Set(esquema)];
      const outras = baralhar(TODAS.filter((c) => !precisas.includes(c)));
      pots = baralhar([...precisas, ...outras.slice(0, Math.max(0, cfg.cores - precisas.length))]);
    }
    let corAtual = pots[0];

    // Azulejos para pintar: um, ou três num painel (o quarto, em cima à esquerda, é o modelo).
    const painel = cfg.modo === "painel";
    const obras = painel ? [0, 1, 2] : [0];
    const cores = obras.map(() => Array(nReg).fill(null));
    const certas = obras.map(() => Array(nReg).fill(false));
    const total = obras.length * nReg;
    let feitas = 0;

    // Tamanhos: primeiro a paleta, depois o maior azulejo que cabe ao lado dela.
    const rc = ctx.cena.getBoundingClientRect();
    const gp = paisagem ? grelha(pots.length, rc.width * 0.32, rc.height - 40, 0.9) : grelha(pots.length, rc.width - 20, rc.height * 0.22, 0.9);
    const lado = Math.max(ALVO_MIN, Math.min(gp.lado, paisagem ? 128 : 140));
    paleta.style.gridTemplateColumns = `repeat(${gp.cols}, ${lado}px)`;
    const linhasPal = Math.ceil(pots.length / gp.cols);
    const palW = gp.cols * (lado + 12) + 24;
    const palH = linhasPal * (lado + 12) + 24;
    const livreW = paisagem ? rc.width - palW - 30 : rc.width - 16;
    const livreH = paisagem ? rc.height - 26 : rc.height - palH - 50;
    // Níveis de copiar: o modelo ao lado tem 0,42 do azulejo.
    let tam;
    if (cfg.modo === "copiar") tam = paisagem ? Math.min(livreH, (livreW - 20) / 1.42) : Math.min(livreW, (livreH - 20) / 1.42);
    else tam = Math.min(livreH, livreW);
    tam = Math.floor(tam);
    obra.style.setProperty("--tam", `${tam}px`);

    const potEls = pots.map((c) => {
      const b = el("button", { class: "pz-tinta", style: { "--lado": `${lado}px`, "--cor": CORES[c] }, "aria-label": c }, [el("span", { class: "pz-gota" })]);
      b.dataset.cor = c;
      b.addEventListener("click", () => escolherCor(c, true));
      paleta.append(b);
      return b;
    });
    function escolherCor(c, falar) {
      if (!ativo) return;
      if (c !== corAtual) st.trocasCor++;
      corAtual = c;
      for (const b of potEls) b.classList.toggle("escolhida", b.dataset.cor === c);
      if (falar) { som.efeito("toque", 0.35); e.dizer(`pintar.cor_${c}`); }
    }
    escolherCor(corAtual, false);

    // O trabalho: o azulejo ou azulejos, e o modelo onde houver.
    const quadros = [];
    let modeloEl = null;
    if (painel) {
      const grade = el("div", { class: "pz-painel" });
      const modelo = el("div", { class: "pz-quadro pz-feito q0", html: svgAzulejo(m, esquema) });
      grade.append(modelo);
      modeloEl = modelo;
      for (const k of obras) {
        const q = el("div", { class: `pz-quadro q${k + 1}`, html: svgAzulejo(m, cores[k], { interativo: true }) });
        q.dataset.k = k;
        grade.append(q);
        quadros.push(q);
      }
      obra.append(grade);
    } else {
      const q = el("div", { class: "pz-quadro", html: svgAzulejo(m, cores[0], { interativo: true }) });
      q.dataset.k = 0;
      quadros.push(q);
      if (cfg.modo === "copiar") {
        modeloEl = el("div", { class: "pz-modelo" }, [el("div", { class: "pz-quadro pz-feito", html: svgAzulejo(m, esquema) })]);
        obra.append(modeloEl, q);
      } else obra.append(q);
    }
    obra.dataset.motivo = m.id;
    obra.dataset.esquema = esquema.join(",");
    const caminhos = quadros.map((q) => [...q.querySelectorAll("[data-r]")]);

    for (const q of quadros) {
      let ini = null;
      q.addEventListener("pointerdown", (ev) => { ini = { x: ev.clientX, y: ev.clientY }; });
      q.addEventListener("pointerup", (ev) => {
        if (!ini) return;
        const moveu = Math.hypot(ev.clientX - ini.x, ev.clientY - ini.y) > 24;
        ini = null;
        if (moveu) return;
        const alvo = ev.target.closest && ev.target.closest("[data-r]");
        if (alvo) pintar(Number(q.dataset.k), Number(alvo.dataset.r), ev);
      });
    }

    function pingo(ev, cor) {
      const r = ctx.cena.getBoundingClientRect();
      const p = el("div", { class: "pz-pingo", style: { left: `${ev.clientX - r.left}px`, top: `${ev.clientY - r.top}px`, "--cor": CORES[cor] } });
      ctx.cena.append(p);
      depois(() => p.remove(), 700);
    }

    async function pista(k, r) {
      st.pistas++;
      errosSeguidos = 0;
      if (cfg.modo === "memoria") {
        st.espreitas++;
        const espreita = el("div", { class: "pz-espreita", html: svgAzulejo(m, esquema) });
        obra.append(espreita);
        e.dizer("pintar.espreita");
        depois(() => espreita.remove(), 2600);
        return;
      }
      // O pote certo pisca, e a mesma parte do modelo.
      const certa = esquema[r];
      const pot = potEls.find((b) => b.dataset.cor === certa);
      animar(pot, "lida-pista");
      const naModelo = modeloEl?.querySelectorAll("path")[r + (m.fundo ? 1 : 0)];
      if (naModelo) animar(naModelo, "pz-pisca");
      e.dizer("pintar.olha_modelo");
    }

    async function pintar(k, r, ev) {
      if (ocupado || !ativo) return;
      const caminho = caminhos[k][r];
      if (cfg.modo === "livre") {
        if (cores[k][r] === corAtual) return;
        const nova = cores[k][r] === null;
        cores[k][r] = corAtual;
        caminho.setAttribute("fill", CORES[corAtual]);
        animar(caminho, "pz-enche");
        pingo(ev, corAtual);
        som.efeito("marcar", 0.3);
        if (nova) {
          feitas++;
          st.certos++;
          st.serie++;
          st.melhorSerie = Math.max(st.melhorSerie, st.serie);
          toques.serie(st.serie);
          ganhar(10);
          st.tempos.push(Date.now() - ultimo);
          ultimo = Date.now();
          ctx.progresso(feitas / total);
          if (feitas === total) mostrarPronto();
        }
        return;
      }
      if (certas[k][r]) return;
      if (corAtual === esquema[r]) {
        certas[k][r] = true;
        cores[k][r] = corAtual;
        caminho.setAttribute("fill", CORES[corAtual]);
        animar(caminho, "pz-enche");
        pingo(ev, corAtual);
        errosSeguidos = 0;
        st.certos++;
        st.serie++;
        st.melhorSerie = Math.max(st.melhorSerie, st.serie);
        toques.serie(st.serie);
        serieBadge(st.serie);
        ganhar(10 + (st.serie >= 3 ? 5 : 0));
        st.tempos.push(Date.now() - ultimo);
        ultimo = Date.now();
        feitas++;
        ctx.progresso(feitas / total);
        if (feitas === total) { ocupado = true; acabar(); }
        return;
      }
      // Cor errada: aparece por um momento, depois a parte volta ao cinzento.
      st.errados++;
      st.serie = 0;
      errosSeguidos++;
      caminho.setAttribute("fill", CORES[corAtual]);
      animar(caminho, "pz-errado");
      som.efeito("quase", 0.4);
      depois(() => { if (!certas[k][r]) caminho.setAttribute("fill", POR_PINTAR); }, 650);
      ocupado = true;
      await e.dizer(cfg.modo === "memoria" ? "pintar.memoria_nao" : cfg.modo === "painel" ? "pintar.painel_nao" : "pintar.copiar_nao");
      ocupado = false;
      if (!ativo) return;
      if (errosSeguidos >= 2) await pista(k, r);
    }

    // Pintar à vontade: o "Pronto!" aparece quando todas as partes têm cor.
    let pronto = null;
    function mostrarPronto() {
      if (pronto) return;
      pronto = el("button", { class: "botao cor-verde pz-pronto" }, "Pronto!");
      pronto.addEventListener("click", () => {
        if (ocupado || !ativo) return;
        som.efeito("toque");
        ocupado = true;
        acabar();
      });
      ctx.cena.append(pronto);
      e.dizer("pintar.pronto_quando", { cara: CARA_FELIZ });
    }

    // Frases de abertura.
    if (primeiro) {
      await e.dizer("pintar.ola", { cara: CARA_FELIZ });
      if (!ativo) return;
    }
    if (cfg.modo === "livre") {
      await e.dizer(primeiro ? "pintar.livre" : "pintar.outro");
      if (primeiro && ativo) await e.dizer("pintar.como");
    } else if (cfg.modo === "copiar") {
      await e.dizer(primeiro ? "pintar.copiar" : "pintar.outro_copiar");
    } else if (painel) {
      await e.dizer(primeiro ? "pintar.painel" : "pintar.outro_painel");
    } else if (cfg.modo === "memoria") {
      // O azulejo é mostrado pronto, depois volta ao cinzento.
      const q = quadros[0];
      q.innerHTML = svgAzulejo(m, esquema);
      q.classList.add("pz-feito");
      await e.dizer(primeiro ? "pintar.memoria" : "pintar.outro_memoria");
      if (!ativo) return;
      await espera((cfg.curto ? 1500 : 3000) + nReg * (cfg.curto ? 500 : 800));
      if (!ativo) return;
      som.efeito("virar", 0.6);
      q.classList.add("apaga");
      await espera(500);
      if (!ativo) return;
      q.innerHTML = svgAzulejo(m, cores[0], { interativo: true });
      q.classList.remove("pz-feito", "apaga");
      caminhos[0] = [...q.querySelectorAll("[data-r]")];
      await e.dizer("pintar.memoria_agora");
    }
    if (!ativo) return;
    ocupado = false;
    ultimo = Date.now();

    await feito;
    if (!ativo) return;
    pronto?.remove();
    // Pronto: brilha, e vai para a parede.
    const desenho = painel ? svgPainel(m, [esquema, ...cores]) : svgAzulejo(m, cores[0]);
    ctx.novos.push(desenho);
    guardarNaParede(desenho);
    obra.classList.add("feito");
    toques.arpejo();
    som.efeito("vitoria2", 0.5);
    ganhar(20);
    const linha = cfg.modo === "livre" ? escolher(["pintar.lindo", "pintar.lindo2", "pintar.lindo3"]) : escolher(["pintar.igual", som.elogio()]);
    await e.dizer(linha, { cara: CARA_AMOR });
    if (!ativo) return;
    await espera(900);
  }

  comecar();
  return () => terminar(false);
}
