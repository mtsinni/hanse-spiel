// ======================================================================
// konkurrenten.js – Die computergesteuerten Konkurrenten, ihre KI und die Rangliste.
// ======================================================================

// ---------- Konkurrenten und ihre künstliche Intelligenz ----------

function erstelleKonkurrenten() {
  const liste = [];
  KONKURRENTEN_START.forEach((vorlage, i) => {
    const k = {
      id: i + 1,
      name: vorlage.name,
      heimat: vorlage.heimat,
      farbe: vorlage.farbe,
      gold: 2000,
      schiffe: [],
      naechsteNr: 1
    };
    erstelleKISchiff(k, "schnigge", k.heimat);
    liste.push(k);
  });
  return liste;
}

// Ein Schiff für einen Konkurrenten – gleich aufgebaut wie deine Schiffe.
// Deshalb funktionieren Funktionen wie reiseFortschritt() oder ladungGesamt() auch für sie.
function erstelleKISchiff(k, typId, ort) {
  const typ = SCHIFFSTYPEN.find(t => t.id === typId);
  const schiff = {
    id: "k" + k.id + "-" + k.naechsteNr,      // z.B. "k2-3" – kann nie mit deinen Nummern verwechselt werden
    name: zufallsElement(KI_SCHIFFSNAMEN),
    typ: typ.name,
    kapazitaet: typ.kapazitaet,
    tempo: typ.tempo,
    ort: ort,
    reise: null,
    ladung: {},
    einkaufspreis: {}
  };
  for (const ware of WAREN) {
    schiff.ladung[ware.id] = 0;
    schiff.einkaufspreis[ware.id] = 0;
  }
  k.naechsteNr++;
  k.schiffe.push(schiff);
  return schiff;
}

// 1. Alles verkaufen, was an Bord ist – Stück für Stück, genau wie bei dir
function kiVerkaufeAlles(k, schiff) {
  const markt = spiel.maerkte[schiff.ort];
  for (const ware of WAREN) {
    while (schiff.ladung[ware.id] > 0) {
      k.gold += verkaufspreis(schiff.ort, ware);
      markt[ware.id] += 1;
      schiff.ladung[ware.id] -= 1;
    }
    schiff.einkaufspreis[ware.id] = 0;
  }
}

// 2. Die beste Handelsidee suchen: Welche Ware, wohin?
//    Die KI probiert ALLE Kombinationen aus Ware und Zielstadt durch und bewertet jede
//    mit "geschätzter Gewinn pro Reisetag". Die beste gewinnt. So eine einfache
//    "Probiere alles und nimm das Beste"-Strategie nennt man eine gierige Strategie (greedy).
function kiPlane(k, schiff) {
  const hier = schiff.ort;
  let beste = null;

  for (const ziel of staedte) {
    if (ziel.name === hier || istZugefroren(ziel.name)) continue;
    const tage = findeRoute(hier, ziel.name).laenge / schiff.tempo;

    for (const ware of WAREN) {
      const kp = kaufpreis(hier, ware);
      const vp = verkaufspreis(ziel.name, ware);
      const spanne = vp - kp;
      if (spanne < kp * KI_MIN_SPANNE) continue;   // zu wenig Aufschlag – lohnt nicht

      const menge = Math.min(schiff.kapazitaet, Math.floor(spiel.maerkte[hier][ware.id]), Math.floor(k.gold / kp));
      if (menge < 5) continue;

      // Beim Kaufen steigt der Preis, beim Verkaufen fällt er – darum rechnen wir
      // vorsichtig nur mit der halben Spanne.
      const wert = (spanne * 0.5 * menge) / tage;
      if (beste === null || wert > beste.wert) {
        beste = { ziel: ziel.name, ware: ware, wert: wert, zielPreis: vp };
      }
    }
  }
  return beste;    // null, wenn nichts Lohnendes gefunden wurde
}

