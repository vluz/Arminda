// Testes de regressão para as falhas encontradas na revisão de 11 de novembro de 2026.
// Cada cenário corre numa página nova. Correr em tools/testes:  node revisao.mjs <porta>
//  1. um ecrã inicial que rebenta ao desenhar não confirma o pacote web novo; um ecrã bom confirma;
//  2. sair de uma vista em 360 com a fotografia ainda a ser preparada não deixa a camada presa;
//  3. uma resposta do servidor que nunca acaba não prende o envio dos registos;
//  4. o manifesto de media e o config.json são lidos outra vez (conteúdos e token que chegam por USB);
//  5. o tempo com o ecrã apagado não conta como tempo ativo;
//  6. os registos não levam nomes de listas, lugares ou divisões;
//  7. os resumos do ecrã da família começam no último "Recomeçar do zero".
import { chromium } from "playwright";

const porta = process.argv[2] || "8765";
const base = `http://127.0.0.1:${porta}`;
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const resultados = [];
const dizer = (nome, ok, pormenor) => {
  resultados.push(ok);
  console.log(`${ok ? "bem  " : "FALHOU"} ${nome}: ${pormenor}`);
};

async function pagina(preparar) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 600 }, hasTouch: true });
  const erros = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.addInitScript(() => localStorage.setItem("mae.v1", JSON.stringify({ "intro.vista": 99, "migracao.niveis2": true })));
  if (preparar) await preparar(page);
  return { page, erros };
}

// Um plugin Atualizar de faz de conta, que só conta as confirmações.
const pluginFalso = () => {
  window.confirmacoes = 0;
  window.Capacitor = { Plugins: { Atualizar: {
    ok: async () => { window.confirmacoes++; return { confirmado: true }; },
    eventos: async () => ({ eventos: [] }),
    estado: async () => ({}),
    verificar: async () => ({ resultado: "nada_novo" }),
    aplicar: async () => ({ aplicado: "" }),
  } } };
};

// ---- 1. confirmação do pacote web ----
{
  const { page } = await pagina((p) => p.addInitScript(pluginFalso));
  await page.goto(`${base}/`);
  await page.waitForSelector(".mosaico", { timeout: 15000 });
  await page.waitForTimeout(3000);
  const bom = await page.evaluate(() => window.confirmacoes);
  await page.close();

  let trocado = false;
  const mau = await pagina(async (p) => {
    await p.addInitScript(pluginFalso);
    // O desenho do ecrã inicial rebenta: a função que desenha o azulejo do botão lança um erro.
    await p.route("**/js/azulejos.js", async (rota) => {
      const r = await rota.fetch();
      const texto = await r.text();
      const novo = texto.replace("export function svgAzulejo(n) {", "export function svgAzulejo(n) { throw new Error(\"erro injetado\");");
      trocado = novo !== texto;
      await rota.fulfill({ response: r, body: novo });
    });
  });
  await mau.page.goto(`${base}/`);
  await mau.page.waitForTimeout(5000);
  const confirmou = await mau.page.evaluate(() => window.confirmacoes);
  const temInicio = await mau.page.locator(".mosaico").count();
  await mau.page.close();
  const rebentou = mau.erros.some((e) => e.includes("erro injetado"));
  dizer("1 confirmação do pacote", bom === 1 && trocado && rebentou && temInicio === 0 && confirmou === 0,
    `ecrã bom confirma ${bom} vez; ecrã que rebenta (erro visto ${rebentou}, ecrã inicial ${temInicio}) confirma ${confirmou} vezes`);
}

