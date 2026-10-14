// ======================================================================
// piraten.js – Piratengebiete, Angriffsrisiko, Kanonen, Schiffszustand und Reparatur.
// Das eigentliche Gefecht steht in gefecht.js.
// ======================================================================

// Wie wahrscheinlich ist es, auf dieser Route mindestens einmal Piraten zu begegnen?
//
// Trick: Man rechnet über das GEGENTEIL. Die Chance, an EINEM Punkt unbehelligt
// durchzukommen, ist (1 - Risiko). Die Chance, an ALLEN Punkten durchzukommen,
// ist das Produkt dieser Werte. Und "mindestens eine Begegnung" = 1 - "alles ruhig".
// Beispiel: zwei Punkte mit je 15 %:  1 - (0,85 × 0,85) = 1 - 0,72 = 28 %
function angriffsRisiko(route) {
  let ruhig = 1;
  for (const name of route.namen) {
    const risiko = PIRATEN[name] || 0;                  // kein Piratengebiet -> 0
    ruhig *= 1 - risiko;                                // *= heißt: ruhig = ruhig * …
  }
  return 1 - ruhig;
}

// Strecke vom Start bis zur Station Nummer "index" einer Reise
function streckeBis(reise, index) {
  let summe = 0;
  for (let i = 0; i < index; i++) summe += entfernung(reise.punkte[i], reise.punkte[i + 1]);
  return summe;
}

// Wird in jedem Bild aufgerufen: Hat ein Schiff gerade eine Station passiert?
function pruefePiraten() {
  for (const schiff of spiel.schiffe) {
    const r = schiff.reise;
    if (!r || !r.namen) continue;     // nicht unterwegs (oder Reise aus einem alten Spielstand)

    const gefahren = reiseFortschritt(schiff) * r.laenge;

    // Alle Stationen abarbeiten, an denen das Schiff inzwischen vorbei ist.
    // (Die letzte Station ist der Zielhafen – dort gibt es keine Piraten.)
    while (r.naechsterPunkt < r.namen.length - 1 && streckeBis(r, r.naechsterPunkt) <= gefahren) {
      const station = r.namen[r.naechsterPunkt];
      // Math.random() liefert eine Zufallszahl zwischen 0 und 1.
      // Ist sie kleiner als das Risiko (z.B. 0.15), tauchen Piraten auf.
      // Läuft gerade schon ein Gefecht, bemerken die nächsten Piraten das Schiff nicht.
      if (PIRATEN[station] && !gefecht && Math.random() < PIRATEN[station]) {
        starteGefecht(schiff, station);                 // steht in gefecht.js
      }
      r.naechsterPunkt++;
    }
  }
}

// ---------- Kanonen ----------

// Wie viel Schaden richtet eine Salve im Schnitt an? (für die Anzeige in der Werft)
// Erwartungswert = Anzahl × Trefferchance × mittlerer Schaden + Musketen
function mittlererSchaden(anzahlKanonen) {
  const kanone = TREFFER_CHANCE * (TREFFER_SCHADEN[0] + TREFFER_SCHADEN[1]) / 2;
  const musketen = (MUSKETEN_SCHADEN[0] + MUSKETEN_SCHADEN[1]) / 2;
  return Math.round(anzahlKanonen * kanone + musketen);
}

// Kanone für das gewählte Schiff kaufen
function kaufeKanone() {
  const schiff = aktivesSchiff();
  if (!schiff.ort || !findeStadt(schiff.ort).werft) return;   // nur in einer Werft

  if (kanonen(schiff) >= typVon(schiff).maxKanonen) {
    spiel.meldung = "Auf die " + schiff.name + " passen keine weiteren Kanonen.";
    return;
  }
  if (spiel.gold < KANONE_PREIS) {
    spiel.meldung = "Nicht genug Geld für eine Kanone.";
    return;
  }

  spiel.gold -= KANONE_PREIS;
  schiff.kanonen = kanonen(schiff) + 1;
  buche("Kanone für „" + schiff.name + "“", -KANONE_PREIS);
  spiel.meldung = "⚔ Die " + schiff.name + " hat jetzt " + schiff.kanonen + " Kanone(n).";
}

// ---------- Schiffszustand und Reparatur (Schritt 21) ----------

// Zustand in Prozent (100 = unbeschädigt). Ältere Schiffe haben das Feld noch nicht -> 100.
function zustand(schiff) {
  return schiff.zustand === undefined ? 100 : schiff.zustand;
}

function reparaturKosten(schiff) {
  return rundeAuf10((100 - zustand(schiff)) / 100 * typVon(schiff).preis * REPARATUR_FAKTOR);
}

function repariere() {
  const schiff = aktivesSchiff();
  if (!schiff.ort || !findeStadt(schiff.ort).werft || zustand(schiff) >= 100) return;
  const kosten = reparaturKosten(schiff);
  if (spiel.gold < kosten) {
    spiel.meldung = "Nicht genug Geld für die Reparatur.";
    return;
  }
  spiel.gold -= kosten;
  schiff.zustand = 100;
  buche("Reparatur der „" + schiff.name + "“", -kosten);
  spiel.meldung = "🔧 Die " + schiff.name + " ist wieder wie neu.";
}
