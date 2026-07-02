# Bauauftrag Phase E — Verlauf-Diagramm

**Auftraggeber:** Projektleiter (Chat-Claude)
**Empfänger:** Coder (Claude Code)
**Datum:** 01.07.2026
**Vorgänger:** Phase D (Werkzeuge) abgeschlossen und getestet
**Nachfolger:** Phase G (Excel-Auswertung + Polish)

---

## Ziel dieser Phase

Eine neue Ansicht "Verlauf" (im Mehr-Bereich, neben Werkzeuge) mit einem
Multi-Wert-Diagramm für den schnellen Überblick unterwegs. Der Nutzer
kann bis zu 6 Werte gleichzeitig über die Zeit anschauen — Vitalwerte
und Ernährungs-Tagessummen gemischt.

Zusätzlich entsteht eine neue Datei `06_Tagesaggregate.csv`, die bei
jedem Sync frisch erzeugt und hochgeladen wird — als Datenbrücke für die
spätere Excel-Auswertung (Phase G).

**Wichtig:** Das Diagramm ist bewusst ein Überblicks-Werkzeug, KEINE
tiefe Auswertung. Die Tiefe (Filter, Korrelationen, exakte Tabellen)
bleibt Excel vorbehalten. Deshalb: schlank halten.

---

## Verortung in der App

- Neuer Eintrag "Verlauf" im "Mehr"-Bereich (wie "Werkzeuge").
- KEIN neuer Tab in der unteren Leiste — die Leiste bleibt unverändert
  (Heute · Vitalwerte · + · Datenbank · Mehr).

---

## Kern-Konzept: normalisierte Darstellung

Die darstellbaren Werte haben völlig verschiedene Größenordnungen
(Gewicht ~85, Kalorien ~2200, Puls ~65). Roh übereinandergelegt wäre die
Gewichtslinie ein flacher Strich. Deshalb:

**Jede Kurve wird auf ihre eigene Spanne normalisiert.** Im gewählten
Zeitraum: der Minimalwert der Kurve = unten (0 %), der Maximalwert =
oben (100 %). Dazwischen linear interpoliert.

```
normalisiert = (wert - min_der_kurve) / (max_der_kurve - min_der_kurve)
```

Sonderfall: Ist min == max (konstante Kurve), die Linie auf die Mitte
(50 %) legen, um Division durch 0 zu vermeiden.

Die Y-Achse zeigt nur "tief / mittel / hoch", KEINE absoluten Zahlen.
Die echten Werte holt der Nutzer per Antippen (siehe unten).

---

## Bildschirme (siehe Mockup phase_e_mockup.html)

### Bildschirm 1 — Verlauf (Hochformat)
- Zeitraum-Schnellwahl oben: Woche / Monat / 3 Monate / Alles, plus
  optional frei wählbar (Von-Bis-Datumsfelder)
- Hinweis "Für das Diagramm das Gerät quer drehen" (Orientierungs-Hinweis)
- Werte-Auswahl darunter: die aktiven Werte, plus Zugang zur vollen
  Auswahlliste
- (Optional im Hochformat eine kompakte Diagramm-Vorschau — wenn einfach)

### Bildschirm 2 — Diagramm (Querformat)
- Erscheint, wenn das Gerät quer gedreht wird (Orientierungs-Erkennung)
- Vollbild-Liniendiagramm, normalisiert
- Linien mit 2px Stärke, kleine Punkte an den Messtagen
- Lücken (Tage ohne Messung) werden zwischen vorhandenen Punkten
  durchgezogen (nicht unterbrochen)
- X-Achse: Datum (an den Rändern und Mitte beschriftet)
- Y-Achse: nur tief/mittel/hoch
- Legende unten: die aktiven Werte mit ihren festen Farben

### Bildschirm 3 — Punkt antippen
- Tippt der Nutzer auf einen Tag (bzw. in die Nähe), erscheint eine
  senkrechte Markierungslinie an diesem Tag
