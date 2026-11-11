"""Fotografias e nomes de substituição para testar as Fotografias, o Quem é quem e os pacotes de media.

Correr: python tools/criar_fotos_teste.py [destino] [--base | --segunda]
Destino por omissão: <kit>/media-exemplo-quem (fora de media/: nunca fotografias verdadeiras).
Faz retratos de cores com números grandes (ImageMagick) como fotos/NNN.jpg e um nomes.txt com nomes
inventados. --base faz só as fotografias 001 a 003 (o que um envio antigo por adb deixou).
--segunda faz a "segunda versão" para o teste do pacote incremental: a fotografia 004 sai, a 011
entra, e a legenda da 002 muda.
"""
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ambiente  # noqa: E402

DEST = os.path.join(ambiente.RAIZ, "media-exemplo-quem")   # nunca dentro de media/: são de substituição
CORES = ["#e63946", "#0a6fd6", "#2b9348", "#7b2cbf", "#fb8500", "#ff4d8d", "#118ab2", "#8d5524",
         "#06d6a0", "#ef476f", "#3a86ff"]

NOMES_1 = """# Nomes de substituição para os testes (pessoas inventadas).
001; a Tia Rosa; a Tia Rita, a Tia Rosário
002; o Primo João; o Primo Joaquim, o Primo José; No casamento da Ana
003; a Avó Maria
004; o Tio Manuel; o Tio Mário, o Tio Miguel, o Tio Marco
005; a Prima Beatriz Conceição Albuquerque; a Prima Beatriz Constança Albuquerque, a Prima Bárbara Conceição Almeida; Na praia
006; os Primos; os Vizinhos, os Amigos
007; a Madrinha Teresa; a Madrinha Teodora
008; o Padrinho Rui; o Padrinho Raul, o Padrinho Rafael
009; a Sobrinha Inês; a Sobrinha Irene, a Sobrinha Isabel; No Natal
010; o Neto Tomás; o Neto Tiago, o Neto Toni
"""

NOMES_2 = NOMES_1.replace("004; o Tio Manuel; o Tio Mário, o Tio Miguel, o Tio Marco\n", "") \
    .replace("No casamento da Ana", "Na festa da Ana") \
    + "011; a Bisneta Leonor; a Bisneta Lara, a Bisneta Luísa\n"


def magick():
    return shutil.which("magick") or "magick"


def retrato(caminho, numero, cor, retrato_alto):
    w, h = (900, 1200) if retrato_alto else (1200, 900)
    subprocess.run([magick(), "-size", f"{w}x{h}", f"xc:{cor}",
                    "-fill", "#ffd6a5", "-stroke", "#111111", "-strokewidth", "12",
                    "-draw", f"circle {w // 2},{h // 2 - 120} {w // 2 + 150},{h // 2 - 120}",
                    "-fill", "#ffffff", "-draw", f"roundrectangle {w // 2 - 260},{h // 2 + 80} {w // 2 + 260},{h - 40} 60,60",
                    "-stroke", "none", "-fill", "#111111", "-pointsize", "220", "-gravity", "south",
                    "-annotate", "+0+60", f"{numero:03d}", caminho], check=True)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    segunda = "--segunda" in sys.argv
    base = "--base" in sys.argv
    destino = args[0] if args else DEST
    fotos = os.path.join(destino, "fotos")
    os.makedirs(fotos, exist_ok=True)
    numeros = ([1, 2, 3] if base else [n for n in range(1, 12) if n != 11] if not segunda
               else [n for n in range(1, 12) if n != 4])
    for f in os.listdir(fotos):
        if f.lower().endswith(".jpg") and int(f[:3]) not in numeros:
            os.remove(os.path.join(fotos, f))
    for n in numeros:
        caminho = os.path.join(fotos, f"{n:03d}.jpg")
        if not os.path.exists(caminho):
            retrato(caminho, n, CORES[(n - 1) % len(CORES)], n % 3 == 0)
    with open(os.path.join(fotos, "nomes.txt"), "w", encoding="utf-8", newline="\n") as f:
        texto = NOMES_2 if segunda else NOMES_1
        if base:
            texto = "".join(l for l in texto.splitlines(True) if l.startswith(("#", "001", "002", "003")))
        f.write(texto)
    print(f"{len(numeros)} fotografias de substituição e nomes.txt em {fotos}" + (" (segunda versão)" if segunda else " (base)" if base else ""))


if __name__ == "__main__":
    main()
