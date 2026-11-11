// O intruso: quatro a seis imagens (ou palavras, no topo), uma não pertence; a pessoa toca nela.
// Depois de cada resposta o gato diz porquê ("A cenoura não é fruta!").
// Sobe de conjuntos óbvios para categorias próximas, depois propriedades, depois palavras, depois
// palavras com duas regras em que o intruso serve a uma delas.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { ler, gravar, nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio } from "../ui.js";
import {
  baralhar, ao, estilos, quadrados, retangulos, caberTexto, esperarCerta, criarRitmo, melhorQueAntes,
} from "./escolhas.js";
import { CONJUNTOS, figura } from "./intruso-conjuntos.js";

// graus: que tipos de conjunto (ver intruso-conjuntos.js); n: botões no ecrã; vezes: conjuntos por ronda.
const NIVEIS = [
  { graus: [1], n: 4, vezes: 8 },
  { graus: [1], n: 5, vezes: 8 },
  { graus: [2], n: 4, vezes: 8 },
  { graus: [2], n: 5, vezes: 8 },
  { graus: [2], n: 6, vezes: 8 },
  { graus: [3], n: 5, vezes: 8 },
  { graus: [2, 3], n: 6, vezes: 8 },
  { graus: [4], n: 4, vezes: 7 },
  { graus: [4], n: 6, vezes: 7 },
  { graus: [5], n: 4, vezes: 7 },
  { graus: [5], n: 5, vezes: 7 },
  { graus: [4, 5], n: 6, vezes: 8 },
];
const PERGUNTAS = ["intruso.qual", "intruso.qual2", "intruso.qual3"];
const CARA_FELIZ = "img/noto/gato_feliz.svg";
const CARA_AMOR = "img/noto/gato_amor.svg";

export const NIVEIS_MAX = NIVEIS.length;

// Conjuntos para uma ronda, evitando os vistos nas últimas rondas enquanto houver outros.
function escolherConjuntos(cfg) {
  const recentes = new Set(ler("intruso.recentes", []));
  const todos = CONJUNTOS.filter((c) => cfg.graus.includes(c.grau));
  const novos = baralhar(todos.filter((c) => !recentes.has(c.id)));
  const lista = [...novos, ...baralhar(todos.filter((c) => recentes.has(c.id)))].slice(0, cfg.vezes);
  gravar("intruso.recentes", [...lista.map((c) => c.id), ...recentes].slice(0, 40));
  return lista;
}

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
    await estilos("intruso");
    if (!ativo) return;
    const n = nivel("intruso");
    const cfg = NIVEIS[n - 1];
    const grade = el("div", { class: "esc-grelha intruso-grelha" });
    e.corpo.replaceChildren(grade);
    const caixa = e.corpo.getBoundingClientRect();
    const conjuntos = escolherConjuntos(cfg);
    const palavras = conjuntos.some((c) => c.palavras);

    if (ritmo) ritmo.remover();
    ritmo = criarRitmo(e.raiz, conjuntos.length);
    const inicio = Date.now();
    const st = { certas: 0, primeira: 0, erros: 0, pistas: 0, tempos: [] };

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        const med = metricas.mediana(st.tempos);
        metricas.ronda("intruso", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: st.primeira,
          sets: conjuntos.length,
          answered: st.certas,
          accuracy: st.certas ? Math.round((st.primeira / st.certas) * 100) / 100 : null,
          kind: palavras ? "palavras" : "figuras",
          options: cfg.n,
          wrong_taps: st.erros,
          hints_needed: st.pistas,
          reaction_ms_median: med,
          best_streak: ritmo ? ritmo.melhorSeguidas : 0,
        });
        // Claramente fácil: nenhum toque errado e respostas rápidas. Claramente difícil: cerca de um erro
        // por conjunto, ou muitas pistas.
        const facil = completo && st.erros === 0 && (med || 0) < (palavras ? 9000 : 6000);
        // Uma ronda deixada a meio não muda nada (regra de estado.js), por isso só uma ronda acabada pode ser difícil.
        const dificil = completo && (st.erros >= conjuntos.length || st.pistas >= conjuntos.length / 3);
        ajustarNivel("intruso", NIVEIS.length, { completo, facil, dificil });
      },
    };

    const duas = cfg.graus.includes(5);
    await e.dizer(n === 1 ? "intruso.instrucao" : duas ? "intruso.duas_intro"
      : palavras ? "intruso.palavras_intro" : "intruso.vamos");
    if (!ativo) return;

    for (let i = 0; i < conjuntos.length && ativo; i++) {
      const c = conjuntos[i];
      const membros = baralhar(c.membros).slice(0, cfg.n - 1);
      const opcoes = baralhar([...membros, c.intruso]);
      const m = c.palavras
        ? retangulos(opcoes.length, caixa.width, caixa.height, 2.6, 140)
        : quadrados(opcoes.length, caixa.width, caixa.height, 260);
      grade.style.gridTemplateColumns = `repeat(${m.cols}, auto)`;
      const botoes = opcoes.map((o) => c.palavras
        ? el("button", { class: "esc-op palavra", style: { "--larg": `${m.larg}px`, "--alt": `${m.alt}px` } }, o)
        : el("button", { class: "esc-op", style: { "--lado": `${m.lado}px` } }, [img(figura(o), "")]));
      grade.replaceChildren(...botoes);
      if (c.palavras) {
        const maximo = Math.floor(m.alt * 0.4);
        botoes.forEach((b) => caberTexto(b, maximo, 16));
      }
      e.dizer(i === 0 ? PERGUNTAS[0] : ao(PERGUNTAS));
      const r = await esperarCerta(botoes, botoes[opcoes.indexOf(c.intruso)], {
        ativo: () => ativo,
        aoErrar: (b, k) => {
          st.erros++;
          e.dizer(k >= 2 ? "intruso.pista" : som.quase());
        },
      });
      if (!ativo) return;
      st.certas++;
      if (r.erros === 0) st.primeira++;
      if (r.pista) st.pistas++;
      st.tempos.push(r.ms);
      ritmo.certo(r.erros === 0);
      ritmo.avancar();
      // Os outros recuam, para o intruso se destacar enquanto o gato diz porquê.
      botoes.forEach((b) => { if (!b.classList.contains("certa")) b.classList.add("sai"); });
      await e.dizer(`intruso.r_${c.id}`, { cara: r.erros === 0 ? CARA_FELIZ : undefined });
      if (!ativo) return;
      await espera(400);
      if (!ativo) return;
    }
    if (!ativo) return;

    if (melhorQueAntes("intruso", n, st.primeira)) {
      await e.dizer("intruso.melhor", { cara: CARA_FELIZ });
      if (!ativo) return;
    }
    await e.dizer("intruso.fim", { cara: CARA_AMOR });
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
