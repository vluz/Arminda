"""Publica uma atualização pela internet para o tablet: um pacote web, um APK, um pacote de media, ou vários.

Correr (em qualquer pasta):
    python tools/publicar_atualizacao.py --bundle                 # ensaio: constrói e mostra
    python tools/publicar_atualizacao.py --bundle --enviar        # constrói e envia
    python tools/publicar_atualizacao.py --apk <ficheiro.apk> [--bundle] [--enviar]
    python tools/publicar_atualizacao.py --media [--enviar]
    python tools/publicar_atualizacao.py --media-base [manifest.json]

  --media    pega nos conteúdos preparados por enviar_media.py --so-preparar (<kit>/media/_preparado),
             compara-os com o que foi publicado da última vez (builds/atualizacoes/media-estado.json)
             e comprime só os ficheiros novos ou mudados, mais pack.json (por coleção: itens a
             acrescentar ou substituir, chaves a remover, a ordem completa; e os ficheiros a apagar),
             como media/media-<n>.zip. O pacote n continua do pacote n-1 ("base"); o versao.json
             lista também os 30 pacotes anteriores ("anteriores"), para um tablet que falhou um os
             apanhar por ordem; um tablet ainda mais atrasado recebe a media por USB
             (enviar_media.py --so-enviar). Limites: 500 MB comprimido, 1 GB descomprimido.
  --media-base  regista, uma vez, o que o tablet já tem do envio por USB (por omissão o
             manifest.json da pasta preparada, <kit>/media/_preparado, e os seus ficheiros) como
             versão de media 0, para o primeiro pacote mandar só o que é novo. Correr logo a seguir
             ao envio por USB, antes de preparar mais alguma coisa. Só local; nada é enviado.

O que faz:
  --bundle   corre tools/preparar_build.py, copia www-build com a versão do pacote web subida em um
             (a linha "export const BUNDLE = n;" em js/atualizar.js), e comprime-o como
             bundles/www-<n>.zip. nativo_minimo é o versionCode de android/app/build.gradle
             (o código nativo para que estes ficheiros web foram escritos); muda-se com --nativo-minimo.
  --apk F    pega num APK construído (normalmente android/app/build/outputs/apk/debug/app-debug.apk
             depois de npm run apk), lê o pacote e o versionCode, recusa-o se for testOnly (o
             tablet não os consegue instalar), e dá-lhe o nome apk/jogos-da-mae-<código>.apk.
  Cada ficheiro leva o seu sha256 e uma assinatura ECDSA P-256 / SHA-256 feita com o openssl e a
  chave privada em <kit>/.SECRETS/atualizacoes/privada.pem (nunca mostrada, nunca copiada). A
  assinatura é conferida com a chave pública antes de acontecer mais alguma coisa. O versao.json
  é escrito com as duas partes (a parte não publicada desta vez fica como no último envio).

Tudo fica em <kit>/builds/atualizacoes/ (fora do git). Sem --enviar nada sai do PC: mostra as
ordens de envio. Com --enviar envia com
    a ordem MAE_ENVIO do ficheiro de segredos, com {local} e {remoto} preenchidos
(o caminho é relativo à pasta publico/ do servidor), primeiro os ficheiros e no fim o versao.json.
Só depois de todos os envios correrem bem é que escreve a nova versão do pacote web em
www/js/atualizar.js, para a construção seguinte do APK a levar como versão de origem, e guarda o
versao.json como publicado.json.
"""
import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ambiente  # noqa: E402

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAIZ = os.path.dirname(APP)
WWW_BUILD = os.path.join(APP, "www-build")
ATUALIZAR_JS = os.path.join(APP, "www", "js", "atualizar.js")
GRADLE = os.path.join(APP, "android", "app", "build.gradle")
CHAVE = os.path.join(RAIZ, ".SECRETS", "atualizacoes", "privada.pem")
PUBLICA = os.path.join(RAIZ, ".SECRETS", "atualizacoes", "publica.pem")
SAIDA = os.path.join(RAIZ, "builds", "atualizacoes")
# Como os ficheiros chegam à pasta publico/ do servidor: um modelo de ordem no ficheiro de segredos,
# MAE_ENVIO, com {local} e {remoto}, por exemplo
#   MAE_ENVIO=scp {local} jogos@servidor.example.org:/srv/jogos/dados/publico/{remoto}
# (--publico-local <pasta> copia para uma pasta, para um servidor nesta máquina).
ENVIO = ambiente.segredo("MAE_ENVIO", obrigatorio=False)
PACOTE = "pt.mae.jogos"
LINHA_BUNDLE = re.compile(r"^export const BUNDLE = (\d+);(?=\r?$)", re.M)   # também em pastas com fins de linha CRLF
# Data fixa para as entradas do zip: os mesmos ficheiros dão sempre o mesmo zip.
DATA_ZIP = (2026, 1, 1, 0, 0, 0)


