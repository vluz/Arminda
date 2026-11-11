"""Substituto do servidor da família, para testar no PC o envio de registos do tablet.

Correr: python tools/servidor_teste.py [porta]
Um POST /api/registos com "Authorization: Bearer teste" e {"registos": [...]} responde
{"aceites": [rid, ...]}; os repetidos são aceites outra vez mas guardados uma só vez. Mostra os totais.
Manda os cabeçalhos CORS de que o servidor verdadeiro também precisa (a app corre em https://localhost).
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

VISTOS = {}


class Pedido(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin") or "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Max-Age", "86400")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path != "/api/registos" or self.headers.get("Authorization") != "Bearer teste":
            self.send_response(401)
            self._cors()
            self.end_headers()
            return
        corpo = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        aceites = []
        for r in corpo.get("registos", []):
            if isinstance(r, dict) and r.get("rid"):
                VISTOS.setdefault(r["rid"], r)
                aceites.append(r["rid"])
        resposta = json.dumps({"aceites": aceites}).encode()
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(resposta)
        tipos = {}
        for r in VISTOS.values():
            tipos[r.get("tipo")] = tipos.get(r.get("tipo"), 0) + 1
        print(f"batch {len(aceites)}, stored {len(VISTOS)}: {tipos}", flush=True)


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8780
    HTTPServer(("127.0.0.1", porta), Pedido).serve_forever()
