// @ts-check

import { KlangGraph, ladeWorklet } from "../site/js/klang.js";
import liste from "../site/klaenge/liste.js";
import { pruefeSchema } from "./schema.js";

/*
 * Prüft Klangbeschreibungen, die niemand anhören muss: Aufbau gegen das Schema,
 * dann 20 s offline rendern und messen. Ziele wie bei den vorhandenen Klängen:
 * Effektivwert etwa -20 dB (±4), Spitzen unter -3 dB.
 * Ergebnis als Textzeilen in #ergebnis-text: "<datei>: OK|HINWEIS|FEHLER <Text>".
 */

const SEKUNDEN = 20;
const RATE = 44100;
const MESSBEGINN = 3;
const ZIEL_RMS = -20;
const TOLERANZ = 4;

const db = (/** @type {number} */ x) => 20 * Math.log10(Math.max(x, 1e-9));

/** @param {any} beschreibung */
async function rendere(beschreibung) {
  const ctx = new OfflineAudioContext(2, SEKUNDEN * RATE, RATE);
  await ladeWorklet(ctx);
  const graph = new KlangGraph(ctx, beschreibung, ctx.destination);
  graph.starte(0, 0.01);
  graph.plane(SEKUNDEN);
  return ctx.startRendering();
}

/**
 * Effektivwert, Spitze und Einsätze (plötzliche Pegelanstiege in 20-ms-Fenstern).
 *
 * @param {AudioBuffer} puffer
 */
function messe(puffer) {
  const kanaele = [puffer.getChannelData(0), puffer.getChannelData(1)];
  const start = RATE * MESSBEGINN;
  const fenster = RATE * 0.02;
  let summe = 0;
  let spitze = 0;
  let ungueltig = false;
  /** @type {number[]} */
  const huelle = [];
  for (let i = start; i + fenster <= kanaele[0].length; i += fenster) {
    let fensterSumme = 0;
    for (let j = i; j < i + fenster; j += 1) {
      for (const k of kanaele) {
        const x = k[j];
        if (!Number.isFinite(x)) {
          ungueltig = true;
        }
        fensterSumme += x * x;
        spitze = Math.max(spitze, Math.abs(x));
      }
    }
    summe += fensterSumme;
    huelle.push(Math.sqrt(fensterSumme / (2 * fenster)));
  }
  const anzahl = huelle.length * fenster * 2;
  const schwelle = Math.max(...huelle) * 0.2;
  /** @type {number[]} */
  const einsaetze = [];
  for (let i = 3; i < huelle.length; i += 1) {
    const vorher = Math.max(huelle[i - 3], huelle[i - 2]);
    const zeit = MESSBEGINN + i * 0.02;
    if (huelle[i] > schwelle && huelle[i] > vorher * 2.5 && (!einsaetze.length || zeit - einsaetze[einsaetze.length - 1] > 0.12)) {
      einsaetze.push(zeit);
    }
  }
  const abstaende = einsaetze.slice(1).map((t, i) => t - einsaetze[i]).sort((a, b) => a - b);
  return { rms: db(Math.sqrt(summe / anzahl)), spitze: db(spitze), ungueltig, einsaetze: einsaetze.length, abstaende };
}

/**
 * Regeln, die das Schema nicht ausdrücken kann.
 *
 * @param {any} beschreibung
 * @returns {[string, string][]}
 */
function zusatzregeln(beschreibung) {
  /** @type {[string, string][]} */
  const befunde = [];
  beschreibung.schichten.forEach((/** @type {any} */ s, /** @type {number} */ i) => {
    const ort = `schichten[${i}]`;
    const st = s.stimme;
    if (st?.art === "ton" && !st.noten && st.frequenz === undefined) {
      befunde.push(["HINWEIS", `${ort}.stimme: weder noten noch frequenz, es klingt 440 Hz.`]);
    }
    if (st?.art === "ton" && st.filter) {
      befunde.push(["FEHLER", `${ort}.stimme.filter wirkt nur bei art "rauschen". Für Töne den Filter an die Schicht hängen.`]);
    }
    if (st?.art === "rauschen" && (st.noten || st.frequenz !== undefined || st.teiltoene || st.gleiten)) {
      befunde.push(["FEHLER", `${ort}.stimme: noten, frequenz, teiltoene und gleiten gelten nur für art "ton".`]);
    }
    const e = s.ereignisse;
    if (e?.abstand !== undefined && (e.streuung ?? 0) >= e.abstand) {
      befunde.push(["FEHLER", `${ort}.ereignisse: streuung muss kleiner als abstand sein.`]);
    }
    if (e?.dichte !== undefined && e.streuung !== undefined) {
      befunde.push(["HINWEIS", `${ort}.ereignisse: streuung wirkt nur mit abstand, nicht mit dichte.`]);
    }
    const kuerzester = e?.abstand !== undefined ? e.abstand - (e.streuung ?? 0) : e?.dichte ? 0 : Infinity;
    if (st?.art === "ton" && kuerzester < 0.5) {
      befunde.push(["HINWEIS", `${ort}: Töne können schneller als alle 0,5 s kommen. Projektregel: langsame Folgen, keine Akkorde.`]);
    }
    if (s.rauschen && (s.stimme || s.muster || s.pegelstreuung !== undefined || s.panorama !== undefined)) {
      befunde.push(["HINWEIS", `${ort}: stimme, muster, pegelstreuung und panorama wirken nur bei ereignisse.`]);
    }
  });
  return befunde;
}

