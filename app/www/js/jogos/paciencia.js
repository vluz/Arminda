// Paciência: o Klondike adaptado a um só dedo. Tocar numa carta leva-a (com as que tem em cima)
// para o melhor sítio permitido; tocar no monte vira uma carta. Cada distribuição é conferida por
// um resolvedor, por isso pode sempre acabar-se. Se a pessoa ficar presa um bocado, o gato aponta
// uma boa jogada; se já não houver saída, o gato arruma por ela a carta seguinte.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel } from "../estado.js";
import { el, ecra, espera, premio, estilo, ALVO_MIN } from "../ui.js";
import * as K from "./cartas.js";
import * as M from "./paciencia-motor.js";

// naipes: naipes em jogo (0 copas, 1 ouros, 2 espadas, 3 paus); max: valor mais alto; livre:
// qualquer carta pode ir para uma coluna vazia; qualquerCor: descer só pelo número; ajuda: ms sem
// progresso até o gato ajudar; limite: posições do resolvedor.
const NIVEIS = [
  { naipes: [0, 2], max: 6, colunas: 3, livre: true, qualquerCor: true, ajuda: 20000, limite: 3000 },
  { naipes: [0, 2], max: 8, colunas: 4, livre: true, qualquerCor: true, ajuda: 25000, limite: 3000 },
  { naipes: [0, 1, 2, 3], max: 6, colunas: 5, livre: true, qualquerCor: true, ajuda: 30000, limite: 3000 },
  { naipes: [0, 1, 2, 3], max: 8, colunas: 6, livre: true, qualquerCor: false, ajuda: 40000, limite: 4000 },
  { naipes: [0, 1, 2, 3], max: 10, colunas: 7, livre: false, qualquerCor: false, ajuda: 50000, limite: 5000 },
  { naipes: [0, 1, 2, 3], max: 13, colunas: 7, livre: false, qualquerCor: false, ajuda: 60000, limite: 5000 },
];

