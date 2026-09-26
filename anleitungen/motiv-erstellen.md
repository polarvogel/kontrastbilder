# Anleitung für KI-Agenten: neues Motiv erstellen

Diese Anleitung richtet sich an ein Sprachmodell mit Dateizugriff und Shell. Arbeite die Schritte der Reihe nach ab. Regeln mit **MUSS** oder **DARF NICHT** prüft das Werkzeug und meldet Verstöße als `FEHLER`. Regeln mit **SOLL** prüft niemand automatisch, sie entscheiden über die Qualität.

## Auftrag

- Ergebnis: genau eine neue Datei `site/motive/<id>.svg` und genau eine neue Zeile in `site/motive/liste.js`.
- `<id>`: Kleinbuchstaben a–z, Ziffern, Bindestrich. Umlaute ausschreiben (`schildkroete`). Die id ist der Dateiname ohne `.svg`.
- Keine anderen Dateien ändern. Kein Build, keine Abhängigkeiten, keine Bilder aus dem Netz.

## Kontext

Die Seite zeigt Säuglingen (0–4 Monate) ein Motiv nach dem anderen bildschirmfüllend. Neugeborene sehen unscharf und kaum Farben. Sie reagieren auf große Flächen, starke Hell-Dunkel-Kanten und gesichtsähnliche Anordnungen. Ein Teil der Motive bewegt sich sehr langsam, das ahmt das langsame Bewegen einer Karte nach. Jedes Motiv erscheint schwarz auf weiß, invertiert (weiß auf schwarz) und optional im Farbmodus. Die App färbt über CSS-Variablen um, deshalb sind im SVG keine Farben fest eingetragen, sondern Rollen.

## Vorgehen

1. Lies `vorlagen/motiv.svg` (Gerüst, besteht die Prüfung) und diese Beispiele:
   - `site/motive/elefant.svg`: Aussparungen, weiße Trennkante am Ohr, verschachtelte Animation, Verkleinern per Gruppe
   - `site/motive/sonne.svg`: Drehung, Wiederholung per `rotate`, Farbmodus mit farbigem Hintergrund
   - `site/motive/wolke.svg`: Endlos-Ablauf, dessen Neustart hinter Flächen verborgen ist
2. Plane auf dem Raster 400 × 400 (Mitte 200/200). Schreibe dir vor dem Zeichnen eine kurze Liste: Hauptform mit Koordinaten, Teile, Details, was sich bewegt.
3. Kopiere die Vorlage nach `site/motive/<id>.svg` und zeichne das Motiv.
4. Prüfe den Entwurf (die Datei steht noch nicht in der Liste):
   ```bash
   python3 werkzeuge/pruefen.py motiv <id>.svg --bild .claude/work/<id>.png
   ```
   Wenn du Bilder ansehen kannst: Öffne das PNG. Es zeigt normal, invertiert, Farbmodus, Ruhepose und Endpose. Beurteile es mit der Checkliste unten.
5. Behebe alle `FEHLER` und prüfe erneut, bis 0 Fehler gemeldet werden. Ein `HINWEIS` darf bleiben, wenn du ihn begründen kannst.
6. Trage die Zeile in `site/motive/liste.js` ein: `{ datei: "<id>.svg", name: "<Anzeigename>" },`. Die Position bestimmt die Reihenfolge: einfache Formen vorn, Tiere mit Details hinten.
7. Abschlussprüfung mit der id, danach muss die Ausgabe `0 Fehler` enthalten und der Rückgabewert 0 sein:
   ```bash
   python3 werkzeuge/pruefen.py motiv <id>
   ```
8. Berichte kurz: Datei, was sich wie bewegt (Dauer), Farben im Farbmodus, letzte Zeile der Prüfausgabe.

Ohne Chromium oder Chrome funktioniert die Prüfung nicht. Dann `site/pruefen.html?datei=<id>.svg` über `python3 werkzeuge/server.py` im Browser öffnen lassen und das Ergebnis vom Menschen erfragen.

## Datei (MUSS)

