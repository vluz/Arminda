"""Faz a voz do computador para todas as frases de www/data/falas.json, e a lista das gravações da
família que a substituem.

Correr com o Python que tem o Piper instalado (passo 5 do kit):
  python tools/gerar_voz.py

Modelo de voz: o único .onnx (com o seu .onnx.json) em tools/voz/ (ver tools/ambiente.py).
Resultado: www/voz/tts/<secção>/<chave>.ogg (Opus, mono, nivelado)
           www/voz/manifest.json  (que ids têm gravação da família em www/voz/familia)
Os ficheiros que existem ficam, a não ser que o texto tenha mudado; os de frases que já não existem
são apagados.
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import wave

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ambiente  # noqa: E402

try:
    from piper import PiperVoice, SynthesisConfig
except ImportError:
    raise SystemExit("O Piper não está instalado neste Python. Passo 5 do kit: pip install piper-tts")

WWW = os.path.join(ambiente.APP, "www")
LENTO = 1.25   # velocidade da fala: 1.0 é o normal do Piper; mais alto é mais lento e mais fácil de seguir


def to_opus(src, dst):
    """De WAV para Opus mono nivelado."""
    subprocess.run([ambiente.programa("ffmpeg"), "-hide_banner", "-loglevel", "error", "-y", "-i", src,
                    "-af", "loudnorm=I=-16:TP=-1.5,apad=pad_dur=0.1",
                    "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "32k", dst],
                   check=True)


def main():
    """Faz o que mudou, apaga o que sobra, refaz a lista das gravações da família."""
    with open(os.path.join(WWW, "data", "falas.json"), encoding="utf-8") as f:
        falas = json.load(f)
    tts_dir = os.path.join(WWW, "voz", "tts")
    stamp_path = os.path.join(tts_dir, "textos.json")
    stamps = {}
    if os.path.exists(stamp_path):
        with open(stamp_path, encoding="utf-8") as f:
            stamps = json.load(f)

    modelo = ambiente.modelo_voz()
    voice = PiperVoice.load(modelo)
    cfg = SynthesisConfig(length_scale=LENTO)
    made = 0
    vivos = set()
    with tempfile.TemporaryDirectory() as tmp:
        for linhas in falas.values():
            for linha in linhas:
                sec, key = linha["id"].split(".", 1)
                vivos.add(linha["id"])
                dst = os.path.join(tts_dir, sec, key + ".ogg")
                h = hashlib.sha1(linha["texto"].encode("utf-8")).hexdigest()
                if os.path.exists(dst) and stamps.get(linha["id"]) == h:
                    continue
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                wav = os.path.join(tmp, "x.wav")
                with wave.open(wav, "wb") as wf:
                    voice.synthesize_wav(linha["texto"], wf, syn_config=cfg)
                to_opus(wav, dst)
                stamps[linha["id"]] = h
                made += 1

    # Frases apagadas ou com outro nome: os ficheiros e as marcas delas também saem.
    orfaos = 0
    if os.path.isdir(tts_dir):
        for sec in os.listdir(tts_dir):
            d = os.path.join(tts_dir, sec)
            if not os.path.isdir(d):
                continue
            for nome in os.listdir(d):
                if nome.endswith(".ogg") and f"{sec}.{nome[:-4]}" not in vivos:
                    os.remove(os.path.join(d, nome))
                    orfaos += 1
    stamps = {k: v for k, v in stamps.items() if k in vivos}
    os.makedirs(tts_dir, exist_ok=True)
    with open(stamp_path, "w", encoding="utf-8") as f:
        json.dump(stamps, f, ensure_ascii=False, indent=1)

    fam_dir = os.path.join(WWW, "voz", "familia")
    familia = []
    if os.path.isdir(fam_dir):
        for sec in sorted(os.listdir(fam_dir)):
            d = os.path.join(fam_dir, sec)
            if os.path.isdir(d):
                familia += [f"{sec}.{n[:-4]}" for n in sorted(os.listdir(d)) if n.endswith(".ogg")]
    with open(os.path.join(WWW, "voz", "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"familia": familia}, f, ensure_ascii=False, indent=1)

    print(f"voz {os.path.basename(modelo)}: {made} ficheiros feitos, {orfaos} ficheiros antigos apagados, "
          f"{len(familia)} gravações da família na lista")


if __name__ == "__main__":
    main()
