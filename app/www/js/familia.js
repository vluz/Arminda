// Ecrã escondido para a família, que só abre segurando o gato quinze segundos no ecrã inicial.
// Funciona sem rede: tudo vem dos registos guardados no tablet.
// - Envio: registos à espera, último envio confirmado, servidor ao alcance, a cópia no cartão de memória.
// - Tablet: desbloquear e bloquear o quiosque, música de fundo ligada ou desligada.
// - Atualizações: versões instaladas, última verificação, um botão para procurar já e outro para
//   instalar o que está pronto.
// - Atividades ainda em teste.
// - Uso: por dia (14 dias), por atividade, e por hora do dia.
// - Recomeço para a entrega: apaga o progresso, fica o id do aparelho, os registos e as definições.

import * as som from "./som.js";
import * as metricas from "./metricas.js";
import * as sincronizar from "./sincronizar.js";
import * as azulejos from "./azulejos.js";
import * as atualizar from "./atualizar.js";
import { ler, gravar, gravarVarios, nivel, chaves, apagar } from "./estado.js";
import { el, img, ecra } from "./ui.js";

let estiloPronto = null;
function estilo() {
  if (estiloPronto) return estiloPronto;
  const link = el("link", { rel: "stylesheet", href: "css/familia.css" });
  estiloPronto = new Promise((ok) => { link.onload = ok; link.onerror = ok; });
  document.head.append(link);
  return estiloPronto;
}

const DIA = 86400000;
const min = (ms) => Math.round(ms / 60000);
const hora = (t) => new Date(t).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
const dataHora = (t) => new Date(t).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const num = (n) => Number(n).toLocaleString("pt-PT");

function tamanho(b) {
  if (b == null || b < 0) return "desconhecido";
  if (b < 1024) return `${b} bytes`;
  if (b < 1024 ** 2) return `${(b / 1024).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} MB`;
  return `${(b / 1024 ** 3).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} GB`;
}

function quando(iso) {
  if (!iso) return "nunca";
  const t = Date.parse(iso);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  if (t >= hoje.getTime()) return `hoje às ${hora(t)}`;
  if (t >= hoje.getTime() - DIA) return `ontem às ${hora(t)}`;
  return dataHora(t);
}

// ---- Recomeço para a entrega: que chaves saem e que chaves ficam ----
// Ficam: o id do aparelho, as migrações feitas uma vez, as definições, os registos (enviados e por
// enviar), a fila do cartão de memória, e tudo o que diz respeito ao envio. Saem: os níveis e os
// seus pontos, as vitórias, as séries, a coleção de azulejos, os azulejos pintados, a marca da
// introdução, e as chaves próprias de cada jogo.
const FICAM = new Set(["dispositivo", "musica.fundo", "metricas", "sd.fila"]);
const FICAM_PREFIXOS = ["migracao.", "sync.", "config.", "sd."];
const SAEM = new Set(["azulejos", "pintar.parede", "intro.vista"]);
const SAEM_PREFIXOS = ["nivel.", "progresso.", "vitorias.", "seguidas."];

export function separarChaves(ids) {
  const sair = [];
  const ficar = [];
  for (const k of chaves()) {
    const fica = FICAM.has(k) || FICAM_PREFIXOS.some((p) => k.startsWith(p));
    const sai = SAEM.has(k) || SAEM_PREFIXOS.some((p) => k.startsWith(p))
      || ids.some((id) => k === id || k.startsWith(`${id}.`));
    (sai && !fica ? sair : ficar).push(k);
  }
  return { sair: sair.sort(), ficar: ficar.sort() };
}

// ---- Resumos a partir dos registos locais ----

// Os registos que contam para os resumos: os de depois do último "Recomeçar do zero". Os anteriores
// são os testes da família antes de entregar o tablet; ficam guardados e são enviados na mesma, mas
// não aparecem nas contas, tal como no painel do servidor. A fila está por ordem de chegada.
export function desdeRecomeco(fila) {
  let i = fila.length - 1;
  while (i >= 0 && fila[i].tipo !== "reset") i--;
  return fila.slice(i + 1);
}