def falhar(msg):
    print("ERRO: " + msg)
    sys.exit(1)


def programa(nome, alternativas):
    achado = shutil.which(nome)
    if achado:
        return achado
    for a in alternativas:
        if os.path.isfile(a):
            return a
    falhar(f"{nome} em falta")


def openssl():
    return ambiente.programa("openssl")


def comando_envio(local, remoto):
    """A ordem de envio de um ficheiro, a partir do modelo MAE_ENVIO."""
    if not ENVIO:
        falhar("MAE_ENVIO não está no ficheiro de segredos (como os ficheiros chegam ao servidor), "
               "e não foi dado --publico-local")
    return ENVIO.replace("{local}", '"' + local.replace(os.sep, "/") + '"').replace("{remoto}", remoto)


def aapt2():
    return ambiente.build_tools("aapt2")


def sha256(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def assinar(caminho):
    """Assina os bytes do ficheiro; devolve a assinatura DER em base64. Confere-a com a chave pública."""
    if not os.path.isfile(CHAVE):
        falhar("falta a chave privada: " + CHAVE)
    conferir_chave_da_app()
    with tempfile.TemporaryDirectory() as tmp:
        sig = os.path.join(tmp, "assinatura.der")
        subprocess.run([openssl(), "dgst", "-sha256", "-sign", CHAVE, "-out", sig, caminho], check=True,
                       stdout=subprocess.DEVNULL)
        r = subprocess.run([openssl(), "dgst", "-sha256", "-verify", PUBLICA, "-signature", sig, caminho],
                           capture_output=True, text=True)
        if r.returncode != 0 or "Verified OK" not in r.stdout:
            falhar("a assinatura nova não confere com a chave pública")
        with open(sig, "rb") as f:
            return base64.b64encode(f.read()).decode("ascii")


def conferir_chave_da_app():
    """Para, a não ser que a chave pública dentro da app (Atualizar.java) seja o par da chave privada."""
    java = os.path.join(APP, "android", "app", "src", "main", "java", "pt", "mae", "jogos", "Atualizar.java")
    with open(java, encoding="utf-8") as f:
        m = re.search(r'CHAVE_PUBLICA =\s*"([^"]*)"', f.read())
    na_app = m.group(1) if m else ""
    r = subprocess.run([openssl(), "ec", "-in", CHAVE, "-pubout", "-outform", "DER"], capture_output=True)
    if r.returncode != 0:
        falhar("não se conseguiu ler a chave privada: " + CHAVE)
    if base64.b64encode(r.stdout).decode("ascii") != na_app:
        falhar("CHAVE_PUBLICA em Atualizar.java está vazia ou não é o par da chave privada: "
               "cole lá a chave pública (passo 11 do kit), construa e instale a app, e depois publique")


def versao_fonte():
    with open(ATUALIZAR_JS, encoding="utf-8") as f:
        achados = LINHA_BUNDLE.findall(f.read())
    if len(achados) != 1:
        falhar("www/js/atualizar.js tem de ter exatamente uma linha 'export const BUNDLE = n;'")
    return int(achados[0])


def escrever_versao(caminho, n):
    with open(caminho, encoding="utf-8", newline="") as f:
        texto = f.read()
    novo, quantos = LINHA_BUNDLE.subn(f"export const BUNDLE = {n};", texto)
    if quantos != 1:
        falhar(f"{caminho}: a linha BUNDLE não aparece exatamente uma vez")
    with open(caminho, "w", encoding="utf-8", newline="") as f:
        f.write(novo)


def codigo_gradle():
    with open(GRADLE, encoding="utf-8") as f:
        m = re.search(r"findProperty\('codigoVersao'\) \?: '(\d+)'", f.read())
    if not m:
        falhar("versionCode em falta em build.gradle")
    return int(m.group(1))


def fazer_bundle(n, nativo_minimo):
    subprocess.run([sys.executable, "-I", os.path.join(APP, "tools", "preparar_build.py")], check=True)
    pasta = os.path.join(SAIDA, "bundles")
    os.makedirs(pasta, exist_ok=True)
    destino = os.path.join(pasta, f"www-{n}.zip")
    with tempfile.TemporaryDirectory(dir=SAIDA) as tmp:
        copia = os.path.join(tmp, "www")
        shutil.copytree(WWW_BUILD, copia)
        escrever_versao(os.path.join(copia, "js", "atualizar.js"), n)
        if not os.path.isfile(os.path.join(copia, "index.html")):
            falhar("www-build não tem index.html")
        ficheiros = []
        for raiz, pastas, nomes in os.walk(copia):
            pastas.sort()
            for nome in sorted(nomes):
                completo = os.path.join(raiz, nome)
                rel = os.path.relpath(completo, copia).replace(os.sep, "/")
                if rel.startswith("../") or ".." in rel.split("/"):
                    falhar("caminho inválido " + rel)
                ficheiros.append((rel, completo))
        with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for rel, completo in ficheiros:
                info = zipfile.ZipInfo(rel, DATA_ZIP)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                with open(completo, "rb") as f:
                    z.writestr(info, f.read())
    print(f"bundle {n}: {len(ficheiros)} files, {os.path.getsize(destino) / 1e6:.1f} MB -> {destino}")
    return {
        "versao": n,
        "ficheiro": f"bundles/www-{n}.zip",
        "sha256": sha256(destino),
        "assinatura": assinar(destino),
        "nativo_minimo": nativo_minimo,
    }, destino


def fazer_apk(origem):
    if not os.path.isfile(origem):
        falhar("APK em falta: " + origem)
    r = subprocess.run([aapt2(), "dump", "badging", origem], capture_output=True, text=True)
    if r.returncode != 0:
        falhar("o aapt2 não conseguiu ler o APK")
    m = re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']*)'", r.stdout)
    if not m or m.group(1) != PACOTE:
        falhar("não é a app dos jogos")
    x = subprocess.run([aapt2(), "dump", "xmltree", "--file", "AndroidManifest.xml", origem], capture_output=True, text=True)
    if x.returncode != 0:
        falhar("o aapt2 não conseguiu ler o manifesto do APK")
    if re.search(r"testOnly\([^)]*\)=(true|0xffffffff|-1)", x.stdout):
        falhar("o APK é testOnly: o instalador do tablet recusa-o. Construa sem -PsomenteTeste.")
    # Uma construção de teste para o emulador (gradlew -PtesteLocal) deixa passar HTTP simples para
    # 10.0.2.2: nunca para o tablet.
    rede = re.search(r"networkSecurityConfig\([^)]*\)=@(0x[0-9a-f]+)", x.stdout)
    if rede:
        res = subprocess.run([aapt2(), "dump", "resources", origem], capture_output=True, text=True).stdout
        if re.search(rf"resource {rede.group(1)} xml/rede_teste_local\b", res):
            falhar("o APK é uma construção de teste para o emulador (-PtesteLocal). Construa outra vez (passo 8 do kit).")
    codigo = int(m.group(2))
    pasta = os.path.join(SAIDA, "apk")
    os.makedirs(pasta, exist_ok=True)
    destino = os.path.join(pasta, f"jogos-da-mae-{codigo}.apk")
    shutil.copyfile(origem, destino)
    print(f"apk {m.group(3)} code {codigo}: {os.path.getsize(destino) / 1e6:.1f} MB -> {destino}")
    return {
        "versionCode": codigo,
        "ficheiro": f"apk/jogos-da-mae-{codigo}.apk",
        "sha256": sha256(destino),
        "assinatura": assinar(destino),
    }, destino


# ---- Pacotes de media ----

MAX_MEDIA_ZIP = 500 * 1024 * 1024
MAX_MEDIA_DESCOMPRIMIDO = 1024 * 1024 * 1024
# Quantos pacotes anteriores o versao.json anuncia. Um tablet apanha um pacote de cada vez, a partir
# da versão que tem; se ficar mais de MAX_ANTERIORES + 1 publicações para trás já não encontra a sua
# continuação (o ecrã da família diz "media_sem_base") e a media nova leva-se por USB
# (enviar_media.py --so-enviar, passo 12 do kit). O número não pode crescer muito: o tablet recusa
# um versao.json com mais de 64 KiB.
MAX_ANTERIORES = 30
BASE_POR_OMISSAO = "<preparado>"
COLECOES = ("fotos", "musica", "casa", "passeios", "quem")
CAMINHO_MEDIA = re.compile(r"^(fotos|musica|casa|quem)/[A-Za-z0-9._-]+$")
# Já comprimidos: guardados como estão (mais rápido de empacotar e de descomprimir no tablet).
JA_COMPRIMIDOS = (".jpg", ".jpeg", ".png", ".ogg", ".opus", ".webp")


def caminhos_media(valor):
    if isinstance(valor, str):
        if CAMINHO_MEDIA.match(valor):
            yield valor
    elif isinstance(valor, dict):
        for v in valor.values():
            yield from caminhos_media(v)
    elif isinstance(valor, list):
        for v in valor:
            yield from caminhos_media(v)


def estado_de(pasta, manifesto):
    """{caminho relativo: sha256} de cada ficheiro a que o manifesto se refere, lido de pasta."""
    ficheiros = {}
    for rel in sorted(set(caminhos_media(manifesto))):
        completo = os.path.join(pasta, rel.replace("/", os.sep))
        if not os.path.isfile(completo):
            falhar(f"{rel} está no manifesto de media mas não em {pasta}")
        ficheiros[rel] = sha256(completo)
    return ficheiros


def ler_json(caminho):
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def chave_item(item):
    return item.get("ficheiro") if isinstance(item, dict) else None


def diferenca_media(antigo, novo_manifesto, novos_ficheiros):
    """Devolve (colecoes, ficheiros a enviar, ficheiros a apagar)."""
    velhos_ficheiros = antigo.get("ficheiros", {})
    velho_manifesto = antigo.get("manifesto", {})
    enviar = sorted(r for r, s in novos_ficheiros.items() if velhos_ficheiros.get(r) != s)
    apagar = sorted(r for r in velhos_ficheiros if r not in novos_ficheiros)
    mudados = set(enviar)
    colecoes = {}
    for col in COLECOES:
        novos = [x for x in novo_manifesto.get(col, []) if chave_item(x)]
        velhos = {chave_item(x): x for x in velho_manifesto.get(col, []) if chave_item(x)}
        chaves = [chave_item(x) for x in novos]
        if len(set(chaves)) != len(chaves):
            falhar(f"dois itens de '{col}' usam o mesmo ficheiro")
        adicionar = [x for x in novos if velhos.get(chave_item(x)) != x or mudados.intersection(caminhos_media(x))]
        remover = sorted(k for k in velhos if k not in set(chaves))
        ordem_velha = [chave_item(x) for x in velho_manifesto.get(col, []) if chave_item(x)]
        if adicionar or remover or ordem_velha != chaves:
            colecoes[col] = {"adicionar": adicionar, "remover": remover, "ordem": chaves}
    return colecoes, enviar, apagar


def fazer_media(n, preparado, antigo):
    manifesto_p = os.path.join(preparado, "manifest.json")
    if not os.path.isfile(manifesto_p):
        falhar(f"não há media preparada em {preparado}: corra primeiro enviar_media.py --so-preparar")
    novo = ler_json(manifesto_p)
    ficheiros = estado_de(preparado, novo)
    colecoes, enviar, apagar = diferenca_media(antigo, novo, ficheiros)
    if not colecoes and not enviar and not apagar:
        return None, None, None
    base = int(antigo.get("versao", 0))
    pacote = {"versao": n, "base": base, "colecoes": colecoes, "ficheiros": enviar, "apagar": apagar}
    descomprimido = sum(os.path.getsize(os.path.join(preparado, r)) for r in enviar)
    if descomprimido > MAX_MEDIA_DESCOMPRIMIDO:
        falhar(f"o pacote descomprimido teria {descomprimido / 1e6:.0f} MB, acima do limite de 1 GB. "
               "Prepare uma parte da media nova, publique, e depois o resto.")
    pasta = os.path.join(SAIDA, "media")
    os.makedirs(pasta, exist_ok=True)
    destino = os.path.join(pasta, f"media-{n}.zip")
    with zipfile.ZipFile(destino, "w") as z:
        info = zipfile.ZipInfo("pack.json", DATA_ZIP)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, json.dumps(pacote, ensure_ascii=False, indent=1).encode("utf-8"))
        for rel in enviar:
            info = zipfile.ZipInfo(rel, DATA_ZIP)
            info.compress_type = zipfile.ZIP_STORED if rel.lower().endswith(JA_COMPRIMIDOS) else zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            with open(os.path.join(preparado, rel), "rb") as f:
                z.writestr(info, f.read())
    tamanho = os.path.getsize(destino)
    if tamanho > MAX_MEDIA_ZIP:
        falhar(f"o pacote tem {tamanho / 1e6:.0f} MB, acima do limite de 500 MB. "
               "Prepare uma parte da media nova, publique, e depois o resto.")
    resumo = ", ".join(f"{c}: +{len(v['adicionar'])} -{len(v['remover'])}" for c, v in colecoes.items()) or "só a ordem"
    print(f"pacote de media {n} (a partir do {base}): {len(enviar)} ficheiros a enviar, {len(apagar)} a apagar; {resumo}; "
          f"{tamanho / 1e6:.1f} MB -> {destino}")
    parte = {
        "versao": n,
        "base": base,
        "ficheiro": f"media/media-{n}.zip",
        "sha256": sha256(destino),
        "assinatura": assinar(destino),
        "bytes": tamanho,
        "bytes_descomprimidos": descomprimido,
    }
    estado = {"versao": n, "ficheiros": ficheiros, "manifesto": novo}
    return parte, destino, estado


