// @ts-check

import liste from "../klaenge/liste.js";

/*
 * Klangerzeuger. Baut aus einer Klangbeschreibung (JSON im Ordner klaenge/) einen
 * Web-Audio-Graphen. Nichts ist aufgenommen, alles entsteht beim Abspielen.
 *
 * Eine Beschreibung besteht aus Schichten. Jede Schicht ist entweder
 *   - Dauerrauschen ("rauschen": weiss | rosa | braun), live im AudioWorklet erzeugt, oder
 *   - eine Folge von Ereignissen ("ereignisse"), jedes spielt eine kurze Stimme:
 *     einen Ton aus Teiltönen oder einen gefilterten Rauschstoß.
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

/* Planung: so weit im Voraus werden Ereignisse eingeplant. Groß genug für gedrosselte Timer. */
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
 * Lädt den Rauschgenerator einmal pro AudioContext.
 *
 * @param {BaseAudioContext} ctx
 */
export function ladeWorklet(ctx) {
  let laden = worklets.get(ctx);
  if (!laden) {
    laden = ctx.audioWorklet.addModule(new URL("./rauschen-worklet.js", import.meta.url));
    worklets.set(ctx, laden);
  }
  return laden;
}

/** @type {WeakMap<BaseAudioContext, AudioBuffer>} */
const rauschPuffer = new WeakMap();

/**
 * Kurzer Puffer mit weißem Rauschen für Rauschstöße (z. B. Regentropfen).
 * Wird einmal beim Start zufällig erzeugt, jeder Stoß beginnt an zufälliger Stelle.
 *
 * @param {BaseAudioContext} ctx
 */
function weissesRauschen(ctx) {
  let puffer = rauschPuffer.get(ctx);
  if (!puffer) {
    puffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const daten = puffer.getChannelData(0);
    for (let i = 0; i < daten.length; i += 1) {
      daten[i] = Math.random() * 2 - 1;
    }
    rauschPuffer.set(ctx, puffer);
  }
  return puffer;
}

const zufall = (/** @type {number} */ min, /** @type {number} */ max) => min + Math.random() * (max - min);

/* Frequenzbereiche werden logarithmisch gewürfelt, das entspricht dem Hören. */
const zufallsFrequenz = (/** @type {number | [number, number]} */ f) => (Array.isArray(f) ? f[0] * (f[1] / f[0]) ** Math.random() : f);

