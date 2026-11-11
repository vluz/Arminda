"""Confere e resume os registos de jogo trazidos do tablet.

Correr:  python tools/analisar_metricas.py <ficheiro jsonl ou pasta>

Numa pasta procuram-se os ficheiros *.jsonl (todas as cópias trazidas do cartão de memória); os
registos vistos duas vezes (mesmo rid) contam uma vez. O resultado é um relatório neutro, só de
números, no ecrã:
  1. o que o ficheiro cobre e se cada registo segue o contrato dos registos
  2. a coerência entre rondas, visitas e eventos
  3. uma repetição da regra dos níveis (ajustarNivel de estado.js) sobre as rondas, jogo a jogo
  4. os números do ecrã da família (familia.js) calculados de novo a partir dos registos, por dia,
     por atividade e por hora, antes e depois do último recomeço
  5. o nível da bateria ao longo do tempo e o ritmo de descarga a jogar
  6. o último bloco de jogo depois do último recomeço, visita a visita, em termos neutros

Nada é enviado para lado nenhum e nenhum ficheiro é escrito. Os registos não têm nomes; este script
só mostra ids de jogos, contagens, horas e durações, nunca o conteúdo de campos de lista ou de texto.
As horas aparecem na hora de Lisboa (o relógio do tablet) com a hora UTC ao lado.
"""

import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

# ---- hora local (Europe/Lisbon: UTC+1 do último domingo de março ao último domingo de outubro) ----
try:
    from zoneinfo import ZoneInfo
    LISBOA = ZoneInfo("Europe/Lisbon")
except Exception:  # sem base de fusos horários nesta máquina: usa-se a regra europeia à mão
    LISBOA = None


def _ultimo_domingo(ano, mes):
    d = datetime(ano, mes + 1, 1, tzinfo=timezone.utc) - timedelta(days=1) if mes < 12 else datetime(ano, 12, 31, tzinfo=timezone.utc)
    return d - timedelta(days=(d.weekday() + 1) % 7)


def local(dt):
    if LISBOA:
        return dt.astimezone(LISBOA)
    ini = _ultimo_domingo(dt.year, 3).replace(hour=1)
    fim = _ultimo_domingo(dt.year, 10).replace(hour=1)
    return dt.astimezone(timezone(timedelta(hours=1 if ini <= dt < fim else 0)))


