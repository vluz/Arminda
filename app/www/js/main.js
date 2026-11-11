// Arranque, ecrã inicial, introdução, painel de azulejos e o ecrã escondido da família.

import * as som from "./som.js";
import * as metricas from "./metricas.js";
import * as azulejos from "./azulejos.js";
import { ler, gravar, definirInicios, definirMaximos } from "./estado.js";
import { el, img, ecra, espera } from "./ui.js";
import { JOGOS as TODOS } from "./jogos/registo.js";
import * as sincronizar from "./sincronizar.js";
import * as fundo from "./fundo.js";
import { abrirFamilia } from "./familia.js";
import * as bateria from "./bateria.js";
import * as atualizar from "./atualizar.js";
import * as media from "./media.js";

// Os jogos ainda por fazer (provisórios) ou ainda não aprovados pela família (oculto) nunca aparecem
// no ecrã inicial. Os atalhos de teste (#jogo=<id>) abrem-nos na mesma.
const JOGOS = TODOS.filter((j) => !j.modulo.ESBOCO && !j.oculto);
// Os jogos que precisam de conteúdos da família (um módulo que exporta disponivel(), como o Quem é
// quem) ficam fora do ecrã inicial até os conteúdos de que precisam estarem no tablet.
let semMedia = new Set();
async function verMedia() {
  const fora = new Set();
  for (const j of TODOS) {
    if (typeof j.modulo.disponivel !== "function") continue;
    try { if (!(await j.modulo.disponivel())) fora.add(j.id); } catch { fora.add(j.id); }
  }
  const mudou = [...fora].join() !== [...semMedia].join();
  if (mudou) ordem = null;
  semMedia = fora;
  return mudou;
}

const app = document.getElementById("app");
const POR_PAGINA = 12;               // jogos por página do ecrã inicial (3 filas de 4)
const SEGURAR_GATO_MS = 15000;       // quanto tempo se segura o gato para abrir o ecrã da família
const OCIOSO_MS = 15 * 60000;        // sem toque dentro de uma atividade durante este tempo, volta-se ao início
let introData = { slides: [] };
let ecraAtual = null;   // limpeza do ecrã atual
let saudou = false;
let pagina = 0;
let noInicio = false;   // o ecrã inicial está à vista (o único sítio onde uma atualização pode trocar)
let jogoAberto = null;  // id da atividade aberta agora, null fora delas

// Os níveis de início são os mesmos para quem quer que o tablet seja: a regra de subida leva cada
// pessoa até onde ela é forte.
definirInicios(Object.fromEntries(JOGOS.map((j) => [j.id, j.inicio])));
// O nível de topo de cada jogo (os escondidos também): um nível guardado acima dele lê-se como o de topo.
definirMaximos(Object.fromEntries(TODOS.filter((j) => j.modulo.NIVEIS_MAX).map((j) => [j.id, j.modulo.NIVEIS_MAX])));

function limpar() {
  som.calar();
  if (ecraAtual) ecraAtual();
  ecraAtual = null;
  app.replaceChildren();
  delete app.dataset.fundo;
  noInicio = false;
  jogoAberto = null;
}

// A música de fundo fica desligada onde é preciso ouvir: as fotografias, as músicas e os sítios da
// pessoa, e os jogos que se jogam de ouvido. A Sequência toca notas para decorar; o Quem é quem lê
// nomes em voz alta.
const SILENCIO = new Set(["fotos", "musica", "casa", "passeios", "ditados", "palavras", "loto",
  "adivinhas", "sequencia", "quem"]);

// Fundo suave com um tema por família de jogos (css/app.css, #app[data-fundo]). Os jogos que não
// estão na lista ficam com o padrão ténue de azulejo do ecrã inicial.
const FUNDOS = {
  cartas: ["pares", "bisca", "sueca", "paciencia", "domino"],
  letras: ["sopa", "palavras", "ditados", "adivinhas", "intruso"],
  tabuleiro: ["damas", "galo", "quatro", "sudoku", "labirinto"],
  cozinha: ["cozinha", "mesa", "montapratos", "feira"],
  natureza: ["jardim", "aquario", "estendal", "sardinha", "gato", "saltos"],
  liso: ["fotos", "musica", "casa", "passeios", "quem"],
};
const FUNDO_DE = new Map(Object.entries(FUNDOS).flatMap(([f, ids]) => ids.map((id) => [id, f])));

