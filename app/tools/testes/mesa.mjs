// Jogada automática de Pôr a mesa: joga rondas inteiras até ao ecrã do prémio nos níveis e tamanhos dados.
// Alterna arrastos a sério com tocar e depois tocar, e faz primeiro uma jogada errada em cada nível
// (o garfo à direita, uma coisa que não faz falta, uma coisa certa apontada como errada, ou uma
// conta errada).
// Correr em tools/testes (depois de npm install nessa pasta):  node mesa.mjs <porta> [níveis | "todos"] [tamanhos]
// "todos": todos os níveis a 1024x600, mais o mais baixo e o mais alto a 1280x800 e a 800x1280.
// Precisa de um servidor nessa porta. Capturas de ecrã: app/test-shots/jogos/mesa-play-*.png
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const MAX = 12;
const [porta = "8765", lista = "todos", tams = "1024x600,1280x800,800x1280"] = process.argv.slice(2);
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const corridas = [];
if (lista === "todos") {
  for (let n = 1; n <= MAX; n++) corridas.push([n, "1024x600"]);
  for (const n of [1, MAX]) for (const t of ["1280x800", "800x1280"]) corridas.push([n, t]);
} else {
  for (const n of lista.split(",").map(Number)) for (const t of tams.split(",")) corridas.push([n, t]);
}
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;
// Centro de cada sítio num lugar, em % (como em mesa.js).
const ZONAS = {
  guardanapo: [10, 62], garfo: [23, 62], prato: [48, 61], faca: [72, 62], colher: [84, 62],
  copo: [85, 18], vinho: [70, 17], chavena: [84, 19], pao: [18, 18],
};

