// Bateria: registada de 15 em 15 minutos para as estatísticas da família, e um aviso quando fica fraca.
// O diálogo de bateria fraca do Android está desligado (saltava por cima da app), por isso é a app que
// avisa: um sinal vermelho de bateria no canto de baixo à esquerda de todos os ecrãs, à vista da
// pessoa e de quem cuida dela, e o gato di-lo uma vez no ecrã inicial quando desce abaixo de 20% e
// outra vez abaixo de 10%.
import * as metricas from "./metricas.js";
import * as som from "./som.js";
import { el } from "./ui.js";

const BAIXA = 0.2;
const MUITO_BAIXA = 0.1;
let bat = null;
let sinal = null;
let avisadoEm = 1;   // o limite mais baixo de que já se avisou em voz alta

function registar(motivo) {
  if (!bat) return;
  metricas.evento("bateria", { level: Math.round(bat.level * 100), charging: bat.charging, reason: motivo });
}

function atualizar() {
  if (!bat) return;
  const baixa = !bat.charging && bat.level < BAIXA;
  if (!sinal) {
    sinal = el("div", { class: "bateria-baixa", "aria-hidden": "true" }, [el("i")]);
    document.body.append(sinal);
  }
  sinal.classList.toggle("ver", baixa);
  sinal.style.setProperty("--carga", `${Math.max(0.05, bat.level)}`);
  if (bat.charging || bat.level >= BAIXA) avisadoEm = 1;
}

export async function iniciar() {
  try {
    if (!navigator.getBattery) return;
    bat = await navigator.getBattery();
  } catch {
    return;
  }
  atualizar();
  registar("inicio");
  bat.addEventListener("levelchange", atualizar);
  bat.addEventListener("chargingchange", () => { atualizar(); registar(bat.charging ? "ligado" : "desligado"); });
  setInterval(() => registar("periodico"), 15 * 60000);
  avisar();   // o ecrã inicial abriu antes de a bateria responder
}

// Nível da bateria de 0 a 100, ou null antes de a bateria responder (ou num browser sem ela).
export function nivel() {
  return bat ? Math.round(bat.level * 100) : null;
}

// Chamado quando o ecrã inicial abre: dizer o aviso uma vez por limite.
export function avisar() {
  if (!bat || bat.charging) return;
  const limite = bat.level < MUITO_BAIXA ? MUITO_BAIXA : bat.level < BAIXA ? BAIXA : 1;
  if (limite < avisadoEm) {
    avisadoEm = limite;
    setTimeout(() => {
      const balao = document.querySelector(".balao");
      if (balao) { balao.textContent = som.texto("geral.bateria"); balao.classList.remove("vazio"); }
      som.falar("geral.bateria");
    }, 2500);
  }
}
