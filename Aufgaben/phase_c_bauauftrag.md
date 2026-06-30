# Bauauftrag Phase C — Tageseingabe (Mahlzeiten + Vitaldaten)

**Auftraggeber:** Projektleiter (Chat-Claude)
**Empfänger:** Coder (Claude Code)
**Datum:** 30.06.2026
**Vorgänger:** Phase B2 (PWA-Grundgerüst) abgeschlossen und live getestet
**Nachfolger:** Phase F (Dropbox-Sync schreibend) — kommt direkt danach

---

## Ziel dieser Phase

Die App bekommt ihre Kernfunktion: das tägliche Erfassen von Mahlzeiten
und Vitaldaten. Konkret:

(1) Neuer Startbildschirm "Heute" mit Kalorien-Kreis, Trinkmengen-Balken
    und Liste der heutigen Mahlzeiten
(2) Mahlzeit-Erfassung über Suche → Menge/Einheit → Speichern
(3) Einheiten-Logik (Gramm, Stück, Portion, Scheibe, Esslöffel, Teelöffel)
    mit lebensmittel-spezifischen Gramm-Werten und Erst-Abfrage-Popup
(4) Vitaldaten-Formular (ein Eintrag pro Tag, überschreibend)
(5) Erweiterte Navigation: 5 Tabs statt 3
(6) Mahlzeit-Einträge löschen und bearbeiten

**WICHTIG — diese Phase schreibt NICHT nach Dropbox.** Alle neuen Daten
(Erfassungen, Vitaldaten, neue Einheiten-Werte) landen ausschließlich in
der lokalen IndexedDB. Das Hochladen nach Dropbox ist Phase F. Aber:
Phase C muss die Daten "sync-bereit" ablegen (siehe Abschnitt
"Sync-Vorbereitung").

---

## Abgrenzung — was Phase C NICHT macht

- Kein Schreiben nach Dropbox (Phase F)
- Keine Mehrtages-Historie / Tagesnavigation (nur "heute")
- Keine Komfort-Features (Favoriten-Kacheln, "zuletzt verwendet",
  Mahlzeit-Bundles) — kommen später
- Keine Diagramme über Zeit (Phase E)
- Keine Rechner-Tools (Phase D)

---

## Datenstruktur-Erweiterung

### Neue Spalten in den Lebensmittel-Stammdaten

Die Lebensmittel (und Eigengerichte) brauchen optionale Felder für die
Einheiten-Gramm-Werte. Beim Indexieren aus der CSV gilt: wenn die Spalte
fehlt (alte CSV aus Phase A), Feld leer lassen — kein Fehler.

Neue optionale Felder pro Lebensmittel:
- `gramm_pro_stueck`
- `gramm_pro_portion`
- `gramm_pro_scheibe`
- `gramm_pro_essloeffel`
- `gramm_pro_teeloeffel`

Gleiche fünf Felder auch pro Eigengericht (Eigengerichte haben
"Portion" besonders häufig).

Diese Felder werden in IndexedDB gepflegt. Wenn ein neuer Wert über das
Erfassungs-Popup eingegeben wird, wird er hier gespeichert. Das spätere
Zurückschreiben in die CSV (Dropbox) macht Phase F — aber die Werte
müssen ab Phase C in IndexedDB korrekt liegen und als "geändert"
markiert sein (siehe Sync-Vorbereitung).

### Erfassungs-Datensatz (IndexedDB Store "erfassung")

Pro Mahlzeit-Eintrag, gemäß CSV-Struktur aus Phase A:
- `erfassungs_id` — eindeutige ID, neu generiert (z. B. ERF_ + Zeitstempel
  + Zufallssuffix, garantiert eindeutig auch über Geräte)
- `datum` — ISO YYYY-MM-DD
- `zeit` — HH:MM
- `mahlzeit_typ` — Morgens/Mittags/Abends/Zwischen/Naschen/Trinken
- `menge_g` — IMMER der berechnete Gramm-Wert (auch wenn in Scheiben
  eingegeben)
- `lebensmittel_id` — bei Lebensmittel
- `lebensmittel_name` — Klartext-Name (für Anzeige ohne Lookup)
- `ist_eigengericht` — true/false
- `eigengericht_id` — bei Eigengericht
- `gericht_kontext` — optional (z. B. die Original-Eingabe "3 Scheiben")
- `bemerkung` — optional

Zusätzlich für die Sync-Vorbereitung (nicht in der CSV, nur intern):
- `geaendert_am` — Zeitstempel der letzten Änderung (ISO)
- `sync_status` — "neu" / "geaendert" / "synchronisiert" (initial "neu")

