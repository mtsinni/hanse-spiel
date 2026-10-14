// ======================================================================
// gefecht.js – Seeschlachten gegen Piraten: Begegnung, Kampfrunden, Ergebnis – mit dem Gefechtsfenster.
// ======================================================================
//
// Ablauf:
//   1. Begegnung  – Piraten tauchen auf. Du entscheidest: kämpfen, fliehen, Lösegeld zahlen oder Ladung übergeben.
//   2. Kampf      – Runde für Runde: Feuer!, Entern (wenn die Piraten angeschlagen sind), Fliehen oder Ergeben.
//   3. Ende       – Beute, Verluste, Schäden. Mit "Weiter" geht die Reise weiter.
//
// Ein Gefecht ist ein "Zustandsautomat": Das Feld "phase" sagt, in welchem Abschnitt wir sind,
// und davon hängt ab, welche Knöpfe es gibt und was sie tun.

let gefecht = null;                 // das laufende Gefecht – oder null, wenn gerade keins läuft
let warPausiertVorGefecht = false;

// ---------- Rechnungen ----------

// Wert der Ladung zum Grundpreis – Grundlage für das Lösegeld
function ladungsWert(schiff) {
  let summe = 0;
  for (const ware of WAREN) summe += schiff.ladung[ware.id] * ware.basispreis;
  return summe;
}

function loesegeld(schiff) {
  return rundeAuf10(200 + ladungsWert(schiff) * LOESEGELD_ANTEIL);
}

// Fluchtchance: schnelle Schiffe entkommen leichter. Angeschlagene Piraten verfolgen weniger hartnäckig.
function fluchtChance() {
  const g = gefecht;
  let chance = 0.2 + (g.schiff.tempo - PIRATEN_TEMPO) * 0.025;
  if (g.phase === "kampf") chance += (1 - g.pirRumpf / g.pirMax) * 0.3;
  return Math.min(Math.max(chance, 0.1), 0.8);
}

// Entern geht erst, wenn das Piratenschiff höchstens noch 35 % Rumpf hat
function kannEntern() {
  return gefecht.pirRumpf / gefecht.pirMax <= 0.35;
}
function enterChance() {
  return Math.min(0.4 + (1 - gefecht.pirRumpf / gefecht.pirMax) * 0.5, 0.9);
}

// Eine Salve: Die Mannschaft schießt immer (Musketen), jede Kanone trifft mit einer gewissen Chance
function salve(anzahlKanonen) {
  let schaden = zufallsZahl(MUSKETEN_SCHADEN[0], MUSKETEN_SCHADEN[1]);
  let treffer = 0;
  for (let i = 0; i < anzahlKanonen; i++) {
    if (Math.random() < TREFFER_CHANCE) {
      schaden += zufallsZahl(TREFFER_SCHADEN[0], TREFFER_SCHADEN[1]);
      treffer++;
    }
  }
  return { schaden: schaden, treffer: treffer };
}

// Piraten nehmen einen Teil (von … bis) jeder Ware mit. Gibt eine Liste wie ["12× Salz", "5× Pelze"] zurück.
function raubeLadung(schiff, von, bis) {
  const anteil = von + Math.random() * (bis - von);
  const verluste = [];
  for (const ware of WAREN) {
    const weg = Math.round(schiff.ladung[ware.id] * anteil);
    if (weg > 0) {
      schiff.ladung[ware.id] -= weg;
      if (schiff.ladung[ware.id] === 0) schiff.einkaufspreis[ware.id] = 0;
      verluste.push(weg + "× " + ware.name);
    }
  }
  return verluste;
}

function logZeile(text) {
  gefecht.log.push(text);
  if (gefecht.log.length > 6) gefecht.log.shift();    // nur die letzten 6 Zeilen zeigen
}

// ---------- Ablauf ----------

