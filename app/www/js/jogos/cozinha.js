// Cozinha: cozinhar um prato tradicional português. A pessoa toca num ingrediente e ele salta para
// a panela. Os níveis baixos mostram a receita; os do meio mostram-na só no início (memória);
// depois os passos por ordem. Níveis mais altos: quantidades ("duas cebolas"), uma receita ouvida
// uma só vez, dois pratos ao mesmo tempo, e os passos de cozinhar como frases, por ordem, com um
// passo que não pertence.
// Receitas simplificadas a partir da Teleculinária e do e-konomista.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { ler, gravar, nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio, grelha, cabem, estilo } from "../ui.js";
import { tocavel } from "./lida.js";

const P = "img/jogos/cozinha-";
const N = "img/noto/";

// Todas as imagens em que se pode tocar. Os nomes são ditos como cozinha.i_<id>.
export const INGREDIENTES = {
  batata: N + "batata.svg",
  cebola: N + "cebola.svg",
  alho: N + "alho.svg",
  couve: N + "couve.svg",
  chourico: P + "chourico.svg",
  azeite: P + "azeite.svg",
  cenoura: N + "cenoura.svg",
  abobora: P + "abobora.svg",
  arroz: N + "arroz.svg",
  leite: N + "leite.svg",
  acucar: P + "acucar.svg",
  limao: N + "limao.svg",
  canela: P + "canela.svg",
  ovo: N + "ovo.svg",
  bacalhau: P + "bacalhau.svg",
  batata_palha: N + "batata_frita.svg",
  azeitonas: N + "azeitonas.svg",
  salsa: N + "salsa.svg",
  farinha: P + "farinha.svg",
  laranja: N + "laranja.svg",
  sardinha: "img/proprio/sardinha.svg",
  sal: N + "sal.svg",
  pimento: N + "pimento.svg",
  broa: P + "broa.svg",
  pao: N + "pao.svg",
  polvo: N + "polvo.svg",
  tomate: N + "tomate.svg",
  // Sempre errados.
  banana: N + "banana.svg",
  morango: N + "morango.svg",
  maca: N + "maca.svg",
  queijo: N + "queijo.svg",
  chocolate: N + "chocolate.svg",
  cogumelo: N + "cogumelo.svg",
  uvas: N + "uvas.svg",
  milho: N + "milho.svg",
  pera: N + "pera.svg",
  cereja: N + "cereja.svg",
  ananas: N + "ananas.svg",
  mel: N + "mel.svg",
  melancia: N + "melancia.svg",
  pepino: N + "pepino.svg",
};

// Imagens para os passos de cozinhar que não são um ingrediente.
const FIGURAS = { ...INGREDIENTES, fogo: N + "fogo.svg" };

// Passos de cozinhar como frases curtas, ditas como cozinha.e_<id>. [id, imagem].
const ETAPAS = {
  cebola_alho: "cebola",
  batatas_agua: "batata",
  couve: "couve",
  chourico: "chourico",
  azeite: "azeite",
  legumes: "cenoura",
  leite_ferver: "leite",
  arroz: "arroz",
  acucar: "acucar",
  gemas_fora: "ovo",
  bacalhau_desfiado: "bacalhau",
  batata_palha: "batata_palha",
  ovos_batidos: "ovo",
  azeitonas: "azeitonas",
  gemas_acucar: "ovo",
  laranja: "laranja",
  farinha: "farinha",
  forno: "fogo",
  sal_grosso: "sal",
  brasa: "sardinha",
  broa: "broa",
  leite_acucar: "leite",
  leite_pao: "pao",
  ovo_batido: "ovo",
  fritar: "fogo",
  canela: "canela",
  pure: "batata",
  desfiar: "bacalhau",
  misturar_ovos: "ovo",
  moldar: "fogo",
  gemas_farinha: "ovo",
  engrossar: "fogo",
  queimar: "acucar",
  tomate: "tomate",
  arroz_agua: "arroz",
  ovos_acucar: "ovo",
  cozer_polvo: "polvo",
  assar_batatas: "batata",
  regar: "azeite",
};

