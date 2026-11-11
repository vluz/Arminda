// O meu jardim: regar vasos de flores, vê-las crescer, apanhá-las para o cesto.
// Nunca acaba e não se pode perder. No nível 1 rega-se com um toque no vaso;
// do nível 2 em diante pede-se à pessoa que arraste o regador até ao vaso.
// Nível 3: o gato pede uma flor ("Rega a rosa!"); pequenas etiquetas mostram o que cresce em cada vaso.
// Nível 4: pode haver um caracol ou uma erva daninha no vaso pedido; um toque tira-o antes de regar.
// Nível 5: o gato pede duas flores seguidas e o balão apaga-se: é preciso decorar as duas.

import * as som from "../som.js";
import * as metricas from "../metricas.js";
import { ler, gravar, nivel, ajustarNivel } from "../estado.js";
import { el, img, ecra, espera, premio, estilo } from "../ui.js";

const FLORES = {
  rosa: "img/noto/rosa.svg",
  malmequer: "img/noto/malmequer.svg",
  girassol: "img/noto/girassol.svg",
  tulipa: "img/noto/tulipa.svg",
  margarida: "img/proprio/margarida.svg",
  cravo: "img/proprio/cravo.svg",
};
const NOMES = Object.keys(FLORES);
const VASOS = 5;
const FLORES_POR_AZULEJO = 5;
const NIVEL_MAX = 5;
const PRAGAS = { caracol: "img/noto/caracol.svg", erva: "img/noto/erva.svg" };

function florAoCalhas(evitar = []) {
  const livres = NOMES.filter((f) => !evitar.includes(f));
  const lista = livres.length ? livres : NOMES;
  return lista[Math.floor(Math.random() * lista.length)];
}

// As fases 0 e 1 são um rebento, pequeno e depois maior; as fases 2 e 3 são a flor, a abrir e depois aberta.
function imagemPlanta(v) {
  return v.fase <= 1 ? "img/noto/rebento.svg" : FLORES[v.flor];
}

function estadoInicial() {
  const vasos = [];
  for (let i = 0; i < VASOS; i++) vasos.push({ flor: florAoCalhas(vasos.map((v) => v.flor)), fase: 0 });
  return { vasos, colhidas: 0 };
}

export const NIVEIS_MAX = NIVEL_MAX;

