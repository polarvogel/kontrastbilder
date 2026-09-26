// @ts-check
/// <reference lib="webworker" />

/*
 * Service Worker für den Offline-Betrieb (nur über https oder localhost).
 *
 * Strategie: erst Netz, bei Fehler Cache. Online gibt es also immer den
 * aktuellen Stand, offline den zuletzt geladenen. Beim Installieren werden
 * die Seiten, der Code und alle Motive aus der Liste vorab gespeichert.
 *
 * Neue JS- oder CSS-Dateien hier in SEITE eintragen. Motive und Klänge kommen
 * automatisch aus motive/liste.js und klaenge/liste.js.
 */

import liste from "./motive/liste.js";
import klaenge from "./klaenge/liste.js";

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

const CACHE = "kontrastbilder-v2";

const SEITE = [
  "./",
  "index.html",
  "druck.html",
  "pruefen.html",
  "hinweise.html",
  "css/app.css",
  "css/druck.css",
  "css/pruefen.css",
  "js/app.js",
  "js/motive.js",
  "js/einstellungen.js",
  "js/wachhalten.js",
  "js/farben.js",
  "js/sprache.js",
  "sprachen/liste.js",
  "sprachen/de.json",
  "js/klang.js",
  "js/klang-worklet.js",
  "js/druck.js",
  "js/pruefen.js",
  "motive/liste.js",
  "klaenge/liste.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

sw.addEventListener("install", (ereignis) => {
  const dateien = [...SEITE, ...liste.map((m) => `motive/${m.datei}`), ...klaenge.map((k) => `klaenge/${k.datei}`)];
  ereignis.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(dateien))
      .then(() => sw.skipWaiting()),
  );
});

sw.addEventListener("activate", (ereignis) => {
  ereignis.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener("fetch", (ereignis) => {
  const anfrage = ereignis.request;
  if (anfrage.method !== "GET" || new URL(anfrage.url).origin !== sw.location.origin) {
    return;
  }
  ereignis.respondWith(netzDannCache(anfrage));
});

/*
 * "no-cache" fragt immer beim Server nach (bei unveränderter Datei nur kurz mit 304).
 * Sonst liefert der HTTP-Cache des Browsers nach Änderungen manchmal alte Dateien.
 */
/** @param {Request} anfrage */
async function netzDannCache(anfrage) {
  const cache = await caches.open(CACHE);
  try {
    const antwort = await fetch(anfrage.url, { cache: "no-cache" });
    if (antwort.ok) {
      cache.put(anfrage, antwort.clone());
    }
    return antwort;
  } catch (fehler) {
    const gespeichert = await cache.match(anfrage, { ignoreSearch: true });
    if (gespeichert) {
      return gespeichert;
    }
    throw fehler;
  }
}