// Toques tolerantes (para mãos que mal conseguem carregar num botão). Um toque que
// começa e acaba no mesmo botão conta como toque mesmo que o dedo tenha escorregado, tremido ou
// ficado muito tempo em baixo, casos em que o browser pode deixar cair o clique. Se o clique do
// próprio browser vier primeiro, não acontece mais nada; se vier tarde (o tablet lento ocupado)
// depois de o nosso já ter disparado, é engolido, para um toque nunca valer por dois.
let toqueInicio = null;
let sintetico = null;   // { b, quando } do último clique que disparámos nós
document.addEventListener("pointerdown", (ev) => {
  const b = ev.target.closest?.("button");
  toqueInicio = b && !b.disabled ? { b, id: ev.pointerId, x: ev.clientX, y: ev.clientY } : null;
}, true);
document.addEventListener("click", (ev) => {
  if (ev.isTrusted && sintetico && sintetico.b === ev.target.closest?.("button")
      && Date.now() - sintetico.quando < 700) {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    sintetico = null;
    return;
  }
  if (toqueInicio) toqueInicio.clicou = true;
}, true);
function clicar(b) {
  if (!b.isConnected || b.disabled) return;
  sintetico = { b, quando: Date.now() };
  b.click();
}
document.addEventListener("pointerup", (ev) => {
  const t = toqueInicio;
  if (!t || t.id !== ev.pointerId) return;
  const r = t.b.getBoundingClientRect();
  const folga = 24;   // até cerca de 4 mm para fora da borda ainda conta
  const dentro = ev.clientX >= r.left - folga && ev.clientX <= r.right + folga
    && ev.clientY >= r.top - folga && ev.clientY <= r.bottom + folga;
  // Um dedo que se mexeu mais de cerca de 7 mm estava a arrastar alguma coisa (o regador, uma peça
  // de roupa), não a tocar: disso tratou o próprio jogo.
  const arrastou = Math.hypot(ev.clientX - t.x, ev.clientY - t.y) > 40;
  if (!dentro || arrastou) { toqueInicio = null; return; }
  setTimeout(() => {
    if (toqueInicio === t && !t.clicou) clicar(t.b);
    if (toqueInicio === t) toqueInicio = null;
  }, 150);
}, true);
document.addEventListener("pointercancel", (ev) => {
  // O browser desistiu do toque (achou que era para deslizar a página): acabá-lo como toque se o dedo
  // ainda estava no botão, mas nunca dentro das listas que deslizam a sério (a mesma lista do app.css).
  const t = toqueInicio;
  if (!t || t.id !== ev.pointerId || t.b.closest(".familia, .musica .lista, .casa-lista")) return;
  toqueInicio = null;
  clicar(t.b);
}, true);

// Engole o levantar de um dedo e o clique que ele faria, para um ecrã que abriu por baixo de um dedo
// ainda em baixo não ser tocado por esse mesmo dedo. Não faz mal se o levantar nunca chegar.
function engolirLevantar(id) {
  let ate = Date.now() + 15000;   // nunca bloquear por muito tempo, mesmo que o levantar se perca
  const fim = () => {
    document.removeEventListener("pointerup", aoLevantar, true);
    document.removeEventListener("click", aoClicar, true);
  };
  const aoLevantar = (ev) => {
    if (ev.pointerId !== id) return;
    ev.stopImmediatePropagation();
    ate = Date.now() + 400;   // o clique vem poucos milissegundos depois do levantar
    setTimeout(fim, 450);
  };
  const aoClicar = (ev) => {
    if (Date.now() > ate) { fim(); return; }
    ev.stopImmediatePropagation();
    ev.preventDefault();
  };
  document.addEventListener("pointerup", aoLevantar, true);
  document.addEventListener("click", aoClicar, true);
  setTimeout(fim, 15000);
}

