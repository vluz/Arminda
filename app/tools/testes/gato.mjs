// Jogada automática do Gato aventureiro: um jogador simples lê o tabuleiro, espera pelos intervalos
// entre os carros, salta para os troncos quando há um à frente, e carrega nos botões grandes de
// seta até ao ecrã do prémio.
// Correr em tools/testes (depois de npm install nessa pasta):  node gato.mjs <porta> [níveis, por exemplo 1,10]
// Precisa de um servidor nessa porta. Capturas de ecrã: app/test-shots/jogos/gato-play-*.png
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const [porta = "8777", lista = "1,10"] = process.argv.slice(2);
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });

// Corre na página: devolve "cima", "esq", "dir" ou null (esperar).
function decidir() {
  const g = document.querySelector(".gt-gato");
  const tab = document.querySelector(".gt-tabuleiro").getBoundingClientRect();
  if (!g) return null;
  const cat = g.getBoundingClientRect();
  const cell = cat.width;
  const cy = cat.top + cat.height / 2;
  const rows = [...document.querySelectorAll(".gt-faixa")];
  const r = rows.findIndex((row) => { const b = row.getBoundingClientRect(); return cy >= b.top && cy < b.bottom; });
  if (r < 0 || r === rows.length - 1) return null;
  const tipo = (row) => row.className.match(/gt-(inicio|estrada|passeio|rio|casa)/)[1];
  const agora = performance.now();
  const ant = window.__ant || {};
  const novo = {};
  // Velocidade de cada objeto em casas por segundo, a partir da olhadela anterior.
  const objetos = (row, sel) => [...row.querySelectorAll(sel)].map((o, i) => {
    const b = o.getBoundingClientRect();
    const k = `${rows.indexOf(row)}-${i}`;
    novo[k] = { x: b.left, t: agora };
    const p = ant[k];
    let v = 0;
    if (p && agora > p.t && Math.abs(b.left - p.x) < cell) v = (b.left - p.x) / cell / ((agora - p.t) / 1000);
    return { rel: (b.left - cat.left) / cell, w: b.width / cell, v, mau: o.classList.contains("aviso") || o.classList.contains("fundo") };
  });
  const atual = rows[r];
  const prox = rows[r + 1];
  let decisao = "cima";
  if (tipo(prox) === "estrada") {
    const carros = objetos(prox, ".gt-carro");
    const livre = carros.every((c) => {
      for (let t = 0; t <= 1.0; t += 0.1) {
        const p = c.rel + (c.v || 0) * t;
        if (p + 0.08 < 0.95 && p + c.w - 0.08 > 0.05) return false;
      }
      return true;
    });
    if (!livre) decisao = null;
  } else if (tipo(prox) === "rio") {
    const troncos = objetos(prox, ".gt-tronco");
    const bom = troncos.some((o) => {
      if (o.mau) return false;
      const p = o.rel + o.v * 0.3;
      return p + 0.45 <= 0.5 && 0.5 <= p + o.w - 0.45;
    });
    if (!bom) decisao = null;
  }
  // Num tronco perto da borda do tabuleiro: dar um passo para dentro se o tronco lá estiver.
  if (decisao === null && tipo(atual) === "rio") {
    const xb = (cat.left - tab.left) / cell;
    const troncos = objetos(atual, ".gt-tronco");
    const sob = troncos.find((o) => o.rel <= 0.5 && 0.5 <= o.rel + o.w);
    if (sob && xb < 0.8 && sob.rel + sob.w >= 1.9) decisao = "dir";
    else if (sob && xb > 3.2 && sob.rel <= -0.9) decisao = "esq";
  }
  // De vez em quando, à espera no passeio de partida: dar um passo para o lado, para variar.
  if (decisao === null && tipo(atual) === "inicio" && Math.random() < 0.02) {
    const xb = Math.round((cat.left - tab.left) / cell);
    decisao = xb > 0 ? "esq" : "dir";
  }
  window.__ant = novo;
  return decisao;
}

