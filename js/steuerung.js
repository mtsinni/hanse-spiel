// ======================================================================
// steuerung.js – Pause, Tempo und Tastatur.
// ======================================================================

// ---------- Steuerung: Pause und Tempo ----------
const btnPause = document.getElementById("btnPause");
const tempoButtons = document.querySelectorAll("button[data-speed]");

function setzePause(wert) {
  // Schritt 21: Solange ein Gefecht läuft, bleibt das Spiel angehalten – egal, wer "weiter" sagt.
  // (typeof prüft, ob es die Variable schon gibt: beim allerersten Aufruf ist gefecht.js evtl. noch nicht geladen)
  if (!wert && typeof gefecht !== "undefined" && gefecht) return;
  spiel.pausiert = wert;
  btnPause.textContent = wert ? "▶ Weiter" : "⏸ Pause";
  btnPause.classList.toggle("aktiv", wert);
}

function setzeTempo(wert) {
  spiel.tempo = wert;
  tempoButtons.forEach(b => {
    b.classList.toggle("aktiv", Number(b.dataset.speed) === wert);
  });
}

btnPause.addEventListener("click", () => setzePause(!spiel.pausiert));
tempoButtons.forEach(b => {
  b.addEventListener("click", () => setzeTempo(Number(b.dataset.speed)));
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    setzePause(!spiel.pausiert);
  }
});
