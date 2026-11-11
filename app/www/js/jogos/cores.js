// Cores: o gato diz uma cor; a pessoa toca nela entre botões grandes.
// Sobe de duas cores simples até seis, depois tons parecidos, depois coisas de uma cor
// ("O que é amarelo?"), depois um Stroop suave: nomes de cores escritos com tinta de outra cor, a
// pedir a palavra ou a tinta, e no topo as duas coisas, à vez.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio } from "../ui.js";
import {
  baralhar, ao, estilos, quadrados, retangulos, caberTexto, esperarCerta, criarRitmo, melhorQueAntes,
} from "./escolhas.js";

// Cores: chave (também o fim do nome da frase dita) e o hexadecimal mostrado.
const COR = {
  vermelho: "#e63946",
  azul: "#0a6fd6",
  amarelo: "#ffd60a",
  verde: "#2b9348",
  roxo: "#7b2cbf",
  laranja: "#ff7b00",
  cor_de_rosa: "#ff7eb6",
  castanho: "#8b5a2b",
  branco: "#ffffff",
  preto: "#1a1a1a",
  azul_claro: "#86cdf9",
  verde_claro: "#9be15d",
  cinzento: "#9e9e9e",
};
const QUATRO = ["vermelho", "azul", "amarelo", "verde"];
const SEIS = [...QUATRO, "roxo", "laranja"];
const DEZ = [...SEIS, "cor_de_rosa", "castanho", "branco", "preto"];
// Famílias de tons parecidos: a cor pedida e as vizinhas partilham um conjunto de botões.
const FAMILIAS = [
  ["vermelho", "cor_de_rosa", "laranja", "roxo"],
  ["azul", "azul_claro", "roxo", "verde"],
  ["verde", "verde_claro", "amarelo", "azul_claro"],
  ["castanho", "laranja", "vermelho", "amarelo"],
  ["branco", "cinzento", "preto", "azul_claro"],
  ["amarelo", "laranja", "verde_claro", "castanho"],
];

// Coisas de uma cor bem clara (imagens Noto).
const N = (id) => `img/noto/${id}.svg`;
const OBJETOS = {
  amarelo: ["banana", "limao", "pintainho_frente", "queijo", "coracao_amarelo", "estrela"],
  vermelho: ["maca", "morango", "tomate", "cereja", "coracao", "joaninha", "telefone", "balao"],
  verde: ["maca_verde", "pepino", "couve", "sapo", "pimento", "coracao_verde", "brocolos", "cato"],
  laranja: ["laranja", "cenoura", "coracao_laranja", "tigre"],
  azul: ["coracao_azul", "gota", "baleia", "calcas", "carrinha", "vestido"],
  roxo: ["uvas", "beringela", "coracao_roxo"],
  cor_de_rosa: ["porco", "flamingo", "flor_cerejeira", "novelo", "sabonete"],
  // Nem o cavalo nem a bota: desenhados em castanho-claro e castanho-alaranjado, ao lado do tigre leem-se como "laranja".
  castanho: ["castanha", "urso", "sapato", "batata"],
  branco: ["ovelha", "nuvem", "dente", "boneco_neve", "rolo_papel"],
};
// Cores fáceis de confundir com cada uma, usadas primeiro no nível mais difícil das "coisas".
const VIZINHAS = {
  amarelo: ["laranja", "castanho", "verde"],
  vermelho: ["cor_de_rosa", "laranja", "roxo"],
  verde: ["azul", "amarelo", "castanho"],
  laranja: ["amarelo", "vermelho", "castanho"],
  azul: ["roxo", "verde", "branco"],
  roxo: ["azul", "cor_de_rosa", "vermelho"],
  cor_de_rosa: ["vermelho", "roxo", "laranja"],
  castanho: ["laranja", "vermelho", "amarelo"],
  branco: ["amarelo", "azul", "cor_de_rosa"],
};
// Tintas para os níveis de palavras: todas legíveis em branco.
const TINTAS = ["vermelho", "azul", "verde", "roxo", "laranja", "preto"];
const PALAVRA = {
  vermelho: "VERMELHO", azul: "AZUL", verde: "VERDE", roxo: "ROXO", laranja: "LARANJA", preto: "PRETO",
};

