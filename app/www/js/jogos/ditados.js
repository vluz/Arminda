// Ditados: o gato diz o início de um ditado português antigo; a pessoa escolhe o que falta.
// Níveis baixos: a última palavra, entre 2 imagens, depois entre 3 e 4 palavras. Mais acima: uma
// palavra do meio, depois o final inteiro entre finais parecidos. Depois de cada resposta o ditado
// inteiro é mostrado e dito.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { nivel, ajustarNivel, ler, gravar } from "../estado.js";
import { el, img, ecra, espera, premio, estilo } from "../ui.js";
import { DITADOS } from "./ditados-lista.js";

// tipo: o que falta. opcoes: número de botões. parecida: incluir a armadilha que soa parecida.
const NIVEIS = [
  { tipo: "palavra", opcoes: 2, figura: true },
  { tipo: "palavra", opcoes: 3 },
  { tipo: "palavra", opcoes: 4, parecida: true },
  { tipo: "meio", opcoes: 4 },
  { tipo: "fim", opcoes: 3 },
  { tipo: "fim", opcoes: 4, parecida: true },
];
const POR_RONDA = 8;
const CHAVE_VISTOS = "ditados.vistos";

function baralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const chave = (s) => s.toLowerCase().replace(/[.,!?]/g, "").trim();
const palavras = (s) => s.split(/\s+/).filter(Boolean);

// Este ditado serve para este tipo de pergunta?
function serve(d, cfg) {
  if (cfg.tipo === "palavra") return !cfg.figura || !!d.fig;
  if (cfg.tipo === "meio") return !!d.meio && chave(d.meio) !== chave(d.ultima);
  return palavras(d.fim).length >= 2;
}

// Ditados para uma ronda: primeiro os que ainda não apareceram neste tablet; quando a lista acaba, recomeça.
function escolher(cfg) {
  const elegiveis = DITADOS.filter((d) => serve(d, cfg));
  let vistos = new Set(ler(CHAVE_VISTOS, []));
  let novos = elegiveis.filter((d) => !vistos.has(d.id));
  if (novos.length < POR_RONDA) {
    const ids = new Set(elegiveis.map((d) => d.id));
    const resto = [...vistos].filter((id) => !ids.has(id));
    gravar(CHAVE_VISTOS, resto);
    const extra = baralhar(elegiveis.filter((d) => !novos.includes(d))).slice(0, POR_RONDA - novos.length);
    return [...baralhar(novos), ...extra];
  }
  return baralhar(novos).slice(0, POR_RONDA);
}

function marcarVisto(id) {
  const v = ler(CHAVE_VISTOS, []);
  if (!v.includes(id)) { v.push(id); gravar(CHAVE_VISTOS, v); }
}

// Substitui a palavra como palavra inteira, na última vez que aparece (palavra final) ou na primeira (palavra do meio).
function partir(frase, palavra, ultima) {
  const re = new RegExp(`(^|[^\\p{L}])(${palavra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![\\p{L}])`, "gu");
  let m;
  let achado = null;
  while ((m = re.exec(frase))) {
    achado = { ini: m.index + m[1].length, fim: m.index + m[0].length };
    if (!ultima) break;
  }
  if (!achado) return [frase, ""];
  return [frase.slice(0, achado.ini), frase.slice(achado.fim)];
}

