// Adivinhas: uma adivinha portuguesa é lida em voz alta e mostrada em grande; a pessoa toca na
// resposta entre três a seis escolhas. Sobe de adivinhas fáceis com imagens muito diferentes, para
// imagens parecidas, para adivinhas tradicionais, para respostas só em palavras, e no topo
// adivinhas cuja resposta não tem imagem nenhuma ("Quanto mais se tira, maior fica").
// Tocar no cartão da adivinha lê-a outra vez.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { ler, gravar, nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio } from "../ui.js";
import {
  baralhar, estilos, quadrados, retangulos, caberTexto, esperarCerta, criarRitmo, melhorQueAntes,
} from "./escolhas.js";
import { ADIVINHAS, NOMES, figura } from "./adivinhas-lista.js";

// graus: que adivinhas; n: escolhas; perto: distrações parecidas; texto: respostas em palavras; vezes: adivinhas por ronda.
const NIVEIS = [
  { graus: [1], n: 3, vezes: 6 },
  { graus: [1, 2], n: 3, vezes: 6 },
  { graus: [2], n: 4, vezes: 6 },
  { graus: [1, 2], n: 4, perto: true, vezes: 7 },
  { graus: [2, 3], n: 4, perto: true, vezes: 7 },
  { graus: [3], n: 4, perto: true, vezes: 7 },
  { graus: [2, 3], n: 4, perto: true, texto: true, vezes: 7 },
  { graus: [3, 4], n: 4, perto: true, texto: true, vezes: 8 },
  { graus: [4], n: 4, perto: true, texto: true, vezes: 8 },
  { graus: [3, 4], n: 5, perto: true, texto: true, vezes: 8 },
  { graus: [4], n: 6, perto: true, texto: true, vezes: 8 },
];
const CARA_FELIZ = "img/noto/gato_feliz.svg";
const CARA_AMOR = "img/noto/gato_amor.svg";

export const NIVEIS_MAX = NIVEIS.length;

const nomeDe = (r) => r.nome || NOMES[r.resposta];
const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Adivinhas para uma ronda, evitando as últimas ouvidas enquanto houver outras.
function escolher(cfg) {
  const recentes = new Set(ler("adivinhas.recentes", []));
  const todas = ADIVINHAS.filter((r) => cfg.graus.includes(r.grau));
  const lista = [...baralhar(todas.filter((r) => !recentes.has(r.id))),
    ...baralhar(todas.filter((r) => recentes.has(r.id)))].slice(0, cfg.vezes);
  gravar("adivinhas.recentes", [...lista.map((r) => r.id), ...recentes].slice(0, 30));
  return lista;
}

// As escolhas de uma adivinha: [{ chave, figura?, texto?, certa }].
function opcoes(r, cfg) {
  if (cfg.texto) {
    const certa = nomeDe(r);
    const perto = r.grau === 4 ? r.perto : r.perto.map((id) => NOMES[id]);
    // Enchimentos fáceis: coisas do dia a dia das primeiras adivinhas (não o sol, que serve a adivinhas a mais).
    const longe = baralhar(ADIVINHAS.filter((o) => o.grau === 1 && o.resposta !== "sol").map(nomeDe));
    const outras = [];
    for (const s of [...baralhar(perto), ...longe]) {
      if (outras.length < cfg.n - 1 && s && s !== certa && !outras.includes(s)) outras.push(s);
    }
    return baralhar([{ chave: certa, texto: maiuscula(certa), certa: true },
      ...outras.map((s) => ({ chave: s, texto: maiuscula(s), certa: false }))]);
  }
  const fora = new Set([r.resposta, ...r.perto, ...r.evitar]);
  const longe = baralhar(ADIVINHAS.filter((o) => o.resposta && !fora.has(o.resposta)
    && !o.perto.includes(r.resposta)).map((o) => o.resposta));
  const outras = [];
  for (const id of [...(cfg.perto ? baralhar(r.perto) : []), ...longe]) {
    if (outras.length < cfg.n - 1 && !outras.includes(id)) outras.push(id);
  }
  return baralhar([{ chave: r.resposta, figura: figura(r.resposta), certa: true },
    ...outras.map((id) => ({ chave: id, figura: figura(id), certa: false }))]);
}

