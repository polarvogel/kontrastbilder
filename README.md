# Kontrastbilder

Schwarz-weiße Kontrastbilder für Säuglinge (ca. 0–4 Monate), eines nach dem anderen im Vollbild, teilweise sehr langsam animiert. Statische Webseite ohne Abhängigkeiten, ohne Build-Schritt, ohne Netzwerkzugriffe zur Laufzeit.

Stand: Grundgerüst mit 3 Motiven (Sonne, Elefant, großer Kreis).

## Lokal starten

Die Seite nutzt ES-Module und lädt die Motive als SVG-Dateien nach. Beides blockieren Browser beim direkten Öffnen der Datei (`file://`). Deshalb ein kleiner lokaler Server, Python ist auf Fedora/Bazzite vorhanden:

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory site
```

Dann `http://localhost:8000` öffnen. Über `localhost` funktionieren auch Bildschirm-wachhalten und der Offline-Cache.

## Bedienung

| Aktion | Tastatur | Maus / Touch |
|---|---|---|
| Weiter / zurück | Pfeil rechts / links | Knöpfe in der Leiste; mit aktivierter Touch-Navigation auch Tippen rechtes/linkes Drittel oder Wischen |
| Animation an/aus | Leertaste | Knopf |
| Invertieren | `I` | Knopf |
| Vollbild | `F` | Knopf (auf dem iPhone nicht verfügbar, dort „Zum Home-Bildschirm“) |
| Geschwindigkeit | `+` / `−` | Einstellungen |
| Leiste einblenden | jede andere Taste | Mausbewegung, Berühren |

Einstellungen (Leiste, rechter Knopf): Animation, Geschwindigkeit, invertiert, automatisch weiter, Sitzungs-Timer, Touch-Navigation (Standard: aus, damit das Baby beim Anfassen nichts umschaltet). Einstellungen bleiben im Browser gespeichert.

Weitere Seiten:

- `druck.html`: alle Motive als Karten für A4 (1, 2, 4 oder 6 pro Seite), optional beidseitig mit invertierter Rückseite.
- `pruefen.html`: jedes Motiv normal, invertiert, unscharf und in der Endpose, dazu automatische Prüfung der Gestaltungsregeln.

## Aufbau

```
site/
  index.html, druck.html, pruefen.html
  css/            app.css, druck.css, pruefen.css
  js/             app.js (Anzeige), motive.js (Laden/Einbetten), einstellungen.js,
                  wachhalten.js (Screen Wake Lock), druck.js, pruefen.js
  motive/         liste.js (Reihenfolge) und eine SVG-Datei pro Motiv
  sw.js           Service Worker (offline), manifest.webmanifest, icons/
```

Jedes Motiv wird in einen eigenen Shadow Root eingebettet. Dadurch stören sich Klassennamen und Keyframes verschiedener Motive nicht.

## Neues Motiv hinzufügen

1. SVG-Datei in `site/motive/` anlegen, am einfachsten eine bestehende kopieren (z. B. `kreis.svg`).
2. Eine Zeile in `site/motive/liste.js` ergänzen. Die Position in der Liste bestimmt die Reihenfolge. Optional `animation: false` oder `tempo: 0.8`.
3. `pruefen.html` öffnen und Befunde beheben.

Regeln für die SVG-Datei (prüft `pruefen.html` automatisch):

- `viewBox="0 0 400 400"`, erstes Element `<rect class="h" width="400" height="400"/>` als Hintergrund.
- Motiv füllt 60–75 % der Kantenlänge, auch in der Endpose der Animation.
- Farben nur über Rollenklassen, keine `fill`/`stroke`-Attribute, keine festen Farbwerte:
  - `v` Fläche in Vordergrundfarbe, `h` Fläche in Hintergrundfarbe (Aussparungen wie Augen)
  - `vl` / `hl` dicke Linie in Vorder- bzw. Hintergrundfarbe (Breite per `stroke-width`)
  - `f1`, `f2`, `f3` Farbplätze für später, derzeit wie `v`
- Keine Transparenz, Verläufe, Filter, Masken, Clip-Pfade, `<use>`, Text.
- Animation nur per CSS-`@keyframes` mit `transform`. Der Zustand ohne Animation ist die Ruhepose (Druck, Animation aus). Hin- und her-Bewegungen mit `alternate` und `ease-in-out`, Drehungen `linear`.
- `transform-origin` in SVG-Koordinaten angeben, z. B. `transform-origin: 200px 200px`.

Den Rollen-Block am Anfang des `<style>` aus einer bestehenden Datei übernehmen. Er sorgt dafür, dass die Datei auch direkt im Browser oder in Inkscape richtig aussieht.

## Vorbereitung für Farbe (noch nicht aktiv)

Alles, was später farbig werden soll (Wasser, Erdbeere, Sonne), bekommt schon jetzt eine eigene Form mit Klasse `f1`–`f3`. In einer späteren Version setzt die App dafür `--f1` bis `--f3`. Beim Invertieren tauschen dann nur Vorder- und Hintergrund, die Farben bleiben.

Offener Punkt: Helle Farben wie Gelb haben auf Weiß kaum Helligkeitskontrast. Solche Flächen brauchen dann eine dicke dunkle Kontur oder den dunklen Hintergrund.

## Offline und Deployment

Der Service Worker speichert Seiten, Code und alle Motive aus `liste.js` beim ersten Besuch. Er ist nur über `https` oder `localhost` aktiv. Neue JS- oder CSS-Dateien in `SEITE` in `site/sw.js` eintragen, Motive kommen automatisch dazu.

GitHub Pages: folgt in Schritt 4.
