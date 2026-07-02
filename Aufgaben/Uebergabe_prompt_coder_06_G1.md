# Übergabe-Prompt für Claude Code — G1

**Anleitung für Dich (Ralle):**

(1) Lade die zwei Dateien `g1_bauauftrag.md` und `g1_mockup.html` aus
    dieser Chat-Session herunter.

(2) Lege sie im lokalen Repo ab:
    - `g1_bauauftrag.md` → in den Ordner `Aufgaben/`
    - `g1_mockup.html` → in den Ordner `Mockups/`

(3) In GitHub Desktop committen und pushen (oder den Coder das machen
    lassen).

(4) Claude Code öffnen (Working Directory: das Repo), den Text zwischen
    den Backticks einfügen.

---

## Wortwörtlich zu kopierender Text:

```
Hallo, wir starten Bauauftrag G1 des Aufschreibung-Projekts.

Die Excel-Auswertung (fruehere Phase G) wird zurueckgestellt. Stattdessen
kommt der Themenblock "Editieren und Datenbank-Erweiterung" in drei
Bauauftraegen: G1 (dieser), G2 (Datenbank-Verwaltung), G3 (Barcode-Scan).

G1 erweitert die bestehende Heute-Ansicht um eine Datums-Navigation: man
kann zu jedem vergangenen Tag blaettern, ihn anschauen, Eintraege
bearbeiten/loeschen und Mahlzeiten/Vitalwerte nachtragen. Kein neuer Tab,
kein neuer Sync-Mechanismus.

Bitte mache folgendes in dieser Reihenfolge:

(1) Lies die CLAUDE.md im Repo-Root erneut (Projektregeln unveraendert).

(2) Lies den Bauauftrag Aufgaben/g1_bauauftrag.md komplett. Achte
    besonders auf das Grundprinzip (zentraler Zustand angezeigtesDatum,
    auf den ALLE Datenabfragen der Tagesansicht filtern) und auf die
    Verhaltensregeln fuer Erfassungen, Vitalwerte und Sync.

(3) Oeffne und betrachte das Mockup Mockups/g1_mockup.html als Referenz
    (fuenf Bildschirme: Heute, Vergangener Tag, Leerer Tag, Kalender,
    Nachtrag).

(4) Pruefe die Voraussetzungen:
    - Liegt Aufgaben/g1_bauauftrag.md vor? Ja/Nein
    - Liegt Mockups/g1_mockup.html vor? Ja/Nein
    - Sind B2, C, F, D, E im Repo vorhanden und lauffaehig? Ja/Nein
    - Existiert der IndexedDB-Index nach_datum (aus Phase C)? Ja/Nein

(5) Schlage Modell und Aufwand vor (Workflow-Regel 7) und sammle Deine
    Rueckfragen in EINER Nachricht. Leite sie ueber mich an den
    Projektleiter weiter.

(6) Erst nach Klaerung baust Du iterativ in der "Empfohlenen Reihenfolge
    des Bauens". Nach jedem Meilenstein (Datumsfilter greift und App
    sonst unveraendert / Kalender mit Markierung laeuft / Nachtragen und
    Bearbeiten vergangener Tage komplett) kurz Bescheid geben.

(7) Am Ende: Statusbericht und Testplan in Status/ (MESZ-Zeitstempel),
    README auf Version 0.6, alles pushen.

BESONDERS WICHTIG bei G1:

- Zentraler Zustand angezeigtesDatum: bisher zeigt die Heute-Ansicht fest
  new Date(). Fuehre eine Variable angezeigtesDatum (ISO-Datum) ein.
  ALLE Datenabfragen der Tagesansicht (Erfassungen, Vitalwerte,
  Kalorien-Summe, Trinkmenge) filtern auf angezeigtesDatum statt auf
  heute, ueber den bestehenden Index nach_datum. Test nach Schritt 1: bei
  angezeigtesDatum = heute muss sich die App EXAKT wie bisher verhalten.

- Der "+"-Erfassen-Knopf uebergibt angezeigtesDatum an die Erfassen-Maske
  (statt new Date()). Beim Nachtrag: datum = angezeigtesDatum, zeit =
  aktuelle Uhrzeit (editierbar).

- Vitalwerte bleiben "ein Eintrag pro Tag, ueberschreibend": beim
  Bearbeiten eines vergangenen Tages wird der vorhandene Datensatz dieses
  Tages ueberschrieben, kein zweiter angelegt.

- geaendert_am ist immer die BEARBEITUNGS-Zeit (jetzt), nicht das
  angezeigte Datum — damit die Konflikt-Regel "neuerer gewinnt" auch beim
  nachtraeglichen Bearbeiten alter Tage korrekt greift. sync_status wie
  gewohnt setzen; der Phase-F-Sync laedt hoch.

- Kalender-Markierung: Tage mit erfassten Daten (eindeutige datum-Werte
  aus Erfassungen ODER Vitalwerten) bekommen einen Punkt. Ein Marker-Typ
  genuegt (keine Farb-Unterscheidung Mahlzeit/Vitalwert). Zukunft sperren
  (Vorwaerts-Pfeil am heutigen Tag deaktiviert, zukuenftige Kalendertage
  nicht waehlbar).

- angezeigtesDatum wird NICHT persistiert: beim App-Neustart steht die
  Ansicht wieder auf heute.

- Regressionstest: alle bisherigen Funktionen (B2/C/F/D/E) muessen
  unveraendert laufen; besonders die Verlauf-Aggregation und
  06_Tagesaggregate.csv muessen nachgetragene Tage korrekt erfassen.

Bestaetige kurz Dein Verstaendnis, das Ergebnis der vier
Voraussetzungs-Pruefungen, Deinen Modell-/Aufwand-Vorschlag, und liste
dann Deine Rueckfragen.
```

---

## Zur Erinnerung — Deine Rolle danach

(1) Coder-Rückfragen hierher in den Chat kopieren, ich beantworte sie.

(2) Bei Meilenstein-Berichten testen. Besonders:
    - Verhält sich die App am heutigen Tag exakt wie vorher (nichts
      kaputt)?
    - Blättern die Pfeile korrekt, stimmen die Tageswerte?
    - Markiert der Kalender die richtigen Tage, sind Lücken sichtbar?
    - Wird ein Nachtrag für den angezeigten Tag gespeichert (nicht für
      heute)?
    - Erscheint ein nachgetragener Tag danach im Verlauf-Diagramm und in
      06_Tagesaggregate.csv?

(3) Wenn G1 grün ist: weiter mit G2 (Datenbank-Verwaltung: Lebensmittel
    und Eigengerichte bearbeiten, manuell neue anlegen).

---

## Test-Hinweis für Dich

Der wichtigste Selbst-Test: Blättere auf einen vergangenen Tag mit
Einträgen und prüfe, ob Kalorien-Kreis, Trinkmenge und Mahlzeiten zu
diesem Tag passen (nicht die von heute). Dann trage auf einem leeren Tag
etwas nach und schau, ob es genau an diesem Tag erscheint — und danach im
Verlauf-Diagramm und in der Dropbox-Datei 06_Tagesaggregate.csv.