const carta = (x) => ({ naipe: K.NAIPES[M.naipeDe(x)], valor: M.valorDe(x) });

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo("cartas");
  estilo("paciencia");
  // O monte e o descarte ficam na barra de cima, ao lado do gato, para a mesa ter espaço para as colunas.
  const sitioMonte = el("div", { class: "pac-topo" });
  const sitioResto = el("div", { class: "pac-topo" });
  const e = ecra(() => terminar(false), [sitioResto, sitioMonte]);
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let relogio = null;
  let redesenhar = null;
  const aoRedimensionar = () => { if (redesenhar) redesenhar(); };
  window.addEventListener("resize", aoRedimensionar);

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    clearInterval(relogio);
    window.removeEventListener("resize", aoRedimensionar);
    if (!completo && ronda) ronda.registar(false);
    e.raiz.remove();
    sair();
  }

  async function comecar() {
    const n = nivel("paciencia");
    const base = NIVEIS[n - 1];
    const inicio = Date.now();

    // O ecrã limita o número de colunas para cada uma ficar com pelo menos ALVO_MIN de largura.
    const caixa0 = e.corpo.getBoundingClientRect();
    const dePe0 = caixa0.height > caixa0.width;
    const larguraUtil = caixa0.width - 32 - (dePe0 ? 0 : 100);
    const cabemCols = Math.max(3, Math.floor((larguraUtil + 8) / (ALVO_MIN + 8)));
    const cfg = { ...base, colunas: Math.min(base.colunas, cabemCols) };
    const deal = M.darGanhavel(cfg.naipes, cfg.max, cfg.colunas, cfg.livre, cfg.qualquerCor, cfg.limite);
    let jogo = deal.jogo;

    let movimentos = 0;
    let tiradas = 0;
    let voltas = 0;
    let erros = 0;
    let errosSeguidos = 0;
    let ajudas = 0;
    let resgates = 0;
    let ultimoProgresso = Date.now();
    let voltasSemNada = 0;
    let bloqueado = true;
    let pista = null; // { m, fonte: "col" | "resto" | "monte", i }
    let novos = new Set();
    let tremer = null;
    let avisouVolta = false;

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        metricas.ronda("paciencia", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: M.arrumadas(jogo),
          cards: M.total(jogo),
          columns: cfg.colunas,
          moves: movimentos,
          stock_draws: tiradas,
          recycles: voltas,
          wrong_taps: erros,
          hints_needed: ajudas,
          rescues: resgates,
          deal_proven: deal.provado,
          accuracy: movimentos + erros ? Math.round((movimentos / (movimentos + erros)) * 100) / 100 : null,
        });
        const facil = completo && ajudas === 0 && resgates === 0 && erros <= 3;
        // Só uma ronda acabada pode ser "difícil": uma ronda deixada a meio não muda nada (regra 10).
        const dificil = completo && (resgates > 0 || ajudas >= 3);
        ajustarNivel("paciencia", NIVEIS.length, { completo, facil, dificil });
      },
    };

    function desenhar() {
      const caixa = e.corpo.getBoundingClientRect();
      const W = caixa.width - 32;
      const H = caixa.height - 32;
      const g = 8;
      const dePe = H > W;
      const nf = cfg.naipes.length;
      let fh;
      let fw;
      // Descarte e monte: na barra de cima quando o ecrã é largo; ao alto, o balão precisa dessa
      // largura, por isso vão para a fila por cima das colunas, ao lado das fundações.
      const lado = Math.round(dePe
        ? Math.max(Math.min(W * 0.17, 150), ALVO_MIN)
        : Math.max(Math.min(innerWidth, innerHeight) * 0.17, ALVO_MIN));
      if (dePe) {
        fh = lado;
        fw = Math.min(fh / 1.25, (W - 2 * lado - 3 * g - (nf - 1) * g) / nf);
      } else {
        fh = Math.min((H - (nf - 1) * g) / nf, 150);
        fw = Math.min(fh / 1.25, 100);
      }
      const TW = dePe ? W : W - fw - 2 * g;
      const TH = dePe ? H - fh - 2 * g : H;
      const cols = jogo.cols.length;
      const w = Math.floor(Math.max(Math.min((TW - (cols - 1) * g) / cols, 190), ALVO_MIN));
      const h = Math.floor(Math.min(w * 1.32, TH * 0.6));

      // O descarte e o monte como cartas grandes e quadradas.
      const topoResto = jogo.resto[jogo.resto.length - 1];
      const bResto = topoResto === undefined
        ? K.lugar(lado, lado)
        : K.carta(carta(topoResto), lado, lado, { tag: "button", classe: `${novos.has(topoResto) ? "cj-entra" : ""}` });
      if (topoResto !== undefined) bResto.addEventListener("click", tocarResto);
      if (pista && pista.fonte === "resto") bResto.classList.add("cj-boa");
      if (tremer === "resto") bResto.classList.add("pac-treme");
      sitioResto.replaceChildren(bResto);
      const bMonte = jogo.monte.length
        ? K.verso(lado, lado, { tag: "button" })
        : el("button", { class: "cj cj-lugar pac-volta", style: { "--w": `${lado}px`, "--h": `${lado}px` } }, "↻");
      if (jogo.monte.length) bMonte.append(el("span", { class: "pac-conta" }, String(jogo.monte.length)));
      if (!jogo.monte.length && !jogo.resto.length) bMonte.classList.add("pac-acabou");
      if (pista && pista.fonte === "monte") bMonte.classList.add("cj-boa");
      bMonte.setAttribute("aria-label", "Monte");
      bMonte.addEventListener("click", tocarMonte);
      sitioMonte.replaceChildren(bMonte);

      const fundacoes = el("div", { class: "pac-fundacoes" }, cfg.naipes.map((nn) => {
        const alto = jogo.fund[nn];
        return alto
          ? K.carta(carta(nn * 13 + alto - 1), fw, fh, { classe: novos.has(nn * 13 + alto - 1) ? "cj-entra" : "" })
          : K.lugar(fw, fh, K.NAIPES[nn]);
      }));

      const mesa = el("div", { class: "pac-colunas", style: { "--g": `${g}px` } }, jogo.cols.map((c, i) => {
        const b = el("button", { class: "pac-coluna", style: { width: `${w}px`, height: `${TH}px` }, "aria-label": `Coluna ${i + 1}` });
        if (pista && pista.fonte === "col" && pista.i === i) b.classList.add("pac-pista");
        if (tremer === i) b.classList.add("pac-treme");
        const nd = c.f.length;
        const nu = c.a.length;
        if (!nd && !nu) {
          b.append(K.lugar(w, h));
        } else {
          let df = w * 0.14;
          let uf = w * 0.4;
          const cabe = () => nd * df + Math.max(0, nu - 1) * uf + h <= TH;
          if (!cabe() && nu > 1) uf = Math.max(w * 0.3, (TH - h - nd * df) / (nu - 1));
          if (!cabe() && nd) df = Math.max(w * 0.05, (TH - h - Math.max(0, nu - 1) * uf) / nd);
          if (!cabe() && nu > 1) uf = (TH - h - nd * df) / (nu - 1);
          let y = 0;
          c.f.forEach(() => {
            const v = K.verso(w, h);
            v.style.top = `${y}px`;
            b.append(v);
            y += df;
          });
          c.a.forEach((x, k) => {
            const f = K.carta(carta(x), w, h, { classe: novos.has(x) ? "cj-entra" : "" });
            f.style.top = `${y}px`;
            b.append(f);
            if (k < nu - 1) y += uf;
          });
        }
        b.addEventListener("click", () => tocarColuna(i));
        return b;
      }));
      novos = new Set();
      tremer = null;
      const barra = e.raiz.querySelector(".topo");
      if (dePe) {
        e.corpo.replaceChildren(el("div", { class: "pac de-pe" }, [
          el("div", { class: "pac-cima" }, [sitioMonte, sitioResto, fundacoes]),
          mesa,
        ]));
      } else {
        if (sitioResto.parentNode !== barra) barra.append(sitioResto, sitioMonte);
        e.corpo.replaceChildren(el("div", { class: "pac" }, [mesa, fundacoes]));
      }
    }
    redesenhar = desenhar;

    const fonteDe = (m) => {
      if (m.t === "cf" || m.t === "cc") return { fonte: "col", i: m.i };
      return { fonte: jogo.resto[jogo.resto.length - 1] === m.x ? "resto" : "monte" };
    };

    async function fazer(m) {
      const antes = jogo;
      if (m.t === "cc") jogo.cols[m.i].a.slice(m.k).forEach((x) => novos.add(x));
      else if (m.t === "cf") novos.add(jogo.cols[m.i].a[jogo.cols[m.i].a.length - 1]);
      else novos.add(m.x);
      jogo = M.aplicar(jogo, m);
      movimentos++;
      errosSeguidos = 0;
      voltasSemNada = 0;
      ultimoProgresso = Date.now();
      pista = null;
      const subiu = M.arrumadas(jogo) > M.arrumadas(antes);
      som.efeito(subiu ? "marcar" : "virar", 0.6);
      desenhar();
      if (M.ganho(jogo) || M.soFalta(jogo)) return acabar();
      if (jogo.virou && Math.random() < 0.25) e.dizer(som.elogio(), { cara: "img/noto/gato_feliz.svg" });
      else if (subiu && Math.random() < 0.15) e.dizer(som.elogio(), { cara: "img/noto/gato_feliz.svg" });
    }

    function falhou(onde) {
      erros++;
      errosSeguidos++;
      tremer = onde;
      som.efeito("quase", 0.4);
      desenhar();
      if (errosSeguidos === 3) e.dizer("paciencia.nao_da");
      if (errosSeguidos >= 6) { errosSeguidos = 0; ajudar(); }
    }

    function tocarColuna(i) {
      if (bloqueado || !ativo) return;
      const m = pista && pista.fonte === "col" && pista.i === i ? pista.m : M.toqueColuna(jogo, i);
      if (!m) return falhou(i);
      fazer(m);
    }

    function tocarResto() {
      if (bloqueado || !ativo) return;
      const m = pista && pista.fonte === "resto" ? pista.m : M.toqueResto(jogo);
      if (!m) return falhou("resto");
      fazer(m);
    }

    function tocarMonte() {
      if (bloqueado || !ativo) return;
      if (!jogo.monte.length && !jogo.resto.length) return;
      const r = M.tirar(jogo);
      jogo = r.jogo;
      if (r.voltou) {
        voltas++;
        voltasSemNada++;
        som.efeito("baralhar", 0.4);
        if (!avisouVolta) { avisouVolta = true; e.dizer("paciencia.volta"); }
      } else {
        tiradas++;
        novos.add(jogo.resto[jogo.resto.length - 1]);
        som.efeito("virar", 0.5);
      }
      // Uma pista sobre uma carta do monte passa a ser uma pista no descarte quando essa carta aparece.
      if (pista && (pista.m.t === "tf" || pista.m.t === "tc")) pista = { m: pista.m, ...fonteDe(pista.m) };
      desenhar();
      if (voltasSemNada >= 2) { voltasSemNada = 0; ajudar(); }
    }

    let aAjudar = false;
    async function ajudar() {
      if (aAjudar || bloqueado || !ativo) return;
      aAjudar = true;
      ultimoProgresso = Date.now();
      const sol = M.resolver(jogo, cfg.limite);
      if (sol && sol.length) {
        ajudas++;
        pista = { m: sol[0], ...fonteDe(sol[0]) };
        desenhar();
        await e.dizer(pista.fonte === "monte" ? "paciencia.ajuda_monte" : "paciencia.ajuda", { cara: "img/noto/gato_amor.svg" });
      } else {
        resgates++;
        bloqueado = true;
        await e.dizer("paciencia.ajudinha", { cara: "img/noto/gato_amor.svg" });
        if (!ativo) return;
        const antes = jogo.fund.slice();
        jogo = M.resgatar(jogo);
        jogo.fund.forEach((v, k) => { if (v > antes[k]) novos.add(k * 13 + v - 1); });
        som.efeito("marcar", 0.6);
        bloqueado = false;
        desenhar();
        if (M.ganho(jogo) || M.soFalta(jogo)) { aAjudar = false; return acabar(); }
      }
      aAjudar = false;
    }

    let acabando = false;
    async function acabar() {
      if (acabando) return;
      acabando = true;
      bloqueado = true;
      pista = null;
      clearInterval(relogio);
      if (!M.ganho(jogo)) {
        await e.dizer("paciencia.arrumo", { cara: "img/noto/gato_feliz.svg" });
        while (ativo && !M.ganho(jogo)) {
          const m = M.proximaASubir(jogo);
          if (!m) break;
          novos.add(jogo.cols[m.i].a[jogo.cols[m.i].a.length - 1]);
          jogo = M.aplicar(jogo, m);
          som.efeito("marcar", 0.4);
          desenhar();
          await espera(260);
        }
      }
      if (!ativo) return;
      som.efeito("vitoria2", 0.6);
      await e.dizer("paciencia.fim", { cara: "img/noto/gato_amor.svg" });
      if (!ativo) return;
      ronda.registar(true);
      ronda = null;
      redesenhar = null;
      const r = await premio(e, e.raiz);
      if (r === "outra") comecar();
      else terminar(true);
    }

    desenhar();
    desenhar(); // outra vez, agora que a barra de cima tem a altura final
    som.efeito("baralhar", 0.5);
    await e.dizer("paciencia.comecar");
    if (!ativo) return;
    await e.dizer("paciencia.instrucao");
    if (!ativo) return;
    await e.dizer(cfg.qualquerCor ? "paciencia.regra_facil" : "paciencia.regra");
    if (!ativo) return;
    bloqueado = false;
    ultimoProgresso = Date.now();
    clearInterval(relogio);
    relogio = setInterval(() => {
      if (!ativo || bloqueado || pista) return;
      if (Date.now() - ultimoProgresso > cfg.ajuda) ajudar();
    }, 1000);
  }

  comecar();
  return () => terminar(false);
}
