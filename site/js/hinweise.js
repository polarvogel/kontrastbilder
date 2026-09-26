// @ts-check

import * as speicher from "./einstellungen.js";
import { ladeSprache, waehleSprache, uebersetzeSeite } from "./sprache.js";

/*
 * Hinweisseite: Texte übersetzen und, wenn die Seite auf GitHub Pages läuft
 * (<benutzer>.github.io/<repo>/), den Link zum Repository aus der Adresse ableiten.
 * So muss kein Benutzer- oder Repo-Name im Code stehen.
 */
function repoLink() {
  const treffer = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
  const repo = location.pathname.split("/").filter(Boolean)[0];
  if (!treffer || !repo) {
    return;
  }
  const link = /** @type {HTMLAnchorElement} */ (document.getElementById("repo"));
  link.href = `https://github.com/${treffer[1]}/${repo}`;
  /** @type {HTMLElement} */ (document.getElementById("repo-absatz")).hidden = false;
}

async function start() {
  await ladeSprache(waehleSprache(speicher.laden().sprache));
  uebersetzeSeite();
  repoLink();
}

start();
