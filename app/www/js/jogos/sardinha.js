// Apanha a sardinha: as sardinhas saltam da água; a pessoa toca-lhes antes de mergulharem outra vez.
// Nos níveis mais altos o gato também aparece: tocar-lhe dá uma frase com graça, nunca um castigo.
// Níveis de topo: várias ao mesmo tempo a velocidades diferentes, uma sardinha dourada para
// festejar, sardinhas que dão a volta no ar, e uma regra do gato ("só as grandes", "só as
// prateadas"), para ser preciso conter-se. Tocar no peixe errado só o faz abanar e dá uma frase simpática.
// Uma ronda é um número fixo de saltos, por isso a lentidão nunca a acaba mais cedo.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel, ler, gravar } from "../estado.js";
import { el, img, ecra, espera, premio, estilo, confetes, ALVO_MIN } from "../ui.js";

// dur: um salto para cima e para baixo (ms); dois: probabilidade de duas ao mesmo tempo; gato:
// probabilidade de um salto ser o gato; lado: nadar para o lado; n: saltos por ronda.
// Acrescentado por cima: tres: probabilidade de três ao mesmo tempo; variar: variação das
// velocidades (0.2 = 20% mais rápido ou mais lento); ouro: probabilidade de uma sardinha dourada;
// vira: probabilidade de uma sardinha que vai de lado dar a volta no ar; regra: "grandes" (só as
// grandes), "prateadas" (só as sardinhas prateadas, não os outros peixes) ou "troca" (o gato
// alterna entre as duas regras); outros: probabilidade de um salto ser um peixe que é para deixar
// em paz enquanto há uma regra.
const NIVEIS = [
  { dur: 4400, dois: 0, gato: 0, lado: false, n: 20 },
  { dur: 3400, dois: 0, gato: 0, lado: false, n: 24 },
  { dur: 3400, dois: 0.5, gato: 0, lado: false, n: 26 },
  { dur: 3200, dois: 0.3, gato: 0.25, lado: false, n: 28 },
  { dur: 3000, dois: 0.3, gato: 0.25, lado: true, n: 28 },
  { dur: 2500, dois: 0.5, gato: 0.3, lado: true, n: 32 },
  { dur: 2900, dois: 0.45, tres: 0.2, gato: 0.35, lado: true, n: 50, variar: 0.2, ouro: 0.1 },
  { dur: 2800, dois: 0.45, tres: 0.3, gato: 0.35, lado: true, n: 52, variar: 0.25, ouro: 0.1, vira: 0.35 },
  { dur: 2900, dois: 0.5, tres: 0.2, gato: 0.3, lado: true, n: 54, variar: 0.2, ouro: 0.08, vira: 0.25, regra: "grandes", outros: 0.4 },
  { dur: 2800, dois: 0.5, tres: 0.25, gato: 0.3, lado: true, n: 56, variar: 0.25, ouro: 0.08, vira: 0.3, regra: "prateadas", outros: 0.4 },
  { dur: 2600, dois: 0.5, tres: 0.3, gato: 0.4, lado: true, n: 60, variar: 0.3, ouro: 0.08, vira: 0.35, regra: "troca", outros: 0.45 },
];
const CARA_FELIZ = "img/noto/gato_feliz.svg";
const CARA_AMOR = "img/noto/gato_amor.svg";
const CORES = ["#e63946", "#ffb703", "#2b9348", "#0a6fd6", "#ff4d8d", "#7b2cbf", "#fb8500"];
const SARDINHA = "img/proprio/sardinha.svg";
const OUTROS_PEIXES = ["img/noto/peixe_tropical.svg", "img/noto/baiacu.svg"];
const REGRA_TEXTO = { grandes: "Só as grandes", prateadas: "Só as prateadas" };

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

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  const e = ecra(() => terminar(false));
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  const vivos = new Set(); // alvos no ar: { el, anim, tipo, raio, inicio, acabar }

  function pararTudo() {
    for (const v of vivos) { try { v.anim.cancel(); } catch { /* já não existe*/ } v.acabar(); }
    vivos.clear();
  }

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    pararTudo();
    if (!completo && ronda) ronda.registar(false);
    e.raiz.remove();
    sair();
  }

  async function comecar() {
    await estiloPronto("sardinha");
    if (!ativo) return;
    const n = nivel("sardinha");
    const cfg = NIVEIS[n - 1];
    const inicio = Date.now();
    const st = { sardinhas: 0, apanhadas: 0, gatos: 0, toquesGato: 0, vazios: 0, reacoes: [], distancias: [],
      ouros: 0, ourosApanhados: 0, outros: 0, errados: 0 };

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        metricas.ronda("sardinha", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: st.apanhadas,
          accuracy: st.sardinhas ? Math.round((st.apanhadas / st.sardinhas) * 100) / 100 : null,
          sardines_shown: st.sardinhas,
          missed: st.sardinhas - st.apanhadas,
          cat_shown: st.gatos,
          cat_taps: st.toquesGato,
          empty_taps: st.vazios,
          reaction_ms_median: metricas.mediana(st.reacoes),
          tap_offset_px_median: metricas.mediana(st.distancias),
          jump_ms: cfg.dur,
          gold_shown: st.ouros,
          gold_caught: st.ourosApanhados,
          others_shown: st.outros,
          wrong_fish_taps: st.errados,
          rule: cfg.regra || null,
          best_streak: st.melhorSerie || 0,
        });
        const taxa = st.sardinhas ? st.apanhadas / st.sardinhas : 0;
        // Regra da família: fácil = claramente fácil (quase todas as sardinhas, nenhum deslize); difícil =
        // claramente difícil demais. Uma ronda deixada a meio não muda nada.
        const facil = completo && taxa >= 0.95 && st.toquesGato === 0 && st.errados === 0;
        const dificil = completo && (taxa < 0.45 || st.toquesGato > Math.max(2, st.gatos / 2) || st.errados > Math.max(3, st.outros / 2));
        ajustarNivel("sardinha", NIVEIS.length, { completo, facil, dificil });
      },
    };

    // Cenário: céu com as fitas dos santos populares, o mar, um cesto que conta.
    const cena = el("div", { class: "sardinhas" });
    const fitas = el("div", { class: "bandeirinhas" });
    for (let i = 0; i < 16; i++) fitas.append(el("i", { style: { background: CORES[i % CORES.length] } }));
    const agua = el("div", { class: "agua" });
    const conta = el("b", {}, "0");
    const cesto = el("div", { class: "contador" }, [img(SARDINHA, ""), conta]);
    // Um emblema de série por baixo do cesto, e uma barra de progresso ao longo do fundo do mar.
    const serieEl = el("div", { class: "serie" });
    const barra = el("i");
    const progresso = el("div", { class: "progresso" }, [barra]);
    cena.append(fitas, agua, cesto, serieEl, progresso);
    let serie = 0;
    function mudarSerie(k) {
      serie = k;
      serieEl.textContent = serie >= 3 ? `${serie} seguidas` : "";
      serieEl.classList.toggle("ve", serie >= 3);
      if (serie >= 3) { serieEl.classList.remove("pula"); void serieEl.offsetWidth; serieEl.classList.add("pula"); }
    }
    // A regra do gato, mostrada num cartão enquanto dura.
    const cartao = el("div", { class: "regra" });
    if (cfg.regra) cena.append(cartao);
    e.corpo.replaceChildren(cena);

    const caixa = cena.getBoundingClientRect();
    const lado = Math.round(Math.max(ALVO_MIN + 22, Math.min(200, Math.min(caixa.width, caixa.height) * 0.27)));
    const linhaAgua = caixa.height * (caixa.width > caixa.height ? 0.72 : 0.78); // y da superfície da água
    // Com uma regra de tamanho as sardinhas grandes crescem e as pequenas encolhem, para a diferença ser clara.
    const grande = cfg.regra ? Math.round(Math.min(lado * 1.28, 240)) : lado;
    const pequena = Math.max(ALVO_MIN, Math.round(lado * 0.85));
    const margem = lado * 0.15;
    // Quantas cabem lado a lado sem se taparem.
    const cabemLado = Math.max(1, Math.floor((caixa.width - 2 * margem) / (grande * 1.2)));

    let regra = cfg.regra === "troca" ? "grandes" : cfg.regra || null;
    // O cartão mostra uma sardinha para "as grandes"; para "as prateadas" mostra os outros peixes riscados.
    function quadroRegra() {
      if (!regra) return;
      cartao.replaceChildren();
      if (regra === "grandes") {
        cartao.append(img(SARDINHA, ""), el("b", {}, REGRA_TEXTO.grandes));
      } else {
        cartao.append(el("span", { class: "nao" }, [img(OUTROS_PEIXES[0], "")]), el("b", {}, REGRA_TEXTO.prateadas));
      }
      cartao.dataset.regra = regra;
      cartao.classList.remove("novo");
      void cartao.offsetWidth;
      cartao.classList.add("novo");
    }

    // Os toques em qualquer sítio do cenário vão para o alvo mais próximo ao alcance: bondade para mãos a tremer.
    cena.addEventListener("pointerdown", (ev) => {
      if (!ativo) return;
      const c = cena.getBoundingClientRect();
      const x = ev.clientX;
      const y = ev.clientY;
      let melhor = null;
      for (const v of vivos) {
        if (v.apanhado || v.tocado) continue;
        const r = v.el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        if (cy - c.top > linhaAgua + v.lado * 0.15) continue; // ainda debaixo de água
        const d = Math.hypot(x - cx, y - cy);
        if (d <= v.lado * 0.78 && (!melhor || d / v.lado < melhor.d / melhor.v.lado)) melhor = { v, d, cx, cy };
      }
      if (!melhor) { st.vazios++; return; }
      if (melhor.v.tipo === "gato") tocarGato(melhor.v);
      else if (melhor.v.tipo === "outro") tocarOutro(melhor.v);
      else apanhar(melhor.v, melhor.d);
    });

    function apanhar(v, d) {
      v.apanhado = true;
      st.apanhadas++;
      st.reacoes.push(Date.now() - v.inicio);
      st.distancias.push(Math.round(d));
      conta.textContent = String(st.apanhadas);
      // Uma série: cada sardinha apanhada de seguida soa um pouco mais aguda.
      mudarSerie(serie + 1);
      som.efeito(serie < 3 ? "sardinha-apanha" : `sardinha-serie${Math.min(4, serie - 2)}`, 0.8);
      st.melhorSerie = Math.max(st.melhorSerie || 0, serie);
      // Parar onde está, depois voar para o cesto.
      const r = v.el.getBoundingClientRect();
      const c = cena.getBoundingClientRect();
      const destino = cesto.getBoundingClientRect();
      v.anim.cancel();
      v.el.style.left = `${r.left - c.left}px`;
      v.el.style.top = `${r.top - c.top}px`;
      v.el.style.transform = "none";
      v.el.classList.add("apanhada");
      const dx = destino.left + destino.width / 2 - (r.left + r.width / 2);
      const dy = destino.top + destino.height / 2 - (r.top + r.height / 2);
      const voo = v.el.animate([
        { transform: "translate(0, 0) scale(1.15) rotate(0)" },
        { transform: `translate(${dx}px, ${dy}px) scale(0.3) rotate(360deg)`, opacity: 0.6 },
      ], { duration: v.ouro ? 1100 : 650, easing: "ease-in", fill: "forwards" });
      cesto.classList.remove("recebe");
      void cesto.offsetWidth;
      cesto.classList.add("recebe");
      voo.onfinish = () => { v.el.remove(); v.acabar(); };
      if (v.ouro) {
        st.ourosApanhados++;
        confetes(cena, 40);
        som.efeito("vitoria2", 0.5);
        e.dizer(st.ourosApanhados % 2 ? "sardinha.ouro1" : "sardinha.ouro2", { cara: CARA_AMOR });
      } else if (st.apanhadas % 5 === 0) {
        e.dizer(Date.now() - v.inicio < v.dur * 0.35 ? "geral.rapidez" : som.elogio(), { cara: CARA_FELIZ });
      }
    }

    function tocarGato(v) {
      if (v.tocado) return;
      v.tocado = true;
      st.toquesGato++;
      mudarSerie(0);
      som.efeito("sardinha-gato", 0.7);
      v.el.querySelector("img").src = "img/noto/gato_feliz.svg";
      v.el.classList.add("riso");
      const linhas = ["sardinha.gato1", "sardinha.gato2", "sardinha.gato3"];
      e.dizer(linhas[(st.toquesGato - 1) % linhas.length], { cara: CARA_FELIZ });
    }

    // Um peixe que a regra manda deixar: abana e segue a nadar. A cada três deslizes, a regra outra vez.
    function tocarOutro(v) {
      if (v.tocado) return;
      v.tocado = true;
      st.errados++;
      mudarSerie(0);
      som.efeito("sardinha-gato", 0.5);
      v.el.classList.add("riso");
      if (st.errados % 3 === 0) e.dizer(`sardinha.so_${regra}`);
      else if (v.pequena) e.dizer(st.errados % 2 ? "sardinha.pequena1" : "sardinha.pequena2", { cara: CARA_FELIZ });
      else e.dizer(st.errados % 2 ? "sardinha.outro1" : "sardinha.outro2", { cara: CARA_FELIZ });
    }

    // Um salto. tipo: "peixe" (uma sardinha para apanhar), "gato" ou "outro" (deixar em paz).
    // Resolve quando é apanhado ou volta à água.
    function saltar(s, x0, x1) {
      return new Promise((acabar) => {
        const { tipo, ouro, pequena: peq } = s;
        const t = tipo === "outro" && peq ? pequena : tipo === "gato" ? lado : grande;
        const figura = tipo === "gato" ? "img/noto/gato.svg" : tipo === "outro" && !peq ? OUTROS_PEIXES[Math.floor(Math.random() * OUTROS_PEIXES.length)] : SARDINHA;
        const classes = ["alvo", tipo === "gato" ? "gato" : "peixe"];
        if (ouro) classes.push("ouro");
        if (peq) classes.push("pequena");
        if (tipo === "outro" && !peq) classes.push("outro");
        const b = el("button", { class: classes.join(" "), style: { width: `${t}px`, height: `${t}px`, left: `${x0}px`, top: `${linhaAgua + t * 0.2}px` } },
          [img(figura, "")]);
        if (ouro) b.append(Object.assign(img("img/noto/brilho.svg", ""), { className: "brilho" }));
        b.tabIndex = -1;
        cena.insertBefore(b, agua);
        const altoMax = linhaAgua - t * 0.1 - 6;
        const subida = tipo === "gato" ? t * (1.1 + Math.random() * 0.3) : altoMax * (0.55 + Math.random() * 0.42);
        const dx = x1 - x0;
        const espalhar = cfg.variar ? 1 + (Math.random() * 2 - 1) * cfg.variar : 1;
        const dur = Math.round((tipo === "gato" ? cfg.dur * 1.2 : cfg.dur) * espalhar * (ouro ? 1.1 : 1));
        const rodar = tipo === "gato" ? 0 : (dx > 0 ? 1 : dx < 0 ? -1 : (Math.random() < 0.5 ? 1 : -1));
        // Uma sardinha que dá a volta: sai por um lado, abana lá em cima, desce pelo outro.
        const vira = tipo !== "gato" && dx !== 0 && cfg.vira && Math.random() < cfg.vira;
        let quadros;
        if (vira) {
          const xa = dx * 0.6;
          const xf = Math.max(margem - x0, Math.min(caixa.width - t - margem - x0, xa - dx * 0.8));
          quadros = [
            { transform: `translate(0, 0) rotate(${-10 * rodar}deg)`, easing: "cubic-bezier(.2,.7,.4,1)" },
            { transform: `translate(${xa}px, ${-subida}px) rotate(${40 * rodar}deg)`, offset: 0.42 },
            { transform: `translate(${xa}px, ${-subida * 1.02}px) rotate(${-30 * rodar}deg)`, offset: 0.56, easing: "cubic-bezier(.6,0,.8,.3)" },
            { transform: `translate(${xf}px, 0) rotate(${-170 * rodar}deg)` },
          ];
        } else {
          quadros = [
            { transform: `translate(0, 0) rotate(${-10 * rodar}deg)`, easing: "cubic-bezier(.2,.7,.4,1)" },
            { transform: `translate(${dx * 0.45}px, ${-subida}px) rotate(${40 * rodar}deg)`, offset: 0.42 },
            { transform: `translate(${dx * 0.55}px, ${-subida}px) rotate(${80 * rodar}deg)`, offset: 0.58, easing: "cubic-bezier(.6,0,.8,.3)" },
            { transform: `translate(${dx}px, 0) rotate(${170 * rodar}deg)` },
          ];
        }
        const anim = b.animate(quadros, { duration: dur, fill: "forwards" });
        const v = { el: b, anim, tipo, ouro, pequena: peq, lado: t, dur, inicio: Date.now(), acabar: () => {} };
        let feito = false;
        v.acabar = () => { if (feito) return; feito = true; vivos.delete(v); acabar(); };
        vivos.add(v);
        if (tipo === "gato") st.gatos++;
        else if (tipo === "outro") st.outros++;
        else { st.sardinhas++; if (ouro) st.ouros++; }
        anim.onfinish = () => {
          if (v.apanhado) return;
          if (tipo === "peixe") mudarSerie(0); // uma sardinha escapou: a série recomeça
          b.remove();
          v.acabar();
        };
        if (tipo !== "gato") setTimeout(() => { if (ativo) som.agua(); }, 120);
      });
    }

    function posicoes(quantos) {
      const larg = caixa.width - grande - margem * 2;
      const escolhidos = [];
      for (let k = 0; k < quantos; k++) {
        let x;
        let tent = 0;
        do { x = margem + Math.random() * larg; tent++; } while (tent < 40 && escolhidos.some((o) => Math.abs(o - x) < grande * 1.2));
        escolhidos.push(x);
      }
      return escolhidos.map((x) => {
        if (!cfg.lado) return [x, x];
        const desvio = (0.22 + Math.random() * 0.18) * caixa.width * (Math.random() < 0.5 ? -1 : 1);
        const x1 = Math.max(margem, Math.min(caixa.width - grande - margem, x + desvio));
        return [x, x1];
      });
    }

    await e.dizer("sardinha.instrucao");
    if (!ativo) return;
    if (cfg.gato > 0) {
      await e.dizer("sardinha.instrucao_gato");
      if (!ativo) return;
    }
    if (cfg.lado) {
      await e.dizer("sardinha.lateral");
      if (!ativo) return;
    }
    if (cfg.tres) { await e.dizer("sardinha.varias"); if (!ativo) return; }
    if (cfg.vira) { await e.dizer("sardinha.vira"); if (!ativo) return; }
    if (cfg.ouro) { await e.dizer("sardinha.ouro_aviso"); if (!ativo) return; }
    if (regra) {
      quadroRegra();
      await e.dizer(`sardinha.so_${regra}`);
      if (!ativo) return;
    }
    await espera(600);

    let feitos = 0;
    let falhadasSeguidas = 0;
    let trocas = 0;
    while (ativo && feitos < cfg.n) {
      // "troca": o gato muda de regra a um terço e a dois terços do caminho.
      if (cfg.regra === "troca" && trocas < 2 && feitos >= (cfg.n * (trocas + 1)) / 3) {
        trocas++;
        regra = regra === "grandes" ? "prateadas" : "grandes";
        quadroRegra();
        await e.dizer("sardinha.muda");
        if (!ativo) return;
        await e.dizer(`sardinha.so_${regra}`);
        if (!ativo) return;
        await espera(400);
      }
      const resta = cfg.n - feitos;
      let quantos = 1;
      if (feitos > 1 && resta >= 3 && cfg.tres && Math.random() < cfg.tres) quantos = 3;
      else if (feitos > 1 && resta >= 2 && Math.random() < cfg.dois) quantos = 2;
      quantos = Math.min(quantos, cabemLado);
      // Tipos: sem gato nem outros peixes nos primeiros saltos, nunca dois gatos juntos, sempre uma sardinha.
      const saltos = Array.from({ length: quantos }, () => {
        if (feitos > 2 && Math.random() < cfg.gato) return { tipo: "gato" };
        if (regra && feitos > 2 && Math.random() < cfg.outros) return { tipo: "outro", pequena: regra === "grandes" };
        return { tipo: "peixe", ouro: !!cfg.ouro && regra !== "prateadas" && feitos > 3 && Math.random() < cfg.ouro };
      });
      let gatos = 0;
      for (const s of saltos) if (s.tipo === "gato" && ++gatos > 1) Object.assign(s, { tipo: "peixe", ouro: false });
      if (quantos > 1 && !saltos.some((s) => s.tipo === "peixe")) saltos[0] = { tipo: "peixe", ouro: false };
      if (saltos.filter((s) => s.ouro).length > 1) saltos.forEach((s, k) => { if (k > 0) s.ouro = false; });
      const antes = st.apanhadas;
      const peixes = saltos.filter((s) => s.tipo === "peixe").length;
      const pos = posicoes(quantos);
      await Promise.all(saltos.map((s, k) => saltar(s, pos[k][0], pos[k][1])));
      if (!ativo) return;
      feitos += quantos;
      barra.style.transform = `scaleX(${Math.min(1, feitos / cfg.n)})`;
      const apanhadasAgora = st.apanhadas - antes;
      if (peixes > 0 && apanhadasAgora === 0) {
        falhadasSeguidas++;
        if (falhadasSeguidas === 3) {
          falhadasSeguidas = 0;
          await e.dizer("sardinha.calma");
        } else if (Math.random() < 0.3) {
          e.dizer("sardinha.fugiu");
        }
      } else if (peixes > 0) {
        falhadasSeguidas = 0;
      }
      await espera(500 + Math.random() * 900);
    }
    if (!ativo) return;

    await espera(500);
    if (!ativo) return;
    cesto.classList.add("final");
    await e.dizer("sardinha.fim", { cara: CARA_AMOR });
    if (!ativo) return;
    // Melhor do que na última ronda neste nível? Dizê-lo.
    const taxa = st.sardinhas ? st.apanhadas / st.sardinhas : 0;
    const antes = ler("sardinha.ultima", null);
    gravar("sardinha.ultima", { nivel: n, taxa });
    if (antes && antes.nivel === n && taxa > antes.taxa + 0.01) {
      await e.dizer("sardinha.melhor", { cara: CARA_AMOR });
      if (!ativo) return;
    }
    ronda.registar(true);
    ronda = null;
    const r = await premio(e, e.raiz);
    if (r === "outra") comecar();
    else terminar(true);
  }

  comecar();
  return () => terminar(false);
}
