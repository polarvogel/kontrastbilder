# Kontrastbilder

Schwarz-weiße Kontrastbilder für Säuglinge (ca. 0–4 Monate), eines nach dem anderen im Vollbild, teilweise sehr langsam animiert. Optional mit Farbmodus (höchstens 4 Farben pro Bild) und live erzeugten Klängen (Rauschen, Meer, Regen, Herzschlag, Xylophon), die sich beliebig mischen lassen. Statische Webseite ohne Abhängigkeiten, ohne Build-Schritt, ohne Netzwerkzugriffe zur Laufzeit. Alle Texte sind übersetzbar, derzeit gibt es Deutsch.

Privates Forschungsprojekt, frei unter [CC0 1.0](LICENSE): Jeder darf alles damit machen.

Stand: 20 Motive (14 animiert), 5 Klänge, Sprache Deutsch.

## Lokal testen

### Am Rechner

Im Projektordner:

```bash
python3 werkzeuge/server.py
```

Dann `http://localhost:8000` im Browser öffnen, beenden mit Strg+C. Der Server sendet `no-store`, der Browser zeigt nach Änderungen also nie alte Dateien. `python3 -m http.server 8000 --directory site` geht auch, dann nach Änderungen aber im Browser hart neu laden (Strg+Shift+R).

Direkt als Datei öffnen (`file://`) geht nicht: ES-Module und das Nachladen der Motive blockieren alle Browser dort. Die Seite zeigt dann einen Hinweis.

Über `localhost` funktionieren auch Bildschirm-wachhalten, Offline-Cache und Klänge. Klänge brauchen einen „sicheren Kontext“ (https oder localhost), weil das AudioWorklet nur dort verfügbar ist.

### Auf iPhone, iPad oder Android

Über das Heimnetz (`python3 werkzeuge/server.py --bind 0.0.0.0`, dann `http://<IP des Rechners>:8000`) lädt die Seite. Motive und Bedienung lassen sich so testen, **Klänge, Bildschirm-wachhalten und Offline-Betrieb aber nicht**: Eine Adresse wie `http://192.168.…` ist kein sicherer Kontext. Die Firewall des Rechners muss den Port außerdem freigeben.

Für einen vollständigen Test auf dem Handy braucht es https. Der saubere Weg ist GitHub Pages (siehe unten). Andere Wege (Tunnel-Dienste, eigene Zertifikate) sind aufwendiger oder schicken den Verkehr über fremde Server.

## Bedienung

| Aktion | Tastatur | Maus / Touch |
|---|---|---|
| Weiter / zurück | Pfeil rechts / links | Knöpfe in der Leiste; mit aktivierter Touch-Navigation auch Tippen rechtes/linkes Drittel oder Wischen |
| Animation an/aus | Leertaste | Knopf |
| Invertieren | `I` | Knopf (im Farbmodus ohne Wirkung) |
| Farbmodus an/aus | `C` | Knopf mit den drei Kreisen |
| Klang an/aus | `T` | Lautsprecher-Knopf; Auswahl und Lautstärke in den Einstellungen |
| Vollbild | `F` | Knopf (auf dem iPhone nicht verfügbar, dort „Zum Home-Bildschirm“) |
| Geschwindigkeit | `+` / `−` | Einstellungen |
| Leiste einblenden | jede andere Taste | Mausbewegung, Berühren |

Einstellungen (Leiste, rechter Knopf): Animation, Geschwindigkeit, invertiert, Farbe, Klänge (mehrere gleichzeitig anhaken, Anteil je Klang, Gesamtlautstärke), automatisch weiter (1, 3, 5 oder 10 Minuten), Sitzungs-Timer (3, 5 oder 10 Minuten), Touch-Navigation (Standard: aus, damit das Baby beim Anfassen nichts umschaltet). Einstellungen bleiben im Browser gespeichert.

Weitere Seiten:

- `druck.html`: alle Motive als Karten für A4 (1, 2, 4 oder 6 pro Seite), schwarz-weiß, invertiert oder farbig, auch beidseitig. Voreinstellung per URL möglich, z. B. `druck.html?variante=farbe&pro-seite=6`.
- `pruefen.html`: jedes Motiv normal, invertiert, im Farbmodus, in Ruhe- und Endpose, dazu automatische Prüfung der Gestaltungsregeln. Einzelnes Motiv groß: `pruefen.html?motiv=elefant`.

