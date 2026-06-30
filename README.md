# Aufschreibung

Progressive Web App zur persönlichen Ernährungs- und Vitalwert-Aufzeichnung.

**Live-App:** https://gallus-optus.github.io/aufschreibung/
**Version:** 0.2 (Phase C)

## Was die App kann

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

> **Hinweis:** Phase C schreibt erfasste Daten nur lokal (IndexedDB).
> Das Hochladen nach Dropbox folgt in Phase F.

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
