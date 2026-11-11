// Registos de jogo, em fila no tablet até o servidor da família os confirmar (sincronizar.js).
// Sem nomes nem pormenores médicos: só o jogo, o nível e como correu a ronda.

import { ler, gravar, gravarVarios, idDispositivo } from "./estado.js";
import { BUNDLE } from "./atualizar.js";

const MAX = 5000;
const VERSAO_APP = "0.7.0";

// Cópia extra no cartão de memória (plugin nativo CopiaSD, só no Android). Cada registo vai também
// para "sd.fila" e é escrito em lotes: de 30 em 30 s, quando o ecrã se apaga e quando a app vai
// para segundo plano. É só uma segunda cópia: a fila acima e o sincronizar.js não dependem dela, e
// qualquer falha aqui é ignorada. No browser não há plugin: nada fica em fila.
const SD_MAX = 3000;
const SD_INTERVALO = 30000;
const copiaSD = () => window.Capacitor?.Plugins?.CopiaSD;
const sdEstado = { ultimaEscrita: null, erro: null };
let sdAEscrever = false;

export async function escreverSD() {
  const P = copiaSD();
  if (!P || sdAEscrever) return 0;
  const linhas = ler("sd.fila", []);
  if (!linhas.length) return 0;
  sdAEscrever = true;
  // `linhas` é a fila viva (ler devolve a própria lista guardada): os registos acrescentados enquanto
  // o plugin escreve caem nela, por isso lembrar quantos foram mandados antes da espera.
  const enviadas = linhas.length;
  try {
    const r = await P.guardar({ linhas });
    // Os registos acrescentados durante a escrita ficam em fila para o lote seguinte.
    gravar("sd.fila", ler("sd.fila", []).slice(enviadas));
    sdEstado.ultimaEscrita = new Date().toISOString();
    sdEstado.erro = null;
    return r?.escritas ?? enviadas;
  } catch (e) {
    sdEstado.erro = String(e?.message || e);
    return 0;
  } finally {
    sdAEscrever = false;
  }
}

export function estadoSD() {
  return { ...sdEstado, pendentes: ler("sd.fila", []).length, disponivel: !!copiaSD() };
}

function iniciarSD() {
  if (!copiaSD()) return;
  setInterval(escreverSD, SD_INTERVALO);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") escreverSD();
  });
  try {
    window.Capacitor?.Plugins?.App?.addListener("appStateChange", ({ isActive }) => { if (!isActive) escreverSD(); });
  } catch {
    // Sem o plugin App: o temporizador e o visibilitychange escrevem na mesma.
  }
  setTimeout(escreverSD, 5000);
}
try { iniciarSD(); } catch { /* nunca parar a app por causa da cópia extra*/ }

function novoId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Cada registo tem um rid único, para o servidor ignorar cópias mandadas duas vezes.
// "s": true quando o servidor o confirmou. Os registos ficam no tablet para o ecrã da família;
// quando a fila enche, saem primeiro os mais antigos já enviados.
function juntar(registo) {
  const fila = ler("metricas", []);
  // player: para quem é o tablet ("1" ou "2", o botão do ecrã da família; "mae"/"pai" antes da
  // 0.7.0), para se distinguirem os registos de um tablet depois de mudar de mãos.
  const novo = { rid: novoId(), device: idDispositivo(), app_version: VERSAO_APP, bundle: BUNDLE,
    player: ler("config.pessoa", "1"), ...registo };
  fila.push(novo);
  if (fila.length > MAX) {
    let excesso = fila.length - MAX;
    for (let i = 0; i < fila.length && excesso > 0; ) {
      if (fila[i].s) { fila.splice(i, 1); excesso--; } else i++;
    }
    if (excesso > 0) fila.splice(0, excesso);
  }
  let sd = null;
  try {
    if (copiaSD()) {
      sd = ler("sd.fila", []);
      sd.push(JSON.stringify({ ...novo, saved_at: new Date().toISOString() }));
      if (sd.length > SD_MAX) sd.splice(0, sd.length - SD_MAX);
    }
  } catch {
    sd = null;
  }
  // Uma só gravação para as duas chaves: o armazém é reescrito inteiro de cada vez.
  if (sd) gravarVarios({ metricas: fila, "sd.fila": sd });
  else gravar("metricas", fila);
}

// Registos ainda não confirmados pelo servidor, dos mais antigos para os mais novos, até n.
export function porEnviar(n) {
  const fila = ler("metricas", []);
  // Os registos de antes da versão 0.2 não têm rid: dar-lhes um, uma vez.
  if (fila.some((r) => !r.rid)) {
    for (const r of fila) if (!r.rid) r.rid = novoId();
    gravar("metricas", fila);
  }
  return fila.filter((r) => !r.s).slice(0, n);
}

export function marcarEnviados(rids) {
  const feitos = new Set(rids);
  const fila = ler("metricas", []);
  for (const r of fila) if (feitos.has(r.rid)) r.s = true;
  gravar("metricas", fila);
}

export function ronda(jogo, dados) {
  juntar({ tipo: "ronda", game: jogo, ...dados });
}

// Uma visita a uma atividade: abriu, saiu, quanto tempo, e quanto desse tempo com as mãos nela.
export function sessao(jogo, dados) {
  juntar({ tipo: "sessao", game: jogo, ...dados });
}

export function evento(tipo, extra = {}) {
  juntar({ tipo, at: new Date().toISOString(), ...extra });
}

// O veredicto da regra dos níveis sobre cada ronda acabada (estado.js), para a família poder
// conferir os níveis sem refazer os critérios de cada jogo.
window.addEventListener("mae:nivel", (ev) => evento("nivel", ev.detail));

export function mediana(valores) {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return Math.round(v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2);
}
