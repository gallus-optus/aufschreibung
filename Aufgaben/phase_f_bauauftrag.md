# Bauauftrag Phase F — Dropbox-Sync (schreibend, mit Merge und Backup)

**Auftraggeber:** Projektleiter (Chat-Claude)
**Empfänger:** Coder (Claude Code)
**Datum:** 30.06.2026
**Vorgänger:** Phase C (Tageseingabe) abgeschlossen und getestet
**Nachfolger:** Phase D (Rechner-Tools)

---

## Ziel dieser Phase

Die in Phase C lokal erfassten Daten werden jetzt mit Dropbox
synchronisiert — in beide Richtungen, sicher gegen Datenverlust.
Konkret:

(1) Lokale Änderungen (Erfassungen, Vitaldaten, neue Einheiten-Werte)
    werden nach Dropbox hochgeladen.
(2) Änderungen von anderen Geräten werden heruntergeladen und
    zusammengeführt.
(3) Konflikte werden nach "neuerer Zeitstempel gewinnt" aufgelöst.
(4) Vor jedem Überschreiben wird ein rollierendes Backup angelegt.
(5) Der Sync läuft automatisch (App-Start + nach Erfassung mit
    Verzögerung) und manuell (Knopf).

**Das ist die heikelste Phase — ein Bug kann Datenverlust verursachen.**
Deshalb: rollierendes Backup, defensive Programmierung, ausführliche
Tests. Lieber einen Schritt mehr absichern als zu wenig.

---

## Grundprinzipien (nicht verhandelbar)

### Prinzip 1: Immer erst herunterladen, dann hochladen

Niemals einfach den lokalen Stand über die Dropbox-Datei kippen. Der
korrekte Ablauf ist IMMER:

```
1. Dropbox-Stand herunterladen (falls geaendert)
2. Mit lokalem Stand zeilenweise mergen
3. Backup der alten Dropbox-Datei anlegen
4. Gemergten Stand hochladen
```

Begründung: Sonst gehen Einträge verloren, die ein anderes Gerät
hochgeladen hat. Diese Reihenfolge ist zwingend.

### Prinzip 2: Zeilenweises Mergen über IDs

Die Daten werden NICHT als ganze Datei ersetzt, sondern Zeile für Zeile
zusammengeführt:

- **Erfassung**: Schlüssel ist `erfassungs_id`. Zeilen, die nur auf einer
  Seite existieren, werden behalten. Bei gleicher ID mit Unterschieden:
  neuerer `geaendert_am` gewinnt.
- **Vitaldaten**: Schlüssel ist `datum`. Gleiche Logik.
- **Stammdaten (Einheiten-Werte)**: Schlüssel ist `lebensmittel_id` bzw.
  `gericht_id`. Bei Konflikt in den `gramm_pro_*`-Feldern: neuerer
  Zeitstempel gewinnt.

### Prinzip 3: Rollierendes Backup vor jedem Überschreiben

Vor jedem Upload, der eine bestehende Dropbox-Datei ersetzt, wird die
alte Version in den Backup-Ordner kopiert. Die letzten 5 Versionen pro
Datei bleiben, ältere werden gelöscht.

---

## Sync-Konfiguration (feste Werte)

- **Backup-Versionen behalten:** 5 pro Datei
- **Backup-Ablage:** Unterordner `_backups/` im Dropbox-App-Ordner
- **Sammel-Verzögerung nach Erfassung:** 60 Sekunden
- **Automatischer Sync:** beim App-Start (Download) + 60 s nach der
  letzten Erfassung (Upload)
- **Manueller Sync:** Knopf "Jetzt synchronisieren" in der Mehr-Sektion
- **Versions-Erkennung:** über die Dropbox-`rev` (oder content_hash) pro
  Datei; die App merkt sich die zuletzt bekannte rev und vergleicht

---

## Backup-Dateinamen-Schema

Im Ordner `_backups/`:
```
03_Erfassung_backup_YYYY-MM-DD_HHMM.csv
04_Vitaldaten_backup_YYYY-MM-DD_HHMM.csv
01_Stammdaten_Lebensmittel_backup_YYYY-MM-DD_HHMM.csv
02_Stammdaten_Eigengerichte_backup_YYYY-MM-DD_HHMM.csv
```