export function abrir(app, sair) {
  estilo("jardim");
  const e = ecra(() => terminar());
  app.append(e.raiz);
  let ativo = true;
  const n = nivel("jardim");
  const arrastar = n >= 2;
  const pedidos = n >= 3;
  const comPragas = n >= 4;
  const memoria = n >= 5;
  const jardim = ler("jardim") || estadoInicial();
  const inicio = Date.now();
  const stats = {
    regas: 0, colhidas: 0, toques: 0, falhas: 0, bichos: 0, bichosApanhados: 0,
    pedidos: 0, certos: 0, errados: 0, repeticoes: 0, pragas: 0, pragasTiradas: 0, bloqueadas: 0,
  };
  let desdeAzulejo = ler("jardim.desdeAzulejo", 0);
  let ocupado = false;
  const temporizadores = [];
  let pedido = [];          // flores pedidas e ainda não regadas
  let pedidoFalas = [];     // as frases que as pediram, para dizer outra vez
  const pragas = new Map(); // índice do vaso -> elemento da praga

  function guardar() {
    gravar("jardim", jardim);
    gravar("jardim.desdeAzulejo", desdeAzulejo);
  }

  function terminar() {
    if (!ativo) return;
    ativo = false;
    temporizadores.forEach(clearTimeout);
    const dur = Date.now() - inicio;
    // O jardim nunca acaba: uma visita conta como ronda quando a pessoa jogou a sério (8 regas ou
    // tentativas). Uma espreitadela rápida é uma ronda deixada a meio e não muda nada.
    const completo = stats.regas + stats.falhas >= 8;
    metricas.ronda("jardim", {
      level: n,
      started_at: new Date(inicio).toISOString(),
      duration_ms: dur,
      completed: completo,
      score: stats.colhidas,
      waterings: stats.regas,
      picked: stats.colhidas,
      taps: stats.toques,
      missed_drops: stats.falhas,
      visitors_shown: stats.bichos,
      visitors_caught: stats.bichosApanhados,
      accuracy: stats.regas + stats.falhas ? Math.round((stats.regas / (stats.regas + stats.falhas)) * 100) / 100 : null,
      requests: stats.pedidos,
      requests_right: stats.certos,
      requests_wrong: stats.errados,
      request_repeats: stats.repeticoes,
      pests_shown: stats.pragas,
      pests_removed: stats.pragasTiradas,
      blocked_waterings: stats.bloqueadas,
    });
    // Subir quando a pessoa rega com facilidade (e encontra as flores pedidas); descer se as gotas
    // falham muito ou se rega muitas vezes a flor errada.
    ajustarNivel("jardim", NIVEL_MAX, {
      completo,
      facil: completo && stats.regas >= 8 && stats.falhas <= 2 && (!pedidos || (stats.certos >= 5 && stats.errados <= 1)),
      dificil: completo && ((arrastar && stats.falhas > stats.regas) || (pedidos && stats.errados > Math.max(2, stats.certos))),
    });
    guardar();
    e.raiz.remove();
    sair();
  }

  const cena = el("div", { class: "jardim" });
  const sol = img("img/noto/sol.svg");
  sol.className = "sol";
  const nuvem = img("img/noto/nuvem.svg");
  nuvem.className = "nuvem";
  const vasosEl = el("div", { class: "vasos" });
  const contagem = el("div", {}, String(jardim.colhidas));
  const cesto = el("div", { class: "cesto" }, [img("img/noto/cesto.svg"), contagem]);
  const regador = el("button", { class: "regador", "aria-label": "Regador" }, [img("img/proprio/regador.svg")]);
  cena.append(sol, nuvem, vasosEl, cesto, regador);
  e.corpo.append(cena);

  const vasos = jardim.vasos.map((v, i) => {
    const planta = el("div", { class: "planta" }, [img(imagemPlanta(v))]);
    const b = el("button", { class: `vaso-flor fase-${v.fase}` }, [
      img("img/noto/gota.svg"),
      planta,
      img("img/proprio/vaso.svg"),
    ]);
    b.firstChild.className = "gotas";
    b.lastChild.className = "vaso";
    if (pedidos) {
      // Uma pequena etiqueta na terra mostra o que cresce ali.
      const placa = el("div", { class: "placa" }, [img(FLORES[v.flor])]);
      b.append(placa);
    }
    b.dataset.flor = v.flor;
    b.addEventListener("click", () => tocarVaso(i));
    vasosEl.append(b);
    return b;
  });

  function desenhar(i) {
    const v = jardim.vasos[i];
    const b = vasos[i];
    b.classList.remove("fase-0", "fase-1", "fase-2", "fase-3");
    b.classList.add(`fase-${v.fase}`);
    b.querySelector(".planta img").src = imagemPlanta(v);
    b.dataset.flor = v.flor;
    const placa = b.querySelector(".placa img");
    if (placa) placa.src = FLORES[v.flor];
  }

  // Pedidos (do nível 3 em diante).
  async function dizerPedido() {
    for (const id of pedidoFalas) {
      if (!ativo) return;
      await e.dizer(id);
    }
    if (memoria && pedidoFalas.length > 1 && ativo) {
      // O balão apaga-se ao fim de um momento: a pessoa guarda as duas flores na cabeça.
      const texto = e.balao.textContent;
      temporizadores.push(setTimeout(() => { if (e.balao.textContent === texto) e.balao.classList.add("vazio"); }, 2500));
    }
  }

  async function fazerPedido() {
    if (!pedidos || !ativo) return;
    // Só pedir um tipo que não tenha já um vaso em flor aberta: senão a pessoa iria
    // à mais bonita, que já não pode levar mais água.
    const emFlor = new Set(jardim.vasos.filter((v) => v.fase >= 3).map((v) => v.flor));
    const porRegar = [...new Set(jardim.vasos.filter((v) => v.fase < 3 && !emFlor.has(v.flor)).map((v) => v.flor))];
    if (!porRegar.length) { pedido = []; pedidoFalas = []; return; }
    const escolha = [];
    const quantos = memoria ? 2 : 1;
    for (const f of porRegar.sort(() => Math.random() - 0.5)) if (escolha.length < quantos) escolha.push(f);
    pedido = escolha;
    pedidoFalas = escolha.map((f, k) => (k === 0 ? `jardim.rega_${f}` : `jardim.depois_${f}`));
    stats.pedidos++;
    // Às vezes há um caracol ou uma erva daninha no primeiro vaso pedido.
    let praga = null;
    if (comPragas && Math.random() < 0.5) {
      const i = jardim.vasos.findIndex((v, k) => v.flor === escolha[0] && v.fase < 3 && !pragas.has(k));
      if (i >= 0) praga = porPraga(i);
    }
    await dizerPedido();
    if (praga && ativo && pragas.has(praga.i)) await e.dizer(`jardim.${praga.tipo}`);
  }

  function porPraga(i) {
    const tipo = Math.random() < 0.5 ? "caracol" : "erva";
    const p = el("div", { class: `praga ${tipo}` }, [img(PRAGAS[tipo])]);
    vasos[i].append(p);
    pragas.set(i, p);
    stats.pragas++;
    return { i, tipo };
  }

  async function tirarPraga(i) {
    const p = pragas.get(i);
    pragas.delete(i);
    stats.pragasTiradas++;
    som.efeito("colher", 0.6);
    p.classList.add("sai");
    temporizadores.push(setTimeout(() => p.remove(), 700));
    await e.dizer("jardim.limpo", { cara: "img/noto/gato_feliz.svg" });
  }

  // Confere o pedido antes de regar. Devolve verdadeiro quando este vaso pode ser regado agora.
  async function podeRegar(i) {
    if (!pedidos) return true;
    // As recusas são ditas sem prender o jardim: a pessoa pode tentar outra vez enquanto o gato fala.
    if (pragas.has(i)) {
      stats.bloqueadas++;
      som.efeito("quase", 0.4);
      e.dizer("jardim.primeiro");
      return false;
    }
    if (!pedido.length) return true;
    if (pedido.includes(jardim.vasos[i].flor)) return true;
    stats.errados++;
    stats.repeticoes++;
    som.efeito("quase", 0.4);
    (async () => {
      await e.dizer("jardim.essa_nao");
      if (ativo) await dizerPedido();
    })();
    return false;
  }

  async function tentarRegar(i) {
    if (ocupado || jardim.vasos[i].fase >= 3) return;
    ocupado = true;
    const pode = await podeRegar(i);
    ocupado = false;
    if (!pode || !ativo) return;
    const flor = jardim.vasos[i].flor;
    const pedida = pedidos && pedido.includes(flor);
    if (pedida) {
      pedido = pedido.filter((f) => f !== flor);
      pedidoFalas = pedidoFalas.filter((id) => !id.endsWith(`_${flor}`));
      stats.certos++;
    }
    await regar(i);
    if (!ativo || !pedidos) return;
    if (pedida && pedido.length) await e.dizer("jardim.e_agora", { cara: "img/noto/gato_feliz.svg" });
    else if (!pedido.length && jardim.vasos.some((v) => v.fase < 3) && !jardim.vasos.some((v) => v.fase >= 3)) {
      await espera(600);
      await fazerPedido();
    }
  }

  async function regar(i) {
    const v = jardim.vasos[i];
    if (v.fase >= 3 || ocupado) return;
    ocupado = true;
    stats.regas++;
    vasos[i].classList.add("a-regar");
    som.agua();
    await espera(900);
    vasos[i].classList.remove("a-regar");
    v.fase++;
    desenhar(i);
    guardar();
    // Saiu durante a rega: a planta cresce na mesma, mas nada mais toca no ecrã inicial.
    if (!ativo) return;
    som.efeito("crescer", 0.5);
    // Libertar o jardim logo que a flor cresceu: a pessoa pode regar o vaso seguinte com o gato
    // ainda a falar (uma frase nova interrompe simplesmente a antiga).
    ocupado = false;
    if (v.fase === 2) await e.dizer("jardim.nasceu");
    else if (v.fase === 3) {
      await e.dizer(`jardim.${v.flor}`, { cara: "img/noto/gato_amor.svg" });
      if (ativo) await e.dizer("jardim.apanhar");
    } else if (Math.random() < 0.4) await e.dizer(som.elogio(), { cara: "img/noto/gato_feliz.svg" });
  }

  async function colher(i) {
    if (ocupado) return;
    ocupado = true;
    const v = jardim.vasos[i];
    som.efeito("colher");
    await e.dizer("jardim.bonita", { cara: "img/noto/gato_amor.svg" });
    // Saiu enquanto o gato falava: a flor fica para a próxima vez, e nenhum prémio toca no ecrã inicial.
    if (!ativo) return;
    jardim.colhidas++;
    stats.colhidas++;
    desdeAzulejo++;
    contagem.textContent = String(jardim.colhidas);
    const outras = jardim.vasos.filter((_, k) => k !== i).map((x) => x.flor);
    jardim.vasos[i] = { flor: pedidos ? florAoCalhas(outras) : florAoCalhas(), fase: 0 };
    desenhar(i);
    guardar();
    if (desdeAzulejo >= FLORES_POR_AZULEJO) {
      desdeAzulejo = 0;
      guardar();
      const r = await premio(e, e.raiz);
      if (r === "casa") { ocupado = false; terminar(); return; }
    }
    ocupado = false;
    if (pedidos) {
      if (!jardim.vasos.some((x) => x.fase >= 3)) {
        if (pedido.length) await dizerPedido();
        else await fazerPedido();
      }
    } else if (v && Math.random() < 0.3) e.dizer("jardim.crescer");
  }

  function tocarVaso(i) {
    if (!ativo) return;
    stats.toques++;
    if (pragas.has(i)) { tirarPraga(i); return; }
    som.efeito("toque", 0.4);
    if (jardim.vasos[i].fase >= 3) colher(i);
    else if (!arrastar) regar(i);
    else {
      regador.classList.add("ativo");
      e.dizer("jardim.regador");
    }
  }

  // Arrastar o regador (do nível 2 em diante): levantá-lo, mexer, largar num vaso.
  if (arrastar) {
    let inicioToque = null;
    regador.addEventListener("pointerdown", (ev) => {
      if (ocupado) return;
      regador.setPointerCapture(ev.pointerId);
      regador.classList.remove("ativo");
      const r = regador.getBoundingClientRect();
      inicioToque = { x: ev.clientX, y: ev.clientY, dx: ev.clientX - r.left, dy: ev.clientY - r.top };
      regador.classList.add("a-arrastar");
    });
    regador.addEventListener("pointermove", (ev) => {
      if (!inicioToque) return;
      regador.style.transform = `translate(${ev.clientX - inicioToque.x}px, ${ev.clientY - inicioToque.y}px)`;
    });
    const largar = (ev) => {
      if (!inicioToque) return;
      const moveu = Math.hypot(ev.clientX - inicioToque.x, ev.clientY - inicioToque.y) > 20;
      inicioToque = null;
      regador.style.transform = "";
      regador.classList.remove("a-arrastar");
      if (!moveu) return;
      // O bico está à esquerda do regador; aponta-se com o ponto por baixo do dedo.
      // O vaso por baixo do dedo, com uma folga generosa; quando servem dois (vasos em duas filas num
      // ecrã ao alto), ganha aquele cujo centro está mais perto.
      let alvo = -1;
      let melhor = Infinity;
      vasos.forEach((b, k) => {
        const r = b.getBoundingClientRect();
        const dentro = ev.clientX > r.left - r.width * 0.3 && ev.clientX < r.right + r.width * 0.3 &&
          ev.clientY > r.top - r.height * 0.4 && ev.clientY < r.bottom + r.height * 0.2;
        const d = Math.hypot(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2));
        if (dentro && d < melhor) { melhor = d; alvo = k; }
      });
      if (alvo >= 0 && jardim.vasos[alvo].fase < 3) tentarRegar(alvo);
      else if (alvo >= 0) e.dizer("jardim.apanhar");   // flor aberta: nunca um nada em silêncio
      else {
        stats.falhas++;
        som.efeito("quase", 0.4);
      }
    };
    regador.addEventListener("pointerup", largar);
    regador.addEventListener("pointercancel", largar);
  } else {
    regador.addEventListener("click", () => {
      // No nível 1 o regador rega o vaso com mais sede.
      const i = jardim.vasos.findIndex((v) => v.fase < 3);
      if (i >= 0) regar(i);
    });
  }

  // De vez em quando passa uma borboleta ou um pássaro. Tocar-lhe é uma pequena surpresa.
  function visita() {
    if (!ativo) return;
    const passaro = Math.random() < 0.4;
    const b = el("button", { class: "bicho" }, [img(passaro ? "img/noto/passaro.svg" : "img/noto/borboleta.svg")]);
    const y = 8 + Math.random() * 30;
    const dur = 9000;
    b.style.top = `${y}%`;
    b.style.left = "-15%";
    b.style.transition = `left ${dur}ms linear`;
    cena.append(b);
    stats.bichos++;
    requestAnimationFrame(() => requestAnimationFrame(() => { b.style.left = "105%"; }));
    if (passaro) { som.piu(); if (!pedidos) e.dizer("jardim.passarinho"); }
    b.addEventListener("click", () => {
      stats.bichosApanhados++;
      som.efeito("par", 0.5);
      if (passaro) som.piu();
      b.style.transition = "transform 0.5s ease, opacity 0.5s ease";
      b.style.transform = "scale(1.6)";
      b.style.opacity = "0";
      e.dizer(som.elogio(), { cara: "img/noto/gato_feliz.svg" });
    }, { once: true });
    temporizadores.push(setTimeout(() => b.remove(), dur + 200));
    temporizadores.push(setTimeout(visita, 20000 + Math.random() * 25000));
  }

  (async () => {
    await e.dizer("jardim.bem_vinda");
    if (!ativo) return;
    if (jardim.vasos.some((v) => v.fase < 3)) {
      await e.dizer("jardim.sede");
      if (arrastar && ativo) await e.dizer("jardim.regador");
      if (pedidos && ativo) {
        await e.dizer(memoria ? "jardim.lembra" : "jardim.placas");
        if (ativo && jardim.vasos.some((v) => v.fase >= 3)) await e.dizer("jardim.apanhar");
        else if (ativo) await fazerPedido();
      }
    } else {
      await e.dizer("jardim.apanhar");
    }
    if (ativo) temporizadores.push(setTimeout(visita, 12000));
  })();
  return () => terminar();
}
