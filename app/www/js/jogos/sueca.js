// Sueca a quatro: a pessoa e a Rosa (a parceira, em frente) contra o Manel e o Zé, todos amigos.
// Regras: baralho português de 40 cartas, 10 cartas a cada um, a carta de quem dá, virada para
// cima, mostra o trunfo. Joga-se no sentido contrário ao dos ponteiros do relógio (a pessoa, o
// Manel à direita dela, a Rosa, o Zé); sai primeiro quem está à direita de quem dá, e quem ganha a
// vaza sai a seguir. É obrigatório assistir ao naipe quando se pode. Ganha o trunfo mais alto,
// senão a carta mais alta do naipe de saída. Ás 11, Sete 10, Rei 4, Valete 3, Dama 2.
// Mais de 60 dos 120 pontos ganha; 60 a cada lado é empate. Aqui uma ronda é um jogo, não uma série.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio, estilo, ALVO_MIN } from "../ui.js";
import * as K from "./cartas.js";

// pista: true = a carta boa brilha logo, um número = ao fim desses ms, null = nunca.
// fraco: probabilidade de o Manel e o Zé jogarem uma carta fraca permitida (bondosos: uma que dá
// pontos ao lado da pessoa, senão uma ao acaso). A Rosa joga sempre o melhor que sabe. Em
// simulação, seguindo sempre a pista, o lado da pessoa ganha cerca de 79% no nível 1, 73% no 2,
// 59% no 3, 56% no 4 e 49% no 6.
const NIVEIS = [
  { pista: true, fraco: 0.8, bondosos: true, placar: true },
  { pista: true, fraco: 0.6, bondosos: true, placar: true },
  { pista: 9000, fraco: 0.4, placar: true },
  { pista: null, fraco: 0.25, placar: true },
  { pista: null, fraco: 0.1, placar: false },
  { pista: null, fraco: 0, placar: false },
];

// Lugares pela ordem de jogo (sentido contrário ao dos ponteiros, visto de cima): a pessoa em
// baixo, o Manel à direita, a Rosa em cima, o Zé à esquerda.
const LUGARES = [
  { id: "ela", nome: "Tu", sitio: "baixo" },
  { id: "manel", nome: "Manel", cara: "img/noto/idoso.svg", sitio: "direita" },
  { id: "rosa", nome: "Rosa", cara: "img/noto/idosa.svg", sitio: "cima" },
  { id: "ze", nome: "Zé", cara: "img/noto/homem.svg", sitio: "esquerda" },
];
const equipa = (s) => s % 2; // 0 = a pessoa e a Rosa, 1 = o Manel e o Zé

export function legais(mao, vaza) {
  if (!vaza.length) return mao;
  const naipe = vaza[0].c.naipe;
  const doNaipe = mao.filter((c) => c.naipe === naipe);
  return doNaipe.length ? doNaipe : mao;
}

// Índice, na vaza, da carta que vai a ganhar.
export function vencedora(vaza, trunfo) {
  let m = 0;
  for (let i = 1; i < vaza.length; i++) {
    const a = vaza[m].c;
    const b = vaza[i].c;
    if (b.naipe === a.naipe ? K.forca(b) > K.forca(a) : b.naipe === trunfo) m = i;
  }
  return m;
}

// Esta é a carta mais forte do seu naipe que ainda anda por aí (não foi jogada e não está na minha mão)?
function eMaisAlta(c, jogadas, mao) {
  return !K.baralho40().some((x) => x.naipe === c.naipe && K.forca(x) > K.forca(c)
    && !jogadas.some((j) => K.igual(j, x)) && !mao.some((m) => K.igual(m, x)));
}

const baixa = (a, b) => K.pontos(a) - K.pontos(b) || K.forca(a) - K.forca(b);