// Parar todas as animações CSS com o ecrã apagado, e ao fim de 10 minutos sem toque, quando o
// tablet escurece (html.oculto em app.css). Senão as animações em ciclo mantêm o processador
// gráfico a desenhar 60 imagens por segundo a noite toda.
let ultimoToqueGeral = Date.now();
let adormecido = false;
const marcarPausa = () => document.documentElement.classList.toggle("oculto", document.hidden || adormecido);
document.addEventListener("visibilitychange", () => {
  // O ecrã voltou a acender (botão de ligar, carregador): alguém está a olhar, por isso o tempo de
  // sossego recomeça, como faz a parte nativa da app. Uma atualização espera então outros 5 minutos
  // de sossego.
  if (!document.hidden) { ultimoToqueGeral = Date.now(); adormecido = false; }
  marcarPausa();
});
window.addEventListener("pointerdown", () => {
  ultimoToqueGeral = Date.now();
  if (adormecido) { adormecido = false; marcarPausa(); }
}, { capture: true, passive: true });
setInterval(() => {
  if (!adormecido && Date.now() - ultimoToqueGeral >= 10 * 60000) { adormecido = true; marcarPausa(); }
}, 30000);

// Os botões do ecrã inicial vêm por uma ordem nova, ao acaso, em cada arranque e depois de 10
// minutos fora do ecrã inicial, para a pessoa procurar "aquele" jogo em vez de tocar num sítio
// decorado. As Fotografias e a Música ficam na primeira página, em sítios ao acaso.
const FIXOS = ["fotos", "musica"];
const BARALHAR_APOS = 10 * 60000;
let ordem = null;
let saiuDoInicio = 0;
function baralhar() {
  const visiveis = JOGOS.filter((j) => !semMedia.has(j.id));
  const resto = visiveis.filter((j) => !FIXOS.includes(j.id));
  for (let i = resto.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [resto[i], resto[k]] = [resto[k], resto[i]];
  }
  for (const j of visiveis.filter((x) => FIXOS.includes(x.id))) {
    resto.splice(Math.floor(Math.random() * Math.min(POR_PAGINA, resto.length + 1)), 0, j);
  }
  ordem = resto;
  pagina = 0;
}

// Chamar a atenção no ecrã inicial, tudo com transformações CSS: a cada 2 minutos de sossego os
// botões viram-se um a seguir ao outro; de vez em quando um botão abana ou brilha. Nada corre
// enquanto a pessoa toca.
const ONDA_MS = 120000;
const PASSO_ONDA = 80;
const TIQUE_MS = 4000;

function saudacao() {
  const h = new Date().getHours();
  if (h >= 6 && h < 13) return "geral.bom_dia";
  if (h >= 13 && h < 20) return "geral.boa_tarde";
  return "geral.boa_noite";
}

function botaoAzulejos() {
  const b = el("button", {
    class: "botao botao-ouvir",
    "aria-label": "Azulejos",
    onclick: () => { som.efeito("toque"); painel(); },
  });
  b.innerHTML = azulejos.svgAzulejo(Math.max(0, azulejos.total() - 1));
  const s = b.firstElementChild;
  s.setAttribute("style", "width:70%;height:70%;border:0.5vmin solid #111");
  return b;
}

