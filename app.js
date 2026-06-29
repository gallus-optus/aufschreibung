/* ================================================================
   app.js — Hauptlogik der "Aufschreibung"-PWA

   Aufbau:
   1. Konstanten und Konfiguration
   2. IndexedDB-Hilfsfunktionen
   3. Dropbox OAuth 2.0 + PKCE (Anmeldung, Token-Erneuerung)
   4. Dropbox-API-Aufrufe (Konto, Dateien)
   5. CSV-Parser und Daten-Import
   6. Mini-Router (Hash-basiert)
   7. Bildschirm-Renderer (Anmeldung, Erst-Import, Listen, Details,
      Einstellungen)
   8. Service-Worker-Registrierung
   9. App-Start
   ================================================================ */

'use strict';

/* ----------------------------------------------------------------
   1. KONSTANTEN UND KONFIGURATION
   ---------------------------------------------------------------- */

/* Dropbox-App-Schlüssel (öffentlich, kein Secret — PKCE-Flow) */
const DROPBOX_APP_KEY = 'iumuxlea7y2s3rt';

/* Redirect-URI: nur die GitHub-Pages-URL ist in der Dropbox-App
   eingetragen. Bei lokalem Test mit localhost kommt man zum
   Anmelde-Bildschirm, aber der Redirect schlägt fehl — das ist
   erwartet und in Ordnung für Phase B2. */
const REDIRECT_URI = 'https://gallus-optus.github.io/aufschreibung/';

/* Dropbox-API-Endpunkte */
const DROPBOX_AUTH_URL   = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL  = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_API_URL    = 'https://api.dropboxapi.com/2/';
const DROPBOX_CONTENT_URL= 'https://content.dropboxapi.com/2/';

/* Die fünf Dateien, die im App-Ordner liegen müssen */
const ERWARTETETE_DATEIEN = [
  '01_Stammdaten_Lebensmittel.csv',
  '02_Stammdaten_Eigengerichte.csv',
  '03_Erfassung.csv',
  '04_Vitaldaten.csv',
  '05_Konfiguration.json',
];

/* IndexedDB-Datenbankname und -Version */
const DB_NAME    = 'aufschreibung-db';
const DB_VERSION = 1;

/* ----------------------------------------------------------------
   2. INDEXEDDB-HILFSFUNKTIONEN

   Promise-basierte Wrapper um die ereignisgesteuerte IndexedDB-API.
   Alle Funktionen geben Promises zurück, damit wir async/await
   verwenden können.
   ---------------------------------------------------------------- */

/* Globale Referenz auf die geöffnete Datenbank */
let db = null;

/**
 * Öffnet die IndexedDB und legt bei Bedarf die Object Stores an.
 * Muss vor allen anderen DB-Funktionen einmalig aufgerufen werden.
 */
function datenbankOeffnen() {
  return new Promise((resolve, reject) => {
    const anfrage = indexedDB.open(DB_NAME, DB_VERSION);

    /* Wird aufgerufen wenn die DB neu angelegt oder upgegradet wird */
    anfrage.onupgradeneeded = (ereignis) => {
      const datenbankInstanz = ereignis.target.result;

      /* Konfiguration und Sync-Status */
      if (!datenbankInstanz.objectStoreNames.contains('meta')) {
        datenbankInstanz.createObjectStore('meta', { keyPath: 'schluessel' });
      }
      /* Dropbox-Tokens */
      if (!datenbankInstanz.objectStoreNames.contains('auth')) {
        datenbankInstanz.createObjectStore('auth', { keyPath: 'schluessel' });
      }
      /* Lebensmittel-Stammdaten — Schlüssel ist lebensmittel_id */
      if (!datenbankInstanz.objectStoreNames.contains('lebensmittel')) {
        datenbankInstanz.createObjectStore('lebensmittel', { keyPath: 'lebensmittel_id' });
      }
      /* Eigengericht-Kopfdaten — Schlüssel ist gericht_id */
      if (!datenbankInstanz.objectStoreNames.contains('eigengerichte')) {
        datenbankInstanz.createObjectStore('eigengerichte', { keyPath: 'gericht_id' });
      }
      /* Zutaten der Eigengerichte */
      if (!datenbankInstanz.objectStoreNames.contains('zutaten')) {
        const zutatenStore = datenbankInstanz.createObjectStore('zutaten', { autoIncrement: true });
        zutatenStore.createIndex('nach_gericht_id', 'gericht_id', { unique: false });
      }
      /* App-Konfiguration aus 05_Konfiguration.json */
      if (!datenbankInstanz.objectStoreNames.contains('konfiguration')) {
        datenbankInstanz.createObjectStore('konfiguration', { keyPath: 'schluessel' });
      }
      /* Erfassungs- und Vitaldaten: Schema schon anlegen, aber in Phase B2 leer */
      if (!datenbankInstanz.objectStoreNames.contains('erfassung')) {
        datenbankInstanz.createObjectStore('erfassung', { keyPath: 'erfassungs_id' });
      }
      if (!datenbankInstanz.objectStoreNames.contains('vitaldaten')) {
        datenbankInstanz.createObjectStore('vitaldaten', { keyPath: 'datum' });
      }
    };

    anfrage.onsuccess = (ereignis) => {
      db = ereignis.target.result;
      resolve(db);
    };

    anfrage.onerror = (ereignis) => {
      reject(new Error('IndexedDB konnte nicht geöffnet werden: ' + ereignis.target.error));
    };
  });
}

/**
 * Liest einen einzelnen Wert aus einem Object Store.
 * @param {string} storeName - Name des Object Store
 * @param {*} schluessel - Der Primärschlüssel
 * @returns {Promise<any>} - Das gefundene Objekt oder undefined
 */
function dbLesen(storeName, schluessel) {
  return new Promise((resolve, reject) => {
    const transaktion = db.transaction(storeName, 'readonly');
    const store = transaktion.objectStore(storeName);
    const anfrage = store.get(schluessel);
    anfrage.onsuccess = () => resolve(anfrage.result);
    anfrage.onerror = () => reject(anfrage.error);
  });
}

/**
 * Schreibt einen Wert in einen Object Store (legt an oder überschreibt).
 * @param {string} storeName - Name des Object Store
 * @param {*} wert - Das zu speichernde Objekt
 * @returns {Promise<void>}
 */
function dbSchreiben(storeName, wert) {
  return new Promise((resolve, reject) => {
    const transaktion = db.transaction(storeName, 'readwrite');
    const store = transaktion.objectStore(storeName);
    const anfrage = store.put(wert);
    anfrage.onsuccess = () => resolve();
    anfrage.onerror = () => reject(anfrage.error);
  });
}

/**
 * Löscht einen Wert aus einem Object Store.
 * @param {string} storeName - Name des Object Store
 * @param {*} schluessel - Der Primärschlüssel
 */
function dbLoeschen(storeName, schluessel) {
  return new Promise((resolve, reject) => {
    const transaktion = db.transaction(storeName, 'readwrite');
    const store = transaktion.objectStore(storeName);
    const anfrage = store.delete(schluessel);
    anfrage.onsuccess = () => resolve();
    anfrage.onerror = () => reject(anfrage.error);
  });
}

/**
 * Liest alle Einträge aus einem Object Store.
 * @param {string} storeName - Name des Object Store
 * @returns {Promise<Array>}
 */
function dbAllesLesen(storeName) {
  return new Promise((resolve, reject) => {
    const transaktion = db.transaction(storeName, 'readonly');
    const store = transaktion.objectStore(storeName);
    const anfrage = store.getAll();
    anfrage.onsuccess = () => resolve(anfrage.result);
    anfrage.onerror = () => reject(anfrage.error);
  });
}

/**
 * Zählt alle Einträge in einem Object Store.
 * @param {string} storeName - Name des Object Store
 * @returns {Promise<number>}
 */
function dbZaehlen(storeName) {
  return new Promise((resolve, reject) => {
    const transaktion = db.transaction(storeName, 'readonly');
    const store = transaktion.objectStore(storeName);
    const anfrage = store.count();
    anfrage.onsuccess = () => resolve(anfrage.result);
    anfrage.onerror = () => reject(anfrage.error);
  });
}

