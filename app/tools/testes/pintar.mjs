// Jogada automática dos Azulejos: joga rondas inteiras até ao ecrã do prémio nos níveis e tamanhos dados.
// Mede cada região do azulejo como a pessoa a vê (o círculo mais largo dentro da parte visível, em px do ecrã).
// Nos níveis de copiar, de painel e de memória faz primeiro uma cor errada.
// Correr em tools/testes (depois de npm install nessa pasta):  node pintar.mjs <porta> [níveis, por exemplo 1,6,11] [tamanhos]
// Precisa de um servidor nessa porta. Capturas de ecrã: app/test-shots/jogos/pintar-play-*.png
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const [porta = "8787", lista = "1,3,5,6,7,8,10,11", tams = "1024x600,1280x800,800x1280"] = process.argv.slice(2);
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;
// A região mais pequena permitida por nível, em px (regra da família: 113 no início, cerca de 70 no topo).
const MINIMO = [113, 113, 113, 113, 95, 84, 72, 85, 85, 70, 70];

for (const nivel of lista.split(",").map(Number)) {
  for (const t of tams.split(",")) {
    const [w, h] = t.split("x").map(Number);
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
    const erros = [];
    page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
    page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
    page.on("pageerror", (e) => erros.push(String(e)));
    // O nível 1 começa com uma parede quase cheia (23 azulejos simples), para ver a parede no seu máximo.
    await page.addInitScript((n) => {
      const parede = n === 1 ? Array.from({ length: 23 }, (_, i) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="hsl(${i * 15} 70% 70%)"/></svg>`) : [];
      localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.pintar": n, "pintar.parede": parede }));
    }, nivel);
    await page.goto(`http://127.0.0.1:${porta}/#jogo=pintar`);
    const nome = `pintar-play-n${nivel}-${w}x${h}`;
    const inicio = Date.now();
    let menorRegiao = Infinity;
    let menorPote = Infinity;
    let errada = nivel < 3;
    let fotos = 0;
    let ultimoMotivo = "";

    // Para cada azulejo k e região r: um ponto dentro da parte visível, e o seu círculo interior mais largo.
    const mapa = () => page.evaluate(() => {
      const out = [];
      for (const q of document.querySelectorAll(".pz-quadro[data-k]")) {
        const b = q.getBoundingClientRect();
        const passo = 3;
        const W = Math.floor(b.width / passo);
        const H = Math.floor(b.height / passo);
        const lab = new Int16Array(W * H).fill(-1);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const el = document.elementFromPoint(b.left + x * passo + 1, b.top + y * passo + 1);
          const r = el && el.closest && q.contains(el) ? el.closest("[data-r]") : null;
          if (r) lab[y * W + x] = Number(r.dataset.r);
        }
        const regioes = {};
        for (const r of new Set(lab)) {
          if (r < 0) continue;
          const D = new Float32Array(W * H);
          for (let i = 0; i < W * H; i++) D[i] = lab[i] === r ? 1e9 : 0;
          const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : D[y * W + x]);
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x;
            if (D[i]) D[i] = Math.min(D[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
          }
          let best = { d: 0, x: 0, y: 0 };
          for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
            const i = y * W + x;
            if (!D[i]) continue;
            D[i] = Math.min(D[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
            if (D[i] > best.d) best = { d: D[i], x, y };
          }
          regioes[r] = { px: Math.round(2 * best.d * passo), x: b.left + best.x * passo + 1, y: b.top + best.y * passo + 1 };
        }
        out.push({ k: Number(q.dataset.k), regioes });
      }
      const obra = document.querySelector(".pz-obra");
      return { motivo: obra?.dataset.motivo, esquema: (obra?.dataset.esquema || "").split(","), tiles: out,
        potes: [...document.querySelectorAll(".pz-tinta")].map((b) => ({ cor: b.dataset.cor, lado: Math.min(b.offsetWidth, b.offsetHeight) })) };
    });
    const modo = await page.evaluate(() => [...document.querySelector(".pz-cena")?.classList || []].find((c) => c.startsWith("pz-m-"))?.slice(5));

    async function pote(cor) {
      await page.click(`.pz-tinta[data-cor="${cor}"]`, { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(120);
    }

    while (Date.now() - inicio < 400000) {
      if (await page.$(".premio")) break;
      const modoAgora = await page.evaluate(() => [...document.querySelector(".pz-cena")?.classList || []].find((c) => c.startsWith("pz-m-"))?.slice(5));
      const pintaveis = await page.$$eval(".pz-quadro[data-k] path[data-r]", (ps) => ps.length).catch(() => 0);
      if (await page.$(".pz-parede")) {
        if (fotos < 9) { await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/${nome}-parede.png` }); fotos = 9; }
        await page.waitForTimeout(400);
        continue;
      }
      if (!pintaveis) { await page.waitForTimeout(400); continue; }
      const m = await mapa();
      if (!m.motivo || !m.tiles.length) { await page.waitForTimeout(300); continue; }
      // Um azulejo novo: esperar até se poder pintar (os níveis de memória mostram primeiro o modelo).
      if (m.motivo + m.tiles.length !== ultimoMotivo) {
        ultimoMotivo = m.motivo + m.tiles.length;
        await page.waitForTimeout(modoAgora === "memoria" ? 600 : 300);
      }
      for (const p of m.potes) menorPote = Math.min(menorPote, p.lado);
      for (const tl of m.tiles) for (const r of Object.values(tl.regioes)) menorRegiao = Math.min(menorRegiao, r.px);
      // Pintar todas as regiões cinzentas: a cor certa (qualquer cor quando é à vontade).
      const cinzentos = await page.$$eval(".pz-quadro[data-k] path[data-r]", (ps) => ps.filter((p) => p.getAttribute("fill") === "#dcdcdc")
        .map((p) => ({ k: Number(p.closest(".pz-quadro").dataset.k), r: Number(p.dataset.r) })));
      if (!cinzentos.length) {
        const pronto = await page.$(".pz-pronto");
        if (pronto) { await pronto.click().catch(() => {}); await page.waitForTimeout(600); }
        else await page.waitForTimeout(300);
        continue;
      }
      const alvo = cinzentos[0];
      const sitio = m.tiles.find((x) => x.k === alvo.k)?.regioes[alvo.r];
      if (!sitio) { await page.waitForTimeout(300); continue; }
      if (!errada && modoAgora !== "livre") {
        const certa = m.esquema[alvo.r];
        const outra = m.potes.find((p) => p.cor !== certa);
        await pote(outra.cor);
        await page.mouse.click(sitio.x, sitio.y);
        await page.waitForTimeout(300);
        if (await page.$(".pz-errado")) errada = true;
        await page.waitForTimeout(1500);
        continue;
      }
      const cor = modoAgora === "livre" ? m.potes[(alvo.r + alvo.k) % m.potes.length].cor : m.esquema[alvo.r];
      await pote(cor);
      await page.mouse.click(sitio.x, sitio.y);
      await page.waitForTimeout(250);
      if (fotos === 0) { await page.screenshot({ path: `${OUT}/${nome}-a.png` }); fotos++; }
      if (fotos === 1 && cinzentos.length === 1) { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${nome}-b.png` }); fotos++; }
    }
    let premio = false;
    let parede = false;
    for (let i = 0; i < 60 && !premio; i++) {
      await page.waitForTimeout(400);
      if (!parede && fotos < 9 && await page.$(".pz-parede")) { parede = true; await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/${nome}-parede.png` }); }
      premio = (await page.locator(".premio .acoes button").count()) > 0;
    }
    await page.screenshot({ path: `${OUT}/${nome}-premio.png` });
    const dados = await page.evaluate(() => JSON.parse(localStorage.getItem("mae.v1")));
    const metrica = (dados.metricas || []).filter((x) => x.game === "pintar" && x.tipo === "ronda").at(-1);
    const naParede = (dados["pintar.parede"] || []).length;
    const limite = MINIMO[nivel - 1];
    console.log(`nível ${nivel} ${w}x${h} (${metrica?.mode || modo}): prémio ${premio}, parede ${naParede} azulejos, região mais pequena ${menorRegiao} px (permitido ${limite}), pote mais pequeno ${menorPote} px, ${Math.round((Date.now() - inicio) / 1000)} s, erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
    console.log(`  registo: ${JSON.stringify(metrica)}`);
    if (!premio || erros.length || menorRegiao < limite || menorPote < 113 || !naParede || (nivel >= 3 && !(metrica && metrica.wrong_colour))) falhou = true;
    await page.close();
  }
}
await browser.close();
process.exit(falhou ? 1 : 0);