// calado: abriu sozinho (um jogo sem toque há 15 minutos), não pela mão da pessoa: sem saudação,
// sem empurrões e sem efeitos de atenção até ela voltar a tocar no ecrã.
function inicio(calado = false) {
  limpar();
  if (!calado) bateria.avisar();
  const ouvir = el("button", {
    class: "botao botao-ouvir",
    "aria-label": "Ouvir a apresentação",
    onclick: () => { som.efeito("toque"); intro(false); },
  }, [img("img/proprio/ouvir.svg", "Ouvir")]);
  const e = ecra(null, [botaoAzulejos(), ouvir]);
  app.append(e.raiz);
  fundo.tocar();
  if (!ordem || (saiuDoInicio && Date.now() - saiuDoInicio > BARALHAR_APOS)) baralhar();

  const paginas = Math.ceil(ordem.length / POR_PAGINA);
  pagina = Math.min(pagina, paginas - 1);
  const mosaico = el("div", { class: "mosaico oito" });
  const pontos = el("div", { class: "pontos" }, Array.from({ length: paginas }, () => el("span")));
  const antes = el("button", { class: "botao cor-branco", "aria-label": "Anterior", onclick: () => mudar(-1) }, "◀");
  const depois = el("button", { class: "botao cor-branco", "aria-label": "Seguinte", onclick: () => mudar(1) }, "▶");
  const barra = el("div", { class: "paginas" }, [antes, pontos, depois]);

  // entrada: "chega" (os botões aparecem um a um), "dir" ou "esq" (a página entra desse lado).
  let fimEntrada = null;
  function desenhar(entrada = "chega") {
    mosaico.replaceChildren();
    ordem.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).forEach((j, k) => {
      mosaico.append(el("button", {
        class: `botao ${j.cor}${j.nome.split(" ").some((p) => p.length >= 10) ? " longo" : ""}`,
        style: { "--i": k },
        onclick: () => abrirJogo(j),
      }, [el("div", { class: "figura" }, [img(j.figura, "")]), j.nome]));
    });
    pontos.querySelectorAll("span").forEach((p, k) => p.classList.toggle("ativo", k === pagina));
    antes.disabled = pagina === 0;
    depois.disabled = pagina === paginas - 1;
    depois.classList.toggle("respira", !depois.disabled);
    mosaico.classList.remove("chega", "dir", "esq");
    void mosaico.offsetWidth;
    mosaico.classList.add(entrada);
    clearTimeout(fimEntrada);
    fimEntrada = setTimeout(() => mosaico.classList.remove(entrada), 900);
  }
  function mudar(d) {
    som.efeito("virar", 0.5);
    pagina = Math.max(0, Math.min(paginas - 1, pagina + d));
    desenhar(d > 0 ? "dir" : "esq");
  }
  desenhar();
  e.corpo.append(mosaico);
  e.raiz.append(barra);

  // Viragem em fila, abanões e brilhos. Um ciclo lento de 4 s confere o tempo de sossego; cada efeito
  // é uma classe CSS num ou mais botões, tirada quando acaba ou ao primeiro toque.
  const EFEITOS = ["vira", "abana", "brilha"];
  let tocando = false;
  let ultimoToqueInicio = calado ? 0 : Date.now();
  let ultimaOnda = Date.now();
  let proximoRealce = Date.now() + 10000;
  let fimEfeito = null;
  const sossegar = () => {
    clearTimeout(fimEfeito);
    for (const t of mosaico.children) t.classList.remove(...EFEITOS);
  };
  e.raiz.addEventListener("pointerdown", () => { tocando = true; ultimoToqueInicio = Date.now(); sossegar(); }, true);
  for (const ev of ["pointerup", "pointercancel"]) {
    e.raiz.addEventListener(ev, () => { tocando = false; ultimoToqueInicio = Date.now(); }, true);
  }
  function onda() {
    const tiles = [...mosaico.children];
    ultimaOnda = Date.now();
    tiles.forEach((t, k) => { t.style.setProperty("--atraso", `${k * PASSO_ONDA}ms`); t.classList.add("vira"); });
    som.efeito("baralhar", 0.25);
    fimEfeito = setTimeout(sossegar, 500 + tiles.length * PASSO_ONDA + 100);
  }
  function realce() {
    const tiles = [...mosaico.children];
    if (!tiles.length) return;
    const t = tiles[Math.floor(Math.random() * tiles.length)];
    const ef = Math.random() < 0.5 ? "abana" : "brilha";
    t.classList.add(ef);
    fimEfeito = setTimeout(sossegar, 1300);
  }
  const tique = setInterval(() => {
    if (document.hidden || tocando || mosaico.classList.length > 2) return;
    const agora = Date.now();
    const quietoMs = agora - ultimoToqueInicio;
    // Ao fim de 10 minutos de sossego o tablet escurece e a música descansa: acabam as viragens e os sons.
    if (adormecido || quietoMs >= 10 * 60000) return;
    if (quietoMs >= ONDA_MS && agora - ultimaOnda >= ONDA_MS) onda();
    else if (quietoMs >= 6000 && agora >= proximoRealce) {
      realce();
      proximoRealce = agora + 12000 + Math.random() * 10000;
    }
  }, TIQUE_MS);

  // Segurar o gato quinze segundos abre o ecrã da família. Comprido de propósito: a pessoa pega muitas
  // vezes no tablet pela borda do ecrã e deixa lá um dedo pousado.
  // Antes era difícil de abrir: em dez segundos um dedo desliza, o
  // browser tomava o deslize por um arrastar da página e cancelava o toque, o Android tomava o toque
  // longo na imagem por um arrastar de imagem, e o saltinho do gato quando fala tirava-o de baixo do
  // dedo. Agora o toque fica preso ao gato (o deslize e o salto não contam), deixa-se mexer até cerca
  // de 1 cm, e a imagem não pode ser arrastada.
  let toqueLongo = null;
  let seguro = null;   // { id, x, y } do dedo que segura o gato
  const largarGato = () => { clearTimeout(toqueLongo); seguro = null; };
  e.mascote.draggable = false;
  e.mascote.style.touchAction = "none";
  e.mascote.style.webkitUserDrag = "none";
  e.mascote.addEventListener("dragstart", (ev) => ev.preventDefault());
  e.mascote.addEventListener("contextmenu", (ev) => ev.preventDefault());
  e.mascote.addEventListener("pointerdown", (ev) => {
    largarGato();
    seguro = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
    try { e.mascote.setPointerCapture(ev.pointerId); } catch { /* WebView antigo: a conferência do movimento funciona na mesma*/ }
    // O ecrã da família abre com o dedo ainda em baixo, mesmo por cima do botão da casinha do próprio
    // ecrã da família: levantá-lo não pode contar como toque aí (mandava a família logo de volta).
    toqueLongo = setTimeout(() => { seguro = null; engolirLevantar(ev.pointerId); familia(); }, SEGURAR_GATO_MS);
  });
  e.mascote.addEventListener("pointermove", (ev) => {
    if (seguro && ev.pointerId === seguro.id && Math.hypot(ev.clientX - seguro.x, ev.clientY - seguro.y) > 60) largarGato();
  });
  for (const ev of ["pointerup", "pointercancel"]) {
    e.mascote.addEventListener(ev, (x) => { if (seguro && x.pointerId === seguro.id) largarGato(); });
  }

  let ativo = true;
  let quieto = null;
  const reiniciarQuieto = () => {
    clearTimeout(quieto);
    quieto = setTimeout(() => { if (ativo) e.dizer("geral.escolhe"); }, 25000);
  };
  e.raiz.addEventListener("pointerdown", reiniciarQuieto);
  ecraAtual = () => {
    ativo = false; clearTimeout(quieto); clearTimeout(toqueLongo);
    clearInterval(tique); clearTimeout(fimEfeito); clearTimeout(fimEntrada);
    saiuDoInicio = Date.now();
  };

  noInicio = true;
  // Conteúdos que chegaram por USB com a app aberta: se mudou o que há para mostrar (um jogo que
  // precisa de fotografias passou a tê-las), desenhar o ecrã inicial outra vez, em silêncio.
  verMedia().then((mudou) => { if (mudou && ativo) inicio(true); }).catch(() => {});
  if (calado) return;
  (async () => {
    if (!saudou) {
      saudou = true;
      await e.dizer(saudacao(), { cara: "img/noto/gato_amor.svg" });
      if (!ativo) return;
    }
    await e.dizer("geral.vamos_jogar");
    reiniciarQuieto();
  })();
}