def media_base(origem_manifesto, estado_json):
    if os.path.isfile(estado_json) and ler_json(estado_json).get("versao", 0) > 0:
        falhar("já foram publicados pacotes de media; a base só se pode registar antes do primeiro")
    if not os.path.isfile(origem_manifesto):
        falhar("manifesto em falta: " + origem_manifesto)
    pasta = os.path.dirname(os.path.abspath(origem_manifesto))
    manifesto = ler_json(origem_manifesto)
    manifesto = {k: v for k, v in manifesto.items() if k in COLECOES}
    ficheiros = estado_de(pasta, manifesto)
    with open(estado_json, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"versao": 0, "ficheiros": ficheiros, "manifesto": manifesto}, f, ensure_ascii=False, indent=1)
    print(f"versão de media 0 registada a partir de {origem_manifesto}: {len(ficheiros)} ficheiros "
          f"({', '.join(f'{k} {len(v)}' for k, v in manifesto.items())}) -> {estado_json}")


def main():
    ap = argparse.ArgumentParser(description="Publica uma atualização pela internet (ensaio, a não ser com --enviar).")
    ap.add_argument("--bundle", action="store_true", help="construir e publicar um pacote web")
    ap.add_argument("--versao", type=int, help="versão do pacote web (por omissão: a de www/js/atualizar.js mais um)")
    ap.add_argument("--nativo-minimo", type=int, help="versionCode mais baixo que pode correr o pacote web (por omissão: o de build.gradle)")
    ap.add_argument("--apk", help="ficheiro APK a publicar")
    ap.add_argument("--media", action="store_true", help="construir e publicar um pacote de media a partir da media preparada")
    ap.add_argument("--preparado", default=os.path.join(RAIZ, "media", "_preparado"),
                    help="pasta da media preparada (por omissão <kit>/media/_preparado)")
    ap.add_argument("--media-base", nargs="?", const=BASE_POR_OMISSAO, metavar="MANIFESTO",
                    help="registar como versão de media 0 o que o envio por USB deixou no tablet (só local). "
                         "Por omissão o manifest.json da pasta preparada; correr logo a seguir ao envio por USB, "
                         "antes de preparar mais alguma coisa")
    ap.add_argument("--saida", help=argparse.SUPPRESS)   # testes: outra pasta de saída
    ap.add_argument("--publico-local", metavar="FOLDER",
                    help="copiar para esta pasta publico/ em vez de enviar (um servidor nesta máquina)")
    ap.add_argument("--enviar", action="store_true", help="enviar a sério (senão só mostra)")
    a = ap.parse_args()
    if a.publico_local:
        a.enviar = True
    global SAIDA
    if a.saida:
        SAIDA = os.path.abspath(a.saida)
    os.makedirs(SAIDA, exist_ok=True)
    estado_json = os.path.join(SAIDA, "media-estado.json")
    if a.media_base:
        if a.bundle or a.apk or a.media or a.enviar:
            ap.error("--media-base usa-se sozinho")
        origem = a.media_base
        if origem == BASE_POR_OMISSAO:
            origem = os.path.join(os.path.abspath(a.preparado), "manifest.json")
            # Um kit de antes da 0.5.0 preparava para media/_tablet.
            antiga = os.path.join(RAIZ, "media", "_tablet", "manifest.json")
            if not os.path.isfile(origem) and os.path.isfile(antiga):
                origem = antiga
        media_base(origem, estado_json)
        return
    if not a.bundle and not a.apk and not a.media:
        ap.error("nada para publicar: dê --bundle, --apk, --media ou vários")

    publicado_json = os.path.join(SAIDA, "publicado.json")
    anterior = {}
    if os.path.isfile(publicado_json):
        with open(publicado_json, encoding="utf-8") as f:
            anterior = json.load(f)
    manifesto = {k: v for k, v in anterior.items() if k in ("bundle", "apk", "media")}
    envios = []
    novo_estado = None

    n = None
    if a.bundle:
        atual = versao_fonte()
        n = a.versao if a.versao is not None else atual + 1
        if n <= atual:
            falhar(f"a versão {n} do pacote web não está acima da que vem na app ({atual}): o tablet ignorava-a")
        if "bundle" in anterior and n <= anterior["bundle"]["versao"]:
            falhar(f"a versão {n} do pacote web não está acima da publicada ({anterior['bundle']['versao']})")
        nativo = a.nativo_minimo if a.nativo_minimo is not None else codigo_gradle()
        parte, local = fazer_bundle(n, nativo)
        manifesto["bundle"] = parte
        envios.append((local, parte["ficheiro"]))
    if a.apk:
        parte, local = fazer_apk(a.apk)
        if "apk" in anterior and parte["versionCode"] <= anterior["apk"]["versionCode"]:
            falhar(f"o versionCode {parte['versionCode']} não está acima do publicado ({anterior['apk']['versionCode']})")
        manifesto["apk"] = parte
        envios.append((local, parte["ficheiro"]))
    if a.media:
        if not os.path.isfile(estado_json):
            print("nota: não há media-estado.json, por isso este pacote leva todos os ficheiros preparados. Se o tablet já "
                  "tem media de um envio pelo adb, pare e corra primeiro --media-base.")
        antigo = ler_json(estado_json) if os.path.isfile(estado_json) else {"versao": 0, "ficheiros": {}, "manifesto": {}}
        nm = int(antigo.get("versao", 0)) + 1
        publicada = anterior.get("media")
        if publicada and publicada["versao"] != nm - 1:
            falhar(f"o publicado.json diz media {publicada['versao']} mas o media-estado.json diz {nm - 1}")
        parte, local, novo_estado = fazer_media(nm, os.path.abspath(a.preparado), antigo)
        if parte is None:
            print("media: nada mudou desde a última versão publicada; não há pacote.")
            if not a.bundle and not a.apk:
                return
        else:
            if publicada:
                velhas = [{k: v for k, v in publicada.items() if k != "anteriores"}] + publicada.get("anteriores", [])
                parte["anteriores"] = velhas[:MAX_ANTERIORES]
                if len(velhas) > MAX_ANTERIORES:
                    mais_antiga = parte["anteriores"][-1]["base"]
                    print(f"nota: um tablet com a media abaixo da versão {mais_antiga} já não apanha estes pacotes pela "
                          "internet. Leve-lhe a media por USB: enviar_media.py --so-enviar (passo 12 do kit).")
            manifesto["media"] = parte
            envios.append((local, parte["ficheiro"]))

    versao_json = os.path.join(SAIDA, "versao.json")
    with open(versao_json, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifesto, f, indent=2, ensure_ascii=False)
        f.write("\n")
    envios.append((versao_json, "versao.json"))   # sempre no fim
    print("versao.json:")
    print(json.dumps({k: {x: (y if x != "anteriores" else [p["versao"] for p in y])
                          for x, y in v.items() if x != "assinatura"} for k, v in manifesto.items()}, indent=2))

    if not a.enviar:
        print("\nEnsaio. Nada foi enviado. Com --enviar correria, por esta ordem:")
        for local, remoto in envios:
            print("  " + comando_envio(local, remoto))
        if n is not None:
            print(f"e depois poria 'export const BUNDLE = {n};' em www/js/atualizar.js")
        if novo_estado is not None:
            print(f"e depois registaria a versão de media {novo_estado['versao']} em {estado_json}")
        return

    for local, remoto in envios:
        print(f"a enviar {remoto}")
        if a.publico_local:
            destino = os.path.join(a.publico_local, remoto.replace("/", os.sep))
            os.makedirs(os.path.dirname(destino), exist_ok=True)
            shutil.copyfile(local, destino)
            continue
        r = subprocess.run(comando_envio(local, remoto), shell=True)
        if r.returncode != 0:
            falhar(f"o envio de {remoto} falhou; o versao.json não mudou no servidor" if remoto != "versao.json"
                   else "o envio do versao.json falhou")
    shutil.copyfile(versao_json, publicado_json)
    if novo_estado is not None:
        with open(estado_json, "w", encoding="utf-8", newline="\n") as f:
            json.dump(novo_estado, f, ensure_ascii=False, indent=1)
        print(f"versão de media {novo_estado['versao']} registada em {estado_json}")
    if n is not None:
        escrever_versao(ATUALIZAR_JS, n)
        print(f"www/js/atualizar.js diz agora BUNDLE = {n} (a próxima construção do APK leva-o).")
    print("Publicado.")


if __name__ == "__main__":
    main()
