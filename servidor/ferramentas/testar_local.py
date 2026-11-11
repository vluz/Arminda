"""Verificações locais do servidor da família, antes de o pôr a correr.

Correr na pasta servidor:  python ferramentas/testar_local.py
Constrói um binário para Windows, arranca-o em 127.0.0.1:8190 com um token e uma pasta de dados
descartáveis, e confere: estado, pedido prévio de CORS (origem permitida e outra origem), token
obrigatório, registos aceites e sem repetidos, um lote vazio (a sonda do ecrã da família)
respondido sem linha no registo do servidor, um registo mau saltado sem recusar o lote, versao,
descarga de ficheiros com Range, conteúdo do painel, o corte do "reset", nomes das atividades,
arredondamento dos minutos, a secção da bateria (último nível, carregador, mínimo de hoje, aviso
de bateria fraca, horas de ecrã apagado), que o painel não carrega nada de outra origem, e que o
registo do servidor só tem contagens. Mostra PASS ou FAIL por verificação. As horas são relativas
a agora, por isso as verificações funcionam em qualquer data.
"""
import datetime
import hashlib
import http.client
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

AQUI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GO = shutil.which("go") or "go"
PORTA = 8190
TOKEN = "token-de-teste-local"

resultados = []


def verifica(nome, ok, detalhe=""):
    resultados.append(ok)
    print(("PASSOU " if ok else "FALHOU ") + nome + (f"  ({detalhe})" if detalhe else ""))


def pedido(metodo, caminho, corpo=None, cab=None):
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=10)
    c.request(metodo, caminho, body=corpo, headers=cab or {})
    r = c.getresponse()
    dados = r.read()
    c.close()
    return r.status, {k.lower(): v for k, v in r.getheaders()}, dados


