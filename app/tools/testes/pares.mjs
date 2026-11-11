// Jogada automática dos Pares nos seus níveis: encontra todos os pares (primeiro um par errado) até ao prémio.
// Correr em tools/testes (depois de npm install nessa pasta):  node pares.mjs <porta> [nível ...]
// Precisa de um servidor:  python -m http.server <porta> --bind 127.0.0.1 --directory app/www
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const [porta = "8775", ...pedidos] = process.argv.slice(2);
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

const CASOS = pedidos.length
  // Um pedido é um nível ("23", a 1024x600) ou "LxA:nível" ("800x1280:23").
  ? pedidos.map((p) => {
    const [tam, n] = p.includes(":") ? p.split(":") : ["1024x600", p];
    return [...tam.split("x").map(Number), Number(n)];
  })
  : [[1024, 600, 1], [1024, 600, 7], [1024, 600, 10], [1024, 600, 13], [1024, 600, 16], [1024, 600, 19], [1024, 600, 23],
     [1280, 800, 23], [800, 1280, 23], [800, 1280, 9]];

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
    "intro.vista": 99, "migracao.niveis2": true, "nivel.pares": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=pares`);
  const nome = `pares-play-n${nivel}-${w}x${h}`;
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/${nome}-mostra.png` });
  await page.waitForFunction(() => document.querySelectorAll(".carta.virada").length === 0, null, { timeout: 20000 });
  await page.waitForTimeout(700);

  const ids = await page.$$eval(".carta", (cs) => cs.map((c) => c.dataset.id));
  const tam = await page.locator(".carta").first().boundingBox();
  // Todas as cartas dentro do ecrã, nenhuma por cima da barra de cima.
  const fora = await page.$$eval(".carta", (cs) => {
    const corpo = document.querySelector(".corpo").getBoundingClientRect();
    return cs.filter((c) => { const r = c.getBoundingClientRect();
      return r.left < corpo.left - 1 || r.right > corpo.right + 1 || r.top < corpo.top - 1 || r.bottom > corpo.bottom + 1; }).length;
  });
  const minimo = nivel >= 11 ? 55 : 113;
  const porId = {};
  ids.forEach((id, i) => (porId[id] ||= []).push(i));
  const pares = Object.values(porId);
  const cartas = page.locator(".carta");
  if (pares.length > 1) {
    await cartas.nth(pares[0][0]).click(); await page.waitForTimeout(300);
    await cartas.nth(pares[1][0]).click(); await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${nome}-erro.png` });
    await page.waitForTimeout(3200);
  }
  for (const [a, b] of pares) {
    await cartas.nth(a).click(); await page.waitForTimeout(300);
    await cartas.nth(b).click(); await page.waitForTimeout(2600);
  }
  let premio = false;
  for (let i = 0; i < 25 && !premio; i++) {
    await page.waitForTimeout(800);
    premio = (await page.locator(".premio .acoes button").count()) > 0;
  }
  await page.screenshot({ path: `${OUT}/${nome}-premio.png` });
  if (premio) await page.locator(".premio >> text=Início").click();
  await page.waitForTimeout(1200);
  const registo = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("mae.v1"));
    return (d.metricas || []).filter((m) => m.tipo === "ronda" && m.game === "pares").at(-1);
  });
  const ok = premio && registo?.completed && !erros.length && tam.width >= minimo && fora === 0;
  if (!ok) falhou = true;
  console.log(`${w}x${h} nível ${nivel}: cartas ${ids.length} of ${Math.round(tam.width)} px (mín. ${minimo}), fora ${fora}; prémio ${premio}; ` +
    `registo ${JSON.stringify(registo && { level: registo.level, pairs: registo.pairs, kind: registo.kind, wrong: registo.wrong_pairs })}; ` +
    `erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  await page.close();
}
await browser.close();
process.exit(falhou ? 1 : 0);
