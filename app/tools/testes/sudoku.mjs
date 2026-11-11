// Joga rondas inteiras de Sudoku até ao ecrã do prémio, em níveis baixos e altos.
// Lê o tabuleiro, resolve-o, e toca na casa e depois na imagem (e na imagem e depois na casa), com
// uns quantos símbolos postos errados de propósito, para experimentar o abanão e a pista.
// Correr em tools/testes (depois de npm install nessa pasta):  node sudoku.mjs <porta>
// Os ficheiros de voz em falta (voz/...) são esperados até a voz ser feita, e não contam.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8786";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

// Resolvedor simples por retrocesso, para uso do próprio teste.
function resolver(g, n) {
  const [br, bc] = n === 4 ? [2, 2] : [2, 3];
  const pode = (i, v) => {
    const r = Math.floor(i / n);
    const c = i % n;
    for (let k = 0; k < n; k++) if (g[r * n + k] === v || g[k * n + c] === v) return false;
    const r0 = r - (r % br);
    const c0 = c - (c % bc);
    for (let a = r0; a < r0 + br; a++) for (let b = c0; b < c0 + bc; b++) if (g[a * n + b] === v) return false;
    return true;
  };
  const i = g.indexOf(0);
  if (i < 0) return true;
  for (let v = 1; v <= n; v++) {
    if (!pode(i, v)) continue;
    g[i] = v;
    if (resolver(g, n)) return true;
    g[i] = 0;
  }
  return false;
}

async function jogar(nivel, w, h, erradas) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("pageerror", (x) => erros.push(String(x)));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.sudoku": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=sudoku`);
  const t0 = Date.now();
  let info = "";
  let foto = false;
  let toques = 0;
  let porFazer = erradas;
  let modo = 0;
  while (Date.now() - t0 < 300000) {
    if (await page.$(".premio")) break;
    const est = await page.evaluate(() => {
      const chave = (b) => b.querySelector("img")?.getAttribute("src") || b.querySelector(".sdk-num")?.textContent || "";
      const casas = [...document.querySelectorAll(".sdk-casa")];
      const paleta = [...document.querySelectorAll(".sdk-escolha")].map(chave);
      // O tabuleiro cresce ao chegar: medir (e jogar) só depois de essa animação acabar.
      const tab = document.querySelector(".sdk-tab");
      if (tab && tab.getAnimations().some((a) => a.playState === "running")) return { casas: [] };
      return {
        casas: casas.map((b) => (b.classList.contains("errada") ? "?" : chave(b))),
        paleta,
        lado: casas[0]?.getBoundingClientRect().width || 0,
        ladoPaleta: document.querySelector(".sdk-escolha")?.getBoundingClientRect().height || 0,
        completo: !!document.querySelector(".sdk-tab.completo"),
        pista: casas.findIndex((b) => b.classList.contains("pista")),
      };
    });
    if (!est.casas.length || est.completo || est.casas.includes("?")) { await page.waitForTimeout(400); continue; }
    const n = Math.round(Math.sqrt(est.casas.length));
    if (!info) info = `tabuleiro ${n}x${n}, casa ${Math.round(est.lado)} px, paleta ${Math.round(est.ladoPaleta)} px`;
    const g = est.casas.map((k) => (k ? est.paleta.indexOf(k) + 1 : 0));
    const sol = g.slice();
    if (!resolver(sol, n)) { erros.push("o teste não conseguiu resolver o tabuleiro"); break; }
    const vazias = g.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    if (!vazias.length) { await page.waitForTimeout(400); continue; }
    if (!foto && vazias.length < est.casas.length / 3) {
      foto = true;
      await page.screenshot({ path: `${OUT}/sudoku-jogo-n${nivel}-${w}x${h}.png` });
    }
    const i = est.pista >= 0 ? est.pista : vazias[0];
    let v = sol[i];
    if (porFazer > 0) { v = (v % n) + 1; porFazer--; }
    // Alternar as duas maneiras de jogar: casa e depois imagem, e imagem e depois casa.
    const errado = v !== sol[i];
    if (modo % 2 === 0) {
      await page.click(`.sdk-casa >> nth=${i}`, { force: true });
      await page.click(`.sdk-escolha >> nth=${v - 1}`, { force: true });
      await page.waitForTimeout(errado ? 1300 : 300);
    } else {
      await page.click(`.sdk-escolha >> nth=${v - 1}`, { force: true });
      await page.click(`.sdk-casa >> nth=${i}`, { force: true });
      await page.waitForTimeout(errado ? 1300 : 300);
      // Largar a imagem escolhida, para o toque seguinte numa casa escolher em vez de pôr.
      if (await page.$(".sdk-escolha.escolhida")) await page.click(".sdk-escolha.escolhida", { force: true });
    }
    modo++;
    toques++;
  }
  await page.waitForTimeout(3000);
  const premio = !!(await page.$(".premio"));
  await page.screenshot({ path: `${OUT}/sudoku-premio-n${nivel}-${w}x${h}.png` });
  const ultima = await page.evaluate(() => JSON.parse(localStorage.getItem("mae.v1")).metricas?.filter((m) => m.game === "sudoku" && m.tipo === "ronda").at(-1));
  console.log(`nível ${nivel} ${w}x${h}: ${info}; prémio ${premio}; símbolos postos ${toques}; ${Math.round((Date.now() - t0) / 1000)} s; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  console.log(`  registo: ${JSON.stringify(ultima)}`);
  if (!premio || erros.length) falhou = true;
  await page.close();
}

await jogar(1, 1024, 600, 3);
await jogar(5, 800, 1280, 1);
await jogar(11, 1024, 600, 4);
await jogar(9, 1280, 800, 0);
await browser.close();
process.exit(falhou ? 1 : 0);
