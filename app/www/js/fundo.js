// Música de fundo suave no ecrã inicial e na maior parte dos jogos.
// Um só elemento HTMLAudio, reaproveitado; sem grafo WebAudio. Baixinha (0.15), e quase calada
// enquanto o gato fala (o som.js chama baixar/subir). Desligada nas atividades em que é preciso ouvir.
// A definição "musica.fundo" (verdadeira por omissão) desliga-a de vez.

import { ler, gravar } from "./estado.js";

const FAIXAS = [
  "snd/musica/caixa-ternura.ogg",
  "snd/musica/caixa-polca.ogg",
  "snd/musica/guitarra.ogg",
  "snd/musica/palmas.ogg",
];
const VOLUME = 0.15;
const VOLUME_BAIXO = 0.02;   // enquanto o gato fala
const LARGAR_MS = 700;       // espera depois de uma frase antes de a música voltar, para frases seguidas não a fazerem subir e descer

let leitor = null;
let ultima = -1;
let querTocar = false;       // o ecrã atual quer música
let falas = 0;               // frases a serem ditas agora
let largar = null;
let fade = null;
let esperaToque = false;
let erros = 0;
let seguranca = null;

function alvo() {
  return falas > 0 ? VOLUME_BAIXO : VOLUME;
}

// Rampa curta de volume. O intervalo só corre durante a rampa (cerca de 300 ms).
function rampa(para) {
  clearInterval(fade);
  if (!leitor) return;
  const de = leitor.volume;
  let passo = 0;
  fade = setInterval(() => {
    passo++;
    leitor.volume = Math.max(0, Math.min(1, de + (para - de) * (passo / 6)));
    if (passo >= 6) clearInterval(fade);
  }, 50);
}

function proxima() {
  let i;
  do { i = Math.floor(Math.random() * FAIXAS.length); } while (i === ultima && FAIXAS.length > 1);
  ultima = i;
  leitor.src = FAIXAS[i];
}

function criar() {
  if (leitor) return;
  leitor = new Audio();
  leitor.preload = "auto";
  leitor.volume = alvo();
  leitor.addEventListener("ended", () => { proxima(); arrancar(); });
  // Um ficheiro em falta ou estragado passa ao seguinte, no máximo uma volta à lista.
  leitor.addEventListener("error", () => {
    if (++erros < FAIXAS.length) { proxima(); arrancar(); }
  });
  leitor.addEventListener("playing", () => { erros = 0; });
  proxima();
}

// O WebView pode recusar-se a tocar antes do primeiro toque: tentar outra vez no seguinte.
function arrancar() {
  if (!leitor || !querTocar || document.hidden || descansando) return;
  const p = leitor.play();
  if (p && p.catch) {
    p.catch(() => {
      if (esperaToque) return;
      esperaToque = true;
      window.addEventListener("pointerdown", () => { esperaToque = false; arrancar(); }, { capture: true, once: true });
    });
  }
}

export function ligada() {
  return ler("musica.fundo", true) !== false;
}

// Ligar ou desligar de vez a música de fundo.
export function ligar(sim) {
  gravar("musica.fundo", !!sim);
  aplicar(sim);
}

function aplicar(sim) {
  if (sim && querTocar) tocar();
  else if (!sim && leitor) leitor.pause();
}

// Descanso: ao fim de 10 minutos sem toque (o tablet escurece na mesma altura) a música para,
// para não tocar nos auscultadores a noite toda. O toque seguinte volta a ligá-la.
const DESCANSO_MS = 10 * 60000;
let ultimoToque = Date.now();
let descansando = false;
window.addEventListener("pointerdown", () => {
  ultimoToque = Date.now();
  if (descansando) {
    descansando = false;
    if (querTocar && ligada()) arrancar();
  }
}, { capture: true, passive: true });
setInterval(() => {
  if (!descansando && Date.now() - ultimoToque >= DESCANSO_MS) {
    descansando = true;
    if (leitor) leitor.pause();
  }
}, 30000);

// O ecrã da família (familia.js) guarda ele próprio "musica.fundo" e depois anuncia a mudança.
window.addEventListener("mae:musica-fundo", (ev) => aplicar(ev.detail !== false));

// O ecrã atual quer música de fundo.
export function tocar() {
  querTocar = true;
  if (!ligada()) return;
  criar();
  leitor.volume = alvo();
  if (leitor.paused) arrancar();
}

// O ecrã atual quer silêncio (atividades de ouvir). Guarda o ponto onde a música ia.
export function pausar() {
  querTocar = false;
  if (leitor) leitor.pause();
}

// Chamado pelo som.js à volta de cada frase dita.
export function baixar() {
  falas++;
  clearTimeout(largar);
  // Rede de segurança: uma frase que nunca diz que acabou não pode deixar a música em baixo para sempre.
  clearTimeout(seguranca);
  seguranca = setTimeout(() => { falas = 1; subir(); }, 20000);
  if (leitor && !leitor.paused) rampa(VOLUME_BAIXO);
  else if (leitor) leitor.volume = VOLUME_BAIXO;
}

export function subir() {
  falas = Math.max(0, falas - 1);
  if (falas > 0) return;
  clearTimeout(seguranca);
  clearTimeout(largar);
  largar = setTimeout(() => {
    if (falas === 0 && leitor) rampa(VOLUME);
  }, LARGAR_MS);
}

document.addEventListener("visibilitychange", () => {
  if (!leitor) return;
  if (document.hidden) leitor.pause();
  else if (querTocar && ligada()) arrancar();
});