/**
 * Löscht alle Einträge aus einem Object Store (der Store selbst bleibt).
 * @param {string} storeName - Name des Object Store
 */
function dbAllesLoeschen(storeName) {
  return new Promise((resolve, reject) => {
    const transaktion = db.transaction(storeName, 'readwrite');
    const store = transaktion.objectStore(storeName);
    const anfrage = store.clear();
    anfrage.onsuccess = () => resolve();
    anfrage.onerror = () => reject(anfrage.error);
  });
}

/**
 * Liest alle Einträge aus einem Index (z. B. alle Zutaten eines Gerichts).
 * @param {string} storeName - Name des Object Store
 * @param {string} indexName - Name des Index
 * @param {*} schluessel - Der Indexschlüssel
 * @returns {Promise<Array>}
 */
function dbIndexLesen(storeName, indexName, schluessel) {
  return new Promise((resolve, reject) => {
    const transaktion = db.transaction(storeName, 'readonly');
    const store = transaktion.objectStore(storeName);
    const index = store.index(indexName);
    const anfrage = index.getAll(schluessel);
    anfrage.onsuccess = () => resolve(anfrage.result);
    anfrage.onerror = () => reject(anfrage.error);
  });
}

/**
 * Schreibt viele Datensätze auf einmal in einen Object Store.
 * Deutlich schneller als viele einzelne dbSchreiben()-Aufrufe,
 * weil alles in einer einzigen Transaktion passiert.
 * @param {string} storeName - Name des Object Store
 * @param {Array} eintraege - Array der zu speichernden Objekte
 */
function dbMassenSchreiben(storeName, eintraege) {
  return new Promise((resolve, reject) => {
    const transaktion = db.transaction(storeName, 'readwrite');
    const store = transaktion.objectStore(storeName);

    transaktion.oncomplete = () => resolve();
    transaktion.onerror = () => reject(transaktion.error);

    for (const eintrag of eintraege) {
      store.put(eintrag);
    }
  });
}

/* ----------------------------------------------------------------
   3. DROPBOX OAUTH 2.0 + PKCE

   PKCE = Proof Key for Code Exchange. Sicherheitsprotokoll für
   öffentliche Clients (Apps ohne App Secret). Ablauf:
   1. Code Verifier zufällig erzeugen und lokal speichern
   2. Code Challenge = SHA-256-Hash des Verifiers, Base64-URL-kodiert
   3. Authorization-URL aufrufen mit Code Challenge
   4. Dropbox leitet nach Login zur Redirect-URI zurück (mit Code)
   5. Token-Exchange: Code + Code Verifier gegen Access+Refresh Token
   ---------------------------------------------------------------- */

/**
 * Erzeugt eine kryptographisch zufällige Zeichenkette für den
 * PKCE Code Verifier (43–128 Zeichen, URL-sicher).
 */
function pkceCodeVerifierErzeugen() {
  const zeichen = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const zufallsBytes = crypto.getRandomValues(new Uint8Array(64));
  return Array.from(zufallsBytes)
    .map(b => zeichen[b % zeichen.length])
    .join('');
}

/**
 * Berechnet den PKCE Code Challenge (SHA-256 → Base64-URL-kodiert).
 * @param {string} verifier - Der zuvor erzeugte Code Verifier
 * @returns {Promise<string>} - Der Code Challenge
 */
