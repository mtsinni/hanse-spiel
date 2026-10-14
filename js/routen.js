// ======================================================================
// routen.js – Automatische Handelsrouten – mit dem Routen-Fenster.
// ======================================================================

// ---------- Handelsrouten ----------
//
// Eine Route hängt an einem Schiff und sieht so aus:
// schiff.route = {
//   aktiv: true,
//   index: 1,                        // welche Station als Nächstes dran ist
//   stationen: [
//     { stadt: "Lübeck", verkaufen: ["pelze"], kaufen: [{ ware: "salz",  menge: 50, maxPreis: 30 }] },
//     { stadt: "Riga",   verkaufen: ["salz"],  kaufen: [{ ware: "pelze", menge: 50, maxPreis: 0 }] }
//   ]
// }
// kaufen.menge heißt "auffüllen BIS so viele Stück an Bord sind". maxPreis 0 = keine Preisgrenze.

// Wird ausgeführt, wenn ein Schiff mit aktiver Route im Hafen liegt
function routeAusfuehren(schiff) {
  const r = schiff.route;
  if (!r || !r.aktiv || r.stationen.length < 2 || !schiff.ort) return;

  const station = r.stationen[r.index];

  // Nicht an der erwarteten Station? (z.B. gerade erst gestartet) -> erst einmal hinfahren
  if (station.stadt !== schiff.ort) {
    segeln(schiff, station.stadt);
    return;
  }

  // 1. Verkaufen (immer alles von den angehakten Waren)
  const goldVorher = spiel.gold;
  for (const wareId of station.verkaufen) verkaufen(wareId, 9999, schiff);
  const erloes = spiel.gold - goldVorher;

  // 2. Einkaufen: zuerst aus dem eigenen Kontor, dann vom Markt
  const goldMitte = spiel.gold;
  for (const k of station.kaufen) {
    let fehlt = k.menge - schiff.ladung[k.ware];
    if (fehlt <= 0) continue;
    if (spiel.kontore[schiff.ort]) {
      const vorher = schiff.ladung[k.ware];
      umladen(k.ware, fehlt, "insSchiff", schiff);
      fehlt -= schiff.ladung[k.ware] - vorher;
    }
    // "k.maxPreis || Infinity": 0 bedeutet "keine Grenze" -> dann Infinity
    if (fehlt > 0) kaufen(k.ware, fehlt, schiff, k.maxPreis || Infinity);
  }
  const ausgaben = goldMitte - spiel.gold;

  // 3. Zur nächsten Station. % sorgt dafür, dass nach der letzten wieder die erste kommt.
  r.index = (r.index + 1) % r.stationen.length;
  const ziel = r.stationen[r.index].stadt;
  segeln(schiff, ziel);

  spiel.meldung = "🧭 " + schiff.name + " in " + station.stadt + ": verkauft für " + geld(erloes) +
                  " ₰, eingekauft für " + geld(ausgaben) + " ₰ – " +
                  (schiff.reise ? "weiter nach " + ziel + "." : "wartet im Hafen (" + ziel + " nicht erreichbar).");
}

function routeStarten(schiff) {
  const r = schiff.route;
  if (r.stationen.length < 2) return;
  r.aktiv = true;
  // Liegt das Schiff schon an einer der Stationen, fängt es dort an
  const hier = r.stationen.findIndex(st => st.stadt === schiff.ort);   // -1, wenn nicht gefunden
  r.index = hier >= 0 ? hier : 0;
  if (schiff.ort) routeAusfuehren(schiff);
  // Ist das Schiff gerade auf See, übernimmt die Route bei der nächsten Ankunft.
}

