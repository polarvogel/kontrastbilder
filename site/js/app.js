// @ts-check

import { ladeMotive, erzeugeMotiv, steuereAnimation } from "./motive.js";
import * as speicher from "./einstellungen.js";
import * as wachhalten from "./wachhalten.js";
import { setzeFarben } from "./farben.js";
import { Klangerzeuger, ladeKlaenge } from "./klang.js";

/** @typedef {import("./motive.js").Motiv} Motiv */

/* Zeiten in ms. UEBERGANG muss zu --uebergang in app.css passen. */
const UEBERGANG = 700;
const LEISTE_SICHTBAR = 3000;
const WISCH_MIN = 60;
const TIPP_MAX = 15;

/**
 * @template {HTMLElement} T
 * @param {string} id
 * @returns {T}
 */
function element(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Element #${id} fehlt`);
  }
  return /** @type {T} */ (el);
}

const buehne = element("buehne");
const leiste = element("leiste");
const titel = element("titel");
const ende = element("ende");
/** @type {HTMLDialogElement} */
const dialog = element("einstellungen");
const knopf = {
  zurueck: element("zurueck"),
  weiter: element("weiter"),
  animation: element("animation"),
  /** @type {HTMLButtonElement} */
  invertieren: element("invertieren"),
  /** @type {HTMLButtonElement} */
  farbe: element("farbe"),
  ton: element("ton"),
  vollbild: element("vollbild"),
  menue: element("menue"),
  fortsetzen: element("fortsetzen"),
};
const feld = {
  /** @type {HTMLInputElement} */
  animation: element("e-animation"),
  animationHinweis: element("e-animation-hinweis"),
  /** @type {HTMLInputElement} */
  tempo: element("e-tempo"),
  /** @type {HTMLOutputElement} */
  tempoWert: element("e-tempo-wert"),
  /** @type {HTMLInputElement} */
  invertiert: element("e-invertiert"),
  /** @type {HTMLInputElement} */
  farbe: element("e-farbe"),
  /** @type {HTMLInputElement} */
  ton: element("e-ton"),
  /** @type {HTMLSelectElement} */
  klang: element("e-klang"),
  /** @type {HTMLInputElement} */
  lautstaerke: element("e-lautstaerke"),
  /** @type {HTMLOutputElement} */
  lautstaerkeWert: element("e-lautstaerke-wert"),
  /** @type {HTMLSelectElement} */
  auto: element("e-auto"),
  /** @type {HTMLSelectElement} */
  sitzung: element("e-sitzung"),
  /** @type {HTMLInputElement} */
  touch: element("e-touch"),
  wach: element("e-wach"),
};

const e = speicher.laden();

/** @type {Motiv[]} */
let motive = [];
/** @type {import("./klang.js").Klang[]} */
let klaenge = [];
const klang = new Klangerzeuger();
/* Browser erlauben Ton erst nach einer Bedienung (Tippen, Taste). */
let bedient = false;
let index = 0;
let wechselLaeuft = false;
let sitzungBeendet = false;

/** @type {ReturnType<typeof setTimeout> | undefined} */
let leisteTimer;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let autoTimer;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let sitzungTimer;

const warte = (/** @type {number} */ ms) => new Promise((fertig) => setTimeout(fertig, ms));

/* ---------- Motive anzeigen ---------- */

/**
 * Zeigt ein Motiv. Im Farbmodus werden vorher seine Farben auf der ganzen Seite
 * gesetzt, damit auch der Hintergrund außerhalb des quadratischen Motivs passt.
 *
 * @param {Motiv} motiv
 */
function setzeMotiv(motiv) {
  setzeFarben(document.documentElement, e.farbe ? motiv.farben : null);
  buehne.replaceChildren(erzeugeMotiv(motiv));
  titel.textContent = `${motiv.name} · ${index + 1}/${motive.length}`;
  aktualisiereAnimation();
}

