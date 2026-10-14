// ======================================================================
// betriebe.js – Eigene Betriebe, Produktion und Kontor – mit dem Betriebe-Fenster.
// ======================================================================

function betriebsTyp(betrieb) {
  return BETRIEBSTYPEN.find(t => t.id === betrieb.typ);
}

function lohnGesamt() {
  let summe = 0;
  for (const b of spiel.betriebe) summe += betriebsTyp(b).lohn;
  return summe;
}

// Was kostet ein Stück aus eigener Herstellung ungefähr?
// (Lohn + Rohstoffe zum Grundpreis) geteilt durch die Tagesmenge
function herstellkosten(typ) {
  let kosten = typ.lohn;
  if (typ.rohstoff) {
    const roh = WAREN.find(w => w.id === typ.rohstoff);
    kosten += roh.basispreis * typ.rohstoffMenge;
  }
  return kosten / typ.menge;
}

// ---------- Betriebe und Kontor ----------

// Leeres Kontor anlegen (passiert automatisch beim ersten Betrieb in einer Stadt)
function erstelleKontor(stadtName) {
  const kontor = { bestand: {}, preis: {} };
  for (const ware of WAREN) {
    kontor.bestand[ware.id] = 0;
    kontor.preis[ware.id] = 0;      // durchschnittlicher Wert pro Stück (wie beim Schiff)
  }
  spiel.kontore[stadtName] = kontor;
}

function baueBetrieb(typId) {
  const typ = BETRIEBSTYPEN.find(t => t.id === typId);
  const stadt = spiel.ausgewaehlteStadt;

  if (!stadt.produziert.includes(typ.ware)) return;     // Sicherheitsprüfung

  // Rang-Prüfungen
  if (typ.rang > spiel.rang) {
    spiel.meldung = "Eine " + typ.name + " darfst du erst als " + RAENGE[typ.rang].name + " bauen.";
    return;
  }
  if (spiel.betriebe.length >= RAENGE[spiel.rang].maxBetriebe) {
    spiel.meldung = "Als " + RAENGE[spiel.rang].name + " darfst du höchstens " + RAENGE[spiel.rang].maxBetriebe + " Betrieb(e) besitzen.";
    return;
  }

  if (spiel.gold < typ.bau) {
    spiel.meldung = "Nicht genug Geld für eine " + typ.name + ".";
    return;
  }

  spiel.gold -= typ.bau;
  if (!spiel.kontore[stadt.name]) erstelleKontor(stadt.name);
  spiel.betriebe.push({ typ: typ.id, stadt: stadt.name, stillstand: false });
  buche("Bau: " + typ.name + " in " + stadt.name, -typ.bau);
  spiel.meldung = "🏭 Deine " + typ.name + " in " + stadt.name + " nimmt morgen die Arbeit auf.";
  aktualisiereStadtNamen();
  chronik("🏭", typ.name + " in " + stadt.name + " gebaut");
  ansehenPlus(15);
}

// Wird einmal pro Spieltag aufgerufen: Alle Betriebe produzieren
function tagesProduktion() {
  for (const betrieb of spiel.betriebe) {
    const typ = betriebsTyp(betrieb);
    const kontor = spiel.kontore[betrieb.stadt];

    // 1. Rohstoffe besorgen (falls der Betrieb welche braucht)
    if (typ.rohstoff) {
      const roh = WAREN.find(w => w.id === typ.rohstoff);
      const markt = spiel.maerkte[betrieb.stadt];
      let fehlt = typ.rohstoffMenge;

      // Reicht es überhaupt? (Kontor + Markt zusammen)
      if (kontor.bestand[roh.id] + Math.floor(markt[roh.id]) < fehlt) {
        betrieb.stillstand = true;
        continue;                                  // diesen Betrieb überspringen
      }

      // a) zuerst aus dem eigenen Kontor nehmen
      const ausKontor = Math.min(fehlt, kontor.bestand[roh.id]);
      kontor.bestand[roh.id] -= ausKontor;
      fehlt -= ausKontor;

      // b) den Rest Stück für Stück auf dem Markt der Stadt kaufen
      while (fehlt > 0) {
        const preis = kaufpreis(betrieb.stadt, roh);
        if (spiel.gold < preis) break;             // kein Geld mehr
        spiel.gold -= preis;
        spiel.rohstoffKosten += preis;
        markt[roh.id] -= 1;
        fehlt--;
      }
      if (fehlt > 0) {
        betrieb.stillstand = true;
        continue;
      }
    }

    // 2. Produzieren: Ware ins Kontor, mit den Herstellkosten als Wert
    kontor.preis[typ.ware] = mischpreis(kontor.bestand[typ.ware], kontor.preis[typ.ware], typ.menge, herstellkosten(typ));
    kontor.bestand[typ.ware] += typ.menge;
    betrieb.stillstand = false;
  }
}

