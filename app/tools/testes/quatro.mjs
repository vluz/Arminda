// Joga partidas inteiras de Quatro em linha até ao ecrã do prémio, em níveis baixos e altos.
// A pessoa joga uma estratégia simples: ganhar se puder, bloquear se o avô ameaçar, senão uma coluna ao acaso.
// No nível de topo o processador é abrandado 6 vezes (como no tablet fraco) e diz-se a tarefa mais
// comprida da thread principal, para conferir que a procura do avô continua com limite de tempo.
// Correr em tools/testes (depois de npm install nessa pasta):  node quatro.mjs <porta>
// Os ficheiros de voz em falta (voz/...) são esperados até a voz ser feita, e não contam.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const porta = process.argv[2] || "8786";
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

// O tabuleiro a partir do DOM: t[r][c] = 0 vazio, 1 a pessoa, 2 o avô (r = 0 é a fila de cima).
function ganha(t, C, R, quem) {
  const v = (r, c) => r >= 0 && r < R && c >= 0 && c < C && t[r][c] === quem;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      if ([0, 1, 2, 3].every((k) => v(r + dr * k, c + dc * k))) return true;
    }
  }
  return false;
}
function vitorias(t, C, R, quem) {
  const lista = [];
  for (let c = 0; c < C; c++) {
    let r = R - 1;
    while (r >= 0 && t[r][c]) r--;
    if (r < 0) continue;
    t[r][c] = quem;
    if (ganha(t, C, R, quem)) lista.push(c);
    t[r][c] = 0;
  }
  return lista;
}

async function jogar(nivel, w, h, lento) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  const erros = [];
  page.on("pageerror", (x) => erros.push(String(x)));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript((n) => {
    localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.quatro": n }));
    window.__tarefas = [];
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((x) => window.__tarefas.push(x.duration))).observe({ entryTypes: ["longtask"] });
    } catch { /* sem medição de tarefas compridas*/ }
  }, nivel);
  if (lento) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  }
  await page.goto(`http://127.0.0.1:${porta}/#jogo=quatro`);
  const t0 = Date.now();
  let foto = false;
  let toques = 0;
  let info = "";
  let tentouCheia = false;
  while (Date.now() - t0 < 400000) {
    if (await page.$(".premio")) break;
    const est = await page.evaluate(() => {
      const cols = [...document.querySelectorAll(".q4-coluna")];
      const R = cols[0]?.querySelectorAll(".q4-buraco").length || 0;
      const alt = parseFloat(getComputedStyle(document.querySelector(".q4-tab") || document.body).getPropertyValue("--alt")) || 1;
      const t = Array.from({ length: R }, () => cols.map(() => 0));
      cols.forEach((b, c) => b.querySelectorAll(".q4-disco").forEach((d) => {
        const r = Math.round(parseFloat(d.style.top) / alt);
        if (r >= 0 && r < R) t[r][c] = d.classList.contains("tu") ? 1 : 2;
      }));
      return {
        C: cols.length,
        R,
        t,
        larg: cols[0]?.getBoundingClientRect().width || 0,
        vez: !!document.querySelector(".q4-tab.tua-vez"),
      };
    });
    if (!info && est.C) info = `tabuleiro ${est.C}x${est.R}, coluna ${Math.round(est.larg)} px`;
    if (est.vez) {
      const discos = est.t.flat().filter(Boolean).length;
      if (!foto && discos >= 8) {
        foto = true;
        await page.screenshot({ path: `${OUT}/quatro-jogo-n${nivel}-${w}x${h}.png` });
      }
      const livres = [...Array(est.C).keys()].filter((c) => !est.t[0][c]);
      const cheias = [...Array(est.C).keys()].filter((c) => est.t[0][c]);
      if (!tentouCheia && cheias.length) {
        tentouCheia = true;
        await page.click(`.q4-coluna >> nth=${cheias[0]}`, { force: true });
        await page.waitForTimeout(800);
      }
      const ganhar = vitorias(est.t, est.C, est.R, 1);
      const travar = vitorias(est.t, est.C, est.R, 2);
      const c = ganhar[0] ?? travar[0] ?? livres[Math.floor(Math.random() * livres.length)];
      await page.click(`.q4-coluna >> nth=${c}`, { force: true, timeout: 3000 }).catch(() => {});
      toques++;
      await page.waitForTimeout(900);
    }
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(3000);
  const premio = !!(await page.$(".premio"));
  await page.screenshot({ path: `${OUT}/quatro-premio-n${nivel}-${w}x${h}.png` });
  const ultima = await page.evaluate(() => JSON.parse(localStorage.getItem("mae.v1")).metricas?.filter((m) => m.game === "quatro" && m.tipo === "ronda").at(-1));
  const tarefa = await page.evaluate(() => Math.round(Math.max(0, ...window.__tarefas)));
  console.log(`nível ${nivel} ${w}x${h}${lento ? " (processador 6 vezes mais lento)" : ""}: ${info}; prémio ${premio}; jogadas ${toques}; tarefa mais comprida ${tarefa} ms; ${Math.round((Date.now() - t0) / 1000)} s; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  console.log(`  registo: ${JSON.stringify(ultima)}`);
  if (!premio || erros.length) falhou = true;
  await page.close();
}

await jogar(1, 1024, 600, false);
await jogar(6, 800, 1280, false);
await jogar(11, 1024, 600, true);
await jogar(11, 1280, 800, false);
await browser.close();
process.exit(falhou ? 1 : 0);
