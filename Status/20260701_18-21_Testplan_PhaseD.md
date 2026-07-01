# Testplan Phase D

## Voraussetzungen

- App ist live unter `https://gallus-optus.github.io/aufschreibung/` und
  auf dem Handy installiert.
- Die fünf Dateien liegen in Dropbox, Phase F läuft.
- **Nach dem Update App schließen und neu öffnen** (ggf. zweimal), damit
  der neue Cache (`v0.4`) geladen wird.

## Testfälle

### Test 1: Werkzeuge erreichbar
1. Tab **Mehr** → oben **„Rechner öffnen …"** antippen.
2. **Erwartet:** Die Werkzeuge-Übersicht mit fünf Rechnern erscheint.
   Jeder Rechner ist über seine Zeile erreichbar; der Zurück-Pfeil führt
   zurück nach Mehr.

### Test 2: Alkoholrechner
1. Werkzeuge → **Alkoholrechner**.
2. Menge `40`, Einheit `ml`, Alkoholgehalt `40`, Zusatz `0`.
3. **Erwartet:** Ergebnis **227 kcal** pro 100 g, „32,0 g reiner Alkohol
   pro 100 g", Zwischenwerte „12,8 g" und „91 kcal".
4. Name „Whiskey Single Malt" eingeben, Gruppe wählen → **In Datenbank
   speichern**.
5. **Erwartet:** Hinweis „Gespeichert …". Unter **Datenbank →
   Lebensmittel** taucht der Eintrag auf (mit 227 kcal).

### Test 3: Brühepulver-Rechner
1. Werkzeuge → **Brühepulver-Rechner**.
2. Gesamtmenge `16000`, Trockenmasse `380`, kcal `5`, je `80` ml.
3. **Erwartet:** **263 kcal** pro 100 g Trockenpulver, Gesamt „1000 kcal",
   „200" Portionen. Speichern legt ein Lebensmittel an.

### Test 4: Garfaktor Quelle → Datenbank
1. Werkzeuge → **Garfaktor: Quelle → Datenbank**.
2. kcal `250`, Eiweiß `30`, Fett `14`, Salz `0,2`, Garfaktor `0,77`.
3. **Erwartet:** **193 kcal** roh, Eiweiß „23,1 g", Fett „10,8 g", Salz
   „0,15 g". Speicherbar als „Rindersteak roh".

### Test 5: Garfaktor für die Aufschreibung
1. Werkzeuge → **Garfaktor: für die Aufschreibung**.
2. Ein rohes Lebensmittel wählen (z. B. das aus Test 4), gegartes Gewicht
   `150`, Garfaktor `0,77`.
3. **Erwartet:** Rohe Menge **195 g**, kcal/Nährwerte der Portion, plus
   Hinweis „Trage in der Aufschreibung 195 g … ein." **Kein**
   Speichern-Knopf für die Datenbank (reine Anzeige).

### Test 6: Rezeptrechner — neues Gericht
1. Werkzeuge → **Rezeptrechner**.
2. **Zutat hinzufügen** → ein Lebensmittel suchen, wählen, Menge in Gramm
   eingeben → **Hinzufügen**. Zwei bis drei Zutaten aufnehmen.
3. **Erwartet:** Rohmasse = Summe der Zutaten. Endgewicht ist automatisch
   = Rohmasse.
4. Endgewicht auf einen kleineren gewogenen Wert setzen (Wasser verkocht).
5. **Erwartet:** Die Nährwerte pro 100 g steigen (bezogen aufs Endgewicht).
6. Name eingeben, Kategorie wählen → **In Datenbank speichern**.
7. **Erwartet:** Hinweis „Gespeichert …". Unter **Datenbank → Gerichte**
   erscheint das neue Gericht mit den berechneten Werten (Detail zeigt den
   vollen Nährwert-Satz).

### Test 7: Rezeptrechner — Endgewicht folgt der Rohmasse
1. Im Rezeptrechner Endgewicht manuell ändern, dann eine Zutat entfernen
   oder hinzufügen.
2. **Erwartet:** Das Endgewicht springt auf die neue Rohmasse zurück
   (kann wieder überschrieben werden).

### Test 8: Rezeptrechner — bestehendes Rezept laden
1. **Bestehendes Rezept laden** → ein Gericht wählen.
2. **Erwartet:** Zutaten und Endgewicht werden geladen, Name als
   „… (Kopie)". Eine Zutat ergänzen, speichern.
3. **Erwartet:** Ein **neues** Gericht entsteht; das Original bleibt in der
   Gerichte-Liste unverändert.

### Test 9: Fehlende Zutat
1. Im Zutaten-Picker nach etwas suchen, das es nicht gibt.
2. **Erwartet:** Hinweis „Nicht gefunden? Lege das Lebensmittel erst in der
   Datenbank an."

