// ======================================================================
// speichern.js – Speichern, Laden und Neues Spiel.
// ======================================================================

// ---------- Speichern und Laden ----------
const SPEICHER_SCHLUESSEL = "hanse-spielstand";

// Version 3 (Schritt 8): Reisen enthalten jetzt eine Route mit Wegpunkten.
// Spielstände aus Version 2 werden beim Laden umgewandelt (siehe laden()).
const SPEICHER_VERSION = 3;

let neustartLaeuft = false;

function speichern() {
  const daten = {
    version: SPEICHER_VERSION,
    tag: spiel.tag,
    letzterBerechneterTag: spiel.letzterBerechneterTag,
    tempo: spiel.tempo,
    gold: spiel.gold,
    maerkte: spiel.maerkte,
    schiffe: spiel.schiffe,
    ausgewaehltesSchiffId: spiel.ausgewaehltesSchiffId,
    naechsteSchiffId: spiel.naechsteSchiffId,
    buch: spiel.buch,
    betriebe: spiel.betriebe,
    kontore: spiel.kontore,
    rohstoffKosten: spiel.rohstoffKosten,
    ansehen: spiel.ansehen,
    rang: spiel.rang,
    aktiveEreignisse: spiel.aktiveEreignisse,
    einwohner: spiel.einwohner,                          // Schritt 19
    statistik: spiel.statistik,                          // Schritt 20
    chronik: spiel.chronik,
    konkurrenten: spiel.konkurrenten,
    auftraege: spiel.auftraege,                          // Schritt 18
    angenommen: spiel.angenommen,
    naechsteAuftragId: spiel.naechsteAuftragId
  };
  try {
    localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(daten));
    return true;
  } catch (fehler) {
    console.warn("Speichern nicht möglich:", fehler);
    return false;
  }
}

function laden() {
  let text;
  try {
    text = localStorage.getItem(SPEICHER_SCHLUESSEL);
  } catch (fehler) {
    return false;
  }
  if (!text) return false;

  let daten;
  try {
    daten = JSON.parse(text);
  } catch (fehler) {
    return false;
  }
  // "Migration" – einen Spielstand der Version 2 auf Version 3 bringen.
  // Alte Reisen haben noch keine Route. Solche Schiffe lassen wir einfach am Ziel ankommen.
  if (daten.version === 2) {
    for (const schiff of daten.schiffe) {
      if (schiff.reise && !schiff.reise.punkte) {
        schiff.ort = schiff.reise.nach;
        schiff.reise = null;
      }
    }
    daten.version = 3;
  }

  if (daten.version !== SPEICHER_VERSION) return false;

  spiel.tag                  = daten.tag;
  spiel.letzterBerechneterTag = daten.letzterBerechneterTag;
  spiel.tempo                 = daten.tempo;
  spiel.gold                  = daten.gold;
  spiel.maerkte               = daten.maerkte;
  spiel.schiffe               = daten.schiffe;
  spiel.ausgewaehltesSchiffId = daten.ausgewaehltesSchiffId;
  spiel.naechsteSchiffId      = daten.naechsteSchiffId;
  // Ältere Spielstände haben noch kein Kassenbuch.
  // "a || b" bedeutet: nimm a – und falls a fehlt, nimm b (hier eine leere Liste).
  // So brauchen wir für diese Änderung keine neue Speicherversion.
  spiel.buch                  = daten.buch || [];
  spiel.betriebe              = daten.betriebe || [];
  spiel.kontore               = daten.kontore || {};
  spiel.rohstoffKosten        = daten.rohstoffKosten || 0;
  spiel.ansehen               = daten.ansehen || 0;
  spiel.rang                  = daten.rang || 0;
  spiel.aktiveEreignisse      = daten.aktiveEreignisse || [];
  // Schritt 19: Ältere Spielstände haben keine Einwohnerzahlen – dann gelten die Startwerte.
  // (Die Vorräte passen sich in den ersten Wochen von selbst an die Stadtgröße an.)
  spiel.einwohner             = daten.einwohner || spiel.einwohner;
  // Ältere Spielstände haben noch keine Konkurrenten –
  // dann behalten wir die frisch erzeugten vom Spielstart.
  spiel.konkurrenten          = daten.konkurrenten || spiel.konkurrenten;
  // Schritt 20: Die Konkurrenten bekommen immer die (geprüften) Farben aus daten.js –
  // auch in älteren Spielständen, in denen noch die alten Farben gespeichert sind.
  spiel.konkurrenten.forEach((k, i) => { if (KONKURRENTEN_START[i]) k.farbe = KONKURRENTEN_START[i].farbe; });
  // Schritt 18: Ältere Spielstände haben noch keine Aufträge – dann bleiben die frisch erzeugten
  spiel.auftraege             = daten.auftraege || spiel.auftraege;
  spiel.angenommen            = daten.angenommen || [];
  spiel.naechsteAuftragId     = daten.naechsteAuftragId || spiel.naechsteAuftragId;
  // Schritt 20: Ältere Spielstände haben noch keine Statistik – dann beginnt sie heute
  spiel.statistik             = daten.statistik || [schnappschuss()];
  spiel.chronik               = daten.chronik || [{ tag: spiel.letzterBerechneterTag, symbol: "📖", text: "Beginn der Chronik" }];
  return true;
}

function neuesSpiel() {
  if (!confirm("Wirklich neu anfangen? Dein Spielstand wird gelöscht.")) return;
  neustartLaeuft = true;
  try { localStorage.removeItem(SPEICHER_SCHLUESSEL); } catch (fehler) {}
  location.reload();
}

document.getElementById("btnSpeichern").addEventListener("click", () => {
  spiel.meldung = speichern() ? "💾 Spiel gespeichert." : "Speichern hat nicht geklappt.";
  zeigeMarkt();
});
document.getElementById("btnNeu").addEventListener("click", neuesSpiel);

window.addEventListener("pagehide", () => {
  if (!neustartLaeuft) speichern();
});
