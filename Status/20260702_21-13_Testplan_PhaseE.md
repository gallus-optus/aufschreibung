# Testplan Phase E

## Voraussetzungen

- App ist live unter `https://gallus-optus.github.io/aufschreibung/` und
  auf dem Handy installiert; Phase F-Sync läuft.
- Es sind bereits einige Tage mit Erfassungen und Vitalwerten vorhanden
  (je mehr Tage, desto aussagekräftiger das Diagramm).
- **Nach dem Update App schließen und neu öffnen** (ggf. zweimal), damit
  der neue Cache (`v0.5`) geladen wird.

## Testfälle

### Test 1: Verlauf erreichbar
1. Tab **Mehr** → **„Verlauf ansehen (Diagramm)"**.
2. **Erwartet:** Die Verlauf-Ansicht öffnet im Hochformat: Zeitraum-Wahl
   oben, Dreh-Hinweis, darunter „Ausgewählte Werte (3 von 6)" mit
   Gewicht, Kalorien gesamt und Blutdruck systolisch (Standard).

### Test 2: Diagramm per Drehen (Kern-Test)
1. In der Verlauf-Ansicht das Handy **quer drehen** (Rotationssperre
   des Handys ggf. ausschalten).
2. **Erwartet:** Das Vollbild-Diagramm erscheint automatisch — Kurven
   mit Punkten, Y-Achse nur „tief/mittel/hoch", X-Achse mit Datum,
   Legende unten mit den Farben.
3. Zurück ins Hochformat drehen.
4. **Erwartet:** Die Auswahl-Ansicht erscheint wieder.
5. Falls das Drehen nicht erkannt wird: Knopf **„Diagramm im Vollbild
   zeigen"** nutzen (Rückfallebene; Schließen über das ✕ oben rechts).

### Test 3: Normalisierung
1. Gewicht (~84) und Kalorien (~2000) gleichzeitig aktiv haben, Diagramm
   ansehen.
2. **Erwartet:** Beide Kurven nutzen die volle Höhe (jede auf ihre
   eigene Spanne skaliert) — die Gewichtskurve ist KEIN flacher Strich
   am Boden. Keine absoluten Zahlen an der Y-Achse.

### Test 4: Punkt antippen (Kern-Test)
1. Im Diagramm auf einen Tag (oder in die Nähe) tippen.
2. **Erwartet:** Eine senkrechte gestrichelte Linie markiert den Tag;
   ein Feld zeigt Datum und die echten Werte aller aktiven Kurven mit
   Einheiten (z. B. „Gewicht 84,6 kg", „Kalorien 2210 kcal").
3. Denselben Tag erneut antippen.
4. **Erwartet:** Markierung und Feld verschwinden wieder.

### Test 5: Zeitraum-Wahl
1. Im Hochformat nacheinander **Woche / Monat / 3 Monate / Alles**
   antippen, jeweils ins Querformat drehen.
2. **Erwartet:** Der Diagramm-Titel und der dargestellte Zeitraum passen
   sich an; bei „Alles" beginnt die X-Achse am frühesten erfassten Tag.
3. Über **Von/Bis** einen freien Bereich wählen.
4. **Erwartet:** Das Diagramm zeigt genau diesen Bereich.

### Test 6: Werte-Auswahl, max. 6, FIFO
1. **„Weitere Werte wählen …"** → die Liste zeigt drei Gruppen
   (Vitalwerte / Ernährung / Kalorien pro Mahlzeit-Typ).
2. Werte an- und abwählen; aktive bekommen eine Farbe.
3. Sechs Werte aktivieren, dann einen **siebten** anhaken.
4. **Erwartet:** Der am längsten aktive Wert wird automatisch
   deaktiviert (oben steht weiterhin „6 von 6 aktiv"). Zwei aktive Werte
   haben nie dieselbe Farbe.

### Test 7: Lücken werden durchgezogen
1. Einen Wert aktiv haben, der nicht täglich gemessen wird (z. B.
   Bauchumfang).
2. **Erwartet:** Die Linie verbindet die vorhandenen Messtage direkt
   (keine Unterbrechung); an messfreien Tagen liegt kein Punkt.

### Test 8: Einstellungen bleiben erhalten
1. Zeitraum und Werte-Auswahl ändern, App komplett schließen und neu
   öffnen, Verlauf öffnen.
2. **Erwartet:** Zeitraum und Auswahl sind wie zuletzt eingestellt.

### Test 9: 06_Tagesaggregate.csv in Dropbox (Kern-Test)
1. Eine Mahlzeit erfassen, ~1 Minute warten oder Mehr → „Jetzt
   synchronisieren".
2. In der Dropbox-Web-Oberfläche `Apps/Aufschreibung-PWA/` öffnen.
3. **Erwartet:** Dort liegt `06_Tagesaggregate.csv`. Sie enthält eine
   Zeile pro Tag mit Erfassungen und die Spalten
   `datum;kcal_gesamt;trinkmenge_ml;…;kcal_trinken`.
4. Im Ordner `_backups/` nachsehen.
5. **Erwartet:** Es gibt KEINE Backup-Dateien für 06 (bewusst — die
   Datei ist jederzeit aus 03 reproduzierbar).

### Test 10: Excel öffnet 06 sauber
1. `06_Tagesaggregate.csv` am PC herunterladen und in Excel öffnen.
2. **Erwartet:** Spalten sauber getrennt (Semikolon), Dezimalzahlen mit
   Komma, Umlaute korrekt. Die Tagessummen entsprechen den Werten der
   Heute-Ansicht der jeweiligen Tage.

### Test 11: Aggregat-Werte stimmen
1. Für den heutigen Tag die Kalorien-Summe der Heute-Ansicht merken.
2. Im Verlauf „Kalorien gesamt" aktivieren, heutigen Tag antippen.
3. **Erwartet:** Der angezeigte kcal-Wert entspricht der Heute-Ansicht
   (±1 durch Rundung).

### Test 12: Bisherige Funktionen unverändert
1. Heute, Erfassen, Vitalwerte, Datenbank, Werkzeuge, Sync kurz
   durchklicken.
2. **Erwartet:** Alles läuft wie zuvor; unter Mehr heißt der Abschnitt
   jetzt „Auswertung & Werkzeuge" (Verlauf + Rechner).

## Bekannte Probleme oder Warnungen

- **06 wird nie heruntergeladen oder gemerged** — sie ist reiner Export
  für Excel. Manuelle Änderungen an 06 werden beim nächsten Sync
  überschrieben.
- **Vitalwerte stehen nicht in 06** (bewusst — sie liegen schon pro Tag
  in `04_Vitaldaten.csv`).
- **Erst-Import-Prüfung unverändert:** Die App verlangt weiterhin nur
  die fünf Dateien 01–05; 06 entsteht automatisch.
- Falls die **Dreh-Erkennung** auf dem Gerät nicht reagiert (z. B.
  Rotationssperre), den manuellen Vollbild-Knopf nutzen und das im
  Testergebnis vermerken.
