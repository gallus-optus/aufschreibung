# Bauauftrag Phase D — Werkzeuge (fünf Rechner)

**Auftraggeber:** Projektleiter (Chat-Claude)
**Empfänger:** Coder (Claude Code)
**Datum:** 01.07.2026
**Vorgänger:** Phase F (Dropbox-Sync schreibend) abgeschlossen und getestet
**Nachfolger:** Phase E (Multi-Achsen-Diagramm)

---

## Ziel dieser Phase

Ein neuer Bereich "Werkzeuge", erreichbar über den "Mehr"-Tab, mit fünf
Rechnern. Sie helfen beim Anlegen von Eigengerichten und Lebensmitteln
und bei der korrekten Mengen-Umrechnung für die Aufschreibung.

Die fünf Rechner:

(1) **Rezeptrechner** — Eigengericht-Editor mit Endgewicht-Korrektur.
    Anbindung: schreibt Eigengericht in die Datenbank.
(2) **Alkoholrechner** — kcal und Alkohol-Gramm pro 100 g.
    Anbindung: schreibt Lebensmittel in die Datenbank (optional).
(3) **Brühepulver-Rechner** — Nährwerte pro 100 g Trockenpulver.
    Anbindung: schreibt Lebensmittel in die Datenbank (optional).
(4) **Garfaktor: Quelle → Datenbank** — gegarte Quell-Werte auf roh
    umrechnen. Anbindung: schreibt Lebensmittel in die Datenbank.
(5) **Garfaktor: für die Aufschreibung** — gegartes Gewicht auf rohe
    Portion umrechnen. Reiner Rechner, keine DB-Anbindung.

---

## Abgrenzung — was Phase D NICHT macht

- Keine neuen Sync-Mechanismen (nutzt den Phase-F-Sync, der bei
  DB-Änderungen automatisch greift)
- Kein Diagramm (Phase E)
- Keine Excel-Auswertung (Phase G)

---

## Verortung in der App

Neuer Menüpunkt "Werkzeuge" im "Mehr"-Tab. Führt zu einer
Übersichtsseite mit den fünf Rechnern als Liste. Jeder Rechner ist ein
eigener Bildschirm. Der Bereich ist erweiterbar (später mehr Werkzeuge).

---

## Wichtige Grundregeln für alle Rechner

(1) **Deutsche Dezimalkommas** in Ein- und Ausgabe.

(2) **DB-Schreibvorgänge** setzen `geaendert_am` und `sync_status`, damit
    der Phase-F-Sync sie automatisch hochlädt. Die Rechner selbst syncen
    nicht — sie schreiben nur in IndexedDB, der bestehende Sync-Mechanismus
    kümmert sich um den Rest.

(3) **Neue Nährwerte** werden auf dieselbe Art gerundet wie im Rest der
    App: kcal ganzzahlig, Makros 1 Nachkommastelle, Salz 2 Nachkommastellen.

(4) **Konstanten** kommen aus der Konfiguration (mit Fallback):
    - kcal pro g: Eiweiß 4,1 / KH 4,1 / Fett 9,3 / Alkohol 7,1
    - Alkohol-Dichte: 0,8 g/ml
    - Garfaktor-Default: 0,77

---

## Rechner 1 — Rezeptrechner (Eigengericht-Editor mit Endgewicht)

### Zweck
Ein Eigengericht aus Zutaten zusammenstellen, das Endgewicht nach dem
Kochen berücksichtigen, und als neues Eigengericht in die Datenbank
speichern. Auch: bestehendes Eigengericht laden, ändern, unter neuem
Namen speichern.

### Bildschirm-Aufbau
- Zutaten-Liste: pro Zutat Name + Menge (g) + Entfernen-Knopf
- "Zutat hinzufügen" — öffnet die Lebensmittel-Suche (wie beim Erfassen),
  Lebensmittel wählen, Menge in Gramm eingeben
- Anzeige "Rohmasse (Summe Zutaten)" — automatisch berechnet, nicht
  editierbar
- Eingabefeld "Endgewicht nach dem Kochen" — Default = Rohmasse,
  überschreibbar mit dem gewogenen Wert
- Ergebnis-Box: berechnete Nährwerte pro 100 g (bezogen auf Endgewicht)
- Feld "Als Eigengericht speichern unter" (Name)
- Knopf "In Datenbank speichern"
- Knopf "Bestehendes Rezept laden"

### Berechnungslogik
```
rohmasse = Summe aller zutat_menge_g
fuer jeden Naehrwert (kcal, eiweiss, kh, zucker, fett, gesaettigt,
                      ungesaettigt, salz, ballaststoffe, alkohol):
    gesamt_wert = Summe ueber Zutaten von
                  (zutat_menge_g / 100) * lebensmittel.wert_pro_100g

endgewicht = eingegeben (Default rohmasse)

pro_100g_wert = (gesamt_wert / endgewicht) * 100
```