def iso(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def hhmm(s):
    return local(iso(s)).strftime("%H:%M")


def hhmmss(s):
    return local(iso(s)).strftime("%H:%M:%S")


def quando(s):
    d = iso(s)
    return f"{local(d).strftime('%d/%m %H:%M')} local ({d.strftime('%H:%M')} UTC)"


def minutos(ms):
    return round(ms / 60000)


# ---- o contrato dos registos (metricas.js, main.js, bateria.js, as chamadas metricas.ronda dos jogos) ----
BASE = ("rid", "device", "app_version", "tipo")
RONDA = ("game", "level", "started_at", "duration_ms", "completed", "score", "accuracy")
SESSAO = ("game", "started_at", "ended_at", "duration_ms", "screen_off_ms", "active_ms", "taps", "left_by")
# Todos os tipos de evento que a app escreve: metricas.evento(...) em www/js, e os "atualizacao_..."
# que vêm da parte Android (Atualizar.java, Media.java). Ao acrescentar um evento à app, acrescentá-lo aqui.
EVENTOS = {"app_aberta", "reset", "ecra_desligado", "ecra_ligado", "abrir_jogo", "bateria",
           "ecra_apagado_bateria", "intro", "jogador", "mais_facil", "nivel", "quiosque_desligado",
           "atualizacao_verificada", "atualizacao_descarregada", "atualizacao_aplicada",
           "atualizacao_recusada", "atualizacao_revertida", "atualizacao_adiada"}
# Enumerações curtas que os jogos escrevem de propósito (não é texto livre).
ENUM = {"purchase_type", "kind", "mode", "occasion", "opponent", "board", "grid", "maze", "list_mode", "rule", "theme", "left_by", "reason"}
# Nível de início de cada jogo (registo.js). Os jogos escondidos começam em 1 (o main.js só
# regista os jogos do ecrã inicial).
INICIO = {"fotos": 1, "musica": 1, "casa": 1, "passeios": 1, "pares": 3, "jardim": 1, "loto": 2, "ditados": 2, "domino": 2,
          "cozinha": 2, "aquario": 1, "sopa": 2, "palavras": 2, "sequencia": 2, "diferencas": 2, "puzzle": 2, "bisca": 2,
          "sueca": 2, "paciencia": 2, "damas": 2, "galo": 2, "feira": 2, "sardinha": 2, "montapratos": 1, "gato": 1,
          "cores": 1, "intruso": 1, "adivinhas": 1, "sudoku": 1, "labirinto": 1, "estendal": 1, "mesa": 1, "pintar": 1,
          "quatro": 1, "saltos": 1}
NOMES = {"fotos": "Fotografias", "musica": "Musica", "casa": "A minha casa", "passeios": "Passeios", "pares": "Pares",
         "jardim": "Jardim", "loto": "Loto", "ditados": "Ditados", "domino": "Domino", "cozinha": "Cozinha",
         "aquario": "Aquario", "sopa": "Sopa de letras", "palavras": "Palavras", "sequencia": "Sequencia",
         "diferencas": "Diferencas", "puzzle": "Puzzle", "bisca": "Bisca", "sueca": "Sueca", "paciencia": "Paciencia",
         "damas": "Damas", "galo": "Jogo do galo", "feira": "Feira", "sardinha": "Sardinhas", "montapratos": "Monta-pratos",
         "gato": "Gato aventureiro", "cores": "Cores", "intruso": "O intruso", "adivinhas": "Adivinhas", "sudoku": "Sudoku",
         "labirinto": "Labirinto", "estendal": "Estendal", "mesa": "Por a mesa", "pintar": "Azulejos",
         "quatro": "Quatro em linha", "saltos": "Saltos"}
SEM_NIVEL = {"fotos", "musica", "casa", "passeios"}   # estes nunca chamam ajustarNivel
PONTOS_PARA_SUBIR = 3
DIFICEIS_PARA_DESCER = 1
SOPA_RAPIDO = [12000, 12000, 12000, 14000, 15000, 15000, 18000, 20000, 25000, 30000]
CORES_RAPIDO = {"cor": 2500, "tons": 3000, "objeto": 3500, "stroop": 4000}


def g(r, k, d=0):
    v = r.get(k)
    return d if v is None else v


# Como cada jogo avalia uma ronda acabada (copiado das linhas facil/dificil do ficheiro de cada jogo).
# Devolve (facil, dificil) ou None quando falta ao registo o que a regra precisa.
def avaliar(r):
    j = r["game"]
    med = r.get("reaction_ms_median")
    h = g(r, "hints_needed")
    w = g(r, "wrong_taps")
    if j == "feira":
        compras = 5 if r.get("purchase_type") == "lista3" else 6
        erros = sum(g(r, k) for k in ("wrong_taps", "overpays", "change_errors", "cheapest_errors", "fewest_coins_errors", "total_errors", "budget_errors", "stall_errors"))
        return (g(r, "score") >= compras and h == 0, h >= 2 or erros > compras * 2)
    if j == "adivinhas":
        n = g(r, "riddles")
        return (w == 0 and (med or 0) < (15000 if r.get("kind") == "palavras" else 12000), w >= n or h >= n / 3)
    if j == "intruso":
        n = g(r, "sets")
        return (w == 0 and (med or 0) < (9000 if r.get("kind") == "palavras" else 6000), w >= n or h >= n / 3)
    if j == "cores":
        k = r.get("kind") or ""
        tipo = "stroop" if k.startswith("stroop") else k
        n = g(r, "prompts")
        return (w == 0 and (med or 0) < CORES_RAPIDO.get(tipo, 4000), w >= n * 0.6 or h >= n / 3)
    if j == "cozinha":
        erros = w + g(r, "order_errors") + g(r, "quantity_errors") + g(r, "pot_errors")
        return (erros == 0 and h == 0, h >= 2 or erros > g(r, "score"))
    if j == "damas":
        return (r.get("result") == 1 and w <= 3, r.get("result") == -1 and (g(r, "pieces_left") <= 1 or w >= 8))
    if j == "diferencas":
        t = g(r, "differences")
        m = r.get("ms_per_difference_median") or 0
        return (h == 0 and w <= t / 3 and m < 12000, h > t / 2 or w > t * 3)
    if j == "ditados":
        return (w <= 1 and (med or 0) < 9000, w > g(r, "sayings"))
    if j == "domino":
        return (bool(r.get("won")) and w <= 1, w >= 5 or h >= 3)
    if j == "estendal":
        erros = g(r, "wrong_choices") + g(r, "order_errors")
        m = r.get("ms_per_piece_median")
        certos = g(r, "pieces_right")
        return (erros == 0 and h == 0 and g(r, "repeats_heard") == 0 and g(r, "missed_drops") <= 2 and (m is None or m <= 8000),
                h >= 3 or erros > max(2, certos) or g(r, "missed_drops") > certos + 4)
    if j == "mesa":
        erros = g(r, "wrong_items") + g(r, "side_errors") + g(r, "order_errors")
        m = r.get("ms_per_item_median")
        certos = g(r, "items_right")
        return (erros == 0 and h == 0 and g(r, "repeats_heard") == 0 and g(r, "missed_drops") <= 2 and (m is None or m <= 7000),
                h >= 3 or erros > max(3, certos / 2) or g(r, "missed_drops") > certos + 4)
    if j == "galo":
        falhas = g(r, "missed_wins") + g(r, "missed_blocks")
        return (g(r, "wins") > g(r, "losses") and falhas <= 1, g(r, "wins") == 0 and g(r, "losses") >= 2)
    if j == "quatro":
        falhas = g(r, "missed_wins") + g(r, "missed_blocks")
        return (g(r, "wins") >= 2 and g(r, "losses") == 0 and falhas <= 1, g(r, "wins") == 0 and g(r, "losses") >= 2)
    if j == "gato":
        vezes = g(r, "crossings")   # uma ronda acabada atravessou exatamente cfg.vezes vezes
        trop = g(r, "bumps") + g(r, "splashes")
        return (trop <= vezes // 4, trop >= vezes * 4)
    if j == "jardim":
        n = r["level"]
        regas, falhas = g(r, "waterings"), g(r, "missed_drops")
        certos, errados = g(r, "requests_right"), g(r, "requests_wrong")
        return (regas >= 8 and falhas <= 2 and (n < 3 or (certos >= 5 and errados <= 1)),
                (n >= 2 and falhas > regas) or (n >= 3 and errados > max(2, certos)))
    if j == "labirinto":
        try:
            c, l = (int(x) for x in r.get("maze", "0x0").split("x"))
        except ValueError:
            return None
        m = r.get("ms_per_maze_median")
        acc = r.get("accuracy")
        return (h == 0 and acc is not None and acc >= 0.7 and m is not None and m <= c * l * 700, h >= max(2, g(r, "mazes")))
    if j == "loto":
        t = g(r, "card_size")
        return (w == 0 and h == 0 and (med or 0) < (6000 if r.get("words_only") else 4000), h > t / 2 or w > t)
    if j == "montapratos":
        t = r.get("accuracy") or 0
        extra = g(r, "wrong_takes") + g(r, "empty_plate_taps")
        return (t >= 0.95 and extra == 0, t < 0.5 or extra > (4 if g(r, "empty_plates_shown") else 3))
    if j == "paciencia":
        return (h == 0 and g(r, "rescues") == 0 and w <= 3, g(r, "rescues") > 0 or h >= 3)
    if j == "palavras":
        # as letras por item não são registadas: aproxima-se pelas letras certas a dividir pelas palavras
        words = g(r, "words") or 1
        lpi = g(r, "letters_right") / words
        m = r.get("ms_per_word_median")
        return (w == 0 and h == 0 and m is not None and m <= 2000 * lpi + 3000, h > words or w > g(r, "letters_right"))
    if j == "pares":
        p = g(r, "pairs")
        e = g(r, "wrong_pairs")
        return (e <= int(p * 0.8) and r["duration_ms"] < p * 12000, e > p * 3)
    if j == "pintar":
        e = g(r, "wrong_colour")
        return (e == 0 and h == 0, h >= 3 or e > max(3, g(r, "regions_right") / 2))
    if j == "puzzle":
        t = g(r, "pieces")
        u = g(r, "useless_swaps")
        return (h == 0 and u <= t / 5 and r["duration_ms"] < t * 9000, h >= 3 or u > t * 1.5)
    if j == "saltos":
        a = r.get("accuracy")
        return ((a or 0) >= 0.9, (1 if a is None else a) < 0.5)
    if j == "sardinha":
        taxa = r.get("accuracy") or 0
        return (taxa >= 0.95 and g(r, "cat_taps") == 0 and g(r, "wrong_fish_taps") == 0,
                taxa < 0.45 or g(r, "cat_taps") > max(2, g(r, "cat_shown") / 2) or g(r, "wrong_fish_taps") > max(3, g(r, "others_shown") / 2))
    if j == "sequencia":
        m, alvo, ini = g(r, "longest_sequence"), g(r, "target_length"), g(r, "start_length")
        return (m >= alvo or (m >= alvo - 1 and g(r, "errors") <= 1), m < ini)
    if j == "sopa":
        n = g(r, "words")
        e = g(r, "wrong_selections")
        m = r.get("ms_per_word_median")
        rapido = SOPA_RAPIDO[min(r["level"], len(SOPA_RAPIDO)) - 1]
        return (e == 0 and h == 0 and m is not None and m <= rapido, h >= n or e > n * 3)
    if j == "sudoku":
        n4 = str(r.get("board", "")).startswith("4x4")
        m = r.get("ms_per_cell_median")
        e = g(r, "wrong_placements")
        return (e <= 1 and h == 0 and m is not None and m <= (9000 if n4 else 15000), h >= 3 or e >= max(8, g(r, "empty_cells")))
    if j == "sueca":
        return (g(r, "score") >= 75, g(r, "score") < 45)
    if j == "bisca":
        return (g(r, "score") >= 70, g(r, "score") < 45)
    if j == "aquario":
        return (False, False)
    return None


# ---- carregar ----
def carregar(caminho):
    ficheiros = []
    if os.path.isdir(caminho):
        for raiz, _, nomes in os.walk(caminho):
            ficheiros += [os.path.join(raiz, n) for n in sorted(nomes) if n.endswith(".jsonl")]
    else:
        ficheiros = [caminho]
    regs = {}
    maus = 0
    repetidos = 0
    for f in sorted(ficheiros):
        with open(f, encoding="utf-8") as h:
            for linha in h:
                linha = linha.strip()
                if not linha:
                    continue
                try:
                    r = json.loads(linha)
                except ValueError:
                    maus += 1
                    continue
                rid = r.get("rid")
                if rid in regs:
                    repetidos += 1
                    continue
                regs[rid or f"sem-rid-{len(regs)}"] = r
    return list(regs.values()), ficheiros, maus, repetidos


def instante(r):
    return r.get("at") or r.get("started_at") or r.get("saved_at") or ""


def texto_livre(k, v):
    # Tudo o que não é um número, um verdadeiro ou falso, um nulo ou uma enumeração curta conhecida.
    if v is None or isinstance(v, (bool, int, float)):
        return False
    if k in ENUM and isinstance(v, str) and len(v) <= 20:
        return False
    return True


# ---- 1. contrato ----
def verificar_contrato(regs):
    print("== 1. Registos e contrato ==")
    faltas = []
    livres = Counter()
    for r in regs:
        tp = r.get("tipo")
        for k in BASE:
            if k not in r:
                faltas.append((instante(r), tp, r.get("game"), f"sem {k}"))
        if tp == "ronda":
            for k in RONDA:
                if k not in r:
                    faltas.append((instante(r), tp, r.get("game"), f"sem {k}"))
            for k, v in r.items():
                if k in BASE or k in RONDA or k == "saved_at" or k == "s":
                    continue
                if texto_livre(k, v):
                    livres[(r.get("game"), k, type(v).__name__)] += 1
        elif tp == "sessao":
            for k in SESSAO:
                if k not in r:
                    faltas.append((instante(r), tp, r.get("game"), f"sem {k}"))
        elif tp in EVENTOS:
            if "at" not in r:
                faltas.append((instante(r), tp, r.get("game"), "sem at"))
        else:
            faltas.append((instante(r), tp, r.get("game"), "tipo desconhecido"))
    rids = Counter(r.get("rid") for r in regs)
    dup = [k for k, n in rids.items() if n > 1 or not k]
    print(f"registos: {len(regs)}; tipos: {dict(sorted(Counter(r.get('tipo') for r in regs).items()))}")
    print(f"dispositivos: {sorted(set(str(r.get('device'))[:4] + '...' for r in regs))}; versoes: {sorted(set(str(r.get('app_version')) for r in regs))}")
    print(f"rid em falta ou repetido: {len(dup)}")
    if faltas:
        print(f"registos fora do contrato: {len(faltas)}")
        for f in faltas[:40]:
            print("   ", *f)
    else:
        print("campos obrigatorios: todos presentes em todos os registos")
    if livres:
        print("campos de ronda que nao sao numeros nem enumeracoes curtas (contrato: sem texto livre):")
        for (jogo, k, t), n in sorted(livres.items()):
            print(f"    {jogo:12} {k:18} {t:5} em {n} ronda(s)")
    print()
    return faltas


# ---- 2. coerência ----
def verificar_consistencia(regs):
    print("== 2. Consistencia ==")
    sessoes = sorted((r for r in regs if r.get("tipo") == "sessao"), key=lambda r: r["started_at"])
    rondas = sorted((r for r in regs if r.get("tipo") == "ronda"), key=lambda r: r["started_at"])
    aberturas = [r for r in regs if r.get("tipo") == "abrir_jogo"]
    print(f"abrir_jogo: {len(aberturas)}; sessoes: {len(sessoes)}; rondas: {len(rondas)}")
    por_jogo_a = Counter(r.get("game") for r in aberturas)
    por_jogo_s = Counter(r.get("game") for r in sessoes)
    dif = {j: (por_jogo_a[j], por_jogo_s[j]) for j in set(por_jogo_a) | set(por_jogo_s) if por_jogo_a[j] != por_jogo_s[j]}
    print("abrir_jogo por jogo igual a sessoes por jogo:", "sim" if not dif else f"nao: {dif}")
    problemas = []
    for r in rondas:
        ini = iso(r["started_at"])
        fim = ini + timedelta(milliseconds=r["duration_ms"])
        folga = timedelta(seconds=2)
        casa = [s for s in sessoes if s["game"] == r["game"] and iso(s["started_at"]) - folga <= ini and fim <= iso(s["ended_at"]) + folga]
        if not casa:
            problemas.append(f"ronda sem sessao: {r['game']} {hhmmss(r['started_at'])} {r['duration_ms']} ms")
    for s in sessoes:
        if s["active_ms"] > s["duration_ms"] + 1000:
            problemas.append(f"active_ms > duration_ms: {s['game']} {hhmmss(s['started_at'])} {s['active_ms']} > {s['duration_ms']}")
        dur_rel = iso(s["ended_at"]) - iso(s["started_at"])
        esperado = timedelta(milliseconds=s["duration_ms"] + s["screen_off_ms"])
        if abs(dur_rel - esperado) > timedelta(seconds=2):
            problemas.append(f"ended-started != duration+screen_off: {s['game']} {hhmmss(s['started_at'])}")
        if s["left_by"] not in ("casa", "voltar", "ocioso"):
            problemas.append(f"left_by desconhecido: {s['left_by']} {s['game']} {hhmmss(s['started_at'])}")
    for a, b in zip(sessoes, sessoes[1:]):
        if iso(b["started_at"]) < iso(a["ended_at"]) - timedelta(seconds=1):
            problemas.append(f"sessoes sobrepostas: {a['game']} ate {hhmmss(a['ended_at'])}, {b['game']} desde {hhmmss(b['started_at'])}")
    sem_ronda = []
    for s in sessoes:
        tem = any(r["game"] == s["game"] and iso(s["started_at"]) - timedelta(seconds=2) <= iso(r["started_at"]) <= iso(s["ended_at"]) for r in rondas)
        if not tem:
            sem_ronda.append(f"{s['game']} {hhmmss(s['started_at'])} ({round(s['duration_ms'] / 1000)} s)")
    print("rondas dentro da sua sessao, active <= duration, sessoes sem sobreposicao:", "sim" if not problemas else "nao")
    for p in problemas:
        print("   ", p)
    print(f"sessoes sem nenhuma ronda registada: {len(sem_ronda)}" + (": " + "; ".join(sem_ronda) if sem_ronda else ""))
    resets = sorted((r for r in regs if r.get("tipo") == "reset"), key=instante)
    for rs in resets:
        depois = sorted((r for r in regs if instante(r) > rs["at"]), key=instante)[:3]
        print(f"reset {quando(rs['at'])}: chaves apagadas {rs.get('keys_cleared')}, azulejos {rs.get('azulejos')}; a seguir: "
              + ", ".join(f"{r['tipo']} {hhmmss(instante(r))}" for r in depois))
    print("nota: a apresentacao (intro) nao escreve registo; o ciclo intro.vista nao se confirma pelos registos")
    on = sum(1 for r in regs if r.get("tipo") == "ecra_ligado")
    off = sum(1 for r in regs if r.get("tipo") == "ecra_desligado")
    print(f"ecra_desligado: {off}, ecra_ligado: {on}" + ("  (desligado sem ligado a seguir: acontece no reload do reset)" if off != on else ""))
    print()
    return sessoes, rondas, resets


# ---- 3. repetição da regra dos níveis ----
def replay_niveis(regs, rondas, resets):
    print("== 3. Regra do nivel (estado.js ajustarNivel) reproduzida sobre as rondas ==")
    print("por jogo: nivel previsto antes de cada ronda vs nivel gravado na ronda; a avaliacao vem das regras de cada jogo")
    estado = {}
    marcos = sorted(r["at"] for r in resets)
    desvios = 0
    por_jogo = defaultdict(list)
    for r in sorted(rondas, key=lambda r: r["started_at"]):
        j = r["game"]
        # um recomeço entre rondas põe o nível outra vez no início
        while marcos and marcos[0] < r["started_at"]:
            estado.clear()
            marcos.pop(0)
        st = estado.setdefault(j, {"n": INICIO.get(j, 1), "p": 0, "d": 0})
        previsto = st["n"]
        nota = "" if previsto == r["level"] else f"  <-- gravado {r['level']}, previsto {previsto}"
        if nota:
            desvios += 1
        av = None
        if r.get("completed"):
            if j in SEM_NIVEL:
                av = ("sem regra", None)
            else:
                res = avaliar(r)
                if res is None:
                    av = ("regra desconhecida", None)
                else:
                    facil, dificil = res
                    av = ("facil" if facil else "dificil" if dificil else "normal", res)
                    if not dificil:
                        st["d"] = 0
                        st["p"] += 3 if facil else 1
                        if st["p"] >= PONTOS_PARA_SUBIR:
                            st["n"] += 1
                            st["p"] = 0
                    else:
                        st["p"] = 0
                        st["d"] += 1
                        if st["d"] >= DIFICEIS_PARA_DESCER:
                            st["n"] = max(1, st["n"] - 1)
                            st["d"] = 0
        por_jogo[j].append(f"    {hhmm(r['started_at'])} nivel {r['level']} {'acabada' if r.get('completed') else 'deixada'}"
                           + (f" -> {av[0]}" if av else "") + f"; pontos {st['p']} nivel seguinte {st['n']}{nota}")
    for j in sorted(por_jogo):
        print(f"  {j} (inicio {INICIO.get(j, '?')})")
        for linha in por_jogo[j]:
            print(linha)
    print(f"rondas cujo nivel gravado difere do previsto: {desvios}")
    print()
    return estado


# ---- 4. números do ecrã da família ----
def ecra_familia(regs, sessoes, rondas, desde=None, rotulo=""):
    print(f"== 4. Ecra da familia recalculado {rotulo} ==")
    filtro = (lambda r: instante(r) >= desde) if desde else (lambda r: True)
    ss = [s for s in sessoes if filtro(s)]
    rr = [r for r in rondas if filtro(r)]
    ab = [r for r in regs if r.get("tipo") == "abrir_jogo" and filtro(r)]
    dias = defaultdict(list)
    for s in ss:
        dias[local(iso(s["started_at"])).date()].append(s)
    print("  Por dia (Dia, Minutos a jogar = soma de active_ms, Visitas = sessoes, Primeira, Ultima):")
    for d in sorted(dias):
        s = dias[d]
        print(f"    {d.strftime('%d/%m')}  {minutos(sum(x['active_ms'] for x in s)):3} min  {len(s):3} visitas  "
              f"{min(hhmm(x['started_at']) for x in s)}  {max(hhmm(x['ended_at']) for x in s)}   (abertos {minutos(sum(x['duration_ms'] for x in s))} min)")
    print("  Por atividade (Vezes = max(sessoes, abrir_jogo), Rondas acabadas, Minutos a jogar, Minutos abertos, Ultima vez, Nivel previsto):")
    linhas = []
    jogos = set(s["game"] for s in ss) | set(r["game"] for r in rr) | set(r["game"] for r in ab)
    for j in jogos:
        s = [x for x in ss if x["game"] == j]
        r = [x for x in rr if x["game"] == j]
        a = sum(1 for x in ab if x["game"] == j)
        tempos = [x["ended_at"] for x in s] + [x["started_at"] for x in r]
        linhas.append((minutos(sum(x["active_ms"] for x in s)), max(len(s), a), j, sum(1 for x in r if x.get("completed")),
                       minutos(sum(x["duration_ms"] for x in s)), max(tempos) if tempos else None, len(r)))
    for m, v, j, acab, ab_min, ult, nr in sorted(linhas, reverse=True):
        aviso = "" if j in INICIO else "  (jogo fora de registo.js: a tabela por atividade do ecra nao o mostra)"
        print(f"    {NOMES.get(j, j):18} {v:3} vezes  {acab:2} acabadas de {nr:2} rondas  {m:3} min a jogar  {ab_min:3} min abertos  ultima {hhmm(ult) if ult else '-'}{aviso}")
    horas = Counter()
    for s in ss:
        horas[local(iso(s["started_at"])).hour] += s["active_ms"]
    print("  Minutos a jogar por hora do dia (hora local; toda a sessao conta na hora em que comecou):")
    print("    " + "  ".join(f"{h:02}h:{minutos(horas[h])}" for h in sorted(horas)))
    print()


# ---- 5. bateria ----
def bateria(regs):
    print("== 5. Bateria ==")
    b = sorted((r for r in regs if r.get("tipo") == "bateria"), key=lambda r: r["at"])
    if not b:
        print("sem registos de bateria")
        print()
        return
    sessoes = [r for r in regs if r.get("tipo") == "sessao"]
    for r in b:
        print(f"    {quando(r['at'])}  {r['level']:3}%  {'a carregar' if r.get('charging') else 'sem carregador'}  ({r.get('reason')})")
    print("  Intervalos (variacao, minutos, taxa por hora, minutos de jogo ativo no intervalo):")
    for a, c in zip(b, b[1:]):
        dt = (iso(c["at"]) - iso(a["at"])).total_seconds() / 60
        if dt < 5:
            continue
        delta = c["level"] - a["level"]
        ativo = 0
        for s in sessoes:
            ini, fim = iso(s["started_at"]), iso(s["ended_at"])
            sobre = max(timedelta(0), min(fim, iso(c["at"])) - max(ini, iso(a["at"])))
            if sobre.total_seconds() > 0 and (fim - ini).total_seconds() > 0:
                ativo += s["active_ms"] / 60000 * (sobre.total_seconds() / (fim - ini).total_seconds())
        modo = "a carregar" if a.get("charging") and c.get("charging") else "descarga" if not a.get("charging") and not c.get("charging") else "misto"
        print(f"    {hhmm(a['at'])}-{hhmm(c['at'])}  {delta:+3}%  {dt:5.1f} min  {delta / dt * 60:+6.1f} %/h  jogo ativo {ativo:4.1f} min  {modo}")
    desc = [(a, c) for a, c in zip(b, b[1:]) if not a.get("charging") and not c.get("charging")]
    if desc:
        ini, fim = desc[0][0], desc[-1][1]
        dt = (iso(fim["at"]) - iso(ini["at"])).total_seconds() / 3600
        if dt > 0:
            print(f"  descarga de {ini['level']}% as {hhmm(ini['at'])} a {fim['level']}% as {hhmm(fim['at'])}: {(ini['level'] - fim['level']) / dt:.1f} % por hora")
    print()


# ---- 6. resumo neutro do último bloco de jogo depois do último recomeço ----
def resumo_ultimo_bloco(sessoes, rondas, resets):
    print("== 6. Ultimo bloco de uso depois do ultimo reset, visita a visita ==")
    desde = max((r["at"] for r in resets), default="")
    ss = [s for s in sessoes if s["started_at"] >= desde]
    if not ss:
        print("sem visitas depois do ultimo reset")
        print()
        return
    blocos = [[ss[0]]]
    for s in ss[1:]:
        if iso(s["started_at"]) - iso(blocos[-1][-1]["ended_at"]) > timedelta(minutes=30):
            blocos.append([s])
        else:
            blocos[-1].append(s)
    print(f"blocos de uso (separados por mais de 30 min sem visitas): {len(blocos)}")
    for k, bl in enumerate(blocos, 1):
        print(f"  bloco {k}: {quando(bl[0]['started_at'])} a {hhmm(bl[-1]['ended_at'])}, {len(bl)} visitas, "
              f"{minutos(sum(s['active_ms'] for s in bl))} min a jogar de {minutos(sum(s['duration_ms'] for s in bl))} abertos")
    bl = blocos[-1]
    print(f"  ultimo bloco em detalhe:")
    for s in bl:
        rs = [r for r in rondas if r["game"] == s["game"] and s["started_at"] <= r["started_at"] <= s["ended_at"]]
        print(f"    {hhmm(s['started_at'])}-{hhmm(s['ended_at'])}  {NOMES.get(s['game'], s['game']):18} "
              f"{round(s['duration_ms'] / 60000, 1):5} min abertos, {round(s['active_ms'] / 60000, 1):5} min com toques, "
              f"{s['taps']:3} toques, saiu por '{s['left_by']}', ecra apagado {round(s['screen_off_ms'] / 1000)} s")
        for r in rs:
            extra = {k: r[k] for k in ("level", "score", "accuracy", "purchases", "wrong_taps", "overpays", "change_errors",
                                       "hints_needed", "ms_per_purchase_median", "purchase_type", "taps") if k in r}
            print(f"        ronda {'acabada' if r.get('completed') else 'deixada a meio'} apos {round(r['duration_ms'] / 60000, 1)} min: {extra}")
    print()


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    regs, ficheiros, maus, repetidos = carregar(sys.argv[1])
    regs.sort(key=instante)
    print(f"ficheiros lidos: {len(ficheiros)}; linhas invalidas: {maus}; registos repetidos (mesmo rid): {repetidos}")
    if regs:
        print(f"cobertura: de {quando(instante(regs[0]))} a {quando(instante(regs[-1]))}")
        ult = max(r.get("saved_at", "") for r in regs)
        if ult:
            print(f"ultimo registo guardado no cartao: {quando(ult)} (o que veio depois so esta no tablet ou no servidor)")
    print()
    verificar_contrato(regs)
    sessoes, rondas, resets = verificar_consistencia(regs)
    replay_niveis(regs, rondas, resets)
    ecra_familia(regs, sessoes, rondas, None, "(todos os registos, como o ecra faz hoje)")
    if resets:
        ecra_familia(regs, sessoes, rondas, max(r["at"] for r in resets), "(so depois do ultimo reset)")
    bateria(regs)
    resumo_ultimo_bloco(sessoes, rondas, resets)


if __name__ == "__main__":
    main()
