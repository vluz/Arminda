// Efeitos sonoros e frases ditas.
// Uma frase dita toca a gravação da família quando existe, senão a voz do computador.

import * as fundo from "./fundo.js";
import { ler } from "./estado.js";

// Para quem é o tablet (ecrã da família): "1" (a pessoa definida em tools/falas.py) ou "2" (a
// segunda pessoa, opcional). Uma frase com uma gémea "<id>__2" em falas.json é dita e mostrada
// nessa forma quando o tablet é da segunda pessoa.
export function quem() {
  return ler("config.pessoa", "1") === "2" && pessoas["2"] ? "2" : "1";
}

// data/pessoa.json, escrito por tools/falas.py: como se trata cada pessoa, a saudação, o título, o rótulo.
let pessoas = { "1": { tratamento: "", genero: "f", rotulo: "", titulo: "Jogos", saudacao: "Olá!" } };
export function pessoa(n = quem()) {
  return pessoas[n] || pessoas["1"];
}
export function pessoasDisponiveis() {
  return Object.keys(pessoas);
}

function variante(id) {
  if (quem() === "2" && textos.has(`${id}__2`)) return `${id}__2`;
  return id;
}

let ctx = null;
const cache = new Map();
const textos = new Map();
let familia = new Set();
let vozAtual = null;
let ultimoElogio = "";

function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Os browsers mantêm o som fechado até ao primeiro toque.
window.addEventListener("pointerdown", () => audio(), { capture: true });

// A fala descodificada é grande (cerca de 190 KB por segundo de frase a 48 kHz). Guardar só as
// frases mais recentes, para um tablet que corre semanas sem reiniciar não encher a memória.
// Os efeitos sonoros (snd/) são poucos e ficam sempre.
const MAX_FALAS = 120;
async function carregarBuffer(url) {
  if (cache.has(url)) {
    const p = cache.get(url);
    cache.delete(url);
    cache.set(url, p);   // o usado mais recentemente fica no fim
    return p;
  }
  const pedido = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(url);
      return r.arrayBuffer();
    })
    .then((ab) => audio().decodeAudioData(ab));
  cache.set(url, pedido);
  pedido.catch(() => { if (cache.get(url) === pedido) cache.delete(url); });
  if (!url.startsWith("snd/")) {
    let falas = 0;
    for (const k of cache.keys()) if (!k.startsWith("snd/")) falas++;
    for (const k of cache.keys()) {
      if (falas <= MAX_FALAS) break;
      if (!k.startsWith("snd/")) { cache.delete(k); falas--; }
    }
  }
  return pedido;
}

function tocar(buffer, volume) {
  const fonte = audio().createBufferSource();
  const ganho = ctx.createGain();
  ganho.gain.value = volume;
  fonte.buffer = buffer;
  fonte.connect(ganho).connect(ctx.destination);
  fonte.start();
  return fonte;
}

export async function iniciar() {
  const falas = await (await fetch("data/falas.json")).json();
  for (const linhas of Object.values(falas)) {
    for (const l of linhas) textos.set(l.id, l.texto);
  }
  try {
    const p = await (await fetch("data/pessoa.json")).json();
    if (p && p["1"]) pessoas = p;
  } catch {
    // Sem pessoa.json (o tools/falas.py ainda não correu): valem os valores neutros acima.
  }
  try {
    const m = await (await fetch("voz/manifest.json")).json();
    familia = new Set(m.familia || []);
  } catch {
    familia = new Set();
  }
}

export function texto(id) {
  return textos.get(variante(id)) || "";
}

export async function efeito(nome, volume = 0.7) {
  try {
    tocar(await carregarBuffer(`snd/${nome}.ogg`), volume);
  } catch {
    // Um som em falta nunca para um jogo.
  }
}

function urlVoz(id) {
  id = variante(id);
  const [sec, chave] = id.split(".");
  const pasta = familia.has(id) ? "familia" : "tts";
  return `voz/${pasta}/${sec}/${chave}.ogg`;
}

