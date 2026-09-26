// @ts-check

import { ladeMotive, ladeMotiv, erzeugeMotiv, STIL_STATISCH } from "./motive.js";
import motivListe from "../motive/liste.js";
import { PALETTE, ROLLEN as FARBROLLEN, MAX_FARBEN, wirksameFarben, kontrast, setzeFarben } from "./farben.js";
import { ladeSprache, hat, STANDARD } from "./sprache.js";

/** @typedef {import("./motive.js").Motiv} Motiv */
/** @typedef {{ art: "fehler" | "hinweis" | "ok", text: string }} Befund */

const ROLLEN = ["v", "h", "f1", "f2", "f3", "d1", "vl", "hl", "f1l", "f2l", "f3l", "d1l"];
const ROLLEN_SELEKTOR = ROLLEN.map((r) => `.${r}`).join(",");
const FORMEN = "rect,circle,ellipse,path,polygon,polyline,line";

/* Alles, was Grau, Verläufe, Transparenz oder externe Bezüge erzeugen kann */
const VERBOTENE_ELEMENTE = [
  "linearGradient",
  "radialGradient",
  "pattern",
  "filter",
  "mask",
  "clipPath",
  "image",
  "foreignObject",
  "use",
  "script",
  "text",
];
const VERBOTENE_ATTRIBUTE = ["opacity", "fill-opacity", "stroke-opacity", "fill", "stroke", "style", "filter", "mask", "clip-path"];
const KEYFRAME_ERLAUBT = new Set(["transform", "animation-timing-function"]);

/* Zielgröße laut Gestaltungsregeln: Motiv füllt 60–75 % der Kantenlänge */
const GROESSE_MIN = 60;
const GROESSE_MAX = 75;

const liste = /** @type {HTMLElement} */ (document.getElementById("liste"));
const zusammenfassung = /** @type {HTMLElement} */ (document.getElementById("zusammenfassung"));

/*
 * Wartet auf das nächste gezeichnete Bild. In Hintergrund-Tabs und headless
 * Browsern kommt requestAnimationFrame nicht, daher zusätzlich ein Timeout.
 */
const naechstesBild = () =>
  new Promise((fertig) => {
    requestAnimationFrame(() => requestAnimationFrame(fertig));
    setTimeout(fertig, 100);
  });

/**
 * Prüft den Quelltext eines Motivs auf die Gestaltungsregeln.
 *
 * @param {Motiv} motiv
 * @returns {Befund[]}
 */
