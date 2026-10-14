// ======================================================================
// zustand.js – Der Spielzustand: alles, was sich im Spiel verändert (und gespeichert wird).
// ======================================================================

// ---------- Der Spielzustand ----------
const spiel = {
  tag: 0,
  pausiert: false,
  tempo: 1,
  letzterBerechneterTag: 0,
  ausgewaehlteStadt: null,
  maerkte: {},
  gold: 2000,
  meldung: "",
  schiffe: [],                // statt "schiff" jetzt eine LISTE von Schiffen
  buch: [],                   // Kassenbuch, neueste Buchung zuerst
  betriebe: [],               // z.B. [{ typ: "saline", stadt: "Lübeck", stillstand: false }]
  kontore: {},                // z.B. kontore["Lübeck"] = { bestand: {...}, preis: {...} }
  rohstoffKosten: 0,          // zugekaufte Rohstoffe seit dem letzten Zahltag
  ansehen: 0,                 // Ansehenspunkte (können auch sinken)
  rang: 0,                    // erreichter Rang als Nummer in RAENGE (sinkt nie)
  aktiveEreignisse: [],       // z.B. [{ typ: "missernte", stadt: "Danzig", ware: "getreide", aenderung: -10, bisTag: 57 }]
  handelsMenge: 10,           // gewählte Menge für Kaufen/Verkaufen (9999 = Max)
  ausgewaehltesSchiffId: 1,   // mit welchem Schiff handelst/segelst du gerade?
  naechsteSchiffId: 1,        // jedes Schiff bekommt eine eindeutige Nummer
  // Einwohner jeder Stadt (Schritt 19).
  // Object.assign({}, …) macht eine KOPIE – sonst würden wir die Startwerte selbst verändern.
  einwohner: Object.assign({}, START_EINWOHNER),
  statistik: [],              // wöchentliche Schnappschüsse (Schritt 20)
  chronik: [],                // wichtige Momente, neueste zuerst
  auftraege: [],              // Angebote im Aushang (Schritt 18)
  angenommen: [],             // deine laufenden Aufträge
  naechsteAuftragId: 1
};

for (const stadt of staedte) {
  spiel.maerkte[stadt.name] = {};
  for (const ware of WAREN) {
    spiel.maerkte[stadt.name][ware.id] = normalBestand(stadt.name);   // hängt von der Stadtgröße ab
  }
}

// Dein Startschiff
erstelleSchiff("schnigge", "Seeadler", "Lübeck");

// Die Konkurrenten mit je einem Startschiff
spiel.konkurrenten = erstelleKonkurrenten();

// Zum Start hängen schon ein paar Aufträge aus (Schritt 18).
// Manche Versuche ergeben Doppelte und werden verworfen – darum mehrmals probieren.
for (let i = 0; i < 6 && spiel.auftraege.length < 3; i++) neuerAuftrag();

// Chronik und Statistik beginnen mit dem ersten Tag (Schritt 20)
chronik("⛵", "Du beginnst als Krämer in Lübeck – mit 2.000 ₰ und der Seeadler");
statistikAufzeichnen();
