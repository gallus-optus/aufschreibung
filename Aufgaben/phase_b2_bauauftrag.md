# Bauauftrag Phase B2 — PWA-Grundgerüst

**Auftraggeber:** Projektleiter (Chat-Claude)
**Empfänger:** Coder (Claude Code)
**Datum:** 29.06.2026
**Vorgänger:** Phase A (Stammdaten-Migration) abgeschlossen
**Vorbereitung:** GitHub-Repo, Dropbox-App, Mockup-Freigabe — alles erledigt

---

## Ziel dieser Phase

Eine lauffähige PWA, die der Nutzer auf seinem Android-Handy
installieren kann und folgendes leistet:

(1) Anmeldung am Dropbox-Konto (OAuth 2.0 + PKCE)
(2) Auffinden, Herunterladen und lokales Indexieren der fünf
    Phase-A-Dateien aus dem App-Folder
(3) Anzeigen der Lebensmittel-Liste mit Suche und Filter
(4) Anzeigen der Eigengericht-Liste mit Suche und Filter
(5) Detail-Ansicht für Lebensmittel
(6) Detail-Ansicht für Eigengerichte mit berechneten Nährwerten
    und Zutaten-Liste
(7) Einstellungs-Seite mit Konto-Info, Sync-Status, Datenbank-Statistik,
    Logout-Funktion

**Diese Phase enthält noch KEINE:** Mahlzeit-Erfassung, Vitalwerte-
Erfassung, Rechner-Tools, Diagramme, Schreiben zurück nach Dropbox.

---

## Lieferumfang

Folgende Dateien werden im Repo erwartet:

**Im Repo-Root:**
- `index.html` — HTML-Grundgerüst, lädt CSS und JS
- `style.css` — sämtliche Styles
- `app.js` — Hauptlogik (Routing, Auth, Datenbank, Views)
- `manifest.json` — PWA-Manifest für "Zum Startbildschirm hinzufügen"
- `service-worker.js` — Offline-Cache der statischen Dateien
- `icon-192.png` — App-Icon 192×192 (einfaches Notiz-Symbol auf blauem
  Hintergrund, oder eine andere passende Grafik — keine fremden IPs)
- `icon-512.png` — App-Icon 512×512 (gleiche Optik, größer)
- `README.md` — kurzer Hinweis was das Projekt ist und wie es läuft

**Im Verzeichnis `Status/`:**
- `YYYYMMDD_HH-MM_Status_PhaseB2.md` — Statusbericht
- `YYYYMMDD_HH-MM_Testplan_PhaseB2.md` — Testplan für den Nutzer

---

## Funktionale Spezifikation pro Bildschirm

### Bildschirm 1 — Anmeldung

**Anzeige:**
- App-Logo zentriert (kleines Notiz-Icon im hellblauen Quadrat)
- App-Name "Aufschreibung" als Titel
- Untertitel "Ernährung und Vitalwerte"
- Großer Knopf "Mit Dropbox verbinden" mit Dropbox-Brand-Blau `#0061FF`
- Hinweistext: "Die App liest und schreibt nur in einem eigenen Ordner
  Apps/Aufschreibung-PWA/. Andere Dateien werden nicht berührt."

**Verhalten:**
- Knopf-Klick startet OAuth-PKCE-Flow zu Dropbox
- Nach erfolgreichem Login: Access Token in IndexedDB speichern, weiter
  zu Bildschirm 2 (oder direkt zu 3 wenn Dateien schon da)

**Sichtbarkeit:** Nur wenn kein Access Token in IndexedDB vorhanden ist.

### Bildschirm 2 — Erst-Import

**Anzeige:**
- Header "Einrichtung"
- Status-Box "Verbunden als gallus.optus@gmail.com" (echter Wert aus
  Dropbox-Account-API)
- Warn-Box: "Dein App-Ordner ist noch leer. Bitte lade einmalig diese
  fünf Dateien in Deine Dropbox hoch."
- Anzeige des Dropbox-Pfads `Apps/Aufschreibung-PWA/` in Mono-Schrift
- Liste der fünf erwarteten Dateien, jede mit grünem Häkchen (gefunden)
  oder rotem Kreuz (fehlt)
- Knopf "Erneut prüfen"

**Verhalten:**
- Beim Anzeigen einmal Dropbox-API abfragen, ob die fünf Dateien
  existieren
- Knopf-Klick: erneute Abfrage
- Wenn alle fünf gefunden: herunterladen, in IndexedDB parsen,
  automatisch weiter zu Bildschirm 3