- Ein kleines Feld zeigt alle aktiven Werte DIESES Tages mit ihren
  ECHTEN Werten und Einheiten (z. B. "Gewicht 84,6 kg", "Kalorien
  2210 kcal", "Blutdruck sys. 132")
- So bleiben die absoluten Zahlen erreichbar, obwohl die Achse
  normalisiert ist

### Bildschirm 4 — Werte-Auswahl
- Alle verfügbaren Werte, gruppiert (siehe unten)
- Jeder Wert mit fester Farbe (feste Zuordnung, nicht nach Reihenfolge)
- Maximal 6 gleichzeitig aktiv. Wird ein 7. gewählt, wird der am
  längsten aktive automatisch deaktiviert (FIFO). Alternativ ein
  Hinweis — aber FIFO ist der Nutzer-Wunsch.

---

## Verfügbare Werte (drei Gruppen)

### Gruppe 1 — Vitalwerte (aus 04_Vitaldaten.csv)
- Gewicht (kg)
- Bauchumfang (cm)
- Armumfang (cm)
- Blutdruck systolisch (mmHg)
- Blutdruck diastolisch (mmHg)
- Puls (1/min)
- k-Faktor

### Gruppe 2 — Ernährung Tagessummen (live aus 03_Erfassung berechnet)
- Kalorien gesamt (kcal)
- Trinkmenge (ml)
- Eiweiß (g)
- Kohlenhydrate (g)
- Zucker (g)
- Fett (g)
- gesättigtes Fett (g)
- ungesättigtes Fett (g)
- Salz (g)
- Ballaststoffe (g)
- Alkohol (g)

### Gruppe 3 — Kalorien pro Mahlzeit-Typ (live aus 03 berechnet)
- Morgens (kcal)
- Mittags (kcal)
- Abends (kcal)
- Zwischen (kcal)
- Naschen (kcal)
- Trinken (kcal)

---

## Feste Farbzuordnung

Jeder Wert bekommt eine feste Farbe (nicht nach Aktivierungs-Reihenfolge,
sondern pro Wert konstant — beim Ab- und Wieder-Anwählen dieselbe Farbe).
Nutze die Kategorial-Palette (max unterscheidbar):
`#2a78d6` (blau), `#1baf7a` (aqua), `#eda100` (gelb), `#008300` (grün),
`#4a3aa7` (violett), `#e34948` (rot), `#e87ba4` (magenta), `#eb6834`
(orange). Da max. 6 gleichzeitig, reichen diese. Weise jedem Wert eine
feste Farbe aus dieser Liste zu (durchgängig dokumentiert im Code).

---

## Die Tages-Aggregation (Kern der Datenlogik)

### Für das Diagramm: LIVE aus IndexedDB
Das Diagramm berechnet die Tageswerte im Moment des Anzeigens aus den
lokalen Einzeleinträgen (03) und den Vitaldaten (04). NICHT aus der
06-Datei. Grund: so zeigt das Diagramm immer den allerneuesten Stand,
auch Einträge, die noch nicht in 06 geschrieben wurden.

Aggregations-Logik pro Tag:
```
Fuer jeden Tag im gewaehlten Zeitraum:
  Ernaehrung: alle Erfassungen dieses Tages nehmen, pro Naehrwert
    aufsummieren ((menge_g/100) * lebensmittel_oder_gericht.wert_pro_100g).
    kcal gesamt = Summe. Trinkmenge = Summe menge_g der Trinken-Eintraege.
  kcal pro Mahlzeit-Typ: dieselbe Summe, aber gruppiert nach mahlzeit_typ.
  Vitalwerte: direkt aus 04 (ein Eintrag pro Tag).
```

Für Eigengerichte: die berechneten Pro-100g-Werte nutzen (der volle
Satz aus Phase D, gecacht).

### Für Excel: die Datei 06_Tagesaggregate.csv
Zusätzlich wird bei jedem Sync eine Datei `06_Tagesaggregate.csv`
erzeugt und nach Dropbox hochgeladen — als Export für die spätere
Excel-Auswertung. Details siehe nächster Abschnitt.

---

## Neue Datei: 06_Tagesaggregate.csv

### Spalten (deutsche Notation, Semikolon, Komma-Dezimal, UTF-8 BOM)
```
datum;
kcal_gesamt;trinkmenge_ml;
eiweiss_g;kohlenhydrate_g;zucker_g;fett_g;fett_gesaettigt_g;
fett_ungesaettigt_g;salz_g;ballaststoffe_g;alkohol_g;
kcal_morgens;kcal_mittags;kcal_abends;kcal_zwischen;kcal_naschen;kcal_trinken
```

Eine Zeile pro Tag, an dem es Erfassungen gibt. Die Vitalwerte kommen
NICHT in diese Datei (die stehen schon in 04 und sind bereits pro Tag).

### Erzeugungs- und Sync-Regeln (WICHTIG)
- `06` ist eine ABGELEITETE Datei — berechnet aus `03`, keine eigenen
  Eingaben.
- Sie wird bei jedem Sync KOMPLETT NEU erzeugt (aus dem aktuellen
  03-Stand nach dem Merge) und ÜBERSCHRIEBEN. Nie zeilenweise gemerged.
- Beim Download wird `06` IGNORIERT (die App berechnet sie eh selbst).
- KEIN Backup für `06` (jederzeit aus `03` reproduzierbar).
- Reihenfolge im Sync: erst `03` normal syncen und mergen, DANN aus dem
  fertigen `03`-Stand die Aggregate berechnen und `06` überschreiben und
  hochladen.
- `06` unterliegt NICHT dem rev-basierten "nur bei Änderung"-Check wie
  die anderen Dateien — sie wird bei jedem Sync neu geschrieben (oder:
  nur wenn sich der Inhalt gegenüber dem letzten erzeugten Stand
  geändert hat, um unnötige Uploads zu sparen — Deine Wahl, Hauptsache
  sie bleibt aktuell).

---

## Querformat / Orientierungs-Erkennung

- Die App erkennt, ob das Gerät hoch oder quer gehalten wird
  (z. B. über `window.matchMedia("(orientation: landscape)")` oder
  `screen.orientation` / Resize).
- Hochformat: Zeitraum + Werte-Auswahl + Dreh-Hinweis (Bildschirm 1).
- Querformat: Vollbild-Diagramm (Bildschirm 2/3).
- Die Umschaltung soll flüssig sein (beim Drehen automatisch wechseln).
- Falls die Orientierungs-Erkennung auf manchen Geräten hakt: ein
  manueller "Diagramm im Vollbild"-Knopf als Rückfallebene wäre gut
  (Deine Entscheidung, wenn einfach machbar).

---

## Diagramm-Technik

- Reines Inline-SVG oder Canvas — KEINE externe Chart-Bibliothek
  (bleibt bei der "keine neuen externen Libs"-Regel).
- SVG ist gut geeignet (Linien, Punkte, Antipp-Bereiche als unsichtbare
  Treffer-Flächen).
- Performance: bei "Alles" über viele Monate können es viele Datenpunkte
  werden — das ist unkritisch für SVG-Linien, aber die Antipp-Treffer
  sollten performant sein (z. B. nächster Punkt zur Tap-X-Position statt
  Treffer pro Punkt).

---

## Akzeptanzkriterien (Definition of Done)

(1) "Verlauf" ist über Mehr erreichbar.

(2) Zeitraum-Schnellwahl (Woche/Monat/3 Monate/Alles) funktioniert, plus
    frei wählbarer Von-Bis-Bereich.

(3) Werte-Auswahl zeigt alle drei Gruppen; max. 6 gleichzeitig; 7.
    deaktiviert den ältesten; feste Farbe pro Wert.

(4) Diagramm zeigt die aktiven Werte normalisiert, Linien mit Punkten,
    Lücken durchgezogen.

(5) Querformat: beim Drehen erscheint das Vollbild-Diagramm.

(6) Antippen eines Tages zeigt die echten Werte dieses Tages mit
    Einheiten.

(7) Tages-Aggregate werden korrekt live aus 03 berechnet (Kalorien,
    Nährwerte, Trinkmenge, kcal pro Mahlzeit-Typ).

(8) Vitalwerte werden korrekt aus 04 gelesen.

(9) `06_Tagesaggregate.csv` wird beim Sync erzeugt und nach Dropbox
    hochgeladen, in deutscher Notation, mit den spezifizierten Spalten.

(10) `06` wird nie gemerged, beim Download ignoriert, kein Backup.

(11) Excel kann `06` sauber öffnen (Semikolon, Komma-Dezimal, Umlaute).

(12) Alle bisherigen Funktionen (B2, C, F, D) laufen unverändert.

(13) Code: deutsche Variablen/Kommentare, Vanilla JS, kein Framework,
     keine neuen externen Bibliotheken.

---

## Empfohlene Reihenfolge des Bauens

(1) "Verlauf"-Einstieg im Mehr-Bereich + leerer Bildschirm.

(2) Tages-Aggregations-Funktion (live aus 03 + 04) — isoliert testbar,
    liefert pro Tag alle Werte. Wird von Diagramm UND 06-Erzeugung
    genutzt.

(3) Werte-Auswahl (drei Gruppen, max. 6, feste Farben, FIFO).

(4) Zeitraum-Wahl (Schnellwahl + frei).

(5) Normalisierung + SVG-Liniendiagramm (Hochformat-Vorschau oder
    direkt Querformat).

(6) Orientierungs-Erkennung + Querformat-Vollbild.

(7) Antipp-Funktion (senkrechte Linie + Werte-Feld mit echten Werten).

(8) 06_Tagesaggregate.csv-Erzeugung + Einhängen in den Sync (nach
    03-Merge, überschreiben, hochladen, kein Backup, Download ignorieren).

(9) Polish, Test, Statusbericht + Testplan, Push.

Meilenstein-Meldungen: nach Schritt 2 (Aggregation korrekt), nach
Schritt 7 (Diagramm mit Antippen läuft), nach Schritt 8 (06 landet in
Dropbox).

---

## Rückfragen-Hinweise (Standard-Annahmen)

- **Nur kcal pro Mahlzeit-Typ** (nicht alle Nährwerte pro Mahlzeit-Typ) —
  das wären 66 Spalten, bewusst nur kcal. Volle Nährwerte pro
  Mahlzeit-Typ ist Excel-Sache.

- **06 nur hochladen, nie herunterladen/mergen** — sie ist reiner Export.

- **Diagramm rechnet live**, 06 ist nur die Excel-Brücke — beide nutzen
  dieselbe Aggregations-Funktion, aber das Diagramm liest aus IndexedDB,
  nicht aus 06.

- **App-Version** geht auf 0.5 (Phase E). Cache-Version aufschreibung-v0.5.

---

## Nach Fertigstellung

(1) Push zum main-Branch.
(2) Statusbericht `Status/YYYYMMDD_HH-MM_Status_PhaseE.md`.
(3) Testplan `Status/YYYYMMDD_HH-MM_Testplan_PhaseE.md`.
(4) README auf Version 0.5 (Phase E).
(5) Kurze Nachricht an den Nutzer.
(6) Bei grünem Test: Phase G vorbereiten (Excel-Auswertung + Polish) —
    die letzte Phase.
