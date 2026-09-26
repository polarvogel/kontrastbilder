# Kontrastbilder

Schwarz-weiße Kontrastbilder für Säuglinge (ca. 0–4 Monate), eines nach dem anderen im Vollbild, teilweise sehr langsam animiert. Optional mit Farbmodus (höchstens 4 Farben pro Bild). Statische Webseite ohne Abhängigkeiten, ohne Build-Schritt, ohne Netzwerkzugriffe zur Laufzeit.

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
| Invertieren | `I` | Knopf (im Farbmodus ohne Wirkung) |
| Farbmodus an/aus | `C` | Knopf mit den drei Kreisen |
| Vollbild | `F` | Knopf (auf dem iPhone nicht verfügbar, dort „Zum Home-Bildschirm“) |
| Geschwindigkeit | `+` / `−` | Einstellungen |
| Leiste einblenden | jede andere Taste | Mausbewegung, Berühren |

Einstellungen (Leiste, rechter Knopf): Animation, Geschwindigkeit, invertiert, Farbe, automatisch weiter (1, 3, 5 oder 10 Minuten), Sitzungs-Timer (3, 5 oder 10 Minuten), Touch-Navigation (Standard: aus, damit das Baby beim Anfassen nichts umschaltet). Einstellungen bleiben im Browser gespeichert.

Weitere Seiten:

- `druck.html`: alle Motive als Karten für A4 (1, 2, 4 oder 6 pro Seite), schwarz-weiß, invertiert oder farbig, auch beidseitig. Voreinstellung per URL möglich, z. B. `druck.html?variante=farbe&pro-seite=6`.
- `pruefen.html`: jedes Motiv normal, invertiert, im Farbmodus, in Ruhe- und Endpose, dazu automatische Prüfung der Gestaltungsregeln. Einzelnes Motiv groß: `pruefen.html?motiv=elefant`.

## Aufbau

