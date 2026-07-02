# Bauauftrag G1 — Datums-Navigation und Editieren vergangener Tage

**Auftraggeber:** Projektleiter (Chat-Claude)
**Empfänger:** Coder (Claude Code)
**Datum:** 02.07.2026
**Vorgänger:** Phase E (Verlauf-Diagramm) abgeschlossen und getestet
**Nachfolger:** G2 (Datenbank-Verwaltung), G3 (Barcode-Scan)

---

## Einordnung

Dies ist der erste von drei Bauaufträgen (G1, G2, G3) aus dem Themenblock
"Editieren und Datenbank-Erweiterung". Die Excel-Auswertung (frühere
Phase G) wird zurückgestellt, nicht gestrichen.

- **G1 (dieser Auftrag):** vergangene Tage anschauen, bearbeiten,
  nachtragen — über eine Datums-Navigation in der bestehenden
  Heute-Ansicht.
- **G2 (später):** Lebensmittel-/Eigengericht-Datenbank bearbeiten und
  manuell neue Einträge anlegen.
- **G3 (später):** Barcode-Scan mit externer Datenquelle
  (Open Food Facts).

---

## Ziel dieser Phase (G1)

Die bestehende Heute-Ansicht wird um eine Datums-Navigation erweitert, mit
der man zu jedem beliebigen vergangenen Tag blättern kann. Auf jedem Tag
gilt: dieselbe Ansicht wie "Heute" (Kalorien-Kreis, Trinkmenge,
Mahlzeiten nach Typ, Vitalwerte), und alle Einträge sind bearbeitbar,
löschbar und nachtragbar.

Kein neuer Tab, kein neuer Sync-Mechanismus. G1 nutzt die bestehende
Erfassungs-, Vitalwert- und Sync-Logik und filtert sie nur auf ein frei
wählbares Datum.

---

## Grundprinzip: der zentrale Zustand `angezeigtesDatum`

Bisher zeigt die Heute-Ansicht fest den heutigen Tag (intern `new Date()`).
G1 führt einen zentralen Zustand ein:

- Eine Variable `angezeigtesDatum` (ISO-Datum, z. B. "2026-06-30") hält den
  gerade angezeigten Tag. Startwert = heute.
- ALLE Datenabfragen der Tagesansicht (Erfassungen, Vitalwerte,
  Kalorien-Summe, Trinkmenge) filtern auf `angezeigtesDatum` statt fest auf
  heute. Dafür wird der bestehende IndexedDB-Index `nach_datum` genutzt.
- Der zentrale "+"-Erfassen-Knopf übergibt `angezeigtesDatum` an die
  Erfassen-Maske (statt intern `new Date()` zu verwenden).

Das ist die eine strukturelle Änderung. Der Rest ist UI drumherum.

---

## Bildschirme (siehe Mockup g1_mockup.html)

### Bildschirm 1 — Heute (mit Datumszeile)
- Neue Datumszeile oben in der Heute-Ansicht: Zurück-Pfeil · antippbares
  Datum · Vorwärts-Pfeil.
- Am heutigen Tag: Überschrift "Heute", darunter klein das Datum
  ("Mi, 02.07.2026"). Der Vorwärts-Pfeil ist deaktiviert (keine Zukunft).
- Zurück-Pfeil blättert einen Tag zurück (`angezeigtesDatum` minus 1 Tag).
- Tippen aufs Datum öffnet den Kalender (Bildschirm 4).

### Bildschirm 2 — Vergangener Tag
- Nach dem Zurückblättern: Überschrift zeigt Wochentag + Datum
  ("Mo, 30.06.2026"), darunter eine Orientierungshilfe ("vor 2 Tagen").
- Beide Pfeile aktiv (vor/zurück).
- Ein "Zurück zu heute"-Knopf erscheint, sobald `angezeigtesDatum` != heute.
  Setzt `angezeigtesDatum` sofort auf heute.
- Alle Einträge des Tages sind bearbeitbar (Stift-Symbol) und löschbar,
  identisch zum bisherigen Verhalten. Kalorien-Kreis und Trinkmenge gelten
  für diesen Tag.

### Bildschirm 3 — Leerer Tag
- Ein Tag ohne Erfassungen und ohne Vitalwerte zeigt statt einer leeren
  Ansicht einen Hinweis ("Für diesen Tag ist noch nichts erfasst.") plus
  zwei Nachtrag-Knöpfe:
  - "Mahlzeit für diesen Tag nachtragen" → öffnet die Erfassen-Maske mit
    `angezeigtesDatum` vorbelegt.
  - "Vitalwerte für diesen Tag nachtragen" → öffnet das Vitalwerte-Formular
    für diesen Tag.
- "Zurück zu heute"-Knopf ist auch hier vorhanden.

