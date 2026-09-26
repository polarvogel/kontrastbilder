// @ts-check

import liste from "../motive/liste.js";
import { leseFarben } from "./farben.js";
import { t } from "./sprache.js";

/**
 * @typedef {Object} MotivEintrag
 * @property {string} datei
 * @property {boolean} [animation]
 * @property {number} [tempo]
 */

/**
 * @typedef {MotivEintrag & { id: string, name: string, svg: string, farben: import("./farben.js").Farben }} Motiv
 */

/*
 * Namen der Motive stehen in sprachen/<code>.json unter "motive.<id>". Die Sprache
 * muss vor dem Laden der Motive geladen sein (ladeSprache in sprache.js).
 */

/*
 * Stil innerhalb jedes Motivs. Das Motiv lebt in einem Shadow Root, damit
 * Klassennamen und Keyframes der einzelnen SVG-Dateien sich nicht gegenseitig
 * überschreiben. CSS-Variablen (--v, --h, --f1 ...) erben trotzdem von außen.
 */
const HOST_STIL = ":host{display:block}svg{display:block;width:100%;height:100%}";

/**
 * Lädt alle Motive aus der Liste. Fehlende Dateien werden übersprungen und
 * in der Konsole gemeldet, damit ein einzelner Fehler nicht alles blockiert.
 *
 * @returns {Promise<Motiv[]>}
 */
export async function ladeMotive() {
  const ergebnisse = await Promise.allSettled(liste.map(ladeMotiv));
  /** @type {Motiv[]} */
  const motive = [];
  ergebnisse.forEach((ergebnis, i) => {
    if (ergebnis.status === "fulfilled") {
      motive.push(ergebnis.value);
    } else {
      console.warn(`Motiv ${liste[i].datei} nicht geladen:`, ergebnis.reason);
    }
  });
  return motive;
}

/**
 * Lädt ein einzelnes Motiv, auch eines, das noch nicht in der Liste steht.
 *
 * @param {MotivEintrag} eintrag
 * @returns {Promise<Motiv>}
 */
export async function ladeMotiv(eintrag) {
  const antwort = await fetch(`motive/${eintrag.datei}`);
  if (!antwort.ok) {
    throw new Error(`HTTP ${antwort.status}`);
  }
  const text = await antwort.text();
  const dokument = new DOMParser().parseFromString(text, "image/svg+xml");
  const id = eintrag.datei.replace(/\.svg$/, "");
  return {
    ...eintrag,
    id,
    name: t(`motive.${id}`),
    svg: text.replace(/<\?xml[^>]*\?>/, "").trim(),
    farben: leseFarben(dokument.documentElement),
  };
}

/**
 * Erzeugt ein Element, das das Motiv enthält.
 *
 * @param {Motiv} motiv
 * @param {string} [zusatzStil] zusätzliches CSS innerhalb des Motivs
 * @returns {HTMLElement}
 */
export function erzeugeMotiv(motiv, zusatzStil = "") {
  const host = document.createElement("div");
  host.className = "motiv";
  host.dataset.motiv = motiv.id;
  host.setAttribute("role", "img");
  host.setAttribute("aria-label", motiv.name);
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${HOST_STIL}${zusatzStil}</style>${motiv.svg}`;
  return host;
}

/**
 * Stil, der alle Animationen abschaltet. Das Motiv zeigt dann seine Ruhepose,
 * also den Zustand ohne Animation.
 */
export const STIL_STATISCH = "*{animation:none!important}";

/**
 * Setzt Tempo und Lauf/Pause aller Animationen eines Motivs. Das Tempo wird
 * über die Web Animations API geändert, damit die Bewegung dabei nicht springt.
 *
 * @param {HTMLElement} host
 * @param {{ laufen: boolean, rate: number }} optionen
 */
export function steuereAnimation(host, { laufen, rate }) {
  const root = host.shadowRoot;
  if (!root) {
    return;
  }
  for (const animation of root.getAnimations()) {
    if (animation.playbackRate !== rate) {
      animation.updatePlaybackRate(rate);
    }
    if (laufen && animation.playState !== "running") {
      animation.play();
    } else if (!laufen && animation.playState === "running") {
      animation.pause();
    }
  }
}