1. Wurzelelement genau so, ohne `width` und `height`: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">`, optional mit `data-farbe-*` (siehe Farbmodus).
2. Den Rollen-Block am Anfang des `<style>` unverändert aus der Vorlage übernehmen.
3. Erstes Element nach `</style>`: `<rect class="h" width="400" height="400"/>` (Hintergrund).
4. Jede Form (`rect`, `circle`, `ellipse`, `path`, `polygon`, `polyline`, `line`) hat eine Rollenklasse, direkt oder über eine umgebende `<g>`.
5. **DARF NICHT** vorkommen:
   - Attribute `fill`, `stroke`, `style`, `opacity`, `fill-opacity`, `stroke-opacity`, `filter`, `mask`, `clip-path`
   - Elemente `linearGradient`, `radialGradient`, `pattern`, `filter`, `mask`, `clipPath`, `image`, `foreignObject`, `use`, `script`, `text`
   - `url(...)`, `opacity`, `filter:` oder Verläufe im CSS
   - feste Farbwerte im CSS, außer den `#000`/`#fff`-Rückfällen im Rollen-Block
6. Erlaubt sind Geometrie-Attribute (`cx`, `r`, `d`, `rx`, `points` …), `stroke-width`, `transform` (nicht an animierten Elementen, siehe unten) und eigene Klassennamen für die Animation.

## Rollen

| Klasse | Wirkung | Schwarz-Weiß | Farbmodus |
|---|---|---|---|
| `v` | Fläche Vordergrund | schwarz (invertiert weiß) | `data-farbe-v` oder schwarz |
| `h` | Fläche Hintergrund, Aussparung | weiß (invertiert schwarz) | `data-farbe-h` oder weiß |
| `f1` `f2` `f3` | Fläche mit Farbplatz | wie `v` | `data-farbe-f1` … |
| `d1` | Detail mit Farbplatz | wie `h` (unsichtbar auf Hintergrund) | `data-farbe-d1` |
| `vl` `hl` `f1l` `f2l` `f3l` `d1l` | dieselben Rollen als Linie, Breite per `stroke-width`, runde Enden | | |

## Gestaltung

- **MUSS**: Größte Ausdehnung 60–75 % der Kantenlänge (240–300 Einheiten), in der Ruhepose **und** in der Endpose der Animation. Nichts ragt über 0–400 hinaus. Die Prüfung misst das.
- **SOLL**: ein einziges Motiv, zentriert, als Silhouette aus großen geschlossenen Flächen. Denk an Scherenschnitt, nicht an Strichzeichnung.
- **SOLL**: wenige Details, keine feinen Linien. Linien mindestens `stroke-width="8"`, Konturen der Hauptform eher 12–40. Einzige Ausnahme sind Glanzpunkte im Auge (r ≥ 3,5).
- **SOLL**: Details als Aussparung in Hintergrundfarbe (`h`, `hl`) auf der Vordergrundfläche. Bewährtes Auge: `h`-Kreis r 14–17, darin `v`-Pupille r 8–10, darin `h`-Glanzpunkt r 3,5 oben links.
- **SOLL**: Gesichter und kleine witzige Details (Locke, Lächeln, Wangen) sind erwünscht. Aber: zwei Punkte und ein Bogen ergeben immer ein Gesicht. Muster auf Bauch oder Panzer so anordnen, dass kein ungewolltes zweites Gesicht entsteht (bei der Eule passiert: drei Federbögen wurden zu Augen und Mund).
- **SOLL**: Gleichfarbige Teile verschmelzen zu einer Fläche. Muss ein Teil vor einem gleichfarbigen Teil erkennbar bleiben (Ohr vor Kopf, Stern vor Mond, Schnabel auf Körper), zuerst dieselbe Form als `hl`-Linie mit `stroke-width` 9–18 zeichnen, danach die Fläche. Die weiße Kante trennt beide.
- **SOLL**: Die Ruhepose (Zustand ohne Animation) ist allein ein vollständiges, gutes Bild. Sie wird gedruckt und bei ausgeschalteter Animation gezeigt.
- **SOLL**: Auch stark verkleinert (Daumennagel) als Form erkennbar sein.

Koordinaten-Hilfen:

- Nutzfläche etwa 60–340 in beiden Richtungen.
- Wo möglich `circle`, `ellipse` und `rect` mit `rx` statt freier Pfade. Freie Formen mit `Q`/`C`-Kurven.
- Spiegeln an der Mitte: `x' = 400 − x`.
- Wiederholung im Kreis: gleiche Form mehrfach mit `transform="rotate(<k·360/n> 200 200)"` (siehe `sonne.svg`).
- Größe nachträglich anpassen: alles in `<g transform="translate(200 200) scale(0.85) translate(-cx -cy)">` packen, mit cx/cy als bisherigem Mittelpunkt (siehe `elefant.svg`). Animationen darin bleiben korrekt.
- Die Prüfung misst Linien inklusive halber Strichbreite.

