// Jogada automática do Quem é quem com conteúdos de família de substituição (nunca fotografias
// verdadeiras): um toque errado na primeira fotografia, depois sempre o nome (ou a fotografia)
// certo, até ao prémio. Confere também o ecrã de "ainda não há fotografias", que disponivel()
// acompanha a media, os tamanhos dos botões, e que os nomes cabem.
// Correr em tools/testes (depois de npm install nessa pasta):  node quem.mjs <porta> [nível ...]
// Precisa de um servidor:  python -m http.server <porta> --bind 127.0.0.1 --directory app/www
// Precisa dos conteúdos de substituição, feitos uma vez com:
//   python tools/criar_fotos_teste.py
//   python tools/enviar_media.py --so-preparar --origem <kit>/media-exemplo-quem
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const [porta = "8795", ...pedidos] = process.argv.slice(2);
const OUT = fileURLToPath(new URL("../../test-shots/jogos", import.meta.url));
const MEDIA = fileURLToPath(new URL("../../../media-exemplo-quem/_preparado", import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(path.join(MEDIA, "manifest.json"))) {
  console.log(`FALHOU: não há conteúdos de substituição em ${MEDIA} (ver o cabeçalho deste ficheiro)`);
  process.exit(1);
}
const MANIFESTO = JSON.parse(fs.readFileSync(path.join(MEDIA, "manifest.json"), "utf8"));
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhou = false;

const CASOS = pedidos.length
  ? pedidos.map((n) => [1024, 600, Number(n)])
  : [[1024, 600, 1], [1024, 600, 3], [1024, 600, 4], [1024, 600, 6], [1024, 600, 7], [1024, 600, 10],
     [1280, 800, 2], [1280, 800, 9], [800, 1280, 1], [800, 1280, 10]];

// Serve os conteúdos de substituição onde a app os procura num browser (www/media-teste/).
async function servirMedia(page, manifesto = MANIFESTO) {
  await page.route("**/media-teste/**", (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname.split("/media-teste/")[1]);
    if (rel === "manifest.json") return route.fulfill({ contentType: "application/json", body: JSON.stringify(manifesto) });
    const f = path.join(MEDIA, rel);
    if (!rel.includes("..") && fs.existsSync(f)) return route.fulfill({ path: f });
    return route.continue();   // os ficheiros de teste da própria app (config.json)
  });
}

function abrirPagina(w, h, nivel) {
  return browser.newPage({ viewport: { width: w, height: h }, hasTouch: true }).then(async (page) => {
    const erros = [];
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const url = m.location()?.url || "";
      if (!url.includes("/voz/")) erros.push(m.text() + " " + url);
    });
    page.on("pageerror", (e) => erros.push(String(e)));
    await page.addInitScript((n) => localStorage.setItem("mae.v1", JSON.stringify({
      "intro.vista": 99, "migracao.niveis2": true, "nivel.quem": n })), nivel);
    return { page, erros };
  });
}

