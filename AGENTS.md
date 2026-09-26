# Kontrastbilder – Hinweise für KI-Agenten

Statische Webseite: schwarz-weiße Kontrastbilder für Säuglinge (0–4 Monate), teils langsam animiert, optionaler Farbmodus, live erzeugte Klänge. Die menschliche Beschreibung steht in `README.md`, die ursprüngliche Aufgabe in `Kontrastbilder-task.md` (nicht ändern).

## Aufgaben mit eigener Anleitung

Für diese Aufgaben zuerst die Anleitung vollständig lesen und genau befolgen:

- Neues Motiv (SVG): `anleitungen/motiv-erstellen.md`
- Neuer Klang (JSON): `anleitungen/klang-erstellen.md`

## Aufbau

```
site/                 die veröffentlichte Seite, ohne Build
  index.html          Anzeige; druck.html Druckansicht; pruefen.html Prüfseite für Motive
  js/                 ES-Module: app.js, motive.js, farben.js, klang.js, klang-worklet.js, …
  motive/             liste.js (Reihenfolge) + eine SVG-Datei pro Motiv
  klaenge/            liste.js (Reihenfolge) + eine JSON-Datei pro Klang
  sw.js               Service Worker (offline); neue JS/CSS-Dateien dort in SEITE eintragen
vorlagen/             Gerüste: motiv.svg, klang.json (bestehen die Prüfung)
werkzeuge/            pruefen.py (Prüfung per Kommandozeile), server.py (Entwicklungsserver),
                      klang.schema.json (Klangformat), klangpruefung.*, schema.js
anleitungen/          Anleitungen für Agenten
```

## Befehle

```bash
python3 werkzeuge/server.py                    # Seite auf http://127.0.0.1:8000
python3 werkzeuge/pruefen.py motiv [id|datei.svg] [--bild pfad.png]
python3 werkzeuge/pruefen.py klang [id|datei.json]
```

`pruefen.py` braucht Chromium oder Chrome (PATH oder Flatpak). Rückgabewert 0 heißt: keine Fehler. Ausgabezeilen: `<datei>: OK|HINWEIS|FEHLER <Text>`.

## Regeln für Änderungen

- Keine Abhängigkeiten, kein Build, keine CDNs. Zur Laufzeit wird nichts aus dem Internet geladen.
- Sprache in Code, Bezeichnern, Kommentaren und Texten: Deutsch.
- Kommentare als eigene Zeile oder Block über dem Code, nie am Zeilenende.
- JavaScript mit `// @ts-check` und JSDoc-Typen.
- Motive nur schwarz/weiß über Rollenklassen (`v`, `h`, `f1`–`f3`, `d1` und Linienvarianten), keine festen Farben, keine Transparenz. Farben im Farbmodus nur über `data-farbe-*` und die Palette in `site/js/farben.js`.
- Animationen: nur `transform`, langsam (Zyklen 6–20 s, Drehungen 30–60 s), kleine Ausschläge, nahtlos.
- Nach Änderungen an Motiven oder Klängen: `pruefen.py` für alle ausführen, 0 Fehler.
- Nach Änderungen an JS: Seite mit `werkzeuge/server.py` öffnen und die Browserkonsole auf Fehler prüfen.
- Veröffentlichung: Push auf `main` startet `.github/workflows/pages.yml` (erst Prüfung, dann GitHub Pages). Nur `site/` wird veröffentlicht.
- Keine persönlichen Daten, lokalen Pfade oder Zugangsdaten ins Repo schreiben.