// ---- 2. sair de uma vista em 360 durante a preparação ----
{
  const { page, erros } = await pagina((p) => p.addInitScript(() => {
    // Um processador gráfico pequeno (a fotografia tem de ser reduzida) e uma leitura de imagem lenta.
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...resto) {
      if (tipo === "webgl" && !this.isConnected) return { MAX_TEXTURE_SIZE: 1, getParameter: () => 2048 };
      return original.call(this, tipo, ...resto);
    };
    const ler = Image.prototype.decode;
    Image.prototype.decode = function () { return new Promise((ok) => setTimeout(ok, 4000)).then(() => ler.call(this)); };
  }));
  await page.goto(`${base}/#jogo=casa`);
  await page.waitForSelector(".casa-tile", { timeout: 15000 });
  await page.locator(".casa-tile").first().click();
  await page.waitForSelector(".casa-ecra", { timeout: 15000 });
  await page.locator(".casa-voltar").click();
  await page.waitForTimeout(500);
  const logo = await page.locator(".casa-ecra").count();
  await page.waitForTimeout(6000);
  const depois = await page.locator(".casa-ecra").count();
  const lista = await page.locator(".casa-tile").count();
  await page.close();
  dizer("2 sair da vista em 360", logo === 0 && depois === 0 && lista > 0 && !erros.length,
    `camada logo depois de voltar ${logo}; depois de a fotografia ficar pronta ${depois}; divisões na lista ${lista}; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
}

// ---- 3. resposta que nunca acaba; 4b. config.json lido de cada vez ----
{
  let token = "velho";
  const vistos = [];
  const { page } = await pagina(async (p) => {
    await p.route("**/media-teste/config.json", (rota) => rota.fulfill({
      contentType: "application/json", body: JSON.stringify({ servidor: base, token }) }));
    await p.route("**/api/registos", (rota) => {
      vistos.push(rota.request().headers().authorization || "");
      return rota.fulfill({ contentType: "application/json", body: JSON.stringify({ aceites: [] }) });
    });
  });
  await page.goto(`${base}/`);
  await page.waitForSelector(".mosaico", { timeout: 15000 });
  await page.evaluate(async () => { const s = await import("/js/sincronizar.js"); await s.enviar(); });
  token = "novo";
  await page.evaluate(async () => { const s = await import("/js/sincronizar.js"); await s.enviar(); });
  const tokens = vistos.map((v) => v.replace("Bearer ", ""));
  dizer("4b config.json lido de cada vez", tokens.length === 2 && tokens[0] === "velho" && tokens[1] === "novo",
    `tokens usados em dois envios: ${tokens.join(", ")}`);

  // O servidor responde com o cabeçalho e depois cala-se. O fetch verdadeiro acaba a leitura do corpo
  // quando o pedido é abortado; o de faz de conta faz o mesmo.
  const preso = await page.evaluate(async () => {
    const s = await import("/js/sincronizar.js");
    const verdadeiro = window.fetch;
    let abortado = false;
    window.fetch = (url, op = {}) => {
      if (!String(url).includes("/api/registos")) return verdadeiro(url, op);
      const corpo = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("{\"aceites\": ["));
          op.signal?.addEventListener("abort", () => { abortado = true; c.error(new DOMException("abortado", "AbortError")); });
        },
      });
      return Promise.resolve(new Response(corpo, { status: 200, headers: { "Content-Type": "application/json" } }));
    };
    const t0 = Date.now();
    const fim = await Promise.race([s.enviar().then(() => "acabou"), new Promise((ok) => setTimeout(() => ok("preso"), 20000))]);
    window.fetch = verdadeiro;
    const seguinte = await Promise.race([s.enviar().then(() => "acabou"), new Promise((ok) => setTimeout(() => ok("preso"), 5000))]);
    return { fim, abortado, segundos: Math.round((Date.now() - t0) / 1000), seguinte };
  });
  await page.close();
  dizer("3 resposta que nunca acaba", preso.fim === "acabou" && preso.abortado && preso.seguinte === "acabou",
    `o envio ${preso.fim} ao fim de ${preso.segundos} s (pedido abortado: ${preso.abortado}); o envio seguinte ${preso.seguinte}`);
}

// ---- 4a. manifesto de media lido outra vez ----
{
  let haManifesto = false;
  const { page } = await pagina((p) => p.route("**/media-teste/manifest.json", (rota) =>
    (haManifesto ? rota.continue() : rota.fulfill({ status: 404, body: "" }))));
  await page.goto(`${base}/`);
  await page.waitForSelector(".mosaico", { timeout: 15000 });
  const fotos = () => page.evaluate(async () => (await (await import("/js/media.js")).manifesto()).fotos.length);
  const antes = await fotos();
  haManifesto = true;
  const cedo = await fotos();
  await page.waitForTimeout(31000);
  const depois = await fotos();
  await page.close();
  dizer("4a manifesto lido outra vez", antes === 0 && cedo === 0 && depois > 0,
    `fotografias sem manifesto ${antes}; logo depois de ele chegar ${cedo}; passados 31 s ${depois}`);
}

// ---- 5. ecrã apagado não é tempo ativo; 6. registos sem nomes ----
{
  const { page, erros } = await pagina((p) => p.addInitScript(() => {
    const agora = Date.now.bind(Date);
    let avanco = 0;
    Date.now = () => agora() + avanco;
    window.avancar = (ms) => { avanco += ms; };
    let visivel = true;
    Object.defineProperty(document, "visibilityState", { get: () => (visivel ? "visible" : "hidden") });
    Object.defineProperty(document, "hidden", { get: () => !visivel });
    window.ecra = (aceso) => { visivel = aceso; document.dispatchEvent(new Event("visibilitychange")); };
  }));
  const registos = () => page.evaluate(() => JSON.parse(localStorage.getItem("mae.v1")).metricas || []);
  const ultimo = async (tipo, jogo) => (await registos()).filter((r) => r.tipo === tipo && r.game === jogo).pop();

  await page.goto(`${base}/#jogo=fotos`);
  await page.waitForSelector(".botao-casa", { timeout: 15000 });
  await page.waitForTimeout(1000);
  // Dois ciclos de apagar e acender, um minuto de cada vez.
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => { window.ecra(false); window.avancar(60000); window.ecra(true); });
    await page.waitForTimeout(700);
  }
  await page.locator(".botao-casa").click();
  await page.waitForSelector(".mosaico", { timeout: 15000 });
  const s = await ultimo("sessao", "fotos");
  dizer("5 ecrã apagado não é tempo ativo",
    !!s && s.screen_off_ms >= 119000 && s.screen_off_ms < 125000 && s.active_ms <= s.duration_ms && s.active_ms < 15000,
    s ? `aceso ${s.duration_ms} ms; apagado ${s.screen_off_ms} ms; ativo ${s.active_ms} ms` : "sem registo de sessão");

  // Música: abrir uma lista e sair. Casa e Passeios: entrar e sair.
  const manifesto = await page.evaluate(async () => (await import("/js/media.js")).manifesto());
  const nomes = [...new Set([
    ...manifesto.musica.map((m) => m.lista), ...manifesto.casa.flatMap((c) => [c.nome, c.id]),
    ...manifesto.passeios.flatMap((c) => [c.nome, c.id, c.grupo]),
  ].filter((n) => typeof n === "string" && n.length > 2))];
  const rondas = [];
  for (const jogo of ["musica", "casa", "passeios"]) {
    await page.goto(`${base}/`);
    await page.goto(`${base}/#jogo=${jogo}`);
    await page.waitForSelector(".botao-casa", { timeout: 15000 });
    await page.waitForTimeout(1500);
    if (jogo === "musica") {
      const lista = page.locator(".mosaico .botao").first();
      if (await lista.count()) { await lista.click(); await page.waitForTimeout(500); }
    }
    await page.locator(".botao-casa").click();
    await page.waitForSelector(".mosaico", { timeout: 15000 });
    rondas.push(await ultimo("ronda", jogo));
  }
  await page.close();
  const texto = JSON.stringify(rondas);
  const escapou = nomes.filter((n) => texto.includes(JSON.stringify(n)));
  const camposVelhos = ["playlists_opened", "places_visited", "spots_visited"].filter((c) => texto.includes(c));
  dizer("6 registos sem nomes", rondas.every(Boolean) && nomes.length > 0 && !escapou.length && !camposVelhos.length && !erros.length,
    `rondas ${rondas.filter(Boolean).length} de 3; nomes procurados ${nomes.length}, encontrados ${escapou.length}; campos antigos: ${camposVelhos.join(" ") || "nenhum"}; erros: ${erros.length ? JSON.stringify(erros) : "nenhum"}`);
}

