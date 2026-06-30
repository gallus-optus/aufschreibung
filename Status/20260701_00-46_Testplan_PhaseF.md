# Testplan Phase F

## ⚠ Wichtige Vorsichtsmaßnahme VOR dem ersten Test

**Sichere einmalig manuell Deinen Dropbox-App-Ordner**, bevor Du die
neue Version zum ersten Mal synchronisieren lässt:

1. Öffne Dropbox am PC oder im Browser.
2. Gehe zu `Apps/Aufschreibung-PWA/`.
3. Kopiere die fünf Dateien (01–05) in einen Ordner außerhalb, z. B.
   `Aufschreibung-Sicherung-vor-PhaseF/`.

Grund: Phase F überschreibt ab jetzt Deine Dropbox-Dateien (mit
automatischem rollierendem Backup, aber eine eigene Kopie vor dem
allerersten Lauf ist die sicherste Absicherung). Danach legt die App die
Sicherungen selbst an (`_backups/`).

## Voraussetzungen

- App ist live unter `https://gallus-optus.github.io/aufschreibung/` und
  auf mindestens einem Handy installiert (für den Zwei-Geräte-Test ideal
  zwei Geräte oder Handy + Tablett).
- Die fünf Dateien liegen in Dropbox (aus den Vorphasen).
- **Nach dem Update App schließen und neu öffnen** (ggf. zweimal), damit
  der neue Service-Worker-Cache (`v0.3`) geladen wird.
- Bestehende lokale Daten bleiben erhalten.

## Testfälle

### Test 1: Erster Sync legt Sicherungen an
1. App öffnen (App-Start löst einen Sync aus). Alternativ Mehr → „Jetzt
   synchronisieren".
2. In Dropbox `Apps/Aufschreibung-PWA/_backups/` öffnen.
3. **Erwartet:** Dort liegen Sicherungen mit Zeitstempel, z. B.
   `01_Stammdaten_Lebensmittel_backup_2026-07-01_0830.csv` und für die
   anderen geänderten Dateien.

