// Quem é quem: uma fotografia da família, grande, e o gato pergunta "Quem é?". Três ou quatro
// botões grandes com nomes; nos níveis baixos o gato lê-os em voz alta. Sobe de nomes bem
// diferentes, para os nomes falsos parecidos que a família escreveu, para nomes que a pessoa lê
// sozinha, para quatro nomes vindos dos nomes falsos de duas fotografias, para o contrário
// ("Quem é a Tia Rosa?" com fotografias à escolha), para os dois misturados. Tocar na fotografia
// pergunta outra vez.
//
// Os nomes, as legendas e as vozes deles vêm dos conteúdos da família (media.js, coleção "quem"),
// feitos no PC a partir de media/fotos/nomes.txt por tools/enviar_media.py; nada disso está nos
// ficheiros da app. Os registos só levam números de fotografias, nunca nomes.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import * as media from "../media.js";
import { ler, gravar, nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio, estilo, ALVO_MIN } from "../ui.js";
import { baralhar, estilos, quadrados, caberTexto, esperarCerta, criarRitmo, melhorQueAntes } from "./escolhas.js";

// modo: "nome" (fotografia, escolher o nome), "foto" (nome, escolher a fotografia), "misto" (os dois, à vez).
// falsos: de onde vêm os nomes errados. "outros": nomes verdadeiros de outras fotografias (bem
// diferentes); "misto": um dos nomes falsos desta fotografia e um nome verdadeiro de outra;
// "proprios": os nomes falsos desta fotografia; "dois": os nomes falsos desta e os de outra
// fotografia. ler: o gato lê os nomes.
// n: nomes (ou fotografias) à escolha. vezes: fotografias por ronda.
const NIVEIS = [
  { modo: "nome", falsos: "outros", n: 3, ler: true, vezes: 6 },
  { modo: "nome", falsos: "misto", n: 3, ler: true, vezes: 6 },
  { modo: "nome", falsos: "proprios", n: 3, ler: true, vezes: 7 },
  { modo: "nome", falsos: "proprios", n: 3, ler: false, vezes: 7 },
  { modo: "nome", falsos: "dois", n: 4, ler: true, vezes: 8 },
  { modo: "nome", falsos: "dois", n: 4, ler: false, vezes: 8 },
  { modo: "foto", n: 3, vezes: 8 },
  { modo: "misto", falsos: "proprios", n: 3, ler: false, fotos: 3, vezes: 8 },
  { modo: "misto", falsos: "dois", n: 4, ler: false, fotos: 3, vezes: 9 },
  { modo: "misto", falsos: "dois", n: 4, ler: false, fotos: 4, vezes: 10 },
];
export const NIVEIS_MAX = NIVEIS.length;
const MINIMO = 4;
const CARA_FELIZ = "img/noto/gato_feliz.svg";
const CARA_AMOR = "img/noto/gato_amor.svg";
const ARTIGO = /^(as|os|a|o)\s+/i;

