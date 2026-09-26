// @ts-check

import liste from "../klaenge/liste.js";

/*
 * Klangerzeuger. Baut aus einer Klangbeschreibung (JSON im Ordner klaenge/) einen
 * Web-Audio-Graphen. Nichts ist aufgenommen, alles entsteht beim Abspielen.
 *
 * Eine Beschreibung besteht aus Schichten. Jede Schicht ist entweder
 *   - Dauerrauschen ("rauschen": weiss | rosa | braun) oder
 *   - eine Folge von Ereignissen ("ereignisse"), jedes spielt eine kurze Stimme:
 *     einen Ton aus Teiltönen oder einen gefilterten Rauschstoß.
 * Beides entsteht im AudioWorklet (js/klang-worklet.js), also im Audio-Thread. Dadurch
 * läuft der Klang auch weiter, wenn der Browser im Hintergrund Timer anhält.
 * Jede Schicht hat einen Pegel, optional feste Filter und langsame Schwankungen ("wellen")
 * von Pegel oder Filterfrequenz. Das Format ist im README beschrieben.
 */

/**
 * @typedef {Object} Filter
 * @property {"tiefpass" | "hochpass" | "bandpass"} typ
 * @property {number | [number, number]} frequenz  fest oder Bereich (Zufall je Ereignis)
 * @property {number} [guete]
 *
 * @typedef {Object} Welle
 * @property {"pegel" | "filter"} ziel
 * @property {"sinus" | "zufall"} [form]
 * @property {number} periode   Sekunden
 * @property {number} tiefe     0 bis 1
 * @property {number} [versatz] Phase 0 bis 1 (nur sinus)
 *
 * @typedef {Object} Stimme
 * @property {"ton" | "rauschen"} art
 * @property {number[]} [noten]                         MIDI-Nummern, zufällige Auswahl
 * @property {number | [number, number]} [frequenz]     Hz, fest oder Bereich
 * @property {[number, number, number][]} [teiltoene]   [Verhältnis, Pegel, Nachklang in s]
 * @property {[number, number]} [gleiten]               [Startfaktor, Dauer in s]
 * @property {Filter[]} [filter]
 * @property {number} [anschlag]                        Einschwingzeit in s
 * @property {number} [nachklang]                       Ausklingzeit in s (nur rauschen)
 *
 * @typedef {Object} Schicht
 * @property {"weiss" | "rosa" | "braun"} [rauschen]
 * @property {{ abstand?: number, streuung?: number, dichte?: number }} [ereignisse]
 * @property {[number, number, number?][]} [muster]  [Versatz s, Pegel, Tonhöhenfaktor]
 * @property {Stimme} [stimme]
 * @property {number} pegel
 * @property {number} [pegelstreuung]
 * @property {number} [panorama]
 * @property {Filter[]} [filter]
 * @property {Welle[]} [wellen]
 *
 * @typedef {{ schichten: Schicht[] }} Beschreibung
 * @typedef {{ datei: string, name: string }} KlangEintrag
 * @typedef {KlangEintrag & { id: string, beschreibung: Beschreibung }} Klang
 */

/* Vorlauf für zufällige Schwankungen, die der Haupt-Thread einplant */
const VORLAUF = 1.5;
const TAKT_MS = 250;
const EINBLENDEN = 2;
const AUSBLENDEN = 1.2;

const FILTERTYP = { tiefpass: "lowpass", hochpass: "highpass", bandpass: "bandpass" };

/**
 * Lädt alle Klänge aus der Liste. Fehlerhafte Dateien werden übersprungen.
 *
 * @returns {Promise<Klang[]>}
 */
export async function ladeKlaenge() {
  const ergebnisse = await Promise.allSettled(
    liste.map(async (eintrag) => {
      const antwort = await fetch(`klaenge/${eintrag.datei}`);
      if (!antwort.ok) {
        throw new Error(`HTTP ${antwort.status}`);
      }
      return { ...eintrag, id: eintrag.datei.replace(/\.json$/, ""), beschreibung: await antwort.json() };
    }),
  );
  /** @type {Klang[]} */
  const klaenge = [];
  ergebnisse.forEach((ergebnis, i) => {
    if (ergebnis.status === "fulfilled") {
      klaenge.push(ergebnis.value);
    } else {
      console.warn(`Klang ${liste[i].datei} nicht geladen:`, ergebnis.reason);
    }
  });
  return klaenge;
}

