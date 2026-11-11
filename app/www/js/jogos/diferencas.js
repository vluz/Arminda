// Diferenças: duas imagens que diferem em poucos sítios. A pessoa toca numa diferença em qualquer
// das imagens; aparece um círculo grande e vivo nas duas. As imagens são feitas em código a partir
// de uma cena, copiadas e depois mudadas (um objeto a menos, uma cor diferente, um objeto a mais,
// um objeto mudado de sítio, um objeto diferente). Ao fim de muito tempo sem encontrar nenhuma, uma
// das diferenças que faltam brilha suavemente.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { ler, gravar, nivel, ajustarNivel } from "../estado.js";
import { el, ecra, espera, premio, estilo } from "../ui.js";
import { gerar, svgImagem, LARGURA, ALTURA } from "./diferencas-cenas.js";

const ID = "diferencas";
const SVGNS = "http://www.w3.org/2000/svg";
const OBVIAS = ["falta", "extra", "troca"];
const TODAS = ["falta", "extra", "troca", "cor", "move"];
const MAIS = [...TODAS, "espelho", "detalhe", "tamanho"];
const SUBTIS = ["troca", "cor", "move", "espelho", "detalhe", "tamanho"];

// difs: diferenças por imagem; imagens: imagens por ronda; subtil: mudanças de cor mais pequenas e
// objetos mais pequenos; pista: segundos sem encontrar nada até uma diferença brilhar.
const NIVEIS = [
  { difs: 2, tipos: OBVIAS, subtil: false, imagens: 2, pista: 25 },
  { difs: 3, tipos: OBVIAS, subtil: false, imagens: 2, pista: 30 },
  { difs: 4, tipos: [...OBVIAS, "cor"], subtil: false, imagens: 1, pista: 35 },
  { difs: 4, tipos: TODAS, subtil: false, imagens: 1, pista: 40 },
  { difs: 5, tipos: TODAS, subtil: true, imagens: 1, pista: 45 },
  { difs: 6, tipos: TODAS, subtil: true, imagens: 1, pista: 50 },
  // Segundo patamar (a pedido da família): cenas mais cheias com objetos mais pequenos (ainda
  // cerca de 1,5 cm num ecrã de 7 polegadas), tipos mais subtis, depois enfeites no fundo.
  { difs: 6, tipos: TODAS, subtil: true, imagens: 1, pista: 55, densa: true },
  { difs: 7, tipos: MAIS, subtil: true, imagens: 1, pista: 60, densa: true },
  { difs: 8, tipos: MAIS, subtil: true, imagens: 1, pista: 70, densa: true, enfeites: true },
  { difs: 8, tipos: SUBTIS, subtil: true, imagens: 1, pista: 80, densa: true, enfeites: true },
  { difs: 9, tipos: SUBTIS, subtil: true, imagens: 1, pista: 90, densa: true, enfeites: true },
];
const SEGUIDOS_PISTA = 5; // toques errados seguidos até uma diferença brilhar

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo(ID);
  const placar = el("div", { class: "dif-placar" });
  const e = ecra(() => terminar(false), [placar]);
  e.raiz.classList.add("dif-ecra");
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let relogio = null;
  let ultimaCena = null;
  let primeiraVez = true;
  let avisouPormenores = false;
  let serie = 0; // diferenças encontradas de seguida sem um toque errado
  let melhorSerie = 0;

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    clearTimeout(relogio);
    if (!completo && ronda) ronda.registar(false);
    e.raiz.remove();
    sair();
  }

  // Tamanho das imagens: lado a lado ou uma por cima da outra, o que der imagens maiores.
  function medidas() {
    const c = e.corpo.getBoundingClientRect();
    const gap = Math.max(14, Math.min(c.width, c.height) * 0.03);
    const folga = 0.985;
    const ladoALado = Math.min((c.width - gap) / 2, (c.height * LARGURA) / ALTURA) * folga;
    const empilhado = Math.min(c.width, ((c.height - gap) / 2) * (LARGURA / ALTURA)) * folga;
    const coluna = empilhado > ladoALado;
    const w = Math.floor(coluna ? empilhado : ladoALado);
    return { coluna, w, h: Math.floor((w * ALTURA) / LARGURA), gap };
  }

  async function comecar() {
    const n = nivel(ID);
    const cfg = NIVEIS[n - 1];
    const inicio = Date.now();
    const tempos = [];
    let encontradas = 0;
    let total = 0;
    let errados = 0;
    let pistas = 0;
    let imagensFeitas = 0;
    serie = 0;
    melhorSerie = 0;

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        metricas.ronda(ID, {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: encontradas,
          differences: total,
          pictures: imagensFeitas,
          wrong_taps: errados,
          hints_needed: pistas,
          accuracy: encontradas + errados ? Math.round((encontradas / (encontradas + errados)) * 100) / 100 : null,
          ms_per_difference_median: metricas.mediana(tempos),
          best_streak: melhorSerie,
        });
        const med = metricas.mediana(tempos) || 0;
        // Claramente fácil: sem pista, poucos toques errados, e uma diferença encontrada a cada 12 s ou perto disso.
        const facil = completo && pistas === 0 && errados <= total / 3 && med < 12000;
        const dificil = completo && (pistas > total / 2 || errados > total * 3);
        ajustarNivel(ID, NIVEIS.length, { completo, facil, dificil });
      },
    };

    for (let img = 0; img < cfg.imagens; img++) {
      const ok = await jogarImagem(cfg, img, {
        achou(ms) { encontradas++; tempos.push(ms); },
        errou() { errados++; },
        pista() { pistas++; },
        contar(k) { total += k; },
      });
      if (!ok || !ativo) return;
      imagensFeitas++;
    }

    await e.dizer("diferencas.todas", { cara: "img/noto/gato_amor.svg" });
    if (!ativo) return;
    // Mais rápido por diferença do que na última ronda neste nível: dizê-lo à pessoa.
    const porDif = (Date.now() - inicio) / Math.max(1, total);
    const antes = ler("diferencas.anterior", null);
    if (antes && antes.nivel === n && porDif < antes.porDif) {
      await e.dizer("diferencas.melhor", { cara: "img/noto/gato_amor.svg" });
      if (!ativo) return;
    }
    gravar("diferencas.anterior", { nivel: n, porDif });
    ronda.registar(true);
    ronda = null;
    const r = await premio(e, e.raiz);
    if (!ativo) return;
    if (r === "outra") comecar();
    else terminar(true);
  }

  // Um par de imagens. Resolve com verdadeiro quando todas as diferenças foram encontradas.
  function jogarImagem(cfg, indice, conta) {
    return new Promise(async (resolver) => {
      const jogo = gerar(cfg.difs, cfg.tipos, cfg.subtil, ultimaCena, { densa: cfg.densa, enfeites: cfg.enfeites });
      ultimaCena = jogo.cena;
      const difs = jogo.difs;
      conta.contar(difs.length);

      const m = medidas();
      const mesa = el("div", { class: `dif-mesa${m.coluna ? " coluna" : ""}`, style: { gap: `${m.gap}px` } });
      const quadros = ["A", "B"].map((lado, k) => {
        const q = el("div", {
          class: "dif-quadro",
          style: { width: `${m.w}px`, height: `${m.h}px` },
          html: svgImagem(jogo.fundo, jogo[lado], `dif${indice}${lado}`),
        });
        q.dataset.lado = lado;
        // Eventos de ponteiro, não cliques: as imagens não são botões, por isso os toques tolerantes da
        // app não as cobrem, e um dedo que trema mais do que a folga do browser (cerca de 8 px) perderia o
        // clique. O toque conta onde o dedo pousou primeiro, até 24 px de deslize.
        let ini = null;
        q.addEventListener("pointerdown", (ev) => { ini = { x: ev.clientX, y: ev.clientY, id: ev.pointerId }; });
        q.addEventListener("pointerup", (ev) => {
          if (!ini || ev.pointerId !== ini.id) return;
          const de = ini;
          ini = null;
          if (Math.hypot(ev.clientX - de.x, ev.clientY - de.y) > 24) return;
          tocar({ clientX: de.x, clientY: de.y }, k);
        });
        q.addEventListener("pointercancel", () => { ini = null; });
        mesa.append(q);
        return q;
      });
      // Onde estão as diferenças, em unidades da imagem, para a jogada automática.
      mesa.dataset.zonas = JSON.stringify(difs.map((d) => d.zonas));
      const svgs = quadros.map((q) => q.firstElementChild);
      const marcas = svgs.map((s) => s.querySelector(".dif-marcas"));
      e.corpo.replaceChildren(mesa);

      placar.replaceChildren(...difs.map(() => el("span")));
      let achadas = 0;
      let seguidos = 0;
      let ultimo = Date.now();
      let fim = false;

      function circulo(z, classe, r) {
        const c = document.createElementNS(SVGNS, "circle");
        c.setAttribute("cx", z.x);
        c.setAttribute("cy", z.y);
        c.setAttribute("r", r);
        c.setAttribute("class", classe);
        return c;
      }

      function armarPista() {
        clearTimeout(relogio);
        relogio = setTimeout(() => mostrarPista(), cfg.pista * 1000);
      }

      function mostrarPista() {
        if (!ativo || fim) return;
        const d = difs.find((x) => !x.achada && !x.pista);
        if (!d) return;
        d.pista = [];
        conta.pista();
        for (const mg of marcas) {
          for (const z of d.zonas) {
            const c = circulo(z, "dif-pista", z.r - 4);
            mg.prepend(c);
            d.pista.push(c);
          }
        }
        e.dizer("diferencas.pista");
        armarPista();
      }

      function ponto(ev, k) {
        const svg = svgs[k];
        const pt = svg.createSVGPoint();
        pt.x = ev.clientX;
        pt.y = ev.clientY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
      }

      function tocar(ev, k) {
        if (!ativo || fim) return;
        const p = ponto(ev, k);
        let melhor = null;
        let dist = Infinity;
        for (const d of difs) {
          if (d.achada) continue;
          for (const z of d.zonas) {
            const dd = Math.hypot(p.x - z.x, p.y - z.y);
            if (dd <= z.r && dd < dist) { melhor = d; dist = dd; }
          }
        }
        if (melhor) achar(melhor);
        else falhar(p, k);
      }

      function achar(d) {
        d.achada = true;
        achadas++;
        seguidos = 0;
        conta.achou(Date.now() - ultimo);
        ultimo = Date.now();
        (d.pista || []).forEach((c) => c.remove());
        for (const mg of marcas) {
          for (const z of d.zonas) {
            mg.append(circulo(z, "dif-achado-fundo", z.r - 8), circulo(z, "dif-achado", z.r - 8));
          }
        }
        placar.children[achadas - 1]?.classList.add("feito");
        // Encontradas de seguida sem um toque errado: cada uma com um som um pouco mais agudo.
        serie++;
        melhorSerie = Math.max(melhorSerie, serie);
        som.efeito(serie >= 2 ? `diferencas-serie${Math.min(serie - 1, 4)}` : "par");
        if (achadas === difs.length) {
          fim = true;
          clearTimeout(relogio);
          quadros.forEach((q) => q.classList.add("feito"));
          (async () => {
            await espera(900);
            if (!ativo) return;
            if (indice < cfg.imagens - 1) {
              await e.dizer("diferencas.outra_imagem", { cara: "img/noto/gato_feliz.svg" });
              if (!ativo) return;
              await espera(300);
            }
            resolver(true);
          })();
          return;
        }
        armarPista();
        const falta = difs.length - achadas;
        e.dizer(falta === 1 ? "diferencas.falta_1" : serie === 3 || serie === 5 ? `diferencas.serie_${serie}`
          : achadas === 1 ? "diferencas.achaste" : som.elogio(),
          { cara: "img/noto/gato_feliz.svg" });
      }

      function falhar(p, k) {
        conta.errou();
        seguidos++;
        serie = 0;
        const c = circulo(p, "dif-toque", 16);
        marcas[k].append(c);
        setTimeout(() => c.remove(), 800);
        som.efeito("quase", 0.25);
        if (seguidos === 3) e.dizer("diferencas.nao_e");
        if (seguidos >= SEGUIDOS_PISTA) {
          seguidos = 0;
          mostrarPista();
        }
      }

      // Deixar de esperar se a pessoa sair.
      const vigia = setInterval(() => { if (!ativo) { clearInterval(vigia); clearTimeout(relogio); resolver(false); } }, 500);
      const resolverOriginal = resolver;
      resolver = (v) => { clearInterval(vigia); resolverOriginal(v); };

      if (primeiraVez) {
        primeiraVez = false;
        await e.dizer("diferencas.instrucao");
        if (!ativo) return;
      }
      if (!avisouPormenores && cfg.tipos.includes("espelho")) {
        avisouPormenores = true;
        await e.dizer("diferencas.pormenores");
        if (!ativo) return;
      }
      if (!fim) e.dizer(`diferencas.ha_${difs.length}`);
      armarPista();
    });
  }

  comecar();
  return () => terminar(false);
}
