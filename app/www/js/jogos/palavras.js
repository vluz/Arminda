// Palavras: uma imagem grande e letras baralhadas; a pessoa toca nas letras por ordem para escrever a palavra.
// Uma letra errada só dá um saltinho. As letras com acento aparecem tal como na palavra.
// Níveis 1 a 6: palavras curtas com imagem. Níveis 7 a 12 (a pedido da família):
// palavras compridas, letras a mais quase iguais, ditado (ouvido, sem imagem), expressões curtas,
// uma palavra meio escrita só com uma pista, e no topo um anagrama só com uma pista.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel, ler, gravar } from "../estado.js";
import { el, img, ecra, espera, premio, estilo, grelha, ALVO_MIN } from "../ui.js";

const entrada = ([id, texto, src = null]) => ({ id, texto, src, letras: [...texto].filter((l) => l !== " "), cat: null });

// A lista original, usada pelos níveis 1 a 6.
const PALAVRAS = [
  ["pao", "PÃO", "img/noto/pao.svg"], ["sol", "SOL", "img/noto/sol.svg"], ["mar", "MAR", "img/noto/mar.svg"],
  ["mel", "MEL", "img/noto/mel.svg"], ["ovo", "OVO", "img/noto/ovo.svg"], ["cao", "CÃO", "img/noto/cao.svg"],
  ["lua", "LUA", "img/noto/lua.svg"], ["cha", "CHÁ", "img/noto/cha.svg"], ["avo", "AVÓ", "img/noto/avo.svg"],
  ["rei", "REI", "img/noto/rei.svg"],
  ["gato", "GATO", "img/noto/gato.svg"], ["casa", "CASA", "img/noto/casa.svg"], ["bolo", "BOLO", "img/noto/bolo.svg"],
  ["flor", "FLOR", "img/noto/girassol.svg"], ["vaca", "VACA", "img/noto/vaca.svg"], ["pato", "PATO", "img/noto/pato.svg"],
  ["rosa", "ROSA", "img/noto/rosa.svg"], ["sapo", "SAPO", "img/noto/sapo.svg"], ["urso", "URSO", "img/noto/urso.svg"],
  ["leao", "LEÃO", "img/noto/leao.svg"], ["maca", "MAÇÃ", "img/noto/maca.svg"], ["pera", "PERA", "img/noto/pera.svg"],
  ["galo", "GALO", "img/proprio/galo.svg"], ["cama", "CAMA", "img/noto/cama.svg"], ["sofa", "SOFÁ", "img/noto/sofa.svg"],
  ["vela", "VELA", "img/noto/vela.svg"], ["uvas", "UVAS", "img/noto/uvas.svg"], ["bebe", "BEBÉ", "img/noto/bebe.svg"],
  ["peixe", "PEIXE", "img/noto/peixe.svg"], ["porco", "PORCO", "img/noto/porco.svg"], ["nuvem", "NUVEM", "img/noto/nuvem.svg"],
  ["chave", "CHAVE", "img/noto/chave.svg"], ["livro", "LIVRO", "img/noto/livro.svg"], ["barco", "BARCO", "img/noto/barco.svg"],
  ["carro", "CARRO", "img/noto/carro.svg"], ["limao", "LIMÃO", "img/noto/limao.svg"], ["leite", "LEITE", "img/noto/leite.svg"],
  ["aviao", "AVIÃO", "img/noto/aviao.svg"], ["cesto", "CESTO", "img/noto/cesto.svg"],
  ["banana", "BANANA", "img/noto/banana.svg"], ["ovelha", "OVELHA", "img/noto/ovelha.svg"],
  ["coelho", "COELHO", "img/noto/coelho.svg"], ["tomate", "TOMATE", "img/noto/tomate.svg"],
  ["cavalo", "CAVALO", "img/noto/cavalo.svg"], ["sapato", "SAPATO", "img/noto/sapato.svg"],
  ["chapeu", "CHAPÉU", "img/noto/chapeu.svg"], ["cereja", "CEREJA", "img/noto/cereja.svg"],
  ["janela", "JANELA", "img/noto/janela.svg"], ["abelha", "ABELHA", "img/noto/abelha.svg"],
  ["laranja", "LARANJA", "img/noto/laranja.svg"], ["galinha", "GALINHA", "img/noto/galinha.svg"],
  ["cenoura", "CENOURA", "img/noto/cenoura.svg"], ["morango", "MORANGO", "img/noto/morango.svg"],
  ["relogio", "RELÓGIO", "img/noto/relogio.svg"], ["comboio", "COMBOIO", "img/noto/comboio.svg"],
  ["cadeira", "CADEIRA", "img/noto/cadeira.svg"], ["coracao", "CORAÇÃO", "img/noto/coracao.svg"],
  ["passaro", "PÁSSARO", "img/noto/passaro.svg"], ["estrela", "ESTRELA", "img/noto/estrela.svg"],
  ["castanha", "CASTANHA", "img/noto/castanha.svg"], ["elefante", "ELEFANTE", "img/noto/elefante.svg"],
  ["telefone", "TELEFONE", "img/noto/telefone.svg"], ["sardinha", "SARDINHA", "img/proprio/sardinha.svg"],
].map(entrada);