/** @type {WeakMap<BaseAudioContext, Promise<void>>} */
const worklets = new WeakMap();

/**
 * Lädt die Klangerzeugung im Audio-Thread einmal pro AudioContext.
 *
 * @param {BaseAudioContext} ctx
 */
export function ladeWorklet(ctx) {
  let laden = worklets.get(ctx);
  if (!laden) {
    laden = ctx.audioWorklet.addModule(new URL("./klang-worklet.js", import.meta.url));
    worklets.set(ctx, laden);
  }
  return laden;
}

const zufall = (/** @type {number} */ min, /** @type {number} */ max) => min + Math.random() * (max - min);

/* Frequenzbereiche werden logarithmisch gewürfelt, das entspricht dem Hören. */
const zufallsFrequenz = (/** @type {number | [number, number]} */ f) => (Array.isArray(f) ? f[0] * (f[1] / f[0]) ** Math.random() : f);

/**
 * Sinus mit Phasenversatz als PeriodicWave: sin(wt + 2*pi*versatz).
 *
 * @param {BaseAudioContext} ctx
 * @param {number} versatz
 */
function sinusMitVersatz(ctx, versatz) {
  const phase = 2 * Math.PI * versatz;
  return ctx.createPeriodicWave(new Float32Array([0, Math.sin(phase)]), new Float32Array([0, Math.cos(phase)]), {
    disableNormalization: true,
  });
}

/**
 * @param {BaseAudioContext} ctx
 * @param {Filter} filter
 */
function baueFilter(ctx, filter) {
  const knoten = ctx.createBiquadFilter();
  knoten.type = /** @type {BiquadFilterType} */ (FILTERTYP[filter.typ]);
  knoten.frequency.value = zufallsFrequenz(filter.frequenz);
  knoten.Q.value = filter.guete ?? 0.7;
  return knoten;
}

/** Eine Schicht eines Klangs mit eigener Filterkette und eigenem Pegel. */
class KlangSchicht {
  /**
   * @param {BaseAudioContext} ctx
   * @param {Schicht} s
   * @param {AudioNode} ziel
   */
  constructor(ctx, s, ziel) {
    this.ctx = ctx;
    this.s = s;
    this.pegel = ctx.createGain();
    this.filter = (s.filter ?? []).map((f) => baueFilter(ctx, f));
    /** @type {AudioNode[]} */
    const kette = [...this.filter, this.pegel];
    kette.slice(0, -1).forEach((knoten, i) => knoten.connect(kette[i + 1]));
    this.pegel.connect(ziel);
    this.eingang = kette[0];

    /** @type {AudioScheduledSourceNode[]} */
    this.quellen = [];
    /** @type {AudioWorkletNode | null} */
    this.erzeuger = null;
    /** @type {{ welle: Welle, param: AudioParam, basis: number, naechste: number }[]} */
    this.zufallsWellen = [];
  }

  /**
   * Startet Erzeuger (Rauschen oder Ereignisse) und Schwankungen. Sinus-Wellen laufen als eigene
   * Oszillatoren, deren Ausgang auf den Pegel bzw. die Filterfrequenz addiert wird.
   *
   * @param {number} zeit
   */
  starte(zeit) {
    const { ctx, s } = this;
    const wellen = s.wellen ?? [];
    const ziele = {
      pegel: { param: this.pegel.gain, wert: s.pegel },
      filter: this.filter[0] ? { param: this.filter[0].frequency, wert: this.filter[0].frequency.value } : null,
    };
    for (const [name, ziel] of Object.entries(ziele)) {
      if (!ziel) {
        continue;
      }
      const eigene = wellen.filter((w) => (w.ziel ?? "pegel") === name);
      const summeSinus = Math.min(
        1,
        eigene.filter((w) => w.form !== "zufall").reduce((summe, w) => summe + w.tiefe, 0),
      );
      const basis = ziel.wert * (1 - summeSinus / 2);
      ziel.param.setValueAtTime(basis, zeit);
      for (const welle of eigene) {
        if (welle.form === "zufall") {
          this.zufallsWellen.push({ welle, param: ziel.param, basis, naechste: zeit });
          continue;
        }
        const lfo = ctx.createOscillator();
        lfo.setPeriodicWave(sinusMitVersatz(ctx, welle.versatz ?? 0));
        lfo.frequency.value = 1 / welle.periode;
        const tiefe = ctx.createGain();
        tiefe.gain.value = (ziel.wert * welle.tiefe) / 2;
        lfo.connect(tiefe).connect(ziel.param);
        lfo.start(zeit);
        this.quellen.push(lfo);
      }
    }

    if (s.rauschen || s.ereignisse) {
      this.erzeuger = new AudioWorkletNode(ctx, s.rauschen ? "rauschen" : "ereignisse", {
        numberOfInputs: 0,
        outputChannelCount: [2],
        processorOptions: s.rauschen ? { farbe: s.rauschen } : { schicht: s },
      });
      this.erzeuger.connect(this.eingang);
    }
  }

