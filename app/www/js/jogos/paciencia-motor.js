// Paciência (Klondike, uma carta de cada vez, voltas sem limite ao monte): regras, distribuições e
// um resolvedor. Sem DOM aqui, para se poder testar sozinho.
// Uma carta é um número: naipe * 13 + (valor - 1). Naipes: 0 copas, 1 ouros, 2 espadas, 3 paus.
// Um jogo: { cols: [{ f: [viradas para baixo], a: [viradas para cima] }], fund: [4 alturas], monte: [], resto: [],
//           max (valor mais alto), naipes: [naipes em jogo] }
// Com uma carta de cada vez e voltas sem limite, chega-se a qualquer carta do monte ou do descarte,
// por isso o resolvedor trata-os como um só conjunto livre (o "talão").

export const naipeDe = (x) => Math.floor(x / 13);
export const valorDe = (x) => (x % 13) + 1;
const vermelho = (x) => naipeDe(x) < 2;

// Os níveis fáceis (livre) aceitam qualquer carta numa coluna vazia, os outros só o valor mais alto;
// os mais fáceis de todos (qualquerCor) descem só pelo número, sem alternar as cores.
export function podePor(x, topo, j) {
  if (topo === undefined) return j.livre || valorDe(x) === j.max;
  return (j.qualquerCor || vermelho(x) !== vermelho(topo)) && valorDe(topo) === valorDe(x) + 1;
}
export const podeSubir = (x, fund) => fund[naipeDe(x)] === valorDe(x) - 1;

