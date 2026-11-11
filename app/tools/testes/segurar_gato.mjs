// Segurar o gato no ecrã inicial abre o ecrã da família ao fim de SEGURAR_GATO_MS (15 s), não antes,
// e um toque curto não faz nada. Correr em tools/testes:  node segurar_gato.mjs <porta>
import { chromium } from "playwright";

const porta = process.argv[2] || "8765";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 600 }, hasTouch: true });
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));
await page.addInitScript(() => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true })));
await page.goto(`http://127.0.0.1:${porta}/`);
await page.waitForSelector(".mosaico", { timeout: 15000 });
const caixa = await page.locator(".mascote").first().boundingBox();
const x = caixa.x + caixa.width / 2;
const y = caixa.y + caixa.height / 2;
const aberta = () => page.locator(".familia").count();

await page.mouse.move(x, y);
await page.mouse.down();
await page.waitForTimeout(3000);
await page.mouse.up();
await page.waitForTimeout(500);
const curto = await aberta();

await page.mouse.down();
await page.waitForTimeout(13000);
const antes = await aberta();
await page.waitForTimeout(3000);
const depois = await aberta();
await page.mouse.up();
await page.waitForTimeout(600);
const ficou = await aberta();
await browser.close();

const ok = curto === 0 && antes === 0 && depois === 1 && ficou === 1 && !erros.length;
console.log(`o toque curto abre ${curto}; aos 13 s aberto ${antes}; aos 16 s aberto ${depois}; ainda aberto depois de levantar ${ficou}; ` +
  `erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
console.log(ok ? "prémio true (segurar o gato: bem)" : "FALHOU");
process.exit(ok ? 0 : 1);