**Sichtbarkeit:** Wenn Login da ist, aber IndexedDB noch leer.

### Bildschirm 3 — Lebensmittel-Liste

**Anzeige (von oben nach unten):**
- Header "Lebensmittel" mit Optionen-Icon rechts (Funktion: erstmal nur
  Platzhalter, kein Menü)
- Suchfeld mit Lupen-Icon
- Filter-Chip-Reihe horizontal scrollbar: "Alle (N)", dann die 10
  Lebensmittel-Gruppen aus der Konfiguration, sortiert nach Anzahl
- Gruppen-Header "Gruppenname · Anzahl" (sticky beim Scrollen wäre
  schön, ist aber nicht Pflicht)
- Listeneinträge: Name links, kcal/100g rechts
- Untere Tab-Bar mit drei Tabs: Lebensmittel (aktiv), Gerichte,
  Einstellungen

**Verhalten:**
- Live-Suche: bei jedem Tippen wird gefiltert (auf Substring im Namen
  und Bemerkung)
- Chip-Filter: bei Tippen auf Gruppe wird nur diese gezeigt
- Antippen eines Eintrags öffnet Bildschirm 4 (Detail)
- Tab-Bar-Wechsel ohne Reload

### Bildschirm 4 — Detail Lebensmittel

**Anzeige:**
- Header mit Zurück-Pfeil und Lebensmittel-Name
- Hero-Bereich (farbiger Hintergrund) mit:
  - kcal-Wert sehr groß
  - "kcal pro 100 g" als Untertitel
  - Gruppe als Pille
- Sektion "Makronährwerte (pro 100 g)":
  - Eiweiß, Kohlenhydrate (mit "davon Zucker" eingerückt), Fett (mit
    "davon gesättigt" und "davon ungesättigt" eingerückt)
- Sektion "Weitere Werte":
  - Salz, Ballaststoffe (und Restmasse/Alkohol wenn > 0)
- Sektion "Kennung":
  - LM-ID in Mono-Schrift, klein, dezent
- Bemerkungsfeld falls vorhanden

**Verhalten:**
- Zurück-Pfeil bringt zur Liste, Scrollposition merken wäre schön

### Bildschirm 5 — Eigengericht-Liste

**Anzeige (analog zu Bildschirm 3):**
- Header "Gerichte"
- Suchfeld
- Filter-Chip-Reihe: "Alle (N)" plus die 6 Standardkategorien
- Gruppen-Header pro Kategorie
- Listeneinträge: Name links, EG-ID rechts (NICHT kcal — siehe
  Designentscheidung Punkt 7 in CLAUDE.md)
- Untere Tab-Bar, Tab "Gerichte" aktiv

### Bildschirm 6 — Detail Eigengericht

**Anzeige:**
- Header mit Zurück-Pfeil und Gerichts-Name
- Hero-Bereich:
  - kcal-Wert (berechnet aus Zutaten!) groß
  - "kcal pro 100 g (berechnet)" als Untertitel
  - Kategorie als Pille
- Sektion "Berechnete Nährwerte (pro 100 g)":
  - Eiweiß, Kohlenhydrate, Fett, Salz
- Sektion "Endgewicht der Portion":
  - Gesamt-Endgewicht in g
- Sektion "Zutaten (N)":
  - Pro Zutat: LM-ID klein dezent, dann Lebensmittel-Name, dann Menge
  - Antippen einer Zutat → Sprung zur Detail-Ansicht des Lebensmittels

**Berechnungslogik:**

```
fuer jede Zutat:
  hole Lebensmittel via lebensmittel_id
  zutat_kcal = (zutat_menge_g / 100) * lebensmittel.kcal_pro_100g
  analog fuer eiweiss, kh, fett, salz
gesamt_kcal = Summe ueber alle Zutaten
gesamt_eiweiss = Summe ueber alle Zutaten
... usw.

pro_100g_kcal = (gesamt_kcal / gericht_endgewicht_g) * 100
pro_100g_eiweiss = analog
... usw.

Runden: kcal ganzzahlig, Naehrwerte auf 1 Nachkommastelle, Salz auf 2
```

Wenn eine Zutat auf `lebensmittel_id = UNBEKANNT` zeigt: Berechnung
weitermachen, aber rote Warnung im Detail-Bildschirm "X Zutaten konnten
nicht verknüpft werden, Nährwerte sind unvollständig."

### Bildschirm 7 — Einstellungen

**Anzeige in Abschnitten:**