function starteGefecht(schiff, station) {
  const typ = typVon(schiff);
  const pirMax = zufallsZahl(PIRATEN_RUMPF[0], PIRATEN_RUMPF[1]);
  gefecht = {
    schiff: schiff,
    station: station,
    pirat: zufallsElement(PIRATEN_NAMEN),
    pirMax: pirMax,
    pirRumpf: pirMax,
    pirKanonen: zufallsZahl(PIRATEN_KANONEN[0], PIRATEN_KANONEN[1]),
    rumpfMax: typ.rumpf,
    rumpf: Math.max(1, Math.round(typ.rumpf * zustand(schiff) / 100)),   // ein beschädigtes Schiff geht geschwächt ins Gefecht
    phase: "begegnung",
    log: []
  };
  warPausiertVorGefecht = spiel.pausiert;
  setzePause(true);
  logZeile("Bei " + station + " taucht ein Piratenschiff auf: <b>" + gefecht.pirat + "</b> mit " +
           gefecht.pirKanonen + " Kanone(n). Es hält direkt auf die <b>" + schiff.name + "</b> zu!");
  zeichneGefechtsbild();
  zeigeGefechtFenster();
  spieleTon("alarm");                   // Schritt 22: Schiffsglocke schlägt Alarm
}

function gefechtAktion(aktion) {
  const g = gefecht;
  if (!g) return;

  if (aktion === "kaempfen") {
    g.phase = "kampf";
    logZeile("„Kanonen laden! Klar zum Gefecht!“");
  }
  if (aktion === "feuer") kampfrunde();
  if (aktion === "fliehen") {
    if (Math.random() < fluchtChance()) {
      gefechtEnde("flucht");
    } else {
      logZeile("Die Flucht misslingt – die Piraten holen auf!");
      g.phase = "kampf";
      piratenSchiessen(1);
    }
  }
  if (aktion === "loesegeld") {
    const betrag = loesegeld(g.schiff);
    if (spiel.gold >= betrag) gefechtEnde("loesegeld");
  }
  if (aktion === "uebergeben") gefechtEnde("uebergabe");
  if (aktion === "entern" && kannEntern()) {
    if (Math.random() < enterChance()) {
      gefechtEnde("geentert");
    } else {
      logZeile("Der Enterversuch scheitert! Die Piraten wehren sich verbissen.");
      piratenSchiessen(1.5);                           // ein fehlgeschlagener Enterversuch ist gefährlich
    }
  }
  if (aktion === "ergeben") gefechtEnde("ergeben");
  if (aktion === "weiter") return schliesseGefecht();

  zeigeGefechtFenster();
}

// Eine Runde: Du schießt zuerst, dann die Piraten (wenn sie noch schwimmen)
function kampfrunde() {
  const g = gefecht;
  const s = salve(kanonen(g.schiff));
  g.pirRumpf = Math.max(0, g.pirRumpf - s.schaden);
  zeigeTreffer("pirat", s.schaden);
  spieleTon("kanone");
  logZeile("Deine Salve: " + s.treffer + " von " + kanonen(g.schiff) + " Kanonen treffen – <b>" + s.schaden + "</b> Schaden.");
  if (g.pirRumpf <= 0) return gefechtEnde("sieg");
  piratenSchiessen(1);
}

function piratenSchiessen(faktor) {
  const g = gefecht;
  if (g.phase === "ende") return;
  const s = salve(g.pirKanonen);
  const schaden = Math.round(s.schaden * faktor);
  g.rumpf = Math.max(0, g.rumpf - schaden);
  setTimeout(() => { zeigeTreffer("eigen", schaden); spieleTon("kanone"); }, 450);   // etwas später – erst schießt du, dann sie
  logZeile("Die Piraten feuern zurück – <b>" + schaden + "</b> Schaden an der " + g.schiff.name + ".");
  if (g.rumpf <= 0) gefechtEnde("niederlage");
}