// passos: grupos de ingredientes pela ordem de cozinhar; dentro de um grupo qualquer ordem serve.
// nunca: coisas que podiam honestamente entrar nalguma versão, por isso nunca aparecem como erradas.
// qtd: quantos de um ingrediente que se conta a receita de origem usa (dito como cozinha.q_<id>_<n>).
// etapas: os passos de cozinhar por ordem; falsos: passos que claramente não pertencem a este prato.
export const RECEITAS = [
  { id: "caldo_verde", panela: "panela", passos: [["azeite"], ["cebola", "alho", "chourico"], ["batata"], ["couve"]],
    nunca: ["sal", "salsa", "cenoura"], qtd: { batata: 4, cebola: 2, alho: 1 },
    etapas: ["cebola_alho", "batatas_agua", "couve", "chourico"], falsos: ["canela", "ovos_acucar", "queimar", "batata_palha"] },
  { id: "sopa_legumes", panela: "panela", passos: [["azeite"], ["cebola", "alho"], ["batata", "cenoura", "abobora"]],
    nunca: ["sal", "couve", "tomate", "salsa", "pepino", "cogumelo", "milho", "pimento"],
    etapas: ["azeite", "cebola_alho", "legumes"], falsos: ["canela", "ovos_acucar", "queimar", "desfiar"] },
  { id: "arroz_doce", panela: "panela", passos: [["leite", "limao", "canela"], ["arroz"], ["acucar"], ["ovo"]],
    nunca: ["sal", "laranja", "mel"],
    etapas: ["leite_ferver", "arroz", "acucar", "gemas_fora"], falsos: ["cebola_alho", "desfiar", "sal_grosso", "couve"] },
  { id: "bacalhau_bras", panela: "frigideira", passos: [["azeite"], ["cebola", "alho"], ["bacalhau"], ["batata_palha"], ["ovo"], ["azeitonas", "salsa"]],
    nunca: ["sal", "batata", "leite"],
    etapas: ["cebola_alho", "bacalhau_desfiado", "batata_palha", "ovos_batidos", "azeitonas"], falsos: ["canela", "queimar", "laranja", "leite_pao"] },
  { id: "bolo_laranja", panela: "tigela", passos: [["ovo", "acucar"], ["laranja"], ["farinha"]],
    nunca: ["leite", "limao", "sal", "mel", "canela"], qtd: { ovo: 3, laranja: 1 },
    etapas: ["gemas_acucar", "laranja", "farinha", "forno"], falsos: ["cebola_alho", "sal_grosso", "couve", "tomate"] },
  { id: "sardinhas", panela: "grelha", passos: [["sardinha"], ["sal"], ["pimento"], ["broa"]],
    nunca: ["batata", "azeite", "cebola", "tomate", "alho", "salsa", "pepino", "limao"],
    etapas: ["sal_grosso", "brasa", "broa"], falsos: ["canela", "ovos_acucar", "farinha", "queimar"] },
  // Acrescentados mais tarde, das mesmas fontes.
  { id: "rabanadas", panela: "frigideira", passos: [["leite", "acucar", "limao"], ["pao"], ["ovo"], ["canela"]],
    nunca: ["azeite", "mel", "laranja", "sal"], qtd: { ovo: 3 },
    etapas: ["leite_acucar", "leite_pao", "ovo_batido", "fritar", "canela"], falsos: ["cebola_alho", "couve", "sal_grosso", "tomate"] },
  { id: "pasteis_bacalhau", panela: "frigideira", passos: [["batata"], ["bacalhau"], ["cebola", "azeite"], ["ovo", "salsa"]],
    nunca: ["alho", "sal", "farinha", "leite"], qtd: { ovo: 4, cebola: 1 },
    etapas: ["pure", "desfiar", "misturar_ovos", "moldar"], falsos: ["canela", "queimar", "laranja", "arroz"] },
  { id: "leite_creme", panela: "panela", passos: [["leite", "limao", "canela"], ["ovo", "acucar", "farinha"]],
    nunca: ["sal", "laranja", "mel"],
    etapas: ["leite_ferver", "gemas_farinha", "engrossar", "queimar"], falsos: ["cebola_alho", "sal_grosso", "couve", "desfiar"] },
  { id: "arroz_tomate", panela: "panela", passos: [["azeite"], ["cebola", "alho"], ["tomate"], ["arroz"]],
    nunca: ["sal", "salsa", "pimento", "chourico", "cenoura"], qtd: { tomate: 3, alho: 1 },
    etapas: ["cebola_alho", "tomate", "arroz_agua"], falsos: ["canela", "queimar", "ovos_acucar", "laranja"] },
  { id: "pao_de_lo", panela: "tigela", passos: [["ovo", "acucar"], ["farinha"]],
    nunca: ["sal", "limao", "laranja", "leite", "canela", "mel"],
    etapas: ["ovos_acucar", "farinha", "forno"], falsos: ["cebola_alho", "sal_grosso", "tomate", "couve"] },
  { id: "polvo_lagareiro", panela: "forno", passos: [["polvo", "cebola"], ["batata"], ["azeite", "alho"]],
    nunca: ["sal", "salsa", "pimento", "azeitonas", "limao"], qtd: { alho: 3, cebola: 1 },
    etapas: ["cozer_polvo", "assar_batatas", "regar", "forno"], falsos: ["canela", "queimar", "ovos_acucar", "leite_pao"] },
];

const ERRADOS = ["banana", "morango", "tomate", "maca", "queijo", "chocolate", "cogumelo", "uvas", "milho",
  "pera", "cereja", "ananas", "mel", "melancia", "pepino"];

// distr: imagens erradas; cartao: "sempre", "memoria" (vista e depois escondida) ou "ouvido" (ouvida
// uma vez, nunca mostrada); ordem: os passos têm de seguir os números; qtd: contar as quantidades;
// dois: dois pratos ao mesmo tempo; etapas: os passos como frases, por ordem, com distr passos que
// não pertencem.
const NIVEIS = [
  { distr: 2, cartao: "sempre", ordem: false, pequenas: true },
  { distr: 3, cartao: "sempre", ordem: false },
  { distr: 5, cartao: "sempre", ordem: false },
  { distr: 3, cartao: "memoria", ordem: false },
  { distr: 5, cartao: "memoria", ordem: false },
  { distr: 3, cartao: "sempre", ordem: true },
  { distr: 4, cartao: "memoria", ordem: true },
  { distr: 4, cartao: "sempre", ordem: false, qtd: true },
  { distr: 4, cartao: "memoria", ordem: false, qtd: true },
  { distr: 5, cartao: "ouvido", ordem: false },
  { distr: 3, cartao: "sempre", ordem: false, dois: true },
  { distr: 2, cartao: "ouvido", ordem: true, etapas: true },
];
const PRATOS = 3; // pratos por ronda
const PARES = 2;  // pares de pratos por ronda no nível dos dois pratos
const ETAPAS_MAX = 6; // cartões de passos no tabuleiro, para cada um ficar grande que chegue

