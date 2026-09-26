# Task: Kontrastbilder für Babys – statische Webseite mit langsam animierten Motiven

## Ziel

Eine kleine, statische Webseite, die schwarz-weiße Kontrastbilder für Säuglinge (ca. 0–4 Monate) im Vollbild zeigt, eines nach dem anderen. Ein Teil der Motive bewegt sich sehr langsam (z. B. Sonne dreht sich, Wolke regnet). Zuerst lokal auf meinem Rechner lauffähig, später als GitHub-Pages-Seite gehostet.

Du erstellst die ersten 15–20 Motive selbst (als Vektorgrafik). Wahl von Technik, Tools und Versionen liegt bei dir; recherchiere bei Bedarf den aktuellen Stand, statt aus dem Gedächtnis zu arbeiten.

## Hintergrund: Was Kontrastbilder ausmacht

Kurz zusammengefasst aus gängigen Quellen (Elternratgeber, Hersteller von Kontrastkarten, Fantz 1963 zu Mustervorlieben von Neugeborenen):

- Neugeborene sehen unscharf und kaum Farben; starke Hell-Dunkel-Kanten und klare Formen werden am besten wahrgenommen.
- Schlecht geeignet: Pastelltöne, Verläufe, feine Linien, viele Details.
- Komplexität soll mit dem Alter wachsen: anfangs große Einzelformen, später Muster und einfache Tiere/Gesichter. Gesichtsartige Anordnungen ziehen besonders Aufmerksamkeit.
- Übliche Nutzung: kurz, ein Motiv zur Zeit, Elternteil ist dabei und spricht mit dem Baby; langsames Bewegen der Karte fördert das Verfolgen mit den Augen. Genau das soll die Animation nachahmen.

Schau dir vor dem Zeichnen selbst einige Beispiele an (Suche z. B. nach „high contrast baby cards“, „Kontrastkarten Baby“), um den Stil zu treffen. Nichts davon kopieren, nur Stil ableiten.

## Gestaltungsregeln für die Motive

- Nur reines Schwarz und reines Weiß. Keine Grautöne, keine Verläufe, keine Transparenz-Effekte, die Grau erzeugen.
- Weiche, runde Formen, dicke gefüllte Flächen statt dünner Konturlinien. Wo Linien nötig sind, sehr kräftig.
- Wenige Details: ein Motiv muss auch stark unscharf (Blur-Test) noch als Form erkennbar sein.
- Ein Motiv pro Bild, zentriert, füllt ca. 60–75 % der kürzeren Bildschirmseite, genügend weißer (bzw. schwarzer) Rand.
- Augen als große, klar abgesetzte Kreise (z. B. schwarzer Kreis mit weißem Glanzpunkt).
- Einheitlicher Stil über alle Motive, quadratisches Grundformat, damit Hoch- und Querformat funktionieren.
- Jedes Motiv muss auch invertiert (weiß auf schwarz) gut aussehen.

## Bewegung

Das ist der Kern des Projekts. Regeln:

- Sehr langsam: ein Bewegungszyklus dauert grob 6–20 Sekunden, Rotationen eher 30–60 Sekunden pro Umdrehung.
- Weich (Ease-in-out), nahtlose Schleifen ohne Sprung am Loop-Ende.
- Kleine Amplituden; das Motiv bleibt ruhig an seinem Platz, nur ein Teil bewegt sich.
- Kein Flackern, Blinken, keine schnellen Hell-Dunkel-Wechsel, keine großflächigen Farbumschläge.
- Etwa die Hälfte der Motive animiert, der Rest statisch.
- Global: Animation an/aus, Geschwindigkeit regelbar (langsamer/schneller), `prefers-reduced-motion` respektieren.

## Motivliste (Vorschlag, 20 Stück, du darfst anpassen)

Animierte Motive:

1. Sonne – runder Kern mit dicken, abgerundeten Strahlen; Strahlenkranz dreht sich sehr langsam.
2. Wolke mit Regen – dicke Tropfen fallen langsam und versetzt aus der Wolke.
3. Elefant – Seitenansicht, Rüssel hebt sich langsam und senkt sich wieder.
4. Katze – streckt sich langsam (Buckel/Vorderbeine nach vorn), dann zurück.
5. Fisch – schwimmt langsam ein Stück nach links und rechts, Schwanzflosse wedelt.
6. Vogel – Flügel heben und senken sich langsam.
7. Schildkröte – Kopf kommt langsam aus dem Panzer und zieht sich zurück.
8. Eule – große runde Augen, blinzelt gelegentlich langsam.
9. Gesicht (einfaches rundes Babygesicht) – lächelt langsam breiter / blinzelt.
10. Qualle – schwebt langsam auf und ab, Tentakel wiegen sich.
11. Blume – Blütenblätter öffnen sich langsam und schließen sich wieder.
12. Herz – „atmet“ sehr sanft (leichte Größenänderung).
13. Schiff auf Welle – schaukelt langsam.
14. Mond mit Stern – Stern wandert langsam um den Mond.

