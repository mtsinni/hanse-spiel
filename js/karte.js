// ======================================================================
// karte.js – Zeichnen der Karte: Meer, Land, Kompass, Städte, Routen und deine Schiffe.
// ======================================================================

const karte = document.getElementById("karte");
const SVG_NS = "http://www.w3.org/2000/svg";

// Ebenen. Was zuerst angelegt wird, liegt unten.
// Reihenfolge: Meer -> Land -> Eis -> Routen -> Städte -> Ereignisse -> Konkurrenten -> deine Schiffe
let ebeneRouten, ebeneSchiffe, ebeneEreignisse, ebeneKI, ebeneEis;

// hier merken wir uns die Grafik jedes Schiffs, z.B. schiffGrafik[3] = { gruppe, linie, winkel }
const schiffGrafik = {};

// Kleine Hilfsfunktion: ein SVG-Element mit mehreren Attributen auf einmal anlegen.
// Beispiel: svg("circle", { cx: 10, cy: 20, r: 5 })
// Object.entries macht aus { cx: 10, r: 5 } die Liste [["cx", 10], ["r", 5]].
function svg(art, attribute = {}) {
  const el = document.createElementNS(SVG_NS, art);
  for (const [name, wert] of Object.entries(attribute)) el.setAttribute(name, wert);
  return el;
}

// ---------- Vorlagen: Verläufe und Muster ----------
// Alles in <defs> wird nicht direkt gezeichnet, sondern dient als Vorlage,
// die man später mit fill="url(#name)" benutzen kann.
function erstelleVorlagen() {
  const defs = svg("defs");

  // Wellenmuster: ein kleines Kachelbild (60 × 30), das sich endlos wiederholt
  const muster = svg("pattern", { id: "wellen", width: 60, height: 30, patternUnits: "userSpaceOnUse" });
  muster.appendChild(svg("path", { d: "M6,10 q4,-4 8,0 q4,-4 8,0", class: "welle" }));
  muster.appendChild(svg("path", { d: "M36,24 q4,-4 8,0", class: "welle" }));
  // Das Muster wandert langsam nach rechts – so sieht das Meer lebendig aus.
  // Nach 60 Einheiten sieht die Kachel wieder genau gleich aus, darum ruckelt der Neustart nicht.
  muster.appendChild(svg("animateTransform", {
    attributeName: "patternTransform", type: "translate",
    from: "0 0", to: "60 0", dur: "24s", repeatCount: "indefinite"
  }));
  defs.appendChild(muster);

  // Dunkler Rand ("Vignette") wie bei einer alten, vergilbten Karte
  const vignette = svg("radialGradient", { id: "vignette", cx: "50%", cy: "50%", r: "70%" });
  vignette.appendChild(svg("stop", { offset: "60%", "stop-color": "#2b2118", "stop-opacity": 0 }));
  vignette.appendChild(svg("stop", { offset: "100%", "stop-color": "#2b2118", "stop-opacity": 0.45 }));
  defs.appendChild(vignette);

  // Eisfläche: innen weiß, nach außen durchsichtig
  const eis = svg("radialGradient", { id: "eisVerlauf" });
  eis.appendChild(svg("stop", { offset: "0%", "stop-color": "#ffffff", "stop-opacity": 0.95 }));
  eis.appendChild(svg("stop", { offset: "70%", "stop-color": "#e8f4fa", "stop-opacity": 0.7 }));
  eis.appendChild(svg("stop", { offset: "100%", "stop-color": "#e8f4fa", "stop-opacity": 0 }));
  defs.appendChild(eis);

  karte.appendChild(defs);
}

// ---------- Land und Meeresnamen ----------
function polygonPunkte(flaeche) {
  // Aus [[lon,lat], [lon,lat], …] wird der Text "x1,y1 x2,y2 …"
  return flaeche.punkte
    .map(([lon, lat]) => {
      const p = projiziere(lon, lat);
      return p.x.toFixed(1) + "," + p.y.toFixed(1);   // toFixed(1) = eine Nachkommastelle
    })
    .join(" ");
}

