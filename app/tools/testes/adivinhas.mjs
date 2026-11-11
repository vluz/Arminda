// Jogada automática das Adivinhas: toca na resposta de cada adivinha (um toque errado na primeira) até ao prémio.
// Correr em tools/testes (depois de npm install nessa pasta):  node adivinhas.mjs <porta> [nível ...]
// Precisa de um servidor:  python -m http.server <porta> --bind 127.0.0.1 --directory app/www
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const [porta = "8785", ...pedidos] = process.argv.slice(2);
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

const CASOS = pedidos.length
  ? pedidos.map((n) => [1024, 600, Number(n)])
  : [[1024, 600, 1], [1024, 600, 4], [1024, 600, 6], [1024, 600, 7], [1024, 600, 9], [1024, 600, 10],
     [1024, 600, 11], [1280, 800, 11], [800, 1280, 11], [800, 1280, 5]];

// A resposta da adivinha que está no cartão (tirada da lista de adivinhas), ou -1 entre adivinhas.
function certa() {
  const bs = [...document.querySelectorAll(".esc-op")];
  if (!bs.length || bs.some((b) => b.classList.contains("certa") || b.classList.contains("sai"))) return -1;
  const { ADIVINHAS, NOMES, figura } = window.__dados;
  const texto = document.querySelector(".adv-texto")?.textContent;
  const linha = window.__falas.find((l) => l.texto === texto && l.id.startsWith("adivinhas.r_"));
  if (!linha) return -1;
  const r = ADIVINHAS.find((x) => `adivinhas.r_${x.id}` === linha.id);
  const nome = r.nome || NOMES[r.resposta];
  const chaves = bs.map((b) => b.querySelector("img")?.getAttribute("src") || b.textContent);
  const i = chaves.indexOf(r.resposta ? figura(r.resposta) : null);
  return i >= 0 ? i : chaves.indexOf(nome.charAt(0).toUpperCase() + nome.slice(1));
}

for (const [w, h, nivel] of CASOS) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = m.location()?.url || "";
    if (!url.includes("/voz/")) erros.push(m.text() + " " + url);
  });
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({
    "intro.vista": 99, "migracao.niveis2": true, "nivel.adivinhas": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=adivinhas`);
  await page.evaluate(async () => {
    window.__dados = await import("/js/jogos/adivinhas-lista.js");
    window.__falas = (await (await fetch("data/falas.json")).json()).adivinhas;
  });
  const nome = `adivinhas-play-n${nivel}-${w}x${h}`;
  let respostas = 0;
  let errou = false;
  let menor = Infinity;
  let premio = false;
  const fim = Date.now() + 180000;
  while (Date.now() < fim) {
    premio = (await page.locator(".premio .acoes button").count()) > 0;
    if (premio) break;
    const i = await page.evaluate(certa);
    if (i < 0) { await page.waitForTimeout(250); continue; }
    const bs = page.locator(".esc-op");
    const tam = await bs.first().boundingBox();
    if (tam) menor = Math.min(menor, tam.width, tam.height);
    if (respostas === 1) await page.waitForTimeout(700);
    if (respostas === 1) await page.screenshot({ path: `${OUT}/${nome}.png` });
    if (!errou) {
      errou = true;
      const n = await bs.count();
      await bs.nth((i + 1) % n).click();
      await page.waitForTimeout(500);
    }
    await bs.nth(i).click();
    respostas++;
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: `${OUT}/${nome}-premio.png` });
  if (premio) await page.locator(".premio >> text=Início").click();
  await page.waitForTimeout(1200);
  const registo = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("mae.v1"));
    return (d.metricas || []).filter((m) => m.tipo === "ronda" && m.game === "adivinhas").at(-1);
  });
  const ok = premio && registo?.completed && !erros.length && menor >= 113;
  if (!ok) falhou = true;
  console.log(`${w}x${h} nível ${nivel}: respostas ${respostas}, botão mais pequeno ${Math.round(menor)} px; prémio ${premio}; ` +
    `registo ${JSON.stringify(registo && { level: registo.level, kind: registo.kind, score: registo.score, wrong: registo.wrong_taps, hints: registo.hints_needed, riddles: registo.riddles })}; ` +
    `erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  await page.close();
}
await browser.close();
process.exit(falhou ? 1 : 0);
