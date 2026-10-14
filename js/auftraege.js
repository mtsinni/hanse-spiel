// ======================================================================
// auftraege.js – Lieferaufträge: Annehmen, Abliefern, Fristen – mit dem Aufträge-Fenster.
// ======================================================================
//
// Ein Auftrag sieht so aus:
// {
//   id: 7,
//   ziel: "Danzig",          // wohin geliefert werden muss
//   ware: "getreide",
//   menge: 80,               // so viel insgesamt
//   geliefert: 30,           // so viel schon abgeliefert (Teillieferungen sind erlaubt)
//   gold: 4200,              // Belohnung
//   ansehen: 13,             // Belohnung
//   dauer: 45,               // so viele Tage hat man nach der Annahme Zeit
//   angebotBis: 57,          // bis zu diesem Tag hängt das Angebot aus
//   bisTag: 92               // erst nach der Annahme gesetzt: die Frist
// }
// spiel.auftraege  = Angebote im Aushang
// spiel.angenommen = deine laufenden Aufträge

// Auf Zehner runden, aber nie unter 10
function rundeAuf10(x) {
  return Math.max(10, Math.round(x / 10) * 10);
}

function auftragWare(a) {
  return WAREN.find(w => w.id === a.ware);
}

// "Die Bäckerzunft von Danzig sucht 80 Getreide"
function auftragText(a) {
  return AUFTRAGGEBER[a.ware] + " von <b>" + a.ziel + "</b> sucht <b>" + a.menge + " " + auftragWare(a).name + "</b>";
}

// Ein neues Angebot erzeugen
function neuerAuftrag() {
  // Eine Stadt bestellt etwas, das sie verbraucht – das passt zur Wirtschaft
  const ziel = zufallsElement(staedte);
  // WICHTIG: erst EINMAL auslosen, dann suchen. Stünde zufallsElement() innerhalb von find(),
  // würde es für jede Ware neu würfeln – und mit Pech passt dann keine einzige.
  const wareId = zufallsElement(ziel.verbraucht);
  const ware = WAREN.find(w => w.id === wareId);

  // Nicht zweimal dieselbe Ware für dieselbe Stadt.
  // concat() hängt zwei Listen zu einer zusammen, damit wir beide auf einmal prüfen können.
  const alle = spiel.auftraege.concat(spiel.angenommen);
  if (alle.some(a => a.ziel === ziel.name && a.ware === ware.id)) return;

  // Die Menge richtet sich nach dem Wert: von billigen Waren mehr, von teuren weniger.
  // Ein Auftrag ist immer etwa 1.500 bis 3.500 ₰ wert (zum Grundpreis).
  const menge = rundeAuf10(zufallsZahl(1500, 3500) / ware.basispreis);
  // Belohnung: 140 % bis 180 % des Grundwerts – also ein ordentlicher Gewinn
  const gold = rundeAuf10(menge * ware.basispreis * (1.4 + Math.random() * 0.4));
  const ansehen = Math.round(5 + menge * ware.basispreis / 400);

  spiel.auftraege.push({
    id: spiel.naechsteAuftragId++,      // ++ hinter der Variablen: erst benutzen, dann um 1 erhöhen
    ziel: ziel.name,
    ware: ware.id,
    menge: menge,
    geliefert: 0,
    gold: gold,
    ansehen: ansehen,
    dauer: zufallsZahl(35, 60),
    angebotBis: spiel.letzterBerechneterTag + AUFTRAG_AUSHANG_TAGE
  });
}

