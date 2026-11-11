// Passeios: passeios em 360 graus por sítios que a pessoa conhece. Um botão por lugar, depois um
// botão por sítio (com uma fatia da sua fotografia), depois o sítio em ecrã inteiro; a seta de
// voltar regressa aos sítios.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import * as media from "../media.js";
import { el, img, ecra, estilo } from "../ui.js";
import { listar, verTelaCheia } from "./vista360.js";

export const NIVEIS_MAX = 1;
const CORES = ["cor-azul", "cor-verde", "cor-vermelho", "cor-roxo", "cor-laranja", "cor-rosa"];

export function abrir(app, sair) {
  estilo("media");
  let ativo = true;
  const inicio = Date.now();
  let vista = null;
  let toques = 0;
  const visitadas = new Set();
  const lugares = new Set();
  let grupos = [];

  function fecharVista() {
    if (!vista) return;
    toques += vista.toques();
    vista.visitadas.forEach((v) => visitadas.add(v));
    vista.destruir();
    vista = null;
  }

  function terminar() {
    if (!ativo) return;
    ativo = false;
    fecharVista();
    metricas.ronda("passeios", {
      level: 1,
      started_at: new Date(inicio).toISOString(),
      duration_ms: Date.now() - inicio,
      completed: true,
      score: visitadas.size,
      accuracy: null,
      taps: toques,
      // Só contagens: os nomes dos lugares e dos sítios são da família e nunca vão para os registos.
      places_count: lugares.size,
    });
    e.raiz.remove();
    sair();
  }

  const e = ecra(terminar);
  app.append(e.raiz);

  function escolherLugar() {
    fecharVista();
    const mosaico = el("div", { class: "mosaico" });
    grupos.forEach(([nome, spots], k) => {
      mosaico.append(el("button", { class: `botao ${CORES[k % CORES.length]}`, onclick: () => { toques++; lugar(nome, spots); } },
        [el("div", { class: "figura" }, [img("img/noto/sol.svg")]), nome]));
    });
    e.corpo.replaceChildren(mosaico);
    e.dizer("passeios.escolhe");
  }

  function lugar(nome, spots) {
    lugares.add(nome);
    som.efeito("abrir", 0.5);
    e.mostrar(nome);
    listar(e.corpo, spots, (s) => abrirSpot(nome, spots, s));
    // Com mais de um lugar, um botão grande volta aos lugares.
    if (grupos.length > 1) {
      e.corpo.firstElementChild.append(el("button", { class: "botao cor-branco casa-tile-voltar", onclick: () => { toques++; escolherLugar(); } }, "☰ Lugares"));
    }
  }

  // Um sítio de cada vez: um segundo toque a tremer enquanto o visor carrega não pode abrir outro.
  let abrindo = false;
  async function abrirSpot(nome, spots, s) {
    toques++;
    if (abrindo || vista) return;
    abrindo = true;
    som.efeito("abrir", 0.5);
    try {
      vista = await verTelaCheia(spots, s.id, () => { fecharVista(); if (ativo) lugar(nome, spots); });
    } catch {
      // O visor não carregou: a pessoa fica na lista.
    } finally {
      abrindo = false;
    }
    if (!ativo || vista?.fechado) fecharVista();
  }

  (async () => {
    const todos = (await media.manifesto()).passeios;
    if (!ativo) return;
    const mapa = new Map();
    for (const s of todos) {
      if (!mapa.has(s.grupo)) mapa.set(s.grupo, []);
      mapa.get(s.grupo).push(s);
    }
    grupos = [...mapa.entries()];
    if (!grupos.length) {
      e.corpo.append(el("div", { class: "media-vazio" }, [el("div", {}, [img("img/noto/sol.svg"), som.texto("passeios.vazio")])]));
      e.dizer("passeios.vazio");
      return;
    }
    if (grupos.length === 1) lugar(...grupos[0]);
    else escolherLugar();
  })();

  return terminar;
}
