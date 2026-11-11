// Joga rondas inteiras de Dominó até ao ecrã do prémio, num nível baixo e num alto.
// Correr em tools/testes (depois de npm install nessa pasta):  node domino.mjs <porta>
// Os ficheiros de voz em falta (voz/...) são esperados até a voz ser feita, e não contam.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8772";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

async function jogar(nivel, w, h, errar) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("pageerror", (x) => erros.push(String(x)));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.domino": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=domino`);
  const t0 = Date.now();
  let jogadas = 0;
  let errou = false;
  let foto = false;
  let escolhas = 0;
  while (Date.now() - t0 < 400000) {
    if (await page.$(".premio")) break;
    const estado = await page.evaluate(() => {
      const pe = document.querySelector(".dom-ponta.esq");
      if (!pe) return { ends: null, mao: [], escolha: false, passo: true };
      const vazia = pe.classList.contains("vazia");
      const ends = vazia ? null : [Number(pe.dataset.n), Number(document.querySelector(".dom-ponta.dir").dataset.n)];
      const mao = [...document.querySelectorAll(".dom-peca")].map((b) => [Number(b.dataset.a), Number(b.dataset.b)]);
      return { ends, mao, escolha: !!document.querySelector(".dom-ponta.escolha"), passo: !!document.querySelector(".dom-rival.vez") };
    });
    if (estado.escolha) {
      escolhas++;
      await page.click(Math.random() < 0.5 ? ".dom-ponta.esq" : ".dom-ponta.dir", { force: true });
      await page.waitForTimeout(500);
      continue;
    }
    if (!estado.passo) {
      const serve = (p) => !estado.ends || p.includes(estado.ends[0]) || p.includes(estado.ends[1]);
      const i = estado.mao.findIndex(serve);
      const mau = estado.mao.findIndex((p) => !serve(p));
      if (errar && !errou && mau >= 0 && i >= 0 && estado.ends) {
        errou = true;
        await page.click(`.dom-peca[data-i="${mau}"]`, { force: true });
        await page.waitForTimeout(3500);
        continue;
      }
      if (i >= 0) {
        if (!foto && estado.ends) {
          foto = true;
          await page.screenshot({ path: `${OUT}/domino-jogo-n${nivel}-${w}x${h}.png` });
        }
        await page.click(`.dom-peca[data-i="${i}"]`, { force: true, timeout: 3000 }).catch(() => {});
        jogadas++;
      }
    }
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(2500);
  const premio = !!(await page.$(".premio"));
  await page.screenshot({ path: `${OUT}/domino-premio-n${nivel}-${w}x${h}.png` });
  const balao = await page.$eval(".balao", (b) => b.textContent).catch(() => "");
  const pequenos = await page.$$eval(".dom-peca, .dom-ponta:not(.vazia)", (bs) => bs.map((b) => b.getBoundingClientRect())
    .filter((r) => r.width > 0 && Math.min(r.width, r.height) < 113).length);
  console.log(`nível ${nivel} ${w}x${h}: prémio ${premio}; toques ${jogadas}; escolhas de ponta ${escolhas}; ${Math.round((Date.now() - t0) / 1000)} s; alvos pequenos ${pequenos}; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}; última frase "${balao}"`);
  if (!premio || erros.length) falhou = true;
  await page.close();
}

await jogar(1, 1024, 600, false);
await jogar(5, 1024, 600, true);
await jogar(2, 800, 1280, false);
await jogar(6, 1280, 800, true);
await browser.close();
process.exit(falhou ? 1 : 0);
