// Mede cada região dos azulejos do jogo Azulejos: o círculo mais largo que cabe dentro da parte
// visível de cada região, em unidades do azulejo (o azulejo tem 100 unidades de largura). Multiplicar
// por px do azulejo / 100 para ter o alvo do dedo. Correr em tools/testes (depois de npm install nessa pasta):  node pintar-regioes.mjs <porta>
import { chromium } from "playwright";

const [porta = "8787"] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${porta}/index.html#nada`);
const res = await page.evaluate(async () => {
  const { MOTIVOS } = await import("/js/jogos/pintar-motivos.js");
  const S = 4; // px por unidade
  const L = 100 * S;
  const out = [];
  for (const m of MOTIVOS) {
    const c = document.createElement("canvas");
    c.width = L; c.height = L;
    const g = c.getContext("2d");
    g.scale(S, S);
    g.fillStyle = "rgb(0,0,0)";
    g.fillRect(0, 0, 100, 100);
    m.regioes.forEach((d, i) => { g.fillStyle = `rgb(${i + 1},0,0)`; g.fill(new Path2D(d)); });
    for (const f of m.fixo || []) {
      g.fillStyle = "rgb(250,0,0)";
      if (f.cor !== "none") g.fill(new Path2D(f.d));
      if (f.traco) { g.strokeStyle = "rgb(250,0,0)"; g.lineWidth = f.largura || 1; g.stroke(new Path2D(f.d)); }
    }
    const px = g.getImageData(0, 0, L, L).data;
    const lab = new Int16Array(L * L);
    for (let k = 0; k < L * L; k++) lab[k] = px[k * 4 + 1] || px[k * 4 + 2] ? -1 : px[k * 4];
    const tam = [];
    for (let i = 0; i < m.regioes.length; i++) {
      // Distância aproximada (chamfer) ao píxel mais próximo fora da região i (a borda do azulejo conta como fora).
      const D = new Float32Array(L * L);
      for (let k = 0; k < L * L; k++) D[k] = lab[k] === i + 1 ? 1e9 : 0;
      const at = (x, y) => (x < 0 || y < 0 || x >= L || y >= L ? 0 : D[y * L + x]);
      for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
        const k = y * L + x;
        if (!D[k]) continue;
        D[k] = Math.min(D[k], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
      }
      let max = 0;
      for (let y = L - 1; y >= 0; y--) for (let x = L - 1; x >= 0; x--) {
        const k = y * L + x;
        if (!D[k]) continue;
        D[k] = Math.min(D[k], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
        if (D[k] > max) max = D[k];
      }
      tam.push(Math.round((2 * max) / S));
    }
    out.push({ id: m.id, grupo: m.grupo, diametros: tam, menor: Math.min(...tam) });
  }
  return out;
});
for (const r of res) console.log(`${r.id.padEnd(14)} ${r.grupo.padEnd(7)} mais pequeno ${String(r.menor).padStart(3)} unidades; regiões ${r.diametros.join(" ")}`);
await browser.close();