### Test 10: Automatischer Upload (Phase-F-Sync)
1. Mit einem Rechner etwas in die Datenbank speichern.
2. Etwa eine Minute warten (oder Mehr → „Jetzt synchronisieren").
3. In Dropbox die betroffene Datei öffnen (`01_…` für Lebensmittel,
   `02_…` für Gerichte).
4. **Erwartet:** Der neue Eintrag steht in der Datei.

### Test 11: Neues Gericht auf zweitem Gerät (Kern-Test)
1. Auf **Gerät A** im Rezeptrechner ein Gericht anlegen, synchronisieren.
2. Auf **Gerät B** die App öffnen / „Jetzt synchronisieren".
3. **Erwartet:** Das neue Gericht erscheint auf Gerät B unter
   **Datenbank → Gerichte** (ohne „Datenbank neu aufbauen").

### Test 12: Bisherige Funktionen unverändert
1. Heute-Ansicht, Erfassen, Vitalwerte, Datenbank-Listen, Detail-Ansichten,
   Sync durchklicken.
2. **Erwartet:** Alles funktioniert wie zuvor; Eigengericht-Details zeigen
   jetzt zusätzlich Zucker, gesättigt/ungesättigt, Ballaststoffe.

## Bekannte Probleme oder Warnungen

- **Rechner legen immer NEUE Einträge an** — sie überschreiben keine
  bestehenden Lebensmittel/Gerichte.
- **Fehlende Zutat** muss erst über die Datenbank angelegt werden (nicht im
  Rezeptrechner).
- **Inhalte bestehender Gerichte** am PC ändern → mit „Datenbank neu
  aufbauen" übernehmen; der Sync merged nur neue Gerichte und Einheiten-
  Werte, keine Zutaten-Inhalte bestehender Gerichte.
- **Neue Lebensmittel aus den Rechnern** führen nur die eingegebenen Werte
  (Rest 0). Bei Bedarf können die restlichen Nährwerte später ergänzt
  werden (spätere Phase / manuell in der CSV).

---

## Nachtrag — Tests zur Nacharbeit (voller Satz, Rechner 5)

Nach dem Update App einmal schließen/neu öffnen (Cache **v0.4.1**).

### Test 13: Alkoholrechner mit Makros
1. Werkzeuge → Alkoholrechner. Menge `40` ml, Vol% `40`, alle weiteren
   Nährwerte `0` lassen.
2. **Erwartet:** weiterhin **227 kcal**, „kcal aus Alkohol 227", „kcal aus
   Makros 0".
3. Jetzt z. B. Eiweiß `1`, Kohlenhydrate `2`, Fett `3` eintragen.
4. **Erwartet:** kcal steigt auf **267** (227 + 40,2). Speichern legt ein
   Lebensmittel mit vollem Satz + `alkohol_g` an.

### Test 14: Brühepulver mit vollem Satz
1. Werkzeuge → Brühepulver. Gesamt `16000`, Trocken `380`, kcal `5`, je
   `80` ml → **263 kcal**.
2. Weitere Nährwerte „je Bezugsmenge" eintragen (z. B. Eiweiß `2`).
3. **Erwartet:** Der Wert wird mit demselben Faktor hochgerechnet und beim
   Speichern mit abgelegt.

### Test 15: Rechner 5 — Roh-Modus (wie bisher)
1. Werkzeuge → Garfaktor: für die Aufschreibung. Umschalter auf **„Roh in
   der DB"**. Ein rohes Lebensmittel wählen, gegartes Gewicht `150`,
   Garfaktor `0,77`.
2. **Erwartet:** Rohe Menge **195 g**, Portions-Nährwerte korrekt.

### Test 16: Rechner 5 — Gegart-Modus
1. Umschalter auf **„Gegart in der DB"**.
2. **Erwartet:** Das Garfaktor-Feld verschwindet. Gegartes Gewicht `150` →
   die Nährwerte werden direkt aus den (gegarten) DB-Werten für 150 g
   berechnet (keine Umrechnung).

### Test 17: Rechner 5 — In die Aufschreibung übernehmen
1. Im Rechner 5 (roh oder gegart) ein Lebensmittel + Gewicht eingeben.
2. **„In die Aufschreibung übernehmen"** antippen.
3. **Erwartet:** Die Erfassen-Maske öffnet vorbefüllt (Lebensmittel +
   berechnete Menge in Gramm). Mahlzeit-Typ/Uhrzeit sind vorbelegt; nach
   Bestätigung erscheint der Eintrag normal in der Heute-Ansicht.

### Test 18: Rechner 5 — Gegen-Form speichern
1. Roh-Modus, Lebensmittel „… roh" gewählt → Namensvorschlag endet auf
   **„gegart"**. **„In Datenbank speichern"** antippen.
2. **Erwartet:** Ein neues Lebensmittel „… gegart" mit den konzentrierten
   Werten (roh ÷ Garfaktor) erscheint in der Datenbank. Umgekehrt legt der
   Gegart-Modus die rohe Form an. Beide dürfen nebeneinander existieren.