  /**
   * Plant zufällige Schwankungen bis zum Zeitpunkt `bis`. Bleibt der Haupt-Thread im
   * Hintergrund stehen, hält der Wert einfach, der Klang selbst läuft weiter.
   *
   * @param {number} bis
   */
  plane(bis) {
    for (const z of this.zufallsWellen) {
      while (z.naechste < bis) {
        const ziel = z.basis * (1 - Math.random() * z.welle.tiefe);
        z.param.setTargetAtTime(ziel, z.naechste, z.welle.periode / 3);
        z.naechste += z.welle.periode * zufall(0.7, 1.3);
      }
    }
  }

  /** @param {number} zeit */
  stoppe(zeit) {
    for (const quelle of this.quellen) {
      quelle.stop(zeit);
    }
    this.erzeuger?.port.postMessage("stopp");
  }

  trenne() {
    this.erzeuger?.disconnect();
    this.pegel.disconnect();
  }
}

/** Lautstärkeregler 0–1 auf Verstärkung: quadratisch, entspricht grob dem Hören */
const verstaerkung = (/** @type {number} */ lautstaerke) => lautstaerke * lautstaerke;

/** Ein kompletter Klang aus mehreren Schichten mit gemeinsamem Ein- und Ausblenden. */
export class KlangGraph {
  /**
   * @param {BaseAudioContext} ctx
   * @param {Beschreibung} beschreibung
   * @param {AudioNode} ziel
   */
  constructor(ctx, beschreibung, ziel) {
    this.ctx = ctx;
    this.ausgang = ctx.createGain();
    this.ausgang.gain.value = 0;
    this.mischer = ctx.createGain();
    this.ausgang.connect(this.mischer).connect(ziel);
    this.schichten = beschreibung.schichten.map((s) => new KlangSchicht(ctx, s, this.ausgang));
  }

  /**
   * Anteil dieses Klangs im Mischpult (0–1, quadratisch wie der Hauptregler).
   *
   * @param {number} wert
   */
  setzeAnteil(wert) {
    this.mischer.gain.setTargetAtTime(verstaerkung(wert), this.ctx.currentTime, 0.1);
  }

  /**
   * @param {number} zeit
   * @param {number} einblenden Sekunden
   */
  starte(zeit, einblenden) {
    this.ausgang.gain.setValueAtTime(0, zeit);
    this.ausgang.gain.setTargetAtTime(1, zeit, einblenden / 4);
    this.schichten.forEach((s) => s.starte(zeit));
  }

  /** @param {number} bis */
  plane(bis) {
    this.schichten.forEach((s) => s.plane(bis));
  }

  /**
   * Blendet aus und baut den Graphen danach ab.
   *
   * @param {number} zeit
   * @param {number} ausblenden Sekunden
   */
  beende(zeit, ausblenden) {
    this.ausgang.gain.setTargetAtTime(0, zeit, ausblenden / 4);
    this.schichten.forEach((s) => s.stoppe(zeit + ausblenden));
    setTimeout(() => {
      this.schichten.forEach((s) => s.trenne());
      this.mischer.disconnect();
    }, (ausblenden + VORLAUF + 0.5) * 1000);
  }
}

