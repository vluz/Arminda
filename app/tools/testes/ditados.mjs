// Jogada automática dos Ditados: joga uma ronda inteira num nível baixo e num alto até ao ecrã do prémio.
// Correr em tools/testes (depois de npm install nessa pasta):  node ditados.mjs <porta>
// Capturas de ecrã: app/test-shots/jogos/ditados-n<nível>-<l>x<a>.png
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8773";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

async function jogar(nivel, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) erros.push(m.text()); });
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.ditados": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=ditados`);
  const t0 = Date.now();
  let respostas = 0;
  let erradas = 0;
  let foto = false;
  let pequenos = [];
  let premio = false;
  while (Date.now() - t0 < 180000) {
    if (await page.$(".premio .acoes button")) { premio = true; break; }
    const certa = await page.$(".dit-opcoes[data-pronto='1'] .dit-opcao[data-certa='1']:not(.certa)");
    if (certa) {
      if (!foto) {
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUT}/ditados-n${nivel}-${w}x${h}.png` });
        foto = true;
        pequenos = await page.$$eval("button", (bs) => bs.map((b) => b.getBoundingClientRect())
          .filter((r) => r.width > 0 && Math.min(r.width, r.height) < 105).map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`));
      }
      // Um toque errado no segundo ditado, para passar pelo caminho simpático.
      const errada = await page.$(".dit-opcao[data-certa='']:not(.errada)");
      if (respostas === 1 && errada && erradas === 0) {
        await errada.click();
        erradas++;
        await page.waitForSelector(".dit-opcoes[data-pronto='1']");
      }
      await certa.click();
      respostas++;
      await page.waitForTimeout(400);
    } else {
      await page.waitForTimeout(250);
    }
  }
  const naPremio = await page.$$eval("button", (bs) => bs.map((b) => b.getBoundingClientRect())
    .filter((r) => r.width > 0 && Math.min(r.width, r.height) < 105).map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`));
  const metrica = await page.evaluate(() => JSON.parse(localStorage.getItem("mae.v1")).metricas.filter((m) => m.game === "ditados" && m.tipo === "ronda").at(-1));
  console.log(`nível ${nivel} ${w}x${h}: prémio ${premio}; respostas ${respostas}; toques errados ${erradas}; ${((Date.now() - t0) / 1000).toFixed(0)} s; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}; botões pequenos em jogo ${pequenos.length ? pequenos.join(" ") : "nenhum"}, no ecrã do prémio ${naPremio.join(" ") || "none"}`);
  console.log("  registo", JSON.stringify(metrica));
  if (!premio || erros.length) falhou = true;
  await page.close();
}

for (const [w, h] of [[1024, 600], [1280, 800], [800, 1280]]) {
  for (const n of [1, 6]) await jogar(n, w, h);
}
// Os níveis do meio também, no tamanho do ecrã do tablet de referência.
for (const n of [2, 3, 4, 5]) await jogar(n, 1024, 600);
await browser.close();
process.exit(falhou ? 1 : 0);
