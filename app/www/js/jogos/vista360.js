// Visor de 360 graus partilhado por A minha casa e pelos Passeios. Usa o Pannellum (MIT, www/lib/pannellum).
// listar() mostra um botão grande por sítio, cada um com uma fatia da sua fotografia; tocar num
// botão abre o sítio em ecrã inteiro, de borda a borda, com uma seta grande de voltar (para a
// lista), setas transparentes de rodar aos lados, e o nome do sítio. A vista fica perto da altura
// dos olhos, roda devagar sozinha quando a deixam, e as setas dentro da imagem levam ao sítio seguinte.

import * as som from "../som.js";
import * as media from "../media.js";
import { el } from "../ui.js";

function carregarPannellum() {
  if (window.pannellum) return Promise.resolve();
  if (!document.querySelector('link[href="lib/pannellum/pannellum.css"]')) {
    document.head.append(el("link", { rel: "stylesheet", href: "lib/pannellum/pannellum.css" }));
  }
  return new Promise((ok, falha) => {
    const s = el("script", { src: "lib/pannellum/pannellum.js" });
    s.onload = ok;
    s.onerror = falha;
    document.head.append(s);
  });
}

function maxTextura() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    return gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 0;
  } catch {
    return 0;
  }
}

// Reduz um panorama ao que o processador gráfico aguenta. Devolve um endereço para usar.
async function adaptar(url, maximo) {
  if (!maximo || maximo >= 4096) return url;
  // Uma fotografia que não se consegue ler aqui vai para o Pannellum como está: aparece a mensagem
  // simpática dele, e a seta de voltar funciona na mesma.
  try {
    const im = new Image();
    im.src = url;
    await im.decode();
    const c = document.createElement("canvas");
    c.width = maximo;
    c.height = maximo / 2;
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob((b) => ok(b ? URL.createObjectURL(b) : url), "image/jpeg", 0.85));
  } catch {
    return url;
  }
}

// A lista: um botão grande por sítio dentro de `onde`. aoEscolher(sítio) é chamado com um toque.
export function listar(onde, salas, aoEscolher) {
  const grelha = el("div", { class: "casa-lista" });
  for (const s of salas) {
    const b = el("button", { class: "botao casa-tile", onclick: () => aoEscolher(s) }, [el("span", {}, s.nome)]);
    // Uma fatia da fotografia da própria divisão, para a pessoa a reconhecer antes de ler.
    b.style.backgroundImage = `url("${media.url(s.ficheiro)}")`;
    grelha.append(b);
  }
  onde.replaceChildren(grelha);
}