Abschnitt "Konto":
- "Verbunden als: <E-Mail-Adresse aus Dropbox-API>"
- "Speicher in Dropbox: <belegt> / 2 GB" (Anzeige in MB)
- Aktion "Von Dropbox abmelden" (in rot, lädt Bildschirm 1)

Abschnitt "Synchronisierung":
- "Status: online/offline" (basiert auf navigator.onLine)
- "Zuletzt synchronisiert: vor X Min" (gespeicherter Zeitstempel)
- Aktion "Jetzt synchronisieren" (lädt alle fünf Dateien neu)

Abschnitt "Lokale Datenbank":
- "Lebensmittel: 597" (echter Wert aus IndexedDB)
- "Eigengerichte: 221" (echter Wert)
- Aktion "Datenbank neu aufbauen" (löscht IndexedDB, lädt frisch aus
  Dropbox)

Abschnitt "Über":
- "Version: 0.1 (Phase B)"
- Link zum GitHub-Repo

**Sichtbarkeit:** Untere Tab-Bar, dritter Tab aktiv.

---

## Technische Spezifikation

### Routing

Eigenes Mini-Routing per JavaScript. URL-Hash-basiert
(`#/lebensmittel`, `#/gericht/EG_013`, etc.) oder einfach
JavaScript-State — entscheidet der Coder. Wichtig: Browser-Zurück-Knopf
soll funktionieren.

### IndexedDB-Struktur

Vorgeschlagene Object Stores:

- `meta` — App-Konfiguration und Sync-Status (Single-Object-Store mit
  Schlüssel "config")
- `auth` — Dropbox-Tokens (Schlüssel "tokens")
- `lebensmittel` — Lebensmittel-Stammdaten (Schlüssel: lebensmittel_id)
- `eigengerichte` — Eigengericht-Headers (Schlüssel: gericht_id)
- `zutaten` — Eigengericht-Zutaten (Composite-Schlüssel:
  gericht_id + zutat_nr; oder mit Auto-Increment-ID)
- `konfiguration` — Inhalt der 05_Konfiguration.json (Single-Object-Store)
- `erfassung` — leer in Phase B2 (Schema schon anlegen)
- `vitaldaten` — leer in Phase B2 (Schema schon anlegen)

### Dropbox-API-Aufrufe (in Phase B2 benötigt)

- `users/get_current_account` — für Anzeige des angemeldeten Kontos
- `users/get_space_usage` — für Speicher-Anzeige in Einstellungen
- `files/list_folder` mit `path: ""` — für App-Folder-Inhalt prüfen
- `files/download` mit `path: "/01_Stammdaten_Lebensmittel.csv"` etc. —
  zum Herunterladen

OAuth-PKCE-Flow: `https://www.dropbox.com/oauth2/authorize` mit
`response_type=code`, `code_challenge_method=S256`, `code_challenge`,
dann nach Redirect Token-Exchange via `https://api.dropbox.com/oauth2/token`.
Dropbox SDK kann das abnehmen, ist aber auch ohne SDK machbar.

### Service Worker

- Cached: `index.html`, `style.css`, `app.js`, `manifest.json`, beide
  Icons
- Strategie: Cache-First für die statischen Dateien
- NICHT cached: Dropbox-API-Aufrufe (`api.dropboxapi.com`,
  `content.dropboxapi.com`)
- Cache-Name mit Versionierung (z. B. `aufschreibung-v0.1`), damit
  spätere Updates funktionieren

### Manifest

```json
{
  "name": "Aufschreibung",
  "short_name": "Aufschreibung",
  "description": "Ernährungs- und Vitalwert-Tracker",
  "start_url": "/aufschreibung/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#0061FF",
  "orientation": "portrait",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## Akzeptanzkriterien (Definition of Done)

(1) Nutzer öffnet `https://gallus-optus.github.io/aufschreibung/` auf
    Android-Chrome → sieht den Anmelde-Bildschirm.

(2) "Zum Startbildschirm hinzufügen" funktioniert, App startet aus dem
    Icon im Vollbild ohne Browser-Leiste.

(3) "Mit Dropbox verbinden" → Dropbox-Login-Seite → Berechtigung
    bestätigen → zurück in die App.

(4) Wenn der App-Ordner leer ist: Bildschirm 2 erscheint korrekt mit
    fünf roten Kreuzen.

(5) Nach Hochladen der fünf Dateien (Nutzer macht das manuell in
    Dropbox): Klick auf "Erneut prüfen" → fünf grüne Häkchen → automatisch
    weiter zur Lebensmittel-Liste.