function baralhar(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function dar(naipes, max, colunas, livre = false, qualquerCor = false) {
  const cartas = [];
  for (const n of naipes) for (let v = 1; v <= max; v++) cartas.push(n * 13 + v - 1);
  baralhar(cartas);
  const cols = [];
  for (let i = 0; i < colunas; i++) {
    const f = cartas.splice(0, i);
    cols.push({ f, a: [cartas.shift()] });
  }
  return { cols, fund: [0, 0, 0, 0], monte: cartas, resto: [], max, naipes, livre, qualquerCor };
}

export const total = (j) => j.naipes.length * j.max;
export const arrumadas = (j) => j.fund.reduce((s, x) => s + x, 0);
export const ganho = (j) => arrumadas(j) === total(j);

function copiar(j) {
  return { ...j, cols: j.cols.map((c) => ({ f: c.f, a: c.a })), fund: [...j.fund], monte: [...j.monte], resto: [...j.resto] };
}

// Jogadas. { t: "cf", i } o topo da coluna i sobe; { t: "cc", i, k, j } as cartas viradas para cima
// a partir do índice k da coluna i vão para a coluna j; { t: "tf", x } uma carta do monte ou do
// descarte sobe; { t: "tc", x, j } uma carta do monte ou do descarte vai para a coluna j.
export function aplicar(j, m) {
  const s = copiar(j);
  const tirarTalao = (x) => {
    s.monte = s.monte.filter((y) => y !== x);
    s.resto = s.resto.filter((y) => y !== x);
  };
  let virou = false;
  const destapar = (c) => {
    if (!c.a.length && c.f.length) {
      c.a = [c.f[c.f.length - 1]];
      c.f = c.f.slice(0, -1);
      virou = true;
    }
  };
  if (m.t === "cf") {
    const c = s.cols[m.i];
    const x = c.a[c.a.length - 1];
    c.a = c.a.slice(0, -1);
    s.fund[naipeDe(x)]++;
    destapar(c);
  } else if (m.t === "cc") {
    const c = s.cols[m.i];
    const d = s.cols[m.j];
    d.a = d.a.concat(c.a.slice(m.k));
    c.a = c.a.slice(0, m.k);
    destapar(c);
  } else if (m.t === "tf") {
    tirarTalao(m.x);
    s.fund[naipeDe(m.x)]++;
  } else if (m.t === "tc") {
    tirarTalao(m.x);
    s.cols[m.j].a = s.cols[m.j].a.concat([m.x]);
  }
  s.virou = virou;
  return s;
}

const topo = (c) => (c.a.length ? c.a[c.a.length - 1] : undefined);

// Uma carta pode subir em segurança quando as cartas mais baixas da outra cor já subiram.
function seguro(x, j) {
  const v = valorDe(x);
  if (v <= 2) return true;
  return j.naipes.filter((n) => (n < 2) !== (naipeDe(x) < 2)).every((n) => j.fund[n] >= v - 1);
}

// Jogadas candidatas, a melhor primeiro. talao = todas as cartas do monte e do descarte.
export function movimentos(j, talao) {
  const sobe = [];
  const revela = [];
  const doTalao = [];
  const parciais = [];
  const esvazia = [];
  j.cols.forEach((c, i) => {
    const x = topo(c);
    if (x !== undefined && podeSubir(x, j.fund)) {
      const m = { t: "cf", i };
      if (seguro(x, j)) return sobe.unshift(m);
      sobe.push(m);
    }
  });
  if (sobe.length && sobe[0].t === "cf" && seguro(topo(j.cols[sobe[0].i]), j)) return [sobe[0]];
  for (const x of talao) {
    if (podeSubir(x, j.fund)) {
      if (seguro(x, j)) return [{ t: "tf", x }];
      sobe.push({ t: "tf", x });
    }
  }
  j.cols.forEach((c, i) => {
    if (!c.a.length) return;
    for (let k = 0; k < c.a.length; k++) {
      const base = c.a[k];
      j.cols.forEach((d, dj) => {
        if (dj === i || !podePor(base, topo(d), j)) return;
        if (k === 0) {
          if (c.f.length) revela.push({ t: "cc", i, k, j: dj });
          else if (d.a.length) esvazia.push({ t: "cc", i, k, j: dj });
        } else {
          const debaixo = c.a[k - 1];
          if (podeSubir(debaixo, j.fund)) parciais.push({ t: "cc", i, k, j: dj });
        }
      });
    }
  });
  for (const x of talao) {
    j.cols.forEach((d, dj) => { if (podePor(x, topo(d), j)) doTalao.push({ t: "tc", x, j: dj }); });
  }
  return [...sobe, ...revela, ...parciais, ...doTalao, ...esvazia];
}

function chave(j) {
  return j.fund.join(",") + "|" + j.cols.map((c) => `${c.f.length}:${c.a.join(".")}`).sort().join("/");
}

// Encontra uma solução completa (lista de jogadas) em até `limite` posições, ou null.
export function resolver(j, limite = 20000) {
  const visto = new Set();
  let nos = 0;
  const caminho = [];
  const alvo = total(j);
  function dfs(s) {
    if (arrumadas(s) === alvo) return true;
    if (++nos > limite) return false;
    const k = chave(s);
    if (visto.has(k)) return false;
    visto.add(k);
    const talao = s.monte.concat(s.resto);
    for (const m of movimentos(s, talao)) {
      caminho.push(m);
      if (dfs(aplicar(s, m))) return true;
      caminho.pop();
      if (nos > limite) return false;
    }
    return false;
  }
  return dfs(j) ? caminho : null;
}

// Uma distribuição que o resolvedor consegue acabar. Tenta várias; se nenhuma ficar provada,
// devolve a última (a ajuda do gato no jogo garante na mesma que ele acaba).
export function darGanhavel(naipes, max, colunas, livre, qualquerCor, limite, tentativas = 40) {
  let j = null;
  for (let t = 0; t < tentativas; t++) {
    j = dar(naipes, max, colunas, livre, qualquerCor);
    if (resolver(j, limite)) return { jogo: j, provado: true, tentativas: t + 1 };
  }
  return { jogo: j, provado: false, tentativas };
}

// O que um toque na coluna i deve fazer: a jogada sensata para as cartas à vista, ou null.
export function toqueColuna(j, i) {
  const c = j.cols[i];
  if (!c.a.length) return null;
  let melhor = null;
  const propor = (m, pontos) => { if (!melhor || pontos > melhor.pontos) melhor = { m, pontos }; };
  const x = topo(c);
  if (podeSubir(x, j.fund)) propor({ t: "cf", i }, c.a.length === 1 && c.f.length ? 95 : 90);
  for (let k = 0; k < c.a.length; k++) {
    const base = c.a[k];
    j.cols.forEach((d, dj) => {
      if (dj === i || !podePor(base, topo(d), j)) return;
      if (k === 0) {
        if (c.f.length) propor({ t: "cc", i, k, j: dj }, d.a.length ? 100 : 98);
        else if (d.a.length) propor({ t: "cc", i, k, j: dj }, 50);
      } else if (podeSubir(c.a[k - 1], j.fund)) {
        propor({ t: "cc", i, k, j: dj }, 70);
      } else if (j.resto.length && podePor(j.resto[j.resto.length - 1], c.a[k - 1], j)) {
        // Partir uma sequência só ajuda se a carta do descarte puder ir depois para a carta que fica destapada.
        propor({ t: "cc", i, k, j: dj }, 60);
      }
    });
  }
  return melhor ? melhor.m : null;
}

// O que um toque no descarte deve fazer.
export function toqueResto(j) {
  const x = j.resto[j.resto.length - 1];
  if (x === undefined) return null;
  if (podeSubir(x, j.fund)) return { t: "tf", x };
  let vazia = null;
  for (let dj = 0; dj < j.cols.length; dj++) {
    const t = topo(j.cols[dj]);
    if (!podePor(x, t, j)) continue;
    if (t !== undefined) return { t: "tc", x, j: dj };
    if (vazia === null) vazia = dj;
  }
  return vazia === null ? null : { t: "tc", x, j: vazia };
}

// Toque no monte: uma carta para o descarte, ou o descarte de volta ao monte quando este está vazio.
export function tirar(j) {
  const s = copiar(j);
  if (s.monte.length) {
    s.resto.push(s.monte.pop());
    return { jogo: s, voltou: false };
  }
  s.monte = [...s.resto].reverse();
  s.resto = [];
  return { jogo: s, voltou: true };
}

// Todas as cartas viradas para cima e nada no monte: o resto arruma-se sozinho.
export const soFalta = (j) => !j.monte.length && !j.resto.length && j.cols.every((c) => !c.f.length);

// A carta seguinte que pode subir quando está tudo virado para cima (ver soFalta).
export function proximaASubir(j) {
  for (let i = 0; i < j.cols.length; i++) {
    const x = topo(j.cols[i]);
    if (x !== undefined && podeSubir(x, j.fund)) return { t: "cf", i };
  }
  return null;
}

// Ajuda quando já não há solução: pôr logo lá em cima a carta seguinte de que a pessoa precisa,
// esteja onde estiver. As cartas viradas para cima que tiver em cima voltam para debaixo do monte.
export function resgatar(j) {
  const s = copiar(j);
  let alvo = null;
  for (const n of s.naipes) {
    if (s.fund[n] < s.max) { alvo = n * 13 + s.fund[n]; break; }
  }
  if (alvo === null) return s;
  s.monte = s.monte.filter((y) => y !== alvo);
  s.resto = s.resto.filter((y) => y !== alvo);
  for (const c of s.cols) {
    const fi = c.f.indexOf(alvo);
    if (fi >= 0) c.f = c.f.filter((y) => y !== alvo);
    const ai = c.a.indexOf(alvo);
    if (ai >= 0) {
      s.monte = c.a.slice(ai + 1).concat(s.monte);
      c.a = c.a.slice(0, ai);
    }
    if (!c.a.length && c.f.length) {
      c.a = [c.f[c.f.length - 1]];
      c.f = c.f.slice(0, -1);
    }
  }
  s.fund[naipeDe(alvo)]++;
  return s;
}
