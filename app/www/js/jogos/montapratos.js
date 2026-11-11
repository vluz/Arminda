// Monta-pratos: um monta-pratos leva pratos da cozinha até um andar ao acaso.
// O andar acende-se e a pessoa toca nele para tirar o prato. Um prato deixado tempo demais
// vira-se e cai pelo poço com um "plof" cómico: nunca é castigo, vem logo o prato seguinte.
// Uma ronda é um número fixo de pratos, nunca um relógio.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel, ler, gravar } from "../estado.js";
import { el, img, ecra, espera, premio, estilo, ALVO_MIN } from "../ui.js";

// andares: andares pedidos (o ecrã pode deixar menos); janela: ms que o prato espera no andar;
// ms: ms por andar de viagem do elevador; vaivem: o elevador sobe e desce antes de parar;
// elevadores: elevadores lado a lado; pedidos: tipos de prato no cartão de pedido do gato (0 = sem
// cartão; pedidosMin: o cartão pode ter menos); mudancas: vezes que o gato muda o pedido numa ronda;
// passa: o elevador passa pelos andares (brilham de leve) e pode ir além antes de parar;
// sujos: probabilidade de uma viagem do segundo elevador ser um prato vazio a descer para lavar
// (é para deixar ir); n: pratos de comida por ronda. Num ecrã de 1024x600 só cabem 3 andares, por
// isso os níveis de topo juntam atenção (cartão de pedido, elevadores a passar, pratos vazios) em
// vez de andares.
const NIVEIS = [
  { andares: 3, janela: 7000, ms: 1500, vaivem: false, elevadores: 1, pedidos: 0, n: 12 },
  { andares: 4, janela: 6000, ms: 1200, vaivem: false, elevadores: 1, pedidos: 0, n: 12 },
  { andares: 5, janela: 4500, ms: 1000, vaivem: false, elevadores: 1, pedidos: 0, n: 12 },
  { andares: 6, janela: 3500, ms: 900, vaivem: false, elevadores: 1, pedidos: 0, n: 12 },
  { andares: 6, janela: 3500, ms: 850, vaivem: true, elevadores: 1, pedidos: 0, n: 12 },
  { andares: 6, janela: 3500, ms: 850, vaivem: true, elevadores: 2, pedidos: 0, n: 14 },
  { andares: 6, janela: 4000, ms: 900, vaivem: true, elevadores: 2, pedidos: 1, mudancas: 1, n: 16 },
  { andares: 6, janela: 3800, ms: 850, vaivem: true, elevadores: 2, pedidos: 1, mudancas: 2, passa: true, n: 20 },
  { andares: 6, janela: 3600, ms: 850, vaivem: true, elevadores: 2, pedidos: 2, mudancas: 2, passa: true, n: 20 },
  { andares: 6, janela: 3500, ms: 800, vaivem: true, elevadores: 2, pedidos: 2, mudancas: 3, passa: true, sujos: 0.35, n: 22 },
  { andares: 6, janela: 3200, ms: 800, vaivem: true, elevadores: 2, pedidos: 3, mudancas: 3, passa: true, sujos: 0.4, n: 22 },
  { andares: 6, janela: 3000, ms: 750, vaivem: true, elevadores: 2, pedidos: 3, pedidosMin: 1, mudancas: 4, passa: true, sujos: 0.45, n: 24 },
];
const VAZIO = "img/jogos/montapratos-prato-vazio.svg";
export const NIVEIS_MAX = NIVEIS.length;

