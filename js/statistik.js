// ======================================================================
// statistik.js – Chronik und Statistik: Aufzeichnen, Diagramme zeichnen, das Statistik-Fenster.
// ======================================================================

// Alle Kaufleute als Liste – für Diagramme und Legenden.
// "schluessel" ist der Name, unter dem ihre Werte in der Statistik gespeichert sind.
function kaufleute() {
  const liste = [{ schluessel: "du", name: "Du", farbe: FARBE_SPIELER }];
  for (const k of spiel.konkurrenten) {
    liste.push({ schluessel: "k" + k.id, name: k.name, farbe: k.farbe });
  }
  return liste;
}

// ---------- Chronik ----------
// Ein Eintrag für die Chronik: wichtige Momente deines Spiels
function chronik(symbol, text) {
  spiel.chronik.unshift({ tag: spiel.letzterBerechneterTag, symbol: symbol, text: text });
  if (spiel.chronik.length > CHRONIK_MAX) spiel.chronik.pop();
}

// ---------- Aufzeichnen ----------
// Ein "Schnappschuss" der wichtigsten Zahlen. Wird jede Woche gespeichert.
function schnappschuss() {
  const e = { tag: spiel.letzterBerechneterTag, vermoegen: {}, schiffe: {}, einwohner: {} };
  e.vermoegen.du = Math.round(vermoegenSpieler());
  e.schiffe.du = spiel.schiffe.length;
  for (const k of spiel.konkurrenten) {
    e.vermoegen["k" + k.id] = Math.round(k.gold + wertDerSchiffe(k.schiffe));
    e.schiffe["k" + k.id] = k.schiffe.length;
  }
  for (const s of staedte) e.einwohner[s.name] = Math.round(spiel.einwohner[s.name]);
  return e;
}

function statistikAufzeichnen() {
  spiel.statistik.push(schnappschuss());

  // Damit der Spielstand nicht endlos wächst: Wird die Liste zu lang, "dünnen" wir die
  // ältere Hälfte aus und behalten dort nur jeden zweiten Eintrag. Die jüngere Vergangenheit
  // bleibt also genau, die ferne Vergangenheit wird gröber – fürs Diagramm reicht das.
  if (spiel.statistik.length > STATISTIK_MAX) {
    const haelfte = Math.floor(spiel.statistik.length / 2);
    const alt = spiel.statistik.slice(0, haelfte).filter((eintrag, i) => i % 2 === 0);
    spiel.statistik = alt.concat(spiel.statistik.slice(haelfte));
  }
}

// ---------- Hilfen für Diagramme ----------

// "Schöne" Achsenwerte finden: statt 0, 3.417, 6.834 … lieber 0, 5.000, 10.000 …
// Die Schrittweite ist immer 1, 2 oder 5 mal eine Zehnerpotenz.
function schoeneSchritte(min, max, anzahl = 4) {
  const spanne = (max - min) || 1;
  const roh = spanne / anzahl;
  const zehner = Math.pow(10, Math.floor(Math.log10(roh)));   // z.B. 1000 bei roh = 3417
  const schritt = [1, 2, 5, 10].map(f => f * zehner).find(s => s >= roh);
  const von = Math.floor(min / schritt) * schritt;
  const bis = Math.ceil(max / schritt) * schritt;
  const werte = [];
  for (let v = von; v <= bis + schritt / 2; v += schritt) werte.push(v);
  return { von: von, bis: bis, werte: werte };
}