/**
 * Eine halbe Sekunde digitale Stille als WAV (8 kHz, 8 Bit), zur Laufzeit erzeugt.
 * Ein laufendes Medienelement markiert die Seite auf iOS als Medienwiedergabe.
 */
function stilleWav() {
  const laenge = 4000;
  const daten = new DataView(new ArrayBuffer(44 + laenge));
  const text = (/** @type {number} */ stelle, /** @type {string} */ zeichen) =>
    [...zeichen].forEach((z, i) => daten.setUint8(stelle + i, z.charCodeAt(0)));
  text(0, "RIFF");
  daten.setUint32(4, 36 + laenge, true);
  text(8, "WAVE");
  text(12, "fmt ");
  daten.setUint32(16, 16, true);
  daten.setUint16(20, 1, true);
  daten.setUint16(22, 1, true);
  daten.setUint32(24, 8000, true);
  daten.setUint32(28, 8000, true);
  daten.setUint16(32, 1, true);
  daten.setUint16(34, 8, true);
  text(36, "data");
  daten.setUint32(40, laenge, true);
  new Uint8Array(daten.buffer, 44).fill(128);
  return URL.createObjectURL(new Blob([daten.buffer], { type: "audio/wav" }));
}

/**
 * Abspielen in Echtzeit mit Lautstärke, weichem Ein-/Ausblenden und Wechsel
 * zwischen Klängen. Der AudioContext darf erst nach einer Nutzeraktion starten.
 *
 * Hintergrund und Sperrbildschirm (vor allem iOS):
 *   - navigator.audioSession.type = "playback" (Safari ab 16.4, im Hintergrund ab iOS 17.5)
 *     macht aus der Seite eine Medienwiedergabe, statt sie wie Umgebungston stumm zu schalten.
 *   - Ein stilles Medienelement in Schleife, gestartet direkt in der Bedienung, hält die
 *     Audio-Sitzung zusätzlich offen und liefert die Steuerung auf dem Sperrbildschirm.
 *   - Nach Unterbrechungen (Anruf, Siri) wird fortgesetzt, sobald das System es erlaubt.
 */
