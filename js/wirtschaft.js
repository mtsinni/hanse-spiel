// ======================================================================
// wirtschaft.js – Preise, tägliche Marktentwicklung, Unterhalt, Kassenbuch und Zahltag.
// ======================================================================

// ---------- Wirtschaft ----------
function berechnePreis(stadtName, ware) {
  const bestand = spiel.maerkte[stadtName][ware.id];
  // Schritt 19: Der Normalbestand hängt von der Stadtgröße ab (siehe staedte.js).
  // In Lübeck (20.000 Einwohner) sind 400 Stück "normal", in Visby (5.000) nur 100.
  let faktor = normalBestand(stadtName) / Math.max(bestand, 1);
  faktor = Math.min(Math.max(faktor, PREIS_MIN), PREIS_MAX);
  return ware.basispreis * faktor;
}
function kaufpreis(stadtName, ware)     { return Math.round(berechnePreis(stadtName, ware) * AUFSCHLAG_KAUF); }
function verkaufspreis(stadtName, ware) { return Math.round(berechnePreis(stadtName, ware) * ABSCHLAG_VERKAUF); }

function schwankend(menge) {
  return menge * (0.5 + Math.random());
}

function tagesUpdate() {
  for (const stadt of staedte) {
    const markt = spiel.maerkte[stadt.name];
    const f = stadtFaktor(stadt.name);          // Schritt 19: große Städte produzieren und verbrauchen mehr
    for (const ware of WAREN) {
      let bestand = markt[ware.id];
      if (stadt.produziert.includes(ware.id)) bestand += schwankend(PRODUKTION) * f;
      if (stadt.verbraucht.includes(ware.id)) bestand -= schwankend(VERBRAUCH) * f;
      bestand += (normalBestand(stadt.name) - bestand) * AUSGLEICH;
      markt[ware.id] = Math.max(bestand, 0);
    }
  }
}

// Unterhalt eines Schiffs nachschlagen.
// Wir speichern ihn NICHT im Schiff, sondern holen ihn aus dem Schiffstyp.
// Vorteil: Alte Spielstände funktionieren ohne Umbau, und wenn du die Werte in
// SCHIFFSTYPEN änderst, gelten sie sofort für alle Schiffe.
// den Schiffstyp eines Schiffs nachschlagen
function typVon(schiff) {
  return SCHIFFSTYPEN.find(t => t.name === schiff.typ);
}

// Ältere Schiffe haben noch kein Feld "kanonen" -> dann 0
function kanonen(schiff) {
  return schiff.kanonen || 0;
}

function unterhalt(schiff) {
  // Jede Kanone kostet zusätzlich Unterhalt
  return typVon(schiff).unterhalt + kanonen(schiff) * KANONE_UNTERHALT;
}

function unterhaltGesamt() {
  let summe = 0;
  for (const schiff of spiel.schiffe) summe += unterhalt(schiff);
  return summe;
}

// Eine Buchung ins Kassenbuch schreiben. Betrag positiv = Einnahme, negativ = Ausgabe.
function buche(text, betrag) {
  // Als Datum nehmen wir den zuletzt ABGERECHNETEN Tag. Normalerweise ist das "heute".
  // Holt die Spielschleife aber mehrere Tage auf einmal nach, bekommt so jeder Zahltag
  // sein richtiges Datum.
  spiel.buch.unshift({ tag: spiel.letzterBerechneterTag, text: text, betrag: betrag });
  // Nur die letzten 200 Buchungen behalten, damit der Spielstand nicht endlos wächst.
  // pop() entfernt den letzten (= ältesten) Eintrag.
  if (spiel.buch.length > 200) spiel.buch.pop();
}

// Wird an jedem Zahltag aufgerufen: Unterhalt (und ab Schritt 11 Löhne) für die ganze Woche abziehen
function zahltag() {
  // Auch die Konkurrenten zahlen Heuer und Unterhalt
  for (const k of spiel.konkurrenten) {
    for (const s of k.schiffe) k.gold -= typVon(s).unterhalt * ZAHLTAG_ALLE;
  }

  const kosten = unterhaltGesamt() * ZAHLTAG_ALLE;
  const loehne = lohnGesamt() * ZAHLTAG_ALLE;
  spiel.gold -= kosten + loehne;
  buche("Heuer & Unterhalt (" + spiel.schiffe.length + " Schiff(e))", -kosten);

  // Löhne und zugekaufte Rohstoffe der Betriebe
  if (loehne > 0) buche("Löhne für " + spiel.betriebe.length + " Betrieb(e)", -loehne);
  if (spiel.rohstoffKosten > 0) {
    // Das Geld wurde schon täglich abgezogen – hier wird es nur gesammelt ins Kassenbuch geschrieben,
    // damit dort nicht jeden Tag eine eigene Zeile erscheint.
    buche("Rohstoffe für Betriebe (zugekauft)", -spiel.rohstoffKosten);
    spiel.rohstoffKosten = 0;
  }

  const summe = kosten + loehne;
  if (spiel.gold < 0) {
    spiel.meldung = "⚠️ Zahltag: " + geld(summe) + " ₰ bezahlt – deine Kasse ist im Minus! Dein Ansehen leidet.";
    ansehenPlus(-10);   // Schulden schaden dem Ruf
  } else {
    spiel.meldung = "💸 Zahltag: " + geld(summe) + " ₰ für Heuer, Unterhalt und Löhne bezahlt.";
  }
}