## Aufbau

```
site/
  index.html, druck.html, pruefen.html, hinweise.html (Datenschutz, Projekt)
  css/            app.css, druck.css, pruefen.css
  js/             app.js (Anzeige), motive.js (Laden/Einbetten), farben.js (Palette), einstellungen.js,
                  klang.js (Klangerzeuger), klang-worklet.js (Erzeugung im Audio-Thread),
                  wachhalten.js (Screen Wake Lock), sprache.js (Übersetzung), druck.js, pruefen.js,
                  hinweise.js
  motive/         liste.js (Reihenfolge) und eine SVG-Datei pro Motiv
  klaenge/        liste.js (Reihenfolge) und eine JSON-Datei pro Klang
  sprachen/       liste.js (verfügbare Sprachen) und eine JSON-Datei pro Sprache (de.json)
  sw.js           Service Worker (offline), manifest.webmanifest, icons/
```

Jedes Motiv wird in einen eigenen Shadow Root eingebettet. Dadurch stören sich Klassennamen und Keyframes verschiedener Motive nicht.

## Neues Motiv hinzufügen

1. SVG-Datei in `site/motive/` anlegen, am einfachsten eine bestehende kopieren (z. B. `kreis.svg`).
2. Eine Zeile in `site/motive/liste.js` ergänzen. Die Position in der Liste bestimmt die Reihenfolge. Optional `animation: false` oder `tempo: 0.8`.
3. Den Anzeigenamen in `site/sprachen/de.json` unter `motive` eintragen, Schlüssel ist der Dateiname ohne `.svg`.
4. `python3 werkzeuge/pruefen.py motiv <id>` ausführen oder `pruefen.html` öffnen und Befunde beheben.

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

## Klänge

Alle Klänge entstehen live im Gerät mit der Web Audio API, es gibt keine Audiodateien. Dauerrauschen und Ereignisse (Töne, Rauschstöße) entstehen Probe für Probe im AudioWorklet (`js/klang-worklet.js`), also im Audio-Thread. Dadurch läuft der Klang weiter, auch wenn der Browser im Hintergrund oder bei gesperrtem Bildschirm Timer anhält. `js/klang.js` baut aus der JSON-Beschreibung den Graphen mit Filtern und langsamen Schwankungen.

- Mischpult: Jeder Klang lässt sich einzeln anhaken, mehrere laufen gleichzeitig (z. B. Regen + Herzschlag + Xylophon). Der Regler neben jedem Klang bestimmt seinen Anteil. Damit die Summe nicht lauter wird, sinkt der Gesamtpegel mit 1/√Anzahl. Anhaken schaltet den Klang ein, Abhaken des letzten aus. Die Taste `T` und der Lautsprecher-Knopf schalten alle gewählten Klänge an oder aus.
- Ton startet erst nach der ersten Bedienung (Tippen, Taste), das verlangen alle Browser. War der Klang beim letzten Mal an, beginnt er bei der ersten Berührung.
- Ein- und Ausblenden dauern 1–2 s, beim Wechsel wird übergeblendet. Ein Begrenzer im Ausgang verhindert Übersteuern.
- Der Klang läuft nach dem Sitzungs-Timer weiter (zum Einschlafen).
- Hintergrund und Sperrbildschirm: Die Seite meldet sich als Medienwiedergabe (`navigator.audioSession.type = "playback"`, Safari ab 16.4, im Hintergrund ab iOS 17.5), startet dazu ein stilles Audio-Element in Schleife und setzt Titel und Play/Pause für den Sperrbildschirm (Media Session API). Nach Unterbrechungen wie Anrufen wird fortgesetzt, sobald das System es erlaubt. Auf echten Geräten noch nicht getestet.
- Kleine Handylautsprecher geben den tiefen Herzschlag nur leise wieder.

### Neuer Klang

JSON-Datei in `site/klaenge/` anlegen, eine Zeile in `site/klaenge/liste.js` ergänzen und den Anzeigenamen in `site/sprachen/de.json` unter `klaenge` eintragen. Beispiel `xylophon.json`, ein ausklingender Ton pro Sekunde (±250 ms):