// Acrescentadas para os níveis 7 a 12: palavras com imagem, de 6 a 10 letras.
const NOVAS = [
  ["borboleta", "BORBOLETA", "img/noto/borboleta.svg"], ["autocarro", "AUTOCARRO", "img/noto/autocarro.svg"],
  ["melancia", "MELANCIA", "img/noto/melancia.svg"], ["caranguejo", "CARANGUEJO", "img/noto/caranguejo.svg"],
  ["joaninha", "JOANINHA", "img/noto/joaninha.svg"], ["malmequer", "MALMEQUER", "img/noto/malmequer.svg"],
  ["girassol", "GIRASSOL", "img/noto/girassol.svg"], ["chocolate", "CHOCOLATE", "img/noto/chocolate.svg"],
  ["manteiga", "MANTEIGA", "img/noto/manteiga.svg"], ["carrinha", "CARRINHA", "img/noto/carrinha.svg"],
  ["cogumelo", "COGUMELO", "img/noto/cogumelo.svg"], ["princesa", "PRINCESA", "img/noto/princesa.svg"],
  ["principe", "PRÍNCIPE", "img/noto/principe.svg"], ["margarida", "MARGARIDA", "img/proprio/margarida.svg"],
  ["guitarra", "GUITARRA", "img/proprio/guitarra.svg"], ["eletrico", "ELÉTRICO", "img/proprio/eletrico.svg"],
  ["tempestade", "TEMPESTADE", "img/noto/tempestade.svg"], ["talheres", "TALHERES", "img/noto/talheres.svg"],
  ["queijo", "QUEIJO", "img/noto/queijo.svg"], ["batata", "BATATA", "img/noto/batata.svg"],
  ["cebola", "CEBOLA", "img/noto/cebola.svg"], ["pepino", "PEPINO", "img/noto/pepino.svg"],
  ["tulipa", "TULIPA", "img/noto/tulipa.svg"], ["agulha", "AGULHA", "img/noto/agulha.svg"],
  ["ananas", "ANANÁS", "img/noto/ananas.svg"], ["concha", "CONCHA", "img/noto/concha.svg"],
  ["caracol", "CARACOL", "img/noto/caracol.svg"], ["pimento", "PIMENTO", "img/noto/pimento.svg"],
  ["baguete", "BAGUETE", "img/noto/baguete.svg"],
].map(entrada);

