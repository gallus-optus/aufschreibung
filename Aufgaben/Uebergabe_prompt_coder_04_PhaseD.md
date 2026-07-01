# Übergabe-Prompt für Claude Code — Phase D

**Anleitung für Dich (Ralle):**

(1) Lade die zwei Dateien `phase_d_bauauftrag.md` und `phase_d_mockup.html`
    aus dieser Chat-Session herunter.

(2) Lege sie im lokalen Repo ab:
    - `phase_d_bauauftrag.md` → in den Ordner `Aufgaben/`
    - `phase_d_mockup.html` → in den Ordner `Mockups/`

(3) In GitHub Desktop committen und pushen (oder den Coder das machen
    lassen).

(4) Claude Code öffnen (Working Directory: das Repo), den Text zwischen
    den Backticks einfügen.

---

## Wortwörtlich zu kopierender Text:

```
Hallo, wir starten Phase D des Aufschreibung-Projekts.

Phase F (Dropbox-Sync) ist abgeschlossen und getestet — die App ist
datensicher und multi-device-tauglich. Jetzt kommen die Komfort-Tools.

Phase D baut einen neuen Bereich "Werkzeuge" (im Mehr-Tab) mit fuenf
Rechnern:
1. Rezeptrechner (Eigengericht-Editor mit Endgewicht-Korrektur)
2. Alkoholrechner
3. Bruehepulver-Rechner
4. Garfaktor: Quelle -> Datenbank (gegart auf roh umrechnen)
5. Garfaktor: fuer die Aufschreibung (gegartes Gewicht auf Portion)

Bitte mache folgendes in dieser Reihenfolge:

(1) Lies die CLAUDE.md im Repo-Root erneut (Projektregeln unveraendert).

(2) Lies den Bauauftrag Aufgaben/phase_d_bauauftrag.md komplett. Achte
    auf die Berechnungslogiken und die DB-Schreibvorgaenge.

(3) Oeffne und betrachte das Mockup Mockups/phase_d_mockup.html als
    Referenz.

(4) Pruefe die Voraussetzungen:
    - Liegt Aufgaben/phase_d_bauauftrag.md vor? Ja/Nein
    - Liegt Mockups/phase_d_mockup.html vor? Ja/Nein
    - Sind B2, C und F im Repo vorhanden und lauffaehig? Ja/Nein
    - Existiert der DB-Schreib-Weg fuer neue Lebensmittel/Eigengerichte
      mit sync-Feldern (aus F) bereits? Ja/Nein

(5) Schlage Modell und Aufwand vor (Workflow-Regel 7) und sammle Deine
    Rueckfragen in EINER Nachricht. Leite sie ueber mich an den
    Projektleiter weiter.

(6) Erst nach Klaerung baust Du iterativ in der "Empfohlenen Reihenfolge
    des Bauens". Nach jedem Meilenstein (erster Rechner speichert in DB /
    vier einfache Rechner fertig / Rezeptrechner fertig) kurz Bescheid
    geben.

(7) Am Ende: Statusbericht und Testplan in Status/ (MESZ-Zeitstempel),
    README auf Version 0.4, alles pushen.

BESONDERS WICHTIG bei Phase D:

- DB-Schreibvorgaenge (neues Lebensmittel / neues Eigengericht) muessen
  geaendert_am und sync_status setzen, damit der Phase-F-Sync sie
  automatisch hochlaedt. Die Rechner selbst syncen nicht.

- Garfaktor-Logik (Kernpunkt): gegart = roh × Garfaktor (Default 0,77).
  Nährwerte pro 100 g sind gegart HOEHER, roh NIEDRIGER (Wasser tritt
  beim Garen aus). Rechner 4 (Quelle->DB): roh = gegart × 0,77. Rechner 5
  (Aufschreibung): rohe_menge = gegartes_gewicht ÷ 0,77.

- Rezeptrechner: Endgewicht Default = Rohmasse (Summe ungegarte Zutaten),
  ueberschreibbar. Beim Laden+Aendern entsteht ein NEUES Gericht (Original
  bleibt). Fehlt eine Zutat in der DB, muss sie erst dort angelegt werden
  (Hinweis im Rechner, kein Anlegen im Rechner selbst).

- Alkoholrechner speichert kcal_pro_100g UND alkohol_g (fuer die spaetere
  Alkohol-Auswertung).

- Deutsche Dezimalkommas ueberall. Konstanten aus der Konfiguration mit
  Fallback (Alkohol 7,1 kcal/g, Dichte 0,8, Garfaktor 0,77).

Bestaetige kurz Dein Verstaendnis, das Ergebnis der vier
Voraussetzungs-Pruefungen, Deinen Modell-/Aufwand-Vorschlag, und liste
dann Deine Rueckfragen.
```

---

## Zur Erinnerung — Deine Rolle danach

(A) Coder-Rückfragen hierher in den Chat kopieren, ich beantworte sie.

(B) Bei Meilenstein-Berichten testen. Besonders: nach dem Speichern in
    die Datenbank prüfen, ob das neue Lebensmittel/Gericht in der
    Datenbank-Liste erscheint und (nach Sync) in der Dropbox-CSV steht.

(C) Wenn Phase D grün ist: weiter mit Phase E (Multi-Achsen-Diagramm für
    Gewicht, Blutdruck, Kalorien etc. über Zeit).

---

## Test-Hinweis für Dich

Die Rechner sind gut nachprüfbar, weil die Beispielzahlen im Mockup
stehen:

(1) Alkohol: 40 ml, 40 Vol% → sollte 12,8 g Alkohol und 227 kcal/100g
    ergeben.

(2) Brühepulver: 16000 ml, 380 g, 5 kcal je 80 ml → 263 kcal/100g.

(3) Garfaktor Quelle→DB: 250 kcal gegart, Faktor 0,77 → 193 kcal roh.

(4) Garfaktor Aufschreibung: 150 g gegart, Faktor 0,77 → 195 g roh.

Wenn diese Zahlen stimmen, rechnen die Tools richtig.
