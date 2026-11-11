// Tudo o que a app lembra de uma sessão para a outra, guardado em localStorage.

const CHAVE = "mae.v1";

let dados = carregar();

function carregar() {
  let d;
  try {
    d = JSON.parse(localStorage.getItem(CHAVE)) || {};
  } catch {
    d = {};
  }
  // A versão 0.6.0 guardava "config.jogador" ("mae"/"pai"); agora a definição é "config.pessoa" ("1"/"2").
  if ("config.jogador" in d && !("config.pessoa" in d)) {
    d["config.pessoa"] = d["config.jogador"] === "pai" ? "2" : "1";
    delete d["config.jogador"];
  }
  return d;
}

function guardar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados));
  } catch {
    // Armazenamento cheio ou bloqueado: os jogos funcionam na mesma, só o progresso é que não fica.
  }
}

export function ler(chave, padrao) {
  return chave in dados ? dados[chave] : padrao;
}

export function gravar(chave, valor) {
  dados[chave] = valor;
  guardar();
}

// Várias chaves de uma vez, guardadas numa só escrita (o armazém é um único bloco JSON, por isso
// cada gravação o reescreve todo).
export function gravarVarios(pares) {
  Object.assign(dados, pares);
  guardar();
}

// Todas as chaves do armazém (ecrã da família: o recomeço para a entrega).
export function chaves() {
  return Object.keys(dados);
}

// Remove chaves e guarda uma vez.
export function apagar(lista) {
  for (const k of lista) delete dados[k];
  guardar();
}

export function idDispositivo() {
  let id = ler("dispositivo");
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
    gravar("dispositivo", id);
  }
  return id;
}

// Nível de início de cada jogo, definido uma vez no arranque a partir da lista de jogos.
const inicios = {};
export function definirInicios(mapa) {
  Object.assign(inicios, mapa);
  // As versões antigas começavam todos os jogos no nível 1. Subir uma vez os níveis guardados para o
  // novo início.
  if (!ler("migracao.niveis2")) {
    for (const [jogo, n] of Object.entries(mapa)) {
      if (ler(`nivel.${jogo}`, 0) < n) gravar(`nivel.${jogo}`, n);
    }
    gravar("migracao.niveis2", true);
  }
}

// Dificuldade silenciosa: cada jogo tem um nível de 1 até ao seu máximo. Regra da família: subir
// depressa, passar do ponto não faz mal, fácil demais é que é o risco a sério.
// - Uma ronda completa que não foi difícil vale 1 ponto, uma claramente fácil vale 3; aos 3 pontos, sobe um.
// - Uma ronda claramente difícil: desce um.
// - Uma ronda deixada a meio não muda nada (uma interrupção não é sinal de que era difícil demais).
const PONTOS_PARA_SUBIR = 3;
const DIFICEIS_PARA_DESCER = 1;

// Nível de topo de cada jogo (NIVEIS_MAX), definido uma vez no arranque. Um nível guardado acima
// dele (um jogo que perdeu níveis numa atualização) lê-se como o nível de topo, em vez de estragar o jogo.
const maximos = {};
export function definirMaximos(mapa) {
  Object.assign(maximos, mapa);
}

export function nivel(jogo) {
  const n = ler(`nivel.${jogo}`, inicios[jogo] || 1);
  const maximo = maximos[jogo];
  return Math.max(1, maximo ? Math.min(n, maximo) : n);
}

// O resultado da última ronda, lido pelo ecrã do prémio (estrelas, subida de nível, marcos).
let ultima = null;
export function ultimaRonda() {
  return ultima && Date.now() - ultima.quando < 60000 ? ultima : null;
}

export function ajustarNivel(jogo, maximo, { completo, facil, dificil }) {
  const antes = nivel(jogo);
  let n = antes;
  const p = ler(`progresso.${jogo}`, { pontos: 0, dificeis: 0 });
  if (completo && !dificil) {
    p.dificeis = 0;
    p.pontos += facil ? 3 : 1;
    if (p.pontos >= PONTOS_PARA_SUBIR && n < maximo) { n += 1; p.pontos = 0; }
  } else if (completo && dificil) {
    // Só uma ronda acabada pode ser difícil: sair a meio nunca custa um nível.
    p.pontos = 0;
    p.dificeis += 1;
    if (p.dificeis >= DIFICEIS_PARA_DESCER) { n -= 1; p.dificeis = 0; }
  }
  n = Math.max(1, Math.min(maximo, n));
  // Uma só gravação para todas as chaves: o armazém é um único bloco JSON, reescrito inteiro de cada vez.
  const novos = { [`nivel.${jogo}`]: n, [`progresso.${jogo}`]: p };
  if (completo) {
    const vitorias = ler(`vitorias.${jogo}`, 0) + 1;
    const seguidas = ler(`seguidas.${jogo}`, 0) + 1;
    novos[`vitorias.${jogo}`] = vitorias;
    novos[`seguidas.${jogo}`] = seguidas;
    ultima = {
      jogo, quando: Date.now(), subiu: n > antes, vitorias, seguidas,
      estrelas: facil ? 3 : dificil ? 1 : 2,
    };
  } else {
    novos[`seguidas.${jogo}`] = 0;
    ultima = null;
  }
  gravarVarios(novos);
  // Para os registos da família (o metricas.js está à escuta): como a regra avaliou uma ronda acabada.
  if (completo) {
    window.dispatchEvent(new CustomEvent("mae:nivel", {
      detail: {
        game: jogo, level_before: antes, level_after: n, max_level: maximo,
        outcome: facil ? "facil" : dificil ? "dificil" : "normal", points: p.pontos,
      },
    }));
  }
  return n;
}
