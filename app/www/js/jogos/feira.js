// Feira: compras no mercado. Uma coisa tem um preço; a pessoa paga tocando em moedas e notas.
// Níveis: uma moeda; duas moedas; até três; a mais barata de duas; pagar com uma nota e escolher
// o troco; uma lista de compras de duas coisas com o total; a mesma lista sem o total.
// Níveis mais altos para quem faz bem as compras: pagar com o menor número de moedas e notas;
// troco de 10 ou 20 euros entre opções próximas; promoções ("leve 3, pague 2", metade do preço);
// preços ao quilo; uma lista de 3 ou 4 coisas cujo total a pessoa calcula; que cesto cabe no
// dinheiro que tem; qual de duas bancas é mais barata.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { ler, gravar, nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio, grelha, estilo } from "../ui.js";
import { svg, formatar, decompor } from "./feira-dinheiro.js";

// Coisas nas bancas. Os nomes são ditos como feira.i_<id>.
const ARTIGOS = {
  macas: "img/noto/maca.svg",
  laranjas: "img/noto/laranja.svg",
  pao: "img/noto/pao.svg",
  couve: "img/noto/couve.svg",
  ovos: "img/noto/ovo.svg",
  queijo: "img/noto/queijo.svg",
  tomates: "img/noto/tomate.svg",
  peras: "img/noto/pera.svg",
  uvas: "img/noto/uvas.svg",
  cerejas: "img/noto/cereja.svg",
  melancia: "img/noto/melancia.svg",
  bananas: "img/noto/banana.svg",
  morangos: "img/noto/morango.svg",
  batatas: "img/noto/batata.svg",
  cebolas: "img/noto/cebola.svg",
  mel: "img/noto/mel.svg",
  flores: "img/noto/girassol.svg",
  limoes: "img/noto/limao.svg",
  ananas: "img/noto/ananas.svg",
  sardinhas: "img/proprio/sardinha.svg",
};
// Vendidas ao quilo, e vendidas à unidade (para o "leve 3, pague 2").
const AO_QUILO = ["macas", "laranjas", "tomates", "peras", "uvas", "cerejas", "bananas", "morangos", "batatas", "cebolas", "sardinhas"];
// Preços de mercado credíveis por quilo, em cêntimos (baixo, alto).
const PRECO_KG = {
  cerejas: [300, 600], morangos: [200, 400], uvas: [160, 320], sardinhas: [300, 600], macas: [100, 240],
  laranjas: [80, 200], tomates: [100, 260], peras: [100, 240], bananas: [100, 200], batatas: [60, 160], cebolas: [60, 160],
};
const precoKg = (id) => entre(...PRECO_KG[id], 20);
const A_UNIDADE = ["pao", "couve", "queijo", "melancia", "mel", "flores", "ananas"];

// tipo: como funciona a compra. extra: moedas erradas postas no porta-moedas.
// total: total a correr mostrado no balcão. pecas: moedas que fazem o preço.
const NIVEIS = [
  { tipo: "uma", extra: 2, total: true },
  { tipo: "pagar", pecas: 2, extra: 2, total: true },
  { tipo: "pagar", pecas: 3, extra: 3, total: true },
  { tipo: "barato", pecas: 2, extra: 3, total: true },
  { tipo: "troco", total: true },
  { tipo: "lista", extra: 2, total: false, mostrarSoma: true },
  { tipo: "lista", extra: 3, total: false, mostrarSoma: false },
  // Rondas de dinheiro mais difíceis, para quem é bom com dinheiro.
  { tipo: "menos", total: true },
  { tipo: "troco2", total: true },
  { tipo: "oferta", extra: 3, total: true },
  { tipo: "quilo", extra: 3, total: true },
  { tipo: "lista3", extra: 2, total: true, compras: 5 },
  { tipo: "orcamento" },
  { tipo: "bancas" },
];
const COMPRAS = 6;
const CARA_FELIZ = "img/noto/gato_feliz.svg";
const CARA_AMOR = "img/noto/gato_amor.svg";
const TODAS = [2000, 1000, 500, 200, 100, 50, 20, 10];
// Quilos: mostrados como "½ kg"; ditos pela chave.
const QUILOS = { 0.5: { txt: "½ kg", chave: "meio" }, 1: { txt: "1 kg", chave: "1" }, 1.5: { txt: "1 ½ kg", chave: "1meio" }, 2: { txt: "2 kg", chave: "2" } };

const ao = (lista) => lista[Math.floor(Math.random() * lista.length)];
const entre = (a, b, passo = 10) => a + passo * Math.floor(Math.random() * ((b - a) / passo + 1));
function baralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// k moedas que somam um preço abaixo de 10 €, nunca todas da mesma moeda pequena.
function precoDe(k, opcoes = [10, 20, 50, 100, 200]) {
  for (;;) {
    const s = Array.from({ length: k }, () => ao(opcoes));
    const soma = s.reduce((a, b) => a + b, 0);
    if (soma <= 990 && new Set(s).size > (k > 2 ? 1 : 0)) return { preco: soma, pecas: s };
  }
}