// Vista em ecrã inteiro a começar em `inicio`. aoSair() corre quando a pessoa toca na seta de voltar.
// Devolve { visitadas, toques(), destruir() }.
export async function verTelaCheia(salas, inicio, aoSair) {
  await carregarPannellum();
  let viewer = null;
  let toques = 0;
  const visitadas = new Set();
  const temporarios = [];
  const maximo = maxTextura();

  const pano = el("div", { class: "casa-pano" });
  const nome = el("div", { class: "casa-nome" });
  const rodar = (graus) => { toques++; if (viewer) viewer.setYaw(viewer.getYaw() + graus, 900); };
  let fechado = false;
  // Tudo de que o fechar() precisa existe antes de a seta de voltar aparecer: a pessoa pode tocar
  // nela com as fotografias ainda a ser preparadas.
  let deVolta = null;
  function fechar() {
    if (fechado) return;
    fechado = true;
    clearTimeout(deVolta);
    try { if (viewer) viewer.destroy(); } catch { /* já não existe*/ }
    temporarios.forEach((u) => URL.revokeObjectURL(u));
    camada.remove();
  }
  // Sem nome escrito por cima da fotografia (escolha da família): o nome é dito em voz alta.
  const camada = el("div", { class: "casa-ecra" }, [
    pano,
    el("button", {
      class: "casa-voltar",
      "aria-label": "Voltar à lista",
      onclick: () => { toques++; som.calar(); som.efeito("voltar"); fechar(); aoSair(); },
    }, "↩"),
    el("button", { class: "casa-rodar esq", "aria-label": "Rodar para a esquerda", onclick: () => rodar(-45) }, "◀"),
    el("button", { class: "casa-rodar dir", "aria-label": "Rodar para a direita", onclick: () => rodar(45) }, "▶"),
  ]);
  document.body.append(camada);

  const cenas = {};
  for (const s of salas) {
    if (fechado) break;
    const url = await adaptar(media.url(s.ficheiro), maximo);
    if (url.startsWith("blob:")) temporarios.push(url);
    cenas[s.id] = {
      type: "equirectangular",
      panorama: url,
      yaw: s.inicio || 0,
      hfov: 100,
      // Um dedo pode inclinar a vista para cima e para baixo. Os limites do Pannellum aplicam-se às
      // BORDAS do ecrã, não ao centro: a borda de baixo para logo acima do disco do tripé (os 12% de
      // baixo da fotografia, abaixo de cerca de -68 graus), a de cima abaixo da vertical. Cerca de 30
      // graus para cada lado.
      pitch: 0,
      minPitch: -66,
      maxPitch: 85,
      // Sem setas dentro da imagem (escolha da família): o que interessa é a fotografia.
      // A pessoa passa de sítio para sítio pela lista e pela seta de voltar.
      hotSpots: [],
    };
  }

  // A pessoa tocou na seta de voltar com as fotografias ainda a ser preparadas: não abrir nada.
  if (fechado) {
    temporarios.forEach((u) => URL.revokeObjectURL(u));
    return { visitadas, toques: () => toques, destruir: fechar, get fechado() { return fechado; } };
  }
  try {
    viewer = window.pannellum.viewer(pano, {
    default: { firstScene: inicio, sceneFadeDuration: 800, autoLoad: true },
    scenes: cenas,
    showControls: false,
    mouseZoom: false,
    keyboardZoom: false,
    doubleClickZoom: false,
    compass: false,
    autoRotate: -3,
    autoRotateInactivityDelay: 6000,
    // Os textos do próprio Pannellum, em português de Portugal.
    strings: {
      loadingLabel: "Um momento...",
      loadButtonLabel: "Toca para ver",
      bylineLabel: "",
      noPanoramaError: "Não há fotografia.",
      fileAccessError: "Não foi possível abrir a fotografia.",
      malformedURLError: "Não foi possível abrir a fotografia.",
      iOS8WebGLError: "Não foi possível mostrar a fotografia.",
      genericWebGLError: "Não foi possível mostrar a fotografia.",
      textureSizeError: "A fotografia é grande demais para este tablet.",
      unknownError: "Não foi possível mostrar a fotografia.",
    },
    });
  } catch (e) {
    // O visor não abriu: tirar a camada de ecrã inteiro, para a pessoa não ficar presa nela.
    fechar();
    throw e;
  }
  viewer.on("load", () => {
    const id = viewer.getScene();
    const s = salas.find((x) => x.id === id);
    visitadas.add(id);
    if (s) {
      nome.textContent = s.nome;
      if (s.voz) som.falarUrl(media.url(s.voz));
    }
  });
  // Quando os dedos estão parados há uns segundos, a vista volta devagar à altura dos olhos;
  // o rodar lento recomeça sozinho (autoRotateInactivityDelay).
  const voltarAoNivel = () => {
    clearTimeout(deVolta);
    deVolta = setTimeout(() => { if (!fechado && viewer) viewer.setPitch(0, 2000); }, 6000);
  };
  viewer.on("mousedown", () => { toques++; clearTimeout(deVolta); });
  viewer.on("touchstart", () => clearTimeout(deVolta));
  viewer.on("mouseup", voltarAoNivel);
  viewer.on("touchend", voltarAoNivel);

  return { visitadas, toques: () => toques, destruir: fechar, get fechado() { return fechado; } };
}
