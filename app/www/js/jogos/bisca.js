// Bisca (Bisca de Três) a dois: a pessoa joga contra a Rosa, uma vizinha simpática do computador.
// Regras: baralho português de 40 cartas, 3 cartas a cada um, a carta seguinte mostra o trunfo e é
// a última a ser tirada. Não é preciso assistir ao naipe. No mesmo naipe ganha a carta mais alta;
// um trunfo ganha a qualquer outro naipe; senão ganha a primeira carta. Quem ganha a vaza tira
// primeiro e joga primeiro a seguir. Ás 11, Sete 10, Rei 4, Valete 3, Dama 2.
// 61 ou mais dos 120 pontos ganha; 60 a cada um é empate.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio, estilo, ALVO_MIN } from "../ui.js";
import * as K from "./cartas.js";

// pista: true = a carta boa brilha logo, um número = ao fim desses ms, null = nunca.
// fraco: probabilidade de a Rosa jogar uma carta fraca (bondosa: uma que dá pontos, senão uma ao
// acaso). placar: pontuação à vista no ecrã. Em simulação, seguindo sempre a pista, a pessoa
// ganha cerca de 80% no nível 1, 75% no 2, 60% no 3, 55% no 4 e 48% no 6.
const NIVEIS = [
  { pista: true, fraco: 0.7, bondosa: true, placar: true },
  { pista: true, fraco: 0.45, bondosa: true, placar: true },
  { pista: 9000, fraco: 0.35, placar: true },
  { pista: null, fraco: 0.2, placar: true },
  { pista: null, fraco: 0.08, placar: false },
  { pista: null, fraco: 0, placar: false },
];

const AMIGA = { nome: "Rosa", cara: "img/noto/idosa.svg" };

// A segunda carta ganha à primeira (a de saída)?
export function ganhaSegunda(a, b, trunfo) {
  if (b.naipe === a.naipe) return K.forca(b) > K.forca(a);
  return b.naipe === trunfo;
}

const porPouco = (a, b) => K.pontos(a) - K.pontos(b) || K.forca(a) - K.forca(b);

// Uma carta sensata: guardar pontos e trunfos, apanhar pontos por pouco, deitar fora o que não presta.
export function boaJogada(mao, lider, trunfo) {
  const normais = mao.filter((c) => c.naipe !== trunfo).sort(porPouco);
  const trunfos = mao.filter((c) => c.naipe === trunfo).sort((a, b) => K.forca(a) - K.forca(b));
  if (!lider) {
    if (normais.length && K.pontos(normais[0]) < 10) return normais[0];
    if (trunfos.length && K.pontos(trunfos[0]) === 0) return trunfos[0];
    return [...mao].sort(porPouco)[0];
  }
  const doNaipe = mao.filter((c) => c.naipe === lider.naipe && K.forca(c) > K.forca(lider));
  if (doNaipe.length && lider.naipe !== trunfo) {
    return doNaipe.sort((a, b) => K.pontos(b) - K.pontos(a) || K.forca(a) - K.forca(b))[0];
  }
  if (lider.naipe === trunfo && doNaipe.length && K.pontos(lider) >= 10) {
    return doNaipe.sort((a, b) => K.forca(a) - K.forca(b))[0];
  }
  const vale = K.pontos(lider);
  if (lider.naipe !== trunfo && trunfos.length) {
    if (vale >= 10) return trunfos[0];
    const baixos = trunfos.filter((c) => K.pontos(c) === 0);
    if (vale >= 3 && baixos.length) return baixos[0];
  }
  if (normais.length) return normais[0];
  return trunfos[0];
}

