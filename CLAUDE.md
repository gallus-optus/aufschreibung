# CLAUDE.md — Projekt-Konstitution Aufschreibung

Diese Datei wird vom Coder (Claude Code) bei jedem Session-Start gelesen.
Sie definiert dauerhaft geltende Regeln und Kontext für das Projekt.

---

## Projekt-Überblick

**Name:** Aufschreibung
**Typ:** Progressive Web App (PWA) für persönliche Ernährungs- und Vitalwert-Aufzeichnung
**Plattform:** Android (Handy + Tablett), Mobile-First
**Hosting:** GitHub Pages unter `https://gallus-optus.github.io/aufschreibung/`
**Repository:** `gallus-optus/aufschreibung` (privat)
**Datenspeicher:** Dropbox App-Folder (`Apps/Aufschreibung-PWA/`)
**Nutzer:** Solo-Projekt für den Repository-Eigentümer

Die App löst eine monolithische Excel-Mappe ab. Hauptziel: bequeme
mobile Datenerfassung statt am PC. Excel bleibt als Auswertungstool
auf dem PC erhalten (manueller CSV-Import).

---

## Rollenverteilung und Kommunikation

**Chat-Claude (im Browser/Web)** ist der Projektleiter. Er liefert
Spezifikationen, Mockups, Bauaufträge und Reviews. Bauaufträge kommen
als separate `.md`-Dateien im Repo unter `Aufgaben/`.

**Du (Claude Code)** bist der Coder. Du setzt Bauaufträge um, schreibst
Code, testest, dokumentierst, pushst zu GitHub. Du erfindest keine
Anforderungen — wenn ein Auftrag unklar ist, sammelst Du Rückfragen
und stellst sie an den Nutzer (nicht: arbeitest auf Vermutung weiter).

**Der Nutzer** ist Auftraggeber und Tester. Er gibt Freigaben und testet
auf seinem Android-Gerät.

---

## Sprache und Stil

**Code-Sprache (Variablennamen, Funktionsnamen):** Deutsch, sprechend.
Beispiel: `lebensmittelListeAnzeigen()`, `aktuellesEigengericht`,
`dropboxZugriffsToken`, NICHT `showFoodList()`, `currentDish`,
`dropboxAccessToken`.

**Kommentare:** Deutsch, ausführlich, für Laien verständlich
("Dummy-tauglich"). Nicht "// init store", sondern
"// Hier wird die lokale Datenbank IndexedDB einmalig vorbereitet,
//  damit wir Lebensmittel, Eigengerichte und Konfiguration offline
//  speichern koennen.".

**Benutzeroberfläche:** Deutsch. Keine englischen Begriffe wenn deutsche
existieren ("Anmelden" statt "Login", "Einstellungen" statt "Settings",
"Synchronisieren" statt "Sync").

**Dokumentation:** Deutsch. README, Anleitungen, Status-Dateien
ausschließlich deutsch.

**Commit-Messages:** Deutsch, knapp und sprechend
("Phase B2: Dropbox-Anmeldung und IndexedDB-Initialisierung",
NICHT "feat: add login").

---

## Datei- und Verzeichnis-Konventionen

```
/                              Repo-Root
├── CLAUDE.md                  diese Datei
├── README.md                  Projekt-README
├── index.html                 PWA-Einstieg
├── app.js                     Hauptlogik
├── style.css                  Styles
├── manifest.json              PWA-Manifest
├── service-worker.js          Offline-Cache
├── icon-192.png               App-Icon
├── icon-512.png               App-Icon
├── Aufgaben/                  Bauauftraege, Prompts, Eingangsdaten
├── Status/                    Statusberichte und Testplaene
├── Mockups/                   Mockup-Spezifikationen (Referenz)
└── Daten/                     CSV-Referenzdaten (live in Dropbox)
```

