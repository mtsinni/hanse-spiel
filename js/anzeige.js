// ======================================================================
// anzeige.js – Die Fenster: Markt, Flotte, Kassenbuch, obere Leiste und das Ereignisfenster.
// ======================================================================

// ---------- Ereignisfenster ----------
let warPausiertVorEreignis = false;

// Eine Warteschlange für Ereignisse.
// Kommen zwei Ereignisse gleichzeitig (z.B. Piraten abgewehrt UND dadurch Aufstieg),
// würde das zweite das erste sonst einfach überschreiben. Jetzt werden sie
// nacheinander gezeigt: push() stellt hinten an, shift() nimmt vorne weg.
const ereignisse = [];

function zeigeEreignis(titel, text) {
  const fenster = document.getElementById("ereignis");
  // Nur beim ERSTEN Fenster merken, ob vorher pausiert war
  if (fenster.style.display !== "block") warPausiertVorEreignis = spiel.pausiert;

  ereignisse.push({ titel: titel, text: text });
  setzePause(true);                    // Spiel anhalten, damit du nichts verpasst
  spieleTon("hinweis");                // Schritt 22
  if (fenster.style.display !== "block") naechstesEreignis();
  else aktualisiereEreignisKnopf();
}

function naechstesEreignis() {
  const e = ereignisse.shift();        // das älteste Ereignis vorne herausnehmen
  document.getElementById("ereignisTitel").textContent = e.titel;
  document.getElementById("ereignisText").innerHTML = e.text;
  document.getElementById("ereignis").style.display = "block";
  aktualisiereEreignisKnopf();
}

function aktualisiereEreignisKnopf() {
  const rest = ereignisse.length;
  document.getElementById("ereignisOk").textContent = rest > 0 ? "Weiter (" + rest + " weitere)" : "Weiter";
}

document.getElementById("ereignisOk").addEventListener("click", () => {
  if (ereignisse.length > 0) {
    naechstesEreignis();               // noch etwas in der Warteschlange
  } else {
    document.getElementById("ereignis").style.display = "none";
    setzePause(warPausiertVorEreignis);  // wieder so wie vorher
  }
});

function stadtAngeklickt(stadt) {
  if (spiel.ausgewaehlteStadt) spiel.ausgewaehlteStadt.svgGruppe.classList.remove("gewaehlt");
  spiel.ausgewaehlteStadt = stadt;
  stadt.svgGruppe.classList.add("gewaehlt");
  spiel.meldung = "";
  zeigeMarkt();
}

// ein Schiff auswählen – und, wenn es im Hafen liegt, gleich dessen Stadt zeigen
function waehleSchiff(id) {
  spiel.ausgewaehltesSchiffId = id;
  const schiff = aktivesSchiff();
  if (schiff.ort) stadtAngeklickt(findeStadt(schiff.ort));
  else zeigeMarkt();
  zeigeFlotte();
  zeigeRoute();
}

