// Jogada automática do Loto: marca todos os números cantados até um cartão ficar cheio e o prémio aparecer.
// Correr em tools/testes (depois de npm install nessa pasta):  node loto.mjs <porta> [nível ...]
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
  // Argumentos: um nível ("8") ou tamanho e nível ("800x1280:7").
  ? pedidos.map((a) => {
    const [tam, n] = a.includes(":") ? a.split(":") : ["1024x600", a];
    const [w, h] = tam.split("x").map(Number);
    return [w, h, Number(n)];
  })
  : [[1024, 600, 5], [1024, 600, 9], [1024, 600, 10], [1280, 800, 10], [800, 1280, 10], [800, 1280, 9]];

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
    "intro.vista": 99, "migracao.niveis2": true, "nivel.loto": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=loto`);
  const nome = `loto-play-n${nivel}-${w}x${h}`;
  await page.waitForTimeout(3000);
  const cartoes = await page.locator(".cartao").count();
  const casas = await page.locator(".casa-num").count();
  const menor = Math.min(...(await page.$$eval(".casa-num", (bs) => bs.map((b) => b.getBoundingClientRect().width))));
  let premio = false;
  let marcadas = 0;
  let foto = false;
  const inicio = Date.now();
  while (!premio && Date.now() - inicio < 400000) {
    await page.waitForTimeout(400);
    premio = (await page.locator(".premio .acoes button").count()) > 0;
    if (premio) break;
    const n = (await page.locator(".bola").getAttribute("data-n")) || "";
    if (!n) continue;
    const casa = page.locator(`.casa-num[data-n="${n}"]:not(.marcada)`);
    if (await casa.count()) {
      await page.waitForTimeout(500);
      await casa.click();
      marcadas++;
      if (marcadas === 4 && !foto) { foto = true; await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${nome}-meio.png` }); }
    }
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${nome}-premio.png` });
  if (premio) await page.locator(".premio >> text=Início").click();
  await page.waitForTimeout(1200);
  const registo = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("mae.v1"));
    return (d.metricas || []).filter((m) => m.tipo === "ronda" && m.game === "loto").at(-1);
  });
  const ok = premio && registo?.completed && !erros.length && menor >= 100;
  if (!ok) falhou = true;
  console.log(`${w}x${h} nível ${nivel}: cartas ${cartoes}, casas ${casas}, casa mais pequena ${Math.round(menor)} px; ` +
    `marcados ${marcadas}; prémio ${premio} ao fim de ${Math.round((Date.now() - inicio) / 1000)} s; ` +
    `registo ${JSON.stringify(registo && { level: registo.level, card_size: registo.card_size, cards: registo.cards, calls: registo.calls })}; ` +
    `erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  await page.close();
}
await browser.close();
process.exit(falhou ? 1 : 0);
