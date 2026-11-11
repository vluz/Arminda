// Labirinto: a pessoa arrasta o gato com o dedo por um labirinto até ao peixe.
// Muito tolerante: o gato só anda pelos corredores abertos, encosta-se ao meio do corredor, dobra
// as esquinas sozinho quando o dedo aponta para lá, e para nas paredes sem castigo nenhum.
// Levantar o dedo deixa o gato onde está. Não corre nenhum ciclo enquanto a pessoa não arrasta.
// Níveis baixos: poucos corredores largos. Níveis mais altos: labirintos mais apertados
// (corredores de pelo menos 60 px), estrelas para apanhar pelo caminho, depois um segundo
// objetivo (um novelo de lã).

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel, ler, gravar } from "../estado.js";
import { el, img, ecra, espera, premio, estilo } from "../ui.js";

// c x r: tamanho do labirinto num ecrã largo (trocado num ecrã ao alto). mazes: labirintos por ronda.
// estrelas: estrelas pelo caminho; fora: estrelas a mais, fora do caminho; dois: um segundo objetivo.
const NIVEIS = [
  { c: 3, r: 2, mazes: 4 },
  { c: 4, r: 3, mazes: 4 },
  { c: 5, r: 3, mazes: 3 },
  { c: 6, r: 4, mazes: 3 },
  { c: 7, r: 4, mazes: 3, estrelas: 2 },
  { c: 8, r: 5, mazes: 3, estrelas: 3 },
  { c: 9, r: 5, mazes: 2, estrelas: 3 },
  { c: 10, r: 6, mazes: 2, estrelas: 3, dois: true },
  { c: 12, r: 6, mazes: 2, estrelas: 4, fora: 1, dois: true },
  { c: 13, r: 7, mazes: 2, estrelas: 4, fora: 2, dois: true },
  { c: 16, r: 8, mazes: 2, estrelas: 5, fora: 2, dois: true },
];
// O corredor mais estreito que a família aceita neste jogo, e o mais largo que vale a pena desenhar.
const MIN_CEL = 60;
const MAX_CEL = 200;
const N = 1;
const E = 2;
const S = 4;
const O = 8;
const PASSO = 0.1;
const EPS = 1e-6;

function aleatorio(s) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Geração por retrocesso (com uma pilha explícita): abre[i] guarda os lados abertos da casa i.
function gerarLabirinto(C, R, rnd) {
  const abre = new Uint8Array(C * R);
  const visto = new Uint8Array(C * R);
  const pilha = [0];
  visto[0] = 1;
  const passos = [[0, -1, N, S], [1, 0, E, O], [0, 1, S, N], [-1, 0, O, E]];
  while (pilha.length) {
    const i = pilha[pilha.length - 1];
    const c = i % C;
    const r = Math.floor(i / C);
    const viz = passos.filter(([dc, dr]) => {
      const cc = c + dc;
      const rr = r + dr;
      return cc >= 0 && cc < C && rr >= 0 && rr < R && !visto[rr * C + cc];
    });
    if (!viz.length) { pilha.pop(); continue; }
    const [dc, dr, lado, oposto] = viz[Math.floor(rnd() * viz.length)];
    const j = (r + dr) * C + (c + dc);
    abre[i] |= lado;
    abre[j] |= oposto;
    visto[j] = 1;
    pilha.push(j);
  }
  return abre;
}

// Distâncias e casas de origem a partir de uma casa (em largura primeiro).
function bfs(abre, C, R, de) {
  const dist = new Int16Array(C * R).fill(-1);
  const pai = new Int16Array(C * R).fill(-1);
  dist[de] = 0;
  const fila = [de];
  for (let k = 0; k < fila.length; k++) {
    const i = fila[k];
    const c = i % C;
    for (const [lado, j] of [[N, i - C], [E, c < C - 1 ? i + 1 : -1], [S, i + C], [O, c > 0 ? i - 1 : -1]]) {
      if ((abre[i] & lado) && j >= 0 && j < C * R && dist[j] < 0) {
        dist[j] = dist[i] + 1;
        pai[j] = i;
        fila.push(j);
      }
    }
  }
  return { dist, pai };
}