// 3. Einkaufen, solange es sich noch lohnt
function kiKaufe(k, schiff, plan) {
  const markt = spiel.maerkte[schiff.ort];
  const id = plan.ware.id;
  while (ladungGesamt(schiff) < schiff.kapazitaet && markt[id] >= 1) {
    const preis = kaufpreis(schiff.ort, plan.ware);
    if (preis > plan.zielPreis * 0.85) break;     // zu teuer geworden – aufhören
    if (k.gold < preis) break;
    schiff.einkaufspreis[id] = mischpreis(schiff.ladung[id], schiff.einkaufspreis[id], 1, preis);
    schiff.ladung[id] += 1;
    markt[id] -= 1;
    k.gold -= preis;
  }
}

// 4. Losfahren – wie segeln(), aber ohne Meldung an dich.
//    Die Abfahrt liegt KI_LIEGEZEIT Tage in der Zukunft: So lange "lädt" das Schiff noch im Hafen.
function kiSegeln(schiff, zielName) {
  const route = findeRoute(schiff.ort, zielName);
  schiff.reise = {
    von: schiff.ort, nach: zielName, startTag: spiel.tag + KI_LIEGEZEIT,
    dauer: route.laenge / schiff.tempo, punkte: route.punkte, laenge: route.laenge,
    namen: route.namen, naechsterPunkt: 1
  };
  schiff.ort = null;
}

// Ein kompletter "Zug" eines Konkurrenten-Schiffs im Hafen
function kiZug(k, schiff) {
  if (istZugefroren(schiff.ort)) return;           // im Eis: abwarten

  kiVerkaufeAlles(k, schiff);

  // Reich genug? Dann ein weiteres Schiff kaufen.
  if (k.gold > 8000 && k.schiffe.length < KI_MAX_SCHIFFE) {
    k.gold -= 4000;
    const neu = erstelleKISchiff(k, "kogge", schiff.ort);
    spiel.meldung = "⚓ " + k.name + " hat in " + schiff.ort + " eine neue Kogge gekauft (die „" + neu.name + "“).";
  }

  const plan = kiPlane(k, schiff);
  if (plan) {
    kiKaufe(k, schiff, plan);
    kiSegeln(schiff, plan.ziel);
  } else {
    // Nichts gefunden: leer zu einer zufälligen anderen Stadt fahren und dort neu schauen
    const moeglich = staedte.filter(s => s.name !== schiff.ort && !istZugefroren(s.name));
    kiSegeln(schiff, zufallsElement(moeglich).name);
  }
}

// Wird in jedem Bild aufgerufen (wenn nicht pausiert)
function kiSchritt() {
  for (const k of spiel.konkurrenten) {
    for (const schiff of k.schiffe) {
      if (schiff.reise && reiseFortschritt(schiff) >= 1) {   // angekommen?
        schiff.ort = schiff.reise.nach;
        schiff.reise = null;
      }
      if (!schiff.reise) kiZug(k, schiff);
    }
  }
}

