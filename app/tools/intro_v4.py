"""Acrescenta os ecrãs da versão 4 a www/data/intro.json: Cores, O intruso, Adivinhas, Labirinto,
Azulejos, Quatro em linha e Saltos, aprovados pela família depois de os experimentar.

Correr: python tools/intro_v4.py   (depois o intro_v2.py deixa-os como estão)
"""
import json
import os

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOVOS = [
    {"versao": 4, "img": f"img/jogos/{j}.svg", "fala": f"{j}.intro"}
    for j in ["cores", "intruso", "adivinhas", "labirinto", "pintar", "quatro", "saltos"]
]


def main():
    caminho = os.path.join(APP, "www", "data", "intro.json")
    with open(caminho, encoding="utf-8") as f:
        intro = json.load(f)
    falas = {s["fala"] for s in intro["slides"]}
    intro["slides"] += [s for s in NOVOS if s["fala"] not in falas]
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(intro, f, ensure_ascii=False, indent=2)
    print("ecrãs da versão 4:", [s["fala"] for s in intro["slides"] if s["versao"] == 4])


if __name__ == "__main__":
    main()
