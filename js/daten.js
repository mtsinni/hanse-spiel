// ======================================================================
// daten.js – Alle festen Spieldaten: Waren, Städte, Karte, Seewege, Schiffs- und Betriebstypen, Ränge, Ereignisse, Stellschrauben.
// ======================================================================

// ---------- Die Daten ----------
const WAREN = [
  { id: "getreide", name: "Getreide", basispreis: 40  },
  { id: "fisch",    name: "Fisch",    basispreis: 35  },
  { id: "holz",     name: "Holz",     basispreis: 30  },
  { id: "salz",     name: "Salz",     basispreis: 25  },
  { id: "bier",     name: "Bier",     basispreis: 45  },
  { id: "tuch",     name: "Tuch",     basispreis: 120 },
  { id: "eisen",    name: "Eisen",    basispreis: 90  },
  { id: "pelze",    name: "Pelze",    basispreis: 200 }
];

// "werft: true" – nur in diesen Städten kann man Schiffe kaufen
const staedte = [
  { name: "Bergen",    x: 47,  y: 33,  produziert: ["fisch"],                     verbraucht: ["getreide", "bier"] },
  { name: "Stockholm", x: 513, y: 95,  produziert: ["eisen", "holz"],             verbraucht: ["getreide", "salz", "tuch"], werft: true },
  { name: "Reval",     x: 753, y: 89,  produziert: ["getreide", "pelze"],         verbraucht: ["salz", "tuch"] },
  { name: "Visby",     x: 521, y: 189, produziert: ["fisch", "holz"],             verbraucht: ["getreide", "tuch"] },
  { name: "Riga",      x: 732, y: 228, produziert: ["getreide", "pelze", "holz"], verbraucht: ["salz", "tuch", "eisen"] },
  { name: "Danzig",    x: 531, y: 367, produziert: ["getreide", "holz", "bier"],  verbraucht: ["salz", "fisch", "tuch"], werft: true },
  { name: "Rostock",   x: 295, y: 384, produziert: ["bier", "getreide"],          verbraucht: ["fisch", "holz", "pelze"] },
  { name: "Lübeck",    x: 244, y: 395, produziert: ["salz", "bier"],              verbraucht: ["getreide", "fisch", "pelze", "eisen"], werft: true },
  { name: "Hamburg",   x: 218, y: 411, produziert: ["bier", "tuch"],              verbraucht: ["getreide", "holz", "pelze"], werft: true },
  { name: "Stettin",   x: 386, y: 423, produziert: ["getreide", "fisch"],         verbraucht: ["tuch", "salz", "eisen"] },
  { name: "Bremen",    x: 175, y: 439, produziert: ["tuch", "bier"],              verbraucht: ["fisch", "holz", "eisen"] }
];

// ---------- Landkarte ----------

// Umrechnung von Erdkoordinaten in Kartenkoordinaten ("Projektion").
// Unsere Karte zeigt Längengrad 4° bis 26° Ost und Breitengrad 52° bis 61° Nord.
// 22 Längengrade auf 800 Einheiten  -> 36,4 Einheiten pro Grad
//  9 Breitengrade auf 500 Einheiten -> 55,6 Einheiten pro Grad
// Breitengrade zählen nach NORDEN hoch, y zählt aber nach UNTEN -> deshalb (61 - lat).
// Übrigens: Genau so wurden in Schritt 1 die x/y-Werte der Städte berechnet.
function projiziere(lon, lat) {
  return {
    x: (lon - 4) * 36.4,
    y: (61 - lat) * 55.6
  };
}

