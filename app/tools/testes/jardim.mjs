// Jogada automática do Jardim nos níveis 3 a 5: ouve os pedidos do gato, tira as pragas, arrasta o
// regador até às flores pedidas (primeiro um vaso errado), apanha uma flor, recebe o prémio.
// Correr em tools/testes (depois de npm install nessa pasta):  node jardim.mjs <porta> [nível ...]
// Precisa de um servidor:  python -m http.server <porta> --bind 127.0.0.1 --directory app/www
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const [porta = "8775", ...pedidos] = process.argv.slice(2);
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

const CASOS = pedidos.length
  ? pedidos.map((n) => [1024, 600, Number(n)])
  : [[1024, 600, 3], [1024, 600, 4], [1024, 600, 5], [1280, 800, 5], [800, 1280, 5]];
const NOMES = { rosa: "rosa", malmequer: "malmequer", girassol: "girassol", "túlipa": "tulipa", margarida: "margarida", cravo: "cravo" };
const FLORES = ["rosa", "malmequer", "girassol", "tulipa", "margarida", "cravo"];

for (const [w, h, nivel] of CASOS) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = m.location()?.url || "";
    if (!url.includes("/voz/")) erros.push(m.text() + " " + url);
  });
  page.on("pageerror", (e) => erros.push(String(e)));
  // Todos os vasos a uma rega de dar flor, para uma ronda chegar depressa ao cesto.
  const vasos = FLORES.slice(0, 5).map((flor) => ({ flor, fase: 2 }));
  await page.addInitScript(([n, vasos]) => {
    localStorage.setItem("mae.v1", JSON.stringify({
      "intro.vista": 99, "migracao.niveis2": true, "nivel.jardim": n,
      jardim: { vasos, colhidas: 0 }, "jardim.desdeAzulejo": 4,
    }));
    // Só para o teste: guardar todas as frases que o gato mostra, por ordem.
    window.__falas = [];
    setInterval(() => {
      const t = document.querySelector(".balao")?.textContent || "";
      if (t && t !== window.__falas.at(-1)) window.__falas.push(t);
    }, 80);
  }, [nivel, vasos]);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=jardim`);
  const nome = `jardim-play-n${nivel}-${w}x${h}`;

  const falas = () => page.evaluate(() => window.__falas);
  const pedidoAtual = async () => {
    const f = await falas();
    const k = f.findLastIndex((t) => t.startsWith("Rega "));
    if (k < 0) return [];
    return f.slice(k, k + 3).filter((t) => /^(Rega |E depois)/.test(t))
      .map((t) => Object.entries(NOMES).find(([pt]) => t.toLowerCase().includes(pt))?.[1]).filter(Boolean);
  };
  const regar = async (flor) => {
    const can = await page.locator(".regador").boundingBox();
    const pote = await page.locator(`.vaso-flor[data-flor="${flor}"]`).first().boundingBox();
    await page.mouse.move(can.x + can.width / 2, can.y + can.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(can.x + can.width / 2 + ((pote.x + pote.width / 2) - (can.x + can.width / 2)) * i / 12,
        can.y + can.height / 2 + ((pote.y + pote.height / 2) - (can.y + can.height / 2)) * i / 12);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
  };

  let pedido = [];
  for (let i = 0; i < 40 && !pedido.length; i++) { await page.waitForTimeout(500); pedido = await pedidoAtual(); }
  await page.waitForTimeout(2500);
  pedido = await pedidoAtual();
  await page.screenshot({ path: `${OUT}/${nome}-pedido.png` });

  // Primeiro um vaso errado.
  const errada = FLORES.slice(0, 5).find((f) => !pedido.includes(f));
  await regar(errada);
  await page.waitForTimeout(4500);
  const disseEssaNao = (await falas()).some((t) => t.startsWith("Essa não"));

  let pragas = 0;
  for (const flor of pedido) {
    const pote = page.locator(`.vaso-flor[data-flor="${flor}"]`).first();
    if (await pote.locator(".praga").count()) {
      pragas++;
      await page.screenshot({ path: `${OUT}/${nome}-praga.png` });
      await pote.click();
      await page.waitForTimeout(2500);
    }
    await regar(flor);
    await page.waitForTimeout(6000);
  }
  await page.screenshot({ path: `${OUT}/${nome}-flores.png` });
  await page.locator(".vaso-flor.fase-3").first().click();
  let premio = false;
  for (let i = 0; i < 20 && !premio; i++) {
    await page.waitForTimeout(800);
    premio = (await page.locator(".premio .acoes button").count()) > 0;
  }
  await page.screenshot({ path: `${OUT}/${nome}-premio.png` });
  if (premio) await page.locator(".premio >> text=Início").click();
  await page.waitForTimeout(1500);
  const registo = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("mae.v1"));
    return (d.metricas || []).filter((m) => m.tipo === "ronda" && m.game === "jardim").at(-1);
  });
  const ok = premio && disseEssaNao && registo && registo.requests_right === pedido.length && !erros.length;
  if (!ok) falhou = true;
  console.log(`${w}x${h} nível ${nivel}: pedidos ${JSON.stringify(pedido)}; vaso errado respondido ${disseEssaNao}; pragas tiradas ${pragas}; ` +
    `prémio ${premio}; registo ${JSON.stringify(registo && { level: registo.level, requests: registo.requests, right: registo.requests_right, wrong: registo.requests_wrong, pests: registo.pests_shown, removed: registo.pests_removed })}; ` +
    `erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  await page.close();
}
await browser.close();
process.exit(falhou ? 1 : 0);