// Uma carta bondosa e fraca: sair com pontos e, a responder, dar pontos em vez de os apanhar.
export function jogadaFraca(mao, lider, trunfo) {
  const generosas = [...mao].sort((a, b) => K.pontos(b) - K.pontos(a) || (a.naipe === trunfo) - (b.naipe === trunfo));
  if (!lider) return generosas.find((c) => c.naipe !== trunfo) || generosas[0];
  const perdem = generosas.filter((c) => !ganhaSegunda(lider, c, trunfo));
  if (perdem.length) return perdem[0];
  return [...mao].sort((a, b) => K.pontos(a) - K.pontos(b) || K.forca(a) - K.forca(b))[0];
}

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo("cartas");
  estilo("bisca");
  const e = ecra(() => terminar(false));
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let acordar = null;
  let redesenhar = null;
  const aoRedimensionar = () => { if (redesenhar) redesenhar(); };
  window.addEventListener("resize", aoRedimensionar);

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    window.removeEventListener("resize", aoRedimensionar);
    if (!completo && ronda) ronda.registar(false);
    if (acordar) acordar(null);
    e.raiz.remove();
    sair();
  }

  async function comecar() {
    const n = nivel("bisca");
    const cfg = NIVEIS[n - 1];
    const inicio = Date.now();

    // A Rosa dá as cartas: fica com as três primeiras e joga primeiro na primeira vaza.
    const monte = K.baralhar(K.baralho40());
    const mao = { ela: monte.splice(0, 3), rosa: monte.splice(0, 3) };
    const trunfoCarta = monte.shift();
    monte.push(trunfoCarta);
    const trunfo = trunfoCarta.naipe;
    const ganhas = { ela: [], rosa: [] };
    const mesa = { ela: null, rosa: null };
    let vez = null;
    let boa = null;
    let ganhou = null;
    let lider = "ela";
    let recente = null; // a carta acabada de jogar, que cresce uma vez ao entrar

    const reacoes = [];
    let jogadas = 0;
    let comoAPista = 0;
    let pistas = 0;
    const soma = (lista) => lista.reduce((s, c) => s + K.pontos(c), 0);

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        const meus = soma(ganhas.ela);
        metricas.ronda("bisca", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: meus,
          opponent_score: soma(ganhas.rosa),
          tricks_won: ganhas.ela.length / 2,
          plays: jogadas,
          hints_shown: pistas,
          accuracy: jogadas ? Math.round((comoAPista / jogadas) * 100) / 100 : null,
          reaction_ms_median: metricas.mediana(reacoes),
        });
        const facil = completo && meus >= 70;
        const dificil = completo && meus < 45;
        ajustarNivel("bisca", NIVEIS.length, { completo, facil, dificil });
      },
    };

    function desenhar() {
      const caixa = e.corpo.getBoundingClientRect();
      const W = caixa.width;
      const H = caixa.height;
      const faixa = Math.max(56, Math.min(H * 0.15, 110));
      const resto = H - faixa - 24;
      // As cartas da pessoa são as maiores; as da mesa um pouco mais pequenas.
      let w = Math.min((resto * 0.56) / 1.32, (W * 0.92 - 40) / 3, 230);
      w = Math.max(w, ALVO_MIN);
      // Ecrã ao alto: o baralho fica por cima da vaza em vez de ao lado.
      const dePe = H > W;
      let t = dePe
        ? Math.min((resto * 0.5) / 3.4, w * 0.85, (W - 60) / 2.6)
        : Math.min((resto * 0.44 - 8) / 1.32, w * 0.85, (W - 260) / 3.7);
      t = Math.max(t, 70);
      const ht = t * 1.32;
      const pequena = Math.min(faixa * 0.8 / 1.32, 60);

      const amiga = el("div", { class: "bisca-amiga" }, [
        el("div", { class: `cj-jogador${vez === "rosa" ? " vez" : ""}` }, [img(AMIGA.cara, ""), AMIGA.nome]),
        el("div", { class: "bisca-costas" }, mao.rosa.map(() => K.verso(pequena, pequena * 1.32))),
      ]);
      if (cfg.placar) {
        amiga.append(el("div", { class: "bisca-placar" }, [
          el("span", {}, ["Tu ", el("b", {}, String(soma(ganhas.ela)))]),
          el("span", {}, [`${AMIGA.nome} `, el("b", {}, String(soma(ganhas.rosa)))]),
        ]));
      }

      const baralho = el("div", { class: "bisca-baralho" }, [
        el("div", { class: "bisca-trunfo" }, [
          trunfoNaMesa() ? K.carta(trunfoCarta, t * 0.8, t * 0.8 * 1.32) : K.lugar(t * 0.8, t * 0.8 * 1.32, trunfo),
          el("div", { class: "bisca-rotulo" }, "Trunfo"),
        ]),
        monte.length > 1
          ? el("div", { class: "bisca-monte" }, [K.verso(t * 0.8, t * 0.8 * 1.32), el("div", { class: "bisca-conta" }, String(monte.length - 1))])
          : null,
      ]);
      // O lugar da Rosa tem a cara dela, o da pessoa diz "Tu", para se ver de quem é cada carta.
      const vaza = el("div", { class: "bisca-vaza" }, ["rosa", "ela"].map((q) => {
        const c = mesa[q];
        const marca = q === "rosa" ? img(AMIGA.cara, "") : el("span", {}, "Tu");
        const carta = c
          ? K.carta(c, t, ht, { classe: `${K.igual(c, recente) ? "cj-entra" : ""}${ganhou === q ? " cj-ganha" : ""}` })
          : K.lugar(t, ht, null, "bisca-sitio");
        return el("div", { class: `bisca-lugar ${q}` }, [carta, el("div", { class: "bisca-dono" }, [marca])]);
      }));
      recente = null;
      const centro = el("div", { class: `bisca-mesa${dePe ? " de-pe" : ""}` }, [baralho, vaza]);

      const minha = el("div", { class: "bisca-mao" }, mao.ela.map((c) => {
        const b = K.carta(c, w, w * 1.32, { tag: "button", classe: K.igual(c, boa) ? "cj-boa" : "" });
        b.addEventListener("click", () => { if (vez === "ela" && acordar) acordar(c); });
        return b;
      }));
      e.corpo.replaceChildren(el("div", { class: "bisca" }, [amiga, centro, minha]));
    }
    redesenhar = desenhar;

    // A carta do trunfo fica na mesa até ser tirada como última carta.
    const trunfoNaMesa = () => monte.length > 0;

    async function dizer(id, cara) {
      if (!ativo) return;
      await e.dizer(id, cara ? { cara } : undefined);
    }

    async function vezDela() {
      vez = "ela";
      const lead = lider === "rosa" ? mesa.rosa : null;
      const sugestao = boaJogada(mao.ela, lead, trunfo);
      boa = cfg.pista === true ? sugestao : null;
      if (boa) pistas++;
      desenhar();
      const desde = Date.now();
      let temporizador = null;
      if (typeof cfg.pista === "number") {
        temporizador = setTimeout(() => {
          if (!ativo || vez !== "ela") return;
          boa = sugestao;
          pistas++;
          desenhar();
        }, cfg.pista);
      }
      const c = await new Promise((r) => { acordar = r; });
      acordar = null;
      clearTimeout(temporizador);
      if (!c || !ativo) return null;
      reacoes.push(Date.now() - desde);
      jogadas++;
      if (K.igual(c, sugestao)) comoAPista++;
      vez = null;
      boa = null;
      mao.ela = mao.ela.filter((x) => !K.igual(x, c));
      mesa.ela = c;
      recente = c;
      som.efeito("virar", 0.6);
      desenhar();
      await dizer(`bisca.${K.chave(c)}`);
      return c;
    }

    async function vezRosa() {
      vez = "rosa";
      desenhar();
      await espera(700);
      if (!ativo) return;
      const lead = lider === "ela" ? mesa.ela : null;
      let c = boaJogada(mao.rosa, lead, trunfo);
      if (Math.random() < cfg.fraco) {
        c = cfg.bondosa ? jogadaFraca(mao.rosa, lead, trunfo) : mao.rosa[Math.floor(Math.random() * mao.rosa.length)];
      }
      mao.rosa = mao.rosa.filter((x) => !K.igual(x, c));
      mesa.rosa = c;
      recente = c;
      vez = null;
      som.efeito("virar", 0.6);
      desenhar();
      await dizer(`bisca.${K.chave(c)}`);
    }

    desenhar();
    som.efeito("baralhar", 0.5);
    await dizer("bisca.comecar");
    await dizer(`bisca.trunfo_${trunfo}`);
    if (!ativo) return;
    await dizer(cfg.pista === true ? "bisca.instrucao_pista" : "bisca.instrucao");
    let avisouFim = false;

    while (ativo && (mao.ela.length || mao.rosa.length)) {
      if (lider === "ela") {
        if (!(await vezDela())) return;
        await vezRosa();
      } else {
        await vezRosa();
        if (!ativo) return;
        if (!(await vezDela())) return;
      }
      if (!ativo) return;
      const primeira = mesa[lider];
      const outro = lider === "ela" ? "rosa" : "ela";
      const vencedor = ganhaSegunda(primeira, mesa[outro], trunfo) ? outro : lider;
      ganhou = vencedor;
      desenhar();
      await espera(500);
      if (!ativo) return;
      const valeu = K.pontos(mesa.ela) + K.pontos(mesa.rosa);
      if (vencedor === "ela") {
        som.efeito("par", 0.5);
        await dizer(valeu >= 10 && Math.random() < 0.5 ? som.elogio() : "bisca.vaza_tua", "img/noto/gato_feliz.svg");
      } else {
        await dizer("bisca.vaza_rosa");
      }
      if (!ativo) return;
      ganhas[vencedor].push(mesa.ela, mesa.rosa);
      mesa.ela = null;
      mesa.rosa = null;
      ganhou = null;
      lider = vencedor;
      // Quem ganhou tira primeiro, depois o outro.
      if (monte.length) {
        mao[vencedor].push(monte.shift());
        mao[vencedor === "ela" ? "rosa" : "ela"].push(monte.shift());
        som.efeito("virar", 0.4);
      }
      desenhar();
      if (!monte.length && !avisouFim && mao.ela.length) {
        avisouFim = true;
        await dizer("bisca.acabou_baralho");
      }
    }
    if (!ativo) return;

    const meus = soma(ganhas.ela);
    const dela = soma(ganhas.rosa);
    e.corpo.querySelector(".bisca")?.append(el("div", { class: "bisca-final" }, [
      el("div", {}, ["Tu ", el("b", {}, String(meus))]),
      el("div", {}, [`${AMIGA.nome} `, el("b", {}, String(dela))]),
    ]));
    if (meus > 60) await dizer("bisca.fim_ganhaste", "img/noto/gato_amor.svg");
    else if (meus === 60) await dizer("bisca.fim_empate", "img/noto/gato_feliz.svg");
    else await dizer("bisca.fim_rosa", "img/noto/gato_feliz.svg");
    if (!ativo) return;
    await dizer("bisca.fim_obrigada", "img/noto/gato_amor.svg");
    if (!ativo) return;
    ronda.registar(true);
    ronda = null;
    redesenhar = null;
    const r = await premio(e, e.raiz);
    if (r === "outra") comecar();
    else terminar(true);
  }

  comecar();
  return () => terminar(false);
}
