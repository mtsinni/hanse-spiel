// ======================================================================
// mobil.js – Handy und Tablet: Karte zoomen und verschieben, Reiter für die Fenster.
// (Zoomen per Mausrad und Knöpfen funktioniert natürlich auch am Computer.)
// ======================================================================

// Ist der Bildschirm schmal (Handy)? Dieselbe Grenze wie im CSS (@media max-width: 800px).
function istMobil() {
  return window.matchMedia("(max-width: 800px)").matches;
}

// ---------- Zoomen und Verschieben der Karte ----------
//
// Der Trick: Wir verändern nur die "viewBox" des SVG – also den Ausschnitt der Karte, der gezeigt wird.
// viewBox "0 0 800 500"   = die ganze Karte
// viewBox "200 150 400 250" = nur die Mitte, doppelt so groß
// Alles andere (Städte, Schiffe, Routen) bleibt unverändert und wird automatisch mitvergrößert.

const ZOOM_MAX = 3;                                  // höchstens dreifach vergrößern
const ansicht = { x: 0, y: 0, b: 800, h: 500 };      // der sichtbare Ausschnitt (b = Breite, h = Höhe)

function setzeAnsicht() {
  // Begrenzen: nicht kleiner als 1/3 der Karte, nicht größer als die ganze, nicht über den Rand hinaus
  ansicht.b = Math.min(Math.max(ansicht.b, 800 / ZOOM_MAX), 800);
  ansicht.h = ansicht.b * 500 / 800;                 // Seitenverhältnis bleibt gleich
  ansicht.x = Math.min(Math.max(ansicht.x, 0), 800 - ansicht.b);
  ansicht.y = Math.min(Math.max(ansicht.y, 0), 500 - ansicht.h);
  karte.setAttribute("viewBox", ansicht.x + " " + ansicht.y + " " + ansicht.b + " " + ansicht.h);

  // Vergrößert: Ein Finger verschiebt die Karte. Ganze Karte: Ein Finger scrollt die Seite.
  karte.style.touchAction = ansicht.b < 799 ? "none" : "pan-y";
}

// Bildschirmposition (Pixel) -> Kartenkoordinaten (0…800, 0…500) im aktuellen Ausschnitt
function kartenPunkt(clientX, clientY) {
  const r = karte.getBoundingClientRect();
  return {
    x: ansicht.x + (clientX - r.left) / r.width * ansicht.b,
    y: ansicht.y + (clientY - r.top) / r.height * ansicht.h
  };
}

// Um einen Punkt herum zoomen: Der Punkt unter dem Finger/der Maus bleibt an seiner Stelle.
// faktor > 1 = hinein, < 1 = heraus
function zoome(faktor, punkt) {
  const neueBreite = Math.min(Math.max(ansicht.b / faktor, 800 / ZOOM_MAX), 800);
  const f = neueBreite / ansicht.b;                  // wie stark sich der Ausschnitt ändert
  ansicht.x = punkt.x - (punkt.x - ansicht.x) * f;
  ansicht.y = punkt.y - (punkt.y - ansicht.y) * f;
  ansicht.b = neueBreite;
  setzeAnsicht();
}

// Mausrad (Computer)
karte.addEventListener("wheel", (e) => {
  e.preventDefault();                                // sonst scrollt die ganze Seite mit
  zoome(e.deltaY < 0 ? 1.2 : 1 / 1.2, kartenPunkt(e.clientX, e.clientY));
}, { passive: false });                              // passive: false – sonst dürfen wir preventDefault nicht aufrufen

// Knöpfe + / − / ⟲
document.getElementById("zoomKnoepfe").addEventListener("click", (e) => {
  const k = e.target.closest("button");
  if (!k) return;
  const mitte = { x: ansicht.x + ansicht.b / 2, y: ansicht.y + ansicht.h / 2 };
  if (k.dataset.zoom === "rein")  zoome(1.5, mitte);
  if (k.dataset.zoom === "raus")  zoome(1 / 1.5, mitte);
  if (k.dataset.zoom === "reset") { ansicht.x = 0; ansicht.y = 0; ansicht.b = 800; setzeAnsicht(); }
});

// Finger und Maus: "Pointer Events" fassen Maus, Finger und Stift zusammen.
// Bei mehreren Fingern bekommt jeder Finger eine eigene pointerId – so können wir sie auseinanderhalten.
const finger = new Map();          // pointerId -> letzte Position { x, y } in Bildschirmpixeln
let zweiFinger = null;             // Startwerte einer Zwei-Finger-Geste
let bewegt = 0;                    // wie weit wurde seit dem Aufsetzen bewegt? (um Ziehen von Tippen zu unterscheiden)

