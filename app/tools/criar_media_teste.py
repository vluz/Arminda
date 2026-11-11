"""Faz conteúdos de família a fingir para testes no PC: 3 fotografias, 2 músicas, 2 divisões em 360.

Correr com um Python que tenha o Pillow (passo 3 do kit):
  python tools/criar_media_teste.py
Escreve os originais em <kit>/media-exemplo/. Depois correr enviar_media.py --teste com
MAE_MEDIA_ORIGEM a apontar para lá.
"""
import os
import subprocess
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ambiente  # noqa: E402

DEST = os.path.join(ambiente.RAIZ, "media-exemplo")   # originais de substituição, nunca conteúdos verdadeiros da família
FFMPEG = ambiente.programa("ffmpeg")


def foto(nome, cor, w=2400, h=1600):
    im = Image.new("RGB", (w, h), cor)
    d = ImageDraw.Draw(im)
    for i in range(12):
        d.ellipse([i * 200, h // 3, i * 200 + 300, h // 3 + 300], fill=((i * 40) % 255, 200, 255 - i * 20))
    d.rectangle([w // 4, h // 2, 3 * w // 4, 3 * h // 4], outline="black", width=20)
    im.save(os.path.join(DEST, "fotos", nome), quality=90)


def sala(nome, base, w=8192, h=4096):
    im = Image.new("RGB", (w, h), base)
    d = ImageDraw.Draw(im)
    for x in range(0, w, w // 16):
        d.line([x, 0, x, h], fill="white", width=12)
    for y in range(0, h, h // 8):
        d.line([0, y, w, y], fill="white", width=12)
    for k in range(8):
        cx = int((k + 0.5) * w / 8)
        d.ellipse([cx - 200, h // 2 - 200, cx + 200, h // 2 + 200], fill=(255, 200 - k * 20, k * 30), outline="black", width=16)
    d.rectangle([0, int(h * 0.75), w, h], fill=(150, 90, 40))
    im.save(os.path.join(DEST, "casa", nome), quality=85)


def main():
    for p in ("fotos", "musica", "casa"):
        os.makedirs(os.path.join(DEST, p), exist_ok=True)
    foto("01 Os netos no Natal.jpg", (230, 57, 70))
    foto("02 A Ana na praia.jpg", (10, 111, 214), 1600, 2400)
    foto("03 O jardim da casa.jpg", (43, 147, 72))
    for nome, notas in [("Canção do teste - Primeira.mp3", [262, 330, 392, 523]),
                        ("Segunda canção de teste.mp3", [392, 349, 330, 294])]:
        expr = "+".join(f"0.2*sin(2*PI*{f}*t)*between(t,{k*1.5},{k*1.5+1.4})" for k, f in enumerate(notas * 3))
        subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
                        "-i", f"aevalsrc=exprs='{expr}':s=44100:d=18", "-metadata", f"title={nome[:-4]}",
                        os.path.join(DEST, "musica", nome)], check=True)
    sala("01 Sala.jpg", (240, 210, 160))
    sala("02 Cozinha.jpg", (160, 220, 240))
    print("conteúdos de teste prontos em", DEST)


if __name__ == "__main__":
    main()