// Jede Landfläche ist eine Liste von Punkten [Längengrad, Breitengrad], die der Reihe
// nach verbunden werden. Der letzte Punkt wird automatisch mit dem ersten verbunden.
// Große Flächen, die über den Kartenrand hinausgehen, laufen einfach am Rand entlang.
// (Vereinfachte Küsten – für ein Spiel genau genug.)
const LAND = [
  { name: "Festland mit Jütland", punkte: [
    [4.25,52.0],[4.5,52.4],[4.7,52.9],[4.9,53.2],[5.6,53.4],[6.5,53.5],[7.0,53.35],[7.3,53.55],
    [7.9,53.7],[8.35,53.6],
    // Weser hinauf bis Bremen und zurück
    [8.5,53.5],[8.62,53.3],[8.72,53.06],[8.88,53.06],[8.74,53.32],[8.66,53.6],[8.6,53.85],
    // Elbe hinauf bis Hamburg und zurück
    [9.2,53.8],[9.6,53.6],[9.95,53.5],[10.08,53.58],[9.8,53.64],[9.4,53.8],[9.0,53.95],
    // Nordseeküste Jütlands bis Skagen
    [8.85,54.1],[8.85,54.4],[8.6,54.5],[8.8,54.9],[8.6,55.3],[8.15,55.5],[8.1,56.0],[8.15,56.6],
    [8.6,57.1],[9.5,57.15],[10.0,57.55],[10.6,57.74],
    // Ostküste Jütlands nach Süden
    [10.45,57.5],[10.5,57.2],[10.3,56.9],[10.3,56.55],[10.9,56.45],[10.7,56.2],[10.2,56.0],
    [10.0,55.75],[9.8,55.6],[9.65,55.3],[9.75,55.0],[10.0,54.8],[9.95,54.55],[10.2,54.45],
    [10.9,54.4],[11.1,54.25],[10.85,54.0],
    // Trave hinauf bis Lübeck
    [10.88,53.98],[10.66,53.86],[10.76,53.85],[10.98,53.97],
    [11.4,54.0],[11.6,54.1],
    // Warnow hinauf bis Rostock
    [12.03,54.18],[12.06,54.06],[12.15,54.06],[12.14,54.19],
    // Vorpommern und Rügen
    [12.5,54.45],[13.0,54.45],[13.4,54.65],[13.65,54.55],[13.6,54.3],[13.9,54.1],[14.2,53.95],
    // Oder hinauf bis Stettin
    [14.3,53.85],[14.52,53.42],[14.67,53.36],[14.62,53.6],[14.42,53.93],
    // Pommern, Danzig, Preußen, Kurland
    [15.0,54.05],[16.0,54.25],[16.9,54.6],[17.7,54.82],[18.4,54.8],[18.55,54.6],[18.65,54.4],
    [19.3,54.42],[19.6,54.45],[19.9,54.95],[20.5,54.95],[21.1,55.25],[21.05,55.75],[21.0,56.1],
    [21.05,56.5],[21.4,57.05],[21.7,57.55],[22.6,57.75],
    // Rigaer Meerbusen
    [23.15,57.3],[23.5,57.0],[24.05,56.88],[24.35,57.25],[24.4,57.9],[24.45,58.35],[23.9,58.4],
    // Estland bis Reval und weiter nach Osten
    [23.5,58.6],[23.45,59.05],[23.9,59.3],[24.7,59.42],[25.5,59.6],[26.0,59.6],
    // am rechten und unteren Kartenrand zurück zum Anfang
    [26.0,52.0]
  ]},
  { name: "Norwegen und Schweden", punkte: [
    [4.9,61.0],[4.95,60.7],[5.2,60.4],[5.0,60.0],[5.3,59.6],[5.5,59.2],[5.55,58.75],[6.0,58.35],
    [6.8,58.05],[7.5,58.0],[8.5,58.3],[9.6,58.95],[10.4,59.25],[10.6,59.8],[10.9,59.6],
    [11.0,59.1],[11.2,58.9],[11.5,58.3],[11.85,57.7],[12.1,57.2],[12.6,56.6],[12.85,56.25],
    [12.9,55.6],[13.2,55.35],[14.2,55.4],[14.35,55.95],[14.8,56.15],[15.6,56.15],[16.0,56.3],
    [16.4,56.65],[16.6,57.3],[16.7,57.9],[17.1,58.5],[17.8,58.9],
    // Stockholm
    [18.3,59.15],[18.05,59.27],[18.3,59.42],[18.9,59.8],
    [19.2,60.1],[18.6,60.4],[17.5,60.7],[17.3,61.0]
  ]},
  { name: "Finnland", punkte: [
    [21.4,61.0],[21.4,60.7],[21.3,60.4],[21.8,60.1],[22.5,59.9],[23.0,59.85],[24.0,60.05],
    [24.95,60.15],[26.0,60.4],[26.0,61.0]
  ]},
  { name: "Seeland",   punkte: [[11.1,55.7],[11.5,56.0],[12.3,56.1],[12.6,55.7],[12.4,55.25],[12.1,54.95],[11.6,55.1],[11.2,55.2]] },
  { name: "Fünen",     punkte: [[9.75,55.5],[10.4,55.6],[10.8,55.3],[10.6,55.05],[10.0,55.05],[9.7,55.25]] },
  { name: "Lolland",   punkte: [[11.0,54.85],[11.9,54.95],[12.1,54.7],[11.5,54.6]] },
  { name: "Bornholm",  punkte: [[14.7,55.3],[15.1,55.3],[15.15,55.0],[14.75,55.0]] },
  { name: "Gotland",   punkte: [[18.2,57.65],[18.75,57.95],[19.3,57.9],[18.95,57.5],[18.7,57.1],[18.3,56.9],[18.15,57.3]] },
  { name: "Öland",     punkte: [[16.45,56.2],[16.95,57.3],[17.1,57.35],[16.65,56.2]] },
  { name: "Ösel",      punkte: [[21.8,58.3],[22.2,58.6],[23.0,58.6],[23.3,58.45],[22.6,58.0],[22.0,57.9]] },
  { name: "Dagö",      punkte: [[22.0,58.9],[22.6,59.05],[23.0,58.8],[22.5,58.7]] },
  { name: "Åland",     punkte: [[19.6,60.1],[20.3,60.4],[20.4,60.1],[19.9,59.95]] }
];

