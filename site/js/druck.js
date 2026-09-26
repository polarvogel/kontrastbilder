// @ts-check

import { ladeMotive, erzeugeMotiv, STIL_STATISCH } from "./motive.js";

/** @typedef {import("./motive.js").Motiv} Motiv */

/*
 * Kartengröße und Raster je Anzahl pro Seite. Die Druckfläche ist 190 × 277 mm
 * (A4 minus 10 mm Rand).
 */
const RASTER = {
  1: { spalten: 1, karte: "180mm" },
  2: { spalten: 1, karte: "130mm" },
  4: { spalten: 2, karte: "90mm" },
  6: { spalten: 2, karte: "85mm" },
};

const seiten = /** @type {HTMLElement} */ (document.getElementById("seiten"));
const proSeite = /** @type {HTMLSelectElement} */ (document.getElementById("pro-seite"));
const variante = /** @type {HTMLSelectElement} */ (document.getElementById("variante"));
const hinweis = /** @type {HTMLElement} */ (document.getElementById("hinweis-beidseitig"));

/** @type {Motiv[]} */
let motive = [];

/**
 * @param {Motiv | null} motiv
 * @param {boolean} invertiert
 */
function karte(motiv, invertiert) {
  const el = document.createElement("div");
  el.className = "karte";
  if (!motiv) {
    el.classList.add("leer");
    return el;
  }
  el.classList.toggle("invertiert", invertiert);
  el.append(erzeugeMotiv(motiv, STIL_STATISCH));
  return el;
}

/**
 * @param {(Motiv | null)[]} gruppe
 * @param {boolean} invertiert
 */
function seite(gruppe, invertiert) {
  const el = document.createElement("section");
  el.className = "seite";
  el.append(...gruppe.map((m) => karte(m, invertiert)));
  return el;
}

/*
 * Für den beidseitigen Druck (Wenden an der langen Kante) muss jede Zeile der
 * Rückseite gespiegelt sein, damit Vorder- und Rückseite übereinanderliegen.
 */
/**
 * @param {(Motiv | null)[]} gruppe
 * @param {number} spalten
 */
function gespiegelt(gruppe, spalten) {
  /** @type {(Motiv | null)[]} */
  const ergebnis = [];
  for (let i = 0; i < gruppe.length; i += spalten) {
    ergebnis.push(...gruppe.slice(i, i + spalten).reverse());
  }
  return ergebnis;
}

function aufbauen() {
  const anzahl = /** @type {1 | 2 | 4 | 6} */ (Number(proSeite.value));
  const raster = RASTER[anzahl];
  document.documentElement.style.setProperty("--spalten", String(raster.spalten));
  document.documentElement.style.setProperty("--karte", raster.karte);
  hinweis.hidden = variante.value !== "beidseitig";

  /** @type {HTMLElement[]} */
  const neu = [];
  for (let i = 0; i < motive.length; i += anzahl) {
    /** @type {(Motiv | null)[]} */
    const gruppe = motive.slice(i, i + anzahl);
    while (gruppe.length < anzahl) {
      gruppe.push(null);
    }
    if (variante.value === "invertiert") {
      neu.push(seite(gruppe, true));
    } else {
      neu.push(seite(gruppe, false));
    }
    if (variante.value === "beidseitig") {
      neu.push(seite(gespiegelt(gruppe, raster.spalten), true));
    }
  }
  seiten.replaceChildren(...neu);
}

async function start() {
  motive = await ladeMotive();
  proSeite.addEventListener("change", aufbauen);
  variante.addEventListener("change", aufbauen);
  document.getElementById("drucken")?.addEventListener("click", () => window.print());
  aufbauen();
}

start();
