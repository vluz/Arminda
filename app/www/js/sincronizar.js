// Envia os registos de jogo para o servidor da família quando o tablet tem rede.
// A configuração está em config.json na pasta da app no tablet (posta por USB, nunca no código):
// { "servidor": "https://...", "token": "..." }. Sem ele, nada é enviado.
// As falhas são silenciosas e tenta-se mais tarde: o Wi-Fi de um hospital vai e vem.

import { porEnviar, marcarEnviados } from "./metricas.js";
import { gravar } from "./estado.js";

const CONFIG_ANDROID = "/storage/emulated/0/Android/data/pt.mae.jogos/files/config.json";
const LOTE = 200;
const INTERVALO = 15 * 60 * 1000;
const LIMITE_PEDIDO = 15000;

let aEnviar = false;

// Lê-se de cada vez que se envia (um ficheiro pequeno, de 15 em 15 minutos): um token ou um
// servidor trocado por USB (tools/enviar_config.py) vale logo, sem reiniciar a app.
async function lerConfig() {
  const C = window.Capacitor;
  const url = C?.isNativePlatform?.() ? C.convertFileSrc(CONFIG_ANDROID) : "media-teste/config.json";
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return {};
    return (await r.json()) || {};
  } catch {
    return {};
  }
}

// Um pedido com limite de tempo. O limite vale até a resposta estar lida por inteiro (corpo
// incluído): um servidor que manda o cabeçalho e depois se cala não pode prender o envio.
// Devolve { ok, dados }; dados é o JSON da resposta, ou null quando não é JSON.
async function pedido(url, opcoes) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), LIMITE_PEDIDO);
  try {
    const r = await fetch(url, { ...opcoes, signal: ctl.signal });
    const texto = await r.text();
    let dados = null;
    try { dados = JSON.parse(texto); } catch { /* não é JSON*/ }
    return { ok: r.ok, dados };
  } finally {
    clearTimeout(t);
  }
}

// Envia tudo o que está à espera, em lotes. Devolve o número de registos confirmados.
export async function enviar() {
  if (aEnviar) return 0;
  const cfg = await lerConfig();
  if (!cfg.servidor || !cfg.token) return 0;
  aEnviar = true;
  let total = 0;
  try {
    for (let voltas = 0; voltas < 50; voltas++) {
      const lote = porEnviar(LOTE);
      if (!lote.length) break;
      const r = await pedido(`${cfg.servidor}/api/registos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
        body: JSON.stringify({ registos: lote }),
      });
      if (!r.ok) break;
      const aceites = r.dados?.aceites;
      if (!Array.isArray(aceites) || !aceites.length) break;
      marcarEnviados(aceites);
      total += aceites.length;
      // Para o ecrã da família: quando foi que o servidor confirmou registos pela última vez.
      try { gravar("sync.ultimo", new Date().toISOString()); } catch { /* só para o estado*/ }
    }
  } catch {
    // Sem rede, rede com página de entrada, ou servidor em baixo: tentar mais tarde.
  } finally {
    aEnviar = false;
  }
  return total;
}

// Ecrã da família: o tablet chega ao servidor neste momento? Devolve verdadeiro, falso, ou null
// quando não há servidor configurado.
export async function servidorAlcancavel() {
  const cfg = await lerConfig();
  if (!cfg.servidor) return null;
  // Um lote vazio, mandado exatamente como um a sério (CORS, token): qualquer resposta HTTP prova que
  // o servidor está ao alcance. Um GET no-cors não serve: o Cross-Origin-Resource-Policy do servidor
  // bloqueia-o.
  try {
    await pedido(`${cfg.servidor}/api/registos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ registos: [] }),
    });
    return true;
  } catch {
    return false;
  }
}

// Envia no arranque, de 15 em 15 minutos com a app aberta, e quando o ecrã se apaga.
export function iniciar() {
  setTimeout(enviar, 20000);
  setInterval(enviar, INTERVALO);
  // Acabou de aparecer uma rede (o Wi-Fi de um hospital falha muito; o hotspot do telemóvel da
  // família numa visita): enviar em segundos em vez de esperar pela próxima volta de 15 minutos.
  window.addEventListener("online", () => setTimeout(enviar, 5000));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") enviar();
  });
}