// Namen der Meere: [Text, Längengrad, Breitengrad]
const MEERE = [
  ["NORDSEE", 5.0, 56.8],
  ["OSTSEE",  17.0, 55.5],
  ["Skagerrak", 7.8, 57.6]
];

// ---------- Seewege ----------

// Wegpunkte im Wasser: [Name, Längengrad, Breitengrad]
const WEGPUNKTE = [
  ["Bergen Reede",      4.7, 60.3],
  ["Nordsee Nord",      4.5, 59.4],
  ["Nordsee Mitte",     6.0, 57.0],
  ["Deutsche Bucht",    7.8, 54.1],
  ["Elbmündung",        8.55, 54.0],
  ["Elbe",              9.5, 53.72],
  ["Wesermündung",      8.45, 53.75],
  ["Weser",             8.69, 53.3],
  ["Skagerrak",         8.5, 57.75],
  ["Skagen",            10.9, 57.9],
  ["Kattegat",          11.3, 57.0],
  ["Kattegat Süd",      11.8, 56.4],
  ["Öresund Nord",      12.65, 56.05],
  ["Öresund Süd",       12.75, 55.5],
  ["Kadetrinne",        12.35, 54.6],
  ["Westliche Ostsee",  11.5, 54.35],
  ["Lübecker Bucht",    11.1, 54.08],
  ["Travemünde",        10.93, 53.97],
  ["Warnemünde",        12.08, 54.3],
  ["Arkona",            13.7, 54.9],
  ["Odermündung",       14.35, 54.1],
  ["Oder",              14.48, 53.65],
  ["Bornholm Nord",     15.0, 55.55],
  ["Stolpe Bank",       17.5, 55.3],
  ["Danziger Bucht",    18.95, 54.7],
  ["Ostsee Mitte",      19.5, 56.3],
  ["Öland Süd",         16.6, 55.95],
  ["Öland Ost",         17.4, 56.8],
  ["Gotland West",      17.8, 57.5],
  ["Gotland Ost",       20.2, 57.5],
  ["Gotland Nord",      19.6, 58.2],
  ["Landsort",          18.4, 58.4],
  ["Stockholmer Schären", 18.6, 59.25],
  ["Ålandsee",          19.5, 59.7],
  ["Finnischer Meerbusen", 22.5, 59.5],
  ["Reval Reede",       24.6, 59.6],
  ["Irbenstraße",       22.3, 57.82],
  ["Rigaer Bucht",      23.6, 57.5]
];

