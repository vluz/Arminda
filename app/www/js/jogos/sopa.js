// Sopa de letras: encontrar palavras conhecidas numa grelha de letras grandes.
// Para marcar uma palavra, a pessoa toca na primeira letra e depois na última, ou desliza um dedo por ela.
// O deslize encosta-se à linha reta mais próxima, por isso um dedo aos ziguezagues apanha na mesma a fila certa.
// Níveis 1 a 6: palavras curtas, uma grelha pequena, uma lista com imagens e nomes.
// Níveis 7 a 10 (a pedido da família): grelhas maiores com casas mais pequenas (72 px pelo menos),
// palavras mais compridas que se cruzam e partilham letras, palavras quase iguais para enganar
// ("GATA" ao lado de "GATO"), e no topo um tema cuja lista só mostra imagens, depois só o número de palavras.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel, ler, gravar } from "../estado.js";
import { el, img, ecra, espera, premio, estilo } from "../ui.js";

// id, palavra, imagem, temas. O primeiro bloco é a lista original, usada pelos níveis 1 a 6.
const BASICAS = [
  ["pao", "PÃO", "img/noto/pao.svg", "cozinha"], ["sol", "SOL", "img/noto/sol.svg"], ["mar", "MAR", "img/noto/mar.svg"],
  ["mel", "MEL", "img/noto/mel.svg", "cozinha"], ["ovo", "OVO", "img/noto/ovo.svg", "cozinha"], ["cao", "CÃO", "img/noto/cao.svg", "animais"],
  ["lua", "LUA", "img/noto/lua.svg"], ["cha", "CHÁ", "img/noto/cha.svg", "cozinha"], ["avo", "AVÓ", "img/noto/avo.svg"],
  ["avo_homem", "AVÔ", "img/noto/avo_homem.svg"], ["uvas", "UVAS", "img/noto/uvas.svg", "fruta"],
  ["bebe", "BEBÉ", "img/noto/bebe.svg"], ["gato", "GATO", "img/noto/gato.svg", "animais"], ["casa", "CASA", "img/noto/casa.svg"],
  ["bolo", "BOLO", "img/noto/bolo.svg", "cozinha"], ["flor", "FLOR", "img/noto/girassol.svg"], ["vaca", "VACA", "img/noto/vaca.svg", "animais"],
  ["pato", "PATO", "img/noto/pato.svg", "animais"], ["rosa", "ROSA", "img/noto/rosa.svg"], ["sapo", "SAPO", "img/noto/sapo.svg", "animais"],
  ["urso", "URSO", "img/noto/urso.svg", "animais"], ["leao", "LEÃO", "img/noto/leao.svg", "animais"], ["maca", "MAÇÃ", "img/noto/maca.svg", "fruta"],
  ["pera", "PERA", "img/noto/pera.svg", "fruta"], ["galo", "GALO", "img/proprio/galo.svg", "animais"], ["cama", "CAMA", "img/noto/cama.svg", "casa"],
  ["sofa", "SOFÁ", "img/noto/sofa.svg", "casa"], ["vela", "VELA", "img/noto/vela.svg", "casa"], ["peixe", "PEIXE", "img/noto/peixe.svg", "animais"],
  ["porco", "PORCO", "img/noto/porco.svg", "animais"], ["nuvem", "NUVEM", "img/noto/nuvem.svg"], ["chave", "CHAVE", "img/noto/chave.svg", "casa"],
  ["livro", "LIVRO", "img/noto/livro.svg", "casa"], ["barco", "BARCO", "img/noto/barco.svg", "transportes"], ["carro", "CARRO", "img/noto/carro.svg", "transportes"],
  ["limao", "LIMÃO", "img/noto/limao.svg", "fruta"], ["leite", "LEITE", "img/noto/leite.svg", "cozinha"],
];
// Acrescentadas para os níveis 7 a 10.
const NOVAS = [
  ["queijo", "QUEIJO", "img/noto/queijo.svg", "cozinha"], ["arroz", "ARROZ", "img/noto/arroz.svg", "cozinha"],
  ["batata", "BATATA", "img/noto/batata.svg", "cozinha"], ["cebola", "CEBOLA", "img/noto/cebola.svg", "cozinha"],
  ["alho", "ALHO", "img/noto/alho.svg", "cozinha"], ["tomate", "TOMATE", "img/noto/tomate.svg", "cozinha"],
  ["sal", "SAL", "img/noto/sal.svg", "cozinha"], ["cafe", "CAFÉ", "img/noto/cafe.svg", "cozinha"],
  ["manteiga", "MANTEIGA", "img/noto/manteiga.svg", "cozinha"], ["pudim", "PUDIM", "img/noto/pudim.svg", "cozinha"],
  ["couve", "COUVE", "img/noto/couve.svg", "cozinha"], ["milho", "MILHO", "img/noto/milho.svg", "cozinha"],
  ["pepino", "PEPINO", "img/noto/pepino.svg", "cozinha"], ["pimento", "PIMENTO", "img/noto/pimento.svg", "cozinha"],
  ["cenoura", "CENOURA", "img/noto/cenoura.svg", "cozinha"], ["talheres", "TALHERES", "img/noto/talheres.svg", "cozinha"],
  ["banana", "BANANA", "img/noto/banana.svg", "fruta"], ["laranja", "LARANJA", "img/noto/laranja.svg", "fruta"],
  ["cereja", "CEREJA", "img/noto/cereja.svg", "fruta"], ["morango", "MORANGO", "img/noto/morango.svg", "fruta"],
  ["melancia", "MELANCIA", "img/noto/melancia.svg", "fruta"], ["ananas", "ANANÁS", "img/noto/ananas.svg", "fruta"],
  ["cavalo", "CAVALO", "img/noto/cavalo.svg", "animais"], ["ovelha", "OVELHA", "img/noto/ovelha.svg", "animais"],
  ["coelho", "COELHO", "img/noto/coelho.svg", "animais"], ["galinha", "GALINHA", "img/noto/galinha.svg", "animais"],
  ["abelha", "ABELHA", "img/noto/abelha.svg", "animais"], ["elefante", "ELEFANTE", "img/noto/elefante.svg", "animais"],
  ["caracol", "CARACOL", "img/noto/caracol.svg", "animais"], ["polvo", "POLVO", "img/noto/polvo.svg", "animais"],
  ["joaninha", "JOANINHA", "img/noto/joaninha.svg", "animais"], ["passaro", "PÁSSARO", "img/noto/passaro.svg", "animais"],
  ["borboleta", "BORBOLETA", "img/noto/borboleta.svg", "animais"],
  ["cadeira", "CADEIRA", "img/noto/cadeira.svg", "casa"], ["janela", "JANELA", "img/noto/janela.svg", "casa"],
  ["porta", "PORTA", "img/noto/porta.svg", "casa"], ["relogio", "RELÓGIO", "img/noto/relogio.svg", "casa"],
  ["telefone", "TELEFONE", "img/noto/telefone.svg", "casa"],
  ["aviao", "AVIÃO", "img/noto/aviao.svg", "transportes"], ["comboio", "COMBOIO", "img/noto/comboio.svg", "transportes"],
  ["autocarro", "AUTOCARRO", "img/noto/autocarro.svg", "transportes"], ["taxi", "TÁXI", "img/noto/taxi.svg", "transportes"],
  ["carrinha", "CARRINHA", "img/noto/carrinha.svg", "transportes"], ["eletrico", "ELÉTRICO", "img/proprio/eletrico.svg", "transportes"],
];
const entrada = (basica) => ([id, texto, src, temas = ""]) => ({ id, texto, src, letras: [...texto], temas: temas.split(" ").filter(Boolean), basica });
const PALAVRAS = [...BASICAS.map(entrada(true)), ...NOVAS.map(entrada(false))];