// ---------- Marktfenster ----------
function zeigeMarkt() {
  const stadt = spiel.ausgewaehlteStadt;
  if (!stadt) return;

  const schiff = aktivesSchiff();
  const schiffHier = (schiff.ort === stadt.name);

  let html = "<h2>" + stadt.name + "</h2>";
  html += stadtInfoHtml(stadt);   // Einwohner, Versorgung, Bedarf (Schritt 19)

  // laufende Ereignisse in dieser Stadt
  for (const e of ereignisseIn(stadt.name)) {
    const typ = ereignisTyp(e);
    const ware = WAREN.find(w => w.id === e.ware);
    const rest = e.bisTag - spiel.letzterBerechneterTag;
    html += '<div class="ereignis-banner">' + typ.symbol + " <b>" + typ.name + "</b>: " + ware.name +
            (e.aenderung < 0 ? " wird knapp" : " im Überfluss") + " · noch " + rest + " Tag(e)</div>";
  }
  if (istZugefroren(stadt.name)) {
    html += '<div class="ereignis-banner">❄ <b>Hafen zugefroren</b> – keine Ein- und Ausfahrt bis Anfang März</div>';
  }
  // Aufträge, die in diese Stadt geliefert werden sollen (Schritt 18)
  for (const a of spiel.angenommen) {
    if (a.ziel !== stadt.name) continue;
    html += '<div class="ereignis-banner">📜 <b>Auftrag:</b> ' + a.menge + " " + auftragWare(a).name + " hierher liefern" +
            " (" + a.geliefert + "/" + a.menge + ", noch " + (a.bisTag - spiel.letzterBerechneterTag) + " Tage)" +
            (lieferbar(a) > 0 ? ' <button class="klein" data-aktion="abliefern" data-auftrag="' + a.id + '">📦 Abliefern</button>' : "") +
            "</div>";
  }

  if (schiffHier) {
    html += '<div class="hinweis">⛵ <b>' + schiff.name + '</b> liegt hier – du kannst handeln.</div>';
  } else if (schiff.reise) {
    html += '<div class="hinweis"><b>' + schiff.name + '</b> ist unterwegs nach ' + schiff.reise.nach +
            ' – Ankunft in ca. ' + restTage(schiff) + ' Tag(en).</div>';
  } else {
    const route = findeRoute(schiff.ort, stadt.name);
    const tage = Math.ceil(route.laenge / schiff.tempo);

    // Wie wahrscheinlich ist eine Begegnung mit Piraten auf dieser Route? (Schritt 21: ob man sie
    // dann besiegt, hängt von Kanonen, Rumpf und deiner Entscheidung im Gefecht ab)
    const risiko = angriffsRisiko(route);
    let warnung = ' <span class="plus">· sichere Route</span>';
    if (risiko > 0) warnung = ' <span class="minus">· ☠ Piratenrisiko ca. ' + Math.round(risiko * 100) + ' %</span>';

    html += '<div class="hinweis"><b>' + schiff.name + '</b> liegt in ' + schiff.ort + '. ' +
            // bei Eis statt des Knopfs ein Hinweis
            (istZugefroren(schiff.ort) || istZugefroren(stadt.name)
              ? '<span class="minus">❄ Fahrt wegen Eis nicht möglich</span>'
              : '<button class="klein" data-aktion="segeln">⛵ Hierher segeln (ca. ' + tage + ' Tage)</button>' + warnung) +
            '</div>';
  }

  // Liegen hier noch ANDERE eigene Schiffe? Dann Knöpfe zum Umschalten anbieten.
  const andere = spiel.schiffe.filter(s => s.ort === stadt.name && s.id !== schiff.id);
  if (andere.length > 0) {
    html += '<div class="hinweis">Außerdem hier: ';
    for (const s of andere) {
      html += '<button class="klein" data-aktion="waehle" data-schiff="' + s.id + '">' + s.name + '</button> ';
    }
    html += "</div>";
  }

  // Mengenwahl – gilt für alle Kaufen/Verkaufen-Knöpfe darunter
  if (schiffHier) {
    html += '<div class="hinweis">Handelsmenge: ';
    for (const m of [1, 10, 50, 9999]) {
      const aktiv = (spiel.handelsMenge === m) ? " aktiv" : "";
      html += '<button class="klein' + aktiv + '" data-aktion="menge" data-wert="' + m + '">' + (m === 9999 ? "Max" : m) + "</button> ";
    }
    html += "</div>";
  }

  html += "<table><tr><th>Ware</th><th>Lager</th><th>Kauf</th><th>Verkauf</th><th>An Bord</th>";
  if (schiffHier) html += "<th>Kaufen</th><th>Verkaufen</th>";
  html += "</tr>";

  for (const ware of WAREN) {
    const bestand = Math.floor(spiel.maerkte[stadt.name][ware.id]);
    const kp = kaufpreis(stadt.name, ware);
    const vp = verkaufspreis(stadt.name, ware);
    const anBord = schiff.ladung[ware.id];

    let klasseKauf = "";
    if (kp < ware.basispreis * 0.8) klasseKauf = "guenstig";
    if (kp > ware.basispreis * 1.2) klasseKauf = "teuer";

    let klasseVerkauf = "";
    if (anBord > 0 && vp > schiff.einkaufspreis[ware.id]) klasseVerkauf = "gewinn";

    let bordText = "–";
    if (anBord > 0) bordText = anBord + " (Ø " + Math.round(schiff.einkaufspreis[ware.id]) + ")";

    html += "<tr>" +
              "<td>" + ware.name + "</td>" +
              '<td class="zahl">' + bestand + "</td>" +
              '<td class="zahl ' + klasseKauf + '">' + kp + " ₰</td>" +
              '<td class="zahl ' + klasseVerkauf + '">' + vp + " ₰</td>" +
              '<td class="zahl">' + bordText + "</td>";

    if (schiffHier) {
      // ein Knopf je Richtung – die Menge kommt aus der Mengenwahl
      html += "<td>" +
                '<button class="klein" data-aktion="kaufen" data-ware="' + ware.id + '" data-menge="' + spiel.handelsMenge + '">Kaufen</button>' +
              "</td><td>" +
                '<button class="klein" data-aktion="verkaufen" data-ware="' + ware.id + '" data-menge="' + spiel.handelsMenge + '"' +
                  (anBord === 0 ? " disabled" : "") + ">Verkaufen</button>" +
              "</td>";
    }
    html += "</tr>";
  }
  html += "</table>";

  // Werft – nur in Städten mit "werft: true"
  if (stadt.werft) {
    html += "<h3>🔨 Werft</h3>";
    html += "<table><tr><th>Typ</th><th>Laderaum</th><th>Tempo</th><th>Unterhalt</th><th>Preis</th><th></th></tr>";
    for (const typ of SCHIFFSTYPEN) {
      // gesperrt durch Rang? Dann zeigt der Knopf, ab wann es geht.
      const rangFehlt = typ.rang > spiel.rang;
      const zuTeuer = spiel.gold < typ.preis || rangFehlt || spiel.schiffe.length >= RAENGE[spiel.rang].maxSchiffe;
      html += "<tr>" +
                "<td>" + typ.name + "</td>" +
                '<td class="zahl">' + typ.kapazitaet + "</td>" +
                '<td class="zahl">' + typ.tempo + "</td>" +
                '<td class="zahl">' + typ.unterhalt + " ₰/Tag</td>" +
                '<td class="zahl">' + typ.preis.toLocaleString("de-DE") + " ₰</td>" +
                '<td><button class="klein" data-aktion="schiffKaufen" data-typ="' + typ.id + '"' +
                   (zuTeuer ? " disabled" : "") + ">" + (rangFehlt ? "ab " + RAENGE[typ.rang].name : "Kaufen") + "</button></td>" +
              "</tr>";
    }
    html += "</table>";

    // Kanonen für das gewählte Schiff – nur wenn es hier im Hafen liegt
    if (schiffHier) {
      const k = kanonen(schiff), max = typVon(schiff).maxKanonen;
      const gesperrt = (k >= max || spiel.gold < KANONE_PREIS);
      html += '<div class="hinweis" style="margin-top:8px">⚔ Kanonen auf der <b>' + schiff.name + "</b>: " +
              k + "/" + max + " · Kampfkraft ca. " + mittlererSchaden(k) + " Schaden pro Salve " +
              '<button class="klein" data-aktion="kanone"' + (gesperrt ? " disabled" : "") + ">" +
              "+1 Kanone (" + KANONE_PREIS + " ₰, +" + KANONE_UNTERHALT + " ₰/Tag)</button></div>";
      // Schritt 21: Reparatur nach einem Gefecht
      if (zustand(schiff) < 100) {
        const kosten = reparaturKosten(schiff);
        html += '<div class="hinweis">🔧 Zustand der <b>' + schiff.name + "</b>: " + zustand(schiff) + " % " +
                '<button class="klein" data-aktion="reparieren"' + (spiel.gold < kosten ? " disabled" : "") + ">" +
                "Reparieren (" + geld(kosten) + " ₰)</button></div>";
      }
    }
  }

  html += '<div id="meldung">' + spiel.meldung + "</div>";
  document.getElementById("markt").innerHTML = html;
  zeigeBetriebe();   // Betriebe-Fenster immer mit aktualisieren
}

