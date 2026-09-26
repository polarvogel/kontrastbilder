// @ts-nocheck

/*
 * Klangerzeugung im Audio-Thread (AudioWorklet). Läuft unabhängig vom Haupt-Thread
 * weiter, auch wenn der Browser im Hintergrund oder bei gesperrtem Bildschirm
 * Timer anhält. Zwei Prozessoren:
 *
 *   rauschen    Dauerrauschen weiss / rosa / braun, Stereo, ohne Wiederholung
 *   ereignisse  Folge einzelner Klänge (Töne aus Teiltönen, gefilterte Rauschstöße)
 *               nach der Beschreibung einer Schicht, siehe js/klang.js und README
 *
 * Beide beenden sich nach der Nachricht "stopp": Rauschen sofort, Ereignisse
 * lassen laufende Töne noch ausklingen.
 */

/* Lautstärkeangleich der Rauschfarben (Effektivwert etwa 0,3 bei pegel 1) */
const WEISS = 0.52;
const ROSA = 0.17;
const BRAUN = 5.2;

class Rauschen extends AudioWorkletProcessor {
  constructor(optionen) {
    super();
    this.farbe = optionen.processorOptions?.farbe ?? "weiss";
    this.aktiv = true;
    this.zustand = [new Float64Array(7), new Float64Array(7)];
    this.port.onmessage = () => {
      this.aktiv = false;
    };
  }

  process(_eingaenge, ausgaenge) {
    const kanaele = ausgaenge[0];
    for (let k = 0; k < kanaele.length; k += 1) {
      const kanal = kanaele[k];
      const z = this.zustand[k % 2];
      for (let i = 0; i < kanal.length; i += 1) {
        kanal[i] = this.probe(z);
      }
    }
    return this.aktiv;
  }

  /* Rosa nach Paul Kellet, braun als Integrator mit Leck */
  probe(z) {
    const w = Math.random() * 2 - 1;
    if (this.farbe === "rosa") {
      z[0] = 0.99886 * z[0] + w * 0.0555179;
      z[1] = 0.99332 * z[1] + w * 0.0750759;
      z[2] = 0.969 * z[2] + w * 0.153852;
      z[3] = 0.8665 * z[3] + w * 0.3104856;
      z[4] = 0.55 * z[4] + w * 0.5329522;
      z[5] = -0.7616 * z[5] - w * 0.016898;
      const rosa = z[0] + z[1] + z[2] + z[3] + z[4] + z[5] + z[6] + w * 0.5362;
      z[6] = w * 0.115926;
      return rosa * ROSA;
    }
    if (this.farbe === "braun") {
      z[0] = (z[0] + 0.02 * w) / 1.02;
      return z[0] * BRAUN;
    }
    return w * WEISS;
  }
}

const zufall = (min, max) => min + Math.random() * (max - min);

/* Frequenzbereiche logarithmisch würfeln, das entspricht dem Hören */
const zufallsFrequenz = (f) => (Array.isArray(f) ? f[0] * (f[1] / f[0]) ** Math.random() : f);

/*
 * Biquad-Filter nach dem Audio EQ Cookbook (R. Bristow-Johnson).
 * guete ist das lineare Q, wie beim Bandpass der Web Audio API.
 */