// Envolvimento: um registo "sessao" por visita a uma atividade, aconteça o que acontecer lá dentro.
// active_ms conta o tempo com um toque nos últimos 60 s, para um jogo deixado aberto em cima da
// mesa não parecer jogo.
const JANELA_ATIVA = 60000;
let sessaoAtual = null;   // { pausaMs, ocultaDesde } da atividade aberta

// Ecrã apagado e aceso: registado para o ritmo do dia da pessoa, e descontado da sessão aberta.
let estavaOculto = false;
function mudarVisibilidade(oculto) {
  if (oculto === estavaOculto) return;   // os dois sinais podem disparar; contar uma vez
  estavaOculto = oculto;
  metricas.evento(oculto ? "ecra_desligado" : "ecra_ligado");
  if (!sessaoAtual) return;
  if (oculto) {
    sessaoAtual.ocultaDesde = Date.now();
    sessaoAtual.aoOcultar();
  } else if (sessaoAtual.ocultaDesde) {
    sessaoAtual.pausaMs += Date.now() - sessaoAtual.ocultaDesde;
    sessaoAtual.ocultaDesde = 0;
    sessaoAtual.aoMostrar();
  }
}
document.addEventListener("visibilitychange", () => mudarVisibilidade(document.visibilityState === "hidden"));