// Waren zwischen dem gewählten Schiff und dem Kontor der Stadt verschieben
function umladen(wareId, menge, richtung, schiff = aktivesSchiff()) {   // Schiff als Parameter
  const kontor = spiel.kontore[schiff.ort];
  if (!schiff.ort || !kontor) return;
  const ware = WAREN.find(w => w.id === wareId);

  if (richtung === "insSchiff") {
    const frei = schiff.kapazitaet - ladungGesamt(schiff);
    // Math.min mit drei Werten: gewünschte Menge, vorhandene Menge, freier Platz
    const n = Math.min(menge, kontor.bestand[wareId], frei);
    if (n <= 0) { spiel.meldung = frei <= 0 ? "Der Laderaum ist voll." : "Nichts davon im Kontor."; return; }

    schiff.einkaufspreis[wareId] = mischpreis(schiff.ladung[wareId], schiff.einkaufspreis[wareId], n, kontor.preis[wareId]);
    schiff.ladung[wareId] += n;
    kontor.bestand[wareId] -= n;
    if (kontor.bestand[wareId] === 0) kontor.preis[wareId] = 0;
    spiel.meldung = n + "× " + ware.name + " aus dem Kontor an Bord geladen.";
  } else {
    const n = Math.min(menge, schiff.ladung[wareId]);
    if (n <= 0) return;

    kontor.preis[wareId] = mischpreis(kontor.bestand[wareId], kontor.preis[wareId], n, schiff.einkaufspreis[wareId]);
    kontor.bestand[wareId] += n;
    schiff.ladung[wareId] -= n;
    if (schiff.ladung[wareId] === 0) schiff.einkaufspreis[wareId] = 0;
    spiel.meldung = n + "× " + ware.name + " ins Kontor eingelagert.";
  }
}

