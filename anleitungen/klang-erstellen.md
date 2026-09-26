# Anleitung für KI-Agenten: neuen Klang erstellen

Diese Anleitung richtet sich an ein Sprachmodell mit Dateizugriff und Shell. Arbeite die Schritte der Reihe nach ab. Regeln mit **MUSS** oder **DARF NICHT** prüft das Werkzeug und meldet Verstöße als `FEHLER`. Regeln mit **SOLL** prüft niemand automatisch, sie entscheiden über die Qualität.

## Auftrag

- Ergebnis: genau eine neue Datei `site/klaenge/<id>.json`, genau eine neue Zeile in `site/klaenge/liste.js` und genau ein neuer Eintrag in `site/sprachen/de.json` unter `klaenge` (Anzeigename).
- `<id>`: Kleinbuchstaben a–z, Ziffern, Bindestrich. Umlaute ausschreiben (`waesserchen`).
- Keine anderen Dateien ändern. Die Klangerzeugung (`site/js/klang.js`, `site/js/klang-worklet.js`) nicht anfassen. Kann das Format einen Klang nicht ausdrücken, sag das, statt Code zu ändern.

## Kontext

Die Seite spielt Säuglingen beruhigende Klänge: Rauschen, Naturklänge, einzelne langsame Töne. Nutzer können mehrere Klänge gleichzeitig anhaken und mischen (z. B. Regen + Herzschlag + Xylophon). Ein Klang soll deshalb für sich stehen und gut mit anderen zusammenpassen: ein Instrument enthält kein Rauschbett, ein Naturklang keine Melodie. Nichts ist aufgenommen, jede JSON-Datei beschreibt, wie der Klang live erzeugt wird. Du kannst das Ergebnis nicht hören. Verlass dich deshalb auf die Messung des Prüfwerkzeugs und auf die bewährten Ausgangswerte unten, und bleib im Zweifel leiser, langsamer und weicher.

## Vorgehen

1. Lies:
   - `werkzeuge/klang.schema.json`: das verbindliche Format mit allen Feldern, Grenzen und Beschreibungen
   - `vorlagen/klang.json`: das Gerüst, besteht die Prüfung
   - die vier Beispiele in `site/klaenge/`, die dem gewünschten Klang am nächsten kommen:
     - `meer.json`: Rauschen mit langsamen Wellen
     - `regen.json`: Rauschen plus zufällige Rauschstöße
     - `herzschlag.json`: Muster aus zwei Anschlägen
     - `xylophon.json`: einzelne Töne
2. Plane in Worten: welche Schichten, welche Rauschfarbe und Filter, welche Ereignisse mit welchem Abstand, wie hell oder dunkel.
3. Schreibe `site/klaenge/<id>.json`.
4. Prüfe den Entwurf (die Datei steht noch nicht in der Liste):
   ```bash
   python3 werkzeuge/pruefen.py klang <id>.json
   ```
5. Behebe alle `FEHLER`. Folge Pegel-Hinweisen: Das Werkzeug nennt einen Faktor, mit dem du alle `pegel` multiplizierst. Prüfe erneut, bis 0 Fehler und keine Pegel-Hinweise mehr kommen.
6. Trage die Zeile in `site/klaenge/liste.js` ein: `{ datei: "<id>.json" },`. Trage den Anzeigenamen in `site/sprachen/de.json` im Objekt `klaenge` ein: `"<id>": "<Anzeigename>"`, in weiteren Sprachdateien übersetzt.
7. Abschlussprüfung, sie muss `0 Fehler` melden und den Rückgabewert 0 liefern:
   ```bash
   python3 werkzeuge/pruefen.py klang <id>
   ```
8. Berichte kurz:
   - Datei
   - Aufbau in einem Satz
   - gemessener Effektivwert und Spitze
   - bei Ereignissen die gemessenen Abstände
   - dass der Klang noch von einem Menschen angehört werden muss

## Format in Kürze

Verbindlich ist das Schema. Ein Klang ist `{ "schichten": [ … ] }` mit 1 bis 6 Schichten. Jede Schicht ist genau eins von beiden:

- **Dauerrauschen**: `"rauschen": "weiss" | "rosa" | "braun"`. Weiß ist hell und zischend, rosa weicher, braun dumpf wie fernes Meer.
- **Ereignisse**: `"ereignisse": { "abstand": s, "streuung": s }` für gleichmäßige Abstände mit Zufallsabweichung ± streuung, oder `{ "dichte": n }` für n zufällige Ereignisse pro Sekunde. Dazu `"stimme"`, was ein Ereignis spielt:
  - `"art": "ton"`: Sinus-Teiltöne.
    - Tonhöhe über `noten` (MIDI, zufällig gewählt, nie zweimal dieselbe hintereinander) oder `frequenz` (Hz, fest oder `[min, max]`).
    - `teiltoene`: Liste von `[Verhältnis zum Grundton, Pegel 0–1, Nachklang in s bis -60 dB]`.
    - `anschlag`: Einschwingzeit in s.
    - `gleiten`: `[Startfaktor, Dauer]`, die Tonhöhe rutscht vom Vielfachen zum Zielton.
  - `"art": "rauschen"`: kurzer Rauschstoß.
    - `filter`: eigene Filter, `frequenz` auch als `[min, max]`, dann je Stoß zufällig.
    - `anschlag`, `nachklang` in s.

Für jede Schicht gibt es außerdem:

- `pegel`: 0–1, Pflicht.
- `filter`: bis zu 3 feste Filter, `tiefpass` | `hochpass` | `bandpass` mit `frequenz` und `guete`.
- `wellen`: langsame Schwankungen von `pegel` oder `filter` (Frequenz des ersten Filters der Schicht). `form` ist `sinus` oder `zufall`, dazu `periode` ≥ 2 s, `tiefe` 0–1 und `versatz` (Phase 0–1).
- Nur bei Ereignissen:
  - `muster`: mehrere Anschläge je Ereignis, `[Versatz s, Pegel, Tonhöhenfaktor]`
  - `pegelstreuung`: zufällig leisere Ereignisse, 0–1
  - `panorama`: zufällige Stereoposition, 0 Mitte bis 1 ganz außen

## Regeln

- **MUSS**: gültig gegen `werkzeuge/klang.schema.json`. Unbekannte Felder sind Fehler.
- **MUSS**: `stimme.filter` nur bei `art: "rauschen"`. Für Töne einen Filter an die Schicht hängen.
- **MUSS**: `streuung` kleiner als `abstand`.
- **MUSS**: Spitzen unter -1 dB. **SOLL**: unter -3 dB, Effektivwert -20 dB ± 4, damit alle Klänge gleich laut sind.
- **SOLL**: beruhigend und gleichmäßig. Keine plötzlich lauten Ereignisse, keine Knalle, kein Zischen über 8 kHz als Hauptanteil.
- **SOLL**: Töne langsam. Mindestens 0,5 s Abstand, besser 1 s oder mehr. Nie mehrere Töne gleichzeitig (keine Akkorde): Ein `muster` mit Tönen nur für kurz nacheinander folgende Anschläge wie „ba-dum“.
- **SOLL**: Tonhöhen aus einer Pentatonik, dann klingt nichts schief, auch wenn Töne ausklingend überlappen. C-Dur-pentatonisch in MIDI: 60 62 64 67 69 72 74 76 79 81 84. Gut geeigneter Bereich 60–84. Über 88 wird es spitz.
- **SOLL**: Schwankungen (`wellen`) langsam, `periode` 5–20 s. Mehrere Wellen mit ungeraden Verhältnissen (z. B. 11 s und 17 s) klingen natürlicher als eine.
- **SOLL**: kleine Handylautsprecher geben unter etwa 150 Hz kaum etwas wieder. Tiefe Töne mit Obertönen (`teiltoene` mit Verhältnis 2, 3, 4) ergänzen, sonst sind sie am Handy stumm.
- **SOLL**: Filtergüte (`guete`) bei `tiefpass`/`hochpass` 0,5–1. Hohe Werte pfeifen. Bei `bandpass` 0,7–4.

## Bewährte Ausgangswerte

Alle Werte hier sind mit dem Prüfwerkzeug gemessen und liegen im Zielbereich. Klanglich sind sie ungeprüft, anhören muss ein Mensch.