function caminho(pai, ate) {
  const lista = [];
  for (let i = ate; i >= 0; i = pai[i]) lista.unshift(i);
  return lista;
}

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  const pronto = estilo("labirinto");
  const marcador = el("div", { class: "lab-marcador" });
  const e = ecra(() => terminar(false), [marcador]);
  e.raiz.classList.add("lab-ecra");
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let limpar = () => {};
  const temporizadores = [];

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    limpar();
    temporizadores.forEach(clearTimeout);
    if (!completo && ronda) ronda.registar(false);
    e.raiz.remove();
    sair();
  }
  const depois = (ms, f) => temporizadores.push(setTimeout(() => { if (ativo) f(); }, ms));

  async function comecar() {
    await pronto;
    if (!ativo) return;
    const n = nivel("labirinto");
    const cfg = NIVEIS[n - 1];
    const caixa = e.corpo.getBoundingClientRect();
    const W = caixa.width * 0.97;
    const H = caixa.height * 0.97;
    // Ecrã ao alto: o labirinto também fica ao alto.
    let [C, R] = W >= H ? [cfg.c, cfg.r] : [cfg.r, cfg.c];
    // O ecrã limita o tamanho: os corredores nunca ficam abaixo de MIN_CEL.
    while (Math.min(W / C, H / R) < MIN_CEL && (C > 2 || R > 2)) {
      if (W / C < H / R) C--;
      else R--;
    }
    const cel = Math.floor(Math.min(MAX_CEL, W / C, H / R));

    const inicio = Date.now();
    let feitos = 0;
    let estrelas = 0;
    let estrelasTotal = 0;
    let otimo = 0;
    let andadas = 0;
    let paragens = 0;
    let falhasAgarrar = 0;
    let pistas = 0;
    const tempos = [];

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        const eficiencia = andadas ? Math.min(1, Math.round((otimo / andadas) * 100) / 100) : null;
        const mediana = metricas.mediana(tempos);
        metricas.ronda("labirinto", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: estrelas,
          maze: `${C}x${R}`,
          cell_px: cel,
          mazes: cfg.mazes,
          mazes_done: feitos,
          stars: estrelas,
          stars_total: estrelasTotal,
          two_goals: !!cfg.dois,
          shortest_cells: otimo,
          cells_moved: andadas,
          wall_stops: paragens,
          missed_grabs: falhasAgarrar,
          hints_needed: pistas,
          ms_per_maze_median: mediana,
          accuracy: eficiencia,
        });
        // Claramente fácil: sem pista, poucos desvios e rápido. Claramente difícil: uma pista na maior parte dos labirintos.
        const rapido = C * R * 700;
        const facil = completo && pistas === 0 && eficiencia != null && eficiencia >= 0.7 && mediana != null && mediana <= rapido;
        const dificil = completo && pistas >= Math.max(2, cfg.mazes);
        ajustarNivel("labirinto", NIVEIS.length, { completo, facil, dificil });
      },
    };

    // Barra de cima: um peixe por labirinto (aceso quando está feito) e a contagem das estrelas.
    const peixes = [];
    const contaEstrelas = el("b", {}, "0");
    const blocoEstrelas = el("div", { class: "lab-estrelas" }, [img("img/noto/estrela.svg", ""), contaEstrelas]);
    function mostrarMarcador() {
      marcador.replaceChildren(...[el("div", { class: "lab-peixes" }, peixes), cfg.estrelas ? blocoEstrelas : null].filter(Boolean));
    }
    for (let k = 0; k < cfg.mazes; k++) peixes.push(img("img/noto/peixe.svg", ""));
    mostrarMarcador();

    await e.dizer("labirinto.comecar");
    if (!ativo) return;
    if (cfg.estrelas) {
      await e.dizer(cfg.dois ? "labirinto.dois" : "labirinto.estrelas");
      if (!ativo) return;
    }

    for (let k = 0; k < cfg.mazes && ativo; k++) {
      if (k > 0) {
        e.dizer("labirinto.outro");
      }
      await jogar(k);
      if (!ativo) return;
      feitos++;
      peixes[k].classList.add("feito");
      if (k < cfg.mazes - 1) {
        await e.dizer("labirinto.peixe", { cara: "img/noto/gato_feliz.svg" });
        if (!ativo) return;
      }
    }
    if (!ativo) return;

    if (estrelasTotal && estrelas === estrelasTotal) await e.dizer("labirinto.todas_estrelas", { cara: "img/noto/gato_amor.svg" });
    if (!ativo) return;
    await e.dizer("labirinto.fim", { cara: "img/noto/gato_amor.svg" });
    if (!ativo) return;
    ronda.registar(true);
    ronda = null;
    // Mais rápido do que na última ronda acabada neste nível.
    const mediana = metricas.mediana(tempos);
    const antes = ler("labirinto.ultima", null);
    gravar("labirinto.ultima", { nivel: n, mediana });
    if (antes && antes.nivel === n && mediana != null && antes.mediana != null && mediana < antes.mediana * 0.85) {
      await e.dizer("labirinto.recorde", { cara: "img/noto/gato_amor.svg" });
      if (!ativo) return;
    }
    const r = await premio(e, e.raiz);
    if (r === "outra") comecar();
    else terminar(true);

    // Um labirinto. Resolve quando o gato tem todos os objetivos.
    function jogar(k) {
      return new Promise((acabar) => {
        const rnd = aleatorio((Math.random() * 4294967296) >>> 0);
        const abre = gerarLabirinto(C, R, rnd);
        // Partida num canto ao acaso; o peixe vai para a casa mais distante.
        const cantos = [0, C - 1, (R - 1) * C, R * C - 1];
        const inicioCel = cantos[Math.floor(rnd() * 4)];
        const de = bfs(abre, C, R, inicioCel);
        let alvo = 0;
        for (let i = 0; i < C * R; i++) if (de.dist[i] > de.dist[alvo]) alvo = i;
        const rota = caminho(de.pai, alvo);
        const objetivos = [alvo];
        let otimoAqui = de.dist[alvo];
        let doAlvo = null;
        if (cfg.dois) {
          doAlvo = bfs(abre, C, R, alvo);
          let outro = -1;
          let melhor = -1;
          for (let i = 0; i < C * R; i++) {
            if (i === inicioCel || i === alvo) continue;
            const m = Math.min(de.dist[i], doAlvo.dist[i]);
            if (m > melhor) { melhor = m; outro = i; }
          }
          objetivos.push(outro);
          otimoAqui = Math.min(de.dist[alvo] + doAlvo.dist[outro], de.dist[outro] + doAlvo.dist[outro]);
        }
        otimo += otimoAqui;
        // Estrelas espalhadas pelo caminho, mais umas quantas em caminhos laterais nos níveis de topo.
        const lugaresEstrela = [];
        if (cfg.estrelas) {
          const meio = rota.slice(1, -1);
          for (let s = 1; s <= cfg.estrelas && meio.length; s++) {
            const i = meio[Math.floor((s * meio.length) / (cfg.estrelas + 1))];
            if (!lugaresEstrela.includes(i)) lugaresEstrela.push(i);
          }
          const naRota = new Set(rota);
          const becos = [];
          for (let i = 0; i < C * R; i++) {
            const lados = [N, E, S, O].filter((l) => abre[i] & l).length;
            if (lados === 1 && !naRota.has(i) && !objetivos.includes(i) && i !== inicioCel) becos.push(i);
          }
          for (let s = 0; s < (cfg.fora || 0) && becos.length; s++) {
            lugaresEstrela.push(becos.splice(Math.floor(rnd() * becos.length), 1)[0]);
          }
        }
        estrelasTotal += lugaresEstrela.length;

        // Desenho: corredores de areia, paredes como sebes verdes e grossas com contorno escuro.
        const largura = C * cel;
        const altura = R * cel;
        const parede = Math.max(7, Math.min(18, cel * 0.13));
        const u = parede / cel;
        let d = `M0 0H${C}V${R}H0Z`;
        for (let i = 0; i < C * R; i++) {
          const c = i % C;
          const r = Math.floor(i / C);
          if (c < C - 1 && !(abre[i] & E)) d += `M${c + 1} ${r}V${r + 1}`;
          if (r < R - 1 && !(abre[i] & S)) d += `M${c} ${r + 1}H${c + 1}`;
        }
        const svg = `<svg viewBox="${-u} ${-u} ${C + 2 * u} ${R + 2 * u}" width="${largura + 2 * parede}" height="${altura + 2 * parede}" aria-hidden="true">`
          + `<path d="${d}" fill="none" stroke="#111" stroke-width="${u + 6 / cel}" stroke-linecap="round" stroke-linejoin="round"/>`
          + `<path d="${d}" fill="none" stroke="#2b9348" stroke-width="${u}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        const area = el("div", { class: "lab-area", style: { width: `${largura}px`, height: `${altura}px`, "--cel": `${cel}px`, "--parede": `${parede}px` } });
        area.append(el("div", { class: "lab-paredes", html: svg }));
        // O gato move-se por transform; tudo o resto fica parado com left/top, para as animações
        // dele (que usam transform) não o tirarem do sítio.
        const pos = (x, y, tam) => `translate(${(x + 0.5) * cel - tam / 2}px, ${(y + 0.5) * cel - tam / 2}px)`;
        const lugar = (i, tam) => ({
          left: `${((i % C) + 0.5) * cel - tam / 2}px`,
          top: `${(Math.floor(i / C) + 0.5) * cel - tam / 2}px`,
          width: `${tam}px`,
          height: `${tam}px`,
        });
        const coloca = (src, classe, i, fator) => {
          const tam = Math.round(cel * fator);
          const im = img(src, "");
          im.className = classe;
          im.style.width = `${tam}px`;
          im.style.height = `${tam}px`;
          Object.assign(im.style, lugar(i, tam));
          area.append(im);
          return im;
        };
        const itens = [];
        lugaresEstrela.forEach((i) => itens.push({ i, tipo: "estrela", el: coloca("img/noto/estrela.svg", "lab-item lab-estrela", i, 0.6) }));
        objetivos.forEach((i, j) => itens.push({ i, tipo: "alvo", el: coloca(j === 0 ? "img/noto/peixe.svg" : "img/noto/novelo.svg", "lab-item lab-alvo", i, 0.78) }));
        const tamBola = Math.round(cel * 0.78);
        const bola = img("img/noto/gato.svg", "");
        bola.className = "lab-bola convida";
        bola.style.width = `${tamBola}px`;
        bola.style.height = `${tamBola}px`;
        area.append(bola);
        e.corpo.replaceChildren(el("div", { class: "lab-mesa" }, [area]));
        area.classList.add("entra");

        // O gato, em unidades de casa: os centros das casas são números inteiros.
        let bx = inicioCel % C;
        let by = Math.floor(inicioCel / C);
        let celAtual = inicioCel;
        const visitadas = new Set([inicioCel]);
        let acabou = false;
        let ultimoProgresso = Date.now();
        let ultimaPista = 0;
        let pistaEls = [];
        let falhasAqui = 0;
        let parado = false;
        const comeco = Date.now();
        const desenhar = () => { bola.style.transform = pos(bx, by, tamBola); };
        desenhar();

        const aberto = (c, r, lado) => (abre[r * C + c] & lado) !== 0;

        // Move o gato na direção do dedo pelos corredores abertos, um pequeno passo de cada vez.
        // Devolve verdadeiro quando parou numa parede com o dedo ainda longe.
        function mover(fx, fy) {
          fx = Math.max(0, Math.min(C - 1, fx));
          fy = Math.max(0, Math.min(R - 1, fy));
          const vistos = new Set();
          for (let k2 = 0; k2 < 800 && !acabou; k2++) {
            const dx = fx - bx;
            const dy = fy - by;
            if (Math.abs(dx) < 0.02 && Math.abs(dy) < 0.02) return false;
            const emX = Math.abs(bx - Math.round(bx)) < EPS;
            const emY = Math.abs(by - Math.round(by)) < EPS;
            let mx = 0;
            let my = 0;
            let virar = false;
            if (emX && emY) {
              // No centro de uma casa: ir para onde o dedo mais aponta, se estiver aberto; senão para o outro lado.
              bx = Math.round(bx);
              by = Math.round(by);
              const chave = by * C + bx;
              if (vistos.has(chave)) return false;
              vistos.add(chave);
              for (const eixo of Math.abs(dx) >= Math.abs(dy) ? ["x", "y"] : ["y", "x"]) {
                const dd = eixo === "x" ? dx : dy;
                if (Math.abs(dd) < 0.12) continue;
                const lado = eixo === "x" ? (dd > 0 ? E : O) : (dd > 0 ? S : N);
                if (aberto(bx, by, lado)) {
                  if (eixo === "x") mx = Math.sign(dd);
                  else my = Math.sign(dd);
                  break;
                }
              }
              if (!mx && !my) return Math.hypot(dx, dy) > 0.6;
            } else if (emY) {
              // Num corredor na horizontal: ir para a ponta onde se pode virar, se a pessoa apontar para lá.
              const a = Math.floor(bx);
              const b = a + 1;
              const r = Math.round(by);
              if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) >= 0.12) {
                const lado = dy > 0 ? S : N;
                const pa = aberto(a, r, lado);
                const pb = aberto(b, r, lado);
                const fim = pa && pb ? (bx - a <= b - bx ? a : b) : pa ? a : pb ? b : null;
                if (fim !== null) { mx = Math.sign(fim - bx); virar = true; }
              }
              if (!mx) mx = Math.abs(dx) >= 0.02 ? Math.sign(dx) : 0;
              if (!mx) return false;
            } else {
              // Num corredor na vertical.
              const a = Math.floor(by);
              const b = a + 1;
              const c = Math.round(bx);
              if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= 0.12) {
                const lado = dx > 0 ? E : O;
                const pa = aberto(c, a, lado);
                const pb = aberto(c, b, lado);
                const fim = pa && pb ? (by - a <= b - by ? a : b) : pa ? a : pb ? b : null;
                if (fim !== null) { my = Math.sign(fim - by); virar = true; }
              }
              if (!my) my = Math.abs(dy) >= 0.02 ? Math.sign(dy) : 0;
              if (!my) return false;
            }
            if (mx) {
              const prox = mx > 0 ? Math.floor(bx + EPS) + 1 : Math.ceil(bx - EPS) - 1;
              let lim = Math.abs(prox - bx);
              if (!virar) lim = Math.min(lim, Math.abs(dx));
              bx += mx * Math.min(PASSO, lim);
              if (Math.abs(bx - Math.round(bx)) < EPS) bx = Math.round(bx);
            } else {
              const prox = my > 0 ? Math.floor(by + EPS) + 1 : Math.ceil(by - EPS) - 1;
              let lim = Math.abs(prox - by);
              if (!virar) lim = Math.min(lim, Math.abs(dy));
              by += my * Math.min(PASSO, lim);
              if (Math.abs(by - Math.round(by)) < EPS) by = Math.round(by);
            }
            depoisDoPasso();
          }
          return false;
        }

        // Casa nova: uma pegada; perto de uma coisa: apanhá-la.
        function depoisDoPasso() {
          const i = Math.round(by) * C + Math.round(bx);
          // Contar uma casa só quando o gato está perto do centro dela: na linha entre duas casas um
          // dedo a tremer faria a contagem saltar para um lado e para o outro em cada imagem.
          const perto = Math.abs(bx - Math.round(bx)) < 0.4 && Math.abs(by - Math.round(by)) < 0.4;   // o objetivo é apanhado a menos de 0.35
          if (perto && i !== celAtual) {
            celAtual = i;
            andadas++;
            if (!visitadas.has(i)) {
              visitadas.add(i);
              ultimoProgresso = Date.now();
              const tam = Math.round(cel * 0.28);
              const p = el("i", { class: "lab-rasto", style: lugar(i, tam) });
              area.insertBefore(p, area.children[1]);
            }
          }
          for (const it of itens) {
            if (it.feito || Math.hypot(bx - (it.i % C), by - Math.floor(it.i / C)) > 0.35) continue;
            it.feito = true;
            it.el.classList.add("apanhado");
            ultimoProgresso = Date.now();
            if (it.tipo === "estrela") {
              estrelas++;
              contaEstrelas.textContent = String(estrelas);
              blocoEstrelas.classList.remove("viva");
              void blocoEstrelas.offsetWidth;
              blocoEstrelas.classList.add("viva");
              som.efeito("labirinto-estrela", 0.7);
            } else if (itens.some((x) => x.tipo === "alvo" && !x.feito)) {
              som.efeito("par", 0.6);
              e.dizer("labirinto.metade", { cara: "img/noto/gato_feliz.svg" });
            } else {
              acabou = true;
            }
          }
        }

        // Mostra as casas seguintes em direção ao objetivo mais próximo como pontos amarelos, por uns segundos.
        function mostrarPista() {
          pistas++;
          ultimaPista = Date.now();
          const daqui = bfs(abre, C, R, celAtual);
          const alvos = itens.filter((x) => x.tipo === "alvo" && !x.feito).map((x) => x.i);
          const destino = alvos.sort((a, b) => daqui.dist[a] - daqui.dist[b])[0];
          const passos = caminho(daqui.pai, destino).slice(1, 8);
          const tam = Math.round(cel * 0.3);
          pistaEls = passos.map((i, j) => {
            const p = el("i", { class: "lab-pista", style: { ...lugar(i, tam), animationDelay: `${j * 0.12}s` } });
            area.append(p);
            return p;
          });
          const estes = pistaEls;
          depois(4500, () => estes.forEach((p) => p.remove()));
          e.dizer("labirinto.pista");
        }

        // Tratamento do ponteiro: o gato só segue enquanto o dedo da pessoa o segura.
        let ponteiro = null;
        let retangulo = null;
        let dedo = null;
        let quadro = 0;
        const paraCel = (ev) => [(ev.clientX - retangulo.left) / cel - 0.5, (ev.clientY - retangulo.top) / cel - 0.5];
        function aplicar() {
          quadro = 0;
          if (!dedo || acabou) return;
          const bateu = mover(dedo[0], dedo[1]);
          desenhar();
          if (bateu && !parado) paragens++;
          parado = bateu;
          if (acabou) { soltar(); concluir(); return; }
          // Preso há um bocado contra as paredes: oferecer o caminho.
          const t = Date.now();
          if (bateu && t - ultimoProgresso > 12000 && t - ultimaPista > 12000) mostrarPista();
        }
        function premir(ev) {
          if (acabou || ponteiro !== null) return;
          retangulo = area.getBoundingClientRect();
          const [fx, fy] = paraCel(ev);
          const raio = Math.max(0.9, 75 / cel);
          if (Math.hypot(fx - bx, fy - by) > raio) {
            falhasAgarrar++;
            falhasAqui++;
            bola.classList.remove("convida");
            void bola.offsetWidth;
            bola.classList.add("convida");
            if (falhasAqui === 2 || falhasAqui === 6) e.dizer("labirinto.agarra");
            return;
          }
          ponteiro = ev.pointerId;
          try { area.setPointerCapture(ev.pointerId); } catch { /* não é suportado: funciona na mesma*/ }
          bola.classList.remove("convida");
          bola.classList.add("agarrada");
          som.efeito("toque", 0.35);
          dedo = [fx, fy];
          aplicar();
        }
        function arrastar(ev) {
          if (ev.pointerId !== ponteiro) return;
          dedo = paraCel(ev);
          if (!quadro) quadro = requestAnimationFrame(aplicar);
        }
        function soltar() {
          if (quadro) cancelAnimationFrame(quadro);
          quadro = 0;
          dedo = null;
          ponteiro = null;
          parado = false;
          bola.classList.remove("agarrada");
        }
        function largar(ev) {
          if (ev.pointerId !== ponteiro) return;
          soltar();
        }
        area.addEventListener("pointerdown", premir);
        area.addEventListener("pointermove", arrastar);
        area.addEventListener("pointerup", largar);
        area.addEventListener("pointercancel", largar);
        limpar = () => { soltar(); };

        async function concluir() {
          tempos.push(Date.now() - comeco);
          limpar = () => {};
          bola.classList.add("chegou");
          som.efeito("vitoria2", 0.5);
          pistaEls.forEach((p) => p.remove());
          await espera(1100);
          acabar();
        }
      });
    }
  }

  comecar();
  return () => terminar(false);
}