### Vitaldaten-Datensatz (IndexedDB Store "vitaldaten")

Pro Tag ein Eintrag, gemäß CSV-Struktur aus Phase A:
- `datum` — ISO YYYY-MM-DD (Primärschlüssel, ein Eintrag pro Tag)
- `gewicht_kg`, `bauchumfang_cm`, `armumfang_cm`,
  `blutdruck_systolisch`, `blutdruck_diastolisch`, `puls`, `k_faktor`
  — alle optional
- `bemerkung` — optional
- `geaendert_am`, `sync_status` — wie oben

---

## Sync-Vorbereitung (für Phase F vorbereiten, aber NICHT umsetzen)

Phase C schreibt nur lokal. Damit Phase F später sauber andockt:

(1) Jeder neue oder geänderte Datensatz (Erfassung, Vitaldaten,
    Einheiten-Wert) bekommt `geaendert_am` (Zeitstempel) und
    `sync_status = "neu"` oder `"geaendert"`.

(2) Es gibt einen separaten IndexedDB-Bereich oder ein Flag, das Phase F
    abfragen kann: "Welche Datensätze sind noch nicht nach Dropbox
    hochgeladen?"

(3) Phase C implementiert NICHT das Hochladen. Es legt nur die Daten so
    ab, dass Phase F sie findet.

(4) In der "Mehr"-Sektion (Einstellungen) kann optional ein Hinweis
    stehen: "X Änderungen noch nicht synchronisiert" — als Vorbereitung
    der Sync-Anzeige. Optional, nicht Pflicht in Phase C.

---

## Funktionale Spezifikation pro Bildschirm

### Bildschirm 1 — Heute (neuer Startbildschirm)

**Anzeige von oben nach unten:**

- Header "Heute · <Wochentag TT.MM.>" mit Kalender-Icon rechts
  (Kalender-Icon Funktion: vorerst Platzhalter, keine Tagesnavigation)