| Klang | Aufbau |
|---|---|
| Weißes Rauschen | `rauschen: weiss`, `pegel` 0,33 |
| Rosa oder braunes Rauschen allein | `pegel` etwa 0,33. Die Farben sind auf gleichen Effektivwert abgeglichen. Filter nehmen Energie weg, dann `pegel` erhöhen. |
| Meer | siehe `meer.json`: braun, Tiefpass 700 Hz, Pegelwelle 11 s Tiefe 0,6, Filterwelle 11 s; dazu rosa über Hochpass 1800 Hz als Gischt |
| Wind | rosa, `pegel` 0,8, `bandpass` 500 Hz, `guete` 0,8, `wellen`: `filter` `zufall` Periode 7 Tiefe 0,6 und `pegel` `zufall` Periode 9 Tiefe 0,5 |
| Bach | weiss, `pegel` 0,4, Hochpass 700 Hz und Tiefpass 5000 Hz. Dazu Ereignisse `dichte` 6, `pegel` 0,12, `pegelstreuung` 0,8, `panorama` 0,7, Stimme `art: "ton"`, `frequenz` [900, 2200], `gleiten` [0.7, 0.04], `teiltoene` [[1, 1, 0.06]]. Der Hinweis „schneller als alle 0,5 s“ ist hier gewollt: Plätschern, keine Melodie. |
| Regen | siehe `regen.json` |
| Herzschlag | siehe `herzschlag.json`: Muster [[0, 1, 1], [0.32, 0.7, 1.12]], `abstand` 0,9 (67/min). Ruhiger 1,0 bis 1,1. |

Klangfarben für `art: "ton"` (`teiltoene`):

| Klangfarbe | teiltoene | Hinweis |
|---|---|---|
| Xylophon | `[[1, 1, 1.6], [3, 0.18, 0.45], [6.2, 0.05, 0.15]]` | `anschlag` 0,003, `pegel` 0,6 bei `abstand` 1 |
| Marimba, weicher | `[[1, 1, 1.8], [4, 0.2, 0.5], [10, 0.04, 0.15]]` | `anschlag` 0,004, `pegel` 0,6, Noten 60–76 |
| Glocke, Klangschale | `[[1, 1, 4], [2.76, 0.4, 2.5], [5.4, 0.15, 1.2]]` | klingt lang: `abstand` 4, `streuung` 1, `pegel` 0,5, Noten 60–72 |
| Spieluhr | `[[1, 1, 1.2], [4, 0.25, 0.3], [9.5, 0.06, 0.1]]` | `anschlag` 0,002, Noten 72–91, `abstand` 1,2, `pegel` 0,5–0,6 |
| Weicher Sinuston | `[[1, 1, 1.5], [2, 0.08, 0.8]]` | `anschlag` 0,05–0,1 macht ihn noch weicher |

MIDI-Umrechnung: 60 = c' (262 Hz), 69 = a' (440 Hz), +12 = eine Oktave höher.

## Häufige Fehler

- Viele sich überlagernde Ereignisse (hohe `dichte`, langer `nachklang`) addieren sich: Spitze steigt, dann `pegel` senken.
- `gleiten` mit großem Faktor und langer Dauer klingt nach Laser oder Sirene. Faktor höchstens 2, Dauer höchstens 0,1 s.
- `wellen` mit `ziel: "filter"` wirkt nur, wenn die Schicht einen Filter hat, und nur auf den ersten.
- Schmaler `bandpass` mit hoher `guete` auf Dauerrauschen pfeift.
- `muster` mit Versatz 0 und mehreren Tonhöhen ergibt einen Akkord, das ist nicht erwünscht.
- Braunes Rauschen ohne Tiefpass wirkt dumpf und schwankend. Für „Rauschen zum Einschlafen“ ist rosa meist angenehmer.

## Checkliste vor dem Abschluss

- [ ] `python3 werkzeuge/pruefen.py klang <id>` meldet 0 Fehler, Effektivwert im Zielbereich.
- [ ] Töne langsam (gemessene Abstände ≥ 0,5 s), keine Akkorde.
- [ ] Nichts Plötzliches, nichts Schrilles.
- [ ] Zeile in `site/klaenge/liste.js`, Name in `site/sprachen/de.json`, sonst keine Datei geändert.
- [ ] Im Bericht erwähnt, dass ein Mensch den Klang anhören muss.
