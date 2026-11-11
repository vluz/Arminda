"""Envia para o tablet, por USB, a configuração do servidor da família (endereço e token do tablet).

Correr: python tools/enviar_config.py
Lê MAE_SERVIDOR (por exemplo https://jogos.example.org) e MAE_TABLET_TOKEN do ficheiro de segredos
(.SECRETS/SECRETS.txt ao lado de app/, uma linha NOME=valor para cada; ver tools/ambiente.py),
escreve config.json numa pasta temporária, envia-o para a pasta da app no tablet
(/sdcard/Android/data/pt.mae.jogos/files/config.json) e apaga a cópia local.
Nunca mostra o token. Sem este ficheiro no tablet a app não envia nada.
"""
import json
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ambiente  # noqa: E402

DESTINO = "/sdcard/Android/data/pt.mae.jogos/files/config.json"


def main():
    """Escreve config.json no PC por um momento e envia-o."""
    servidor = ambiente.segredo("MAE_SERVIDOR").rstrip("/")
    token = ambiente.segredo("MAE_TABLET_TOKEN")
    if not servidor.startswith("https://"):
        raise SystemExit("MAE_SERVIDOR tem de começar por https:// (a app recusa http simples)")
    if not token:
        raise SystemExit("MAE_TABLET_TOKEN está vazio no ficheiro de segredos")
    adb = ambiente.adb()
    with tempfile.TemporaryDirectory() as tmp:
        local = os.path.join(tmp, "config.json")
        with open(local, "w", encoding="utf-8") as f:
            json.dump({"servidor": servidor, "token": token}, f)
        subprocess.run([adb, "shell", "mkdir", "-p", os.path.dirname(DESTINO)], check=True)
        r = subprocess.run([adb, "push", local, DESTINO], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("o envio falhou: " + r.stderr.strip())
    print(f"config.json enviado para o tablet ({servidor}; o token não é mostrado)")


if __name__ == "__main__":
    main()
