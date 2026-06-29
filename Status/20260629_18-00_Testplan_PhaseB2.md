# Testplan Phase B2

## Voraussetzungen

1. Die fünf Dateien aus Phase A liegen im Dropbox-App-Ordner
   `Apps/Aufschreibung-PWA/`:
   - `01_Stammdaten_Lebensmittel.csv`
   - `02_Stammdaten_Eigengerichte.csv`
   - `03_Erfassung.csv`
   - `04_Vitaldaten.csv`
   - `05_Konfiguration.json`

2. Android-Chrome auf dem Handy geöffnet.

3. Internet-Verbindung aktiv.

---

## Testfälle

### Test 1: Anmelde-Bildschirm

1. Öffne `https://gallus-optus.github.io/aufschreibung/` in Chrome auf dem Handy.
2. **Erwartet:** Anmelde-Bildschirm mit blauem "A"-Logo, Titel "Aufschreibung",
   Untertitel "Ernährung und Vitalwerte" und blauem Knopf "Mit Dropbox verbinden".
3. **Erwartet:** Hinweistext über den App-Ordner sichtbar.

---

### Test 2: PWA-Installation

1. Tippe auf das Browser-Menü (⋮ rechts oben in Chrome).
2. Wähle "Zum Startbildschirm hinzufügen" (oder "App installieren").
3. **Erwartet:** Installations-Dialog erscheint mit App-Name "Aufschreibung"
   und blauem "A"-Icon.
4. Bestätige die Installation.
5. **Erwartet:** App-Icon erscheint auf dem Startbildschirm.
6. Öffne die App vom Startbildschirm aus.
7. **Erwartet:** App öffnet im Vollbild ohne Browser-Adressleiste.

---

### Test 3: Dropbox-Anmeldung

1. Tippe auf "Mit Dropbox verbinden".
2. **Erwartet:** Browser öffnet die Dropbox-Anmeldeseite.
3. Melde Dich mit Deinen Dropbox-Zugangsdaten an (falls noch nicht angemeldet).
4. Erteile der App die angeforderte Berechtigung.
5. **Erwartet:** Zurück in der App — entweder Bildschirm 2 (Erst-Import)
   oder direkt Bildschirm 3 (Lebensmittel-Liste wenn IndexedDB schon Daten hat).

---

### Test 4: Erst-Import — Dateien-Prüfung

*Nur relevant beim ersten Mal oder nach "Datenbank neu aufbauen".*

1. Nach dem Login erscheint der Einrichtungs-Bildschirm.
2. **Erwartet:** E-Mail-Adresse des angemeldeten Kontos erscheint.
3. **Erwartet:** Alle fünf Dateien zeigen ein grünes Häkchen ✅
   (wenn die Dateien in Dropbox hochgeladen sind).
4. Wenn ein Kreuz ❌ erscheint: Datei in Dropbox hochladen, dann "Erneut prüfen"
   antippen.
5. **Erwartet nach grünen Häkchen:** Ladebalken erscheint, Daten werden
   heruntergeladen, danach automatischer Wechsel zur Lebensmittel-Liste.

---

### Test 5: Lebensmittel-Liste Grundanzeige

1. Lebensmittel-Liste ist geöffnet (Tab "Lebensmittel" aktiv).
2. **Erwartet:** Header "Lebensmittel" oben.
3. **Erwartet:** Suchfeld mit Lupen-Icon.
4. **Erwartet:** Chip-Reihe mit "Alle (597)" und den Gruppen-Chips.
5. **Erwartet:** Liste mit Lebensmitteln, nach Gruppen gegliedert.
6. **Erwartet:** Jeder Eintrag zeigt Name links, kcal/100g rechts.
7. Zähle ungefähr nach: Es müssen etwa 597 Einträge sein (Gesamt-Chip).

---

### Test 6: Suche in Lebensmitteln

1. Tippe "brot" ins Suchfeld.
2. **Erwartet:** Liste filtert live — nur Einträge mit "brot" im Namen
   oder der Bemerkung erscheinen. Diverse Brot-Produkte sollten sichtbar sein.
3. Lösche die Suche (× im Suchfeld oder alles löschen).
4. **Erwartet:** Alle 597 Einträge wieder sichtbar.

---

### Test 7: Gruppen-Filter

1. Tippe auf einen Gruppen-Chip (z. B. "Fleisch & Fisch").
2. **Erwartet:** Chip wird blau hervorgehoben, Liste zeigt nur diese Gruppe.
3. Tippe auf "Alle".
4. **Erwartet:** Alle Einträge wieder sichtbar.

---

### Test 8: Detail-Ansicht Lebensmittel

1. Tippe in der Liste auf "Brötchen" oder ein beliebiges Lebensmittel.
2. **Erwartet:** Detail-Ansicht öffnet sich mit:
   - Header: Zurück-Pfeil links, Lebensmittel-Name rechts
   - Blauer Hero-Bereich mit großer kcal-Zahl und Gruppen-Pille
   - Sektion "Makronährwerte (pro 100 g)" mit Eiweiß, KH, Zucker, Fett,
     gesättigt, ungesättigt
   - Sektion "Weitere Werte" mit Salz und Ballaststoffen
   - Sektion "Kennung" mit LM-ID in Mono-Schrift