function auftragAnnehmen(id) {
  if (spiel.angenommen.length >= AUFTRAG_MAX_ANGENOMMEN) {
    spiel.meldung = "Du hast schon " + AUFTRAG_MAX_ANGENOMMEN + " Aufträge – erfülle erst einen davon.";
    return;
  }
  const index = spiel.auftraege.findIndex(a => a.id === id);
  if (index < 0) return;

  // splice entfernt den Auftrag aus dem Aushang UND gibt ihn zurück (als Liste mit einem Eintrag)
  const a = spiel.auftraege.splice(index, 1)[0];
  a.bisTag = spiel.letzterBerechneterTag + a.dauer;   // ab jetzt läuft die Frist
  spiel.angenommen.push(a);
  spiel.meldung = "📜 Auftrag angenommen: " + a.menge + " " + auftragWare(a).name + " nach " + a.ziel +
                  " bis zum " + datumKurz(a.bisTag) + ".";
}

// Wie viel von der Ware haben deine Schiffe in der Zielstadt gerade an Bord?
function lieferbar(a) {
  let summe = 0;
  for (const s of spiel.schiffe) {
    if (s.ort === a.ziel) summe += s.ladung[a.ware];
  }
  return summe;
}

function abliefern(id) {
  const a = spiel.angenommen.find(x => x.id === id);
  if (!a) return;

  // Von allen deinen Schiffen in der Zielstadt nehmen, bis der Auftrag erfüllt ist
  let jetzt = 0;
  for (const s of spiel.schiffe) {
    if (s.ort !== a.ziel) continue;
    const n = Math.min(s.ladung[a.ware], a.menge - a.geliefert);
    if (n <= 0) continue;
    s.ladung[a.ware] -= n;
    if (s.ladung[a.ware] === 0) s.einkaufspreis[a.ware] = 0;
    a.geliefert += n;
    jetzt += n;
  }

  if (jetzt === 0) {
    spiel.meldung = "Keines deiner Schiffe in " + a.ziel + " hat " + auftragWare(a).name + " an Bord.";
    return;
  }

  if (a.geliefert >= a.menge) {
    auftragErfuellt(a);
  } else {
    spiel.meldung = "📜 " + jetzt + " " + auftragWare(a).name + " abgeliefert – noch " + (a.menge - a.geliefert) + " fehlen.";
  }
}

function auftragErfuellt(a) {
  spiel.angenommen = spiel.angenommen.filter(x => x.id !== a.id);
  spiel.gold += a.gold;
  buche("📜 Auftrag erfüllt: " + a.menge + " " + auftragWare(a).name + " nach " + a.ziel, a.gold);
  chronik("📜", "Auftrag erfüllt: " + a.menge + " " + auftragWare(a).name + " nach " + a.ziel + " (+" + geld(a.gold) + " ₰)");
  spiel.meldung = "📜 Auftrag erfüllt! +" + geld(a.gold) + " ₰";

  // Erst das Ereignis zeigen, dann Ansehen geben – falls dadurch ein Aufstieg kommt,
  // erscheint dessen Nachricht dank der Warteschlange danach.
  zeigeEreignis("📜 Auftrag erfüllt!",
    auftragText(a) + " – und du hast pünktlich geliefert.<br><br>" +
    "Belohnung: <b>" + geld(a.gold) + " ₰</b> und <b>" + a.ansehen + "</b> Punkte Ansehen.");
  spieleTon("glocke");                 // Schritt 22
  ansehenPlus(a.ansehen);
}

// Wird einmal pro Spieltag aufgerufen
function tagesAuftraege() {
  const heute = spiel.letzterBerechneterTag;

  // 1. Alte Angebote verschwinden aus dem Aushang
  spiel.auftraege = spiel.auftraege.filter(a => a.angebotBis > heute);

  // 2. Verpasste Fristen
  const verpasst = spiel.angenommen.filter(a => a.bisTag < heute);
  spiel.angenommen = spiel.angenommen.filter(a => a.bisTag >= heute);
  for (const a of verpasst) {
    const strafe = rundeAuf10(a.gold * AUFTRAG_STRAFE);
    spiel.gold -= strafe;
    buche("📜 Vertragsstrafe: " + auftragWare(a).name + " für " + a.ziel, -strafe);
    chronik("📜", "Frist verpasst: " + auftragWare(a).name + " für " + a.ziel);
    zeigeEreignis("📜 Frist verpasst",
      auftragText(a) + " – aber die Frist ist abgelaufen (geliefert: " + a.geliefert + " von " + a.menge + ").<br><br>" +
      "Vertragsstrafe: <b>" + geld(strafe) + " ₰</b>, außerdem verlierst du <b>" + a.ansehen + "</b> Punkte Ansehen.");
    ansehenPlus(-a.ansehen);
  }

  // 3. Vielleicht hängt ein neues Angebot aus?
  if (spiel.auftraege.length < AUFTRAG_MAX_ANGEBOTE && Math.random() < AUFTRAG_CHANCE) {
    neuerAuftrag();
  }

  if (verpasst.length > 0) zeichneEreignisse();
}