async function pkceCodeChallengeBerechnen(verifier) {
  const encoder = new TextEncoder();
  const daten = encoder.encode(verifier);
  const hashPuffer = await crypto.subtle.digest('SHA-256', daten);
  /* Base64-URL-Kodierung: kein Padding, + → -, / → _ */
  return btoa(String.fromCharCode(...new Uint8Array(hashPuffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Startet den OAuth-PKCE-Flow: leitet den Nutzer zur Dropbox-
 * Anmeldeseite weiter. Code Verifier und State werden in
 * sessionStorage gespeichert, damit nach dem Redirect darauf
 * zugegriffen werden kann.
 */
async function dropboxAnmeldenStarten() {
  const codeVerifier = pkceCodeVerifierErzeugen();
  const codeChallenge = await pkceCodeChallengeBerechnen(codeVerifier);

  /* Zufälliger State-Wert zum Schutz vor CSRF */
  const state = pkceCodeVerifierErzeugen().substring(0, 16);

  /* Zwischenspeichern für den Redirect-Callback */
  sessionStorage.setItem('pkce_code_verifier', codeVerifier);
  sessionStorage.setItem('pkce_state', state);

  const parameter = new URLSearchParams({
    client_id:             DROPBOX_APP_KEY,
    response_type:         'code',
    redirect_uri:          REDIRECT_URI,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
    state:                 state,
    token_access_type:     'offline',   /* Refresh Token anfordern */
  });

  window.location.href = `${DROPBOX_AUTH_URL}?${parameter.toString()}`;
}

/**
 * Wird nach dem Redirect von Dropbox aufgerufen.
 * Tauscht den Authorization Code gegen Access- und Refresh-Token.
 * @param {string} code - Der Authorization Code aus der URL
 * @param {string} state - Der zurückgegebene State-Wert
 */
async function dropboxTokenEintauschen(code, state) {
  /* State-Prüfung gegen CSRF */
  const gespeicherterState = sessionStorage.getItem('pkce_state');
  if (state !== gespeicherterState) {
    throw new Error('Sicherheitsprüfung fehlgeschlagen: State stimmt nicht überein.');
  }

  const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
  if (!codeVerifier) {
    throw new Error('Code Verifier nicht gefunden — bitte erneut anmelden.');
  }

  const antwort = await fetch(DROPBOX_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type:    'authorization_code',
      client_id:     DROPBOX_APP_KEY,
      redirect_uri:  REDIRECT_URI,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!antwort.ok) {
    const fehlerText = await antwort.text();
    throw new Error('Token-Austausch fehlgeschlagen: ' + fehlerText);
  }

  const tokenDaten = await antwort.json();

  /* Tokens in IndexedDB speichern */
  await dbSchreiben('auth', {
    schluessel:     'tokens',
    access_token:   tokenDaten.access_token,
    refresh_token:  tokenDaten.refresh_token,
    ablauf_zeit_ms: Date.now() + (tokenDaten.expires_in * 1000),
  });

  /* Temporäre PKCE-Daten aufräumen */
  sessionStorage.removeItem('pkce_code_verifier');
  sessionStorage.removeItem('pkce_state');
}

/**
 * Lädt die gespeicherten Tokens aus der IndexedDB.
 * @returns {Promise<Object|null>} - Die Token-Daten oder null
 */
async function tokensLaden() {
  return dbLesen('auth', 'tokens');
}

/**
 * Erneuert den Access Token mit dem Refresh Token.
 * Wird aufgerufen wenn der Access Token abgelaufen ist.
 * @param {string} refreshToken - Der gespeicherte Refresh Token
 * @returns {Promise<string>} - Der neue Access Token
 */
async function accessTokenErneuern(refreshToken) {
  const antwort = await fetch(DROPBOX_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     DROPBOX_APP_KEY,
    }).toString(),
  });

  if (!antwort.ok) {
    throw new Error('Token-Erneuerung fehlgeschlagen.');
  }

  const tokenDaten = await antwort.json();

  /* Neuen Access Token speichern (Refresh Token bleibt gleich) */
  const aktuelleTokens = await tokensLaden();
  await dbSchreiben('auth', {
    ...aktuelleTokens,
    access_token:   tokenDaten.access_token,
    ablauf_zeit_ms: Date.now() + (tokenDaten.expires_in * 1000),
  });

  return tokenDaten.access_token;
}

/**
 * Gibt den gültigen Access Token zurück.
 * Wenn der Token fast abgelaufen ist (< 5 Minuten Restlaufzeit),
 * wird er automatisch mit dem Refresh Token erneuert.
 * @returns {Promise<string>} - Ein gültiger Access Token
 */
async function gueltigesAccessTokenHolen() {
  const tokens = await tokensLaden();

  if (!tokens) {
    throw new Error('Nicht angemeldet.');
  }

  /* Noch mindestens 5 Minuten gültig? Dann direkt verwenden. */
  const fuenfMinutenInMs = 5 * 60 * 1000;
  if (tokens.ablauf_zeit_ms && Date.now() < tokens.ablauf_zeit_ms - fuenfMinutenInMs) {
    return tokens.access_token;
  }

  /* Token abgelaufen oder läuft bald ab — mit Refresh Token erneuern */
  if (tokens.refresh_token) {
    return accessTokenErneuern(tokens.refresh_token);
  }

  throw new Error('Token abgelaufen und kein Refresh Token vorhanden — bitte erneut anmelden.');
}

/* ----------------------------------------------------------------
   4. DROPBOX-API-AUFRUFE

   Hilfsfunktion für JSON-API-Aufrufe zu api.dropboxapi.com und
   Datei-Downloads von content.dropboxapi.com.
   Bei 401-Antworten wird der Token automatisch erneuert und der
   Aufruf einmal wiederholt.
   ---------------------------------------------------------------- */

/**
 * Sendet einen POST-Aufruf an die Dropbox JSON-API.
 * @param {string} endpunkt - API-Endpunkt, z. B. "users/get_current_account"
 * @param {Object} nutzlast - Das JSON-Body-Objekt (leer = null senden)
 * @param {boolean} wiederholungsVersuch - Intern: ist das schon ein Retry?
 */
async function dropboxApiAufruf(endpunkt, nutzlast = null, wiederholungsVersuch = false) {
  const token = await gueltigesAccessTokenHolen();

  /* Kopfzeilen aufbauen. Wichtig: Bei Endpunkten OHNE Argumente
     (z. B. users/get_current_account) darf KEIN Content-Type und
     KEIN Body gesendet werden — sonst antwortet Dropbox mit einem
     JSON-Decodier-Fehler. Nur wenn es eine Nutzlast gibt, schicken
     wir application/json mit. */
  const kopfzeilen = {
    'Authorization': 'Bearer ' + token,
  };

  const fetchOptionen = { method: 'POST', headers: kopfzeilen };

  if (nutzlast !== null) {
    kopfzeilen['Content-Type'] = 'application/json';
    fetchOptionen.body = JSON.stringify(nutzlast);
  }

  const antwort = await fetch(DROPBOX_API_URL + endpunkt, fetchOptionen);

  if (antwort.status === 401 && !wiederholungsVersuch) {
    /* Token ungültig — einmal erneuern und nochmals versuchen */
    const tokens = await tokensLaden();
    if (tokens && tokens.refresh_token) {
      await accessTokenErneuern(tokens.refresh_token);
      return dropboxApiAufruf(endpunkt, nutzlast, true);
    }
  }

  if (!antwort.ok) {
    const fehlerText = await antwort.text();
    throw new Error(`Dropbox-API-Fehler (${antwort.status}): ${fehlerText}`);
  }

  return antwort.json();
}

/**
 * Lädt eine Datei aus dem Dropbox-App-Ordner herunter.
 * @param {string} dateiPfad - Pfad relativ zum App-Ordner,
 *   z. B. "/01_Stammdaten_Lebensmittel.csv"
 * @returns {Promise<string>} - Dateiinhalt als Text
 */
async function dropboxDateiHerunterladen(dateiPfad, wiederholungsVersuch = false) {
  const token = await gueltigesAccessTokenHolen();

  const antwort = await fetch(DROPBOX_CONTENT_URL + 'files/download', {
    method: 'POST',
    headers: {
      'Authorization':   'Bearer ' + token,
      'Dropbox-API-Arg': JSON.stringify({ path: dateiPfad }),
    },
  });

  if (antwort.status === 401 && !wiederholungsVersuch) {
    const tokens = await tokensLaden();
    if (tokens && tokens.refresh_token) {
      await accessTokenErneuern(tokens.refresh_token);
      return dropboxDateiHerunterladen(dateiPfad, true);
    }
  }

  if (!antwort.ok) {
    const fehlerText = await antwort.text();
    throw new Error(`Download fehlgeschlagen für ${dateiPfad} (${antwort.status}): ${fehlerText}`);
  }

  return antwort.text();
}

/**
 * Ruft Konto-Infos des angemeldeten Nutzers ab.
 * @returns {Promise<Object>} - Konto-Objekt mit email, display_name, etc.
 */
async function dropboxKontoInfoHolen() {
  return dropboxApiAufruf('users/get_current_account');
}

/**
 * Ruft Speicherplatz-Nutzung des Kontos ab.
 * @returns {Promise<Object>} - Objekt mit used und allocated
 */
async function dropboxSpeicherInfoHolen() {
  return dropboxApiAufruf('users/get_space_usage');
}

/**
 * Listet alle Dateien im App-Ordner auf.
 * @returns {Promise<Array>} - Array mit Datei-Einträgen
 */
async function dropboxDateienAuflisten() {
  const ergebnis = await dropboxApiAufruf('files/list_folder', { path: '' });
  return ergebnis.entries || [];
}

/* ----------------------------------------------------------------
   5. CSV-PARSER UND DATEN-IMPORT

   Eigener CSV-Parser für die deutschen Excel-Dateien:
   - Trennzeichen: Semikolon
   - Dezimaltrennzeichen: Komma (wird beim Lesen in Punkt umgewandelt)
   - Encoding: UTF-8 mit BOM (BOM wird entfernt)
   ---------------------------------------------------------------- */

/**
 * Wandelt eine CSV-Zeichenkette in ein Array von Objekten um.
 * Die erste Zeile wird als Kopfzeile (Spaltennamen) verwendet.
 * @param {string} csvText - Der gesamte CSV-Inhalt als Text
 * @returns {Array<Object>} - Array mit einem Objekt pro Datenzeile
 */
function csvParsen(csvText) {
  /* BOM (Byte Order Mark) am Anfang entfernen, falls vorhanden */
  const bereinigt = csvText.replace(/^﻿/, '');
  const zeilen = bereinigt.split('\n').filter(z => z.trim() !== '');

  if (zeilen.length < 2) return [];

  /* Kopfzeile: Spaltennamen extrahieren */
  const kopfzeile = zeilen[0].split(';').map(s => s.trim());

  const ergebnis = [];
  for (let i = 1; i < zeilen.length; i++) {
    const felder = zeilen[i].split(';');
    const objekt = {};
    kopfzeile.forEach((spalte, index) => {
      objekt[spalte] = (felder[index] || '').trim();
    });
    ergebnis.push(objekt);
  }

  return ergebnis;
}

/**
 * Wandelt einen deutschen Dezimalwert (Komma) in eine Zahl um.
 * Leere Strings werden zu 0. "1,5" → 1.5, "100" → 100.
 * @param {string} wert - Der Wert als Zeichenkette
 * @returns {number}
 */
function deutscheZahlParsen(wert) {
  if (wert === null || wert === undefined) return 0;
  const text = String(wert).trim();
  if (text === '') return 0;
  return parseFloat(text.replace(',', '.')) || 0;
}

/**
 * Formatiert eine Zahl mit deutschem Dezimalkomma fuer die Anzeige.
 * Beispiel: zahlDe(9.1, 1) → "9,1", zahlDe(1.2, 2) → "1,20".
 * @param {number} wert - Die anzuzeigende Zahl
 * @param {number} stellen - Anzahl Nachkommastellen
 * @returns {string}
 */
function zahlDe(wert, stellen) {
  return Number(wert).toFixed(stellen).replace('.', ',');
}

/**
 * Formatiert eine Mengen-Angabe in Gramm: ganze Zahlen ohne
 * Nachkommastelle, sonst mit einer. Beispiel: 840 → "840", 12.5 → "12,5".
 * @param {number} wert - Menge in Gramm
 * @returns {string}
 */
function mengeFormatieren(wert) {
  return Number.isInteger(wert) ? String(wert) : zahlDe(wert, 1);
}

/**
 * Berechnet die Nährwerte eines Eigengerichts aus seinen Zutaten.
 * @param {Array} zutaten - Array der Zutat-Objekte aus IndexedDB
 * @param {Map} lebensmittelMap - Map von lebensmittel_id → Lebensmittel-Objekt
 * @param {number} endgewichtG - Endgewicht des Gerichts in Gramm
 * @returns {Object} - Objekt mit kcal, eiweiss, kh, fett, salz (pro 100g) und anzahlUnbekannt
 */
function gerichtNaehrwerteBerechnen(zutaten, lebensmittelMap, endgewichtG) {
  let gesamtKcal     = 0;
  let gesamtEiweiss  = 0;
  let gesamtKh       = 0;
  let gesamtFett     = 0;
  let gesamtSalz     = 0;
  let anzahlUnbekannt = 0;

  for (const zutat of zutaten) {
    const mengeG = deutscheZahlParsen(zutat.zutat_menge_g);
    const lm = lebensmittelMap.get(zutat.zutat_lebensmittel_id);

    if (!lm || zutat.zutat_lebensmittel_id === 'UNBEKANNT') {
      anzahlUnbekannt++;
      continue;
    }

    const faktor = mengeG / 100;
    gesamtKcal    += faktor * deutscheZahlParsen(lm.kcal_pro_100g);
    gesamtEiweiss += faktor * deutscheZahlParsen(lm.eiweiss_g);
    gesamtKh      += faktor * deutscheZahlParsen(lm.kohlenhydrate_g);
    gesamtFett    += faktor * deutscheZahlParsen(lm.fett_g);
    gesamtSalz    += faktor * deutscheZahlParsen(lm.salz_g);
  }

  const endgewicht = endgewichtG > 0 ? endgewichtG : 1;
  const faktor100g = 100 / endgewicht;

  return {
    kcal_pro_100g:     Math.round(gesamtKcal * faktor100g),
    eiweiss_pro_100g:  parseFloat((gesamtEiweiss * faktor100g).toFixed(1)),
    kh_pro_100g:       parseFloat((gesamtKh * faktor100g).toFixed(1)),
    fett_pro_100g:     parseFloat((gesamtFett * faktor100g).toFixed(1)),
    salz_pro_100g:     parseFloat((gesamtSalz * faktor100g).toFixed(2)),
    anzahl_unbekannt:  anzahlUnbekannt,
  };
}

/**
 * Lädt alle fünf Dateien aus Dropbox, parst sie und füllt IndexedDB.
 * Ruft optional eine Fortschritts-Callback-Funktion auf.
 * @param {Function} fortschrittCallback - Wird mit (schritt, gesamt, beschreibung) aufgerufen
 */
async function allesDatenImportieren(fortschrittCallback) {
  const gesamtSchritte = 7; /* 5 Downloads + 2 Verarbeitungsschritte */
  let schritt = 0;

  const fortschritt = (beschreibung) => {
    schritt++;
    if (fortschrittCallback) fortschrittCallback(schritt, gesamtSchritte, beschreibung);
  };

  /* Schritt 1: Lebensmittel-Stammdaten */
  fortschritt('Lade Lebensmittel-Stammdaten…');
  const lmCsv = await dropboxDateiHerunterladen('/01_Stammdaten_Lebensmittel.csv');
  const lmRoh = csvParsen(lmCsv);

  const lebensmittelListe = lmRoh.map(z => ({
    lebensmittel_id:       z.lebensmittel_id,
    name:                  z.name,
    bemerkung:             z.bemerkung,
    gruppe:                z.gruppe,
    kcal_pro_100g:         z.kcal_pro_100g,
    eiweiss_g:             z.eiweiss_g,
    kohlenhydrate_g:       z.kohlenhydrate_g,
    zucker_g:              z.zucker_g,
    fett_g:                z.fett_g,
    fett_gesaettigt_g:     z.fett_gesaettigt_g,
    fett_ungesaettigt_g:   z.fett_ungesaettigt_g,
    salz_g:                z.salz_g,
    ballaststoffe_g:       z.ballaststoffe_g,
    restmasse_g:           z.restmasse_g,
    alkohol_g:             z.alkohol_g,
  }));

  /* Schnelle Map für Nährwert-Berechnungen */
  const lebensmittelMap = new Map(lebensmittelListe.map(lm => [lm.lebensmittel_id, lm]));

  /* Schritt 2: Eigengerichte-Stammdaten */
  fortschritt('Lade Eigengerichte-Stammdaten…');
  const egCsv = await dropboxDateiHerunterladen('/02_Stammdaten_Eigengerichte.csv');
  const egRoh = csvParsen(egCsv);

  /* Zutaten separat speichern; Gerichte als Kopfdaten-Map aufbauen */
  const gerichteMap = new Map();
  const zutatenListe = [];

  for (const zeile of egRoh) {
    const gerichtId = zeile.gericht_id;

    if (!gerichteMap.has(gerichtId)) {
      gerichteMap.set(gerichtId, {
        gericht_id:                zeile.gericht_id,
        gericht_name:              zeile.gericht_name,
        gericht_kategorie:         zeile.gericht_kategorie,
        gericht_original_kategorie: zeile.gericht_original_kategorie,
        gericht_endgewicht_g:      zeile.gericht_endgewicht_g,
        kcal_pro_100g_berechnet:   0,   /* Wird unten befüllt */
        kcal_unvollstaendig:       false,
      });
    }

    zutatenListe.push({
      gericht_id:                    zeile.gericht_id,
      zutat_nr:                      zeile.zutat_nr,
      zutat_lebensmittel_id:         zeile.zutat_lebensmittel_id,
      zutat_lebensmittel_name_original: zeile.zutat_lebensmittel_name_original,
      zutat_menge_g:                 zeile.zutat_menge_g,
    });
  }

  /* Schritt 3: Nährwerte für alle Gerichte vorausberechnen */
  fortschritt('Berechne Nährwerte der Gerichte…');
  const gerichteNachId = new Map();

  for (const [gerichtId, gericht] of gerichteMap.entries()) {
    const zutatenDesGerichts = zutatenListe.filter(z => z.gericht_id === gerichtId);
    const endgewicht = deutscheZahlParsen(gericht.gericht_endgewicht_g);
    const berechnete = gerichtNaehrwerteBerechnen(zutatenDesGerichts, lebensmittelMap, endgewicht);

    gericht.kcal_pro_100g_berechnet  = berechnete.kcal_pro_100g;
    gericht.eiweiss_pro_100g         = berechnete.eiweiss_pro_100g;
    gericht.kh_pro_100g              = berechnete.kh_pro_100g;
    gericht.fett_pro_100g            = berechnete.fett_pro_100g;
    gericht.salz_pro_100g            = berechnete.salz_pro_100g;
    gericht.kcal_unvollstaendig      = berechnete.anzahl_unbekannt > 0;
    gericht.anzahl_unbekannte_zutaten = berechnete.anzahl_unbekannt;
    gerichteNachId.set(gerichtId, gericht);
  }

  /* Schritt 4: Konfiguration laden */
  fortschritt('Lade Konfiguration…');
  const konfigText = await dropboxDateiHerunterladen('/05_Konfiguration.json');
  const konfigDaten = JSON.parse(konfigText);

  /* Schritt 5: Alles in IndexedDB speichern */
  fortschritt('Speichere Daten lokal…');
  await dbAllesLoeschen('lebensmittel');
  await dbAllesLoeschen('eigengerichte');
  await dbAllesLoeschen('zutaten');
  await dbAllesLoeschen('konfiguration');

  await dbMassenSchreiben('lebensmittel', lebensmittelListe);
  await dbMassenSchreiben('eigengerichte', Array.from(gerichteNachId.values()));
  await dbMassenSchreiben('zutaten', zutatenListe);
  await dbSchreiben('konfiguration', { schluessel: 'config', daten: konfigDaten });

  /* Schritt 6: Sync-Zeitstempel speichern */
  fortschritt('Abschluss…');
  await dbSchreiben('meta', {
    schluessel: 'config',
    zuletzt_synchronisiert: Date.now(),
    lebensmittel_anzahl: lebensmittelListe.length,
    eigengerichte_anzahl: gerichteNachId.size,
  });
}

/* ----------------------------------------------------------------
   6. MINI-ROUTER

   Hash-basiertes Routing: die URL hinter dem # bestimmt, welcher
   Bildschirm angezeigt wird. Beispiel: #/lebensmittel/LM_0001

   Historien-Stack: wir merken uns die letzte Ansicht, damit der
   Zurück-Knopf funktioniert (ohne Browser-History-API-Komplexität).
   ---------------------------------------------------------------- */

/* Globale Zustandsvariablen für die Listenansichten */
let lebensmittelSuchfilter     = '';
let lebensmittelGruppenfilter  = 'alle';
let gerichteSuchfilter         = '';
let gerichteKategoriefilter    = 'alle';

/**
 * Zeigt eine Ansicht an und blendet alle anderen aus.
 * @param {string} ansichtId - Die ID des Bildschirm-Elements
 */
function ansichtAnzeigen(ansichtId) {
  /* Alle Ansichten verstecken */
  document.querySelectorAll('.ansicht').forEach(el => {
    el.classList.remove('aktiv');
  });

  /* Die gewünschte Ansicht einblenden */
  const zielAnsicht = document.getElementById(ansichtId);
  if (zielAnsicht) {
    zielAnsicht.classList.add('aktiv');
  }

  /* Tab-Leiste nur bei den Haupt-Bildschirmen anzeigen */
  const tabLeiste = document.getElementById('tab-leiste');
  const mitTabbar = ['ansicht-lebensmittel', 'ansicht-gerichte', 'ansicht-einstellungen'];
  if (mitTabbar.includes(ansichtId)) {
    tabLeiste.classList.remove('versteckt');
  } else {
    tabLeiste.classList.add('versteckt');
  }

  /* Aktiven Tab markieren */
  document.querySelectorAll('.tab-knopf').forEach(knopf => {
    const ziel = knopf.dataset.ziel;
    knopf.classList.toggle('aktiv', ansichtId === 'ansicht-' + ziel);
  });
}

/**
 * Navigiert zu einem bestimmten Bildschirm, indem der URL-Hash
 * gesetzt wird. Das Setzen des Hash loest das "hashchange"-Ereignis
 * aus, welches dann routeVerarbeiten() aufruft.
 *
 * Sonderfall: Ist der Ziel-Hash bereits der aktuelle (z. B. nach dem
 * OAuth-Redirect steht schon "#/lebensmittel" in der URL), feuert der
 * Browser KEIN "hashchange". Dann rendern wir die Ansicht direkt,
 * damit die App nicht haengen bleibt.
 *
 * @param {string} pfad - z. B. "lebensmittel", "gericht/EG_013"
 */
async function navigieren(pfad) {
  const neuerHash = '#/' + pfad;
  if (location.hash === neuerHash) {
    await routeVerarbeiten();
  } else {
    location.hash = neuerHash;
  }
}

/**
 * Wertet den aktuellen URL-Hash aus und zeigt den richtigen Bildschirm.
 */
async function routeVerarbeiten() {
  const hash = location.hash.replace('#/', '') || '';
  const teile = hash.split('/');
  const seite = teile[0];
  const parameter = teile[1];

  const tokens = await tokensLaden();
  if (!tokens) {
    /* Kein Token → Anmeldung */
    ansichtAnzeigen('ansicht-anmeldung');
    return;
  }

  /* Prüfen ob IndexedDB bereits Daten hat */
  const lmAnzahl = await dbZaehlen('lebensmittel');

  if (lmAnzahl === 0) {
    /* Daten fehlen → Erst-Import */
    ansichtAnzeigen('ansicht-erstimport');
    await erstImportBildschirmLaden();
    return;
  }

  /* Normales Routing */
  switch (seite) {
    case 'gerichte':
      ansichtAnzeigen('ansicht-gerichte');
      await gerichteListeLaden();
      break;
    case 'gericht':
      if (parameter) {
        ansichtAnzeigen('ansicht-gericht-detail');
        await gerichtDetailLaden(parameter);
      }
      break;
    case 'einstellungen':
      ansichtAnzeigen('ansicht-einstellungen');
      await einstellungenLaden();
      break;
    case 'lebensmittel-detail':
      if (parameter) {
        ansichtAnzeigen('ansicht-lebensmittel-detail');
        await lebensmittelDetailLaden(parameter);
      }
      break;
    default:
      /* Standardmäßig Lebensmittel-Liste */
      ansichtAnzeigen('ansicht-lebensmittel');
      await lebensmittelListeLaden();
  }
}

/* ----------------------------------------------------------------
   7. BILDSCHIRM-RENDERER

   Pro Bildschirm eine Ladefunktion, die Daten aus IndexedDB holt
   und das DOM aktualisiert.
   ---------------------------------------------------------------- */

/* -- Bildschirm 2: Erst-Import ---------------------------------- */

async function erstImportBildschirmLaden() {
  /* Konto-Info anzeigen */
  try {
    const konto = await dropboxKontoInfoHolen();
    document.getElementById('erstimport-email').textContent = konto.email || konto.name?.display_name || '—';
  } catch (e) {
    document.getElementById('erstimport-email').textContent = 'Unbekannt';
  }

  /* Dateien prüfen */
  await dateiStatusAktualisieren();
}

async function dateiStatusAktualisieren() {
  const dateiListeEl = document.getElementById('erstimport-dateiliste');
  /* Alle Status auf "Prüfe…" setzen */
  dateiListeEl.querySelectorAll('.datei-status').forEach(el => {
    el.textContent = '⏳';
  });

  let vorhanden = [];
  try {
    const eintraege = await dropboxDateienAuflisten();
    vorhanden = eintraege.map(e => e.name);
  } catch (fehler) {
    fehlermeldungAnzeigen('Dropbox-Zugriff fehlgeschlagen: ' + fehler.message);
    return;
  }

  let alleDa = true;
  for (const eintrag of dateiListeEl.querySelectorAll('.datei-eintrag')) {
    const dateiName = eintrag.dataset.datei;
    const statusEl  = eintrag.querySelector('.datei-status');
    if (vorhanden.includes(dateiName)) {
      statusEl.textContent = '✅';
    } else {
      statusEl.textContent = '❌';
      alleDa = false;
    }
  }

  /* Wenn alle Dateien vorhanden: automatisch herunterladen */
  if (alleDa) {
    await dateienHerunterladen();
  }
}

async function dateienHerunterladen() {
  const ladebalken = document.getElementById('erstimport-ladebalken');
  const ladetext   = document.getElementById('erstimport-ladetext');
  const fueller    = document.getElementById('erstimport-fueller');
  ladebalken.classList.remove('versteckt');

  try {
    await allesDatenImportieren((schritt, gesamt, beschreibung) => {
      ladetext.textContent = beschreibung;
      fueller.style.width = Math.round((schritt / gesamt) * 100) + '%';
    });

    /* Fertig → zur Lebensmittel-Liste */
    ladebalken.classList.add('versteckt');
    await navigieren('lebensmittel');
  } catch (fehler) {
    ladebalken.classList.add('versteckt');
    fehlermeldungAnzeigen('Fehler beim Herunterladen: ' + fehler.message);
  }
}

/* -- Bildschirm 3: Lebensmittel-Liste --------------------------- */

/* Gecachte Liste für schnelle Filter ohne erneutes DB-Lesen */
let lebensmittelCache = null;

async function lebensmittelListeLaden() {
  if (!lebensmittelCache) {
    lebensmittelCache = await dbAllesLesen('lebensmittel');
  }
  lebensmittelListeRendern();
}

function lebensmittelListeRendern() {
  const liste = lebensmittelCache || [];
  const suche = lebensmittelSuchfilter.toLowerCase();
  const gruppe = lebensmittelGruppenfilter;

  /* Gefilterte Liste berechnen */
  const gefiltert = liste.filter(lm => {
    const nameTrifft = lm.name.toLowerCase().includes(suche) ||
      (lm.bemerkung && lm.bemerkung.toLowerCase().includes(suche));
    const gruppeTrifft = gruppe === 'alle' || lm.gruppe === gruppe;
    return nameTrifft && gruppeTrifft;
  });

  /* Chips erzeugen (nur beim ersten Mal oder nach Cache-Reset) */
  const chipsEl = document.getElementById('lebensmittel-chips');
  if (chipsEl.children.length === 0) {
    lebensmittelChipsErzeugen(liste);
  }

  /* Liste rendern */
  const listeEl = document.getElementById('lebensmittel-liste');

  if (gefiltert.length === 0) {
    listeEl.innerHTML = '<div class="leerer-zustand">Keine Lebensmittel gefunden.</div>';
    return;
  }

  /* Gruppieren */
  const gruppen = {};
  for (const lm of gefiltert) {
    const g = lm.gruppe || 'Sonstiges';
    if (!gruppen[g]) gruppen[g] = [];
    gruppen[g].push(lm);
  }

  const html = [];
  for (const [gruppenName, eintraege] of Object.entries(gruppen).sort()) {
    html.push(`<div class="gruppen-header">${escapeHtml(gruppenName)} · ${eintraege.length}</div>`);
    for (const lm of eintraege.sort((a, b) => a.name.localeCompare(b.name))) {
      const kcal = Math.round(deutscheZahlParsen(lm.kcal_pro_100g));
      html.push(`
        <div class="listen-eintrag" role="listitem" data-id="${escapeHtml(lm.lebensmittel_id)}" tabindex="0">
          <span class="listen-eintrag-name">${escapeHtml(lm.name)}</span>
          <span class="listen-eintrag-wert">${kcal} kcal</span>
        </div>`);
    }
  }

  listeEl.innerHTML = html.join('');

  /* Klick-Events auf die Einträge registrieren */
  listeEl.querySelectorAll('.listen-eintrag').forEach(el => {
    el.addEventListener('click', () => {
      navigieren('lebensmittel-detail/' + el.dataset.id);
    });
  });
}

function lebensmittelChipsErzeugen(liste) {
  const chipsEl = document.getElementById('lebensmittel-chips');

  /* Alle vorhandenen Gruppen zählen */
  const gruppenZaehler = {};
  for (const lm of liste) {
    const g = lm.gruppe || 'Sonstiges';
    gruppenZaehler[g] = (gruppenZaehler[g] || 0) + 1;
  }

  const html = [`<span class="chip ${lebensmittelGruppenfilter === 'alle' ? 'aktiv' : ''}" data-gruppe="alle" role="listitem">Alle (${liste.length})</span>`];

  for (const [gruppenName, anzahl] of Object.entries(gruppenZaehler).sort((a, b) => b[1] - a[1])) {
    const aktiv = lebensmittelGruppenfilter === gruppenName ? 'aktiv' : '';
    html.push(`<span class="chip ${aktiv}" data-gruppe="${escapeHtml(gruppenName)}" role="listitem">${escapeHtml(gruppenName)} (${anzahl})</span>`);
  }

  chipsEl.innerHTML = html.join('');

  chipsEl.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      lebensmittelGruppenfilter = chip.dataset.gruppe;
      /* Aktiven Chip markieren */
      chipsEl.querySelectorAll('.chip').forEach(c => c.classList.remove('aktiv'));
      chip.classList.add('aktiv');
      lebensmittelListeRendern();
    });
  });
}

