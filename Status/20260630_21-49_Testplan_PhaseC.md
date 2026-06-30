# Testplan Phase C

## Voraussetzungen

- Die App ist live unter `https://gallus-optus.github.io/aufschreibung/`
  und auf dem Handy installiert (aus Phase B2).
- In Dropbox liegen die fünf Dateien (aus Phase B2 schon vorhanden).
- **Wichtig nach dem Update:** Damit der neue Code und der neue
  Service-Worker-Cache (`v0.2`) geladen werden, die App einmal **schließen
  und neu öffnen** (ggf. zweimal). Falls etwas „alt“ aussieht: in den
  Browser-Einstellungen den Seiten-Cache leeren oder die Seite mit
  Neuladen aktualisieren.
- **Die bestehenden Daten bleiben erhalten** — der Update-Vorgang
  zerstört die lokale Datenbank nicht. Falls dennoch der Einrichtungs-
  Bildschirm erscheint: über „Mehr → Datenbank neu aufbauen“ neu laden.

## Testfälle

### Test 1: Update ohne Datenverlust
1. App nach dem Update öffnen.
2. Es erscheint direkt die neue **Heute**-Ansicht (nicht Anmeldung,
   nicht Einrichtung).
3. Unter **Datenbank** (unten) sind weiterhin alle Lebensmittel und
   Gerichte vorhanden.
4. **Erwartet:** Keine Neuanmeldung nötig, Stammdaten unverändert da.

### Test 2: Neue Navigation (5 Tabs)
1. Unten erscheinen fünf Einstiegspunkte: **Heute**, **Vitalwerte**,
   blauer **„+“**, **Datenbank**, **Mehr**.
2. Jeden Tab antippen.
3. **Erwartet:** Heute zeigt die Tagesbilanz, Vitalwerte das Formular,
   „+“ die Erfassen-Suche, Datenbank die Listen, Mehr die Einstellungen.
   Der aktive Tab ist blau markiert.

### Test 3: Erste Mahlzeit erfassen (Gramm)
1. Auf **„+“** tippen.
2. Oben **Lebensmittel** gewählt lassen, ins Suchfeld z. B. `brot`
   eingeben.
3. Einen Treffer antippen.
4. Menge `100`, Einheit **Gramm** lassen.
5. **Erwartet:** Die Ergebnis-Box zeigt sofort „… g · … kcal“.
6. Mahlzeit-Typ ist nach Uhrzeit vorbelegt, Uhrzeit ist gefüllt.
7. „Zur Aufschreibung hinzufügen“ tippen.
8. **Erwartet:** Zurück auf **Heute**, der Eintrag steht in seiner
   Mahlzeit-Gruppe, der Kalorien-Kreis ist gewachsen.

### Test 4: Einheit mit bekanntem Wert (Live-Berechnung)
1. „+“ → ein Lebensmittel wählen, für das schon eine Scheibe/Portion
   hinterlegt ist (z. B. das aus Test 5).
2. Menge `3`, Einheit **Scheibe** wählen.
3. **Erwartet:** Sofortige Umrechnung, z. B. „120 g · 264 kcal“, plus
   Hinweis „1 Scheibe = 40 g (gespeichert)“. **Kein** Popup.

### Test 5: Einheit ohne Wert → Popup (Kernfeature)
1. „+“ → ein Lebensmittel wählen, für das **noch keine** Portion
   hinterlegt ist.
2. Einheit **Portion** wählen.
3. **Erwartet:** Ein Popup erscheint: „Wie viel wiegt eine Portion?“.
4. Einen Wert eingeben (z. B. `90`), „Speichern und weiter“.
5. **Erwartet:** Popup schließt, Ergebnis-Box rechnet mit 90 g weiter.
6. Eintrag hinzufügen, danach erneut dasselbe Lebensmittel + Portion
   wählen.
7. **Erwartet:** **Kein** erneutes Popup — der Wert wird automatisch
   genutzt.

### Test 6: Popup abbrechen
1. „+“ → Lebensmittel wählen → Einheit ohne Wert wählen → Popup
   erscheint → **Abbrechen**.
2. **Erwartet:** Einheit springt zurück auf **Gramm**, kein Wert
   gespeichert.

### Test 7: Eigengericht erfassen
1. „+“ → oben auf **Gerichte** umschalten.
2. Ein Gericht suchen und wählen.
3. Menge `1`, Einheit **Portion** (falls noch kein Wert: Popup, Gewicht
   eingeben).
4. Hinzufügen.
5. **Erwartet:** Eintrag erscheint auf Heute, kcal passend zum Gericht.

### Test 8: Mahlzeit-Typ-Automatik
1. Beim Erfassen die **Uhrzeit** ändern (z. B. auf `08:00`, dann `13:00`,
   dann `19:00`).
