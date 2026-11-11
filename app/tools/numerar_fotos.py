"""Numera uma remessa de fotografias recebidas para <kit>/media/fotos, a seguir ao número mais alto
que lá está (001.jpg, 002.jpg e, na remessa seguinte, 072.jpg). Os originais nunca são mudados.

Os números são para sempre: a família fala das fotografias pelo número ("a 014 é o Primo João"), o
pacote de media guarda o número de cada fotografia, e os registos só dizem números. Nunca renumerar.

Para cada remessa também:
- acrescenta a fotos/_origem.tsv (número, pasta da remessa, nome original do ficheiro);
- acrescenta a fotos/nomes-rascunho.txt uma linha comentada por fotografia, com o nome original do
  ficheiro como pista, para a família transformar em linhas a sério de nomes.txt;
- faz folhas de contacto numeradas em media/_recebido/folhas/ (36 fotografias por folha) para
  mandar para um telemóvel.

Correr: python tools/numerar_fotos.py <pasta recebida>
"""
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ambiente  # noqa: E402
import nomes_fotos  # noqa: E402

FOTOS = os.path.join(ambiente.PASTA_MEDIA, "fotos")
FOLHAS = os.path.join(ambiente.PASTA_MEDIA, "_recebido", "folhas")
EXT = (".jpg", ".jpeg", ".png")
POR_FOLHA = 36


def main():
    if len(sys.argv) != 2 or not os.path.isdir(sys.argv[1]):
        sys.exit(__doc__)
    origem = sys.argv[1]
    os.makedirs(FOTOS, exist_ok=True)
    os.makedirs(FOLHAS, exist_ok=True)

    # O número de uma fotografia lê-se como no resto das ferramentas (7.jpg, 07.jpg, 007.jpg e
    # "7 No Natal.jpg" são todas a fotografia 7), para nunca se dar um número que já tem dona.
    usados = {}
    for f in sorted(os.listdir(FOTOS)):
        if not f.lower().endswith(EXT):
            continue
        n = nomes_fotos.numero_da_foto(f)
        if n is None:
            continue
        if n in usados:
            sys.exit(f"{FOTOS}: {usados[n]} e {f} são as duas a fotografia {n}. Fique só com uma antes de numerar mais.")
        usados[n] = f
    proximo = max(usados, default=0) + 1
    ficheiros = sorted((f for f in os.listdir(origem) if f.lower().endswith(EXT)), key=str.lower)
    if not ficheiros:
        sys.exit(f"Não há fotografias em {origem}")

    lote = os.path.basename(os.path.normpath(origem))
    novos = []
    tsv, rascunho = [], [f"", f"# Lote {lote}: fotografias {proximo:03d} a {proximo + len(ficheiros) - 1:03d}"]
    for i, f in enumerate(ficheiros):
        num = f"{proximo + i:03d}"
        de = os.path.join(origem, f)
        para = os.path.join(FOTOS, num + ".jpg")
        if os.path.exists(para):
            sys.exit(f"{para} já existe; a parar para não escrever por cima de nada.")
        if f.lower().endswith(".png"):
            subprocess.run(["magick", de, "-quality", "90", para], check=True)
        else:
            shutil.copy2(de, para)
        novos.append(para)
        tsv.append(f"{num}\t{lote}\t{f}")
        rascunho += [f"# {num}: {f}", f"# {num}; ...; ...; ..."]

    with open(os.path.join(FOTOS, "_origem.tsv"), "a", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(tsv) + "\n")
    with open(os.path.join(FOTOS, "nomes-rascunho.txt"), "a", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(rascunho) + "\n")

    folhas = []
    for k in range(0, len(novos), POR_FOLHA):
        parte = novos[k:k + POR_FOLHA]
        nome = os.path.join(FOLHAS, f"folha-{os.path.basename(parte[0])[:3]}-{os.path.basename(parte[-1])[:3]}.jpg")
        subprocess.run(["magick", "montage", *parte, "-auto-orient", "-thumbnail", "300x300",
                        "-background", "#f3ecdc", "-fill", "black", "-font", "Arial", "-pointsize", "34",
                        "-set", "label", "%t", "-geometry", "300x300+8+8", "-tile", "4x", nome], check=True)
        folhas.append(nome)

    print(f"{len(novos)} fotografias numeradas de {proximo:03d} a {proximo + len(novos) - 1:03d} em {FOTOS}")
    for f in folhas:
        print(f"folha de contacto: {f}")


if __name__ == "__main__":
    main()