/* -- Bildschirm 4: Detail Lebensmittel -------------------------- */

async function lebensmittelDetailLaden(lmId) {
  const lm = await dbLesen('lebensmittel', lmId);
  if (!lm) {
    document.getElementById('lm-detail-titel').textContent = 'Nicht gefunden';
    document.getElementById('lm-detail-inhalt').innerHTML = '<div class="leerer-zustand">Lebensmittel nicht gefunden.</div>';
    return;
  }

  document.getElementById('lm-detail-titel').textContent = lm.name;

  const kcal         = Math.round(deutscheZahlParsen(lm.kcal_pro_100g));
  const eiweiss      = deutscheZahlParsen(lm.eiweiss_g);
  const kh           = deutscheZahlParsen(lm.kohlenhydrate_g);
  const zucker       = deutscheZahlParsen(lm.zucker_g);
  const fett         = deutscheZahlParsen(lm.fett_g);
  const fettGes      = deutscheZahlParsen(lm.fett_gesaettigt_g);
  const fettUnges    = deutscheZahlParsen(lm.fett_ungesaettigt_g);
  const salz         = deutscheZahlParsen(lm.salz_g);
  const ballaststoffe= deutscheZahlParsen(lm.ballaststoffe_g);
  const restmasse    = deutscheZahlParsen(lm.restmasse_g);
  const alkohol      = deutscheZahlParsen(lm.alkohol_g);

  let html = `
    <div class="detail-hero">
      <div class="detail-hero-kcal">${kcal}</div>
      <div class="detail-hero-untertitel">kcal pro 100 g</div>
      <span class="detail-hero-pille">${escapeHtml(lm.gruppe || 'Sonstiges')}</span>
    </div>
    <div class="detail-body">
      <div class="detail-sektion">
        <div class="detail-sektion-titel">Makronährwerte (pro 100 g)</div>
        <div class="naehrwert-reihe">
          <span class="naehrwert-label">Eiweiß</span>
          <span class="naehrwert-wert">${zahlDe(eiweiss, 1)} g</span>
        </div>
        <div class="naehrwert-reihe">
          <span class="naehrwert-label">Kohlenhydrate</span>
          <span class="naehrwert-wert">${zahlDe(kh, 1)} g</span>
        </div>
        <div class="naehrwert-reihe eingerueckt">
          <span class="naehrwert-label">davon Zucker</span>
          <span class="naehrwert-wert">${zahlDe(zucker, 1)} g</span>
        </div>
        <div class="naehrwert-reihe">
          <span class="naehrwert-label">Fett</span>
          <span class="naehrwert-wert">${zahlDe(fett, 1)} g</span>
        </div>
        <div class="naehrwert-reihe eingerueckt">
          <span class="naehrwert-label">davon gesättigt</span>
          <span class="naehrwert-wert">${zahlDe(fettGes, 1)} g</span>
        </div>
        <div class="naehrwert-reihe eingerueckt">
          <span class="naehrwert-label">davon ungesättigt</span>
          <span class="naehrwert-wert">${zahlDe(fettUnges, 1)} g</span>
        </div>
      </div>

      <div class="detail-sektion">
        <div class="detail-sektion-titel">Weitere Werte</div>
        <div class="naehrwert-reihe">
          <span class="naehrwert-label">Salz</span>
          <span class="naehrwert-wert">${zahlDe(salz, 2)} g</span>
        </div>
        <div class="naehrwert-reihe">
          <span class="naehrwert-label">Ballaststoffe</span>
          <span class="naehrwert-wert">${zahlDe(ballaststoffe, 1)} g</span>
        </div>`;

  if (restmasse > 0) {
    html += `<div class="naehrwert-reihe">
          <span class="naehrwert-label">Restmasse</span>
          <span class="naehrwert-wert">${zahlDe(restmasse, 1)} g</span>
        </div>`;
  }
  if (alkohol > 0) {
    html += `<div class="naehrwert-reihe">
          <span class="naehrwert-label">Alkohol</span>
          <span class="naehrwert-wert">${zahlDe(alkohol, 1)} g</span>
        </div>`;
  }

  html += `</div>

      <div class="detail-sektion">
        <div class="detail-sektion-titel">Kennung</div>
        <div class="detail-id">${escapeHtml(lm.lebensmittel_id)}</div>`;

  if (lm.bemerkung) {
    html += `<div class="detail-bemerkung">${escapeHtml(lm.bemerkung)}</div>`;
  }

  html += `</div></div>`;

  document.getElementById('lm-detail-inhalt').innerHTML = html;
}

