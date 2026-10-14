// ======================================================================
// hilfen.js – Kleine Hilfsfunktionen, die überall gebraucht werden: Nachschlagen, Geld- und Datumsformat, Zufall, Entfernung.
// ======================================================================

function findeStadt(name) {
  return staedte.find(s => s.name === name);
}

// das gerade ausgewählte Schiff holen
function aktivesSchiff() {
  return spiel.schiffe.find(s => s.id === spiel.ausgewaehltesSchiffId);
}

// ---------- Geld, Kosten und Kassenbuch ----------

// Zahl hübsch mit Tausenderpunkt: 12500 -> "12.500"
function geld(betrag) {
  return betrag.toLocaleString("de-DE");
}

// ---------- Hilfsfunktionen für Betriebe ----------

// Gewichteter Durchschnittspreis, wenn zu einer Menge eine neue Menge dazukommt.
// Beispiel: 10 Stück zu je 20 ₰ + 10 Stück zu je 30 ₰  ->  20 Stück zu je 25 ₰
function mischpreis(alteMenge, alterPreis, neueMenge, neuerPreis) {
  const gesamt = alteMenge + neueMenge;
  if (gesamt === 0) return 0;
  return (alteMenge * alterPreis + neueMenge * neuerPreis) / gesamt;
}

// ---------- Segeln ----------
// Abstand zweier Punkte (alles, was x und y hat: Städte, Wegpunkte …)
function entfernung(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// ---------- Ereignisse ----------

// Zufällige ganze Zahl von min bis max (beide eingeschlossen)
function zufallsZahl(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Zufälliges Element aus einer Liste
function zufallsElement(liste) {
  return liste[Math.floor(Math.random() * liste.length)];
}

// Spieltag -> echtes Datum (für Monat und Tag im Monat)
function datumVon(tag) {
  return new Date(START_JAHR, START_MONAT, START_TAG + tag);
}

// ---------- Anzeige oben ----------
// kurzes Datum für das Kassenbuch, z.B. "3. Apr"
function datumKurz(tag) {
  const d = new Date(START_JAHR, START_MONAT, START_TAG + tag);
  return d.getDate() + ". " + MONATE[d.getMonth()].slice(0, 3);   // slice(0,3) = erste 3 Buchstaben
}

function datumAlsText() {
  const ganzeTage = Math.floor(spiel.tag);
  const d = new Date(START_JAHR, START_MONAT, START_TAG + ganzeTage);
  return d.getDate() + ". " + MONATE[d.getMonth()] + " " + d.getFullYear();
}