function porDia(fila) {
  const sessoes = fila.filter((m) => m.tipo === "sessao" && m.started_at);
  const dias = [];
  for (let d = 0; d < 14; d++) {
    const ini = new Date(); ini.setHours(0, 0, 0, 0); ini.setDate(ini.getDate() - d);
    const a = ini.getTime();
    const b = a + DIA;
    const s = sessoes.filter((m) => { const t = Date.parse(m.started_at); return t >= a && t < b; });
    let primeira = Infinity;
    let ultima = -Infinity;
    for (const m of s) {
      primeira = Math.min(primeira, Date.parse(m.started_at));
      ultima = Math.max(ultima, Date.parse(m.ended_at || m.started_at));
    }
    dias.push({
      nome: d === 0 ? "Hoje" : d === 1 ? "Ontem" : ini.toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "2-digit" }),
      ativos: min(s.reduce((t, m) => t + (m.active_ms || 0), 0)),
      sessoes: s.length,
      primeira: s.length ? hora(primeira) : "-",
      ultima: s.length ? hora(ultima) : "-",
    });
  }
  return dias;
}

function porAtividade(fila, jogos) {
  return jogos.map((j) => {
    const s = fila.filter((m) => m.tipo === "sessao" && m.game === j.id);
    const aberturas = fila.filter((m) => m.tipo === "abrir_jogo" && m.game === j.id).length;
    const rondas = fila.filter((m) => m.tipo === "ronda" && m.game === j.id);
    const tempos = [...s.map((m) => Date.parse(m.ended_at || m.started_at)), ...rondas.map((r) => Date.parse(r.started_at))]
      .filter((t) => !Number.isNaN(t));
    const ultima = tempos.length ? Math.max(...tempos) : null;
    return {
      nome: j.nome,
      oculto: !!j.oculto,
      vezes: Math.max(s.length, aberturas),
      acabadas: rondas.filter((r) => r.completed).length,
      minutos: min(s.reduce((t, m) => t + (m.active_ms || 0), 0)),
      abertos: min(s.reduce((t, m) => t + (m.duration_ms || 0), 0)),
      nivel: nivel(j.id),
      ultima,
    };
  })
    .filter((l) => l.vezes > 0 || !l.oculto)
    .sort((a, b) => b.minutos - a.minutos || b.vezes - a.vezes || (b.ultima || 0) - (a.ultima || 0));
}

function porHora(fila) {
  const desde = Date.now() - 14 * DIA;
  const horas = Array(24).fill(0);
  for (const m of fila) {
    if (m.tipo !== "sessao" || !m.started_at) continue;
    const t = Date.parse(m.started_at);
    if (t > desde) horas[new Date(t).getHours()] += m.active_ms || 0;
  }
  return horas.map(min);
}

// ---- O ecrã ----

