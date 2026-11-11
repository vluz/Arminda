// Joga jogos inteiros de Damas até ao ecrã do prémio, num nível baixo e num alto.
// Correr em tools/testes (depois de npm install nessa pasta):  node damas.mjs <porta>
// Os ficheiros de voz em falta (voz/...) são esperados até a voz ser feita, e não contam.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8772";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

async function jogar(nivel, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("pageerror", (x) => erros.push(String(x)));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.damas": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=damas`);
  const t0 = Date.now();
  let toques = 0;
  let fotos = 0;
  let errou = false;
  let capturas = 0;
  while (Date.now() - t0 < 560000) {
    if (await page.$(".premio")) break;
    const est = await page.evaluate(() => ({
      destinos: [...document.querySelectorAll(".damas-casa.destino")].map((b) => b.dataset.i),
      origens: [...document.querySelectorAll(".damas-casa.pode, .damas-casa.obrigatoria")].map((b) => b.dataset.i),
      obrig: !!document.querySelector(".damas-casa.obrigatoria"),
      vazias: [...document.querySelectorAll(".damas-casa.escura:empty")].map((b) => b.dataset.i),
      lado: document.querySelector(".damas-casa.escura")?.getBoundingClientRect().width || 0,
      n: Math.round(Math.sqrt(document.querySelectorAll(".damas-casa").length)),
    }));
    const pick = (l) => l[Math.floor(Math.random() * l.length)];
    if (est.destinos.length) {
      if (fotos === 0 || (est.obrig && fotos === 1)) {
        fotos++;
        await page.screenshot({ path: `${OUT}/damas-jogo${fotos}-n${nivel}-${w}x${h}.png` });
      }
      await page.click(`.damas-casa[data-i="${pick(est.destinos)}"]`, { force: true, timeout: 3000 }).catch(() => {});
      toques++;
    } else if (est.origens.length) {
      if (est.obrig) capturas++;
      if (!errou && nivel > 3 && est.vazias.length) {
        errou = true;
        await page.click(`.damas-casa[data-i="${est.vazias[0]}"]`, { force: true }).catch(() => {});
        await page.waitForTimeout(1500);
      }
      await page.click(`.damas-casa[data-i="${pick(est.origens)}"]`, { force: true, timeout: 3000 }).catch(() => {});
      toques++;
      if (toques === 1) console.log(`  tabuleiro ${est.n}x${est.n}, casa ${Math.round(est.lado)} px`);
    }
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(2500);
  const premio = !!(await page.$(".premio"));
  await page.screenshot({ path: `${OUT}/damas-premio-n${nivel}-${w}x${h}.png` });
  const balao = await page.$eval(".balao", (b) => b.textContent).catch(() => "");
  const ultima = await page.evaluate(() => JSON.parse(localStorage.getItem("mae.v1")).metricas?.filter((m) => m.game === "damas" && m.tipo === "ronda").at(-1));
  console.log(`nível ${nivel} ${w}x${h}: prémio ${premio}; toques ${toques}; vezes a comer ${capturas}; ${Math.round((Date.now() - t0) / 1000)} s; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}; última frase "${balao}"`);
  console.log(`  registo: ${JSON.stringify(ultima)}`);
  if (!premio || erros.length) falhou = true;
  await page.close();
}

await jogar(1, 1024, 600);
await jogar(5, 1280, 800);
await jogar(4, 800, 1280);
await jogar(6, 1024, 600);
await browser.close();
process.exit(falhou ? 1 : 0);