const PRATOS = [
  { id: "caldo_verde", src: "img/jogos/cozinha-prato-caldo_verde.svg", tipo: "sopa", cor: "#4f9a3a" },
  { id: "sopa_legumes", src: "img/jogos/cozinha-prato-sopa_legumes.svg", tipo: "sopa", cor: "#f39a2b" },
  { id: "arroz_doce", src: "img/jogos/cozinha-prato-arroz_doce.svg", tipo: "doce", cor: "#f5d77a" },
  { id: "bolo_laranja", src: "img/jogos/cozinha-prato-bolo_laranja.svg", tipo: "doce", cor: "#f0a030" },
  { id: "pastel_nata", src: "img/proprio/pastel_nata.svg", tipo: "doce", cor: "#f2c14e" },
  { id: "pudim", src: "img/noto/pudim.svg", tipo: "doce", cor: "#e08a1e" },
  { id: "bacalhau_bras", src: "img/jogos/cozinha-prato-bacalhau_bras.svg", tipo: "peixe", cor: "#f7dc6f" },
  { id: "sardinhas", src: "img/jogos/cozinha-prato-sardinhas.svg", tipo: "peixe", cor: "#8aa0b4" },
  { id: "pao", src: "img/noto/pao.svg", tipo: "pao", cor: "#d9a35b" },
  { id: "queijo", src: "img/noto/queijo.svg", tipo: "pao", cor: "#ffd54f" },
  { id: "laranja", src: "img/noto/laranja.svg", tipo: "fruta", cor: "#fb8500" },
  { id: "uvas", src: "img/noto/uvas.svg", tipo: "fruta", cor: "#7b2cbf" },
  { id: "cereja", src: "img/noto/cereja.svg", tipo: "fruta", cor: "#e63946" },
  { id: "melancia", src: "img/noto/melancia.svg", tipo: "fruta", cor: "#e63946" },
];
// Tipos que o gato pode pedir no nível de topo, com a imagem do cartão de pedido.
const PEDIDOS = {
  sopa: "img/jogos/cozinha-prato-caldo_verde.svg",
  doce: "img/proprio/pastel_nata.svg",
  peixe: "img/jogos/cozinha-prato-sardinhas.svg",
  fruta: "img/noto/laranja.svg",
};
const PEDIDO_TEXTO = { sopa: "Só sopa", doce: "Só doces", peixe: "Só peixe", fruta: "Só fruta" };
const MORADORES = ["img/noto/idosa.svg", "img/noto/avo_homem.svg", "img/noto/bebe.svg", "img/noto/homem.svg",
  "img/noto/avo.svg", "img/noto/idoso.svg", "img/noto/cao.svg", "img/noto/princesa.svg"];
const PAREDES = ["#ffe8b0", "#d8f0d0", "#d6e8ff", "#ffd6e2", "#efe0ff", "#fff1c9", "#d4f4f0", "#ffe0c4"];
const CARA_FELIZ = "img/noto/gato_feliz.svg";
const CARA_AMOR = "img/noto/gato_amor.svg";

const sorte = (lista) => lista[Math.floor(Math.random() * lista.length)];