// ---------- Das Aufträge-Fenster ----------
function zeigeAuftraege() {
  const heute = spiel.letzterBerechneterTag;
  let html = "<h3 style='margin-top:0'>📜 Aufträge</h3>";

  // Deine laufenden Aufträge
  if (spiel.angenommen.length > 0) {
    html += "<div class='hinweis'><b>Deine Aufträge</b></div>";
    for (const a of spiel.angenommen) {
      const rest = a.bisTag - heute;
      const knapp = rest <= 7 ? "minus" : "";          // die letzte Woche: rot
      const kann = lieferbar(a) > 0;
      html += '<div class="station">' + auftragText(a) + "<br>" +
              "<span class='klein'>Geliefert: " + a.geliefert + " / " + a.menge +
              " · <span class='" + knapp + "'>noch " + rest + " Tag(e)</span>" +
              " · Belohnung " + geld(a.gold) + " ₰, 🎖 +" + a.ansehen + "</span><br>" +
              (kann
                ? '<button class="klein" data-aktion="abliefern" data-auftrag="' + a.id + '">📦 Jetzt abliefern (' + Math.min(lieferbar(a), a.menge - a.geliefert) + ")</button>"
                : "<span class='klein' style='opacity:.7'>Bring die Ware mit einem Schiff nach " + a.ziel + ".</span>") +
              "</div>";
    }
  }

  // Der Aushang
  html += "<div class='hinweis'><b>Aushang</b> · " + spiel.angenommen.length + " von " + AUFTRAG_MAX_ANGENOMMEN + " Aufträgen angenommen</div>";
  if (spiel.auftraege.length === 0) {
    html += "<div class='hinweis'>Zur Zeit keine Angebote. Neue Aufträge hängen alle paar Tage aus.</div>";
  }
  const voll = spiel.angenommen.length >= AUFTRAG_MAX_ANGENOMMEN;
  for (const a of spiel.auftraege) {
    html += '<div class="station">' + auftragText(a) + "<br>" +
            "<span class='klein'>Belohnung <b>" + geld(a.gold) + " ₰</b>, 🎖 +" + a.ansehen +
            " · Frist " + a.dauer + " Tage ab Annahme · hängt noch " + (a.angebotBis - heute) + " Tag(e) aus</span><br>" +
            '<button class="klein" data-aktion="annehmen" data-auftrag="' + a.id + '"' + (voll ? " disabled" : "") + ">Annehmen</button>" +
            "</div>";
  }

  document.getElementById("auftraege").innerHTML = html;
}

// Klicks im Aufträge-Fenster
document.getElementById("auftraege").addEventListener("click", (e) => {
  const knopf = e.target.closest("button");
  if (!knopf) return;
  const id = Number(knopf.dataset.auftrag);
  if (knopf.dataset.aktion === "annehmen")  auftragAnnehmen(id);
  if (knopf.dataset.aktion === "abliefern") abliefern(id);

  zeigeAuftraege();
  zeichneEreignisse();     // 📜-Symbole auf der Karte
  zeigeMarkt();
  zeigeFlotte();
  zeigeKasse();
  aktualisiereAnzeige();
});
