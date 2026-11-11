// Jogada automática do Monta-pratos: toca no andar aceso na maior parte dos pratos, deixa cair um
// em cada quatro, nos níveis de pedidos só tira os tipos de prato do cartão do gato, e deixa em
// paz os pratos vazios (andar azul), menos um deslize de propósito.
// Correr em tools/testes (depois de npm install nessa pasta):  node montapratos.mjs <porta> [níveis, por exemplo 1,12]
// Precisa de um servidor nessa porta. Capturas de ecrã: app/test-shots/jogos/montapratos-play-*.png
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const [porta = "8777", lista = "1,12"] = process.argv.slice(2);
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
// Imagem do prato -> tipo, para obedecer ao "Só a sopa!" no nível de topo.
const TIPO = {
  caldo_verde: "sopa", sopa_legumes: "sopa", arroz_doce: "doce", bolo_laranja: "doce", pastel_nata: "doce", pudim: "doce",
  bacalhau_bras: "peixe", sardinhas: "peixe", pao: "pao", queijo: "pao", laranja: "fruta", uvas: "fruta", cereja: "fruta", melancia: "fruta",
};

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
    await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true, "nivel.montapratos": n })), nivel);
    await page.goto(`http://127.0.0.1:${porta}/#jogo=montapratos`);
    const inicio = Date.now();
    let chegadas = 0;
    let toques = 0;
    let deixados = 0;
    let sujoTocado = false;
    const vistos = new Map(); // índice do elevador -> chave do prato que está agora à espera
    const fotos = new Set();
    while (Date.now() - inicio < Number(process.env.LIMITE || 400000)) {
      if (await page.$(".premio")) break;
      const espera = await page.$$eval(".mp-cabine", (cs) => {
        const acesas = [...document.querySelectorAll(".mp-andar.acesa, .mp-andar.lavar")].map((a) => a.getBoundingClientRect());
        const pedido = document.querySelector(".mp-pedido")?.dataset.tipos || "";
        return cs.map((c, i) => {
          const p = c.querySelector(".mp-prato");
          const r = c.getBoundingClientRect();
          const cy = r.top + r.height / 2;
          const andar = acesas.find((a) => cy > a.top && cy < a.bottom);
          const sujo = /sujo/.test(p.className);
          const aguarda = andar && (sujo || /chegou|treme/.test(p.className));
          return { i, aguarda, sujo, x: r.left + r.width / 2, y: cy, src: p.getAttribute("src"), pedido, y0: andar ? Math.round(andar.top) : 0 };
        }).filter((c) => c.aguarda);
      }).catch(() => []);
      for (const c of espera) {
        const chave = `${c.src}|${c.y0}`;
        if (vistos.get(c.i) === chave) continue;
        vistos.set(c.i, chave);
        chegadas++;
        const nome = (c.src.match(/(?:prato-)?([a-z_]+)\.svg$/) || [])[1];
        let tocar;
        if (c.sujo) { tocar = !sujoTocado; sujoTocado = true; }
        else if (c.pedido) tocar = c.pedido.split(",").includes(TIPO[nome]);
        else tocar = chegadas % 4 !== 0;
        const foto = c.sujo ? "sujo" : "acesa";
        if (!fotos.has(foto)) { fotos.add(foto); await page.screenshot({ path: `${OUT}/montapratos-play-n${nivel}-${w}x${h}-${foto}.png` }); }
        if (c.pedido && c.pedido.includes(",") && !fotos.has("varios")) { fotos.add("varios"); await page.screenshot({ path: `${OUT}/montapratos-play-n${nivel}-${w}x${h}-varios.png` }); }
        if (!tocar) { deixados++; continue; }
        await page.waitForTimeout(300 + Math.random() * 500);
        // Um toque um pouco a tremer no andar aceso, fora do prato.
        await page.mouse.click(c.x - 40, c.y + 10);
        toques++;
      }
      if (!fotos.has("plof") && await page.$(".mp-splat")) {
        fotos.add("plof");
        await page.screenshot({ path: `${OUT}/montapratos-play-n${nivel}-${w}x${h}-plof.png` });
      }
      await page.waitForTimeout(120);
    }
    const premio = !!(await page.$(".premio"));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/montapratos-play-n${nivel}-${w}x${h}-premio.png` });
    const metrica = await page.evaluate(() => (JSON.parse(localStorage.getItem("mae.v1")).metricas || []).filter((m) => m.game === "montapratos" && m.tipo === "ronda").at(-1));
    console.log(`nível ${nivel} ${w}x${h}: chegadas ${chegadas}, toques ${toques}, deixados ${deixados}, prémio ${premio}, ${Math.round((Date.now() - inicio) / 1000)} s, erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
    console.log(`  registo: ${JSON.stringify(metrica)}`);
    if (!premio || erros.length || !metrica || !metrica.completed) falhou = true;
    await page.close();
  }
}
await browser.close();
process.exit(falhou ? 1 : 0);
