// ======================================================================
// ton.js – Klänge und Musik, komplett im Browser erzeugt (Web Audio API, keine Sounddateien).
// ======================================================================
//
// So funktioniert Web Audio, ganz kurz:
//   Man baut eine Kette aus "Knoten" (nodes), durch die der Klang fließt – wie Kabel zwischen Geräten:
//
//   Oszillator (Tonerzeuger) ──> Filter (Klangfarbe) ──> Lautstärke (Gain) ──> Lautsprecher
//
//   - Ein OSZILLATOR erzeugt einen Ton mit einer Frequenz (440 Hz = Kammerton a).
//     Wellenformen: "sine" (weich), "triangle" (etwas heller), "square" (hart), "sawtooth" (scharf).
//   - RAUSCHEN (zufällige Werte) ist die Grundlage für Wellen, Wind, Kanonendonner.
//   - Ein FILTER lässt nur tiefe ("lowpass") oder nur mittlere ("bandpass") Töne durch.
//   - Ein GAIN-Knoten regelt die Lautstärke – und zwar zeitgenau. Damit baut man die "Hüllkurve":
//     schnell lauter werden (Anschlag), dann langsam leiser (Ausklingen). Das macht aus einem
//     Piepton eine Glocke oder ein Zupfinstrument.

const TON_SCHLUESSEL = "hanse-ton";            // Einstellungen getrennt vom Spielstand speichern
const tonEinstellungen = { effekte: true, musik: true };
try {
  Object.assign(tonEinstellungen, JSON.parse(localStorage.getItem(TON_SCHLUESSEL)) || {});
} catch (fehler) {}

let audio = null;                               // der AudioContext – wird erst beim ersten Klick erzeugt
let hauptRegler, effektBus, musikBus, rauschenBus;
let rauschPuffer = null;

// ---------- Start ----------
// Browser erlauben Ton erst, nachdem der Spieler etwas angeklickt oder gedrückt hat.
// Deshalb starten wir alles beim ersten Klick bzw. Tastendruck.
function tonStarten() {
  if (audio) {
    if (audio.state === "suspended") audio.resume();
    return;
  }
  const Kontext = window.AudioContext || window.webkitAudioContext;
  if (!Kontext) return;                         // sehr alter Browser: dann eben ohne Ton
  audio = new Kontext();

  // Drei "Busse" (Sammelschienen) mit eigener Lautstärke, alle auf einen Hauptregler
  hauptRegler = audio.createGain();
  hauptRegler.gain.value = 0.8;
  hauptRegler.connect(audio.destination);
  effektBus = audio.createGain();   effektBus.connect(hauptRegler);
  musikBus = audio.createGain();    musikBus.connect(hauptRegler);
  rauschenBus = audio.createGain(); rauschenBus.connect(hauptRegler);
  busseEinstellen();

  starteMeeresrauschen();
  starteMusik();
}
document.addEventListener("pointerdown", tonStarten);
document.addEventListener("keydown", tonStarten);

// Lautstärken der Busse passend zu den Einstellungen – weich übergeblendet statt hart geschaltet
function busseEinstellen() {
  if (!audio) return;
  const t = audio.currentTime;
  effektBus.gain.setTargetAtTime(tonEinstellungen.effekte ? 1 : 0, t, 0.1);
  rauschenBus.gain.setTargetAtTime(tonEinstellungen.effekte ? 0.05 : 0, t, 0.5);
  musikBus.gain.setTargetAtTime(tonEinstellungen.musik ? 0.55 : 0, t, 0.5);
}

// ---------- Bausteine ----------

// Ein einzelner Ton mit Hüllkurve.
// Die Angaben in { … } sind "benannte Parameter" mit Standardwerten – man gibt nur an, was man ändern will:
//   ton(440, 0.5)                                -> Sinuston a, eine halbe Sekunde
//   ton(440, 0.5, { typ: "triangle", start: 1 }) -> heller, eine Sekunde später
function ton(frequenz, dauer, { typ = "sine", lautstaerke = 0.3, start = 0, anschlag = 0.005, gleitenAuf = null, ziel = effektBus } = {}) {
  const t = audio.currentTime + start;
  const osz = audio.createOscillator();
  osz.type = typ;
  osz.frequency.setValueAtTime(frequenz, t);
  if (gleitenAuf) osz.frequency.exponentialRampToValueAtTime(gleitenAuf, t + dauer);   // Tonhöhe gleitet

  const huelle = audio.createGain();
  huelle.gain.setValueAtTime(0.0001, t);                                  // still …
  huelle.gain.exponentialRampToValueAtTime(lautstaerke, t + anschlag);    // … schnell laut …
  huelle.gain.exponentialRampToValueAtTime(0.0001, t + dauer);            // … und langsam leise

  osz.connect(huelle);
  huelle.connect(ziel);
  osz.start(t);
  osz.stop(t + dauer + 0.05);                    // danach räumt der Browser den Oszillator selbst weg
}