// Três fios ondulados de vapor por cima do prato pronto (animados em cozinha.css).
const VAPOR = `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">${[25, 60, 95].map((x, i) => {
  const d = `M${x} 76 q-10 -12 0 -24 q10 -12 0 -24 q-10 -12 0 -24`;
  return `<g class="fio f${i + 1}" fill="none" stroke-linecap="round"><path d="${d}" stroke="#6b7a86" stroke-width="10"/><path d="${d}" stroke="#ffffff" stroke-width="5"/></g>`;
}).join("")}</svg>`;

const CARA_FELIZ = "img/noto/gato_feliz.svg";
const CARA_AMOR = "img/noto/gato_amor.svg";

function baralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const todos = (r) => r.passos.flat();
const nomeDe = (id) => som.texto(`cozinha.i_${id}`).replace(/[.!]$/, "");

// "Duas cebolas." -> "2 cebolas": o cartão mostra algarismos, a voz diz as palavras.
const NUM_PALAVRA = { Um: 1, Uma: 1, Dois: 2, Duas: 2, "Três": 3, Quatro: 4 };
function textoQtd(id, q) {
  const t = som.texto(`cozinha.q_${id}_${q}`).replace(/[.!]$/, "");
  const [primeira, ...resto] = t.split(" ");
  return NUM_PALAVRA[primeira] ? `${NUM_PALAVRA[primeira]} ${resto.join(" ")}` : t;
}

// O tabuleiro é medido logo que é construído, por isso esperar primeiro pela folha de estilos do jogo.
async function estiloPronto(id) {
  estilo(id);
  const l = document.querySelector(`link[data-jogo="${id}"]`);
  if (l && !l.sheet) {
    await new Promise((r) => {
      l.addEventListener("load", r, { once: true });
      l.addEventListener("error", r, { once: true });
      setTimeout(r, 2000);
    });
  }
}

const abana = (b) => {
  b.classList.remove("abana");
  void b.offsetWidth;
  b.classList.add("abana");
};

