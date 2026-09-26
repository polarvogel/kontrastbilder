// @ts-check

/**
 * @typedef {Object} Einstellungen
 * @property {boolean | null} animation  null = Systemeinstellung (prefers-reduced-motion)
 * @property {number} tempo              Faktor auf alle Animationen
 * @property {boolean} invertiert
 * @property {boolean} farbe             Farbmodus: jedes Motiv mit seinen eigenen Farben
 * @property {boolean} ton               Klang an (Hauptschalter)
 * @property {string[]} klaenge          ids der gleichzeitig gewählten Klänge
 * @property {Record<string, number>} klangAnteile  Anteil je Klang im Mischpult, 0 bis 1 (fehlt = 1)
 * @property {number} lautstaerke        0 bis 1
 * @property {string} sprache            Sprachcode, leer = automatisch nach Browser
 * @property {number} autoWeiter         Sekunden bis zum nächsten Motiv, 0 = aus (60, 180, 300, 600)
 * @property {number} sitzung            Minuten bis zum Ausblenden, 0 = aus
 * @property {boolean} touchNavigation   Tippen links/rechts und Wischen wechselt das Motiv
 * @property {string} letztesMotiv       id des zuletzt gezeigten Motivs
 */

const SCHLUESSEL = "kontrastbilder.einstellungen.v1";

export const TEMPO_STUFEN = [0.5, 0.75, 1, 1.25, 1.5, 2];

/* Erlaubte Werte der Auswahlfelder. Andere gespeicherte Werte fallen auf den Standard zurück. */
const ERLAUBT = {
  tempo: TEMPO_STUFEN,
  autoWeiter: [0, 60, 180, 300, 600],
  sitzung: [0, 3, 5, 10],
};

const wenigerBewegung = window.matchMedia("(prefers-reduced-motion: reduce)");

/** @returns {Einstellungen} */
function standard() {
  return {
    animation: null,
    tempo: 1,
    invertiert: false,
    farbe: false,
    ton: false,
    klaenge: [],
    klangAnteile: {},
    lautstaerke: 0.7,
    sprache: "",
    autoWeiter: 0,
    sitzung: 0,
    touchNavigation: false,
    letztesMotiv: "",
  };
}

/**
 * Liest gespeicherte Einstellungen. Unbekannte Felder oder falsche Typen werden
 * ignoriert. Ohne Speicher (privates Fenster, blockiert) gelten die Standardwerte.
 *
 * @returns {Einstellungen}
 */
export function laden() {
  const einstellungen = standard();
  try {
    const gespeichert = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? "{}");
    // Frühere Version speicherte genau einen Klang als "klang".
    if (typeof gespeichert.klang === "string" && !Array.isArray(gespeichert.klaenge)) {
      gespeichert.klaenge = gespeichert.klang ? [gespeichert.klang] : [];
    }
    for (const [schluessel, wert] of Object.entries(gespeichert)) {
      if (!(schluessel in einstellungen)) {
        continue;
      }
      const erwartet = typeof einstellungen[/** @type {keyof Einstellungen} */ (schluessel)];
      const liste = ERLAUBT[/** @type {keyof typeof ERLAUBT} */ (schluessel)];
      const passt =
        (typeof wert === erwartet || (schluessel === "animation" && typeof wert === "boolean")) &&
        (!liste || liste.includes(wert));
      if (passt) {
        /** @type {any} */ (einstellungen)[schluessel] = wert;
      }
    }
  } catch {
    // Kein Zugriff auf localStorage oder kaputter Inhalt: Standardwerte behalten.
  }
  einstellungen.lautstaerke = Math.min(1, Math.max(0, einstellungen.lautstaerke));
  if (!Array.isArray(einstellungen.klaenge) || !einstellungen.klaenge.every((k) => typeof k === "string")) {
    einstellungen.klaenge = [];
  }
  if (Array.isArray(einstellungen.klangAnteile) || !Object.values(einstellungen.klangAnteile).every((w) => typeof w === "number")) {
    einstellungen.klangAnteile = {};
  }
  return einstellungen;
}

/** @param {Einstellungen} einstellungen */
export function speichern(einstellungen) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(einstellungen));
  } catch {
    // Speichern nicht möglich: Einstellungen gelten nur für diese Sitzung.
  }
}

/**
 * Ob Animationen laufen sollen. Eine ausdrückliche Wahl im Menü hat Vorrang,
 * sonst gilt die Systemeinstellung "Bewegung reduzieren".
 *
 * @param {Einstellungen} einstellungen
 */
export function animationAn(einstellungen) {
  return einstellungen.animation ?? !wenigerBewegung.matches;
}

/**
 * Meldet Änderungen der Systemeinstellung "Bewegung reduzieren".
 *
 * @param {() => void} rueckruf
 */
export function beiBewegungsAenderung(rueckruf) {
  wenigerBewegung.addEventListener("change", rueckruf);
}
