// @ts-check

import { ladeMotive, erzeugeMotiv, STIL_STATISCH } from "./motive.js";
import { setzeFarben } from "./farben.js";

/** @typedef {import("./motive.js").Motiv} Motiv */
/** @typedef {"normal" | "invertiert" | "farbe"} Art */

/*
 * Vorder- und Rückseite je Auswahl. Ohne Rückseite wird nur einseitig gedruckt.
 */
/** @type {Record<string, { vorne: Art, hinten: Art | null }>} */
const VARIANTEN = {
  normal: { vorne: "normal", hinten: null },
  invertiert: { vorne: "invertiert", hinten: null },
  farbe: { vorne: "farbe", hinten: null },
  beidseitig: { vorne: "normal", hinten: "invertiert" },
  "farbe-sw": { vorne: "farbe", hinten: "normal" },
};

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
 * @param {Art} art
 */
function karte(motiv, art) {
  const el = document.createElement("div");
  el.className = "karte";
  if (!motiv) {
    el.classList.add("leer");
    return el;
  }
  el.classList.toggle("invertiert", art === "invertiert");
  const host = erzeugeMotiv(motiv, STIL_STATISCH);
  if (art === "farbe") {
    setzeFarben(host, motiv.farben);
  }
  el.append(host);
  return el;
}

/**
 * @param {(Motiv | null)[]} gruppe
 * @param {Art} art
 */
function seite(gruppe, art) {
  const el = document.createElement("section");
  el.className = "seite";
  el.append(...gruppe.map((m) => karte(m, art)));
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
  const { vorne, hinten } = VARIANTEN[variante.value] ?? VARIANTEN.normal;
  hinweis.hidden = !hinten;

  /** @type {HTMLElement[]} */
  const neu = [];
  for (let i = 0; i < motive.length; i += anzahl) {
    /** @type {(Motiv | null)[]} */
    const gruppe = motive.slice(i, i + anzahl);
    while (gruppe.length < anzahl) {
      gruppe.push(null);
    }
    neu.push(seite(gruppe, vorne));
    if (hinten) {
      neu.push(seite(gespiegelt(gruppe, raster.spalten), hinten));
    }
  }
  seiten.replaceChildren(...neu);
}

/*
 * Voreinstellung per URL, z. B. druck.html?variante=farbe&pro-seite=6
 */
function uebernehmeUrl() {
  const parameter = new URLSearchParams(location.search);
  const wunschVariante = parameter.get("variante");
  const wunschAnzahl = parameter.get("pro-seite");
  if (wunschVariante && wunschVariante in VARIANTEN) {
    variante.value = wunschVariante;
  }
  if (wunschAnzahl && wunschAnzahl in RASTER) {
    proSeite.value = wunschAnzahl;
  }
}

async function start() {
  uebernehmeUrl();
  motive = await ladeMotive();
  proSeite.addEventListener("change", aufbauen);
  variante.addEventListener("change", aufbauen);
  document.getElementById("drucken")?.addEventListener("click", () => window.print());
  aufbauen();
}

start();
