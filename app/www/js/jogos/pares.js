// Pares: virar cartas para encontrar pares iguais de coisas portuguesas conhecidas.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { ler, gravar, nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio, cabem, estilo, ALVO_MIN } from "../ui.js";

const CARTAS = [
  { id: "pastel_nata", src: "img/proprio/pastel_nata.svg" },
  { id: "sardinha", src: "img/proprio/sardinha.svg" },
  { id: "galo", src: "img/proprio/galo.svg" },
  { id: "cafe", src: "img/noto/cafe.svg" },
  { id: "gato", src: "img/noto/gato.svg" },
  { id: "cao", src: "img/noto/cao.svg" },
  { id: "flor", src: "img/noto/girassol.svg" },
  { id: "pao", src: "img/noto/pao.svg" },
  { id: "laranja", src: "img/noto/laranja.svg" },
  { id: "eletrico", src: "img/proprio/eletrico.svg" },
  { id: "guitarra", src: "img/proprio/guitarra.svg" },
  { id: "coracao", src: "img/noto/coracao.svg" },
];

// Imagens usadas só nos níveis mais difíceis.
const MAIS = {
  rosa: "img/noto/rosa.svg",
  tulipa: "img/noto/tulipa.svg",
  malmequer: "img/noto/malmequer.svg",
  margarida: "img/proprio/margarida.svg",
  peixe: "img/noto/peixe.svg",
  peixe_tropical: "img/noto/peixe_tropical.svg",
  croissant: "img/noto/croissant.svg",
  baguete: "img/noto/baguete.svg",
  limao: "img/noto/limao.svg",
  maca: "img/noto/maca.svg",
  maca_verde: "img/noto/maca_verde.svg",
  pera: "img/noto/pera.svg",
  cha: "img/noto/cha.svg",
  chave: "img/noto/chave.svg",
  porta: "img/noto/porta.svg",
  abelha: "img/noto/abelha.svg",
  mel: "img/noto/mel.svg",
  vaca: "img/noto/vaca.svg",
  leite: "img/noto/leite.svg",
  galinha: "img/noto/galinha.svg",
  ovo: "img/noto/ovo.svg",
  osso: "img/noto/osso.svg",
  guarda_chuva: "img/noto/guarda_chuva.svg",
  chuva: "img/noto/chuva.svg",
  agulha: "img/noto/agulha.svg",
  linha: "img/noto/carrinho_linha.svg",
  dente: "img/noto/dente.svg",
  escova: "img/noto/escova_dentes.svg",
  manteiga: "img/noto/manteiga.svg",
};
// Mais imagens para os níveis de topo (muitos pares, famílias parecidas, mais coisas que andam juntas).
for (const id of ["banana", "cereja", "morango", "uvas", "tomate", "cenoura", "queijo", "bolo", "pudim", "sol", "lua",
  "estrela", "borboleta", "joaninha", "caracol", "coelho", "ovelha", "pato", "passaro", "cavalo", "elefante", "porco",
  "urso", "sapo", "polvo", "caranguejo", "barco", "aviao", "comboio", "autocarro", "carro", "taxi", "carrinha",
  "relogio", "telefone", "chapeu", "sapato", "livro", "vela", "vinho", "mar", "pe", "baiacu", "melancia", "cogumelo",
  "pintainho", "pintainho_frente", "pintainho_ovo", "coracao_azul", "coracao_verde", "coracao_amarelo",
  "coracao_roxo", "caniche", "hibisco", "flor_cerejeira", "queque", "fatia_bolo", "bota", "sandalia", "sapato_salto",
  "rato", "macaco", "oculos", "novelo", "ninho", "cartola", "bone"]) {
  MAIS[id] = `img/noto/${id}.svg`;
}
const FIGURA = Object.fromEntries([...CARTAS.map((c) => [c.id, c.src]), ...Object.entries(MAIS)]);

