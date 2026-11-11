"""Copia os recursos de terceiros escolhidos para www/, com nomes simples.

Correr: python tools/preparar_recursos.py
As origens foram descarregadas para <kit>/downloads (as licenças estão em CREDITOS.md).
"""
import os
import shutil
import subprocess
import sys
import urllib.request

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WWW = os.path.join(APP, "www")
# Só para desenvolvimento: os ficheiros preparados já estão em www/. Só é preciso outra vez para os
# refazer a partir de descargas novas, postas em <kit>/downloads.
DL = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "downloads")
KENNEY = os.path.join(DL, "kenney")
NOTO = os.path.join(DL, "noto")
FONTS_DL = os.path.join(DL, "atkinson")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ambiente  # noqa: E402

# nome do efeito -> ficheiro do Kenney (CC0)
SONS = {
    "toque": r"interface-sounds\Audio\select_002.ogg",
    "virar": r"casino-audio\Audio\card-place-1.ogg",
    "baralhar": r"casino-audio\Audio\card-shuffle.ogg",
    "par": r"interface-sounds\Audio\confirmation_002.ogg",
    "quase": r"interface-sounds\Audio\pluck_001.ogg",
    "vitoria": r"music-jingles\Audio\Steel jingles\jingles_STEEL00.ogg",
    "vitoria2": r"music-jingles\Audio\Pizzicato jingles\jingles_PIZZI00.ogg",
    "linha": r"music-jingles\Audio\Steel jingles\jingles_STEEL04.ogg",
    "bola": r"casino-audio\Audio\dice-shake-1.ogg",
    "marcar": r"casino-audio\Audio\chip-lay-1.ogg",
    "azulejo": r"interface-sounds\Audio\glass_002.ogg",
    "abrir": r"interface-sounds\Audio\maximize_002.ogg",
    "voltar": r"interface-sounds\Audio\back_002.ogg",
    "crescer": r"interface-sounds\Audio\maximize_006.ogg",
    "colher": r"interface-sounds\Audio\pluck_002.ogg",
}

# nome da imagem -> código do emoji Noto (Apache 2.0)
IMAGENS = {
    "gato": "1f431", "cao": "1f436", "cafe": "2615", "pao": "1f35e",
    "laranja": "1f34a", "coracao": "2764", "girassol": "1f33b",
    "rosa": "1f339", "tulipa": "1f337", "malmequer": "1f33c",
    "rebento": "1f331", "borboleta": "1f98b", "passaro": "1f426",
    "sol": "2600", "gota": "1f4a7", "casa": "1f3e0",
    "gato_sorri": "1f63a", "gato_feliz": "1f638", "gato_amor": "1f63b",
    "estrela": "2b50", "festa": "1f389", "taca": "1f3c6", "ramo": "1f490",
    "cesto": "1f9fa", "nuvem": "2601", "arco_iris": "1f308",
    "aplauso": "1f44f", "nota": "1f3b5", "beijo": "1f48b",
    "joaninha": "1f41e", "abelha": "1f41d",
}

FONTES = {
    "AtkinsonHyperlegibleNext-Regular.woff2": "fonts/webfonts/AtkinsonHyperlegibleNext-Regular.woff2",
    "AtkinsonHyperlegibleNext-Bold.woff2": "fonts/webfonts/AtkinsonHyperlegibleNext-Bold.woff2",
    "AtkinsonHyperlegibleNext-ExtraBold.woff2": "fonts/webfonts/AtkinsonHyperlegibleNext-ExtraBold.woff2",
    "OFL.txt": "OFL.txt",
}
FONT_BASE = "https://raw.githubusercontent.com/googlefonts/atkinson-hyperlegible-next/main/"


def main():
    snd = os.path.join(WWW, "snd")
    img = os.path.join(WWW, "img", "noto")
    fnt = os.path.join(WWW, "fonts")
    for d in (snd, img, fnt, FONTS_DL):
        os.makedirs(d, exist_ok=True)

    for nome, rel in SONS.items():
        src = os.path.join(KENNEY, rel)
        dst = os.path.join(snd, nome + ".ogg")
        # Passa para Vorbis mono a 44,1 kHz e nivela o volume, para os efeitos ficarem abaixo da voz.
        subprocess.run([ambiente.programa("ffmpeg"), "-hide_banner", "-loglevel", "error", "-y", "-i", src,
                        "-ac", "1", "-ar", "44100", "-af", "loudnorm=I=-20:TP=-2",
                        "-c:a", "libvorbis", "-q:a", "4", dst], check=True)
    for nome, code in IMAGENS.items():
        shutil.copyfile(os.path.join(NOTO, f"emoji_u{code}.svg"), os.path.join(img, nome + ".svg"))

    for nome, rel in FONTES.items():
        local = os.path.join(FONTS_DL, nome)
        if not os.path.exists(local):
            urllib.request.urlretrieve(FONT_BASE + rel, local)
        shutil.copyfile(local, os.path.join(fnt, nome))

    print(f"{len(SONS)} sons, {len(IMAGENS)} imagens e {len(FONTES)} ficheiros de tipo de letra copiados")


if __name__ == "__main__":
    main()
