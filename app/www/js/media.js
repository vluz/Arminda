// Conteúdos da família (fotografias, música, imagens em 360 da casa, os nomes para o Quem é quem),
// guardados fora da app para se poderem acrescentar sem a construir outra vez. O
// tools/enviar_media.py prepara os ficheiros no PC; chegam ao tablet em pacotes de media pela
// internet (Media.java) ou pelo adb, com um manifesto na pasta da própria app, que não precisa de
// permissões do Android.
// Num browser de computador (testes) lê-se a mesma arrumação em www/media-teste/.

const PASTA_ANDROID = "/storage/emulated/0/Android/data/pt.mae.jogos/files/media/";

// O manifesto lido vale por pouco tempo: os conteúdos também chegam por USB com a app aberta
// (tools/enviar_media.py), e uma leitura falhada (ainda não havia manifesto) não pode ficar para sempre.
const VALIDADE_MS = 30000;

let cache = null;
let lidoEm = 0;

// Os caminhos no manifesto são relativos à pasta de media, ou absolutos ("/storage/...")
// quando os ficheiros estão no cartão de memória.
export function url(caminho) {
  const C = window.Capacitor;
  if (C?.isNativePlatform?.()) return C.convertFileSrc(caminho.startsWith("/") ? caminho : PASTA_ANDROID + caminho);
  return "media-teste/" + caminho;
}

// { fotos: [{ ficheiro, legenda, voz, numero? }], musica: [{ ficheiro, titulo, artista, lista }],
//   casa: [{ id, nome, ficheiro, voz, inicio, ligacoes: [{ para, yaw }] }], passeios: [... grupo],
//   quem: [{ ficheiro, numero, nome, falsos: [nome], vozes: { nome: { opcao, ou } }, voz_olha, voz_quem }],
//   versao_media }
export async function manifesto() {
  if (cache && Date.now() - lidoEm < VALIDADE_MS) return cache;
  let novo;
  try {
    const r = await fetch(url("manifest.json"), { cache: "no-store" });
    novo = await r.json();
  } catch {
    novo = {};
  }
  novo.fotos ||= [];
  novo.musica ||= [];
  novo.casa ||= [];
  novo.passeios ||= [];
  novo.quem ||= [];
  cache = novo;
  lidoEm = Date.now();
  return cache;
}

// Esquecer o manifesto lido até agora (acabou de ser aplicado um pacote de media).
export function limpar() {
  cache = null;
  lidoEm = 0;
}

// Endereços absolutos das fotografias da família, pela ordem da lista. Vazio quando não há nenhuma.
export async function fotosFamilia() {
  return (await manifesto()).fotos.map((f) => url(f.ficheiro));
}
