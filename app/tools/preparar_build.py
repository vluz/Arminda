"""Copia www/ para www-build/ sem os ficheiros só de teste, para a construção Android.

Correr: python tools/preparar_build.py
O capacitor.config.json usa o webDir "www-build", por isso os conteúdos de teste e a configuração
de teste do PC (www/media-teste/, com um endereço e um token de servidor a fingir) nunca chegam
ao APK.
"""
import os
import shutil

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEM = os.path.join(APP, "www")
DESTINO = os.path.join(APP, "www-build")
FORA = {"media-teste"}


def main():
    if os.path.isdir(DESTINO):
        shutil.rmtree(DESTINO)
    shutil.copytree(ORIGEM, DESTINO, ignore=lambda d, nomes: [n for n in nomes if d == ORIGEM and n in FORA])
    n = sum(len(f) for _, _, f in os.walk(DESTINO))
    tam = sum(os.path.getsize(os.path.join(r, x)) for r, _, f in os.walk(DESTINO) for x in f)
    print(f"www-build: {n} ficheiros, {tam / 1e6:.1f} MB (de fora: {', '.join(sorted(FORA))})")


if __name__ == "__main__":
    main()
