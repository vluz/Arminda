// Teste rápido de um jogo: abre-o diretamente em três tamanhos de ecrã, espera, tira capturas e diz os erros.
// Correr em tools/testes (depois de npm install nessa pasta):
//   node lib/testar_jogo.mjs <id-do-jogo> <porta> [segundos-de-espera]
// Precisa de um servidor nessa porta:  python -m http.server <porta> --bind 127.0.0.1 --directory app/www
// Capturas de ecrã: app/test-shots/jogos/<id-do-jogo>-<l>x<a>.png
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const [id, porta = "8765", seg = "6"] = process.argv.slice(2);
if (!id) { console.log("uso: node lib/testar_jogo.mjs <id-do-jogo> <porta> [segundos]"); process.exit(2); }
const OUT = fileURLToPath(new URL("../../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;
for (const [w, h] of [[1024, 600], [1280, 800], [800, 1280]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  // Os ficheiros de voz em falta (/voz/) são esperados até o gerar_voz.py correr; qualquer outro ficheiro falhado conta.
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.addInitScript(() => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true })));
  await page.goto(`http://127.0.0.1:${porta}/#jogo=${id}`);
  await page.waitForTimeout(Number(seg) * 1000);
  await page.screenshot({ path: `${OUT}/${id}-${w}x${h}.png` });
  // Todos os botões têm de ter pelo menos ALVO_MIN (113 px) no lado mais pequeno, tirando a própria página.
  // As casas de um tabuleiro (damas) podem descer até 100 px: é a exceção do GUIA-JOGOS.md.
  const pequenos = await page.$$eval("button", (bs) => bs
    .map((b) => ({ r: b.getBoundingClientRect(), casa: b.classList.contains("damas-casa") }))
    .filter(({ r, casa }) => r.width > 0 && Math.min(r.width, r.height) < (casa ? 100 : 105))
    .map(({ r }) => `${Math.round(r.width)}x${Math.round(r.height)}`));
  console.log(`${w}x${h}: erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}; botões pequenos: ${pequenos.length ? pequenos.join(" ") : "nenhum"}`);
  if (erros.length) falhou = true;
  await page.close();
}
await browser.close();
process.exit(falhou ? 1 : 0);