Pro Datei werden nur die jüngsten 5 behalten. Beim Anlegen eines neuen
Backups: alle Backups derselben Quelldatei auflisten, nach Zeitstempel
sortieren, alle ab dem 6. löschen.

---

## CSV-Schema-Erweiterungen ausrollen

Phase C hat neue Felder in IndexedDB eingeführt, die jetzt in die
Dropbox-CSVs geschrieben werden. Beim ersten Upload die Header
entsprechend erweitern:

### 01_Stammdaten_Lebensmittel.csv — neue Spalten am Ende
`gramm_pro_stueck;gramm_pro_portion;gramm_pro_scheibe;gramm_pro_essloeffel;gramm_pro_teeloeffel`

### 02_Stammdaten_Eigengerichte.csv — neue Spalten am Ende
Die gleichen fünf `gramm_pro_*`-Spalten (pro Gericht, also pro
Gericht-Header-Zeile; bei den denormalisierten Zutaten-Zeilen leer).

### 03_Erfassung.csv — neue Spalten am Ende
`menge_eingabe;einheit_eingabe`

WICHTIG: Die internen Sync-Felder `geaendert_am` und `sync_status`
gehören NICHT in die CSV. Die bleiben nur in IndexedDB. In die CSV
kommt nur, was fachlich Teil der Daten ist.

Beim Lesen alter CSVs ohne die neuen Spalten: fehlende Felder leer
behandeln, kein Fehler.

---

## Merge-Algorithmus (detailliert)

```
funktion sync_datei(dateiname, schluessel_feld):
    lokale_zeilen = lese_aus_indexeddb(dateiname)        # Map: schluessel -> zeile
    
    # Schritt 1+2: Version pruefen und herunterladen
    dropbox_rev = hole_aktuelle_rev(dateiname)
    wenn dropbox_rev == gemerkte_rev[dateiname]:
        dropbox_zeilen = {}        # nichts Neues von Dropbox
        dropbox_unveraendert = true
    sonst:
        dropbox_inhalt = lade_herunter(dateiname)
        dropbox_zeilen = parse_csv(dropbox_inhalt)       # Map: schluessel -> zeile
        dropbox_unveraendert = false
    
    # Schritt 3: Mergen
    ergebnis = {}
    alle_schluessel = vereinigung(lokale_zeilen.keys, dropbox_zeilen.keys)
    fuer jeden schluessel in alle_schluessel:
        l = lokale_zeilen[schluessel]      # kann fehlen
        d = dropbox_zeilen[schluessel]     # kann fehlen
        wenn l und nicht d:  ergebnis[schluessel] = l
        wenn d und nicht l:  ergebnis[schluessel] = d
        wenn l und d:
            # Konflikt: neuerer geaendert_am gewinnt
            wenn l.geaendert_am >= d.geaendert_am: ergebnis[schluessel] = l
            sonst: ergebnis[schluessel] = d
    
    # Schritt 4: nur hochladen wenn sich etwas geaendert hat
    lokale_aenderungen_vorhanden = (es gibt Zeilen mit sync_status != "synchronisiert")
    merge_hat_neues = (ergebnis != dropbox_zeilen)
    
    wenn lokale_aenderungen_vorhanden oder merge_hat_neues:
        # Backup der alten Dropbox-Datei (wenn sie existierte)
        wenn dropbox_datei_existiert(dateiname):
            lege_backup_an(dateiname)
            loesche_alte_backups(dateiname, behalten=5)
        # Hochladen
        neuer_csv = schreibe_csv(ergebnis)
        neue_rev = lade_hoch(dateiname, neuer_csv)
        gemerkte_rev[dateiname] = neue_rev
        markiere_alle_lokal_als_synchronisiert(dateiname)
    
    # Lokale IndexedDB mit dem Merge-Ergebnis aktualisieren
    schreibe_in_indexeddb(dateiname, ergebnis)
```