// Só ouvidas (ditado): palavras carinhosas do dia a dia, sem imagem.
const OUVIDAS = [
  ["saudade", "SAUDADE"], ["domingo", "DOMINGO"], ["primavera", "PRIMAVERA"], ["alegria", "ALEGRIA"],
  ["carinho", "CARINHO"], ["abraco", "ABRAÇO"], ["familia", "FAMÍLIA"], ["obrigada", "OBRIGADA"],
  ["jardim", "JARDIM"], ["vizinha", "VIZINHA"], ["aniversario", "ANIVERSÁRIO"], ["felicidade", "FELICIDADE"],
  ["amizade", "AMIZADE"], ["sorriso", "SORRISO"], ["parabens", "PARABÉNS"], ["almofada", "ALMOFADA"],
].map(entrada);

// Expressões curtas, ouvidas; no fim aparece uma imagem, quando há.
const EXPRESSOES = [
  ["pao_de_lo", "PÃO DE LÓ"], ["bolo_laranja", "BOLO DE LARANJA"], ["pastel_nata", "PASTEL DE NATA", "img/proprio/pastel_nata.svg"],
  ["batata_frita", "BATATA FRITA", "img/noto/batata_frita.svg"], ["cafe_leite", "CAFÉ COM LEITE"], ["arroz_doce", "ARROZ DOCE"],
  ["caldo_verde", "CALDO VERDE"], ["bom_dia", "BOM DIA"], ["boa_noite", "BOA NOITE"], ["cha_limao", "CHÁ DE LIMÃO"],
  ["sopa_legumes", "SOPA DE LEGUMES"], ["arroz_pato", "ARROZ DE PATO"], ["ovos_moles", "OVOS MOLES"],
  ["feliz_natal", "FELIZ NATAL"], ["escova_dentes", "ESCOVA DE DENTES", "img/noto/escova_dentes.svg"],
].map(entrada);

// Pistas para as palavras meio escritas e para os anagramas.
const CATEGORIAS = {
  fruta: ["banana", "laranja", "cereja", "morango", "melancia", "ananas", "limao"],
  animal: ["cavalo", "ovelha", "coelho", "galinha", "abelha", "elefante", "caracol", "borboleta", "joaninha",
    "caranguejo", "passaro", "sardinha", "peixe", "porco"],
  comer: ["tomate", "cenoura", "chocolate", "manteiga", "queijo", "batata", "cebola", "pepino", "pimento",
    "cogumelo", "baguete", "castanha", "leite"],
  casa: ["cadeira", "janela", "relogio", "telefone", "livro", "chave"],
  transporte: ["autocarro", "comboio", "carrinha", "eletrico", "aviao", "barco", "carro"],
  flor: ["girassol", "malmequer", "margarida", "tulipa"],
  ceu: ["estrela", "nuvem"],
  pessoa: ["princesa", "principe"],
  vestir: ["sapato", "chapeu"],
  musica: ["guitarra"],
};
const TODAS = [...PALAVRAS, ...NOVAS, ...OUVIDAS];
for (const [cat, ids] of Object.entries(CATEGORIAS)) {
  for (const id of ids) TODAS.find((p) => p.id === id).cat = cat;
}
const FONTES = {
  figuras: [...PALAVRAS, ...NOVAS],
  ditado: TODAS,
  expressoes: EXPRESSOES,
  pistas: TODAS.filter((p) => p.cat),
};