class Biquad {
  constructor(typ, frequenz, guete) {
    const w0 = (2 * Math.PI * Math.min(frequenz, sampleRate * 0.45)) / sampleRate;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * guete);
    let b0;
    let b1;
    let b2;
    if (typ === "hochpass") {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
    } else if (typ === "bandpass") {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    } else {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
    }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  schritt(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/*
 * Eine klingende Stimme: Hüllkurve mit linearem Anschlag und exponentiellem
 * Ausklingen (-60 dB nach `nachklang` Sekunden), Stereo-Position mit gleicher Leistung.
 */
class Stimme {
  constructor(start, pegel, pan) {
    this.start = start;
    this.pegel = pegel;
    const winkel = ((pan + 1) * Math.PI) / 4;
    this.links = Math.cos(winkel);
    this.rechts = Math.sin(winkel);
    this.fertig = false;
  }

  huelle(alter, anschlag, nachklang) {
    if (alter < anschlag) {
      return alter / anschlag;
    }
    return Math.exp((-6.9 * (alter - anschlag)) / nachklang);
  }

  rendere(links, rechts, blockStart) {
    const dt = 1 / sampleRate;
    for (let i = 0; i < links.length; i += 1) {
      const alter = blockStart + i * dt - this.start;
      if (alter < 0) {
        continue;
      }
      const wert = this.probe(alter) * this.pegel;
      links[i] += wert * this.links;
      rechts[i] += wert * this.rechts;
    }
    this.fertig = blockStart + links.length * dt - this.start > this.dauer;
  }
}

class Ton extends Stimme {
  constructor(start, pegel, pan, frequenz, st) {
    super(start, pegel, pan);
    this.anschlag = st.anschlag ?? 0.005;
    this.gleiten = st.gleiten;
    this.teile = (st.teiltoene ?? [[1, 1, 1]])
      .filter(([verhaeltnis]) => frequenz * verhaeltnis < sampleRate / 2)
      .map(([verhaeltnis, teilpegel, nachklang]) => ({ f: frequenz * verhaeltnis, teilpegel, nachklang, phase: 0 }));
    this.dauer = this.anschlag + Math.max(...this.teile.map((t) => t.nachklang), 0);
  }

  probe(alter) {
    let summe = 0;
    let faktor = 1;
    if (this.gleiten && alter < this.gleiten[1]) {
      faktor = this.gleiten[0] ** (1 - alter / this.gleiten[1]);
    }
    for (const teil of this.teile) {
      teil.phase += (2 * Math.PI * teil.f * faktor) / sampleRate;
      if (teil.phase > 2 * Math.PI) {
        teil.phase -= 2 * Math.PI;
      }
      summe += Math.sin(teil.phase) * teil.teilpegel * this.huelle(alter, this.anschlag, teil.nachklang);
    }
    return summe;
  }
}

class Rauschstoss extends Stimme {
  constructor(start, pegel, pan, st) {
    super(start, pegel, pan);
    this.anschlag = st.anschlag ?? 0.002;
    this.nachklang = st.nachklang ?? 0.05;
    this.filter = (st.filter ?? []).map((f) => new Biquad(f.typ, zufallsFrequenz(f.frequenz), f.guete ?? 0.707));
    this.dauer = this.anschlag + this.nachklang;
  }

  probe(alter) {
    let x = Math.random() * 2 - 1;
    for (const filter of this.filter) {
      x = filter.schritt(x);
    }
    return x * this.huelle(alter, this.anschlag, this.nachklang);
  }
}

class Ereignisse extends AudioWorkletProcessor {
  constructor(optionen) {
    super();
    this.s = optionen.processorOptions.schicht;
    this.stimmen = [];
    this.naechstes = currentTime + 0.1;
    this.letzteNote = -1;
    this.aktiv = true;
    this.port.onmessage = () => {
      this.aktiv = false;
    };
  }

  /* Zeit bis zum nächsten Ereignis: gleichmäßig mit Streuung oder zufällig nach Dichte */
  abstand() {
    const e = this.s.ereignisse ?? {};
    const wert = e.dichte ? -Math.log(1 - Math.random()) / e.dichte : (e.abstand ?? 1) + zufall(-1, 1) * (e.streuung ?? 0);
    return Math.max(0.01, wert);
  }

  /* Frequenz des nächsten Tons, bei Notenlisten nie zweimal hintereinander dieselbe */
  grundfrequenz() {
    const st = this.s.stimme;
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

  /* Ein Ereignis, bei Mustern mehrere Anschläge (z. B. Herzschlag „ba-dum“) */
  spiele(zeit) {
    const { s } = this;
    const st = s.stimme;
    const pan = s.panorama ? zufall(-1, 1) * s.panorama : 0;
    const streuung = 1 - Math.random() * (s.pegelstreuung ?? 0);
    const frequenz = st.art === "rauschen" ? 0 : this.grundfrequenz();
    for (const [versatz, pegel, tonhoehe] of s.muster ?? [[0, 1]]) {
      const start = zeit + versatz;
      const lautstaerke = pegel * streuung;
      this.stimmen.push(
        st.art === "rauschen"
          ? new Rauschstoss(start, lautstaerke, pan, st)
          : new Ton(start, lautstaerke, pan, frequenz * (tonhoehe ?? 1), st),
      );
    }
  }

  process(_eingaenge, ausgaenge) {
    const [links, rechts] = ausgaenge[0];
    const blockEnde = currentTime + links.length / sampleRate;
    while (this.aktiv && this.s.stimme && this.naechstes < blockEnde) {
      this.spiele(this.naechstes);
      this.naechstes += this.abstand();
    }
    for (const stimme of this.stimmen) {
      stimme.rendere(links, rechts, currentTime);
    }
    this.stimmen = this.stimmen.filter((stimme) => !stimme.fertig);
    return this.aktiv || this.stimmen.length > 0;
  }
}

registerProcessor("rauschen", Rauschen);
registerProcessor("ereignisse", Ereignisse);
