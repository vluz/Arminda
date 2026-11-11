// Capturas de ecrã para o README do kit: o ecrã inicial, um ecrã da introdução, o ecrã dos jogos e
// alguns jogos acabados de abrir, a 1024x600 (o tablet de referência). Não aparece nenhum conteúdo da família.
// Correr em tools/testes:  node lib/capturas_kit.mjs <porta> <pasta de saída>
import { chromium } from "playwright";
import fs from "node:fs";

const porta = process.argv[2] || "8765";
const OUT = process.argv[3] || "capturas";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

// Cada captura tem uma página nova, com o estado guardado posto antes de a app carregar (a app
// reescreve o estado inteiro em cada gravação, por isso pô-lo depois de carregar perde-se).
async function pagina(estado) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 600 }, hasTouch: true, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log("erro da página:", String(e)));
  await page.addInitScript((s) => localStorage.setItem("mae.v1", JSON.stringify(s)), estado);
  return page;
}
const shot = async (page, nome) => { await page.screenshot({ path: `${OUT}/${nome}.png` }); console.log("saved", nome); };

let page = await pagina({});
await page.goto(`http://127.0.0.1:${porta}/`);
await page.waitForTimeout(2500);
await shot(page, "01-inicio");
await page.click("button.cor-verde");
await page.waitForTimeout(2500);
await shot(page, "02-introducao");
await page.close();

const visto = { "intro.vista": 99, "migracao.niveis2": true };
page = await pagina(visto);
await page.goto(`http://127.0.0.1:${porta}/`);
await page.waitForTimeout(3000);
await shot(page, "03-jogos");
await page.close();

const jogos = [["pares", 2], ["loto", 3], ["jardim", 3], ["aquario", 1], ["feira", 3], ["sopa", 3], ["domino", 2], ["cozinha", 2], ["sequencia", 2], ["puzzle", 2], ["damas", 2], ["galo", 2]];
for (const [id, nivel] of jogos) {
  page = await pagina({ ...visto, [`nivel.${id}`]: nivel });
  await page.goto(`http://127.0.0.1:${porta}/#jogo=${id}`);
  await page.waitForTimeout(6000);
  await shot(page, `jogo-${id}`);
  await page.close();
}
await browser.close();