## Animation

Etwa die Hälfte der Motive bewegt sich. Keine Pflicht.

- **MUSS**: nur CSS-`@keyframes`, darin nur `transform` (und optional `animation-timing-function`). Keine `opacity`, keine Farbwechsel.
- **SOLL**: Hin und her: `animation: name 5s ease-in-out infinite alternate;` mit nur einem `to { transform: … }` oder mit `from`/`to`. Nahtlos, weil `alternate` zurückläuft.
- **SOLL**: Drehung: `animation: name 48s linear infinite;` mit `to { transform: rotate(360deg); }`, 30–60 s pro Umdrehung.
- **SOLL**: langsam. Ein Zyklus dauert 6–20 s, bei `alternate` also 3–10 s je Richtung.
- **SOLL**: kleine Ausschläge. Drehung höchstens etwa 30°, Verschiebung höchstens etwa 20 Einheiten, Skalierung höchstens etwa 1,08. Nur ein Teil bewegt sich, das Motiv bleibt am Platz.
- **SOLL**: kein Blinken, kein schneller Hell-Dunkel-Wechsel großer Flächen. Blinzeln (`scaleY` der Augen auf 0,1) höchstens alle 8–10 s, siehe `eule.svg`.
- **MUSS**: `transform-origin` in SVG-Koordinaten mit `px` angeben, z. B. `transform-origin: 96px 196px;`. Er bezieht sich auf die Koordinaten der umgebenden Gruppe, auch in verschachtelten oder skalierten Gruppen.
- **MUSS**: Ein animiertes Element hat kein `transform`-Attribut, die CSS-Animation würde es ersetzen. Positionieren über eine äußere `<g transform="…">`, animieren an der inneren `<g class="…">`.
- **SOLL**: Endlos-Abläufe, die neu beginnen (Tropfen fallen), nur wenn Anfang und Ende hinter einer Fläche verborgen sind. Tropfen zuerst zeichnen, Wolke und Pfütze danach. Mehrere gleiche Teile mit negativer `animation-delay` versetzen. Eine statische `transform`-Regel an derselben Klasse legt die Ruhepose fest (siehe `wolke.svg`).
- **SOLL**: Die Endpose (größte Auslenkung) sieht ebenfalls gut aus. Sie steht im Prüfbild ganz rechts.

## Farbmodus

Optional, aber erwünscht.

- Farben am Wurzelelement: `data-farbe-<rolle>="<name>"`. Rollen: `v`, `h`, `f1`, `f2`, `f3`, `d1`.
- Farbnamen: `schwarz`, `weiss`, `rot`, `orange`, `gelb`, `gruen`, `blau`, `dunkelblau`, `rosa`, `braun`, `lila`. Andere Namen sind `FEHLER`.
- **MUSS**: höchstens 4 verschiedene Farben pro Motiv, Schwarz und Weiß zählen mit. Gezählt werden nur Rollen, die im SVG vorkommen.
- Was farbig werden soll, braucht eine eigene Form mit `f1`–`f3` (in Schwarz-Weiß wie `v`) oder `d1` (in Schwarz-Weiß wie `h`, also z. B. Wangen, die nur in Farbe sichtbar sind).
- Helle Farben (`gelb`, `orange`) nicht auf Weiß setzen, die Prüfung meldet zu geringen Kontrast als `HINWEIS`. Besser einen farbigen Hintergrund setzen (`data-farbe-h="blau"` bei der Sonne) oder eine dunkle Kante.
- Invertieren wirkt im Farbmodus nicht. Die Farben müssen also für ihren eigenen Hintergrund gewählt sein.

## Checkliste vor dem Abschluss

- [ ] `python3 werkzeuge/pruefen.py motiv <id>` meldet 0 Fehler.
- [ ] Ruhepose allein ist ein vollständiges Bild.
- [ ] Keine ungewollten Gesichter oder Formen, keine feinen Linien.
- [ ] Teile, die sich überlappen und gleichfarbig sind, sind durch weiße Kanten getrennt, wo sie erkennbar bleiben müssen.
- [ ] Bewegung langsam, klein, nur ein Teil. Endpose sieht gut aus.
- [ ] Invertiert und im Farbmodus stimmig. Höchstens 4 Farben.
- [ ] Zeile in `site/motive/liste.js`, sonst keine Datei geändert.