document.getElementById("markt").addEventListener("click", (e) => {
  const knopf = e.target.closest("button");
  if (!knopf) return;
  const goldVorher = spiel.gold;     // Schritt 22: für den Münzklang

  const aktion = knopf.dataset.aktion;
  if (aktion === "kaufen")       kaufen(knopf.dataset.ware, Number(knopf.dataset.menge));
  if (aktion === "verkaufen")    verkaufen(knopf.dataset.ware, Number(knopf.dataset.menge));
  if (aktion === "menge")        spiel.handelsMenge = Number(knopf.dataset.wert);
  if (aktion === "abliefern") {                                                        // Schritt 18
    abliefern(Number(knopf.dataset.auftrag));
    zeigeAuftraege();
    zeichneEreignisse();
  }
  if (aktion === "segeln") {
    // Wer von Hand losschickt, hält die automatische Route an
    const s = aktivesSchiff();
    if (s.route && s.route.aktiv) s.route.aktiv = false;
    segeln(s, spiel.ausgewaehlteStadt.name);
  }
  if (aktion === "schiffKaufen") kaufeSchiff(knopf.dataset.typ);
  if (aktion === "kanone")       kaufeKanone();
  if (aktion === "reparieren")   repariere();                                          // Schritt 21
  if (aktion === "waehle") {
    waehleSchiff(Number(knopf.dataset.schiff));
    return;   // waehleSchiff zeichnet schon alles neu
  }

  zeigeMarkt();
  zeigeFlotte();
  zeigeKasse();
  zeigeRoute();           // z.B. nach einem Schiffskauf ist ein anderes Schiff gewählt
  aktualisiereAnzeige();
  if (spiel.gold !== goldVorher) spieleTon("muenze");   // Geld ist geflossen -> Münzklang
});