function zeichneLand(ebene) {
  // Erster Durchgang: hellblauer, breiter Rand um jede Küste = flaches Wasser.
  // Er wird VOR dem Land gezeichnet, deshalb sieht man nur den Teil, der ins Meer ragt.
  for (const flaeche of LAND) {
    ebene.appendChild(svg("polygon", { class: "kueste", points: polygonPunkte(flaeche) }));
  }
  // Zweiter Durchgang: das Land selbst
  for (const flaeche of LAND) {
    ebene.appendChild(svg("polygon", { class: "land", points: polygonPunkte(flaeche) }));
  }

  for (const [text, lon, lat] of MEERE) {
    const p = projiziere(lon, lat);
    const t = svg("text", { class: "meername", x: p.x, y: p.y });
    t.textContent = text;
    ebene.appendChild(t);
  }
}

// ---------- Kompassrose ----------
// Ein Punkt in einer bestimmten Himmelsrichtung vom Mittelpunkt aus.
// Winkel in Grad: 0 = Norden (oben), 90 = Osten (rechts), 180 = Süden …
function richtungsPunkt(mx, my, winkel, laenge) {
  const rad = winkel * Math.PI / 180;                  // Grad -> Bogenmaß
  return (mx + Math.sin(rad) * laenge).toFixed(1) + "," + (my - Math.cos(rad) * laenge).toFixed(1);
}

function zeichneKompass(ebene, mx, my, r) {
  const g = svg("g", { class: "kompass" });
  g.appendChild(svg("circle", { cx: mx, cy: my, r: r * 0.72, class: "kompass-ring" }));

  // Erst die 4 kurzen Zacken (Nordost, Südost …), dann die 4 langen darüber.
  // Jede Zacke besteht aus zwei Dreiecken: einer hellen und einer dunklen Hälfte.
  for (const lang of [false, true]) {
    for (let winkel = lang ? 0 : 45; winkel < 360; winkel += 90) {
      const spitze = richtungsPunkt(mx, my, winkel, lang ? r : r * 0.6);
      const links  = richtungsPunkt(mx, my, winkel - 45, r * 0.16);
      const rechts = richtungsPunkt(mx, my, winkel + 45, r * 0.16);
      const mitte  = mx + "," + my;
      g.appendChild(svg("polygon", { points: mitte + " " + spitze + " " + links,  class: "kompass-hell" }));
      g.appendChild(svg("polygon", { points: mitte + " " + spitze + " " + rechts, class: "kompass-dunkel" }));
    }
  }

  const n = svg("text", { x: mx, y: my - r - 4, class: "kompass-n" });
  n.textContent = "N";
  g.appendChild(n);
  ebene.appendChild(g);
}

// ---------- Schiffsform (von oben gesehen) ----------
// Der Bug zeigt nach rechts (+x). Mit rotate() drehen wir das Schiff später in Fahrtrichtung.
// Von oben gesehen sieht ein Schiff in JEDER Richtung richtig aus – von der Seite gesehen
// stünde es bei Fahrt nach Westen auf dem Kopf.
function schiffsForm(segelFarbe) {
  const g = svg("g", { class: "schiffsform" });
  // Rumpf: spitz am Bug, rund am Heck
  g.appendChild(svg("path", { d: "M13,0 C8,-5 -4,-6 -11,-4 L-12,0 L-11,4 C-4,6 8,5 13,0 Z", class: "rumpf" }));
  // Deck-Linie
  g.appendChild(svg("path", { d: "M8,0 L-9,0", class: "deck" }));
  // Großsegel: quer zum Schiff, nach vorne gewölbt (der Wind kommt von hinten)
  g.appendChild(svg("path", { d: "M2,-10 Q8,0 2,10 L0,10 Q6,0 0,-10 Z", fill: segelFarbe, class: "segel" }));
  // kleines Besansegel am Heck
  g.appendChild(svg("path", { d: "M-6,-6 Q-2,0 -6,6 L-7.5,6 Q-3.5,0 -7.5,-6 Z", fill: segelFarbe, class: "segel" }));
  return g;
}

