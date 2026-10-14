// ======================================================================
// segeln.js – Routensuche (Dijkstra), Reisen und Ankunft.
// ======================================================================

// Der Dijkstra-Algorithmus – findet den kürzesten Weg durchs Seewege-Netz.
//
// Die Idee: Wir gehen vom Start aus wie eine Welle nach außen.
//  - "dist" merkt sich für jeden Knoten die kürzeste bisher bekannte Strecke vom Start.
//  - Am Anfang ist der Start 0 entfernt, alle anderen "unendlich" (noch unbekannt).
//  - Wir nehmen immer den noch offenen Knoten mit der KLEINSTEN Strecke.
//    Dessen Strecke ist jetzt sicher die kürzeste – er wird "abgeschlossen".
//  - Von ihm aus schauen wir alle Nachbarn an: Ist der Weg über ihn kürzer als das,
//    was wir bisher für den Nachbarn kannten? Dann merken wir uns den neuen Wert –
//    und in "vorher", über welchen Knoten wir gekommen sind.
//  - Sobald das Ziel abgeschlossen ist, sind wir fertig.
function findeRoute(startName, zielName) {
  const dist   = {};
  const vorher = {};
  const offen  = new Set(Object.keys(KNOTEN));   // Set = Menge ohne doppelte Einträge

  for (const name of offen) dist[name] = Infinity;
  dist[startName] = 0;

  while (offen.size > 0) {
    // 1. Offenen Knoten mit der kleinsten Strecke suchen
    let aktuell = null;
    for (const name of offen) {
      if (aktuell === null || dist[name] < dist[aktuell]) aktuell = name;
    }
    if (aktuell === zielName || dist[aktuell] === Infinity) break;
    offen.delete(aktuell);                          // 2. abschließen

    // 3. Nachbarn prüfen
    for (const nachbar of NACHBARN[aktuell]) {
      if (!offen.has(nachbar)) continue;
      const neueStrecke = dist[aktuell] + entfernung(KNOTEN[aktuell], KNOTEN[nachbar]);
      if (neueStrecke < dist[nachbar]) {
        dist[nachbar] = neueStrecke;
        vorher[nachbar] = aktuell;
      }
    }
  }

  if (dist[zielName] === Infinity) return null;     // kein Weg gefunden

  // 4. Weg rückwärts zusammensetzen: Ziel -> vorher -> vorher … bis zum Start
  const namen = [zielName];
  while (namen[0] !== startName) {
    namen.unshift(vorher[namen[0]]);                // unshift = VORNE einfügen
  }

  return {
    namen: namen,              // die Namen der Stationen (für Piratengebiete)
    punkte: namen.map(n => ({ x: KNOTEN[n].x, y: KNOTEN[n].y })),
    laenge: dist[zielName]
  };
}

// Reisedauer = Länge des Seewegs ÷ Tempo des Schiffs
function reiseTage(schiff, stadtA, stadtB) {
  return findeRoute(stadtA.name, stadtB.name).laenge / schiff.tempo;
}

function segeln(schiff, zielName) {
  if (!schiff.ort) return;
  if (schiff.ort === zielName) return;

  // Aus einem zugefrorenen Hafen kommt man nicht heraus – und nicht hinein
  if (istZugefroren(schiff.ort) || istZugefroren(zielName)) {
    spiel.meldung = "❄ Der Hafen von " + (istZugefroren(schiff.ort) ? schiff.ort : zielName) + " ist zugefroren.";
    return;
  }

  const route = findeRoute(schiff.ort, zielName);
  if (!route) return;

  schiff.reise = {
    von: schiff.ort,
    nach: zielName,
    startTag: spiel.tag,
    dauer: route.laenge / schiff.tempo,
    punkte: route.punkte,      // alle Stationen der Fahrt
    laenge: route.laenge,      // Gesamtlänge
    namen: route.namen,
    naechsterPunkt: 1          // welche Station als Nächstes erreicht wird (0 = Start)
  };
  schiff.ort = null;
  spieleTon("segel");                   // Schritt 22: Segel fangen Wind
  platziereStadtNamen();                // der Platz im Hafen ist jetzt frei
  spiel.meldung = "⛵ " + schiff.name + " sticht in See nach " + zielName + ".";
}

function reiseFortschritt(schiff) {
  const r = schiff.reise;
  // Math.max(…, 0) – liegt die Abfahrt noch in der Zukunft
  // (Liegezeit der Konkurrenten), ist der Fortschritt 0 statt negativ.
  return Math.min(Math.max((spiel.tag - r.startTag) / r.dauer, 0), 1);
}

function restTage(schiff) {
  return Math.ceil(schiff.reise.startTag + schiff.reise.dauer - spiel.tag);
}

// prüft ALLE Schiffe nacheinander
function pruefeAnkunft() {
  for (const schiff of spiel.schiffe) {
    if (!schiff.reise) continue;               // continue = dieses Schiff überspringen, nächstes prüfen
    if (reiseFortschritt(schiff) < 1) continue;

    const ziel = schiff.reise.nach;
    schiff.ort = ziel;
    schiff.reise = null;

    // Nur wenn das GEWÄHLTE Schiff ankommt, springt die Ansicht zur Stadt.
    // Sonst würde dich jedes ankommende Schiff aus deiner Ansicht reißen.
    if (schiff.id === spiel.ausgewaehltesSchiffId) {
      stadtAngeklickt(findeStadt(ziel));
    }
    spiel.meldung = "⚓ " + schiff.name + " ist in " + ziel + " angekommen.";
    platziereStadtNamen();          // das Schiff braucht jetzt Platz im Hafen

    // Schiffe mit aktiver Route handeln automatisch und fahren weiter
    if (schiff.route && schiff.route.aktiv) {
      routeAusfuehren(schiff);
      if (schiff.id === spiel.ausgewaehltesSchiffId) zeigeRoute();
      zeigeKasse();
    }
    zeigeMarkt();
    zeigeFlotte();
  }
}