// Welche Punkte sind direkt durch Wasser verbunden? (in beide Richtungen befahrbar)
const SEEWEGE = [
  ["Bergen", "Bergen Reede"], ["Bergen Reede", "Nordsee Nord"], ["Nordsee Nord", "Nordsee Mitte"],
  ["Nordsee Mitte", "Skagerrak"], ["Nordsee Mitte", "Deutsche Bucht"],
  ["Deutsche Bucht", "Elbmündung"], ["Deutsche Bucht", "Wesermündung"], ["Elbmündung", "Wesermündung"],
  ["Elbmündung", "Elbe"], ["Elbe", "Hamburg"],
  ["Wesermündung", "Weser"], ["Weser", "Bremen"],
  ["Skagerrak", "Skagen"], ["Skagen", "Kattegat"], ["Kattegat", "Kattegat Süd"],
  ["Kattegat Süd", "Öresund Nord"], ["Öresund Nord", "Öresund Süd"],
  ["Öresund Süd", "Kadetrinne"], ["Öresund Süd", "Arkona"],
  ["Kadetrinne", "Westliche Ostsee"], ["Kadetrinne", "Warnemünde"], ["Kadetrinne", "Arkona"],
  ["Westliche Ostsee", "Lübecker Bucht"], ["Westliche Ostsee", "Warnemünde"],
  ["Lübecker Bucht", "Travemünde"], ["Travemünde", "Lübeck"],
  ["Warnemünde", "Rostock"],
  ["Arkona", "Bornholm Nord"], ["Arkona", "Odermündung"],
  ["Odermündung", "Oder"], ["Oder", "Stettin"], ["Odermündung", "Stolpe Bank"],
  ["Bornholm Nord", "Stolpe Bank"], ["Bornholm Nord", "Öland Süd"],
  ["Stolpe Bank", "Öland Süd"], ["Stolpe Bank", "Danziger Bucht"], ["Stolpe Bank", "Ostsee Mitte"],
  ["Danziger Bucht", "Danzig"], ["Danziger Bucht", "Ostsee Mitte"],
  ["Öland Süd", "Öland Ost"], ["Öland Ost", "Gotland West"], ["Öland Ost", "Ostsee Mitte"],
  ["Gotland West", "Visby"], ["Gotland West", "Landsort"],
  ["Landsort", "Stockholmer Schären"], ["Landsort", "Gotland Nord"],
  ["Stockholmer Schären", "Stockholm"], ["Stockholmer Schären", "Ålandsee"],
  ["Ostsee Mitte", "Gotland Ost"], ["Gotland Ost", "Gotland Nord"],
  ["Gotland Nord", "Finnischer Meerbusen"], ["Ålandsee", "Finnischer Meerbusen"],
  ["Finnischer Meerbusen", "Reval Reede"], ["Reval Reede", "Reval"],
  ["Gotland Ost", "Irbenstraße"], ["Irbenstraße", "Rigaer Bucht"], ["Rigaer Bucht", "Riga"]
];

// Auf true setzen, um das Netz der Seewege auf der Karte zu sehen (zum Ausprobieren)
const ZEIGE_SEEWEGE = false;

// Piratengebiete.
// Wegpunkt -> Wahrscheinlichkeit, dass beim Durchfahren Piraten angreifen.
// 0.15 bedeutet 15 % – also ungefähr bei jeder 7. Durchfahrt.
const PIRATEN = {
  "Nordsee Nord": 0.12,
  "Nordsee Mitte": 0.12,
  "Stolpe Bank": 0.05,
  "Gotland Ost": 0.15,
  "Gotland Nord": 0.15,
  "Irbenstraße": 0.10,
  "Finnischer Meerbusen": 0.08
};

// Kanonen
const KANONE_PREIS     = 400;    // Kaufpreis pro Kanone
const KANONE_UNTERHALT = 3;      // zusätzliche Kosten pro Tag (Pulver, Kanoniere)
// Seeschlachten (Schritt 21)
const PIRATEN_NAMEN    = ["Hein Schwarzbart", "Jasper Krummbein", "Ole Eisenhand", "die Schwarze Möwe", "Lütt Matten", "der Graue Klaas"];
const PIRATEN_RUMPF    = [70, 130];   // so stark ist ein Piratenschiff (von … bis)
const PIRATEN_KANONEN  = [1, 4];      // so viele Kanonen hat es (von … bis)
const PIRATEN_TEMPO    = 55;          // so schnell segeln Piraten – wichtig für die Flucht
const TREFFER_CHANCE   = 0.7;         // jede Kanone trifft mit 70 % Wahrscheinlichkeit …
const TREFFER_SCHADEN  = [6, 12];     // … und richtet dann so viel Schaden an
const MUSKETEN_SCHADEN = [2, 5];      // die Mannschaft schießt immer mit (auch ohne Kanonen)
const LOESEGELD_ANTEIL = 0.15;        // Lösegeld: 15 % des Ladungswerts + 200 ₰
const REPARATUR_FAKTOR = 0.3;         // ein völlig zerstörtes Schiff zu reparieren kostet 30 % des Neupreises