2. **Erwartet:** Der Typ-Vorschlag ändert sich nicht automatisch beim
   Tippen der Uhrzeit (er wird beim Öffnen der Maske aus der aktuellen
   Zeit gesetzt). Der Typ ist jederzeit im Dropdown änderbar.
3. Hinweis: morgens (vor 10:30) → Morgens, 11:30–15:00 → Mittags,
   ab 18:00 → Abends, dazwischen → Zwischen.

### Test 9: Trinkmenge
1. „+“ → ein Getränk wählen (z. B. Wasser/Kaffee), Menge in Gramm/ml
   (1 ml ≈ 1 g), Mahlzeit-Typ auf **Trinken** stellen, hinzufügen.
2. **Erwartet:** Der Trinkmengen-Balken auf Heute wächst; die Anzeige
   zeigt z. B. „1,4 / 2,0 L“. Der Eintrag erscheint zusätzlich in einer
   Gruppe **Trinken** am Ende der Liste.

### Test 10: Eintrag bearbeiten
1. Auf Heute einen Eintrag antippen.
2. **Erwartet:** Die Maske öffnet vorbefüllt mit der **Original-Eingabe**
   (z. B. „3 Scheiben“, nicht „120 g“), Titel „Eintrag bearbeiten“,
   Knopf „Änderung speichern“.
3. Menge ändern, speichern.
4. **Erwartet:** Auf Heute ist der Wert aktualisiert, **kein** doppelter
   Eintrag.

### Test 11: Eintrag löschen
1. Eintrag antippen → unten **„Eintrag löschen“** → Rückfrage bestätigen.
2. **Erwartet:** Eintrag verschwindet von Heute, Kalorien-Kreis sinkt.

### Test 12: Kalorien-Kreis Farben
1. So viel erfassen, dass die Tagessumme über 2200 (gelb) bzw. über
   2400 (rot) steigt.
2. **Erwartet:** Der Ring wird gelb bzw. rot; der Hinweistext darunter
   passt sich an („… bis zum Tagesziel“ / „… überschritten“).

### Test 13: Vitalwerte speichern und überschreiben
1. Tab **Vitalwerte** → Gewicht z. B. `84,2`, ein paar weitere Felder
   füllen → „Vitalwerte speichern“.
2. Den Tab verlassen und wieder öffnen.
3. **Erwartet:** Die Werte sind vorbefüllt; Hinweis „Heutiger Eintrag
   geladen — Speichern überschreibt ihn.“
4. Einen Wert ändern, erneut speichern.
5. **Erwartet:** Beim nächsten Öffnen steht der geänderte Wert (ein
   Eintrag pro Tag).

### Test 14: Datenbank-Umschalter
1. Tab **Datenbank** → oben zwischen **Lebensmittel** und **Gerichte**
   umschalten.
2. **Erwartet:** Beide Listen funktionieren wie in Phase B2 (Suche,
   Chips, Detail-Ansichten). Der untere Tab „Datenbank“ bleibt aktiv.

### Test 15: Offene Änderungen
1. Nach einigen Erfassungen Tab **Mehr** öffnen.
2. **Erwartet:** Unter „Synchronisierung“ steht bei „Nicht hochgeladen“
   eine Zahl (z. B. „5 Änderungen“) — das ist die Vorbereitung für den
   späteren Dropbox-Upload (Phase F).

### Test 16: Offline-Betrieb
1. Flugmodus an.
2. Erfassen, bearbeiten, löschen, Vitalwerte speichern.
3. **Erwartet:** Alles funktioniert (lokale Datenbank). Nur ein echter
   Dropbox-Sync wäre offline nicht möglich (kommt erst in Phase F).

## Bekannte Probleme oder Warnungen

- **Kein Dropbox-Upload in Phase C.** „Jetzt synchronisieren“ und
  „Datenbank neu aufbauen“ laden weiterhin **von** Dropbox herunter —
  sie laden **nichts hoch**. Die erfassten Mahlzeiten/Vitalwerte bleiben
  vorerst nur auf dem Gerät.
- **Datenbank neu aufbauen ist sicher für Einheiten-Werte:** Selbst
  eingegebene Gewichte (z. B. „1 Portion = 690 g“) überstehen den
  Neuaufbau. Die erfassten Mahlzeiten/Vitalwerte bleiben ebenfalls
  erhalten (nur Stammdaten werden neu geladen).
- **Kalender-Knopf** (oben rechts auf Heute/Vitalwerte) ist noch ohne
  Funktion (Tagesnavigation kommt später).
- **Nur der heutige Tag** wird angezeigt und bearbeitet.
