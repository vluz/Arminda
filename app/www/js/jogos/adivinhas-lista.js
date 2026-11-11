// Adivinhas: as adivinhas. A adivinha que a pessoa ouve é a frase "adivinhas.r_<id>", e a frase da
// resposta é "adivinhas.s_<id>" (tools/falas/adivinhas.json).
// grau 1: fáceis, escritas para este jogo; 2 e 3: quase todas adivinhas populares portuguesas;
// 4: adivinhas cuja resposta não tem imagem (só respostas em texto).
// resposta: id da imagem (img/noto, ou img/proprio para o galo); perto: distrações parecidas
// (ids de imagens, ou palavras no grau 4); evitar: imagens nunca dadas como distrações fáceis.

const PROPRIO = new Set(["galo"]);
export const figura = (id) => `img/${PROPRIO.has(id) ? "proprio" : "noto"}/${id}.svg`;

// Nomes com o artigo, para os níveis com respostas em texto.
export const NOMES = {
  vaca: "a vaca", ovelha: "a ovelha", cabra: "a cabra", porco: "o porco", abelha: "a abelha",
  borboleta: "a borboleta", joaninha: "a joaninha", formiga: "a formiga", guarda_chuva: "o guarda-chuva",
  chapeu: "o chapéu", bota: "a bota", cachecol: "o cachecol", banana: "a banana", limao: "o limão",
  milho: "o milho", pera: "a pera", sol: "o sol", lua: "a lua", estrela: "a estrela", fogo: "o fogo",
  caracol: "o caracol", sapo: "o sapo", galo: "o galo", galinha: "a galinha", pato: "o pato",
  passaro: "o pássaro", queijo: "o queijo", manteiga: "a manteiga", leite: "o leite", pao: "o pão",
  chave: "a chave", porta: "a porta", janela: "a janela", relogio: "o relógio", ovo: "o ovo",
  pintainho: "o pintainho", ninho: "o ninho", comboio: "o comboio", autocarro: "o autocarro",
  carro: "o carro", aviao: "o avião", cogumelo: "o cogumelo", couve: "a couve", cebola: "a cebola",
  vela: "a vela", lampada: "a lâmpada", lanterna: "a lanterna", livro: "o livro", caderno: "o caderno",
  arvore: "a árvore", folha_seca: "a folha", agulha: "a agulha", tesoura: "a tesoura",
  carrinho_linha: "o carrinho de linhas", novelo: "o novelo", cereja: "a cereja", morango: "o morango",
  tomate: "o tomate", maca: "a maçã", telefone: "o telefone", cadeira: "a cadeira", sofa: "o sofá",
  cama: "a cama", escada: "a escada", polvo: "o polvo", lula: "a lula", caranguejo: "o caranguejo",
  peixe: "o peixe", luva: "a luva", meias: "as meias", sapato: "o sapato", balao: "o balão",
  erva: "a erva", girassol: "o girassol", nuvem: "a nuvem", alho: "o alho", batata: "a batata",
  dente: "o dente", ananas: "o ananás", rei: "o rei", melancia: "a melancia", bule: "o bule",
  cafe: "o café", tigela: "a tigela", croissant: "o croissant", bolo: "o bolo", castanha: "a castanha",
  ourico: "o ouriço", faca: "a faca", pente: "o pente", escova_dentes: "a escova de dentes",
  garrafa: "a garrafa", taca: "a taça", papagaio: "o papagaio de papel", helicoptero: "o helicóptero",
  serrote: "o serrote",
};

const a = (id, grau, perto, evitar = "") => ({
  id, grau, resposta: id, perto: perto.split(" "), evitar: evitar ? evitar.split(" ") : [],
});
const t = (id, nome, perto) => ({ id, grau: 4, nome, perto: perto.split("|"), evitar: [] });

export const ADIVINHAS = [
  // 1: fáceis
  a("vaca", 1, "ovelha cabra porco"),
  a("abelha", 1, "borboleta joaninha formiga"),
  a("guarda_chuva", 1, "chapeu bota cachecol"),
  a("banana", 1, "limao milho pera"),
  a("sol", 1, "lua estrela fogo", "vela"),
  a("caracol", 1, "joaninha sapo formiga"),
  a("galo", 1, "galinha pato passaro"),
  a("queijo", 1, "manteiga leite pao"),
  a("chave", 1, "porta janela relogio", "pente alho"),
  a("ovo", 1, "pintainho galinha ninho"),
  a("comboio", 1, "autocarro carro aviao"),
  // 2: médias
  a("cogumelo", 2, "chapeu couve cebola"),
  a("vela", 2, "lampada lanterna fogo", "sol lua"),
  a("livro", 2, "caderno arvore folha_seca"),
  a("agulha", 2, "tesoura carrinho_linha novelo"),
  a("cereja", 2, "morango tomate maca"),
  a("relogio", 2, "telefone lampada sol"),
  a("cadeira", 2, "sofa cama escada"),
  a("polvo", 2, "lula caranguejo peixe"),
  a("luva", 2, "meias cachecol sapato"),
  a("escada", 2, "cadeira porta balao"),
  a("folha_seca", 2, "arvore erva girassol", "livro castanha"),
  a("lua", 2, "sol estrela nuvem"),
  // 3: mais difíceis, quase todas tradicionais
  a("alho", 3, "cebola batata dente", "pente chave"),
  a("ananas", 3, "rei peixe melancia", "dente"),
  a("dente", 3, "rei arvore alho", "ananas"),
  a("bule", 3, "passaro cafe tigela"),
  a("pao", 3, "croissant bolo cafe"),
  a("castanha", 3, "ourico ovo batata"),
  a("cebola", 3, "alho batata faca"),
  a("pente", 3, "escova_dentes chave alho"),
  a("garrafa", 3, "taca leite bule"),
  a("papagaio", 3, "balao aviao passaro"),
  a("aviao", 3, "helicoptero balao passaro", "papagaio"),
  a("tesoura", 3, "faca agulha serrote"),
  a("sapato", 3, "meias chapeu luva"),
  // 4: só respostas em texto
  t("buraco", "o buraco", "o bolo|o monte|a saca de arroz"),
  t("silencio", "o silêncio", "o vidro|o segredo|o espelho"),
  t("rio", "o rio", "o mar|o vento|o caminho"),
  t("sombra", "a sombra", "o sabonete|o peixe|o vento"),
  t("letra_u", "a letra U", "o passeio|o candeeiro|a letra R"),
  t("letra_v", "a letra V", "a gema|a clara|a letra O"),
  t("baralho", "o baralho de cartas", "o pão|o bolo|a toalha"),
  t("selo", "o selo", "o avião|o carteiro|o globo"),
  t("toalha", "a toalha", "a esponja|o guarda-chuva|a roupa estendida"),
  t("amanha", "o amanhã", "o comboio|o carteiro|o domingo"),
  t("luz", "a luz", "a mobília|a água|o pó"),
  t("idade", "a idade", "o elevador|a escada|a maré"),
  t("nome", "o teu nome", "o teu chapéu|a tua casa|o teu telefone"),
  t("partir", "o ovo", "o copo|o prato|a garrafa"),
  t("segredo", "o segredo", "o pão|o dinheiro|o abraço"),
  t("pegadas", "as pegadas", "o caminho|o cansaço|a sombra"),
  t("vento", "o vento", "a chuva|o frio|o pássaro"),
  t("eco", "o eco", "o rádio|o relógio|o telefone"),
];
