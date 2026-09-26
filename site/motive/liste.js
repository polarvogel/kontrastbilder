// @ts-check

/**
 * Reihenfolge und Einstellungen der Motive.
 *
 * Neues Motiv: SVG-Datei in diesen Ordner legen, hier eine Zeile ergänzen und den
 * Anzeigenamen in sprachen/de.json unter "motive.<id>" eintragen (id = Dateiname ohne .svg).
 * Die Reihenfolge hier ist die Reihenfolge in der Anzeige und im Druck.
 * Sortiert grob von einfachen Formen zu Tieren mit mehr Details.
 *
 * Felder:
 *   datei      Dateiname im Ordner motive/ (Pflicht)
 *   animation  false schaltet die Animation dieses Motivs ab (Standard: true)
 *   tempo      Faktor auf die globale Geschwindigkeit, z. B. 0.8 (Standard: 1)
 *
 * @type {import("../js/motive.js").MotivEintrag[]}
 */
export default [
  { datei: "kreis.svg" },
  { datei: "ringe.svg" },
  { datei: "streifen.svg" },
  { datei: "schachbrett.svg" },
  { datei: "herz.svg" },
  { datei: "sonne.svg" },
  { datei: "mond.svg" },
  { datei: "gesicht.svg" },
  { datei: "blume.svg" },
  { datei: "wolke.svg" },
  { datei: "fisch.svg" },
  { datei: "qualle.svg" },
  { datei: "schiff.svg" },
  { datei: "vogel.svg" },
  { datei: "eule.svg" },
  { datei: "schnecke.svg" },
  { datei: "pinguin.svg" },
  { datei: "elefant.svg" },
  { datei: "katze.svg" },
  { datei: "schildkroete.svg" },
];