// Em que tocar agora: { tipo: "nome" | "foto", certa: índice } ou null entre fotografias.
function estadoAgora(quem) {
  const semArtigo = (n) => {
    const s = n.trim().replace(/^(as|os|a|o)\s+/i, "").trim() || n.trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const nomes = [...document.querySelectorAll(".quem-nome")];
  const fotos = [...document.querySelectorAll(".quem-opfoto")];
  const bs = nomes.length ? nomes : fotos;
  if (!bs.length || bs.some((b) => b.classList.contains("certa") || b.classList.contains("sai"))) return null;
  if (nomes.length) {
    const src = decodeURIComponent(document.querySelector(".quem-foto img")?.getAttribute("src") || "");
    const f = quem.find((x) => src.endsWith(x.ficheiro));
    if (!f) return null;
    return { tipo: "nome", certa: nomes.findIndex((b) => b.textContent === semArtigo(f.nome)), numero: f.numero };
  }
  const balao = document.querySelector(".balao")?.textContent || "";
  const f = quem.find((x) => balao === `Quem ${/^(as|os)\s/i.test(x.nome) ? "são" : "é"} ${x.nome}?`);
  if (!f) return null;
  return {
    tipo: "foto", numero: f.numero,
    certa: fotos.findIndex((b) => decodeURIComponent(b.querySelector("img").getAttribute("src")).endsWith(f.ficheiro)),
  };
}

for (const [w, h, nivel] of CASOS) {
  const { page, erros } = await abrirPagina(w, h, nivel);
  await servirMedia(page);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=quem`);
  const nome = `quem-play-n${nivel}-${w}x${h}`;
  let respostas = 0;
  let errou = false;
  let menor = Infinity;
  let transborda = 0;
  let menorLetra = Infinity;
  const tipos = new Set();
  let premio = false;
  const fim = Date.now() + 240000;
  while (Date.now() < fim) {
    premio = (await page.locator(".premio .acoes button").count()) > 0;
    if (premio) break;
    const s = await page.evaluate(estadoAgora, MANIFESTO.quem);
    if (!s || s.certa < 0) { await page.waitForTimeout(250); continue; }
    tipos.add(s.tipo);
    const bs = page.locator(s.tipo === "nome" ? ".quem-nome" : ".quem-opfoto");
    const medidas = await bs.evaluateAll((l) => l.map((b) => {
      const r = b.getBoundingClientRect();
      const t = b.firstElementChild;
      return { w: r.width, h: r.height, sai: t && t.tagName === "SPAN" ? b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1 : false,
        letra: t && t.tagName === "SPAN" ? parseFloat(getComputedStyle(t).fontSize) : Infinity };
    }));
    for (const m of medidas) {
      menor = Math.min(menor, m.w, m.h);
      if (m.sai) transborda++;
      menorLetra = Math.min(menorLetra, m.letra);
    }
    if (respostas === 1 || (s.tipo === "foto" && !tipos.has("foto-shot"))) {
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/${nome}${s.tipo === "foto" ? "-fotos" : ""}.png` });
      if (s.tipo === "foto") tipos.add("foto-shot");
    }
    if (!errou) {
      errou = true;
      const n = await bs.count();
      await bs.nth((s.certa + 1) % n).click();
      await page.waitForTimeout(500);
    }
    await bs.nth(s.certa).click();
    respostas++;
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: `${OUT}/${nome}-premio.png` });
  if (premio) await page.locator(".premio >> text=Início").click();
  await page.waitForTimeout(1200);
  const registo = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("mae.v1"));
    return (d.metricas || []).filter((m) => m.tipo === "ronda" && m.game === "quem").at(-1);
  });
  // Os registos só levam números de fotografias: nenhum nome nem legenda em parte nenhuma do registo.
  const texto = JSON.stringify(registo || {});
  const semNomes = MANIFESTO.quem.every((x) => !texto.includes(x.nome) && x.falsos.every((f) => !texto.includes(f)));
  const ok = premio && registo?.completed && registo.wrong_taps >= 1 && !erros.length && menor >= 113
    && transborda === 0 && semNomes && registo.level === nivel;
  if (!ok) falhou = true;
  console.log(`${w}x${h} nível ${nivel}: respostas ${respostas} (${[...tipos].filter((t) => t !== "foto-shot").join("+")}), ` +
    `botão mais pequeno ${Math.round(menor)} px, texto de nome mais pequeno ${menorLetra === Infinity ? "-" : Math.round(menorLetra) + " px"}, ` +
    `nomes que não cabem ${transborda}; prémio ${premio}; sem nomes no registo ${semNomes}; ` +
    `registo ${JSON.stringify(registo && { level: registo.level, kind: registo.kind, score: registo.score, wrong: registo.wrong_taps, hints: registo.hints_needed, photos: registo.photos, numbers: registo.photo_numbers, options: registo.options, read: registo.read_aloud })}; ` +
    `erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
  await page.close();
}

// Menos de 4 fotografias que sirvam: uma frase simpática, depois o início; disponivel() falso. Com a media: verdadeiro.
{
  const { page, erros } = await abrirPagina(1024, 600, 1);
  const poucas = { ...MANIFESTO, quem: MANIFESTO.quem.slice(0, 3) };
  await servirMedia(page, poucas);
  await page.goto(`http://127.0.0.1:${porta}/#jogo=quem`);
  await page.waitForSelector(".media-vazio", { timeout: 10000 });
  const frase = await page.locator(".media-vazio").textContent();
  await page.screenshot({ path: `${OUT}/quem-vazio-1024x600.png` });
  await page.waitForSelector(".mosaico", { timeout: 15000 });
  const disp = await page.evaluate(async () => (await import("/js/jogos/quem.js")).disponivel());
  const registos = await page.evaluate(() => (JSON.parse(localStorage.getItem("mae.v1")).metricas || []).filter((m) => m.tipo === "ronda" && m.game === "quem").length);
  const naCasa = await page.locator(".mosaico button", { hasText: "Quem é quem" }).count();
  await page.close();
  const p2 = await abrirPagina(1024, 600, 1);
  await servirMedia(p2.page);
  await p2.page.goto(`http://127.0.0.1:${porta}/#familia`);
  await p2.page.waitForTimeout(1500);
  const disp2 = await p2.page.evaluate(async () => (await import("/js/jogos/quem.js")).disponivel());
  await p2.page.close();
  const ok = frase.includes("Ainda não há fotografias para este jogo") && disp === false && disp2 === true
    && registos === 0 && naCasa === 0 && !erros.length && !p2.erros.length;
  if (!ok) falhou = true;
  console.log(`caso vazio: frase mostrada ${frase.includes("Ainda não há fotografias")}, voltou ao início true, ` +
    `registos de ronda ${registos}, no ecrã inicial ${naCasa}, disponivel com 3 fotografias ${disp}, com 9 fotografias ${disp2}; ` +
    `erros: ${erros.length || p2.erros.length ? JSON.stringify([...erros, ...p2.erros]) : "nenhum"}`);
}

await browser.close();
process.exit(falhou ? 1 : 0);