// Sobe com calar(): uma frase ainda a carregar quando o calar() corre não pode começar depois.
let vez = 0;

export function calar() {
  vez++;
  if (vozAtual) {
    try { vozAtual.stop(); } catch { /* já parou*/ }
    vozAtual = null;
  }
}

// Diz uma frase e resolve quando ela acaba. A música de fundo baixa enquanto o gato fala.
export async function falar(id) {
  calar();
  const minha = vez;
  fundo.baixar();
  try {
    const buffer = await carregarBuffer(urlVoz(id));
    if (minha !== vez) return;
    const fonte = tocar(buffer, 1);
    vozAtual = fonte;
    await new Promise((fim) => { fonte.onended = fim; });
    if (vozAtual === fonte) vozAtual = null;
  } catch {
    await new Promise((fim) => setTimeout(fim, 1200));
  } finally {
    fundo.subir();
  }
}

// Diz um ficheiro de som pelo endereço (legendas das fotografias e nomes das divisões, dos conteúdos da família).
export async function falarUrl(url) {
  calar();
  const minha = vez;
  fundo.baixar();
  try {
    const buffer = await carregarBuffer(url);
    if (minha !== vez) return;
    const fonte = tocar(buffer, 1);
    vozAtual = fonte;
    await new Promise((fim) => { fonte.onended = fim; });
    if (vozAtual === fonte) vozAtual = null;
  } catch {
    // Sem voz para este item: continuar em silêncio.
  } finally {
    fundo.subir();
  }
}

export function preCarregar(ids) {
  for (const id of ids) carregarBuffer(urlVoz(id)).catch(() => {});
}

const ELOGIOS = ["geral.muito_bem", "geral.maravilha", "geral.bravo", "geral.isso_mesmo",
  "geral.perfeito", "geral.fantastico", "geral.campea", "geral.grande_forma"];
const ELOGIOS_NORA = ["nora.muito_bem", "nora.bravo", "nora.maravilha", "nora.fantastico"];

// Um elogio diferente do último. De vez em quando da secção "nora": uma segunda voz da família, quando foi gravada.
export function elogio() {
  const lista = Math.random() < 0.25 ? ELOGIOS_NORA : ELOGIOS;
  let id;
  do { id = lista[Math.floor(Math.random() * lista.length)]; } while (id === ultimoElogio && lista.length > 1);
  ultimoElogio = id;
  return id;
}

export function quase() {
  const lista = ["geral.quase", "geral.tenta", "geral.nao_faz_mal", "nora.quase"];
  return lista[Math.floor(Math.random() * lista.length)];
}

// Pequenos sons sintetizados, para os quais ainda não vem nenhuma gravação CC0.
export function agua() {
  const a = audio();
  const dur = 0.9;
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / d.length);
  const fonte = a.createBufferSource();
  const filtro = a.createBiquadFilter();
  const ganho = a.createGain();
  filtro.type = "bandpass";
  filtro.frequency.value = 1400;
  filtro.Q.value = 0.8;
  ganho.gain.value = 0.35;
  fonte.buffer = buf;
  fonte.connect(filtro).connect(ganho).connect(a.destination);
  fonte.start();
}

export function piu() {
  const a = audio();
  const t = a.currentTime;
  for (const [ini, f1, f2] of [[0, 2600, 3600], [0.18, 2800, 4000], [0.36, 2600, 3400]]) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f1, t + ini);
    o.frequency.exponentialRampToValueAtTime(f2, t + ini + 0.12);
    g.gain.setValueAtTime(0.0001, t + ini);
    g.gain.exponentialRampToValueAtTime(0.25, t + ini + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ini + 0.14);
    o.connect(g).connect(a.destination);
    o.start(t + ini);
    o.stop(t + ini + 0.15);
  }
}