Beispiel: Rohmasse 1140 g, Zutaten summieren zu 1618 kcal. Endgewicht
990 g (Wasser verkocht). → (1618 / 990) * 100 = 163 kcal/100g. Werte
steigen, weil Endgewicht < Rohmasse.

### DB-Schreibvorgang
Beim Speichern ein neues Eigengericht anlegen:
- neue `gericht_id` generieren (z. B. EG_ + fortlaufend/Zeitstempel)
- `gericht_name` = eingegebener Name
- `gericht_kategorie` = wählbar (Default "Sonstiges" oder aus Auswahl)
- `gericht_endgewicht_g` = eingegebenes Endgewicht
- Zutaten als denormalisierte Zeilen (zutat_nr, zutat_lebensmittel_id,
  zutat_lebensmittel_name_original, zutat_menge_g)
- `kcal_pro_100g_berechnet` = der berechnete Wert (gecacht, wie in B2)
- `gramm_pro_*`-Felder leer (können später über die Einheiten-Logik
  gefüllt werden)
- `geaendert_am`, `sync_status = "neu"`

### Laden eines bestehenden Rezepts
- "Bestehendes Rezept laden" öffnet die Eigengericht-Auswahl
- Gewähltes Gericht: Zutaten und Endgewicht in den Editor laden
- Nutzer ändert (z. B. Zutat ergänzen)
- Beim Speichern: als NEUES Gericht mit neuem Namen und neuer ID
  (das Original bleibt unverändert). Default-Endgewicht nach Änderung =
  neue Rohmasse (Nutzer kann überschreiben).

### WICHTIGE REGEL — fehlende Zutat
Wenn ein Lebensmittel, das der Nutzer als Zutat braucht, noch nicht in
der Datenbank existiert: es kann NICHT direkt im Rezeptrechner angelegt
werden. Der Nutzer muss es erst als Lebensmittel in die Datenbank
eintragen (über die bestehende Datenbank-Funktion), dann steht es in der
Zutaten-Suche zur Verfügung. Im Rezeptrechner nur ein Hinweis, falls die
Suche nichts findet: "Nicht gefunden? Lege das Lebensmittel erst in der
Datenbank an."

---

## Rechner 2 — Alkoholrechner

### Zweck
Aus Menge und Alkoholgehalt die kcal und Alkohol-Gramm pro 100 g
berechnen, optional als Lebensmittel in die Datenbank übernehmen.

### Bildschirm-Aufbau
- Menge + Einheit (ml / Liter)
- Alkoholgehalt (Vol %)
- Zusätzliche kcal pro 100 g (Zucker o.ä.) — Default 0
- Ergebnis-Box: kcal pro 100 g, Alkohol-Gramm pro 100 g, Zwischenwerte
- Feld "In Datenbank speichern als" (Name)
- Knopf "In Datenbank speichern"

### Berechnungslogik
```
menge_ml = Menge (in ml; bei Liter *1000)
reiner_alkohol_g = menge_ml * (vol_prozent / 100) * 0,8    # 0,8 = Dichte
kcal_aus_alkohol = reiner_alkohol_g * 7,1
# auf 100 g beziehen (Annahme: 1 ml Getraenk ~ 1 g, wie bei Wasser)
alkohol_g_pro_100g = (reiner_alkohol_g / menge_ml) * 100
kcal_pro_100g = alkohol_g_pro_100g * 7,1 + zusatz_kcal_pro_100g
```

Beispiel: 40 ml, 40 Vol% → 40 * 0,4 * 0,8 = 12,8 g Alkohol → 91 kcal für
die 40 ml. Pro 100 g: 32 g Alkohol → 227 kcal/100g (ohne Zusatz).

### DB-Schreibvorgang
Neues Lebensmittel:
- neue `lebensmittel_id`
- `name` = eingegebener Name (z. B. "Whiskey Single Malt")
- `gruppe` = passende Gruppe (z. B. "Getränke" oder aus Auswahl)
- `kcal_pro_100g` = berechnet
- `alkohol_g` = alkohol_g_pro_100g (WICHTIG: für Alkohol-Auswertung)
- übrige Nährwerte 0 (oder aus Zusatz-Feld ableitbar, falls gewünscht —
  aber vorerst nur kcal und alkohol_g füllen)
- `geaendert_am`, `sync_status = "neu"`

---

## Rechner 3 — Brühepulver-Rechner