// KNOTEN: alle Punkte des Netzes (Städte + Wegpunkte) mit ihrer Position.
// Ein Objekt als "Nachschlagewerk": KNOTEN["Skagen"] = { x: …, y: … }
const KNOTEN = {};
for (const stadt of staedte) KNOTEN[stadt.name] = { x: stadt.x, y: stadt.y };
for (const [name, lon, lat] of WEGPUNKTE) KNOTEN[name] = projiziere(lon, lat);

// NACHBARN: für jeden Knoten die Liste der direkt erreichbaren Knoten.
// Diese Form nennt man "Adjazenzliste". Beispiel: NACHBARN["Skagen"] = ["Skagerrak", "Kattegat"]
const NACHBARN = {};
for (const name in KNOTEN) NACHBARN[name] = [];
for (const [a, b] of SEEWEGE) {
  NACHBARN[a].push(b);
  NACHBARN[b].push(a);      // Seewege gehen in beide Richtungen
}

// Schiffstypen – klein & schnell bis groß & langsam
// tempo = Karteneinheiten pro Spieltag
const SCHIFFSTYPEN = [
  // unterhalt = Heuer + Instandhaltung pro Tag
  // maxKanonen = so viele Kanonen passen höchstens an Bord
  // rang = ab welchem Rang (Nummer in RAENGE) man diesen Typ kaufen darf
  { id: "schnigge", name: "Schnigge", kapazitaet: 50,  tempo: 65, preis: 1500, unterhalt: 15, maxKanonen: 2, rang: 0, rumpf: 60 },
  { id: "kogge",    name: "Kogge",    kapazitaet: 120, tempo: 55, preis: 4000, unterhalt: 35, maxKanonen: 4, rang: 1, rumpf: 110 },
  { id: "holk",     name: "Holk",     kapazitaet: 220, tempo: 45, preis: 9000, unterhalt: 70, maxKanonen: 6, rang: 2, rumpf: 170 }
];

// Die Ränge. "ab" = so viel Ansehen braucht man.
// maxSchiffe / maxBetriebe = so viele darf man in diesem Rang besitzen.
const RAENGE = [
  { name: "Krämer",              ab: 0,    maxSchiffe: 2,  maxBetriebe: 1 },
  { name: "Händler",             ab: 50,   maxSchiffe: 3,  maxBetriebe: 3 },
  { name: "Kaufmann",            ab: 150,  maxSchiffe: 5,  maxBetriebe: 6 },
  { name: "Fernhändler",         ab: 400,  maxSchiffe: 8,  maxBetriebe: 10 },
  { name: "Ratsherr",            ab: 1000, maxSchiffe: 12, maxBetriebe: 15 },
  { name: "Patrizier",           ab: 2500, maxSchiffe: 16, maxBetriebe: 25 },
  { name: "Eldermann der Hanse", ab: 5000, maxSchiffe: 25, maxBetriebe: 40 }
];

// Die computergesteuerten Konkurrenten (frei erfundene Kaufleute)
const KONKURRENTEN_START = [
  { name: "Hinrich Vos",    heimat: "Hamburg",   farbe: "#4a8ae0" },
  { name: "Tidemann Kruse", heimat: "Danzig",    farbe: "#34a866" },
  { name: "Godeke Ruge",    heimat: "Stockholm", farbe: "#b16dd2" }
];
const KI_SCHIFFSNAMEN = ["Möwe", "Falke", "Rose", "Hoffnung", "Gute Fahrt", "Sankt Jürgen", "Maria", "Glücksrad", "Seestern", "Delphin"];
const KI_MAX_SCHIFFE  = 3;      // so viele Schiffe kauft sich ein Konkurrent höchstens
const KI_LIEGEZEIT    = 1;      // so viele Tage liegt ein Konkurrenten-Schiff zum Be- und Entladen im Hafen
const KI_MIN_SPANNE   = 0.25;   // so viel Aufschlag (25 %) muss eine Route mindestens bringen

