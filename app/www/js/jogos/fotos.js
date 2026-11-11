// Fotografias: o álbum de fotografias da família. Uma fotografia de cada vez, com a legenda dita e
// mostrada, e setas grandes para avançar. Deixado sozinho, vira a página devagar por si.
// As legendas vêm de media/fotos/nomes.txt no PC ("Olha, é a Tia Rosa! No casamento da Ana."),
// passadas a voz quando os conteúdos são preparados (tools/enviar_media.py); o texto no ecrã é o
// nome sem o artigo, mais a legenda.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import * as media from "../media.js";
import { el, img, ecra, estilo } from "../ui.js";

export const NIVEIS_MAX = 1;
const PASSAGEM_SOZINHA = 15000;

export function abrir(app, sair) {
  estilo("media");
  let ativo = true;
  const inicio = Date.now();
  const tempos = {};      // id da fotografia -> ms no ecrã
  let toques = 0;
  let deslizes = 0;   // quantas das viragens de página foram deslizes (as outras foram toques nas setas)
  let cheios = 0;     // toques na fotografia, a entrar e a sair do ecrã inteiro
  let relogio = null;
  let mostradaEm = 0;
  let atual = -1;
  let lista = [];

  function terminar() {
    if (!ativo) return;
    ativo = false;
    clearTimeout(relogio);
    contar();
    const vistas = Object.values(tempos);
    metricas.ronda("fotos", {
      level: 1,
      started_at: new Date(inicio).toISOString(),
      duration_ms: Date.now() - inicio,
      completed: true,
      score: vistas.length,
      accuracy: null,
      photos_total: lista.length,
      taps: toques,
      swipes: deslizes,
      fullscreen_taps: cheios,
      view_ms_median: metricas.mediana(vistas),
      // Que fotografias prendem mais a atenção, pelo número da fotografia ou pelo id do ficheiro (sem nomes).
      longest_views: Object.entries(tempos).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, v]),
    });
    e.raiz.remove();
    sair();
  }

  const e = ecra(terminar);
  app.append(e.raiz);

  function contar() {
    if (atual < 0 || !lista[atual]) return;
    const f = lista[atual];
    const id = Number.isInteger(f.numero) ? String(f.numero) : f.ficheiro.split("/").pop().replace(/\.jpg$/, "");
    tempos[id] = (tempos[id] || 0) + (Date.now() - mostradaEm);
  }

  const moldura = el("div", { class: "media-moldura" });
  // Deslizar para o lado na fotografia vira a página, como num telemóvel.
  // As setas ficam, para os dias em que deslizar custa. Sobretudo para o lado e pelo menos 60 px; um
  // toque ou um dedo a tremer não faz nada.
  moldura.style.touchAction = "pan-y";
  let deslize = null;
  moldura.addEventListener("pointerdown", (ev) => { deslize = { x: ev.clientX, y: ev.clientY, id: ev.pointerId }; });
  moldura.addEventListener("pointercancel", () => { deslize = null; });
  moldura.addEventListener("pointerup", (ev) => {
    const d = deslize;
    deslize = null;
    if (!d || d.id !== ev.pointerId || !lista.length) return;
    const dx = ev.clientX - d.x;
    const dy = ev.clientY - d.y;
    // Um toque na fotografia mostra-a no ecrã inteiro; outro toque traz as setas de volta.
    // Muitas pessoas preferem ver a deslizar.
    if (Math.hypot(dx, dy) < 40) { toques++; cheios++; centro.classList.toggle("cheio"); return; }
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    toques++;
    deslizes++;
    mudar(dx < 0 ? 1 : -1);   // dedo para a esquerda: fotografia seguinte, como num telemóvel
  });
  const legenda = el("div", { class: "media-legenda" });
  const centro = el("div", { class: "media-centro" }, [moldura, legenda]);
  const antes = el("button", { class: "botao cor-branco seta", "aria-label": "Anterior", onclick: () => { toques++; mudar(-1); } }, "◀");
  const depois = el("button", { class: "botao cor-branco seta", "aria-label": "Seguinte", onclick: () => { toques++; mudar(1); } }, "▶");

  function mostrar(i) {
    contar();
    atual = (i + lista.length) % lista.length;
    mostradaEm = Date.now();
    const f = lista[atual];
    const foto = img(media.url(f.ficheiro), "");
    // Uma fotografia que não carrega mostra um coração em vez do sinal de imagem estragada.
    foto.addEventListener("error", () => { foto.src = "img/noto/coracao.svg"; }, { once: true });
    moldura.replaceChildren(foto);
    legenda.textContent = f.legenda || "";
    if (f.voz) som.falarUrl(media.url(f.voz));
    clearTimeout(relogio);
    relogio = setTimeout(() => { if (ativo) mostrar(atual + 1); }, PASSAGEM_SOZINHA);
  }

  function mudar(d) {
    som.efeito("virar", 0.5);
    mostrar(atual + d);
  }

  (async () => {
    lista = (await media.manifesto()).fotos;
    if (!ativo) return;
    if (!lista.length) {
      e.corpo.append(el("div", { class: "media-vazio" }, [el("div", {}, [img("img/noto/coracao.svg"), som.texto("fotos.vazio")])]));
      e.dizer("fotos.vazio");
      return;
    }
    e.corpo.append(el("div", { class: "media-palco" }, [
      antes, centro, depois,
    ]));
    await e.dizer("fotos.ola", { cara: "img/noto/gato_amor.svg" });
    if (!ativo) return;
    mostrar(0);
  })();

  return terminar;
}
