// Jogada automática dos Saltos: um jogador simples olha para o obstáculo seguinte e carrega em
// "Salta" para pedras e troncos, e em "Baixa" para ramos e pássaros, quando ele está a cerca de
// duas unidades. De vez em quando atrasa-se de propósito (ERRO, 10% por omissão), para também
// haver encontrões. Às vezes toca também nas metades do cenário.
// Correr em tools/testes (depois de npm install nessa pasta):  node saltos.mjs <porta> [níveis, por exemplo 1,10] [tamanhos, por exemplo 1024x600]
// Precisa de um servidor nessa porta. Capturas de ecrã: app/test-shots/jogos/saltos-play-*.png
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const [porta = "8788", lista = "1,10", tamanhos = "1024x600,1280x800,800x1280"] = process.argv.slice(2);
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
const ERRO = Number(process.env.ERRO || 0.1);
fs.mkdirSync(OUT, { recursive: true });

// Corre na página: "salta", "baixa" ou null.
function olhar(erro) {
  const cena = document.querySelector(".sl-cena");
  const coelho = document.querySelector(".sl-coelho");
  if (!cena || !coelho) return null;
  const c = cena.getBoundingClientRect();
  const U = c.width / 10;
  const cx = coelho.getBoundingClientRect();
  const centro = cx.left + cx.width / 2;
  let melhor = null;
  for (const o of document.querySelectorAll(".sl-obj:not(.sl-moeda):not(.sl-meta):not([data-feito])")) {
    if (o.style.visibility === "hidden") continue;
    const b = o.getBoundingClientRect();
    const meio = b.left + b.width / 2;
    if (meio < centro) { o.dataset.feito = "1"; continue; }
    if (!melhor || meio < melhor.meio) melhor = { o, meio };
  }
  if (!melhor) return null;
  const longe = (melhor.meio - centro) / U;
  const alto = melhor.o.classList.contains("sl-ramo") || melhor.o.classList.contains("sl-passaro");
  if (longe > (alto ? 1.9 : 2.2)) return null;
  melhor.o.dataset.feito = "1";
  if (Math.random() < erro) return null;   // desta vez lento demais
  return alto ? "baixa" : "salta";
}

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

for (const nivel of lista.split(",").map(Number)) {
  for (const [w, h] of tamanhos.split(",").map((t) => t.split("x").map(Number))) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
    const erros = [];
    page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
    page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
    page.on("pageerror", (e) => erros.push(String(e)));
    await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.saltos": n })), nivel);
    await page.goto(`http://127.0.0.1:${porta}/#jogo=saltos`);
    await page.waitForSelector(".sl-botao");
    const inicio = Date.now();
    let toques = 0;
    const fotos = new Set();
    while (Date.now() - inicio < Number(process.env.LIMITE || 300000)) {
      if (await page.$(".premio")) break;
      const d = await page.evaluate(olhar, ERRO).catch(() => null);
      if (d) {
        // Quase sempre os botões grandes; um toque em cada cinco na metade de cima ou de baixo do cenário.
        const naCena = Math.random() < 0.2;
        const alvo = await page.$(naCena ? ".sl-cena" : `.sl-botao.${d}`);
        const r = alvo && await alvo.boundingBox();
        if (r) {
          const y = naCena ? (d === "salta" ? r.y + r.height * 0.25 : r.y + r.height * 0.75) : r.y + r.height * 0.55;
          await page.mouse.click(r.x + r.width * 0.45, y);
          toques++;
        }
      }
      for (const [sel, nome] of [[".sl-pose.baixo", "baixo"], [".sl-pose.tropeca", "tropeca"], [".sl-moeda.apanhada", "moeda"],
        [".sl-passaro", "passaro"], [".sl-seq.ve", "seq"]]) {
        if (!fotos.has(nome) && await page.$(sel)) {
          fotos.add(nome);
          await page.screenshot({ path: `${OUT}/saltos-play-n${nivel}-${w}x${h}-${nome}.png` });
        }
      }
      const salto = await page.$eval(".sl-coelho", (c) => c.style.transform.includes("-") && !c.style.transform.includes("-0px")).catch(() => false);
      if (salto && !fotos.has("salto")) { fotos.add("salto"); await page.screenshot({ path: `${OUT}/saltos-play-n${nivel}-${w}x${h}-salto.png` }); }
      await page.waitForTimeout(25);
    }
    const premio = !!(await page.$(".premio"));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/saltos-play-n${nivel}-${w}x${h}-premio.png` });
    const metrica = await page.evaluate(() => (JSON.parse(localStorage.getItem("mae.v1")).metricas || []).filter((m) => m.game === "saltos" && m.tipo === "ronda").at(-1));
    console.log(`nível ${nivel} ${w}x${h}: toques ${toques}, prémio ${premio}, ${Math.round((Date.now() - inicio) / 1000)} s, erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
    console.log(`  registo: ${JSON.stringify(metrica)}`);
    if (!premio || erros.length || !metrica || !metrica.completed) falhou = true;
    await page.close();
  }
}
await browser.close();
process.exit(falhou ? 1 : 0);
