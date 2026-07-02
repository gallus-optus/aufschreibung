# Aufschreibung

Progressive Web App zur persönlichen Ernährungs- und Vitalwert-Aufzeichnung.

**Live-App:** https://gallus-optus.github.io/aufschreibung/
**Version:** 0.5 (Phase E)

## Was die App kann

### Verlauf-Diagramm (Phase E)

- **Verlauf-Ansicht** (Mehr → Verlauf): bis zu 6 Werte gleichzeitig über
  die Zeit — Vitalwerte und Ernährungs-Tagessummen gemischt
- **Normalisierte Darstellung**: jede Kurve auf ihre eigene Spanne
  skaliert, so bleiben Trends vergleichbar; echte Werte per Antippen
- **Querformat**: Gerät drehen → Vollbild-Diagramm (plus manueller
  Vollbild-Knopf als Rückfallebene)
- Zeitraum-Schnellwahl (Woche/Monat/3 Monate/Alles) und freier
  Von-Bis-Bereich
- **06_Tagesaggregate.csv**: bei jedem Sync automatisch erzeugte
  Excel-Brücke mit den Tagessummen (Nährwerte, Trinkmenge, kcal pro
  Mahlzeit-Typ)

### Werkzeuge / Rechner (Phase D)

Ein Bereich „Werkzeuge" im Mehr-Tab mit fünf Rechnern:

- **Rezeptrechner** — Eigengericht aus Zutaten zusammenstellen, mit
  Endgewicht-Korrektur (Wasser verkocht/kommt hinzu), als neues Gericht
  speichern; bestehendes Rezept laden und abgewandelt neu speichern
- **Alkoholrechner** — Alkohol-Gramm automatisch (ml × Vol% × 0,8) plus
  voller Nährwert-Satz pro 100 g
- **Brühepulver-Rechner** — voller Nährwert-Satz pro 100 g Trockenpulver
- **Garfaktor: für die Aufschreibung** — gegartes Gewicht umrechnen
  (Lebensmittel roh oder gegart in der DB); Ergebnis direkt in die
  Aufschreibung übernehmen oder die Gegen-Form als Lebensmittel speichern

Neu angelegte Lebensmittel/Gerichte werden über den Dropbox-Sync
automatisch hochgeladen; im Rezeptrechner erstellte Gerichte erscheinen
auch auf anderen Geräten. Eigengerichte führen jetzt den vollen
Nährwert-Satz (inkl. Zucker, gesättigte/ungesättigte Fette, Ballaststoffe).

### Dropbox-Synchronisierung (Phase F)

- **Zwei-Wege-Sync** mit Dropbox: lokale Erfassungen, Vitaldaten und
  Einheiten-Werte werden hochgeladen, Änderungen anderer Geräte
  heruntergeladen und zusammengeführt
- **Zeilenweises Mergen** über IDs — kein Eintrag geht verloren; bei
  Konflikt gewinnt der neuere Stand
- **Rollierendes Backup** (5 Versionen je Datei im Ordner `_backups/`)
  vor jedem Überschreiben
- **Automatisch** beim App-Start und ~60 s nach einer Erfassung, plus
  manueller Knopf in „Mehr"
- Funktioniert offline (sammelt Änderungen) und erneuert abgelaufene
  Tokens selbstständig

### Tageseingabe (Phase C)

- **Heute-Ansicht** als Startbildschirm: Kalorien-Kreis (färbt sich
  grün/gelb/rot nach den Tageszielen), Trinkmengen-Balken und die
  heutigen Mahlzeiten nach Typ gruppiert
- **Mahlzeit erfassen** über Suche → Menge + Einheit → Speichern
- **Einheiten-Logik:** Gramm, Stück, Portion, Scheibe, Esslöffel,
  Teelöffel — pro Lebensmittel/Gericht wird das Gramm-Gewicht einer
  Einheit einmalig abgefragt und gespeichert
- **Einträge bearbeiten und löschen** (Original-Eingabe bleibt erhalten)
- **Vitalwerte-Formular:** ein Eintrag pro Tag (Gewicht, Umfänge,
  Blutdruck, Puls, k-Faktor)
- Alle Daten werden lokal gespeichert und für den späteren
  Dropbox-Upload (Phase F) vorgemerkt (`sync_status`)

### Stammdaten (Phase B2)

- Anmeldung am Dropbox-Konto (OAuth 2.0 mit PKCE, kein Passwort gespeichert)
- Herunterladen und lokales Indexieren der Stammdaten aus dem Dropbox-App-Ordner
- Lebensmittel-Liste mit Suche und Gruppen-Filter (597 Einträge)
- Eigengericht-Liste mit Suche und Kategorie-Filter (221 Gerichte)
- Detail-Ansicht für Lebensmittel mit allen Nährwerten
- Detail-Ansicht für Eigengerichte mit berechneten Nährwerten und Zutaten
- Einstellungen: Konto-Info, Sync-Status, Datenbank-Statistik
- Offline-Betrieb nach erstem Sync (Service Worker, Cache-First)

> **Hinweis:** Seit Phase F werden erfasste Daten automatisch mit
> Dropbox synchronisiert (mit rollierendem Backup). Excel bleibt das
> Auswertungstool am PC (CSV-Import aus dem Dropbox-Ordner).

## Voraussetzung

Fünf CSV/JSON-Dateien müssen einmalig in den Dropbox-App-Ordner
`Apps/Aufschreibung-PWA/` hochgeladen werden:

- `01_Stammdaten_Lebensmittel.csv`
- `02_Stammdaten_Eigengerichte.csv`
- `03_Erfassung.csv`
- `04_Vitaldaten.csv`
- `05_Konfiguration.json`

## Technischer Aufbau

- Vanilla JavaScript, kein Framework, kein Build-Schritt
- Datenspeicher: IndexedDB (lokal), Dropbox App-Folder (Cloud)
- Auth: OAuth 2.0 PKCE (Dropbox SDK v10.34.0)
- Hosting: GitHub Pages (Branch `main`, Verzeichnis `/`)

## Projektstruktur

```
/
├── index.html          Einzige HTML-Seite (SPA)
├── app.js              Gesamte App-Logik
├── style.css           Alle Styles (Mobile-First)
├── manifest.json       PWA-Manifest
├── service-worker.js   Offline-Cache
├── icon-192.png        App-Icon
├── icon-512.png        App-Icon
├── Aufgaben/           Bauaufträge vom Projektleiter
├── Status/             Statusberichte und Testpläne
├── Mockups/            Design-Referenzen
└── Daten/              CSV-Referenzdaten
```