/* Abklingen auf -60 dB in `nachklang` Sekunden als Zeitkonstante für setTargetAtTime */
const zeitkonstante = (/** @type {number} */ nachklang) => nachklang / 6.9;

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
    this.rauschen = null;
    /** @type {{ welle: Welle, param: AudioParam, basis: number, naechste: number }[]} */
    this.zufallsWellen = [];
    this.naechstesEreignis = 0;
    this.letzteNote = -1;
  }

  /**
   * Startet Rauschquelle und Schwankungen. Sinus-Wellen laufen als eigene
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

    if (s.rauschen) {
      this.rauschen = new AudioWorkletNode(ctx, "rauschen", {
        numberOfInputs: 0,
        outputChannelCount: [2],
        processorOptions: { farbe: s.rauschen },
      });
      this.rauschen.connect(this.eingang);
    }
    this.naechstesEreignis = zeit + 0.1;
  }

  /**
   * Plant Ereignisse und zufällige Schwankungen bis zum Zeitpunkt `bis`.
   *
   * @param {number} bis
   */
  plane(bis) {
    const { s } = this;
    if (s.ereignisse && s.stimme) {
      while (this.naechstesEreignis < bis) {
        this.spiele(this.naechstesEreignis);
        this.naechstesEreignis += this.abstand();
      }
    }
    for (const z of this.zufallsWellen) {
      while (z.naechste < bis) {
        const ziel = z.basis * (1 - Math.random() * z.welle.tiefe);
        z.param.setTargetAtTime(ziel, z.naechste, z.welle.periode / 3);
        z.naechste += z.welle.periode * zufall(0.7, 1.3);
      }
    }
  }

  /** Zeit bis zum nächsten Ereignis: gleichmäßig mit Streuung oder zufällig nach Dichte */
  abstand() {
    const e = this.s.ereignisse ?? {};
    const wert = e.dichte ? -Math.log(1 - Math.random()) / e.dichte : (e.abstand ?? 1) + zufall(-1, 1) * (e.streuung ?? 0);
    return Math.max(0.01, wert);
  }

  /**
   * Ein Ereignis, bei Mustern mehrere Anschläge (z. B. Herzschlag „ba-dum“).
   *
   * @param {number} zeit
   */
  spiele(zeit) {
    const { ctx, s } = this;
    /** @type {AudioNode} */
    let ziel = this.eingang;
    if (s.panorama) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = zufall(-1, 1) * s.panorama;
      panner.connect(this.eingang);
      ziel = panner;
    }
    const streuung = 1 - Math.random() * (s.pegelstreuung ?? 0);
    const faktor = this.grundfrequenz();
    for (const [versatz, pegel, tonhoehe] of s.muster ?? [[0, 1]]) {
      const t = zeit + versatz;
      if (s.stimme?.art === "rauschen") {
        this.rauschstoss(t, pegel * streuung, ziel);
      } else {
        this.ton(t, pegel * streuung, faktor * (tonhoehe ?? 1), ziel);
      }
    }
  }

  /** Frequenz des nächsten Tons. Bei Notenlisten nie zweimal hintereinander dieselbe. */
  grundfrequenz() {
    const st = this.s.stimme ?? /** @type {Stimme} */ ({ art: "ton" });
    if (st.noten?.length) {
      let i = Math.floor(Math.random() * st.noten.length);
      if (st.noten.length > 1 && i === this.letzteNote) {
        i = (i + 1 + Math.floor(Math.random() * (st.noten.length - 1))) % st.noten.length;
      }
      this.letzteNote = i;
      return 440 * 2 ** ((st.noten[i] - 69) / 12);
    }
    return zufallsFrequenz(st.frequenz ?? 440);
  }

  /**
   * Ton aus Sinus-Teiltönen, jeder mit eigener Lautstärke und Ausklingzeit.
   *
   * @param {number} t
   * @param {number} pegel
   * @param {number} frequenz
   * @param {AudioNode} ziel
   */
  ton(t, pegel, frequenz, ziel) {
    const { ctx } = this;
    const st = /** @type {Stimme} */ (this.s.stimme);
    const anschlag = st.anschlag ?? 0.005;
    for (const [verhaeltnis, teilpegel, nachklang] of st.teiltoene ?? [[1, 1, 1]]) {
      const f = frequenz * verhaeltnis;
      if (f >= ctx.sampleRate / 2) {
        continue;
      }
      const osz = ctx.createOscillator();
      if (st.gleiten) {
        osz.frequency.setValueAtTime(f * st.gleiten[0], t);
        osz.frequency.exponentialRampToValueAtTime(f, t + st.gleiten[1]);
      } else {
        osz.frequency.value = f;
      }
      const huelle = ctx.createGain();
      huelle.gain.setValueAtTime(0, t);
      huelle.gain.linearRampToValueAtTime(pegel * teilpegel, t + anschlag);
      huelle.gain.setTargetAtTime(0, t + anschlag, zeitkonstante(nachklang));
      osz.connect(huelle).connect(ziel);
      osz.start(t);
      osz.stop(t + anschlag + nachklang + 0.05);
    }
  }

  /**
   * Kurzer gefilterter Rauschstoß.
   *
   * @param {number} t
   * @param {number} pegel
   * @param {AudioNode} ziel
   */
  rauschstoss(t, pegel, ziel) {
    const { ctx } = this;
    const st = /** @type {Stimme} */ (this.s.stimme);
    const anschlag = st.anschlag ?? 0.002;
    const nachklang = st.nachklang ?? 0.05;
    const quelle = ctx.createBufferSource();
    quelle.buffer = weissesRauschen(ctx);
    /** @type {AudioNode} */
    let letzter = quelle;
    for (const f of st.filter ?? []) {
      const knoten = baueFilter(ctx, f);
      letzter.connect(knoten);
      letzter = knoten;
    }
    const huelle = ctx.createGain();
    huelle.gain.setValueAtTime(0, t);
    huelle.gain.linearRampToValueAtTime(pegel, t + anschlag);
    huelle.gain.setTargetAtTime(0, t + anschlag, zeitkonstante(nachklang));
    letzter.connect(huelle).connect(ziel);
    quelle.start(t, Math.random() * (quelle.buffer.duration - 1));
    quelle.stop(t + anschlag + nachklang + 0.05);
  }

  /** @param {number} zeit */
  stoppe(zeit) {
    for (const quelle of this.quellen) {
      quelle.stop(zeit);
    }
    this.rauschen?.port.postMessage("stopp");
  }

  trenne() {
    this.rauschen?.disconnect();
    this.pegel.disconnect();
  }
}

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
    this.ausgang.connect(ziel);
    this.schichten = beschreibung.schichten.map((s) => new KlangSchicht(ctx, s, this.ausgang));
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
      this.ausgang.disconnect();
    }, (ausblenden + VORLAUF + 0.5) * 1000);
  }
}

