"""Transforma as gravações por secção em ficheiros de voz da família, um por frase.

Correr: python tools/importar_gravacoes.py [secção ...]

Para cada <kit>/audio/raw/<secção>.wav (secções como em www/data/falas.json), encontra a duração
de pausa que a corta em exatamente tantos pedaços quantas as frases da secção; depois apara, limpa,
nivela e escreve www/voz/familia/<secção>/<chave>.ogg. A seguir correr gerar_voz.py para refazer
a lista. Uma secção cujo número de pedaços não bate certo é saltada e avisada, para nunca tocar
uma frase com o nome errado.
"""
import json
import os
import re
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ambiente  # noqa: E402

APP = ambiente.APP
WWW = os.path.join(APP, "www")
RAW = ambiente.PASTA_GRAVACOES
FFMPEG = ambiente.programa("ffmpeg")
MARGEM = 0.12
MIN_FALA = 0.25
LIMIAR_DB = -35

# Filtro para os graves de fundo, limpeza suave do ruído, depois o mesmo volume da voz do computador.
FILTRO = "highpass=f=80,afftdn=nr=12:nf=-45:tn=1,loudnorm=I=-16:TP=-1.5"


def silencios(path, pausa):
    err = subprocess.run([FFMPEG, "-hide_banner", "-i", path, "-af",
                          f"silencedetect=noise={LIMIAR_DB}dB:d={pausa}", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err)
    total = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    ini = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    fim = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    fim += [total] * (len(ini) - len(fim))
    return total, list(zip(ini, fim))


def falas_em(total, sil):
    out, pos = [], 0.0
    for s, e in sil:
        if s - pos >= MIN_FALA:
            out.append((pos, s))
        pos = e
    if total - pos >= MIN_FALA:
        out.append((pos, total))
    return out


def dividir(path, esperado):
    # A pausa mais comprida que ainda dá a contagem certa é o corte mais seguro.
    for pausa in (1.5, 1.2, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3):
        total, sil = silencios(path, pausa)
        pedacos = falas_em(total, sil)
        if len(pedacos) == esperado:
            return total, pedacos, pausa
    return None, None, None


def main():
    with open(os.path.join(WWW, "data", "falas.json"), encoding="utf-8") as f:
        falas = json.load(f)
    pedidas = sys.argv[1:] or [s for s in falas if os.path.exists(os.path.join(RAW, s + ".wav"))]
    for sec in pedidas:
        src = os.path.join(RAW, sec + ".wav")
        if sec not in falas or not os.path.exists(src):
            print(f"{sec}: a secção não existe ou não tem gravação; saltada")
            continue
        linhas = falas[sec]
        total, pedacos, pausa = dividir(src, len(linhas))
        if not pedacos:
            print(f"{sec}: não se conseguiu cortar em {len(linhas)} frases. Grave outra vez com pausas mais compridas. Saltada.")
            continue
        destino = os.path.join(WWW, "voz", "familia", sec)
        os.makedirs(destino, exist_ok=True)
        with tempfile.TemporaryDirectory() as tmp:
            for (s, e), linha in zip(pedacos, linhas):
                s, e = max(0.0, s - MARGEM), min(total, e + MARGEM)
                chave = linha["id"].split(".", 1)[1]
                wav = os.path.join(tmp, "x.wav")
                subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", src,
                                "-ss", f"{s:.3f}", "-to", f"{e:.3f}", "-af", FILTRO, wav], check=True)
                subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", wav,
                                "-af", "afade=t=in:d=0.03,areverse,afade=t=in:d=0.08,areverse",
                                "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "40k",
                                os.path.join(destino, chave + ".ogg")], check=True)
        print(f"{sec}: {len(linhas)} frases importadas (pausa de {pausa} s)")
    print("Agora corra gerar_voz.py para refazer a lista, e depois construa o APK outra vez.")


if __name__ == "__main__":
    main()