// Moedas erradas para o porta-moedas: de valores diferentes das precisas, quando dá.
function extras(quantos, evitar, opcoes = [10, 20, 50, 100, 200, 500]) {
  const livres = baralhar(opcoes.filter((v) => !evitar.includes(v)));
  const r = [];
  for (let i = 0; i < quantos; i++) r.push(livres[i % livres.length] || ao(opcoes));
  return r;
}

// Peças mais pequenas que fazem o mesmo valor.
const PARTIR = { 2000: [1000, 1000], 1000: [500, 500], 500: [200, 200, 100], 200: [100, 100], 100: [50, 50], 50: [20, 20, 10], 20: [10, 10] };

// Moedas e notas que pagam uma quantia: as menos possíveis, com uma ou duas trocadas em mais pequenas.
function pecasPara(valor, maximo = 6) {
  let p = decompor(valor, TODAS);
  for (let i = 0; i < 2; i++) {
    const k = Math.floor(Math.random() * p.length);
    const novo = PARTIR[p[k]];
    if (novo && p.length - 1 + novo.length <= maximo) p = [...p.slice(0, k), ...novo, ...p.slice(k + 1)];
  }
  return p;
}

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

// Sensação de jogo: uma barra de progresso ao longo da borda de baixo e um emblema de acertos
// seguidos, com uma festa a cada três respostas certas de seguida.
function criarRitmo(raiz, total) {
  const barra = el("div", { class: "feira-barra" }, [el("i")]);
  const selo = el("div", { class: "feira-selo" });
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
      if (seguidas >= 3) {
        selo.textContent = `${seguidas} certas seguidas!`;
        selo.classList.remove("mostra");
        void selo.offsetWidth;
        selo.classList.add("mostra");
        if (seguidas % 3 === 0) som.efeito(seguidas % 6 === 0 ? "vitoria2" : "linha", 0.5);
      }
    },
    errado() { seguidas = 0; },
    remover() { barra.remove(); selo.remove(); },
  };
}

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
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

  const dizerPreco = (c) => e.dizer(`feira.p_${c}`);

  async function comecar() {
    await estiloPronto("feira");
    if (!ativo) return;
    const n = nivel("feira");
    const cfg = NIVEIS[n - 1];
    const compras = cfg.compras || COMPRAS;
    const inicio = Date.now();
    const st = {
      certas: 0, primeira: 0, errados: 0, demais: 0, trocoErrado: 0, baratoErrado: 0, pistas: 0, tempos: [],
      maisPecas: 0, totalErrado: 0, cestoErrado: 0, bancaErrada: 0,
    };
    const usados = new Set();
    if (ritmo) ritmo.remover();
    ritmo = criarRitmo(e.raiz, compras);

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        metricas.ronda("feira", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: st.primeira,
          purchases: st.certas,
          accuracy: st.certas ? Math.round((st.primeira / st.certas) * 100) / 100 : null,
          wrong_taps: st.errados,
          overpays: st.demais,
          change_errors: st.trocoErrado,
          cheapest_errors: st.baratoErrado,
          hints_needed: st.pistas,
          ms_per_purchase_median: metricas.mediana(st.tempos),
          purchase_type: cfg.tipo,
          fewest_coins_errors: st.maisPecas,
          total_errors: st.totalErrado,
          budget_errors: st.cestoErrado,
          stall_errors: st.bancaErrada,
        });
        const erros = st.errados + st.demais + st.trocoErrado + st.baratoErrado + st.maisPecas + st.totalErrado + st.cestoErrado + st.bancaErrada;
        // Claramente fácil: todas as compras certas à primeira, sem pistas (2 pontos). Uma ronda acabada de outra maneira vale 1.
        const facil = completo && st.primeira >= compras && st.pistas === 0;
        // Uma ronda deixada a meio não muda nada (regra de estado.js), por isso só uma ronda acabada pode ser difícil.
        const dificil = completo && (st.pistas >= 2 || erros > compras * 2);
        ajustarNivel("feira", NIVEIS.length, { completo, facil, dificil });
      },
    };

    for (let i = 0; i < compras && ativo; i++) {
      if (cfg.tipo === "orcamento") await orcamento(st, usados, i);
      else if (cfg.tipo === "bancas") await bancas(st, usados, i);
      else await compra(cfg, st, usados, i);
    }
    if (!ativo) return;
    // Melhor do que da última vez neste nível: dizê-lo.
    const antes = ler("feira.ultima", null);
    gravar("feira.ultima", { nivel: n, primeira: st.primeira });
    if (antes && antes.nivel === n && st.primeira > antes.primeira) {
      await e.dizer("feira.melhor", { cara: CARA_FELIZ });
      if (!ativo) return;
    }
    await e.dizer("feira.fim", { cara: CARA_AMOR });
    if (!ativo) return;
    ronda.registar(true);
    ronda = null;
    const r = await premio(e, e.raiz);
    if (r === "outra") comecar();
    else terminar(true);
  }

  function novoArtigo(usados, de = Object.keys(ARTIGOS)) {
    const livres = de.filter((a) => !usados.has(a));
    const a = ao(livres.length ? livres : de);
    usados.add(a);
    return a;
  }

  const nomeArtigo = (id) => som.texto(`feira.i_${id}`).replace(/[.!]$/, "");

  function cartaoArtigo(id, preco, tag = "div") {
    return el(tag, { class: "artigo" }, [
      img(ARTIGOS[id], ""),
      el("div", { class: "nome-artigo" }, nomeArtigo(id)),
      el("div", { class: "etiqueta", "data-preco": preco }, formatar(preco)),
    ]);
  }

  function linhaLista(a) {
    return el("div", { class: "linha-lista" }, [
      img(ARTIGOS[a.id], ""),
      el("span", { class: "nome-artigo" }, nomeArtigo(a.id)),
      el("span", { class: "etiqueta", "data-preco": a.preco }, formatar(a.preco)),
    ]);
  }

  // Um preço dividido em k coisas de pelo menos `minimo` cêntimos cada, em passos de 10 cêntimos.
  function repartir(total, k, minimo = 40) {
    for (let t = 0; t < 200; t++) {
      const cortes = Array.from({ length: k - 1 }, () => 10 * Math.floor(Math.random() * (total / 10)));
      const pontos = [0, ...cortes.sort((a, b) => a - b), total];
      const partes = pontos.slice(1).map((p, i) => p - pontos[i]);
      if (partes.every((p) => p >= minimo && p <= 990)) return partes;
    }
    return null;
  }

  // Uma compra. Resolve quando está paga.
  async function compra(cfg, st, usados, indice) {
    const inicioCompra = Date.now();
    let errosAqui = 0;
    let pistaDada = false;

    // O que comprar e o que há no porta-moedas.
    let preco;
    let carteira;
    let artigos;
    let nota = 500;  // a nota com que a pessoa paga nos níveis de troco
    let minimo = 0;  // o menor número de peças que paga o preço ("menos")
    let oferta = null;
    let quilo = null;
    if (cfg.tipo === "uma") {
      preco = ao([10, 20, 50, 100, 200, 500]);
      carteira = [preco, ...extras(cfg.extra, [preco], [10, 20, 50, 100, 200, 500])];
      artigos = [{ id: novoArtigo(usados), preco }];
    } else if (cfg.tipo === "pagar") {
      const p = precoDe(cfg.pecas, cfg.pecas > 2 ? [10, 20, 50, 100, 200, 500] : [10, 20, 50, 100, 200]);
      preco = p.preco;
      carteira = [...p.pecas, ...extras(cfg.extra, p.pecas)];
      artigos = [{ id: novoArtigo(usados), preco }];
    } else if (cfg.tipo === "barato") {
      let a;
      let b;
      do { a = precoDe(2); b = precoDe(2); } while (Math.abs(a.preco - b.preco) < 30);
      artigos = [{ id: novoArtigo(usados), preco: a.preco, pecas: a.pecas }, { id: novoArtigo(usados), preco: b.preco, pecas: b.pecas }];
    } else if (cfg.tipo === "troco") {
      do { preco = 110 + 10 * Math.floor(Math.random() * 38); } while (preco % 100 === 0);
      // Um par de moedas que não chegam, e a nota.
      const poucas = decompor(Math.floor(preco / 2), [100, 50, 20, 10]).slice(0, 2);
      carteira = [500, ...poucas];
      artigos = [{ id: novoArtigo(usados), preco }];
    } else if (cfg.tipo === "troco2") {
      // Uma nota de 10 € para um preço abaixo de 10 €, uma de 20 € para um entre 10 e 20 €.
      nota = ao([1000, 2000]);
      do { preco = nota === 1000 ? entre(110, 990) : entre(1010, 1990); } while (preco % 100 === 0 || preco % 50 === 0);
      const poucas = decompor(Math.floor(preco / 4), [100, 50, 20, 10]).slice(0, 2);
      carteira = [nota, ...poucas];
      artigos = [{ id: novoArtigo(usados), preco }];
    } else if (cfg.tipo === "menos") {
      // Um preço que precisa de 3 a 5 peças; o porta-moedas tem também peças mais pequenas que fazem o mesmo.
      let d;
      do { preco = entre(130, 990); d = decompor(preco, TODAS); } while (d.length < 3 || d.length > 5);
      minimo = d.length;
      const partidas = baralhar(d.filter((v) => PARTIR[v])).slice(0, 2).flatMap((v) => PARTIR[v]);
      carteira = [...d, ...partidas].slice(0, 9);
      if (carteira.length < 8) carteira.push(...extras(8 - carteira.length, carteira, [10, 20, 50, 100, 200]));
      artigos = [{ id: novoArtigo(usados), preco }];
    } else if (cfg.tipo === "oferta") {
      const id = novoArtigo(usados, A_UNIDADE);
      if (Math.random() < 0.5) {
        const cada = entre(40, 300);
        preco = cada * 2;
        oferta = { tipo: "3", cada };
      } else {
        const antes = entre(100, 800, 20);
        preco = antes / 2;
        oferta = { tipo: "metade", antes };
      }
      const pecas = pecasPara(preco);
      carteira = [...pecas, ...extras(Math.min(cfg.extra, 9 - pecas.length), pecas)];
      artigos = [{ id, preco }];
    } else if (cfg.tipo === "quilo") {
      const id = novoArtigo(usados, AO_QUILO);
      const kg = ao([0.5, 1.5, 2]);
      const porKg = precoKg(id);
      preco = Math.round(porKg * kg);
      quilo = { kg, porKg };
      const pecas = pecasPara(preco);
      carteira = [...pecas, ...extras(Math.min(cfg.extra, 9 - pecas.length), pecas)];
      artigos = [{ id, preco }];
    } else if (cfg.tipo === "lista3") {
      // Três coisas nas primeiras listas, depois quatro.
      const k = indice < 2 ? 3 : 4;
      let partes;
      do { preco = entre(k * 90, k === 3 ? 1200 : 1600); partes = repartir(preco, k); } while (!partes);
      artigos = partes.map((p) => ({ id: novoArtigo(usados), preco: p }));
      const pecas = pecasPara(preco);
      carteira = [...pecas, ...extras(Math.min(cfg.extra, 9 - pecas.length), pecas, [10, 20, 50, 100, 200, 500, 1000])];
    } else {
      const a = precoDe(ao([1, 2]), [50, 100, 200]);
      const b = precoDe(2, [10, 20, 50, 100]);
      preco = a.preco + b.preco;
      carteira = [...a.pecas, ...b.pecas, ...extras(cfg.extra, [...a.pecas, ...b.pecas])];
      artigos = [{ id: novoArtigo(usados), preco: a.preco }, { id: novoArtigo(usados), preco: b.preco }];
    }

    const caixa = e.corpo.getBoundingClientRect();
    const paisagem = caixa.width > caixa.height * 1.1;
    const raiz = el("div", { class: `feira ${paisagem ? "paisagem" : "retrato"}` });
    const banca = el("div", { class: "banca" }, [el("div", { class: "toldo" })]);
    const mostrador = el("div", { class: "mostrador" });
    banca.append(mostrador);
    const balcao = el("div", { class: "balcao" });
    const somaEl = el("div", { class: "soma" });
    const pagos = el("div", { class: "pagos" });
    balcao.append(pagos, somaEl);
    const lado = el("div", { class: "lado-banca" }, [banca, balcao]);
    const bolsa = el("div", { class: "carteira" });
    raiz.append(lado, bolsa);
    e.corpo.replaceChildren(raiz);
    if (!cfg.total) somaEl.classList.add("escondida");

    // Banca: uma coisa, duas para comparar, a lista de compras, uma promoção ou um preço ao quilo.
    let totalEl = null;
    if (cfg.tipo === "lista" || cfg.tipo === "lista3") {
      const lista = el("div", { class: `lista${artigos.length > 3 ? " longa" : ""}` }, [el("div", { class: "titulo-lista" }, "Lista")]);
      for (const a of artigos) lista.append(linhaLista(a));
      totalEl = el("div", { class: "linha-total", "data-preco": preco }, [el("span", {}, "Total"), el("span", { class: "etiqueta" }, formatar(preco))]);
      if (!cfg.mostrarSoma) totalEl.classList.add("escondida");
      lista.append(totalEl);
      mostrador.append(lista);
      mostrador.dataset.preco = preco;
    } else if (oferta) {
      const id = artigos[0].id;
      const figuras = el("div", { class: "figuras" }, (oferta.tipo === "3" ? [1, 2, 3] : [1]).map(() => img(ARTIGOS[id], "")));
      const precos = oferta.tipo === "3"
        ? [el("div", { class: "etiqueta" }, [formatar(oferta.cada), el("small", {}, " cada")]), el("div", { class: "autocolante" }, "Leve 3, pague 2")]
        : [el("div", { class: "etiqueta riscada" }, formatar(oferta.antes)), el("div", { class: "autocolante" }, "Metade do preço")];
      mostrador.append(el("div", { class: `artigo oferta${oferta.tipo === "3" ? " tres" : ""}` }, [figuras, el("div", { class: "precos" }, precos)]));
      mostrador.dataset.preco = preco;
    } else if (quilo) {
      const id = artigos[0].id;
      mostrador.append(el("div", { class: "artigo oferta" }, [
        el("div", { class: "figuras" }, [img(ARTIGOS[id], "")]),
        el("div", { class: "precos" }, [
          el("div", { class: "etiqueta" }, [formatar(quilo.porKg), el("small", {}, " / kg")]),
          el("div", { class: "peso" }, QUILOS[quilo.kg].txt),
        ]),
      ]));
      mostrador.dataset.preco = preco;
    } else if (cfg.tipo !== "barato") {
      mostrador.append(cartaoArtigo(artigos[0].id, preco));
      mostrador.dataset.preco = preco;
    }

    som.preCarregar([...artigos.map((a) => `feira.i_${a.id}`), ...artigos.map((a) => `feira.p_${a.preco}`), preco ? `feira.p_${preco}` : null].filter(Boolean));

    // A mais barata de duas: a pessoa escolhe uma primeiro.
    if (cfg.tipo === "barato") {
      const antesBarato = st.baratoErrado;
      const escolhido = await escolherBarato(artigos, mostrador, st, indice);
      if (!ativo) return;
      // Escolher mal a coisa mais barata também conta como erro nesta compra (não foi certa à primeira).
      errosAqui += st.baratoErrado - antesBarato;
      const a = escolhido;
      preco = a.preco;
      carteira = [...a.pecas, ...extras(cfg.extra, a.pecas)];
      mostrador.replaceChildren(cartaoArtigo(a.id, a.preco));
      mostrador.dataset.preco = preco;
    }

    // Porta-moedas.
    carteira = baralhar(carteira);
    const bb = bolsa.getBoundingClientRect();
    const { cols, lado: ladoG } = grelha(carteira.length, bb.width, bb.height, 0.9);
    const ladoP = Math.min(ladoG, 200);
    bolsa.style.gridTemplateColumns = `repeat(${cols}, ${ladoP}px)`;
    let pago = 0;
    const pagas = [];
    let ocupado = true;
    let fim = null;
    const pronto = new Promise((r) => { fim = r; });

    const botoes = carteira.map((v) => {
      const b = el("button", { class: `dinheiro ${v >= 500 ? "nota" : "moeda"}`, style: { "--lado": `${ladoP}px` }, html: svg(v), "aria-label": formatar(v) });
      b.dataset.valor = v;
      b.addEventListener("click", () => pagar(b));
      bolsa.append(b);
      return b;
    });
    function atualizarSoma() {
      somaEl.replaceChildren(el("span", {}, "Já deste"), el("b", {}, formatar(pago)));
    }
    atualizarSoma();

    // Dizer o que é e quanto custa.
    if (cfg.tipo === "lista" || cfg.tipo === "lista3") {
      await e.dizer(indice === 0 ? "feira.lista" : "feira.lista_outra");
      if (!ativo) return;
      for (const a of artigos) {
        await e.dizer(`feira.i_${a.id}`);
        if (!ativo) return;
        await dizerPreco(a.preco);
        if (!ativo) return;
      }
      if (cfg.tipo === "lista3") {
        // A pessoa calcula primeiro o total, depois paga-o.
        await escolherTotal(preco, st, () => { errosAqui++; });
        if (!ativo) return;
        totalEl.classList.remove("escondida");
        await e.dizer("feira.agora_paga");
      } else if (cfg.mostrarSoma) {
        await e.dizer("feira.total");
        if (!ativo) return;
        await dizerPreco(preco);
      } else {
        await e.dizer("feira.soma_tu");
      }
    } else if (oferta) {
      await e.dizer(`feira.i_${artigos[0].id}`);
      if (!ativo) return;
      await e.dizer(oferta.tipo === "3" ? "feira.cada" : "feira.custava");
      if (!ativo) return;
      await dizerPreco(oferta.tipo === "3" ? oferta.cada : oferta.antes);
      if (!ativo) return;
      if (oferta.tipo === "3") {
        await e.dizer("feira.oferta_3");
        if (!ativo) return;
        await e.dizer("feira.levas_3");
      } else {
        await e.dizer("feira.oferta_metade");
      }
    } else if (quilo) {
      await e.dizer(`feira.i_${artigos[0].id}`);
      if (!ativo) return;
      await e.dizer("feira.o_quilo");
      if (!ativo) return;
      await dizerPreco(quilo.porKg);
      if (!ativo) return;
      await e.dizer(`feira.queres_${QUILOS[quilo.kg].chave}`);
    } else if (cfg.tipo !== "barato") {
      await e.dizer(`feira.i_${artigos[0].id}`);
      if (!ativo) return;
      await dizerPreco(preco);
      if (!ativo) return;
      if (indice === 0) {
        const instr = { uma: "feira.instrucao_uma", troco: "feira.instrucao_troco", troco2: "feira.instrucao_troco2", menos: "feira.instrucao_menos" };
        await e.dizer(instr[cfg.tipo] || "feira.instrucao");
      }
    } else {
      await dizerPreco(preco);
      if (!ativo) return;
      if (indice === 0) await e.dizer("feira.instrucao");
    }
    if (!ativo) return;
    ocupado = false;

    function pista() {
      if (pistaDada) return;
      pistaDada = true;
      st.pistas++;
      // Pôr a piscar um conjunto de moedas que paga certo (ou a nota, quando o que interessa é o troco).
      let alvo = cfg.tipo === "troco" || cfg.tipo === "troco2" ? [nota] : cfg.tipo === "menos" ? menorPagamento(carteira, preco) : solucao(carteira, preco);
      const livres = botoes.filter((b) => !b.classList.contains("usado"));
      for (const v of alvo || []) {
        const b = livres.find((x) => Number(x.dataset.valor) === v && !x.classList.contains("pista"));
        if (b) b.classList.add("pista");
      }
    }

    async function devolver() {
      for (const b of botoes) b.classList.remove("usado");
      pago = 0;
      pagas.length = 0;
      pagos.replaceChildren();
      atualizarSoma();
    }

    async function pagar(b) {
      if (ocupado || !ativo || b.classList.contains("usado")) return;
      const v = Number(b.dataset.valor);
      if (cfg.tipo === "uma" && v !== preco) {
        st.errados++;
        errosAqui++;
        ocupado = true;
        abana(b);
        som.efeito("quase", 0.4);
        await e.dizer(v > preco ? "feira.essa_muito" : "feira.essa_pouco");
        if (!ativo) return;
        if (errosAqui >= 2) pista();
        ocupado = false;
        return;
      }
      b.classList.add("usado");
      b.classList.remove("pista");
      som.efeito(v >= 500 ? "feira-nota" : "feira-moeda", 0.7);
      pago += v;
      pagas.push(v);
      const mini = el("div", { class: `mini ${v >= 500 ? "nota" : "moeda"}`, html: svg(v) });
      pagos.append(mini);
      atualizarSoma();

      if (cfg.tipo === "troco" || cfg.tipo === "troco2") {
        if (pago >= preco) {
          ocupado = true;
          await espera(500);
          if (!ativo) return;
          if (pago > preco) await escolherTroco(pago - preco, st, () => { errosAqui++; }, cfg.tipo === "troco2");
          if (!ativo) return;
          fim();
        }
        return;
      }
      if (pago === preco && cfg.tipo === "menos" && pagas.length > minimo) {
        // Quantia certa, mas com mais peças do que era preciso: de volta ao porta-moedas.
        st.maisPecas++;
        errosAqui++;
        ocupado = true;
        som.efeito("quase", 0.4);
        await e.dizer("feira.menos_nao");
        if (!ativo) return;
        await devolver();
        if (errosAqui >= 2) pista();
        ocupado = false;
      } else if (pago === preco) {
        ocupado = true;
        fim();
      } else if (pago > preco) {
        st.demais++;
        errosAqui++;
        ocupado = true;
        som.efeito("quase", 0.4);
        await e.dizer("feira.demais");
        if (!ativo) return;
        await devolver();
        if (errosAqui >= 2) pista();
        ocupado = false;
      }
    }

    await pronto;
    if (!ativo) return;
    await vendido(mostrador, st, errosAqui === 0 && !pistaDada, inicioCompra);
  }

  async function vendido(mostrador, st, primeira, inicioCompra) {
    st.certas++;
    if (primeira) st.primeira++;
    st.tempos.push(Date.now() - inicioCompra);
    if (primeira) ritmo.certo();
    else ritmo.errado();
    ritmo.avancar();
    mostrador.classList.add("vendido");
    som.efeito("par", 0.6);
    await e.dizer(Math.random() < 0.5 ? "feira.obrigada" : som.elogio(), { cara: CARA_FELIZ });
    if (!ativo) return;
    await espera(600);
  }

  // Duas coisas com preços; a pessoa toca na mais barata. Devolve essa coisa.
  function escolherBarato(artigos, mostrador, st, indice) {
    return new Promise(async (resolver) => {
      const par = el("div", { class: "par-artigos" });
      let ocupado = true;
      const botoes = artigos.map((a) => {
        const b = cartaoArtigo(a.id, a.preco, "button");
        b.classList.add("escolha");
        b.addEventListener("click", async () => {
          if (ocupado || !ativo) return;
          const barato = artigos.reduce((m, x) => (x.preco < m.preco ? x : m));
          if (a === barato) {
            ocupado = true;
            b.classList.add("certo");
            som.efeito("toque", 0.5);
            await e.dizer("feira.barato_certo", { cara: CARA_FELIZ });
            resolver(a);
          } else {
            st.baratoErrado++;
            ocupado = true;
            abana(b);
            som.efeito("quase", 0.4);
            await e.dizer("feira.barato_nao");
            ocupado = false;
          }
        });
        par.append(b);
        return b;
      });
      mostrador.replaceChildren(par);
      mostrador.dataset.precos = artigos.map((a) => a.preco).join(",");
      for (const a of artigos) {
        await e.dizer(`feira.i_${a.id}`);
        if (!ativo) return;
        await dizerPreco(a.preco);
        if (!ativo) return;
      }
      await e.dizer(indice === 0 ? "feira.qual_barato" : "feira.qual_barato2");
      ocupado = false;
      void botoes;
    });
  }

  // Quantias erradas próximas da certa.
  function vizinhos(certo, quantos, desvios) {
    const opcoes = new Set([certo]);
    for (const d of baralhar(desvios)) {
      if (opcoes.size >= quantos + 1) break;
      const v = certo + d;
      if (v > 0 && v <= 2000) opcoes.add(v);
    }
    return baralhar([...opcoes]);
  }

  // O vendedor oferece punhados de troco; a pessoa escolhe o certo.
  // perto: quatro punhados que diferem em pouco, com notas.
  function escolherTroco(certo, st, errou, perto = false) {
    return new Promise(async (resolver) => {
      const opcoes = perto
        ? vizinhos(certo, 3, [-100, 100, -50, 50, -20, 20, -10, 10])
        : vizinhos(certo, 2, [-100, 100, -50, 50, -20, 20, -10, 10, 200]);
      const camada = el("div", { class: `troco${perto ? " perto" : ""}` }, [el("div", { class: "titulo-troco" }, som.texto("feira.qual_troco"))]);
      const fila = el("div", { class: "opcoes-troco" });
      camada.append(fila);
      let ocupado = true;
      for (const v of opcoes) {
        const pecas = decompor(v, perto ? [1000, 500, 200, 100, 50, 20, 10] : [200, 100, 50, 20, 10]);
        const b = el("button", { class: "opcao-troco" }, pecas.map((m) => el("div", { class: `mini ${m >= 500 ? "nota" : "moeda"}`, html: svg(m) })));
        b.dataset.valor = v;
        b.addEventListener("click", async () => {
          if (ocupado || !ativo) return;
          if (v === certo) {
            ocupado = true;
            b.classList.add("certo");
            som.efeito("feira-moeda", 0.7);
            await e.dizer("feira.troco_certo", { cara: CARA_FELIZ });
            if (!ativo) return;
            await dizerPreco(certo);
            camada.remove();
            resolver();
          } else {
            st.trocoErrado++;
            errou();
            ocupado = true;
            abana(b);
            som.efeito("quase", 0.4);
            await e.dizer("feira.troco_nao");
            ocupado = false;
          }
        });
        fila.append(b);
      }
      // Só por cima do porta-moedas, para o preço e o dinheiro dado ficarem à vista.
      (e.corpo.querySelector(".carteira") || e.corpo).append(camada);
      await e.dizer("feira.qual_troco");
      ocupado = false;
    });
  }

  // "Quanto é tudo junto?": três totais próximos por cima do porta-moedas; a pessoa escolhe um.
  function escolherTotal(certo, st, errou) {
    return new Promise(async (resolver) => {
      const opcoes = vizinhos(certo, 2, [-100, 100, -50, 50, -20, 20, -10, 10]);
      const camada = el("div", { class: "troco" }, [el("div", { class: "titulo-troco" }, som.texto("feira.quanto_tudo"))]);
      const fila = el("div", { class: "opcoes-troco" });
      camada.append(fila);
      let ocupado = true;
      for (const v of opcoes) {
        const b = el("button", { class: "opcao-total" }, formatar(v));
        b.dataset.valor = v;
        b.addEventListener("click", async () => {
          if (ocupado || !ativo) return;
          if (v === certo) {
            ocupado = true;
            b.classList.add("certo");
            som.efeito("toque", 0.5);
            await e.dizer("feira.total_certo", { cara: CARA_FELIZ });
            if (!ativo) return;
            await dizerPreco(certo);
            camada.remove();
            resolver();
          } else {
            st.totalErrado++;
            errou();
            ocupado = true;
            abana(b);
            som.efeito("quase", 0.4);
            await e.dizer("feira.total_nao");
            ocupado = false;
          }
        });
        fila.append(b);
      }
      (e.corpo.querySelector(".carteira") || e.corpo).append(camada);
      await e.dizer("feira.quanto_tudo");
      ocupado = false;
    });
  }

  // Uma escolha em ecrã inteiro (cestos para o dinheiro que há, duas bancas). Resolve quando a pessoa escolhe o cartão certo.
  function escolhaGrande(cartoes, certo, aoErrar, aoAcertar, falarAntes) {
    return new Promise(async (resolver) => {
      let ocupado = true;
      cartoes.forEach((b, k) => {
        b.addEventListener("click", async () => {
          if (ocupado || !ativo) return;
          ocupado = true;
          if (k === certo) {
            b.classList.add("certo");
            som.efeito("toque", 0.5);
            await aoAcertar();
            resolver();
          } else {
            abana(b);
            som.efeito("quase", 0.4);
            await aoErrar(b);
            ocupado = false;
          }
        });
      });
      await falarAntes();
      ocupado = false;
    });
  }

  // "Tens 10 euros: que cesto podes pagar?" Três cestos; só um cabe no dinheiro.
  async function orcamento(st, usados, indice) {
    const inicioCompra = Date.now();
    let errosAqui = 0;
    const tens = ao([500, 1000, 1000, 2000]);
    const certo = Math.floor(Math.random() * 3);
    const cestos = [0, 1, 2].map((k) => {
      const total = k === certo ? tens - ao([0, 10, 20, 40, 60, 90, 130]) : tens + ao([10, 20, 30, 50, 80, 120]);
      const n = tens <= 500 ? 2 : ao([2, 3]);
      let partes = repartir(total, n, 30);
      if (!partes) partes = repartir(total, 3, 30) || [total];
      return { total, itens: partes.map((p) => ({ id: novoArtigo(usados), preco: p })) };
    });
    // Coisas diferentes em cada cesto; a ronda recomeça do zero depois disto.
    usados.clear();

    const caixa = e.corpo.getBoundingClientRect();
    const paisagem = caixa.width > caixa.height * 1.1;
    const raiz = el("div", { class: `feira escolher ${paisagem ? "paisagem" : "retrato"}` });
    const dinheiro = el("div", { class: "tens", "data-tens": tens }, [
      el("span", {}, "Tens"),
      el("div", { class: `mini ${tens >= 500 ? "nota" : "moeda"}`, html: svg(tens) }),
    ]);
    const fila = el("div", { class: "opcoes-grandes tres" });
    const cartoes = cestos.map((c) => {
      const b = el("button", { class: "cesto", "data-total": c.total },
        c.itens.map((a) => linhaLista(a)));
      fila.append(b);
      return b;
    });
    raiz.append(dinheiro, fila);
    e.corpo.replaceChildren(raiz);
    raiz.dataset.certo = certo;

    await escolhaGrande(cartoes, certo,
      async () => {
        st.cestoErrado++;
        errosAqui++;
        if (errosAqui === 2) st.pistas++;
        await e.dizer("feira.cesto_nao");
      },
      async () => {
        await e.dizer("feira.cesto_certo", { cara: CARA_FELIZ });
        if (!ativo) return;
        await dizerPreco(cestos[certo].total);
        if (!ativo) return;
        if (tens > cestos[certo].total) {
          await e.dizer("feira.sobram");
          if (!ativo) return;
          await dizerPreco(tens - cestos[certo].total);
        }
      },
      async () => {
        await e.dizer(`feira.tens_${tens / 100}`);
        if (!ativo) return;
        await e.dizer("feira.qual_cesto");
      });
    if (!ativo) return;
    await vendido(fila, st, errosAqui === 0, inicioCompra);
  }

  // Duas bancas vendem a mesma coisa em quantidades diferentes; a pessoa escolhe o quilo mais barato.
  async function bancas(st, usados, indice) {
    const inicioCompra = Date.now();
    let errosAqui = 0;
    const id = novoArtigo(usados, AO_QUILO);
    let a;
    let b;
    for (;;) {
      const [kA, kB] = baralhar([0.5, 1, 1.5, 2]).slice(0, 2);
      const pA = precoKg(id);
      const pB = precoKg(id);
      const dif = Math.abs(pA - pB);
      if (dif < 20 || dif / Math.min(pA, pB) < 0.1) continue;
      a = { kg: kA, porKg: pA, preco: Math.round(pA * kA) };
      b = { kg: kB, porKg: pB, preco: Math.round(pB * kB) };
      // Não quando o quilo mais barato é também, à vista, o preço mais baixo por mais quantidade: é para fazer pensar.
      if (indice > 0 && ((a.porKg < b.porKg) === (a.preco < b.preco)) && Math.random() < 0.6) continue;
      if (a.preco <= 2000 && b.preco <= 2000) break;
    }
    const lados = [{ ...a, cor: "azul" }, { ...b, cor: "verde" }];
    const certo = a.porKg < b.porKg ? 0 : 1;

    const caixa = e.corpo.getBoundingClientRect();
    const paisagem = caixa.width > caixa.height * 1.1;
    const raiz = el("div", { class: `feira escolher ${paisagem ? "paisagem" : "retrato"}` });
    const fila = el("div", { class: "opcoes-grandes duas" });
    const cartoes = lados.map((l) => {
      const bt = el("button", { class: `banca-escolha ${l.cor}`, "data-por-kg": l.porKg }, [
        el("div", { class: "toldo" }),
        el("div", { class: "conteudo" }, [
          img(ARTIGOS[id], ""),
          el("div", { class: "peso" }, QUILOS[l.kg].txt),
          el("div", { class: "etiqueta" }, formatar(l.preco)),
        ]),
      ]);
      fila.append(bt);
      return bt;
    });
    raiz.append(fila);
    e.corpo.replaceChildren(raiz);
    raiz.dataset.certo = certo;

    await escolhaGrande(cartoes, certo,
      async () => {
        st.bancaErrada++;
        errosAqui++;
        if (errosAqui === 2) st.pistas++;
        await e.dizer("feira.banca_nao");
      },
      async () => {
        await e.dizer("feira.banca_certo", { cara: CARA_FELIZ });
        if (!ativo) return;
        await dizerPreco(lados[certo].porKg);
      },
      async () => {
        await e.dizer(`feira.i_${id}`);
        for (const l of lados) {
          if (!ativo) return;
          await e.dizer(`feira.${l.cor}_${QUILOS[l.kg].chave}`);
          if (!ativo) return;
          await dizerPreco(l.preco);
        }
        if (!ativo) return;
        await e.dizer("feira.qual_banca");
      });
    if (!ativo) return;
    await vendido(fila, st, errosAqui === 0, inicioCompra);
  }

  comecar();
  return () => terminar(false);
}

// Um conjunto de valores do porta-moedas que soma exatamente o preço (procura pequena), ou null.
function solucao(carteira, preco) {
  const v = [...carteira].sort((a, b) => b - a);
  let melhor = null;
  (function procurar(i, soma, usadas) {
    if (melhor) return;
    if (soma === preco) { melhor = [...usadas]; return; }
    if (soma > preco || i >= v.length) return;
    usadas.push(v[i]);
    procurar(i + 1, soma + v[i], usadas);
    usadas.pop();
    procurar(i + 1, soma, usadas);
  })(0, 0, []);
  return melhor;
}

// O pagamento certo com o menor número de peças do porta-moedas, ou null.
function menorPagamento(carteira, preco) {
  let melhor = null;
  const v = [...carteira].sort((a, b) => b - a);
  (function procurar(i, soma, usadas) {
    if (soma === preco) { if (!melhor || usadas.length < melhor.length) melhor = [...usadas]; return; }
    if (soma > preco || i >= v.length || (melhor && usadas.length >= melhor.length)) return;
    usadas.push(v[i]);
    procurar(i + 1, soma + v[i], usadas);
    usadas.pop();
    procurar(i + 1, soma, usadas);
  })(0, 0, []);
  return melhor;
}