// Konkurrenten-Schiffe auf der Karte: kleiner, mit farbigem Punkt
const kiGrafik = {};
function zeichneKonkurrenten() {
  for (const k of spiel.konkurrenten) {
    k.schiffe.forEach((schiff, nr) => {
      let g = kiGrafik[schiff.id];
      if (!g) {
        // Dieselbe Schiffsform wie bei dir (aus karte.js) – nur mit Segeln in der Farbe des Konkurrenten
        g = svg("g");
        g.appendChild(schiffsForm(k.farbe));
        const titel = svg("title");
        titel.textContent = k.name + ": " + schiff.typ + " „" + schiff.name + "“";
        g.appendChild(titel);
        g.winkel = 0;                    // letzte Fahrtrichtung (man kann eigene Werte an Elemente hängen)
        // Schritt 23: Liegt das Schiff im Hafen, verdeckt es den Stadtpunkt. Ein Klick darauf
        // soll deshalb die Stadt öffnen – sonst käme man an Danzig oder Hamburg kaum heran.
        g.setAttribute("class", "ki-schiff");
        g.addEventListener("click", () => { if (g.hafen) stadtAngeklickt(findeStadt(g.hafen)); });
        ebeneKI.appendChild(g);
        kiGrafik[schiff.id] = g;
      }

      // Liegt das Schiff im Hafen? Auch während der Liegezeit (Reise geplant, aber noch nicht losgefahren)
      // zählt es als "im Hafen" – sonst stünde es genau auf dem Stadtpunkt und verdeckte ihn.
      g.hafen = schiff.ort || (reiseFortschritt(schiff) === 0 ? schiff.reise.von : null);
      // Auf See lässt das Schiff Klicks einfach durch (pointer-events: none)
      g.style.pointerEvents = g.hafen ? "" : "none";

      let pos;
      if (!g.hafen) {
        pos = schiffPosition(schiff);              // dieselbe Rechnung wie bei deinen Schiffen
        g.winkel = pos.winkel;
      } else {
        const stadt = findeStadt(g.hafen);         // im Hafen: links unterhalb der Stadt
        pos = { x: Math.max(stadt.x - 16 - (k.id - 1) * 14 - nr * 5, 10), y: stadt.y + 13 };
      }
      // scale(0.7): Konkurrenten-Schiffe etwas kleiner als deine
      g.setAttribute("transform", "translate(" + pos.x + " " + pos.y + ") rotate(" + g.winkel + ") scale(0.7)");
    });
  }
}

// Vermögen = Geld + Wert der Schiffe (halber Kaufpreis) + Ladung (+ bei dir: Betriebe und Kontore)
function wertDerSchiffe(schiffe) {
  let summe = 0;
  for (const s of schiffe) {
    summe += typVon(s).preis * 0.5;
    for (const ware of WAREN) summe += s.ladung[ware.id] * s.einkaufspreis[ware.id];
  }
  return summe;
}

function vermoegenSpieler() {
  let summe = spiel.gold + wertDerSchiffe(spiel.schiffe);
  for (const b of spiel.betriebe) summe += betriebsTyp(b).bau * 0.5;
  for (const stadtName in spiel.kontore) {
    const kontor = spiel.kontore[stadtName];
    for (const ware of WAREN) summe += kontor.bestand[ware.id] * kontor.preis[ware.id];
  }
  return summe;
}

function zeigeRangliste() {
  // Eine gemeinsame Liste aus dir und allen Konkurrenten ...
  const liste = [{ name: "Du", info: RAENGE[spiel.rang].name, farbe: FARBE_SPIELER,
                   schiffe: spiel.schiffe.length, vermoegen: vermoegenSpieler(), ich: true }];
  for (const k of spiel.konkurrenten) {
    liste.push({ name: k.name, info: "aus " + k.heimat, farbe: k.farbe,
                 schiffe: k.schiffe.length, vermoegen: k.gold + wertDerSchiffe(k.schiffe), ich: false });
  }

  // ... absteigend nach Vermögen sortiert.
  // sort() bekommt eine Vergleichsfunktion: Ist das Ergebnis positiv, kommt b vor a.
  liste.sort((a, b) => b.vermoegen - a.vermoegen);

  let html = "<h3 style='margin-top:0'>🏆 Rangliste der Kaufleute</h3>";
  html += "<table><tr><th>#</th><th>Kaufmann</th><th>Schiffe</th><th>Vermögen</th></tr>";
  liste.forEach((e, i) => {
    const fett = e.ich ? " style='font-weight:bold;color:#f0c040'" : "";
    html += "<tr" + fett + "><td>" + (i + 1) + ".</td>" +
            "<td><span style='color:" + e.farbe + "'>●</span> " + e.name +
            " <span class='klein' style='opacity:.7'>(" + e.info + ")</span></td>" +
            '<td class="zahl">' + e.schiffe + "</td>" +
            '<td class="zahl">' + geld(Math.round(e.vermoegen)) + " ₰</td></tr>";
  });
  html += "</table>";
  document.getElementById("rangliste").innerHTML = html;
}