// Famílias de imagens parecidas (dois peixes, duas flores, dois pães).
const PARECIDAS = [
  ["sardinha", "peixe", "peixe_tropical"],
  ["flor", "rosa", "tulipa", "malmequer", "margarida"],
  ["pao", "croissant", "baguete"],
  ["laranja", "limao", "pera"],
  ["maca", "maca_verde"],
  ["cafe", "cha"],
];
// Mais famílias, só nos novos níveis de topo (cfg.mais).
const PARECIDAS_MAIS = [
  ["pintainho", "pintainho_frente", "pintainho_ovo"],
  ["coracao", "coracao_azul", "coracao_verde", "coracao_amarelo", "coracao_roxo"],
  ["bolo", "queque", "fatia_bolo", "pudim"],
  ["sapato", "bota", "sandalia", "sapato_salto"],
  ["chapeu", "cartola", "bone"],
  ["carro", "taxi", "carrinha", "autocarro"],
  ["tomate", "cereja", "morango"],
  ["passaro", "pato", "galinha"],
  ["ovelha", "caniche"],
];

// Imagens diferentes que andam juntas.
const JUNTAS = [
  ["chave", "porta"], ["abelha", "mel"], ["vaca", "leite"], ["galinha", "ovo"], ["cao", "osso"],
  ["guarda_chuva", "chuva"], ["agulha", "linha"], ["dente", "escova"], ["pao", "manteiga"],
];
const JUNTAS_MAIS = [
  ["rato", "queijo"], ["macaco", "banana"], ["oculos", "livro"], ["novelo", "ovelha"], ["ninho", "passaro"],
  ["pe", "sapato"], ["coelho", "cenoura"], ["vela", "bolo"], ["uvas", "vinho"], ["lua", "estrela"], ["mar", "barco"],
];

// Nível: número de pares, e quanto tempo as cartas ficam todas viradas para cima no início.
// tipo: "parecidas" mistura imagens parecidas; "juntas" faz pares de coisas que andam juntas.
// O ecrã limita o número de pares para as cartas ficarem com pelo menos ALVO_MIN.
const NIVEIS = [
  { pares: 2, mostrar: 4000 },
  { pares: 3, mostrar: 3500 },
  { pares: 4, mostrar: 3000 },
  { pares: 5, mostrar: 2500 },
  { pares: 6, mostrar: 2000 },
  { pares: 8, mostrar: 1500 },
  { pares: 10, mostrar: 1200 },
  { pares: 8, mostrar: 1500, tipo: "parecidas" },
  { pares: 10, mostrar: 1200, tipo: "parecidas" },
  { pares: 8, mostrar: 2500, tipo: "juntas" },
  // A pedido da família: mais pares, degrau a degrau, com cartas até MIN_TOPO.
  // mais: tirar de todas as imagens e de todas as famílias parecidas.
  { pares: 12, mostrar: 1200, mais: true },
  { pares: 12, mostrar: 1200, tipo: "parecidas", mais: true },
  { pares: 12, mostrar: 2000, tipo: "juntas", mais: true },
  { pares: 15, mostrar: 1000, mais: true },
  { pares: 15, mostrar: 1000, tipo: "parecidas", mais: true },
  { pares: 18, mostrar: 900, tipo: "parecidas", mais: true },
  { pares: 16, mostrar: 1500, tipo: "juntas", mais: true },
  { pares: 21, mostrar: 800, tipo: "parecidas", mais: true },
  { pares: 24, mostrar: 700, tipo: "parecidas", mais: true },
  { pares: 28, mostrar: 600, tipo: "parecidas", mais: true },
  { pares: 32, mostrar: 600, tipo: "parecidas", mais: true },
  { pares: 36, mostrar: 500, tipo: "parecidas", mais: true },
  { pares: 40, mostrar: 500, tipo: "parecidas", mais: true },
];
// A carta mais pequena nos níveis novos: cerca de um terço de um botão do ecrã inicial (guia, só nos Pares).
const MIN_TOPO = 55;

// As cartas de uma ronda: [{ par, id, src }], duas por par.
function montarBaralho(cfg, pares) {
  const carta = (par, id) => ({ par, id, src: FIGURA[id] });
  if (cfg.tipo === "juntas") {
    const lista = cfg.mais ? [...JUNTAS, ...JUNTAS_MAIS] : JUNTAS;
    return baralhar(lista).slice(0, pares).flatMap(([a, b]) => [carta(a, a), carta(a, b)]);
  }
  const todas = cfg.mais ? Object.keys(FIGURA) : CARTAS.map((c) => c.id);
  let ids;
  if (cfg.tipo === "parecidas") {
    ids = [];
    for (const familia of baralhar(cfg.mais ? [...PARECIDAS, ...PARECIDAS_MAIS] : PARECIDAS)) {
      for (const id of baralhar(familia)) if (ids.length < pares && !ids.includes(id)) ids.push(id);
    }
    for (const id of baralhar(todas)) if (ids.length < pares && !ids.includes(id)) ids.push(id);
  } else {
    ids = baralhar(todas).slice(0, pares);
  }
  return ids.flatMap((id) => [carta(id, id), carta(id, id)]);
}

function baralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Colunas e tamanho de carta que cabem na mesa, deitado ou ao alto.
function disposicao(n, largura, altura) {
  let melhor = null;
  for (let cols = 1; cols <= n; cols++) {
    const linhas = Math.ceil(n / cols);
    const lado = Math.min(largura / cols, altura / linhas) * 0.86;
    if (!melhor || lado > melhor.lado) melhor = { cols, lado };
  }
  return melhor;
}

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo("pares");
  const e = ecra(() => terminar(false));
  app.append(e.raiz);
  let ativo = true;
  let ronda;

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    if (!completo && ronda) ronda.registar(false);
    e.raiz.remove();
    sair();
  }

  async function comecar() {
    const n = nivel("pares");
    const nivelCfg = NIVEIS[n - 1];
    const mesa = el("div", { class: "mesa" });
    e.corpo.replaceChildren(mesa);
    const caixa = e.corpo.getBoundingClientRect();
    const minimo = nivelCfg.mais ? MIN_TOPO : ALVO_MIN;
    const cabe = Math.floor(cabem(caixa.width, caixa.height, 0.86, minimo) / 2);
    const cfg = { ...nivelCfg, pares: Math.max(2, Math.min(nivelCfg.pares, cabe)) };
    const baralho = baralhar(montarBaralho(cfg, cfg.pares));
    som.preCarregar([...new Set(baralho.map((c) => `pares.${c.id}`))]);
    const { cols, lado } = disposicao(baralho.length, caixa.width, caixa.height);
    mesa.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    // O intervalo entre as cartas encolhe com elas, para uma mesa cheia caber na mesma.
    const vmin = Math.min(window.innerWidth, window.innerHeight);
    mesa.style.gap = `${Math.floor(Math.min(vmin * 0.025, lado * 0.15))}px`;
    mesa.classList.toggle("pequenas", lado < 90);
    // Uma barra de progresso fina no intervalo por cima da mesa.
    const enchimento = el("i");
    e.corpo.append(el("div", { class: "pares-barra" }, [enchimento]));

    const inicio = Date.now();
    let serie = 0;
    let melhorSerie = 0;
    let viradas = [];
    let bloqueado = true;
    let encontrados = 0;
    let toques = 0;
    let erros = 0;
    let errosSeguidos = 0;
    let repetidas = 0;
    const vistas = new Set();
    const temposPar = [];
    let ultimoPar = Date.now();

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        metricas.ronda("pares", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: encontrados,
          pairs: cfg.pares,
          kind: cfg.tipo || "iguais",
          flips: toques,
          wrong_pairs: erros,
          repeats_of_seen: repetidas,
          accuracy: toques ? Math.round((encontrados * 2 / toques) * 100) / 100 : 0,
          ms_per_pair_median: metricas.mediana(temposPar),
          best_streak: melhorSerie,
        });
        // Claramente fácil: menos erros do que uma memória perfeita precisa em média (cerca de 0,6 por par)
        // mais um pouco, e sem demoras. Claramente difícil: três erros por par ou mais.
        const facil = completo && erros <= Math.floor(cfg.pares * 0.8) && dur < cfg.pares * 12000;
        const dificil = completo && erros > cfg.pares * 3;
        ajustarNivel("pares", NIVEIS.length, { completo, facil, dificil });
      },
    };

    const cartas = baralho.map((c, i) => {
      const b = el("button", { class: "carta virada", style: { "--lado": `${lado}px` } }, [
        el("div", { class: "dentro" }, [
          el("div", { class: "verso" }),
          el("div", { class: "face" }, [img(c.src, som.texto(`pares.${c.id}`))]),
        ]),
      ]);
      b.dataset.id = c.par;
      b.dataset.fala = c.id;
      b.dataset.i = i;
      b.addEventListener("click", () => tocar(b));
      mesa.append(b);
      return b;
    });

    if (cfg.tipo === "juntas") {
      await e.dizer("pares.juntas");
      if (!ativo) return;
      await e.dizer("pares.exemplo");
    } else {
      await e.dizer(cfg.pares > 12 ? "pares.muitas" : "pares.instrucao");
      if (ativo && cfg.tipo === "parecidas") await e.dizer("pares.parecidas");
    }
    if (!ativo) return;
    await espera(cfg.mostrar);
    if (!ativo) return;
    som.efeito("baralhar", 0.5);
    cartas.forEach((b) => b.classList.remove("virada"));
    await espera(500);
    bloqueado = false;

    async function tocar(b) {
      if (bloqueado || !ativo || b.classList.contains("virada") || b.classList.contains("feita")) return;
      toques++;
      b.classList.add("virada");
      som.efeito("virar", 0.6);
      som.falar(`pares.${b.dataset.fala}`);
      viradas.push(b);
      if (viradas.length < 2) {
        vistas.add(b.dataset.i);
        return;
      }

      bloqueado = true;
      const [a, c] = viradas;
      viradas = [];
      await espera(900);
      if (!ativo) return;

      if (a.dataset.id === c.dataset.id) {
        a.classList.add("feita");
        c.classList.add("feita");
        encontrados++;
        errosSeguidos = 0;
        temposPar.push(Date.now() - ultimoPar);
        ultimoPar = Date.now();
        serie++;
        melhorSerie = Math.max(melhorSerie, serie);
        // Pares seguidos sem um erro: cada um com um som um pouco mais agudo.
        som.efeito(serie >= 2 ? `pares-serie${Math.min(serie - 1, 4)}` : "par");
        enchimento.style.width = `${(encontrados / cfg.pares) * 100}%`;
        if (encontrados === cfg.pares) {
          await e.dizer("pares.todos", { cara: "img/noto/gato_amor.svg" });
          if (!ativo) return;
          // Menos erros por par do que na última ronda neste nível: dizê-lo à pessoa.
          const taxa = erros / cfg.pares;
          const antes = ler("pares.ultima", null);
          if (antes && antes.nivel === n && taxa < antes.taxa) {
            await e.dizer("pares.melhor", { cara: "img/noto/gato_amor.svg" });
            if (!ativo) return;
          }
          gravar("pares.ultima", { nivel: n, taxa });
          ronda.registar(true);
          ronda = null;
          const r = await premio(e, e.raiz);
          if (r === "outra") comecar();
          else terminar(true);
          return;
        }
        const linha = serie === 3 || serie === 5 ? `pares.serie_${serie}` : encontrados === 1 ? "pares.par" : som.elogio();
        // Não se espera por isto: uma carta virada durante o elogio nunca se perde (o nome dela corta o elogio).
        bloqueado = false;
        e.dizer(linha, { cara: "img/noto/gato_feliz.svg" });
        return;
      } else {
        erros++;
        serie = 0;
        errosSeguidos++;
        // A carta igual já tinha sido vista antes? Então foi um deslize de memória.
        const par = cartas.find((x) => x !== c && x.dataset.id === c.dataset.id);
        if (par && vistas.has(par.dataset.i)) repetidas++;
        vistas.add(c.dataset.i);
        som.efeito("quase", 0.5);
        await e.dizer(erros === 1 ? "pares.nao_iguais" : som.quase());
        a.classList.remove("virada");
        c.classList.remove("virada");
        // Ao fim de três erros seguidos (cinco nas mesas grandes), mostrar discretamente onde está um par.
        if (errosSeguidos >= (cfg.pares > 12 ? 5 : 3)) {
          errosSeguidos = 0;
          const resto = cartas.filter((x) => !x.classList.contains("feita"));
          const alvo = resto[0].dataset.id;
          resto.filter((x) => x.dataset.id === alvo).forEach((x) => {
            x.classList.remove("pista");
            void x.offsetWidth;
            x.classList.add("pista");
          });
        }
      }
      bloqueado = false;
    }
  }

  comecar();
  return () => terminar(false);
}