// ---------- Die ganze Karte aufbauen ----------
function zeichneKarte() {
  erstelleVorlagen();

  // Meer: eine Grundfarbe und darüber das bewegte Wellenmuster
  const ebeneMeer = svg("g");
  ebeneMeer.appendChild(svg("rect", { width: 800, height: 500, class: "meer" }));
  ebeneMeer.appendChild(svg("rect", { width: 800, height: 500, fill: "url(#wellen)" }));
  karte.appendChild(ebeneMeer);

  // Land
  const ebeneLand = svg("g");
  karte.appendChild(ebeneLand);
  zeichneLand(ebeneLand);

  // Eis (wird im Winter von zeichneEreignisse() gefüllt) – über dem Land, unter den Städten
  ebeneEis = svg("g");
  karte.appendChild(ebeneEis);

  // Kompassrose in der Nordsee
  zeichneKompass(ebeneLand, 72, 352, 30);

  // Piratengebiete als rote Kreise mit Totenkopf
  for (const station in PIRATEN) {
    const p = KNOTEN[station];
    const kreis = svg("circle", { class: "gefahr", cx: p.x, cy: p.y, r: 14 + PIRATEN[station] * 120 });  // je gefährlicher, desto größer
    const tooltip = svg("title");
    tooltip.textContent = "Piratengebiet " + station + ": " + Math.round(PIRATEN[station] * 100) + " % Risiko";
    kreis.appendChild(tooltip);
    ebeneLand.appendChild(kreis);

    const symbol = svg("text", { class: "gefahr-symbol", x: p.x, y: p.y });
    symbol.textContent = "☠";
    ebeneLand.appendChild(symbol);
  }

  // das Seewege-Netz einzeichnen – nur wenn ZEIGE_SEEWEGE auf true steht
  if (ZEIGE_SEEWEGE) {
    for (const [a, b] of SEEWEGE) {
      ebeneLand.appendChild(svg("line", { class: "seeweg", x1: KNOTEN[a].x, y1: KNOTEN[a].y, x2: KNOTEN[b].x, y2: KNOTEN[b].y }));
    }
  }

  ebeneRouten = svg("g");
  karte.appendChild(ebeneRouten);

  for (const stadt of staedte) {
    const gruppe = svg("g", { class: "stadt" });
    // Die Kreise merken wir uns, damit ihre Größe später der Einwohnerzahl folgen kann (staedte.js)
    stadt.svgKreis = svg("circle", { cx: stadt.x, cy: stadt.y, r: 8 });
    stadt.svgKern  = svg("circle", { cx: stadt.x, cy: stadt.y, r: 3, class: "stadt-kern" });
    gruppe.appendChild(stadt.svgKreis);
    gruppe.appendChild(stadt.svgKern);

    const text = svg("text", { x: stadt.x + 12, y: stadt.y + 5 });
    text.textContent = stadt.name + (stadt.werft ? " 🔨" : "");   // Werftstädte markieren
    stadt.svgText = text;   // merken, damit wir später 🏭 anhängen können
    gruppe.appendChild(text);

    karte.appendChild(gruppe);
    stadt.svgGruppe = gruppe;
    gruppe.addEventListener("click", () => stadtAngeklickt(stadt));
  }

  // Ebene für Ereignis-Symbole (über den Städten, unter den Schiffen)
  ebeneEreignisse = svg("g");
  karte.appendChild(ebeneEreignisse);

  // Konkurrenten-Schiffe liegen unter deinen Schiffen
  ebeneKI = svg("g");
  karte.appendChild(ebeneKI);

  ebeneSchiffe = svg("g");
  karte.appendChild(ebeneSchiffe);

  // Ganz oben: dunkler Rand und ein feiner Doppelrahmen wie bei einer gedruckten Karte.
  // pointer-events: none (im CSS) sorgt dafür, dass Klicks durch sie hindurchgehen.
  karte.appendChild(svg("rect", { width: 800, height: 500, fill: "url(#vignette)", class: "ueberlagerung" }));
  karte.appendChild(svg("rect", { x: 5, y: 5, width: 790, height: 490, class: "rahmen ueberlagerung" }));
}