// Nível: comprimentos das palavras (letras), primeira letra dada, letras erradas a mais, palavras
// por ronda, duas palavras de cada vez. Níveis 7 e acima: origem das palavras, como se pede
// ("figura" imagem, "ditado" ouvida, "falta" meio escrita com uma pista, "anagrama" só uma pista),
// letras a mais parecidas, letra mais pequena, segundos até uma pista, frase de abertura.
const NIVEIS = [
  { min: 3, max: 3, dada: true, extra: 0, quantas: 5 },
  { min: 4, max: 4, dada: true, extra: 0, quantas: 5 },
  { min: 4, max: 5, dada: false, extra: 0, quantas: 5 },
  { min: 6, max: 8, dada: false, extra: 0, quantas: 4 },
  { min: 5, max: 7, dada: false, extra: 2, quantas: 4 },
  { min: 3, max: 4, dada: false, extra: 2, quantas: 3, duas: true },
  { min: 8, max: 10, extra: 2, quantas: 4, fonte: "figuras", modo: "figura", peca: 90, pista: 30, instr: "palavras.instrucao_longas" },
  { min: 6, max: 9, extra: 4, parecidas: true, quantas: 4, fonte: "figuras", modo: "figura", peca: 90, pista: 30, instr: "palavras.instrucao_parecidas" },
  { min: 6, max: 11, extra: 2, quantas: 4, fonte: "ditado", modo: "ditado", peca: 90, pista: 30, instr: "palavras.instrucao_ditado" },
  { min: 6, max: 14, extra: 1, quantas: 3, fonte: "expressoes", modo: "ditado", peca: 90, pista: 35, instr: "palavras.instrucao_expressao" },
  { min: 6, max: 10, extra: 2, quantas: 4, fonte: "pistas", modo: "falta", peca: 90, pista: 45, instr: "palavras.instrucao_falta" },
  { min: 5, max: 9, extra: 0, quantas: 4, fonte: "pistas", modo: "anagrama", peca: 90, pista: 45, instr: "palavras.instrucao_anagrama" },
];
const EXTRAS = "AEIOURSTLMNCPBDG";
// Letras que se tomam facilmente por outra: acentos, Ç e S, M e N, B e P.
const PARECIDAS = {
  A: "ÁÃÂ", E: "ÉÊ", I: "Í", O: "ÓÕÔ", U: "Ú", Ã: "AÂ", Á: "AÃ", É: "EÊ", Ó: "OÕ", Í: "I", Ú: "U",
  C: "ÇS", Ç: "CS", S: "ZÇ", Z: "S", M: "N", N: "M", B: "P", P: "B", D: "T", T: "D", L: "R", R: "L",
  G: "J", J: "G", V: "F", F: "V", Q: "C", X: "CH", H: "",
};
const PISTA_MS = 20000;

function baralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Palavras meio escritas: um terço das letras fica, o resto é a pessoa que preenche.
const faltam = (n) => n - Math.ceil(n / 3);