// O main.js diz que #jogo=<id> abre na mesma os jogos escondidos (oculto), mas houve uma altura em
// que o atalho procurava na lista filtrada. Enquanto isso não estiver certo, servir o main.js com
// o atalho a procurar em todos os jogos. Não faz nada quando já está certo.
async function abrirOculto(page) {
  await page.route("**/js/main.js", async (route) => {
    const r = await route.fetch();
    const corpo = (await r.text()).replace("JOGOS.find((x) => x.id === h.slice(6))", "TODOS.find((x) => x.id === h.slice(6))");
    await route.fulfill({ response: r, body: corpo });
  });
}

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

for (const nivel of lista.split(",").map(Number)) {
  for (const [w, h] of [[1024, 600], [1280, 800], [800, 1280]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
    const erros = [];
    page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
    page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) erros.push(m.text()); });
    page.on("pageerror", (e) => erros.push(String(e)));
    await abrirOculto(page);
    await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.gato": n })), nivel);
    await page.goto(`http://127.0.0.1:${porta}/#jogo=gato`);
    // O servidor de teste local às vezes recusa uma ligação quando está carregado: nesse caso recarregar uma vez.
    try { await page.waitForSelector(".gt-botao"); } catch { await page.reload(); await page.waitForSelector(".gt-botao"); }
    const inicio = Date.now();
    let toques = 0;
    const tropecos = { carro: 0, agua: 0 };
    const fotos = new Set();
    while (Date.now() - inicio < Number(process.env.LIMITE || 400000)) {
      if (await page.$(".premio")) break;
      const d = await page.evaluate(decidir).catch(() => null);
      if (d) {
        const b = await page.$(`.gt-botao.${d}`);
        const r = b && await b.boundingBox();
        if (r) {
          // Um toque um pouco a tremer, fora do centro.
          await page.mouse.click(r.x + r.width * 0.35, r.y + r.height * 0.6);
          toques++;
          await page.waitForTimeout(380);
        }
      }
      // Contar os encontrões e os chapes à medida que aparecem (ditos mesmo que a ronda não acabe).
      for (const t of await page.$$eval(".gt-efeito:not([data-visto])", (es) => es.map((x) => { x.dataset.visto = "1"; return x.classList.contains("carro") ? "carro" : "agua"; })).catch(() => [])) tropecos[t]++;
      for (const [sel, nome] of [[".gt-efeito.carro", "carro"], [".gt-efeito.agua", "agua"], [".gt-sprite.dorme", "casa"],
        [".gt-tartarugas.fundo", "tartarugas"], [".gt-trator", "trator"], [".gt-peixe.apanhado", "peixe"]]) {
        if (!fotos.has(nome) && await page.$(sel)) {
          fotos.add(nome);
          await page.screenshot({ path: `${OUT}/gato-play-n${nivel}-${w}x${h}-${nome}.png` });
        }
      }
      if (!fotos.has("meio") && toques === 4) { fotos.add("meio"); await page.screenshot({ path: `${OUT}/gato-play-n${nivel}-${w}x${h}-meio.png` }); }
      await page.waitForTimeout(70);
    }
    const premio = !!(await page.$(".premio"));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/gato-play-n${nivel}-${w}x${h}-premio.png` });
    const metrica = await page.evaluate(() => (JSON.parse(localStorage.getItem("mae.v1")).metricas || []).filter((m) => m.game === "gato" && m.tipo === "ronda").at(-1));
    console.log(`nível ${nivel} ${w}x${h}: toques ${toques}, encontrões ${tropecos.carro}, chapes ${tropecos.agua}, prémio ${premio}, ${Math.round((Date.now() - inicio) / 1000)} s, erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
    console.log(`  registo: ${JSON.stringify(metrica)}`);
    if (!premio || erros.length || !metrica || !metrica.completed) falhou = true;
    await page.close();
  }
}
await browser.close();
process.exit(falhou ? 1 : 0);