// 12500 -> "12,5 Tsd.", 2300000 -> "2,3 Mio."
function kurzeZahl(n) {
  const betrag = Math.abs(n);
  if (betrag >= 1e6) return (n / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " Mio.";
  if (betrag >= 1e4) return (n / 1e3).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " Tsd.";
  return geld(Math.round(n));
}

// "Apr 1400"
function monatJahr(tag) {
  const d = datumVon(tag);
  return MONATE[d.getMonth()].slice(0, 3) + " " + d.getFullYear();
}

// ---------- Ein Liniendiagramm zeichnen ----------
// tage:   [0, 7, 14, …]                       – die x-Werte
// serien: [{ name, farbe, werte: [..] }, …]   – je Serie ein Wert pro Tag
// Gibt ein fertiges HTML-Element zurück.
function linienDiagramm(tage, serien, einheit) {
  const box = document.createElement("div");
  box.className = "diagramm";
  if (tage.length < 2) {
    box.innerHTML = "<div class='hinweis'>Noch zu wenig Daten. Die Statistik wird jede Woche ergänzt – schau in ein paar Wochen wieder vorbei.</div>";
    return box;
  }

  // Maße im eigenen Koordinatensystem; Ränder links für Zahlen, rechts für Namen
  const B = 820, H = 300, LINKS = 70, RECHTS = 130, OBEN = 14, UNTEN = 30;
  const alleWerte = serien.flatMap(s => s.werte);           // flatMap: alle Listen zu einer zusammenfügen
  const y = schoeneSchritte(Math.min(0, ...alleWerte), Math.max(...alleWerte));
  const tagMin = tage[0], tagMax = tage[tage.length - 1];

  // Umrechnung Daten -> Bildpunkte (wieder die lineare Interpolation aus Schritt 4)
  const xPos = t => LINKS + (t - tagMin) / (tagMax - tagMin) * (B - LINKS - RECHTS);
  const yPos = v => OBEN + (1 - (v - y.von) / (y.bis - y.von)) * (H - OBEN - UNTEN);

  const s = svg("svg", { viewBox: "0 0 " + B + " " + H, class: "diagramm-svg" });

  // Gitterlinien und Beschriftung der y-Achse – zurückhaltend, damit die Daten im Vordergrund stehen
  for (const v of y.werte) {
    s.appendChild(svg("line", { x1: LINKS, x2: B - RECHTS, y1: yPos(v), y2: yPos(v), class: v === 0 ? "gitter null" : "gitter" }));
    const t = svg("text", { x: LINKS - 8, y: yPos(v) + 4, class: "achse-text", "text-anchor": "end" });
    t.textContent = kurzeZahl(v);
    s.appendChild(t);
  }
  // x-Achse: fünf gleichmäßig verteilte Datumsangaben
  for (let i = 0; i <= 4; i++) {
    const tag = tagMin + (tagMax - tagMin) * i / 4;
    const t = svg("text", { x: xPos(tag), y: H - 8, class: "achse-text", "text-anchor": "middle" });
    t.textContent = monatJahr(tag);
    s.appendChild(t);
  }

  // Die Linien selbst
  for (const serie of serien) {
    const punkte = serie.werte.map((v, i) => xPos(tage[i]).toFixed(1) + "," + yPos(v).toFixed(1)).join(" ");
    s.appendChild(svg("polyline", { points: punkte, stroke: serie.farbe, class: "linie" }));
  }

  // Namen direkt ans Ende jeder Linie schreiben (statt einer Legende, die man suchen muss).
  // Liegen zwei Enden zu nah beieinander, schieben wir die Beschriftungen auseinander.
  const enden = serien.map(serie => ({ serie: serie, y: yPos(serie.werte[serie.werte.length - 1]) }));
  enden.sort((a, b) => a.y - b.y);
  for (let i = 1; i < enden.length; i++) {
    if (enden[i].y - enden[i - 1].y < 16) enden[i].y = enden[i - 1].y + 16;
  }
  for (const ende of enden) {
    s.appendChild(svg("circle", { cx: B - RECHTS + 10, cy: ende.y, r: 4, fill: ende.serie.farbe }));
    const t = svg("text", { x: B - RECHTS + 18, y: ende.y + 4, class: "end-label" });
    t.textContent = ende.serie.name;
    s.appendChild(t);
  }

  // ---- Hover: senkrechte Linie, Punkte und ein Infokästchen beim Darüberfahren ----
  const kreuz = svg("line", { y1: OBEN, y2: H - UNTEN, class: "kreuz", visibility: "hidden" });
  s.appendChild(kreuz);
  const marker = serien.map(serie => {
    const m = svg("circle", { r: 4.5, fill: serie.farbe, class: "punkt", visibility: "hidden" });
    s.appendChild(m);
    return m;
  });
  // Eine unsichtbare Fläche über dem Diagramm fängt die Mausbewegungen ein
  const flaeche = svg("rect", { x: LINKS, y: OBEN, width: B - LINKS - RECHTS, height: H - OBEN - UNTEN, fill: "transparent" });
  s.appendChild(flaeche);

  const tipp = document.createElement("div");
  tipp.className = "tooltip";

  flaeche.addEventListener("pointermove", (ev) => {   // "pointer" = Maus, Finger oder Stift
    // Bildschirm-Pixel -> Koordinaten im viewBox (das SVG kann ja beliebig skaliert sein)
    const rahmen = s.getBoundingClientRect();
    const vx = (ev.clientX - rahmen.left) / rahmen.width * B;
    const tag = tagMin + (vx - LINKS) / (B - LINKS - RECHTS) * (tagMax - tagMin);

    // den nächstgelegenen aufgezeichneten Tag suchen
    let i = 0;
    for (let j = 1; j < tage.length; j++) {
      if (Math.abs(tage[j] - tag) < Math.abs(tage[i] - tag)) i = j;
    }

    const x = xPos(tage[i]);
    kreuz.setAttribute("x1", x);
    kreuz.setAttribute("x2", x);
    kreuz.setAttribute("visibility", "visible");
    serien.forEach((serie, n) => {
      marker[n].setAttribute("cx", x);
      marker[n].setAttribute("cy", yPos(serie.werte[i]));
      marker[n].setAttribute("visibility", "visible");
    });

    // Infokästchen: Datum und alle Werte, der größte zuerst
    const zeilen = serien.map(serie => ({ serie: serie, wert: serie.werte[i] })).sort((a, b) => b.wert - a.wert);
    tipp.innerHTML = "<b>" + datumKurz(tage[i]) + " " + datumVon(tage[i]).getFullYear() + "</b><br>" +
      zeilen.map(z => "<span style='color:" + z.serie.farbe + "'>●</span> " + z.serie.name + ": " + geld(z.wert) + einheit).join("<br>");
    tipp.style.display = "block";
    // Kästchen links oder rechts vom Kreuz – je nachdem, wo mehr Platz ist
    const anteil = x / B;
    if (anteil < 0.55) { tipp.style.left = (anteil * 100 + 2) + "%"; tipp.style.right = "auto"; }
    else               { tipp.style.right = ((1 - anteil) * 100 + 2) + "%"; tipp.style.left = "auto"; }
  });
  flaeche.addEventListener("pointerleave", () => {
    tipp.style.display = "none";
    kreuz.setAttribute("visibility", "hidden");
    marker.forEach(m => m.setAttribute("visibility", "hidden"));
  });

  box.appendChild(s);
  box.appendChild(tipp);
  return box;
}

// ---------- Das Statistik-Fenster ----------
let statistikTab = "vermoegen";
let warPausiertVorStatistik = false;

// Die aufgezeichneten Wochen plus ein Punkt für "heute", damit das Diagramm aktuell ist
function statistikMitHeute() {
  const liste = spiel.statistik.slice();          // slice() ohne Angaben = Kopie der Liste
  const letzte = liste[liste.length - 1];
  if (!letzte || letzte.tag < spiel.letzterBerechneterTag) liste.push(schnappschuss());
  return liste;
}

// Diagramm für "vermoegen" oder "schiffe" bauen
function kaufleuteDiagramm(feld, einheit) {
  const daten = statistikMitHeute();
  const tage = daten.map(e => e.tag);
  const serien = kaufleute().map(k => ({
    name: k.name,
    farbe: k.farbe,
    werte: daten.map(e => e[feld][k.schluessel] || 0)
  }));
  return linienDiagramm(tage, serien, einheit);
}

// Kleine Tabelle unter dem Diagramm – die Zahlen zum Nachlesen
function kaufleuteTabelle(feld, einheit) {
  const daten = statistikMitHeute();
  const jetzt = daten[daten.length - 1];
  let html = "<table><tr><th>Kaufmann</th><th>Jetzt</th><th>Höchstwert</th></tr>";
  for (const k of kaufleute()) {
    const hoch = Math.max(...daten.map(e => e[feld][k.schluessel] || 0));
    html += "<tr><td><span style='color:" + k.farbe + "'>●</span> " + k.name + "</td>" +
            '<td class="zahl">' + geld(jetzt[feld][k.schluessel] || 0) + einheit + "</td>" +
            '<td class="zahl">' + geld(hoch) + einheit + "</td></tr>";
  }
  return html + "</table>";
}

function staedteAnsicht() {
  const erste = spiel.statistik[0];
  const liste = staedte.map(s => ({
    name: s.name,
    ew: Math.round(spiel.einwohner[s.name]),
    start: erste ? erste.einwohner[s.name] : START_EINWOHNER[s.name]
  }));
  liste.sort((a, b) => b.ew - a.ew);
  const max = liste[0].ew;

  // Ein Balken pro Stadt, alle in EINER Farbe – hier geht es um "wie viel", nicht um "wer"
  let html = "<div class='hinweis'>Einwohner heute und Veränderung seit Beginn der Aufzeichnung</div><table>";
  for (const z of liste) {
    const prozent = Math.round((z.ew / z.start - 1) * 100);
    const trend = prozent > 0 ? "<span class='plus'>▲ +" + prozent + " %</span>"
                : prozent < 0 ? "<span class='minus'>▼ " + prozent + " %</span>" : "● 0 %";
    html += "<tr><td>" + z.name + "</td>" +
            "<td style='width:55%'><div class='stadt-balken' style='width:" + (z.ew / max * 100).toFixed(1) + "%'></div></td>" +
            '<td class="zahl">' + geld(z.ew) + "</td><td class='zahl'>" + trend + "</td></tr>";
  }
  return html + "</table>";
}

function chronikAnsicht() {
  if (spiel.chronik.length === 0) return "<div class='hinweis'>Noch keine Einträge.</div>";
  let html = "<table>";
  for (const e of spiel.chronik) {
    html += "<tr><td class='klein' style='white-space:nowrap'>" + datumKurz(e.tag) + " " + datumVon(e.tag).getFullYear() + "</td>" +
            "<td>" + e.symbol + "</td><td style='white-space:normal'>" + e.text + "</td></tr>";
  }
  return html + "</table>";
}

function zeigeStatistik() {
  const inhalt = document.getElementById("statistikInhalt");
  inhalt.innerHTML = "";
  document.querySelectorAll("#statistikTabs button").forEach(b => b.classList.toggle("aktiv", b.dataset.tab === statistikTab));

  if (statistikTab === "vermoegen") {
    inhalt.innerHTML = "<div class='hinweis'>Vermögen = Geld + halber Wert der Schiffe + Ladung (bei dir auch Betriebe und Kontore)</div>";
    inhalt.appendChild(kaufleuteDiagramm("vermoegen", " ₰"));
    inhalt.insertAdjacentHTML("beforeend", kaufleuteTabelle("vermoegen", " ₰"));   // HTML am Ende anhängen
  }
  if (statistikTab === "schiffe") {
    inhalt.innerHTML = "<div class='hinweis'>Anzahl der Schiffe</div>";
    inhalt.appendChild(kaufleuteDiagramm("schiffe", ""));
    inhalt.insertAdjacentHTML("beforeend", kaufleuteTabelle("schiffe", ""));
  }
  if (statistikTab === "staedte") inhalt.innerHTML = staedteAnsicht();
  if (statistikTab === "chronik") inhalt.innerHTML = chronikAnsicht();
}

function oeffneStatistik() {
  const fenster = document.getElementById("statistikFenster");
  if (fenster.style.display === "block") return schliesseStatistik();   // zweiter Klick schließt
  warPausiertVorStatistik = spiel.pausiert;
  setzePause(true);
  fenster.style.display = "block";
  zeigeStatistik();
}

function schliesseStatistik() {
  document.getElementById("statistikFenster").style.display = "none";
  setzePause(warPausiertVorStatistik);
}

document.getElementById("btnStatistik").addEventListener("click", oeffneStatistik);
document.getElementById("statistikZu").addEventListener("click", schliesseStatistik);
document.getElementById("statistikTabs").addEventListener("click", (e) => {
  const knopf = e.target.closest("button");
  if (!knopf) return;
  statistikTab = knopf.dataset.tab;
  zeigeStatistik();
});