```json
{
  "schichten": [
    {
      "ereignisse": { "abstand": 1, "streuung": 0.25 },
      "pegel": 0.6,
      "panorama": 0.3,
      "stimme": {
        "art": "ton",
        "noten": [67, 69, 72, 74, 76, 79, 81, 84],
        "anschlag": 0.003,
        "teiltoene": [[1, 1, 1.6], [3, 0.18, 0.45], [6.2, 0.05, 0.15]]
      }
    }
  ]
}
```

Ein Klang besteht aus Schichten. Jede Schicht ist Dauerrauschen oder eine Folge von Ereignissen.

| Feld | Bedeutung |
|---|---|
| `rauschen` | Dauerrauschen: `weiss`, `rosa` (weicher) oder `braun` (dumpf) |
| `ereignisse` | `{ "abstand": s, "streuung": s }` gleichmäßig mit Zufallsabweichung, oder `{ "dichte": n }` zufällig mit n Ereignissen pro Sekunde |
| `pegel` | Lautstärke der Schicht, 0 bis 1 |
| `filter` | Liste fester Filter: `{ "typ": "tiefpass" \| "hochpass" \| "bandpass", "frequenz": Hz, "guete": 0.7 }` |
| `wellen` | Langsame Schwankungen: `{ "ziel": "pegel" \| "filter", "periode": s, "tiefe": 0–1, "form": "sinus" \| "zufall", "versatz": 0–1 }`. `filter` wirkt auf den ersten Filter der Schicht |
| `muster` | Mehrere Anschläge pro Ereignis: `[[Versatz s, Pegel, Tonhöhenfaktor], …]`, z. B. Herzschlag „ba-dum“ |
| `pegelstreuung` | Zufällig leisere Ereignisse, 0 bis 1 |
| `panorama` | Zufällige Stereoposition je Ereignis, 0 (Mitte) bis 1 (ganz außen) |
| `stimme` | Was ein Ereignis spielt, siehe unten |