Wichtig:
- Zeitstempel-Vergleich über ISO-String oder Millisekunden — konsistent.
- Wenn ein Datensatz lokal gelöscht wurde: in Phase F als
  Standard-Annahme NICHT gesondert behandelt (kein Tombstone). Heißt:
  ein auf Gerät A gelöschter Eintrag, der auf Dropbox noch existiert,
  kommt beim Merge zurück. Das ist akzeptabel für den Start. Wenn der
  Nutzer echtes Löschen über Geräte braucht, ist das eine spätere
  Erweiterung (Tombstone-Konzept). HINWEIS im Statusbericht vermerken.

---

## Sync-Auslöser

### Beim App-Start
- Download-orientierter Sync: holt aktuellen Stand aus Dropbox, merged,
  aktualisiert die lokale Ansicht.

### Nach einer Erfassung / Vitaldaten-Speicherung
- Ein Timer von 60 Sekunden startet (bzw. wird zurückgesetzt, wenn
  innerhalb der 60 s eine weitere Erfassung passiert — "debounce").
- Nach Ablauf: Upload-orientierter Sync (erst Download+Merge wie immer,
  dann Upload).

### Manuell
- Knopf "Jetzt synchronisieren" in der Mehr-Sektion: löst sofort einen
  vollen Sync aus.

### Offline-Verhalten
- Wenn kein Internet (`navigator.onLine` false oder Dropbox-Call
  scheitert): Sync abbrechen, Status auf "offline" setzen, lokale Daten
  bleiben mit sync_status "neu"/"geaendert". Beim nächsten erfolgreichen
  Sync werden sie nachgezogen.

---

## Token-Erneuerung im Sync

Wenn ein Dropbox-Call mit 401 (Unauthorized) oder abgelaufenem Token
fehlschlägt: automatisch über den Refresh-Token (aus Phase B2) einen
neuen Access-Token holen und den Call wiederholen. Schlägt auch das fehl:
Status auf "Anmeldung erforderlich", Nutzer muss sich neu anmelden.

---

## UI-Änderungen (minimal)

Die Mehr-Sektion (Einstellungen) bekommt einen erweiterten
Synchronisierungs-Abschnitt:

```
Synchronisierung
  Status: ● synchron / ○ offline / Änderungen ausstehend
  Zuletzt synchronisiert: vor X Min
  Offene Änderungen: N
  [Jetzt synchronisieren]

Sicherungen
  Letzte Sicherung: <Zeitpunkt>
  Behaltene Versionen: 5
```

- "Status" nutzt navigator.onLine und das Ergebnis des letzten Syncs.
- "Offene Änderungen" = Anzahl Datensätze mit sync_status != "synchronisiert".
- Mehr UI ist nicht nötig — kein Sync-Protokoll, keine Konflikt-Anzeige
  (Nutzer-Entscheidung).

---

## Akzeptanzkriterien (Definition of Done)

(1) Nach einer Erfassung wird innerhalb von ~60 s automatisch nach
    Dropbox hochgeladen (in der Dropbox-Web-Oberfläche sichtbar).

