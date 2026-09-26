// @ts-check

/**
 * Reihenfolge und Einstellungen der Motive.
 *
 * Neues Motiv: SVG-Datei in diesen Ordner legen und hier eine Zeile ergänzen.
 * Die Reihenfolge hier ist die Reihenfolge in der Anzeige und im Druck.
 * Sortiert grob von einfachen Formen zu Tieren mit mehr Details.
 *
 * Felder:
 *   datei      Dateiname im Ordner motive/ (Pflicht)
 *   name       Anzeigename (Pflicht)
 *   animation  false schaltet die Animation dieses Motivs ab (Standard: true)
 *   tempo      Faktor auf die globale Geschwindigkeit, z. B. 0.8 (Standard: 1)
 *
 * @type {import("../js/motive.js").MotivEintrag[]}
 */
export default [
  { datei: "kreis.svg", name: "Großer Kreis" },
  { datei: "ringe.svg", name: "Ringe" },
  { datei: "streifen.svg", name: "Wellenstreifen" },
  { datei: "schachbrett.svg", name: "Schachbrett" },
  { datei: "herz.svg", name: "Herz" },
  { datei: "sonne.svg", name: "Sonne" },
  { datei: "mond.svg", name: "Mond und Stern" },
  { datei: "gesicht.svg", name: "Gesicht" },
  { datei: "blume.svg", name: "Blume" },
  { datei: "wolke.svg", name: "Regenwolke" },
  { datei: "fisch.svg", name: "Fisch" },
  { datei: "qualle.svg", name: "Qualle" },
  { datei: "schiff.svg", name: "Schiff" },
  { datei: "vogel.svg", name: "Vogel" },
  { datei: "eule.svg", name: "Eule" },
  { datei: "schnecke.svg", name: "Schnecke" },
  { datei: "pinguin.svg", name: "Pinguin" },
  { datei: "elefant.svg", name: "Elefant" },
  { datei: "katze.svg", name: "Katze" },
  { datei: "schildkroete.svg", name: "Schildkröte" },
];