/**
 * Wechselt ruhig zum Motiv mit dem gegebenen Index: ausblenden, tauschen, einblenden.
 * Mehrere schnelle Tastendrücke während eines Wechsels landen beim letzten Ziel.
 *
 * @param {number} ziel
 */
async function wechsleZu(ziel) {
  if (!motive.length) {
    return;
  }
  index = (ziel + motive.length) % motive.length;
  e.letztesMotiv = motive[index].id;
  speicher.speichern(e);
  planeAutoWeiter();
  if (wechselLaeuft) {
    return;
  }
  wechselLaeuft = true;
  buehne.classList.add("ausgeblendet");
  await warte(UEBERGANG);
  setzeMotiv(motive[index]);
  buehne.classList.remove("ausgeblendet");
  wechselLaeuft = false;
}

const weiter = () => wechsleZu(index + 1);
const zurueck = () => wechsleZu(index - 1);

/* ---------- Darstellung und Animation ---------- */

function aktualisiereAnimation() {
  const an = speicher.animationAn(e);
  knopf.animation.setAttribute("aria-pressed", String(an));
  const host = /** @type {HTMLElement | null} */ (buehne.firstElementChild);
  const motiv = motive[index];
  if (!host || !motiv) {
    return;
  }
  steuereAnimation(host, {
    laufen: an && motiv.animation !== false && !sitzungBeendet,
    rate: e.tempo * (motiv.tempo ?? 1),
  });
}

function aktualisiereDarstellung() {
  document.documentElement.classList.toggle("invertiert", e.invertiert);
  knopf.invertieren.setAttribute("aria-pressed", String(e.invertiert));
  knopf.invertieren.disabled = e.farbe;
  knopf.invertieren.title = e.farbe ? "Invertieren (im Farbmodus ohne Wirkung)" : "Invertieren (I)";
  knopf.farbe.setAttribute("aria-pressed", String(e.farbe));
  knopf.ton.setAttribute("aria-pressed", String(e.ton));
  aktualisiereAnimation();
  aktualisiereFormular();
}

/** @param {(e: import("./einstellungen.js").Einstellungen) => void} aenderung */
function aendere(aenderung) {
  aenderung(e);
  speicher.speichern(e);
  aktualisiereDarstellung();
}

function schalteAnimation() {
  aendere((e) => {
    e.animation = !speicher.animationAn(e);
  });
}

function schalteInvertierung() {
  if (e.farbe) {
    return;
  }
  aendere((e) => {
    e.invertiert = !e.invertiert;
  });
}

/**
 * Farbmodus an/aus. Das aktuelle Motiv wird dabei aus- und wieder eingeblendet,
 * damit die Farben nicht schlagartig umspringen.
 *
 * @param {boolean} [an]
 */
function schalteFarbe(an = !e.farbe) {
  aendere((e) => {
    e.farbe = an;
  });
  wechsleZu(index);
}

/** @param {number} richtung +1 schneller, -1 langsamer */
function aendereTempo(richtung) {
  const stufen = speicher.TEMPO_STUFEN;
  const jetzt = stufen.indexOf(e.tempo);
  const neu = Math.min(stufen.length - 1, Math.max(0, (jetzt < 0 ? 2 : jetzt) + richtung));
  aendere((e) => {
    e.tempo = stufen[neu];
  });
}

async function schalteVollbild() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }
  } catch {
    // Vollbild abgelehnt, z. B. ohne Nutzeraktion.
  }
}

/* ---------- Klang ---------- */

const gewaehlterKlang = () => klaenge.find((k) => k.id === e.klang) ?? klaenge[0];

function starteKlang() {
  const auswahl = gewaehlterKlang();
  if (!e.ton || !bedient || !auswahl) {
    return;
  }
  klang.setzeLautstaerke(e.lautstaerke);
  klang.spiele(auswahl.beschreibung).catch((fehler) => console.warn("Klang nicht gestartet:", fehler));
}

/** @param {boolean} [an] */
function schalteTon(an = !e.ton) {
  aendere((e) => {
    e.ton = an;
  });
  if (an) {
    starteKlang();
  } else {
    klang.stoppe();
  }
}