export function abrir(app, sair) {
  const e = ecra(() => terminar(false));
  e.raiz.classList.add("adivinhas");
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let ritmo = null;

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    if (!completo && ronda) ronda.registar(false);
    som.calar();
    e.raiz.remove();
    sair();
  }

  async function comecar() {
    await estilos("adivinhas");
    if (!ativo) return;
    const n = nivel("adivinhas");
    const cfg = NIVEIS[n - 1];
    const cartao = el("button", { class: "adv-cartao" }, [el("div", { class: "adv-texto" }), img("img/proprio/ouvir.svg", "")]);
    const grade = el("div", { class: "esc-grelha adv-grelha" });
    const zona = el("div", { class: "adv-zona" }, [cartao, grade]);
    e.corpo.replaceChildren(zona);
    const paisagem = e.corpo.clientWidth > e.corpo.clientHeight * 1.1;
    zona.classList.add(paisagem ? "paisagem" : "retrato");
    if (cfg.texto) zona.classList.add("texto");
    const caixa = grade.getBoundingClientRect();
    const lista = escolher(cfg);

    if (ritmo) ritmo.remover();
    ritmo = criarRitmo(e.raiz, lista.length);
    const inicio = Date.now();
    const st = { certas: 0, primeira: 0, erros: 0, pistas: 0, repetir: 0, tempos: [] };

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        const med = metricas.mediana(st.tempos);
        metricas.ronda("adivinhas", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: st.primeira,
          riddles: lista.length,
          answered: st.certas,
          accuracy: st.certas ? Math.round((st.primeira / st.certas) * 100) / 100 : null,
          kind: cfg.texto ? "palavras" : "figuras",
          options: cfg.n,
          wrong_taps: st.erros,
          hints_needed: st.pistas,
          repeats_asked: st.repetir,
          reaction_ms_median: med,
          best_streak: ritmo ? ritmo.melhorSeguidas : 0,
        });
        // Claramente fácil: nenhum toque errado, resposta dada durante ou logo depois de ouvir. Claramente
        // difícil: cerca de um erro por adivinha.
        const facil = completo && st.erros === 0 && (med || 0) < (cfg.texto ? 15000 : 12000);
        // Uma ronda deixada a meio não muda nada (regra de estado.js), por isso só uma ronda acabada pode ser difícil.
        const dificil = completo && (st.erros >= lista.length || st.pistas >= lista.length / 3);
        ajustarNivel("adivinhas", NIVEIS.length, { completo, facil, dificil });
      },
    };

    let atual = null;
    cartao.addEventListener("click", () => {
      if (!atual || !ativo) return;
      st.repetir++;
      som.efeito("toque", 0.4);
      lerAdivinha(atual);
    });
    const textoCartao = cartao.firstChild;
    // Lê a adivinha em voz alta; as palavras estão no cartão grande, o balão diz o que fazer.
    async function lerAdivinha(r) {
      cartao.classList.add("fala");
      await som.falar(`adivinhas.r_${r.id}`);
      cartao.classList.remove("fala");
    }

    await e.dizer(n === 1 ? "adivinhas.instrucao" : cfg.texto ? "adivinhas.palavras_intro" : "adivinhas.vamos");
    if (!ativo) return;

    for (let i = 0; i < lista.length && ativo; i++) {
      const r = lista[i];
      atual = r;
      const ops = opcoes(r, cfg);
      const m = cfg.texto
        ? retangulos(ops.length, caixa.width, caixa.height, 2.2, 130)
        : quadrados(ops.length, caixa.width, caixa.height, 230);
      grade.style.gridTemplateColumns = `repeat(${m.cols}, auto)`;
      const botoes = ops.map((o) => o.texto
        ? el("button", { class: "esc-op palavra", style: { "--larg": `${m.larg}px`, "--alt": `${m.alt}px` } }, o.texto)
        : el("button", { class: "esc-op", style: { "--lado": `${m.lado}px` } }, [img(o.figura, "")]));
      grade.replaceChildren(...botoes);
      if (cfg.texto) botoes.forEach((b) => caberTexto(b, Math.floor(m.alt * 0.36), 16));
      textoCartao.textContent = som.texto(`adivinhas.r_${r.id}`);
      caberTexto(textoCartao, Math.floor(Math.min(cartao.clientHeight * 0.16, cartao.clientWidth * 0.13, 56)), 18);
      cartao.classList.remove("nova");
      void cartao.offsetWidth;
      cartao.classList.add("nova");
      e.mostrar(som.texto(i === 0 ? "adivinhas.ouve" : "adivinhas.outra"));
      lerAdivinha(r);
      const res = await esperarCerta(botoes, botoes[ops.findIndex((o) => o.certa)], {
        ativo: () => ativo,
        aoErrar: (b, k) => {
          st.erros++;
          e.dizer(k >= 2 ? "adivinhas.pista" : som.quase());
        },
      });
      if (!ativo) return;
      atual = null;
      st.certas++;
      if (res.erros === 0) st.primeira++;
      if (res.pista) st.pistas++;
      st.tempos.push(res.ms);
      ritmo.certo(res.erros === 0);
      ritmo.avancar();
      botoes.forEach((b) => { if (!b.classList.contains("certa")) b.classList.add("sai"); });
      await e.dizer(`adivinhas.s_${r.id}`, { cara: res.erros === 0 ? CARA_FELIZ : undefined });
      if (!ativo) return;
      if (i < lista.length - 1 && res.erros === 0 && ritmo.seguidas > 0 && ritmo.seguidas % 3 === 0) {
        await e.dizer(som.elogio(), { cara: CARA_FELIZ });
        if (!ativo) return;
      }
      await espera(400);
      if (!ativo) return;
    }
    if (!ativo) return;

    if (melhorQueAntes("adivinhas", n, st.primeira)) {
      await e.dizer("adivinhas.melhor", { cara: CARA_FELIZ });
      if (!ativo) return;
    }
    await e.dizer("adivinhas.fim", { cara: CARA_AMOR });
    if (!ativo) return;
    ronda.registar(true);
    ronda = null;
    const res = await premio(e, e.raiz);
    if (res === "outra") comecar();
    else terminar(true);
  }

  comecar();
  return () => terminar(false);
}
