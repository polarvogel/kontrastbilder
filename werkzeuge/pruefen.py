#!/usr/bin/env python3
"""
Prüft Motive oder Klänge in einem Chromium ohne Fenster und gibt die Befunde als
Textzeilen aus: "<datei>: OK|HINWEIS|FEHLER <Text>", zuletzt "ERGEBNIS: ...".
Rückgabewert 0 ohne Fehler, 1 bei Fehlern, 2 bei Problemen mit dem Werkzeug.

Aufruf:
  python3 werkzeuge/pruefen.py motiv                       alle Motive aus site/motive/liste.js
  python3 werkzeuge/pruefen.py motiv elefant               ein Motiv aus der Liste
  python3 werkzeuge/pruefen.py motiv entwurf.svg           Datei in site/motive/, auch ohne Listeneintrag
  python3 werkzeuge/pruefen.py motiv elefant --bild a.png  zusätzlich Bild der Prüfseite speichern
  python3 werkzeuge/pruefen.py klang                       alle Klänge aus site/klaenge/liste.js
  python3 werkzeuge/pruefen.py klang meer                  ein Klang aus der Liste
  python3 werkzeuge/pruefen.py klang neu.json              Datei in site/klaenge/, auch ohne Listeneintrag

Braucht nur python3 und Chromium oder Chrome (im PATH oder als Flatpak).
Anderer Browser-Befehl: CHROMIUM="/pfad/zu/chrome" python3 werkzeuge/pruefen.py ...

Technik: startet werkzeuge/server.py als Thread, steuert den Browser über das
DevTools-Protokoll (eigener kleiner WebSocket-Client) und liest #ergebnis-text,
sobald die Prüfseite fertig ist.
"""

import argparse
import base64
import functools
import http.server
import json
import os
import pathlib
import shlex
import shutil
import signal
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request

WERKZEUGE = pathlib.Path(__file__).resolve().parent
PROJEKT = WERKZEUGE.parent
sys.path.insert(0, str(WERKZEUGE))
import server as testserver