// Uma carta sensata para quem está no lugar s: ganhar pontos por pouco, dar pontos ao parceiro,
// deitar aos adversários o que não presta.
export function boaJogada(s, mao, vaza, trunfo, jogadas) {
  const opcoes = legais(mao, vaza);
  if (!vaza.length) {
    const normais = opcoes.filter((c) => c.naipe !== trunfo);
    const seguras = normais.filter((c) => K.pontos(c) >= 10 && eMaisAlta(c, jogadas, mao));
    if (seguras.length) return seguras.sort((a, b) => K.pontos(b) - K.pontos(a))[0];
    const lixo = normais.filter((c) => K.pontos(c) < 10).sort(baixa);
    if (lixo.length) return lixo[0];
    return [...opcoes].sort(baixa)[0];
  }
  const v = vaza[vencedora(vaza, trunfo)];
  const ultimo = vaza.length === 3;
  const naMesa = vaza.reduce((t, j) => t + K.pontos(j.c), 0);
  const ganha = (c) => (c.naipe === v.c.naipe ? K.forca(c) > K.forca(v.c) : c.naipe === trunfo);
  if (equipa(v.s) === equipa(s)) {
    const segura = ultimo || (eMaisAlta(v.c, jogadas, mao)
      && (v.c.naipe === trunfo || vaza.length === 2));
    if (segura) {
      const dar = opcoes.filter((c) => c.naipe !== trunfo || opcoes.every((x) => x.naipe === trunfo));
      return [...dar].sort((a, b) => K.pontos(b) - K.pontos(a) || K.forca(a) - K.forca(b))[0];
    }
    return [...opcoes].sort(baixa)[0];
  }
  const vencem = opcoes.filter(ganha).sort((a, b) => K.forca(a) - K.forca(b) + (a.naipe === trunfo) - (b.naipe === trunfo));
  if (vencem.length) {
    if (ultimo) {
      // O último a jogar: ganhar com a carta que também traz mais pontos para casa.
      return vencem.sort((a, b) => (a.naipe === trunfo) - (b.naipe === trunfo) || K.pontos(b) - K.pontos(a))[0];
    }
    const forte = vencem.find((c) => eMaisAlta(c, jogadas, mao) && c.naipe === v.c.naipe);
    if (forte && naMesa + K.pontos(forte) >= 10) return forte;
    if (naMesa >= 3 || K.pontos(vencem[0]) === 0) return vencem[0];
  }
  return [...opcoes].sort(baixa)[0];
}

// Uma carta bondosa e fraca para o Manel e o Zé nos níveis fáceis: sair com pontos, e dar pontos ao lado da pessoa.
export function jogadaFraca(s, mao, vaza, trunfo) {
  const opcoes = legais(mao, vaza);
  const generosas = [...opcoes].sort((a, b) => K.pontos(b) - K.pontos(a) || (a.naipe === trunfo) - (b.naipe === trunfo));
  if (!vaza.length) return generosas.find((c) => c.naipe !== trunfo) || generosas[0];
  const v = vaza[vencedora(vaza, trunfo)];
  const ganha = (c) => (c.naipe === v.c.naipe ? K.forca(c) > K.forca(v.c) : c.naipe === trunfo);
  if (equipa(v.s) !== equipa(s)) return generosas.find((c) => !ganha(c)) || [...opcoes].sort(baixa)[0];
  return [...opcoes].sort(baixa)[0];
}