### Bildschirm 4 — Kalender
- Öffnet sich beim Tippen aufs Datum.
- Monatsweise blätterbar (Pfeile im Kalenderkopf).
- Jeder Tag mit erfassten Daten (Erfassungen ODER Vitalwerte) trägt einen
  Punkt-Marker. Tage ohne Daten haben keinen Marker (= Lücke sichtbar).
- Der aktuell gewählte Tag ist hervorgehoben; der heutige Tag hat eine
  dezente Umrandung.
- Antippen eines Tages setzt `angezeigtesDatum` auf diesen Tag, schließt den
  Kalender und zeigt die Tagesansicht.
- Zukünftige Tage sind nicht wählbar (ausgegraut oder ohne Funktion).

### Bildschirm 5 — Nachtrag erfassen
- Wird die Erfassen-Maske von einem vergangenen Tag aus geöffnet (per "+"
  oder per Nachtrag-Knopf), ist das Datum auf `angezeigtesDatum` gesetzt und
  wird dem Nutzer angezeigt ("Nachtrag · Do, 26.06.").
- Die Uhrzeit ist mit der AKTUELLEN Uhrzeit vorbelegt (`new Date()`), aber
  editierbar.
- Sonst identisch zum bestehenden Erfassen-Ablauf (Live-Suche, Menge +
  Einheit, Einheiten-Logik, Mahlzeit-Typ).

---

## Verhaltensregeln (präzise)

### Erfassungen
- Anzeige: alle Erfassungen mit `datum == angezeigtesDatum`, gruppiert nach
  Mahlzeit-Typ, wie in der bisherigen Heute-Ansicht.
- Bearbeiten/Löschen: unverändert zum bestehenden Mechanismus. Beim
  Bearbeiten wird die Original-Eingabe über `menge_eingabe` und
  `einheit_eingabe` rekonstruiert.
- Nachtrag: neue Erfassung mit `datum = angezeigtesDatum`, `zeit` =
  aktuelle Uhrzeit (editierbar).

### Vitalwerte
- Regel unverändert: ein Eintrag pro Tag, überschreibend.
- Anzeige/Bearbeiten: der Vitalwert-Datensatz mit `datum == angezeigtesDatum`.
  Existiert keiner, ist das Formular leer (Nachtrag möglich).
- Beim Speichern eines vergangenen Tages wird ein vorhandener Datensatz
  dieses Tages überschrieben (kein zweiter Datensatz für denselben Tag).

### Sync (unverändert)
- Jeder geänderte oder neue Datensatz bekommt `geaendert_am` (aktueller
  Zeitstempel des Bearbeitens) und `sync_status = "neu"` bzw. "geaendert".
- Der bestehende Phase-F-Sync (60-s-Debounce nach Änderung, App-Start,
  manueller Knopf) lädt die Datensätze hoch. KEIN neuer Sync-Mechanismus.
- Wichtig: `geaendert_am` ist der Zeitpunkt der BEARBEITUNG, nicht das
  angezeigte Datum. So greift die Konflikt-Regel "neuerer gewinnt" korrekt,
  auch wenn ein alter Tag nachträglich bearbeitet wird.

---

## Datums-Logik und Anzeige

### Wochentag + Datum
- Anzeigeformat: "Mo, 30.06.2026" (Wochentag abgekürzt, Datum in
  deutschem Format TT.MM.JJJJ).
- Am heutigen Tag: "Heute" groß, Datum klein darunter.
- Orientierungshilfe unter dem Datum: "vor X Tagen" (bzw. "gestern" für
  gestern). Nur bei vergangenen Tagen.

### Kalender-Markierung
- Beim Öffnen des Kalenders wird die Menge aller Tage mit Daten ermittelt:
  eindeutige `datum`-Werte aus Erfassungen plus eindeutige `datum`-Werte aus
  Vitalwerten. Diese Tage bekommen den Punkt-Marker.
- Die Ermittlung nutzt den IndexedDB-Index `nach_datum` (effizient, keine
  Volltabellen-Scans nötig).
- EIN Marker-Typ genügt (Nutzer-Entscheidung: keine farbliche
  Unterscheidung zwischen "hat Mahlzeiten" und "hat Vitalwerte" in G1).

### Grenzen
- Kein Limit in die Vergangenheit — kompletter Datenbestand navigierbar.
- Zukunft ist gesperrt: Vorwärts-Pfeil am heutigen Tag deaktiviert,
  zukünftige Kalendertage nicht wählbar.

---

## Akzeptanzkriterien (Definition of Done)

(1) Die Heute-Ansicht hat eine Datumszeile mit Zurück-Pfeil, antippbarem
    Datum und Vorwärts-Pfeil.

(2) Am heutigen Tag steht "Heute", der Vorwärts-Pfeil ist deaktiviert.

(3) Zurück-Pfeil blättert tageweise zurück; die Ansicht zeigt die Daten des
    jeweiligen Tages (Kalorien, Trinkmenge, Mahlzeiten, Vitalwerte).