3. Tippe den Zurück-Pfeil an.
4. **Erwartet:** Zurück zur Lebensmittel-Liste.

---

### Test 9: Tab-Wechsel zu Gerichte

1. Tippe auf den Tab "Gerichte" in der unteren Tab-Leiste.
2. **Erwartet:** Gerichte-Liste erscheint ohne Neuladen.
3. **Erwartet:** "Alle (221)" im ersten Chip — 221 Eigengerichte.
4. **Erwartet:** Einträge nach Kategorie gruppiert, Name links, kcal rechts.

---

### Test 10: Suche in Gerichten

1. Tippe "kartoffel" ins Suchfeld der Gerichte-Liste.
2. **Erwartet:** Gerichte mit "kartoffel" im Namen erscheinen (z. B.
   "Quetschkartoffeln 01").

---

### Test 11: Detail-Ansicht Eigengericht

1. Tippe auf "Quetschkartoffeln 01" (oder ein anderes Gericht mit
   vielen Zutaten).
2. **Erwartet:** Detail-Ansicht mit:
   - Hero-Bereich: kcal pro 100g (berechnet), Kategorie-Pille
   - Sektion "Berechnete Nährwerte" mit Eiweiß, KH, Fett, Salz
   - Sektion "Endgewicht der Portion" mit Gewicht in g
   - Sektion "Zutaten (N)" — jede Zutat mit LM-ID, Name und Menge in g
3. Tippe auf eine Zutat in der Liste.
4. **Erwartet:** Spring zur Detail-Ansicht dieses Lebensmittels.
5. Tippe Zurück.
6. **Erwartet:** Zurück zum Gerichte-Detail.

---

### Test 12: Einstellungen

1. Tippe auf den Tab "Einstellungen".
2. **Erwartet:** Vier Abschnitte: Konto, Synchronisierung, Lokale Datenbank, Über.
3. **Erwartet im Abschnitt "Konto":** Deine Dropbox-E-Mail-Adresse steht dort.
4. **Erwartet im Abschnitt "Lokale Datenbank":** "Lebensmittel: 597",
   "Eigengerichte: 221".
5. **Erwartet im Abschnitt "Über":** Version "0.1 (Phase B)" und GitHub-Link.

---

### Test 13: Jetzt synchronisieren

1. Tippe in den Einstellungen auf "Jetzt synchronisieren".
2. **Erwartet:** Knopf wird deaktiviert, Text ändert sich zu "Synchronisiere…".
3. **Erwartet nach Abschluss:** Knopf wieder aktiv, Sync-Zeit aktualisiert
   ("Gerade eben" oder "vor 0 Min").

---

### Test 14: Datenbank neu aufbauen

1. Tippe auf "Datenbank neu aufbauen".
2. **Erwartet:** Browser-Bestätigungs-Dialog erscheint.
3. Bestätige mit OK.
4. **Erwartet:** Daten werden neu geladen, danach Einstellungen neu angezeigt
   mit korrekten Zählern.

---

### Test 15: Abmelden

1. Tippe auf "Von Dropbox abmelden" (roter Knopf).
2. **Erwartet:** App springt zum Anmelde-Bildschirm zurück.
3. **Erwartet:** Die Lebensmittel-Daten sind NOCH in IndexedDB (nicht gelöscht).
4. Tippe erneut auf "Mit Dropbox verbinden" und melde Dich an.
5. **Erwartet:** Direkt zur Lebensmittel-Liste (kein Erst-Import, da Daten
   noch da sind).

---

### Test 16: Offline-Betrieb

1. Verbinde Dich einmal vollständig (alle Daten geladen, Lebensmittel-Liste sichtbar).
2. Aktiviere auf dem Handy den Flugmodus.
3. Schließe die App vollständig.
4. Öffne die App erneut vom Startbildschirm.
5. **Erwartet:** Lebensmittel-Liste erscheint normal (aus IndexedDB und Cache).
6. **Erwartet:** Suche und Filter funktionieren.
7. Navigiere zu Einstellungen → "Jetzt synchronisieren".
8. **Erwartet:** Fehlermeldung "Keine Internetverbindung — Synchronisierung
   nicht möglich." erscheint oben.

---

## Bekannte Probleme oder Warnungen

- **Erster Service-Worker-Start:** Nach dem allerersten Öffnen der App
  ist der Service Worker möglicherweise noch nicht aktiv. Die App
  funktioniert trotzdem, aber erst nach einem zweiten Öffnen ist
  der Offline-Modus zuverlässig.

- **OAuth-Redirect lokal nicht testbar:** Der Anmelde-Flow funktioniert
  nur auf `https://gallus-optus.github.io/aufschreibung/`. Ein lokaler
  Test mit Datei-URL oder localhost schlägt beim Redirect fehl — das ist
  erwartet und kein Fehler.

- **Eigengerichte mit UNBEKANNT-Zutaten:** Falls ein Gericht eine Zutat
  mit `lebensmittel_id = UNBEKANNT` enthält, erscheint in der Gerichte-Liste
  ein "*" hinter dem kcal-Wert und in der Detail-Ansicht eine gelbe
  Warnung. Das ist korrekt so.