function abstand(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function mitteVon(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

karte.addEventListener("pointerdown", (e) => {
  finger.set(e.pointerId, { x: e.clientX, y: e.clientY });
  bewegt = 0;
  if (finger.size === 2) {
    const [a, b] = [...finger.values()];             // die beiden Finger
    const m = mitteVon(a, b);
    zweiFinger = { abstand: abstand(a, b), breite: ansicht.b, punkt: kartenPunkt(m.x, m.y) };
  }
});

// Bewegungen auf dem ganzen Fenster verfolgen – der Finger darf auch über den Kartenrand hinaus
window.addEventListener("pointermove", (e) => {
  const alt = finger.get(e.pointerId);
  if (!alt) return;                                  // dieser Zeiger hat nicht auf der Karte angefangen
  const neu = { x: e.clientX, y: e.clientY };
  bewegt += abstand(alt, neu);
  finger.set(e.pointerId, neu);

  if (finger.size === 2 && zweiFinger) {
    // Zwei Finger: Abstand bestimmt den Zoom, die Mitte zwischen ihnen bleibt am selben Kartenpunkt
    const [a, b] = [...finger.values()];
    ansicht.b = zweiFinger.breite * zweiFinger.abstand / Math.max(abstand(a, b), 1);
    ansicht.b = Math.min(Math.max(ansicht.b, 800 / ZOOM_MAX), 800);
    ansicht.h = ansicht.b * 500 / 800;
    const m = mitteVon(a, b), r = karte.getBoundingClientRect();
    ansicht.x = zweiFinger.punkt.x - (m.x - r.left) / r.width * ansicht.b;
    ansicht.y = zweiFinger.punkt.y - (m.y - r.top) / r.height * ansicht.h;
    setzeAnsicht();
  } else if (finger.size === 1 && ansicht.b < 799) {
    // Ein Finger (oder Maus mit gedrückter Taste) bei vergrößerter Karte: verschieben
    const r = karte.getBoundingClientRect();
    ansicht.x -= (neu.x - alt.x) / r.width * ansicht.b;
    ansicht.y -= (neu.y - alt.y) / r.height * ansicht.h;
    setzeAnsicht();
  }
});

function fingerWeg(e) {
  finger.delete(e.pointerId);
  if (finger.size < 2) zweiFinger = null;
}
window.addEventListener("pointerup", fingerWeg);
window.addEventListener("pointercancel", fingerWeg);  // z.B. wenn der Browser doch scrollt

// Wurde die Karte gezogen, soll beim Loslassen KEINE Stadt "angeklickt" werden.
// Der dritte Parameter "true" heißt: Wir hören in der "Capture"-Phase zu – also BEVOR die Stadt
// den Klick bekommt – und können ihn dann abfangen (stopPropagation).
karte.addEventListener("click", (e) => {
  if (bewegt > 8) {
    e.stopPropagation();
    e.preventDefault();
  } else if (istMobil() && e.target.closest(".stadt, .schiff, .ki-schiff")) {
    zeigeReiter("markt");                           // Stadt oder Schiff angetippt -> Markt zeigen
  }
}, true);

// ---------- Reiter (nur auf dem Handy sichtbar) ----------
function zeigeReiter(name) {
  document.querySelectorAll("#seitenleiste > .panel").forEach(p => p.classList.toggle("sichtbar", p.id === name));
  document.querySelectorAll("#reiter button").forEach(b => b.classList.toggle("aktiv", b.dataset.reiter === name));
}
document.getElementById("reiter").addEventListener("click", (e) => {
  const k = e.target.closest("button");
  if (k) zeigeReiter(k.dataset.reiter);
});
zeigeReiter("markt");

// ---------- Mitwandernde Leisten ----------
// Auf dem Handy bleiben obere Leiste, Karte und Reiter beim Scrollen stehen ("sticky").
// Damit sie nicht übereinanderrutschen, muss das CSS wissen, wie hoch Leiste und Karte gerade sind.
// Diese Höhen schreiben wir in CSS-Variablen (--leiste-h, --karte-h), die das CSS dann benutzt.
function merkeHoehen() {
  const wurzel = document.documentElement.style;
  wurzel.setProperty("--leiste-h", document.getElementById("topbar").offsetHeight + "px");
  wurzel.setProperty("--karte-h", document.getElementById("kartenRahmen").offsetHeight + "px");
}
// ResizeObserver meldet sich, sobald sich die Größe eines Elements ändert (Drehen des Handys, Umbruch …)
new ResizeObserver(merkeHoehen).observe(document.getElementById("topbar"));
new ResizeObserver(merkeHoehen).observe(document.getElementById("kartenRahmen"));

setzeAnsicht();
