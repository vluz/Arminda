// Jogada automática do Estendal: joga rondas inteiras até ao ecrã do prémio nos níveis e tamanhos dados.
// Alterna arrastos a sério com tocar e depois tocar, e faz primeiro uma jogada errada em cada nível.
// Correr em tools/testes (depois de npm install nessa pasta):  node estendal.mjs <porta> [níveis | "todos"] [tamanhos]
// "todos": todos os níveis a 1024x600, mais o mais baixo e o mais alto a 1280x800 e a 800x1280.
// Precisa de um servidor nessa porta. Capturas de ecrã: app/test-shots/jogos/estendal-play-*.png
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

for (const [nivel, t] of corridas) {
  const [w, h] = t.split("x").map(Number);
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.estendal": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=estendal`);
  const nome = `estendal-play-n${nivel}-${w}x${h}`;
  const inicio = Date.now();
  let menor = Infinity;
  let jogadas = 0;
  let errada = false;
  let fotos = 0;

  const centro = async (sel) => {
    const b = await page.locator(sel).first().boundingBox();
    return b && { x: b.x + b.width / 2, y: b.y + b.height * 0.45 };
  };
  // Uma jogada: arrastar a peça a para a corda, ou tocar em a e depois tocar na corda.
  async function mover(selA, selB) {
    const a = await centro(selA);
    const b = await centro(selB);
    if (!a || !b) return;
    if (jogadas++ % 2 === 0) {
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 10, a.y + (b.y - a.y) * i / 10); await page.waitForTimeout(25); }
      await page.mouse.up();
    } else {
      const escolhida = await page.$eval(selA, (x) => x.classList.contains("escolhida")).catch(() => false);
      if (!escolhida) { await page.mouse.click(a.x, a.y); await page.waitForTimeout(150); }
      await page.mouse.click(b.x, b.y);
    }
    await page.waitForTimeout(450);
  }
  const estado = () => page.evaluate(() => {
    const c = document.querySelector(".est-cordas");
    const pecas = [...document.querySelectorAll(".est-peca")].map((b, i) => ({ i, chave: b.dataset.chave, tipo: b.dataset.tipo, cor: b.dataset.cor, padrao: b.dataset.padrao, usada: b.classList.contains("usada") }));
    const d = c ? c.dataset : {};
    const partir = (s) => (s || "").split(",").filter(Boolean);
    const tamanhos = [...document.querySelectorAll(".est-peca")].map((b) => Math.min(b.offsetWidth, b.offsetHeight));
    return {
      modo: d.modo || "", pecas, tamanhos,
      alvo: partir(d.alvo), faltam: partir(d.faltam),
      grupos: partir(d.grupos).map((x) => { const [tipo, q] = x.split(":"); return { tipo, n: Number(q) }; }),
      regras: (d.regras || "").split(",").map((x) => { const [atr, val] = x.split(":"); return { atr, val }; }),
    };
  });

  // Para o estado atual: a jogada certa e uma errada, como [peça, corda] ou null.
  function jogada(s) {
    const livres = s.pecas.filter((p) => !p.usada);
    const usadas = s.pecas.length - livres.length;
    const P = (p) => p && `.est-peca >> nth=${p.i}`;
    const L = (k) => `.est-corda >> nth=${k}`;
    if (s.modo === "regra") {
      const linha = (p) => s.regras.findIndex((r) => p[r.atr] === r.val);
      const certa = livres.find((p) => linha(p) >= 0);
      const errada = livres.find((p) => linha(p) < 0);
      return { certo: certa && [P(certa), L(linha(certa))], errado: errada && [P(errada), L(0)] };
    }
    if (s.modo === "falta") {
      const hung = new Set(s.pecas.filter((p) => p.usada).map((p) => p.chave));
      const certa = livres.find((p) => s.faltam.includes(p.chave) && !hung.has(p.chave));
      const errada = livres.find((p) => !s.faltam.includes(p.chave));
      return { certo: certa && [P(certa), L(0)], errado: errada && [P(errada), L(0)] };
    }
    if (s.modo === "encomenda") {
      let k = usadas;
      const atual = s.grupos.find((g) => { if (k < g.n) return true; k -= g.n; return false; });
      if (!atual) return { certo: null, errado: null };
      const certa = livres.find((p) => p.tipo === atual.tipo);
      const errada = livres.find((p) => p.tipo !== atual.tipo);
      return { certo: certa && [P(certa), L(0)], errado: errada && [P(errada), L(0)] };
    }
    if (!s.alvo.length || usadas >= s.alvo.length) return { certo: null, errado: null };
    const certa = livres.find((p) => p.chave === s.alvo[usadas]);
    const errada = livres.find((p) => p.chave !== s.alvo[usadas]);
    return { certo: certa && [P(certa), L(0)], errado: errada && [P(errada), L(0)] };
  }

  while (Date.now() - inicio < 420000) {
    if (await page.$(".premio")) break;
    const s = await estado();
    if (!s.modo || !s.pecas.length) { await page.waitForTimeout(300); continue; }
    menor = Math.min(menor, ...s.tamanhos);
    const { certo, errado } = jogada(s);
    if (!certo) { await page.waitForTimeout(300); continue; }
    // Um pássaro na corda merece um toque.
    const passaro = await page.$(".est-passaro:not(.apanhado):not(.vai)");
    if (passaro) { await passaro.click().catch(() => {}); await page.waitForTimeout(400); }
    if (!errada && errado) {
      if (fotos === 0) { await page.screenshot({ path: `${OUT}/${nome}-0.png` }); fotos++; }
      // Uma jogada errada, para passar pelo caminho do erro; repetida até uma peça abanar.
      if (await page.$(".lida-abana")) { errada = true; await page.waitForTimeout(2500); continue; }
      await mover(...errado);
      await page.waitForTimeout(400);
      continue;
    }
    errada = true;
    const usadas = s.pecas.filter((p) => p.usada).length;
    if (fotos <= 1 && usadas >= 1) { await page.screenshot({ path: `${OUT}/${nome}-a.png` }); fotos = 2; }
    await mover(...certo);
    const d = await estado();
    if (d.pecas.filter((p) => p.usada).length === usadas) await page.waitForTimeout(600);
    if (fotos === 2 && !jogada(d).certo && d.modo) { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${nome}-b.png` }); fotos = 3; }
  }
  let premio = false;
  for (let i = 0; i < 40 && !premio; i++) { await page.waitForTimeout(500); premio = (await page.locator(".premio .acoes button").count()) > 0; }
  await page.screenshot({ path: `${OUT}/${nome}-premio.png` });
  const metrica = await page.evaluate(() => (JSON.parse(localStorage.getItem("mae.v1")).metricas || []).filter((m) => m.game === "estendal" && m.tipo === "ronda").at(-1));
  console.log(`nível ${nivel} ${w}x${h}: prémio ${premio}, peça mais pequena ${menor} px, ${Math.round((Date.now() - inicio) / 1000)} s, erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  console.log(`  registo: ${JSON.stringify(metrica)}`);
  if (!premio || erros.length || menor < 113 || !metrica || !(metrica.wrong_choices + metrica.order_errors)) falhou = true;
  await page.close();
}
await browser.close();
process.exit(falhou ? 1 : 0);
