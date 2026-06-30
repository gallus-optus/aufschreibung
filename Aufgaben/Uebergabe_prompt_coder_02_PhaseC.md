# Übergabe-Prompt für Claude Code — Phase C

**Anleitung für Dich (Ralle):**

(1) Lade die zwei Dateien `phase_c_bauauftrag.md` und `phase_c_mockup.html`
    aus dieser Chat-Session herunter.

(2) Lege sie im lokalen Repo ab:
    - `phase_c_bauauftrag.md` → in den Ordner `Aufgaben/`
    - `phase_c_mockup.html` → in den Ordner `Mockups/`

(3) In GitHub Desktop committen und pushen (oder den Coder das machen
    lassen — siehe Prompt).

(4) Claude Code öffnen (Working Directory: das Repo), den Text zwischen
    den Backticks einfügen.

---

## Wortwörtlich zu kopierender Text:

```
Hallo, wir starten Phase C des Aufschreibung-Projekts.

Phase B2 ist abgeschlossen und live getestet — die App laeuft auf dem
Handy, Login und Datenbank-Listen funktionieren.

Bitte mache folgendes in dieser Reihenfolge:

(1) Lies die CLAUDE.md im Repo-Root erneut (falls neue Session) — die
    Projektregeln gelten unveraendert.

(2) Lies den neuen Bauauftrag Aufgaben/phase_c_bauauftrag.md komplett.

(3) Oeffne und betrachte das Mockup Mockups/phase_c_mockup.html (im
    Browser oder durch Lesen des HTML) als visuelle Referenz.

(4) Pruefe die Voraussetzungen:
    - Liegt Aufgaben/phase_c_bauauftrag.md vor? Ja/Nein
    - Liegt Mockups/phase_c_mockup.html vor? Ja/Nein
    - Ist der Phase-B2-Code im Repo vorhanden und lauffaehig? Ja/Nein

(5) Sammle Deine Rueckfragen zum Bauauftrag in EINER Nachricht. Leite
    sie ueber mich an den Projektleiter (Chat-Claude) weiter.

(6) Erst nach Klaerung baust Du iterativ in der "Empfohlenen Reihenfolge
    des Bauens" aus dem Bauauftrag. Nach jedem groesseren Meilenstein
    (Tab-Bar erweitert / Heute-Ansicht steht / Erfassen funktioniert /
    Vitalwerte funktionieren) kurz Bescheid geben, damit ich auf dem
    Handy testen kann.

(7) Am Ende: Statusbericht und Testplan in Status/ (mit MESZ-Zeitstempel),
    README auf Version 0.2 aktualisieren, alles pushen.

BESONDERS WICHTIG bei Phase C:

- Phase C schreibt NUR in die lokale IndexedDB, NICHT nach Dropbox. Das
  Hochladen ist Phase F. Aber: alle neuen/geaenderten Datensaetze muessen
  "sync-bereit" abgelegt werden (Felder geaendert_am und sync_status) —
  siehe Abschnitt "Sync-Vorbereitung" im Bauauftrag.

- Die Einheiten-Logik (Gramm/Stueck/Portion/Scheibe/Essloeffel/Teeloeffel)
  ist das Kernfeature. Lebensmittel und Eigengerichte bekommen neue
  optionale Felder fuer die Gramm-Werte je Einheit. Beim Indexieren alter
  CSVs ohne diese Spalten: Felder leer lassen, kein Fehler.

- Das IndexedDB-Schema muss erweitert werden OHNE die bestehenden
  Phase-B2-Daten zu zerstoeren. Bitte Migration sauber handhaben
  (Versionsnummer der IndexedDB erhoehen, onupgradeneeded korrekt).

- Die Phase-B2-Screens (Datenbank-Listen, Detail-Ansichten,
  Einstellungen) bleiben erhalten und wandern unter die neuen Tabs
  "Datenbank" und "Mehr".

Bestaetige kurz Dein Verstaendnis, das Ergebnis der drei
Voraussetzungs-Pruefungen, und liste dann Deine Rueckfragen.
```

---

## Zur Erinnerung — Deine Rolle danach

(A) Coder-Rückfragen hierher in den Chat kopieren, ich beantworte sie.

(B) Bei Meilenstein-Berichten auf dem Handy testen.

(C) Am Ende den vollen Testplan durchgehen.

(D) Wenn Phase C grün ist: wir machen Phase F (Dropbox-Sync schreibend),
    damit Deine Eingaben endlich über Geräte synchronisiert und in
    Dropbox gesichert werden.

---

## Hinweis zur Reihenfolge (Erinnerung)

Wir bauen: C (jetzt) → F (Sync) → D (Tools) → E (Diagramm) → G (Excel +
Polish). Phase C macht die App benutzbar, Phase F macht sie
multi-device-tauglich und sichert die Daten.