/*
 * Erste Bedienung überhaupt: jetzt darf Ton starten. War der Klang gespeichert
 * eingeschaltet, beginnt er hier.
 */
function ersteBedienung() {
  if (bedient) {
    return;
  }
  bedient = true;
  starteKlang();
}

/* ---------- Automatisches Weiterschalten und Sitzungs-Timer ---------- */

function planeAutoWeiter() {
  clearTimeout(autoTimer);
  if (e.autoWeiter > 0 && !sitzungBeendet) {
    autoTimer = setTimeout(weiter, e.autoWeiter * 1000);
  }
}

function planeSitzung() {
  clearTimeout(sitzungTimer);
  if (e.sitzung > 0 && !sitzungBeendet) {
    sitzungTimer = setTimeout(beendeSitzung, e.sitzung * 60_000);
  }
}

function beendeSitzung() {
  sitzungBeendet = true;
  clearTimeout(autoTimer);
  document.body.classList.add("beendet");
  ende.hidden = false;
  aktualisiereAnimation();
  wachhalten.freigeben();
}

function setzeSitzungFort() {
  sitzungBeendet = false;
  document.body.classList.remove("beendet");
  ende.hidden = true;
  aktualisiereAnimation();
  planeAutoWeiter();
  planeSitzung();
  wachhalten.aktivieren();
  versteckeLeiste();
}

/* ---------- Bedienleiste ---------- */

function zeigeLeiste() {
  document.body.classList.add("leiste-sichtbar");
  document.body.classList.remove("ruhig");
  leiste.inert = false;
  clearTimeout(leisteTimer);
  leisteTimer = setTimeout(versteckeLeisteWennUnbenutzt, LEISTE_SICHTBAR);
}

function versteckeLeiste() {
  clearTimeout(leisteTimer);
  document.body.classList.remove("leiste-sichtbar");
  document.body.classList.add("ruhig");
  leiste.inert = true;
  if (leiste.contains(document.activeElement)) {
    /** @type {HTMLElement} */ (document.activeElement).blur();
  }
}

/* Nicht ausblenden, solange die Maus auf der Leiste steht oder der Dialog offen ist. */
function versteckeLeisteWennUnbenutzt() {
  if (dialog.open || leiste.matches(":hover") || ende.matches(":hover")) {
    zeigeLeiste();
    return;
  }
  versteckeLeiste();
}

/* ---------- Eingaben: Tastatur ---------- */

/** @param {KeyboardEvent} ereignis */
function taste(ereignis) {
  if (dialog.open || ereignis.altKey || ereignis.ctrlKey || ereignis.metaKey) {
    return;
  }
  const ziel = /** @type {HTMLElement} */ (ereignis.target);
  const aufKnopf = ziel instanceof HTMLButtonElement;
  wachhalten.erneuern();

  if (sitzungBeendet) {
    if (["ArrowLeft", "ArrowRight", " ", "Enter"].includes(ereignis.key) && !aufKnopf) {
      ereignis.preventDefault();
      setzeSitzungFort();
    } else {
      zeigeLeiste();
    }
    return;
  }

  switch (ereignis.key) {
    case "ArrowRight":
    case "PageDown":
      ereignis.preventDefault();
      weiter();
      break;
    case "ArrowLeft":
    case "PageUp":
      ereignis.preventDefault();
      zurueck();
      break;
    case " ":
      if (!aufKnopf) {
        ereignis.preventDefault();
        schalteAnimation();
      }
      break;
    case "i":
    case "I":
      schalteInvertierung();
      break;
    case "c":
    case "C":
      schalteFarbe();
      break;
    case "t":
    case "T":
      schalteTon();
      break;
    case "f":
    case "F":
      schalteVollbild();
      break;
    case "+":
    case "=":
      aendereTempo(1);
      break;
    case "-":
      aendereTempo(-1);
      break;
    case "Escape":
      versteckeLeiste();
      break;
    default:
      zeigeLeiste();
  }
}

/* ---------- Eingaben: Maus, Touch, Stift ---------- */