/* -- Bildschirm 5: Gerichte-Liste ------------------------------- */

let gerichteCache = null;

async function gerichteListeLaden() {
  if (!gerichteCache) {
    gerichteCache = await dbAllesLesen('eigengerichte');
  }
  gerichteListeRendern();
}

function gerichteListeRendern() {
  const liste = gerichteCache || [];
  const suche = gerichteSuchfilter.toLowerCase();
  const kategorie = gerichteKategoriefilter;

  const gefiltert = liste.filter(g => {
    const nameTrifft = g.gericht_name.toLowerCase().includes(suche);
    const kategorieTrifft = kategorie === 'alle' || g.gericht_kategorie === kategorie;
    return nameTrifft && kategorieTrifft;
  });

  /* Chips nur einmal erzeugen */
  const chipsEl = document.getElementById('gerichte-chips');
  if (chipsEl.children.length === 0) {
    gerichteChipsErzeugen(liste);
  }

  const listeEl = document.getElementById('gerichte-liste');

  if (gefiltert.length === 0) {
    listeEl.innerHTML = '<div class="leerer-zustand">Keine Gerichte gefunden.</div>';
    return;
  }

  /* Gruppieren nach Kategorie */
  const gruppen = {};
  for (const g of gefiltert) {
    const kat = g.gericht_kategorie || 'Sonstiges';
    if (!gruppen[kat]) gruppen[kat] = [];
    gruppen[kat].push(g);
  }

  const html = [];
  for (const [katName, eintraege] of Object.entries(gruppen).sort()) {
    html.push(`<div class="gruppen-header">${escapeHtml(katName)} · ${eintraege.length}</div>`);
    for (const g of eintraege.sort((a, b) => a.gericht_name.localeCompare(b.gericht_name))) {
      const kcalText = g.kcal_unvollstaendig
        ? `${g.kcal_pro_100g_berechnet} kcal*`
        : `${g.kcal_pro_100g_berechnet} kcal`;
      html.push(`
        <div class="listen-eintrag" role="listitem" data-id="${escapeHtml(g.gericht_id)}" tabindex="0">
          <span class="listen-eintrag-name">${escapeHtml(g.gericht_name)}</span>
          <span class="listen-eintrag-wert">${kcalText}</span>
        </div>`);
    }
  }

  listeEl.innerHTML = html.join('');

  listeEl.querySelectorAll('.listen-eintrag').forEach(el => {
    el.addEventListener('click', () => {
      navigieren('gericht/' + el.dataset.id);
    });
  });
}