// tipo: cor (botões simples), tons (tons parecidos), objeto (coisas), stroop (palavras em tinta).
// modo (stroop): palavra = tocar na palavra; tinta = tocar na tinta; alterna = as duas, a mudar.
const NIVEIS = [
  { tipo: "cor", n: 2, de: QUATRO, perguntas: 8 },
  { tipo: "cor", n: 3, de: QUATRO, perguntas: 8 },
  { tipo: "cor", n: 4, de: SEIS, perguntas: 8 },
  { tipo: "cor", n: 6, de: DEZ, perguntas: 10 },
  { tipo: "tons", n: 4, perguntas: 10 },
  { tipo: "tons", n: 6, perguntas: 10 },
  { tipo: "objeto", n: 4, perguntas: 10 },
  { tipo: "objeto", n: 6, perto: true, perguntas: 10 },
  { tipo: "stroop", n: 4, modo: "palavra", perguntas: 10 },
  { tipo: "stroop", n: 4, modo: "tinta", perguntas: 10 },
  { tipo: "stroop", n: 4, modo: "alterna", perguntas: 12 },
  { tipo: "stroop", n: 6, modo: "alterna", perguntas: 12 },
];
// Mediana do tempo de resposta (ms) abaixo da qual uma ronda sem falhas conta como claramente fácil.
const RAPIDO = { cor: 2500, tons: 3000, objeto: 3500, stroop: 4000 };