export function abrir(app, sair) {
  const e = ecra(() => terminar(false));
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let elevadores = [];
  const temporizadores = new Set();

  // Um setTimeout que é cancelado quando o jogo para.
  function depois(ms, fn) {
    const t = setTimeout(() => { temporizadores.delete(t); if (ativo) fn(); }, ms);
    temporizadores.add(t);
    return t;
  }
  const esperar = (ms) => new Promise((r) => depois(ms, r));

  function pararTudo() {
    for (const t of temporizadores) clearTimeout(t);
    temporizadores.clear();
    for (const l of elevadores) {
      if (l.anim) { try { l.anim.cancel(); } catch { /* já não existe*/ } }
      if (l.resolver) l.resolver("fim");
    }
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
    await estilo("montapratos");
    if (!ativo) return;
    const n = nivel("montapratos");
    const cfg = NIVEIS[n - 1];
    const inicio = Date.now();
    const st = { pratos: 0, alvos: 0, apanhados: 0, caidos: 0, errados: 0, deixados: 0, vazios: 0, reacoes: [],
      sujos: 0, sujosTocados: 0, cedo: 0, mudancas: 0, melhorSerie: 0 };

    // Disposição: andares com pelo menos ALVO_MIN de altura; a cozinha do rés do chão guarda o elevador parado.
    const caixa = e.corpo.getBoundingClientRect();
    // A borda do prédio (var(--borda)) fica por fora dos andares: deixar espaço para ela.
    const borda = Math.max(4, Math.round(Math.min(innerWidth, innerHeight) * 0.007));
    const H = caixa.height - borda;
    const cabemAndares = Math.floor((H - 8) / ALVO_MIN - 0.78);
    const N = Math.max(2, Math.min(cfg.andares, cabemAndares));
    const hA = Math.floor(Math.min(190, (H - 8) / (N + 0.78)));
    const ch = Math.round(hA * 0.78);
    const hT = Math.max(ch + 8, Math.min(H - N * hA, hA * 1.1));
    const altura = N * hA + hT;
    // Dois elevadores precisam de um prédio mais largo, para as salas (e o cartão de pedido) manterem o espaço.
    const BW = Math.round(Math.min(caixa.width - 2 * borda, cfg.elevadores > 1 ? Math.max(hA * 6.5, 720) : Math.max(hA * 5.2, 560)));
    const cw = Math.round(Math.min(160, hA * 1.05));
    const nElev = cfg.elevadores;
    const centros = nElev === 1 ? [0.6] : [0.56, 0.8];

    ronda = {
      registar(completo) {
        const taxa = st.alvos ? st.apanhados / st.alvos : null;
        metricas.ronda("montapratos", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: Date.now() - inicio,
          completed: completo,
          score: st.apanhados,
          accuracy: taxa == null ? null : Math.round(taxa * 100) / 100,
          dishes: st.pratos,
          dishes_to_take: st.alvos,
          caught: st.apanhados,
          dropped: st.caidos,
          wrong_takes: st.errados,
          let_go: st.deixados,
          empty_taps: st.vazios,
          reaction_ms_median: metricas.mediana(st.reacoes),
          floors: N,
          lifts: nElev,
          window_ms: cfg.janela,
          order_kinds: cfg.pedidos || 0,
          order_changes: st.mudancas,
          empty_plates_shown: st.sujos,
          empty_plate_taps: st.sujosTocados,
          early_taps: st.cedo,
          best_streak: st.melhorSerie,
        });
        const t = taxa ?? 0;
        // Regra da família: fácil = claramente fácil (quase todos os pratos, nenhum tirado por engano);
        // difícil = claramente difícil demais. Uma ronda deixada a meio não muda nada.
        const facil = completo && t >= 0.95 && st.errados === 0 && st.sujosTocados === 0;
        const dificil = completo && (t < 0.5 || st.errados + st.sujosTocados > (cfg.sujos ? 4 : 3));
        ajustarNivel("montapratos", NIVEIS.length, { completo, facil, dificil });
      },
    };

    // O prédio.
    const predio = el("div", { class: "mp-predio", style: { width: `${BW + 2 * borda}px`, height: `${altura + borda}px`, "--prato": `${Math.round(hA * 0.36)}px` } });
    const andares = []; // índice k = andar k (1..N); o 0 não se usa
    for (let k = N; k >= 1; k--) {
      const linha = el("div", { class: "mp-andar", style: { top: `${(N - k) * hA}px`, height: `${hA}px`, background: PAREDES[(k - 1) % PAREDES.length] } });
      const esq = Math.round(BW * centros[0] - cw / 2 - 10);
      const sala = el("div", { class: "mp-sala", style: { width: `${esq}px` } }, [
        el("div", { class: "mp-janela" }),
        Object.assign(img(MORADORES[(k - 1) % MORADORES.length], ""), { className: "mp-morador" }),
        el("div", { class: "mp-mesa" }),
      ]);
      linha.append(sala);
      for (const c of centros) {
        linha.append(el("div", { class: "mp-porta", style: { left: `${Math.round(BW * c - cw / 2 - 8)}px`, width: `${cw + 16}px` } }));
      }
      linha.append(el("div", { class: "mp-placa" }, `${k}`));
      predio.append(linha);
      andares[k] = { linha, mesa: sala.querySelector(".mp-mesa") };
    }
    const cozinha = el("div", { class: "mp-cozinha", style: { top: `${N * hA}px`, height: `${hT}px` } });
    const cozinheiro = img("img/noto/gato_sorri.svg", "");
    cozinheiro.className = "mp-cozinheiro";
    // O cozinheiro fica à direita do último poço, tão grande quanto o espaço ali deixar.
    const ladoCozinheiro = BW - (BW * centros[centros.length - 1] + cw / 2 + 10) - 4;
    cozinheiro.style.height = `${Math.round(Math.min(hT * 0.8, ladoCozinheiro))}px`;
    cozinheiro.style.right = "4px";
    const panela = img("img/jogos/cozinha-panela.svg", "");
    panela.className = "mp-panela";
    panela.style.height = `${Math.round(hT * 0.7)}px`;
    cozinha.append(panela, cozinheiro);
    predio.append(cozinha);

    // O pedido do gato: um tipo mostra uma imagem e palavras; dois ou três tipos mostram as imagens.
    let pedido = null; // lista de tipos, ou null
    let cartao = null;
    if (cfg.pedidos) {
      cartao = el("div", { class: "mp-pedido", style: { height: `${Math.round(hT * 0.86)}px`, maxWidth: `${Math.round(BW * (centros[0] - 0.02) - cw / 2 - 16)}px` } });
      cozinha.append(cartao);
      panela.style.display = "none";
    }
    function mudarPedido(tipos) {
      pedido = tipos;
      cartao.replaceChildren(...tipos.map((t) => img(PEDIDOS[t], "")));
      if (tipos.length === 1) cartao.append(el("b", {}, PEDIDO_TEXTO[tipos[0]]));
      cartao.classList.toggle("varios", tipos.length > 1);
      cartao.dataset.tipos = tipos.join(",");
      cartao.classList.remove("novo");
      void cartao.offsetWidth;
      cartao.classList.add("novo");
    }
    // Um pedido novo, nunca igual ao anterior.
    function novoPedido(antes) {
      const maximo = cfg.pedidos;
      const minimo = cfg.pedidosMin || maximo;
      const chave = (l) => [...l].sort().join(",");
      let tipos;
      let tent = 0;
      do {
        const quantos = minimo + Math.floor(Math.random() * (maximo - minimo + 1));
        tipos = Object.keys(PEDIDOS).sort(() => Math.random() - 0.5).slice(0, quantos);
        tent++;
      } while (antes && tent < 20 && (chave(tipos) === chave(antes) || (tipos.length === 1 && antes.length === 1 && tipos[0] === antes[0])));
      return tipos;
    }
    async function dizerPedido() {
      await e.dizer(`montapratos.so_${pedido[0]}`);
      for (const t of pedido.slice(1)) {
        if (!ativo) return;
        await e.dizer(`montapratos.e_${t}`);
      }
    }

    // Posições do elevador: desvio em y (px para cima a partir do fundo do prédio) do chão da cabine no andar k.
    const yAndar = (k) => (k === 0 ? 4 : hT + (k - 1) * hA + 4);

    elevadores = centros.map((c, i) => {
      const poco = el("div", { class: "mp-poco", style: { left: `${Math.round(BW * c - cw / 2 - 6)}px`, width: `${cw + 12}px` } });
      const prato = img("", "");
      prato.className = "mp-prato";
      const cabine = el("div", { class: "mp-cabine", style: { width: `${cw}px`, height: `${ch}px`, transform: `translateY(${-yAndar(0)}px)` } }, [prato]);
      poco.append(el("div", { class: "mp-roldana" }), cabine);
      predio.append(poco);
      return { i, x: BW * c, poco, cabine, prato, andar: 0, anim: null, resolver: null, espera: null };
    });

    // Uma barra de progresso fina ao longo do cimo do prédio, e a série que salta num andar.
    const barra = el("i");
    predio.append(el("div", { class: "mp-progresso" }, [barra]));
    let serie = 0;
    function mostrarSerie(k) {
      const b = el("b", { class: "mp-serie", style: { top: `${(N - k) * hA + hA * 0.1}px`, left: `${Math.round(BW * 0.04)}px` } }, `${serie} seguidos!`);
      predio.append(b);
      depois(1300, () => b.remove());
    }
    const cena = el("div", { class: "mp-cena" }, [predio]);
    e.corpo.replaceChildren(cena);

    // brilho: os andares por onde o elevador passa brilham de leve à passagem (e o último também,
    // quando ele só lá dá a volta). Tocar num não faz mal; conta como toque antes do tempo.
    function mover(l, k, msPorAndar, brilho = null) {
      const de = yAndar(l.andar);
      const para = yAndar(k);
      const dur = Math.max(450, Math.abs(k - l.andar) * msPorAndar);
      if (brilho) {
        const a = l.andar;
        const passos = Math.abs(k - a);
        const sentido = Math.sign(k - a);
        for (let s = 1; s <= passos; s++) {
          const j = a + s * sentido;
          if (j < 1 || (s === passos && brilho === "final")) continue;
          const linha = andares[j].linha;
          depois(Math.max(0, (s / passos) * dur - msPorAndar * 0.35), () => {
            linha.classList.add("passa");
            depois(msPorAndar * 0.7, () => linha.classList.remove("passa"));
          });
        }
      }
      l.andar = k;
      const anim = l.cabine.animate([
        { transform: `translateY(${-de}px)` },
        { transform: `translateY(${-para}px)` },
      ], { duration: dur, easing: "ease-in-out", fill: "forwards" });
      l.anim = anim;
      return anim.finished.then(() => {
        l.cabine.style.transform = `translateY(${-para}px)`;
        anim.cancel();
        l.anim = null;
      }, () => {});
    }

    // Toques: em qualquer sítio de um andar aceso tira-se o prato que lá espera (o elevador mais próximo, se houver dois).
    predio.addEventListener("pointerdown", (ev) => {
      if (!ativo) return;
      const r = predio.getBoundingClientRect();
      const y = ev.clientY - r.top - borda;
      const x = ev.clientX - r.left - borda;
      const k = y < N * hA ? N - Math.floor(y / hA) : 0;
      let melhor = null;
      for (const l of elevadores) {
        if (!l.espera || l.andar !== k) continue;
        const d = Math.abs(x - l.x);
        if (!melhor || d < melhor.d) melhor = { l, d };
      }
      if (!melhor) {
        st.vazios++;
        if (k >= 1 && andares[k].linha.classList.contains("passa")) st.cedo++;
        return;
      }
      melhor.l.resolver("toque");
    });

    function escolherPrato(ultimo) {
      let lista = PRATOS;
      if (pedido) lista = Math.random() < 0.5 ? PRATOS.filter((p) => pedido.includes(p.tipo)) : PRATOS.filter((p) => !pedido.includes(p.tipo));
      let p;
      do { p = sorte(lista); } while (p === ultimo && lista.length > 1);
      return p;
    }

    function escolherAndar(l, evitar) {
      const livres = [];
      for (let k = 1; k <= N; k++) {
        const ocupado = elevadores.some((o) => o !== l && o.alvo === k);
        if (!ocupado && k !== evitar) livres.push(k);
      }
      return livres.length ? sorte(livres) : 1 + Math.floor(Math.random() * N);
    }

    // Canto de cima à esquerda por dentro da borda do prédio, onde começam os filhos de posição absoluta.
    function origem() {
      const p = predio.getBoundingClientRect();
      return { left: p.left + borda, top: p.top + borda };
    }

    // Posição da imagem do prato dentro do prédio.
    function posPrato(l) {
      const r = l.prato.getBoundingClientRect();
      const p = origem();
      return { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height };
    }

    function voarParaMesa(l, prato, k) {
      const a = posPrato(l);
      const mesa = andares[k].mesa;
      const mr = mesa.getBoundingClientRect();
      const p = origem();
      const voa = img(prato.src, "");
      voa.className = "mp-voa";
      Object.assign(voa.style, { left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px` });
      predio.append(voa);
      l.prato.style.visibility = "hidden";
      const destX = mr.left - p.left + mr.width / 2 - a.w / 2;
      const destY = mr.top - p.top - a.h * 0.7;
      const anim = voa.animate([
        { transform: "translate(0, 0) scale(1)" },
        { transform: `translate(${(destX - a.x) / 2}px, ${(destY - a.y) / 2 - hA * 0.4}px) scale(0.9)`, offset: 0.5 },
        { transform: `translate(${destX - a.x}px, ${destY - a.y}px) scale(0.6)` },
      ], { duration: 650, easing: "ease-in-out", fill: "forwards" });
      anim.onfinish = () => {
        voa.remove();
        const peq = img(prato.src, "");
        peq.className = "mp-na-mesa";
        mesa.append(peq);
        while (mesa.children.length > 3) mesa.firstChild.remove();
      };
    }

    async function cair(l, prato) {
      const a = posPrato(l);
      const queda = el("div", { class: "mp-queda", style: { left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px` } }, [img(prato.src, "")]);
      predio.append(queda);
      l.prato.style.visibility = "hidden";
      som.efeito("montapratos-cai", 0.6);
      const dy = altura - 6 - (a.y + a.h);
      const durQueda = 500 + Math.sqrt(Math.max(0, dy)) * 28;
      const anim = queda.animate([
        { transform: "translate(0, 0) rotate(0)" },
        { transform: `translate(${a.w * 0.25}px, ${-hA * 0.15}px) rotate(-25deg)`, offset: 0.12 },
        { transform: `translate(${-a.w * 0.1}px, ${dy * 0.25}px) rotate(160deg)`, offset: 0.4, easing: "ease-in" },
        { transform: `translate(${a.w * 0.1}px, ${dy}px) rotate(560deg) scale(1.05, 0.8)` },
      ], { duration: durQueda, fill: "forwards" });
      l.anim = anim;
      await anim.finished.catch(() => {});
      l.anim = null;
      queda.remove();
      if (!ativo) return;
      som.efeito("montapratos-plof", 0.9);
      const splat = el("div", { class: "mp-splat", style: { left: `${a.x + a.w / 2 - cw * 0.55}px`, width: `${cw * 1.1}px`, height: `${Math.round(hT * 0.5)}px`, "--cor": prato.cor } }, [
        Object.assign(img(prato.src, ""), { className: "mp-esmagado" }),
        el("b", { class: "mp-plof" }, "PLOF!"),
      ]);
      predio.append(splat);
      depois(1900, () => splat.remove());
      cozinheiro.src = CARA_FELIZ;
      cozinheiro.classList.remove("ri");
      void cozinheiro.offsetWidth;
      cozinheiro.classList.add("ri");
      depois(1800, () => { cozinheiro.src = "img/noto/gato_sorri.svg"; cozinheiro.classList.remove("ri"); });
    }

    let lancados = 0;
    let falhasSeguidas = 0;
    let caiuFala = 0;
    let aFalar = false;

    // Um comentário curto que não prende o elevador (a frase mais nova substitui a anterior).
    function comentar(id, cara) {
      e.dizer(id, { cara });
    }

    // Espera num andar até um toque, o fim da janela, ou o fim do jogo ("toque", "tempo", "fim").
    function aguardar(l, janela) {
      return new Promise((r) => {
        l.espera = true;
        let feito = false;
        // Os dois temporizadores são só desta espera: um prato seguinte no mesmo elevador não os pode herdar.
        const t1 = depois(janela * 0.65, () => { if (!feito && l.prato.className === "mp-prato chegou") l.prato.className = "mp-prato treme"; });
        const t2 = depois(janela, () => { if (!feito) l.resolver("tempo"); });
        l.resolver = (v) => {
          if (feito) return;
          feito = true;
          clearTimeout(t1);
          clearTimeout(t2);
          temporizadores.delete(t1);
          temporizadores.delete(t2);
          l.espera = null;
          l.resolver = null;
          r(v);
        };
      });
    }

    // O segundo elevador nos níveis de topo: sobe vazio, um vizinho põe-lhe um prato vazio
    // (o andar brilha a azul, não a amarelo) e ele desce para lavar. É para deixar ir.
    async function viagemSuja(l) {
      st.sujos++;
      l.prato.style.visibility = "hidden";
      await esperar(400);
      if (!ativo) return;
      const destino = escolherAndar(l, 0);
      l.alvo = destino;
      await mover(l, destino, cfg.ms, cfg.passa ? "final" : null);
      if (!ativo) return;
      const linha = andares[destino].linha;
      linha.classList.add("lavar");
      l.prato.src = VAZIO;
      l.prato.style.visibility = "visible";
      l.prato.className = "mp-prato sujo carrega";
      const resultado = await aguardar(l, Math.max(2200, cfg.janela * 0.8));
      linha.classList.remove("lavar");
      l.alvo = null;
      if (!ativo || resultado === "fim") return;
      if (resultado === "toque") {
        st.sujosTocados++;
        serie = 0;
        l.prato.className = "mp-prato sujo nao";
        comentar(st.sujosTocados % 2 ? "montapratos.vazio1" : "montapratos.vazio2");
        await esperar(900);
        if (!ativo) return;
      } else if (st.sujos % 3 === 1) {
        comentar("montapratos.lavar", CARA_FELIZ);
      }
      l.prato.className = "mp-prato sujo";
      await mover(l, 0, Math.max(400, cfg.ms * 0.6));
      if (!ativo) return;
      l.prato.style.visibility = "hidden";
      await esperar(300 + Math.random() * 400);
    }

    async function trabalhar(l) {
      let ultimo = null;
      while (ativo && lancados < cfg.n) {
        if (l.i === 1 && cfg.sujos && st.pratos >= 3 && Math.random() < cfg.sujos) {
          await viagemSuja(l);
          continue;
        }
        lancados++;
        barra.style.transform = `scaleX(${Math.min(1, (lancados - 1) / cfg.n)})`;
        const prato = escolherPrato(ultimo);
        ultimo = prato;
        st.pratos++;
        // Carregar o prato na cozinha.
        l.prato.src = prato.src;
        l.prato.style.visibility = "visible";
        l.prato.className = "mp-prato carrega";
        await esperar(700);
        if (!ativo) return;
        // Subir (e descer outra vez, nos níveis mais altos) até um andar ao acaso.
        const destino = escolherAndar(l, 0);
        l.alvo = destino;
        const paragens = [];
        if (cfg.vaivem && N >= 2) {
          let a = escolherAndar(l, destino);
          if (a === destino) a = destino === N ? 1 : N;
          paragens.push(a);
          if (Math.random() < 0.5 && N >= 3) {
            let b = 1 + Math.floor(Math.random() * N);
            if (b === a || b === destino) b = a === 1 ? N : 1;
            if (b !== destino) paragens.push(b);
          }
        }
        // Níveis de passagem: de vez em quando o elevador passa direto pelo andar e volta.
        if (cfg.passa && N >= 2 && Math.random() < 0.6) {
          const antes = paragens.length ? paragens[paragens.length - 1] : 0;
          if (antes < destino && destino < N) paragens.push(destino + 1 + Math.floor(Math.random() * (N - destino)));
          else if (antes > destino && destino > 1) paragens.push(1 + Math.floor(Math.random() * (destino - 1)));
        }
        paragens.push(destino);
        for (const k of paragens) {
          await mover(l, k, cfg.ms, cfg.passa ? (k === destino ? "final" : "tudo") : null);
          if (!ativo) return;
          if (k !== destino) await esperar(cfg.passa ? 120 : 250);
        }
        // Chegada: o andar acende-se e o prato espera.
        const linha = andares[destino].linha;
        linha.classList.add("acesa");
        som.efeito("montapratos-ding", 0.35);
        const chegou = Date.now();
        l.prato.className = "mp-prato chegou";
        const resultado = await aguardar(l, cfg.janela);
        linha.classList.remove("acesa");
        l.alvo = null;
        if (!ativo || resultado === "fim") return;
        // Avaliado agora: o gato pode ter mudado o pedido enquanto o prato subia.
        const alvo = !pedido || pedido.includes(prato.tipo);
        if (alvo) st.alvos++;

        if (resultado === "toque" && alvo) {
          st.apanhados++;
          st.reacoes.push(Date.now() - chegou);
          falhasSeguidas = 0;
          serie++;
          st.melhorSerie = Math.max(st.melhorSerie, serie);
          som.efeito(serie < 3 ? "montapratos-apanha" : `montapratos-serie${Math.min(4, serie - 2)}`, 0.8);
          if (serie >= 3) mostrarSerie(destino);
          voarParaMesa(l, prato, destino);
          if (pedido || st.apanhados % 4 === 0) comentar(som.elogio(), CARA_FELIZ);
          else comentar(`montapratos.p_${prato.id}`, CARA_FELIZ);
          await esperar(500);
        } else if (resultado === "toque") {
          // Tirou um prato que o gato não pediu: ele abana a cabeça e o prato volta a descer.
          st.errados++;
          serie = 0;
          l.prato.className = "mp-prato nao";
          comentar(Math.random() < 0.5 ? "montapratos.errado" : "montapratos.errado2");
          await esperar(900);
        } else if (alvo) {
          st.caidos++;
          serie = 0;
          falhasSeguidas++;
          l.prato.className = "mp-prato tomba";
          await esperar(650);
          if (!ativo) return;
          const fala = `montapratos.caiu${(caiuFala++ % 4) + 1}`;
          await cair(l, prato);
          if (!ativo) return;
          if (falhasSeguidas >= 3 && !aFalar) {
            falhasSeguidas = 0;
            aFalar = true;
            await e.dizer("montapratos.calma");
            aFalar = false;
          } else {
            comentar(fala, CARA_FELIZ);
          }
          await esperar(400);
        } else {
          st.deixados++;
          if (st.deixados % 3 === 1) comentar("montapratos.deixaste", CARA_FELIZ);
        }
        if (!ativo) return;
        l.prato.className = "mp-prato";
        await mover(l, 0, Math.max(350, cfg.ms * 0.5));
        if (!ativo) return;
        l.prato.style.visibility = "hidden";
        await esperar(300 + Math.random() * 500);
      }
    }

    await e.dizer("montapratos.instrucao");
    if (!ativo) return;
    if (cfg.vaivem) { await e.dizer("montapratos.vaivem"); if (!ativo) return; }
    if (nElev > 1) { await e.dizer("montapratos.dois"); if (!ativo) return; }
    if (cfg.passa) { await e.dizer("montapratos.passa"); if (!ativo) return; }
    if (cfg.sujos) { await e.dizer("montapratos.sujos"); if (!ativo) return; }
    if (cfg.pedidos) {
      mudarPedido(novoPedido(null));
      await e.dizer(cfg.pedidos > 1 ? "montapratos.escolher_varios" : "montapratos.escolher");
      if (!ativo) return;
      await dizerPedido();
      if (!ativo) return;
    }
    await espera(400);
    if (!ativo) return;

    // O gato muda de ideias durante a ronda, com as mudanças bem espalhadas pelos pratos.
    if (cfg.pedidos && cfg.mudancas) {
      (async () => {
        for (let i = 1; i <= cfg.mudancas; i++) {
          const marca = Math.floor((cfg.n * i) / (cfg.mudancas + 1));
          while (ativo && lancados < marca) await esperar(300);
          if (!ativo || lancados >= cfg.n) return;
          mudarPedido(novoPedido(pedido));
          st.mudancas++;
          await e.dizer("montapratos.muda");
          if (!ativo) return;
          await dizerPedido();
        }
      })();
    }

    const trabalhos = elevadores.map(async (l, i) => {
      if (i > 0) await esperar(cfg.ms * 1.5 + 1800);
      if (ativo) await trabalhar(l);
    });
    await Promise.all(trabalhos);
    if (!ativo) return;
    barra.style.transform = "scaleX(1)";

    await espera(600);
    if (!ativo) return;
    await e.dizer("montapratos.fim", { cara: CARA_AMOR });
    if (!ativo) return;
    // Melhor do que na última ronda neste nível? Dizê-lo.
    const taxa = st.alvos ? st.apanhados / st.alvos : 0;
    const antes = ler("montapratos.ultima", null);
    gravar("montapratos.ultima", { nivel: n, taxa });
    if (antes && antes.nivel === n && taxa > antes.taxa + 0.01) {
      await e.dizer("montapratos.melhor", { cara: CARA_AMOR });
      if (!ativo) return;
    }
    ronda.registar(true);
    ronda = null;
    const r = await premio(e, e.raiz);
    if (!ativo) return;
    if (r === "outra") comecar();
    else terminar(true);
  }

  comecar();
  return () => terminar(false);
}