// O jogo mede a sua disposição, por isso espera primeiro pela folha de estilos (carregada por estilo).
function estiloPronto(id) {
  const l = document.querySelector(`link[data-jogo="${id}"]`);
  if (!l || l.sheet) return Promise.resolve();
  return new Promise((r) => {
    l.addEventListener("load", r, { once: true });
    l.addEventListener("error", r, { once: true });
    setTimeout(r, 2000);
  });
}

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo("palavras");
  const e = ecra(() => terminar(false));
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let relogio = null;
  let acordar = null;

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    clearInterval(relogio);
    if (!completo && ronda) ronda.registar(false);
    if (acordar) acordar();
    e.raiz.remove();
    sair();
  }

  async function comecar() {
    clearInterval(relogio);
    const n = nivel("palavras");
    const cfg = NIVEIS[n - 1];
    const modo = cfg.modo || "figura";
    const semFigura = modo !== "figura";
    const pecaMin = cfg.peca || ALVO_MIN;
    await estiloPronto("palavras");
    if (!ativo) return;

    // Disposição do ecrã: a imagem ao lado (deitado) ou por cima (ao alto) dos lugares e das letras.
    // Sem imagem, essa caixa tem um botão grande de "ouvir outra vez".
    const mesa = el("div", { class: "palavras" });
    const quadro = el("div", { class: "pal-quadro" });
    const casas = el("div", { class: "pal-casas" });
    const pecas = el("div", { class: "pal-pecas" });
    // Barra de progresso e emblema de série por cima dos lugares.
    const enchimento = el("div", { class: "pal-enche" });
    const selo = el("div", { class: "pal-serie" });
    const progresso = el("div", { class: "pal-progresso" }, [el("div", { class: "pal-barra" }, [enchimento, selo])]);
    mesa.append(quadro, el("div", { class: "pal-lado" }, [progresso, casas, pecas]));
    if (semFigura) mesa.classList.add("sem-figura");
    if (cfg.peca) mesa.classList.add("miuda");
    e.corpo.replaceChildren(mesa);
    const caixa = e.corpo.getBoundingClientRect();
    const paisagem = caixa.width > caixa.height;
    mesa.classList.add(paisagem ? "deitada" : "em-pe");
    const caixaPecas = pecas.getBoundingClientRect();

    // O ecrã limita quantas letras pode haver; saem primeiro as letras erradas, depois as palavras mais compridas.
    const reservaCasas = cfg.fonte === "expressoes" ? 160 : 120;
    // Lado da letra para n letras numa caixa: a melhor grelha, e depois o intervalo do CSS (2.5vmin) e a
    // margem de baixo (1.5vmin) também têm de caber, senão a última fila fica cortada.
    const vmin = Math.min(innerWidth, innerHeight) / 100;
    const ladoPecas = (n, w, h) => {
      const g = grelha(n, w, h, 0.88);
      const lado = Math.floor(Math.min(g.lado, 150,
        (w - 2.5 * vmin * (g.cols - 1)) / g.cols,
        (h - 1.5 * vmin - 2.5 * vmin * (g.linhas - 1)) / g.linhas));
      return { g, lado };
    };
    const cabemPecas = (() => {
      let k = 1;
      while (k < 30 && ladoPecas(k + 1, caixaPecas.width, caixaPecas.height - reservaCasas - (paisagem ? 0 : 110)).lado >= pecaMin) k++;
      return k;
    })();
    const pecasDe = (p) => (modo === "falta" ? faltam(p.letras.length) : p.letras.length - (cfg.dada ? 1 : 0));
    const extra = Math.max(0, Math.min(cfg.extra, cabemPecas - (cfg.duas ? 6 : modo === "falta" ? faltam(cfg.min) : cfg.min)));
    const cabe = (p) => pecasDe(p) + extra <= cabemPecas;
    const fonte = cfg.fonte ? FONTES[cfg.fonte] : PALAVRAS;
    let candidatas = fonte.filter((p) => p.letras.length >= cfg.min && p.letras.length <= cfg.max && cabe(p));
    if (!candidatas.length) candidatas = fonte.filter((p) => cabe(p));
    if (!candidatas.length) candidatas = PALAVRAS.filter((p) => p.letras.length <= 4);

    // Cada item é uma palavra, ou duas palavras seguidas no nível 6.
    const itens = [];
    const usadas = baralhar(candidatas);
    for (let i = 0; i < cfg.quantas && usadas.length; i++) {
      const a = usadas.shift();
      if (cfg.duas) {
        const j = usadas.findIndex((b) => a.letras.length + b.letras.length + extra <= Math.min(8 + extra, cabemPecas));
        if (j >= 0) { itens.push([a, usadas.splice(j, 1)[0]]); continue; }
      }
      itens.push([a]);
    }
    som.preCarregar([...itens.flat().map((p) => `palavras.${p.id}`),
      ...itens.flat().filter((p) => p.cat).map((p) => `palavras.cat_${p.cat}`)]);

    const inicio = Date.now();
    const tempos = [];
    let feitas = 0;
    let erradas = 0;
    let pistas = 0;
    let letrasCertas = 0;
    let ouvidas = 0;
    let serie = 0; // palavras seguidas sem um toque errado
    let melhorSerie = 0;

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        const mediana = metricas.mediana(tempos);
        metricas.ronda("palavras", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: feitas,
          words: itens.flat().length,
          letters_right: letrasCertas,
          wrong_taps: erradas,
          hints_needed: pistas,
          ms_per_word_median: mediana,
          accuracy: letrasCertas + erradas ? Math.round((letrasCertas / (letrasCertas + erradas)) * 100) / 100 : null,
          mode: modo,
          extra_letters: extra,
          replays: ouvidas,
          best_streak: melhorSerie,
        });
        // Claramente fácil: nenhum toque errado, nenhuma pista, e cerca de 2 segundos por letra ou menos.
        // Claramente difícil demais: mais pistas do que palavras, ou mais toques errados do que certos.
        const letrasPorItem = itens.length ? itens.reduce((s, it) => s + it.reduce((t, p) => t + pecasDe(p), 0), 0) / itens.length : 0;
        const facil = completo && erradas === 0 && pistas === 0 && mediana != null && mediana <= 2000 * letrasPorItem + 3000;
        // Uma ronda deixada a meio não muda nada (regra de estado.js), por isso só uma ronda acabada pode ser difícil.
        const dificil = completo && (pistas > itens.length || erradas > letrasCertas);
        ajustarNivel("palavras", NIVEIS.length, { completo, facil, dificil });
      },
    };

    await e.dizer(cfg.instr || (cfg.duas ? "palavras.instrucao_duas" : cfg.dada ? "palavras.instrucao_primeira" : "palavras.instrucao"));
    if (!ativo) return;

    for (const item of itens) {
      if (!ativo) return;
      const t0 = Date.now();
      const p0 = item[0];

      // O que a pessoa ouve ou vê para esta palavra. No ditado a palavra fica fora do balão.
      const ouvir = async () => {
        if (modo === "ditado") {
          e.mostrar(som.texto("palavras.ouve"));
          await som.falar(`palavras.${p0.id}`);
        } else {
          await e.dizer(`palavras.cat_${p0.cat}`);
        }
      };
      if (semFigura) {
        const botao = el("button", { class: "pal-ouvir", "aria-label": "Ouvir outra vez" }, [img("img/proprio/ouvir.svg", "")]);
        botao.addEventListener("click", () => { if (!ativo) return; ouvidas++; som.efeito("toque", 0.4); ouvir(); });
        quadro.replaceChildren(botao);
        quadro.classList.add("com-botao");
      } else {
        quadro.replaceChildren(...item.map((p) => el("div", { class: "pal-figura" }, [img(p.src, "")])));
      }
      quadro.classList.toggle("duas", item.length > 1);

      // Lugares: todas as letras de todas as palavras, com um espaço entre as palavras. As palavras
      // meio escritas mantêm um terço das letras no sítio.
      const precisas = []; // letras ainda por pôr, por ordem, com o seu lugar
      casas.replaceChildren();
      const dadas = new Set();
      if (modo === "falta") {
        const nL = p0.letras.length;
        for (const i of baralhar([...Array(nL).keys()]).slice(0, nL - faltam(nL))) dadas.add(i);
      }
      const grupos = item.flatMap((p) => p.texto.split(" ").map((w) => ({ p, w })));
      const unidades = (gs) => gs.reduce((s, g) => s + g.w.length, 0) + (gs.length - 1) * 0.5;
      const larguraCasas = casas.getBoundingClientRect().width;
      const ladoPara = (u) => Math.floor(Math.min(104, (larguraCasas - 8 * u) / u));
      let ladoCasa = ladoPara(unidades(grupos));
      let corte = -1; // índice da primeira palavra numa segunda linha de lugares
      if (grupos.length > 1 && ladoCasa < 60) {
        for (let k = 1; k < grupos.length; k++) {
          const l = ladoPara(Math.max(unidades(grupos.slice(0, k)), unidades(grupos.slice(k))));
          if (Math.min(l, 72) > ladoCasa) { ladoCasa = Math.min(l, 72); corte = k; }
        }
      }
      casas.style.setProperty("--casa", `${ladoCasa}px`);
      casas.classList.toggle("duas-linhas", corte > 0);
      const contador = new Map(); // índice da letra dentro de cada entrada
      grupos.forEach(({ p, w }, k) => {
        if (k === corte) casas.append(el("div", { class: "pal-quebra" }));
        else if (k > 0) casas.append(el("div", { class: "pal-espaco" }));
        const grupo = el("div", { class: "pal-grupo" });
        [...w].forEach((l) => {
          const i = contador.get(p) || 0;
          contador.set(p, i + 1);
          const casa = el("div", { class: "pal-casa" });
          casa.dataset.letra = l;
          if ((cfg.dada && i === 0) || dadas.has(i)) {
            casa.textContent = l;
            casa.classList.add("dada");
          } else {
            precisas.push({ letra: l, casa });
          }
          grupo.append(casa);
        });
        casas.append(grupo);
      });
      precisas[0].casa.classList.add("proxima");

      // Letras: as que faltam mais umas erradas, baralhadas.
      const naPalavra = new Set(item.flatMap((p) => p.letras));
      let extras = [];
      if (cfg.parecidas) {
        const perto = new Set([...naPalavra].flatMap((l) => [...(PARECIDAS[l] || "")]).filter((l) => !naPalavra.has(l)));
        extras = baralhar([...perto]).slice(0, extra);
      }
      extras = [...extras, ...baralhar([...EXTRAS].filter((l) => !naPalavra.has(l) && !extras.includes(l)))].slice(0, extra);
      const certas = precisas.map((x) => x.letra);
      let letras = baralhar([...certas, ...extras]);
      // Um anagrama nunca pode sair já pela ordem certa.
      for (let t = 0; t < 10 && extras.length === 0 && letras.join("") === certas.join("") && letras.length > 1; t++) letras = baralhar(letras);
      pecas.replaceChildren();
      // Se os lugares deixam pouco espaço para letras do tamanho mínimo do nível, encolher os lugares.
      const medir = () => {
        const cp = pecas.getBoundingClientRect();
        return ladoPecas(letras.length, cp.width, cp.height);
      };
      let { g, lado: ladoPeca } = medir();
      while (ladoPeca < pecaMin && ladoCasa > 40) {
        ladoCasa = Math.max(40, ladoCasa - 6);
        casas.style.setProperty("--casa", `${ladoCasa}px`);
        ({ g, lado: ladoPeca } = medir());
      }
      pecas.style.gridTemplateColumns = `repeat(${g.cols}, ${ladoPeca}px)`;
      pecas.replaceChildren();
      const botoes = letras.map((l) => {
        const b = el("button", { class: "pal-peca", style: { "--lado": `${ladoPeca}px` } }, l);
        b.dataset.letra = l;
        pecas.append(b);
        return b;
      });

      if (semFigura) {
        await ouvir();
        if (!ativo) return;
      }

      // Esperar que a palavra fique escrita.
      let pos = 0;
      let errosAqui = 0;
      let errosPalavra = 0;
      let ultimoToque = Date.now();
      let pistaEm = -1; // letra de que já se deu pista: um jogo deixado aberto não pode contar uma pista a cada 30 s
      const mostrarPista = () => {
        const alvo = botoes.find((b) => !b.classList.contains("usada") && b.dataset.letra === precisas[pos].letra);
        if (!alvo) return;
        alvo.classList.remove("pista");
        void alvo.offsetWidth;
        alvo.classList.add("pista");
        if (pistaEm !== pos) { pistaEm = pos; pistas++; }
      };
      const esperaPista = (cfg.pista || PISTA_MS / 1000) * 1000;
      pecas.dataset.pronto = "1";
      await new Promise((resolver) => {
        acordar = resolver;
        relogio = setInterval(() => {
          if (ativo && Date.now() - ultimoToque > esperaPista) { ultimoToque = Date.now(); mostrarPista(); }
        }, 1000);
        for (const b of botoes) {
          b.addEventListener("click", () => {
            if (!ativo || b.classList.contains("usada") || pos >= precisas.length) return;
            ultimoToque = Date.now();
            const alvo = precisas[pos];
            if (b.dataset.letra === alvo.letra) {
              som.efeito("toque", 0.5);
              b.classList.add("usada");
              botoes.forEach((x) => x.classList.remove("pista"));
              alvo.casa.textContent = alvo.letra;
              alvo.casa.classList.remove("proxima");
              alvo.casa.classList.add("cheia");
              letrasCertas++;
              errosAqui = 0;
              pos++;
              if (pos < precisas.length) precisas[pos].casa.classList.add("proxima");
              else resolver();
            } else {
              erradas++;
              errosAqui++;
              errosPalavra++;
              if (serie) { serie = 0; selo.textContent = ""; selo.classList.remove("viva"); }
              b.classList.remove("errada");
              void b.offsetWidth;
              b.classList.add("errada");
              som.efeito("quase", 0.35);
              if (errosAqui === 3) {
                e.dizer("palavras.ajuda");
                mostrarPista();
              }
            }
          });
        }
      });
      clearInterval(relogio);
      acordar = null;
      pecas.dataset.pronto = "";
      if (!ativo) return;

      feitas += item.length;
      tempos.push(Date.now() - t0);
      casas.classList.add("feita");
      enchimento.style.width = `${Math.round(((itens.indexOf(item) + 1) / itens.length) * 100)}%`;
      if (errosPalavra === 0) {
        serie++;
        melhorSerie = Math.max(melhorSerie, serie);
      }
      // Sem imagem durante o jogo, a imagem (quando há) aparece como prémio.
      if (semFigura && p0.src) {
        quadro.replaceChildren(el("div", { class: "pal-figura" }, [img(p0.src, "")]));
        quadro.classList.remove("com-botao");
      }
      quadro.classList.add("feita");
      // Sininhos a subir para palavras seguidas sem um toque errado.
      som.efeito(serie >= 2 ? `palavras-serie${Math.min(serie - 1, 4)}` : "par");
      if (serie >= 2) {
        selo.textContent = `${serie} seguidas`;
        selo.classList.remove("viva");
        void selo.offsetWidth;
        selo.classList.add("viva");
      }
      for (const p of item) {
        await e.dizer(`palavras.${p.id}`, { cara: "img/noto/gato_feliz.svg" });
        if (!ativo) return;
      }
      if (serie === 3 || serie === 5) {
        await e.dizer(`palavras.serie_${serie}`, { cara: "img/noto/gato_feliz.svg" });
        if (!ativo) return;
      } else if (Math.random() < 0.4) {
        await e.dizer(som.elogio(), { cara: "img/noto/gato_feliz.svg" });
        if (!ativo) return;
      } else {
        await espera(500);
      }
      casas.classList.remove("feita");
      quadro.classList.remove("feita");
    }
    if (!ativo) return;

    await e.dizer("palavras.todas", { cara: "img/noto/gato_amor.svg" });
    if (!ativo) return;
    ronda.registar(true);
    ronda = null;
    // Melhor do que na última ronda acabada neste nível: menos toques errados, ou claramente mais rápido.
    const mediana = metricas.mediana(tempos);
    const antes = ler("palavras.ultima", null);
    gravar("palavras.ultima", { nivel: n, erradas, mediana });
    if (antes && antes.nivel === n && (erradas < antes.erradas
      || (erradas === antes.erradas && mediana != null && antes.mediana != null && mediana < antes.mediana * 0.85))) {
      await e.dizer("palavras.melhor", { cara: "img/noto/gato_amor.svg" });
      if (!ativo) return;
    }
    const r = await premio(e, e.raiz);
    if (r === "outra") comecar();
    else terminar(true);
  }

  comecar();
  return () => terminar(false);
}
