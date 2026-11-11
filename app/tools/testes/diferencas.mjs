// Jogada automática das Diferenças: toca em todas as diferenças (em qualquer das imagens), faz uns
// toques errados, espera uma vez pelo brilho da pista, e joga até ao ecrã do prémio num nível baixo
// e num alto.
// Correr em tools/testes (depois de npm install nessa pasta):  node diferencas.mjs <porta> [LxA]
// Capturas de ecrã: app/test-shots/jogos/diferencas-n<nível>-<l>x<a>[-fim].png
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8776";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

// Ponto do ecrã de um ponto da imagem, na imagem k (0 ou 1).
async function ecraDe(page, k, x, y) {
  return page.evaluate(([k, x, y]) => {
    const svg = document.querySelectorAll(".dif-quadro > svg")[k];
    const p = svg.createSVGPoint();
    p.x = x; p.y = y;
    const q = p.matrixTransform(svg.getScreenCTM());
    return { x: q.x, y: q.y };
  }, [k, x, y]);
}

async function jogar(nivel, w, h, esperarPista) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = m.location()?.url || "";
    if (url.includes("/voz/")) return; // os ficheiros de voz vêm depois (gerar_voz.py)
    erros.push(`${m.text()} ${url}`);
  });
  page.on("pageerror", (e) => erros.push(String(e)));
  // Uma imagem cuja carga foi cortada porque o gato mudou de cara não é um erro.
  page.on("requestfailed", (r) => {
    if (r.url().includes("/voz/") || (r.failure()?.errorText || "").includes("ERR_ABORTED")) return;
    erros.push(`falhou ${r.url()} ${r.failure()?.errorText || ""}`);
  });
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.diferencas": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=diferencas`);
  const t0 = Date.now();
  let imagens = 0;
  let toques = 0;
  let errados = 0;
  let pistaVista = false;
  let premio = false;
  let tamanhos = [];
  let objetos = [];
  while (Date.now() - t0 < 240000) {
    if (await page.$(".premio .acoes button")) { premio = true; break; }
    const mesa = await page.$(".dif-mesa:not([data-feita])");
    if (!mesa) { await page.waitForTimeout(250); continue; }
    await page.evaluate(() => { document.querySelector(".dif-mesa").dataset.feita = "1"; });
    const zonas = JSON.parse(await mesa.getAttribute("data-zonas"));
    imagens++;
    await page.waitForTimeout(1200);
    if (imagens === 1) await page.screenshot({ path: `${OUT}/diferencas-n${nivel}-${w}x${h}.png` });
    // A zona de diferença mais pequena no ecrã, em px CSS (diâmetro da zona de toque).
    const escala = await page.evaluate(() => {
      const s = document.querySelector(".dif-quadro > svg");
      return s.getBoundingClientRect().width / 400;
    });
    tamanhos.push(...zonas.flat().map((z) => Math.round(2 * z.r * escala)));
    objetos.push(...zonas.flat().map((z) => Math.round(z.s * escala)));

    // Dois toques errados num sítio longe de todas as diferenças.
    let livre = null;
    for (let y = 20; y < 320 && !livre; y += 15) {
      for (let x = 20; x < 390 && !livre; x += 15) {
        if (zonas.flat().every((z) => Math.hypot(z.x - x, z.y - y) > z.r + 10)) livre = { x, y };
      }
    }
    if (livre) {
      for (let i = 0; i < 2; i++) {
        const p = await ecraDe(page, i % 2, livre.x, livre.y);
        await page.mouse.click(p.x, p.y);
        errados++;
        await page.waitForTimeout(400);
      }
    }

    if (esperarPista && !pistaVista) {
      await page.waitForSelector(".dif-pista", { timeout: 60000 });
      pistaVista = true;
      await page.screenshot({ path: `${OUT}/diferencas-n${nivel}-${w}x${h}-pista.png` });
    }

    for (let d = 0; d < zonas.length; d++) {
      // Tocar um pouco fora do centro, em imagens alternadas, como faria um dedo a tremer.
      const z = zonas[d][d % zonas[d].length];
      const k = d % 2;
      const p = await ecraDe(page, k, z.x + z.r * 0.25, z.y - z.r * 0.2);
      await page.mouse.click(p.x, p.y);
      toques++;
      await page.waitForTimeout(700);
      if (d === zonas.length - 2) await page.screenshot({ path: `${OUT}/diferencas-n${nivel}-${w}x${h}-fim.png` });
    }
  }
  const pequenos = await page.$$eval("button", (bs) => bs.map((b) => b.getBoundingClientRect())
    .filter((r) => r.width > 0 && Math.min(r.width, r.height) < 105).map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`));
  const metrica = await page.evaluate(() => JSON.parse(localStorage.getItem("mae.v1")).metricas?.filter((m) => m.game === "diferencas" && m.tipo === "ronda").at(-1));
  console.log(`nível ${nivel} ${w}x${h}: prémio ${premio}; imagens ${imagens}; toques ${toques}; errados ${errados}; pista vista ${pistaVista}; zona de toque mais pequena ${Math.min(...tamanhos)} px; objeto mudado mais pequeno ${Math.min(...objetos)} px (mín. 88); ${((Date.now() - t0) / 1000).toFixed(0)} s; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}; botões pequenos: ${pequenos.length ? pequenos.join(" ") : "nenhum"}`);
  console.log("  registo", JSON.stringify(metrica));
  if (!premio || erros.length || Math.min(...objetos) < 88) falhou = true;
  await page.close();
}

const so = process.argv[3];
for (const [w, h] of [[1024, 600], [1280, 800], [800, 1280]]) {
  if (so && so !== `${w}x${h}`) continue;
  await jogar(1, w, h, w === 1024);
  await jogar(6, w, h, false);
  await jogar(11, w, h, false);
}
if (!so) {
  for (const n of [2, 3, 4, 5, 7, 8, 9, 10]) await jogar(n, 1024, 600, false);
}
await browser.close();
process.exit(falhou ? 1 : 0);
