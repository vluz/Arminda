// Confere as definições da pessoa de tools/falas.py (data/pessoa.json): com config.pessoa = "2" o
// ecrã inicial saúda a segunda pessoa, os elogios tomam o género dela, cada gémea "__2" resolve e o
// seu ficheiro de voz existe, nenhuma frase fica com o tratamento da primeira pessoa, os níveis de
// início não mudam e os registos levam player "2"; com "1" fica tudo como definido para a primeira pessoa.
// Confere também a migração da 0.6.0, de config.jogador ("pai") para config.pessoa ("2").
// Correr em tools/testes (depois de npm install nessa pasta):  node pessoa.mjs <porta>
import { chromium } from "playwright";

const porta = process.argv[2] || "8765";
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let falhas = 0;
const ver = (nome, ok, extra = "") => { console.log(`${ok ? "ok  " : "FALHOU"} ${nome}${extra ? `: ${extra}` : ""}`); if (!ok) falhas++; };

const pessoa = JSON.parse(await (await fetch(`http://127.0.0.1:${porta}/data/pessoa.json`)).text());
const casos = [["2", { "config.pessoa": "2" }], ["1", { "config.pessoa": "1" }], ["migra", { "config.jogador": "pai" }]];
for (const [caso, inicial] of casos) {
  const quem = caso === "1" ? "1" : "2";
  const p = pessoa[quem];
  const page = await browser.newPage({ viewport: { width: 1024, height: 600 }, hasTouch: true });
  const erros = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  page.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/voz/")) erros.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript((i) => localStorage.setItem("mae.v1", JSON.stringify(i)), inicial);
  await page.goto(`http://127.0.0.1:${porta}/`);
  await page.waitForTimeout(2500);
  const balao = (await page.textContent(".balao")).trim();
  ver(`${caso}: saudação do primeiro ecrã`, balao === p.saudacao, balao);
  ver(`${caso}: título da página`, (await page.title()) === p.titulo, await page.title());
  const r = await page.evaluate(async (q) => {
    const som = await import("./js/som.js");
    const estado = await import("./js/estado.js");
    const metricas = await import("./js/metricas.js");
    metricas.evento("teste");
    const fila = estado.ler("metricas", []);
    const dados = await (await fetch("data/falas.json")).json();
    const twins = [], semVoz = [];
    for (const [sec, linhas] of Object.entries(dados)) {
      for (const l of linhas) {
        if (!l.id.endsWith("__2")) continue;
        const base = l.id.slice(0, -3);
        twins.push([base, som.texto(base) === (q === "2" ? l.texto : linhas.find((x) => x.id === base).texto)]);
        const resp = await fetch("voz/tts/" + sec + "/" + l.id.split(".").slice(1).join(".") + ".ogg").catch(() => null);
        if (!resp || !resp.ok) semVoz.push(l.id);
      }
    }
    return {
      quem: som.quem(), campea: som.texto("geral.campea"), ola: som.texto("intro.ola"), casa: som.texto("casa.ola"),
      pares: estado.nivel("pares"), jardim: estado.nivel("jardim"), sopa: estado.nivel("sopa"),
      player: fila[fila.length - 1].player, pessoaGuardada: estado.ler("config.pessoa"), jogadorAntigo: estado.ler("config.jogador"),
      twins: twins.length, twinsErrados: twins.filter((t) => !t[1]).map((t) => t[0]), semVoz,
      // Todas as frases na forma escolhida: nenhuma pode ficar com o tratamento da outra pessoa.
      outro: Object.values(dados).flat().filter((l) => !l.id.endsWith("__2")).map((l) => som.texto(l.id)),
    };
  }, quem);
  const outroT = pessoa[quem === "1" ? "2" : "1"].tratamento;
  // O tratamento vem sempre depois de uma vírgula ("Olá, mãe!"); a palavra sozinha pode ser de um ditado.
  const vazam = r.outro.filter((t) => t.includes(`, ${outroT}!`));
  ver(`${caso}: som.quem()`, r.quem === quem, r.quem);
  ver(`${caso}: elogio no género certo`, r.campea === (p.genero === "f" ? "És uma campeã!" : "És um campeão!"), r.campea);
  ver(`${caso}: frase da introdução`, r.ola === `Olá, ${p.tratamento}! Este tablet é só para ti.`, r.ola);
  ver(`${caso}: frase da casa`, r.casa === (p.genero === "f" ? "Bem-vinda a casa!" : "Bem-vindo a casa!"), r.casa);
  ver(`${caso}: todas as gémeas resolvem (${r.twins})`, r.twinsErrados.length === 0, r.twinsErrados.join(" "));
  ver(`${caso}: todas as gémeas têm ficheiro de voz`, r.semVoz.length === 0, r.semVoz.join(" "));
  ver(`${caso}: nenhuma frase diz "${outroT}"`, vazam.length === 0, vazam.slice(0, 3).join(" | "));
  ver(`${caso}: os pares começam no 3`, r.pares === 3, String(r.pares));
  ver(`${caso}: a sopa começa no 2`, r.sopa === 2, String(r.sopa));
  ver(`${caso}: o jardim começa no 1`, r.jardim === 1, String(r.jardim));
  ver(`${caso}: o registo leva player`, r.player === quem, String(r.player));
  if (caso === "migra") {
    ver("migra: config.pessoa definido a partir de config.jogador", r.pessoaGuardada === "2", String(r.pessoaGuardada));
    ver("migra: config.jogador removido", r.jogadorAntigo === undefined, String(r.jogadorAntigo));
  }
  if (caso === "2") { await page.click("button.cor-verde"); await page.waitForTimeout(4000); }   // a voz da gémea tem de tocar
  ver(`${caso}: sem erros da página nem ficheiros de voz em falta`, erros.length === 0, erros.join(" | "));
  await page.close();
}
await browser.close();
console.log(falhas ? `FALHOU ${falhas}` : "tudo bem");
process.exit(falhas ? 1 : 0);
