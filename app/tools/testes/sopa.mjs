// Jogada automática da Sopa de letras: resolve a grelha a partir do ecrã e marca todas as palavras,
// alternando um deslize de dedo aos ziguezagues com o modo de tocar na primeira e depois na última,
// até ao ecrã do prémio.
// Correr em tools/testes (depois de npm install nessa pasta):  node sopa.mjs <porta>
// Capturas de ecrã: app/test-shots/jogos/sopa-n<nível>-<l>x<a>.png (início) e -fim (tudo encontrado)
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8773";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1]];

async function pronto(page) {
  await page.waitForSelector(".sopa-grelha[data-pronto='1'], .premio", { timeout: 60000 });
}

async function jogar(nivel, w, h, { esperarPista = false } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("console", (m) => { // os 404 em /voz/ (voz ainda por fazer) e o servidor de envio de registos de media-teste/config.json (porta 8780, muitas vezes em baixo) não são erros do jogo.
    if (m.type() === "error" && !m.text().includes("404") && !m.text().includes("ERR_CONNECTION_REFUSED")) erros.push(m.text()); });
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.sopa": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=sopa`);
  // O servidor de teste local às vezes deixa cair um pedido e a página fica em branco: carregá-la mais uma vez.
  if (!(await page.waitForSelector(".ecra .corpo", { timeout: 20000 }).catch(() => null))) {
    console.log("  página em branco, a carregar outra vez");
    await page.reload();
  }
  const t0 = Date.now();
  try {
    await pronto(page);
  } catch {
    console.log(`nível ${nivel} ${w}x${h}: PRESO antes de a grelha estar pronta; erros: ${JSON.stringify(erros)}`);
    await page.screenshot({ path: `${OUT}/sopa-n${nivel}-${w}x${h}-preso.png` });
    falhou = true;
    await page.close();
    return;
  }
  await page.screenshot({ path: `${OUT}/sopa-n${nivel}-${w}x${h}.png` });

  const info = await page.evaluate(async (n) => {
    const { DADOS } = await import("/js/jogos/sopa.js");
    const cel = [...document.querySelectorAll(".sopa-letra")];
    const linhas = Math.max(...cel.map((c) => +c.dataset.r)) + 1;
    const colunas = Math.max(...cel.map((c) => +c.dataset.c)) + 1;
    const g = Array.from({ length: linhas }, (_, r) => cel.filter((c) => +c.dataset.r === r).map((c) => c.textContent));
    // A lista de palavras: nomes (níveis 1 a 8), só imagens (9), ou só o tema e a contagem (10).
    let palavras = [...document.querySelectorAll(".sopa-item span")].map((s) => s.textContent);
    let modo = "texto", total = palavras.length;
    if (document.querySelector(".sopa-fig")) {
      const porSrc = new Map(DADOS.PALAVRAS.map((p) => [p.src, p.texto]));
      palavras = [...document.querySelectorAll(".sopa-fig img")].map((i) => porSrc.get(i.getAttribute("src")));
      modo = "figuras"; total = palavras.length;
    } else if (document.querySelector(".sopa-tema")) {
      const nome = document.querySelector(".sopa-tema span").textContent;
      const tema = Object.keys(DADOS.TEMAS).find((k) => DADOS.TEMAS[k].nome === nome);
      palavras = DADOS.PALAVRAS.filter((p) => p.temas.includes(tema)).map((p) => p.texto);
      modo = "conta:" + tema; total = +document.querySelector(".sopa-conta").textContent.split("/")[1];
    }
    const lado = cel[0].getBoundingClientRect().width;
    const minimo = n >= 7 ? 72 : 100;
    const pequenos = [...document.querySelectorAll(".sopa-letra")].map((c) => c.getBoundingClientRect())
      .filter((r) => Math.min(r.width, r.height) < minimo).length;
    const lista = document.querySelector(".sopa-lista").getBoundingClientRect();
    const zona = document.querySelector(".sopa-grelha").getBoundingClientRect();
    const fora = zona.right > innerWidth + 1 || zona.bottom > innerHeight + 1 || lista.bottom > innerHeight + 1 ? "FORA DO ECRÃ" : "dentro";
    return { g, palavras, linhas, colunas, lado: Math.round(lado), pequenos, modo, total, fora };
  }, nivel);

  let pista = null;
  if (esperarPista) {
    await page.waitForSelector(".sopa-letra.pista", { timeout: 40000 }).then(() => { pista = "piscou"; }).catch(() => { pista = "SEM PISTA"; });
    await pronto(page);
  }

  // Encontra cada palavra na grelha, em qualquer direção.
  function achar(p) {
    const letras = [...p];
    for (let r = 0; r < info.linhas; r++) for (let c = 0; c < info.colunas; c++) {
      for (const [dr, dc] of DIRS) {
        let ok = true;
        for (let k = 0; k < letras.length && ok; k++) {
          const rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr >= info.linhas || cc < 0 || cc >= info.colunas || info.g[rr][cc] !== letras[k]) ok = false;
        }
        if (ok) return { r, c, r1: r + dr * (letras.length - 1), c1: c + dc * (letras.length - 1) };
      }
    }
    return null;
  }
  async function centro(r, c) {
    return page.evaluate(([r, c]) => {
      const b = document.querySelector(`.sopa-letra[data-r="${r}"][data-c="${c}"]`).getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }, [r, c]);
  }

  // Primeiro uma seleção errada: duas casas que não fazem uma palavra.
  let errada = false;
  {
    const a = await centro(0, 0);
    const b = await centro(info.linhas - 1, 0);
    const txt = info.g.map((l) => l[0]).join("");
    if (!info.palavras.includes(txt) && !info.palavras.includes([...txt].reverse().join(""))) {
      await page.mouse.click(a.x, a.y);
      await page.mouse.click(b.x, b.y);
      errada = true;
      await page.waitForTimeout(300);
      await pronto(page);
    }
  }

  let modos = { deslize: 0, toque: 0 };
  // Sem lista, só as palavras do tema que estão mesmo na grelha.
  if (info.modo.startsWith("conta")) info.palavras = info.palavras.filter((p) => achar(p));
  if (info.palavras.length !== info.total) { console.log("  esperadas", info.total, "palavras, veem-se", info.palavras.join(",")); falhou = true; }
  for (const [i, p] of info.palavras.entries()) {
    const s = achar(p);
    if (!s) { console.log("  palavra não encontrada na grelha:", p); falhou = true; continue; }
    const a = await centro(s.r, s.c);
    const b = await centro(s.r1, s.c1);
    if (i % 2 === 0) {
      // Deslizar com um ziguezague de um terço de casa para os lados da linha, acabando um pouco antes do fim.
      const nx = -(b.y - a.y), ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let k = 1; k <= 10; k++) {
        const t = k / 10;
        const wob = Math.sin(t * Math.PI * 2) * info.lado * 0.33;
        const enc = k === 10 ? 0.85 : 1;
        await page.mouse.move(a.x + (b.x - a.x) * t * enc + (nx / len) * wob, a.y + (b.y - a.y) * t * enc + (ny / len) * wob);
      }
      await page.mouse.up();
      modos.deslize++;
    } else {
      await page.mouse.click(a.x, a.y);
      await page.mouse.click(b.x, b.y);
      modos.toque++;
    }
    await page.waitForTimeout(300);
    await pronto(page);
    const feitas = await page.$$eval(".sopa-item.feita span, .sopa-vaga.feita", (x) => x.map((s) => s.textContent));
    const nFeitas = await page.$$eval(".sopa-item.feita, .sopa-fig.feita, .sopa-vaga.feita", (x) => x.length);
    if (!feitas.includes(p) && nFeitas < i + 1 && !(await page.$(".premio"))) console.log(`  falhou ${p} by ${i % 2 === 0 ? "slide" : "taps"} at`, JSON.stringify(s));
  }
  const achadas = await page.$$eval(".sopa-item.feita, .sopa-fig.feita, .sopa-vaga.feita", (x) => x.length);
  const sensacao = await page.evaluate(() => `barra ${document.querySelector(".sopa-enche").style.width}, série "${document.querySelector(".sopa-serie").textContent}"`);
  await page.screenshot({ path: `${OUT}/sopa-n${nivel}-${w}x${h}-fim.png` });
  let premio = false;
  try { await page.waitForSelector(".premio .acoes button", { timeout: 30000 }); premio = true; } catch { /* dito mais abaixo*/ }
  const metrica = await page.evaluate(() => (JSON.parse(localStorage.getItem("mae.v1")).metricas || []).filter((m) => m.game === "sopa" && m.tipo === "ronda").at(-1));
  console.log(`nível ${nivel} ${w}x${h}: grelha ${info.linhas}x${info.colunas} casa ${info.lado}px (abaixo de ${nivel >= 7 ? 72 : 100}: ${info.pequenos}); lista ${info.modo}; disposição ${info.fora}; palavras ${info.palavras.join(",")}; encontradas ${achadas}/${info.palavras.length} (ecrãs ${modos.deslize}, toques ${modos.toque}); errados ${errada ? 1 : 0}; pista ${pista ?? "-"}; prémio ${premio}; ${sensacao}; ${((Date.now() - t0) / 1000).toFixed(0)} s; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  console.log("  registo", JSON.stringify(metrica));
  if (!premio || erros.length || achadas !== info.palavras.length || info.pequenos || info.fora !== "dentro") falhou = true;
  await page.close();
}

await jogar(1, 1024, 600, { esperarPista: true });
for (const [w, h] of [[1024, 600], [1280, 800], [800, 1280]]) {
  for (const n of [2, 6, 8, 9, 10]) await jogar(n, w, h);
}
for (const n of [3, 4, 5, 7]) await jogar(n, 1024, 600);
console.log(falhou ? "FALHARAM" : "PASSARAM TODOS");
await browser.close();
process.exit(falhou ? 1 : 0);
