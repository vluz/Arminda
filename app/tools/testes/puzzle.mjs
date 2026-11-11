// Jogada automática do Puzzle: resolve rondas em níveis baixos e altos, com as cenas que vêm com o jogo e com fotografias.
// Correr em tools/testes (depois de npm install nessa pasta):  node puzzle.mjs <porta>
// Precisa de um servidor:  python -m http.server <porta> --bind 127.0.0.1 --directory app/www
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8775";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

// [largura, altura, nível, fotografias?]
const CASOS = [
  [1024, 600, 1, false], [1024, 600, 4, false], [1024, 600, 6, false], [1024, 600, 3, true],
  [1024, 600, 8, false], [1024, 600, 11, true], [1024, 600, 12, false],
  [1280, 800, 12, false], [800, 1280, 4, false], [800, 1280, 12, true],
];

for (const [w, h, nivel, fotos] of CASOS) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = m.location()?.url || "";
    if (!url.includes("/voz/")) erros.push(m.text() + " " + url);
  });
  page.on("pageerror", (e) => erros.push(String(e)));
  if (!fotos) await page.route("**/media-teste/manifest.json", (r) => r.fulfill({ json: { fotos: [] } }));
  await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({
    "intro.vista": 99, "migracao.niveis2": true, "nivel.puzzle": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=puzzle`);
  await page.waitForTimeout(3500);
  const nome = `puzzle-play-n${nivel}${fotos ? "-foto" : ""}-${w}x${h}`;
  await page.screenshot({ path: `${OUT}/${nome}-inicio.png` });

  const pecas = page.locator(".peca");
  const total = await pecas.count();
  const tam = await pecas.first().boundingBox();
  const passo = tam.width + 3;
  const slotDe = async () => {
    const tab = await page.locator(".tabuleiro").boundingBox();
    const cols = Math.round((tab.width - 2 * 4 + 3) / passo) || 1;
    const rects = await page.$$eval(".peca", (bs) => bs.map((b) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(b).transform);
      return [m.m41, m.m42];
    }));
    return rects.map(([x, y]) => Math.round(y / passo) * cols + Math.round(x / passo));
  };
  const toque = async (i) => { await pecas.nth(i).click(); await page.waitForTimeout(250); };

  // Primeiro uma troca inútil nos níveis mais altos: duas peças que ficam as duas fora do sítio.
  if (nivel >= 4) {
    const s = await slotDe();
    const a = s.findIndex((v, i) => v !== i);
    const b = s.findIndex((v, i) => i !== a && v !== i && s[a] !== i && v !== a);
    if (a >= 0 && b >= 0) { await toque(a); await toque(b); await page.waitForTimeout(1800); }
    await page.screenshot({ path: `${OUT}/${nome}-escolha.png` });
  }
  let trocas = 0;
  for (let guarda = 0; guarda < 80; guarda++) {
    const s = await slotDe();
    const p = s.findIndex((v, i) => v !== i);
    if (p < 0) break;
    const ocupante = s.indexOf(p);
    await toque(p);
    if (trocas === 3) await page.screenshot({ path: `${OUT}/${nome}-meio.png` });
    await toque(ocupante);
    trocas++;
    await page.waitForTimeout(2600);
  }
  // Peças rodadas já no sítio: tocar em cada uma até ficar direita.
  const tortas = await page.locator(".peca.torta").count();
  if (tortas) await page.screenshot({ path: `${OUT}/${nome}-torta.png` });
  let rodadelas = 0;
  for (let guarda = 0; guarda < 200; guarda++) {
    const t = page.locator(".peca.torta");
    if (!(await t.count())) break;
    await t.first().click(); rodadelas++;
    await page.waitForTimeout(700);
  }
  let premio = false;
  for (let i = 0; i < 20 && !premio; i++) {
    await page.waitForTimeout(800);
    premio = (await page.locator(".premio .acoes button").count()) > 0;
  }
  await page.screenshot({ path: `${OUT}/${nome}-premio.png` });
  if (premio) await page.locator(".premio >> text=Início").click();
  await page.waitForTimeout(1200);
  const registo = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("mae.v1"));
    return (d.metricas || []).filter((m) => m.tipo === "ronda" && m.game === "puzzle").at(-1);
  });
  const minimo = nivel >= 7 ? 80 : 113;
  const ok = premio && registo && registo.completed && !erros.length && tam.width >= minimo && (nivel < 12 || (registo.turned_pieces > 0 && registo.turns > 0));
  if (!ok) falhou = true;
  console.log(`${w}x${h} nível ${nivel}${fotos ? " fotografias" : ""}: peças ${total} of ${Math.round(tam.width)} px (mín. ${minimo}); trocas ${trocas}; rodadas no sítio ${tortas}, toques de rodar ${rodadelas}; ` +
    `prémio ${premio}; registo ${JSON.stringify(registo && { level: registo.level, shown: registo.level_shown, swaps: registo.swaps, useless: registo.useless_swaps, hints: registo.hints_needed, photo: registo.photo, preview: registo.preview, turned: registo.turned_pieces, turns: registo.turns })}; ` +
    `erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  await page.close();
}
await browser.close();
process.exit(falhou ? 1 : 0);
