"""Onde as ferramentas encontram os programas e os ficheiros de que precisam. Um só sítio para mudar,
usado por todas as ferramentas.

Os programas procuram-se primeiro no PATH (ffmpeg, adb, openssl). Se um programa não está no PATH,
tentam-se os sítios alternativos abaixo; acrescente lá o seu caminho se for preciso. As pastas são
relativas ao kit, por isso nada depende de uma letra de disco.
"""
import glob
import os
import shutil

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))     # a pasta da app
RAIZ = os.path.dirname(APP)                                           # a pasta que tem app/
PERFIL = os.environ.get("USERPROFILE") or os.environ.get("HOME") or ""

# ---- Sítios alternativos, tentados só quando o programa não está no PATH ----
LOCAIS = {
    "ffmpeg": [os.path.join(PERFIL, "scoop", "shims", "ffmpeg.exe")],
    "ffprobe": [os.path.join(PERFIL, "scoop", "shims", "ffprobe.exe")],
    "magick": [os.path.join(PERFIL, "scoop", "shims", "magick.exe")],
    "openssl": [os.path.join(PERFIL, "scoop", "shims", "openssl.exe"),
                r"C:\Program Files\Git\mingw64\bin\openssl.exe", r"C:\Program Files\Git\usr\bin\openssl.exe"],
    "bash": [r"C:\Program Files\Git\bin\bash.exe"],
    "node": [],
}

# ---- Android SDK: ANDROID_HOME, senão os sítios habituais ----
SDK_CANDIDATOS = [
    os.environ.get("ANDROID_HOME", ""),
    os.environ.get("ANDROID_SDK_ROOT", ""),
    os.path.join(os.environ.get("LOCALAPPDATA", ""), "Android", "Sdk"),
    os.path.join(PERFIL, "Android", "Sdk"),
]

# ---- A voz do computador (passo 5 do kit): um modelo .onnx (com o seu .onnx.json) em app/tools/voz/ ----
PASTA_VOZ = os.path.join(APP, "tools", "voz")
MODELO_VOZ_FALLBACK = ""

# ---- Conteúdos da família (passo 6 do kit): originais em <kit>/media, ao lado de app/ ----
PASTA_MEDIA = os.environ.get("MAE_MEDIA_ORIGEM", os.path.join(RAIZ, "media"))

# ---- Gravações da família (passo 5 do kit): <kit>/audio/raw/<secção>.wav ----
PASTA_GRAVACOES = os.path.join(RAIZ, "audio", "raw")

# ---- Segredos (passos 10 e 11): um ficheiro de texto com linhas NOME=valor, nunca no git ----
PASTA_SEGREDOS = os.path.join(RAIZ, ".SECRETS")
FICHEIRO_SEGREDOS = os.path.join(PASTA_SEGREDOS, "SECRETS.txt")
FICHEIROS_SEGREDOS = [FICHEIRO_SEGREDOS]

# ---- Afinações opcionais de um só PC (tools/ambiente_local.py, nunca no git): pode definir
# SDK_EXTRA (lista de pastas de SDK), MODELO_VOZ_EXTRA (caminho), SEGREDOS_EXTRA (lista de ficheiros),
# LOCAIS_EXTRA (dicionário como LOCAIS) ----
try:
    import ambiente_local  # noqa: E402
    SDK_CANDIDATOS += getattr(ambiente_local, "SDK_EXTRA", [])
    MODELO_VOZ_FALLBACK = getattr(ambiente_local, "MODELO_VOZ_EXTRA", MODELO_VOZ_FALLBACK)
    FICHEIROS_SEGREDOS += getattr(ambiente_local, "SEGREDOS_EXTRA", [])
    for _nome, _caminhos in getattr(ambiente_local, "LOCAIS_EXTRA", {}).items():
        LOCAIS.setdefault(_nome, []).extend(_caminhos)
except ImportError:
    pass


def programa(nome):
    """Caminho completo de um programa: primeiro o PATH, depois os sítios alternativos. Erro claro se faltar."""
    caminho = shutil.which(nome)
    if caminho:
        return caminho
    for c in LOCAIS.get(nome, []):
        if c and os.path.exists(c):
            return c
    raise SystemExit(f"{nome} em falta. Instale-o e confirme que está no PATH "
                     f"(ou acrescente o sítio dele a LOCAIS em tools/ambiente.py).")


def sdk():
    """A pasta do Android SDK."""
    for c in SDK_CANDIDATOS:
        if c and os.path.isdir(os.path.join(c, "platform-tools")):
            return c
    raise SystemExit("Android SDK em falta: defina ANDROID_HOME com a pasta que tem platform-tools.")


def adb():
    """O adb.exe do SDK (o PATH é tentado primeiro)."""
    caminho = shutil.which("adb")
    if caminho:
        return caminho
    return os.path.join(sdk(), "platform-tools", "adb" + (".exe" if os.name == "nt" else ""))


def build_tools(ferramenta):
    """Um programa da pasta de build-tools mais recente (aapt2, apksigner)."""
    base = os.path.join(sdk(), "build-tools")
    versoes = sorted(glob.glob(os.path.join(base, "*")), reverse=True)
    for v in versoes:
        for nome in (ferramenta + ".exe", ferramenta + ".bat", ferramenta):
            c = os.path.join(v, nome)
            if os.path.exists(c):
                return c
    raise SystemExit(f"{ferramenta} em falta em {base}: instale um pacote de build-tools com o sdkmanager.")


def modelo_voz():
    """O modelo de voz do Piper: o único .onnx em tools/voz/, senão o caminho alternativo."""
    modelos = glob.glob(os.path.join(PASTA_VOZ, "*.onnx"))
    if len(modelos) == 1:
        return modelos[0]
    if len(modelos) > 1:
        raise SystemExit(f"há mais de um .onnx em {PASTA_VOZ}: deixe só a voz que quer.")
    if MODELO_VOZ_FALLBACK and os.path.exists(MODELO_VOZ_FALLBACK):
        return MODELO_VOZ_FALLBACK
    raise SystemExit(f"falta o modelo de voz: ponha um .onnx (e o seu .onnx.json) em {PASTA_VOZ} (passo 5 do kit).")


def segredo(nome, obrigatorio=True):
    """Uma linha NOME=valor do ficheiro de segredos. Nunca é mostrada por nenhuma ferramenta."""
    for ficheiro in FICHEIROS_SEGREDOS:
        if not os.path.exists(ficheiro):
            continue
        with open(ficheiro, encoding="utf-8") as f:
            for linha in f:
                linha = linha.strip()
                if linha.startswith(nome + "="):
                    return linha.split("=", 1)[1].strip()
    valor = os.environ.get(nome)
    if valor:
        return valor
    if obrigatorio:
        raise SystemExit(f"{nome} em falta em {FICHEIRO_SEGREDOS} (uma linha NOME=valor) e nas variáveis de ambiente.")
    return None
