"""Faz as cenas que vêm com o Puzzle, como ficheiros SVG completos (400x400).

Cada cena é desenhada com formas simples e com cópias embutidas dos nossos SVG (www/img/proprio,
www/img/jogos) e de imagens do Noto Emoji. Os ids dentro de cada imagem embutida levam um prefixo único.
Correr: python tools/cenas_puzzle.py
"""
import os
import re

APP = "app/www"
NOTO_EXTRA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "noto")
SAIDA = os.path.join(APP, "img", "jogos")

contador = [0]


def fonte(nome):
    for p in (f"{APP}/img/proprio/{nome}.svg", f"{APP}/img/noto/{nome}.svg",
              f"{APP}/img/jogos/{nome}.svg", f"{NOTO_EXTRA}/{nome}.svg"):
        if os.path.exists(p):
            with open(p, encoding="utf-8", errors="replace") as f:
                return f.read()
    raise SystemExit("falta " + nome)


def usar(nome, x, y, w, h=None, extra=""):
    """Embute a imagem `nome` na caixa (x, y, w, h)."""
    h = h or w
    txt = fonte(nome)
    txt = re.sub(r"<\?xml.*?\?>", "", txt, flags=re.S)
    txt = re.sub(r"<!DOCTYPE.*?\]>", "", txt, flags=re.S)
    txt = re.sub(r"<!--.*?-->", "", txt, flags=re.S)
    m = re.search(r"<svg\b([^>]*)>(.*)</svg>", txt, flags=re.S)
    atr, corpo = m.group(1), m.group(2)
    vb = re.search(r'viewBox="([^"]+)"', atr).group(1)
    contador[0] += 1
    p = f"c{contador[0]}_"
    ids = set(re.findall(r'\bid="([^"]+)"', corpo))
    for i in sorted(ids, key=len, reverse=True):
        corpo = corpo.replace(f'id="{i}"', f'id="{p}{i}"')
        corpo = corpo.replace(f"url(#{i})", f"url(#{p}{i})")
        corpo = corpo.replace(f'href="#{i}"', f'href="#{p}{i}"')
    return (f'<svg x="{x}" y="{y}" width="{w}" height="{h}" viewBox="{vb}" '
            f'preserveAspectRatio="xMidYMid meet" {extra}>{corpo}</svg>')


def cena(nome, partes):
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
           'viewBox="0 0 400 400" width="400" height="400">' + "".join(partes) + "</svg>")
    caminho = os.path.join(SAIDA, f"puzzle-{nome}.svg")
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(svg)
    print(nome, len(svg))


L = "#1A1A1A"


def janela(x, y, w, h, cor="#8EC9F0"):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" fill="{cor}" stroke="{L}" stroke-width="3"/>'
            f'<line x1="{x + w / 2}" y1="{y}" x2="{x + w / 2}" y2="{y + h}" stroke="{L}" stroke-width="2"/>'
            f'<line x1="{x}" y1="{y + h / 2}" x2="{x + w}" y2="{y + h / 2}" stroke="{L}" stroke-width="2"/>')


def calcada(y0, y1):
    out = [f'<rect x="0" y="{y0}" width="400" height="{y1 - y0}" fill="#EDE6D6"/>']
    for i in range(0, 400, 40):
        out.append(f'<path d="M{i} {y1} Q{i + 20} {y0 + 10} {i + 40} {y1}" fill="none" stroke="#3A3A3A" stroke-width="5"/>')
    return "".join(out)


