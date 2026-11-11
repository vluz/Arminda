// Jogada automática da Sueca: joga jogos inteiros num nível baixo e num alto até ao ecrã do prémio.
// Correr em tools/testes (depois de npm install nessa pasta):  node sueca.mjs [porta]
// Precisa de um servidor:  python -m http.server <porta> --bind 127.0.0.1 --directory app/www
// Os temporizadores correm 8 vezes mais depressa. Confere também que uma carta esbatida não faz
// nada e que as cartas da pessoa ficam com pelo menos 113 px de largura.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8771";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

for (const [nivel, w, h] of [[1, 1024, 600], [6, 1024, 600], [2, 800, 1280], [5, 1280, 800]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
  // Os ficheiros de voz não existem até a voz ser feita; qualquer outro ficheiro em falta é um erro.
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.addInitScript((n) => {
    localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.sueca": n }));
    const st = window.setTimeout;
    window.setTimeout = (f, ms, ...a) => st(f, (ms || 0) / 8, ...a);
  }, nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=sueca`);
  const t0 = Date.now();
  let jogadas = 0;
  let menor = Infinity;
  let fotos = 0;
  let proibidaTestada = "não visto";
  let fim = false;
  while (Date.now() - t0 < 400000) {
    if (await page.$(".premio")) { fim = true; break; }
    const cartas = await page.$$(".sueca-mao button.cj");
    for (const c of cartas) {
      const r = await c.boundingBox();
      if (r) menor = Math.min(menor, r.width, r.height);
    }
    const proibida = await page.$(".sueca-mao button.cj-proibida");
    if (proibida && proibidaTestada === "não visto") {
      const antes = cartas.length;
      await proibida.click({ force: true });
      await page.waitForTimeout(400);
      const depois = (await page.$$(".sueca-mao button.cj")).length;
      proibidaTestada = depois === antes ? "não fez nada (bem)" : "FOI JOGADA";
      await page.screenshot({ path: `${OUT}/sueca-proibidas-n${nivel}-${w}x${h}.png` });
    }
    const alvo = (await page.$(".sueca-mao button.cj-boa")) || (await page.$(".sueca-mao button.cj:not(.cj-proibida)"));
    if (alvo) {
      const antes = cartas.length;
      await alvo.click({ timeout: 2000, force: true }).catch(() => {});
      await page.waitForTimeout(150);
      if ((await page.$$(".sueca-mao button.cj")).length < antes) jogadas++;
    }
    const naMesa = (await page.$$(".sueca-mesa .sueca-lugar .cj:not(.cj-lugar)")).length;
    if (fotos === 0 && jogadas >= 1) { fotos++; await page.screenshot({ path: `${OUT}/sueca-inicio-n${nivel}-${w}x${h}.png` }); }
    if (fotos === 1 && naMesa === 4) { fotos++; await page.screenshot({ path: `${OUT}/sueca-vaza-n${nivel}-${w}x${h}.png` }); }
    await page.waitForTimeout(200);
  }
  const final = await page.$eval(".sueca-final", (x) => x.textContent).catch(() => "?");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/sueca-premio-n${nivel}-${w}x${h}.png` });
  const nivelDepois = await page.evaluate(() => JSON.parse(localStorage.getItem("mae.v1"))["nivel.sueca"]);
  console.log(`nível ${nivel} ${w}x${h}: ${fim ? "prémio alcançado" : "SEM PRÉMIO"} em ${Math.round((Date.now() - t0) / 1000)} s; jogadas da pessoa ${jogadas}; final "${final}"; toque em carta esbatida ${proibidaTestada}; carta mais pequena ${Math.round(menor)} px; nível depois ${nivelDepois}; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  if (!fim || erros.length || menor < 113 || proibidaTestada === "FOI JOGADA") falhou = true;
  await page.close();
}
await browser.close();
process.exit(falhou ? 1 : 0);
