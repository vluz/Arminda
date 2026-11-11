// Atualizações pela internet: quando procurar, e quando é seguro trocar. O trabalho em si (descarga,
// conferência do sha256 e da assinatura, descomprimir, trocar, voltar atrás, instalar o APK, pacotes
// de media) está nos plugins nativos Atualizar e Media (android/.../Atualizar.java, Media.java). No
// browser não há plugin e nada acontece.
//
// Procura: cerca de 60 s depois de arrancar, de 6 em 6 horas, quando aparece uma rede (o hotspot da
// família numa visita), e a partir do ecrã da família. Só troca num momento seguro: no ecrã inicial
// sem toque há 5 minutos, ou com o tablet escurecido ou o ecrã apagado; nunca dentro de um jogo. Um
// pacote web novo tem de chamar ok() quando o seu ecrã inicial estiver desenhado, senão volta atrás
// sozinho.

// Versão destes ficheiros web. O tools/publicar_atualizacao.py sobe-a quando publica um pacote web;
// não se muda em mais lado nenhum.
export const BUNDLE = 2;

const P = () => window.Capacitor?.Plugins?.Atualizar;
const SEIS_HORAS = 6 * 3600000;
const QUIETO_MS = 5 * 60000;
const CALADO = "atualizar.calado";

let registar = () => {};
let podeAplicar = () => false;
let mediaMudou = () => {};
let pronto = false;
let vigia = null;

// Entrega ao metricas os eventos que o plugin tem em fila (só números e códigos fixos).
async function recolherEventos() {
  const A = P();
  if (!A) return;
  try {
    const { eventos } = await A.eventos();
    for (const e of eventos || []) {
      const { tipo, ...resto } = e;
      if (typeof tipo === "string" && tipo.startsWith("atualizacao_")) registar(tipo, resto);
    }
  } catch { /* fica para a próxima*/ }
}

// Pergunta ao servidor. Devolve a resposta do plugin, ou null sem plugin.
export async function verificar() {
  const A = P();
  if (!A) return null;
  let r;
  try {
    r = await A.verificar({ bundle: BUNDLE });
  } catch {
    r = { resultado: "erro" };
  }
  // Só quando o servidor respondeu (tem_bundle vem preenchido): uma verificação falhada não conta.
  if (typeof r.tem_bundle === "boolean") {
    registar("atualizacao_verificada", { tem_bundle: !!r.tem_bundle, tem_apk: !!r.tem_apk, tem_media: !!r.tem_media });
  }
  await recolherEventos();
  pronto = !!(r.pronto_bundle || r.pronto_apk || r.pronto_media);
  if (pronto) vigiar();
  return r;
}

export async function estado() {
  const A = P();
  if (!A) return null;
  try { return await A.estado(); } catch { return null; }
}

// Trocar já (o botão do ecrã da família, ou a vigia abaixo num momento seguro).
export async function aplicar() {
  const A = P();
  if (!A) return "";
  try {
    // A página recarrega na versão nova: arrancar em silêncio (sem saudação à noite).
    localStorage.setItem(CALADO, String(Date.now()));
  } catch { /* só muda a saudação*/ }
  let r;
  try { r = await A.aplicar(); } catch { r = { aplicado: "" }; }
  if (!r.aplicado || r.aplicado === "media") {
    try { localStorage.removeItem(CALADO); } catch { /* ignorar*/ }
  }
  if (r.media) {
    // Conteúdos novos da família: sem recarregar, a página lê o manifesto novo. Depois procurar outra
    // vez em breve: um tablet que falhou pacotes apanha-os um de cada vez.
    await recolherEventos();
    try { mediaMudou(); } catch { /* o próximo arranque lê-o na mesma*/ }
    setTimeout(verificar, 20000);
  }
  return r.aplicado;
}

// O último arranque veio de uma troca de atualização? Então o ecrã inicial abre em silêncio.
export function comecarCalado() {
  try {
    const t = Number(localStorage.getItem(CALADO) || 0);
    localStorage.removeItem(CALADO);
    return t > 0 && Date.now() - t < 10 * 60000;
  } catch {
    return false;
  }
}

async function tentar() {
  if (!pronto) { clearInterval(vigia); vigia = null; return; }
  if (!podeAplicar(QUIETO_MS)) return;
  pronto = false;
  await aplicar();   // um pacote web recarrega a página; um APK reinicia a app
}

function vigiar() {
  if (vigia) return;
  vigia = setInterval(tentar, 30000);
}

// O ecrã acabou de se apagar (a bateria, a app apaga-o ao fim de 10 minutos de sossego): é o melhor
// momento, por isso tentar já em vez de esperar pelo próximo ciclo de 30 s, que pode só vir depois
// de a pessoa o acordar.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && vigia) setTimeout(tentar, 1000);
});

// O ecrã inicial está desenhado: diz ao plugin que este pacote funciona (acaba a experiência).
export async function confirmar() {
  const A = P();
  if (!A) return;
  try { await A.ok({ bundle: BUNDLE }); } catch { /* a experiência volta atrás sozinha*/ }
  await recolherEventos();
}

// evento(tipo, dados): metricas.evento. seguro(quietoMs): verdadeiro num momento seguro (main.js).
// media(): chamado depois de um pacote de media ser aplicado (o main.js volta a ler a media).
export function iniciar({ evento, seguro, media }) {
  if (!P()) return;
  registar = evento;
  podeAplicar = seguro;
  if (media) mediaMudou = media;
  recolherEventos();
  setTimeout(verificar, 60000);
  setInterval(verificar, SEIS_HORAS);
  window.addEventListener("online", () => setTimeout(verificar, 15000));
  // Uma atualização conferida antes de um reinício é aplicada no arranque pelo próprio plugin; uma
  // que está pronta mas à espera (um pacote web que precisa de um APK mais novo, ou um APK) é
  // apanhada aqui.
  estado().then((s) => { if (s && (s.pendente || s.apkPendente || s.mediaPendente)) { pronto = true; vigiar(); } });
}
