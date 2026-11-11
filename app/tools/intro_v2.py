"""Acrescenta os ecrãs da versão 2 a www/data/intro.json: um por cada atividade acrescentada depois
da versão 1.

Correr: python tools/intro_v2.py
Lê a ordem do ecrã inicial e as imagens dos botões em www/js/jogos/registo.js, e a frase
"<id>.intro" de cada atividade em www/data/falas.json. Pode correr-se outra vez: refaz os ecrãs
da versão 2 e não toca nos da versão 1.
"""
import json
import os
import re

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JA_NA_V1 = {"pares", "jardim", "loto"}


def main():
    with open(os.path.join(APP, "www", "js", "jogos", "registo.js"), encoding="utf-8") as f:
        registo = f.read()
    # Os jogos escondidos (oculto: true) ficam fora da introdução até a família os aprovar.
    jogos = [(j, fig) for j, fig, resto in re.findall(r'\{ id: "(\w+)", nome: "[^"]+", cor: "[^"]+", figura: "([^"]+)"([^}]*)\}', registo)
             if "oculto: true" not in resto]
    with open(os.path.join(APP, "www", "data", "falas.json"), encoding="utf-8") as f:
        falas = {l["id"] for linhas in json.load(f).values() for l in linhas}
    caminho = os.path.join(APP, "www", "data", "intro.json")
    with open(caminho, encoding="utf-8") as f:
        intro = json.load(f)
    slides = [s for s in intro["slides"] if s["versao"] == 1]
    depois = [s for s in intro["slides"] if s["versao"] >= 3]   # as versões seguintes ficam como estão
    ja_depois = {s["fala"].split(".")[0] for s in depois}
    novos = [{"versao": 2, "img": "img/noto/festa.svg", "fala": "intro.mais_jogos"}]
    sem_linha = []
    for jid, figura in jogos:
        if jid in JA_NA_V1 or jid in ja_depois:
            continue
        if f"{jid}.intro" in falas:
            novos.append({"versao": 2, "img": figura, "fala": f"{jid}.intro"})
        else:
            sem_linha.append(jid)
    intro["slides"] = slides + novos + depois
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(intro, f, ensure_ascii=False, indent=2)
    print(f"{len(slides)} ecrãs da versão 1, {len(novos)} ecrãs da versão 2; sem frase de introdução: {sem_linha or 'nenhum'}")


if __name__ == "__main__":
    main()
