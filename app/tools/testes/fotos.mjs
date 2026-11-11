// Fotografias com conteúdos de família de substituição (nunca fotografias verdadeiras): as legendas
// feitas a partir de nomes.txt são mostradas (o nome sem o artigo, mais a legenda) e os ficheiros
// de voz delas tocam; o álbum está pela ordem dos números das fotografias; o registo só diz as
// fotografias pelo número.
// Correr em tools/testes (depois de npm install nessa pasta):  node fotos.mjs <porta>
// Precisa de um servidor em <porta> e dos conteúdos de substituição (ver o cabeçalho de quem.mjs).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const [porta = "8795"] = process.argv.slice(2);
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
const MEDIA = fileURLToPath(new URL("../../../media-exemplo-quem/_preparado", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(path.join(MEDIA, "manifest.json"))) {
  console.log(`FALHOU: não há conteúdos de substituição em ${MEDIA} (ver o cabeçalho de quem.mjs)`);
  process.exit(1);
}
const MANIFESTO = JSON.parse(fs.readFileSync(path.join(MEDIA, "manifest.json"), "utf8"));
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

for (const [w, h] of [[1024, 600], [1280, 800], [800, 1280]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("console", (m) => { if (m.type() === "error" && !(m.location()?.url || "").includes("/voz/")) erros.push(m.text()); });
  page.on("pageerror", (e) => erros.push(String(e)));
  const pedidos = [];
  await page.route("**/media-teste/**", (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname.split("/media-teste/")[1]);
    pedidos.push(rel);
    const f = path.join(MEDIA, rel);
    if (!rel.includes("..") && fs.existsSync(f)) return route.fulfill({ path: f });
    return route.continue();
  });
  await page.addInitScript(() => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true })));
  await page.goto(`http://127.0.0.1:${porta}/#jogo=fotos`);
  const vistas = [];
  for (let k = 0; k < 3; k++) {
    await page.waitForFunction((n) => document.querySelector(".media-legenda")?.textContent && document.querySelectorAll(".media-moldura img").length, k, { timeout: 15000 });
    await page.waitForTimeout(900);
    const legenda = await page.locator(".media-legenda").textContent();
    const src = decodeURIComponent(await page.locator(".media-moldura img").getAttribute("src"));
    vistas.push({ legenda, src });
    if (k === 1) await page.screenshot({ path: `${OUT}/fotos-legenda-${w}x${h}.png` });
    await page.locator("button[aria-label=Seguinte]").click();
  }
  // Ecrã inteiro com toque a sério: um toque na fotografia enche o ecrã, um segundo toque traz as
  // setas de volta, e um deslize continua a virar a página em ecrã inteiro.
  const cdp = await page.context().newCDPSession(page);
  const toque = async (x, y, x2 = x, y2 = y) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    if (x2 !== x || y2 !== y) for (let i = 1; i <= 5; i++) {
      await page.waitForTimeout(30);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + ((x2 - x) * i) / 5, y: y + ((y2 - y) * i) / 5 }] });
    }
    await page.waitForTimeout(80);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(600);
  };
  const caixa = await page.locator(".media-moldura").boundingBox();
  const cx = caixa.x + caixa.width / 2, cy = caixa.y + caixa.height / 2;
  await toque(cx, cy);
  const cheio = await page.evaluate(() => {
    const c = document.querySelector(".media-centro"), r = c.getBoundingClientRect();
    const topo = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return c.classList.contains("cheio") && r.width === innerWidth && r.height === innerHeight && c.contains(topo);
  });
  await page.screenshot({ path: `${OUT}/fotos-cheio-${w}x${h}.png` });
  const antesDeslize = await page.locator(".media-moldura img").getAttribute("src");
  await toque(w * 0.75, h / 2, w * 0.25, h / 2);
  const deslizouCheio = (await page.locator(".media-moldura img").getAttribute("src")) !== antesDeslize;
  await toque(w / 2, h / 2);
  const voltou = await page.evaluate(() => !document.querySelector(".media-centro").classList.contains("cheio"));
  const setasOk = await page.locator("button[aria-label=Seguinte]").isVisible();
  const cheioOk = cheio && deslizouCheio && voltou && setasOk;
  console.log(`${w}x${h}: o toque enche o ecrã ${cheio}; o deslize em ecrã inteiro vira ${deslizouCheio}; segundo toque volta ${voltou}; setas à vista ${setasOk}`);

  await page.locator(".botao-casa").click();
  await page.waitForTimeout(1000);
  const registo = await page.evaluate(() => (JSON.parse(localStorage.getItem("mae.v1")).metricas || [])
    .filter((m) => m.tipo === "ronda" && m.game === "fotos").at(-1));
  const esperado = MANIFESTO.fotos.slice(0, 3);
  const legendasOk = vistas.every((v, k) => v.legenda === esperado[k].legenda && v.src.endsWith(esperado[k].ficheiro));
  const vozesOk = esperado.every((f) => pedidos.includes(f.voz));
  const ordemOk = MANIFESTO.fotos.map((f) => f.numero).join() === [...MANIFESTO.fotos.map((f) => f.numero)].sort((a, b) => a - b).join();
  const chaves = (registo?.longest_views || []).map(([k]) => k);
  const semNomes = !JSON.stringify(registo || {}).match(/Tia|Primo|Avó/);
  const ok = cheioOk && registo?.fullscreen_taps === 2 && registo?.swipes === 1 && legendasOk && vozesOk && ordemOk && chaves.length && chaves.every((k) => /^\d+$/.test(k)) && semNomes && !erros.length;
  if (!ok) falhou = true;
  console.log(`${w}x${h}: legendas ${JSON.stringify(vistas.map((v) => v.legenda))} ${legendasOk ? "match" : "DIFFER"}; ` +
    `vozes das legendas tocadas ${vozesOk}; ordem dos números ${ordemOk}; chaves de fotografia no registo ${JSON.stringify(chaves)}, sem nomes ${semNomes}; ` +
    `erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  await page.close();
}
await browser.close();
process.exit(falhou ? 1 : 0);