// ---------- Flottenliste ----------
function zeigeFlotte() {
  let html = "<h3 style='margin-top:0'>⚓ Deine Flotte</h3>";

  for (const schiff of spiel.schiffe) {
    let wo;
    if (schiff.ort) wo = "in " + schiff.ort;
    else wo = "→ " + schiff.reise.nach + " (noch ca. " + restTage(schiff) + " Tg.)";

    const gewaehlt = (schiff.id === spiel.ausgewaehltesSchiffId) ? " gewaehlt" : "";
    html += '<div class="eintrag' + gewaehlt + '" data-schiff="' + schiff.id + '">' +
              "⛵ <b>" + schiff.name + "</b> " +
              '<span class="klein">(' + schiff.typ + (kanonen(schiff) > 0 ? ", ⚔ " + kanonen(schiff) : "") + ")</span>" +
                  (zustand(schiff) < 100 ? ' <span class="klein ' + (zustand(schiff) < 50 ? "minus" : "") + '">🔧 ' + zustand(schiff) + " %</span>" : "") +   // Schritt 21
              (schiff.route && schiff.route.aktiv ? ' <span class="klein" title="fährt eine Handelsroute">🧭</span>' : "") + "<br>" +
              '<span class="klein">' + wo + " · Laderaum " + ladungGesamt(schiff) + "/" + schiff.kapazitaet +
              " · " + unterhalt(schiff) + " ₰/Tag</span>" +
            "</div>";
  }

  // Gesamtkosten und Countdown bis zum nächsten Zahltag.
  // % ist der "Modulo"-Operator: der Rest beim Teilen. 10 % 7 = 3, 14 % 7 = 0.
  const tageBisZahltag = ZAHLTAG_ALLE - (spiel.letzterBerechneterTag % ZAHLTAG_ALLE);
  html += '<div class="hinweis" style="margin:8px 0 0 0">Unterhalt gesamt: <b>' + unterhaltGesamt() +
          " ₰/Tag</b> · nächster Zahltag in " + tageBisZahltag + " Tag(en): <b>" +
          geld(unterhaltGesamt() * ZAHLTAG_ALLE) + " ₰</b></div>";

  document.getElementById("flotte").innerHTML = html;
}

