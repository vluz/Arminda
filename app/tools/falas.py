"""Fonte única de todas as frases ditas, e de para quem é o tablet.

Correr: python tools/falas.py        (na pasta da app; qualquer pasta serve)
Escreve www/data/falas.json e www/data/pessoa.json.

As frases partilhadas estão aqui. As de cada jogo estão em tools/falas/<jogo>.json como
{"linhas": [["chave", "texto"], ...]} e ficam com os ids "<jogo>.<chave>". A ordem das secções
e a ordem das frases são as de AUDIO-LINHAS.md, para uma gravação da família cortada em pedaços
corresponder aos ids pela posição.

As frases são modelos: "{T}" é como o gato trata a pessoa (PESSOA["tratamento"]), e
"{feminino|masculino}" escolhe uma forma por PESSOA["genero"]: "És {uma campeã|um campeão}!".
Com PESSOA_2 definida, cada frase que sai diferente para a segunda pessoa ganha uma gémea
"<chave>__2" no fim da sua secção (para as posições anteriores não mudarem), e o botão do ecrã
da família escolhe a gémea na altura. As chaves nunca têm dois traços baixos seguidos.
"""
import json
import os
import re

# ---- A pessoa para quem é o tablet (passo 4 do kit). Mude isto, corra este ficheiro, depois gerar_voz.py. ----
PESSOA = {
    "tratamento": "mãe",        # como o gato trata a pessoa: "mãe", "pai", "avó", "avô", "tia", um nome próprio
    "genero": "f",              # "f" ou "m": escolhe "campeã" ou "campeão", "bem-vinda" ou "bem-vindo"
    "rotulo": "da mãe",         # ecrã da família: "Este tablet é da mãe"; "do avô", "da Maria"
    "titulo": "Jogos da Mãe",   # título da janela (vê-se no PC; o tablet mostra o nome da app, "Jogos")
}
# Segunda pessoa, opcional, para um tablet que pode mudar de mãos.
# Pôr None quando há uma só pessoa.
PESSOA_2 = {
    "tratamento": "pai",
    "genero": "m",
    "rotulo": "do pai",
    "titulo": "Jogos do Pai",
}

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTA_JOGOS = os.path.join(APP, "tools", "falas")

# Os jogos pela ordem do ecrã inicial. Tem de ser igual a www/js/jogos/registo.js.
JOGOS = ["fotos", "musica", "casa", "passeios", "pares", "jardim", "loto", "ditados", "domino", "cozinha",
         "aquario", "sopa", "palavras", "sequencia", "diferencas", "puzzle", "bisca", "sueca",
         "paciencia", "damas", "galo", "feira", "sardinha", "montapratos", "gato",
         "cores", "intruso", "adivinhas", "sudoku", "labirinto", "estendal", "mesa", "pintar",
         "quatro", "saltos", "quem"]

SECOES = {
    "geral": [
        ("bom_dia", "Bom dia, {T}!"),
        ("boa_tarde", "Boa tarde, {T}!"),
        ("boa_noite", "Boa noite, {T}!"),
        ("ola", "Olá, {T}! Que bom ver-te!"),
        ("vamos_jogar", "Vamos jogar um bocadinho?"),
        ("escolhe", "Escolhe um jogo."),
        ("muito_bem", "Muito bem!"),
        ("maravilha", "Que maravilha!"),
        ("bravo", "Bravo!"),
        ("isso_mesmo", "Isso mesmo!"),
        ("perfeito", "Perfeito!"),
        ("fantastico", "Fantástico!"),
        ("campea", "És {uma campeã|um campeão}!"),
        ("grande_forma", "Estás em grande forma!"),
        ("rapidez", "Que rapidez!"),
        ("melhor_ontem", "Melhor do que ontem!"),
        ("quase", "Quase!"),
        ("tenta", "Tenta outra vez."),
        ("nao_faz_mal", "Não faz mal."),
        ("calma", "Calma, há tempo."),
        ("quase_la", "Estás quase lá."),
        ("dificil", "Essa era difícil!"),
        ("acabou", "Acabou! Que bem jogaste!"),
        ("azulejo_novo", "Ganhaste um azulejo novo!"),
        ("painel", "Olha o teu painel de azulejos!"),
        ("outra_vez", "Queres jogar outra vez?"),
        ("inicio", "Vamos voltar ao início."),
        ("ate_logo", "Até logo, {T}!"),
        ("descansa", "Descansa bem."),
        ("beijinho", "Um beijinho grande!"),
        ("gosto", "Gosto muito de ti."),
        ("subiu", "Estás a jogar tão bem que a próxima vai ser mais difícil!"),
        ("bateria", "A bateria está a acabar. Pede a alguém para pôr o tablet a carregar."),
        ("tres_estrelas", "Três estrelas! Perfeito!"),
        ("sequencia_vitorias", "Mais uma vitória seguida! Ninguém te para!"),
        ("marco_10", "Já ganhaste dez vezes neste jogo!"),
        ("marco_25", "Já ganhaste vinte e cinco vezes neste jogo! És {uma campeã|um campeão}!"),
        ("marco_50", "Cinquenta vitórias neste jogo! Que espetáculo!"),
        ("marco_100", "Cem vitórias neste jogo! Inacreditável!"),
    ],
    "nora": [
        ("muito_bem", "Muito bem!"),
        ("bravo", "Bravo!"),
        ("maravilha", "Que maravilha!"),
        ("fantastico", "Fantástico!"),
        ("parabens", "Parabéns!"),
        ("quase", "Quase!"),
        ("beijinho", "Um beijinho!"),
        ("ate_logo", "Até logo!"),
    ],
    "intro": [
        ("ola", "Olá, {T}! Este tablet é só para ti."),
        ("jogos", "Aqui tens jogos para te divertires."),
        ("pares", "Nas Pares, encontras as cartas iguais."),
        ("jardim", "No teu jardim, regas as flores e vês como crescem."),
        ("loto", "No Loto, ouves os números e marcas no teu cartão."),
        ("azulejos", "Sempre que jogas, ganhas um azulejo para o teu painel."),
        ("casa", "A casinha leva-te sempre ao início."),
        ("repetir", "Para ouvir isto outra vez, toca no botão de ouvir."),
        ("fim", "Diverte-te! Gostamos muito de ti."),
        ("novidade", "Há uma novidade para ti!"),
        ("mais_jogos", "Há muitos jogos novos! Toca na seta para ver mais."),
    ],
}

