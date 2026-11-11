"""Lê <kit>/media/fotos/nomes.txt: quem está em cada fotografia da família, para as Fotografias e o
Quem é quem.

Uma linha por fotografia, em UTF-8, campos separados por ";" (os espaços à volta não contam):

    número; nome verdadeiro; nomes falsos separados por vírgulas; legenda opcional

- 2 a 4 campos. O campo 3 (nomes falsos, separados por vírgulas) pode estar vazio ou faltar; o
  campo 4 é uma legenda opcional.
- Os nomes levam o artigo: "a Tia Rosa", "o Primo João", "os Primos". O gato diz
  "Olha, é a Tia Rosa!" ("Olha, são os Primos!" com "os" ou "as"); os botões do jogo mostram o nome
  sem o artigo.
- As linhas que começam por # são comentários. As linhas vazias não contam.
- Uma linha sem nomes falsos: a fotografia aparece nas Fotografias com o nome dito, nunca no jogo.
- A fotografia é fotos/<número>.jpg (também .jpeg ou .png, maiúsculas ou minúsculas; "7", "07" e
  "007" são o mesmo número).

ler(caminho) devolve (entradas, avisos) ou levanta NomesErro com todos os problemas e a linha de cada um.
Correr diretamente para conferir um ficheiro:  python tools/nomes_fotos.py [nomes.txt]
"""
import os
import re
import sys

ARTIGOS = ("a ", "o ", "as ", "os ")
MAX_NOME = 40   # nomes mais compridos funcionam, mas os botões encolhem muito o texto


class NomesErro(Exception):
    def __init__(self, erros):
        super().__init__("\n".join(erros))
        self.erros = erros


def sem_artigo(nome):
    """'a Tia Rosa' -> 'Tia Rosa' (para os botões e para a legenda no ecrã)."""
    n = nome.strip()
    baixo = n.lower()
    for a in ARTIGOS:
        if baixo.startswith(a) and len(n) > len(a):
            n = n[len(a):].strip()
            break
    return n[:1].upper() + n[1:]


def plural(nome):
    return nome.strip().lower().startswith(("as ", "os "))


def frase_olha(nome):
    return f"Olha, {'são' if plural(nome) else 'é'} {nome.strip()}!"


def frase_quem(nome):
    return f"Quem {'são' if plural(nome) else 'é'} {nome.strip()}?"


def maiuscula(s):
    return s[:1].upper() + s[1:]


def frase_opcao(nome):
    return maiuscula(nome.strip()) + "?"


def frase_ou(nome):
    return f"Ou {nome.strip()}?"


def ler_texto(texto, origem="nomes.txt"):
    entradas = []
    erros = []
    avisos = []
    vistos = {}
    texto = texto.lstrip("﻿")   # uma marca de ordem de bytes que alguns editores põem
    for n, bruta in enumerate(texto.splitlines(), 1):
        linha = bruta.strip()
        if not linha or linha.startswith("#"):
            continue
        campos = [c.strip() for c in linha.split(";")]
        # Um ";" no fim deixa um último campo vazio: é permitido ("7; a Avó Maria;").
        while len(campos) > 2 and campos[-1] == "":
            campos.pop()
        onde = f"{origem} linha {n}"
        if len(campos) < 2:
            erros.append(f"{onde}: esperava-se 'número; nome verdadeiro[; nomes falsos][; legenda]', e só há um campo: {linha!r}")
            continue
        if len(campos) > 4:
            erros.append(f"{onde}: {len(campos)} campos separados por ';', e o máximo são 4. "
                         f"Separe os nomes falsos com vírgulas, e não use ';' dentro da legenda.")
            continue
        numero_txt, verdadeiro = campos[0], campos[1]
        falsos_txt = campos[2] if len(campos) > 2 else ""
        legenda = campos[3] if len(campos) > 3 else ""
        if not re.fullmatch(r"\d{1,6}", numero_txt):
            erros.append(f"{onde}: o primeiro campo tem de ser o número da fotografia (só algarismos), e está {numero_txt!r}")
            continue
        numero = int(numero_txt)
        if numero in vistos:
            erros.append(f"{onde}: o número de fotografia {numero} já está na linha {vistos[numero]}")
            continue
        vistos[numero] = n
        if not verdadeiro:
            erros.append(f"{onde}: o nome verdadeiro (segundo campo) está vazio")
            continue
        if "," in verdadeiro:
            erros.append(f"{onde}: o nome verdadeiro {verdadeiro!r} tem uma vírgula. Os nomes falsos vão no terceiro campo, "
                         f"depois de um ';', por exemplo: {numero_txt}; a Tia Rosa; a Tia Rita, a Tia Rosário")
            continue
        falsos = []
        for f in falsos_txt.split(","):
            f = f.strip()
            if not f:
                continue
            if f.lower() == verdadeiro.lower():
                erros.append(f"{onde}: o nome falso {f!r} é igual ao nome verdadeiro")
                continue
            if f.lower() in (x.lower() for x in falsos):
                avisos.append(f"{onde}: o nome falso {f!r} está escrito duas vezes; usa-se uma")
                continue
            falsos.append(f)
        if len(falsos) == 1:
            avisos.append(f"{onde}: só um nome falso; o jogo funciona, mas dois ou mais é melhor")
        for nome in [verdadeiro, *falsos]:
            if len(nome) > MAX_NOME:
                avisos.append(f"{onde}: {nome!r} é comprido ({len(nome)} letras); o texto do botão vai ficar pequeno")
        entradas.append({"numero": numero, "linha": n, "nome": verdadeiro, "falsos": falsos, "legenda": legenda})
    if erros:
        raise NomesErro(erros)
    return entradas, avisos


def ler(caminho):
    with open(caminho, encoding="utf-8-sig") as f:
        try:
            texto = f.read()
        except UnicodeDecodeError as e:
            raise NomesErro([f"{caminho}: o texto não está em UTF-8 ({e.reason} no byte {e.start}). Guarde-o como UTF-8."])
    return ler_texto(texto, os.path.basename(caminho))


def numero_da_foto(nome_ficheiro):
    """'007.jpg' -> 7, '12 No Natal.JPEG' -> 12, 'praia.png' -> None."""
    base = os.path.splitext(os.path.basename(nome_ficheiro))[0]
    m = re.match(r"^(\d{1,6})(?!\d)", base)
    return int(m.group(1)) if m else None


def main():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import ambiente  # noqa: E402
    caminho = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ambiente.PASTA_MEDIA, "fotos", "nomes.txt")
    try:
        entradas, avisos = ler(caminho)
    except NomesErro as e:
        print("Problemas em " + caminho + ":")
        for x in e.erros:
            print("  " + x)
        sys.exit(1)
    for a in avisos:
        print("  note: " + a)
    jogo = sum(1 for x in entradas if x["falsos"])
    print(f"{len(entradas)} fotografias com nome, {jogo} servem para o Quem é quem.")


if __name__ == "__main__":
    main()