// Klick auf einen Eintrag = dieses Schiff auswählen (wieder Event-Delegation)
document.getElementById("flotte").addEventListener("click", (e) => {
  const eintrag = e.target.closest(".eintrag");
  if (!eintrag) return;
  waehleSchiff(Number(eintrag.dataset.schiff));
});

// ---------- Kassenbuch anzeigen ----------
function zeigeKasse() {
  const heute = Math.floor(spiel.tag);
  let einnahmen = 0, ausgaben = 0;

  // Alle Buchungen der letzten 30 Tage zusammenzählen
  for (const eintrag of spiel.buch) {
    if (eintrag.tag < heute - 30) continue;
    if (eintrag.betrag > 0) einnahmen += eintrag.betrag;
    else ausgaben += eintrag.betrag;          // Ausgaben sind negativ
  }
  const saldo = einnahmen + ausgaben;

  let html = "<h3 style='margin-top:0'>📒 Kassenbuch</h3>";
  html += '<div class="hinweis">Letzte 30 Tage: ' +
            '<span class="plus">+' + geld(einnahmen) + "</span> / " +
            '<span class="minus">' + geld(ausgaben) + "</span> = " +
            // Bedingung ? wennJa : wennNein  – eine Kurzform von if/else ("ternärer Operator")
            '<b class="' + (saldo >= 0 ? "plus" : "minus") + '">' + (saldo >= 0 ? "+" : "") + geld(saldo) + " ₰</b>" +
          "</div>";

  if (spiel.buch.length === 0) {
    html += '<div class="hinweis">Noch keine Buchungen.</div>';
  } else {
    html += "<table>";
    // slice(0, 8) = nur die ersten 8 Einträge (die neuesten)
    for (const eintrag of spiel.buch.slice(0, 8)) {
      const klasse = eintrag.betrag >= 0 ? "plus" : "minus";
      // Einträge ohne Betrag (z.B. Aufstiege) zeigen keinen Betrag
      let betragText = (eintrag.betrag >= 0 ? "+" : "") + geld(eintrag.betrag) + " ₰";
      if (eintrag.betrag === 0) betragText = "";
      html += "<tr>" +
                '<td class="klein">' + datumKurz(eintrag.tag) + "</td>" +
                "<td style='white-space:normal'>" + eintrag.text + "</td>" +
                '<td class="zahl ' + klasse + '">' + betragText + "</td>" +
              "</tr>";
    }
    html += "</table>";
  }
  document.getElementById("kasse").innerHTML = html;
}

function aktualisiereAnzeige() {
  document.getElementById("datum").textContent = datumAlsText();
  const goldFeld = document.getElementById("gold");
  goldFeld.textContent = "💰 " + geld(spiel.gold) + " ₰";
  goldFeld.className = spiel.gold < 0 ? "minus" : "";   // Schulden in Rot
  // .length = wie viele Einträge hat die Liste?
  document.getElementById("flottenInfo").textContent = "⚓ " + spiel.schiffe.length + " Schiff(e)";

  // Rang mit Fortschrittsbalken bis zum nächsten Rang
  const r = RAENGE[spiel.rang];
  const naechster = RAENGE[spiel.rang + 1];      // undefined, wenn es keinen höheren gibt
  let rangHtml = "🎖 " + r.name;
  if (naechster) {
    // Wie viel Prozent des Wegs von dieser Schwelle zur nächsten sind geschafft?
    const anteil = (spiel.ansehen - r.ab) / (naechster.ab - r.ab);
    const prozent = Math.min(Math.max(anteil, 0), 1) * 100;
    rangHtml += '<span class="balken" title="Ansehen ' + Math.floor(spiel.ansehen) + " / " + naechster.ab +
                '"><span style="width:' + prozent.toFixed(0) + '%"></span></span>';
  }
  document.getElementById("rang").innerHTML = rangHtml;
}