// ---- 7. resumos a partir do último recomeço ----
{
  const { page } = await pagina();
  await page.goto(`${base}/`);
  await page.waitForSelector(".mosaico", { timeout: 15000 });
  const r = await page.evaluate(async () => {
    const f = await import("/js/familia.js");
    const antes = { tipo: "sessao", game: "pares", active_ms: 300000 };
    const depois = { tipo: "sessao", game: "cores", active_ms: 1000 };
    return {
      comRecomeco: f.desdeRecomeco([antes, { tipo: "reset" }, depois]).map((x) => x.game),
      doisRecomecos: f.desdeRecomeco([antes, { tipo: "reset" }, antes, { tipo: "reset" }]).length,
      semRecomeco: f.desdeRecomeco([antes, depois]).length,
    };
  });
  await page.close();
  dizer("7 resumos desde o recomeço", r.comRecomeco.join() === "cores" && r.doisRecomecos === 0 && r.semRecomeco === 2,
    `depois de um recomeço contam: ${r.comRecomeco.join() || "nada"}; logo a seguir a um recomeço ${r.doisRecomecos}; sem recomeço ${r.semRecomeco}`);
}

await browser.close();
const ok = resultados.every(Boolean);
console.log(ok ? `prémio true (revisão: ${resultados.length} cenários bem)` : "FALHOU");
process.exit(ok ? 0 : 1);