# 1. Rua de Lisboa com o elétrico amarelo.
cena("eletrico", [
    '<rect width="400" height="400" fill="#8ED1FC"/>',
    usar("sol", 300, 12, 70),
    usar("nuvem", 40, 20, 80),
    # prédios
    f'<rect x="0" y="80" width="130" height="230" fill="#F7B6C8" stroke="{L}" stroke-width="4"/>',
    f'<path d="M-4 80 L130 80 L110 56 L0 56 Z" fill="#D94F2B" stroke="{L}" stroke-width="4"/>',
    janela(16, 100, 40, 50), janela(74, 100, 40, 50), janela(16, 170, 40, 50), janela(74, 170, 40, 50),
    f'<rect x="270" y="70" width="130" height="240" fill="#FFD966" stroke="{L}" stroke-width="4"/>',
    f'<path d="M270 70 L404 70 L404 46 L290 46 Z" fill="#D94F2B" stroke="{L}" stroke-width="4"/>',
    janela(286, 92, 40, 50), janela(344, 92, 40, 50), janela(286, 162, 40, 50), janela(344, 162, 40, 50),
    f'<rect x="130" y="120" width="140" height="190" fill="#9ED8C0" stroke="{L}" stroke-width="4"/>',
    janela(150, 140, 40, 46), janela(210, 140, 40, 46),
    usar("rosa", 20, 228, 34), usar("tulipa", 344, 222, 34),
    usar("passaro", 200, 70, 50),
    # carris e passeio
    f'<rect x="0" y="300" width="400" height="20" fill="#8A8A8A" stroke="{L}" stroke-width="3"/>',
    calcada(320, 400),
    usar("eletrico", 85, 150, 230),
    usar("gato", 20, 330, 60),
    usar("guitarra", 330, 318, 70),
])

# 2. Jardim cheio de flores.
cena("jardim", [
    '<rect width="400" height="400" fill="#8ED1FC"/>',
    usar("sol", 20, 14, 80),
    usar("nuvem", 230, 24, 90),
    f'<path d="M0 170 Q100 140 200 170 Q300 200 400 160 L400 400 L0 400 Z" fill="#7CCF4F" stroke="{L}" stroke-width="4"/>',
    usar("arvore", 270, 60, 130),
    usar("casa_jardim", 40, 90, 120),
    usar("girassol", 10, 210, 90), usar("rosa", 100, 230, 80), usar("tulipa", 180, 214, 80),
    usar("malmequer", 260, 230, 80), usar("margarida", 330, 210, 70),
    usar("cravo", 20, 310, 80), usar("vaso", 110, 320, 70), usar("regador", 200, 310, 90),
    usar("gato", 300, 300, 90),
    usar("borboleta", 170, 110, 60), usar("abelha", 120, 60, 44), usar("joaninha", 300, 190, 30),
])

# 3. Parede de azulejos com uma janela e um vaso de flores.
def azulejo(x, y, cor, motivo):
    t = 80
    out = [f'<rect x="{x}" y="{y}" width="{t}" height="{t}" fill="#FFFFFF" stroke="#2B4F9E" stroke-width="2"/>']
    c = x + t / 2
    m = y + t / 2
    if motivo == 0:
        out.append(f'<circle cx="{c}" cy="{m}" r="22" fill="{cor}"/><circle cx="{c}" cy="{m}" r="9" fill="#FFB703"/>')
        for dx, dy in ((0, 0), (t, 0), (0, t), (t, t)):
            out.append(f'<path d="M{x + dx} {y + dy} m-18 0 a18 18 0 0 0 36 0 a18 18 0 0 0 -36 0" fill="{cor}" opacity="0.7"/>')
    elif motivo == 1:
        out.append(f'<path d="M{c} {y + 8} L{x + t - 8} {m} L{c} {y + t - 8} L{x + 8} {m} Z" fill="{cor}"/>'
                   f'<circle cx="{c}" cy="{m}" r="10" fill="#FFFFFF"/>')
    else:
        for a in range(4):
            out.append(f'<ellipse cx="{c}" cy="{m - 18}" rx="9" ry="18" fill="{cor}" transform="rotate({a * 90} {c} {m})"/>')
        out.append(f'<circle cx="{c}" cy="{m}" r="7" fill="#E63946"/>')
    return "".join(out)


partes = ['<rect width="400" height="400" fill="#FFFFFF"/>']
cores = ["#1F5FBF", "#2B9348", "#1F5FBF", "#FB8500"]
for i in range(5):
    for j in range(5):
        partes.append(azulejo(i * 80, j * 80, cores[(i + 2 * j) % 4], (i * 3 + j) % 3))
partes += [
    f'<rect x="110" y="60" width="180" height="170" rx="6" fill="#8ED1FC" stroke="{L}" stroke-width="6"/>',
    usar("sol", 210, 76, 60), usar("nuvem", 124, 90, 70),
    f'<line x1="200" y1="60" x2="200" y2="230" stroke="{L}" stroke-width="6"/>',
    f'<rect x="96" y="226" width="208" height="20" fill="#C0392B" stroke="{L}" stroke-width="4"/>',
    usar("vaso", 120, 160, 70), usar("rosa", 128, 110, 56),
    usar("gato", 220, 150, 80),
    usar("galo", 20, 270, 110),
    usar("pastel_nata", 280, 300, 90),
    f'<rect x="150" y="300" width="100" height="70" rx="8" fill="#FFB703" stroke="{L}" stroke-width="4"/>',
    usar("cafe", 160, 300, 80),
]
cena("azulejos", partes)