function abrirJogo(j) {
  limpar();
  som.efeito("abrir");
  if (SILENCIO.has(j.id)) fundo.pausar(); else fundo.tocar();
  if (FUNDO_DE.has(j.id)) app.dataset.fundo = FUNDO_DE.get(j.id);
  metricas.evento("abrir_jogo", { game: j.id });
  jogoAberto = j.id;
  const inicioSessao = Date.now();
  let ultimoToque = inicioSessao;
  let ativoMs = 0;
  let toques = 0;
  let maiorPausa = 0;   // maior intervalo entre toques: pausas compridas são o aspeto de um dia difícil
  // O tempo ativo conta-se aos bocados: de contaDesde até ao toque seguinte, ao ecrã apagar-se ou à
  // saída, no máximo JANELA_ATIVA de cada vez. Com o ecrã apagado não se conta nada (contaDesde = 0).
  let contaDesde = inicioSessao;
  const fecharBocado = (agora) => {
    if (contaDesde) ativoMs += Math.min(agora - contaDesde, JANELA_ATIVA);
    contaDesde = 0;
  };
  const contarToque = () => {
    const agora = Date.now();
    fecharBocado(agora);
    contaDesde = agora;
    maiorPausa = Math.max(maiorPausa, agora - ultimoToque);
    ultimoToque = agora;
    toques++;
  };
  app.addEventListener("pointerdown", contarToque, true);
  const estaSessao = {
    pausaMs: 0,
    ocultaDesde: 0,
    aoOcultar: () => fecharBocado(Date.now()),
    aoMostrar: () => { contaDesde = Date.now(); },
  };
  sessaoAtual = estaSessao;
  let fechado = false;
  const fecharSessao = (como) => {
    app.removeEventListener("pointerdown", contarToque, true);
    if (sessaoAtual === estaSessao) sessaoAtual = null;
    const fim = Date.now();
    const pausa = estaSessao.pausaMs + (estaSessao.ocultaDesde ? fim - estaSessao.ocultaDesde : 0);
    const duracao = Math.max(0, fim - inicioSessao - pausa);
    fecharBocado(fim);
    metricas.sessao(j.id, {
      started_at: new Date(inicioSessao).toISOString(),
      ended_at: new Date(fim).toISOString(),
      duration_ms: duracao,
      screen_off_ms: pausa,
      // Nunca mais do que o tempo com o ecrã aceso.
      active_ms: Math.min(ativoMs, duracao),
      taps: toques,
      idle_ms_max: Math.max(maiorPausa, fim - ultimoToque),
      left_by: como,
    });
  };
  let vigia = null;
  const parar = j.modulo.abrir(app, () => {
    // A saída do próprio jogo (botão da casinha, "Início" depois do prémio).
    if (fechado) return;
    fechado = true;
    clearInterval(vigia);
    fecharSessao("casa");
    ecraAtual = null;
    inicio();
  });
  // Chamado quando outra coisa (o botão de voltar do Android, o ecrã a apagar-se) sai do jogo.
  ecraAtual = (como = "voltar") => {
    clearInterval(vigia);
    if (!fechado) { fechado = true; fecharSessao(como); if (parar) parar(); }
  };
  // Um jogo sem toque há 15 minutos volta ao início (conta como deixado a meio, o que não muda
  // nenhum nível), para as pistas, as vozes e as vistas em 360 a rodar não correrem a noite toda. As
  // fotografias e a música podem ficar abertas. O ecrã inicial fica depois em sossego: o tablet está
  // escurecido desde o décimo minuto.
  if (!MEDIA.has(j.id) && !fechado) {
    vigia = setInterval(() => {
      if (fechado || document.hidden || Date.now() - ultimoToque < OCIOSO_MS) return;
      const sair = ecraAtual;
      ecraAtual = null;
      sair("ocioso");
      inicio(true);
    }, 60000);
  }
}
const MEDIA = new Set(["fotos", "musica"]);   // as vistas em 360 rodam sozinhas: também voltam ao início