def ha(minutos):
    """Hora UTC em ISO, em segundos certos, há tantos minutos (como o started_at do tablet)."""
    t = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=minutos)
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def main():
    tmp = tempfile.mkdtemp()
    exe = os.path.join(tmp, "mae.exe")
    env = dict(os.environ, CGO_ENABLED="0", GOTELEMETRY="off")
    subprocess.run([GO, "build", "-o", exe, "."], cwd=os.path.join(AQUI, "src"), env=env, check=True)
    dados = os.path.join(tmp, "data")
    os.makedirs(os.path.join(dados, "publico", "app"))
    with open(os.path.join(dados, "publico", "app", "pacote.zip"), "wb") as f:
        f.write(bytes(range(256)) * 400)
    with open(os.path.join(dados, "publico", "versao.json"), "w") as f:
        json.dump({"app": {"versao": "0.2.0", "ficheiro": "app/pacote.zip"}}, f)
    registo = open(os.path.join(tmp, "servidor.log"), "wb")
    proc = subprocess.Popen([exe], env=dict(os.environ, MAE_DATA=dados, MAE_ADDR=f"127.0.0.1:{PORTA}",
                                            MAE_TOKEN_SHA256=hashlib.sha256(TOKEN.encode()).hexdigest()),
                            stdout=registo, stderr=subprocess.STDOUT)
    try:
        for _ in range(50):
            try:
                pedido("GET", "/healthz")
                break
            except OSError:
                time.sleep(0.1)
        st, cab, corpo = pedido("GET", "/healthz")
        verifica("o healthz só devolve ok", st == 200 and corpo == b"ok", f"{st} {corpo!r}")
        verifica("noindex em todas as respostas", cab.get("x-robots-tag", "").startswith("noindex"))

        st, cab, _ = pedido("OPTIONS", "/api/registos", cab={"Origin": "https://localhost",
                            "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"})
        verifica("pedido prévio de https://localhost: 204 com os cabeçalhos de permissão",
                 st == 204 and cab.get("access-control-allow-origin") == "https://localhost"
                 and "Authorization" in cab.get("access-control-allow-headers", ""), f"{st} {cab.get('access-control-allow-origin')}")
        st, cab, _ = pedido("OPTIONS", "/api/registos", cab={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
        verifica("pedido prévio de outra origem: sem cabeçalho de permissão",
                 "access-control-allow-origin" not in cab, f"{st} {cab.get('access-control-allow-origin')}")

        # O jogo de teste da família: Pares há uma hora (4 min), Loto ontem (7 min).
        lote = json.dumps({"registos": [
            {"rid": "a1", "device": "d", "tipo": "sessao", "game": "pares", "started_at": ha(60),
             "duration_ms": 300000, "active_ms": 240000, "taps": 50, "left_by": "casa"},
            {"rid": "a2", "device": "d", "tipo": "ronda", "game": "pares", "started_at": ha(59),
             "level": 4, "completed": True},
            {"rid": "a3", "device": "d", "tipo": "sessao", "game": "loto", "started_at": ha(26 * 60),
             "duration_ms": 600000, "active_ms": 420000, "taps": 80, "left_by": "voltar"},
        ]}).encode()
        st, _, _ = pedido("POST", "/api/registos", lote, {"Content-Type": "application/json"})
        verifica("registos sem token recusados", st == 401, str(st))
        st, _, _ = pedido("POST", "/api/registos", lote, {"Content-Type": "application/json", "Authorization": "Bearer errado"})
        verifica("registos com token errado recusados", st == 401, str(st))
        auth = {"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}", "Origin": "https://localhost"}
        st, cab, corpo = pedido("POST", "/api/registos", lote, auth)
        verifica("registos aceites com token", st == 200 and json.loads(corpo)["aceites"] == ["a1", "a2", "a3"], f"{st} {corpo[:80]!r}")
        verifica("cabeçalho de permissão CORS no pedido a sério", cab.get("access-control-allow-origin") == "https://localhost")
        st, _, corpo = pedido("POST", "/api/registos", lote, auth)
        verifica("o mesmo lote outra vez: aceite outra vez (repetir não duplica)", st == 200 and len(json.loads(corpo)["aceites"]) == 3)
        st, _, corpo = pedido("POST", "/api/registos", b"{not json", auth)
        verifica("JSON inválido recusado", st == 400, str(st))
        st, cab, corpo = pedido("POST", "/api/registos", json.dumps({"registos": []}).encode(), auth)
        verifica("lote vazio (sonda do ecrã da família): 200 com aceites []",
                 st == 200 and json.loads(corpo) == {"aceites": []} and cab.get("content-type", "").startswith("application/json"), f"{st} {corpo!r}")
        misto = json.dumps({"registos": [
            {"device": "d", "tipo": "sessao", "game": "pares", "started_at": ha(5)},   # sem rid
            7,                                                                           # não é um objeto
            {"rid": "b1", "device": "d", "tipo": "bateria", "at": ha(5), "level": 80, "charging": True},
            {"rid": "b1", "device": "d", "tipo": "bateria", "at": ha(5), "level": 80, "charging": True},
        ]}).encode()
        st, _, corpo = pedido("POST", "/api/registos", misto, auth)
        verifica("registos maus saltados, o bom aceite, rid repetido num lote sem problema",
                 st == 200 and json.loads(corpo)["aceites"] == ["b1", "b1"], f"{st} {corpo[:80]!r}")
        st, _, _ = pedido("POST", "/api/registos", json.dumps({"registos": [{"rid": "x"}] * 1001}).encode(), auth)
        verifica("mais de 1000 registos num lote recusados", st == 413, str(st))

        st, _, corpo = pedido("GET", "/api/versao", cab={"Authorization": f"Bearer {TOKEN}"})
        verifica("versao servida", st == 200 and json.loads(corpo)["app"]["versao"] == "0.2.0")
        st, cab, corpo = pedido("GET", "/api/ficheiros/app/pacote.zip", cab={"Authorization": f"Bearer {TOKEN}", "Range": "bytes=100-199"})
        verifica("a descarga aceita Range (retomar)", st == 206 and len(corpo) == 100 and corpo[0] == 100, f"{st} {len(corpo)}")
        for tentativa in ("/api/ficheiros/../mae.db", "/api/ficheiros/..%2fmae.db", "/api/ficheiros/app/..%2f..%2fmae.db"):
            st, _, corpo = pedido("GET", tentativa, cab={"Authorization": f"Bearer {TOKEN}"})
            verifica(f"fuga de caminho recusada: {tentativa}", st != 200 and b"SQLite" not in corpo, str(st))
        st, _, _ = pedido("GET", "/api/ficheiros/app/pacote.zip")
        verifica("descarga sem token recusada", st == 401, str(st))

        st, cab, corpo = pedido("GET", "/")
        html = corpo.decode("utf-8")
        verifica("o painel desenha-se", st == 200 and "Jogos da Mãe" in html and "Pares" in html and "Loto" in html, str(st))
        externos = re.findall(r'(?:src|href)\s*=\s*"(?:https?:)?//', html)
        verifica("o painel não carrega nada de outra origem", not externos and "<script" not in html, str(externos))
        verifica("CSP do painel: default-src 'none'", "default-src 'none'" in cab.get("content-security-policy", ""))
        verifica("o painel mostra as linhas guardadas uma só vez", html.count(">Pares<") == 2, f"Pares cells: {html.count('>Pares<')}")
        verifica("o painel diz que as estatísticas começam no primeiro registo", "Estatísticas desde o primeiro registo." in html)

        # A família recomeça o tablet há 2 horas: o Loto (ontem) é jogo de teste e sai;
        # os Pares (há uma hora) ficam. Depois as primeiras visitas a sério: Gato (50 s) e a
        # Corrida, já retirada (40 s). Minutos em 7 dias: 240 + 50 + 40 s = 5,5 min, arredondados uma
        # vez para 6 (o corte antigo, visita a visita, dava 4).
        corte = ha(120)
        depois = json.dumps({"registos": [
            {"rid": "r1", "device": "d", "tipo": "reset", "at": corte, "keys_cleared": 32, "azulejos": 6},
            {"rid": "c1", "device": "d", "tipo": "sessao", "game": "gato", "started_at": ha(30),
             "duration_ms": 50000, "active_ms": 50000, "taps": 9, "left_by": "casa"},
            {"rid": "c2", "device": "d", "tipo": "sessao", "game": "corrida", "started_at": ha(20),
             "duration_ms": 40000, "active_ms": 40000, "taps": 5, "left_by": "casa"},
        ]}).encode()
        st, _, corpo = pedido("POST", "/api/registos", depois, auth)
        verifica("reset e registos seguintes aceites", st == 200 and len(json.loads(corpo)["aceites"]) == 3, str(st))
        st, _, corpo = pedido("GET", "/")
        html = corpo.decode("utf-8")
        verifica("depois de um reset: o jogo de teste anterior fica escondido", ">Loto<" not in html and html.count(">Pares<") == 2, f"Loto cells: {html.count('>Loto<')}")
        verifica("depois de um reset: a página diz desde quando", "Estatísticas desde " in html and "último recomeço do zero" in html)
        verifica("nomes das atividades novas e do jogo retirado", ">Gato aventureiro<" in html and ">Corrida (retirado)<" in html)
        verifica("minutos somados e arredondados uma vez", "Últimos 7 dias<b>6 min</b>" in html,
                 re.search(r"Últimos 7 dias<b>[^<]*</b>", html).group(0) if re.search(r"Últimos 7 dias<b>", html) else "no summary")
        verifica("a contagem de registos continua a mostrar todos os registos em bruto", "Registos recebidos<b>7</b>" in html)

        # Bateria. Até aqui um registo: 80%, a carregar, há 5 minutos.
        verifica("bateria: último nível e carregador à vista", "Último nível<b>80%</b>" in html and "Carregador<b>ligado</b>" in html,
                 re.search(r"Último nível<b>[^<]*</b>", html).group(0) if "Último nível<b>" in html else "no battery block")
        verifica("battery: no warning while charging", "Bateria fraca" not in html)
        verifica("a secção da bateria fica por cima do resumo", 0 < html.find("<h2>Bateria</h2>") < html.find("Últimos 7 dias<b>"))
        # Fora do carregador e a descer; os 5% de ontem não podem contar como mínimo de hoje; a
        # app apagou o ecrã duas vezes hoje e uma há 8 dias (fora da lista de 7 dias).
        bat = json.dumps({"registos": [
            {"rid": "bt1", "device": "d", "tipo": "bateria", "at": ha(26 * 60), "level": 5, "charging": False, "reason": "periodico"},
            {"rid": "bt2", "device": "d", "tipo": "bateria", "at": ha(4), "level": 30, "charging": False, "reason": "desligado"},
            {"rid": "bt3", "device": "d", "tipo": "bateria", "at": ha(3), "level": 15, "charging": False, "reason": "periodico"},
            {"rid": "ea1", "device": "d", "tipo": "ecra_apagado_bateria", "at": ha(2), "level": 15, "mode": "lock"},
            {"rid": "ea2", "device": "d", "tipo": "ecra_apagado_bateria", "at": ha(30), "level": 41, "mode": "lock"},
            {"rid": "ea3", "device": "d", "tipo": "ecra_apagado_bateria", "at": ha(8 * 24 * 60), "level": 77, "mode": "lock"},
        ]}).encode()
        st, _, corpo = pedido("POST", "/api/registos", bat, auth)
        verifica("registos de bateria aceites", st == 200 and len(json.loads(corpo)["aceites"]) == 6, str(st))
        st, _, corpo = pedido("GET", "/")
        html = corpo.decode("utf-8")
        verifica("bateria: fraca e sem carregador dá a linha de aviso", "Bateria fraca no último envio" in html)
        verifica("bateria: o último nível é o do registo mais novo", "Último nível<b>15%</b>" in html and "Carregador<b>desligado</b>" in html,
                 re.search(r"Último nível<b>[^<]*</b>", html).group(0) if "Último nível<b>" in html else "no battery block")
        verifica("bateria: o mínimo de hoje ignora o de ontem", "Mais baixo hoje<b>15%</b>" in html,
                 re.search(r"Mais baixo hoje<b>[^<]*</b>", html).group(0) if "Mais baixo hoje<b>" in html else "missing")
        linha = re.search(r"Ecrã apagado pela bateria \(últimos 7 dias\):[^<]*", html)
        linha = linha.group(0) if linha else ""
        verifica("horas de ecrã apagado: as duas de hoje, a mais nova primeiro, a de há 8 dias de fora",
                 "Ecrã apagado hoje<b>2</b>" in html and 0 < linha.find("(15%)") < linha.find("(41%)") and "(77%)" not in linha, linha)
        verifica("hora da bateria no formato de Lisboa", re.search(r"Último registo de bateria: \d\d/\d\d/\d{4} \d\d:\d\d\.", html) is not None)
        # Ligado outra vez, depois um registo de bateria estragado (sem nível) que não o pode substituir.
        mais = json.dumps({"registos": [
            {"rid": "bt4", "device": "d", "tipo": "bateria", "at": ha(1), "level": 16, "charging": True, "reason": "ligado"},
            {"rid": "bt5", "device": "d", "tipo": "bateria", "at": ha(0), "charging": False},
        ]}).encode()
        st, _, _ = pedido("POST", "/api/registos", mais, auth)
        st, _, corpo = pedido("GET", "/")
        html = corpo.decode("utf-8")
        verifica("bateria: carregador de volta, aviso desaparece, registo sem nível ignorado",
                 st == 200 and "Bateria fraca" not in html and "Último nível<b>16%</b>" in html and "Carregador<b>ligado</b>" in html)
        verifica("bateria: o corte continua a valer para o jogo", ">Loto<" not in html and "último recomeço do zero" in html)
    finally:
        proc.terminate()
        proc.wait()
        registo.close()
        with open(os.path.join(tmp, "servidor.log"), "rb") as f:
            log = f.read().decode("utf-8", "replace")
        verifica("o registo do servidor tem as linhas dos lotes, só com contagens",
                 "registos: lote 3, novos 3" in log and "registos: lote 3, novos 0" in log and "registos: lote 4, novos 1" in log,
                 " | ".join(l for l in log.splitlines() if "registos:" in l))
        verifica("o registo do servidor cala-se no lote vazio", "batch 0" not in log)
        verifica("o registo do servidor nunca mostra o conteúdo dos registos", "a1" not in log and "pares" not in log and TOKEN not in log)
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"{sum(resultados)}/{len(resultados)} verificações passaram")
    sys.exit(0 if all(resultados) else 1)


if __name__ == "__main__":
    main()
