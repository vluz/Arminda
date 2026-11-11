// Jogada automática da Paciência: joga distribuições inteiras num nível baixo e num alto até ao
// ecrã do prémio, tocando como a pessoa tocaria: primeiro o sítio da pista, depois o descarte e as
// colunas, depois o monte.
// Correr em tools/testes (depois de npm install nessa pasta):  node paciencia.mjs [porta]
// Precisa de um servidor:  python -m http.server <porta> --bind 127.0.0.1 --directory app/www
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8771";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

const estado = (page) => page.evaluate(() => [...document.querySelectorAll(".pac-coluna, .pac-fundacoes, .pac-topo")]
  .map((x) => [...x.querySelectorAll("[data-carta], .cj-verso, .pac-conta")].map((c) => c.dataset.carta || c.textContent || "v").join(",")).join("|"));

for (const [nivel, w, h] of [[1, 1024, 600], [6, 1024, 600], [3, 800, 1280], [5, 1280, 800]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
  // Os ficheiros de voz não existem até a voz ser feita; qualquer outro ficheiro em falta é um erro.
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.addInitScript((n) => {
    localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.paciencia": n }));
    const st = window.setTimeout;
    window.setTimeout = (f, ms, ...a) => st(f, (ms || 0) / 8, ...a);
  }, nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=paciencia`);
  await page.waitForFunction(() => /Põe as cartas/.test(document.querySelector(".balao")?.textContent || ""), null, { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/paciencia-inicio-n${nivel}-${w}x${h}.png` });

  const t0 = Date.now();
  const tentados = new Set();
  let toques = 0;
  let pistasSeguidas = 0;
  let menor = Infinity;
  let foto = false;
  let fim = false;
  while (Date.now() - t0 < 400000) {
    if (await page.$(".premio")) { fim = true; break; }
    // O tamanho da disposição, não a caixa no ecrã, para uma carta a crescer ao entrar não contar como pequena.
    menor = Math.min(menor, await page.$$eval(".pac-coluna, .pac-topo button",
      // Só os elementos ainda no ecrã: o acabar automático desenha de novo a cada 260 ms, e os que saíram medem 0.
      (bs) => Math.min(...bs.filter((b) => b.isConnected).map((b) => Math.min(b.offsetWidth, b.offsetHeight)))));
    const s = await estado(page);
    const pista = await page.$(".pac-pista, .pac-topo .cj-boa");
    let alvo = null;
    if (pista) {
      alvo = pista;
      pistasSeguidas++;
    } else {
      const colunas = await page.$$(".pac-coluna");
      const resto = await page.$(".pac-topo button:not([aria-label='Monte'])");
      const cands = [["resto", resto], ...colunas.map((c, i) => [`c${i}`, c])].filter(([, x]) => x);
      for (const [nome, x] of cands) {
        if (!tentados.has(`${s}#${nome}`)) { tentados.add(`${s}#${nome}`); alvo = x; break; }
      }
      if (!alvo) alvo = await page.$(".pac-topo button[aria-label='Monte']");
    }
    if (alvo) {
      await alvo.click({ force: true, timeout: 2000 }).catch(() => {});
      toques++;
    }
    await page.waitForTimeout(120);
    if (!foto && toques > 25) {
      foto = true;
      await page.screenshot({ path: `${OUT}/paciencia-jogo-n${nivel}-${w}x${h}.png` });
    }
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/paciencia-premio-n${nivel}-${w}x${h}.png` });
  const reg = await page.evaluate(() => JSON.parse(localStorage.getItem("mae.v1")).metricas?.filter((m) => m.game === "paciencia" && m.tipo === "ronda").at(-1));
  console.log(`nível ${nivel} ${w}x${h}: ${fim ? "prémio alcançado" : "SEM PRÉMIO"} em ${Math.round((Date.now() - t0) / 1000)} s; toques ${toques}; ` +
    `cartas ${reg?.cards} colunas ${reg?.columns} jogadas ${reg?.moves} errados ${reg?.wrong_taps} pistas ${reg?.hints_needed} ajudas ${reg?.rescues} provado ${reg?.deal_proven}; ` +
    `alvo mais pequeno ${Math.round(menor)} px; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  if (!fim || erros.length || menor < 113) falhou = true;
  await page.close();
}
await browser.close();
process.exit(falhou ? 1 : 0);
