// ======================================================================
// ereignisse.js – Zufällige Ereignisse und der Eiswinter.
// ======================================================================

function ereignisTyp(ereignis) {
  return EREIGNISTYPEN.find(t => t.id === ereignis.typ);
}

function ereignisseIn(stadtName) {
  return spiel.aktiveEreignisse.filter(e => e.stadt === stadtName);
}

// Ist dieser Hafen gerade zugefroren? (Januar = Monat 0, Februar = Monat 1)
function istZugefroren(stadtName) {
  const monat = datumVon(spiel.letzterBerechneterTag).getMonth();
  return EISHAEFEN.includes(stadtName) && (monat === 0 || monat === 1);
}

function starteZufallsEreignis() {
  const typ = zufallsElement(EREIGNISTYPEN);

  // Welche Städte kommen in Frage?
  const kandidaten = staedte.filter(s => {
    if (typ.nurWo === "produziert" && !s.produziert.includes(typ.ware)) return false;
    if (typ.nurWo === "verbraucht" && !s.verbraucht.includes(typ.ware)) return false;
    // nicht zweimal dieselbe Ware in derselben Stadt
    return !spiel.aktiveEreignisse.some(e => e.stadt === s.name && e.ware === typ.ware);
  });
  if (kandidaten.length === 0) return;

  const stadt = zufallsElement(kandidaten);
  const dauer = zufallsZahl(typ.dauer[0], typ.dauer[1]);

  // Wir speichern das ENDE (bisTag), nicht die Dauer. So müssen wir nicht jeden Tag
  // herunterzählen – wir vergleichen einfach mit dem heutigen Tag.
  spiel.aktiveEreignisse.push({
    typ: typ.id,
    stadt: stadt.name,
    ware: typ.ware,
    aenderung: typ.aenderung,
    bisTag: spiel.letzterBerechneterTag + dauer
  });

  zeigeEreignis(typ.symbol + " " + typ.name + " in " + stadt.name,
    typ.text(stadt.name) + "<br><br><span class='hinweis'>Das dauert etwa " + dauer + " Tage.</span>");
  zeichneEreignisse();
}

// Wird einmal pro Spieltag aufgerufen
function tagesEreignisse() {
  const heute = spiel.letzterBerechneterTag;

  // 1. Abgelaufene Ereignisse beenden.
  //    filter() teilt die Liste in zwei: was vorbei ist, und was weiterläuft.
  const vorbei = spiel.aktiveEreignisse.filter(e => e.bisTag <= heute);
  spiel.aktiveEreignisse = spiel.aktiveEreignisse.filter(e => e.bisTag > heute);
  for (const e of vorbei) {
    spiel.meldung = "✔ " + ereignisTyp(e).name + " in " + e.stadt + " ist vorüber.";
  }

  // 2. Laufende Ereignisse wirken: Ware kommt dazu oder fällt weg
  for (const e of spiel.aktiveEreignisse) {
    const markt = spiel.maerkte[e.stadt];
    markt[e.ware] = Math.max(0, markt[e.ware] + e.aenderung);
  }

  // 3. Vielleicht beginnt ein neues Ereignis?
  if (spiel.aktiveEreignisse.length < MAX_EREIGNISSE && Math.random() < EREIGNIS_CHANCE) {
    starteZufallsEreignis();
  }

  // 4. Der Kalender: Winter im Norden
  const d = datumVon(heute);
  const istErster = (d.getDate() === 1);
  if (istErster && d.getMonth() === 11) {          // 1. Dezember
    spiel.meldung = "🍂 Der Winter naht. Ab Januar frieren die Häfen von " + EISHAEFEN.join(", ") + " zu.";
  }
  if (istErster && d.getMonth() === 0) {           // 1. Januar
    zeigeEreignis("❄ Eiswinter",
      "Die Ostsee friert im Norden zu. Die Häfen von <b>" + EISHAEFEN.join(", ") + "</b> sind bis Anfang März " +
      "gesperrt – kein Schiff kann dort ein- oder auslaufen.<br><br>" +
      "<span class='hinweis'>Schiffe, die schon unterwegs sind, erreichen ihr Ziel noch.</span>");
  }
  if (istErster && d.getMonth() === 2) {           // 1. März
    spiel.meldung = "🌊 Das Eis ist getaut – alle Häfen sind wieder offen.";
  }

  if (vorbei.length > 0 || istErster) zeichneEreignisse();
}

// Symbole an den Städten auf der Karte neu zeichnen
function zeichneEreignisse() {
  ebeneEreignisse.innerHTML = "";      // alles Alte entfernen

  // Winter: Die ganze Karte bekommt die CSS-Klasse "winter" (Schnee auf dem Land, graues Meer).
  // Das eigentliche Umfärben macht das CSS – mit einem weichen Übergang (transition).
  const winter = EISHAEFEN.some(h => istZugefroren(h));
  karte.classList.toggle("winter", winter);

  // Eisflächen vor den zugefrorenen Häfen, aus mehreren unregelmäßig verteilten Schollen
  ebeneEis.innerHTML = "";
  for (const name of EISHAEFEN) {
    if (!istZugefroren(name)) continue;
    const stadt = findeStadt(name);
    for (const [dx, dy, r] of [[0, 0, 30], [-18, 10, 20], [14, 16, 18], [-6, -16, 16]]) {
      ebeneEis.appendChild(svg("circle", { cx: stadt.x + dx, cy: stadt.y + dy, r: r, fill: "url(#eisVerlauf)" }));
    }
  }

  for (const stadt of staedte) {
    let symbole = "";
    let tooltip = [];
    for (const e of ereignisseIn(stadt.name)) {
      symbole += ereignisTyp(e).symbol;
      tooltip.push(ereignisTyp(e).name);
    }
    // Schritt 18: Hierhin soll ein angenommener Auftrag geliefert werden
    if (spiel.angenommen.some(a => a.ziel === stadt.name)) {
      symbole += "📜";
      tooltip.push("Lieferauftrag");
    }
    if (istZugefroren(stadt.name)) {
      symbole += "❄";
      tooltip.push("Hafen zugefroren");
    }
    if (symbole === "") continue;

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("class", "ereignis-symbol");
    text.setAttribute("x", stadt.x - 8);
    text.setAttribute("y", stadt.y + 24);
    text.textContent = symbole;
    const titel = document.createElementNS(SVG_NS, "title");
    titel.textContent = stadt.name + ": " + tooltip.join(", ");
    text.appendChild(titel);
    ebeneEreignisse.appendChild(text);
  }
}
