// @ts-check

/*
 * Hält den Bildschirm wach (Screen Wake Lock API). Der Browser gibt die Sperre
 * selbst frei, wenn der Tab in den Hintergrund geht. Deshalb wird sie beim
 * Zurückkehren und bei jeder Bedienung neu angefordert, solange sie gewünscht ist.
 */

/** @type {WakeLockSentinel | null} */
let sperre = null;
let gewuenscht = false;
let abgelehnt = false;

export const unterstuetzt = "wakeLock" in navigator;

async function anfordern() {
  if (!unterstuetzt || !gewuenscht || sperre || document.visibilityState !== "visible") {
    return;
  }
  try {
    sperre = await navigator.wakeLock.request("screen");
    abgelehnt = false;
    sperre.addEventListener("release", () => {
      sperre = null;
    });
  } catch {
    // Abgelehnt, z. B. Energiesparmodus, Browser-Richtlinie oder fehlende Nutzerinteraktion.
    sperre = null;
    abgelehnt = true;
  }
}

export function aktivieren() {
  gewuenscht = true;
  return anfordern();
}

export async function freigeben() {
  gewuenscht = false;
  const alt = sperre;
  sperre = null;
  await alt?.release();
}

/** Neuer Versuch nach einer Bedienung, falls der Browser eine Nutzeraktion verlangt. */
export function erneuern() {
  return anfordern();
}

/** @returns {"aktiv" | "abgelehnt" | "aus" | "nicht unterstützt"} */
export function status() {
  if (!unterstuetzt) {
    return "nicht unterstützt";
  }
  if (sperre) {
    return "aktiv";
  }
  return abgelehnt ? "abgelehnt" : "aus";
}

document.addEventListener("visibilitychange", () => {
  anfordern();
});
