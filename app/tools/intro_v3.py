"""Acrescenta os ecrãs da versão 3 a www/data/intro.json: Monta-pratos e Gato aventureiro,
aprovados pela família depois de os experimentar.

Correr: python tools/intro_v3.py   (depois o intro_v2.py deixa-os como estão)
"""
import json
import os

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOVOS = [
    {"versao": 3, "img": "img/jogos/montapratos.svg", "fala": "montapratos.intro"},
    {"versao": 3, "img": "img/jogos/gato.svg", "fala": "gato.intro"},
]


def main():
    caminho = os.path.join(APP, "www", "data", "intro.json")
    with open(caminho, encoding="utf-8") as f:
        intro = json.load(f)
    falas = {s["fala"] for s in intro["slides"]}
    intro["slides"] += [s for s in NOVOS if s["fala"] not in falas]
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(intro, f, ensure_ascii=False, indent=2)
    print("ecrãs da versão 3:", [s["fala"] for s in intro["slides"] if s["versao"] == 3])


if __name__ == "__main__":
    main()
