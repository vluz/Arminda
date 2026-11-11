// Música: as músicas preferidas da pessoa, agrupadas em listas (uma por pasta no PC).
// Botões grandes para escolher uma lista, depois "Tocar tudo" ou uma só música, com tocar/pausa e
// seguinte/anterior bem grandes. As músicas tocam umas a seguir às outras. A música para quando a
// pessoa sai.
// A lista "Natal" só aparece de 1 de dezembro a 6 de janeiro (Dia de Reis).

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import * as media from "../media.js";
import { el, img, ecra, estilo } from "../ui.js";

export const NIVEIS_MAX = 1;
const SEM_LISTA = "Canções";

export function emEpoca(nome, hoje = new Date()) {
  if (nome.toLowerCase() !== "natal") return true;
  const m = hoje.getMonth();
  return m === 11 || (m === 0 && hoje.getDate() <= 6);
}

export function abrir(app, sair) {
  estilo("media");
  let ativo = true;
  const inicio = Date.now();
  const leitor = new Audio();
  leitor.preload = "auto";
  let lista = [];          // músicas da lista aberta
  let atual = -1;
  let tocadas = 0;
  let toques = 0;
  const ouvido = {};       // id da música -> ms ouvidos
  const listasAbertas = new Set();

  let desde = 0;
  function acumular() {
    if (desde && atual >= 0) {
      const id = lista[atual].ficheiro.replace(/^.*\/|\.ogg$/g, "");
      ouvido[id] = (ouvido[id] || 0) + (Date.now() - desde);
    }
    desde = 0;
  }

  function terminar() {
    if (!ativo) return;
    ativo = false;
    acumular();
    leitor.pause();
    leitor.removeAttribute("src");
    metricas.ronda("musica", {
      level: 1,
      started_at: new Date(inicio).toISOString(),
      duration_ms: Date.now() - inicio,
      completed: true,
      score: tocadas,
      accuracy: null,
      taps: toques,
      // Só a contagem: os nomes das listas são da família (nomes de pastas) e nunca vão para os registos.
      playlists_count: listasAbertas.size,
      listened: Object.entries(ouvido).sort((a, b) => b[1] - a[1]).slice(0, 10),
    });
    e.raiz.remove();
    sair();
  }

  const e = ecra(terminar);
  app.append(e.raiz);

  const listaEl = el("div", { class: "lista" });
  const tocarBtn = el("button", { class: "botao cor-verde", "aria-label": "Tocar", onclick: () => { toques++; alternar(); } }, "▶");
  const comandos = el("div", { class: "comandos" }, [
    el("button", { class: "botao cor-branco", "aria-label": "Anterior", onclick: () => { toques++; tocar(atual - 1); } }, "⏮"),
    tocarBtn,
    el("button", { class: "botao cor-branco", "aria-label": "Seguinte", onclick: () => { toques++; tocar(atual + 1); } }, "⏭"),
  ]);

  function marcar() {
    listaEl.querySelectorAll(".cancao").forEach((b) => b.classList.toggle("atual", Number(b.dataset.k) === atual));
    tocarBtn.textContent = leitor.paused ? "▶" : "❚❚";
  }

  function tocar(i) {
    if (!lista.length) return;
    acumular();
    som.calar();
    atual = (i + lista.length) % lista.length;
    leitor.src = media.url(lista[atual].ficheiro);
    leitor.play().then(() => { desde = Date.now(); tocadas++; marcar(); }).catch(marcar);
    e.mostrar(lista[atual].titulo);
    marcar();
  }

  function alternar() {
    if (atual < 0) return tocar(0);
    if (leitor.paused) { leitor.play().then(() => { desde = Date.now(); marcar(); }).catch(marcar); }
    else { acumular(); leitor.pause(); marcar(); }
  }

  leitor.addEventListener("ended", () => { if (ativo) tocar(atual + 1); });
  // Uma música que não carrega passa à seguinte, no máximo uma volta à lista; se nenhuma carregar,
  // o leitor para e mostra o sinal de tocar (uma carga falhada deixa `paused` em falso).
  let falhadas = 0;
  leitor.addEventListener("error", () => {
    if (!ativo || atual < 0) return;
    if (++falhadas < lista.length) { tocar(atual + 1); return; }
    falhadas = 0;
    leitor.pause();
    marcar();
  });
  leitor.addEventListener("playing", () => { falhadas = 0; });

  function abrirLista(nome, cancoes, comVoltar) {
    listasAbertas.add(nome);
    lista = cancoes;
    atual = -1;
    listaEl.replaceChildren(
      el("button", { class: "botao cor-verde cancao", onclick: () => { toques++; tocar(0); } }, ["▶  Tocar tudo"]),
      ...cancoes.map((c, k) => el("button", { class: "botao cor-branco cancao", "data-k": k, onclick: () => { toques++; tocar(k); } },
        [el("span", { class: "titulo" }, c.titulo), c.artista ? el("small", {}, c.artista) : null])),
    );
    const partes = [listaEl, comandos];
    if (comVoltar) {
      comandos.prepend(el("button", { class: "botao cor-amarelo", "aria-label": "Listas", onclick: () => { toques++; escolherLista(); } }, "☰"));
    }
    e.corpo.replaceChildren(el("div", { class: "musica" }, partes));
    e.mostrar(nome);
    marcar();
  }

  let listas = [];
  function escolherLista() {
    acumular();
    leitor.pause();
    comandos.querySelector('[aria-label="Listas"]')?.remove();
    const mosaico = el("div", { class: "mosaico" });
    for (const [nome, cancoes] of listas) {
      mosaico.append(el("button", { class: "botao cor-roxo", onclick: () => { toques++; abrirLista(nome, cancoes, true); } },
        [el("div", { class: "figura" }, [img(nome.toLowerCase() === "natal" ? "img/noto/estrela.svg" : "img/noto/nota.svg")]), nome]));
    }
    e.corpo.replaceChildren(mosaico);
    e.dizer("musica.escolhe");
  }

  (async () => {
    const todas = (await media.manifesto()).musica;
    if (!ativo) return;
    const grupos = new Map();
    for (const c of todas) {
      const nome = c.lista || SEM_LISTA;
      if (!grupos.has(nome)) grupos.set(nome, []);
      grupos.get(nome).push(c);
    }
    // As listas fora de época escondem-se, a não ser que sejam toda a música que há.
    const naEpoca = [...grupos.entries()].filter(([nome]) => emEpoca(nome));
    listas = naEpoca.length ? naEpoca : [...grupos.entries()];
    if (!listas.length) {
      e.corpo.append(el("div", { class: "media-vazio" }, [el("div", {}, [img("img/noto/nota.svg"), som.texto("musica.vazio")])]));
      e.dizer("musica.vazio");
      return;
    }
    if (listas.length === 1) {
      abrirLista(listas[0][0], listas[0][1], false);
      e.dizer("musica.escolhe");
    } else {
      escolherLista();
    }
  })();

  return terminar;
}
