// ======================================================================
// ansehen.js – Ansehen, Ränge und Aufstieg.
// ======================================================================

// ---------- Ansehen und Ränge ----------

// Welcher Rang passt zu dieser Menge Ansehen?
// Wir gehen die Ränge von oben nach unten durch und nehmen den ersten, dessen Schwelle erreicht ist.
function rangFuerAnsehen(ansehen) {
  for (let i = RAENGE.length - 1; i >= 0; i--) {   // i-- = rückwärts zählen
    if (ansehen >= RAENGE[i].ab) return i;
  }
  return 0;
}

// Ansehen ändern (positiv = Lob, negativ = Tadel) und prüfen, ob ein Aufstieg fällig ist
function ansehenPlus(punkte) {
  spiel.ansehen = Math.max(0, spiel.ansehen + punkte);

  // Der Rang kann nur steigen, nie fallen – einmal Ratsherr, immer Ratsherr.
  // Deshalb vergleichen wir mit dem bisherigen Rang und nehmen nur den höheren.
  const neuerRang = rangFuerAnsehen(spiel.ansehen);
  if (neuerRang > spiel.rang) {
    spiel.rang = neuerRang;
    aufstieg(neuerRang);
  }
}

// Aufstiegs-Nachricht mit allem, was neu freigeschaltet wurde
function aufstieg(nr) {
  const r = RAENGE[nr];
  const neu = [];
  for (const t of SCHIFFSTYPEN)  if (t.rang === nr) neu.push("Schiffstyp <b>" + t.name + "</b>");
  for (const t of BETRIEBSTYPEN) if (t.rang === nr) neu.push("Betrieb <b>" + t.name + "</b>");
  neu.push("bis zu <b>" + r.maxSchiffe + "</b> Schiffe und <b>" + r.maxBetriebe + "</b> Betriebe");

  let text = "Die Kaufleute der Hanse sprechen mit Respekt von dir. Du bist jetzt <b>" + r.name + "</b>!" +
             "<br><br>Neu freigeschaltet:<br>• " + neu.join("<br>• ");
  if (nr === RAENGE.length - 1) {
    text += "<br><br>🏆 <b>Du hast den höchsten Rang erreicht – das Spiel ist gewonnen!</b> Du kannst natürlich weiterhandeln.";
  }
  zeigeEreignis("🎖 Aufstieg zum " + r.name, text);
  spieleTon("glocke");                 // Schritt 22
  spieleTon("fanfare");
  buche("🎖 Aufstieg zum " + r.name, 0);
  chronik("🎖", "Aufstieg zum <b>" + r.name + "</b>");
  zeigeMarkt();   // Werft- und Bau-Knöpfe sofort mit dem neuen Rang neu zeichnen
}

// Übersicht über alle Ränge (öffnet sich beim Klick auf die Rang-Anzeige)
function zeigeRaenge() {
  let text = "<table><tr><th>Rang</th><th>Ansehen</th><th>Schiffe</th><th>Betriebe</th></tr>";
  RAENGE.forEach((r, i) => {          // forEach liefert auch die Nummer (i) mit
    const aktuell = (i === spiel.rang) ? " style='color:#f0c040;font-weight:bold'" : "";
    text += "<tr" + aktuell + "><td>" + r.name + "</td>" +
            '<td class="zahl">' + geld(r.ab) + '</td><td class="zahl">' + r.maxSchiffe +
            '</td><td class="zahl">' + r.maxBetriebe + "</td></tr>";
  });
  text += "</table><br><b>So gewinnst du Ansehen:</b><br>" +
          "• Verkauf mit Gewinn: 1 Punkt pro 100 ₰ Gewinn<br>" +
          "• Waren dorthin bringen, wo sie gebraucht werden: 1 Punkt pro 10 Stück<br>" +
          "• Betrieb bauen: 15 Punkte · Schiff kaufen: 5 Punkte · Piraten abwehren: 3 Punkte<br>" +
          "• Aber: Bist du am Zahltag im Minus, verlierst du 10 Punkte.<br><br>" +
          "Dein Ansehen: <b>" + Math.floor(spiel.ansehen) + "</b>";
  zeigeEreignis("🎖 Die Ränge der Hanse", text);
}
document.getElementById("rang").addEventListener("click", zeigeRaenge);
