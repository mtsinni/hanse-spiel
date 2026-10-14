// ======================================================================
// start.js – Die Spielschleife und der Start des Spiels. Diese Datei wird als letzte geladen.
// ======================================================================

// ---------- Die Spielschleife ----------
let letzterZeitstempel = null;

function spielSchleife(zeitstempel) {
  if (letzterZeitstempel === null) letzterZeitstempel = zeitstempel;
  const delta = (zeitstempel - letzterZeitstempel) / 1000;
  letzterZeitstempel = zeitstempel;

  if (!spiel.pausiert) {
    spiel.tag += (delta / SEKUNDEN_PRO_TAG) * spiel.tempo;
  }

  let neuerTag = false;
  while (spiel.letzterBerechneterTag < Math.floor(spiel.tag)) {
    tagesUpdate();
    tagesStaedte();       // Städte wachsen oder schrumpfen
    tagesProduktion();    // Betriebe arbeiten
    spiel.letzterBerechneterTag++;
    tagesEreignisse();    // Ereignisse beginnen, wirken und enden
    tagesAuftraege();     // Aufträge: neue Angebote, verpasste Fristen
    // Ist der Tag durch 7 teilbar (Rest 0)? Dann ist Zahltag.
    if (spiel.letzterBerechneterTag % ZAHLTAG_ALLE === 0) zahltag();
    if (spiel.letzterBerechneterTag % STATISTIK_ALLE === 0) statistikAufzeichnen();   // Schnappschuss für die Statistik
    neuerTag = true;
  }
  if (neuerTag) {
    // Schiffe mit Route, die im Hafen warten (z.B. wegen Eis), versuchen es erneut
    for (const schiff of spiel.schiffe) {
      if (schiff.route && schiff.route.aktiv && schiff.ort && !schiff.reise) routeAusfuehren(schiff);
    }
    zeigeMarkt();
    zeigeFlotte();        // Resttage in der Flottenliste aktualisieren
    zeigeKasse();
    zeigeRangliste();
    if (Math.random() < 0.2) spieleTon("moewe");   // Schritt 22: ab und zu eine Möwe
    zeigeAuftraege();     // verbleibende Tage aktualisieren
    aktualisiereStadtGroesse();   // Stadtkreise auf der Karte
    speichern();
  }

  if (!spiel.pausiert) kiSchritt();   // Konkurrenten handeln und segeln
  zeichneKonkurrenten();
  pruefePiraten();        // vor der Ankunft, damit auch der letzte Abschnitt zählt
  pruefeAnkunft();
  zeichneSchiffe();       // Mehrzahl – alle Schiffe
  aktualisiereAnzeige();
  requestAnimationFrame(spielSchleife);
}

// ---------- Start ----------
const geladen = laden();

zeichneKarte();
aktualisiereStadtNamen();   // 🏭 bei geladenen Betrieben
zeichneEreignisse();        // Symbole für laufende Ereignisse
setzeTempo(spiel.tempo);

// Das ausgewählte Schiff bestimmt, welche Stadt wir zuerst zeigen
const startSchiff = aktivesSchiff();
const startStadt = startSchiff.ort || startSchiff.reise.nach;
stadtAngeklickt(findeStadt(startStadt));
zeigeFlotte();
zeigeKasse();
zeigeRangliste();
zeigeRoute();
zeigeAuftraege();
aktualisiereStadtGroesse();

if (geladen) {
  setzePause(true);
  spiel.meldung = "📜 Spielstand geladen. Leertaste oder ▶ zum Weiterspielen.";
  zeigeMarkt();
}

requestAnimationFrame(spielSchleife);
