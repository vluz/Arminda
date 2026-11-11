// Jogada automática das Palavras: escreve todas as palavras tocando nas letras, com uma letra
// errada por ronda, até ao ecrã do prémio. Correr em tools/testes (depois de npm install nessa pasta):  node palavras.mjs <porta>
// Capturas de ecrã: app/test-shots/jogos/palavras-n<nível>-<l>x<a>.png
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8773";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

async function jogar(nivel, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("console", (m) => { // os 404 em /voz/ (voz ainda por fazer) e o servidor de envio de registos de media-teste/config.json (porta 8780, muitas vezes em baixo) não são erros do jogo.
    if (m.type() === "error" && !m.text().includes("404") && !m.text().includes("ERR_CONNECTION_REFUSED")) erros.push(m.text()); });
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.palavras": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=palavras`);
  // O servidor de teste local às vezes deixa cair um pedido e a página fica em branco: carregá-la mais uma vez.
  if (!(await page.waitForSelector(".ecra .corpo", { timeout: 20000 }).catch(() => null))) {
    console.log("  página em branco, a carregar outra vez");
    await page.reload();
  }
  const t0 = Date.now();
  const palavras = [];
  let foto = false;
  let pequenos = [];
  let tamanhos = "";
  let menorPeca = Infinity;
  let cortadas = 0;
  let erradas = 0;
  let premio = false;
  while (Date.now() - t0 < 300000) {
    try {
      await page.waitForSelector(".pal-pecas[data-pronto='1'], .premio .acoes button", { timeout: 60000 });
    } catch {
      console.log("  preso; erros:", JSON.stringify(erros));
      falhou = true;
      await page.screenshot({ path: `${OUT}/palavras-n${nivel}-${w}x${h}-preso.png` });
      break;
    }
    if (await page.$(".premio .acoes button")) { premio = true; break; }
    const alvo = await page.evaluate(() => {
      const c = document.querySelector(".pal-casa.proxima");
      return c ? c.dataset.letra : null;
    });
    if (!alvo) { await page.waitForTimeout(200); continue; }
    if (!foto) {
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/palavras-n${nivel}-${w}x${h}.png` });
      foto = true;
      // As letras podem ter 90 px a partir do nível 7 (a pedido da família); todos os outros botões 105 ou mais.
      const medida = await page.evaluate((n) => {
        const minPeca = n >= 7 ? 90 : 105;
        const bs = [...document.querySelectorAll("button")].map((b) => ({ r: b.getBoundingClientRect(), peca: b.classList.contains("pal-peca") }))
          .filter((x) => x.r.width > 0);
        const pequenos = bs.filter((x) => Math.min(x.r.width, x.r.height) < (x.peca ? minPeca : 105))
          .map((x) => `${Math.round(x.r.width)}x${Math.round(x.r.height)}`);
        const pecas = bs.filter((x) => x.peca);
        const zona = document.querySelector(".pal-pecas").getBoundingClientRect();
        const casas = document.querySelector(".pal-casas");
        const cortada = pecas.some((x) => x.r.bottom > zona.bottom + 1 || x.r.right > zona.right + 1)
          || casas.scrollWidth > casas.clientWidth + 1
          || [...document.querySelectorAll(".pal-casa")].some((c) => c.getBoundingClientRect().bottom > innerHeight);
        const casa = document.querySelector(".pal-casa").getBoundingClientRect().width;
        return { pequenos, tiles: pecas.length, peca: Math.round(Math.min(...pecas.map((x) => x.r.width))), casa: Math.round(casa), cortada,
          ouvir: !!document.querySelector(".pal-ouvir") };
      }, nivel);
      pequenos = medida.pequenos;
      tamanhos = `letras ${medida.tiles} a ${medida.peca}px, lugares ${medida.casa}px${medida.ouvir ? ", botão de ouvir" : ""}${medida.cortada ? ", CORTADA" : ""}`;
      if (medida.cortada) falhou = true;
      if (medida.ouvir) { await page.click(".pal-ouvir"); await page.waitForTimeout(300); }
      // Primeiro uma letra errada, para experimentar o saltinho.
      const errada = await page.$(`.pal-peca:not(.usada):not([data-letra="${alvo}"])`);
      if (errada) { await errada.click(); erradas++; }
    }
    const casas = await page.$$eval(".pal-grupo", (gs) => gs.map((g) => [...g.children].map((c) => c.dataset.letra).join("")).join("_"));
    if (!palavras.includes(casas)) {
      palavras.push(casas);
      // Todas as palavras, não só a primeira: a letra mais pequena, e se alguma coisa fica cortada.
      const m = await page.evaluate(() => {
        const z = document.querySelector(".pal-pecas").getBoundingClientRect();
        const ps = [...document.querySelectorAll(".pal-peca")].map((b) => b.getBoundingClientRect());
        return { min: Math.round(Math.min(...ps.map((r) => r.width))), fora: ps.some((r) => r.bottom > z.bottom + 1 || r.right > z.right + 1) };
      });
      menorPeca = Math.min(menorPeca, m.min);
      if (m.fora) { cortadas++; falhou = true; }
    }
    const b = await page.$(`.pal-peca:not(.usada)[data-letra="${alvo}"]`);
    if (!b) { console.log("  não há letra para", alvo); falhou = true; break; }
    await b.click();
    await page.waitForTimeout(120);
  }
  const sensacao = await page.evaluate(() => {
    const b = document.querySelector(".pal-enche");
    return b ? `barra ${b.style.width}, série "${document.querySelector(".pal-serie").textContent}"` : "sem barra";
  });
  const metrica = await page.evaluate(() => (JSON.parse(localStorage.getItem("mae.v1")).metricas || []).filter((m) => m.game === "palavras" && m.tipo === "ronda").at(-1));
  console.log(`nível ${nivel} ${w}x${h}: palavras ${palavras.join(" ")}; errados ${erradas}; prémio ${premio}; ${sensacao}; ${((Date.now() - t0) / 1000).toFixed(0)} s; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}; ${tamanhos}; botões pequenos em jogo ${pequenos.length ? pequenos.join(" ") : "nenhum"}; letra mais pequena da ronda ${menorPeca}px${cortadas ? `, ${cortadas} palavras com letras cortadas` : ""}`);
  if (menorPeca < (nivel >= 7 ? 90 : 105)) falhou = true;
  console.log("  registo", JSON.stringify(metrica));
  if (!premio || erros.length || pequenos.length) falhou = true;
  await page.close();
}

for (const [w, h] of [[1024, 600], [1280, 800], [800, 1280]]) {
  for (const n of [1, 7, 9, 10, 11, 12]) await jogar(n, w, h);
}
for (const n of [2, 3, 4, 5, 6, 8]) await jogar(n, 1024, 600);
await browser.close();
console.log(falhou ? "FALHARAM" : "PASSARAM TODOS");
process.exit(falhou ? 1 : 0);