Stimme `"art": "ton"`: Sinus-Teiltöne. `noten` (MIDI-Nummern, 60 = c', zufällig, nie zweimal dieselbe hintereinander) oder `frequenz` (Hz, fest oder Bereich `[min, max]`). `teiltoene`: `[Verhältnis zum Grundton, Pegel, Nachklang in s]`. `anschlag`: Einschwingzeit. `gleiten`: `[Startfaktor, Dauer]`, Tonhöhe rutscht vom Vielfachen auf den Zielton.

Stimme `"art": "rauschen"`: kurzer Rauschstoß mit eigenen `filter` (Frequenz auch als Bereich, dann zufällig je Stoß), `anschlag` und `nachklang` in s.

Die Pegel der vorhandenen Klänge sind so eingestellt, dass alle etwa gleich laut sind (rund −20 dB Effektivwert, Spitzen unter −3 dB). Neue Klänge danach ausrichten.

## Sprachen

Alle sichtbaren Texte stehen in `site/sprachen/<code>.json`, auch die Namen der Motive und Klänge. `site/js/sprache.js` lädt die Sprache (gespeicherte Wahl, sonst Browsersprache, sonst Deutsch) und setzt die Texte in Elemente mit `data-i18n="schluessel"` bzw. Attribute mit `data-i18n-attr="title=schluessel"`. Im HTML stehen deutsche Texte nur als Rückfall ohne JavaScript. Fehlende Texte einer Sprache fallen auf Deutsch zurück.

Neue Sprache:

1. `site/sprachen/de.json` nach `site/sprachen/<code>.json` kopieren (z. B. `en.json`) und alle Werte übersetzen, die Schlüssel bleiben. Platzhalter wie `{name}` unverändert lassen.
2. In `site/sprachen/liste.js` eine Zeile ergänzen, z. B. `{ code: "en", name: "English" }`. Der Offline-Cache übernimmt die Datei automatisch.

Ab zwei Sprachen erscheint in den Einstellungen eine Auswahl. Prüfseite, Werkzeuge und Anleitungen bleiben Deutsch.

## Werkzeuge und Anleitungen für KI-Agenten

- `AGENTS.md`: Einstieg für KI-Agenten (Codex, Copilot, Cursor, Gemini CLI u. a.). `CLAUDE.md` verweist für Claude Code darauf.
- `anleitungen/motiv-erstellen.md`, `anleitungen/klang-erstellen.md`: Schritt-für-Schritt-Anleitungen für eine andere KI, mit harten Regeln, Rezepten, typischen Fehlern und Checkliste.
- `vorlagen/`: Gerüste für ein neues Motiv und einen neuen Klang, beide bestehen die Prüfung.
- `werkzeuge/pruefen.py`: prüft Motive oder Klänge von der Kommandozeile (Chromium ohne Fenster, gesteuert über das DevTools-Protokoll, nur Python-Standardbibliothek). Beispiel: `python3 werkzeuge/pruefen.py motiv elefant --bild /tmp/elefant.png`.
- `werkzeuge/klang.schema.json`: JSON Schema des Klangformats. Editoren wie VS Code prüfen damit beim Schreiben, wenn eine Klangdatei `"$schema": "../../werkzeuge/klang.schema.json"` enthält.

## Offline und Deployment

Der Service Worker speichert Seiten, Code und alle Motive aus `liste.js` beim ersten Besuch. Er ist nur über `https` oder `localhost` aktiv. Neue JS- oder CSS-Dateien in `SEITE` in `site/sw.js` eintragen, Motive, Klänge und Sprachen kommen automatisch dazu.

### GitHub Pages

Der Workflow `.github/workflows/pages.yml` prüft bei jedem Push auf `main` alle Motive und Klänge (`werkzeuge/pruefen.py` mit Chrome auf dem Runner) und veröffentlicht danach den Ordner `site/`. Bei Pull Requests wird nur geprüft.

Einmalig einrichten (Repo-Name hier `kontrastbilder`):

```bash
gh auth login
```

```bash
gh repo create kontrastbilder --public --source . --remote origin
```

```bash
gh api -X POST repos/{owner}/kontrastbilder/pages -f build_type=workflow
```

```bash
git push -u origin main
```

Alternativ zum dritten Befehl: im Repo unter Settings → Pages bei „Source“ „GitHub Actions“ wählen. Die Seite liegt danach unter `https://<benutzername>.github.io/kontrastbilder/`. Alle Pfade in der Seite sind relativ, der Unterpfad funktioniert.

Weiterarbeiten: ändern, `python3 werkzeuge/pruefen.py motiv` bzw. `klang` ausführen, committen, pushen. Die Veröffentlichung läuft automatisch. Auf einem anderen Rechner: `gh repo clone <benutzername>/kontrastbilder`. Der Ordner `.claude/` (lokale Sitzungsnotizen) ist per `.gitignore` ausgeschlossen.

Mit GitHub Free geht Pages nur aus öffentlichen Repos. Die Seite selbst ist bei GitHub Pages immer öffentlich.

## Lizenz, Datenschutz, Herkunft

- **Lizenz:** [CC0 1.0 Universal](LICENSE). Der Urheber verzichtet auf alle Rechte, soweit das möglich ist. Jeder darf Code, Motive, Klänge, Anleitungen und Werkzeuge ohne Namensnennung und ohne Einschränkung nutzen, ändern und weitergeben, auch kommerziell. Beiträge zu diesem Repository stehen ebenfalls unter CC0.
- **Datenschutz:** Die Seite selbst erhebt nichts, lädt nichts von Dritten und setzt keine Cookies. Einstellungen und Offline-Cache bleiben im Gerät. GitHub Pages protokolliert beim Aufruf die IP-Adresse. Einzelheiten stehen in `site/hinweise.html`.
- **Herkunft:** Motive, Klänge, Icons und Code sind für dieses Projekt neu erstellt, es gibt keine fremden Bibliotheken, Schriften oder Bilder. Der Rosa-Rausch-Filter (Paul Kellet) und die Filterformeln (Audio EQ Cookbook) sind veröffentlichte mathematische Verfahren, die Quelle steht jeweils im Code.
- **Nicht ins Repo:** persönliche Daten, lokale Pfade, Zugangsdaten.