### Zweck
Von der Packungsangabe (Nährwert je zubereitete Menge) zurückrechnen auf
Nährwerte pro 100 g Trockenpulver.

### Bildschirm-Aufbau
- Zubereitbare Gesamtmenge Brühe (ml)
- Trockenmasse Pulver in der Packung (g)
- Nährwertangabe: kcal + je ... ml zubereitet
- Ergebnis-Box: kcal pro 100 g Trockenpulver, Zwischenwerte
- Feld "In Datenbank speichern als" (Name)
- Knopf "In Datenbank speichern"

### Berechnungslogik
```
portionen = gesamt_ml / bezugs_ml
gesamt_kcal = portionen * bezugs_kcal
kcal_pro_100g_pulver = (gesamt_kcal / trockenmasse_g) * 100
```

Beispiel: 16000 ml / 80 ml = 200 Portionen * 5 kcal = 1000 kcal Gesamt.
/ 380 g * 100 = 263 kcal/100g Trockenpulver.

### DB-Schreibvorgang
Neues Lebensmittel mit kcal_pro_100g = berechnet, Name eingegeben,
passende Gruppe, geaendert_am + sync_status.

Optional: Wenn die Packung weitere Nährwerte angibt (Eiweiß, Fett, Salz
je Bezugsmenge), koennten diese analog umgerechnet werden. Fuer die
erste Version reicht kcal; wenn einfach machbar, die weiteren Naehrwerte
mit gleicher Logik anbieten. Falls das den Bildschirm ueberladet: nur
kcal, Rest spaeter.

---

## Rechner 4 — Garfaktor: Quelle → Datenbank

### Zweck
Datenbank-Hilfsrechner. Eine Nährwert-Quelle gibt nur GEGARTE Werte an,
die Datenbank soll aber ROHE Werte führen. Rechnet gegart → roh um.

### Fachliche Grundlage
Beim Garen tritt Wasser aus, das Produkt wird leichter:
gegart = roh × Garfaktor (0,77). Die Nährstoffe bleiben, verteilen sich
aber auf weniger Masse → gegarte Werte pro 100 g sind HÖHER, rohe
NIEDRIGER.

Umrechnung der Pro-100g-Werte:
```
roh_pro_100g = gegart_pro_100g * garfaktor
```
(Werte sinken, weil im rohen Zustand mehr Wasser-Masse dabei ist.)

### Bildschirm-Aufbau
- Erklär-Hinweis oben
- Gegarte Nährwerte laut Quelle (pro 100 g): kcal, Eiweiß, Fett, Salz
  (evtl. weitere)
- Garfaktor (Default 0,77, überschreibbar)
- Ergebnis-Box: umgerechnete rohe Werte (pro 100 g)
- Feld "In Datenbank speichern als" (Name, z. B. "Rindersteak roh")
- Knopf "In Datenbank speichern"

### Berechnungslogik
```
fuer jeden eingegebenen Naehrwert:
    roh_wert = gegart_wert * garfaktor
```
Beispiel: 250 kcal gegart * 0,77 = 193 kcal roh.

### DB-Schreibvorgang
Neues Lebensmittel mit den rohen Werten, Name, Gruppe, geaendert_am +
sync_status.

---

## Rechner 5 — Garfaktor: für die Aufschreibung

### Zweck
Reiner Rechner, KEINE DB-Anbindung. Das Lebensmittel steht ROH in der
Datenbank, der Nutzer hat es aber GEGART gegessen und kennt das gegarte
Gewicht. Rechnet auf die rohe Menge um, zeigt die Nährwerte der Portion.

### Bildschirm-Aufbau
- Erklär-Hinweis oben
- Lebensmittel (roh) aus Datenbank wählen — zeigt dessen kcal/100g
- Gegartes Gewicht, das gegessen wurde (g)
- Garfaktor (Default 0,77, überschreibbar)
- Ergebnis-Box: rohe Menge, Nährwerte für die Portion
- Knopf "Werte anzeigen zum Übernehmen" (nur Anzeige, kein DB-Schreiben)

### Berechnungslogik
```
rohe_menge_g = gegartes_gewicht_g / garfaktor
fuer jeden Naehrwert:
    portion_wert = (rohe_menge_g / 100) * lebensmittel.wert_pro_100g
```
Beispiel: 150 g gegart / 0,77 = 195 g roh. Bei 193 kcal/100g roh →
(195/100) * 193 = 376 kcal für die Portion.

### Keine DB-Anbindung
Der Rechner zeigt die Werte nur an. Die Erfassung macht der Nutzer
normal über die Aufschreibung (mit der errechneten rohen Menge und dem
rohen Lebensmittel). Optional: ein Hinweistext "Trage in der
Aufschreibung <rohe_menge> g <Lebensmittel> ein."