function ordenar(mao, trunfo) {
  const ordem = ["copas", "espadas", "ouros", "paus"].filter((n) => n !== trunfo).concat(trunfo);
  return [...mao].sort((a, b) => ordem.indexOf(a.naipe) - ordem.indexOf(b.naipe) || K.forca(b) - K.forca(a));
}

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo("cartas");
  estilo("sueca");
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
    const n = nivel("sueca");
    const cfg = NIVEIS[n - 1];
    const inicio = Date.now();

    const monte = K.baralhar(K.baralho40());
    const maos = [0, 1, 2, 3].map((s) => monte.slice(s * 10, s * 10 + 10));
    const dador = Math.floor(Math.random() * 4);
    // A última carta de quem dá é virada para cima: o naipe dela é o trunfo, e a carta fica na mão de quem deu.
    const trunfoCarta = maos[dador][9];
    const trunfo = trunfoCarta.naipe;
    maos[0] = ordenar(maos[0], trunfo);
    let trunfoVisivel = true;
    let lider = (dador + 1) % 4;
    let vaza = []; // [{ s, c }]
    const jogadas = [];
    const pontosEquipa = [0, 0];
    const vazasEquipa = [0, 0];
    let vez = null;
    let boa = null;
    let ganhou = null;
    let recente = null;

    const reacoes = [];
    let minhas = 0;
    let comoAPista = 0;
    let pistas = 0;
    let proibidas = 0;

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        metricas.ronda("sueca", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: pontosEquipa[0],
          opponent_score: pontosEquipa[1],
          tricks_won: vazasEquipa[0],
          plays: minhas,
          illegal_taps: proibidas,
          hints_shown: pistas,
          accuracy: minhas ? Math.round((comoAPista / minhas) * 100) / 100 : null,
          reaction_ms_median: metricas.mediana(reacoes),
        });
        const facil = completo && pontosEquipa[0] >= 75;
        const dificil = completo && pontosEquipa[0] < 45;
        ajustarNivel("sueca", NIVEIS.length, { completo, facil, dificil });
      },
    };

    function desenhar() {
      const caixa = e.corpo.getBoundingClientRect();
      // Dentro da mesa verde: a margem de dentro e a borda dela levam cerca de 32 px.
      const W = caixa.width - 32;
      const H = caixa.height - 32;
      const g = 8;
      const dePe = H > W;
      // A mão da pessoa: até 5 cartas por fila, duas filas, nunca mais estreitas do que ALVO_MIN.
      let w;
      let h;
      if (dePe) {
        w = Math.min((W - 4 * g) / 5, 190);
        h = Math.min(w * 1.3, (H * 0.42 - g) / 2);
      } else {
        w = Math.min((W * 0.6 - 4 * g) / 5, (H - g) / 2 / 1.3, 190);
        h = Math.min(w * 1.3, (H - g) / 2);
      }
      w = Math.floor(Math.max(w, ALVO_MIN));
      h = Math.floor(Math.max(h, ALVO_MIN));
      const maoL = 5 * w + 4 * g + 1;
      const mesaW = dePe ? W : W - maoL - g;
      const mesaH = dePe ? H - 2 * h - 2 * g : H;
      const t = Math.max(60, Math.min(mesaW / 3.25, mesaH / 2.75, 200));
      const ht = t * 1.3;

      const opcoes = vez === 0 ? legais(maos[0], vaza) : maos[0];
      const mao = el("div", { class: "sueca-mao", style: { width: `${maoL}px` } }, maos[0].map((c) => {
        const ok = opcoes.some((x) => K.igual(x, c));
        const classe = vez === 0 && !ok ? "cj-proibida" : K.igual(c, boa) ? "cj-boa" : "";
        const b = K.carta(c, w, h, { tag: "button", classe });
        b.addEventListener("click", () => {
          if (vez !== 0 || !acordar) return;
          if (!legais(maos[0], vaza).some((x) => K.igual(x, c))) { proibidas++; return; }
          acordar(c);
        });
        return b;
      }));

      const mesa = el("div", { class: "sueca-mesa", style: { width: `${mesaW}px`, height: `${mesaH}px`, "--t": `${t}px`, "--ht": `${ht}px` } });
      for (let s = 0; s < 4; s++) {
        const L = LUGARES[s];
        const j = vaza.find((x) => x.s === s);
        const marca = L.cara ? img(L.cara, "") : el("span", {}, "Tu");
        let dentro;
        if (j) {
          dentro = [K.carta(j.c, t, ht, { classe: `${K.igual(j.c, recente) ? "cj-entra" : ""}${ganhou === s ? " cj-ganha" : ""}` }),
            el("div", { class: "sueca-dono" }, [marca])];
        } else {
          const vazio = K.lugar(t, ht, null, "sueca-vazio");
          vazio.append(el("div", { class: "sueca-quem" }, [L.cara ? img(L.cara, "") : null, el("span", {}, L.nome)]));
          dentro = [vazio];
        }
        mesa.append(el("div", { class: `sueca-lugar ${L.sitio}${vez === s && s ? " vez" : ""}` }, dentro));
      }
      recente = null;
      const tw = Math.min(t * 0.62, 90);
      mesa.append(el("div", { class: "sueca-trunfo" }, [
        trunfoVisivel ? K.carta(trunfoCarta, tw, tw * 1.3) : K.lugar(tw, tw * 1.3, trunfo),
        el("div", { class: "sueca-rotulo" }, "Trunfo"),
      ]));
      if (cfg.placar) {
        mesa.append(el("div", { class: "sueca-placar" }, [
          el("div", {}, ["Nós ", el("b", {}, String(pontosEquipa[0]))]),
          el("div", {}, ["Eles ", el("b", {}, String(pontosEquipa[1]))]),
        ]));
      }
      e.corpo.replaceChildren(el("div", { class: `sueca${dePe ? " de-pe" : ""}` }, [mesa, mao]));
    }
    redesenhar = desenhar;

    async function dizer(id, cara) {
      if (!ativo) return;
      await e.dizer(id, cara ? { cara } : undefined);
    }

    let avisouNaipe = false;
    async function vezDela() {
      vez = 0;
      const sugestao = boaJogada(0, maos[0], vaza, trunfo, jogadas);
      boa = cfg.pista === true ? sugestao : null;
      if (boa) pistas++;
      desenhar();
      if (!avisouNaipe && legais(maos[0], vaza).length < maos[0].length) {
        avisouNaipe = true;
        dizer("sueca.assistir");
      }
      const desde = Date.now();
      let temporizador = null;
      if (typeof cfg.pista === "number") {
        temporizador = setTimeout(() => {
          if (!ativo || vez !== 0) return;
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
      minhas++;
      if (K.igual(c, sugestao)) comoAPista++;
      boa = null;
      return c;
    }

    async function vezDeOutro(s) {
      vez = s;
      desenhar();
      await espera(800);
      if (!ativo) return null;
      const opcoes = legais(maos[s], vaza);
      let c = boaJogada(s, maos[s], vaza, trunfo, jogadas);
      if (s !== 2 && Math.random() < cfg.fraco) {
        c = cfg.bondosos ? jogadaFraca(s, maos[s], vaza, trunfo) : opcoes[Math.floor(Math.random() * opcoes.length)];
      }
      return c;
    }

    desenhar();
    som.efeito("baralhar", 0.5);
    await dizer("sueca.comecar");
    if (!ativo) return;
    await dizer(`sueca.trunfo_${trunfo}`);
    if (!ativo) return;
    await dizer(cfg.pista === true ? "sueca.instrucao_pista" : "sueca.instrucao");

    for (let v = 0; v < 10 && ativo; v++) {
      vaza = [];
      for (let i = 0; i < 4; i++) {
        const s = (lider + i) % 4;
        const c = s === 0 ? await vezDela() : await vezDeOutro(s);
        if (!c || !ativo) return;
        maos[s] = maos[s].filter((x) => !K.igual(x, c));
        vaza.push({ s, c });
        jogadas.push(c);
        if (K.igual(c, trunfoCarta)) trunfoVisivel = false;
        recente = c;
        vez = null;
        som.efeito("virar", 0.6);
        desenhar();
        await dizer(`bisca.${K.chave(c)}`);
        if (!ativo) return;
      }
      const vence = vaza[vencedora(vaza, trunfo)].s;
      ganhou = vence;
      desenhar();
      await espera(500);
      if (!ativo) return;
      const valeu = vaza.reduce((t, j) => t + K.pontos(j.c), 0);
      pontosEquipa[equipa(vence)] += valeu;
      vazasEquipa[equipa(vence)]++;
      if (vence === 0) {
        som.efeito("par", 0.5);
        await dizer(valeu >= 10 && Math.random() < 0.5 ? som.elogio() : "sueca.vaza_tua", "img/noto/gato_feliz.svg");
      } else if (vence === 2) {
        som.efeito("par", 0.4);
        await dizer("sueca.vaza_rosa", "img/noto/gato_feliz.svg");
      } else {
        await dizer(vence === 1 ? "sueca.vaza_manel" : "sueca.vaza_ze");
      }
      if (!ativo) return;
      ganhou = null;
      lider = vence;
      vaza = [];
      desenhar();
    }
    if (!ativo) return;

    const [nos, eles] = pontosEquipa;
    e.corpo.querySelector(".sueca")?.append(el("div", { class: "sueca-final" }, [
      el("div", {}, ["Tu e a Rosa ", el("b", {}, String(nos))]),
      el("div", {}, ["Manel e Zé ", el("b", {}, String(eles))]),
    ]));
    redesenhar = null;
    if (vazasEquipa[0] === 10) await dizer("sueca.bandeira", "img/noto/gato_amor.svg");
    else if (nos >= 91) await dizer("sueca.ganhamos_muito", "img/noto/gato_amor.svg");
    else if (nos > 60) await dizer("sueca.ganhamos", "img/noto/gato_amor.svg");
    else if (nos === 60) await dizer("sueca.empate", "img/noto/gato_feliz.svg");
    else await dizer("sueca.perdemos", "img/noto/gato_feliz.svg");
    if (!ativo) return;
    await dizer("sueca.fim", "img/noto/gato_amor.svg");
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