// Das Ergebnis anwenden: Beute, Verluste, Ansehen, Chronik
function gefechtEnde(art) {
  const g = gefecht;
  if (g.phase === "ende") return;                       // nicht zweimal beenden
  g.phase = "ende";
  const s = g.schiff;

  if (art === "sieg" || art === "geentert") {
    let beute = rundeAuf10(zufallsZahl(300, 800) * (1 + g.pirKanonen * 0.25));
    if (art === "geentert") beute *= 2;                // die ganze Schatzkiste statt nur Treibgut
    spiel.gold += beute;
    buche("⚔ Beute von " + g.pirat, beute);
    g.ergebnis = (art === "geentert"
      ? "🪝 <b>Geentert!</b> Deine Leute stürmen das Piratenschiff und erbeuten die Schatzkiste: "
      : "🔥 <b>Sieg!</b> Das Piratenschiff sinkt. Aus dem Wrack fischt ihr ") + "<b>" + geld(beute) + " ₰</b>.";
    // Besiegt: Das Piratenschiff versinkt langsam (CSS-Animation "sinken")
    if (art === "sieg") setTimeout(() => { if (gefecht) gefecht.bildPirat.classList.add("sinkt"); }, 500);
    chronik("⚔", "Die " + s.name + " " + (art === "geentert" ? "entert" : "besiegt") + " " + g.pirat + " bei " + g.station + " (+" + geld(beute) + " ₰)");
    setTimeout(() => spieleTon("fanfare"), 600);   // Schritt 22
    ansehenPlus(art === "geentert" ? 15 : 8);
  }
  if (art === "flucht") {
    spieleTon("segel");
    g.ergebnis = "⛵ <b>Entkommen!</b> Mit vollen Segeln lässt die " + s.name + " die Piraten hinter sich.";
  }
  if (art === "loesegeld") {
    const betrag = loesegeld(s);
    spiel.gold -= betrag;
    buche("☠ Lösegeld an " + g.pirat, -betrag);
    g.ergebnis = "💰 Du zahlst <b>" + geld(betrag) + " ₰</b>. Die Piraten ziehen grinsend ab – die Ladung bleibt an Bord.";
  }
  if (art === "uebergabe" || art === "ergeben" || art === "niederlage") {
    const bereich = { uebergabe: [0.3, 0.6], ergeben: [0.5, 0.8], niederlage: [0.8, 1.0] }[art];
    const verluste = raubeLadung(s, bereich[0], bereich[1]);
    const text = verluste.length ? "Verloren: " + verluste.join(", ") + "." : "Zum Glück war der Laderaum leer.";
    if (art === "uebergabe")  g.ergebnis = "🏳 Du lässt die Piraten an Bord. " + text;
    if (art === "ergeben")    g.ergebnis = "🏳 Du streichst die Flagge. " + text;
    if (art === "niederlage") g.ergebnis = "💥 <b>Niederlage!</b> Die " + s.name + " ist schwer beschädigt, die Piraten plündern sie aus. " + text;
    if (verluste.length) chronik("☠", g.pirat + " plündert die " + s.name + " bei " + g.station);
    if (art === "ergeben")    ansehenPlus(-3);
    if (art === "niederlage") { ansehenPlus(-5); setTimeout(() => spieleTon("niederlage"), 600); }
  }

  // Schäden bleiben am Schiff, bis es in einer Werft repariert wird (mindestens 10 % bleiben übrig)
  s.zustand = Math.max(10, Math.round(g.rumpf / g.rumpfMax * 100));
  if (s.zustand < 100) g.ergebnis += "<br><span class='hinweis'>Zustand der " + s.name + ": " + s.zustand + " % – reparieren kannst du in jeder Werft 🔨.</span>";
}

function schliesseGefecht() {
  document.getElementById("gefecht").style.display = "none";
  gefecht = null;
  setzePause(warPausiertVorGefecht);
  zeigeMarkt();
  zeigeFlotte();
  zeigeKasse();
  aktualisiereAnzeige();
}

// ---------- Anzeige ----------

// Ein Lebensbalken: grün, bei wenig Rumpf gelb und rot (immer zusammen mit der Zahl)
function rumpfBalken(titel, wert, max) {
  const anteil = wert / max;
  const farbe = anteil > 0.5 ? "#5fae5f" : anteil > 0.25 ? "#d9a030" : "#d0503c";
  return "<div class='gefecht-seite'><div>" + titel + "</div>" +
         "<div class='rumpf-balken'><span style='width:" + (anteil * 100).toFixed(0) + "%;background:" + farbe + "'></span></div>" +
         "<div class='klein'>Rumpf " + wert + " / " + max + "</div></div>";
}

function knopf(aktion, text, gesperrt = false) {
  return '<button data-aktion="' + aktion + '"' + (gesperrt ? " disabled" : "") + ">" + text + "</button> ";
}

