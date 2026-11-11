"""Cria o token do tablet (uma vez) e mostra o SHA-256 que o servidor precisa.

Correr:  python servidor/ferramentas/segredos.py
- Gera MAE_TABLET_TOKEN (32 bytes aleatórios, base64url) e guarda-o em <kit>/.SECRETS/SECRETS.txt,
  se ainda lá não estiver. O token nunca é mostrado no ecrã.
- Mostra MAE_TOKEN_SHA256 (SHA-256 do token, em hexadecimal) para pôr no .env do Compose ou no
  ficheiro quadlet. O servidor só guarda este valor; o token fica no tablet e no ficheiro de segredos.
"""
import base64
import hashlib
import os
import secrets

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PASTA = os.path.join(RAIZ, ".SECRETS")
FICHEIRO = os.path.join(PASTA, "SECRETS.txt")


def ler(nome):
    """O valor de NAME=valor no ficheiro de segredos, ou None."""
    if not os.path.exists(FICHEIRO):
        return None
    with open(FICHEIRO, encoding="utf-8") as f:
        for linha in f:
            if linha.strip().startswith(nome + "="):
                valor = linha.strip().split("=", 1)[1].strip()
                if not valor:
                    raise SystemExit(f"{nome} está vazio em {FICHEIRO}: apague essa linha e corra outra vez.")
                return valor
    return None


def main():
    """Garante o token e imprime só o seu SHA-256."""
    token = ler("MAE_TABLET_TOKEN")
    if token:
        print(f"MAE_TABLET_TOKEN já existe em {FICHEIRO} (não é mostrado).")
    else:
        token = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")
        os.makedirs(PASTA, exist_ok=True)
        # Só o dono lê o ficheiro (em Linux e Mac; o Windows usa as permissões da pasta do utilizador).
        with os.fdopen(os.open(FICHEIRO, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600), "a", encoding="utf-8") as f:
            f.write(f"\n# Token do tablet para o servidor da família (passo 10)\nMAE_TABLET_TOKEN={token}\n")
        print(f"MAE_TABLET_TOKEN criado e guardado em {FICHEIRO} (não é mostrado).")
    print("Ponha esta linha no .env (Compose) ou no mae.container (quadlet):")
    print("MAE_TOKEN_SHA256=" + hashlib.sha256(token.encode()).hexdigest())


if __name__ == "__main__":
    main()