### Test 2: Erfassung wird automatisch hochgeladen (~60 s)
1. Eine Mahlzeit erfassen (Heute → „+").
2. Etwa eine Minute warten (oder Mehr → „Jetzt synchronisieren" für
   sofort).
3. In der Dropbox-Web-Oberfläche `03_Erfassung.csv` öffnen.
4. **Erwartet:** Der neue Eintrag steht in der Datei, mit den Spalten
   `menge_eingabe` und `einheit_eingabe` am Ende.

### Test 3: Excel öffnet die Datei sauber (deutsche Notation)
1. `03_Erfassung.csv` aus Dropbox am PC herunterladen und in Excel öffnen.
2. **Erwartet:** Spalten sind korrekt durch Semikolon getrennt,
   Dezimalzahlen mit Komma, Umlaute richtig dargestellt (UTF-8-BOM). Eine
   Bemerkung mit Semikolon steht korrekt in einer Zelle (in
   Anführungszeichen in der Rohdatei).

### Test 4: Zweites Gerät bekommt die Einträge (Kern-Test)
1. Auf **Gerät A** eine Mahlzeit erfassen, synchronisieren lassen.
2. Auf **Gerät B** die App öffnen (App-Start-Sync) oder „Jetzt
   synchronisieren" tippen.
3. **Erwartet:** Der auf Gerät A erfasste Eintrag erscheint auf Gerät B.
   (Ohne zweites Gerät: auf demselben Gerät „Datenbank neu aufbauen" —
   die Einträge bleiben erhalten/kommen aus Dropbox zurück.)

### Test 5: Zwei Geräte, kein Datenverlust (Kern-Test)
1. **Gleichzeitig/ohne zwischendurch zu syncen:** Gerät A erfasst
   Mahlzeit X, Gerät B erfasst Mahlzeit Y.
2. Gerät A synchronisieren, danach Gerät B synchronisieren, danach Gerät
   A nochmal.
3. **Erwartet:** Nach den Syncs haben **beide** Geräte sowohl X als auch
   Y. Kein Eintrag geht verloren.

### Test 6: Offene Änderungen und Status
1. Mehr-Sektion öffnen.
2. Eine Erfassung machen, sofort zurück in Mehr.
3. **Erwartet:** „Offene Änderungen" zeigt kurz eine Zahl > 0 und „Status"
   ggf. „Änderungen ausstehend"; nach dem Sync steht „Offene Änderungen 0"
   und Status „● synchron".

### Test 7: Einheiten-Werte landen in den Stammdaten
1. Beim Erfassen für ein Lebensmittel erstmals eine Einheit (z. B.
   Portion) mit Gewicht angeben (Popup).
2. Synchronisieren.
3. In Dropbox `01_Stammdaten_Lebensmittel.csv` öffnen.
4. **Erwartet:** Die Datei hat jetzt die Spalten `gramm_pro_*` am Ende,
   und beim betreffenden Lebensmittel steht der eingegebene Wert.
   (Analog `02_Stammdaten_Eigengerichte.csv` bei einem Gericht — Wert auf
   der ersten Zutat-Zeile des Gerichts.)

### Test 8: Backup-Rotation (nur 5 bleiben)
1. Mehrfach (mehr als fünf Mal, mit etwas Abstand) etwas erfassen und
   jeweils synchronisieren — so entstehen mehrere `03`-Sicherungen.
2. `_backups/` ansehen.
3. **Erwartet:** Von `03_Erfassung_backup_*` bleiben höchstens die
   jüngsten fünf; ältere sind gelöscht.

### Test 9: Manueller Sync-Knopf
1. Mehr → „Jetzt synchronisieren".
2. **Erwartet:** Knopf zeigt kurz „Synchronisiere…", danach Status
   „● synchron" und „Zuletzt synchronisiert: Gerade eben".

### Test 10: Offline-Verhalten
1. Flugmodus an.
2. Erfassen, Mehr öffnen.
3. **Erwartet:** Status „○ offline", „Offene Änderungen" > 0. Kein
   Absturz.
4. Flugmodus aus, „Jetzt synchronisieren".
5. **Erwartet:** Änderungen werden hochgeladen, „Offene Änderungen 0".

### Test 11: Token-Erneuerung
1. App längere Zeit (mehrere Stunden) nicht nutzen, dann wieder öffnen und
   synchronisieren.
2. **Erwartet:** Sync läuft ohne erneute Anmeldung (der abgelaufene
   Access-Token wird automatisch erneuert). Nur wenn das fehlschlägt:
   Status „Anmeldung erforderlich".

### Test 12: Phase-B2/C-Funktionen laufen weiter
1. Lebensmittel-/Gerichte-Listen, Detail-Ansichten, Heute-Ansicht,
   Vitalwerte, Bearbeiten/Löschen durchklicken.
2. **Erwartet:** Alles funktioniert wie zuvor.

## Bekannte Probleme oder Warnungen

- **Löschen propagiert nicht über Geräte (kein Tombstone).** Löschst Du
  auf Gerät A einen Eintrag, der in Dropbox/auf Gerät B noch existiert,
  kommt er beim nächsten Sync zurück. Das ist eine bekannte, akzeptierte
  Einschränkung dieser Phase.

- **Stammdaten-Inhalte am PC ändern:** Wenn Du die Lebensmittel-/Gericht-
  Inhalte direkt in der CSV am PC änderst, übernimm das mit „Datenbank neu
  aufbauen" — der Sync merged nur die Einheiten-Werte, nicht die
  Stammdaten-Inhalte. Ändere nicht gleichzeitig am PC eine Zutat und am
  Handy einen Einheiten-Wert desselben Gerichts.

- **Backup-Test braucht echte Dropbox:** Die Backup-/Upload-Vorgänge sind
  nur auf dem Handy (über die echte Dropbox) prüfbar, nicht in der lokalen
  Vorschau. Die Sync-Logik selbst wurde lokal mit simulierter Dropbox
  vollständig durchgetestet.

- **Erster Sync kann kurz dauern:** Beim ersten Lauf werden 01 und 02 ggf.
  einmal neu geschrieben (Header-Erweiterung) und gesichert — danach nur
  noch bei echten Änderungen.