---

## Akzeptanzkriterien (Definition of Done)

(1) "Werkzeuge" ist über den Mehr-Tab erreichbar und listet fünf Rechner.

(2) Rezeptrechner: Zutaten aus DB hinzufügen, Rohmasse wird summiert,
    Endgewicht Default = Rohmasse, überschreibbar.

(3) Rezeptrechner: Nährwerte pro 100 g werden korrekt auf das Endgewicht
    bezogen berechnet.

(4) Rezeptrechner: "In Datenbank speichern" legt ein neues Eigengericht
    an, das danach in der Gerichte-Liste erscheint.

(5) Rezeptrechner: "Bestehendes Rezept laden" lädt Zutaten + Endgewicht,
    Änderung + Speichern erzeugt ein NEUES Gericht (Original unverändert).

(6) Rezeptrechner: fehlt eine Zutat in der DB, weist ein Hinweis darauf
    hin, sie erst in der Datenbank anzulegen.

(7) Alkoholrechner: 40 ml / 40 Vol% ergibt 12,8 g Alkohol, 227 kcal/100g.
    Speichern füllt kcal_pro_100g UND alkohol_g.

(8) Brühepulver: 16000 ml / 380 g / 5 kcal je 80 ml ergibt 263 kcal/100g.

(9) Garfaktor Quelle→DB: 250 kcal gegart × 0,77 = 193 kcal roh, speicherbar.

(10) Garfaktor Aufschreibung: 150 g gegart ÷ 0,77 = 195 g roh, Nährwerte
     der Portion korrekt, nur Anzeige (kein DB-Schreiben).

(11) Alle DB-Schreibvorgänge setzen geaendert_am + sync_status, sodass
     der Phase-F-Sync sie hochlädt.

(12) Deutsche Dezimalkommas überall.

(13) Alle bisherigen Funktionen (B2, C, F) laufen unverändert.

(14) Code: deutsche Variablen/Kommentare, Vanilla JS, kein Framework,
     keine neuen externen Bibliotheken.

---

## Empfohlene Reihenfolge des Bauens

(1) "Werkzeuge"-Übersicht im Mehr-Tab + Routing zu fünf leeren
    Rechner-Bildschirmen.

(2) Gemeinsame Bausteine: Nährwert-Summierung, Rundung, DB-Schreib-Helfer
    für neues Lebensmittel / neues Eigengericht (mit sync-Feldern).

(3) Rechner 2 (Alkohol) — einfachster, gut zum Etablieren des
    DB-Schreib-Musters.

(4) Rechner 3 (Brühepulver) — ähnlich einfach.

(5) Rechner 4 (Garfaktor → DB) — einfache Multiplikation.

(6) Rechner 5 (Garfaktor → Aufschreibung) — mit DB-Lesen (Lebensmittel
    wählen), reine Anzeige.

(7) Rechner 1 (Rezeptrechner) — der aufwendigste, mit Zutaten-Suche,
    Laden bestehender Gerichte, Endgewicht-Logik, Eigengericht-Schreiben.

(8) Polish, Test, Statusbericht + Testplan, Push.

Meilenstein-Meldungen: nach Schritt 3 (erster Rechner speichert in DB),
nach Schritt 6 (vier einfache Rechner fertig), nach Schritt 7
(Rezeptrechner fertig).

---

## Rückfragen-Hinweise (Standard-Annahmen)

- **Gruppe/Kategorie bei DB-Schreibvorgängen**: ein Auswahl-Dropdown aus
  den bestehenden Gruppen/Kategorien der Konfiguration. Falls unklar:
  Default-Gruppe verwenden und fragen.

- **Rezeptrechner-Nährwerte**: voller Satz (kcal, Eiweiß, KH, Zucker,
  Fett, gesättigt, ungesättigt, Salz, Ballaststoffe, Alkohol) — analog
  zur Eigengericht-Berechnung aus B2.

- **Überschreiben statt neu**: Rechner legen immer NEUE Einträge an. Ein
  bestehendes Lebensmittel/Gericht zu überschreiben ist nicht Teil von
  Phase D (Standard-Annahme). Falls der Nutzer das braucht: später.

---

## Nach Fertigstellung

(1) Push zum main-Branch.
(2) Statusbericht `Status/YYYYMMDD_HH-MM_Status_PhaseD.md`.
(3) Testplan `Status/YYYYMMDD_HH-MM_Testplan_PhaseD.md`.
(4) README auf Version 0.4 (Phase D).
(5) Kurze Nachricht an den Nutzer.
(6) Bei grünem Test: Phase E vorbereiten (Multi-Achsen-Diagramm).
