// @ts-check

/**
 * Reihenfolge und Einstellungen der Motive.
 *
 * Neues Motiv: SVG-Datei in diesen Ordner legen und hier eine Zeile ergänzen.
 * Die Reihenfolge hier ist die Reihenfolge in der Anzeige und im Druck.
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
  { datei: "sonne.svg", name: "Sonne" },
  { datei: "elefant.svg", name: "Elefant" },
  { datei: "kreis.svg", name: "Großer Kreis" },
];
