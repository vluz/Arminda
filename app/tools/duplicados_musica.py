"""Encontra músicas repetidas numa pasta de música.

Correr: python tools/duplicados_musica.py <pasta> [--mover <destino>]

Dois ficheiros são repetidos quando o conteúdo é igual, ou quando o artista e o título são os mesmos
depois de tirar os números de faixa e as notas de remasterização ou de versão, e as durações
diferem menos de 3 segundos. Em cada grupo fica o primeiro ficheiro (o de nome mais curto). Com
--mover os outros são movidos (não apagados) para <destino>, com os mesmos nomes.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from collections import defaultdict

FFPROBE = os.path.join(os.environ["USERPROFILE"], "scoop", "shims", "ffprobe.exe")
AUD = (".mp3", ".m4a", ".flac", ".ogg", ".wav", ".opus", ".aac")


def duracao(p):
    r = subprocess.run([FFPROBE, "-v", "quiet", "-print_format", "json", "-show_format", p],
                       capture_output=True, text=True, check=False)
    try:
        return float(json.loads(r.stdout)["format"]["duration"])
    except (ValueError, KeyError):
        return None


def chave_nome(nome):
    n = os.path.splitext(nome)[0].lower()
    n = re.sub(r"^\d+[\s._-]*", "", n)                       # número da faixa
    n = re.sub(r"[\(\[][^\)\]]*[\)\]]", "", n)               # (remaster), [versão editada]
    n = re.sub(r"\b(remaster(ed)?|single version|edit(ed)?|version|mix)\b.*$", "", n)
    n = n.replace("&", "and")
    return re.sub(r"[^a-z0-9]+", " ", n).strip()


def md5(p):
    h = hashlib.md5()
    with open(p, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def main():
    pasta = sys.argv[1]
    mover = sys.argv[sys.argv.index("--mover") + 1] if "--mover" in sys.argv else None
    ficheiros = sorted((os.path.join(r, f) for r, _, fs in os.walk(pasta) for f in fs
                        if f.lower().endswith(AUD)), key=lambda p: (len(os.path.basename(p)), p))
    grupos = defaultdict(list)
    por_hash = {}
    for p in ficheiros:
        h = md5(p)
        if h in por_hash:
            grupos[por_hash[h]].append((p, "conteúdo igual"))
            continue
        por_hash[h] = p
        grupos[p]
    vistos = {}
    for p in list(grupos):
        k = chave_nome(os.path.basename(p))
        d = duracao(p)
        alvo = vistos.get(k)
        if alvo and alvo[1] and d and abs(alvo[1] - d) < 3:
            grupos[alvo[0]].append((p, f"mesmo artista e título, {d:.0f} s e {alvo[1]:.0f} s"))
            grupos[alvo[0]].extend(grupos.pop(p))
        elif not alvo:
            vistos[k] = (p, d)
    duplicados = [(manter, dup) for manter, lista in grupos.items() for dup in lista]
    for manter, (dup, porque) in duplicados:
        print(f"KEEP  {os.path.basename(manter)}\n  DUP {os.path.basename(dup)}  ({porque})")
    print(f"{len(ficheiros)} ficheiros, {len(duplicados)} repetidos")
    if mover:
        os.makedirs(mover, exist_ok=True)
        for _, (dup, _) in duplicados:
            shutil.move(dup, os.path.join(mover, os.path.basename(dup)))
        print(f"{len(duplicados)} ficheiros movidos para {mover}")


if __name__ == "__main__":
    main()