// Zwei Sekunden weißes Rauschen – einmal erzeugt, immer wieder benutzt
function holeRauschen() {
  if (!rauschPuffer) {
    rauschPuffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const werte = rauschPuffer.getChannelData(0);
    for (let i = 0; i < werte.length; i++) werte[i] = Math.random() * 2 - 1;   // Zufallswerte von -1 bis 1
  }
  return rauschPuffer;
}

// Gefiltertes Rauschen mit Hüllkurve, optional mit wanderndem Filter (für "Wusch"-Geräusche)
function rauschen(dauer, { filter = "lowpass", frequenz = 800, frequenzEnde = null, q = 1, lautstaerke = 0.5, start = 0 } = {}) {
  const t = audio.currentTime + start;
  const quelle = audio.createBufferSource();
  quelle.buffer = holeRauschen();

  const f = audio.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(frequenz, t);
  if (frequenzEnde) f.frequency.exponentialRampToValueAtTime(frequenzEnde, t + dauer);
  f.Q.value = q;

  const huelle = audio.createGain();
  huelle.gain.setValueAtTime(0.0001, t);
  huelle.gain.exponentialRampToValueAtTime(lautstaerke, t + 0.01);
  huelle.gain.exponentialRampToValueAtTime(0.0001, t + dauer);

  quelle.connect(f);
  f.connect(huelle);
  huelle.connect(effektBus);
  quelle.start(t);
  quelle.stop(t + dauer + 0.05);
}

// ---------- Die Klänge des Spiels ----------
// Ein Objekt voller Funktionen: KLAENGE.muenze(), KLAENGE.kanone() …
const KLAENGE = {
  // zwei helle, kurze Töne – wie Münzen, die aneinanderschlagen
  muenze() {
    ton(2100, 0.15, { typ: "triangle", lautstaerke: 0.2 });
    ton(2800, 0.25, { typ: "triangle", lautstaerke: 0.17, start: 0.06 });
  },
  // Rauschen, dessen Filter nach oben wandert: Segel fangen Wind
  segel() {
    rauschen(1.0, { filter: "bandpass", frequenz: 300, frequenzEnde: 1500, q: 0.7, lautstaerke: 0.7 });
  },
  // tiefes, abklingendes Rauschen plus ein dumpfer Schlag, der nach unten gleitet
  kanone() {
    rauschen(0.9, { filter: "lowpass", frequenz: 1200, frequenzEnde: 100, lautstaerke: 0.5 });
    ton(95, 0.7, { lautstaerke: 0.45, gleitenAuf: 35 });
  },
  // Glocke: mehrere Töne, deren Frequenzen KEIN sauberes Vielfaches sind (2,76 und 5,4) –
  // genau das macht den metallischen Glockenklang aus
  glocke() {
    const grund = 523;
    for (const [faktor, laut, dauer] of [[1, 0.25, 2.5], [2, 0.1, 1.8], [2.76, 0.08, 1.2], [5.4, 0.04, 0.7]]) {
      ton(grund * faktor, dauer, { lautstaerke: laut, anschlag: 0.002 });
    }
  },
  // Schiffsglocke dreimal schnell: Alarm!
  alarm() {
    for (let i = 0; i < 3; i++) ton(1250, 0.35, { typ: "triangle", lautstaerke: 0.18, start: i * 0.22, anschlag: 0.002 });
  },
  // kleine Siegesfanfare: aufsteigender Dreiklang
  fanfare() {
    [392, 523, 659, 784].forEach((f, i) => ton(f, i === 3 ? 0.9 : 0.25, { typ: "triangle", lautstaerke: 0.2, start: i * 0.16 }));
  },
  // absteigende, traurige Töne
  niederlage() {
    [392, 330, 262].forEach((f, i) => ton(f, 0.7, { typ: "triangle", lautstaerke: 0.18, start: i * 0.35 }));
  },
  // sanfter Hinweis für Nachrichten
  hinweis() {
    ton(660, 0.3, { lautstaerke: 0.12 });
    ton(880, 0.45, { lautstaerke: 0.1, start: 0.12 });
  },
  // Möwe: ein Ton, der hoch- und wieder runtergleitet – zweimal, leicht verschieden
  moewe() {
    const hoehe = 1300 + Math.random() * 400;
    ton(hoehe, 0.3, { lautstaerke: 0.08, gleitenAuf: hoehe * 1.4 });
    ton(hoehe * 1.35, 0.45, { lautstaerke: 0.07, gleitenAuf: hoehe * 0.8, start: 0.3 });
  }
};

