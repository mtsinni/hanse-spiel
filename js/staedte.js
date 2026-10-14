// ======================================================================
// staedte.js – Einwohner, Versorgung und Wachstum der Städte.
// ======================================================================
//
// Die Idee in drei Sätzen:
// 1. Jede Stadt hat Einwohner (spiel.einwohner["Lübeck"] = 20000).
// 2. Ihre Größe bestimmt, wie groß ihr Markt ist: Vorräte, Produktion und Verbrauch
//    wachsen mit – die PREISE bleiben im Schnitt gleich, aber der Markt wird "tiefer".
// 3. Ist eine Stadt gut mit dem versorgt, was sie braucht, wächst sie – sonst schrumpft sie.

// Wie groß ist eine Stadt im Vergleich zu einer "Normalstadt" mit 10.000 Einwohnern?
// Lübeck mit 20.000 Einwohnern hat Faktor 2, Visby mit 5.000 hat Faktor 0,5.
function stadtFaktor(stadtName) {
  return spiel.einwohner[stadtName] / EINWOHNER_BASIS;
}

// Der "normale" Vorrat einer Ware hängt jetzt von der Stadtgröße ab
function normalBestand(stadtName) {
  return NORMAL_BESTAND * stadtFaktor(stadtName);
}

// Wie gut ist die Stadt versorgt? Durchschnitt über alle Waren, die sie verbraucht.
// 1,0 = Vorrat so groß wie normal, 0,5 = halber Vorrat, 0 = nichts mehr da.
function versorgung(stadtName) {
  const stadt = findeStadt(stadtName);
  let summe = 0;
  for (const wareId of stadt.verbraucht) {
    const anteil = spiel.maerkte[stadtName][wareId] / normalBestand(stadtName);
    summe += Math.min(anteil, 1.5);         // Überfluss zählt nur bis 150 %
  }
  return summe / stadt.verbraucht.length;
}

// Welche Versorgung braucht eine Stadt, um NICHT zu schrumpfen?
// Große Städte sind anspruchsvoller: Math.log2 zählt, wie oft sich die Größe verdoppelt hat.
//   5.000 Einwohner (Faktor 0,5): log2 = -1  ->  Ziel 0,4
//  10.000 Einwohner (Faktor 1):   log2 =  0  ->  Ziel 0,5
//  20.000 Einwohner (Faktor 2):   log2 =  1  ->  Ziel 0,6
//  40.000 Einwohner (Faktor 4):   log2 =  2  ->  Ziel 0,7
// Dadurch pendelt sich jede Stadt bei einer Größe ein, die zu ihrer Versorgung passt –
// sonst würden die Städte über die Jahre endlos wachsen.
function versorgungsZiel(stadtName) {
  return VERSORGUNG_ZIEL + VERSORGUNG_ANSPRUCH * Math.log2(stadtFaktor(stadtName));
}

// Wachstum pro Tag (0.001 = +0,1 %). Positiv bei guter, negativ bei schlechter Versorgung.
function wachstumsRate(stadtName) {
  const rate = (versorgung(stadtName) - versorgungsZiel(stadtName)) * WACHSTUM_STAERKE;
  return Math.min(Math.max(rate, -WACHSTUM_MAX), WACHSTUM_MAX);
}

// "Marktflecken", "Kleinstadt" … – die höchste Klasse, deren Schwelle erreicht ist
function groessenklasse(einwohner) {
  let klasse = GROESSENKLASSEN[0].name;
  for (const k of GROESSENKLASSEN) {
    if (einwohner >= k.ab) klasse = k.name;
  }
  return klasse;
}

// Wird einmal pro Spieltag aufgerufen
function tagesStaedte() {
  for (const stadt of staedte) {
    const vorher = spiel.einwohner[stadt.name];
    let nachher = vorher * (1 + wachstumsRate(stadt.name));
    nachher = Math.min(Math.max(nachher, EINWOHNER_MIN), EINWOHNER_MAX);

    // Wenn die Stadt wächst, wachsen ihre Vorräte mit – sonst würde sie durch das
    // Wachstum allein "verarmen" (gleicher Vorrat für mehr Leute).
    const markt = spiel.maerkte[stadt.name];
    for (const ware of WAREN) markt[ware.id] *= nachher / vorher;

    spiel.einwohner[stadt.name] = nachher;

    // Neue Größenklasse erreicht (oder verloren)?
    const alt = groessenklasse(vorher), neu = groessenklasse(nachher);
    if (alt !== neu) {
      spiel.meldung = nachher > vorher
        ? "🏘 " + stadt.name + " ist zur " + neu + " gewachsen!"
        : "🏚 " + stadt.name + " ist zur " + neu + " geschrumpft.";
      chronik(nachher > vorher ? "🏘" : "🏚", spiel.meldung.slice(2));   // slice(2): ohne das Symbol vorne
    }
  }
}

// Kreise auf der Karte: je mehr Einwohner, desto größer.
// Wurzel (Math.sqrt), damit große Städte nicht riesig werden:
// doppelt so viele Einwohner -> etwa 1,4-mal so großer Kreis.
function aktualisiereStadtGroesse() {
  for (const stadt of staedte) {
    const r = 4 + 4 * Math.sqrt(stadtFaktor(stadt.name));
    stadt.svgKreis.setAttribute("r", r.toFixed(1));
    stadt.svgKern.setAttribute("r", (r * 0.38).toFixed(1));
  }
  platziereStadtNamen();      // größere Kreise brauchen mehr Abstand zum Namen
}

// Die Infozeile oben im Marktfenster
function stadtInfoHtml(stadt) {
  const ew = Math.round(spiel.einwohner[stadt.name]);
  const v = versorgung(stadt.name);
  const rate = wachstumsRate(stadt.name);

  let trend = "● stabil";
  if (rate > 0.0003)  trend = '<span class="plus">▲ wächst</span>';
  if (rate < -0.0003) trend = '<span class="minus">▼ schrumpft</span>';

  let wort = "schlecht", farbe = "minus";
  if (v >= 0.35) { wort = "mäßig"; farbe = ""; }
  if (v >= 0.6)  { wort = "gut"; farbe = "plus"; }
  if (v >= 0.9)  { wort = "sehr gut"; farbe = "plus"; }

  // Was braucht die Stadt – und wie viel ist davon da?
  const bedarf = findeStadt(stadt.name).verbraucht.map(wareId => {
    const ware = WAREN.find(w => w.id === wareId);
    const anteil = spiel.maerkte[stadt.name][wareId] / normalBestand(stadt.name);
    const zeichen = anteil >= 0.6 ? "✔" : anteil >= 0.3 ? "⚠" : "✖";
    const klasse  = anteil >= 0.6 ? "plus" : anteil >= 0.3 ? "" : "minus";
    return "<span class='" + klasse + "'>" + zeichen + " " + ware.name + "</span>";
  });

  return '<div class="hinweis">🏘 <b>' + groessenklasse(ew) + "</b> · " + geld(ew) + " Einwohner · " + trend + "<br>" +
         "Versorgung: <span class='" + farbe + "'>" + wort + "</span>" +
         '<span class="balken" title="' + Math.round(v * 100) + ' %"><span style="width:' + Math.min(v / 1.5, 1) * 100 + '%"></span></span>' +
         " · Bedarf: " + bedarf.join(", ") + "</div>";
}