/** Lautstärkeregler 0–1 auf Verstärkung: quadratisch, entspricht grob dem Hören */
const verstaerkung = (/** @type {number} */ lautstaerke) => lautstaerke * lautstaerke;

/**
 * Abspielen in Echtzeit mit Lautstärke, weichem Ein-/Ausblenden und Wechsel
 * zwischen Klängen. Der AudioContext darf erst nach einer Nutzeraktion starten.
 */
export class Klangerzeuger {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    /** @type {GainNode | null} */
    this.haupt = null;
    /** @type {KlangGraph | null} */
    this.graph = null;
    /** @type {ReturnType<typeof setInterval> | undefined} */
    this.takt = undefined;
    this.lautstaerke = 0.5;
    this.aktiv = false;
  }

  /*
   * Hauptausgang mit Begrenzer, damit sich überlagernde Ereignisse nie übersteuern.
   * Auf iOS spielt Web Audio sonst nicht bei eingeschaltetem Stummschalter.
   */
  async bereit() {
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
    }
    const sitzung = /** @type {any} */ (navigator).audioSession;
    if (sitzung) {
      sitzung.type = "playback";
    }
    /* resume() noch im Aufruf aus der Bedienung starten, Safari verlangt das */
    const fortsetzen = this.ctx.resume();
    await ladeWorklet(this.ctx);
    await fortsetzen;
    return { ctx: this.ctx, haupt: /** @type {GainNode} */ (this.haupt) };
  }

  /**
   * Startet einen Klang oder wechselt überblendend zu ihm.
   *
   * @param {Beschreibung} beschreibung
   */
  async spiele(beschreibung) {
    this.aktiv = true;
    const { ctx, haupt } = await this.bereit();
    const jetzt = ctx.currentTime;
    this.graph?.beende(jetzt, AUSBLENDEN);
    this.graph = new KlangGraph(ctx, beschreibung, haupt);
    this.graph.starte(jetzt + 0.05, EINBLENDEN);
    haupt.gain.setTargetAtTime(verstaerkung(this.lautstaerke), jetzt, 0.2);
    clearInterval(this.takt);
    const plane = () => this.graph?.plane(ctx.currentTime + VORLAUF);
    plane();
    this.takt = setInterval(plane, TAKT_MS);
  }

  /** Blendet aus und hält den AudioContext danach an (spart Strom). */
  stoppe() {
    this.aktiv = false;
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
      this.graph?.beende(ctx.currentTime, 0.05);
      this.graph = null;
      ctx.suspend();
    }, AUSBLENDEN * 1000 + 300);
  }

  /** @param {number} wert 0 bis 1 */
  setzeLautstaerke(wert) {
    this.lautstaerke = wert;
    if (this.aktiv && this.ctx && this.haupt) {
      this.haupt.gain.setTargetAtTime(verstaerkung(wert), this.ctx.currentTime, 0.1);
    }
  }
}