function painel() {
  limpar();
  som.efeito("abrir");
  const e = ecra(inicio);
  app.append(e.raiz);
  const t = azulejos.total();
  const n = azulejos.POR_PAINEL;
  const primeiro = Math.floor(Math.max(0, t - 1) / n) * n;
  const grelha = el("div", { class: "painel" });
  e.corpo.append(grelha);
  const caixa = e.corpo.getBoundingClientRect();
  const paisagem = caixa.width > caixa.height;
  const cols = paisagem ? 4 : 3;
  const linhas = n / cols;
  const lado = Math.min(caixa.width / cols, caixa.height / linhas) * 0.9;
  grelha.style.gridTemplateColumns = `repeat(${cols}, ${lado}px)`;
  for (let i = primeiro; i < primeiro + n; i++) {
    const ganho = i < t;
    const tile = el("div", { class: `tile${ganho ? "" : " vazio"}${i === t - 1 ? " novo" : ""}`, style: { "--lado": `${lado}px` } });
    if (ganho) tile.innerHTML = azulejos.svgAzulejo(i);
    grelha.append(tile);
  }
  e.dizer("geral.painel", { cara: "img/noto/gato_amor.svg" });
}

// Ecrã escondido para a família (familia.js): só abre segurando o gato quinze segundos.
function familia() {
  limpar();
  ecraAtual = abrirFamilia(app, { voltar: inicio, abrirJogo, todos: TODOS });
}

// Introdução. soNovas=true passa só os ecrãs mais novos do que o último que a pessoa viu.
async function intro(soNovas) {
  limpar();
  fundo.pausar();   // ecrã atrás de ecrã com fala: a música andaria a subir e a descer
  const vista = ler("intro.vista", 0);
  const slides = soNovas ? introData.slides.filter((s) => s.versao > vista) : introData.slides;
  let ativo = true;
  let vistos = 0;
  let registado = false;
  const maisNova = Math.max(vista, ...introData.slides.map((s) => s.versao));
  const registar = (completo) => {
    if (registado) return;
    registado = true;
    // Ver uma vez chega: depois de um reinício a pessoa cai nos jogos, não na introdução toda outra
    // vez (o botão de ouvir do ecrã inicial repete-a quando se quiser).
    if (completo || vistos > 0) gravar("intro.vista", maisNova);
    metricas.evento("intro", { slides: slides.length, seen: vistos, completed: completo, only_new: !!soNovas });
  };
  const e = ecra(() => { ativo = false; registar(false); inicio(); });
  app.append(e.raiz);
  ecraAtual = () => { ativo = false; registar(false); };
  const figura = el("div", {});
  const frase = el("div", { class: "frase" });
  const pontos = el("div", { class: "pontos" }, slides.map(() => el("span")));
  e.corpo.append(el("div", { class: "intro" }, [figura, frase, pontos]));
  som.preCarregar(slides.map((s) => s.fala));

  if (soNovas && vista > 0) {
    e.mostrar(som.texto("intro.novidade"));
    await som.falar("intro.novidade");
  }
  for (let i = 0; i < slides.length && ativo; i++) {
    const s = slides[i];
    figura.replaceChildren();
    if (s.img.startsWith("azulejo:")) {
      const a = el("div", { html: azulejos.svgAzulejo(Number(s.img.slice(8))) });
      a.firstElementChild.setAttribute("style", "width:45vmin;height:45vmin;border:0.6vmin solid #111;animation:aparece .5s ease");
      figura.append(a);
    } else {
      figura.append(img(s.img, ""));
    }
    frase.textContent = som.texto(s.fala);
    e.balao.classList.add("vazio");
    pontos.querySelectorAll("span").forEach((p, k) => p.classList.toggle("ativo", k === i));
    vistos = i + 1;
    await som.falar(s.fala);
    await espera(1200);
  }
  if (!ativo) return;
  registar(true);
  inicio();
}

