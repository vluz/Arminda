// Jogada automática da Feira: joga rondas inteiras até ao ecrã do prémio nos níveis dados.
// Correr em tools/testes (depois de npm install nessa pasta):  node feira.mjs <porta> [níveis, por exemplo 1,5,8,14]
// Precisa de um servidor nessa porta. Capturas de ecrã: app/test-shots/jogos/feira-play-*.png
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const [porta = "8774", lista = "1,7,8,9,10,11,12,13,14"] = process.argv.slice(2);
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

// Índices dos valores do porta-moedas que somam exatamente o preço, com o menor número de peças.
function subconjunto(valores, preco) {
  let r = null;
  (function f(i, soma, usados) {
    if (soma > preco || (r && usados.length >= r.length)) return;
    if (soma === preco) { r = [...usados]; return; }
    if (i >= valores.length) return;
    f(i + 1, soma + valores[i].v, [...usados, valores[i].i]);
    f(i + 1, soma, usados);
  })(0, 0, []);
  return r;
}

async function clicarAte(page, sel, condicao, limite = 60000) {
  const t0 = Date.now();
  while (!(await condicao())) {
    if (Date.now() - t0 > limite) { const info = await page.evaluate(() => ({ preco: document.querySelector(".mostrador")?.dataset.preco, bolsa: [...document.querySelectorAll(".dinheiro")].map((b) => b.dataset.valor + (b.classList.contains("usado") ? "u" : "")), balao: document.querySelector(".balao")?.textContent })); throw new Error(`preso a clicar em ${sel} ${JSON.stringify(info)}`); }
    await page.click(sel, { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(350);
  }
}

for (const nivel of lista.split(",").map(Number)) {
  for (const [w, h] of [[1024, 600], [1280, 800], [800, 1280]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
    const erros = [];
    page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
    page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
    page.on("pageerror", (e) => erros.push(String(e)));
    await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.feira": n })), nivel);
    await page.goto(`http://127.0.0.1:${porta}/#jogo=feira`);
    const inicio = Date.now();
    let compras = 0;
    let errou = false;
    let ultimaBanca = null;
    let menor = Infinity;
    const medir = async (sel) => {
      const m = await page.$$eval(sel, (bs) => bs.filter((b) => !b.classList.contains("usado")).map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }));
      if (m.length) menor = Math.min(menor, ...m);
    };
    while (Date.now() - inicio < 420000) {
      if (await page.$(".premio")) break;
      // Cestos para o dinheiro que há: primeiro um errado, depois o que cabe.
      if (await page.$(".cesto:not(.certo)")) {
        if (await page.$(".cesto.certo")) { await page.waitForTimeout(300); continue; }
        await page.waitForTimeout(300);
        const tens = await page.$eval(".tens", (t) => Number(t.dataset.tens));
        const totais = await page.$$eval(".cesto", (cs) => cs.map((c) => Number(c.dataset.total)));
        const k = totais.findIndex((t) => t <= tens);
        await medir(".cesto");
        if (compras === 0) await page.screenshot({ path: `${OUT}/feira-play-n${nivel}-${w}x${h}-a.png` });
        if (!errou) {
          const mau = totais.findIndex((t) => t > tens);
          await clicarAte(page, `.cesto >> nth=${mau}`, async () => !!(await page.$(".cesto.abana")));
          errou = true;
        }
        await clicarAte(page, `.cesto >> nth=${k}`, async () => !!(await page.$(".cesto.certo")) || !(await page.$(".cesto")));
        await page.waitForFunction(() => !document.querySelector(".cesto.certo") || document.querySelector(".premio"), null, { timeout: 40000 });
        compras++;
        continue;
      }
      // Duas bancas: o quilo mais barato.
      if (await page.$(".banca-escolha:not(.certo)")) {
        if (await page.$(".banca-escolha.certo")) { await page.waitForTimeout(300); continue; }
        await page.waitForTimeout(300);
        const kg = await page.$$eval(".banca-escolha", (cs) => cs.map((c) => Number(c.dataset.porKg)));
        const k = kg.indexOf(Math.min(...kg));
        await medir(".banca-escolha");
        if (compras === 0) await page.screenshot({ path: `${OUT}/feira-play-n${nivel}-${w}x${h}-a.png` });
        if (!errou) {
          await clicarAte(page, `.banca-escolha >> nth=${1 - k}`, async () => !!(await page.$(".banca-escolha.abana")));
          errou = true;
        }
        await clicarAte(page, `.banca-escolha >> nth=${k}`, async () => !!(await page.$(".banca-escolha.certo")) || !(await page.$(".banca-escolha")));
        await page.waitForFunction(() => !document.querySelector(".banca-escolha.certo") || document.querySelector(".premio"), null, { timeout: 40000 });
        compras++;
        continue;
      }
      // A mais barata de duas.
      if (await page.$(".escolha:not(.certo)")) {
        const precos = await page.$$eval(".escolha .etiqueta", (es) => es.map((x) => Number(x.dataset.preco)));
        const k = precos.indexOf(Math.min(...precos));
        if (!errou) {
          await clicarAte(page, `.escolha >> nth=${1 - k}`, async () => !!(await page.$(".escolha.abana")));
          errou = true;
        }
        if (compras === 0) await page.screenshot({ path: `${OUT}/feira-play-n${nivel}-${w}x${h}-barato.png` });
        await clicarAte(page, `.escolha >> nth=${k}`, async () => !!(await page.$(".escolha.certo")) || !(await page.$(".escolha")));
        continue;
      }
      // Total da lista.
      if (await page.$(".opcao-total:not(.certo)")) {
        if (await page.$(".opcao-total.certo")) { await page.waitForTimeout(300); continue; }
        const preco = await page.$eval(".mostrador", (m) => Number(m.dataset.preco));
        await medir(".opcao-total");
        if (compras === 0) await page.screenshot({ path: `${OUT}/feira-play-n${nivel}-${w}x${h}-total.png` });
        if (!errou) {
          await clicarAte(page, `.opcao-total:not([data-valor="${preco}"]) >> nth=0`, async () => !!(await page.$(".opcao-total.abana")));
          errou = true;
        }
        await clicarAte(page, `.opcao-total[data-valor="${preco}"]`, async () => !(await page.$(".opcao-total")) || !!(await page.$(".opcao-total.certo")));
        await page.waitForFunction(() => !document.querySelector(".opcao-total"), null, { timeout: 30000 });
        continue;
      }
      // Troco.
      if (await page.$(".opcao-troco")) {
        const preco = await page.$eval(".mostrador", (m) => Number(m.dataset.preco));
        const valores = await page.$$eval(".dinheiro.usado", (bs) => bs.map((b) => Number(b.dataset.valor)));
        const troco = valores.reduce((a, b) => a + b, 0) - preco;
        await medir(".opcao-troco");
        await page.screenshot({ path: `${OUT}/feira-play-n${nivel}-${w}x${h}-troco.png` });
        await clicarAte(page, `.opcao-troco[data-valor="${troco}"]`, async () => !(await page.$(".opcao-troco")) || !!(await page.$(".opcao-troco.certo")));
        await page.waitForFunction(() => !document.querySelector(".troco"), null, { timeout: 30000 });
        compras++;
        continue;
      }
      // Preço, porta-moedas e banca lidos de uma vez: leituras separadas podiam misturar a coisa vendida com o porta-moedas seguinte.
      const foto = await page.evaluate(() => {
        const m = document.querySelector(".mostrador");
        return {
          banca: m?.dataset.preco || null,
          vendido: !!m?.classList.contains("vendido"),
          chave: m?.innerHTML || "",
          livres: [...document.querySelectorAll(".dinheiro")].map((b, i) => ({ i, v: Number(b.dataset.valor), usado: b.classList.contains("usado") })),
        };
      });
      const { banca, livres } = foto;
      if (!banca || !livres.length || foto.vendido) { await page.waitForTimeout(300); continue; }
      // Lista comprida: a pergunta do total vem antes de pagar.
      if (nivel === 12 && (await page.$(".linha-total.escondida"))) { await page.waitForTimeout(300); continue; }
      const preco = Number(banca);
      const chave = foto.chave;
      if (chave === ultimaBanca) { await page.waitForTimeout(300); continue; }
      const disponiveis = livres.filter((x) => !x.usado);
      await medir(".dinheiro");
      if (compras === 0) await page.screenshot({ path: `${OUT}/feira-play-n${nivel}-${w}x${h}-a.png` });
      if (nivel === 5 || nivel === 9) {
        // Níveis de troco: pagar com a nota.
        const nota = livres.filter((x) => !x.usado).sort((a, b) => b.v - a.v)[0];
        await clicarAte(page, `.dinheiro >> nth=${nota.i}`, async () => !!(await page.$(".opcao-troco"))
          || (await page.$eval(`.dinheiro >> nth=${nota.i}`, (b) => b.classList.contains("usado")).catch(() => true)), 60000);
        continue;
      }
      const escolha = subconjunto(disponiveis, preco);
      if (!escolha) {
        // Já há moedas no balcão: a venda está só a acabar. Olhar outra vez.
        if (disponiveis.length < livres.length) { await page.waitForTimeout(300); continue; }
        throw new Error(`não há pagamento certo para ${preco} em ${JSON.stringify(disponiveis)}`);
      }
      const mudou = async () => (await page.$eval(".mostrador", (m) => m.innerHTML).catch(() => "")) !== chave;
      for (const i of escolha) {
        await clicarAte(page, `.dinheiro >> nth=${i}`, async () => (await page.$eval(`.dinheiro >> nth=${i}`, (b) => b.classList.contains("usado")).catch(() => true)) || !!(await page.$(".mostrador.vendido")) || (await mudou()));
      }
      const ok = await page.waitForFunction((c) => document.querySelector(".mostrador.vendido") || document.querySelector(".mostrador")?.innerHTML !== c, chave, { timeout: 20000 }).catch(() => null);
      // Um toque apanhou uma mudança de ecrã (as moedas voltaram como "a mais"): olhar outra vez e pagar de novo.
      if (!ok) continue;
      ultimaBanca = chave;
      compras++;
    }
    const premio = !!(await page.$(".premio"));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/feira-play-n${nivel}-${w}x${h}-premio.png` });
    const metrica = await page.evaluate(() => (JSON.parse(localStorage.getItem("mae.v1")).metricas || []).filter((m) => m.game === "feira" && m.tipo === "ronda").at(-1));
    console.log(`nível ${nivel} ${w}x${h}: compras ${compras}, prémio ${premio}, alvo mais pequeno ${Math.round(menor)} px, ${Math.round((Date.now() - inicio) / 1000)} s, erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
    console.log(`  registo: ${JSON.stringify(metrica)}`);
    if (!premio || erros.length || menor < 113) falhou = true;
    await page.close();
  }
}
await browser.close();
process.exit(falhou ? 1 : 0);
