// Joga rondas inteiras do Labirinto até ao ecrã do prémio, em níveis baixos e altos, arrastando o
// gato pelo caminho da solução com eventos de ponteiro. Lê as paredes do labirinto no traçado SVG
// desenhado, encontra o caminho com uma procura em largura, apanha as estrelas e depois os objetivos.
// Também toca longe do gato e empurra uma vez contra uma parede, o que não pode dar erro nenhum.
// Correr em tools/testes (depois de npm install nessa pasta):  node labirinto.mjs <porta>
// Os ficheiros de voz em falta (voz/...) são esperados até a voz ser feita, e não contam.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8786";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

// Paredes a partir do traçado SVG: "M{x} {y}V{y2}" é uma parede à esquerda da casa x, "M{x} {y}H{x2}" por cima da linha y.
function lerParedes(d, C, R) {
  const vert = new Set();
  const hor = new Set();
  for (const m of d.matchAll(/M(\d+) (\d+)([VH])(\d+)/g)) {
    const x = +m[1];
    const y = +m[2];
    if (m[3] === "V") vert.add(`${x},${y}`);
    else hor.add(`${x},${y}`);
  }
  // O gato pode ir de (c, r) um passo de (dc, dr)?
  return (c, r, dc, dr) => {
    const cc = c + dc;
    const rr = r + dr;
    if (cc < 0 || cc >= C || rr < 0 || rr >= R) return false;
    if (dc === 1) return !vert.has(`${c + 1},${r}`);
    if (dc === -1) return !vert.has(`${c},${r}`);
    if (dr === 1) return !hor.has(`${c},${r + 1}`);
    return !hor.has(`${c},${r}`);
  };
}

function rota(pode, C, R, de, ate) {
  const pai = new Map([[de, -1]]);
  const fila = [de];
  while (fila.length) {
    const i = fila.shift();
    if (i === ate) break;
    const c = i % C;
    const r = Math.floor(i / C);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (r + dr) * C + (c + dc);
      if (pode(c, r, dc, dr) && !pai.has(j)) { pai.set(j, i); fila.push(j); }
    }
  }
  const lista = [];
  for (let i = ate; i !== -1 && i !== undefined; i = pai.get(i)) lista.unshift(i);
  return lista;
}

async function jogar(nivel, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("pageerror", (x) => erros.push(String(x)));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.labirinto": n })), nivel);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=labirinto`);
  const t0 = Date.now();
  let info = "";
  let foto = false;
  let testouExtras = false;
  let labirintos = 0;
  while (Date.now() - t0 < 300000) {
    if (await page.$(".premio")) break;
    const est = await page.evaluate(() => {
      const area = document.querySelector(".lab-area");
      if (!area || area.querySelector(".lab-bola.chegou")) return null;
      // Esperar pela animação de entrada do labirinto, que lhe muda o tamanho.
      if (area.getAnimations().some((a) => a.playState === "running")) return null;
      const cel = parseFloat(area.style.getPropertyValue("--cel"));
      const caixa = area.getBoundingClientRect();
      const C = Math.round(caixa.width / cel);
      const R = Math.round(caixa.height / cel);
      const bola = area.querySelector(".lab-bola");
      const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(bola.style.transform);
      const tam = parseFloat(bola.style.width);
      const bx = Math.round((+m[1] + tam / 2) / cel - 0.5);
      const by = Math.round((+m[2] + tam / 2) / cel - 0.5);
      const itens = [...area.querySelectorAll(".lab-item:not(.apanhado)")].map((x) => ({
        estrela: x.classList.contains("lab-estrela"),
        i: Math.round((parseFloat(x.style.top) + parseFloat(x.style.height) / 2) / cel - 0.5) * C
          + Math.round((parseFloat(x.style.left) + parseFloat(x.style.width) / 2) / cel - 0.5),
      }));
      return { cel, C, R, x0: caixa.left, y0: caixa.top, bola: by * C + bx, itens, d: area.querySelector("path").getAttribute("d") };
    });
    if (!est || !est.itens.length) { await page.waitForTimeout(300); continue; }
    if (!info) info = `labirinto ${est.C}x${est.R}, corredor ${Math.round(est.cel)} px`;
    const pode = lerParedes(est.d, est.C, est.R);
    const centro = (i) => [est.x0 + ((i % est.C) + 0.5) * est.cel, est.y0 + (Math.floor(i / est.C) + 0.5) * est.cel];

    if (!testouExtras) {
      testouExtras = true;
      // Um toque longe do gato, depois um empurrão a direito contra uma parede.
      const longe = est.bola === 0 ? est.C * est.R - 1 : 0;
      await page.mouse.click(...centro(longe));
      await page.waitForTimeout(300);
      const c = est.bola % est.C;
      const r = Math.floor(est.bola / est.C);
      const parede = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dc, dr]) => {
        const cc = c + dc;
        const rr = r + dr;
        return cc >= 0 && cc < est.C && rr >= 0 && rr < est.R && !pode(c, r, dc, dr);
      });
      if (parede) {
        const [x, y] = centro(est.bola);
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + parede[0] * est.cel, y + parede[1] * est.cel, { steps: 6 });
        await page.mouse.move(x, y, { steps: 3 });
        await page.mouse.up();
      }
    }

    // Alvo seguinte: a estrela mais próxima, depois o objetivo mais próximo.
    const estrelas = est.itens.filter((x) => x.estrela);
    const lista = estrelas.length ? estrelas : est.itens;
    const caminhos = lista.map((x) => rota(pode, est.C, est.R, est.bola, x.i)).sort((a, b) => a.length - b.length);
    const caminho = caminhos[0];
    if (!caminho || caminho.length < 1) { erros.push("o teste não encontrou caminho"); break; }
    const [x, y] = centro(caminho[0]);
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (const i of caminho.slice(1)) {
      const [cx, cy] = centro(i);
      await page.mouse.move(cx, cy, { steps: 4 });
    }
    // Passar um pouco para lá do alvo, como faria um dedo a sério.
    const [ux, uy] = centro(caminho[caminho.length - 1]);
    await page.mouse.move(ux + 3, uy + 3, { steps: 2 });
    if (!foto && est.C >= 8 && caminho.length > 3) {
      foto = true;
      await page.screenshot({ path: `${OUT}/labirinto-jogo-n${nivel}-${w}x${h}.png` });
    }
    await page.mouse.up();
    if (!est.itens.some((x) => x.estrela) || est.itens.length === 1) labirintos++;
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3000);
  const premio = !!(await page.$(".premio"));
  await page.screenshot({ path: `${OUT}/labirinto-premio-n${nivel}-${w}x${h}.png` });
  const ultima = await page.evaluate(() => JSON.parse(localStorage.getItem("mae.v1")).metricas?.filter((m) => m.game === "labirinto" && m.tipo === "ronda").at(-1));
  console.log(`nível ${nivel} ${w}x${h}: ${info}; prémio ${premio}; ${Math.round((Date.now() - t0) / 1000)} s; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  console.log(`  registo: ${JSON.stringify(ultima)}`);
  if (!premio || erros.length || !ultima?.completed) falhou = true;
  await page.close();
}

await jogar(1, 1024, 600);
await jogar(6, 800, 1280);
await jogar(11, 1024, 600);
await jogar(9, 1280, 800);
await browser.close();
process.exit(falhou ? 1 : 0);