**Niemals in den Repo committen:**
- Dropbox-Access-Tokens, Refresh-Tokens
- Echte Nutzerdaten (Mahlzeiten, Vitalwerte)
- `.env`-Dateien mit Secrets
- `node_modules/`

---

## CSV-Konvention (zwingend)

Alle CSV-Dateien dieses Projekts nutzen deutsche Excel-Notation:

- **Trennzeichen:** Semikolon `;`
- **Dezimaltrennzeichen:** Komma `,`
- **Encoding:** UTF-8 mit BOM (`utf-8-sig`)
- **Zeilenenden:** Unix-Stil (`\n`)
- **Datum:** ISO 8601 (`YYYY-MM-DD`)
- **Uhrzeit:** `HH:MM` oder `HH:MM:SS`

Beim Lesen in JavaScript dafuer eine eigene CSV-Parser-Funktion nutzen
(simple Implementierung ausreichend, keine externe Bibliothek wenn
vermeidbar).

---

## Datenstruktur (Phase A bereits erledigt)

Im Dropbox-App-Ordner liegen fuenf Dateien:

### 01_Stammdaten_Lebensmittel.csv
597 Lebensmittel, IDs `LM_0001` bis `LM_0597`.
Spalten: `lebensmittel_id;name;bemerkung;gruppe;kcal_pro_100g;eiweiss_g;kohlenhydrate_g;zucker_g;fett_g;fett_gesaettigt_g;fett_ungesaettigt_g;salz_g;ballaststoffe_g;restmasse_g;alkohol_g`

### 02_Stammdaten_Eigengerichte.csv
221 Eigengerichte, denormalisiert (eine Zeile = eine Zutat). IDs
`EG_001` bis `EG_221`. 1.702 Zeilen insgesamt.
Spalten: `gericht_id;gericht_name;gericht_kategorie;gericht_original_kategorie;gericht_endgewicht_g;zutat_nr;zutat_lebensmittel_id;zutat_lebensmittel_name_original;zutat_menge_g`

### 03_Erfassung.csv
Tagesdaten der Mahlzeiten. Initial nur Header.
Spalten: `erfassungs_id;datum;zeit;mahlzeit_typ;menge_g;lebensmittel_id;lebensmittel_name;ist_eigengericht;eigengericht_id;gericht_kontext;bemerkung`

### 04_Vitaldaten.csv
Tagesdaten der Vitalwerte. Initial nur Header.
Spalten: `datum;gewicht_kg;bauchumfang_cm;armumfang_cm;blutdruck_systolisch;blutdruck_diastolisch;puls;k_faktor;bemerkung`

### 05_Konfiguration.json
Konstanten, Listen, Defaults. Wichtige Felder:

- `kalorien_konstanten`: kcal pro g (Eiweiss 4,1; KH 4,1; Fett 9,3; Alkohol 7,1)
- `alkohol_konstanten.dichte_g_pro_ml`: 0,8
- `bruehepulver_konstanten.garfaktor_default`: 0,77
- `mahlzeit_zeitregeln`: morgens_bis 10:30, mittags_bis 15:00, abends_ab 18:00
- `lebensmittel_gruppen`: Liste von 10 Gruppen (bearbeitbar in App)
- `gericht_kategorien`: Liste von 6 Standards (Hauptgericht, Suppe,
  Beilage, Soße & Dip, Dessert & Backwerk, Sonstiges)
- `mahlzeit_typen`: Morgens, Mittags, Abends, Zwischen, Naschen, Trinken

---

## Externe Dienste

### Dropbox
- App-Name in Dropbox-Console: `Aufschreibung-PWA`
- **App Key:** `iumuxlea7y2s3rt` (oeffentlich, hardcoded in JS okay)
- Modus: App-Folder-Access (App sieht nur eigenen Ordner)
- Berechtigungen: `files.content.read`, `files.content.write`,
  `files.metadata.read`, `account_info.read`
