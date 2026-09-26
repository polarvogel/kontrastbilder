#!/usr/bin/env python3
"""
Kleiner Webserver für die Entwicklung, nur Python-Standardbibliothek.

Unterschied zu "python3 -m http.server": sendet Cache-Control: no-store, damit der
Browser nach Änderungen nie alte Dateien zeigt.

Aufruf:
  python3 werkzeuge/server.py                      site/ auf http://127.0.0.1:8000
  python3 werkzeuge/server.py --port 8001 --verzeichnis .
  python3 werkzeuge/server.py --bind 0.0.0.0       im Heimnetz erreichbar (siehe README)
"""

import argparse
import functools
import http.server
import pathlib


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format, *args):
        pass


def main():
    projekt = pathlib.Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="Entwicklungsserver für Kontrastbilder")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--verzeichnis", default=str(projekt / "site"))
    argumente = parser.parse_args()

    handler = functools.partial(Handler, directory=argumente.verzeichnis)
    server = http.server.ThreadingHTTPServer((argumente.bind, argumente.port), handler)
    server.daemon_threads = True
    print(f"Kontrastbilder: http://{argumente.bind}:{argumente.port}/ (Verzeichnis {argumente.verzeichnis}), Ende mit Strg+C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
