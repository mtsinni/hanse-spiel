// ======================================================================
// handel.js – Kaufen, Verkaufen und neue Schiffe.
// ======================================================================

// ---------- Handel ----------
// Die Funktion bekommt jetzt das Schiff mitgegeben ("Parameter"),
// statt immer dasselbe eine Schiff zu benutzen.
function ladungGesamt(schiff) {
  let summe = 0;
  for (const ware of WAREN) summe += schiff.ladung[ware.id];
  return summe;
}

// "Standardwerte" für Parameter.
// kaufen("salz", 10)  -> das ausgewählte Schiff kauft, ohne Preisgrenze.
// kaufen("salz", 10, meinSchiff, 30) -> ein bestimmtes Schiff kauft, aber nur bis 30 ₰ pro Stück.
function kaufen(wareId, menge, schiff = aktivesSchiff(), maxPreis = Infinity) {
  if (!schiff.ort) return;
  const ware   = WAREN.find(w => w.id === wareId);
  const markt  = spiel.maerkte[schiff.ort];
  let stueck = 0, kosten = 0, grund = "";

  for (let i = 0; i < menge; i++) {
    const preis = kaufpreis(schiff.ort, ware);
    if (markt[wareId] < 1)                         { grund = "Die Stadt hat nichts mehr davon."; break; }
    if (ladungGesamt(schiff) >= schiff.kapazitaet) { grund = "Der Laderaum ist voll.";          break; }
    if (spiel.gold < preis)                        { grund = "Nicht genug Geld.";                break; }
    if (preis > maxPreis)                          { grund = "Preisgrenze erreicht.";            break; }

    // Die Durchschnittsformel steckt jetzt in der Funktion mischpreis
    schiff.einkaufspreis[wareId] = mischpreis(schiff.ladung[wareId], schiff.einkaufspreis[wareId], 1, preis);

    schiff.ladung[wareId] += 1;
    markt[wareId] -= 1;
    spiel.gold -= preis;
    stueck++;
    kosten += preis;
  }

  if (stueck > 0) buche("Kauf " + stueck + "× " + ware.name + " in " + schiff.ort, -kosten);

  spiel.meldung = "";
  if (stueck > 0) spiel.meldung = stueck + "× " + ware.name + " für " + kosten + " ₰ gekauft. ";
  spiel.meldung += grund;
}

function verkaufen(wareId, menge, schiff = aktivesSchiff()) {   // Schiff als Parameter
  if (!schiff.ort) return;
  const ware   = WAREN.find(w => w.id === wareId);
  const markt  = spiel.maerkte[schiff.ort];
  let stueck = 0, erloes = 0, grund = "";

  const einstand = schiff.einkaufspreis[wareId];   // was die Ware im Schnitt gekostet hat

  for (let i = 0; i < menge; i++) {
    if (schiff.ladung[wareId] < 1) { grund = "Nichts mehr davon an Bord."; break; }
    const preis = verkaufspreis(schiff.ort, ware);
    schiff.ladung[wareId] -= 1;
    markt[wareId] += 1;
    spiel.gold += preis;
    stueck++;
    erloes += preis;
  }
  if (schiff.ladung[wareId] === 0) schiff.einkaufspreis[wareId] = 0;

  if (stueck > 0) buche("Verkauf " + stueck + "× " + ware.name + " in " + schiff.ort, erloes);

  // Ansehen für Gewinn und für die Versorgung der Stadt
  const gewinn = erloes - einstand * stueck;
  let punkte = Math.max(gewinn, 0) / 100;                          // 1 Punkt pro 100 ₰ Gewinn
  if (findeStadt(schiff.ort).verbraucht.includes(wareId)) {
    punkte += stueck / 10;                                         // 1 Punkt pro 10 gelieferte Stück
  }
  if (punkte > 0) ansehenPlus(punkte);

  spiel.meldung = "";
  if (stueck > 0) spiel.meldung = stueck + "× " + ware.name + " für " + erloes + " ₰ verkauft. ";
  spiel.meldung += grund;
}

// "Bauplan" für ein neues Schiff. Wird für das Startschiff UND für Käufe benutzt.
function erstelleSchiff(typId, name, ort) {
  const typ = SCHIFFSTYPEN.find(t => t.id === typId);
  const schiff = {
    id: spiel.naechsteSchiffId,
    name: name,
    typ: typ.name,
    kapazitaet: typ.kapazitaet,
    tempo: typ.tempo,
    ort: ort,
    reise: null,
    ladung: {},
    einkaufspreis: {},
    zustand: 100              // Schritt 21: 100 % = unbeschädigt
  };
  for (const ware of WAREN) {
    schiff.ladung[ware.id] = 0;
    schiff.einkaufspreis[ware.id] = 0;
  }
  spiel.naechsteSchiffId++;           // die nächste Nummer ist eins höher
  spiel.schiffe.push(schiff);         // push = hinten an die Liste anhängen
  platziereStadtNamen();     // ein neues Schiff im Hafen braucht Platz
  return schiff;
}

// ---------- Werft: Schiffe kaufen ----------
function kaufeSchiff(typId) {
  const typ = SCHIFFSTYPEN.find(t => t.id === typId);
  const stadt = spiel.ausgewaehlteStadt;

  // Darf man das in seinem Rang überhaupt?
  if (typ.rang > spiel.rang) {
    spiel.meldung = "Eine " + typ.name + " darfst du erst als " + RAENGE[typ.rang].name + " kaufen.";
    return;
  }
  if (spiel.schiffe.length >= RAENGE[spiel.rang].maxSchiffe) {
    spiel.meldung = "Als " + RAENGE[spiel.rang].name + " darfst du höchstens " + RAENGE[spiel.rang].maxSchiffe + " Schiffe besitzen.";
    return;
  }

  if (spiel.gold < typ.preis) {
    spiel.meldung = "Nicht genug Geld für eine " + typ.name + ".";
    return;
  }

  // prompt() fragt nach einem Text. Abbrechen liefert null.
  const vorschlag = typ.name + " " + spiel.naechsteSchiffId;
  const name = prompt("Wie soll dein neues Schiff heißen?", vorschlag);
  if (name === null) return;                      // abgebrochen -> nichts kaufen

  spiel.gold -= typ.preis;
  const schiff = erstelleSchiff(typ.id, name.trim() || vorschlag, stadt.name);
  buche("Schiffskauf: " + typ.name + " „" + schiff.name + "“", -typ.preis);
  spiel.ausgewaehltesSchiffId = schiff.id;        // das neue Schiff gleich auswählen
  spiel.meldung = "🔨 Die " + schiff.name + " liegt in " + stadt.name + " bereit!";
  chronik("⚓", "Neues Schiff: " + typ.name + " „" + schiff.name + "“ in " + stadt.name);
  ansehenPlus(5);
}
