# Übergabe-Prompt für Claude Code — Phase F

**Anleitung für Dich (Ralle):**

(1) Lade die zwei Dateien `phase_f_bauauftrag.md` und `phase_f_mockup.html`
    aus dieser Chat-Session herunter.

(2) Lege sie im lokalen Repo ab:
    - `phase_f_bauauftrag.md` → in den Ordner `Aufgaben/`
    - `phase_f_mockup.html` → in den Ordner `Mockups/`

(3) In GitHub Desktop committen und pushen (oder den Coder das machen
    lassen).

(4) Claude Code öffnen (Working Directory: das Repo), den Text zwischen
    den Backticks einfügen.

---

## Wortwörtlich zu kopierender Text:

```
Hallo, wir starten Phase F des Aufschreibung-Projekts.

Phase C (Tageseingabe) ist abgeschlossen und getestet — Erfassung,
Einheiten-Logik, Vitalwerte und die 5-Tab-Navigation laufen auf dem
Handy. Die Daten liegen aktuell nur lokal in IndexedDB.

Phase F schaltet jetzt den Zwei-Wege-Sync mit Dropbox scharf. Das ist
die heikelste Phase des Projekts — ein Bug kann Datenverlust
verursachen. Deshalb bauen wir defensiv, mit rollierendem Backup.

Bitte mache folgendes in dieser Reihenfolge:

(1) Lies die CLAUDE.md im Repo-Root erneut (Projektregeln gelten
    unveraendert).

(2) Lies den Bauauftrag Aufgaben/phase_f_bauauftrag.md komplett. Achte
    besonders auf die drei Grundprinzipien (erst herunterladen dann
    hochladen / zeilenweises Mergen / rollierendes Backup) und auf den
    detaillierten Merge-Algorithmus.

(3) Oeffne und betrachte das Mockup Mockups/phase_f_mockup.html als
    Referenz fuer den Sync-Ablauf und die Status-UI.

(4) Pruefe die Voraussetzungen:
    - Liegt Aufgaben/phase_f_bauauftrag.md vor? Ja/Nein
    - Liegt Mockups/phase_f_mockup.html vor? Ja/Nein
    - Sind Phase B2 und Phase C im Repo vorhanden und lauffaehig? Ja/Nein
    - Existieren die Sync-Felder geaendert_am und sync_status bereits in
      den IndexedDB-Datensaetzen (aus Phase C)? Ja/Nein

(5) Sammle Deine Rueckfragen in EINER Nachricht. Leite sie ueber mich an
    den Projektleiter weiter.

(6) Erst nach Klaerung baust Du iterativ in der "Empfohlenen Reihenfolge
    des Bauens". WICHTIG: Baue und teste den Backup-Mechanismus, BEVOR
    der erste echte Ueberschreib-Upload scharf geschaltet wird. Nach
    jedem Meilenstein (Erfassung synct / Auto-Sync laeuft / Zwei-Geraete-
    Test bestanden) kurz Bescheid geben.

(7) Am Ende: Statusbericht und Testplan in Status/ (MESZ-Zeitstempel),
    README auf Version 0.3, alles pushen.

BESONDERS WICHTIG bei Phase F:

- Reihenfolge IMMER: erst herunterladen, dann mergen, dann Backup, dann
  hochladen. Nie nur hochladen — sonst gehen Eintraege anderer Geraete
  verloren.

- Zeilenweises Mergen ueber IDs (erfassungs_id / datum / lebensmittel_id).
  Bei Konflikt: neuerer geaendert_am gewinnt.

- Rollierendes Backup: 5 Versionen pro Datei, im Unterordner _backups/
  im Dropbox-App-Ordner. Schema:
  03_Erfassung_backup_YYYY-MM-DD_HHMM.csv (analog fuer die anderen).

- Sammel-Verzoegerung 60 Sekunden nach Erfassung (debounce), plus
  App-Start-Sync, plus manueller Knopf.

- Die neuen CSV-Spalten aus Phase C jetzt ausrollen: die fuenf
  gramm_pro_* in 01 und 02, sowie menge_eingabe und einheit_eingabe in
  03. Die internen Felder geaendert_am und sync_status kommen NICHT in
  die CSV (nur IndexedDB).

- Deutsche CSV-Notation beim Schreiben zwingend beachten: Semikolon,
  Komma-Dezimal, UTF-8 BOM, ISO-Datum. Bitte explizit testen, dass Excel
  die geschriebenen Dateien sauber oeffnet.

- rev-Konsistenz: nach jedem Upload die neue Dropbox-rev als "gemerkte
  rev" speichern, sonst laedt die App beim naechsten Mal unnoetig herunter.

- Kein Tombstone in Phase F: geloeschte Eintraege werden ueber Geraete
  nicht propagiert (kommen beim Merge zurueck). Das als bekannte
  Einschraenkung im Statusbericht dokumentieren.

Bestaetige kurz Dein Verstaendnis, das Ergebnis der vier
Voraussetzungs-Pruefungen, und liste dann Deine Rueckfragen.
```

---

## Zur Erinnerung — Deine Rolle danach

(A) Coder-Rückfragen hierher in den Chat kopieren, ich beantworte sie.

(B) Bei Meilenstein-Berichten testen — besonders der Zwei-Geräte-Test
    ist wichtig.

(C) Beim Testen unbedingt einmal in der Dropbox-Web-Oberfläche
    nachschauen, ob die CSVs korrekt geschrieben wurden und der
    `_backups/`-Ordner Backups enthält.

(D) Wenn Phase F grün ist: weiter mit Phase D (die drei Rechner-Tools:
    Rezeptrechner, Alkoholrechner, Brühepulver-Rechner).

---

## Wichtiger Test-Hinweis für Dich

Phase F ist die Phase, wo Du nach dem Bauen besonders genau testen
solltest. Der Coder liefert einen Testplan, aber zwei Dinge solltest Du
auf jeden Fall selbst prüfen:

(1) **In der Dropbox nachschauen:** Nach einer Erfassung in der App —
    erscheint die Zeile in `03_Erfassung.csv`? Liegt im `_backups/`-
    Ordner eine Sicherung?

(2) **Zwei-Geräte-Test** (oder simuliert): Auf Gerät A etwas erfassen,
    synchronisieren. Auf Gerät B (oder nach "Datenbank neu aufbauen")
    öffnen — ist der Eintrag da? Dann auf B etwas anderes erfassen,
    auf A prüfen. Beide Einträge sollten am Ende auf beiden Geräten sein.

Wenn diese zwei Tests sauber laufen, ist der Sync vertrauenswürdig.
