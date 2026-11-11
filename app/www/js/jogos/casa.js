// A minha casa: a casa da pessoa em fotografias de 360 graus. Uma lista de divisões (botões grandes
// com uma fatia de cada fotografia); um toque abre a divisão em ecrã inteiro, e a seta de voltar
// regressa à lista.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import * as media from "../media.js";
import { el, img, ecra, estilo } from "../ui.js";
import { listar, verTelaCheia } from "./vista360.js";

export const NIVEIS_MAX = 1;

export function abrir(app, sair) {
  estilo("media");
  let ativo = true;
  const inicio = Date.now();
  let vista = null;
  let toques = 0;
  const visitadas = new Set();
  let salas = [];

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
    metricas.ronda("casa", {
      level: 1,
      started_at: new Date(inicio).toISOString(),
      duration_ms: Date.now() - inicio,
      completed: true,
      score: visitadas.size,
      accuracy: null,
      taps: toques,   // score já diz quantas divisões; os nomes delas nunca vão para os registos
    });
    e.raiz.remove();
    sair();
  }

  const e = ecra(terminar);
  app.append(e.raiz);

  function mostrarLista() {
    fecharVista();
    listar(e.corpo, salas, abrirSala);
  }

  // Uma divisão de cada vez: um segundo toque a tremer enquanto o visor carrega não pode abrir outra.
  let abrindo = false;
  async function abrirSala(s) {
    toques++;
    if (abrindo || vista) return;
    abrindo = true;
    som.efeito("abrir", 0.5);
    try {
      vista = await verTelaCheia(salas, s.id, () => { fecharVista(); if (ativo) mostrarLista(); });
    } catch {
      // O visor não carregou: a pessoa fica na lista.
    } finally {
      abrindo = false;
    }
    if (!ativo || vista?.fechado) fecharVista();
  }

  (async () => {
    salas = (await media.manifesto()).casa;
    if (!ativo) return;
    if (!salas.length) {
      e.corpo.append(el("div", { class: "media-vazio" }, [el("div", {}, [img("img/noto/casa.svg"), som.texto("casa.vazio")])]));
      e.dizer("casa.vazio");
      return;
    }
    mostrarLista();
    await e.dizer("casa.ola", { cara: "img/noto/gato_amor.svg" });
  })();

  return terminar;
}
