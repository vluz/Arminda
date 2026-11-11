"""Confere o leitor de nomes.txt (tools/nomes_fotos.py). Correr: python tools/testes/nomes_teste.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import nomes_fotos as nf  # noqa: E402

falhas = 0


def verifica(nome, ok, detalhe=""):
    global falhas
    if not ok:
        falhas += 1
    print(("PASSOU " if ok else "FALHOU ") + nome + (f"  ({detalhe})" if detalhe else ""))


def erros_de(texto):
    try:
        nf.ler_texto(texto)
    except nf.NomesErro as e:
        return e.erros
    return []


# As três linhas de exemplo.
e, av = nf.ler_texto("# comentário\n\n001; a Tia Rosa; a Tia Rita, a Tia Rosário\n"
                     "002; o Primo João; o Primo Joaquim, o Primo José; No casamento da Ana\n003; a Avó Maria\n")
verifica("as três linhas de exemplo são lidas", [x["numero"] for x in e] == [1, 2, 3])
verifica("os nomes falsos separam-se nas vírgulas", e[0]["falsos"] == ["a Tia Rita", "a Tia Rosário"], e[0]["falsos"])
verifica("legenda no campo 4", e[1]["legenda"] == "No casamento da Ana")
verifica("sem nomes falsos: lista vazia", e[2]["falsos"] == [] and e[2]["legenda"] == "")
verifica("sem avisos para linhas boas", av == [], av)

e, _ = nf.ler_texto("7; a Avó Maria; ; Na horta\n8; o Avô; \n")
verifica("campo 3 vazio com legenda", e[0]["falsos"] == [] and e[0]["legenda"] == "Na horta")
verifica("um ';' no fim é permitido", e[1]["nome"] == "o Avô" and e[1]["falsos"] == [])
e, _ = nf.ler_texto("\ufeff009 ;  a Tia Rosa ;a Tia Rita ,a Tia Rosário  \n")
verifica("espaços tirados, marca de ordem de bytes ignorada, 009 é 9", e[0]["numero"] == 9 and e[0]["falsos"] == ["a Tia Rita", "a Tia Rosário"])

er = erros_de("001; a Tia Rosa\n001; o Primo João\n")
verifica("número repetido -> erro com as duas linhas", len(er) == 1 and "linha 2" in er[0] and "linha 1" in er[0], er)
er = erros_de("x1; a Tia Rosa\n")
verifica("número mau -> erro", len(er) == 1 and "linha 1" in er[0] and "número" in er[0], er)
er = erros_de("\n\n001\n")
verifica("um só campo -> erro com a linha 3", len(er) == 1 and "linha 3" in er[0], er)
er = erros_de("001; a Tia Rosa; a Tia Rita; legenda; mais\n")
verifica("cinco campos -> erro", len(er) == 1 and "5 campos" in er[0], er)
er = erros_de("001; a Tia Rosa, a Tia Rita\n")
verifica("vírgula no nome verdadeiro -> erro simpático", len(er) == 1 and "terceiro campo" in er[0], er)
er = erros_de("001; a Tia Rosa; a tia rosa, a Tia Rita\n")
verifica("nome falso igual ao verdadeiro -> erro", len(er) == 1 and "igual ao nome verdadeiro" in er[0], er)
er = erros_de("001; ; a Tia Rita\n")
verifica("nome verdadeiro vazio -> erro", len(er) == 1 and "vazio" in er[0], er)
er = erros_de("abc; x\n002; y\n002; z\n004\n")
verifica("todos os erros ditos de uma vez", len(er) == 3, er)

e, av = nf.ler_texto("001; a Tia Rosa; a Tia Rita, a Tia Rita\n002; o Rui; o Raul\n")
verifica("nome falso repetido usado uma vez, com uma nota", e[0]["falsos"] == ["a Tia Rita"] and any("duas vezes" in a for a in av), av)
verifica("um só nome falso: uma nota", any("só um nome falso" in a for a in av), av)

verifica("sem_artigo a/o/as/os", [nf.sem_artigo(x) for x in ["a Tia Rosa", "o Primo João", "os Primos", "As Tias", "Ana"]]
         == ["Tia Rosa", "Primo João", "Primos", "Tias", "Ana"])
verifica("sem_artigo mantém um artigo sozinho", nf.sem_artigo("o") == "O")
verifica("Olha, é a Tia Rosa!", nf.frase_olha("a Tia Rosa") == "Olha, é a Tia Rosa!")
verifica("Olha, são os Primos!", nf.frase_olha("os Primos") == "Olha, são os Primos!")
verifica("Quem é o Primo João?", nf.frase_quem("o Primo João") == "Quem é o Primo João?")
verifica("frases das opções", nf.frase_opcao("a Tia Rita") == "A Tia Rita?" and nf.frase_ou("a Tia Rosa") == "Ou a Tia Rosa?")
verifica("números das fotografias a partir dos nomes dos ficheiros", [nf.numero_da_foto(x) for x in ["007.jpg", "7.JPEG", "12 No Natal.png", "praia.jpg", "x/003.Png"]]
         == [7, 7, 12, None, 3])

exemplo = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "exemplos", "nomes-exemplo.txt")
e, av = nf.ler(exemplo)
verifica("o nomes-exemplo.txt lê-se sem problemas", len(e) == 3 and not av, f"{len(e)} entradas, {av}")

print("FALHARAM: " + str(falhas) if falhas else "passaram todas")
sys.exit(1 if falhas else 0)