function pruefeQuelltext(motiv) {
  /** @type {Befund[]} */
  const befunde = [];
  const fehler = (/** @type {string} */ text) => befunde.push({ art: "fehler", text });

  const doc = new DOMParser().parseFromString(motiv.svg, "image/svg+xml");
  if (doc.querySelector("parsererror")) {
    fehler("SVG ist kein gültiges XML.");
    return befunde;
  }
  const svg = doc.documentElement;
  if (svg.getAttribute("viewBox") !== "0 0 400 400") {
    fehler(`viewBox ist "${svg.getAttribute("viewBox")}", erwartet "0 0 400 400".`);
  }

  for (const name of VERBOTENE_ELEMENTE) {
    if (doc.getElementsByTagName(name).length) {
      fehler(`Element <${name}> ist nicht erlaubt.`);
    }
  }

  /** @type {Set<string>} */
  const attributFehler = new Set();
  for (const el of doc.querySelectorAll("*")) {
    for (const attribut of VERBOTENE_ATTRIBUTE) {
      if (el.hasAttribute(attribut)) {
        attributFehler.add(`Attribut ${attribut}="…" an <${el.tagName}>: Farben und Transparenz nur über Rollenklassen.`);
      }
    }
  }
  attributFehler.forEach(fehler);

  const ohneRolle = [...doc.querySelectorAll(FORMEN)].filter((el) => !el.closest(ROLLEN_SELEKTOR));
  if (ohneRolle.length) {
    fehler(`${ohneRolle.length} Form(en) ohne Farbrolle (${ROLLEN.join(", ")}).`);
  }

  const css = [...doc.querySelectorAll("style")].map((s) => s.textContent ?? "").join("\n");
  const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  if (/opacity|filter\s*:|gradient|url\(/i.test(ohneKommentare)) {
    fehler("CSS enthält opacity, filter, gradient oder url().");
  }
  const farben = (ohneKommentare.match(/#[0-9a-f]{3,8}\b/gi) ?? []).filter((f) => !/^#(000|fff)$/i.test(f));
  if (farben.length || /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/i.test(ohneKommentare)) {
    fehler(`CSS enthält feste Farbwerte (${[...new Set(farben)].join(", ") || "Farbfunktion"}). Nur #000/#fff als Fallback erlaubt.`);
  }

  try {
    const blatt = new CSSStyleSheet();
    blatt.replaceSync(css);
    let keyframes = 0;
    for (const regel of blatt.cssRules) {
      if (!(regel instanceof CSSKeyframesRule)) {
        continue;
      }
      keyframes += 1;
      for (const bild of regel.cssRules) {
        const stil = /** @type {CSSKeyframeRule} */ (bild).style;
        for (let i = 0; i < stil.length; i += 1) {
          if (!KEYFRAME_ERLAUBT.has(stil[i])) {
            fehler(`@keyframes ${regel.name} ändert "${stil[i]}". Erlaubt ist nur transform.`);
          }
        }
      }
    }
    befunde.push({ art: "ok", text: keyframes ? `${keyframes} Animation(en) definiert.` : "Statisches Motiv." });
  } catch (grund) {
    fehler(`CSS nicht lesbar: ${grund}`);
  }

  befunde.push(...pruefeFarben(motiv, doc));
  return befunde;
}

/** Farbname zu einem Hexwert, für lesbare Meldungen */
const NAME = Object.fromEntries(Object.entries(PALETTE).map(([name, hex]) => [hex, name]));

/**
 * Prüft die Farbangaben für den Farbmodus: bekannte Rollen und Farbnamen,
 * höchstens MAX_FARBEN verschiedene Farben unter den tatsächlich benutzten Rollen,
 * und ob sich farbige Flächen hell/dunkel vom Hintergrund abheben.
 *
 * @param {Motiv} motiv
 * @param {Document} doc
 * @returns {Befund[]}
 */
function pruefeFarben(motiv, doc) {
  /** @type {Befund[]} */
  const befunde = [];
  for (const [rolle, name] of Object.entries(motiv.farben)) {
    if (!FARBROLLEN.includes(rolle)) {
      befunde.push({ art: "fehler", text: `data-farbe-${rolle}: unbekannte Rolle. Erlaubt: ${FARBROLLEN.join(", ")}.` });
    } else if (!name || !(name in PALETTE)) {
      befunde.push({ art: "fehler", text: `data-farbe-${rolle}="${name}": unbekannte Farbe. Erlaubt: ${Object.keys(PALETTE).join(", ")}.` });
    }
  }
  if (!Object.keys(motiv.farben).length) {
    befunde.push({ art: "ok", text: "Farbmodus: keine eigenen Farben, bleibt schwarz-weiß." });
    return befunde;
  }

  /** @type {Set<string>} */
  const benutzt = new Set();
  for (const el of doc.querySelectorAll("[class]")) {
    for (const klasse of el.classList) {
      const rolle = klasse.replace(/l$/, "");
      if (FARBROLLEN.includes(rolle)) {
        benutzt.add(rolle);
      }
    }
  }
  const wirksam = wirksameFarben(motiv.farben);
  const verschieden = [...new Set([...benutzt].map((rolle) => wirksam[rolle]))];
  const liste = verschieden.map((hex) => NAME[hex] ?? hex).join(", ");
  if (verschieden.length > MAX_FARBEN) {
    befunde.push({ art: "fehler", text: `Farbmodus: ${verschieden.length} Farben (${liste}), erlaubt sind ${MAX_FARBEN}.` });
  } else {
    befunde.push({ art: "ok", text: `Farbmodus: ${verschieden.length} ${verschieden.length === 1 ? "Farbe" : "Farben"} (${liste}).` });
  }
  for (const hex of verschieden) {
    const k = kontrast(hex, wirksam.h);
    if (hex !== wirksam.h && k < 1.5) {
      befunde.push({ art: "hinweis", text: `Farbmodus: ${NAME[hex] ?? hex} hebt sich kaum vom Hintergrund ab (Kontrast ${k.toFixed(1)}).` });
    }
  }
  return befunde;
}

/**
 * Misst die Ausdehnung aller Formen außer dem Hintergrund, in Prozent der
 * Kantenlänge. Striche werden um die halbe Strichbreite erweitert.
 *
 * @param {HTMLElement} host
 */
function messeAusdehnung(host) {
  const svg = host.shadowRoot?.querySelector("svg");
  if (!svg) {
    return null;
  }
  const rahmen = svg.getBoundingClientRect();
  const skala = rahmen.width / 400;
  let links = Infinity;
  let oben = Infinity;
  let rechts = -Infinity;
  let unten = -Infinity;
  for (const el of svg.querySelectorAll(FORMEN)) {
    const istHintergrund = el.tagName === "rect" && el.getAttribute("width") === "400" && el.getAttribute("height") === "400";
    if (istHintergrund) {
      continue;
    }
    const r = el.getBoundingClientRect();
    const strich = el.closest(".vl,.hl,.f1l,.f2l,.f3l,.d1l") ? parseFloat(getComputedStyle(el).strokeWidth) || 0 : 0;
    const rand = strich * 0.5 * skala;
    links = Math.min(links, r.left - rand);
    oben = Math.min(oben, r.top - rand);
    rechts = Math.max(rechts, r.right + rand);
    unten = Math.max(unten, r.bottom + rand);
  }
  const prozent = (/** @type {number} */ px) => (px / rahmen.width) * 100;
  return {
    breite: prozent(rechts - links),
    hoehe: prozent(unten - oben),
    ausserhalb: links < rahmen.left - 0.5 || oben < rahmen.top - 0.5 || rechts > rahmen.right + 0.5 || unten > rahmen.bottom + 0.5,
  };
}

/**
 * Hält alle Animationen eines Motivs an der Stelle größter Auslenkung an:
 * bei hin- und herlaufenden Animationen am Ende des ersten Durchlaufs, sonst in der Mitte.
 *
 * @param {HTMLElement} host
 */
function zeigeEndpose(host) {
  for (const animation of host.shadowRoot?.getAnimations() ?? []) {
    const timing = animation.effect?.getTiming();
    const dauer = Number(timing?.duration) || 0;
    const verzoegerung = timing?.delay ?? 0;
    animation.pause();
    animation.currentTime = String(timing?.direction).startsWith("alternate") ? verzoegerung + dauer - 1 : verzoegerung + dauer / 2;
  }
}

/**
 * @param {string} beschriftung
 * @param {HTMLElement} host
 * @param {string} [klasse]
 */
function kachel(beschriftung, host, klasse = "") {
  const figur = document.createElement("figure");
  figur.className = `kachel ${klasse}`.trim();
  const unterschrift = document.createElement("figcaption");
  unterschrift.textContent = beschriftung;
  figur.append(host, unterschrift);
  return figur;
}

/**
 * @param {ReturnType<typeof messeAusdehnung>} mass
 * @param {string} pose
 * @returns {Befund}
 */
function bewerteGroesse(mass, pose) {
  if (!mass) {
    return { art: "fehler", text: `${pose}: nicht messbar.` };
  }
  const groesste = Math.max(mass.breite, mass.hoehe);
  const text = `${pose}: ${mass.breite.toFixed(0)} % breit, ${mass.hoehe.toFixed(0)} % hoch.`;
  if (mass.ausserhalb) {
    return { art: "fehler", text: `${text} Ragt über den Rand.` };
  }
  if (groesste < GROESSE_MIN - 5 || groesste > GROESSE_MAX + 5) {
    return { art: "fehler", text: `${text} Ziel ${GROESSE_MIN}–${GROESSE_MAX} %.` };
  }
  if (groesste < GROESSE_MIN || groesste > GROESSE_MAX) {
    return { art: "hinweis", text: `${text} Ziel ${GROESSE_MIN}–${GROESSE_MAX} %.` };
  }
  return { art: "ok", text };
}

/** @param {Motiv} motiv */
async function pruefeMotiv(motiv) {
  const abschnitt = document.createElement("section");
  abschnitt.className = "motiv-pruefung";
  const ueberschrift = document.createElement("h2");
  ueberschrift.textContent = `${motiv.name} (${motiv.datei})`;
  const kacheln = document.createElement("div");
  kacheln.className = "kacheln";

  const ruhe = erzeugeMotiv(motiv, STIL_STATISCH);
  const ende = erzeugeMotiv(motiv);
  const farbig = erzeugeMotiv(motiv);
  setzeFarben(farbig, motiv.farben);
  kacheln.append(
    kachel("Normal, animiert", erzeugeMotiv(motiv)),
    kachel("Invertiert, animiert", erzeugeMotiv(motiv), "invertiert"),
    kachel("Farbmodus, animiert", farbig),
    kachel("Ruhepose (Druck)", ruhe),
    kachel("Endpose der Animation", ende),
  );
  const ergebnisse = document.createElement("ul");
  ergebnisse.className = "ergebnisse";
  abschnitt.append(ueberschrift, kacheln, ergebnisse);
  liste.append(abschnitt);

  await naechstesBild();
  zeigeEndpose(ende);
  await naechstesBild();

  const befunde = [
    ...pruefeQuelltext(motiv),
    bewerteGroesse(messeAusdehnung(ruhe), "Ruhepose"),
    bewerteGroesse(messeAusdehnung(ende), "Endpose"),
  ];
  for (const befund of befunde) {
    const zeile = document.createElement("li");
    zeile.className = befund.art;
    zeile.textContent = befund.text;
    ergebnisse.append(zeile);
  }
  return befunde;
}

/*
 * Optional nur ein Motiv prüfen und größer zeigen:
 *   pruefen.html?motiv=elefant       Motiv aus der Liste
 *   pruefen.html?datei=entwurf.svg   Datei in motive/, auch wenn sie noch nicht in der Liste steht
 * Die Befunde stehen zusätzlich als Text in #ergebnis-text (für werkzeuge/pruefen.sh).
 */
async function start() {
  const parameter = new URLSearchParams(location.search);
  const auswahl = parameter.get("motiv");
  const datei = parameter.get("datei");
  /** @type {Motiv[]} */
  let motive;
  /** @type {string[]} */
  const zeilen = [];
  let fehler = 0;
  let hinweise = 0;
  await ladeSprache(STANDARD);
  if (datei) {
    motive = [await ladeMotiv({ datei })];
    if (!motivListe.some((m) => m.datei === datei)) {
      zeilen.push(`${datei}: HINWEIS Noch nicht in motive/liste.js eingetragen.`);
      hinweise += 1;
    }
  } else {
    motive = (await ladeMotive()).filter((m) => !auswahl || m.id === auswahl);
    if (auswahl && !motive.length) {
      zeilen.push(`${auswahl}: FEHLER Motiv nicht in motive/liste.js gefunden.`);
      fehler += 1;
    }
  }
  if (auswahl || datei) {
    document.documentElement.style.setProperty("--kachel", "min(290px, 44vw)");
  }
  for (const motiv of motive) {
    const befunde = await pruefeMotiv(motiv);
    if (!hat(`motive.${motiv.id}`)) {
      befunde.unshift({
        art: datei ? "hinweis" : "fehler",
        text: `Name fehlt in sprachen/de.json unter "motive" → "${motiv.id}".`,
      });
    }
    fehler += befunde.filter((b) => b.art === "fehler").length;
    hinweise += befunde.filter((b) => b.art === "hinweis").length;
    zeilen.push(...befunde.map((b) => `${motiv.datei}: ${b.art.toUpperCase()} ${b.text}`));
  }
  zusammenfassung.textContent = `${motive.length} Motive geprüft: ${fehler} Fehler, ${hinweise} Hinweise.`;
  zeilen.push(`ERGEBNIS: ${motive.length} Motive, ${fehler} Fehler, ${hinweise} Hinweise`);
  const text = /** @type {HTMLElement} */ (document.getElementById("ergebnis-text"));
  text.textContent = zeilen.join("\n");
  document.body.dataset.fehler = String(fehler);
}

start();
