// Jogada automática da Bisca: joga partidas inteiras num nível baixo e num alto até ao ecrã do prémio.
// Correr em tools/testes (depois de npm install nessa pasta):  node bisca.mjs [porta]
// Precisa de um servidor:  python -m http.server <porta> --bind 127.0.0.1 --directory app/www
// Os temporizadores correm 8 vezes mais depressa, para uma partida demorar cerca de um minuto.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8771";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

for (const [nivel, w, h] of [[1, 1024, 600], [6, 1024, 600], [3, 800, 1280], [5, 1280, 800]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
  // Os ficheiros de voz não existem até a voz ser feita; qualquer outro ficheiro em falta é um erro.
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.addInitScript((n) => {
    localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.bisca": n }));
    const st = window.setTimeout;
    window.setTimeout = (f, ms, ...a) => st(f, (ms || 0) / 8, ...a);
  }, nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=bisca`);
  const t0 = Date.now();
  let jogadas = 0;
  let menor = Infinity;
  let foto = false;
  let fim = false;
  while (Date.now() - t0 < 300000) {
    if (await page.$(".premio")) { fim = true; break; }
    const cartas = await page.$$(".bisca-mao button.cj");
    for (const c of cartas) {
      const r = await c.boundingBox();
      if (r) menor = Math.min(menor, r.width, r.height);
    }
    const boa = await page.$(".bisca-mao button.cj-boa");
    const alvo = boa || cartas[0];
    if (alvo) {
      const antes = cartas.length;
      await alvo.click({ timeout: 2000, force: true }).catch(() => {});
      await page.waitForTimeout(150);
      if ((await page.$$(".bisca-mao button.cj")).length < antes) jogadas++;
    }
    if (!foto && jogadas >= 4) {
      foto = true;
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/bisca-jogo-n${nivel}-${w}x${h}.png` });
    }
    await page.waitForTimeout(250);
  }
  const final = await page.$eval(".bisca-final", (x) => x.textContent).catch(() => "?");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/bisca-premio-n${nivel}-${w}x${h}.png` });
  const nivelDepois = await page.evaluate(() => JSON.parse(localStorage.getItem("mae.v1"))["nivel.bisca"]);
  console.log(`nível ${nivel} ${w}x${h}: ${fim ? "prémio alcançado" : "SEM PRÉMIO"} em ${Math.round((Date.now() - t0) / 1000)} s; jogadas ${jogadas}; final "${final}"; carta mais pequena ${Math.round(menor)} px; nível depois ${nivelDepois}; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  if (!fim || erros.length || menor < 113) falhou = true;
  await page.close();
}
await browser.close();
process.exit(falhou ? 1 : 0);