for jogo in JOGOS:
    caminho = os.path.join(PASTA_JOGOS, jogo + ".json")
    if os.path.exists(caminho):
        with open(caminho, encoding="utf-8") as f:
            SECOES[jogo] = [tuple(x) for x in json.load(f)["linhas"]]

UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"]
DEZ_A_DEZANOVE = ["dez", "onze", "doze", "treze", "catorze", "quinze",
                  "dezasseis", "dezassete", "dezoito", "dezanove"]
DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta",
           "sessenta", "setenta", "oitenta", "noventa"]


def por_extenso(n):
    """Um número de 0 a 99 por extenso."""
    if n < 10:
        return UNIDADES[n]
    if n < 20:
        return DEZ_A_DEZANOVE[n - 10]
    d, u = divmod(n, 10)
    return DEZENAS[d] + (" e " + UNIDADES[u] if u else "")


for i, (a, b) in enumerate([(1, 30), (31, 60), (61, 90)], 1):
    SECOES[f"numeros{i}"] = [(str(n), por_extenso(n).capitalize() + "!") for n in range(a, b + 1)]

ALTERNATIVA = re.compile(r"\{([^{}|]*)\|([^{}|]*)\}")


def render(texto, pessoa):
    """Preenche um modelo para uma pessoa: {T} e {feminino|masculino}."""
    if pessoa["genero"] not in ("f", "m"):
        raise SystemExit(f"genero tem de ser 'f' ou 'm', não {pessoa['genero']!r}")
    texto = ALTERNATIVA.sub(lambda m: m.group(1) if pessoa["genero"] == "f" else m.group(2), texto)
    texto = texto.replace("{T}", pessoa["tratamento"])
    if "{" in texto or "}" in texto:
        raise SystemExit(f"modelo inválido: {texto!r}")
    return texto


def saudacao(pessoa):
    """O balão do ecrã inicial: "Olá, mãe!"."""
    return render("Olá, {T}!", pessoa)


def main():
    """Escreve falas.json (as frases para a pessoa, as gémeas para a segunda pessoa) e pessoa.json."""
    out = {}
    for sec, linhas in SECOES.items():
        base = [{"id": f"{sec}.{k}", "texto": render(t, PESSOA)} for k, t in linhas]
        twins = []
        if PESSOA_2:
            for k, t in linhas:
                outro = render(t, PESSOA_2)
                if outro != render(t, PESSOA):
                    twins.append({"id": f"{sec}.{k}__2", "texto": outro})
        out[sec] = base + twins
    for sec, linhas in out.items():
        ids = [l["id"] for l in linhas]
        dup = {i for i in ids if ids.count(i) > 1}
        if dup:
            raise SystemExit(f"ids repetidos em {sec}: {sorted(dup)}")
    pasta = os.path.join(APP, "www", "data")
    os.makedirs(pasta, exist_ok=True)
    with open(os.path.join(pasta, "falas.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    pessoas = {"1": {**PESSOA, "saudacao": saudacao(PESSOA)}}
    if PESSOA_2:
        pessoas["2"] = {**PESSOA_2, "saudacao": saudacao(PESSOA_2)}
    with open(os.path.join(pasta, "pessoa.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(pessoas, f, ensure_ascii=False, indent=1)
    total = sum(len(v) for v in out.values())
    twins = sum(1 for v in out.values() for l in v if l["id"].endswith("__2"))
    print(f"{total} frases em {len(out)} secções ({twins} gémeas para a segunda pessoa) -> {pasta}")


if __name__ == "__main__":
    main()