// Anzeige: Betriebe, Bauen und Kontor der gewählten Stadt
function zeigeBetriebe() {
  const stadt = spiel.ausgewaehlteStadt;
  if (!stadt) return;
  const schiff = aktivesSchiff();
  const schiffHier = (schiff.ort === stadt.name);
  const kontor = spiel.kontore[stadt.name];
  const hier = spiel.betriebe.filter(b => b.stadt === stadt.name);

  let html = "<h3 style='margin-top:0'>🏭 Deine Betriebe in " + stadt.name + "</h3>";

  if (hier.length === 0) {
    html += '<div class="hinweis">Du hast hier noch keine Betriebe.</div>';
  } else {
    html += "<table><tr><th>Betrieb</th><th>Produktion pro Tag</th><th>Lohn</th><th>Status</th></tr>";
    for (const b of hier) {
      const typ = betriebsTyp(b);
      const ware = WAREN.find(w => w.id === typ.ware);
      let produktion = "+" + typ.menge + " " + ware.name;
      if (typ.rohstoff) {
        const roh = WAREN.find(w => w.id === typ.rohstoff);
        produktion += " <span class='minus'>(−" + typ.rohstoffMenge + " " + roh.name + ")</span>";
      }
      const status = b.stillstand
        ? '<span class="minus">⚠ Rohstoffe fehlen</span>'
        : '<span class="plus">läuft</span>';
      html += "<tr><td>" + typ.name + "</td><td>" + produktion + "</td>" +
              '<td class="zahl">' + typ.lohn + " ₰</td><td>" + status + "</td></tr>";
    }
    html += "</table>";
  }

  // Bauen – nur Betriebe für Waren, die diese Stadt ohnehin herstellt
  const moeglich = BETRIEBSTYPEN.filter(t => stadt.produziert.includes(t.ware));
  html += "<h3>Neuen Betrieb bauen</h3>";
  html += "<table><tr><th>Betrieb</th><th>Produktion</th><th>Kosten/Stück</th><th>Lohn</th><th>Bau</th><th></th></tr>";
  for (const typ of moeglich) {
    const ware = WAREN.find(w => w.id === typ.ware);
    let produktion = typ.menge + " " + ware.name;
    if (typ.rohstoff) produktion += " <span class='klein'>(braucht " + typ.rohstoffMenge + " " + WAREN.find(w => w.id === typ.rohstoff).name + ")</span>";
    html += "<tr><td>" + typ.name + "</td><td style='white-space:normal'>" + produktion + "</td>" +
            '<td class="zahl">ca. ' + Math.round(herstellkosten(typ)) + " ₰</td>" +
            '<td class="zahl">' + typ.lohn + " ₰/Tag</td>" +
            '<td class="zahl">' + geld(typ.bau) + " ₰</td>" +
            '<td><button class="klein" data-aktion="bauen" data-typ="' + typ.id + '"' +
              // gesperrt bei zu wenig Geld, zu niedrigem Rang oder erreichtem Limit
              (spiel.gold < typ.bau || typ.rang > spiel.rang || spiel.betriebe.length >= RAENGE[spiel.rang].maxBetriebe ? " disabled" : "") + ">" +
              (typ.rang > spiel.rang ? "ab " + RAENGE[typ.rang].name : "Bauen") + "</button></td></tr>";
  }
  html += "</table>";

  // Kontor
  if (kontor) {
    html += "<h3>🏠 Kontor</h3>";
    // Zeilen nur für Waren, die im Kontor liegen – oder an Bord, wenn das Schiff hier ist
    const zeilen = WAREN.filter(w => kontor.bestand[w.id] > 0 || (schiffHier && schiff.ladung[w.id] > 0));

    if (zeilen.length === 0) {
      html += '<div class="hinweis">Das Kontor ist leer. Deine Betriebe füllen es jeden Tag.</div>';
    } else {
      html += "<table><tr><th>Ware</th><th>Im Kontor</th><th>An Bord</th>";
      if (schiffHier) html += "<th>⬆ ins Schiff</th><th>⬇ ins Kontor</th>";
      html += "</tr>";
      for (const ware of zeilen) {
        html += "<tr><td>" + ware.name + "</td>" +
                '<td class="zahl">' + kontor.bestand[ware.id] + "</td>" +
                '<td class="zahl">' + (schiffHier ? schiff.ladung[ware.id] : "–") + "</td>";
        if (schiffHier) {
          // data-menge="9999" bedeutet "alles" – umladen() nimmt sowieso höchstens, was geht
          html += "<td>" +
                    '<button class="klein" data-aktion="insSchiff" data-ware="' + ware.id + '" data-menge="10">10</button> ' +
                    '<button class="klein" data-aktion="insSchiff" data-ware="' + ware.id + '" data-menge="9999">alle</button>' +
                  "</td><td>" +
                    '<button class="klein" data-aktion="insKontor" data-ware="' + ware.id + '" data-menge="10">10</button> ' +
                    '<button class="klein" data-aktion="insKontor" data-ware="' + ware.id + '" data-menge="9999">alle</button>' +
                  "</td>";
        }
        html += "</tr>";
      }
      html += "</table>";
    }
    if (!schiffHier) html += '<div class="hinweis">Lege mit einem Schiff hier an, um Waren umzuladen.</div>';
  }

  // Übersicht über alle Städte
  if (spiel.betriebe.length > 0) {
    const staedteMitBetrieb = new Set(spiel.betriebe.map(b => b.stadt));
    html += '<div class="hinweis" style="margin:10px 0 0 0">Insgesamt: ' + spiel.betriebe.length +
            " Betrieb(e) in " + staedteMitBetrieb.size + " Stadt/Städten · Löhne " + lohnGesamt() + " ₰/Tag</div>";
  }

  document.getElementById("betriebe").innerHTML = html;
}

// Klicks im Betriebe-Fenster (wieder Event-Delegation)
document.getElementById("betriebe").addEventListener("click", (e) => {
  const knopf = e.target.closest("button");
  if (!knopf) return;
  const goldVorher = spiel.gold;     // Schritt 22: für den Münzklang
  const aktion = knopf.dataset.aktion;
  if (aktion === "bauen")     baueBetrieb(knopf.dataset.typ);
  if (aktion === "insSchiff") umladen(knopf.dataset.ware, Number(knopf.dataset.menge), "insSchiff");
  if (aktion === "insKontor") umladen(knopf.dataset.ware, Number(knopf.dataset.menge), "insKontor");

  zeigeMarkt();            // zeigt auch die Meldung – und ruft zeigeBetriebe() auf
  zeigeFlotte();
  zeigeKasse();
  aktualisiereAnzeige();
  if (spiel.gold !== goldVorher) spieleTon("muenze");
});

// Stadtnamen auf der Karte: 🔨 = Werft, 🏭 = eigener Betrieb
function aktualisiereStadtNamen() {
  for (const stadt of staedte) {
    const hatBetrieb = spiel.betriebe.some(b => b.stadt === stadt.name);   // some = "gibt es mindestens einen?"
    stadt.beschriftung = stadt.name + (stadt.werft ? " 🔨" : "") + (hatBetrieb ? " 🏭" : "");
  }
  platziereStadtNamen();   // freie Plätze für die Namen suchen (karte.js)
}
