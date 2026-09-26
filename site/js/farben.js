// @ts-check

/*
 * Farbmodus.
 *
 * Jedes Motiv kann am SVG-Wurzelelement festlegen, welche Farbe eine Rolle im
 * Farbmodus bekommt, z. B. <svg data-farbe-h="blau" data-farbe-f1="gelb">.
 * Ohne Angabe gilt: v schwarz, h weiß, f1–f3 wie v, d1 wie h.
 * Pro Motiv sind höchstens 4 verschiedene Farben erlaubt, Schwarz und Weiß
 * zählen mit. Die Prüfseite kontrolliert das.
 */

/** Zentrale Palette. Kräftige, gut unterscheidbare Farben ohne Pastell. */
export const PALETTE = {
  schwarz: "#000000",
  weiss: "#ffffff",
  rot: "#e3261c",
  orange: "#ff7b00",
  gelb: "#ffcc00",
  gruen: "#1f9e3a",
  blau: "#1f5fd6",
  dunkelblau: "#10245e",
  rosa: "#f2508e",
  braun: "#8a5a2b",
  lila: "#7a3cc2",
};

/** Rollen, die eine Farbe bekommen können */
export const ROLLEN = ["v", "h", "f1", "f2", "f3", "d1"];

export const MAX_FARBEN = 4;

/** @typedef {Partial<Record<string, string>>} Farben */

/**
 * Liest die Farbangaben aus dem SVG-Quelltext eines Motivs.
 *
 * @param {Element} svg Wurzelelement
 * @returns {Farben}
 */
export function leseFarben(svg) {
  /** @type {Farben} */
  const farben = {};
  for (const attribut of svg.attributes) {
    const treffer = attribut.name.match(/^data-farbe-(.+)$/);
    if (treffer) {
      farben[treffer[1]] = attribut.value.trim();
    }
  }
  return farben;
}

/**
 * Hexwert je Rolle im Farbmodus, mit den Rückfallregeln der Rollen.
 * Unbekannte Namen fallen auf den Standard zurück.
 *
 * @param {Farben} farben
 * @returns {Record<string, string>}
 */
export function wirksameFarben(farben) {
  const wert = (/** @type {string | undefined} */ name) => (name && name in PALETTE ? PALETTE[/** @type {keyof typeof PALETTE} */ (name)] : undefined);
  const v = wert(farben.v) ?? PALETTE.schwarz;
  const h = wert(farben.h) ?? PALETTE.weiss;
  return {
    v,
    h,
    f1: wert(farben.f1) ?? v,
    f2: wert(farben.f2) ?? v,
    f3: wert(farben.f3) ?? v,
    d1: wert(farben.d1) ?? h,
  };
}

/**
 * Setzt die CSS-Variablen für den Farbmodus an einem Element oder entfernt sie
 * (farben = null). Ohne Variablen gelten wieder Schwarz-Weiß bzw. Invertiert.
 *
 * @param {HTMLElement} element
 * @param {Farben | null} farben
 */
export function setzeFarben(element, farben) {
  for (const rolle of ROLLEN) {
    element.style.removeProperty(`--${rolle}`);
  }
  if (!farben) {
    return;
  }
  for (const [rolle, hex] of Object.entries(wirksameFarben(farben))) {
    element.style.setProperty(`--${rolle}`, hex);
  }
}

/**
 * Kontrast nach WCAG zwischen zwei Hexfarben (1 bis 21).
 *
 * @param {string} a
 * @param {string} b
 */
export function kontrast(a, b) {
  const la = helligkeit(a);
  const lb = helligkeit(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** @param {string} hex */
function helligkeit(hex) {
  const kanal = (/** @type {number} */ i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal(1) + 0.7152 * kanal(3) + 0.0722 * kanal(5);
}