/**
 * @param {string} datei
 * @param {any} schema
 * @returns {Promise<[string, string][]>}
 */
async function pruefe(datei, schema) {
  /** @type {[string, string][]} */
  const befunde = [];
  if (!liste.some((k) => k.datei === datei)) {
    befunde.push(["HINWEIS", "Noch nicht in site/klaenge/liste.js eingetragen."]);
  }
  const antwort = await fetch(`../site/klaenge/${datei}`, { cache: "no-cache" });
  if (!antwort.ok) {
    return [...befunde, ["FEHLER", `Datei nicht gefunden (HTTP ${antwort.status}).`]];
  }
  /** @type {any} */
  let beschreibung;
  try {
    beschreibung = JSON.parse(await antwort.text());
  } catch (grund) {
    return [...befunde, ["FEHLER", `Kein gültiges JSON: ${grund}`]];
  }
  const schemaFehler = pruefeSchema(schema, beschreibung);
  if (schemaFehler.length) {
    return [...befunde, ...schemaFehler.map((text) => /** @type {[string, string]} */ (["FEHLER", text]))];
  }
  befunde.push(...zusatzregeln(beschreibung));

  const m = messe(await rendere(beschreibung));
  if (m.ungueltig) {
    befunde.push(["FEHLER", "Ausgabe enthält ungültige Werte (NaN/Infinity)."]);
    return befunde;
  }
  if (m.rms < -60) {
    befunde.push(["FEHLER", `Praktisch stumm (Effektivwert ${m.rms.toFixed(1)} dB).`]);
    return befunde;
  }
  const pegel = `Effektivwert ${m.rms.toFixed(1)} dB (Ziel ${ZIEL_RMS} ± ${TOLERANZ}), Spitze ${m.spitze.toFixed(1)} dB (Ziel unter -3).`;
  if (Math.abs(m.rms - ZIEL_RMS) > TOLERANZ) {
    const faktor = 10 ** ((ZIEL_RMS - m.rms) / 20);
    befunde.push(["HINWEIS", `${pegel} Alle pegel etwa mit ${faktor.toFixed(2)} multiplizieren.`]);
  } else {
    befunde.push(["OK", pegel]);
  }
  if (m.spitze > -1) {
    befunde.push(["FEHLER", `Übersteuert: Spitze ${m.spitze.toFixed(1)} dB. pegel der lautesten Schicht senken.`]);
  } else if (m.spitze > -3) {
    befunde.push(["HINWEIS", `Spitze ${m.spitze.toFixed(1)} dB knapp am Begrenzer.`]);
  }
  if (beschreibung.schichten.some((/** @type {any} */ s) => s.ereignisse) && m.abstaende.length) {
    const a = m.abstaende;
    befunde.push([
      "OK",
      `${m.einsaetze} Einsätze in ${SEKUNDEN - MESSBEGINN} s, Abstände min ${a[0].toFixed(2)} s, Median ${a[Math.floor(a.length / 2)].toFixed(2)} s, max ${a[a.length - 1].toFixed(2)} s (grob gemessen).`,
    ]);
  }
  return befunde;
}

async function start() {
  const parameter = new URLSearchParams(location.search);
  const klang = parameter.get("klang");
  const datei = parameter.get("datei");
  const schema = await (await fetch("klang.schema.json", { cache: "no-cache" })).json();
  const dateien = datei ? [datei] : klang ? [`${klang}.json`] : liste.map((k) => k.datei);
  /** @type {string[]} */
  const zeilen = [];
  let fehler = 0;
  let hinweise = 0;
  for (const d of dateien) {
    for (const [art, text] of await pruefe(d, schema)) {
      zeilen.push(`${d}: ${art} ${text}`);
      fehler += art === "FEHLER" ? 1 : 0;
      hinweise += art === "HINWEIS" ? 1 : 0;
    }
  }
  zeilen.push(`ERGEBNIS: ${dateien.length} Klänge, ${fehler} Fehler, ${hinweise} Hinweise`);
  const ausgabe = /** @type {HTMLElement} */ (document.getElementById("ergebnis-text"));
  ausgabe.textContent = zeilen.join("\n");
}

start().catch((grund) => {
  const ausgabe = /** @type {HTMLElement} */ (document.getElementById("ergebnis-text"));
  ausgabe.textContent = `FEHLER Prüfung abgebrochen: ${grund}\nERGEBNIS: abgebrochen`;
});