(4) An vergangenen Tagen erscheint "Zurück zu heute" und springt korrekt
    zum heutigen Tag.

(5) Wochentag + Datum + "vor X Tagen" werden korrekt angezeigt.

(6) Der Kalender öffnet sich beim Tippen aufs Datum, ist monatsweise
    blätterbar und markiert Tage mit Daten per Punkt.

(7) Antippen eines Kalendertages springt zu diesem Tag.

(8) Zukünftige Tage sind nicht wählbar.

(9) Erfassungen eines beliebigen Tages sind bearbeitbar und löschbar
    (Original-Eingabe wird rekonstruiert).

(10) Vitalwerte eines beliebigen Tages sind bearbeitbar; Speichern
     überschreibt den vorhandenen Tages-Datensatz.

(11) Leere Tage zeigen einen Hinweis plus zwei Nachtrag-Knöpfe.

(12) Der "+"-Erfassen-Knopf speichert für den angezeigten Tag (Datum
     vorbelegt), Uhrzeit = aktuelle Uhrzeit (editierbar).

(13) Nachträge und Änderungen bekommen `geaendert_am` (Bearbeitungszeit) und
     `sync_status`; der Phase-F-Sync lädt sie hoch.

(14) Alle bisherigen Funktionen (B2, C, F, D, E) laufen unverändert; die
     Verlauf-Aggregation und `06_Tagesaggregate.csv` erfassen nachgetragene
     Tage korrekt.

(15) Code: deutsche, sprechende Variablennamen; ausführliche Kommentare für
     Einsteiger; Vanilla JS, kein Framework, keine neuen externen
     Bibliotheken.

---

## Empfohlene Reihenfolge des Bauens

(1) Zustand `angezeigtesDatum` einführen; alle Datenabfragen der
    Heute-Ansicht von "heute" auf `angezeigtesDatum` umstellen. Isoliert
    testen: bei `angezeigtesDatum` = heute muss sich die App exakt wie
    bisher verhalten.

(2) Datumszeile bauen (Pfeile, Datum, "Heute"/Datum-Umschaltung,
    Vorwärts-Sperre, "vor X Tagen").

(3) "Zurück zu heute"-Knopf.

(4) Kalender-Popup (Monatsansicht, Blättern, Auswahl, Zukunft sperren).

(5) Kalender-Markierung: Tage mit Daten ermitteln (Index `nach_datum`) und
    Punkte setzen.

(6) Leerer-Tag-Zustand mit den zwei Nachtrag-Knöpfen.

(7) "+"-Erfassen und Nachtrag-Knöpfe an `angezeigtesDatum` koppeln; Uhrzeit
    mit aktueller Zeit vorbelegen.

(8) Vitalwerte-Formular an `angezeigtesDatum` koppeln (überschreibend).

(9) Bearbeiten/Löschen an vergangenen Tagen prüfen (Mechanismus ist
    vorhanden, nur der Datumsbezug ändert sich).

(10) Regressionstest B2/C/F/D/E; Verlauf-Aggregation mit nachgetragenen
     Tagen prüfen.

(11) Polish, Statusbericht + Testplan, Push.

Meilenstein-Meldungen: nach Schritt 1 (Datumsfilter greift, App sonst
unverändert), nach Schritt 5 (Kalender mit Markierung läuft), nach
Schritt 9 (Nachtragen/Bearbeiten vergangener Tage komplett).

---

## Rückfragen-Hinweise (Standard-Annahmen)

- **Ein Marker-Typ im Kalender** (kein Farbunterschied Mahlzeit/Vitalwert) —
  Nutzer-Entscheidung.

- **Uhrzeit beim Nachtrag = aktuelle Uhrzeit**, editierbar — Nutzer-
  Entscheidung. Keine mahlzeit-typ-abhängige Vorbelegung.

- **App-Version:** geht auf 0.6 (G1). Cache-Version `aufschreibung-v0.6`.
  IndexedDB-Schema unverändert (kein Migrationsbedarf, `angezeigtesDatum` ist
  reiner Laufzeit-Zustand, keine Persistenz nötig).

- **`angezeigtesDatum` wird nicht persistiert:** Beim App-Neustart steht die
  Ansicht wieder auf heute. (Falls der Nutzer später "letzten angezeigten Tag
  merken" wünscht, ist das eine kleine Erweiterung — für G1 nicht nötig.)

---

## Nach Fertigstellung

(1) Push zum main-Branch.
(2) Statusbericht `Status/JJJJMMDD_HH-MM_Status_G1.md`.
(3) Testplan `Status/JJJJMMDD_HH-MM_Testplan_G1.md`.
(4) README auf Version 0.6 (G1).
(5) Kurze Nachricht an den Nutzer.
(6) Bei grünem Test: G2 vorbereiten (Datenbank-Verwaltung).
