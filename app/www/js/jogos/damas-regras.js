// Regras das damas portuguesas (damas clássicas), para um tabuleiro de lado N (6 ou 8).
// As pedras movem-se e comem só na diagonal para a frente. As damas movem-se e comem a qualquer
// distância. Comer é obrigatório; tem de se jogar a sequência que come mais peças e, entre essas,
// a que come mais damas. As peças comidas saem do tabuleiro depois da jogada.
// Casas: índice r * N + c, com a fila 0 em cima. As peças da pessoa (1 pedra, 2 dama) começam em
// baixo e sobem; as do computador (-1, -2) começam em cima. Casas escuras: (r + c) par, por isso
// o canto à direita de cada jogador é escuro.

export const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

export function inicial(N) {
  const filas = N === 8 ? 3 : 2;
  const t = new Array(N * N).fill(0);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if ((r + c) % 2) continue;
      if (r < filas) t[r * N + c] = -1;
      else if (r >= N - filas) t[r * N + c] = 1;
    }
  }
  return t;
}

const dentro = (N, r, c) => r >= 0 && r < N && c >= 0 && c < N;
const lado = (v) => Math.sign(v);

// Todas as jogadas legais do lado s (1 a pessoa, -1 o computador).
// Cada jogada: { de, passos: [casas onde pousa], comidas: [casas comidas], damas: damas comidas }.
export function jogadas(t, N, s) {
  const capturas = [];
  const simples = [];
  for (let i = 0; i < t.length; i++) {
    if (lado(t[i]) !== s) continue;
    const dama = Math.abs(t[i]) === 2;
    const r = Math.floor(i / N);
    const c = i % N;
    // Capturas a partir desta casa, em profundidade primeiro.
    const procurar = (pr, pc, passos, comidas, damasComidas) => {
      let continuou = false;
      for (const [dr, dc] of DIAG) {
        if (!dama && dr !== -s) continue; // uma pedra só come para a frente
        if (dama) {
          let rr = pr + dr;
          let cc = pc + dc;
          while (dentro(N, rr, cc) && (t[rr * N + cc] === 0 || rr * N + cc === i)) { rr += dr; cc += dc; }
          if (!dentro(N, rr, cc)) continue;
          const alvo = rr * N + cc;
          if (lado(t[alvo]) !== -s || comidas.includes(alvo)) continue;
          let lr = rr + dr;
          let lc = cc + dc;
          while (dentro(N, lr, lc) && (t[lr * N + lc] === 0 || lr * N + lc === i)) {
            continuou = true;
            procurar(lr, lc, [...passos, lr * N + lc], [...comidas, alvo], damasComidas + (Math.abs(t[alvo]) === 2 ? 1 : 0));
            lr += dr;
            lc += dc;
          }
        } else {
          const mr = pr + dr;
          const mc = pc + dc;
          const lr = pr + 2 * dr;
          const lc = pc + 2 * dc;
          if (!dentro(N, lr, lc)) continue;
          const alvo = mr * N + mc;
          const destino = lr * N + lc;
          if (lado(t[alvo]) !== -s || comidas.includes(alvo)) continue;
          if (t[destino] !== 0 && destino !== i) continue;
          continuou = true;
          procurar(lr, lc, [...passos, destino], [...comidas, alvo], damasComidas + (Math.abs(t[alvo]) === 2 ? 1 : 0));
        }
      }
      if (!continuou && comidas.length) capturas.push({ de: i, passos, comidas, damas: damasComidas });
    };
    procurar(r, c, [], [], 0);
    if (capturas.length) continue;
    for (const [dr, dc] of DIAG) {
      if (!dama && dr !== -s) continue;
      let rr = r + dr;
      let cc = c + dc;
      while (dentro(N, rr, cc) && t[rr * N + cc] === 0) {
        simples.push({ de: i, passos: [rr * N + cc], comidas: [], damas: 0 });
        if (!dama) break;
        rr += dr;
        cc += dc;
      }
    }
  }
  if (!capturas.length) return simples;
  const maxN = Math.max(...capturas.map((m) => m.comidas.length));
  const porN = capturas.filter((m) => m.comidas.length === maxN);
  const maxD = Math.max(...porN.map((m) => m.damas));
  return porN.filter((m) => m.damas === maxD);
}

// Aplica uma jogada e devolve o tabuleiro novo. Uma pedra que acaba na última fila vira dama.
export function aplicar(t, N, m) {
  const n = [...t];
  const v = n[m.de];
  n[m.de] = 0;
  for (const x of m.comidas) n[x] = 0;
  const fim = m.passos[m.passos.length - 1];
  const r = Math.floor(fim / N);
  const s = lado(v);
  n[fim] = Math.abs(v) === 1 && ((s === 1 && r === 0) || (s === -1 && r === N - 1)) ? 2 * s : v;
  return n;
}

// Material do ponto de vista do computador, com um pequeno crédito por avançar as pedras.
function avaliar(t, N) {
  let p = 0;
  for (let i = 0; i < t.length; i++) {
    const v = t[i];
    if (!v) continue;
    const r = Math.floor(i / N);
    const c = i % N;
    const centro = (c > 0 && c < N - 1) ? 3 : 0;
    if (v === -1) p += 100 + r * 4 + centro;
    else if (v === -2) p += 280;
    else if (v === 1) p -= 100 + (N - 1 - r) * 4 + centro;
    else p -= 280;
  }
  return p;
}

function minimax(t, N, prof, s, alfa, beta, conta) {
  const ms = jogadas(t, N, s);
  if (!ms.length) return s === -1 ? -100000 - prof : 100000 + prof;
  if (prof === 0 || conta.n > 40000) return avaliar(t, N);
  conta.n++;
  if (s === -1) {
    let melhor = -Infinity;
    for (const m of ms) {
      melhor = Math.max(melhor, minimax(aplicar(t, N, m), N, prof - 1, 1, alfa, beta, conta));
      alfa = Math.max(alfa, melhor);
      if (alfa >= beta) break;
    }
    return melhor;
  }
  let melhor = Infinity;
  for (const m of ms) {
    melhor = Math.min(melhor, minimax(aplicar(t, N, m), N, prof - 1, -1, alfa, beta, conta));
    beta = Math.min(beta, melhor);
    if (alfa >= beta) break;
  }
  return melhor;
}

// A escolha do computador. prof 0: ao acaso; 1 ou mais: olha esse número de meias jogadas à frente.
// ruido junta acaso às pontuações, para os níveis mais fracos fazerem erros com ar humano.
export function escolher(t, N, prof, ruido) {
  const ms = jogadas(t, N, -1);
  if (!ms.length) return null;
  if (prof === 0) return ms[Math.floor(Math.random() * ms.length)];
  const conta = { n: 0 };
  let melhor = null;
  let melhorP = -Infinity;
  for (const m of ms) {
    const p = minimax(aplicar(t, N, m), N, prof - 1, 1, -Infinity, Infinity, conta) + Math.random() * ruido;
    if (p > melhorP) { melhorP = p; melhor = m; }
  }
  return melhor;
}