const CARA_FELIZ = "img/noto/gato_feliz.svg";
const CARA_AMOR = "img/noto/gato_amor.svg";

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

  async function comecar() {
    await estilos("cores");
    if (!ativo) return;
    const n = nivel("cores");
    const cfg = NIVEIS[n - 1];
    const grade = el("div", { class: `esc-grelha cores-grelha ${cfg.tipo}` });
    e.corpo.replaceChildren(grade);
    const caixa = e.corpo.getBoundingClientRect();
    const medida = cfg.tipo === "stroop"
      ? retangulos(cfg.n, caixa.width, caixa.height, 2.6, 150)
      : quadrados(cfg.n, caixa.width, caixa.height, cfg.tipo === "objeto" ? 240 : 280);
    grade.style.gridTemplateColumns = `repeat(${medida.cols}, auto)`;

    if (ritmo) ritmo.remover();
    ritmo = criarRitmo(e.raiz, cfg.perguntas);
    const inicio = Date.now();
    const st = { certas: 0, primeira: 0, erros: 0, pistas: 0, iscas: 0, tempos: [] };

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        const med = metricas.mediana(st.tempos);
        metricas.ronda("cores", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: st.primeira,
          prompts: cfg.perguntas,
          answered: st.certas,
          accuracy: st.certas ? Math.round((st.primeira / st.certas) * 100) / 100 : null,
          kind: cfg.modo ? `stroop_${cfg.modo}` : cfg.tipo,
          options: cfg.n,
          wrong_taps: st.erros,
          lure_taps: st.iscas,
          hints_needed: st.pistas,
          reaction_ms_median: med,
          best_streak: ritmo ? ritmo.melhorSeguidas : 0,
        });
        // Claramente fácil: nenhum toque errado e respostas rápidas. Claramente difícil: um erro na maior
        // parte dos pedidos, ou muitas pistas.
        const facil = completo && st.erros === 0 && (med || 0) < RAPIDO[cfg.tipo];
        // Uma ronda deixada a meio não muda nada (regra de estado.js), por isso só uma ronda acabada pode ser difícil.
        const dificil = completo && (st.erros >= cfg.perguntas * 0.6 || st.pistas >= cfg.perguntas / 3);
        ajustarNivel("cores", NIVEIS.length, { completo, facil, dificil });
      },
    };

    // Frases de abertura: o que fazer neste nível.
    await e.dizer(n === 1 ? "cores.instrucao" : cfg.tipo === "cor" ? "cores.vamos"
      : cfg.tipo === "tons" ? "cores.tons" : cfg.tipo === "objeto" ? "cores.objetos"
      : cfg.modo === "palavra" ? "cores.modo_palavra_intro"
      : cfg.modo === "tinta" ? "cores.modo_tinta_intro" : "cores.alterna_intro");
    if (!ativo) return;

    let anterior = null;
    let modoAnterior = null;
    let mesmoModo = 0;
    for (let i = 0; i < cfg.perguntas && ativo; i++) {
      // Modo Stroop deste pedido: os níveis que alternam mudam-no ao acaso, nunca mais de três iguais seguidos.
      let modo = cfg.modo;
      if (modo === "alterna") {
        modo = modoAnterior && mesmoModo < 3 && Math.random() < 0.5 ? modoAnterior
          : modoAnterior ? (modoAnterior === "palavra" ? "tinta" : "palavra") : ao(["palavra", "tinta"]);
        if (modoAnterior && modo !== modoAnterior) {
          await e.dizer(modo === "palavra" ? "cores.muda_palavra" : "cores.muda_tinta");
          if (!ativo) return;
        }
        mesmoModo = modo === modoAnterior ? mesmoModo + 1 : 1;
        modoAnterior = modo;
      }
      const p = montar(cfg, modo, anterior, medida);
      anterior = p.alvo;
      grade.replaceChildren(...p.botoes);
      if (cfg.tipo === "stroop") {
        const maximo = Math.floor(medida.alt * 0.36);
        p.botoes.forEach((b) => caberTexto(b, maximo, 16));
      }
      e.dizer(p.linha);
      const r = await esperarCerta(p.botoes, p.certa, {
        ativo: () => ativo,
        aoErrar: (b, k) => {
          st.erros++;
          if (b === p.isca) {
            st.iscas++;
            e.dizer(modo === "tinta" ? "cores.isca_tinta" : "cores.isca_palavra");
          } else if (k >= 2) e.dizer("cores.pista");
          else e.dizer(som.quase());
        },
      });
      if (!ativo) return;
      salpico(e.raiz, p.certa, COR[p.alvo]);
      st.certas++;
      if (r.erros === 0) st.primeira++;
      if (r.pista) st.pistas++;
      st.tempos.push(r.ms);
      ritmo.certo(r.erros === 0);
      ritmo.avancar();
      await espera(700);
      if (!ativo) return;
      if (i < cfg.perguntas - 1 && r.erros === 0 && ritmo.seguidas > 0 && ritmo.seguidas % 4 === 0) {
        await e.dizer(r.ms < 1500 ? "geral.rapidez" : som.elogio(), { cara: CARA_FELIZ });
        if (!ativo) return;
      }
    }
    if (!ativo) return;

    if (melhorQueAntes("cores", n, st.primeira)) {
      await e.dizer("cores.melhor", { cara: CARA_FELIZ });
      if (!ativo) return;
    }
    await e.dizer("cores.fim", { cara: CARA_AMOR });
    if (!ativo) return;
    ronda.registar(true);
    ronda = null;
    const r = await premio(e, e.raiz);
    if (r === "outra") comecar();
    else terminar(true);
  }

  comecar();
  return () => terminar(false);
}

const SPLATS = ["00", "03", "05", "06", "08", "12", "13", "15", "16", "17", "22", "23"];

// Uma resposta certa: uma grande mancha da cor salta do botão, com um chape suave.
function salpico(raiz, botao, cor) {
  const r = botao.getBoundingClientRect();
  const lado = Math.max(r.width, r.height) * 1.6;
  const s = el("i", {
    class: "cores-salpico",
    style: {
      "--mascara": `url(../../img/jogos/cores-splat${ao(SPLATS)}.png)`,
      background: cor,
      left: `${r.left + r.width / 2 - lado / 2}px`,
      top: `${r.top + r.height / 2 - lado / 2}px`,
      width: `${lado}px`,
      height: `${lado}px`,
      "--rodar": `${Math.floor(Math.random() * 360)}deg`,
    },
  });
  raiz.append(s);
  som.efeito("cores-splat", 0.8);
  setTimeout(() => s.remove(), 900);
}

