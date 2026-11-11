// Jogada automática do Aquário: dar de comer aos peixes, rebentar uma bolha, avançar quatro minutos, receber o azulejo.
// Correr em tools/testes (depois de npm install nessa pasta):  node aquario.mjs <porta>
// Precisa de um servidor:  python -m http.server <porta> --bind 127.0.0.1 --directory app/www
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8775";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

for (const [w, h] of [[1024, 600], [1280, 800], [800, 1280]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  const vozEmFalta = new Set();
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = m.location()?.url || "";
    if (url.includes("/voz/")) vozEmFalta.add(url); else erros.push(m.text() + " " + url);
  });
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.clock.install();
  await page.addInitScript(() => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true })));
  await page.goto(`http://127.0.0.1:${porta}/#jogo=aquario`);
  await page.waitForTimeout(2500);
  const caixa = await page.locator(".aquario").boundingBox();
  const tocar = (fx, fy) => page.mouse.click(caixa.x + caixa.width * fx, caixa.y + caixa.height * fy);

  await tocar(0.3, 0.3);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/aquario-play-onda-${w}x${h}.png` });
  await page.waitForTimeout(4200);
  const comidos1 = await page.locator(".aquario .comida").count();
  await tocar(0.7, 0.4);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/aquario-play-comer-${w}x${h}.png` });

  // Avançar até à primeira visita: uma bolha ou o cavalo-marinho.
  await page.clock.fastForward(13000);
  await page.waitForTimeout(3000);
  const visitante = page.locator(".aquario .bolha, .aquario .cavalo").first();
  let tocouVisitante = false;
  if (await visitante.count()) {
    await page.screenshot({ path: `${OUT}/aquario-play-visita-${w}x${h}.png` });
    const b = await visitante.boundingBox();
    if (b && b.y + b.height > caixa.y && b.y < caixa.y + caixa.height) {
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      tocouVisitante = true;
    }
  }
  await page.locator(".aquario .caranguejo").click();

  // Quatro minutos depois a pessoa ainda lá está: vem o azulejo.
  await page.clock.fastForward(4 * 60 * 1000);
  await tocar(0.5, 0.5);
  let premio = false;
  for (let i = 0; i < 30 && !premio; i++) {
    await page.waitForTimeout(1000);
    premio = (await page.locator(".premio .acoes button").count()) > 0;
  }
  await page.screenshot({ path: `${OUT}/aquario-play-premio-${w}x${h}.png` });
  if (premio) await page.locator(".premio >> text=Início").click();
  await page.waitForTimeout(1500);
  const registo = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("mae.v1"));
    return (d.metricas || []).filter((m) => m.tipo === "ronda" && m.game === "aquario").at(-1);
  });
  const pequenos = await page.$$eval(".aquario button", (bs) => bs.map((b) => b.getBoundingClientRect())
    .filter((r) => r.width > 0 && Math.min(r.width, r.height) < 105).length);
  const ok = premio && registo && registo.reward_given && registo.fish_fed > 0 && !erros.length;
  if (!ok) falhou = true;
  console.log(`${w}x${h}: prémio ${premio}; bolinhas que sobraram da primeira comida ${comidos1}; visita tocada ${tocouVisitante}; ` +
    `registo ${JSON.stringify(registo)}; botões pequenos: ${pequenos}; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}; ` +
    `ficheiros de voz em falta ${vozEmFalta.size}`);
  await page.close();
}
await browser.close();
process.exit(falhou ? 1 : 0);
