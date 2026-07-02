# Übergabe-Prompt für Claude Code — Phase E

**Anleitung für Dich (Ralle):**

(1) Lade die zwei Dateien `phase_e_bauauftrag.md` und `phase_e_mockup.html`
    aus dieser Chat-Session herunter.

(2) Lege sie im lokalen Repo ab:
    - `phase_e_bauauftrag.md` → in den Ordner `Aufgaben/`
    - `phase_e_mockup.html` → in den Ordner `Mockups/`

(3) In GitHub Desktop committen und pushen (oder den Coder das machen
    lassen).

(4) Claude Code öffnen (Working Directory: das Repo), den Text zwischen
    den Backticks einfügen.

---

## Wortwörtlich zu kopierender Text:

```
Hallo, wir starten Phase E des Aufschreibung-Projekts.

Phase D (Werkzeuge) ist abgeschlossen und getestet. Jetzt die vorletzte
Phase: das Verlauf-Diagramm.

Phase E baut eine neue Ansicht "Verlauf" (im Mehr-Bereich, KEIN neuer
Tab) mit einem Multi-Wert-Diagramm im Querformat — schneller Ueberblick
unterwegs, bis zu 6 Werte gleichzeitig, normalisiert dargestellt. Dazu
eine neue Datei 06_Tagesaggregate.csv als Excel-Bruecke.

Bitte mache folgendes in dieser Reihenfolge:

(1) Lies die CLAUDE.md im Repo-Root erneut (Projektregeln unveraendert).

(2) Lies den Bauauftrag Aufgaben/phase_e_bauauftrag.md komplett. Achte
    auf das Normalisierungs-Konzept, die Live-Aggregation und die
    Sonderregeln fuer 06 (nie mergen, nur ueberschreiben, kein Backup).

(3) Oeffne und betrachte das Mockup Mockups/phase_e_mockup.html als
    Referenz (vier Bildschirme: Verlauf-Hochformat, Diagramm-Querformat,
    Punkt-antippen, Werte-Auswahl).

(4) Pruefe die Voraussetzungen:
    - Liegt Aufgaben/phase_e_bauauftrag.md vor? Ja/Nein
    - Liegt Mockups/phase_e_mockup.html vor? Ja/Nein
    - Sind B2, C, F, D im Repo vorhanden und lauffaehig? Ja/Nein
    - Ist der Phase-F-Sync-Mechanismus vorhanden (fuer das Einhaengen
      der 06-Erzeugung)? Ja/Nein

(5) Schlage Modell und Aufwand vor (Workflow-Regel 7) und sammle Deine
    Rueckfragen in EINER Nachricht. Leite sie ueber mich an den
    Projektleiter weiter.

(6) Erst nach Klaerung baust Du iterativ in der "Empfohlenen Reihenfolge
    des Bauens". Nach jedem Meilenstein (Aggregation korrekt / Diagramm
    mit Antippen laeuft / 06 landet in Dropbox) kurz Bescheid geben.

(7) Am Ende: Statusbericht und Testplan in Status/ (MESZ-Zeitstempel),
    README auf Version 0.5, alles pushen.

BESONDERS WICHTIG bei Phase E:

- Normalisierung ist der Kern: jede Kurve auf ihre eigene Min-Max-Spanne
  im Zeitraum skalieren (min = unten, max = oben). Y-Achse zeigt nur
  tief/mittel/hoch, keine absoluten Zahlen. Echte Werte per Antippen.
  Sonderfall min==max → Kurve auf die Mitte legen.

- Live-Aggregation: Das Diagramm rechnet die Tageswerte im Moment des
  Anzeigens aus den lokalen Einzeleintraegen (03) und Vitaldaten (04),
  NICHT aus 06. Dieselbe Aggregations-Funktion wird auch fuer die
  06-Erzeugung genutzt.

- 06_Tagesaggregate.csv: abgeleitete Datei, bei jedem Sync KOMPLETT neu
  erzeugt (nach dem 03-Merge) und ueberschrieben. NIE gemerged, beim
  Download IGNORIERT, KEIN Backup. Nur Upload als Excel-Bruecke. Spalten
  siehe Bauauftrag (Tagessummen aller Naehrwerte + kcal pro
  Mahlzeit-Typ). Deutsche Notation (Semikolon, Komma, BOM).

- Nur kcal pro Mahlzeit-Typ (nicht alle Naehrwerte pro Mahlzeit-Typ) —
  bewusst, sonst 66 Spalten.

- Querformat ueber Orientierungs-Erkennung: Hochformat zeigt
  Zeitraum+Auswahl+Dreh-Hinweis, quer zeigt das Vollbild-Diagramm.

- max. 6 Werte gleichzeitig, feste Farbe pro Wert, 7. Haken deaktiviert
  den aeltesten (FIFO).

- Diagramm als Inline-SVG oder Canvas, KEINE externe Chart-Bibliothek.

Bestaetige kurz Dein Verstaendnis, das Ergebnis der vier
Voraussetzungs-Pruefungen, Deinen Modell-/Aufwand-Vorschlag, und liste
dann Deine Rueckfragen.
```

---

## Zur Erinnerung — Deine Rolle danach

(A) Coder-Rückfragen hierher in den Chat kopieren, ich beantworte sie.

(B) Bei Meilenstein-Berichten testen. Besonders:
    - Stimmen die Tageswerte im Diagramm mit dem überein, was Du in der
      Heute-Ansicht siehst (Kalorien)?
    - Erscheint `06_Tagesaggregate.csv` in Dropbox, und öffnet Excel sie
      sauber?
    - Funktioniert das Drehen ins Querformat?
    - Kannst Du bis zu 6 Werte wählen und per Antippen die echten Werte
      sehen?

(C) Wenn Phase E grün ist: weiter mit Phase G (Excel-Auswertung + Polish)
    — die letzte Phase.

---

## Test-Hinweis für Dich

Der wichtigste Selbst-Test: Wähle "Kalorien gesamt" im Verlauf und
vergleiche einen bestimmten Tag (per Antippen) mit dem, was die
Heute-Ansicht für denselben Tag im Kalorien-Kreis zeigt. Die Zahlen
müssen übereinstimmen — dann rechnet die Aggregation korrekt.

Und schau nach dem ersten Sync in Dropbox, ob `06_Tagesaggregate.csv`
da ist und die Tagessummen enthält.