// A pergunta de um ditado: o texto do cartão à volta do espaço, a resposta e as opções erradas.
function pergunta(d, cfg) {
  const outros = DITADOS.filter((x) => x.id !== d.id);
  if (cfg.tipo === "fim") {
    const certa = d.fim;
    const n = palavras(certa).length;
    const usadas = new Set([chave(certa)]);
    const erradas = [];
    if (cfg.parecida && d.par) {
      const [antes, depois] = partir(certa, d.ultima, true);
      const p = antes + d.par + depois;
      erradas.push(p);
      usadas.add(chave(p));
    }
    // Finais de outros ditados com um comprimento parecido, para o comprimento não denunciar nada.
    const parecidas = baralhar(outros)
      .map((x) => x.fim)
      .filter((f) => Math.abs(palavras(f).length - n) <= 2);
    for (const f of parecidas) {
      if (erradas.length >= cfg.opcoes - 1) break;
      if (usadas.has(chave(f))) continue;
      usadas.add(chave(f));
      erradas.push(f);
    }
    return { antes: d.inicio + " ", depois: "", certa, erradas };
  }

  const alvo = cfg.tipo === "meio" ? d.meio : d.ultima;
  const [antes, depois] = partir(d.fim, alvo, cfg.tipo !== "meio");
  const usadas = new Set([chave(alvo)]);
  const erradas = [];
  if (cfg.figura) {
    const vistas = new Set([d.fig]);
    for (const x of baralhar(outros)) {
      if (erradas.length >= cfg.opcoes - 1) break;
      if (!x.fig || vistas.has(x.fig) || usadas.has(chave(x.ultima))) continue;
      vistas.add(x.fig);
      usadas.add(chave(x.ultima));
      erradas.push({ texto: x.ultima, fig: x.fig });
    }
    return { antes: `${d.inicio} ${antes}`, depois, certa: { texto: alvo, fig: d.fig }, erradas };
  }
  if (cfg.parecida && d.par && !usadas.has(chave(d.par))) {
    erradas.push(d.par);
    usadas.add(chave(d.par));
  }
  const fonte = baralhar(outros).map((x) => (cfg.tipo === "meio" ? x.meio : x.ultima)).filter(Boolean);
  for (const p of fonte) {
    if (erradas.length >= cfg.opcoes - 1) break;
    if (usadas.has(chave(p))) continue;
    usadas.add(chave(p));
    erradas.push(p);
  }
  return { antes: `${d.inicio} ${antes}`, depois, certa: alvo, erradas };
}

export const NIVEIS_MAX = NIVEIS.length;