function gerichteChipsErzeugen(liste) {
  const chipsEl = document.getElementById('gerichte-chips');

  const kategorieZaehler = {};
  for (const g of liste) {
    const kat = g.gericht_kategorie || 'Sonstiges';
    kategorieZaehler[kat] = (kategorieZaehler[kat] || 0) + 1;
  }

  const html = [`<span class="chip ${gerichteKategoriefilter === 'alle' ? 'aktiv' : ''}" data-kategorie="alle" role="listitem">Alle (${liste.length})</span>`];

  for (const [katName, anzahl] of Object.entries(kategorieZaehler).sort()) {
    const aktiv = gerichteKategoriefilter === katName ? 'aktiv' : '';
    html.push(`<span class="chip ${aktiv}" data-kategorie="${escapeHtml(katName)}" role="listitem">${escapeHtml(katName)} (${anzahl})</span>`);
  }

  chipsEl.innerHTML = html.join('');

  chipsEl.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      gerichteKategoriefilter = chip.dataset.kategorie;
      chipsEl.querySelectorAll('.chip').forEach(c => c.classList.remove('aktiv'));
      chip.classList.add('aktiv');
      gerichteListeRendern();
    });
  });
}

/* -- Bildschirm 6: Detail Eigengericht -------------------------- */

async function gerichtDetailLaden(gerichtId) {
  const gericht = await dbLesen('eigengerichte', gerichtId);
  if (!gericht) {
    document.getElementById('eg-detail-titel').textContent = 'Nicht gefunden';
    document.getElementById('eg-detail-inhalt').innerHTML = '<div class="leerer-zustand">Gericht nicht gefunden.</div>';
    return;
  }

  document.getElementById('eg-detail-titel').textContent = gericht.gericht_name;

  const zutaten = await dbIndexLesen('zutaten', 'nach_gericht_id', gerichtId);
  zutaten.sort((a, b) => parseInt(a.zutat_nr) - parseInt(b.zutat_nr));

  const kcal     = gericht.kcal_pro_100g_berechnet || 0;
  const eiweiss  = gericht.eiweiss_pro_100g || 0;
  const kh       = gericht.kh_pro_100g || 0;
  const fett     = gericht.fett_pro_100g || 0;
  const salz     = gericht.salz_pro_100g || 0;
  const endgewicht = deutscheZahlParsen(gericht.gericht_endgewicht_g);

  const kcalAnzeige = gericht.kcal_unvollstaendig ? `${kcal}*` : `${kcal}`;

  let html = `
    <div class="detail-hero">
      <div class="detail-hero-kcal">${kcalAnzeige}</div>
      <div class="detail-hero-untertitel">kcal pro 100 g (berechnet)</div>
      <span class="detail-hero-pille">${escapeHtml(gericht.gericht_kategorie || 'Sonstiges')}</span>
    </div>
    <div class="detail-body">`;

  /* Warnung bei unvollständiger Berechnung */
  if (gericht.kcal_unvollstaendig) {
    html += `<div class="warn-vollstaendigkeit">
      <span class="info-symbol" aria-hidden="true">⚠</span>
      <span>${gericht.anzahl_unbekannte_zutaten} Zutat(en) konnten nicht verknüpft werden — Nährwerte sind unvollständig.</span>
    </div>`;
  }

  html += `
      <div class="detail-sektion">
        <div class="detail-sektion-titel">Berechnete Nährwerte (pro 100 g)</div>
        <div class="naehrwert-reihe">
          <span class="naehrwert-label">Eiweiß</span>
          <span class="naehrwert-wert">${zahlDe(eiweiss, 1)} g</span>
        </div>
        <div class="naehrwert-reihe">
          <span class="naehrwert-label">Kohlenhydrate</span>
          <span class="naehrwert-wert">${zahlDe(kh, 1)} g</span>
        </div>
        <div class="naehrwert-reihe">
          <span class="naehrwert-label">Fett</span>
          <span class="naehrwert-wert">${zahlDe(fett, 1)} g</span>
        </div>
        <div class="naehrwert-reihe">
          <span class="naehrwert-label">Salz</span>
          <span class="naehrwert-wert">${zahlDe(salz, 2)} g</span>
        </div>
      </div>

      <div class="detail-sektion">
        <div class="detail-sektion-titel">Endgewicht der Portion</div>
        <div class="naehrwert-reihe">
          <span class="naehrwert-label">Gesamt</span>
          <span class="naehrwert-wert">${mengeFormatieren(endgewicht)} g</span>
        </div>
      </div>

      <div class="detail-sektion">
        <div class="detail-sektion-titel">Zutaten (${zutaten.length})</div>`;

  for (const zutat of zutaten) {
    const mengeG = deutscheZahlParsen(zutat.zutat_menge_g);
    html += `
        <div class="zutat-eintrag" data-lm-id="${escapeHtml(zutat.zutat_lebensmittel_id)}">
          <div class="zutat-links">
            <span class="zutat-lm-id">${escapeHtml(zutat.zutat_lebensmittel_id)}</span>
            <span class="zutat-name">${escapeHtml(zutat.zutat_lebensmittel_name_original)}</span>
          </div>
          <span class="zutat-menge">${mengeFormatieren(mengeG)} g</span>
        </div>`;
  }

  html += `</div></div>`;

  const inhaltEl = document.getElementById('eg-detail-inhalt');
  inhaltEl.innerHTML = html;

  /* Klick auf Zutat → Detail des Lebensmittels */
  inhaltEl.querySelectorAll('.zutat-eintrag').forEach(el => {
    el.addEventListener('click', () => {
      const lmId = el.dataset.lmId;
      if (lmId && lmId !== 'UNBEKANNT') {
        navigieren('lebensmittel-detail/' + lmId);
      }
    });
  });
}