// app: o elemento #app. voltar(): de volta ao ecrã inicial. abrirJogo(j): abre um jogo.
// todos: todos os jogos de registo.js. Devolve uma função de limpeza.
export function abrirFamilia(app, { voltar, abrirJogo, todos }) {
  let ativo = true;
  const e = ecra(voltar);
  e.raiz.classList.add("fam-ecra");
  app.append(e.raiz);
  e.mostrar("Para a família");
  const caixa = el("div", { class: "familia fam" });
  e.corpo.append(caixa);
  estilo().then(() => { if (ativo) desenhar(); });

  function desenhar() {
    const fila = ler("metricas", []);
    const jogos = todos.filter((j) => !j.modulo.ESBOCO);
    const porEnviar = fila.filter((r) => !r.s).length;

    // Em cima: um caminho de volta bem grande.
    const topo = el("div", { class: "fam-topo" }, [
      el("button", { class: "botao cor-verde fam-voltar", onclick: () => voltar() }, "Voltar"),
      el("div", { class: "fam-titulo" }, "Para a família"),
    ]);

    // O envio e a cópia no cartão de memória.
    const servidor = el("span", { class: "fam-valor" }, "a verificar...");
    const sdLinhas = el("div", {});
    const envio = el("section", { class: "fam-cartao" }, [
      el("h3", {}, "Registos e envio"),
      linha("Por enviar", el("span", { class: `fam-valor${porEnviar ? " fam-aviso" : ""}` }, `${num(porEnviar)} de ${num(fila.length)} registos`)),
      linha("Último envio com sucesso", el("span", { class: "fam-valor" }, quando(ler("sync.ultimo", null)))),
      linha("Servidor", servidor),
      sdLinhas,
      el("div", { class: "fam-botoes" }, [
        el("button", { class: "botao cor-azul fam-botao", onclick: enviarAgora }, "Enviar agora"),
      ]),
    ]);
    async function verificarServidor() {
      servidor.textContent = "a verificar...";
      servidor.className = "fam-valor";
      const ok = await sincronizar.servidorAlcancavel();
      if (!ativo) return;
      servidor.textContent = ok === null ? "não configurado" : ok ? "alcançável" : "sem ligação";
      servidor.className = `fam-valor ${ok ? "fam-bom" : "fam-aviso"}`;
    }
    async function mostrarSD() {
      const P = window.Capacitor?.Plugins?.CopiaSD;
      const est = metricas.estadoSD();
      if (!P) {
        sdLinhas.replaceChildren(linha("Cópia no cartão", el("span", { class: "fam-valor" }, "só no tablet")));
        return;
      }
      let i = null;
      try { i = await P.info(); } catch { /* aparece como desconhecido*/ }
      if (!ativo) return;
      sdLinhas.replaceChildren(
        linha("Cópia no cartão", el("span", { class: `fam-valor ${est.erro ? "fam-aviso" : "fam-bom"}` },
          est.erro ? `erro: ${est.erro}` : est.ultimaEscrita ? `última cópia ${quando(est.ultimaEscrita)}` : "à espera da primeira cópia")),
        linha("Pasta", el("span", { class: "fam-valor fam-caminho" }, i ? `${i.pasta}${i.removivel ? "" : " (sem cartão: memória interna)"}` : "desconhecida")),
        linha("Escrito hoje", el("span", { class: "fam-valor" }, i ? tamanho(i.bytesHoje) : "desconhecido")),
        linha("Livre no cartão", el("span", { class: "fam-valor" }, i ? `${tamanho(i.livre)} de ${tamanho(i.total)}` : "desconhecido")),
        linha("À espera de cópia", el("span", { class: "fam-valor" }, `${num(est.pendentes)} registos`)),
      );
    }
    async function enviarAgora() {
      servidor.textContent = "a enviar...";
      try { await metricas.escreverSD(); } catch { /* o estado mostra-o*/ }
      try { await sincronizar.enviar(); } catch { /* em silêncio, como o temporizador*/ }
      if (ativo) desenhar();
    }

    // Tablet: modo quiosque e música de fundo.
    const Quiosque = window.Capacitor?.Plugins?.Quiosque;
    const quiosque = el("div", { class: "fam-botoes" });
    async function mostrarQuiosque() {
      if (!Quiosque) return;
      let s;
      try { s = await Quiosque.estado(); } catch { return; }
      if (!ativo) return;
      if (!s.dono) {
        quiosque.replaceChildren(el("p", {}, "Modo quiosque: não ativo neste tablet."));
        desistir.replaceChildren();
        return;
      }
      const ate = s.pausaAte > Date.now() ? new Date(s.pausaAte).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : null;
      quiosque.replaceChildren(
        el("p", { class: "fam-largo" }, s.bloqueado ? "Tablet bloqueado nos jogos." : `Tablet desbloqueado${ate ? ` até às ${ate}` : ""}.`),
        el("button", { class: "botao cor-amarelo fam-botao",
          onclick: async () => { await Quiosque.pausar({ minutos: 15 }); mostrarQuiosque(); } }, "Desbloquear por 15 minutos"),
        el("button", { class: "botao cor-verde fam-botao",
          onclick: async () => { await Quiosque.retomar(); mostrarQuiosque(); } }, "Bloquear já"),
      );
    }
    const musica = el("button", { class: "botao fam-botao", onclick: () => {
      gravar("musica.fundo", !ler("musica.fundo", true));
      window.dispatchEvent(new CustomEvent("mae:musica-fundo", { detail: ler("musica.fundo", true) }));
      mostrarMusica();
    } });
    function mostrarMusica() {
      const ligada = ler("musica.fundo", true);
      musica.className = `botao fam-botao ${ligada ? "cor-verde" : "cor-branco"}`;
      musica.textContent = ligada ? "Música de fundo: ligada" : "Música de fundo: desligada";
    }
    mostrarMusica();

    // Para quem é o tablet (um tablet pode mudar de mãos). As duas pessoas
    // vêm de tools/falas.py (PESSOA e PESSOA_2, por data/pessoa.json); com uma só pessoa, não aparece
    // nada. As saudações e os elogios tomam a forma escolhida e cada registo, daí em diante, leva
    // "player". Os níveis não são tocados: "Recomeçar do zero" é um passo à parte. Recarrega para o
    // ecrã inicial acompanhar logo.
    const jogador = el("div", { class: "fam-botoes" });
    function mostrarJogador() {
      const pessoas = som.pessoasDisponiveis();
      if (pessoas.length < 2) { jogador.replaceChildren(); return; }
      const atual = som.quem();
      jogador.replaceChildren(
        el("p", { class: "fam-largo" },
          `Este tablet é ${som.pessoa(atual).rotulo}. Muda o que o gato diz; o progresso só muda com "Recomeçar do zero".`),
        ...pessoas.map((v) =>
          el("button", { class: `botao fam-botao ${atual === v ? "cor-verde" : "cor-branco"}`, onclick: () => {
            if (atual === v) return;
            gravar("config.pessoa", v);
            metricas.evento("jogador", { player: v });
            location.reload();
          } }, `É ${som.pessoa(v).rotulo}`)),
      );
    }
    mostrarJogador();

    // Um dia difícil: deixar uma ronda a meio nunca muda um nível,
    // por isso num dia em que nem as contas do nível 1 saem, nada desce sozinho. Um toque
    // baixa todos os jogos um nível; três rondas normais voltam a subi-lo, e um dia bom desfaz tudo.
    const diaDificil = el("div", { class: "fam-botoes" });
    function difPasso1() {
      diaDificil.replaceChildren(el("button", { class: "botao cor-branco fam-botao", onclick: difPasso2 },
        "Dia difícil: tudo um nível mais fácil"));
    }
    function difPasso2() {
      diaDificil.replaceChildren(
        el("p", { class: "fam-largo" }, "Baixa um nível em todos os jogos que estão acima do nível 1."),
        el("button", { class: "botao cor-amarelo fam-botao", onclick: difJa }, "Sim, mais fácil"),
        el("button", { class: "botao cor-branco fam-botao", onclick: difPasso1 }, "Não"),
      );
    }
    function difJa() {
      const novos = {};
      for (const j of todos) {
        const n = nivel(j.id);
        if (n > 1) {
          novos[`nivel.${j.id}`] = n - 1;
          novos[`progresso.${j.id}`] = { pontos: 0, dificeis: 0 };
        }
      }
      gravarVarios(novos);
      const baixados = Object.keys(novos).length / 2;
      metricas.evento("mais_facil", { games_lowered: baixados });
      diaDificil.replaceChildren(el("p", { class: "fam-largo" },
        baixados ? `Feito: ${baixados} jogos ficaram um nível mais fáceis.` : "Todos os jogos já estão no nível 1."));
    }
    difPasso1();

    // Atualizações pela internet (atualizar.js e o plugin nativo Atualizar).
    const RESULTADOS = {
      nada_novo: "tudo atualizado", pronto: "atualização pronta a instalar", sem_ligacao: "sem ligação",
      sem_chave: "esta aplicação não tem chave de atualizações", sem_config: "servidor não configurado", recusado: "recusada (ficheiro não confere)",
      precisa_apk: "precisa primeiro da nova aplicação", manifesto_invalido: "resposta inválida do servidor",
      ocupado: "já está a procurar", erro: "erro",
      sem_espaco: "falta espaço no cartão de memória", media_sem_base: "fotografias: ficaram muito para trás, levar por USB",
    };
    const textoResultado = (r) => RESULTADOS[r] || (r && r.startsWith("servidor_") ? `servidor respondeu ${r.slice(9)}` : r || "-");
    const atLinhas = el("div", {});
    const atBotoes = el("div", { class: "fam-botoes" });
    async function mostrarAtualizacoes(texto) {
      const s = await atualizar.estado();
      if (!ativo) return;
      if (!s) {
        atLinhas.replaceChildren(linha("Atualizações", el("span", { class: "fam-valor" }, "só no tablet")));
        atBotoes.replaceChildren();
        return;
      }
      const pronta = [
        s.pendente ? `jogos versão ${s.pendente}` : s.apkPendente ? `aplicação código ${s.apkPendente}` : "",
        s.mediaPendente ? `fotografias e música versão ${s.mediaPendente}` : "",
      ].filter(Boolean).join(", ") || null;
      atLinhas.replaceChildren(
        linha("Versão dos jogos", el("span", { class: "fam-valor" }, `${atualizar.BUNDLE}${s.prova ? " (em prova)" : ""}`)),
        linha("Versão da aplicação", el("span", { class: "fam-valor" }, `${s.versionName} (código ${s.versionCode})`)),
        linha("Fotografias e música", el("span", { class: "fam-valor" }, `versão ${s.mediaVersao ?? 0}`)),
        linha("Última procura", el("span", { class: "fam-valor" }, s.verificadoEm ? quando(new Date(s.verificadoEm).toISOString()) : "nunca")),
        linha("Resultado", el("span", { class: `fam-valor${s.resultado === "pronto" ? " fam-bom" : ""}` },texto || (s.resultado === "pronto" && !pronta ? "instalada" : textoResultado(s.resultado)))),
        pronta ? linha("Pronta", el("span", { class: "fam-valor fam-bom" }, pronta)) : "",
      );
      atBotoes.replaceChildren(
        el("button", { class: "botao cor-azul fam-botao", onclick: procurar }, "Procurar atualizações"),
        pronta ? el("button", { class: "botao cor-verde fam-botao", onclick: instalarJa }, "Instalar agora") : "",
      );
    }
    async function procurar() {
      mostrarAtualizacoes("a procurar...");
      await atualizar.verificar();
      if (ativo) mostrarAtualizacoes();
    }
    async function instalarJa() {
      mostrarAtualizacoes("a instalar...");
      // Uma atualização web recarrega a página num segundo ou dois; uma atualização da app reinicia a
      // app; fotografias e música novas não precisam de nenhuma das duas coisas.
      const feito = await atualizar.aplicar();
      if ((!feito || feito === "media") && ativo) mostrarAtualizacoes(feito === "media" ? "fotografias e música instaladas" : undefined);
    }
    const atualizacoes = el("section", { class: "fam-cartao" }, [el("h3", {}, "Atualizações"), atLinhas, atBotoes]);

    // Modo quiosque desligado de vez (larga-se o lugar de dono do aparelho), em dois passos. Para
    // devolver o tablet ou tirar a app; depois disso a app é uma app normal e pode ser desinstalada.
    const desistir = el("div", { class: "fam-botoes" });
    function desPasso1() {
      desistir.replaceChildren(el("button", { class: "botao cor-branco fam-botao", onclick: desPasso2 }, "Deixar o modo quiosque"));
    }
    function desPasso2() {
      desistir.replaceChildren(
        el("p", { class: "fam-largo fam-aviso" },
          "Desliga o modo quiosque de vez: o tablet volta a ser um tablet normal e a app deixa de arrancar sozinha. "
          + "Para voltar a ligar é preciso um computador. O progresso e os registos ficam."),
        el("button", { class: "botao cor-vermelho fam-botao", onclick: desPasso3 }, "Continuar"),
        el("button", { class: "botao cor-branco fam-botao", onclick: desPasso1 }, "Não"),
      );
    }
    function desPasso3() {
      desistir.replaceChildren(
        el("p", { class: "fam-largo fam-aviso" }, "Tem a certeza? Isto não se desfaz no tablet."),
        el("button", { class: "botao cor-vermelho fam-botao", onclick: desistirJa }, "Sim, deixar o modo quiosque"),
        el("button", { class: "botao cor-branco fam-botao", onclick: desPasso1 }, "Não, manter"),
      );
    }
    async function desistirJa() {
      let r = null;
      try { r = await Quiosque.desistir(); } catch { /* aparece abaixo*/ }
      metricas.evento("quiosque_desligado", { ok: !!r?.feito });
      if (!ativo) return;
      await mostrarQuiosque();
      desistir.replaceChildren(el("p", { class: "fam-largo" },
        r?.feito ? "Feito: o modo quiosque está desligado." : "Não foi possível desligar o modo quiosque."));
    }
    desPasso1();

    const tablet = el("section", { class: "fam-cartao" }, [
      el("h3", {}, "Tablet"),
      Quiosque ? quiosque : null,
      el("div", { class: "fam-botoes" }, [musica]),
      jogador,
      diaDificil,
    ]);

    // Jogos que a família ainda está a experimentar: só se abrem daqui, nunca do ecrã inicial.
    const emTeste = jogos.filter((j) => j.oculto);
    const testes = emTeste.length
      ? el("section", { class: "fam-cartao" }, [
        el("h3", {}, "Em teste (só aparecem aqui até serem aprovados)"),
        el("div", { class: "fam-botoes" }, emTeste.map((j) =>
          el("button", { class: `botao ${j.cor} fam-botao fam-jogo`, onclick: () => abrirJogo(j) }, [img(j.figura, ""), j.nome]))),
      ])
      : null;

    // Uso por dia, nos últimos 14 dias.
    const contam = desdeRecomeco(fila);
    const dias = porDia(contam);
    // Os cabeçalhos das colunas de números alinham com os números (a primeira coluna é texto).
    const th = (t, i) => el("th", i > 0 && !t.startsWith("Última vez") ? { class: "n" } : {}, t);
    const td = (t, n) => el("td", n ? { class: "n" } : {}, String(t));
    const tabelaDias = el("table", {}, [
      el("tr", {}, ["Dia", "Minutos a jogar", "Visitas", "Primeira", "Última"].map(th)),
      ...dias.map((d) => el("tr", d.sessoes ? {} : { class: "fam-vazio" },
        [td(d.nome), td(d.ativos, 1), td(d.sessoes, 1), td(d.primeira, 1), td(d.ultima, 1)])),
    ]);

    // Por atividade.
    const atividades = porAtividade(contam, jogos);
    const tabelaJogos = el("table", {}, [
      el("tr", {}, ["Atividade", "Vezes", "Rondas acabadas", "Minutos a jogar", "Nível", "Última vez"].map(th)),
      ...atividades.map((l) => el("tr", l.vezes ? {} : { class: "fam-vazio" }, [
        td(l.oculto ? `${l.nome} (teste)` : l.nome), td(l.vezes, 1), td(l.acabadas, 1), td(l.minutos, 1), td(l.nivel, 1),
        td(l.ultima ? dataHora(l.ultima) : "-"),
      ])),
    ]);

    // Por hora do dia, com barras simples em CSS.
    const horas = porHora(contam);
    const maior = Math.max(1, ...horas);
    const barras = el("div", { class: "fam-barras" }, horas.map((v, h) =>
      el("div", { class: "fam-coluna" }, [
        el("div", { class: "fam-num" }, v ? String(v) : ""),
        el("div", { class: v ? "fam-barra" : "fam-barra zero", style: { height: `${(v / maior) * 100}%` } }),
        el("div", { class: "fam-hora" }, String(h)),
      ])));

    // Recomeço para a entrega, em dois passos.
    const recomecar = el("div", { class: "fam-botoes" });
    function passo1() {
      recomecar.replaceChildren(el("button", { class: "botao cor-branco fam-botao", onclick: passo2 }, "Recomeçar do zero"));
    }
    function passo2() {
      const { sair } = separarChaves(todos.map((j) => j.id));
      recomecar.replaceChildren(
        el("p", { class: "fam-largo fam-aviso" },
          `Apaga níveis, azulejos (${azulejos.total()}), pinturas e a marca da apresentação: ${sair.length} itens. Os registos ficam.`),
        el("button", { class: "botao cor-vermelho fam-botao", onclick: () => recomecarJa() }, "Sim, apagar progresso"),
        el("button", { class: "botao cor-branco fam-botao", onclick: passo1 }, "Não, deixar como está"),
      );
    }
    async function recomecarJa() {
      const { sair } = separarChaves(todos.map((j) => j.id));
      metricas.evento("reset", { keys_cleared: sair.length, azulejos: azulejos.total() });
      try { await metricas.escreverSD(); } catch { /* o registo continua na fila*/ }
      apagar(sair);
      location.reload();
    }
    passo1();

    caixa.replaceChildren(
      topo,
      envio,
      tablet,
      atualizacoes,
      testes,
      el("section", { class: "fam-cartao" }, [
        el("h3", {}, "Últimos 14 dias"),
        el("p", {}, `Azulejos ganhos: ${azulejos.total()}.`),
        tabelaDias,
      ]),
      el("section", { class: "fam-cartao" }, [el("h3", {}, "Por atividade"), tabelaJogos]),
      el("section", { class: "fam-cartao" }, [
        el("h3", {}, "Minutos a jogar por hora do dia, últimos 14 dias"),
        horas.some((v) => v) ? barras : el("p", {}, "Ainda sem dados."),
      ]),
      el("section", { class: "fam-cartao fam-perigo" }, [
        el("h3", {}, "Entrega do tablet"),
        el("p", {}, "Põe o progresso a zero antes de entregar o tablet. Os registos e o envio continuam."),
        recomecar,
      ]),
      Quiosque ? el("section", { class: "fam-cartao fam-perigo" }, [
        el("h3", {}, "Modo quiosque"),
        el("p", {}, "Só para devolver o tablet ou tirar a app. O dia a dia não precisa disto."),
        desistir,
      ]) : "",
      el("div", { class: "fam-botoes" }, [el("button", { class: "botao cor-verde fam-voltar", onclick: () => voltar() }, "Voltar")]),
    );
    verificarServidor();
    mostrarSD();
    mostrarQuiosque();
    mostrarAtualizacoes();
  }

  return () => { ativo = false; };
}

function linha(rotulo, valor) {
  return el("div", { class: "fam-linha" }, [el("span", { class: "fam-rotulo" }, rotulo), valor]);
}