// Sensação de jogo: uma barra de progresso ao longo da borda de baixo (um passo por prato) e um
// emblema de acertos seguidos, com uma festa a cada cinco toques certos de seguida.
function criarRitmo(raiz, total) {
  const barra = el("div", { class: "cozinha-barra" }, [el("i")]);
  const selo = el("div", { class: "cozinha-selo" });
  raiz.append(barra, selo);
  let feitos = 0;
  let seguidas = 0;
  return {
    avancar() {
      feitos++;
      barra.firstChild.style.width = `${Math.min(100, (feitos / total) * 100)}%`;
    },
    certo() {
      seguidas++;
      if (seguidas >= 5 && seguidas % 5 === 0) {
        selo.textContent = `${seguidas} certas seguidas!`;
        selo.classList.remove("mostra");
        void selo.offsetWidth;
        selo.classList.add("mostra");
        som.efeito(seguidas % 10 === 0 ? "vitoria2" : "linha", 0.5);
      }
    },
    errado() { seguidas = 0; },
    remover() { barra.remove(); selo.remove(); },
  };
}

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo("cozinha");
  const e = ecra(() => terminar(false));
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let ritmo = null;

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    if (!completo && ronda) ronda.registar(false);
    e.raiz.remove();
    sair();
  }

  // Pratos para uma ronda, diferentes dos da última vez quando dá.
  function escolherReceitas(cfg) {
    const ultimas = ler("cozinha.ultimas", []);
    const base = cfg.qtd ? RECEITAS.filter((r) => r.qtd) : RECEITAS;
    let lista = base.filter((r) => !ultimas.includes(r.id));
    if (cfg.pequenas) {
      const pequenas = lista.filter((r) => todos(r).length <= 5);
      lista = pequenas.length >= PRATOS ? pequenas : RECEITAS.filter((r) => todos(r).length <= 6);
    }
    if (lista.length < PRATOS) lista = base;
    const escolha = baralhar(lista).slice(0, PRATOS);
    gravar("cozinha.ultimas", escolha.map((r) => r.id));
    return escolha;
  }

  // Nível dos dois pratos: pares que não partilham ingredientes (para cada imagem ter uma só panela
  // certa) e que cabem no tabuleiro com pelo menos uma imagem errada.
  function escolherPares(cabe) {
    const pares = [];
    for (let i = 0; i < RECEITAS.length; i++) {
      for (let j = i + 1; j < RECEITAS.length; j++) {
        const a = RECEITAS[i];
        const b = RECEITAS[j];
        const ta = todos(a);
        const tb = todos(b);
        if (ta.some((x) => tb.includes(x))) continue;
        pares.push({ par: [a, b], n: ta.length + tb.length });
      }
    }
    let cabem_ = pares.filter((p) => p.n < cabe);
    if (cabem_.length < PARES) {
      const menor = Math.min(...pares.map((p) => p.n));
      cabem_ = pares.filter((p) => p.n <= menor + 1);
    }
    const escolha = [];
    for (const p of baralhar(cabem_)) {
      if (escolha.length >= PARES) break;
      // Pratos diferentes nos dois pares, quando dá.
      if (escolha.some((q) => q.par.some((r) => p.par.includes(r))) && cabem_.length > PARES * 2) continue;
      escolha.push(p);
    }
    return escolha.map((p) => baralhar(p.par));
  }

  async function comecar() {
    await estiloPronto("cozinha");
    if (!ativo) return;
    const n = nivel("cozinha");
    const cfg = NIVEIS[n - 1];
    const inicio = Date.now();
    if (ritmo) ritmo.remover();
    ritmo = criarRitmo(e.raiz, cfg.dois ? PARES * 2 : PRATOS);
    const st = { certos: 0, errados: 0, foraOrdem: 0, pistas: 0, pratos: 0, tempos: [], quantidade: 0, panelaErrada: 0, passoFalso: 0 };

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        const erros = st.errados + st.foraOrdem + st.quantidade + st.panelaErrada;
        const tentativas = st.certos + erros;
        metricas.ronda("cozinha", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: st.certos,
          accuracy: tentativas ? Math.round((st.certos / tentativas) * 100) / 100 : null,
          dishes_done: st.pratos,
          wrong_taps: st.errados,
          order_errors: st.foraOrdem,
          hints_needed: st.pistas,
          memory_mode: cfg.cartao !== "sempre",
          order_mode: cfg.ordem,
          distractors: cfg.distr,
          ms_per_ingredient_median: metricas.mediana(st.tempos),
          heard_only: cfg.cartao === "ouvido",
          quantity_mode: !!cfg.qtd,
          quantity_errors: st.quantidade,
          two_dishes: !!cfg.dois,
          pot_errors: st.panelaErrada,
          steps_mode: !!cfg.etapas,
          wrong_step_taps: st.passoFalso,
        });
        // Claramente fácil: sem erros e sem pistas (2 pontos); uma ronda acabada de outra maneira vale 1.
        const facil = completo && erros === 0 && st.pistas === 0;
        // Uma ronda deixada a meio não muda nada (regra de estado.js), por isso só uma ronda acabada pode ser difícil.
        const dificil = completo && (st.pistas >= 2 || erros > st.certos);
        ajustarNivel("cozinha", NIVEIS.length, { completo, facil, dificil });
      },
    };

    if (cfg.dois) {
      const caixa = e.corpo.getBoundingClientRect();
      const paisagem = caixa.width > caixa.height * 1.1;
      // Parte do ecrã que o tabuleiro ocupa neste nível (ver .cozinha.dois em cozinha.css).
      const cabe = paisagem ? cabem(caixa.width * 0.5, caixa.height) : cabem(caixa.width, caixa.height * 0.42);
      const pares = escolherPares(cabe);
      for (let i = 0; i < pares.length && ativo; i++) {
        await cozinharDois(pares[i], cfg, st, i === 0);
        if (!ativo) return;
        st.pratos += 2;
        ritmo.avancar(); ritmo.avancar();
      }
    } else {
      const receitas = escolherReceitas(cfg);
      for (let i = 0; i < receitas.length && ativo; i++) {
        if (cfg.etapas) await cozinharEtapas(receitas[i], cfg, st, i === 0);
        else await cozinhar(receitas[i], cfg, st, i === 0);
        if (!ativo) return;
        st.pratos++;
        ritmo.avancar();
      }
    }
    if (!ativo) return;
    // Melhor do que da última vez neste nível: dizê-lo.
    const certeza = st.certos / Math.max(1, st.certos + st.errados + st.foraOrdem + st.quantidade + st.panelaErrada);
    const antes = ler("cozinha.ultima", null);
    gravar("cozinha.ultima", { nivel: n, certeza });
    if (antes && antes.nivel === n && certeza > antes.certeza) {
      await e.dizer("cozinha.melhor", { cara: CARA_FELIZ });
      if (!ativo) return;
    }
    await e.dizer("cozinha.fim", { cara: CARA_AMOR });
    if (!ativo) return;
    ronda.registar(true);
    ronda = null;
    const r = await premio(e, e.raiz);
    if (r === "outra") comecar();
    else terminar(true);
  }

  // Uma panela com o nome do prato por cima. Devolve { panela, panelaImg }.
  function montarPanela(rec, extra = "") {
    const panelaImg = img(`${P}${rec.panela}.svg`, "");
    const panela = el("div", { class: `panela${extra}` }, [
      el("div", { class: "nome-prato" }, som.texto(`cozinha.nome_${rec.id}`)),
      el("div", { class: "fundo-panela" }, [panelaImg, el("div", { class: "vapor", html: VAPOR })]),
    ]);
    panela.dataset.receita = rec.id;
    return { panela, panelaImg };
  }

  // Linhas do cartão: uma por cada ingrediente preciso, numeradas por passo quando a ordem conta,
  // com a quantidade quando ela conta.
  function montarCartao(rec, cfg, qtd, titulo = false) {
    const cartao = el("div", { class: "receita" });
    const linhas = {};
    if (titulo) cartao.append(el("div", { class: "titulo-receita" }, som.texto(`cozinha.nome_${rec.id}`)));
    rec.passos.forEach((grupo, k) => {
      for (const id of grupo) {
        const q = qtd[id];
        const linha = el("div", { class: `linha-receita${q ? " com-qtd" : ""}` }, [
          cfg.ordem ? el("span", { class: "passo" }, String(k + 1)) : null,
          img(INGREDIENTES[id], ""),
          el("span", { class: "nome" }, q ? textoQtd(id, q) : nomeDe(id)),
        ]);
        linha.dataset.passo = k;
        linhas[id] = linha;
        cartao.append(linha);
      }
    });
    cartao.dataset.receita = rec.id;
    cartao.style.setProperty("--linhas", todos(rec).length + (titulo ? 1 : 0));
    return { cartao, linhas };
  }

  // Imagens erradas para um tabuleiro: metade com graça (banana), metade ingredientes a sério de outros pratos.
  function escolherErrados(recs, distr, cfg) {
    const precisos = recs.flatMap(todos);
    const proibidos = new Set([...precisos, ...recs.flatMap((r) => r.nunca)]);
    const outrasReceitas = RECEITAS.flatMap(todos).filter((x) => !proibidos.has(x));
    const poolEstranho = baralhar(ERRADOS.filter((x) => !proibidos.has(x)));
    const poolReal = baralhar([...new Set(outrasReceitas)]);
    const errados = [];
    while (errados.length < distr) {
      const fonte = (errados.length % 2 === 0 && cfg.distr > 2) || !poolEstranho.length ? poolReal : poolEstranho;
      const x = fonte.shift() || poolEstranho.shift() || poolReal.shift();
      if (!x) break;
      if (!errados.includes(x)) errados.push(x);
    }
    return errados;
  }

  function montarBotoes(tabuleiro, pecas, tocar) {
    const tb = tabuleiro.getBoundingClientRect();
    const { cols, lado } = grelha(pecas.length, tb.width, tb.height, 0.9);
    const ladoFinal = Math.min(lado, 190);
    tabuleiro.style.gridTemplateColumns = `repeat(${cols}, ${ladoFinal}px)`;
    return pecas.map((id) => {
      const b = el("button", { class: "ingrediente", style: { "--lado": `${ladoFinal}px` } }, [
        img(INGREDIENTES[id], ""),
        el("span", {}, nomeDe(id)),
      ]);
      b.dataset.id = id;
      b.addEventListener("click", () => tocar(b));
      tabuleiro.append(b);
      return b;
    });
  }

  function voar(origem, srcImg, panelaImg) {
    const de = origem.getBoundingClientRect();
    const para = panelaImg.getBoundingClientRect();
    const base = e.raiz.getBoundingClientRect();
    const voo = img(srcImg, "");
    voo.className = "voo-ingrediente";
    Object.assign(voo.style, {
      left: `${de.left - base.left}px`, top: `${de.top - base.top}px`, width: `${de.width}px`, height: `${de.height}px`,
    });
    e.raiz.append(voo);
    const dx = para.left + para.width / 2 - (de.left + de.width / 2);
    const dy = para.top + para.height * 0.3 - (de.top + de.height / 2);
    const alto = Math.min(dy, 0) - Math.max(80, de.height);
    const anim = voo.animate([
      { transform: "translate(0, 0) scale(1) rotate(0)" },
      { transform: `translate(${dx * 0.5}px, ${alto}px) scale(0.85) rotate(-90deg)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.45) rotate(-200deg)`, opacity: 0.9 },
    ], { duration: 600, easing: "ease-in-out", fill: "forwards" });
    anim.onfinish = () => voo.remove();
  }

  function plop(panela) {
    setTimeout(() => {
      if (!ativo) return;
      som.efeito("cozinha-plop", 0.6);
      panela.classList.remove("recebe");
      void panela.offsetWidth;
      panela.classList.add("recebe");
    }, 550);
  }

  // Lê a receita em voz alta, uma linha de cada vez; as linhas do cartão acendem-se quando estão à vista.
  async function lerReceita(rec, qtd, linhas, mostrar) {
    for (const id of todos(rec)) {
      if (mostrar) linhas[id].classList.add("lida");
      await e.dizer(qtd[id] ? `cozinha.q_${id}_${qtd[id]}` : `cozinha.i_${id}`);
      if (!ativo) return;
      if (mostrar) linhas[id].classList.remove("lida");
    }
  }

  async function servir(panelas, cartoes, tabuleiro, recs) {
    await espera(900);
    if (!ativo) return;
    for (const c of cartoes) c.classList.remove("escondida");
    panelas.forEach(({ panela, panelaImg }, k) => {
      panelaImg.src = `${P}prato-${recs[k].id}.svg`;
      panela.classList.add("pronto");
    });
    tabuleiro.classList.add("arrumado");
    som.efeito("vitoria2", 0.6);
    for (const rec of recs) {
      await e.dizer(`cozinha.pronto_${rec.id}`, { cara: CARA_AMOR });
      if (!ativo) return;
    }
    await espera(1500);
  }

  // Um prato: tocar nos ingredientes (com quantidades nos níveis de quantidades).
  async function cozinhar(rec, cfg, st, primeiro) {
    const precisos = todos(rec);
    const qtd = cfg.qtd ? (rec.qtd || {}) : {};
    const precisa = (id) => qtd[id] || 1;
    som.preCarregar([`cozinha.fazer_${rec.id}`, `cozinha.pronto_${rec.id}`,
      ...precisos.map((x) => (qtd[x] ? `cozinha.q_${x}_${qtd[x]}` : `cozinha.i_${x}`))]);

    // Peças do ecrã: cartão da receita, panela, tabuleiro dos ingredientes.
    const caixa = e.corpo.getBoundingClientRect();
    const paisagem = caixa.width > caixa.height * 1.1;
    const raiz = el("div", { class: `cozinha ${paisagem ? "paisagem" : "retrato"}${cfg.qtd ? " qtd" : ""}` });
    e.corpo.replaceChildren(raiz);
    const { cartao, linhas: linhasCartao } = montarCartao(rec, cfg, qtd);
    const { panela, panelaImg } = montarPanela(rec);
    const tabuleiro = el("div", { class: "tabuleiro" });
    raiz.append(cartao, panela, tabuleiro);
    // Nível de ouvir uma só vez: o cartão está tapado desde o início.
    if (cfg.cartao === "ouvido") cartao.classList.add("escondida");

    // Quantas peças cabem no tamanho inteiro decide quantas erradas entram.
    const tb = tabuleiro.getBoundingClientRect();
    const cabe = cabem(tb.width, tb.height);
    const distr = Math.max(1, Math.min(cfg.distr, cabe - precisos.length));
    const errados = escolherErrados([rec], distr, cfg);
    const pecas = baralhar([...precisos, ...errados]);
    const botoes = montarBotoes(tabuleiro, pecas, (b) => tocar(b));

    let ocupado = true;
    let passo = 0;
    const postos = new Set();
    const contagem = {};
    let errosSeguidos = 0;
    let ultimoCerto = Date.now();
    let acabar = null;
    const feito = new Promise((r) => { acabar = r; });

    function marcarPasso() {
      if (!cfg.ordem) return;
      for (const [id, linha] of Object.entries(linhasCartao)) {
        linha.classList.toggle("atual", Number(linha.dataset.passo) === passo && !postos.has(id));
      }
    }

    await e.dizer(`cozinha.fazer_${rec.id}`, { cara: CARA_FELIZ });
    if (!ativo) return;
    if (cfg.cartao === "memoria") {
      await e.dizer("cozinha.olha");
      if (!ativo) return;
      // Ler a receita em voz alta, uma linha de cada vez, e depois escondê-la.
      await lerReceita(rec, qtd, linhasCartao, true);
      if (!ativo) return;
      await espera(1500 + precisos.length * 400);
      if (!ativo) return;
      cartao.classList.add("escondida");
      som.efeito("virar", 0.5);
      await e.dizer(cfg.ordem ? "cozinha.lembra_ordem" : "cozinha.lembra");
    } else if (cfg.cartao === "ouvido") {
      await e.dizer("cozinha.ouve");
      if (!ativo) return;
      await lerReceita(rec, qtd, linhasCartao, false);
      if (!ativo) return;
      await e.dizer("cozinha.lembra");
    } else if (primeiro) {
      await e.dizer(cfg.ordem ? "cozinha.instrucao_ordem" : cfg.qtd ? "cozinha.instrucao_qtd" : "cozinha.instrucao");
    }
    if (!ativo) return;
    marcarPasso();
    ocupado = false;
    ultimoCerto = Date.now();

    async function pista() {
      st.pistas++;
      errosSeguidos = 0;
      if (cartao.classList.contains("escondida")) {
        cartao.classList.remove("escondida");
        await e.dizer("cozinha.espreita");
        await espera(3500);
        if (!ativo) return;
        cartao.classList.add("escondida");
      } else {
        // Receita já à vista: pôr a piscar as próximas imagens precisas.
        const falta = cfg.ordem ? rec.passos[passo].filter((x) => !postos.has(x)) : precisos.filter((x) => !postos.has(x));
        botoes.filter((b) => falta.includes(b.dataset.id)).slice(0, 1).forEach((b) => {
          b.classList.remove("pista");
          void b.offsetWidth;
          b.classList.add("pista");
        });
      }
    }

    async function falhar(b, linha, contador) {
      st[contador]++;
      ritmo.errado();
      errosSeguidos++;
      ocupado = true;
      abana(b);
      som.efeito("quase", 0.4);
      await e.dizer(linha);
      ocupado = false;
      if (errosSeguidos >= 3) await pista();
    }

    async function tocar(b) {
      if (ocupado || !ativo || b.classList.contains("usado")) return;
      const id = b.dataset.id;
      const certo = precisos.includes(id);
      if (certo && cfg.ordem && !rec.passos[passo].includes(id)) {
        await falhar(b, "cozinha.ainda_nao", "foraOrdem");
        return;
      }
      if (!certo) {
        const frases = ["cozinha.nao_vai", "cozinha.nao_vai2", "cozinha.nao_vai3"];
        await falhar(b, st.errados === 0 ? "cozinha.nao_vai" : frases[Math.floor(Math.random() * frases.length)], "errados");
        return;
      }
      if (postos.has(id)) {
        // Níveis de quantidades: a imagem fica, por isso é preciso parar na conta certa.
        await falhar(b, "cozinha.ja_chega", "quantidade");
        return;
      }
      // A certa: salta para a panela.
      errosSeguidos = 0;
      st.certos++;
      ritmo.certo();
      st.tempos.push(Date.now() - ultimoCerto);
      ultimoCerto = Date.now();
      contagem[id] = (contagem[id] || 0) + 1;
      if (contagem[id] >= precisa(id)) postos.add(id);
      b.classList.remove("pista");
      voar(b.querySelector("img"), INGREDIENTES[id], panelaImg);
      if (cfg.qtd) {
        // Emblema com a conta em cima da imagem; a imagem fica no tabuleiro.
        let marca = b.querySelector(".conta");
        if (!marca) { marca = el("b", { class: "conta" }); b.append(marca); }
        marca.textContent = String(contagem[id]);
      } else {
        b.classList.add("usado");
      }
      if (postos.has(id)) linhasCartao[id].classList.add("posto");
      som.efeito("toque", 0.4);
      e.dizer(`cozinha.i_${id}`);
      if (cfg.ordem && rec.passos[passo].every((x) => postos.has(x))) passo++;
      marcarPasso();
      plop(panela);
      if (postos.size === precisos.length) {
        ocupado = true;
        acabar();
      } else if (postos.size === Math.ceil(precisos.length / 2) && contagem[id] === precisa(id) && Math.random() < 0.6) {
        ocupado = true;
        await espera(800);
        if (!ativo) return;
        await e.dizer(som.elogio(), { cara: CARA_FELIZ });
        ocupado = false;
      }
    }

    await feito;
    if (!ativo) return;
    // O prato está pronto: servido e a fumegar.
    await servir([{ panela, panelaImg }], [cartao], tabuleiro, [rec]);
  }

  // Dois pratos ao mesmo tempo: tocar num ingrediente, depois na panela a que pertence.
  async function cozinharDois(recs, cfg, st, primeiro) {
    const precisos = recs.flatMap(todos);
    som.preCarregar(recs.flatMap((r) => [`cozinha.fazer_${r.id}`, `cozinha.pronto_${r.id}`]));
    const caixa = e.corpo.getBoundingClientRect();
    const paisagem = caixa.width > caixa.height * 1.1;
    const raiz = el("div", { class: `cozinha dois ${paisagem ? "paisagem" : "retrato"}` });
    e.corpo.replaceChildren(raiz);
    const cartoes = recs.map((r) => montarCartao(r, cfg, {}, true));
    const panelas = recs.map((r, k) => montarPanela(r, ` cor${k + 1}`));
    cartoes.forEach((c, k) => c.cartao.classList.add(`cor${k + 1}`));
    const coluna = el("div", { class: "cartoes" }, cartoes.map((c) => c.cartao));
    const fogao = el("div", { class: "panelas" }, panelas.map((p) => p.panela));
    const tabuleiro = el("div", { class: "tabuleiro" });
    raiz.append(coluna, fogao, tabuleiro);

    const tb = tabuleiro.getBoundingClientRect();
    const cabe = cabem(tb.width, tb.height);
    const distr = Math.max(1, Math.min(cfg.distr, cabe - precisos.length));
    const errados = escolherErrados(recs, distr, cfg);
    const botoes = montarBotoes(tabuleiro, baralhar([...precisos, ...errados]), (b) => tocar(b));
    panelas.forEach((p, k) => {
      p.panela.classList.add("alvo");
      // A panela não é um botão: um toque de ponteiro com folga para um dedo a tremer (lida.js), porque
      // um clique perder-se-ia ao fim de 8 px de deslize.
      tocavel(p.panela, () => tocarPanela(k));
    });

    let ocupado = true;
    let escolhido = null;
    let errosSeguidos = 0;
    let ultimoCerto = Date.now();
    const postos = new Set();
    let acabar = null;
    const feito = new Promise((r) => { acabar = r; });

    if (primeiro) await e.dizer("cozinha.dois", { cara: CARA_FELIZ });
    if (!ativo) return;
    for (const r of recs) {
      await e.dizer(`cozinha.fazer_${r.id}`, { cara: CARA_FELIZ });
      if (!ativo) return;
    }
    if (primeiro) await e.dizer("cozinha.instrucao_dois");
    if (!ativo) return;
    ocupado = false;
    ultimoCerto = Date.now();

    function pista() {
      st.pistas++;
      errosSeguidos = 0;
      const b = botoes.find((x) => precisos.includes(x.dataset.id) && !postos.has(x.dataset.id));
      if (!b) return;
      b.classList.remove("pista");
      void b.offsetWidth;
      b.classList.add("pista");
      const k = recs.findIndex((r) => todos(r).includes(b.dataset.id));
      panelas[k].panela.classList.remove("pista");
      void panelas[k].panela.offsetWidth;
      panelas[k].panela.classList.add("pista");
    }

    async function tocar(b) {
      if (ocupado || !ativo || b.classList.contains("usado")) return;
      const id = b.dataset.id;
      if (!precisos.includes(id)) {
        st.errados++;
        ritmo.errado();
        errosSeguidos++;
        ocupado = true;
        abana(b);
        som.efeito("quase", 0.4);
        await e.dizer(Math.random() < 0.5 ? "cozinha.nao_vai" : "cozinha.nao_vai2");
        ocupado = false;
        if (errosSeguidos >= 3) pista();
        return;
      }
      // Pegar nele; a panela vem a seguir.
      for (const x of botoes) x.classList.remove("escolhido");
      b.classList.add("escolhido");
      escolhido = b;
      som.efeito("toque", 0.4);
      e.dizer(`cozinha.i_${id}`);
    }

    async function tocarPanela(k) {
      if (ocupado || !ativo) return;
      if (!escolhido) {
        ocupado = true;
        await e.dizer("cozinha.escolhe_primeiro");
        ocupado = false;
        return;
      }
      const b = escolhido;
      const id = b.dataset.id;
      if (!todos(recs[k]).includes(id)) {
        st.panelaErrada++;
        ritmo.errado();
        errosSeguidos++;
        ocupado = true;
        abana(panelas[k].panela);
        som.efeito("quase", 0.4);
        await e.dizer("cozinha.outro_prato");
        ocupado = false;
        if (errosSeguidos >= 3) pista();
        return;
      }
      errosSeguidos = 0;
      escolhido = null;
      st.certos++;
      ritmo.certo();
      st.tempos.push(Date.now() - ultimoCerto);
      ultimoCerto = Date.now();
      postos.add(id);
      b.classList.remove("escolhido", "pista");
      for (const p of panelas) p.panela.classList.remove("pista");
      voar(b.querySelector("img"), INGREDIENTES[id], panelas[k].panelaImg);
      b.classList.add("usado");
      cartoes[k].linhas[id].classList.add("posto");
      plop(panelas[k].panela);
      if (postos.size === precisos.length) {
        ocupado = true;
        acabar();
      }
    }

    await feito;
    if (!ativo) return;
    await servir(panelas, cartoes.map((c) => c.cartao), tabuleiro, recs);
  }

  // Os passos de cozinhar como frases: ouvidos uma vez por ordem, depois tocados por ordem.
  // Alguns cartões de passos no tabuleiro não pertencem a este prato.
  async function cozinharEtapas(rec, cfg, st, primeiro) {
    const etapas = rec.etapas;
    som.preCarregar([`cozinha.fazer_${rec.id}`, `cozinha.pronto_${rec.id}`, ...etapas.map((x) => `cozinha.e_${x}`)]);
    const caixa = e.corpo.getBoundingClientRect();
    const paisagem = caixa.width > caixa.height * 1.1;
    const raiz = el("div", { class: `cozinha etapas ${paisagem ? "paisagem" : "retrato"}` });
    e.corpo.replaceChildren(raiz);

    // Cartão: lugares numerados que se enchem à medida que cada passo é posto.
    const cartao = el("div", { class: "receita" });
    const slots = etapas.map((x, k) => {
      const s = el("div", { class: "linha-receita etapa" }, [
        el("span", { class: "passo" }, String(k + 1)),
        el("span", { class: "nome" }, som.texto(`cozinha.e_${x}`).replace(/[.!]$/, "")),
      ]);
      cartao.append(s);
      return s;
    });
    cartao.dataset.receita = rec.id;
    cartao.style.setProperty("--linhas", etapas.length);
    const { panela, panelaImg } = montarPanela(rec);
    const tabuleiro = el("div", { class: "tabuleiro" });
    raiz.append(cartao, panela, tabuleiro);

    const nFalsos = Math.max(1, Math.min(cfg.distr, ETAPAS_MAX - etapas.length));
    const falsos = baralhar(rec.falsos).slice(0, nFalsos);
    const cartas = baralhar([...etapas, ...falsos]);
    const tb = tabuleiro.getBoundingClientRect();
    const cols = 2;
    const filas = Math.ceil(cartas.length / cols);
    const vmin = Math.min(innerWidth, innerHeight) / 100;
    const gap = 1.8 * vmin;
    const largura = Math.floor(Math.min((tb.width - gap) / cols, 420));
    const altura = Math.floor(Math.min((tb.height - gap * (filas - 1)) / filas, 170));
    tabuleiro.style.gridTemplateColumns = `repeat(${cols}, ${largura}px)`;
    tabuleiro.style.gridAutoRows = `${altura}px`;
    const botoes = cartas.map((x) => {
      const b = el("button", { class: "ingrediente etapa" }, [
        img(FIGURAS[ETAPAS[x]], ""),
        el("span", {}, som.texto(`cozinha.e_${x}`).replace(/[.!]$/, "")),
      ]);
      b.dataset.etapa = x;
      b.addEventListener("click", () => tocar(b));
      tabuleiro.append(b);
      return b;
    });

    let ocupado = true;
    let passo = 0;
    let errosSeguidos = 0;
    let ultimoCerto = Date.now();
    let acabar = null;
    const feito = new Promise((r) => { acabar = r; });

    await e.dizer(`cozinha.fazer_${rec.id}`, { cara: CARA_FELIZ });
    if (!ativo) return;
    await e.dizer("cozinha.etapas_ouve");
    if (!ativo) return;
    // Os passos acendem-se no cartão enquanto são lidos, e depois o cartão é tapado.
    for (const [k, x] of etapas.entries()) {
      slots[k].classList.add("lida");
      await e.dizer(`cozinha.e_${x}`);
      if (!ativo) return;
      slots[k].classList.remove("lida");
    }
    await espera(1200);
    if (!ativo) return;
    cartao.classList.add("escondida");
    som.efeito("virar", 0.5);
    await e.dizer(primeiro ? "cozinha.etapas_lembra" : "cozinha.lembra_ordem");
    if (!ativo) return;
    slots[0].classList.add("atual");
    ocupado = false;
    ultimoCerto = Date.now();

    async function pista() {
      st.pistas++;
      errosSeguidos = 0;
      const b = botoes.find((x) => x.dataset.etapa === etapas[passo] && !x.classList.contains("usado"));
      if (!b) return;
      b.classList.remove("pista");
      void b.offsetWidth;
      b.classList.add("pista");
    }

    async function tocar(b) {
      if (ocupado || !ativo || b.classList.contains("usado")) return;
      const x = b.dataset.etapa;
      if (x !== etapas[passo]) {
        const falso = !etapas.includes(x);
        if (falso) { st.errados++; st.passoFalso++; } else st.foraOrdem++;
        ritmo.errado();
        errosSeguidos++;
        ocupado = true;
        abana(b);
        som.efeito("quase", 0.4);
        await e.dizer(falso ? "cozinha.passo_nao" : "cozinha.passo_antes");
        ocupado = false;
        if (errosSeguidos >= 2) await pista();
        return;
      }
      errosSeguidos = 0;
      st.certos++;
      ritmo.certo();
      st.tempos.push(Date.now() - ultimoCerto);
      ultimoCerto = Date.now();
      b.classList.remove("pista");
      voar(b.querySelector("img"), FIGURAS[ETAPAS[x]], panelaImg);
      b.classList.add("usado");
      slots[passo].classList.remove("atual");
      slots[passo].classList.add("posto");
      som.efeito("toque", 0.4);
      plop(panela);
      passo++;
      if (passo >= etapas.length) {
        ocupado = true;
        acabar();
        return;
      }
      slots[passo].classList.add("atual");
      ocupado = true;
      await e.dizer(`cozinha.e_${x}`);
      ocupado = false;
    }

    await feito;
    if (!ativo) return;
    await servir([{ panela, panelaImg }], [cartao], tabuleiro, [rec]);
  }

  comecar();
  return () => terminar(false);
}
