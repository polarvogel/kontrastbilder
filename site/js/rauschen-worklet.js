// @ts-nocheck

/*
 * Rauschgenerator als AudioWorklet. Erzeugt fortlaufend neues Rauschen, Probe für
 * Probe, ohne Wiederholung. Stereo mit unabhängigen Kanälen, damit es räumlich klingt.
 *
 * Farben:
 *   weiss  gleiche Energie über alle Frequenzen, hell und zischend
 *   rosa   Energie fällt um 3 dB pro Oktave, weicher (Filter nach Paul Kellet)
 *   braun  Energie fällt um 6 dB pro Oktave, dumpf und rauschend (Integrator mit Leck)
 *
 * Die Faktoren am Ende gleichen die Lautstärke der drei Farben grob an
 * (Effektivwert etwa 0,3 bei pegel 1).
 */
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

const WEISS = 0.52;
const ROSA = 0.17;
const BRAUN = 5.2;

registerProcessor("rauschen", Rauschen);
