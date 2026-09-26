// @ts-check

/**
 * Reihenfolge der Klänge in der Auswahl.
 *
 * Neuer Klang: JSON-Datei in diesen Ordner legen, hier eine Zeile ergänzen und den
 * Anzeigenamen in sprachen/de.json unter "klaenge.<id>" eintragen (id = Dateiname ohne .json).
 * Das Format der Dateien steht im README (Abschnitt Klänge).
 *
 * @type {import("../js/klang.js").KlangEintrag[]}
 */
export default [
  { datei: "weisses-rauschen.json" },
  { datei: "meer.json" },
  { datei: "regen.json" },
  { datei: "herzschlag.json" },
  { datei: "xylophon.json" },
];