- Auth-Flow: OAuth 2.0 mit PKCE (kein App Secret!)
- Library: Dropbox SDK (`dropbox` Paket von cdnjs oder unpkg)

### GitHub Pages
- URL der Live-App: `https://gallus-optus.github.io/aufschreibung/`
- Diese URL ist die einzige gueltige Redirect-URI bei Dropbox
- Branch: `main`, Source: `/ (root)`

---

## Architektur-Entscheidungen (nicht verhandelbar ohne Ruecksprache)

(1) **Vanilla JavaScript.** Kein Framework. Kein Build-Prozess.
Die App muss direkt aus dem GitHub-Repo geladen werden koennen,
ohne Compile-Schritt. Begruendung: minimale Abhaengigkeiten,
maximale Verstaendlichkeit fuer den Nutzer.

(2) **IndexedDB als lokaler Speicher.** Nicht localStorage (zu klein,
synchron). Zugriff via Promise-basierte Hilfsfunktionen.

(3) **Service Worker fuer Offline-Faehigkeit.** Statische Dateien
werden gecached, Dropbox-Aufrufe nicht. Cache-First-Strategie fuer
die App selbst.

(4) **Single-Page-App-Architektur.** Eine einzige `index.html`, alle
Views werden in JavaScript ein- und ausgeblendet. Kein Routing-
Framework — eigene Mini-Router-Funktion.

(5) **Mobile-First.** Layout primaer fuer 360–420 px Breite, danach
hochskalierend. Touch-Bedienung im Vordergrund (44 px Mindestgroesse
fuer Tap-Flaechen).

(6) **Datenfluss:** Beim App-Start liest die App Stammdaten aus
IndexedDB. Wenn IndexedDB leer (Erststart) oder Refresh angefordert,
laedt die App die fuenf Dateien aus Dropbox neu. Schreibvorgaenge
zurueck nach Dropbox kommen erst in Phase F.

(7) **Vorsichtsmaßnahme: Keine externen Bibliotheken einbinden
ausser:** Dropbox SDK. Falls weitere noetig: vorher mit Projektleiter
abklaeren.

---

## Designsprache

Die App lehnt sich optisch an die Mockup-Spezifikation aus Phase B2 an.
Wichtige Tokens:

- **Hauptfarbe Akzent:** Dropbox-Blau `#0061FF` fuer Login-Knopf und
  primaere Aktionen. Sonst dezent.
- **Hintergrund:** Hell-grau bis weiss. Kein Schwarz, keine Verlaeufe.
- **Schrift:** System-Sans-Serif (`-apple-system, BlinkMacSystemFont,
  "Segoe UI", Roboto, sans-serif`).
- **Schriftgroessen:** Body 14–15 px, Titel 17–22 px, Mikrotext 11–12 px.
- **Abstaende:** 8 px Grid (8, 16, 24, 32 px).
- **Eckenradien:** 8 px (Karten), 22 px (Phone-Frame), 999 px (Pills).
- **Trenner:** `0.5px solid var(--border)` mit `--border: #E5E5E5`.

Dark Mode: nicht in Phase B2 Pflicht, aber CSS-Variablen so anlegen,
dass es spaeter mit `prefers-color-scheme` ergaenzbar ist.

---

## Workflow-Regeln (zwingend)

(1) **Vor jeder Bauphase:** Bauauftrag aus `Aufgaben/` lesen,
Rueckfragen klaeren, nicht auf Vermutungen losbauen.

(2) **Mockup-First-Prinzip:** Jeder Bauauftrag basiert auf einem
Mockup oder einer Spezifikation. Wenn etwas im Auftrag fehlt, ist
das eine Rueckfrage, kein "ich entscheide das mal selbst".

(3) **Iterativ in kleinen Schritten arbeiten:** Lieber ein kleines
Stueck fertig + testen + committen, als eine grosse Aenderung am
Stueck. Idealgroesse pro Commit: eine Funktion oder ein Screen.

