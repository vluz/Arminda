// Jogada automática da Cozinha: joga rondas inteiras até ao ecrã do prémio nos níveis dados.
// Correr em tools/testes (depois de npm install nessa pasta):  node cozinha.mjs <porta> [níveis, por exemplo 1,8,12]
// Precisa de um servidor nessa porta. Capturas de ecrã: app/test-shots/jogos/cozinha-play-*.png
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const [porta = "8774", lista = "1,7,8,9,10,11,12"] = process.argv.slice(2);
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

// Clicar até a condição ser verdadeira.
async function clicarAte(page, sel, feito, limite = 90000) {
  const t0 = Date.now();
  while (!(await feito())) {
    if (Date.now() - t0 > limite) throw new Error(`preso em ${sel}`);
    await page.click(sel, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(350);
  }
}

for (const nivel of lista.split(",").map(Number)) {
  for (const [w, h] of [[1024, 600], [1280, 800], [800, 1280]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
    const erros = [];
    // Os ficheiros de voz em falta são esperados até a voz ser feita; qualquer outra falha conta.
    page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
    page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
    page.on("pageerror", (e) => erros.push(String(e)));
    await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.cozinha": n })), nivel);
    await page.goto(`http://127.0.0.1:${porta}/#jogo=cozinha`);
    const receitas = await page.evaluate(async () => (await import("/js/jogos/cozinha.js")).RECEITAS);
    const inicio = Date.now();
    let pratos = 0;
    let errada = false;
    let shot = 0;
    let menor = Infinity;
    const medir = async (sel) => {
      const m = await page.$$eval(sel, (bs) => bs.filter((b) => !b.classList.contains("usado")).map((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height)));
      if (m.length) menor = Math.min(menor, ...m);
    };
    const foto = async () => {
      if (shot === 0) { await page.screenshot({ path: `${OUT}/cozinha-play-n${nivel}-${w}x${h}-a.png` }); shot++; }
    };
    while (Date.now() - inicio < 420000) {
      if (await page.$(".premio")) break;
      const ids = await page.$$eval(".receita", (cs) => cs.map((c) => c.dataset.receita)).catch(() => []);
      const pronto = await page.$(".panela.pronto");
      if (!ids.length || pronto) { await page.waitForTimeout(300); continue; }
      const dois = !!(await page.$(".cozinha.dois"));
      const etapas = !!(await page.$(".cozinha.etapas"));
      const qtd = !!(await page.$(".cozinha.qtd"));
      const recs = ids.map((id) => receitas.find((r) => r.id === id));
      // Um toque errado nos níveis altos, para passar pelo caminho do erro simpático.
      if (nivel >= 4 && !errada) {
        if (etapas) {
          const falso = await page.$$eval(".ingrediente.etapa", (bs, e) => bs.map((b) => b.dataset.etapa).find((x) => !e.includes(x)), recs[0].etapas);
          if (falso) {
            await clicarAte(page, `.ingrediente[data-etapa="${falso}"]`, async () => !!(await page.$(".ingrediente.abana")));
            errada = true;
          }
        } else {
          const precisos = recs.flatMap((r) => r.passos.flat());
          const bs = await page.$$eval(".ingrediente", (xs) => xs.map((b) => b.dataset.id));
          const mau = bs.find((x) => !precisos.includes(x));
          if (mau) {
            await clicarAte(page, `.ingrediente[data-id="${mau}"]`, async () => !!(await page.$(".ingrediente.abana")));
            errada = true;
          }
        }
      }
      if (etapas) {
        await medir(".ingrediente.etapa");
        for (const x of recs[0].etapas) {
          const sel = `.ingrediente[data-etapa="${x}"]`;
          await clicarAte(page, sel, async () => page.$eval(sel, (b) => b.classList.contains("usado")).catch(() => true));
          await foto();
        }
      } else if (dois) {
        await medir(".ingrediente");
        await medir(".panela");
        for (const [k, rec] of recs.entries()) {
          for (const ing of rec.passos.flat()) {
            const sel = `.ingrediente[data-id="${ing}"]`;
            const t0 = Date.now();
            while (!(await page.$eval(sel, (b) => b.classList.contains("usado")).catch(() => true))) {
              if (Date.now() - t0 > 90000) throw new Error(`preso em ${ing}`);
              if (!(await page.$eval(sel, (b) => b.classList.contains("escolhido")).catch(() => false))) {
                await page.click(sel, { timeout: 5000 }).catch(() => {});
                await page.waitForTimeout(300);
                continue;
              }
              await foto();
              await page.click(`.panela[data-receita="${rec.id}"]`, { timeout: 5000 }).catch(() => {});
              await page.waitForTimeout(350);
            }
            void k;
          }
        }
      } else {
        await medir(".ingrediente");
        const rec = recs[0];
        const cont = qtd ? (rec.qtd || {}) : {};
        for (const grupo of rec.passos) {
          for (const ing of grupo) {
            const sel = `.ingrediente[data-id="${ing}"]`;
            const quer = cont[ing] || 1;
            const t0 = Date.now();
            const feito = async () => qtd
              ? Number(await page.$eval(`${sel} .conta`, (b) => b.textContent).catch(() => "0")) >= quer
              : page.$eval(sel, (b) => b.classList.contains("usado")).catch(() => true);
            while (!(await feito())) {
              if (Date.now() - t0 > 90000) throw new Error(`preso em ${ing}`);
              const antes = await page.$eval(`${sel} .conta`, (b) => b.textContent).catch(() => "0");
              await page.click(sel, { timeout: 5000 }).catch(() => {});
              // Esperar que este toque conte antes do seguinte, para não cair nenhum toque a mais.
              if (qtd) await page.waitForFunction(([s, a]) => (document.querySelector(`${s} .conta`)?.textContent || "0") !== a || document.querySelector(".panela.pronto"), [sel, antes], { timeout: 5000 }).catch(() => {});
              await page.waitForTimeout(350);
            }
            if (grupo === rec.passos[1]) await foto();
          }
        }
      }
      pratos += recs.length;
      await page.waitForSelector(".panela.pronto", { timeout: 20000 });
      await page.waitForTimeout(400);
      if (pratos <= 2) await page.screenshot({ path: `${OUT}/cozinha-play-n${nivel}-${w}x${h}-pronto.png` });
      await page.waitForFunction(() => !document.querySelector(".panela.pronto") || document.querySelector(".premio"), null, { timeout: 40000 });
    }
    const premio = !!(await page.$(".premio"));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/cozinha-play-n${nivel}-${w}x${h}-premio.png` });
    const metrica = await page.evaluate(() => (JSON.parse(localStorage.getItem("mae.v1")).metricas || []).filter((m) => m.game === "cozinha" && m.tipo === "ronda").at(-1));
    console.log(`nível ${nivel} ${w}x${h}: pratos ${pratos}, prémio ${premio}, alvo mais pequeno ${Math.round(menor)} px, ${Math.round((Date.now() - inicio) / 1000)} s, erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
    console.log(`  registo: ${JSON.stringify(metrica)}`);
    if (!premio || erros.length || menor < 113) falhou = true;
    await page.close();
  }
}
await browser.close();
process.exit(falhou ? 1 : 0);
