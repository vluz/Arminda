"""Escreve AUDIO-LINHAS.md: todas as frases ditas, por secção, pela ordem exata que o importador espera.

Correr: python tools/gerar_audio_md.py
É feito a partir de www/data/falas.json, por isso bate sempre certo com a app. Os números do loto
aparecem como intervalos. É o que a família lê enquanto grava (passo 5 do kit).
"""
import json
import os

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(os.path.dirname(APP), "AUDIO-LINHAS.md")


def main():
    with open(os.path.join(APP, "www", "data", "falas.json"), encoding="utf-8") as f:
        falas = json.load(f)
    linhas = [
        "# As frases do gato",
        "",
        "Feito a partir de `app/www/data/falas.json` por `app/tools/gerar_audio_md.py`. Não editar à mão.",
        "",
        "Para gravar vozes da família: leia cada secção numa só gravação, por esta ordem, com dois segundos de silêncio entre frases.",
        "A secção `nora` é para uma segunda voz da família: os mesmos elogios, ditos por outra pessoa.",
        "Se o tablet tem uma segunda pessoa, as frases dela vêm no fim de cada secção.",
        "",
        "| Secção | Frases |",
        "| --- | --- |",
    ]
    linhas += [f"| `{sec}` | {len(v)} |" for sec, v in falas.items()]
    for sec, v in falas.items():
        linhas += ["", f"## Secção `{sec}`", ""]
        if sec.startswith("numeros"):
            linhas.append(f"Os números de {v[0]['id'].split('.')[1]} a {v[-1]['id'].split('.')[1]}, cada um por extenso: \"{v[0]['texto']}\", \"{v[1]['texto']}\" e assim por diante.")
            continue
        linhas += ["| # | Frase |", "| --- | --- |"]
        linhas += [f"| {i} | {l['texto'].replace('|', '/')} |" for i, l in enumerate(v, 1)]
    with open(SAIDA, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(linhas) + "\n")
    print(f"{sum(len(v) for v in falas.values())} frases em {len(falas)} secções -> {SAIDA}")


if __name__ == "__main__":
    main()