/** @type {{ x: number, y: number } | null} */
let druckStart = null;
/** @type {{ x: number, y: number } | null} */
let letzteMaus = null;

/** @param {PointerEvent} ereignis */
function zeigerRunter(ereignis) {
  druckStart = { x: ereignis.clientX, y: ereignis.clientY };
  wachhalten.erneuern();
}

/**
 * Auswertung von Tippen und Wischen auf der Bühne. Ist die Touch-Navigation aus,
 * blendet jede Berührung nur die Leiste ein.
 *
 * @param {PointerEvent} ereignis
 */
function zeigerHoch(ereignis) {
  if (!druckStart) {
    return;
  }
  const dx = ereignis.clientX - druckStart.x;
  const dy = ereignis.clientY - druckStart.y;
  druckStart = null;

  if (sitzungBeendet || !e.touchNavigation) {
    zeigeLeiste();
    return;
  }
  if (Math.abs(dx) >= WISCH_MIN && Math.abs(dx) > 1.5 * Math.abs(dy)) {
    if (dx < 0) {
      weiter();
    } else {
      zurueck();
    }
    return;
  }
  if (Math.abs(dx) <= TIPP_MAX && Math.abs(dy) <= TIPP_MAX) {
    const drittel = window.innerWidth / 3;
    if (ereignis.clientX < drittel) {
      zurueck();
    } else if (ereignis.clientX > 2 * drittel) {
      weiter();
    } else if (document.body.classList.contains("leiste-sichtbar")) {
      versteckeLeiste();
    } else {
      zeigeLeiste();
    }
  }
}

/**
 * Mausbewegung zeigt die Leiste. Kleine Zuckungen und synthetische Events ohne
 * echte Bewegung (manche Browser feuern sie beim Umbau der Seite) werden ignoriert.
 *
 * @param {PointerEvent} ereignis
 */
function zeigerBewegt(ereignis) {
  if (ereignis.pointerType !== "mouse") {
    return;
  }
  const jetzt = { x: ereignis.clientX, y: ereignis.clientY };
  if (letzteMaus && Math.hypot(jetzt.x - letzteMaus.x, jetzt.y - letzteMaus.y) < 4) {
    return;
  }
  letzteMaus = jetzt;
  zeigeLeiste();
}

/* ---------- Einstellungsdialog ---------- */

function aktualisiereFormular() {
  feld.animation.checked = speicher.animationAn(e);
  feld.animationHinweis.hidden = !(e.animation === null && !speicher.animationAn(e));
  const stufe = speicher.TEMPO_STUFEN.indexOf(e.tempo);
  feld.tempo.value = String(stufe < 0 ? 2 : stufe);
  feld.tempoWert.value = `${String(e.tempo).replace(".", ",")}×`;
  feld.invertiert.checked = e.invertiert;
  feld.invertiert.disabled = e.farbe;
  feld.farbe.checked = e.farbe;
  feld.ton.checked = e.ton;
  feld.klang.value = gewaehlterKlang()?.id ?? "";
  feld.lautstaerke.value = String(Math.round(e.lautstaerke * 100));
  feld.lautstaerkeWert.value = `${feld.lautstaerke.value} %`;
  feld.auto.value = String(e.autoWeiter);
  feld.sitzung.value = String(e.sitzung);
  feld.touch.checked = e.touchNavigation;
  const wachText = {
    aktiv: "aktiv.",
    abgelehnt: "vom Browser abgelehnt. Der Bildschirm kann sich nach der Systemzeit abschalten.",
    aus: "aus.",
    "nicht unterstützt": "von diesem Browser nicht unterstützt.",
  };
  feld.wach.textContent = `Bildschirm wachhalten: ${wachText[wachhalten.status()]}`;
}