// O botão de voltar do Android vai para o início em vez de fechar a app.
function prepararAndroid() {
  const App = window.Capacitor?.Plugins?.App;
  if (App) {
    App.addListener("backButton", () => inicio());
    App.addListener("appStateChange", ({ isActive }) => mudarVisibilidade(!isActive));
  }
  // A bateria, a app apaga o ecrã ao fim de 10 minutos de sossego (MainActivity.java). Mesmo antes
  // avisa: registar, e um jogo deixado aberto volta ao início em silêncio (como aos 15 minutos
  // parado), para o botão de ligar acordar no ecrã inicial e uma atualização poder trocar com o
  // ecrã apagado. As fotografias e a música ficam abertas.
  const Q = window.Capacitor?.Plugins?.Quiosque;
  if (Q?.addListener) {
    Q.addListener("ecraApagado", (d) => {
      const extra = { mode: d?.modo === "tempo" ? "tempo" : "lock" };
      const n = bateria.nivel();
      if (n !== null) extra.level = n;
      metricas.evento("ecra_apagado_bateria", extra);
      if (jogoAberto && !MEDIA.has(jogoAberto) && ecraAtual) {
        const sair = ecraAtual;
        ecraAtual = null;
        sair("ocioso");
        inicio(true);
      }
    });
  }
}

// Atalhos de teste: #jogo=<id> abre um jogo diretamente, #familia o ecrã da família.
function atalho() {
  const h = location.hash;
  if (h.startsWith("#jogo=")) {
    const j = TODOS.find((x) => x.id === h.slice(6));   // os jogos escondidos também
    if (j) { saudou = true; abrirJogo(j); return true; }
  }
  if (h === "#familia") { familia(); return true; }
  return false;
}

async function arrancar() {
  await som.iniciar();
  document.title = som.pessoa().titulo;
  try {
    introData = await (await fetch("data/intro.json")).json();
  } catch {
    introData = { slides: [] };
  }
  prepararAndroid();
  metricas.evento("app_aberta");
  sincronizar.iniciar();
  bateria.iniciar();
  await verMedia();
  atualizar.iniciar({ evento: metricas.evento, seguro: momentoSeguro, media: novaMedia });
  const calado = atualizar.comecarCalado();
  if (atalho()) { confirmarPacote(); return; }
  const vista = ler("intro.vista", 0);
  const maisNova = Math.max(0, ...introData.slides.map((s) => s.versao));
  if (maisNova > vista) {
    // O som precisa de um primeiro toque: mostrar um só botão grande para começar.
    const e = ecra(null);
    app.append(e.raiz);
    e.mostrar(som.pessoa().saudacao);
    e.corpo.append(el("div", { class: "intro" }, [
      el("button", {
        class: "botao cor-verde",
        style: { fontSize: "9vmin", padding: "4vmin 8vmin" },
        onclick: () => { som.efeito("toque"); saudou = true; intro(vista > 0); },
      }, [img("img/proprio/ouvir.svg", ""), "Começar"]),
    ]));
  } else {
    inicio(calado);
  }
  confirmarPacote();
}

// Um pacote web novo fica à experiência até o seu primeiro ecrã estar montado: só aí se confirma a
// si próprio. Chama-se depois de o primeiro ecrã ter sido desenhado sem erro; se o desenho rebentar,
// não se chega aqui, a parte Android não recebe a confirmação e volta ao pacote anterior. Com o ecrã
// apagado (uma atualização aplicada às escuras) não há imagem para esperar: o ecrã estar montado é
// prova que chegue; senão a experiência acabava e um pacote bom voltava atrás.
function confirmarPacote() {
  setTimeout(() => {
    if (!app.firstElementChild) return;   // nada montado: não confirmar
    if (document.hidden) atualizar.confirmar();
    else requestAnimationFrame(() => atualizar.confirmar());
  }, 1500);
}

// Uma atualização só pode trocar no ecrã inicial, e só quando ninguém está a usar o tablet: sem
// toque há quietoMs, ou o tablet escurecido, ou o ecrã apagado. Nunca dentro de um jogo nem do ecrã
// da família (aí a família tem o seu próprio botão).
function momentoSeguro(quietoMs) {
  return noInicio && (adormecido || document.hidden || Date.now() - ultimoToqueGeral >= quietoMs);
}

// Foi aplicado um pacote de media (só num momento seguro, no ecrã inicial): ler o manifesto novo,
// e desenhar de novo o ecrã inicial em silêncio, para o caso de um jogo que precisa de media já
// poder aparecer.
async function novaMedia() {
  media.limpar();
  await verMedia();
  if (noInicio) inicio(true);
}

arrancar();
