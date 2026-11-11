// Moedas e notas para o jogo Feira, desenhadas como formas simples: cores distintas, valor escrito em grande.
// Não são cópias dos desenhos oficiais do euro.

// Valores em cêntimos.
export const MOEDAS = [10, 20, 50, 100, 200];
export const NOTAS = [500, 1000, 2000];

// "2,50 €", "0,50 €", "3 €".
export function formatar(c) {
  const eur = Math.floor(c / 100);
  const cent = c % 100;
  return cent ? `${eur},${String(cent).padStart(2, "0")} €` : `${eur} €`;
}

const COR_MOEDA = {
  10: { fundo: "#d98a4e", aro: null, tam: 0.8 },
  20: { fundo: "#f2c94c", aro: null, tam: 0.86, dentes: true },
  50: { fundo: "#e6a817", aro: null, tam: 0.94 },
  100: { fundo: "#cfd4d9", aro: "#e8c547", tam: 0.9 },
  200: { fundo: "#e8c547", aro: "#cfd4d9", tam: 1 },
};
const COR_NOTA = { 500: "#9fb3a6", 1000: "#e0646a", 2000: "#5b8fe0", };

export function svg(valor) {
  if (valor >= 500) {
    const cor = COR_NOTA[valor] || "#9fb3a6";
    const eur = valor / 100;
    return `<svg viewBox="0 0 180 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="174" height="94" rx="8" fill="${cor}" stroke="#111" stroke-width="5"/>
      <circle cx="30" cy="50" r="17" fill="none" stroke="#fff" stroke-width="4" opacity="0.7"/>
      <path d="M140 20 Q160 50 140 80" fill="none" stroke="#fff" stroke-width="4" opacity="0.7"/>
      <rect x="52" y="18" width="80" height="64" rx="8" fill="#fff" stroke="#111" stroke-width="4"/>
      <text x="92" y="66" font-family="Roboto, Arial, sans-serif" font-weight="900" font-size="44" text-anchor="middle" fill="#111">${eur} €</text>
    </svg>`;
  }
  const c = COR_MOEDA[valor];
  const r = 46 * c.tam;
  const partes = [];
  if (c.aro) {
    partes.push(`<circle cx="50" cy="50" r="${r}" fill="${c.aro}" stroke="#111" stroke-width="4"/>`);
    partes.push(`<circle cx="50" cy="50" r="${r * 0.68}" fill="${c.fundo}" stroke="#111" stroke-width="2.5"/>`);
  } else {
    partes.push(`<circle cx="50" cy="50" r="${r}" fill="${c.fundo}" stroke="#111" stroke-width="4"/>`);
    partes.push(`<circle cx="50" cy="50" r="${r * 0.82}" fill="none" stroke="#111" stroke-width="1.5" opacity="0.45"/>`);
  }
  if (c.dentes) {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const x = 50 + Math.cos(a) * r;
      const y = 50 + Math.sin(a) * r;
      partes.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="#fff6e0" stroke="#111" stroke-width="1.5"/>`);
    }
  }
  if (valor >= 100) {
    partes.push(`<text x="50" y="${50 + r * 0.32}" font-family="Roboto, Arial, sans-serif" font-weight="900" font-size="${r * 0.9}" text-anchor="middle" fill="#111">${valor / 100}€</text>`);
  } else {
    partes.push(`<text x="50" y="${50 + r * 0.18}" font-family="Roboto, Arial, sans-serif" font-weight="900" font-size="${r * 0.82}" text-anchor="middle" fill="#111">${valor}</text>`);
    partes.push(`<text x="50" y="${50 + r * 0.62}" font-family="Roboto, Arial, sans-serif" font-weight="800" font-size="${r * 0.3}" text-anchor="middle" fill="#111">cênt.</text>`);
  }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${partes.join("")}</svg>`;
}

// O menor número de moedas (e notas) para uma quantia, das maiores para as menores.
export function decompor(c, pecas = [2000, 1000, 500, 200, 100, 50, 20, 10]) {
  const r = [];
  for (const p of pecas) {
    while (c >= p) { r.push(p); c -= p; }
  }
  return r;
}