function zeigeGefechtFenster() {
  const g = gefecht;
  const s = g.schiff;
  document.getElementById("gefechtTitel").textContent =
    g.phase === "begegnung" ? "☠ Piraten in Sicht!" : g.phase === "kampf" ? "⚔ Seeschlacht bei " + g.station : "Das Gefecht ist vorbei";

  document.getElementById("gefechtWerte").innerHTML =
    rumpfBalken("⛵ <b>" + s.name + "</b> <span class='klein'>(" + s.typ + ", ⚔ " + kanonen(s) + ")</span>", g.rumpf, g.rumpfMax) +
    rumpfBalken("☠ <b>" + g.pirat + "</b> <span class='klein'>(⚔ " + g.pirKanonen + ")</span>", g.pirRumpf, g.pirMax);

  let text = g.log.map(z => "<div>" + z + "</div>").join("");
  if (g.phase === "ende") text += "<div class='gefecht-ergebnis'>" + g.ergebnis + "</div>";
  document.getElementById("gefechtLog").innerHTML = text;

  let knoepfe = "";
  const prozent = x => Math.round(x * 100) + " %";
  if (g.phase === "begegnung") {
    const betrag = loesegeld(s);
    knoepfe = knopf("kaempfen", "⚔ Kämpfen") +
              knopf("fliehen", "⛵ Fliehen (" + prozent(fluchtChance()) + ")") +
              knopf("loesegeld", "💰 Lösegeld zahlen (" + geld(betrag) + " ₰)", spiel.gold < betrag) +
              knopf("uebergeben", "🏳 Ladung übergeben");
    knoepfe += "<div class='hinweis' style='margin-top:6px'>Deine Kampfkraft: ca. " + mittlererSchaden(kanonen(s)) +
               " Schaden pro Salve · Piraten: ca. " + mittlererSchaden(g.pirKanonen) + "</div>";
  }
  if (g.phase === "kampf") {
    knoepfe = knopf("feuer", "🔥 Feuer!") +
              (kannEntern() ? knopf("entern", "🪝 Entern (" + prozent(enterChance()) + ")") : "") +
              knopf("fliehen", "⛵ Fliehen (" + prozent(fluchtChance()) + ")") +
              knopf("ergeben", "🏳 Ergeben");
  }
  if (g.phase === "ende") knoepfe = knopf("weiter", "Weiter");
  document.getElementById("gefechtKnoepfe").innerHTML = knoepfe;

  document.getElementById("gefecht").style.display = "block";
}

// Die kleine Szene: zwei Schiffe auf bewegtem Meer
function zeichneGefechtsbild() {
  const bild = document.getElementById("gefechtBild");
  bild.innerHTML = "";
  bild.appendChild(svg("rect", { width: 400, height: 120, class: "meer" }));
  bild.appendChild(svg("rect", { width: 400, height: 120, fill: "url(#wellen)" }));   // das Muster aus karte.js

  // Drei Ebenen je Schiff: Position (transform) -> Wackeln bei Treffern -> Schaukeln (aus dem CSS)
  function schiffImBild(x, drehung, segel) {
    const aussen = svg("g", { transform: "translate(" + x + " 62) rotate(" + drehung + ") scale(2.6)" });
    const wackler = svg("g", { class: "wackler" });
    wackler.appendChild(schiffsForm(segel));
    aussen.appendChild(wackler);
    bild.appendChild(aussen);
    return wackler;
  }
  gefecht.bildEigen = schiffImBild(105, 0, "#f6efe0");
  gefecht.bildPirat = schiffImBild(295, 180, "#2b2b2b");    // schwarze Segel, Bug zeigt nach links
}

// Mündungsfeuer, Wackeln und eine aufsteigende Schadenszahl
function zeigeTreffer(ziel, schaden) {
  if (!gefecht) return;
  const bild = document.getElementById("gefechtBild");
  const schuetzeX = ziel === "pirat" ? 145 : 255;
  const zielX     = ziel === "pirat" ? 295 : 105;

  const blitz = svg("circle", { cx: schuetzeX, cy: 62, r: 10, class: "blitz" });
  bild.appendChild(blitz);

  const zahl = svg("text", { x: zielX, y: 40, class: "schadenszahl" });
  zahl.textContent = "−" + schaden;
  bild.appendChild(zahl);

  const wackler = ziel === "pirat" ? gefecht.bildPirat : gefecht.bildEigen;
  wackler.classList.remove("getroffen");
  void wackler.getBBox();                 // Trick: zwingt den Browser, die Animation neu zu starten
  wackler.classList.add("getroffen");

  // Nach der Animation wieder aufräumen
  setTimeout(() => { blitz.remove(); zahl.remove(); }, 1000);
}

// Klicks im Gefechtsfenster
document.getElementById("gefechtKnoepfe").addEventListener("click", (e) => {
  const k = e.target.closest("button");
  if (k) gefechtAktion(k.dataset.aktion);
});