- **Kalorien-Kreis** (SVG-Donut): zeigt Tages-kcal-Summe in der Mitte,
  darunter "von <Ziel> kcal". Der Ring färbt sich nach den
  Konfigurations-Grenzen:
  - grün bis `gruen_bis` (Default 2200)
  - gelb von `gruen_bis` bis `ziel` (Default 2400)
  - rot über `ziel`
  Der Ring füllt sich proportional. Unter dem Kreis ein kurzer Hinweis
  (z. B. "noch 560 kcal im grünen Bereich" oder "Tagesziel um 120 kcal
  überschritten").

- **Trinkmengen-Balken**: summiert alle Einträge mit mahlzeit_typ
  "Trinken" des Tages, zeigt sie gegen das Trink-Ziel (Default 2,0 L).
  Anzeige in Litern. Fortschrittsbalken.

- **Mahlzeiten-Liste**, gruppiert nach Mahlzeit-Typ (Morgens, Mittags,
  Abends, Zwischen, Naschen — Trinken kann separat oder integriert
  gezeigt werden, Coder entscheidet sinnvoll). Pro Gruppe eine
  Zwischensumme. Pro Eintrag: Name, Menge mit Einheit (z. B.
  "3 Scheiben · 66 g"), kcal. Antippen öffnet Bearbeiten/Löschen.

- Untere Tab-Bar (5 Tabs, siehe Navigation).

**Verhalten:**
- Kalorien-Summe und Kreis aktualisieren sich nach jedem Hinzufügen/Löschen
- Antippen eines Eintrags → Bearbeiten-Ansicht (Menge/Einheit/Typ ändern)
  oder Löschen (mit confirm())

### Bildschirm 2 — Erfassen, Schritt 1: Suche

Erreichbar über den zentralen "+"-Knopf in der Tab-Bar.

**Anzeige:**
- Header "Erfassen" mit Schließen-Kreuz (X) links
- Umschalter Lebensmittel / Gerichte (wie Chips oder Tabs)
- Suchfeld mit Live-Suche (Substring im Namen, wie Phase B2)
- Trefferliste: Name links, kcal/100g rechts

**Verhalten:**
- Live-Suche: "hack" zeigt alle Treffer mit "hack" im Namen
- Antippen eines Treffers → Schritt 2 (Menge + Einheit)

### Bildschirm 3 — Erfassen, Schritt 2: Menge + Einheit

**Anzeige:**
- Header mit Zurück-Pfeil und Titel "Menge eingeben"
- Name des gewählten Lebensmittels + kcal/100g
- Mengen-Eingabefeld (Zahl)
- Einheit-Dropdown mit allen sechs: Gramm (Default), Stück, Portion,
  Scheibe, Esslöffel, Teelöffel
- **Live-Ergebnis-Box**: zeigt berechneten Gramm-Wert und kcal, plus
  Hinweis welcher Einheiten-Wert verwendet wurde (z. B. "1 Scheibe =
  22 g (gespeichert)")
- Mahlzeit-Typ-Dropdown — automatisch vorbelegt nach Uhrzeit-Regeln aus
  der Konfiguration, aber änderbar
- Uhrzeit-Feld — vorbelegt mit aktueller Zeit, änderbar
- Knopf "Zur Aufschreibung hinzufügen"

**Verhalten:**
- Wenn Einheit gewählt wird, für die ein Gramm-Wert existiert: sofort
  live umrechnen
- Wenn Einheit gewählt wird, für die KEIN Wert existiert: Popup
  (Bildschirm 4)
- "Gramm" braucht nie ein Popup
- Bei "Hinzufügen": Eintrag in IndexedDB schreiben mit allen Feldern,
  sync_status = "neu", dann zurück zur Heute-Ansicht

**Mahlzeit-Typ-Automatik (aus Konfiguration):**
- vor `morgens_bis` (10:30) → Morgens
- zwischen `morgens_bis` und `mittags_start` → Zwischen
- zwischen `mittags_start` (11:30) und `mittags_bis` (15:00) → Mittags
- zwischen `mittags_bis` und `abends_ab` → Zwischen
- ab `abends_ab` (18:00) → Abends
(Naschen/Trinken nie automatisch, nur manuell wählbar)

### Bildschirm 4 — Einheiten-Abfrage (Popup)

Erscheint, wenn eine Einheit ohne hinterlegten Gramm-Wert gewählt wird.

**Anzeige:**
- Titel "Wie viel wiegt eine <Einheit>?" (z. B. "...eine Portion?")
- Erklärtext: "Für '<Name>' ist noch kein Gewicht für eine <Einheit>
  hinterlegt. Gib es einmalig an — es wird gespeichert und künftig
  automatisch genutzt."
- Eingabefeld "Gewicht einer <Einheit> in Gramm"
- Knopf "Speichern und weiter"
- Knopf "Abbrechen"

**Verhalten:**
- Bei "Speichern und weiter": den Gramm-Wert in das Lebensmittel
  (bzw. Eigengericht) in IndexedDB schreiben (Feld gramm_pro_<einheit>),
  sync_status des Lebensmittels auf "geaendert" setzen, Popup schließen,
  Live-Berechnung in Bildschirm 3 fortsetzen
- Bei "Abbrechen": zurück zu Bildschirm 3, Einheit zurück auf Gramm

### Bildschirm 5 — Vitalwerte

Erreichbar über den Tab "Vitalwerte".

**Anzeige:**
- Header "Vitalwerte · <Wochentag TT.MM.>" mit Kalender-Icon
- Formularfelder (alle optional):
  - Gewicht (kg) — Dezimalkomma
  - Bauchumfang (cm), Armumfang (cm) — nebeneinander
  - Blutdruck systolisch, Blutdruck diastolisch — nebeneinander, Integer
  - Puls — Integer
  - k-Faktor — optional, frei
  - Bemerkung — optional
- Knopf "Vitalwerte speichern"

**Verhalten:**
- Beim Öffnen: wenn für heute schon ein Eintrag existiert, Felder
  vorbefüllen
- Bei Speichern: Eintrag für das heutige Datum schreiben/überschreiben,
  sync_status setzen
- Ein Eintrag pro Tag (Datum ist Schlüssel)
- Deutsche Dezimalkommas in der Anzeige und Eingabe

### Navigation — neue Tab-Bar (5 Tabs)

Reihenfolge von links nach rechts:

(1) **Heute** (`ti-home`) — Bildschirm 1
(2) **Vitalwerte** (`ti-heart-rate-monitor`) — Bildschirm 5
(3) **Erfassen** — zentraler runder blauer "+"-Knopf (`ti-plus`),
    optisch hervorgehoben, größer als die anderen. Führt zu Bildschirm 2.
(4) **Datenbank** (`ti-database`) — die Lebensmittel- und Gerichte-Listen
    aus Phase B2, jetzt unter einem Tab mit zwei Unter-Reitern
    (Lebensmittel / Gerichte)
(5) **Mehr** (`ti-settings`) — die bisherige Einstellungen-Seite aus B2

Die bisherigen Phase-B2-Bildschirme (Lebensmittel-Liste, Gerichte-Liste,
Detail-Ansichten, Einstellungen) bleiben erhalten und wandern unter die
Tabs "Datenbank" und "Mehr".

---

## Einheiten-Berechnungslogik

```
Eingabe: menge (Zahl), einheit (String), lebensmittel/gericht-Objekt

wenn einheit == "Gramm":
    gramm = menge
sonst:
    feldname = "gramm_pro_" + einheit (kleingeschrieben, ae/oe-Mapping beachten)
    wenn lebensmittel[feldname] existiert und > 0:
        gramm = menge * lebensmittel[feldname]
    sonst:
        zeige Popup (Bildschirm 4), frage Gramm-Wert ab
        speichere lebensmittel[feldname] = eingegebener Wert
        gramm = menge * eingegebener Wert

kcal = (gramm / 100) * lebensmittel.kcal_pro_100g
(bei Eigengericht: kcal = (gramm / 100) * gericht.kcal_pro_100g_berechnet)

In der Erfassung gespeichert wird IMMER gramm (menge_g).
Das Feld gericht_kontext speichert die Original-Eingabe ("3 Scheibe")
zur Anzeige.
```

Feldnamen-Mapping Einheit → Feld:
- Gramm → (kein Feld, direkt)
- Stück → gramm_pro_stueck
- Portion → gramm_pro_portion
- Scheibe → gramm_pro_scheibe
- Esslöffel → gramm_pro_essloeffel
- Teelöffel → gramm_pro_teeloeffel

---

## Trinkmengen-Logik

- Getränke werden als normale Lebensmittel erfasst, mahlzeit_typ =
  "Trinken"
- Intern in Gramm gespeichert (1 ml Wasser ≈ 1 g, kein praktischer
  Unterschied)
- Die Heute-Ansicht summiert alle "Trinken"-Einträge des Tages und
  zeigt die Summe in Litern gegen das Trink-Ziel (Default 2,0 L aus
  Konfiguration)

---

## Konfigurations-Erweiterung

Die `05_Konfiguration.json` braucht (falls noch nicht vorhanden) Felder
für die Tagesbilanz. Falls sie fehlen, mit Defaults arbeiten:
- `tagesziel_kcal` (Default 2400)
- `kcal_gruen_bis` (Default 2200)
- `trink_ziel_liter` (Default 2.0)

Ausserdem kennt die Konfiguration im Block `mahlzeit_zeitregeln` das
Feld `mittags_start` (Default 11:30) — zusaetzlich zu den bereits in
CLAUDE.md beschriebenen `morgens_bis` (10:30), `mittags_bis` (15:00)
und `abends_ab` (18:00). Es wird fuer die Mahlzeit-Typ-Automatik
gebraucht. Fehlt es in der echten JSON, arbeitet der Code mit dem
Default 11:30 (Fallback). Das tatsaechliche Nachtragen in die
Dropbox-`05_Konfiguration.json` erfolgt spaeter (Phase F oder manuell).

Diese werden in Phase C nur gelesen. Editierbarkeit in den Einstellungen
ist optional / spätere Phase.

---

## CSV-Schema-Erweiterung (Dokumentation fuer Phase F)

Durch die Einheiten-Felder und die Bearbeitungs-Hilfsfelder waechst das
CSV-Schema. Phase C legt diese Werte NUR in IndexedDB ab; das
Zurueckschreiben in die CSV macht Phase F. Damit Phase F weiss, welche
Spalten wo dazukommen:

- **01_Stammdaten_Lebensmittel.csv** — fuenf neue Spalten am Ende:
  `gramm_pro_stueck;gramm_pro_portion;gramm_pro_scheibe;gramm_pro_essloeffel;gramm_pro_teeloeffel`
- **02_Stammdaten_Eigengerichte.csv** — dieselben fuenf Spalten am Ende
  (pro Gericht, also auf Kopfdaten-Ebene):
  `gramm_pro_stueck;gramm_pro_portion;gramm_pro_scheibe;gramm_pro_essloeffel;gramm_pro_teeloeffel`
- **03_Erfassung.csv** — zwei neue Spalten am Ende:
  `menge_eingabe;einheit_eingabe`

Beim Indexieren alter CSVs ohne diese Spalten: Felder leer lassen,
kein Fehler.

---

## Akzeptanzkriterien (Definition of Done)

(1) Tab-Bar zeigt 5 Einstiegspunkte, "Heute" ist Startbildschirm.

(2) Heute-Ansicht zeigt Kalorien-Kreis mit korrekter Farbe (grün/gelb/rot
    nach Grenzen).

(3) "+" öffnet die Suche; "hack" filtert korrekt.

(4) Lebensmittel auswählen → Menge "3" + Einheit "Scheibe" eingeben → bei
    bekanntem Wert sofortige Berechnung, bei unbekanntem Wert Popup.

(5) Popup speichert den Gramm-Wert, danach wird er automatisch genutzt
    (kein erneutes Popup beim nächsten Mal).

(6) Mahlzeit-Typ wird aus Uhrzeit vorgeschlagen, ist änderbar.

(7) Nach "Hinzufügen" erscheint der Eintrag in der Heute-Ansicht, der
    Kalorien-Kreis aktualisiert sich.

(8) Eigengericht erfassen funktioniert analog (mit "Portion").

(9) Trinkmengen-Einträge summieren sich korrekt im Trinkmengen-Balken.

(10) Mahlzeit-Eintrag antippen → bearbeiten oder löschen funktioniert.

(11) Vitalwerte-Formular speichert einen Tageseintrag; erneutes Öffnen
     zeigt die Werte vorbefüllt; Speichern überschreibt.

(12) Alle neuen/geänderten Datensätze haben geaendert_am und sync_status
     gesetzt (Vorbereitung Phase F).

(13) Die Phase-B2-Funktionen (Datenbank-Listen, Detail-Ansichten,
     Einstellungen) bleiben unter "Datenbank" und "Mehr" erreichbar und
     funktionieren weiter.

(14) Deutsche Dezimalkommas überall in Anzeige und Eingabe.

(15) Alles funktioniert offline (lokale IndexedDB, kein Dropbox-Schreiben
     in dieser Phase).

(16) Code: deutsche Variablen/Kommentare, Vanilla JS, kein Framework,
     keine neuen externen Bibliotheken.

---

## Empfohlene Reihenfolge des Bauens

(1) Tab-Bar auf 5 Tabs erweitern, Phase-B2-Screens unter "Datenbank"
    und "Mehr" einsortieren, Routing anpassen.

(2) IndexedDB-Schema erweitern (neue Felder, sync_status, geaendert_am).
    Migration beachten: bestehende B2-Daten dürfen nicht kaputtgehen.

(3) Heute-Ansicht Grundgerüst (ohne Daten) — Layout, Kalorien-Kreis als
    SVG, Trinkmengen-Balken.

(4) Erfassen-Suche (Schritt 1) — viel von B2-Liste wiederverwendbar.

(5) Menge+Einheit (Schritt 2) mit Live-Berechnung.

(6) Einheiten-Popup (Schritt 4) und Zurückschreiben in IndexedDB.

(7) Mahlzeit-Typ-Automatik aus Uhrzeit.

(8) Speichern eines Eintrags → Heute-Ansicht füllt sich, Kreis
    aktualisiert.

(9) Mahlzeit bearbeiten/löschen.

(10) Trinkmengen-Summierung.

(11) Vitalwerte-Formular mit Vorbefüllung und Überschreiben.

(12) Sync-Vorbereitung prüfen (alle Datensätze korrekt markiert).

(13) Polish, Test, Statusbericht + Testplan, Push.

Nach jedem größeren Meilenstein (Heute-Ansicht steht / Erfassen
funktioniert / Vitalwerte funktionieren) kurz an den Nutzer melden zum
Zwischentest.

---

## Rückfragen-Hinweise (Standard-Annahmen)

- **Bearbeiten eines Eintrags**: gleiche Maske wie Erfassen-Schritt-2,
  vorbefüllt. Standard-Annahme. Falls unklar: fragen.

- **Trinken in der Mahlzeiten-Liste**: kann als eigene Gruppe unten oder
  integriert gezeigt werden. Standard-Annahme: eigene Gruppe "Trinken"
  am Ende der Mahlzeiten-Liste, zusätzlich zur Balken-Anzeige oben.

- **Kalorien-Kreis bei 0 kcal** (noch nichts erfasst): leerer grauer
  Ring, Mitte zeigt "0". Standard-Annahme.

- **Eigengericht-kcal**: nutzt das in Phase B2 eingeführte gecachte Feld
  kcal_pro_100g_berechnet. Falls dieses Feld fehlt: zur Sicherheit
  on-the-fly berechnen.

---

## Nach Fertigstellung

(1) Push aller Dateien zum main-Branch.

(2) Statusbericht in `Status/YYYYMMDD_HH-MM_Status_PhaseC.md`.

(3) Testplan in `Status/YYYYMMDD_HH-MM_Testplan_PhaseC.md`.

(4) README aktualisieren (Versionsnummer auf 0.2, Phase C).

(5) Kurze Nachricht an den Nutzer mit Test-Hinweis.

(6) Auf Rückmeldung warten. Bei grünem Test: Phase F vorbereiten
    (Dropbox-Sync schreibend).