// Temas para os níveis de topo: o nome mostrado por cima da lista, e a sua imagem.
const TEMAS = {
  cozinha: { nome: "Cozinha", src: "img/noto/talheres.svg" },
  fruta: { nome: "Fruta", src: "img/noto/maca.svg" },
  animais: { nome: "Animais", src: "img/noto/cao.svg" },
  casa: { nome: "Casa", src: "img/noto/casa.svg" },
  transportes: { nome: "Transportes", src: "img/noto/autocarro.svg" },
};

// Direções como [passo na linha, passo na coluna].
const H = [0, 1], V = [1, 0], HR = [0, -1], VR = [-1, 0], D = [1, 1], DR = [-1, -1], D2 = [-1, 1], D2R = [1, -1];
const TODAS = [H, V, HR, VR, D, DR, D2, D2R];

// Nível: palavras, grelha desejada (linhas x colunas, deitado), direções, segundos preso até uma
// pista, palavra mais comprida. Níveis 7 e acima: casa mais pequena, palavra mais curta, palavras
// que se cruzam, palavras para enganar, tema e estilo da lista ("texto" nomes e imagens, "figuras"
// só imagens, "conta" só quantas são), e "rapido": a mediana do tempo por palavra (ms) abaixo da
// qual uma ronda sem falhas conta como claramente fácil.
const NIVEIS = [
  { palavras: 3, linhas: 4, colunas: 5, dirs: [H], pista: 20, maxLetras: 4, rapido: 12000 },
  { palavras: 4, linhas: 4, colunas: 6, dirs: [H], pista: 25, maxLetras: 5, rapido: 12000 },
  { palavras: 4, linhas: 4, colunas: 6, dirs: [H, V], pista: 25, maxLetras: 5, rapido: 12000 },
  { palavras: 5, linhas: 5, colunas: 7, dirs: [H, V], pista: 30, maxLetras: 5, rapido: 14000 },
  { palavras: 5, linhas: 5, colunas: 8, dirs: [H, V, HR], pista: 35, maxLetras: 5, rapido: 15000 },
  { palavras: 6, linhas: 5, colunas: 9, dirs: [H, V, HR, VR, D, DR, D2], pista: 40, maxLetras: 5, rapido: 15000 },
  { palavras: 6, linhas: 5, colunas: 8, dirs: [H, V, HR, VR], pista: 45, minLetras: 4, maxLetras: 7,
    celula: 80, cruzar: true, rapido: 18000, falas: ["sopa.instrucao_cruzadas"] },
  { palavras: 7, linhas: 6, colunas: 9, dirs: TODAS, pista: 50, minLetras: 4, maxLetras: 8,
    celula: 72, cruzar: true, iscas: 2, rapido: 20000, falas: ["sopa.instrucao_diagonal", "sopa.instrucao_iscas"] },
  { palavras: 7, linhas: 6, colunas: 10, dirs: TODAS, pista: 60, minLetras: 3, maxLetras: 9,
    celula: 72, cruzar: true, iscas: 2, tema: true, lista: "figuras", rapido: 25000 },
  { palavras: 8, linhas: 6, colunas: 10, dirs: TODAS, pista: 60, minLetras: 3, maxLetras: 9,
    celula: 72, cruzar: true, iscas: 2, tema: true, lista: "conta", rapido: 30000 },
];
const CELULA_MIN = 100;
const ENCHER = "AEOSRINDMUTCLPGBV"; // letras de enchimento, comuns em português, sem acentos
const TROCAS = "AEIOSRNLT"; // letras usadas para fazer uma palavra quase igual
const CORES = ["#ffb703", "#2b9348", "#0a6fd6", "#ff4d8d", "#7b2cbf", "#fb8500", "#e63946"];
const NUMEROS = ["", "", "dois", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove"];

function baralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const sorte = (lista) => lista[Math.floor(Math.random() * lista.length)];

// Põe as palavras; devolve null quando não cabem. (Níveis 1 a 6.)
function montar(palavras, linhas, colunas, dirs) {
  const g = Array.from({ length: linhas }, () => Array(colunas).fill(null));
  const lugares = [];
  for (const p of palavras) {
    const n = p.letras.length;
    let posto = null;
    for (let t = 0; t < 300 && !posto; t++) {
      const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
      const r0 = Math.floor(Math.random() * linhas);
      const c0 = Math.floor(Math.random() * colunas);
      const r1 = r0 + dr * (n - 1);
      const c1 = c0 + dc * (n - 1);
      if (r1 < 0 || r1 >= linhas || c1 < 0 || c1 >= colunas) continue;
      let ok = true;
      for (let k = 0; k < n && ok; k++) {
        const x = g[r0 + dr * k][c0 + dc * k];
        if (x !== null && x !== p.letras[k]) ok = false;
      }
      if (ok) posto = { r0, c0, dr, dc };
    }
    if (!posto) return null;
    for (let k = 0; k < n; k++) g[posto.r0 + posto.dr * k][posto.c0 + posto.dc * k] = p.letras[k];
    lugares.push({ ...posto, palavra: p });
  }
  encher(g);
  return { g, lugares, iscas: [] };
}

function encher(g) {
  for (const linha of g) {
    for (let c = 0; c < linha.length; c++) {
      if (linha[c] === null) linha[c] = ENCHER[Math.floor(Math.random() * ENCHER.length)];
    }
  }
}

// Todos os sítios onde uma fila de letras cabe na grelha, com quantas das suas casas já lá estão.
function opcoes(g, letras, dirs) {
  const linhas = g.length, colunas = g[0].length, n = letras.length;
  const out = [];
  for (const [dr, dc] of dirs) {
    for (let r0 = 0; r0 < linhas; r0++) {
      for (let c0 = 0; c0 < colunas; c0++) {
        const r1 = r0 + dr * (n - 1), c1 = c0 + dc * (n - 1);
        if (r1 < 0 || r1 >= linhas || c1 < 0 || c1 >= colunas) continue;
        let ok = true, sob = 0;
        for (let k = 0; k < n && ok; k++) {
          const x = g[r0 + dr * k][c0 + dc * k];
          if (x === null) continue;
          if (x === letras[k]) sob++; else ok = false;
        }
        // Uma palavra pousada toda em letras que já lá estão ficaria escondida duas vezes: nunca.
        if (ok && sob < n) out.push({ r0, c0, dr, dc, sob });
      }
    }
  }
  return out;
}

// Quantas vezes se pode ler uma palavra na grelha, em qualquer direção.
function ocorrencias(g, letras) {
  const linhas = g.length, colunas = g[0].length, n = letras.length;
  let total = 0;
  for (const [dr, dc] of TODAS) {
    for (let r0 = 0; r0 < linhas; r0++) {
      for (let c0 = 0; c0 < colunas; c0++) {
        const r1 = r0 + dr * (n - 1), c1 = c0 + dc * (n - 1);
        if (r1 < 0 || r1 >= linhas || c1 < 0 || c1 >= colunas) continue;
        let ok = true;
        for (let k = 0; k < n && ok; k++) if (g[r0 + dr * k][c0 + dc * k] !== letras[k]) ok = false;
        if (ok) total++;
      }
    }
  }
  const palindromo = letras.join("") === [...letras].reverse().join("");
  return palindromo ? total / 2 : total;
}

// Uma palavra quase igual: uma letra mudada, nunca a primeira ("GATO" dá "GATA" ou "GASO").
function fazerIsca(p, proibidas) {
  for (let t = 0; t < 20; t++) {
    const n = p.letras.length;
    const k = Math.random() < 0.5 ? n - 1 : 1 + Math.floor(Math.random() * (n - 1));
    const nova = sorte([...TROCAS].filter((x) => x !== p.letras[k]));
    const letras = [...p.letras];
    letras[k] = nova;
    const texto = letras.join("");
    if (!proibidas.has(texto) && !proibidas.has([...letras].reverse().join(""))) return letras;
  }
  return null;
}

// Níveis 7 e acima: as palavras cruzam-se onde podem, as palavras para enganar ficam perto da que
// imitam, e cada palavra da lista lê-se exatamente uma vez.
function montarNovo(palavras, linhas, colunas, dirs, { cruzar = false, iscas = 0, evitar = [] }) {
  const g = Array.from({ length: linhas }, () => Array(colunas).fill(null));
  const lugares = [];
  for (const p of palavras) {
    const todas = opcoes(g, p.letras, dirs);
    if (!todas.length) return null;
    const cruzadas = todas.filter((o) => o.sob > 0);
    const posto = sorte(cruzar && cruzadas.length && Math.random() < 0.75 ? cruzadas : todas);
    for (let k = 0; k < p.letras.length; k++) g[posto.r0 + posto.dr * k][posto.c0 + posto.dc * k] = p.letras[k];
    lugares.push({ r0: posto.r0, c0: posto.c0, dr: posto.dr, dc: posto.dc, palavra: p });
  }
  const proibidas = new Set(PALAVRAS.map((p) => p.texto));
  const postas = [];
  const bases = baralhar(palavras.filter((p) => p.letras.length >= 4));
  for (let i = 0; i < iscas && i < bases.length; i++) {
    const base = lugares.find((l) => l.palavra === bases[i]);
    const letras = fazerIsca(base.palavra, proibidas);
    if (!letras) continue;
    const perto = opcoes(g, letras, dirs)
      .map((o) => ({ ...o, d: Math.abs(o.r0 - base.r0) + Math.abs(o.c0 - base.c0) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);
    if (!perto.length) continue;
    const o = sorte(perto);
    for (let k = 0; k < letras.length; k++) g[o.r0 + o.dr * k][o.c0 + o.dc * k] = letras[k];
    postas.push(letras.join(""));
  }
  // Encher, e conferir que nenhuma palavra da lista aparece duas vezes (o enchimento ou uma palavra
  // para enganar podem formar uma por acaso), e que não aparece nenhuma outra palavra do tema quando
  // é preciso encontrar as palavras sem lista.
  const vazio = g.map((l) => [...l]);
  for (let t = 0; t < 30; t++) {
    const tentativa = vazio.map((l) => [...l]);
    encher(tentativa);
    if (palavras.every((p) => ocorrencias(tentativa, p.letras) === 1)
      && evitar.every((p) => ocorrencias(tentativa, p.letras) === 0)) return { g: tentativa, lugares, iscas: postas };
  }
  return null;
}

export const NIVEIS_MAX = NIVEIS.length;
// Só para a jogada automática.
export const DADOS = { PALAVRAS, TEMAS };

export function abrir(app, sair) {
  const css = estilo("sopa");
  const e = ecra(() => terminar(false));
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let relogio = null;

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    clearInterval(relogio);
    if (!completo && ronda) ronda.registar(false);
    e.raiz.remove();
    sair();
  }

  async function comecar() {
    clearInterval(relogio);
    await css;
    if (!ativo) return;
    const n = nivel("sopa");
    const cfg = NIVEIS[n - 1];
    const modoLista = cfg.lista || "texto";
    const celulaMin = cfg.celula || CELULA_MIN;
    const FOLGA = cfg.celula ? 4 : 6; // intervalo entre casas, em px

    // Espaço para a grelha: a lista de palavras fica ao lado (deitado) ou por cima (ao alto).
    const caixa = e.corpo.getBoundingClientRect();
    const paisagem = caixa.width > caixa.height;
    const larguraBase = modoLista === "texto" ? 260 : 200;
    const larguraLista = paisagem ? Math.max(larguraBase, Math.round(caixa.width * (modoLista === "texto" ? 0.25 : 0.18))) : caixa.width;
    const alturaLista = paisagem ? caixa.height : Math.round(Math.min(240, caixa.height * 0.2));
    const areaW = paisagem ? caixa.width - larguraLista - 24 : caixa.width;
    // Ao alto, o balão pode crescer para várias linhas depois de isto ser medido: guardar espaço para ele.
    const areaH = paisagem ? caixa.height : caixa.height - alturaLista - 24 - 110;
    const maxCols = Math.max(3, Math.floor((areaW + FOLGA) / (celulaMin + FOLGA)));
    const maxLinhas = Math.max(3, Math.floor((areaH + FOLGA) / (celulaMin + FOLGA)));
    let [querL, querC] = [cfg.linhas, cfg.colunas];
    if (!paisagem) [querL, querC] = [querC, querL];
    const linhas = Math.min(querL, maxLinhas);
    const colunas = Math.min(querC, maxCols);
    const lado = Math.floor(Math.min((areaW + FOLGA) / colunas, (areaH + FOLGA) / linhas) - FOLGA);

    // Palavras que cabem, num nível que o ecrã deixa; menos palavras se a grelha ficar cheia demais.
    const comprido = Math.max(linhas, colunas);
    const limite = Math.min(cfg.maxLetras, comprido);
    let tema = null;
    if (cfg.tema) {
      // Um tema com palavras suficientes que caibam nesta grelha.
      const bons = Object.keys(TEMAS).filter((t) => PALAVRAS.filter((p) => p.temas.includes(t) && p.letras.length <= limite).length >= cfg.palavras);
      tema = sorte(bons.length ? bons : Object.keys(TEMAS));
    }
    const fonte = PALAVRAS.filter((p) => (cfg.celula ? true : p.basica)
      && p.letras.length <= limite && p.letras.length >= (cfg.minLetras || 1)
      && (!tema || p.temas.includes(tema)));
    let quantas = Math.min(cfg.palavras, Math.floor((linhas * colunas) / (cfg.celula ? 4 : 5)), fonte.length);
    let montagem = null;
    let escolhidas = [];
    const dirsUteis = cfg.dirs.filter(([dr, dc]) => (dr === 0 || linhas >= 3) && (dc === 0 || colunas >= 3));
    while (!montagem && quantas >= 2) {
      for (let t = 0; t < 30 && !montagem; t++) {
        escolhidas = baralhar(fonte).slice(0, quantas);
        // As mais compridas primeiro: são mais fáceis de pôr.
        escolhidas.sort((a, b) => b.letras.length - a.letras.length);
        montagem = cfg.celula
          ? montarNovo(escolhidas, linhas, colunas, dirsUteis, { cruzar: cfg.cruzar, iscas: cfg.iscas || 0, evitar: modoLista === "conta" ? fonte.filter((p) => !escolhidas.includes(p)) : [] })
          : montar(escolhidas, linhas, colunas, dirsUteis);
      }
      if (!montagem) quantas--;
    }
    const { g, lugares } = montagem;
    som.preCarregar(escolhidas.map((p) => `sopa.${p.id}`));

    const inicio = Date.now();
    const tempos = [];
    let ultimoAchado = Date.now();
    let ultimoProgresso = Date.now(); // para o temporizador da pista
    let achadas = 0;
    let erradas = 0;
    let errosSeguidos = 0;
    let pistas = 0;
    let deslizes = 0;
    let toques = 0;
    let cruzamentos = 0;
    let serie = 0; // palavras encontradas de seguida sem uma marcação errada
    let melhorSerie = 0;
    {
      const vistas = new Map();
      for (const l of lugares) {
        for (let k = 0; k < l.palavra.letras.length; k++) {
          const chave = `${l.r0 + l.dr * k},${l.c0 + l.dc * k}`;
          vistas.set(chave, (vistas.get(chave) || 0) + 1);
        }
      }
      for (const v of vistas.values()) if (v > 1) cruzamentos++;
    }

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        const mediana = metricas.mediana(tempos);
        metricas.ronda("sopa", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: achadas,
          words: escolhidas.length,
          grid: `${linhas}x${colunas}`,
          wrong_selections: erradas,
          hints_needed: pistas,
          swipe_marks: deslizes,
          tap_marks: toques,
          ms_per_word_median: mediana,
          accuracy: achadas + erradas ? Math.round((achadas / (achadas + erradas)) * 100) / 100 : null,
          cell_px: lado,
          list_mode: modoLista,
          theme: tema,
          decoys: montagem.iscas.length,
          crossings: cruzamentos,
          best_streak: melhorSerie,
        });
        // Claramente fácil: sem marcações erradas, sem pistas e rápido. Claramente difícil demais: uma pista por palavra.
        const facil = completo && erradas === 0 && pistas === 0 && mediana != null && mediana <= cfg.rapido;
        // Uma ronda deixada a meio não muda nada (regra de estado.js), por isso só uma ronda acabada pode ser difícil.
        const dificil = completo && (pistas >= escolhidas.length || erradas > escolhidas.length * 3);
        ajustarNivel("sopa", NIVEIS.length, { completo, facil, dificil });
      },
    };

    // Lista de palavras: nomes e imagens, só imagens, ou só quantas são.
    const lista = el("div", { class: `sopa-lista lista-${modoLista}` });
    // Barra de progresso e emblema de série, no cimo da lista.
    const enchimento = el("div", { class: "sopa-enche" });
    const selo = el("div", { class: "sopa-serie" });
    lista.append(el("div", { class: "sopa-progresso" }, [el("div", { class: "sopa-barra" }, [enchimento, selo])]));
    const alturaItens = alturaLista - 44;
    const itens = new Map();
    const ordenadas = [...escolhidas].sort((a, b) => a.texto.localeCompare(b.texto, "pt"));
    if (modoLista === "texto") {
      const altItem = paisagem
        ? Math.min(96, Math.floor(alturaItens / escolhidas.length) - 8)
        : Math.min(96, Math.floor(alturaItens / Math.ceil(escolhidas.length / 3)) - 8);
      for (const p of ordenadas) {
        const item = el("div", { class: "sopa-item", style: { "--alt": `${altItem}px` } }, [img(p.src, ""), el("span", {}, p.texto)]);
        lista.append(item);
        itens.set(p.id, item);
      }
    } else if (modoLista === "figuras") {
      const porLinha = paisagem ? 2 : Math.min(escolhidas.length, 5);
      const filas = Math.ceil(escolhidas.length / porLinha);
      const larg = paisagem ? larguraLista : caixa.width;
      const alt = Math.floor(Math.min((larg - 8 * (porLinha - 1)) / porLinha, (alturaItens - 8 * (filas - 1)) / filas, 130));
      lista.style.setProperty("--fig", `${alt}px`);
      lista.style.gridTemplateColumns = `repeat(${porLinha}, ${alt}px)`;
      for (const p of baralhar(escolhidas)) {
        const item = el("div", { class: "sopa-fig" }, [img(p.src, "")]);
        lista.append(item);
        itens.set(p.id, item);
      }
    } else {
      const t = TEMAS[tema];
      const cab = el("div", { class: "sopa-tema" }, [img(t.src, ""), el("span", {}, t.nome)]);
      const conta = el("div", { class: "sopa-conta" }, `0 / ${escolhidas.length}`);
      const vagas = el("div", { class: "sopa-vagas" });
      lista.append(cab, conta, vagas);
      for (let i = 0; i < escolhidas.length; i++) vagas.append(el("div", { class: "sopa-vaga" }, "?"));
      itens.set("conta", conta);
    }

    // A grelha.
    const grelha = el("div", { class: "sopa-grelha", style: { "--lado": `${lado}px` } });
    grelha.style.gridTemplateColumns = `repeat(${colunas}, ${lado}px)`;
    grelha.style.gap = `${FOLGA}px`;
    if (cfg.celula) grelha.classList.add("miuda");
    const faixas = el("div", { class: "sopa-faixas" });
    const celulas = [];
    for (let r = 0; r < linhas; r++) {
      celulas.push([]);
      for (let c = 0; c < colunas; c++) {
        const cel = el("div", { class: "sopa-letra" }, g[r][c]);
        cel.dataset.r = r;
        cel.dataset.c = c;
        grelha.append(cel);
        celulas[r].push(cel);
      }
    }
    grelha.append(faixas);
    const mesa = el("div", { class: `sopa ${paisagem ? "deitada" : "em-pe"}` }, [lista, el("div", { class: "sopa-zona" }, [grelha])]);
    if (paisagem) lista.style.width = `${larguraLista}px`;
    else lista.style.height = `${alturaLista}px`;
    e.corpo.replaceChildren(mesa);

    // Seleção, partilhada pelos toques e pelos deslizes.
    let inicioSel = null; // [r, c] da primeira letra
    let marcadas = [];
    let bloqueado = true;
    const travar = (v) => { bloqueado = v; grelha.dataset.pronto = v ? "" : "1"; };
    let corN = 0;

    function limparMarcas() {
      marcadas.forEach((x) => x.classList.remove("sel"));
      marcadas = [];
    }
    function marcar(cells) {
      limparMarcas();
      marcadas = cells;
      marcadas.forEach((x) => x.classList.add("sel"));
    }
    function linhaEntre([r0, c0], [r1, c1]) {
      const dr = Math.sign(r1 - r0);
      const dc = Math.sign(c1 - c0);
      const passos = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
      if (!(r0 === r1 || c0 === c1 || Math.abs(r1 - r0) === Math.abs(c1 - c0))) return null;
      const out = [];
      for (let k = 0; k <= passos; k++) out.push([r0 + dr * k, c0 + dc * k]);
      return out;
    }

    // Confere as letras ao longo de uma linha com as palavras ainda escondidas, num sentido e no outro.
    // Também tolerante: uma seleção que está em cima de uma palavra escondida e só falha a primeira ou a última letra.
    function celulasDe(l) {
      return l.palavra.letras.map((_, k) => [l.r0 + l.dr * k, l.c0 + l.dc * k]);
    }
    function cobre(l, pos) {
      const n = l.palavra.letras.length;
      if (pos.length < Math.max(2, n - 1)) return false;
      const s = `|${celulasDe(l).map((x) => x.join(",")).join("|")}|`;
      const f = pos.map((x) => x.join(","));
      return s.includes(`|${f.join("|")}|`) || s.includes(`|${[...f].reverse().join("|")}|`);
    }
    async function avaliar(pos, modo) {
      const texto = pos.map(([r, c]) => g[r][c]).join("");
      let lugar = lugares.find((l) => !l.feita
        && (texto === l.palavra.texto || texto === [...l.palavra.letras].reverse().join("")));
      if (!lugar) {
        lugar = lugares.find((l) => !l.feita && cobre(l, pos));
        if (lugar) pos = celulasDe(lugar);
      }
      if (!lugar) {
        limparMarcas();
        erradas++;
        errosSeguidos++;
        serie = 0;
        selo.textContent = "";
        selo.classList.remove("viva");
        som.efeito("quase", 0.4);
        if (errosSeguidos >= 3) {
          errosSeguidos = 0;
          mostrarPista(true);
        } else if (errosSeguidos === 1 || Math.random() < 0.4) {
          travar(true);
          await e.dizer(som.quase());
          travar(false);
        }
        return;
      }
      lugar.feita = true;
      if (modo === "deslize") deslizes++; else toques++;
      achadas++;
      errosSeguidos = 0;
      tempos.push(Date.now() - ultimoAchado);
      ultimoAchado = Date.now();
      ultimoProgresso = Date.now();
      limparMarcas();
      const cor = CORES[corN++ % CORES.length];
      desenharFaixa(pos[0], pos[pos.length - 1], cor);
      pos.forEach(([r, c]) => { celulas[r][c].classList.add("achada"); celulas[r][c].classList.remove("pista"); });
      if (modoLista === "conta") {
        const vaga = lista.querySelectorAll(".sopa-vaga")[achadas - 1];
        vaga.textContent = lugar.palavra.texto;
        vaga.classList.add("feita");
        vaga.style.setProperty("--cor", cor);
        itens.get("conta").textContent = `${achadas} / ${escolhidas.length}`;
      } else {
        const item = itens.get(lugar.palavra.id);
        item.classList.add("feita");
        item.style.setProperty("--cor", cor);
      }
      // Sininhos a subir para palavras seguidas; a barra enche-se.
      serie++;
      melhorSerie = Math.max(melhorSerie, serie);
      som.efeito(serie >= 2 ? `sopa-serie${Math.min(serie - 1, 4)}` : "par");
      enchimento.style.width = `${Math.round((achadas / lugares.length) * 100)}%`;
      if (serie >= 2) {
        selo.textContent = `${serie} seguidas`;
        selo.classList.remove("viva");
        void selo.offsetWidth;
        selo.classList.add("viva");
      }
      travar(true);
      await e.dizer(`sopa.${lugar.palavra.id}`, { cara: "img/noto/gato_feliz.svg" });
      if (!ativo) return;
      if (achadas === lugares.length) {
        clearInterval(relogio);
        await espera(400);
        if (!ativo) return;
        await e.dizer("sopa.todas", { cara: "img/noto/gato_amor.svg" });
        if (!ativo) return;
        ronda.registar(true);
        ronda = null;
        // Melhor do que na última ronda acabada neste nível: menos marcações erradas, ou claramente mais rápido.
        const mediana = metricas.mediana(tempos);
        const antes = ler("sopa.ultima", null);
        gravar("sopa.ultima", { nivel: n, erradas, mediana });
        if (antes && antes.nivel === n && (erradas < antes.erradas
          || (erradas === antes.erradas && mediana != null && antes.mediana != null && mediana < antes.mediana * 0.85))) {
          await e.dizer("sopa.melhor", { cara: "img/noto/gato_amor.svg" });
          if (!ativo) return;
        }
        const r = await premio(e, e.raiz);
        if (r === "outra") comecar();
        else terminar(true);
        return;
      }
      if (serie === 3 || serie === 5) await e.dizer(`sopa.serie_${serie}`, { cara: "img/noto/gato_feliz.svg" });
      else if (Math.random() < 0.3) await e.dizer(som.elogio(), { cara: "img/noto/gato_feliz.svg" });
      travar(false);
    }

    function desenharFaixa([r0, c0], [r1, c1], cor) {
      const passo = lado + FOLGA;
      const x0 = c0 * passo + lado / 2, y0 = r0 * passo + lado / 2;
      const x1 = c1 * passo + lado / 2, y1 = r1 * passo + lado / 2;
      const comp = Math.hypot(x1 - x0, y1 - y0) + lado * 0.86;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      faixas.append(el("div", {
        class: "sopa-faixa",
        style: {
          width: `${comp}px`,
          height: `${lado * 0.78}px`,
          left: `${(x0 + x1) / 2 - comp / 2}px`,
          top: `${(y0 + y1) / 2 - lado * 0.39}px`,
          transform: `rotate(${ang}rad)`,
          background: cor,
        },
      }));
    }

    // Pista: a primeira letra de uma palavra escondida pisca.
    function mostrarPista(contar) {
      const resto = lugares.filter((l) => !l.feita);
      if (!resto.length) return;
      const l = resto[Math.floor(Math.random() * resto.length)];
      const cel = celulas[l.r0][l.c0];
      cel.classList.remove("pista");
      void cel.offsetWidth;
      cel.classList.add("pista");
      if (contar) pistas++;
      ultimoProgresso = Date.now();
      e.dizer("sopa.pista");
    }

    // Tratamento do ponteiro: um deslize que atravessa meia casa é um deslize; senão é um toque.
    const passo = lado + FOLGA;
    let arrasto = null;
    function celulaEm(x, y) {
      const caixaG = grelha.getBoundingClientRect();
      const c = Math.floor((x - caixaG.left) / passo);
      const r = Math.floor((y - caixaG.top) / passo);
      if (r < 0 || r >= linhas || c < 0 || c >= colunas) return null;
      return [r, c];
    }
    const permiteDiagonal = cfg.dirs.some(([dr, dc]) => dr !== 0 && dc !== 0);
    // Encosta o dedo à linha reta permitida mais próxima, a partir da casa de partida.
    function encaixar(origem, x, y) {
      const caixaG = grelha.getBoundingClientRect();
      const cx = caixaG.left + origem[1] * passo + lado / 2;
      const cy = caixaG.top + origem[0] * passo + lado / 2;
      const dx = (x - cx) / passo;
      const dy = (y - cy) / passo;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.5) return [origem];
      const angulo = Math.atan2(dy, dx);
      const fatia = permiteDiagonal ? Math.PI / 4 : Math.PI / 2;
      const a = Math.round(angulo / fatia) * fatia;
      const sr = Math.round(Math.sin(a));
      const sc = Math.round(Math.cos(a));
      // Comprimento ao longo da linha escolhida, pela projeção do dedo nela.
      const proj = (dx * sc + dy * sr) / (sr && sc ? 2 : 1);
      let k = Math.max(0, Math.round(proj));
      while (k > 0) {
        const r = origem[0] + sr * k, c = origem[1] + sc * k;
        if (r >= 0 && r < linhas && c >= 0 && c < colunas) break;
        k--;
      }
      const out = [];
      for (let i = 0; i <= k; i++) out.push([origem[0] + sr * i, origem[1] + sc * i]);
      return out;
    }

    grelha.addEventListener("pointerdown", (ev) => {
      if (bloqueado || !ativo) return;
      const pos = celulaEm(ev.clientX, ev.clientY);
      if (!pos) return;
      ev.preventDefault();
      try { grelha.setPointerCapture(ev.pointerId); } catch { /* não é suportado*/ }
      arrasto = { id: ev.pointerId, origem: pos, linha: [pos], deslizou: false };
      if (!inicioSel) marcar([celulas[pos[0]][pos[1]]]);
    });
    grelha.addEventListener("pointermove", (ev) => {
      if (!arrasto || ev.pointerId !== arrasto.id) return;
      const linha = encaixar(arrasto.origem, ev.clientX, ev.clientY);
      if (linha.length > 1) arrasto.deslizou = true;
      if (!arrasto.deslizou) return;
      arrasto.linha = linha;
      if (inicioSel) inicioSel = null;
      marcar(linha.map(([r, c]) => celulas[r][c]));
    });
    const largar = (ev) => {
      if (!arrasto || ev.pointerId !== arrasto.id) return;
      const a = arrasto;
      arrasto = null;
      if (bloqueado || !ativo) return;
      if (a.deslizou) {
        if (a.linha.length > 1) avaliar(a.linha, "deslize");
        else limparMarcas();
        return;
      }
      tocar(a.origem);
    };
    grelha.addEventListener("pointerup", largar);
    grelha.addEventListener("pointercancel", (ev) => {
      if (arrasto && ev.pointerId === arrasto.id) { arrasto = null; if (!inicioSel) limparMarcas(); }
    });

    // Modo de toque: primeira letra, depois última letra.
    function tocar(pos) {
      som.efeito("toque", 0.4);
      if (!inicioSel) {
        inicioSel = pos;
        marcar([celulas[pos[0]][pos[1]]]);
        return;
      }
      const primeiro = inicioSel;
      inicioSel = null;
      if (primeiro[0] === pos[0] && primeiro[1] === pos[1]) { limparMarcas(); return; }
      const linha = linhaEntre(primeiro, pos);
      if (!linha) {
        // Não está em linha reta: recomeçar a partir desta letra, com simpatia.
        inicioSel = pos;
        marcar([celulas[pos[0]][pos[1]]]);
        return;
      }
      marcar(linha.map(([r, c]) => celulas[r][c]));
      avaliar(linha, "toque");
    }

    // O que o gato diz primeiro.
    let falas;
    if (tema) {
      falas = [`sopa.tema_${tema}`, `sopa.instrucao_${modoLista}`];
      if (modoLista === "conta") falas.push(`sopa.conta_${NUMEROS[escolhidas.length]}`);
    } else if (cfg.falas) {
      falas = cfg.falas;
    } else {
      const instr = cfg.dirs.some(([dr, dc]) => dr !== 0 && dc !== 0) ? "sopa.instrucao_diagonal"
        : cfg.dirs.includes(HR) ? "sopa.instrucao_contrario"
        : cfg.dirs.includes(V) ? "sopa.instrucao_vertical" : "sopa.instrucao";
      falas = instr === "sopa.instrucao" ? [instr] : ["sopa.instrucao", instr];
    }
    for (const f of falas) {
      await e.dizer(f);
      if (!ativo) return;
    }
    travar(false);
    ultimoAchado = Date.now();
    ultimoProgresso = Date.now();

    // Pista depois da espera do nível sem encontrar uma palavra. Uma vez por palavra: um jogo deixado
    // aberto em cima da mesa não pode contar (nem dizer) uma pista por minuto sem ninguém a jogar.
    let achadasNaPista = -1;
    relogio = setInterval(() => {
      if (!ativo || bloqueado || achadasNaPista === achadas) return;
      if (Date.now() - ultimoProgresso > cfg.pista * 1000) {
        ultimoProgresso = Date.now();
        achadasNaPista = achadas;
        mostrarPista(true);
      }
    }, 1000);
  }

  comecar();
  return () => terminar(false);
}