function verbindeFormular() {
  feld.animation.addEventListener("change", () =>
    aendere((e) => {
      e.animation = feld.animation.checked;
    }),
  );
  feld.tempo.addEventListener("input", () =>
    aendere((e) => {
      e.tempo = speicher.TEMPO_STUFEN[Number(feld.tempo.value)] ?? 1;
    }),
  );
  feld.invertiert.addEventListener("change", () =>
    aendere((e) => {
      e.invertiert = feld.invertiert.checked;
    }),
  );
  feld.farbe.addEventListener("change", () => schalteFarbe(feld.farbe.checked));
  feld.ton.addEventListener("change", () => schalteTon(feld.ton.checked));
  feld.klang.addEventListener("change", () => {
    aendere((e) => {
      e.klang = feld.klang.value;
    });
    starteKlang();
  });
  feld.lautstaerke.addEventListener("input", () => {
    aendere((e) => {
      e.lautstaerke = Number(feld.lautstaerke.value) / 100;
    });
    klang.setzeLautstaerke(e.lautstaerke);
  });
  feld.auto.addEventListener("change", () => {
    aendere((e) => {
      e.autoWeiter = Number(feld.auto.value);
    });
    planeAutoWeiter();
  });
  feld.sitzung.addEventListener("change", () => {
    aendere((e) => {
      e.sitzung = Number(feld.sitzung.value);
    });
    planeSitzung();
  });
  feld.touch.addEventListener("change", () =>
    aendere((e) => {
      e.touchNavigation = feld.touch.checked;
    }),
  );
  dialog.addEventListener("close", () => zeigeLeiste());
}

/* ---------- Start ---------- */

function verbindeBedienung() {
  knopf.zurueck.addEventListener("click", zurueck);
  knopf.weiter.addEventListener("click", weiter);
  knopf.animation.addEventListener("click", schalteAnimation);
  knopf.invertieren.addEventListener("click", schalteInvertierung);
  knopf.farbe.addEventListener("click", () => schalteFarbe());
  knopf.ton.addEventListener("click", () => schalteTon());
  window.addEventListener("pointerdown", ersteBedienung, { capture: true });
  window.addEventListener("keydown", ersteBedienung, { capture: true });
  knopf.vollbild.addEventListener("click", schalteVollbild);
  knopf.menue.addEventListener("click", () => {
    aktualisiereFormular();
    dialog.showModal();
  });
  knopf.fortsetzen.addEventListener("click", setzeSitzungFort);
  if (!document.fullscreenEnabled) {
    knopf.vollbild.hidden = true;
  }

  document.addEventListener("keydown", taste);
  buehne.addEventListener("pointerdown", zeigerRunter);
  buehne.addEventListener("pointerup", zeigerHoch);
  buehne.addEventListener("pointercancel", () => {
    druckStart = null;
  });
  document.addEventListener("pointermove", zeigerBewegt);
  leiste.addEventListener("pointerdown", () => zeigeLeiste());
  speicher.beiBewegungsAenderung(aktualisiereDarstellung);
  verbindeFormular();
}

/*
 * Offline-Fähigkeit nur über https oder localhost; über file:// gibt es keine
 * Service Worker. Der Worker ist ein ES-Modul, damit er die Motivliste importieren kann.
 */
function registriereServiceWorker() {
  const sicher = location.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  if (!("serviceWorker" in navigator) || !sicher) {
    return;
  }
  navigator.serviceWorker.register("sw.js", { type: "module" }).catch((fehler) => {
    console.warn("Service Worker nicht registriert:", fehler);
  });
}

async function start() {
  verbindeBedienung();
  aktualisiereDarstellung();
  versteckeLeiste();

  [motive, klaenge] = await Promise.all([ladeMotive(), ladeKlaenge()]);
  feld.klang.replaceChildren(...klaenge.map((k) => new Option(k.name, k.id)));
  aktualisiereFormular();
  if (!motive.length) {
    buehne.textContent = "Keine Motive gefunden.";
    return;
  }
  index = Math.max(0, motive.findIndex((m) => m.id === e.letztesMotiv));
  setzeMotiv(motive[index]);
  planeAutoWeiter();
  planeSitzung();
  wachhalten.aktivieren();
  registriereServiceWorker();
}

start();