class WebSocket:
    """Minimaler WebSocket-Client (RFC 6455), reicht für das DevTools-Protokoll."""

    def __init__(self, url):
        teile = urllib.parse.urlparse(url)
        self.sock = socket.create_connection((teile.hostname, teile.port), timeout=60)
        schluessel = base64.b64encode(os.urandom(16)).decode()
        anfrage = (
            f"GET {teile.path} HTTP/1.1\r\nHost: {teile.hostname}:{teile.port}\r\n"
            f"Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {schluessel}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(anfrage.encode())
        antwort = b""
        while b"\r\n\r\n" not in antwort:
            antwort += self.sock.recv(1024)
        if b" 101 " not in antwort.split(b"\r\n", 1)[0]:
            raise RuntimeError(f"WebSocket abgelehnt: {antwort[:200]!r}")
        self.rest = antwort.split(b"\r\n\r\n", 1)[1]

    def _lies(self, anzahl):
        while len(self.rest) < anzahl:
            block = self.sock.recv(65536)
            if not block:
                raise ConnectionError("WebSocket geschlossen")
            self.rest += block
        daten, self.rest = self.rest[:anzahl], self.rest[anzahl:]
        return daten

    def senden(self, text):
        nutzlast = text.encode()
        kopf = bytes([0x81])
        laenge = len(nutzlast)
        if laenge < 126:
            kopf += bytes([0x80 | laenge])
        elif laenge < 65536:
            kopf += bytes([0x80 | 126]) + struct.pack(">H", laenge)
        else:
            kopf += bytes([0x80 | 127]) + struct.pack(">Q", laenge)
        maske = os.urandom(4)
        maskiert = bytes(b ^ maske[i % 4] for i, b in enumerate(nutzlast))
        self.sock.sendall(kopf + maske + maskiert)

    def empfangen(self):
        teile = []
        while True:
            b1, b2 = self._lies(2)
            laenge = b2 & 0x7F
            if laenge == 126:
                laenge = struct.unpack(">H", self._lies(2))[0]
            elif laenge == 127:
                laenge = struct.unpack(">Q", self._lies(8))[0]
            nutzlast = self._lies(laenge)
            opcode = b1 & 0x0F
            if opcode == 8:
                raise ConnectionError("WebSocket geschlossen")
            if opcode in (0, 1, 2):
                teile.append(nutzlast)
                if b1 & 0x80:
                    return b"".join(teile).decode()


class DevTools:
    """Aufrufe im Chrome DevTools Protocol, Ereignisse werden ignoriert."""

    def __init__(self, ws_url):
        self.ws = WebSocket(ws_url)
        self.naechste_id = 0

    def rufe(self, methode, **parameter):
        self.naechste_id += 1
        kennung = self.naechste_id
        self.ws.senden(json.dumps({"id": kennung, "method": methode, "params": parameter}))
        while True:
            nachricht = json.loads(self.ws.empfangen())
            if nachricht.get("id") == kennung:
                if "error" in nachricht:
                    raise RuntimeError(f"{methode}: {nachricht['error']}")
                return nachricht.get("result", {})


def finde_browser():
    """Browserbefehl und, bei Flatpak, die App-ID."""
    if os.environ.get("CHROMIUM"):
        return shlex.split(os.environ["CHROMIUM"]), None
    for name in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable"):
        if shutil.which(name):
            return [name], None
    if shutil.which("flatpak"):
        for app in ("org.chromium.Chromium", "com.google.Chrome"):
            if subprocess.run(["flatpak", "info", app], capture_output=True).returncode == 0:
                return ["flatpak", "run", app], app
    return None, None


def eigenes_profil(flatpak_app):
    """
    Eigenes Browserprofil, damit die Prüfung nie das normale Profil benutzt oder
    sich an ein offenes Browserfenster hängt. Flatpak-Browser sehen /tmp des Systems
    nicht, deshalb liegt das Profil dort im Cache-Ordner der App.
    """
    if flatpak_app:
        basis = pathlib.Path.home() / ".var" / "app" / flatpak_app / "cache"
        basis.mkdir(parents=True, exist_ok=True)
        return pathlib.Path(tempfile.mkdtemp(prefix="kontrastbilder-pruefen-", dir=basis))
    return pathlib.Path(tempfile.mkdtemp(prefix="kontrastbilder-pruefen-"))


def beende_reste(port):
    """Beendet alle Prozesse, die mit unserem DevTools-Port gestartet wurden."""
    kennung = f"--remote-debugging-port={port}".encode()
    for eintrag in pathlib.Path("/proc").iterdir():
        if not eintrag.name.isdigit():
            continue
        try:
            if kennung in (eintrag / "cmdline").read_bytes():
                os.kill(int(eintrag.name), signal.SIGTERM)
        except (OSError, ProcessLookupError):
            pass


def freier_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def starte_server():
    handler = functools.partial(testserver.Handler, directory=str(PROJEKT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def seite_fuer(art, ziel):
    if art == "motiv":
        if not ziel:
            return "site/pruefen.html"
        schluessel = "datei" if ziel.endswith(".svg") else "motiv"
        return f"site/pruefen.html?{schluessel}={urllib.parse.quote(ziel)}"
    if not ziel:
        return "werkzeuge/klangpruefung.html"
    schluessel = "datei" if ziel.endswith(".json") else "klang"
    return f"werkzeuge/klangpruefung.html?{schluessel}={urllib.parse.quote(ziel)}"


def warte_auf_devtools(port, sekunden=40):
    ende = time.time() + sekunden
    while time.time() < ende:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=2) as antwort:
                for ziel in json.load(antwort):
                    if ziel.get("type") == "page":
                        return ziel["webSocketDebuggerUrl"]
        except OSError:
            pass
        time.sleep(0.3)
    raise RuntimeError("Browser startet nicht (DevTools nicht erreichbar)")


def main():
    parser = argparse.ArgumentParser(description="Motive und Klänge prüfen")
    parser.add_argument("art", choices=["motiv", "klang"])
    parser.add_argument("ziel", nargs="?", default="", help="id aus der Liste oder Dateiname")
    parser.add_argument("--bild", help="PNG der Prüfseite speichern (nur motiv)")
    parser.add_argument("--zeit", type=int, default=180, help="höchstens so viele Sekunden warten")
    argumente = parser.parse_args()

    browser, flatpak_app = finde_browser()
    if not browser:
        print("FEHLER Kein Chromium oder Chrome gefunden. CHROMIUM=... setzen.", file=sys.stderr)
        return 2

    signal.signal(signal.SIGTERM, lambda *_: sys.exit(2))
    server = starte_server()
    profil = eigenes_profil(flatpak_app)
    url = f"http://127.0.0.1:{server.server_address[1]}/{seite_fuer(argumente.art, argumente.ziel)}"
    port = freier_port()
    prozess = subprocess.Popen(
        browser
        + [
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--hide-scrollbars",
            "--window-size=1600,760",
            "--autoplay-policy=no-user-gesture-required",
            f"--remote-debugging-port={port}",
            f"--user-data-dir={profil}",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    devtools = None
    try:
        devtools = DevTools(warte_auf_devtools(port))
        devtools.rufe("Page.navigate", url=url)
        ergebnis = ""
        ende = time.time() + argumente.zeit
        while time.time() < ende:
            time.sleep(0.5)
            antwort = devtools.rufe(
                "Runtime.evaluate",
                expression="document.getElementById('ergebnis-text')?.textContent ?? ''",
                returnByValue=True,
            )
            ergebnis = antwort.get("result", {}).get("value", "")
            if "ERGEBNIS:" in ergebnis:
                break
        if "ERGEBNIS:" not in ergebnis:
            print(f"FEHLER Keine Ergebnisse nach {argumente.zeit} s ({url}).", file=sys.stderr)
            return 2
        print(ergebnis.strip())
        if argumente.bild:
            bild = devtools.rufe("Page.captureScreenshot", format="png")
            pfad = pathlib.Path(argumente.bild).resolve()
            pfad.write_bytes(base64.b64decode(bild["data"]))
            print(f"BILD: {pfad}")
        return 1 if ": FEHLER " in ergebnis else 0
    except (RuntimeError, OSError) as fehler:
        print(f"FEHLER Werkzeug: {fehler}", file=sys.stderr)
        return 2
    finally:
        try:
            if devtools:
                devtools.rufe("Browser.close")
        except (RuntimeError, OSError):
            pass
        try:
            prozess.wait(timeout=10)
        except subprocess.TimeoutExpired:
            prozess.terminate()
        beende_reste(port)
        server.shutdown()
        shutil.rmtree(profil, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