# 4. Praia com sardinhas assadas.
cena("praia", [
    '<rect width="400" height="400" fill="#8ED1FC"/>',
    usar("sol", 300, 10, 80),
    usar("nuvem", 30, 26, 80),
    usar("passaro", 170, 40, 50),
    f'<rect x="0" y="120" width="400" height="120" fill="#1F7FD0" stroke="{L}" stroke-width="4"/>',
    usar("barco", 60, 70, 100),
    usar("onda", 250, 130, 90), usar("golfinho", 180, 120, 70),
    f'<path d="M0 230 Q100 210 200 232 Q300 250 400 226 L400 400 L0 400 Z" fill="#F6D68A" stroke="{L}" stroke-width="4"/>',
    usar("guarda_sol", 10, 200, 130),
    usar("balde", 150, 270, 60), usar("concha", 220, 320, 50), usar("caranguejo", 330, 330, 60),
    # grelha com sardinhas
    f'<rect x="210" y="250" width="150" height="70" rx="6" fill="#555555" stroke="{L}" stroke-width="4"/>',
    f'<g stroke="#999" stroke-width="3">' + "".join(f'<line x1="{x}" y1="252" x2="{x}" y2="318"/>' for x in range(222, 360, 14)) + "</g>",
    usar("sardinha", 210, 238, 80), usar("sardinha", 270, 238, 80), usar("sardinha", 240, 270, 80),
    usar("pao", 30, 330, 60), usar("limao", 100, 340, 50),
])

# 5. Cozinha.
cozinha = ['<rect width="400" height="400" fill="#FFF6E0"/>']
for i in range(0, 400, 40):
    for j in range(0, 200, 40):
        cor = "#CFE3F7" if (i // 40 + j // 40) % 2 else "#FFFFFF"
        cozinha.append(f'<rect x="{i}" y="{j}" width="40" height="40" fill="{cor}" stroke="#7FA7D6" stroke-width="1.5"/>')
cozinha += [
    f'<rect x="250" y="30" width="120" height="100" rx="6" fill="#8ED1FC" stroke="{L}" stroke-width="5"/>',
    usar("sol", 300, 40, 50), f'<line x1="310" y1="30" x2="310" y2="130" stroke="{L}" stroke-width="4"/>',
    f'<rect x="20" y="40" width="190" height="16" fill="#A0522D" stroke="{L}" stroke-width="3"/>',
    usar("bule", 24, 2, 60), usar("cafe", 90, 6, 50), usar("cha", 150, 6, 50),
    usar("panela", 40, 110, 100),
    f'<rect x="20" y="190" width="160" height="210" fill="#EEEEEE" stroke="{L}" stroke-width="4"/>',
    f'<circle cx="60" cy="210" r="10" fill="#333"/><circle cx="140" cy="210" r="10" fill="#333"/>',
    f'<rect x="40" y="240" width="120" height="120" rx="6" fill="#333" stroke="{L}" stroke-width="3"/>',
    f'<rect x="50" y="250" width="100" height="60" fill="#FFB703" opacity="0.5"/>',
    # mesa com toalha aos quadrados
    f'<rect x="190" y="220" width="210" height="180" fill="#FFFFFF" stroke="{L}" stroke-width="4"/>',
]
for i in range(190, 400, 30):
    for j in range(220, 400, 30):
        if ((i - 190) // 30 + (j - 220) // 30) % 2 == 0:
            cozinha.append(f'<rect x="{i}" y="{j}" width="30" height="30" fill="#E63946" opacity="0.85"/>')
cozinha += [
    usar("pao", 200, 170, 80), usar("frigideira", 290, 160, 90),
    usar("pastel_nata", 210, 260, 70), usar("laranja", 300, 250, 60), usar("tomate", 340, 300, 54),
    usar("cebola", 220, 330, 60), usar("cenoura", 290, 320, 60), usar("uvas", 170, 140, 50),
    usar("gato", 0, 330, 70),
]
cena("cozinha", cozinha)