(6) Lebensmittel-Liste zeigt 597 Einträge gruppiert nach Gruppen.

(7) Suche "brot" zeigt alle Brot-Produkte.

(8) Tippen auf "Brötchen Panini 80g" zeigt Detail mit allen Nährwerten.

(9) Wechsel zu Tab "Gerichte" zeigt 221 Eigengerichte gruppiert nach
    Kategorie.

(10) Tippen auf "Quetschkartoffeln 01" zeigt Detail mit aus Zutaten
     berechneten Nährwerten und der Zutaten-Liste.

(11) Antippen einer Zutat im Gerichte-Detail springt zur Detail-Ansicht
     dieses Lebensmittels.

(12) Einstellungen-Tab zeigt korrekte Werte für Konto-E-Mail, Anzahl
     Lebensmittel (597) und Eigengerichte (221).

(13) "Datenbank neu aufbauen" funktioniert ohne Fehler.

(14) "Von Dropbox abmelden" bringt zurück zum Anmelde-Bildschirm.

(15) App funktioniert offline (nach erstem Sync): Schließen, Internet
     aus, App neu öffnen → Lebensmittel- und Gerichte-Liste sind weiter
     da. Nur "Jetzt synchronisieren" zeigt Offline-Status.

(16) Lighthouse-PWA-Audit zeigt mindestens 90 Punkte.

(17) Im Code keine `console.log` mit sensiblen Daten, keine hardcoded
     E-Mails, keine englischen Kommentare.

---

## Empfohlene Reihenfolge des Bauens

Iterativ, jeder Schritt einzeln committen und lokal testen:

(1) Statisches Grundgerüst: index.html + style.css mit Bildschirm 1
    (Anmeldung) — ohne Logik, nur Optik.

(2) Manifest + Service Worker + Icons → "Zum Startbildschirm
    hinzufügen" testen.

(3) IndexedDB-Helpers (open, get, set, delete).

(4) Dropbox-OAuth-PKCE-Flow — Anmeldung und Token-Speicherung.

(5) Bildschirm 2 (Erst-Import): Dropbox-Datei-Liste prüfen, Status
    anzeigen.

(6) Datei-Download und CSV-Parser, Befüllung von IndexedDB.

(7) Bildschirm 3 (Lebensmittel-Liste) mit Routing + Tab-Bar.

(8) Suche und Chip-Filter in der Liste.

(9) Bildschirm 4 (Detail Lebensmittel).

(10) Bildschirm 5 (Gerichte-Liste) — viel Code von 3 wiederverwenden.

(11) Bildschirm 6 (Detail Gericht) mit Berechnungs-Logik.

(12) Bildschirm 7 (Einstellungen).

(13) Polish, Bug-Fixing, Lighthouse-Audit.

(14) Statusbericht und Testplan in `Status/` schreiben, README
     aktualisieren, alles pushen.

---

## Rückfragen an den Nutzer (über Chat-Claude weiterleiten)

Falls beim Bauen unklar wird:

- Soll der Anmelde-Bildschirm 1 nach erfolgreichem Login zu Bildschirm 2
  springen ("immer Erst-Import-Check") oder nur zu 2 wenn IndexedDB
  leer ist? **Standard-Annahme: nur wenn IndexedDB leer.** Wenn Nutzer
  das anders will, hier nachfragen.

- Soll der Logout-Knopf nur Token löschen oder auch IndexedDB? **Standard-
  Annahme: nur Token. IndexedDB bleibt, damit Re-Login schneller ist.**

- Soll "Datenbank neu aufbauen" eine Bestätigungs-Abfrage haben?
  **Standard-Annahme: ja, einfaches `confirm()` reicht.**

---

## Nach Fertigstellung

(1) Push aller Dateien zum `main`-Branch von `gallus-optus/aufschreibung`.

(2) Statusbericht in `Status/` als Markdown — siehe CLAUDE.md für
    das genaue Format.

(3) Testplan in `Status/` als Markdown — siehe CLAUDE.md für das
    genaue Format.

(4) Eine kurze Nachricht an den Nutzer in dieser Form:
    "Phase B2 fertig. Öffne https://gallus-optus.github.io/aufschreibung/
    auf dem Handy. Stell sicher, dass die fünf Dateien in Deinem
    Dropbox-App-Ordner liegen. Tester-Schritte siehe
    Status/<datum>_Testplan_PhaseB2.md."

(5) Auf Nutzer-Rückmeldung warten. Bugs fixen wenn nötig, oder Phase C
    starten wenn alles funktioniert.
