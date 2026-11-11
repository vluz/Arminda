// Jogada automática da Sequência: vê as luzes, repete-as, faz um erro (tratado com simpatia), e
// joga até ao ecrã do prémio num nível baixo e num alto.
// Correr em tools/testes (depois de npm install nessa pasta):  node sequencia.mjs <porta>
// Capturas de ecrã: app/test-shots/jogos/sequencia-n<nível>-<l>x<a>.png
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8776";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

// modo "ate_fim": sempre certo, chega ao comprimento pretendido.
// modo "parar": um erro cedo, depois dois erros no comprimento seguinte, para a ronda acabar mais cedo.
async function jogar(nivel, w, h, modo) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (t.includes("404") && !t.includes("/voz/tts/") && m.location()?.url && !m.location().url.includes("/voz/tts/")) erros.push(`${t} ${m.location().url}`);
    else if (!t.includes("404")) erros.push(t);
  });
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.addInitScript((n) => {
    localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.sequencia": n }));
    // Registar que botões se acendem enquanto a sequência é mostrada.
    window.__seq = [];
    new MutationObserver((lista) => {
      for (const m of lista) {
        const t = m.target;
        if (t.classList?.contains("seq-grelha") && t.classList.contains("demo") && !(m.oldValue || "").includes("demo")) window.__seq = [];
        if (t.classList?.contains("seq-botao") && t.classList.contains("acesa") && !(m.oldValue || "").includes("acesa")
          && t.parentElement.classList.contains("demo")) window.__seq.push(Number(t.dataset.i));
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  }, nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=sequencia`);
  const t0 = Date.now();
  let vezes = 0;
  let falhas = 0;
  let maior = 0;
  let premio = false;
  let foto = false;
  while (Date.now() - t0 < 240000) {
    if (await page.$(".premio .acoes button")) { premio = true; break; }
    const balao = await page.$eval(".balao", (b) => b.textContent).catch(() => "");
    const demo = await page.$(".seq-grelha.demo");
    if (!demo && balao.startsWith("Agora tu")) {
      const seq = await page.evaluate(() => window.__seq.slice());
      const contrario = balao.includes("contrário");
      let ordem = contrario ? [...seq].reverse() : seq;
      vezes++;
      // Errar de propósito: "parar" erra na 1.ª vez e duas vezes no 3.º comprimento; "ate_fim" uma vez na 2.ª vez.
      const errar = (modo === "parar" && (vezes === 1 || vezes >= 3)) || (modo === "ate_fim" && vezes === 2);
      if (errar) {
        const nb = await page.$$eval(".seq-botao", (b) => b.length);
        ordem = [(ordem[0] + 1) % nb];
        falhas++;
      } else {
        maior = Math.max(maior, seq.length);
      }
      if (!foto) {
        await page.screenshot({ path: `${OUT}/sequencia-n${nivel}-${w}x${h}.png` });
        foto = true;
      }
      const botoes = await page.$$(".seq-botao");
      for (const i of ordem) {
        const r = await botoes[i].boundingBox();
        await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
        await page.waitForTimeout(330);
      }
      // Esperar até o balão mudar, para a mesma vez não ser jogada duas vezes.
      await page.waitForFunction((t) => document.querySelector(".balao")?.textContent !== t || document.querySelector(".premio"), balao, { timeout: 20000 }).catch(() => {});
    } else {
      await page.waitForTimeout(200);
    }
  }
  const pequenos = await page.$$eval("button", (bs) => bs.map((b) => b.getBoundingClientRect())
    .filter((r) => r.width > 0 && Math.min(r.width, r.height) < 105).map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`));
  const lado = await page.$$eval(".seq-botao", (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().width))).catch(() => []);
  const metrica = await page.evaluate(() => JSON.parse(localStorage.getItem("mae.v1")).metricas?.filter((m) => m.game === "sequencia" && m.tipo === "ronda").at(-1));
  console.log(`nível ${nivel} ${w}x${h} ${modo}: prémio ${premio}; vezes ${vezes}; falhas ${falhas}; mais comprida ${maior}; ${((Date.now() - t0) / 1000).toFixed(0)} s; botões ${lado.join(",")} px; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}; botões pequenos: ${pequenos.length ? pequenos.join(" ") : "nenhum"}`);
  console.log("  registo", JSON.stringify(metrica));
  if (!premio || erros.length) falhou = true;
  await page.close();
}

const so = process.argv[3];
for (const [w, h] of [[1024, 600], [1280, 800], [800, 1280]]) {
  if (so && so !== `${w}x${h}`) continue;
  await jogar(1, w, h, "ate_fim");
  await jogar(6, w, h, "ate_fim");
}
if (!so) {
  for (const n of [2, 3, 4, 5]) await jogar(n, 1024, 600, "parar");
}
await browser.close();
process.exit(falhou ? 1 : 0);
