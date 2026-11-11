"""Usado uma vez: cria módulos provisórios e imagens de botão para jogos ainda por fazer.

Correr: python tools/criar_esboços.py
Nunca escreve por cima de um ficheiro que exista.
"""
import os
import shutil

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WWW = os.path.join(APP, "www")

NOVOS = {
    "ditados": "nota", "domino": "estrela", "sopa": "estrela", "palavras": "beijo",
    "bisca": "coracao", "sueca": "coracao", "paciencia": "estrela", "damas": "estrela",
    "galo": "estrela", "cozinha": "laranja", "feira": "cesto", "sardinha": "gato",
    "aquario": "arco_iris", "puzzle": "festa", "sequencia": "estrela", "diferencas": "estrela",
    "fotos": "coracao", "musica": "nota", "casa": "casa", "montapratos": "cesto", "gato": "gato",
    "cores": "arco_iris", "intruso": "oculos", "adivinhas": "livro", "sudoku": "estrela",
    "labirinto": "caracol", "estendal": "sol", "mesa": "talheres", "pintar": "flor_cerejeira",
    "quatro": "coracao_amarelo", "saltos": "coelho",
}

ESBOCO = '''// Provisório até o jogo estar feito.
import {{ ecra }} from "../ui.js";

export const NIVEIS_MAX = 1;
export const ESBOCO = true;   // fica fora do ecrã inicial até estar feito

export function abrir(app, sair) {{
  let ativo = true;
  const terminar = () => {{ if (!ativo) return; ativo = false; e.raiz.remove(); sair(); }};
  const e = ecra(terminar);
  app.append(e.raiz);
  e.mostrar("Em breve!");
  return terminar;
}}
'''


def main():
    os.makedirs(os.path.join(WWW, "img", "jogos"), exist_ok=True)
    for jogo, noto in NOVOS.items():
        mod = os.path.join(WWW, "js", "jogos", jogo + ".js")
        if not os.path.exists(mod):
            with open(mod, "w", encoding="utf-8", newline="\n") as f:
                f.write(ESBOCO.format(jogo=jogo))
        fig = os.path.join(WWW, "img", "jogos", jogo + ".svg")
        if not os.path.exists(fig):
            shutil.copyfile(os.path.join(WWW, "img", "noto", noto + ".svg"), fig)
    print("provisórios prontos")


if __name__ == "__main__":
    main()