Statische Motive (einfache Formen, auch für die ersten Wochen):

15. Großer Kreis / Punkt
16. Dicke Streifen (gebogen oder wellig, keine harten Ecken)
17. Konzentrische Kreise (wenige, dicke Ringe)
18. Schachbrett mit abgerundeten Feldern (grob, max. 3×3)
19. Igel oder Schnecke
20. Zebra-Kopf oder Pinguin

Optional später (nicht Teil dieses Tasks): Stufen nach Alter filtern, roter Akzent ab ca. 3 Monaten.

## Bedienung

- Vollbild, keine sichtbaren Bedienelemente während der Anzeige; Steuerung blendet sich bei Berührung/Mausbewegung kurz ein und verschwindet wieder.
- Weiter/zurück per Wischen, Tippen auf Bildhälften und Pfeiltasten.
- Optional automatisches Weiterschalten mit langem, einstellbarem Intervall; Übergänge ruhig (kein harter Schnitt, kein Gleit-Effekt quer über den Bildschirm).
- Umschalter Normal/invertiert.
- Bildschirm soll während der Anzeige nicht in den Ruhezustand gehen (sofern der Browser das unterstützt).
- Optionaler Sitzungs-Timer (z. B. 3/5/10 Minuten), danach blendet die Anzeige sanft aus.
- Druckansicht: alle Motive statisch als Karten zum Ausdrucken (z. B. mehrere pro A4-Seite), als Alternative zum Bildschirm.
- Kein Ton. Einstellungen merken, soweit ohne Server möglich.

## Technische Rahmenbedingungen

- Rein statisch, kein Backend. Zur Laufzeit wird nichts aus dem Internet geladen: keine CDNs, keine Web-Fonts von außen, kein Tracking.
- Lokal testbar, idealerweise schon durch Öffnen der HTML-Datei; wenn ein lokaler Server nötig ist, einen einfachen Startbefehl dokumentieren. Hinweis: Manche Browser-Features (z. B. Service Worker) funktionieren nicht über `file://`.
- Später Deployment auf GitHub Pages; nach dem Deployment soll die Seite auch offline weiter funktionieren (z. B. installierbar/offlinefähig), sofern das ohne Mehraufwand für den Nutzer geht.
- Ein Build-Schritt ist erlaubt, wenn er echten Nutzen bringt; das Ergebnis muss aber statisch und ohne Laufzeit-Abhängigkeiten sein.
- Neue Motive sollen einfach hinzuzufügen sein (eine Datei plus ein Eintrag o. Ä.), Reihenfolge und Animation pro Motiv konfigurierbar.
- Läuft auf aktuellem Smartphone, Tablet und Desktop-Browser (Firefox und Chromium-basiert); flüssig auch auf schwächeren Geräten.
- Code kommentieren: Kommentare als eigene Zeile über dem Abschnitt, nicht am Zeilenende.

## Vorgehen

1. Kurz recherchieren (Stil von Kontrastkarten, passende Technik), Plan mit Technikentscheidung und Begründung vorlegen, bevor du viel Code schreibst.
2. Grundgerüst mit 3 Motiven (Sonne, Elefant, großer Kreis) inkl. Bedienung, damit ich Stil und Tempo prüfen kann.
3. Nach meinem Feedback die restlichen Motive.
4. README mit lokalem Start, Hinzufügen neuer Motive und GitHub-Pages-Deployment.

## Abnahmekriterien

- Alle Motive nur schwarz/weiß, auch invertiert sauber.
- Keine einzige Netzwerkanfrage zur Laufzeit (im DevTools-Netzwerk-Tab prüfen).
- Animationen ruckelfrei, ohne sichtbaren Sprung am Loop-Ende, abschaltbar.
- Bedienung per Touch und Tastatur, Bedienelemente verschwinden selbstständig.
- Druckansicht erzeugt brauchbare Karten.
- README vorhanden.

## Nicht Teil dieses Tasks

Farbe, Ton, Nutzerkonten, Analytics, App-Store-Versionen.