/* -- Bildschirm 7: Einstellungen -------------------------------- */

/**
 * Aktualisiert die Online/Offline-Anzeige in den Einstellungen.
 * "online" wird gruen hervorgehoben. Wird sowohl beim Oeffnen der
 * Einstellungen als auch bei Netzwerk-Ereignissen aufgerufen.
 */
function onlineStatusAktualisieren() {
  const statusEl = document.getElementById('einst-online-status');
  if (!statusEl) return;
  if (navigator.onLine) {
    statusEl.textContent = 'online';
    statusEl.classList.add('erfolg');
  } else {
    statusEl.textContent = 'offline';
    statusEl.classList.remove('erfolg');
  }
}

async function einstellungenLaden() {
  /* Online-Status */
  onlineStatusAktualisieren();

  /* Sync-Zeitstempel */
  const meta = await dbLesen('meta', 'config');
  if (meta && meta.zuletzt_synchronisiert) {
    const minuten = Math.round((Date.now() - meta.zuletzt_synchronisiert) / 60000);
    document.getElementById('einst-sync-zeit').textContent =
      minuten < 1 ? 'Gerade eben' : `vor ${minuten} Min`;
  } else {
    document.getElementById('einst-sync-zeit').textContent = 'Noch nie';
  }

  /* Anzahlen aus IndexedDB */
  const lmAnzahl = await dbZaehlen('lebensmittel');
  const egAnzahl = await dbZaehlen('eigengerichte');
  document.getElementById('einst-lm-anzahl').textContent = lmAnzahl;
  document.getElementById('einst-eg-anzahl').textContent = egAnzahl;

  /* Konto-Info von Dropbox holen */
  try {
    const konto = await dropboxKontoInfoHolen();
    document.getElementById('einst-email').textContent = konto.email || '—';
  } catch (e) {
    document.getElementById('einst-email').textContent = '(Offline)';
  }

  /* Speicher-Nutzung (belegt in MB, Gesamt in GB — wie im Mockup) */
  try {
    const speicher = await dropboxSpeicherInfoHolen();
    const belegtMb = (speicher.used || 0) / 1024 / 1024;
    const belegtText = belegtMb < 10 ? `${zahlDe(belegtMb, 1)} MB` : `${Math.round(belegtMb)} MB`;

    let gesamtText = '2 GB';
    const allocBytes = speicher.allocation && speicher.allocation.allocated;
    if (allocBytes) {
      const gesamtGb = allocBytes / 1024 / 1024 / 1024;
      gesamtText = Number.isInteger(gesamtGb) ? `${gesamtGb} GB` : `${zahlDe(gesamtGb, 1)} GB`;
    }

    document.getElementById('einst-speicher').textContent = `${belegtText} / ${gesamtText}`;
  } catch (e) {
    document.getElementById('einst-speicher').textContent = '(Offline)';
  }
}