// Alle wie viele Tage ist Zahltag?
const ZAHLTAG_ALLE = 7;

// Zufällige Ereignisse.
// ware/aenderung = so viel kommt pro Tag in der betroffenen Stadt dazu (positiv) oder fällt weg (negativ)
// nurWo = in welchen Städten das Ereignis passieren kann ("produziert", "verbraucht" oder überall)
// dauer = [kürzeste, längste] Dauer in Tagen
// text = eine FUNKTION, die den Stadtnamen bekommt und den Nachrichtentext liefert
const EREIGNISTYPEN = [
  { id: "missernte", symbol: "🌾", name: "Missernte", ware: "getreide", aenderung: -15, nurWo: "produziert", dauer: [20, 35],
    text: s => "Nach wochenlangem Regen ist die Ernte rund um " + s + " verdorben. Getreide wird dort knapp und teuer!" },
  { id: "stadtfest", symbol: "🎉", name: "Stadtfest", ware: "bier", aenderung: -10, dauer: [8, 14],
    text: s => "In " + s + " wird ein großes Fest gefeiert. Die Bürger haben gewaltigen Durst auf Bier!" },
  { id: "kirchenbau", symbol: "⛪", name: "Kirchenbau", ware: "holz", aenderung: -8, dauer: [30, 45],
    text: s => "In " + s + " beginnt der Bau einer neuen Kirche. Holz wird dringend gebraucht." },
  { id: "hering", symbol: "🐟", name: "Heringsschwarm", ware: "fisch", aenderung: 12, nurWo: "produziert", dauer: [15, 25],
    text: s => "Vor " + s + " ziehen riesige Heringsschwärme. Fisch gibt es dort im Überfluss – und billig!" },
  { id: "pelzmode", symbol: "👑", name: "Pelzmode", ware: "pelze", aenderung: -4, nurWo: "verbraucht", dauer: [20, 30],
    text: s => "Pelz ist die neueste Mode. Die reichen Bürger von " + s + " reißen sich darum." }
];
const EREIGNIS_CHANCE = 0.04;   // 4 % Chance pro Tag auf ein neues Ereignis (etwa alle 25 Tage)
const MAX_EREIGNISSE  = 3;      // höchstens so viele gleichzeitig

// Diese Häfen frieren im Januar und Februar zu
const EISHAEFEN = ["Stockholm", "Reval", "Riga"];

// Betriebe, die du bauen kannst.
// ware/menge = was pro Tag ins Kontor kommt
// rohstoff/rohstoffMenge = was der Betrieb pro Tag verbraucht (falls nötig)
// bau = Baukosten, lohn = Lohnkosten pro Tag
const BETRIEBSTYPEN = [
  // rang = ab welchem Rang man den Betrieb bauen darf
  { id: "gutshof",     name: "Gutshof",    ware: "getreide", menge: 5, bau: 2500, lohn: 40, rang: 0 },
  { id: "fischerei",   name: "Fischerei",  ware: "fisch",    menge: 5, bau: 2000, lohn: 35, rang: 0 },
  { id: "saegemuehle", name: "Sägemühle",  ware: "holz",     menge: 6, bau: 2000, lohn: 30, rang: 0 },
  { id: "saline",      name: "Saline",     ware: "salz",     menge: 6, bau: 2500, lohn: 35, rang: 0 },
  { id: "brauerei",    name: "Brauerei",   ware: "bier",     menge: 4, bau: 3500, lohn: 25, rohstoff: "getreide", rohstoffMenge: 2, rang: 1 },
  { id: "weberei",     name: "Weberei",    ware: "tuch",     menge: 2, bau: 6000, lohn: 80, rang: 2 },
  { id: "eisenhuette", name: "Eisenhütte", ware: "eisen",    menge: 2, bau: 6000, lohn: 50, rohstoff: "holz", rohstoffMenge: 3, rang: 2 },
  { id: "jagdhuette",  name: "Jagdhütte",  ware: "pelze",    menge: 1, bau: 5000, lohn: 60, rang: 2 }
];