const chave = (nome) => nome.trim().toLowerCase();
// "a Tia Rosa" -> "Tia Rosa" nos botões; o artigo fica na fala.
export function semArtigo(nome) {
  const n = nome.trim();
  const s = ARTIGO.test(n) && n.replace(ARTIGO, "").trim() ? n.replace(ARTIGO, "").trim() : n;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const plural = (nome) => /^(as|os)\s/i.test(nome.trim());
const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fraseOlha = (nome) => `Olha, ${plural(nome) ? "são" : "é"} ${nome.trim()}!`;
const fraseQuem = (nome) => `Quem ${plural(nome) ? "são" : "é"} ${nome.trim()}?`;

// Fotografias sobre as quais o jogo pode perguntar: um nome verdadeiro e pelo menos um nome falso.
function utilizaveis(lista) {
  return (lista || []).filter((x) => x && x.ficheiro && typeof x.nome === "string" && x.nome.trim()
    && Array.isArray(x.falsos) && x.falsos.some((f) => typeof f === "string" && f.trim()));
}

// Para o main.js: o jogo só aparece no ecrã inicial quando há fotografias para ele.
export async function disponivel() {
  return utilizaveis((await media.manifesto()).quem).length >= MINIMO;
}

// As fotografias de uma ronda: primeiro as perguntadas há mais tempo, com os empates ao acaso.
function escolherFotos(todas, quantas) {
  const usadas = ler("quem.usadas", {});
  const ordem = baralhar(todas).sort((a, b) => (usadas[a.numero] || 0) - (usadas[b.numero] || 0));
  const lista = ordem.slice(0, quantas);
  const agora = Date.now();
  for (const f of lista) usadas[f.numero] = agora;
  // Manter a memória pequena: as 300 mais recentes.
  const recentes = Object.entries(usadas).sort((a, b) => b[1] - a[1]).slice(0, 300);
  gravar("quem.usadas", Object.fromEntries(recentes));
  return lista;
}

// Os nomes à escolha para a fotografia f: [{ nome, certa }], baralhados.
function opcoesNomes(f, todas, cfg) {
  const certa = f.nome.trim();
  const vistos = new Set([chave(semArtigo(certa))]);
  const escolhidas = [];
  const juntar = (nomes, ate) => {
    for (const n of nomes) {
      if (escolhidas.length >= ate) return;
      const k = chave(semArtigo(n));
      if (!n || !n.trim() || vistos.has(k)) continue;
      vistos.add(k);
      escolhidas.push(n.trim());
    }
  };
  const proprios = baralhar(f.falsos);
  const outrosVerdadeiros = baralhar(todas.filter((o) => o !== f).map((o) => o.nome));
  const outrosFalsos = baralhar(todas.filter((o) => o !== f && chave(o.nome) !== chave(certa)))
    .flatMap((o) => baralhar(o.falsos));
  const quer = cfg.n - 1;
  if (cfg.falsos === "outros") juntar(outrosVerdadeiros, quer);
  else if (cfg.falsos === "misto") { juntar(proprios, 1); juntar(outrosVerdadeiros, quer); }
  else if (cfg.falsos === "dois") { juntar(proprios, 2); juntar(outrosFalsos, quer); }
  else juntar(proprios, quer);
  // Não há que chegue do tipo pedido: qualquer outra coisa que seja diferente.
  juntar([...proprios, ...outrosVerdadeiros, ...outrosFalsos], quer);
  return baralhar([{ nome: certa, certa: true }, ...escolhidas.map((nome) => ({ nome, certa: false }))]);
}

// As fotografias à escolha para "Quem é <nome>?": [{ foto, certa }], cada uma de uma pessoa diferente.
function opcoesFotos(f, todas, n) {
  const vistos = new Set([chave(f.nome)]);
  const outras = [];
  for (const o of baralhar(todas)) {
    if (outras.length >= n - 1) break;
    if (o === f || vistos.has(chave(o.nome))) continue;
    vistos.add(chave(o.nome));
    outras.push(o);
  }
  if (outras.length < n - 1) return null;
  return baralhar([{ foto: f, certa: true }, ...outras.map((foto) => ({ foto, certa: false }))]);
}

// Botões dos nomes: uma coluna de botões largos se couberem com 113 px ou mais, senão duas colunas.
function medirNomes(n, largura, altura) {
  const umaCol = Math.min(170, Math.floor((altura / n) * 0.86));
  if (umaCol >= ALVO_MIN) return { cols: 1, larg: Math.floor(Math.min(largura * 0.96, 620)), alt: umaCol };
  const linhas = Math.ceil(n / 2);
  const alt = Math.max(ALVO_MIN, Math.min(170, Math.floor((altura / linhas) * 0.86)));
  return { cols: 2, larg: Math.floor(Math.min((largura / 2) * 0.94, 420)), alt };
}

function fotoImg(f) {
  const i = img(media.url(f.ficheiro), "");
  i.addEventListener("error", () => { i.src = "img/noto/coracao.svg"; }, { once: true });
  return i;
}

export function abrir(app, sair) {
  const e = ecra(() => terminar(false));
  e.raiz.classList.add("quem");
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;
  let ritmo = null;
  let leitura = 0;   // sobe para parar uma leitura dos nomes que esteja a decorrer

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    leitura++;
    if (!completo && ronda) ronda.registar(false);
    som.calar();
    e.raiz.remove();
    sair();
  }

  async function semFotos() {
    e.corpo.replaceChildren(el("div", { class: "media-vazio" },
      [el("div", {}, [img("img/noto/coracao.svg"), som.texto("quem.vazio")])]));
    await e.dizer("quem.vazio");
    await espera(2500);
    if (ativo) terminar(false);
  }

  async function comecar() {
    await Promise.all([estilos("quem"), estilo("media")]);
    if (!ativo) return;
    const m = await media.manifesto();
    if (!ativo) return;
    const todas = utilizaveis(m.quem);
    if (todas.length < MINIMO) { semFotos(); return; }

    const n = nivel("quem");
    const cfg = NIVEIS[n - 1];
    const lista = escolherFotos(todas, Math.min(cfg.vezes, todas.length));
    // As vozes de todos os nomes que há no tablet (verdadeiros e falsos), para ler as opções em voz alta.
    const vozes = new Map();
    for (const x of m.quem || []) {
      for (const [nome, v] of Object.entries(x.vozes || {})) vozes.set(chave(nome), v);
    }

    if (ritmo) ritmo.remover();
    ritmo = criarRitmo(e.raiz, lista.length);
    const inicio = Date.now();
    const st = { certas: 0, primeira: 0, erros: 0, pistas: 0, repetir: 0, tempos: [], falhadas: [] };

    ronda = {
      registar(completo) {
        const med = metricas.mediana(st.tempos);
        metricas.ronda("quem", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: Date.now() - inicio,
          completed: completo,
          score: st.primeira,
          accuracy: st.certas ? Math.round((st.primeira / st.certas) * 100) / 100 : null,
          photos: lista.length,
          answered: st.certas,
          photo_numbers: lista.map((f) => f.numero),
          missed_photo_numbers: st.falhadas,
          kind: cfg.modo,
          options: cfg.n,
          read_aloud: !!cfg.ler,
          wrong_taps: st.erros,
          hints_needed: st.pistas,
          repeats_asked: st.repetir,
          reaction_ms_median: med,
          best_streak: ritmo ? ritmo.melhorSeguidas : 0,
        });
        // Claramente fácil: nenhum toque errado e rápido. Claramente difícil: cerca de um erro por fotografia, ou muitas pistas.
        const facil = completo && st.erros === 0 && (med || 0) < (cfg.ler ? 12000 : 15000);
        const dificil = completo && (st.erros >= lista.length || st.pistas >= lista.length / 3);
        ajustarNivel("quem", NIVEIS.length, { completo, facil, dificil });
      },
    };

    const zona = el("div", { class: "quem-zona" });
    e.corpo.replaceChildren(zona);
    const paisagem = e.corpo.clientWidth > e.corpo.clientHeight * 1.1;
    zona.classList.add(paisagem ? "paisagem" : "retrato");

    // Lê os nomes em voz alta: "A Tia Rita? A Tia Rosa? Ou a Tia Rosário?"
    async function lerNomes(ops) {
      const minha = ++leitura;
      for (let k = 0; k < ops.length; k++) {
        if (!ativo || minha !== leitura) return;
        const v = vozes.get(chave(ops[k].nome));
        const url = v && (k === ops.length - 1 ? v.ou : v.opcao);
        if (url) await som.falarUrl(media.url(url));
        else await espera(700);
        await espera(150);
      }
    }
    const textoNomes = (ops) => ops.map((o, k) => (k === ops.length - 1 ? `Ou ${o.nome}?` : `${maiuscula(o.nome)}?`)).join(" ");

    let primeiraNome = true;
    let primeiraFoto = true;
    let disseLer = false;
    for (let i = 0; i < lista.length && ativo; i++) {
      const f = lista[i];
      let modo = cfg.modo === "misto" ? (i % 2 ? "foto" : "nome") : cfg.modo;
      const opsFotos = modo === "foto" ? opcoesFotos(f, todas, cfg.fotos || cfg.n) : null;
      if (modo === "foto" && !opsFotos) modo = "nome";   // pessoas diferentes a menos para o contrário
      let botoes;
      let certa;
      let perguntar;
      // O que fazer é dito antes de os botões aparecerem, para não se perder nenhum toque enquanto o gato fala.
      if (modo === "nome" && primeiraNome) {
        primeiraNome = false;
        await e.dizer(n === 1 ? "quem.instrucao" : "quem.vamos");
        if (!ativo) return;
      }
      if (modo === "nome" && cfg.modo !== "foto" && !cfg.ler && !disseLer) {
        disseLer = true;
        await e.dizer("quem.le");
        if (!ativo) return;
      }
      if (modo === "foto" && primeiraFoto) {
        primeiraFoto = false;
        await e.dizer("quem.reverso");
        if (!ativo) return;
      }

      if (modo === "nome") {
        const cfgNome = cfg.modo === "foto" ? { falsos: "proprios", n: 3, ler: true } : cfg;
        const ops = opcoesNomes(f, todas, cfgNome);
        const moldura = el("button", { class: "quem-foto", "aria-label": "Ouvir outra vez" }, [fotoImg(f)]);
        const grade = el("div", { class: "quem-nomes" });
        zona.replaceChildren(moldura, grade);
        zona.classList.remove("fotos");
        const caixa = grade.getBoundingClientRect();
        const med = medirNomes(ops.length, caixa.width, caixa.height);
        grade.style.gridTemplateColumns = `repeat(${med.cols}, auto)`;
        botoes = ops.map((o) => el("button", {
          class: "esc-op palavra quem-nome", style: { "--larg": `${med.larg}px`, "--alt": `${med.alt}px` },
        }, [el("span", {}, semArtigo(o.nome))]));
        grade.replaceChildren(...botoes);
        // Todos os nomes do mesmo tamanho: o tamanho em que cabe o mais comprido.
        const letra = Math.min(...botoes.map((b) => caberTexto(b, Math.floor(med.alt * 0.42), 22)));
        botoes.forEach((b) => { b.style.fontSize = `${letra}px`; });
        certa = botoes[ops.findIndex((o) => o.certa)];
        const lerAgora = cfgNome.ler;
        perguntar = async () => {
          leitura++;
          await e.dizer("quem.quem_e");
          if (!ativo) return;
          if (lerAgora) {
            e.mostrar(textoNomes(ops));
            await lerNomes(ops);
          }
        };
        moldura.addEventListener("click", () => {
          if (!ativo) return;
          st.repetir++;
          som.efeito("toque", 0.4);
          perguntar();
        });
      } else {
        const grade = el("div", { class: "esc-grelha quem-fotos" });
        const ouvir = el("button", { class: "quem-ouvir", "aria-label": "Ouvir outra vez" }, [img("img/proprio/ouvir.svg", "")]);
        zona.replaceChildren(grade, ouvir);
        zona.classList.add("fotos");
        const caixa = grade.getBoundingClientRect();
        const q = quadrados(opsFotos.length, caixa.width, caixa.height, 330);
        grade.style.gridTemplateColumns = `repeat(${q.cols}, auto)`;
        botoes = opsFotos.map((o) => el("button", { class: "esc-op quem-opfoto", style: { "--lado": `${q.lado}px` } }, [fotoImg(o.foto)]));
        grade.replaceChildren(...botoes);
        certa = botoes[opsFotos.findIndex((o) => o.certa)];
        perguntar = async () => {
          leitura++;
          e.mostrar(fraseQuem(f.nome));
          if (f.voz_quem) await som.falarUrl(media.url(f.voz_quem));
          else await espera(1200);
        };
        ouvir.addEventListener("click", () => {
          if (!ativo) return;
          st.repetir++;
          som.efeito("toque", 0.4);
          perguntar();
        });
      }

      if (i > 0 && modo === "nome") await espera(200);
      perguntar();
      const res = await esperarCerta(botoes, certa, {
        ativo: () => ativo,
        aoErrar: (b, k) => {
          st.erros++;
          leitura++;
          e.dizer(k >= 2 ? (modo === "foto" ? "quem.pista_foto" : "quem.pista") : "quem.quase");
        },
      });
      if (!ativo) return;
      leitura++;
      st.certas++;
      if (res.erros === 0) st.primeira++;
      else st.falhadas.push(f.numero);
      if (res.pista) st.pistas++;
      st.tempos.push(res.ms);
      ritmo.certo(res.erros === 0);
      ritmo.avancar();
      botoes.forEach((b) => { if (b !== certa) b.classList.add("sai"); });
      // O nome outra vez, com carinho: "Olha, é a Tia Rosa!"
      e.mostrar(fraseOlha(f.nome));
      e.mascote.src = res.erros === 0 ? CARA_FELIZ : "img/noto/gato_sorri.svg";
      if (f.voz_olha) await som.falarUrl(media.url(f.voz_olha));
      else await espera(1200);
      if (!ativo) return;
      if (i < lista.length - 1 && res.erros === 0 && ritmo.seguidas > 0 && ritmo.seguidas % 3 === 0) {
        await e.dizer(som.elogio(), { cara: CARA_FELIZ });
        if (!ativo) return;
      }
      await espera(500);
      if (!ativo) return;
    }
    if (!ativo) return;

    if (melhorQueAntes("quem", n, st.primeira)) {
      await e.dizer("quem.melhor", { cara: CARA_FELIZ });
      if (!ativo) return;
    }
    await e.dizer("quem.fim", { cara: CARA_AMOR });
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