(2) Beim App-Start auf einem zweiten Gerät (oder nach "Datenbank neu
    aufbauen") erscheinen die auf dem ersten Gerät erfassten Einträge.

(3) Zwei Geräte erfassen unterschiedliche Mahlzeiten → nach Sync haben
    beide alle Einträge (kein Verlust).

(4) Backup wird vor dem Überschreiben angelegt; im `_backups/`-Ordner
    liegen die Dateien mit Zeitstempel.

(5) Nach mehr als 5 Backups derselben Datei werden die ältesten
    gelöscht (nur 5 bleiben).

(6) Neue Einheiten-Werte (gramm_pro_portion etc.) landen in der
    Dropbox-Stammdaten-CSV.

(7) menge_eingabe und einheit_eingabe landen in 03_Erfassung.csv.

(8) Manueller "Jetzt synchronisieren"-Knopf funktioniert und
    aktualisiert den Status.

(9) Offline: App sammelt Änderungen, "Status: offline" wird angezeigt,
    nach Reconnect + Sync werden sie hochgeladen.

(10) Abgelaufener Token wird automatisch erneuert, Sync läuft weiter.

(11) Die CSVs bleiben in deutscher Notation (Semikolon, Komma-Dezimal,
     UTF-8 BOM, ISO-Datum) — auch nach dem Schreiben durch die App.

(12) "Offene Änderungen" zeigt korrekt 0 nach erfolgreichem Sync.

(13) Alle Phase-C- und B2-Funktionen laufen unverändert weiter.

(14) Code: deutsche Variablen/Kommentare, Vanilla JS, kein Framework,
     keine neuen externen Bibliotheken außer dem schon genutzten
     Dropbox SDK.

---

## Empfohlene Reihenfolge des Bauens

(1) CSV-Schreiben (Serialisierung) in deutscher Notation — Gegenstück
    zum vorhandenen CSV-Parser. Sorgfältig: Semikolon, Komma-Dezimal,
    BOM, korrekte Spaltenreihenfolge inkl. der neuen Felder.

(2) Dropbox-Upload-Funktion (files/upload mit overwrite-Modus).

(3) rev-Tracking: zuletzt bekannte rev pro Datei in IndexedDB merken.

(4) Merge-Funktion für einen Datentyp (Erfassung) — isoliert testbar
    mit konstruierten Daten.

(5) Backup-Anlegen + alte Backups löschen (5 behalten).

(6) Vollständiger Sync-Ablauf für Erfassung (Download → Merge → Backup
    → Upload).

(7) Gleiche Logik für Vitaldaten und Stammdaten (Einheiten-Werte).

(8) Auslöser: App-Start-Sync.

(9) Auslöser: 60-s-Debounce nach Erfassung.

(10) Manueller Sync-Knopf + Status-Anzeige in der Mehr-Sektion.

(11) Offline-Handling und Token-Erneuerung im Sync-Kontext.

(12) Tests: Zwei-Geräte-Szenario simulieren (z. B. mit "Datenbank neu
     aufbauen" zwischen zwei Erfassungs-Runden, oder echt mit zwei
     Geräten).

(13) Polish, Statusbericht + Testplan, Push.

Meilenstein-Meldungen: nach Schritt 6 (Erfassung synct), nach Schritt 9
(Auto-Sync läuft), nach Schritt 12 (Zwei-Geräte-Test bestanden).

---

## Besondere Sorgfalt / Warnungen

(1) **Datenverlust-Risiko.** Die Backup-Logik MUSS vor dem ersten
    echten Upload funktionieren. Bitte den Backup-Schritt zuerst
    bauen und testen, bevor der erste Überschreib-Upload scharf
    geschaltet wird.

(2) **rev-Konsistenz.** Wenn die App eine Datei hochlädt, gibt Dropbox
    eine neue rev zurück. Diese MUSS als "gemerkte rev" gespeichert
    werden, sonst denkt die App beim nächsten Sync, die Datei sei
    fremd-geändert, und lädt unnötig herunter.

(3) **Deutsche CSV-Notation beim Schreiben.** Der häufigste Fehler:
    beim Serialisieren Punkt statt Komma als Dezimaltrenner. Bitte
    explizit testen, dass geschriebene CSVs Komma-Dezimal und
    Semikolon-Trenner haben und Excel sie sauber öffnet.

(4) **Kein Tombstone in Phase F.** Löschungen werden über Geräte nicht
    propagiert (gelöschter Eintrag kommt beim Merge zurück). Das im
    Statusbericht klar dokumentieren als bekannte Einschränkung.

---

## Nach Fertigstellung

(1) Push zum main-Branch.

(2) Statusbericht `Status/YYYYMMDD_HH-MM_Status_PhaseF.md`.

(3) Testplan `Status/YYYYMMDD_HH-MM_Testplan_PhaseF.md` — mit
    besonderem Fokus auf das Zwei-Geräte-Szenario und die
    Backup-Prüfung.

(4) README auf Version 0.3 (Phase F) aktualisieren.

(5) Kurze Nachricht an den Nutzer.

(6) Bei grünem Test: Phase D (Rechner-Tools) vorbereiten.
