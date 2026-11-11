// Joga partidas inteiras do Jogo do Galo até ao ecrã do prémio, num nível baixo e num alto.
// Correr em tools/testes (depois de npm install nessa pasta):  node galo.mjs <porta>
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
  await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.galo": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=galo`);
  const t0 = Date.now();
  let toques = 0;
  let foto = false;
  let errou = false;
  let info = "";
  while (Date.now() - t0 < 400000) {
    if (await page.$(".premio")) break;
    const est = await page.evaluate(() => {
      const cs = [...document.querySelectorAll(".galo-casa")];
      return {
        livres: cs.filter((c) => !c.classList.contains("tu") && !c.classList.contains("galo")).map((c) => c.dataset.i),
        ocupadas: cs.filter((c) => c.classList.contains("tu") || c.classList.contains("galo")).map((c) => c.dataset.i),
        n: Math.round(Math.sqrt(cs.length)),
        lado: cs[0]?.getBoundingClientRect().width || 0,
        acabou: !!document.querySelector(".galo-tab.acabou"),
      };
    });
    if (!info && est.n) info = `tabuleiro ${est.n}x${est.n}, casa ${Math.round(est.lado)} px`;
    if (est.livres.length && !est.acabou) {
      if (!foto && est.ocupadas.length >= 3) {
        foto = true;
        await page.screenshot({ path: `${OUT}/galo-jogo-n${nivel}-${w}x${h}.png` });
      }
      if (!errou && nivel > 3 && est.ocupadas.length) {
        errou = true;
        await page.click(`.galo-casa[data-i="${est.ocupadas[0]}"]`, { force: true }).catch(() => {});
        await page.waitForTimeout(1500);
      }
      const i = est.livres[Math.floor(Math.random() * est.livres.length)];
      await page.click(`.galo-casa[data-i="${i}"]`, { force: true, timeout: 3000 }).catch(() => {});
      toques++;
    }
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(2500);
  const premio = !!(await page.$(".premio"));
  await page.screenshot({ path: `${OUT}/galo-premio-n${nivel}-${w}x${h}.png` });
  const ultima = await page.evaluate(() => JSON.parse(localStorage.getItem("mae.v1")).metricas?.filter((m) => m.game === "galo" && m.tipo === "ronda").at(-1));
  console.log(`nível ${nivel} ${w}x${h}: ${info}; prémio ${premio}; toques ${toques}; ${Math.round((Date.now() - t0) / 1000)} s; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  console.log(`  registo: ${JSON.stringify(ultima)}`);
  if (!premio || erros.length) falhou = true;
  await page.close();
}

await jogar(1, 1024, 600);
await jogar(6, 1024, 600);
await jogar(4, 800, 1280);
await jogar(6, 1280, 800);
await browser.close();
process.exit(falhou ? 1 : 0);
