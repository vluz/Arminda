"""Prepara os conteúdos da família no PC e (em alternativa) envia-os para o tablet por USB.

Correr com um Python que tenha o Pillow e o Piper (passo 3 do kit: pip install pillow piper-tts):
  python tools/enviar_media.py [--so-preparar | --so-enviar] [--teste]

Dois passos, feitos de seguida por omissão:
  preparar  os originais em <kit>/media/ -> a pasta <kit>/media/_preparado/ (fora do git, como o
            resto de media/). Só se refaz o que mudou; os ficheiros a que já nada se refere saem
            dessa pasta (nunca dos originais).
  enviar    manda a pasta preparada pelo adb para a pasta da app no cartão de memória (a
            alternativa; o caminho normal é pela internet: publicar_atualizacao.py --media).
  --so-preparar (ou o antigo --sem-enviar) só prepara; --so-enviar manda o que já está preparado.
  --teste prepara para www/media-teste/ e não envia (testes no browser do PC).
  --origem PASTA e --saida PASTA mudam as pastas (testes). MAE_MEDIA_ORIGEM também define a origem.

Pôr os originais em <kit>/media/:
  fotos/   fotografias da família, JPEG ou PNG, com nome de número: 001.jpg, 002.jpg (7, 07 e 007
           são o mesmo número). fotos/nomes.txt diz quem está em cada uma (regra e exemplo em
           app/exemplos/nomes-exemplo.txt): as Fotografias dizem "Olha, é a Tia Rosa!" e a legenda,
           e as fotografias com nomes falsos entram no jogo Quem é quem. Uma fotografia sem linha em
           nomes.txt segue a regra antiga: o nome do ficheiro é a legenda ("01 Os netos no Natal.jpg").
           Uma gravação da família fotos/vozes/<número>.wav (ou .m4a, .mp3, .ogg) substitui a voz
           do computador na legenda dessa fotografia.
  musica/  MP3, M4A, FLAC, OGG, WAV. O título e o artista vêm das etiquetas do ficheiro, senão de
           "Artista - Título.mp3", senão do nome do ficheiro. A primeira subpasta é a lista.
  casa/    fotografias em 360 (JPEG equirretangular, por exemplo de uma Ricoh Theta). O nome do
           ficheiro é a divisão: "01 Sala.jpg", "02 Cozinha.jpg". casa.json, opcional, diz para
           onde se olha ao entrar em cada divisão (ângulo de 0 a 359): {"inicio": {"Sala": 180}}
           (a app mostra as divisões numa lista; o campo "ligacoes" do manifesto já não é usado)
  passeios/<Lugar>/<NN Sítio>.jpg  fotografias em 360 de sítios, agrupadas por lugar.

As fotografias são postas direitas, reduzidas a 1600 px e ficam sem metadados (nem GPS nem dados
da câmara saem do PC). A música é nivelada ao mesmo volume. Cada ficheiro preparado tem o nome
tirado da sua origem ou do texto dito, por isso uma fotografia ou legenda mudada dá um nome novo;
é isso que deixa o publicar_atualizacao.py mandar só o que mudou. Os nomes e as legendas vivem só
no manifesto de media (dados da família, no tablet), nunca nos ficheiros da app.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave

from PIL import Image, ImageDraw, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ambiente  # noqa: E402
import nomes_fotos  # noqa: E402

APP = ambiente.APP
RAIZ = ambiente.RAIZ
# Os programas e o modelo de voz são encontrados por tools/ambiente.py (primeiro o PATH).
DESTINO_TABLET = "/sdcard/Android/data/pt.mae.jogos/files/media/"
ESTADO_PUBLICADO = os.path.join(RAIZ, "builds", "atualizacoes", "media-estado.json")

IMG = (".jpg", ".jpeg", ".png", ".webp")
AUD = (".mp3", ".m4a", ".flac", ".ogg", ".wav", ".opus", ".aac")
GRAVACAO = (".wav", ".m4a", ".mp3", ".ogg", ".opus")
# Pastas da arrumação dos conteúdos (no tablet e num pacote de media). Os passeios usam casa/.
PASTAS_MEDIA = ("fotos", "musica", "casa", "quem")
COLECOES = ("fotos", "musica", "casa", "passeios", "quem")
CAMINHO_MEDIA = re.compile(r"^(fotos|musica|casa|quem)/[A-Za-z0-9._-]+$")

# Escrito exatamente como antes da 0.5.0: os nomes dos ficheiros preparados vêm do caminho de origem
# (chave), por isso a mesma grafia mantém os nomes do que já está no tablet.
ORIGEM = ambiente.PASTA_MEDIA
LEGADO = None   # a pasta preparada antiga (_tablet): os ficheiros reaproveitados são copiados, não recodificados

_voz = None


def voz():
    global _voz
    if _voz is None:
        from piper import PiperVoice
        _voz = PiperVoice.load(ambiente.modelo_voz())
    return _voz


def opus(origem, destino, canais=1, kbps=32):
    # bitexact: a mesma entrada dá sempre os mesmos bytes (sem número de série Ogg ao acaso).
    subprocess.run([ambiente.programa("ffmpeg"), "-hide_banner", "-loglevel", "error", "-y", "-i", origem, "-vn",
                    "-af", "loudnorm=I=-16:TP=-1.5", "-ac", str(canais), "-ar", "48000",
                    "-c:a", "libopus", "-b:a", f"{kbps}k", "-fflags", "+bitexact", "-flags:a", "+bitexact",
                    "-map_metadata", "-1", destino], check=True)


def falar(texto, destino):
    from piper import SynthesisConfig
    with tempfile.TemporaryDirectory() as tmp:
        w = os.path.join(tmp, "v.wav")
        with wave.open(w, "wb") as wf:
            voz().synthesize_wav(texto, wf, syn_config=SynthesisConfig(length_scale=1.2))
        opus(w, destino)


def h(texto, n=16):
    return hashlib.sha1(texto.encode("utf-8")).hexdigest()[:n]


def reutilizar(saida, rel):
    """Verdadeiro quando o ficheiro preparado existe (ou pôde ser copiado da pasta preparada antiga)."""
    destino = os.path.join(saida, rel)
    if os.path.exists(destino):
        return True
    if LEGADO and os.path.isfile(os.path.join(LEGADO, rel)):
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        shutil.copyfile(os.path.join(LEGADO, rel), destino)
        return True
    return False


def fala_para(saida, pasta, texto):
    """Texto dito -> <pasta>/v-<resumo do texto>.ogg, feito uma vez e guardado (a voz do Piper sai um
    pouco diferente de cada vez, por isso refazê-la obrigaria cada pacote a mandá-la de novo)."""
    rel = f"{pasta}/v-{h(texto)}.ogg"
    if not reutilizar(saida, rel):
        os.makedirs(os.path.join(saida, pasta), exist_ok=True)
        falar(texto, os.path.join(saida, rel))
    return rel


def nome_limpo(ficheiro):
    base = os.path.splitext(os.path.basename(ficheiro))[0]
    base = re.sub(r"^\d+[\s._-]*", "", base)          # número de ordem no início
    return re.sub(r"[_]+", " ", base).strip()


def chave(caminho):
    st = os.stat(caminho)
    return hashlib.sha1(f"{caminho}|{st.st_size}|{st.st_mtime}".encode()).hexdigest()[:12]


PASTAS = {"musica": ("musica", "music")}   # nomes de pasta aceites


def raiz(pasta):
    for nome in PASTAS.get(pasta, (pasta,)):
        d = os.path.join(ORIGEM, nome)
        if os.path.isdir(d):
            return d
    return None


def listar(pasta, ext):
    d = raiz(pasta)
    if not d:
        return []
    return sorted(os.path.join(r, f) for r, _, fs in os.walk(d) for f in fs if f.lower().endswith(ext))


def ler_nomes():
    d = raiz("fotos")
    caminho = os.path.join(d, "nomes.txt") if d else None
    if not caminho or not os.path.isfile(caminho):
        return {}
    try:
        entradas, avisos = nomes_fotos.ler(caminho)
    except nomes_fotos.NomesErro as e:
        print("Problemas em " + caminho + " (nada foi preparado):")
        for x in e.erros:
            print("  " + x)
        sys.exit(1)
    for a in avisos:
        print("  note: " + a)
    return {x["numero"]: x for x in entradas}


def gravacao(numero):
    """Uma gravação da família para a legenda desta fotografia, ou None."""
    d = raiz("fotos")
    pasta = os.path.join(d, "vozes") if d else None
    if not pasta or not os.path.isdir(pasta):
        return None
    for f in sorted(os.listdir(pasta)):
        if f.lower().endswith(GRAVACAO) and nomes_fotos.numero_da_foto(f) == numero:
            return os.path.join(pasta, f)
    return None


def preparar_fotos(saida):
    """Devolve (fotos, quem): o álbum e as fotografias para o Quem é quem."""
    os.makedirs(os.path.join(saida, "fotos"), exist_ok=True)
    nomes = ler_nomes()
    fontes = [s for s in listar("fotos", IMG) if os.path.basename(os.path.dirname(s)) != "vozes"]
    por_numero = {}
    for src in fontes:
        n = nomes_fotos.numero_da_foto(src)
        if n is not None and n in nomes:
            if n in por_numero:
                print(f"ERRO: duas fotografias têm o número {n}: {os.path.basename(por_numero[n])} e "
                      f"{os.path.basename(src)}. Mude o nome a uma (nada foi preparado).")
                sys.exit(1)
            por_numero[n] = src
    for n, x in sorted(nomes.items()):
        if n not in por_numero:
            print(f"  nota: nomes.txt linha {x['linha']}: não há fotografia {n:03d}.jpg (nem .jpeg, .png) em fotos/; linha saltada")
    # Primeiro as fotografias com número, por ordem de número; as outras pelo nome do ficheiro.
    fontes.sort(key=lambda s: (nomes_fotos.numero_da_foto(s) is None, nomes_fotos.numero_da_foto(s) or 0, s))
    fotos, quem = [], []
    for src in fontes:
        k = chave(src)
        jpg = f"fotos/{k}.jpg"
        if not reutilizar(saida, jpg):
            with Image.open(src) as im:
                im = ImageOps.exif_transpose(im).convert("RGB")
                im.thumbnail((1600, 1600), Image.LANCZOS)
                im.save(os.path.join(saida, jpg), "JPEG", quality=85, optimize=True)  # o EXIF não fica
        numero = nomes_fotos.numero_da_foto(src)
        x = nomes.get(numero) if por_numero.get(numero) == src else None
        item = {"ficheiro": jpg}
        if numero is not None:
            item["numero"] = numero
        if x:
            legenda = x["legenda"]
            if legenda and legenda[-1] not in ".!?":
                legenda += "."
            texto = nomes_fotos.frase_olha(x["nome"]) + (" " + legenda if legenda else "")
            item["legenda"] = nomes_fotos.sem_artigo(x["nome"]) + (". " + legenda if legenda else "")
        else:
            texto = nome_limpo(src)
            item["legenda"] = texto
        rec = gravacao(numero) if numero is not None else None
        if rec:
            with open(rec, "rb") as f:
                rel = f"fotos/r-{hashlib.sha1(f.read()).hexdigest()[:16]}.ogg"
            if not reutilizar(saida, rel):
                opus(rec, os.path.join(saida, rel))
            item["voz"] = rel
        elif texto:
            item["voz"] = fala_para(saida, "fotos", texto)
        else:
            item["voz"] = None
        fotos.append(item)
        if x and x["falsos"]:
            vozes = {}
            for nome in [x["nome"], *x["falsos"]]:
                vozes[nome] = {"opcao": fala_para(saida, "quem", nomes_fotos.frase_opcao(nome)),
                               "ou": fala_para(saida, "quem", nomes_fotos.frase_ou(nome))}
            quem.append({
                "ficheiro": jpg, "numero": numero, "nome": x["nome"], "falsos": x["falsos"],
                "vozes": vozes,
                "voz_olha": fala_para(saida, "quem", nomes_fotos.frase_olha(x["nome"])),
                "voz_quem": fala_para(saida, "quem", nomes_fotos.frase_quem(x["nome"])),
            })
    return fotos, quem


def etiquetas(src):
    r = subprocess.run([ambiente.programa("ffprobe"), "-v", "quiet", "-print_format", "json", "-show_format", src],
                       capture_output=True, text=True)
    try:
        tags = {k.lower(): v for k, v in json.loads(r.stdout)["format"].get("tags", {}).items()}
    except (ValueError, KeyError):
        tags = {}
    titulo, artista = tags.get("title"), tags.get("artist")
    if not titulo:
        n = nome_limpo(src)
        if " - " in n:
            artista, titulo = [x.strip() for x in n.split(" - ", 1)]
        else:
            titulo = n
    return titulo, artista or ""


def preparar_musica(saida):
    os.makedirs(os.path.join(saida, "musica"), exist_ok=True)
    lista = []
    for src in listar("musica", AUD):
        k = chave(src)
        ogg = f"musica/{k}.ogg"
        if not reutilizar(saida, ogg):
            opus(src, os.path.join(saida, ogg), canais=2, kbps=96)
        titulo, artista = etiquetas(src)
        # A primeira subpasta dentro da pasta da música é a lista ("Natal", "Fado").
        rel = os.path.relpath(src, raiz("musica"))
        playlist = rel.split(os.sep)[0] if os.sep in rel else ""
        lista.append({"ficheiro": ogg, "titulo": titulo, "artista": artista, "lista": playlist})
    return lista


def preparar_casa(saida):
    return preparar_360(saida, listar("casa", (".jpg", ".jpeg")), os.path.join(ORIGEM, "casa", "casa.json"))


def preparar_passeios(saida):
    """passeios/<Lugar>/<NN Sítio>.jpg -> sítios com "grupo": "<Lugar>"."""
    d = raiz("passeios")
    if not d:
        return []
    todos = []
    for lugar in sorted(os.listdir(d)):
        pasta = os.path.join(d, lugar)
        if not os.path.isdir(pasta):
            continue
        fontes = sorted(os.path.join(pasta, f) for f in os.listdir(pasta) if f.lower().endswith((".jpg", ".jpeg")))
        for item in preparar_360(saida, fontes, os.path.join(pasta, "lugar.json"), prefixo=lugar):
            item["grupo"] = lugar
            todos.append(item)
    return todos


def preparar_360(saida, fontes, cfg_path, prefixo=""):
    os.makedirs(os.path.join(saida, "casa"), exist_ok=True)
    cfg = {}
    if os.path.exists(cfg_path):
        with open(cfg_path, encoding="utf-8") as f:
            cfg = json.load(f)
    nomes = [nome_limpo(s) for s in fontes]
    ids = [re.sub(r"[^a-z0-9]+", "-", (prefixo + " " + n).lower()).strip("-") for n in nomes]
    lista = []
    for i, (src, nome, rid) in enumerate(zip(fontes, nomes, ids)):
        k = chave(src)
        jpg = f"casa/{k}.jpg"
        ogg = f"casa/{k}.ogg"
        if not reutilizar(saida, jpg):
            Image.MAX_IMAGE_PIXELS = None
            with Image.open(src) as im:
                im = im.convert("RGB").resize((4096, 2048), Image.LANCZOS)
                # Tapar o tripé em baixo (nadir): numa vista em 360 a faixa de baixo
                # vira uma mancha redonda no chão, mesmo por baixo.
                d = ImageDraw.Draw(im)
                topo = int(2048 * 0.88)
                d.rectangle([0, topo, 4096, 2048], fill=(255, 183, 3))
                d.rectangle([0, topo, 4096, topo + 14], fill=(17, 17, 17))
                im.save(os.path.join(saida, jpg), "JPEG", quality=85, optimize=True)
        if not reutilizar(saida, ogg):
            falar(nome, os.path.join(saida, ogg))
        if nome in cfg.get("ligacoes", {}):
            lig = [{"para": ids[nomes.index(n)], "yaw": y} for n, y in cfg["ligacoes"][nome] if n in nomes]
        else:
            lig = []
            if i + 1 < len(ids):
                lig.append({"para": ids[i + 1], "yaw": 0})
            if i > 0:
                lig.append({"para": ids[i - 1], "yaw": 180})
        lista.append({"id": rid, "nome": nome, "ficheiro": jpg, "voz": ogg,
                      "inicio": cfg.get("inicio", {}).get(nome, 0), "ligacoes": lig})
    return lista


def caminhos(valor):
    """Todos os caminhos de ficheiros de media dentro de um item do manifesto (a qualquer profundidade)."""
    if isinstance(valor, str):
        if CAMINHO_MEDIA.match(valor):
            yield valor
    elif isinstance(valor, dict):
        for v in valor.values():
            yield from caminhos(v)
    elif isinstance(valor, list):
        for v in valor:
            yield from caminhos(v)


def com_prefixo(valor, prefixo):
    """Cópia de um item do manifesto com todos os caminhos de media absolutos (o manifesto do próprio tablet)."""
    if isinstance(valor, str):
        return prefixo + valor if CAMINHO_MEDIA.match(valor) else valor
    if isinstance(valor, dict):
        return {k: com_prefixo(v, prefixo) for k, v in valor.items()}
    if isinstance(valor, list):
        return [com_prefixo(v, prefixo) for v in valor]
    return valor


def podar(saida, manifesto):
    """Apaga os ficheiros preparados a que nada no manifesto se refere já."""
    usados = set(caminhos(manifesto))
    tirados = 0
    for pasta in PASTAS_MEDIA:
        d = os.path.join(saida, pasta)
        if not os.path.isdir(d):
            continue
        for f in os.listdir(d):
            if f"{pasta}/{f}" not in usados and os.path.isfile(os.path.join(d, f)):
                os.remove(os.path.join(d, f))
                tirados += 1
    return tirados


def preparar(saida):
    os.makedirs(saida, exist_ok=True)
    fotos, quem = preparar_fotos(saida)
    manifesto = {"fotos": fotos, "musica": preparar_musica(saida),
                 "casa": preparar_casa(saida), "passeios": preparar_passeios(saida), "quem": quem}
    for rel in caminhos(manifesto):
        if not os.path.isfile(os.path.join(saida, rel)):
            print("ERRO: falta um ficheiro preparado: " + rel)
            sys.exit(1)
    tirados = podar(saida, manifesto)
    with open(os.path.join(saida, "manifest.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifesto, f, ensure_ascii=False, indent=1)
    print(f"{len(fotos)} fotografias ({len(quem)} para o Quem é quem), {len(manifesto['musica'])} músicas, "
          f"{len(manifesto['casa'])} divisões da casa, {len(manifesto['passeios'])} sítios de passeio -> {saida}"
          + (f"; {tirados} ficheiros preparados antigos apagados" if tirados else ""))
    return manifesto


def sha256(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def versao_para_o_tablet(saida, manifesto):
    """A versão de media a escrever no manifesto do tablet.

    Os pacotes pela internet são diferenças em relação ao que foi publicado (media-estado.json, de
    publicar_atualizacao.py). O tablet só pode dizer que tem a versão n se tiver exatamente a media
    da versão n; senão os pacotes seguintes deixavam-no com ficheiros a menos ou a mais para sempre.
      - sem media-estado.json (quem não usa as atualizações pela internet): versão 0;
      - a media preparada é igual à publicada: a versão publicada;
      - é diferente e ainda só há a base (versão 0): versão 0, com o aviso de registar a base outra vez;
      - é diferente e já há pacotes publicados: parar, e dizer como se resolve.
    """
    if not os.path.isfile(ESTADO_PUBLICADO):
        return 0
    with open(ESTADO_PUBLICADO, encoding="utf-8") as f:
        estado = json.load(f)
    versao = int(estado.get("versao", 0))
    preparado = {k: v for k, v in manifesto.items() if k in COLECOES}
    publicado = {k: v for k, v in estado.get("manifesto", {}).items() if k in COLECOES}
    ficheiros = {rel: sha256(os.path.join(saida, rel.replace("/", os.sep))) for rel in sorted(set(caminhos(preparado)))}
    igual = ficheiros == estado.get("ficheiros", {}) and all(
        preparado.get(c, []) == publicado.get(c, []) for c in COLECOES)
    if igual:
        return versao
    if versao == 0:
        print("AVISO: a media preparada mudou desde que a base foi registada. Depois deste envio corra outra vez:\n"
              "  python tools/publicar_atualizacao.py --media-base")
        return 0
    print(f"ERRO: a media preparada não é igual à versão {versao} publicada pela internet.\n"
          "Se fosse enviada assim por USB, os pacotes seguintes deixavam o tablet com a media errada.\n"
          "Publique primeiro o que preparou, e envie por USB depois (o tablet fica igual à versão nova):\n"
          "  python tools/publicar_atualizacao.py --media --enviar\n"
          "  python tools/enviar_media.py --so-enviar")
    sys.exit(1)


def enviar(saida):
    """Alternativa pelo adb: manda os conteúdos preparados para o cartão e o manifesto para a memória interna."""
    with open(os.path.join(saida, "manifest.json"), encoding="utf-8") as f:
        manifesto = json.load(f)
    # Os ficheiros de media vão para a pasta da app no cartão de memória quando há um; o
    # manifesto vai sempre para a memória interna, com caminhos absolutos para o cartão.
    # Antes de mexer no tablet: a versão só se escreve se a media for mesmo a dessa versão.
    versao = versao_para_o_tablet(saida, manifesto)
    cartao = cartao_sd()
    destino_ficheiros = f"/storage/{cartao}/Android/data/pt.mae.jogos/files/media/" if cartao else DESTINO_TABLET
    print("ficheiros de media ->", destino_ficheiros)
    for pasta in PASTAS_MEDIA:
        local = os.path.join(saida, pasta)
        if not os.path.isdir(local) or not os.listdir(local):
            continue
        subprocess.run([ambiente.adb(), "shell", "mkdir", "-p", destino_ficheiros + pasta], check=True)
        r = subprocess.run([ambiente.adb(), "push", "--sync", local + os.sep + ".", destino_ficheiros + pasta + "/"],
                           capture_output=True, text=True, check=False)
        print(pasta + ":", (r.stdout or r.stderr).strip().splitlines()[-1] if (r.stdout or r.stderr) else "ok")
        if r.returncode:
            sys.exit(r.returncode)
    no_tablet = {k: com_prefixo(v, destino_ficheiros) for k, v in manifesto.items()}
    # A versão de media de onde os pacotes pela internet continuam (versao_para_o_tablet). Um pacote
    # seguinte manda o que mudou desde essa versão (ver publicar_atualizacao.py --media).
    no_tablet["versao_media"] = versao
    caminho = os.path.join(saida, "manifest-tablet.json")
    with open(caminho, "w", encoding="utf-8", newline="\n") as f:
        json.dump(no_tablet, f, ensure_ascii=False, indent=1)
    subprocess.run([ambiente.adb(), "shell", "mkdir", "-p", DESTINO_TABLET], check=True)
    subprocess.run([ambiente.adb(), "push", caminho, DESTINO_TABLET + "manifest.json.tmp"], check=True, capture_output=True)
    subprocess.run([ambiente.adb(), "shell", "mv", "-f", DESTINO_TABLET + "manifest.json.tmp", DESTINO_TABLET + "manifest.json"],
                   check=True)
    print(f"manifesto -> {DESTINO_TABLET}manifest.json (versão de media {no_tablet['versao_media']})")


def cartao_sd():
    """Identificador (UUID) de um cartão de memória montado, por exemplo '0A07-12FD', ou None."""
    r = subprocess.run([ambiente.adb(), "shell", "sm", "list-volumes", "public"], capture_output=True, text=True, check=False)
    for linha in r.stdout.splitlines():
        partes = linha.split()
        if len(partes) == 3 and partes[1] == "mounted" and partes[2] != "null":
            return partes[2]
    return None


def main():
    global ORIGEM, LEGADO
    ap = argparse.ArgumentParser(description="Prepara os conteúdos da família e, em alternativa, envia-os pelo adb.")
    ap.add_argument("--so-preparar", "--sem-enviar", dest="so_preparar", action="store_true", help="só preparar")
    ap.add_argument("--so-enviar", action="store_true", help="enviar o que já está preparado")
    ap.add_argument("--teste", action="store_true", help="preparar para www/media-teste, sem enviar")
    ap.add_argument("--origem", help="pasta com os originais (por omissão <kit>/media)")
    ap.add_argument("--saida", help="pasta preparada (por omissão <origem>/_preparado)")
    a = ap.parse_args()
    if a.origem:
        ORIGEM = os.path.abspath(a.origem)
    saida = (os.path.abspath(a.saida) if a.saida
             else os.path.join(APP, "www", "media-teste") if a.teste
             else os.path.join(ORIGEM, "_preparado"))
    legado = os.path.join(ORIGEM, "_tablet")
    LEGADO = legado if os.path.isdir(legado) and os.path.abspath(legado) != saida else None
    if not a.so_enviar:
        preparar(saida)
    if a.teste or a.so_preparar:
        return
    if not os.path.isfile(os.path.join(saida, "manifest.json")):
        print("ERRO: nada preparado em " + saida)
        sys.exit(1)
    enviar(saida)


if __name__ == "__main__":
    main()