export class Klangerzeuger {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    /** @type {GainNode | null} */
    this.haupt = null;
    /** @type {Map<string, KlangGraph>} */
    this.graphen = new Map();
    this.anzahl = 0;
    /** @type {HTMLAudioElement | null} */
    this.stille = null;
    /** @type {ReturnType<typeof setInterval> | undefined} */
    this.takt = undefined;
    this.lautstaerke = 0.5;
    this.aktiv = false;
    /* Anzeige auf dem Sperrbildschirm, von der App in der gewählten Sprache gesetzt */
    this.kuenstler = "Kontrastbilder";
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.fortsetzen();
      }
    });
  }

  /*
   * Alles bis zum ersten await läuft noch innerhalb der Bedienung. Safari erlaubt
   * Ton nur dort, deshalb werden Kontext, Stille und resume() hier sofort angestoßen.
   * Der Begrenzer im Ausgang verhindert, dass sich überlagernde Töne übersteuern.
   */
  async bereit() {
    const sitzung = /** @type {any} */ (navigator).audioSession;
    if (sitzung && sitzung.type !== "playback") {
      sitzung.type = "playback";
    }
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: "playback" });
      this.haupt = this.ctx.createGain();
      this.haupt.gain.value = 0;
      const begrenzer = this.ctx.createDynamicsCompressor();
      begrenzer.threshold.value = -3;
      begrenzer.knee.value = 3;
      begrenzer.ratio.value = 20;
      begrenzer.attack.value = 0.003;
      begrenzer.release.value = 0.25;
      this.haupt.connect(begrenzer).connect(this.ctx.destination);
      this.ctx.addEventListener("statechange", () => {
        if (this.ctx?.state !== "running") {
          this.fortsetzen();
        }
      });
    }
    if (!this.stille) {
      this.stille = new Audio(stilleWav());
      this.stille.loop = true;
      this.stille.setAttribute("playsinline", "");
    }
    const stilleLaeuft = this.stille.play().catch(() => undefined);
    const laeuft = this.ctx.resume();
    await ladeWorklet(this.ctx);
    await Promise.all([laeuft, stilleLaeuft]);
    return { ctx: this.ctx, haupt: /** @type {GainNode} */ (this.haupt) };
  }

  /** Nach Unterbrechung oder Rückkehr in den Vordergrund weiterspielen, falls gewünscht. */
  fortsetzen() {
    if (!this.aktiv || !this.ctx) {
      return;
    }
    this.stille?.play().catch(() => undefined);
    this.ctx.resume().catch(() => undefined);
  }

  /**
   * Spielt eine Auswahl von Klängen gleichzeitig. Neue Klänge werden eingeblendet,
   * abgewählte ausgeblendet, laufende behalten ihren Zustand und ändern nur ihren Anteil.
   * Mehrere Klänge addieren sich; damit es insgesamt nicht lauter wird, sinkt der
   * Hauptpegel mit 1/√Anzahl.
   *
   * @param {{ id: string, beschreibung: Beschreibung, anteil: number, titel: string }[]} auswahl
   */
  async spiele(auswahl) {
    this.aktiv = true;
    this.zeigeTitel(auswahl.map((k) => k.titel).join(" + ") || null, "playing");
    const { ctx, haupt } = await this.bereit();
    if (!this.aktiv) {
      return;
    }
    const jetzt = ctx.currentTime;
    const gewuenscht = new Set(auswahl.map((k) => k.id));
    for (const [id, graph] of this.graphen) {
      if (!gewuenscht.has(id)) {
        graph.beende(jetzt, AUSBLENDEN);
        this.graphen.delete(id);
      }
    }
    for (const klang of auswahl) {
      let graph = this.graphen.get(klang.id);
      if (!graph) {
        graph = new KlangGraph(ctx, klang.beschreibung, haupt);
        graph.starte(jetzt + 0.05, EINBLENDEN);
        this.graphen.set(klang.id, graph);
      }
      graph.setzeAnteil(klang.anteil);
    }
    this.anzahl = auswahl.length;
    this.setzeLautstaerke(this.lautstaerke);
    clearInterval(this.takt);
    const plane = () => this.graphen.forEach((graph) => graph.plane(ctx.currentTime + VORLAUF));
    plane();
    this.takt = setInterval(plane, TAKT_MS);
  }

  /**
   * Anteil eines laufenden Klangs ändern, ohne ihn neu zu starten.
   *
   * @param {string} id
   * @param {number} anteil
   */
  setzeAnteil(id, anteil) {
    this.graphen.get(id)?.setzeAnteil(anteil);
  }

  /** Blendet aus und hält den AudioContext danach an (spart Strom). */
  stoppe() {
    this.aktiv = false;
    this.zeigeTitel(null, "paused");
    const { ctx, haupt } = this;
    if (!ctx || !haupt) {
      return;
    }
    haupt.gain.setTargetAtTime(0, ctx.currentTime, AUSBLENDEN / 4);
    setTimeout(() => {
      if (this.aktiv) {
        return;
      }
      clearInterval(this.takt);
      this.graphen.forEach((graph) => graph.beende(ctx.currentTime, 0.05));
      this.graphen.clear();
      this.stille?.pause();
      ctx.suspend();
    }, AUSBLENDEN * 1000 + 300);
  }

  /** @param {number} wert 0 bis 1 */
  setzeLautstaerke(wert) {
    this.lautstaerke = wert;
    if (this.aktiv && this.ctx && this.haupt) {
      const ausgleich = 1 / Math.sqrt(Math.max(1, this.anzahl));
      this.haupt.gain.setTargetAtTime(verstaerkung(wert) * ausgleich, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Titel und Zustand für Sperrbildschirm und Mediensteuerung des Systems.
   *
   * @param {string | null} titel
   * @param {MediaSessionPlaybackState} zustand
   * @param {string} [kuenstler]
   */
  zeigeTitel(titel, zustand, kuenstler = this.kuenstler) {
    if (!("mediaSession" in navigator)) {
      return;
    }
    if (titel) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: titel,
        artist: kuenstler,
        artwork: [{ src: new URL("../icons/icon-512.png", import.meta.url).href, sizes: "512x512", type: "image/png" }],
      });
    }
    navigator.mediaSession.playbackState = zustand;
  }
}