const NORMAL_BESTAND = 200;
const PRODUKTION     = 6;
const VERBRAUCH      = 5;
const AUSGLEICH      = 0.05;
const PREIS_MIN      = 0.4;
const PREIS_MAX      = 2.5;
const AUFSCHLAG_KAUF    = 1.05;
const ABSCHLAG_VERKAUF  = 0.95;

const SEKUNDEN_PRO_TAG = 2;
const START_JAHR = 1400, START_MONAT = 3, START_TAG = 1;
const MONATE = ["Januar","Februar","März","April","Mai","Juni",
                "Juli","August","September","Oktober","November","Dezember"];

// ---------- Städte und Einwohner (Schritt 19) ----------
// Einwohner zu Spielbeginn (grob an die echten Größenverhältnisse um 1400 angelehnt)
const START_EINWOHNER = {
  "Lübeck": 20000, "Hamburg": 11000, "Danzig": 12000, "Bremen": 8000, "Rostock": 9000,
  "Stettin": 7000, "Riga": 8000, "Reval": 5000, "Stockholm": 6000, "Visby": 5000, "Bergen": 7000
};
const EINWOHNER_BASIS    = 10000;  // eine Stadt dieser Größe hat genau die "normalen" Marktwerte
const EINWOHNER_MIN      = 2000;
const EINWOHNER_MAX      = 60000;
const VERSORGUNG_ZIEL    = 0.5;    // bei dieser Versorgung bleibt eine Stadt mit 10.000 Einwohnern gleich groß
const VERSORGUNG_ANSPRUCH = 0.1;   // pro Verdopplung der Größe braucht eine Stadt 10 % mehr Versorgung zum Wachsen
const WACHSTUM_STAERKE   = 0.003;  // wie stark die Versorgung auf das Wachstum wirkt
const WACHSTUM_MAX       = 0.002;  // höchstens ±0,2 % pro Tag
const GROESSENKLASSEN = [          // aufsteigend sortiert
  { ab: 0,     name: "Marktflecken" },
  { ab: 4000,  name: "Kleinstadt" },
  { ab: 8000,  name: "Stadt" },
  { ab: 15000, name: "Großstadt" },
  { ab: 25000, name: "Metropole" }
];

// ---------- Chronik und Statistik (Schritt 20) ----------
// Deine Farbe in Diagrammen. Alle Farben der Kaufleute (hier und bei den Konkurrenten oben)
// wurden mit einem Prüfprogramm getestet: gut lesbar auf dem dunklen Hintergrund und
// auch bei Rot-Grün-Schwäche voneinander unterscheidbar.
const FARBE_SPIELER  = "#bf8526";
const STATISTIK_ALLE = 7;     // alle 7 Tage wird ein Schnappschuss gespeichert
const STATISTIK_MAX  = 300;   // so viele Schnappschüsse höchstens (danach wird ausgedünnt)
const CHRONIK_MAX    = 150;   // so viele Chronik-Einträge höchstens

// ---------- Aufträge (Schritt 18) ----------
// Wer in einer Stadt welche Ware bestellt – nur für den Text des Auftrags
const AUFTRAGGEBER = {
  getreide: "Die Bäckerzunft",
  fisch:    "Das Kloster",
  holz:     "Die Zimmerleute",
  salz:     "Die Fischhändler",
  bier:     "Der Wirt des Ratskellers",
  tuch:     "Die Schneiderzunft",
  eisen:    "Die Schmiede",
  pelze:    "Der Bürgermeister"
};
const AUFTRAG_CHANCE        = 0.15;   // 15 % Chance pro Tag auf ein neues Angebot
const AUFTRAG_MAX_ANGEBOTE  = 5;      // so viele Angebote hängen höchstens gleichzeitig aus
const AUFTRAG_MAX_ANGENOMMEN = 3;     // so viele Aufträge darfst du gleichzeitig haben
const AUFTRAG_AUSHANG_TAGE  = 20;     // so lange hängt ein Angebot aus, bevor es verschwindet
const AUFTRAG_STRAFE        = 0.2;    // Vertragsstrafe bei verpasster Frist: 20 % der Belohnung
