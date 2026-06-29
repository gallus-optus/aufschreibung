# Aufschreibung

Progressive Web App zur persönlichen Ernährungs- und Vitalwert-Aufzeichnung.

**Live-App:** https://gallus-optus.github.io/aufschreibung/

## Was die App kann (Phase B2)

- Anmeldung am Dropbox-Konto (OAuth 2.0 mit PKCE, kein Passwort gespeichert)
- Herunterladen und lokales Indexieren der Stammdaten aus dem Dropbox-App-Ordner
- Lebensmittel-Liste mit Suche und Gruppen-Filter (597 Einträge)
- Eigengericht-Liste mit Suche und Kategorie-Filter (221 Gerichte)
- Detail-Ansicht für Lebensmittel mit allen Nährwerten
- Detail-Ansicht für Eigengerichte mit berechneten Nährwerten und Zutaten
- Einstellungen: Konto-Info, Sync-Status, Datenbank-Statistik
- Offline-Betrieb nach erstem Sync (Service Worker, Cache-First)

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