export function abrir(app, sair) {
  estilo("ditados");
  const e = ecra(() => terminar(false));
  app.append(e.raiz);
  let ativo = true;
  let ronda = null;

  function terminar(completo) {
    if (!ativo) return;
    ativo = false;
    if (!completo && ronda) ronda.registar(false);
    e.raiz.remove();
    sair();
  }

  async function comecar() {
    const n = nivel("ditados");
    const cfg = NIVEIS[n - 1];
    const lista = escolher(cfg);
    som.preCarregar(lista.flatMap((d) => [`ditados.${d.id}_inicio`, `ditados.${d.id}_completo`]));

    const inicio = Date.now();
    const reacoes = [];
    let certos = 0;
    let errados = 0;
    let ajudas = 0;
    let primeiraCerta = 0;

    ronda = {
      registar(completo) {
        const dur = Date.now() - inicio;
        const med = metricas.mediana(reacoes);
        metricas.ronda("ditados", {
          level: n,
          started_at: new Date(inicio).toISOString(),
          duration_ms: dur,
          completed: completo,
          score: certos,
          sayings: lista.length,
          first_try_right: primeiraCerta,
          wrong_taps: errados,
          hints_needed: ajudas,
          reaction_ms_median: med,
          accuracy: certos + errados ? Math.round((certos / (certos + errados)) * 100) / 100 : null,
        });
        const facil = completo && errados <= 1 && (med || 0) < 9000;
        // Uma ronda deixada a meio não muda nada (regra de estado.js), por isso só uma ronda acabada pode ser difícil.
        const dificil = completo && (errados > lista.length);
        ajustarNivel("ditados", NIVEIS.length, { completo, facil, dificil });
      },
    };

    const cartaz = el("div", { class: "dit-cartaz" });
    const opcoes = el("div", { class: `dit-opcoes dit-${cfg.tipo}${cfg.figura ? " dit-figura" : ""}` });
    e.corpo.replaceChildren(el("div", { class: "ditados" }, [cartaz, opcoes]));

    await e.dizer(cfg.figura ? "ditados.instrucao_figura"
      : cfg.tipo === "meio" ? "ditados.instrucao_meio"
      : cfg.tipo === "fim" ? "ditados.instrucao_fim" : "ditados.instrucao");
    if (!ativo) return;

    for (let i = 0; i < lista.length && ativo; i++) {
      const d = lista[i];
      const q = pergunta(d, cfg);
      marcarVisto(d.id);

      const lacuna = el("span", { class: "dit-lacuna" }, String.fromCharCode(160));
      cartaz.replaceChildren(q.antes, lacuna, q.depois);
      cartaz.classList.toggle("longo", d.texto.length > 58);
      cartaz.classList.remove("feito");
      opcoes.replaceChildren();

      const textoDe = (o) => (typeof o === "string" ? o : o.texto);
      const total = q.erradas.length + 1;
      opcoes.style.setProperty("--cols", cfg.tipo === "fim" || total === 4 ? 2 : total);
      opcoes.style.setProperty("--cols-r", cfg.tipo === "fim" ? 1 : 2);
      const botoes = baralhar([q.certa, ...q.erradas]).map((o) => {
        const conteudo = cfg.figura
          ? [el("span", { class: "dit-fig" }, [img(o.fig, "")]), el("span", {}, o.texto)]
          : [textoDe(o)];
        const b = el("button", { class: "botao cor-branco dit-opcao" }, conteudo);
        b.dataset.certa = o === q.certa ? "1" : "";
        opcoes.append(b);
        return b;
      });

      let bloqueado = true;
      const travar = (v) => { bloqueado = v; opcoes.dataset.pronto = v ? "" : "1"; };
      travar(true);
      let errosAqui = 0;
      let mostradoEm = 0;
      const resposta = new Promise((resolver) => {
        for (const b of botoes) {
          b.addEventListener("click", async () => {
            if (bloqueado || !ativo || b.classList.contains("errada")) return;
            if (b.dataset.certa) {
              travar(true);
              reacoes.push(Date.now() - mostradoEm);
              resolver();
              return;
            }
            errados++;
            errosAqui++;
            b.classList.add("errada");
            som.efeito("quase", 0.5);
            travar(true);
            await e.dizer(som.quase());
            if (!ativo) return;
            // Dois erros num ditado: tirar mais uma opção errada.
            const restantes = botoes.filter((x) => !x.dataset.certa && !x.classList.contains("errada"));
            if (errosAqui >= 2 && restantes.length) {
              ajudas++;
              restantes[0].classList.add("errada");
              await e.dizer("ditados.ajuda");
              if (!ativo) return;
            }
            travar(false);
          });
        }
      });

      await e.dizer(`ditados.${d.id}_inicio`);
      if (!ativo) return;
      travar(false);
      mostradoEm = Date.now();
      await resposta;
      if (!ativo) return;

      certos++;
      if (errosAqui === 0) primeiraCerta++;
      const certo = botoes.find((b) => b.dataset.certa);
      certo.classList.add("certa");
      botoes.filter((b) => b !== certo).forEach((b) => b.classList.add("apagada"));
      lacuna.textContent = textoDe(q.certa);
      lacuna.classList.add("cheia");
      cartaz.classList.add("feito");
      som.efeito("par");
      await e.dizer(`ditados.${d.id}_completo`, { cara: "img/noto/gato_feliz.svg" });
      if (!ativo) return;
      if (i < lista.length - 1 && Math.random() < 0.35) {
        await e.dizer(som.elogio(), { cara: "img/noto/gato_feliz.svg" });
        if (!ativo) return;
      } else {
        await espera(600);
        if (!ativo) return;
      }
    }
    if (!ativo) return;

    await e.dizer("ditados.todos", { cara: "img/noto/gato_amor.svg" });
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