// Diese Funktion rufen alle anderen Dateien auf, z.B. spieleTon("kanone")
function spieleTon(name) {
  if (!audio || !tonEinstellungen.effekte) return;
  try { KLAENGE[name](); } catch (fehler) { console.warn("Ton", name, fehler); }
}

// ---------- Meeresrauschen ----------
// Dauerhaftes, tiefes Rauschen, dessen Lautstärke langsam an- und abschwillt wie Brandung.
// Das An- und Abschwellen macht ein zweiter, sehr langsamer Oszillator (0,1 Hz = alle 10 Sekunden),
// der nicht hörbar ist, sondern die Lautstärke "dreht". So etwas nennt man LFO (Low Frequency Oscillator).
function starteMeeresrauschen() {
  const quelle = audio.createBufferSource();
  quelle.buffer = holeRauschen();
  quelle.loop = true;                             // endlos wiederholen

  const tief = audio.createBiquadFilter();
  tief.type = "lowpass";
  tief.frequency.value = 450;

  const brandung = audio.createGain();
  brandung.gain.value = 0.6;
  const lfo = audio.createOscillator();
  lfo.frequency.value = 0.1;
  const lfoStaerke = audio.createGain();
  lfoStaerke.gain.value = 0.4;                    // schwankt also zwischen 0,2 und 1,0
  lfo.connect(lfoStaerke);
  lfoStaerke.connect(brandung.gain);              // der LFO steuert die Lautstärke!

  quelle.connect(tief);
  tief.connect(brandung);
  brandung.connect(rauschenBus);
  quelle.start();
  lfo.start();
}

// ---------- Musik ----------
// Eine kleine, selbst ausgedachte Melodie im "dorischen" Modus – so klingt viel mittelalterliche Musik.
// Sie besteht aus kurzen Phrasen, die zufällig aneinandergereiht werden: Die Musik wiederholt sich
// dadurch nie ganz gleich, obwohl sie nur aus vier Bausteinen besteht.

const DORISCH = [0, 2, 3, 5, 7, 9, 10];           // Halbtonschritte der Tonleiter (d-e-f-g-a-h-c)
const GRUNDTON = 62;                              // MIDI-Notennummer für d' (62)
const SCHLAEGE_PRO_MINUTE = 84;

// Jede Phrase: Liste aus [Tonstufe, Länge in Schlägen]. Stufe 0 = Grundton, 7 = eine Oktave höher.
const PHRASEN = [
  [[0, 1], [2, 1], [3, 1], [4, 1], [3, 2], [2, 2]],
  [[4, 1], [5, 1], [4, 1], [2, 1], [3, 2], [1, 2]],
  [[7, 1.5], [6, 0.5], [5, 1], [4, 1], [5, 1], [3, 1], [4, 2]],
  [[2, 1], [1, 1], [0, 1], [-1, 1], [0, 4]]       // Schlussphrase, endet auf dem Grundton
];

// Tonstufe -> Frequenz. Eine Stufe über 6 rutscht in die nächste Oktave, unter 0 in die darunter.
function stufeZuFrequenz(stufe) {
  const oktave = Math.floor(stufe / 7);
  const schritt = DORISCH[((stufe % 7) + 7) % 7];   // ((x % 7) + 7) % 7 – Modulo, das auch bei negativen Zahlen klappt
  const midi = GRUNDTON + oktave * 12 + schritt;
  return 440 * Math.pow(2, (midi - 69) / 12);       // die Formel für gleichstufige Stimmung
}