// Um pedido: os botões, o certo, um engodo opcional (Stroop) e a frase a dizer.
function montar(cfg, modo, anterior, medida) {
  const quadrado = (conteudo, estilo) => el("button", {
    class: "esc-op", style: { "--lado": `${medida.lado}px`, ...estilo },
  }, conteudo);

  if (cfg.tipo === "cor" || cfg.tipo === "tons") {
    let cores;
    let alvo;
    if (cfg.tipo === "cor") {
      cores = baralhar(cfg.de).slice(0, cfg.n);
      alvo = ao(cores.filter((c) => c !== anterior));
    } else {
      // Uma família de tons parecidos, completada com outras cores quando o nível quer mais botões.
      const fam = ao(FAMILIAS.filter((f) => f[0] !== anterior));
      alvo = fam[0];
      const outros = baralhar(Object.keys(COR).filter((c) => !fam.includes(c)));
      cores = baralhar([...fam.slice(0, cfg.n), ...outros].slice(0, cfg.n));
    }
    // Cada cor é uma mancha de tinta (Kenney Splat Pack, CC0): uma mancha escura por trás dá o
    // contorno grosso, a de cor fica por cima. Uma forma diferente em cada botão.
    const formas = baralhar(SPLATS);
    const botoes = cores.map((c, k) => {
      const mascara = `url(../../img/jogos/cores-splat${formas[k % formas.length]}.png)`;
      const b = quadrado([
        el("i", { class: "splat-borda", style: { "--mascara": mascara } }),
        el("i", { class: "splat-cor", style: { "--mascara": mascara, background: COR[c] } }),
      ]);
      b.classList.add("amostra");
      b.dataset.cor = c;
      return b;
    });
    return { botoes, certa: botoes[cores.indexOf(alvo)], alvo, linha: `cores.c_${alvo}` };
  }

  if (cfg.tipo === "objeto") {
    const alvo = ao(Object.keys(OBJETOS).filter((c) => c !== anterior));
    let outras = baralhar(Object.keys(OBJETOS).filter((c) => c !== alvo));
    if (cfg.perto) outras = [...baralhar(VIZINHAS[alvo]), ...outras.filter((c) => !VIZINHAS[alvo].includes(c))];
    const cores = baralhar([alvo, ...outras.slice(0, cfg.n - 1)]);
    const botoes = cores.map((c) => {
      const b = quadrado([img(N(ao(OBJETOS[c])), "")]);
      b.dataset.cor = c;
      return b;
    });
    return { botoes, certa: botoes[cores.indexOf(alvo)], alvo, linha: `cores.o_${alvo}` };
  }

  // Stroop: n nomes de cores, cada um numa tinta que nunca é a sua cor. A cor pedida aparece uma
  // vez como palavra e uma vez como tinta, em botões diferentes; a outra é o engodo.
  const palavras = baralhar(TINTAS).slice(0, cfg.n);
  let tintas;
  do { tintas = baralhar(palavras); } while (tintas.some((t, k) => t === palavras[k]));
  const alvo = ao(palavras.filter((c) => c !== anterior));
  const botoes = palavras.map((p, k) => {
    const b = el("button", {
      class: "esc-op palavra stroop",
      style: { "--larg": `${medida.larg}px`, "--alt": `${medida.alt}px`, color: COR[tintas[k]] },
    }, PALAVRA[p]);
    b.dataset.palavra = p;
    b.dataset.tinta = tintas[k];
    return b;
  });
  const iPalavra = palavras.indexOf(alvo);
  const iTinta = tintas.indexOf(alvo);
  const [certa, isca] = modo === "palavra" ? [iPalavra, iTinta] : [iTinta, iPalavra];
  return {
    botoes, certa: botoes[certa], isca: botoes[isca], alvo,
    linha: modo === "palavra" ? `cores.p_${alvo}` : `cores.t_${alvo}`,
  };
}
