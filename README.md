# Kontrastbilder

Schwarz-weiße Kontrastbilder für Säuglinge (ca. 0–4 Monate), eines nach dem anderen im Vollbild, teilweise sehr langsam animiert. Statische Webseite ohne Abhängigkeiten, ohne Build-Schritt, ohne Netzwerkzugriffe zur Laufzeit.

Stand: 20 Motive, davon 14 animiert. GitHub-Pages-Deployment folgt.

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

Einstellungen (Leiste, rechter Knopf): Animation, Geschwindigkeit, invertiert, automatisch weiter (1, 3, 5 oder 10 Minuten), Sitzungs-Timer (3, 5 oder 10 Minuten), Touch-Navigation (Standard: aus, damit das Baby beim Anfassen nichts umschaltet). Einstellungen bleiben im Browser gespeichert.

Weitere Seiten:

- `druck.html`: alle Motive als Karten für A4 (1, 2, 4 oder 6 pro Seite), optional beidseitig mit invertierter Rückseite.
- `pruefen.html`: jedes Motiv normal, invertiert, in Ruhe- und Endpose, dazu automatische Prüfung der Gestaltungsregeln. Einzelnes Motiv groß: `pruefen.html?motiv=elefant`.

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
  - `f1`, `f2`, `f3` Flächen mit Farbplatz für später, derzeit wie `v`
  - `f1l`, `f2l`, `f3l` Linien mit Farbplatz, derzeit wie `vl`
- Keine Transparenz, Verläufe, Filter, Masken, Clip-Pfade, `<use>`, Text.
- Animation nur per CSS-`@keyframes` mit `transform`. Der Zustand ohne Animation ist die Ruhepose (Druck, Animation aus). Hin- und her-Bewegungen mit `alternate` und `ease-in-out`, Drehungen `linear`.
- `transform-origin` in SVG-Koordinaten angeben, z. B. `transform-origin: 200px 200px`.
- Ein animiertes Element darf kein `transform`-Attribut haben, weil die CSS-Animation es ersetzt. Bei Bedarf in eine äußere `<g transform="…">` packen.
- Details vom Motiv trennen: gleichfarbige Teile verschmelzen. Eine `hl`-Linie unter dem Teil (etwas breiter als dessen Kontur) erzeugt eine weiße Kante, siehe Ohr beim Elefant oder Stern beim Mond.

Den Rollen-Block am Anfang des `<style>` aus einer bestehenden Datei übernehmen. Er sorgt dafür, dass die Datei auch direkt im Browser oder in Inkscape richtig aussieht.

## Motive

Reihenfolge von einfachen Formen zu Tieren mit mehr Details (`liste.js`):

| Motiv | Bewegung | Farbplätze für später |
|---|---|---|
| Großer Kreis, Ringe, Wellenstreifen, Schachbrett | statisch | – |
| Herz | „atmet“ (7 % größer), 4 s hin, 4 s zurück | f1 Herz |
| Sonne | Strahlenkranz dreht sich in 48 s | f1 Sonne |
| Mond und Stern | Stern wandert in 8 s auf einem Bogen durch die offene Seite der Sichel und zurück | f1 Mond, f2 Stern |
| Gesicht | Lächeln wird breiter (6 s), blinzelt etwa alle 9 s | – |
| Blume | Blütenblätter schließen sich zur Mitte (6 s) | f1 Blätter, f2 Mitte, f3 Stängel |
| Regenwolke | drei Tropfen fallen versetzt in die Pfütze (6 s) | f1 Tropfen und Pfütze |
| Fisch | schwimmt hin und her (7 s), Schwanzflosse wedelt (3 s) | f1 Fisch |
| Qualle | schwebt auf und ab (6 s), Tentakel wiegen sich versetzt | f1 Qualle |
| Schiff | schaukelt (5 s), Wellen schwappen (6 s) | f1 Rumpf, f2 Wellen, f3 Fahne |
| Vogel | Flügel hebt und senkt sich (3,5 s) | f1 Schnabel und Beine, f3 Ast |
| Eule | blinzelt etwa alle 10 s | f1 Schnabel, f3 Ast |
| Schnecke, Pinguin | statisch | f1 Haus bzw. Schnabel und Füße |
| Elefant | Rüssel hebt sich und rollt sich ein (7 s) | – |
| Katze | Schwanz schwingt (4 s), Kopf neigt sich (7 s) | – |
| Schildkröte | Kopf zieht sich in den Panzer zurück (5 s) | f1 Panzer |

Abweichungen von der ursprünglichen Motivliste: Schnecke statt Igel und Pinguin statt Zebra, weil Stacheln und Zebrastreifen feine Details sind. Die Katze schwingt den Schwanz, statt sich zu strecken, weil Strecken mit starren Teilen mechanisch aussieht. Der Stern umrundet den Mond nicht ganz, sonst müsste er über die Sichel wandern und würde mit ihr verschmelzen.

## Vorbereitung für Farbe (noch nicht aktiv)

Alles, was später farbig werden soll (Wasser, Erdbeere, Sonne), bekommt schon jetzt eine eigene Form mit Klasse `f1`–`f3`. In einer späteren Version setzt die App dafür `--f1` bis `--f3`. Beim Invertieren tauschen dann nur Vorder- und Hintergrund, die Farben bleiben.

Offene Punkte für die Farbversion:

- Helle Farben wie Gelb haben auf Weiß kaum Helligkeitskontrast. Solche Flächen brauchen dann eine dicke dunkle Kontur oder den dunklen Hintergrund.
- Die Farbplätze fallen derzeit auf die Vordergrundfarbe zurück. Teile, die in Schwarz-Weiß weiß sind (z. B. die Katzennase) und später farbig werden sollen, brauchen dann eine zusätzliche Rolle mit Rückfall auf die Hintergrundfarbe.

## Offline und Deployment

Der Service Worker speichert Seiten, Code und alle Motive aus `liste.js` beim ersten Besuch. Er ist nur über `https` oder `localhost` aktiv. Neue JS- oder CSS-Dateien in `SEITE` in `site/sw.js` eintragen, Motive kommen automatisch dazu.

GitHub Pages: folgt in Schritt 4.