(4) **Nach Abschluss eines Bauauftrags:** Schreib ZWEI Dokumente
in `Status/` — einen Statusbericht und einen Testplan (Format siehe
unten).

(5) **Push zu GitHub** erst nach erfolgreichem lokalen Test. Wenn
moeglich vor dem Push eine `npx serve .` oder `python3 -m http.server`-
Sitzung mit kurzem Funktionstest.

(6) **Bei Bugs nach Live-Schaltung:** nicht panisch fixen, sondern
erst dokumentieren, dann reproduzieren, dann beheben.

(7) **Modell- und Aufwandsvorschlag vor Taskbeginn:** Vor jeder
Aufgabe oder jedem Bauauftrag schlaegt der Coder ein geeignetes
Modell und einen Aufwand (Effort) vor, um den Tokenverbrauch zu
optimieren. Anschliessend wartet der Coder, bis der Nutzer das
Modell und den Aufwand eingestellt und "weiter" eingegeben hat —
erst dann wird mit der Arbeit begonnen.

---

## Konkrete Don'ts

- KEIN React, Vue, Svelte, Angular oder anderes Framework.
- KEIN TypeScript (Vanilla JS reicht und ist transparenter).
- KEIN Webpack/Vite/Rollup/Build-Schritt.
- KEINE Telemetrie, Analytics, Tracking, Werbung.
- KEINE Cookies (IndexedDB reicht).
- KEINE Fonts von Google/CDN (System-Fonts sind genug).
- KEIN jQuery, Bootstrap, Tailwind oder UI-Framework.
- KEINE harten Pfade auf `http://localhost` oder ahnliches im
  Produktiv-Code.
- KEINE Englische Sprache in Code-Kommentaren oder UI-Texten.

---

## Statusberichte und Testplaene des Coders

Pro abgeschlossener Bauphase liefert der Coder ZWEI Dokumente in `Status/`.

### Dokument 1: Statusbericht

Dateiname: `YYYYMMDD_HH-MM_Status_PhaseX.md` (MESZ-Zeitstempel).
Aufbau:

```
# Status PhaseX – was wurde gebaut

## Lieferumfang
- Liste der erstellten/geaenderten Dateien
- Wichtigste Funktionen

## Architektur-Entscheidungen waehrend des Bauens
- Falls Annahmen getroffen wurden, hier dokumentieren

## Bekannte Einschraenkungen
- Was noch nicht funktioniert
- Warum

## Offene Rueckfragen
- An den Projektleiter oder Nutzer
```

### Dokument 2: Testplan

Dateiname: `YYYYMMDD_HH-MM_Testplan_PhaseX.md` (gleicher Zeitstempel
wie Statusbericht).
Aufbau:

```
# Testplan PhaseX

## Voraussetzungen
- Was muss der Nutzer vorher tun (z. B. Dateien in Dropbox haben)

## Testfaelle
### Test 1: <Was wird getestet>
1. Schritt
2. Schritt
3. Erwartetes Ergebnis

### Test 2: ...
...

## Bekannte Probleme oder Warnungen
- Was darf NICHT testen oder ist noch nicht implementiert
```

---

## Bei Unklarheiten

Wenn Du als Coder einen Bauauftrag liest und etwas unklar ist:

(1) NICHT auf Vermutung losbauen.
(2) Stattdessen: in der Antwort an den Nutzer eine **Liste der
    Rueckfragen** zusammenstellen.
(3) Der Nutzer leitet die an Chat-Claude weiter, der klaert.
(4) Erst nach Klaerung mit dem Bauen anfangen.

Bei Unklarheiten zwischen dieser CLAUDE.md und einem Bauauftrag gilt:
**diese CLAUDE.md hat Vorrang, der Bauauftrag muss sich daran halten.**
Falls ein Bauauftrag dieser Datei widerspricht, ist das eine
Rueckfrage wert.
