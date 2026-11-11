// Jogada automática das Sardinhas: toca em todas as sardinhas que vê (e no gato uma vez, nos níveis
// com gato) até ao ecrã do prémio. Nos níveis com regra deixa em paz as sardinhas pequenas e os
// outros peixes, menos um deslize de propósito para conferir a frase simpática.
// Correr em tools/testes (depois de npm install nessa pasta):  node sardinha.mjs <porta> [níveis, por exemplo 1,11]
// Precisa de um servidor nessa porta. Capturas de ecrã: app/test-shots/jogos/sardinha-play-*.png
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const [porta = "8774", lista = "1,11"] = process.argv.slice(2);
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

for (const nivel of lista.split(",").map(Number)) {
  for (const [w, h] of [[1024, 600], [1280, 800], [800, 1280]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
    const erros = [];
    page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
    page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
    page.on("pageerror", (e) => erros.push(String(e)));
    await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.sardinha": n })), nivel);
    await page.goto(`http://127.0.0.1:${porta}/#jogo=sardinha`);
    const inicio = Date.now();
    let toques = 0;
    let gatoTocado = false;
    let outroTocado = false;
    let shot = 0;
    let menor = Infinity;
    let maxJuntos = 0;
    const fotos = new Set();
    while (Date.now() - inicio < Number(process.env.LIMITE || 400000)) {
      if (await page.$(".premio")) break;
      // Alvos visíveis: com o centro acima da superfície da água.
      const alvos = await page.$$eval(".sardinhas .alvo:not(.apanhada)", (as) => {
        const agua = document.querySelector(".sardinhas .agua").getBoundingClientRect().top;
        return as.map((a, i) => {
          const r = a.getBoundingClientRect();
          return { i, gato: a.classList.contains("gato"), outro: a.classList.contains("pequena") || a.classList.contains("outro"),
            ouro: a.classList.contains("ouro"), riso: a.classList.contains("riso"), lado: parseFloat(a.style.width),
            x: r.left + r.width / 2, y: r.top + r.height / 2, fora: r.top + r.height / 2 < agua - r.height * 0.3 };
        }).filter((a) => a.fora);
      }).catch(() => []);
      maxJuntos = Math.max(maxJuntos, alvos.length);
      for (const a of alvos) menor = Math.min(menor, a.lado);
      for (const [nome, sim] of [["ouro", alvos.some((a) => a.ouro)], ["outro", alvos.some((a) => a.outro)], ["tres", alvos.length >= 3]]) {
        if (sim && !fotos.has(nome)) { fotos.add(nome); await page.screenshot({ path: `${OUT}/sardinha-play-n${nivel}-${w}x${h}-${nome}.png` }); }
      }
      for (const a of alvos) {
        if (a.riso) continue;
        if (a.gato && (gatoTocado || nivel < 4)) continue;
        if (a.outro && outroTocado) continue;
        if (a.gato) gatoTocado = true;
        if (a.outro) outroTocado = true;
        // Um toque um pouco a tremer, um pouco fora do centro.
        await page.mouse.click(a.x + 12, a.y - 8);
        toques++;
        if (shot < 2 && (a.gato || toques === 3)) {
          await page.screenshot({ path: `${OUT}/sardinha-play-n${nivel}-${w}x${h}-${a.gato ? "gato" : "peixe"}.png` });
          shot++;
        }
      }
      await page.waitForTimeout(100);
    }
    const premio = !!(await page.$(".premio"));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/sardinha-play-n${nivel}-${w}x${h}-premio.png` });
    const metrica = await page.evaluate(() => (JSON.parse(localStorage.getItem("mae.v1")).metricas || []).filter((m) => m.game === "sardinha" && m.tipo === "ronda").at(-1));
    console.log(`nível ${nivel} ${w}x${h}: toques ${toques}, alvo mais pequeno ${menor} px, máximo ao mesmo tempo ${maxJuntos}, prémio ${premio}, ${Math.round((Date.now() - inicio) / 1000)} s, erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
    console.log(`  registo: ${JSON.stringify(metrica)}`);
    if (!premio || erros.length || menor < 113) falhou = true;
    await page.close();
  }
}
await browser.close();
process.exit(falhou ? 1 : 0);
