"""Guarda os dados privados da app a partir do tablet ligado por USB (precisa de uma construção de
depuração, para o run-as funcionar): o armazenamento do WebView (o localStorage tem a fila de
registos, os níveis, as vitórias e os azulejos), shared_prefs e files. Cópia byte a byte, só de
leitura no tablet. Usar junto com puxar_metricas.ps1, que traz as cópias legíveis dos registos
que estão no cartão de memória.

Correr: python tools/guardar_dados_app.py [número de série do adb]
Resultado: <kit>/dados/tablet/<hoje>/app-data/<a mesma árvore que no tablet>
"""
import datetime
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ambiente  # noqa: E402

ADB = ambiente.adb()
PACOTE = "pt.mae.jogos"
RAIZ = ambiente.RAIZ
DESTINO = os.path.join(RAIZ, "dados", "tablet", datetime.date.today().isoformat(), "app-data")
PASTAS = ["app_webview", "shared_prefs", "files", "databases"]


def adb(*args, binario=False):
    serie = ["-s", sys.argv[1]] if len(sys.argv) > 1 else []
    r = subprocess.run([ADB, *serie, *args], capture_output=True, timeout=300)
    if r.returncode != 0:
        raise SystemExit(f"adb {' '.join(args)} falhou: {r.stderr.decode('utf-8', 'replace').strip()}")
    return r.stdout if binario else r.stdout.decode("utf-8", "replace")


def main():
    # Sem passar por uma shell: as aspas não sobrevivem ao adb a partir do Windows. Lista-se tudo e
    # ficam as pastas que interessam.
    lista = adb("shell", f"run-as {PACOTE} find . -type f")
    ficheiros = [l.strip()[2:] for l in lista.replace("\r", "").split("\n") if l.strip().startswith("./")]
    ficheiros = [f for f in ficheiros if f.split("/")[0] in PASTAS and not f.startswith(("files/bundles/", "files/descargas/"))]
    # files/bundles e files/descargas são as descargas pela internet, que já estão no PC e no servidor.
    if not ficheiros:
        raise SystemExit("nada na lista: o tablet está ligado, e a app é uma construção de depuração?")
    total = 0
    for rel in ficheiros:
        try:
            dados = adb("exec-out", f"run-as {PACOTE} cat '{rel}'", binario=True)
        except SystemExit:  # o adb às vezes deixa cair uma transferência ("error: closed"); tenta-se mais uma vez
            dados = adb("exec-out", f"run-as {PACOTE} cat '{rel}'", binario=True)
        destino = os.path.join(DESTINO, *rel.split("/"))
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        with open(destino, "wb") as f:
            f.write(dados)
        total += len(dados)
    print(f"{len(ficheiros)} ficheiros, {total:,} bytes -> {DESTINO}")


if __name__ == "__main__":
    main()
