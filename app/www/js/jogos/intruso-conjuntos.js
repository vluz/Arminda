// O intruso: os conjuntos. Cada conjunto tem um grupo (membros, mais do que o ecrã mostra, para as
// rondas variarem) e um intruso. A razão que o gato diz depois da resposta é a frase "intruso.r_<id>".
// grau 1: óbvio (fruta e um carro); 2: categorias próximas (fruta e um legume, cozinha e casa de banho);
// 3: por uma propriedade (coisas que voam, coisas frias); 4: palavras; 5: palavras com duas regras
// (o intruso serve a uma delas, por isso à primeira vista parece certo).

// Imagens de img/proprio; todos os outros ids de imagem são img/noto/<id>.svg.
const PROPRIO = new Set(["bola", "cartas", "cravo", "eletrico", "galo", "guitarra", "margarida", "pastel_nata", "sardinha"]);
export const figura = (id) => `img/${PROPRIO.has(id) ? "proprio" : "noto"}/${id}.svg`;

const f = (id, grau, membros, intruso) => ({ id, grau, membros: membros.split(" "), intruso });
const p = (id, grau, membros, intruso) => ({ id, grau, membros: membros.split("|"), intruso, palavras: true });

export const CONJUNTOS = [
  // 1: óbvio
  f("o_fruta", 1, "maca banana pera laranja uvas morango", "carro"),
  f("o_animais", 1, "cao gato vaca porco ovelha cavalo", "cadeira"),
  f("o_flores", 1, "rosa tulipa girassol malmequer hibisco margarida", "autocarro"),
  f("o_transportes", 1, "carro autocarro comboio aviao barco bicicleta", "banana"),
  f("o_doces", 1, "bolo pudim queque chocolate fatia_bolo pastel_nata", "sapato"),
  f("o_calcado", 1, "sapato bota sandalia sapato_salto", "peixe"),
  f("o_cabeca", 1, "chapeu cartola bone coroa", "cenoura"),
  f("o_ceu", 1, "sol lua estrela nuvem arco_iris", "telefone"),
  f("o_aves", 1, "passaro galinha pato pintainho galo pinguim", "elefante"),
  f("o_mar", 1, "peixe peixe_tropical polvo caranguejo baleia golfinho", "leao"),
  f("o_coracoes", 1, "coracao coracao_azul coracao_verde coracao_amarelo coracao_roxo coracao_laranja", "maca"),
  f("o_bebidas", 1, "cafe cha leite vinho", "livro"),
  f("o_musica", 1, "guitarra piano trompete tambor violino acordeao", "tomate"),
  f("o_casa", 1, "cadeira cama sofa janela porta", "vaca"),
  f("o_legumes", 1, "cenoura batata cebola couve pepino brocolos", "bicicleta"),
  f("o_roupa", 1, "calcas vestido camisola cachecol meias luva", "ovo"),

  // 2: categorias próximas
  f("p_fruta", 2, "maca banana pera laranja uvas morango cereja ananas pessego", "cenoura"),
  f("p_legumes", 2, "cenoura batata cebola couve pepino brocolos alho beringela", "morango"),
  f("p_mar", 2, "peixe polvo caranguejo baleia golfinho tubarao lula", "sapo"),
  f("p_quinta", 2, "vaca porco ovelha galinha cabra cavalo coelho", "girafa"),
  f("p_selva", 2, "leao elefante macaco girafa tigre zebra", "vaca"),
  f("p_cozinha", 2, "talheres frigideira colher tigela bule faca", "sanita"),
  f("p_banho", 2, "sanita banheira chuveiro sabonete escova_dentes rolo_papel", "frigideira"),
  f("p_roupa", 2, "calcas vestido camisola cachecol meias luva", "oculos"),
  f("p_flores", 2, "rosa tulipa girassol malmequer hibisco flor_cerejeira cravo", "couve"),
  f("p_aves", 2, "passaro galinha pato pintainho pinguim galo", "morcego"),
  f("p_insetos", 2, "abelha borboleta joaninha formiga", "caracol"),
  f("p_doces", 2, "bolo pudim queque chocolate gelado pastel_nata fatia_bolo", "queijo"),
  f("p_musica", 2, "guitarra piano trompete tambor violino acordeao", "telefone"),
  f("p_terra", 2, "carro autocarro comboio taxi trator bicicleta carrinha", "barco"),
  f("p_calcado", 2, "sapato bota sandalia sapato_salto", "meias"),
  f("p_escola", 2, "lapis livro tesoura regua caderno caneta", "colher"),
  f("p_cabeca", 2, "chapeu cartola bone coroa", "luva"),

  // 3: por uma propriedade
  f("q_voam", 3, "aviao passaro borboleta abelha helicoptero balao papagaio", "tartaruga"),
  f("q_frio", 3, "gelado boneco_neve gelo floco_neve", "cafe"),
  f("q_quente", 3, "fogo sol cafe cha vela", "gelado"),
  f("q_redondo", 3, "bola laranja moeda tomate sol", "livro"),
  f("q_rodas", 3, "carro bicicleta trator autocarro comboio taxi", "barco"),
  f("q_luz", 3, "sol vela lampada lanterna estrela fogo", "nuvem"),
  f("q_picam", 3, "abelha cato agulha ourico", "borboleta"),
  f("q_abrem", 3, "porta janela livro guarda_chuva", "colher"),
  f("q_cortam", 3, "tesoura faca serrote", "colher"),
  f("q_quatro_pernas", 3, "cadeira cao cavalo vaca gato porco", "galinha"),
  f("q_amarelos", 3, "banana limao pintainho_frente girassol queijo coracao_amarelo", "maca"),
  f("q_verdes", 3, "sapo maca_verde pepino couve brocolos cato", "cenoura"),
  f("q_brancos", 3, "ovelha nuvem dente boneco_neve leite rolo_papel", "chocolate"),
  f("q_crescem", 3, "arvore girassol erva couve tulipa cogumelo", "pedra"),
  f("q_penas", 3, "galinha pato passaro pinguim galo pintainho", "borboleta"),
  f("q_agua", 3, "peixe polvo baleia golfinho tubarao caranguejo", "gato"),
  f("q_leite", 3, "vaca cabra ovelha", "galinha"),
  f("q_doce", 3, "mel bolo chocolate gelado queque", "sal"),

  // 4: palavras
  p("w_meses", 4, "Janeiro|Março|Maio|Julho|Outubro|Dezembro", "Domingo"),
  p("w_dias", 4, "Segunda|Terça|Quarta|Quinta|Sexta", "Agosto"),
  p("w_rios", 4, "Tejo|Douro|Mondego|Minho|Guadiana|Vouga", "Lisboa"),
  p("w_cidades", 4, "Lisboa|Porto|Coimbra|Braga|Faro|Évora", "Madrid"),
  p("w_cores", 4, "Vermelho|Azul|Amarelo|Verde|Roxo|Castanho", "Redondo"),
  p("w_profissoes", 4, "Padeiro|Médico|Carteiro|Pescador|Costureira|Enfermeira", "Laranjeira"),
  p("w_arvores", 4, "Pinheiro|Oliveira|Sobreiro|Castanheiro|Laranjeira|Figueira", "Sapateiro"),
  p("w_familia", 4, "Irmã|Avó|Tia|Prima|Sobrinha|Neta", "Vizinha"),
  p("w_estacoes", 4, "Primavera|Verão|Outono|Inverno", "Manhã"),
  p("w_tempo", 4, "Chuva|Vento|Neve|Nevoeiro|Trovoada|Granizo", "Areia"),
  p("w_corpo", 4, "Braço|Perna|Joelho|Cotovelo|Ombro|Pescoço", "Gaveta"),
  p("w_pratos", 4, "Bacalhau|Caldo verde|Cozido|Feijoada|Sardinhas assadas|Arroz de pato", "Hambúrguer"),
  p("w_doces", 4, "Pastel de nata|Arroz-doce|Pão de ló|Leite-creme|Ovos moles|Bolo-rei", "Bacalhau"),
  p("w_cozinha", 4, "Panela|Tacho|Frigideira|Concha|Escumadeira|Coador", "Almofada"),
  p("w_pares", 4, "2|4|6|8|10|12", "7"),
  p("w_tabuada", 4, "3|6|9|12|15|18", "10"),
  p("w_moedas", 4, "1 cêntimo|2 cêntimos|5 cêntimos|10 cêntimos|20 cêntimos|50 cêntimos", "3 cêntimos"),
  p("w_notas", 4, "5 euros|10 euros|20 euros|50 euros|100 euros", "30 euros"),
  p("w_instrumentos", 4, "Guitarra|Piano|Violino|Acordeão|Bombo|Flauta", "Martelo"),

  // 5: palavras, duas regras
  p("d_frutas_vermelhas", 5, "Morango|Cereja|Framboesa|Romã|Groselha", "Banana"),
  p("d_aves_voam", 5, "Andorinha|Pardal|Gaivota|Pombo|Cegonha", "Pinguim"),
  p("d_peixes", 5, "Sardinha|Carapau|Bacalhau|Pescada|Robalo|Dourada", "Golfinho"),
  p("d_terra", 5, "Cenoura|Batata|Cebola|Alho|Nabo|Beterraba", "Couve"),
  p("d_caroco", 5, "Cereja|Pêssego|Azeitona|Ameixa|Alperce|Manga", "Morango"),
  p("d_quatro_patas", 5, "Vaca|Porco|Ovelha|Cabra|Burro|Cavalo", "Galinha"),
  p("d_rodas", 5, "Carro|Comboio|Bicicleta|Autocarro|Elétrico|Mota", "Barco"),
  p("d_quentes", 5, "Café|Chá|Galão|Meia de leite|Chocolate quente", "Limonada"),
  p("d_31", 5, "Janeiro|Março|Maio|Julho|Agosto|Outubro|Dezembro", "Abril"),
  p("d_mar", 5, "Porto|Lisboa|Faro|Aveiro|Nazaré|Peniche", "Évora"),
  p("d_rios", 5, "Tejo|Douro|Mondego|Zêzere|Sado|Vouga", "Sena"),
  p("d_arvores_fruto", 5, "Laranjeira|Macieira|Pereira|Figueira|Cerejeira|Limoeiro", "Eucalipto"),
  p("d_doces_pt", 5, "Pastel de nata|Arroz-doce|Pão de ló|Ovos moles|Toucinho do céu|Pastel de Tentúgal", "Tiramisu"),
  p("d_cordas", 5, "Guitarra|Violino|Viola|Cavaquinho|Harpa|Bandolim", "Acordeão"),
  p("d_moedas", 5, "1 cêntimo|5 cêntimos|50 cêntimos|1 euro|2 euros", "5 euros"),
];