// legt die Grafik für EIN Schiff an (nur einmal, beim ersten Zeichnen)
function erstelleSchiffGrafik(schiff) {
  const linie = svg("polyline", { class: "route" });   // Linie mit vielen Knicken
  ebeneRouten.appendChild(linie);

  const gruppe = svg("g", { class: "schiff" });
  gruppe.appendChild(svg("circle", { r: 16 }));        // gelber Kreis, wenn ausgewählt
  gruppe.appendChild(schiffsForm("#f6efe0"));          // deine Schiffe: helle Segel

  // <title> zeigt beim Drüberfahren mit der Maus den Namen an
  const tooltip = svg("title");
  tooltip.textContent = schiff.name;
  gruppe.appendChild(tooltip);
  ebeneSchiffe.appendChild(gruppe);

  gruppe.addEventListener("click", () => waehleSchiff(schiff.id));

  schiffGrafik[schiff.id] = { gruppe: gruppe, linie: linie, winkel: 0 };
  return schiffGrafik[schiff.id];
}

// Wo steht ein Schiff gerade – und in welche Richtung fährt es?
function schiffPosition(schiff) {
  if (schiff.reise) {
    // Position auf einem Weg mit mehreren Abschnitten.
    // Wir wissen, wie weit das Schiff insgesamt gefahren ist (strecke),
    // und laufen die Abschnitte ab, bis wir den richtigen gefunden haben.
    const r = schiff.reise;
    let strecke = reiseFortschritt(schiff) * r.laenge;

    for (let i = 0; i < r.punkte.length - 1; i++) {
      const a = r.punkte[i], b = r.punkte[i + 1];
      const abschnitt = entfernung(a, b);
      // Fahrtrichtung dieses Abschnitts. Math.atan2 liefert den Winkel einer Strecke
      // (im Bogenmaß) – mal 180/π ergibt Grad, so wie SVG ihn für rotate() braucht.
      const winkel = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      if (strecke <= abschnitt || i === r.punkte.length - 2) {
        const f = Math.min(strecke / abschnitt, 1);  // wie weit in DIESEM Abschnitt (0 … 1)
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, winkel: winkel };
      }
      strecke -= abschnitt;                          // Abschnitt ist schon geschafft
    }
  }

  // Liegen mehrere Schiffe im selben Hafen, stellen wir sie nebeneinander:
  // das erste direkt neben die Stadt, jedes weitere 26 Einheiten weiter links.
  // (Ohne "winkel" – im Hafen behält das Schiff seine letzte Richtung.)
  const stadt = findeStadt(schiff.ort);
  const imHafen = spiel.schiffe.filter(s => s.ort === schiff.ort);   // filter = alle passenden heraussuchen
  const nr = imHafen.indexOf(schiff);                                // die wievielte bin ich? (0, 1, 2 …)
  return { x: Math.max(stadt.x - 22 - nr * 26, 14), y: stadt.y - 16 };
}

// alle Schiffe zeichnen (wird in jedem Bild aufgerufen)
function zeichneSchiffe() {
  for (const schiff of spiel.schiffe) {
    const grafik = schiffGrafik[schiff.id] || erstelleSchiffGrafik(schiff);
    const pos = schiffPosition(schiff);
    if (pos.winkel !== undefined) grafik.winkel = pos.winkel;   // letzte Richtung merken

    // Erst verschieben, dann drehen. Die Reihenfolge ist wichtig: so dreht sich das
    // Schiff um seinen eigenen Mittelpunkt und nicht um die Ecke der Karte.
    grafik.gruppe.setAttribute("transform", "translate(" + pos.x + " " + pos.y + ") rotate(" + grafik.winkel + ")");
    grafik.gruppe.classList.toggle("gewaehlt", schiff.id === spiel.ausgewaehltesSchiffId);

    if (schiff.reise) {
      // Polylinie durch alle Stationen der Route
      const punkteText = schiff.reise.punkte.map(p => p.x + "," + p.y).join(" ");
      grafik.linie.setAttribute("points", punkteText);
      grafik.linie.style.display = "";
    } else {
      grafik.linie.style.display = "none";
    }
  }
}