for (const [nivel, t] of corridas) {
  const [w, h] = t.split("x").map(Number);
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.mesa": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=mesa`);
  const nome = `mesa-play-n${nivel}-${w}x${h}`;
  const inicio = Date.now();
  let menor = Infinity;
  let jogadas = 0;
  let errada = false;
  let fotos = 0;

  async function arrastarOuTocar(a, alvo) {
    if (jogadas++ % 2 === 0) {
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) { await page.mouse.move(a.x + (alvo.x - a.x) * i / 10, a.y + (alvo.y - a.y) * i / 10); await page.waitForTimeout(25); }
      await page.mouse.up();
      return true;
    }
    return false;
  }
  async function mover(item, alvo) {
    const b = await page.locator(`.pm-coisa[data-item="${item}"]`).boundingBox();
    if (!b || !alvo) return;
    const a = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    if (!(await arrastarOuTocar(a, alvo))) {
      const escolhida = await page.$eval(`.pm-coisa[data-item="${item}"]`, (x) => x.classList.contains("escolhida")).catch(() => false);
      if (!escolhida) { await page.mouse.click(a.x, a.y); await page.waitForTimeout(150); }
      await page.mouse.click(alvo.x, alvo.y);
    }
    await page.waitForTimeout(450);
  }
  // O que está mal: tocar na coisa na gaveta, ou arrastá-la para a mesa.
  async function apontar(item) {
    const b = await page.locator(`.pm-coisa[data-item="${item}"]`).boundingBox();
    const m = await page.locator(".pm-mesa").boundingBox();
    if (!b || !m) return;
    const a = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    if (!(await arrastarOuTocar(a, { x: m.x + m.width / 2, y: m.y + m.height / 2 }))) await page.mouse.click(a.x, a.y);
    await page.waitForTimeout(450);
  }
  async function ponto(k, item, lado) {
    const r = await page.locator(`.pm-lugar[data-k="${k}"]`).boundingBox();
    if (!r) return null;
    const [x, y] = lado != null ? [lado, 60] : ZONAS[item];
    return { x: r.x + r.width * x / 100, y: r.y + r.height * y / 100 };
  }
  const estado = () => page.evaluate(() => {
    const m = document.querySelector(".pm-mesa");
    const tamanhos = [...document.querySelectorAll(".pm-gaveta button")].map((b) => Math.min(b.offsetWidth, b.offsetHeight));
    if (m && m.dataset.resposta) {
      const numeros = [...document.querySelectorAll(".pm-numero")].map((b) => Number(b.dataset.n));
      return { modo: "contar", resposta: Number(m.dataset.resposta), numeros, tamanhos, feito: !document.querySelector(".pm-pergunta") };
    }
    if (!m || !m.dataset.precisa || !m.dataset.modo) return null;
    const precisa = JSON.parse(m.dataset.precisa);
    const nomes = (sel) => [...document.querySelectorAll(sel)].filter((f) => !f.classList.contains("sai")).map((f) => [...f.classList].find((c) => c.startsWith("c-")).slice(2));
    const postos = precisa.map((_, k) => nomes(`.pm-lugar[data-k="${k}"] .pm-posto`));
    const centro = (m.dataset.centro || "").split(",").filter(Boolean);
    const noCentro = nomes(".pm-centro .pm-posto");
    const seq = (m.dataset.sequencia || "").split(",").filter(Boolean);
    const errosMesa = (m.dataset.erros || "").split(",").filter(Boolean);
    const gaveta = [...document.querySelectorAll(".pm-coisa")].map((b) => b.dataset.item);
    return { modo: m.dataset.modo, precisa, postos, centro, noCentro, seq, errosMesa, tamanhos, gaveta };
  });

  while (Date.now() - inicio < 420000) {
    if (await page.$(".premio")) break;
    const s = await estado();
    if (!s) { await page.waitForTimeout(300); continue; }
    menor = Math.min(menor, ...s.tamanhos);
    const joaninha = await page.$(".pm-joaninha:not(.apanhada)");
    if (joaninha) { await joaninha.click().catch(() => {}); await page.waitForTimeout(300); }

    if (s.modo === "contar") {
      if (s.feito) { await page.waitForTimeout(300); continue; }
      if (fotos === 0) { await page.screenshot({ path: `${OUT}/${nome}-0.png` }); fotos = 1; }
      const n = errada ? s.resposta : s.numeros.find((x) => x !== s.resposta);
      if (!errada && await page.$(".lida-abana")) { errada = true; await page.waitForTimeout(2500); continue; }
      await page.locator(`.pm-numero[data-n="${n}"]`).click();
      await page.waitForTimeout(errada ? 2500 : 600);
      if (errada && fotos === 1) { await page.screenshot({ path: `${OUT}/${nome}-b.png` }); fotos = 3; }
      continue;
    }

    if (s.modo === "erros") {
      if (!s.errosMesa.length) { await page.waitForTimeout(300); continue; }
      if (fotos === 0) { await page.screenshot({ path: `${OUT}/${nome}-0.png` }); fotos = 1; }
      if (!errada) {
        if (await page.$(".lida-abana")) { errada = true; await page.waitForTimeout(2500); continue; }
        const bem = s.gaveta.find((x) => !s.errosMesa.includes(x) && x !== "chavena" && x !== "vinho" && x !== "copo");
        await apontar(bem);
        await page.waitForTimeout(400);
        continue;
      }
      const antes = s.errosMesa.length;
      await apontar(s.errosMesa[0]);
      const d = await estado();
      if (d && d.errosMesa.length === antes) await page.waitForTimeout(800);
      if (fotos === 1 && d && d.errosMesa.length === 0) { await page.waitForTimeout(800); await page.screenshot({ path: `${OUT}/${nome}-b.png` }); fotos = 3; }
      continue;
    }

    // Coisa seguinte a pôr: pela ordem dita, senão a primeira que falte em qualquer lugar.
    let prox = null;
    if (s.seq.length) {
      const k = s.postos[0].length;
      if (k < s.seq.length) prox = { k: 0, item: s.seq[k] };
    } else {
      for (const [k, p] of s.precisa.entries()) {
        const x = p.find((i) => !s.postos[k].includes(i));
        if (x) { prox = { k, item: x }; break; }
      }
      if (!prox) {
        const x = s.centro.find((i) => !s.noCentro.includes(i));
        if (x) prox = { k: "centro", item: x };
      }
    }
    if (!prox) { await page.waitForTimeout(300); continue; }
    if (!errada) {
      if (fotos === 0) { await page.screenshot({ path: `${OUT}/${nome}-0.png` }); fotos = 1; }
      if (await page.$(".lida-abana")) { errada = true; await page.waitForTimeout(2500); continue; }
      const naoPrecisa = s.gaveta.find((i) => !s.precisa[0].includes(i) && !s.centro.includes(i));
      if (s.precisa[0].includes("garfo") && !s.postos[0].includes("garfo")) await mover("garfo", await ponto(0, "garfo", 85));
      else if (naoPrecisa) await mover(naoPrecisa, await ponto(0, "prato"));
      else errada = true;
      await page.waitForTimeout(300);
      continue;
    }
    if (fotos === 1 && s.postos.flat().length >= 2) { await page.screenshot({ path: `${OUT}/${nome}-a.png` }); fotos = 2; }
    const antes = s.postos.flat().length + s.noCentro.length;
    if (prox.k === "centro") {
      const r = await page.locator(".pm-centro").boundingBox();
      await mover(prox.item, { x: r.x + r.width / 2, y: r.y + r.height / 2 });
    } else {
      await mover(prox.item, await ponto(prox.k, prox.item));
    }
    const d = await estado();
    if (d && d.postos && d.postos.flat().length + d.noCentro.length === antes) await page.waitForTimeout(600);
    if (fotos === 2 && d && d.precisa && d.precisa.every((p, k) => p.every((i) => d.postos[k].includes(i))) && d.centro.every((i) => d.noCentro.includes(i))) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${nome}-b.png` });
      fotos = 3;
    }
  }
  let premio = false;
  for (let i = 0; i < 40 && !premio; i++) { await page.waitForTimeout(500); premio = (await page.locator(".premio .acoes button").count()) > 0; }
  await page.screenshot({ path: `${OUT}/${nome}-premio.png` });
  const metrica = await page.evaluate(() => (JSON.parse(localStorage.getItem("mae.v1")).metricas || []).filter((m) => m.game === "mesa" && m.tipo === "ronda").at(-1));
  console.log(`nível ${nivel} ${w}x${h}: prémio ${premio}, botão mais pequeno ${menor} px, ${Math.round((Date.now() - inicio) / 1000)} s, erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  console.log(`  registo: ${JSON.stringify(metrica)}`);
  const erradas = metrica ? metrica.wrong_items + metrica.side_errors + metrica.order_errors : 0;
  if (!premio || erros.length || menor < 113 || !erradas) falhou = true;
  await page.close();
}
await browser.close();
process.exit(falhou ? 1 : 0);