// Ein Zupfton wie von einer Laute: hell anschlagen, schnell verklingen, Obertöne leise dazu
function laute(frequenz, zeit, dauer) {
  const start = zeit - audio.currentTime;
  ton(frequenz, Math.min(dauer, 1.2), { typ: "triangle", lautstaerke: 0.22, start: start, anschlag: 0.004, ziel: musikBus });
  ton(frequenz * 2, Math.min(dauer, 0.6), { typ: "sine", lautstaerke: 0.05, start: start, anschlag: 0.004, ziel: musikBus });
}

// Ein leiser Bordunton (Grundton + Quinte), wie bei einer Drehleier
function bordun(zeit, dauer) {
  const start = zeit - audio.currentTime;
  for (const midi of [GRUNDTON - 24, GRUNDTON - 17]) {
    ton(440 * Math.pow(2, (midi - 69) / 12), dauer, { typ: "triangle", lautstaerke: 0.07, start: start, anschlag: 0.6, ziel: musikBus });
  }
}

// Der "Taktgeber": Alle 100 ms schauen wir, ob Noten für die nächsten 0,4 Sekunden geplant werden müssen.
// Warum nicht einfach setTimeout für jede Note? Weil setTimeout ungenau ist (der Browser hat
// anderes zu tun). Die Noten selbst planen wir deshalb mit der genauen Audio-Uhr (audio.currentTime) –
// setTimeout sorgt nur dafür, dass wir rechtzeitig nachplanen. Das ist die übliche Technik für Musik im Browser.
let naechsteNote = 0, phrase = null, notenIndex = 0, phrasenZaehler = 0;

function starteMusik() {
  naechsteNote = audio.currentTime + 1;
  setInterval(planeMusik, 100);
}

function planeMusik() {
  if (!audio || !tonEinstellungen.musik) {
    if (audio) naechsteNote = Math.max(naechsteNote, audio.currentTime + 0.5);   // beim Wiedereinschalten nicht nachholen
    return;
  }
  const schlag = 60 / SCHLAEGE_PRO_MINUTE;
  while (naechsteNote < audio.currentTime + 0.4) {
    // Neue Phrase wählen: jede vierte ist die Schlussphrase, sonst eine zufällige der ersten drei
    if (!phrase || notenIndex >= phrase.length) {
      phrasenZaehler++;
      phrase = (phrasenZaehler % 4 === 0) ? PHRASEN[3] : PHRASEN[Math.floor(Math.random() * 3)];
      notenIndex = 0;
      const laenge = phrase.reduce((summe, note) => summe + note[1], 0) * schlag;   // reduce: alles aufsummieren
      bordun(naechsteNote, laenge);
    }
    const [stufe, schlaege] = phrase[notenIndex];
    laute(stufeZuFrequenz(stufe), naechsteNote, schlaege * schlag);
    naechsteNote += schlaege * schlag;
    notenIndex++;
    // Nach der Schlussphrase eine kleine Atempause
    if (notenIndex >= phrase.length && phrase === PHRASEN[3]) naechsteNote += 2 * schlag;
  }
}

// ---------- Knöpfe ----------
function aktualisiereTonKnoepfe() {
  const e = document.getElementById("btnEffekte"), m = document.getElementById("btnMusik");
  e.textContent = tonEinstellungen.effekte ? "🔊" : "🔇";
  e.title = tonEinstellungen.effekte ? "Klänge ausschalten" : "Klänge einschalten";
  m.textContent = tonEinstellungen.musik ? "🎵" : "🎵✕";
  m.title = tonEinstellungen.musik ? "Musik ausschalten" : "Musik einschalten";
  m.classList.toggle("aus", !tonEinstellungen.musik);
  e.classList.toggle("aus", !tonEinstellungen.effekte);
}

function schalteTon(art) {
  tonEinstellungen[art] = !tonEinstellungen[art];
  try { localStorage.setItem(TON_SCHLUESSEL, JSON.stringify(tonEinstellungen)); } catch (fehler) {}
  tonStarten();
  busseEinstellen();
  aktualisiereTonKnoepfe();
}

document.getElementById("btnEffekte").addEventListener("click", () => schalteTon("effekte"));
document.getElementById("btnMusik").addEventListener("click", () => schalteTon("musik"));
aktualisiereTonKnoepfe();