// Anzeige und Editor der Route des gewählten Schiffs
function zeigeRoute() {
  const schiff = aktivesSchiff();
  const r = schiff.route;
  let html = "<h3 style='margin-top:0'>🧭 Handelsroute der " + schiff.name + "</h3>";

  if (!r) {
    html += '<div class="hinweis">Dieses Schiff hat keine Route. Mit einer Route fährt es selbstständig ' +
            "von Stadt zu Stadt, verkauft und kauft dort, was du festlegst.</div>" +
            '<button class="klein" data-aktion="routeNeu">Neue Route anlegen</button>';
    document.getElementById("route").innerHTML = html;
    return;
  }

  html += '<div class="hinweis">' + (r.aktiv ? '<span class="plus">▶ Route läuft</span>' : '<span class="minus">⏸ Route angehalten</span>') + "</div>";
  if (r.stationen.length < 2) html += '<div class="hinweis">Füge mindestens zwei Stationen hinzu.</div>';

  r.stationen.forEach((st, i) => {
    const naechste = r.aktiv && i === r.index;
    html += '<div class="station' + (naechste ? " naechste" : "") + '">' +
            "<b>" + (i + 1) + ". " + st.stadt + "</b>" + (naechste ? " <span class='klein'>◀ nächstes Ziel</span>" : "") +
            ' <button class="klein" data-aktion="stationWeg" data-i="' + i + '" title="Station entfernen">✕</button><br>';

    // Verkaufen: ein "Chip" pro Ware zum An- und Ausschalten
    html += "<span class='klein'>Verkaufen:</span> ";
    for (const w of WAREN) {
      const an = st.verkaufen.includes(w.id) ? " an" : "";
      html += '<button class="klein chip' + an + '" data-aktion="verkaufToggle" data-i="' + i + '" data-ware="' + w.id + '">' + w.name + "</button>";
    }

    // Einkaufen: vorhandene Einträge ...
    html += "<br><span class='klein'>Einkaufen:</span> ";
    if (st.kaufen.length === 0) html += "<span class='klein' style='opacity:.6'>nichts</span> ";
    st.kaufen.forEach((k, j) => {
      const ware = WAREN.find(w => w.id === k.ware);
      html += "<span class='klein'>" + ware.name + " bis " + k.menge + " Stk." + (k.maxPreis ? ", max. " + k.maxPreis + " ₰" : "") + "</span>" +
              ' <button class="klein" data-aktion="kaufWeg" data-i="' + i + '" data-j="' + j + '">✕</button> ';
    });

    // ... und ein kleines Formular für einen neuen Eintrag
    html += "<br><select id='kw" + i + "'>" + WAREN.map(w => "<option value='" + w.id + "'>" + w.name + "</option>").join("") + "</select>" +
            " bis <input id='km" + i + "' type='number' min='1' value='" + Math.min(50, schiff.kapazitaet) + "' style='width:48px'> Stk.," +
            " max. <input id='kp" + i + "' type='number' min='0' placeholder='egal' style='width:52px'> ₰ " +
            '<button class="klein" data-aktion="kaufNeu" data-i="' + i + '">+ Einkauf</button>';
    html += "</div>";
  });

  // Neue Station
  html += "<div style='margin:6px 0'>Station hinzufügen: <select id='neueStation'>" +
          staedte.map(s => "<option>" + s.name + "</option>").join("") + "</select> " +
          '<button class="klein" data-aktion="stationNeu">+ Station</button></div>';

  // Steuerung
  if (r.aktiv) {
    html += '<button class="klein" data-aktion="routeStopp">⏸ Route anhalten</button> ';
  } else {
    html += '<button class="klein" data-aktion="routeStart"' + (r.stationen.length < 2 ? " disabled" : "") + ">▶ Route starten</button> ";
  }
  html += '<button class="klein" data-aktion="routeLoeschen">Route löschen</button>';

  document.getElementById("route").innerHTML = html;
}

// Klicks im Routen-Fenster
document.getElementById("route").addEventListener("click", (e) => {
  const knopf = e.target.closest("button");
  if (!knopf) return;
  const schiff = aktivesSchiff();
  const aktion = knopf.dataset.aktion;
  const i = Number(knopf.dataset.i);

  if (aktion === "routeNeu") {
    // Die aktuelle Stadt gleich als erste Station eintragen – das spart einen Klick
    schiff.route = { aktiv: false, index: 0, stationen: [] };
    if (schiff.ort) schiff.route.stationen.push({ stadt: schiff.ort, verkaufen: [], kaufen: [] });
  }
  if (aktion === "stationNeu") {
    const stadt = document.getElementById("neueStation").value;
    schiff.route.stationen.push({ stadt: stadt, verkaufen: [], kaufen: [] });
  }
  if (aktion === "stationWeg") {
    schiff.route.stationen.splice(i, 1);          // splice(i, 1) = 1 Eintrag an Stelle i entfernen
    schiff.route.index = 0;
    if (schiff.route.stationen.length < 2) schiff.route.aktiv = false;
  }
  if (aktion === "verkaufToggle") {
    const liste = schiff.route.stationen[i].verkaufen;
    const ware = knopf.dataset.ware;
    if (liste.includes(ware)) liste.splice(liste.indexOf(ware), 1);   // war an -> aus
    else liste.push(ware);                                            // war aus -> an
  }
  if (aktion === "kaufNeu") {
    const menge = Number(document.getElementById("km" + i).value);
    const maxPreis = Number(document.getElementById("kp" + i).value) || 0;   // leer -> 0 = egal
    if (menge > 0) {
      schiff.route.stationen[i].kaufen.push({ ware: document.getElementById("kw" + i).value, menge: menge, maxPreis: maxPreis });
    }
  }
  if (aktion === "kaufWeg")       schiff.route.stationen[i].kaufen.splice(Number(knopf.dataset.j), 1);
  if (aktion === "routeStart")    routeStarten(schiff);
  if (aktion === "routeStopp")    schiff.route.aktiv = false;
  if (aktion === "routeLoeschen") schiff.route = null;

  zeigeRoute();
  zeigeMarkt();
  zeigeFlotte();
  zeigeKasse();
  aktualisiereAnzeige();
});