```
site/
  index.html, druck.html, pruefen.html
  css/            app.css, druck.css, pruefen.css
  js/             app.js (Anzeige), motive.js (Laden/Einbetten), farben.js (Palette), einstellungen.js,
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
  - `f1`, `f2`, `f3` Flächen mit Farbplatz, in Schwarz-Weiß wie `v`
  - `f1l`, `f2l`, `f3l` Linien mit Farbplatz, in Schwarz-Weiß wie `vl`
  - `d1` / `d1l` Detail mit Farbplatz, in Schwarz-Weiß wie `h` (z. B. Wangen, die nur in Farbe erscheinen)
- Keine Transparenz, Verläufe, Filter, Masken, Clip-Pfade, `<use>`, Text.
- Animation nur per CSS-`@keyframes` mit `transform`. Der Zustand ohne Animation ist die Ruhepose (Druck, Animation aus). Hin- und her-Bewegungen mit `alternate` und `ease-in-out`, Drehungen `linear`.
- `transform-origin` in SVG-Koordinaten angeben, z. B. `transform-origin: 200px 200px`.
- Ein animiertes Element darf kein `transform`-Attribut haben, weil die CSS-Animation es ersetzt. Bei Bedarf in eine äußere `<g transform="…">` packen.
- Details vom Motiv trennen: gleichfarbige Teile verschmelzen. Eine `hl`-Linie unter dem Teil (etwas breiter als dessen Kontur) erzeugt eine weiße Kante, siehe Ohr beim Elefant oder Stern beim Mond.

Den Rollen-Block am Anfang des `<style>` aus einer bestehenden Datei übernehmen. Er sorgt dafür, dass die Datei auch direkt im Browser oder in Inkscape richtig aussieht.

## Motive

Reihenfolge von einfachen Formen zu Tieren mit mehr Details (`liste.js`):

| Motiv | Bewegung | Farbmodus |
|---|---|---|
| Großer Kreis, Ringe, Wellenstreifen, Schachbrett | statisch | rot; rot/schwarz; rot/blau/grün; blau |
| Herz | „atmet“ (7 % größer), 4 s hin, 4 s zurück | rot |
| Sonne | Strahlenkranz dreht sich in 48 s | gelb auf Himmelblau, Gesicht schwarz |
| Mond und Stern | Stern wandert in 8 s auf einem Bogen durch die offene Seite der Sichel und zurück | gelb auf Nachtblau |
| Gesicht | Lächeln wird breiter (6 s), blinzelt etwa alle 9 s | rosa Wangen |
| Blume | Blütenblätter schließen sich zur Mitte (6 s) | rot, gelb, grün |
| Regenwolke | drei Tropfen fallen versetzt in die Pfütze (6 s) | blaue Tropfen und Pfütze |
| Fisch | schwimmt hin und her (7 s), Schwanzflosse wedelt (3 s) | orange im blauen Wasser |
| Qualle | schwebt auf und ab (6 s), Tentakel wiegen sich versetzt | rosa |
| Schiff | schaukelt (5 s), Wellen schwappen (6 s) | rot, blau |
| Vogel | Flügel hebt und senkt sich (3,5 s) | oranger Schnabel, brauner Ast |
| Eule | blinzelt etwa alle 10 s | gelbe Augen, oranger Schnabel |
| Schnecke, Pinguin | statisch | orange |
| Elefant | Rüssel hebt sich und rollt sich ein (7 s) | blau |
| Katze | Schwanz schwingt (4 s), Kopf neigt sich (7 s) | grüne Augen |
| Schildkröte | Kopf zieht sich in den Panzer zurück (5 s) | grüner Panzer |

Abweichungen von der ursprünglichen Motivliste: Schnecke statt Igel und Pinguin statt Zebra, weil Stacheln und Zebrastreifen feine Details sind. Die Katze schwingt den Schwanz, statt sich zu strecken, weil Strecken mit starren Teilen mechanisch aussieht. Der Stern umrundet den Mond nicht ganz, sonst müsste er über die Sichel wandern und würde mit ihr verschmelzen.

## Farbmodus

Umschalten per Knopf, Taste `C` oder in den Einstellungen. Jedes Motiv legt am SVG-Wurzelelement fest, welche Rolle welche Farbe bekommt:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"
     data-farbe-h="blau" data-farbe-f1="gelb" data-farbe-d1="schwarz">
```

- Rollen: `v`, `h`, `f1`–`f3`, `d1`. Nicht angegebene Rollen: `v` schwarz, `h` weiß, `f1`–`f3` wie `v`, `d1` wie `h`.
- Farbnamen aus der zentralen Palette in `site/js/farben.js`: schwarz, weiss, rot, orange, gelb, gruen, blau, dunkelblau, rosa, braun, lila. Neue Farben dort ergänzen.
- Höchstens 4 verschiedene Farben pro Motiv, Schwarz und Weiß zählen mit. Die Prüfseite zählt die tatsächlich benutzten Farben und meldet mehr als 4 als Fehler.
- Der Hintergrund `h` darf farbig sein (Sonne, Mond, Fisch). Die App färbt dann die ganze Seite.
- Motive ohne `data-farbe-*` bleiben im Farbmodus schwarz-weiß.
- Invertieren wirkt im Farbmodus nicht, weil jede Farbzusammenstellung für ihren Hintergrund gewählt ist.
- Beim Umschalten und beim Wechsel zwischen Motiven wird ausgeblendet, damit Farben nicht schlagartig umspringen.

Die Prüfseite gibt einen Hinweis, wenn eine Farbe sich hell/dunkel kaum vom Hintergrund abhebt (Kontrast unter 1,5, z. B. Gelb auf Weiß). Solche Flächen brauchen einen farbigen Hintergrund oder eine dunkle Kante.

## Offline und Deployment

Der Service Worker speichert Seiten, Code und alle Motive aus `liste.js` beim ersten Besuch. Er ist nur über `https` oder `localhost` aktiv. Neue JS- oder CSS-Dateien in `SEITE` in `site/sw.js` eintragen, Motive kommen automatisch dazu.

GitHub Pages: folgt in Schritt 4.