/* ----------------------------------------------------------------
   8. EREIGNIS-LISTENER UND STEUERUNG
   ---------------------------------------------------------------- */

function fehlermeldungAnzeigen(text) {
  const leiste = document.getElementById('fehler-leiste');
  leiste.textContent = text;
  leiste.classList.remove('versteckt');
  setTimeout(() => leiste.classList.add('versteckt'), 6000);
}

/**
 * Einfache HTML-Sonderzeichen-Maskierung gegen XSS.
 * Wichtig bei allen Daten aus der Datenbank, die in innerHTML landen.
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Registriert alle Knopf-Klick- und Formular-Ereignisse.
 * Wird einmalig beim App-Start aufgerufen.
 */
function ereignisListenerRegistrieren() {

  /* Anmelde-Knopf */
  document.getElementById('knopf-dropbox-anmelden').addEventListener('click', () => {
    dropboxAnmeldenStarten().catch(fehler => fehlermeldungAnzeigen(fehler.message));
  });

  /* Erneut-prüfen-Knopf im Erst-Import */
  document.getElementById('knopf-erneut-pruefen').addEventListener('click', async () => {
    await dateiStatusAktualisieren();
  });

  /* Zurück-Knopf Lebensmittel-Detail */
  document.getElementById('lm-detail-zurueck').addEventListener('click', () => {
    history.back();
  });

  /* Zurück-Knopf Gericht-Detail */
  document.getElementById('eg-detail-zurueck').addEventListener('click', () => {
    history.back();
  });

  /* Tab-Leiste */
  document.querySelectorAll('.tab-knopf').forEach(knopf => {
    knopf.addEventListener('click', () => {
      const ziel = knopf.dataset.ziel;
      /* Caches invalidieren wenn der Nutzer manuell wechselt */
      navigieren(ziel);
    });
  });

  /* Suche Lebensmittel */
  document.getElementById('lebensmittel-suche').addEventListener('input', (e) => {
    lebensmittelSuchfilter = e.target.value;
    lebensmittelListeRendern();
  });

  /* Suche Gerichte */
  document.getElementById('gerichte-suche').addEventListener('input', (e) => {
    gerichteSuchfilter = e.target.value;
    gerichteListeRendern();
  });

  /* Abmelden */
  document.getElementById('knopf-abmelden').addEventListener('click', async () => {
    await dbLoeschen('auth', 'tokens');
    lebensmittelCache = null;
    gerichteCache = null;
    navigieren('');
  });

  /* Jetzt synchronisieren */
  document.getElementById('knopf-synchronisieren').addEventListener('click', async () => {
    if (!navigator.onLine) {
      fehlermeldungAnzeigen('Keine Internetverbindung — Synchronisierung nicht möglich.');
      return;
    }
    const knopf = document.getElementById('knopf-synchronisieren');
    knopf.disabled = true;
    knopf.textContent = 'Synchronisiere…';
    try {
      lebensmittelCache = null;
      gerichteCache = null;
      await allesDatenImportieren(null);
      await einstellungenLaden();
    } catch (fehler) {
      fehlermeldungAnzeigen('Synchronisierung fehlgeschlagen: ' + fehler.message);
    } finally {
      knopf.disabled = false;
      knopf.textContent = 'Jetzt synchronisieren';
    }
  });

  /* Datenbank neu aufbauen */
  document.getElementById('knopf-db-neuaufbau').addEventListener('click', async () => {
    if (!confirm('Lokale Datenbank löschen und neu aus Dropbox aufbauen? Das dauert einen Moment.')) {
      return;
    }
    if (!navigator.onLine) {
      fehlermeldungAnzeigen('Keine Internetverbindung — Neuaufbau nicht möglich.');
      return;
    }
    const knopf = document.getElementById('knopf-db-neuaufbau');
    knopf.disabled = true;
    knopf.textContent = 'Bitte warten…';
    try {
      lebensmittelCache = null;
      gerichteCache = null;
      await allesDatenImportieren(null);
      await einstellungenLaden();
    } catch (fehler) {
      fehlermeldungAnzeigen('Neuaufbau fehlgeschlagen: ' + fehler.message);
    } finally {
      knopf.disabled = false;
      knopf.textContent = 'Datenbank neu aufbauen';
    }
  });

  /* Hash-Änderungen abhören (Vor/Zurück im Browser) */
  window.addEventListener('hashchange', () => {
    routeVerarbeiten();
  });

  /* Netzwerk-Status live aktualisieren, damit die Einstellungen-
     Anzeige sofort auf "offline"/"online" umspringt. */
  window.addEventListener('online', onlineStatusAktualisieren);
  window.addEventListener('offline', onlineStatusAktualisieren);
}

/* ----------------------------------------------------------------
   9. SERVICE-WORKER-REGISTRIERUNG
   ---------------------------------------------------------------- */

function serviceWorkerRegistrieren() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/aufschreibung/service-worker.js')
      .catch(fehler => {
        /* Kein Fehler-Popup — Service Worker ist optional für die Grundfunktion */
      });
  }
}

/* ----------------------------------------------------------------
   10. APP-START

   Einstiegspunkt: Datenbank öffnen, dann Route auswerten.
   Beim ersten Laden prüfen ob ein OAuth-Code in der URL steckt
   (Redirect nach Dropbox-Login).
   ---------------------------------------------------------------- */

async function appStarten() {
  try {
    await datenbankOeffnen();
  } catch (fehler) {
    fehlermeldungAnzeigen('Datenbank konnte nicht geöffnet werden: ' + fehler.message);
    return;
  }

  ereignisListenerRegistrieren();
  serviceWorkerRegistrieren();

  /* Prüfen ob wir gerade vom Dropbox-OAuth-Redirect kommen */
  const suchParameter = new URLSearchParams(window.location.search);
  const authCode  = suchParameter.get('code');
  const authState = suchParameter.get('state');

  if (authCode && authState) {
    /* OAuth-Code aus der URL verarbeiten */
    try {
      await dropboxTokenEintauschen(authCode, authState);
    } catch (fehler) {
      fehlermeldungAnzeigen('Anmeldung fehlgeschlagen: ' + fehler.message);
      ansichtAnzeigen('ansicht-anmeldung');
      return;
    }

    /* URL-Parameter entfernen (ohne Seiten-Reload) */
    const saubereUrl = window.location.pathname + '#/lebensmittel';
    window.history.replaceState({}, '', saubereUrl);
  }

  /* Aktuelle Route rendern */
  await routeVerarbeiten();
}

/* App starten sobald der DOM fertig ist */
document.addEventListener('DOMContentLoaded', appStarten);
