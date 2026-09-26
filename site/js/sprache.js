// @ts-check

import sprachen from "../sprachen/liste.js";

/*
 * Lokalisierung. Alle sichtbaren Texte stehen in sprachen/<code>.json, verschachtelt
 * nach Bereichen (z. B. "einstellungen.titel"). Deutsch ist Standard und Rückfall für
 * fehlende Texte. Im HTML stehen deutsche Texte nur als Rückfall ohne JavaScript;
 * maßgeblich ist die JSON-Datei.
 *
 * HTML-Anbindung:
 *   data-i18n="schluessel"                       setzt den Textinhalt
 *   data-i18n-attr="title=schluessel;aria-label=…" setzt Attribute
 * Platzhalter im Text: {name}, ersetzt über t("schluessel", { name: … }).
 */

export const STANDARD = "de";
export const verfuegbar = sprachen;

/** @type {Record<string, any>} */
let texte = {};
/** @type {Record<string, any>} */
let rueckfall = {};
let aktuell = STANDARD;

/**
 * Gewünschte Sprache, sonst erste passende Browsersprache, sonst Deutsch.
 *
 * @param {string} [gewuenscht]
 */
export function waehleSprache(gewuenscht) {
  const codes = sprachen.map((s) => s.code);
  if (gewuenscht && codes.includes(gewuenscht)) {
    return gewuenscht;
  }
  for (const sprache of navigator.languages ?? [navigator.language]) {
    const kurz = sprache.toLowerCase().split("-")[0];
    if (codes.includes(kurz)) {
      return kurz;
    }
  }
  return STANDARD;
}

/** @param {string} code */
async function ladeDatei(code) {
  const antwort = await fetch(new URL(`../sprachen/${code}.json`, import.meta.url));
  if (!antwort.ok) {
    throw new Error(`Sprache ${code}: HTTP ${antwort.status}`);
  }
  return antwort.json();
}

/**
 * Lädt eine Sprache (und Deutsch als Rückfall) und setzt das lang-Attribut der Seite.
 *
 * @param {string} code
 */
export async function ladeSprache(code) {
  rueckfall = await ladeDatei(STANDARD);
  texte = rueckfall;
  if (code !== STANDARD) {
    try {
      texte = await ladeDatei(code);
    } catch (fehler) {
      console.warn(fehler);
    }
  }
  aktuell = code;
  document.documentElement.lang = code;
}

export const sprache = () => aktuell;

/**
 * @param {Record<string, any>} quelle
 * @param {string} schluessel
 * @returns {unknown}
 */
function suche(quelle, schluessel) {
  return schluessel.split(".").reduce((/** @type {any} */ knoten, teil) => knoten?.[teil], quelle);
}

/**
 * Ob es für den Schlüssel einen Text gibt (in der Sprache oder im Rückfall).
 *
 * @param {string} schluessel
 */
export function hat(schluessel) {
  return typeof (suche(texte, schluessel) ?? suche(rueckfall, schluessel)) === "string";
}

/**
 * Text zum Schlüssel, Platzhalter {name} werden ersetzt. Fehlt der Text, erscheint
 * der Schlüssel selbst, damit Lücken auffallen.
 *
 * @param {string} schluessel
 * @param {Record<string, string | number>} [werte]
 */
export function t(schluessel, werte = {}) {
  const text = suche(texte, schluessel) ?? suche(rueckfall, schluessel);
  if (typeof text !== "string") {
    console.warn(`Text fehlt: ${schluessel}`);
    return schluessel;
  }
  return text.replace(/\{(\w+)\}/g, (ganz, name) => (name in werte ? String(werte[name]) : ganz));
}

/**
 * Zahl im Format der Sprache, z. B. 0,75 im Deutschen.
 *
 * @param {number} wert
 * @param {Intl.NumberFormatOptions} [optionen]
 */
export function zahl(wert, optionen) {
  return new Intl.NumberFormat(aktuell, optionen).format(wert);
}

/**
 * Übersetzt alle markierten Elemente unterhalb von `wurzel`.
 *
 * @param {ParentNode} [wurzel]
 */
export function uebersetzeSeite(wurzel = document) {
  for (const el of wurzel.querySelectorAll("[data-i18n]")) {
    el.textContent = t(/** @type {HTMLElement} */ (el).dataset.i18n ?? "");
  }
  for (const el of wurzel.querySelectorAll("[data-i18n-attr]")) {
    for (const paar of (/** @type {HTMLElement} */ (el).dataset.i18nAttr ?? "").split(";")) {
      const [attribut, schluessel] = paar.split("=").map((teil) => teil.trim());
      if (attribut && schluessel) {
        el.setAttribute(attribut, t(schluessel));
      }
    }
  }
}
