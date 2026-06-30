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

/* IndexedDB-Datenbankname und -Version.
   Version 2 (Phase C): Indizes auf 'erfassung' (nach Datum, nach
   Sync-Status) und 'vitaldaten' (nach Sync-Status) ergaenzt. Die
   Stammdaten-Stores aus Phase B2 bleiben unveraendert erhalten. */
const DB_NAME    = 'aufschreibung-db';
const DB_VERSION = 2;

/* Die sechs Einheiten der Mengen-Erfassung. "Gramm" ist die Basis
   und braucht nie einen hinterlegten Umrechnungswert. Die anderen
   fuenf werden pro Lebensmittel/Gericht als Gramm-Wert gespeichert. */
const EINHEITEN = ['Gramm', 'Stück', 'Portion', 'Scheibe', 'Esslöffel', 'Teelöffel'];

/* Zuordnung Einheit → Feldname im Lebensmittel-/Gericht-Datensatz.
   "Gramm" hat bewusst keinen Eintrag (direkte Menge, kein Faktor). */
const EINHEIT_ZU_FELD = {
  'Stück':     'gramm_pro_stueck',
  'Portion':   'gramm_pro_portion',
  'Scheibe':   'gramm_pro_scheibe',
  'Esslöffel': 'gramm_pro_essloeffel',
  'Teelöffel': 'gramm_pro_teeloeffel',
};

/* Mehrzahl-Formen der Einheiten fuer die Anzeige ("3 Scheiben"). */
const EINHEIT_MEHRZAHL = {
  'Gramm':     'Gramm',
  'Stück':     'Stück',
  'Portion':   'Portionen',
  'Scheibe':   'Scheiben',
  'Esslöffel': 'Esslöffel',
  'Teelöffel': 'Teelöffel',
};

/* Reihenfolge der Mahlzeit-Gruppen in der Heute-Ansicht.
   "Trinken" wird als eigene Gruppe ganz unten gefuehrt. */
const MAHLZEIT_REIHENFOLGE = ['Morgens', 'Mittags', 'Abends', 'Zwischen', 'Naschen', 'Trinken'];

/* Standardwerte der Tagesbilanz, falls die Konfiguration sie nicht
   enthaelt (siehe Bauauftrag "Konfigurations-Erweiterung"). */
const STANDARD_TAGESZIEL_KCAL  = 2400;
const STANDARD_KCAL_GRUEN_BIS  = 2200;
const STANDARD_TRINK_ZIEL_LITER = 2.0;

/* Standard-Zeitgrenzen fuer die Mahlzeit-Typ-Automatik (Fallback). */
const STANDARD_ZEITREGELN = {
  morgens_bis:   '10:30',
  mittags_start: '11:30',
  mittags_bis:   '15:00',
  abends_ab:     '18:00',
};

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

    /* Wird aufgerufen wenn die DB neu angelegt oder upgegradet wird.
       Wichtig fuer die Migration B2 → C: bestehende Stores (mit den
       echten Stammdaten des Nutzers) werden NICHT neu angelegt oder
       geloescht — sie bleiben unangetastet. Nur fehlende Stores und
       fehlende Indizes werden ergaenzt. So gehen die 597 Lebensmittel
       und 221 Gerichte beim Update nicht verloren. */
    anfrage.onupgradeneeded = (ereignis) => {
      const datenbankInstanz = ereignis.target.result;
      /* Die laufende "versionchange"-Transaktion. Ueber sie erreichen
         wir bereits existierende Stores, um ihnen neue Indizes zu geben. */
      const aktuelleTransaktion = ereignis.target.transaction;

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

      /* Erfassungs-Store: Schluessel ist erfassungs_id. Neu in Phase C
         sind zwei Indizes — einer fuer "alle Eintraege eines Tages"
         (Heute-Ansicht) und einer fuer "alle noch nicht hochgeladenen
         Eintraege" (Vorbereitung Phase F). Der Store existiert seit B2
         schon (war nur leer), darum holen wir ihn ggf. aus der
         Transaktion statt ihn neu anzulegen. */
      let erfassungStore;
      if (!datenbankInstanz.objectStoreNames.contains('erfassung')) {
        erfassungStore = datenbankInstanz.createObjectStore('erfassung', { keyPath: 'erfassungs_id' });
      } else {
        erfassungStore = aktuelleTransaktion.objectStore('erfassung');
      }
      if (!erfassungStore.indexNames.contains('nach_datum')) {
        erfassungStore.createIndex('nach_datum', 'datum', { unique: false });
      }
      if (!erfassungStore.indexNames.contains('nach_sync_status')) {
        erfassungStore.createIndex('nach_sync_status', 'sync_status', { unique: false });
      }

      /* Vitaldaten-Store: Schluessel ist das Datum (ein Eintrag pro Tag).
         Neu in Phase C: Index nach Sync-Status (Vorbereitung Phase F). */
      let vitaldatenStore;
      if (!datenbankInstanz.objectStoreNames.contains('vitaldaten')) {
        vitaldatenStore = datenbankInstanz.createObjectStore('vitaldaten', { keyPath: 'datum' });
      } else {
        vitaldatenStore = aktuelleTransaktion.objectStore('vitaldaten');
      }
      if (!vitaldatenStore.indexNames.contains('nach_sync_status')) {
        vitaldatenStore.createIndex('nach_sync_status', 'sync_status', { unique: false });
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
   4b. DROPBOX-SCHREIBZUGRIFFE (Phase F)

   Hochladen, Kopieren, Loeschen und Metadaten-Abfrage. Alle mit
   automatischer Token-Erneuerung bei 401 (wie die Lese-Funktionen).
   ---------------------------------------------------------------- */

/**
 * Laedt eine Datei in den App-Ordner hoch (overwrite-Modus).
 * Der Inhalt wird als UTF-8 kodiert (das fuehrende BOM bleibt als
 * Bytes EF BB BF erhalten — wichtig fuer Excel).
 * @param {string} dateiPfad - z. B. "/03_Erfassung.csv"
 * @param {string} inhalt - Der vollstaendige Dateiinhalt (mit BOM)
 * @returns {Promise<Object>} - Dropbox-Metadaten der neuen Version (inkl. rev)
 */
async function dropboxDateiHochladen(dateiPfad, inhalt, wiederholungsVersuch = false) {
  const token = await gueltigesAccessTokenHolen();

  const antwort = await fetch(DROPBOX_CONTENT_URL + 'files/upload', {
    method: 'POST',
    headers: {
      'Authorization':   'Bearer ' + token,
      'Dropbox-API-Arg': JSON.stringify({ path: dateiPfad, mode: 'overwrite', mute: true }),
      'Content-Type':    'application/octet-stream',
    },
    /* Als echte UTF-8-Bytes senden, damit das BOM und Umlaute korrekt
       ankommen. */
    body: new TextEncoder().encode(inhalt),
  });

  if (antwort.status === 401 && !wiederholungsVersuch) {
    const tokens = await tokensLaden();
    if (tokens && tokens.refresh_token) {
      await accessTokenErneuern(tokens.refresh_token);
      return dropboxDateiHochladen(dateiPfad, inhalt, true);
    }
  }

  if (!antwort.ok) {
    const fehlerText = await antwort.text();
    throw new Error(`Upload fehlgeschlagen für ${dateiPfad} (${antwort.status}): ${fehlerText}`);
  }

  return antwort.json();
}

/**
 * Kopiert eine Datei innerhalb des App-Ordners (fuer Backups).
 * @param {string} vonPfad - Quellpfad
 * @param {string} nachPfad - Zielpfad
 */
async function dropboxKopieren(vonPfad, nachPfad) {
  return dropboxApiAufruf('files/copy_v2', {
    from_path: vonPfad,
    to_path:   nachPfad,
    autorename: false,
  });
}

/**
 * Loescht eine Datei im App-Ordner (fuer alte Backups).
 * @param {string} dateiPfad - Pfad der zu loeschenden Datei
 */
async function dropboxLoeschen(dateiPfad) {
  return dropboxApiAufruf('files/delete_v2', { path: dateiPfad });
}

/**
 * Holt die Metadaten aller Dateien in einem Ordner als Map
 * (Dateiname → Eintrag mit rev und server_modified). Beachtet die
 * Dropbox-Seitenaufteilung (has_more/cursor). Existiert der Ordner
 * nicht, wird eine leere Map zurueckgegeben.
 * @param {string} pfad - "" fuer den App-Ordner, "/_backups" fuer Backups
 * @returns {Promise<Map<string, Object>>}
 */
async function dropboxOrdnerMetadaten(pfad = '') {
  const karte = new Map();
  let ergebnis;
  try {
    ergebnis = await dropboxApiAufruf('files/list_folder', { path: pfad });
  } catch (fehler) {
    /* Ordner existiert (noch) nicht — leere Map ist das richtige Ergebnis */
    return karte;
  }
  const eintragAufnehmen = (e) => {
    if (e['.tag'] === 'file') karte.set(e.name, e);
  };
  (ergebnis.entries || []).forEach(eintragAufnehmen);
  while (ergebnis.has_more) {
    ergebnis = await dropboxApiAufruf('files/list_folder/continue', { cursor: ergebnis.cursor });
    (ergebnis.entries || []).forEach(eintragAufnehmen);
  }
  return karte;
}

/* ----------------------------------------------------------------
   5. CSV-PARSER UND DATEN-IMPORT

   Eigener CSV-Parser für die deutschen Excel-Dateien:
   - Trennzeichen: Semikolon
   - Dezimaltrennzeichen: Komma (wird beim Lesen in Punkt umgewandelt)
   - Encoding: UTF-8 mit BOM (BOM wird entfernt)
   ---------------------------------------------------------------- */

/**
 * Zerlegt einen CSV-Text in Zeilen aus Feldern. Beachtet
 * Anfuehrungszeichen nach RFC 4180: innerhalb von "..." duerfen
 * Semikolon und Zeilenumbruch stehen, "" ist ein literales
 * Anfuehrungszeichen. So gehen freie Bemerkungs-Texte mit Semikolon
 * nicht kaputt. Trennzeichen ist das Semikolon (deutsche Excel-Notation).
 * @param {string} text - Der gesamte CSV-Inhalt
 * @returns {Array<Array<string>>} - Zeilen, je Zeile ein Feld-Array
 */
function csvInFelderZerlegen(text) {
  /* BOM (Byte Order Mark) am Anfang entfernen, falls vorhanden */
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const zeilen = [];
  let aktuelleZeile = [];
  let feld = '';
  let inAnfuehrung = false;
  let i = 0;

  while (i < text.length) {
    const zeichen = text[i];

    if (inAnfuehrung) {
      if (zeichen === '"') {
        /* Verdoppeltes Anfuehrungszeichen = ein literales " */
        if (text[i + 1] === '"') { feld += '"'; i += 2; continue; }
        inAnfuehrung = false; i++; continue;
      }
      feld += zeichen; i++; continue;
    }

    if (zeichen === '"') { inAnfuehrung = true; i++; continue; }
    if (zeichen === ';') { aktuelleZeile.push(feld); feld = ''; i++; continue; }
    if (zeichen === '\r') { i++; continue; }            /* CR ignorieren (CRLF→LF) */
    if (zeichen === '\n') {
      aktuelleZeile.push(feld);
      zeilen.push(aktuelleZeile);
      aktuelleZeile = []; feld = ''; i++; continue;
    }
    feld += zeichen; i++;
  }

  /* Letztes Feld/letzte Zeile abschliessen (falls Datei ohne
     abschliessenden Zeilenumbruch endet) */
  if (feld !== '' || aktuelleZeile.length > 0) {
    aktuelleZeile.push(feld);
    zeilen.push(aktuelleZeile);
  }
  return zeilen;
}

/**
 * Wandelt eine CSV-Zeichenkette in ein Array von Objekten um.
 * Die erste Zeile wird als Kopfzeile (Spaltennamen) verwendet.
 * @param {string} csvText - Der gesamte CSV-Inhalt als Text
 * @returns {Array<Object>} - Array mit einem Objekt pro Datenzeile
 */
function csvParsen(csvText) {
  /* Komplett leere Zeilen verwerfen (z. B. Leerzeile am Dateiende) */
  const zeilen = csvInFelderZerlegen(csvText)
    .filter(z => !(z.length === 1 && z[0].trim() === ''));

  if (zeilen.length < 2) return [];

  const kopfzeile = zeilen[0].map(s => s.trim());
  const ergebnis = [];
  for (let i = 1; i < zeilen.length; i++) {
    const felder = zeilen[i];
    const objekt = {};
    kopfzeile.forEach((spalte, index) => {
      objekt[spalte] = (felder[index] !== undefined ? felder[index] : '').trim();
    });
    ergebnis.push(objekt);
  }
  return ergebnis;
}

/**
 * Serialisiert ein einzelnes CSV-Feld in deutscher Excel-Notation.
 * Felder mit Semikolon, Anfuehrungszeichen oder Zeilenumbruch werden
 * in Anfuehrungszeichen gesetzt, innere " werden verdoppelt.
 * @param {*} wert - Der Feldwert (Zahl, String, null, undefined)
 * @returns {string}
 */
function csvFeldSerialisieren(wert) {
  if (wert === null || wert === undefined) return '';
  let text = String(wert);
  if (/[;"\n\r]/.test(text)) {
    text = '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

/**
 * Baut eine vollstaendige CSV-Datei in deutscher Excel-Notation:
 * UTF-8-BOM, Semikolon-Trenner, \n-Zeilenenden, abschliessender
 * Zeilenumbruch. Die Spaltenreihenfolge bestimmt das Ergebnis.
 * @param {Array<string>} spalten - Spaltennamen (Reihenfolge = Ausgabe)
 * @param {Array<Object>} zeilen - Datenzeilen als Objekte
 * @returns {string} - Der fertige CSV-Text inkl. BOM
 */
function csvSchreiben(spalten, zeilen) {
  const BOM = '﻿';
  const kopf = spalten.map(csvFeldSerialisieren).join(';');
  const koerper = zeilen
    .map(zeile => spalten.map(sp => csvFeldSerialisieren(zeile[sp])).join(';'))
    .join('\n');
  /* Header immer mit \n abschliessen; Koerper nur wenn vorhanden */
  return BOM + kopf + '\n' + (koerper ? koerper + '\n' : '');
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

  /* Vor dem Neuaufbau: bereits vom Nutzer eingegebene Einheiten-Gramm-
     Werte (z. B. "1 Scheibe = 22 g") sichern, damit sie einen Re-Import
     ueberleben. Diese Werte stehen in Phase C noch NICHT in der Dropbox-
     CSV — das Zurueckschreiben macht erst Phase F. Ohne diese Sicherung
     wuerde "Datenbank neu aufbauen" sie loeschen. */
  const lmBestand = await dbAllesLesen('lebensmittel').catch(() => []);
  const egBestand = await dbAllesLesen('eigengerichte').catch(() => []);
  const lmEinheitenAlt = new Map();
  for (const alt of lmBestand) {
    lmEinheitenAlt.set(alt.lebensmittel_id, einheitenFelderUebernehmen(alt));
  }
  const egEinheitenAlt = new Map();
  for (const alt of egBestand) {
    egEinheitenAlt.set(alt.gericht_id, einheitenFelderUebernehmen(alt));
  }

  /* Schritt 1: Lebensmittel-Stammdaten */
  fortschritt('Lade Lebensmittel-Stammdaten…');
  const lmCsv = await dropboxDateiHerunterladen('/01_Stammdaten_Lebensmittel.csv');
  const lmRoh = csvParsen(lmCsv);

  const lebensmittelListe = lmRoh.map(z => {
    const eintrag = {
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
      /* Einheiten-Gramm-Werte: aus CSV uebernehmen falls vorhanden
         (alte CSV hat die Spalten nicht → leer). */
      gramm_pro_stueck:      z.gramm_pro_stueck     || '',
      gramm_pro_portion:     z.gramm_pro_portion    || '',
      gramm_pro_scheibe:     z.gramm_pro_scheibe    || '',
      gramm_pro_essloeffel:  z.gramm_pro_essloeffel || '',
      gramm_pro_teeloeffel:  z.gramm_pro_teeloeffel || '',
    };
    /* Lokal vom Nutzer eingegebene Werte haben Vorrang und bleiben
       erhalten (samt Sync-Markierung "geaendert"). */
    const bewahrt = lmEinheitenAlt.get(z.lebensmittel_id);
    return bewahrt ? { ...eintrag, ...bewahrt } : eintrag;
  });

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
        /* Einheiten-Gramm-Werte (Gerichte haben oft "Portion") */
        gramm_pro_stueck:      zeile.gramm_pro_stueck     || '',
        gramm_pro_portion:     zeile.gramm_pro_portion    || '',
        gramm_pro_scheibe:     zeile.gramm_pro_scheibe    || '',
        gramm_pro_essloeffel:  zeile.gramm_pro_essloeffel || '',
        gramm_pro_teeloeffel:  zeile.gramm_pro_teeloeffel || '',
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
    /* Lokal eingegebene Einheiten-Werte bewahren (Vorrang vor CSV). */
    const bewahrt = egEinheitenAlt.get(gerichtId);
    if (bewahrt) Object.assign(gericht, bewahrt);
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
   5b. ZEIT-, DATUMS-, KONFIGURATIONS- UND EINHEITEN-HILFEN (Phase C)

   Kleine, reine Hilfsfunktionen fuer die Tageseingabe: heutiges
   Datum/Uhrzeit, Mahlzeit-Typ-Automatik, Einheiten-Umrechnung.
   ---------------------------------------------------------------- */

/**
 * Liefert das heutige Datum als ISO-Zeichenkette YYYY-MM-DD in
 * LOKALER Zeit. Bewusst nicht toISOString() (das waere UTC und je
 * nach Uhrzeit einen Tag daneben).
 */
function heutigesDatum() {
  const d = new Date();
  const jahr  = d.getFullYear();
  const monat = String(d.getMonth() + 1).padStart(2, '0');
  const tag   = String(d.getDate()).padStart(2, '0');
  return `${jahr}-${monat}-${tag}`;
}

/**
 * Liefert die aktuelle Uhrzeit als "HH:MM" (lokale Zeit).
 */
function aktuelleUhrzeit() {
  const d = new Date();
  const stunde = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${stunde}:${minute}`;
}

/**
 * Voller Zeitstempel (ISO) fuer das Feld geaendert_am.
 */
function jetztZeitstempel() {
  return new Date().toISOString();
}

/**
 * Formatiert ein ISO-Datum als "Di 30.06." (Wochentag + Tag.Monat.).
 * @param {string} datumIso - YYYY-MM-DD
 */
function wochentagDatum(datumIso) {
  const wochentage = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const teile = datumIso.split('-');
  /* Datum lokal um die Mittagszeit bilden — so kann keine Zeitzonen-
     Verschiebung den Wochentag ueber Mitternacht kippen. */
  const d = new Date(Number(teile[0]), Number(teile[1]) - 1, Number(teile[2]), 12, 0, 0);
  const wt    = wochentage[d.getDay()];
  const tag   = String(d.getDate()).padStart(2, '0');
  const monat = String(d.getMonth() + 1).padStart(2, '0');
  return `${wt} ${tag}.${monat}.`;
}

/**
 * Erzeugt eine garantiert eindeutige Erfassungs-ID:
 * ERF_<Zeitstempel-ms>_<Zufallssuffix>. Auch ueber Geraete eindeutig.
 */
function erfassungsIdErzeugen() {
  const zeit = Date.now();
  const zufall = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(zufall).map(b => b.toString(16).padStart(2, '0')).join('');
  return `ERF_${zeit}_${suffix}`;
}

/**
 * Sammelt aus einem Lebensmittel-/Gericht-Objekt die Felder, die einen
 * Re-Import ueberleben sollen: gesetzte Einheiten-Gramm-Werte und (falls
 * noch ausstehend) die Sync-Markierung. Genutzt beim Daten-Neuaufbau.
 */
function einheitenFelderUebernehmen(obj) {
  const ergebnis = {};
  for (const feld of Object.values(EINHEIT_ZU_FELD)) {
    if (obj[feld] !== undefined && obj[feld] !== '' && obj[feld] !== null) {
      ergebnis[feld] = obj[feld];
    }
  }
  if (obj.sync_status === 'geaendert' || obj.sync_status === 'neu') {
    ergebnis.sync_status = obj.sync_status;
    if (obj.geaendert_am) ergebnis.geaendert_am = obj.geaendert_am;
  }
  return ergebnis;
}

/**
 * Liest einen Konfigurationswert, der als Zahl oder als deutsche
 * Zeichenkette ("2,0") vorliegen kann. Fehlt er, kommt der Standard.
 */
function zahlAusKonfig(wert, standard) {
  if (wert === undefined || wert === null || wert === '') return standard;
  if (typeof wert === 'number') return wert;
  return deutscheZahlParsen(wert);
}

/* Zwischenspeicher fuer die normalisierte Konfiguration. */
let konfigCache = null;

/**
 * Liefert Tagesbilanz-Ziele und Zeitregeln, ergaenzt um Standardwerte
 * fuer alles, was in der echten 05_Konfiguration.json (noch) fehlt.
 */
async function konfigurationHolen() {
  if (konfigCache) return konfigCache;
  const eintrag = await dbLesen('konfiguration', 'config');
  const roh = (eintrag && eintrag.daten) ? eintrag.daten : {};
  const zeit = roh.mahlzeit_zeitregeln || {};
  konfigCache = {
    tagesziel_kcal:   Math.round(zahlAusKonfig(roh.tagesziel_kcal, STANDARD_TAGESZIEL_KCAL)),
    kcal_gruen_bis:   Math.round(zahlAusKonfig(roh.kcal_gruen_bis, STANDARD_KCAL_GRUEN_BIS)),
    trink_ziel_liter: zahlAusKonfig(roh.trink_ziel_liter, STANDARD_TRINK_ZIEL_LITER),
    morgens_bis:      zeit.morgens_bis   || STANDARD_ZEITREGELN.morgens_bis,
    mittags_start:    zeit.mittags_start || STANDARD_ZEITREGELN.mittags_start,
    mittags_bis:      zeit.mittags_bis   || STANDARD_ZEITREGELN.mittags_bis,
    abends_ab:        zeit.abends_ab     || STANDARD_ZEITREGELN.abends_ab,
  };
  return konfigCache;
}

/**
 * Schlaegt den Mahlzeit-Typ anhand der Uhrzeit vor (aus den
 * Konfigurations-Zeitregeln). Der Vergleich als "HH:MM"-Zeichenkette
 * funktioniert, weil Stunden und Minuten zweistellig sind.
 */
function mahlzeitTypAusUhrzeit(uhrzeit, konfig) {
  if (uhrzeit < konfig.morgens_bis)   return 'Morgens';
  if (uhrzeit < konfig.mittags_start) return 'Zwischen';
  if (uhrzeit < konfig.mittags_bis)   return 'Mittags';
  if (uhrzeit < konfig.abends_ab)     return 'Zwischen';
  return 'Abends';
}

/**
 * Anzeige-Text fuer Menge + Einheit, z. B. (3, "Scheibe") →
 * "3 Scheiben", (1, "Portion") → "1 Portion".
 */
function einheitAnzeige(menge, einheit) {
  const mehrzahl = (Number(menge) === 1) ? einheit : (EINHEIT_MEHRZAHL[einheit] || einheit);
  return `${mengeFormatieren(Number(menge))} ${mehrzahl}`;
}

/**
 * Liefert die kcal pro 100 g eines Lebensmittels oder Gerichts.
 * Bei Gerichten der gecachte berechnete Wert.
 */
function kcalProHundert(objekt, istEigengericht) {
  if (!objekt) return 0;
  if (istEigengericht) {
    return Number(objekt.kcal_pro_100g_berechnet) || 0;
  }
  return deutscheZahlParsen(objekt.kcal_pro_100g);
}

/**
 * Rechnet eine Eingabe (Menge + Einheit) in Gramm um.
 * @returns {Object} { gramm, hatWert, feldname, proEinheit } —
 *   hatWert=false, wenn fuer die Einheit (ausser Gramm) noch kein
 *   Gewicht hinterlegt ist (dann muss das Popup gezeigt werden).
 */
function grammBerechnen(menge, einheit, objekt) {
  const m = Number(menge) || 0;
  if (einheit === 'Gramm') {
    return { gramm: m, hatWert: true, feldname: null, proEinheit: 1 };
  }
  const feldname = EINHEIT_ZU_FELD[einheit];
  const hinterlegt = objekt ? deutscheZahlParsen(objekt[feldname]) : 0;
  if (hinterlegt > 0) {
    return { gramm: m * hinterlegt, hatWert: true, feldname, proEinheit: hinterlegt };
  }
  return { gramm: 0, hatWert: false, feldname, proEinheit: 0 };
}

/* ----------------------------------------------------------------
   6. MINI-ROUTER

   Hash-basiertes Routing: die URL hinter dem # bestimmt, welcher
   Bildschirm angezeigt wird. Beispiel: #/lebensmittel-detail/LM_0001
   ---------------------------------------------------------------- */

/* Globale Zustandsvariablen für die Listenansichten */
let lebensmittelSuchfilter     = '';
let lebensmittelGruppenfilter  = 'alle';
let gerichteSuchfilter         = '';
let gerichteKategoriefilter    = 'alle';

/* Zustand des Erfassen-Ablaufs (Suche → Menge → speichern). */
let erfassenModus       = 'lebensmittel';  /* 'lebensmittel' | 'gerichte' */
let erfassenSuchfilter  = '';
let erfassenAuswahl     = null;  /* gewaehltes Lebensmittel/Gericht (Objekt) */
let erfassenBearbeitenId = null; /* erfassungs_id im Bearbeiten-Modus, sonst null */

/* Zuordnung Bildschirm → Tab, der unten markiert sein soll. Detail-
   und Unter-Bildschirme verweisen auf ihren uebergeordneten Tab. */
const ANSICHT_ZU_TAB = {
  'ansicht-heute':              'heute',
  'ansicht-vitalwerte':         'vitalwerte',
  'ansicht-erfassen-suche':     'erfassen',
  'ansicht-erfassen-menge':     'erfassen',
  'ansicht-lebensmittel':       'datenbank',
  'ansicht-gerichte':           'datenbank',
  'ansicht-lebensmittel-detail':'datenbank',
  'ansicht-gericht-detail':     'datenbank',
  'ansicht-einstellungen':      'mehr',
};

/* Bildschirme, bei denen die untere Tab-Leiste sichtbar ist. */
const ANSICHTEN_MIT_TABBAR = new Set([
  'ansicht-heute',
  'ansicht-vitalwerte',
  'ansicht-erfassen-suche',
  'ansicht-lebensmittel',
  'ansicht-gerichte',
  'ansicht-einstellungen',
]);

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
  if (ANSICHTEN_MIT_TABBAR.has(ansichtId)) {
    tabLeiste.classList.remove('versteckt');
  } else {
    tabLeiste.classList.add('versteckt');
  }

  /* Aktiven Tab markieren: jeder Bildschirm gehoert zu genau einem Tab
     (Detail-/Unterseiten markieren ihren Eltern-Tab). Der zentrale
     "+"-Knopf (Erfassen) wird nie als aktiv markiert. */
  const aktiverTab = ANSICHT_ZU_TAB[ansichtId] || '';
  document.querySelectorAll('.tab-knopf').forEach(knopf => {
    knopf.classList.toggle('aktiv', knopf.dataset.tab === aktiverTab);
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
    case 'heute':
      ansichtAnzeigen('ansicht-heute');
      await heuteAnsichtLaden();
      break;
    case 'vitalwerte':
      ansichtAnzeigen('ansicht-vitalwerte');
      await vitalwerteLaden();
      break;
    case 'erfassen':
      ansichtAnzeigen('ansicht-erfassen-suche');
      await erfassenSucheLaden();
      break;
    case 'erfassen-menge':
      /* Braucht eine vorher getroffene Auswahl (Modul-Zustand). Fehlt
         sie — z. B. nach einem Neuladen direkt auf dieser URL — geht
         es zurueck zur Suche. */
      if (erfassenAuswahl) {
        ansichtAnzeigen('ansicht-erfassen-menge');
        await erfassenMengeLaden();
      } else {
        await navigieren('erfassen');
      }
      break;
    case 'lebensmittel':
      ansichtAnzeigen('ansicht-lebensmittel');
      await lebensmittelListeLaden();
      break;
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
      /* Standard-Startbildschirm ist "Heute" */
      ansichtAnzeigen('ansicht-heute');
      await heuteAnsichtLaden();
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

    /* Fertig → zur Heute-Ansicht (neuer Startbildschirm) */
    ladebalken.classList.add('versteckt');
    await navigieren('heute');
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
  /* Die Status-Zeile zeigt jetzt den Sync-Zustand (Phase F). Bei einem
     Wechsel online↔offline einfach die Anzeige neu zeichnen. */
  syncStatusAnzeigen();
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

  /* Offene (noch nicht hochgeladene) Aenderungen zaehlen: Datensaetze
     mit sync_status "neu"/"geaendert" ueber alle vier Datendateien. */
  let offen = 0;
  try {
    const offenEl = document.getElementById('einst-offen-anzahl');
    const istOffen = d => d.sync_status === 'neu' || d.sync_status === 'geaendert';
    const erf = await dbAllesLesen('erfassung');
    const vit = await dbAllesLesen('vitaldaten');
    const lm  = await dbAllesLesen('lebensmittel');
    const eg  = await dbAllesLesen('eigengerichte');
    offen = erf.filter(istOffen).length + vit.filter(istOffen).length +
            lm.filter(istOffen).length + eg.filter(istOffen).length;
    offenEl.textContent = String(offen);
    offenEl.classList.toggle('erfolg', offen === 0);
  } catch (e) {
    document.getElementById('einst-offen-anzahl').textContent = '—';
  }

  /* Status-Zeile passend zum offenen Stand aktualisieren (sofern nicht
     gerade ein Sync laeuft). */
  if (offen > 0 && letzterSyncStatus !== 'laeuft') {
    letzterSyncStatus = 'ausstehend';
  } else if (offen === 0 && letzterSyncStatus === 'ausstehend') {
    letzterSyncStatus = 'synchron';
  }
  syncStatusAnzeigen();

  /* Sicherungen: Zeitpunkt des letzten Backups + behaltene Versionen */
  const syncMeta = await syncMetaHolen();
  const sicherungZeit = letzteSicherungMs || syncMeta.letzte_sicherung;
  const backupEl = document.getElementById('einst-backup-zeit');
  if (backupEl) {
    if (sicherungZeit) {
      const d = new Date(sicherungZeit);
      const heute = (d.toDateString() === new Date().toDateString());
      backupEl.textContent = (heute ? 'heute ' : `${zweiStellen(d.getDate())}.${zweiStellen(d.getMonth() + 1)}. `) +
        `${zweiStellen(d.getHours())}:${zweiStellen(d.getMinutes())}`;
    } else {
      backupEl.textContent = 'Noch keine';
    }
  }

  /* Anzahlen aus IndexedDB */
  const lmAnzahl  = await dbZaehlen('lebensmittel');
  const egAnzahl  = await dbZaehlen('eigengerichte');
  const erfAnzahl = await dbZaehlen('erfassung');
  document.getElementById('einst-lm-anzahl').textContent = lmAnzahl;
  document.getElementById('einst-eg-anzahl').textContent = egAnzahl;
  const erfEl = document.getElementById('einst-erf-anzahl');
  if (erfEl) erfEl.textContent = erfAnzahl;

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
   7b. PHASE-C-BILDSCHIRME: Heute, Erfassen, Vitalwerte

   Die Tageseingabe. Schreibt ausschliesslich in die lokale IndexedDB
   (kein Dropbox-Upload — das ist Phase F). Alle neuen/geaenderten
   Datensaetze bekommen geaendert_am + sync_status (Vorbereitung F).
   ---------------------------------------------------------------- */

/* Vorbelegung der Mengen-Maske (im Bearbeiten-Modus gefuellt). */
let erfassenVorbelegung = null;
/* Welche Einheit gerade im Popup abgefragt wird. */
let popupEinheitAktuell = null;

/**
 * Liefert eine Map lebensmittel_id → Lebensmittel (nutzt den Cache).
 */
async function lebensmittelMapHolen() {
  if (!lebensmittelCache) lebensmittelCache = await dbAllesLesen('lebensmittel');
  return new Map(lebensmittelCache.map(lm => [lm.lebensmittel_id, lm]));
}

/**
 * Liefert eine Map gericht_id → Eigengericht (nutzt den Cache).
 */
async function gerichteMapHolen() {
  if (!gerichteCache) gerichteCache = await dbAllesLesen('eigengerichte');
  return new Map(gerichteCache.map(g => [g.gericht_id, g]));
}

/**
 * Bestimmt den naechsten Sync-Status nach einer Aenderung:
 * noch nie hochgeladene Datensaetze bleiben "neu", bereits
 * synchronisierte werden "geaendert".
 */
function naechsterSyncStatus(alterStatus) {
  if (!alterStatus || alterStatus === 'neu') return 'neu';
  return 'geaendert';
}

/* -- Bildschirm: Heute (Startbildschirm) ------------------------ */

/**
 * Baut den SVG-Donut fuer die Tageskalorien. Der Ring faerbt sich nach
 * den Konfigurations-Grenzen (gruen/gelb/rot) und fuellt sich
 * proportional zum Tagesziel.
 */
function kalorienKreisSvg(summe, konfig) {
  const radius = 62;
  const umfang = 2 * Math.PI * radius;            /* ≈ 389,56 */
  const ziel   = konfig.tagesziel_kcal;
  const anteil = ziel > 0 ? Math.min(summe / ziel, 1) : 0;
  const fuellung = umfang * anteil;
  const rest     = umfang - fuellung;

  let farbe;
  if (summe <= konfig.kcal_gruen_bis)      farbe = 'var(--gruen)';
  else if (summe <= konfig.tagesziel_kcal) farbe = 'var(--gelb)';
  else                                     farbe = 'var(--rot)';

  return `
    <svg width="150" height="150" viewBox="0 0 150 150" role="img" class="heute-ring">
      <title>Tageskalorien ${summe} von ${ziel}</title>
      <circle cx="75" cy="75" r="${radius}" fill="none" stroke="var(--flaeche-gedaempft)" stroke-width="14"/>
      <circle cx="75" cy="75" r="${radius}" fill="none" stroke="${farbe}" stroke-width="14"
        stroke-linecap="round" stroke-dasharray="${fuellung.toFixed(1)} ${rest.toFixed(1)}"
        transform="rotate(-90 75 75)"/>
      <text x="75" y="70" text-anchor="middle" class="heute-ring-zahl">${summe}</text>
      <text x="75" y="92" text-anchor="middle" class="heute-ring-ziel">von ${ziel} kcal</text>
    </svg>`;
}

/**
 * Liefert den Hinweistext unter dem Kalorien-Kreis.
 */
function kalorienHinweis(summe, konfig) {
  if (summe <= konfig.kcal_gruen_bis) {
    return `noch ${konfig.kcal_gruen_bis - summe} kcal im grünen Bereich`;
  }
  if (summe <= konfig.tagesziel_kcal) {
    return `noch ${konfig.tagesziel_kcal - summe} kcal bis zum Tagesziel`;
  }
  return `Tagesziel um ${summe - konfig.tagesziel_kcal} kcal überschritten`;
}

/**
 * Laedt und rendert die Heute-Ansicht: Kalorien-Kreis, Trinkmengen-
 * Balken und die nach Mahlzeit-Typ gruppierten Eintraege des Tages.
 */
async function heuteAnsichtLaden() {
  const datum = heutigesDatum();
  document.getElementById('heute-titel').textContent = 'Heute · ' + wochentagDatum(datum);

  const konfig = await konfigurationHolen();
  const eintraege = await dbIndexLesen('erfassung', 'nach_datum', datum);
  const lmMap = await lebensmittelMapHolen();
  const egMap = await gerichteMapHolen();

  /* Summen berechnen; kcal je Eintrag fuer die Anzeige zwischenspeichern */
  let summeKcal = 0;
  let trinkenGramm = 0;
  for (const e of eintraege) {
    const objekt = e.ist_eigengericht ? egMap.get(e.eigengericht_id) : lmMap.get(e.lebensmittel_id);
    const kcal = Math.round((e.menge_g / 100) * kcalProHundert(objekt, e.ist_eigengericht));
    e._kcal = kcal;
    summeKcal += kcal;
    if (e.mahlzeit_typ === 'Trinken') trinkenGramm += e.menge_g;
  }

  const liter = trinkenGramm / 1000;
  const trinkAnteil = konfig.trink_ziel_liter > 0 ? Math.min(liter / konfig.trink_ziel_liter, 1) : 0;

  /* Tropfen-Symbol fuer den Trinkmengen-Balken */
  const tropfenSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" style="vertical-align:-2px"><path d="M12 3c3 4 6 7 6 10.5a6 6 0 0 1 -12 0C6 10 9 7 12 3z"/></svg>';

  const teile = [];
  teile.push(`<div class="heute-ring-wrap">${kalorienKreisSvg(summeKcal, konfig)}<div class="heute-ring-sub">${escapeHtml(kalorienHinweis(summeKcal, konfig))}</div></div>`);
  teile.push(`
    <div class="balken-reihe">
      <div class="balken-kopf">
        <span class="balken-label">${tropfenSvg} Trinkmenge</span>
        <span class="balken-wert">${zahlDe(liter, 1)} / ${zahlDe(konfig.trink_ziel_liter, 1)} L</span>
      </div>
      <div class="balken-spur"><div class="balken-fueller" style="width:${(trinkAnteil * 100).toFixed(0)}%"></div></div>
    </div>`);

  teile.push('<div class="abschnitt-titel">Mahlzeiten heute</div>');

  if (eintraege.length === 0) {
    teile.push('<div class="leerer-zustand">Noch nichts erfasst. Tippe unten auf „+", um eine Mahlzeit hinzuzufügen.</div>');
  } else {
    for (const typ of MAHLZEIT_REIHENFOLGE) {
      const gruppe = eintraege.filter(e => e.mahlzeit_typ === typ);
      if (gruppe.length === 0) continue;
      const gruppenSumme = gruppe.reduce((s, e) => s + e._kcal, 0);
      teile.push(`<div class="mahlzeit-gruppe-kopf"><span>${escapeHtml(typ)}</span><span>${gruppenSumme} kcal</span></div>`);
      gruppe.sort((a, b) => (a.zeit || '').localeCompare(b.zeit || ''));
      for (const e of gruppe) {
        const mengeText = (e.einheit_eingabe && e.einheit_eingabe !== 'Gramm')
          ? `${einheitAnzeige(e.menge_eingabe, e.einheit_eingabe)} · ${mengeFormatieren(e.menge_g)} g`
          : `${mengeFormatieren(e.menge_g)} g`;
        teile.push(`
          <div class="mahlzeit-eintrag" data-id="${escapeHtml(e.erfassungs_id)}" tabindex="0">
            <span class="mahlzeit-name">${escapeHtml(e.lebensmittel_name)}<span class="mahlzeit-menge">${escapeHtml(mengeText)}</span></span>
            <span class="mahlzeit-kcal">${e._kcal} kcal</span>
          </div>`);
      }
    }
  }

  const inhalt = document.getElementById('heute-inhalt');
  inhalt.innerHTML = teile.join('');
  inhalt.querySelectorAll('.mahlzeit-eintrag').forEach(el => {
    el.addEventListener('click', () => eintragBearbeitenOeffnen(el.dataset.id));
  });
}

/* -- Bildschirm: Erfassen Schritt 1 (Suche) --------------------- */

/**
 * Setzt den Erfassen-Ablauf auf Anfang (wird vom "+"-Knopf gerufen).
 */
function erfassenNeuStarten() {
  erfassenModus       = 'lebensmittel';
  erfassenSuchfilter  = '';
  erfassenAuswahl     = null;
  erfassenBearbeitenId = null;
  erfassenVorbelegung = null;
  navigieren('erfassen');
}

/**
 * Laedt die Such-Ansicht (Segment + Suchfeld auf aktuellen Stand,
 * Caches sicherstellen, Treffer rendern).
 */
async function erfassenSucheLaden() {
  document.getElementById('erfassen-suche').value = erfassenSuchfilter;
  document.querySelectorAll('#erfassen-segment .segment-knopf').forEach(k => {
    k.classList.toggle('aktiv', k.dataset.modus === erfassenModus);
  });
  if (!lebensmittelCache) lebensmittelCache = await dbAllesLesen('lebensmittel');
  if (!gerichteCache)     gerichteCache     = await dbAllesLesen('eigengerichte');
  erfassenTrefferRendern();
}

/**
 * Rendert die Trefferliste der Live-Suche (Lebensmittel oder Gerichte).
 * Begrenzt auf die ersten 100 Treffer, um die Liste fluessig zu halten.
 */
function erfassenTrefferRendern() {
  const suche = erfassenSuchfilter.toLowerCase();
  const listeEl = document.getElementById('erfassen-treffer');
  const MAX = 100;
  const html = [];

  if (erfassenModus === 'lebensmittel') {
    const treffer = (lebensmittelCache || []).filter(lm =>
      lm.name.toLowerCase().includes(suche) ||
      (lm.bemerkung && lm.bemerkung.toLowerCase().includes(suche)));
    treffer.sort((a, b) => a.name.localeCompare(b.name));
    if (treffer.length === 0) {
      listeEl.innerHTML = '<div class="leerer-zustand">Keine Lebensmittel gefunden.</div>';
      return;
    }
    for (const lm of treffer.slice(0, MAX)) {
      const kcal = Math.round(deutscheZahlParsen(lm.kcal_pro_100g));
      html.push(`<div class="listen-eintrag" data-typ="lm" data-id="${escapeHtml(lm.lebensmittel_id)}" tabindex="0"><span class="listen-eintrag-name">${escapeHtml(lm.name)}</span><span class="listen-eintrag-wert">${kcal} kcal</span></div>`);
    }
    if (treffer.length > MAX) {
      html.push(`<div class="listen-hinweis">… nur die ersten ${MAX} von ${treffer.length} Treffern. Bitte Suche eingrenzen.</div>`);
    }
  } else {
    const treffer = (gerichteCache || []).filter(g => g.gericht_name.toLowerCase().includes(suche));
    treffer.sort((a, b) => a.gericht_name.localeCompare(b.gericht_name));
    if (treffer.length === 0) {
      listeEl.innerHTML = '<div class="leerer-zustand">Keine Gerichte gefunden.</div>';
      return;
    }
    for (const g of treffer.slice(0, MAX)) {
      const kcalText = g.kcal_unvollstaendig ? `${g.kcal_pro_100g_berechnet} kcal*` : `${g.kcal_pro_100g_berechnet} kcal`;
      html.push(`<div class="listen-eintrag" data-typ="eg" data-id="${escapeHtml(g.gericht_id)}" tabindex="0"><span class="listen-eintrag-name">${escapeHtml(g.gericht_name)}</span><span class="listen-eintrag-wert">${kcalText}</span></div>`);
    }
    if (treffer.length > MAX) {
      html.push(`<div class="listen-hinweis">… nur die ersten ${MAX} von ${treffer.length} Treffern. Bitte Suche eingrenzen.</div>`);
    }
  }

  listeEl.innerHTML = html.join('');
  listeEl.querySelectorAll('.listen-eintrag').forEach(el => {
    el.addEventListener('click', () => erfassenTrefferGewaehlt(el.dataset.typ === 'eg', el.dataset.id));
  });
}

/**
 * Wird beim Antippen eines Suchtreffers gerufen: Auswahl merken und
 * zur Mengen-Eingabe wechseln (Neu-Modus).
 */
async function erfassenTrefferGewaehlt(istEigengericht, id) {
  const objekt = istEigengericht ? await dbLesen('eigengerichte', id) : await dbLesen('lebensmittel', id);
  if (!objekt) return;
  erfassenAuswahl = {
    ist_eigengericht: istEigengericht,
    id,
    name: istEigengericht ? objekt.gericht_name : objekt.name,
    objekt,
  };
  erfassenBearbeitenId = null;
  erfassenVorbelegung  = null;
  await navigieren('erfassen-menge');
}

/* -- Bildschirm: Erfassen Schritt 2 (Menge + Einheit) ----------- */

/**
 * Laedt die Mengen-Maske: Kopf, Dropdowns, Vorbelegung, Live-Ergebnis.
 */
async function erfassenMengeLaden() {
  const auswahl = erfassenAuswahl;
  const konfig  = await konfigurationHolen();
  const kcal100 = kcalProHundert(auswahl.objekt, auswahl.ist_eigengericht);

  document.getElementById('menge-titel').textContent =
    erfassenBearbeitenId ? 'Eintrag bearbeiten' : 'Menge eingeben';
  document.getElementById('menge-name').textContent = auswahl.name;
  document.getElementById('menge-kcal-info').textContent = `${kcal100} kcal pro 100 g`;

  /* Einheit-Dropdown */
  document.getElementById('menge-einheit').innerHTML =
    EINHEITEN.map(e => `<option value="${e}">${e}</option>`).join('');
  /* Mahlzeit-Typ-Dropdown */
  document.getElementById('menge-typ').innerHTML =
    MAHLZEIT_REIHENFOLGE.map(t => `<option value="${t}">${t}</option>`).join('');

  /* Vorbelegung: im Bearbeiten-Modus aus dem Eintrag, sonst Defaults */
  let vorMenge, vorEinheit, vorTyp, vorZeit;
  if (erfassenVorbelegung) {
    vorMenge   = erfassenVorbelegung.menge;
    vorEinheit = erfassenVorbelegung.einheit;
    vorTyp     = erfassenVorbelegung.typ;
    vorZeit    = erfassenVorbelegung.uhrzeit;
  } else {
    vorMenge   = '100';
    vorEinheit = 'Gramm';
    vorZeit    = aktuelleUhrzeit();
    vorTyp     = mahlzeitTypAusUhrzeit(vorZeit, konfig);
  }
  document.getElementById('menge-zahl').value     = vorMenge;
  document.getElementById('menge-einheit').value  = vorEinheit;
  document.getElementById('menge-typ').value      = vorTyp;
  document.getElementById('menge-uhrzeit').value  = vorZeit;

  document.getElementById('menge-loeschen').classList.toggle('versteckt', !erfassenBearbeitenId);
  document.getElementById('menge-hinzufuegen').textContent =
    erfassenBearbeitenId ? 'Änderung speichern' : 'Zur Aufschreibung hinzufügen';

  erfassenLiveBerechnen();
}

/**
 * Aktualisiert die Live-Ergebnis-Box (Gramm + kcal + Einheiten-Hinweis).
 */
function erfassenLiveBerechnen() {
  const auswahl = erfassenAuswahl;
  if (!auswahl) return;
  const menge   = deutscheZahlParsen(document.getElementById('menge-zahl').value);
  const einheit = document.getElementById('menge-einheit').value;
  const kcal100 = kcalProHundert(auswahl.objekt, auswahl.ist_eigengericht);
  const berechnung = grammBerechnen(menge, einheit, auswahl.objekt);

  const ergebnisEl = document.getElementById('menge-ergebnis');
  const hinweisEl  = document.getElementById('menge-ergebnis-hinweis');

  if (!berechnung.hatWert) {
    ergebnisEl.textContent = '— g · — kcal';
    hinweisEl.textContent  = `Für „${einheit}" ist noch kein Gewicht hinterlegt.`;
    return;
  }
  const gramm = berechnung.gramm;
  const kcal  = Math.round((gramm / 100) * kcal100);
  ergebnisEl.textContent = `${mengeFormatieren(gramm)} g · ${kcal} kcal`;
  hinweisEl.textContent  = (einheit === 'Gramm')
    ? ''
    : `1 ${einheit} = ${mengeFormatieren(berechnung.proEinheit)} g (gespeichert)`;
}

/**
 * Reagiert auf einen Wechsel des Einheit-Dropdowns. Fehlt fuer die
 * gewaehlte Einheit ein Gramm-Wert, wird das Abfrage-Popup geoeffnet.
 */
function erfassenEinheitGewechselt() {
  const einheit = document.getElementById('menge-einheit').value;
  const menge   = deutscheZahlParsen(document.getElementById('menge-zahl').value) || 1;
  const berechnung = grammBerechnen(menge, einheit, erfassenAuswahl.objekt);
  if (!berechnung.hatWert) {
    einheitPopupOeffnen(einheit);
  } else {
    erfassenLiveBerechnen();
  }
}

/* -- Bildschirm: Einheiten-Abfrage (Popup) ---------------------- */

/**
 * Oeffnet das Popup zur Abfrage des Gramm-Gewichts einer Einheit.
 */
function einheitPopupOeffnen(einheit) {
  popupEinheitAktuell = einheit;
  const name = erfassenAuswahl.name;
  document.getElementById('popup-einheit-titel').textContent = `Wie viel wiegt eine ${einheit}?`;
  document.getElementById('popup-einheit-text').textContent =
    `Für „${name}" ist noch kein Gewicht für eine ${einheit} hinterlegt. Gib es einmalig an — es wird gespeichert und künftig automatisch genutzt.`;
  document.getElementById('popup-einheit-label').textContent = `Gewicht einer ${einheit} in Gramm`;
  const wertEl = document.getElementById('popup-einheit-wert');
  wertEl.value = '';
  document.getElementById('popup-einheit').classList.remove('versteckt');
  wertEl.focus();
}

/**
 * Schliesst das Einheiten-Popup.
 */
function einheitPopupSchliessen() {
  document.getElementById('popup-einheit').classList.add('versteckt');
  popupEinheitAktuell = null;
}

/**
 * Speichert den im Popup eingegebenen Gramm-Wert beim Lebensmittel/
 * Gericht (sync_status = "geaendert") und setzt die Berechnung fort.
 */
async function einheitPopupSpeichern() {
  const einheit = popupEinheitAktuell;
  const wert = deutscheZahlParsen(document.getElementById('popup-einheit-wert').value);
  if (wert <= 0) {
    fehlermeldungAnzeigen('Bitte ein Gewicht größer als 0 eingeben.');
    return;
  }
  const feldname = EINHEIT_ZU_FELD[einheit];
  const auswahl  = erfassenAuswahl;
  const store    = auswahl.ist_eigengericht ? 'eigengerichte' : 'lebensmittel';

  const frisch = await dbLesen(store, auswahl.id);
  if (frisch) {
    frisch[feldname]    = mengeFormatieren(wert);  /* deutsche Notation, CSV-konform */
    frisch.sync_status  = 'geaendert';
    frisch.geaendert_am = jetztZeitstempel();
    await dbSchreiben(store, frisch);
    auswahl.objekt = frisch;
    /* Caches verwerfen, damit Listen den neuen Wert sehen */
    lebensmittelCache = null;
    gerichteCache = null;
  }
  einheitPopupSchliessen();
  erfassenLiveBerechnen();
}

/**
 * Bricht das Popup ab und setzt die Einheit zurueck auf Gramm.
 */
function einheitPopupAbbrechen() {
  document.getElementById('menge-einheit').value = 'Gramm';
  einheitPopupSchliessen();
  erfassenLiveBerechnen();
}

/* -- Speichern / Bearbeiten / Loeschen eines Eintrags ----------- */

/**
 * Speichert den aktuellen Erfassen-Stand als Eintrag in IndexedDB
 * (neu oder als Aktualisierung) und kehrt zur Heute-Ansicht zurueck.
 */
async function erfassenSpeichern() {
  const auswahl = erfassenAuswahl;
  if (!auswahl) return;

  const mengeEingabe = deutscheZahlParsen(document.getElementById('menge-zahl').value);
  const einheit      = document.getElementById('menge-einheit').value;
  const typ          = document.getElementById('menge-typ').value;
  let   zeit         = document.getElementById('menge-uhrzeit').value.trim();

  if (mengeEingabe <= 0) {
    fehlermeldungAnzeigen('Bitte eine Menge größer als 0 eingeben.');
    return;
  }
  const berechnung = grammBerechnen(mengeEingabe, einheit, auswahl.objekt);
  if (!berechnung.hatWert) {
    einheitPopupOeffnen(einheit);
    return;
  }
  /* Uhrzeit grob pruefen (HH:MM); sonst aktuelle Zeit nehmen */
  if (!/^\d{1,2}:\d{2}$/.test(zeit)) zeit = aktuelleUhrzeit();

  const istEg = auswahl.ist_eigengericht;

  /* Bestehenden Eintrag holen (Bearbeiten) oder neuen anlegen */
  let eintrag;
  let altStatus;
  if (erfassenBearbeitenId) {
    eintrag = await dbLesen('erfassung', erfassenBearbeitenId) || { erfassungs_id: erfassenBearbeitenId };
    altStatus = eintrag.sync_status;
  } else {
    eintrag = { erfassungs_id: erfassungsIdErzeugen(), datum: heutigesDatum() };
    altStatus = undefined;
  }

  eintrag.zeit             = zeit;
  eintrag.mahlzeit_typ     = typ;
  eintrag.menge_g          = Math.round(berechnung.gramm * 10) / 10;
  eintrag.lebensmittel_id  = istEg ? '' : auswahl.id;
  eintrag.lebensmittel_name = auswahl.name;
  eintrag.ist_eigengericht = istEg;
  eintrag.eigengericht_id  = istEg ? auswahl.id : '';
  eintrag.gericht_kontext  = (einheit === 'Gramm') ? '' : einheitAnzeige(mengeEingabe, einheit);
  eintrag.bemerkung        = eintrag.bemerkung || '';
  eintrag.menge_eingabe    = mengeFormatieren(mengeEingabe);
  eintrag.einheit_eingabe  = einheit;
  eintrag.geaendert_am     = jetztZeitstempel();
  eintrag.sync_status      = naechsterSyncStatus(altStatus);

  await dbSchreiben('erfassung', eintrag);

  /* Phase F: 60-s-Sammelupload anstossen (debounce). */
  syncAnstossenNachErfassung();

  erfassenBearbeitenId = null;
  erfassenAuswahl      = null;
  erfassenVorbelegung  = null;
  await navigieren('heute');
}

/**
 * Oeffnet einen bestehenden Eintrag zum Bearbeiten (gleiche Maske wie
 * Erfassen-Schritt-2, vorbefuellt mit der Original-Eingabe).
 */
async function eintragBearbeitenOeffnen(erfassungsId) {
  const eintrag = await dbLesen('erfassung', erfassungsId);
  if (!eintrag) return;
  const istEg = !!eintrag.ist_eigengericht;
  const objekt = istEg
    ? await dbLesen('eigengerichte', eintrag.eigengericht_id)
    : await dbLesen('lebensmittel', eintrag.lebensmittel_id);

  erfassenAuswahl = {
    ist_eigengericht: istEg,
    id:   istEg ? eintrag.eigengericht_id : eintrag.lebensmittel_id,
    name: eintrag.lebensmittel_name,
    objekt,
  };
  erfassenBearbeitenId = erfassungsId;
  erfassenVorbelegung = {
    menge:   (eintrag.menge_eingabe !== undefined && eintrag.menge_eingabe !== '')
               ? eintrag.menge_eingabe : mengeFormatieren(eintrag.menge_g),
    einheit: eintrag.einheit_eingabe || 'Gramm',
    typ:     eintrag.mahlzeit_typ,
    uhrzeit: eintrag.zeit,
  };
  await navigieren('erfassen-menge');
}

/**
 * Loescht den gerade bearbeiteten Eintrag (mit Rueckfrage).
 */
async function erfassenEintragLoeschen() {
  if (!erfassenBearbeitenId) return;
  if (!confirm('Diesen Eintrag wirklich löschen?')) return;
  await dbLoeschen('erfassung', erfassenBearbeitenId);
  erfassenBearbeitenId = null;
  erfassenAuswahl      = null;
  erfassenVorbelegung  = null;
  await navigieren('heute');
}

/* -- Bildschirm: Vitalwerte ------------------------------------- */

/**
 * Laedt das Vitalwerte-Formular und befuellt es mit dem heutigen
 * Eintrag, falls schon einer existiert.
 */
async function vitalwerteLaden() {
  const datum = heutigesDatum();
  document.getElementById('vital-titel').textContent = 'Vitalwerte · ' + wochentagDatum(datum);

  const vorhanden = await dbLesen('vitaldaten', datum);
  const setze = (id, wert) => {
    document.getElementById(id).value = (wert === undefined || wert === null) ? '' : wert;
  };
  setze('vital-gewicht',   vorhanden && vorhanden.gewicht_kg);
  setze('vital-bauch',     vorhanden && vorhanden.bauchumfang_cm);
  setze('vital-arm',       vorhanden && vorhanden.armumfang_cm);
  setze('vital-sys',       vorhanden && vorhanden.blutdruck_systolisch);
  setze('vital-dia',       vorhanden && vorhanden.blutdruck_diastolisch);
  setze('vital-puls',      vorhanden && vorhanden.puls);
  setze('vital-kfaktor',   vorhanden && vorhanden.k_faktor);
  setze('vital-bemerkung', vorhanden && vorhanden.bemerkung);

  document.getElementById('vital-hinweis').textContent =
    vorhanden ? 'Heutiger Eintrag geladen — Speichern überschreibt ihn.' : '';
}

/**
 * Speichert das Vitalwerte-Formular fuer das heutige Datum
 * (ein Eintrag pro Tag, ueberschreibend).
 */
async function vitalwerteSpeichern(ereignis) {
  if (ereignis) ereignis.preventDefault();
  const datum = heutigesDatum();
  const lese = id => document.getElementById(id).value.trim();
  /* Dezimalfelder auf deutsches Komma normalisieren (CSV-konform). */
  const dez = id => { const v = lese(id); return v === '' ? '' : v.replace('.', ','); };

  const alt = await dbLesen('vitaldaten', datum);
  const vitaldaten = {
    datum,
    gewicht_kg:           dez('vital-gewicht'),
    bauchumfang_cm:       lese('vital-bauch'),
    armumfang_cm:         lese('vital-arm'),
    blutdruck_systolisch: lese('vital-sys'),
    blutdruck_diastolisch: lese('vital-dia'),
    puls:                 lese('vital-puls'),
    k_faktor:             dez('vital-kfaktor'),
    bemerkung:            lese('vital-bemerkung'),
    geaendert_am:         jetztZeitstempel(),
    sync_status:          naechsterSyncStatus(alt && alt.sync_status),
  };
  await dbSchreiben('vitaldaten', vitaldaten);
  document.getElementById('vital-hinweis').textContent = 'Gespeichert.';

  /* Phase F: 60-s-Sammelupload anstossen (debounce). */
  syncAnstossenNachErfassung();
}

/* ================================================================
   7c. DROPBOX-SYNC (Phase F)

   Zwei-Wege-Synchronisierung mit Dropbox, defensiv gegen
   Datenverlust. Grundprinzipien (nicht verhandelbar):
     1. IMMER erst herunterladen, dann mergen, dann Backup, dann
        hochladen — nie nur hochladen.
     2. Zeilenweises Mergen ueber IDs; bei Konflikt gewinnt der
        neuere Zeitstempel.
     3. Rollierendes Backup (5 Versionen) vor jedem Ueberschreiben.

   Phase F schreibt nur 01-04. Die Konfiguration (05) bleibt nur
   lesend. Die internen Felder geaendert_am/sync_status kommen NICHT
   in die CSV — nur in IndexedDB.
   ================================================================ */

/* Wieviele Backup-Versionen pro Datei behalten werden. */
const BACKUP_BEHALTEN = 5;
/* Sammel-Verzoegerung nach einer Erfassung, bevor hochgeladen wird. */
const SYNC_DEBOUNCE_MS = 60000;

/* Spaltenreihenfolge der CSV-Dateien (inkl. der Phase-C-Felder). */
const CSV_SPALTEN_01 = ['lebensmittel_id', 'name', 'bemerkung', 'gruppe', 'kcal_pro_100g', 'eiweiss_g', 'kohlenhydrate_g', 'zucker_g', 'fett_g', 'fett_gesaettigt_g', 'fett_ungesaettigt_g', 'salz_g', 'ballaststoffe_g', 'restmasse_g', 'alkohol_g', 'gramm_pro_stueck', 'gramm_pro_portion', 'gramm_pro_scheibe', 'gramm_pro_essloeffel', 'gramm_pro_teeloeffel'];
const CSV_SPALTEN_02 = ['gericht_id', 'gericht_name', 'gericht_kategorie', 'gericht_original_kategorie', 'gericht_endgewicht_g', 'zutat_nr', 'zutat_lebensmittel_id', 'zutat_lebensmittel_name_original', 'zutat_menge_g', 'gramm_pro_stueck', 'gramm_pro_portion', 'gramm_pro_scheibe', 'gramm_pro_essloeffel', 'gramm_pro_teeloeffel'];
const CSV_SPALTEN_03 = ['erfassungs_id', 'datum', 'zeit', 'mahlzeit_typ', 'menge_g', 'lebensmittel_id', 'lebensmittel_name', 'ist_eigengericht', 'eigengericht_id', 'gericht_kontext', 'bemerkung', 'menge_eingabe', 'einheit_eingabe'];
const CSV_SPALTEN_04 = ['datum', 'gewicht_kg', 'bauchumfang_cm', 'armumfang_cm', 'blutdruck_systolisch', 'blutdruck_diastolisch', 'puls', 'k_faktor', 'bemerkung'];

/* Laufzeit-Zustand des Syncs */
let syncLaeuftGerade   = false;   /* Sperre gegen ueberlappende Syncs */
let syncDebounceTimer  = null;    /* Timer fuer den 60-s-Upload */
let letzterSyncStatus  = 'unbekannt';
let letzteSicherungMs  = null;    /* Zeitpunkt des letzten Backups */

/* -- Zahl-Serialisierung fuer die CSV --------------------------- */

/**
 * Wandelt einen Mengen-Wert in deutsche CSV-Notation. Zahlen werden
 * mit Komma-Dezimal ausgegeben; bereits vorliegende Strings (deutsche
 * Notation aus der CSV) werden unveraendert durchgereicht.
 */
function mengeNachCsv(wert) {
  if (wert === null || wert === undefined || wert === '') return '';
  return (typeof wert === 'number') ? mengeFormatieren(wert) : String(wert);
}

/* -- CSV-Zeilen-Builder (IndexedDB-Objekt → CSV-Zeile) ---------- */

function erfassungZuCsvZeile(e) {
  return {
    erfassungs_id:    e.erfassungs_id,
    datum:            e.datum || '',
    zeit:             e.zeit || '',
    mahlzeit_typ:     e.mahlzeit_typ || '',
    menge_g:          mengeNachCsv(e.menge_g),
    lebensmittel_id:  e.lebensmittel_id || '',
    lebensmittel_name: e.lebensmittel_name || '',
    ist_eigengericht: e.ist_eigengericht ? 'true' : 'false',
    eigengericht_id:  e.eigengericht_id || '',
    gericht_kontext:  e.gericht_kontext || '',
    bemerkung:        e.bemerkung || '',
    menge_eingabe:    e.menge_eingabe || '',
    einheit_eingabe:  e.einheit_eingabe || '',
  };
}

function vitaldatenZuCsvZeile(v) {
  return {
    datum:                 v.datum,
    gewicht_kg:            v.gewicht_kg || '',
    bauchumfang_cm:        v.bauchumfang_cm || '',
    armumfang_cm:          v.armumfang_cm || '',
    blutdruck_systolisch:  v.blutdruck_systolisch || '',
    blutdruck_diastolisch: v.blutdruck_diastolisch || '',
    puls:                  v.puls || '',
    k_faktor:              v.k_faktor || '',
    bemerkung:             v.bemerkung || '',
  };
}

function lebensmittelZuCsvZeile(lm) {
  const zeile = {};
  for (const spalte of CSV_SPALTEN_01) {
    zeile[spalte] = lm[spalte] !== undefined ? lm[spalte] : '';
  }
  return zeile;
}

/* -- Normalisierung (CSV-Zeile → IndexedDB-Objekt) -------------- */

/**
 * Wandelt eine gelesene Erfassungs-CSV-Zeile in die interne Form.
 * menge_g wird zur Zahl, ist_eigengericht zum Bool. proxyZeit ist die
 * server_modified-Zeit der Dropbox-Datei (Ersatz-geaendert_am).
 */
function csvZeileZuErfassung(z, proxyZeit) {
  return {
    erfassungs_id:    z.erfassungs_id,
    datum:            z.datum || '',
    zeit:             z.zeit || '',
    mahlzeit_typ:     z.mahlzeit_typ || '',
    menge_g:          deutscheZahlParsen(z.menge_g),
    lebensmittel_id:  z.lebensmittel_id || '',
    lebensmittel_name: z.lebensmittel_name || '',
    /* tolerant lesen: true/1 → true, alles andere → false */
    ist_eigengericht: (z.ist_eigengericht === 'true' || z.ist_eigengericht === '1' || z.ist_eigengericht === true),
    eigengericht_id:  z.eigengericht_id || '',
    gericht_kontext:  z.gericht_kontext || '',
    bemerkung:        z.bemerkung || '',
    menge_eingabe:    z.menge_eingabe || '',
    einheit_eingabe:  z.einheit_eingabe || '',
    geaendert_am:     proxyZeit,
    sync_status:      'synchronisiert',
  };
}

function csvZeileZuVitaldaten(z, proxyZeit) {
  return {
    datum:                 z.datum,
    gewicht_kg:            z.gewicht_kg || '',
    bauchumfang_cm:        z.bauchumfang_cm || '',
    armumfang_cm:          z.armumfang_cm || '',
    blutdruck_systolisch:  z.blutdruck_systolisch || '',
    blutdruck_diastolisch: z.blutdruck_diastolisch || '',
    puls:                  z.puls || '',
    k_faktor:              z.k_faktor || '',
    bemerkung:             z.bemerkung || '',
    geaendert_am:          proxyZeit,
    sync_status:           'synchronisiert',
  };
}

function csvZeileZuLebensmittel(z, proxyZeit) {
  const obj = {};
  for (const spalte of CSV_SPALTEN_01) {
    obj[spalte] = z[spalte] !== undefined ? z[spalte] : '';
  }
  obj.geaendert_am = proxyZeit;
  obj.sync_status  = 'synchronisiert';
  return obj;
}

/* -- Merge (zeilenweise ueber IDs) ------------------------------ */

/**
 * Fuehrt zwei Zeilen-Maps zusammen. Reine Vereinigung verschiedener
 * IDs; bei gleicher ID gewinnt die lokale Zeile, wenn ihr geaendert_am
 * >= server_modified der Dropbox-Datei ist, sonst die Dropbox-Zeile
 * (RQ-1: server_modified als Ersatz-Zeitstempel fuer Dropbox-Zeilen).
 * @returns {Map} - das gemergte Ergebnis (Schluessel → Zeile)
 */
function zeilenMergen(lokaleMap, dropboxMap, serverModifiedMs) {
  const ergebnis = new Map();
  const alleSchluessel = new Set([...lokaleMap.keys(), ...dropboxMap.keys()]);
  for (const schluessel of alleSchluessel) {
    const l = lokaleMap.get(schluessel);
    const d = dropboxMap.get(schluessel);
    if (l && !d) {
      ergebnis.set(schluessel, l);
    } else if (d && !l) {
      ergebnis.set(schluessel, d);
    } else {
      const lZeit = l.geaendert_am ? (Date.parse(l.geaendert_am) || 0) : 0;
      ergebnis.set(schluessel, (lZeit >= serverModifiedMs) ? l : d);
    }
  }
  return ergebnis;
}

/* -- Rollierendes Backup ---------------------------------------- */

function zweiStellen(n) { return String(n).padStart(2, '0'); }

/**
 * Backup-Zeitstempel YYYY-MM-DD_HHMM (oder mit Sekunden bei Kollision).
 */
function backupZeitstempel(mitSekunden) {
  const d = new Date();
  const datum = `${d.getFullYear()}-${zweiStellen(d.getMonth() + 1)}-${zweiStellen(d.getDate())}`;
  const zeit = mitSekunden
    ? `${zweiStellen(d.getHours())}${zweiStellen(d.getMinutes())}${zweiStellen(d.getSeconds())}`
    : `${zweiStellen(d.getHours())}${zweiStellen(d.getMinutes())}`;
  return `${datum}_${zeit}`;
}

/**
 * Legt vor dem Ueberschreiben ein Backup der aktuellen Dropbox-Datei
 * im Ordner _backups/ an und loescht ueberzaehlige (aelter als die
 * juengsten 5). Wirft bei Fehler — der Aufrufer ueberschreibt dann NICHT.
 * @param {string} dateiname - z. B. "03_Erfassung.csv"
 * @param {string} quellPfad - z. B. "/03_Erfassung.csv"
 */
async function backupAnlegen(dateiname, quellPfad) {
  const basis = dateiname.replace(/\.csv$/i, '');
  const vorhandene = await dropboxOrdnerMetadaten('/_backups');

  let stempel  = backupZeitstempel(false);
  let zielName = `${basis}_backup_${stempel}.csv`;
  /* Kollision in derselben Minute → Sekunden anhaengen, damit kein
     frueheres Backup ueberschrieben wird. */
  if (vorhandene.has(zielName)) {
    zielName = `${basis}_backup_${backupZeitstempel(true)}.csv`;
  }

  await dropboxKopieren(quellPfad, `/_backups/${zielName}`);
  letzteSicherungMs = Date.now();

  /* Alte Backups derselben Quelldatei aufraeumen (nur 5 behalten). */
  const aktualisiert = await dropboxOrdnerMetadaten('/_backups');
  const praefix = `${basis}_backup_`;
  const namen = Array.from(aktualisiert.keys())
    .filter(n => n.startsWith(praefix))
    .sort();   /* lexikografisch = chronologisch (YYYY-MM-DD_HHMM) */
  const zuLoeschen = namen.slice(0, Math.max(0, namen.length - BACKUP_BEHALTEN));
  for (const name of zuLoeschen) {
    try { await dropboxLoeschen(`/_backups/${name}`); } catch (e) { /* unkritisch */ }
  }
}

/* -- Sync-Metadaten (gemerkte revs etc.) ------------------------ */

async function syncMetaHolen() {
  const m = await dbLesen('meta', 'sync');
  return m || { schluessel: 'sync', revs: {}, letzte_sicherung: null };
}

async function syncMetaSpeichern(m) {
  m.schluessel = 'sync';
  await dbSchreiben('meta', m);
}

/* -- Synchronisierung einer zeilenbasierten Datei (01/03/04) ---- */

/**
 * Synchronisiert eine zeilenbasierte CSV-Datei (Erfassung, Vitaldaten,
 * Lebensmittel) nach dem Grundablauf: Version pruefen → ggf.
 * herunterladen → mergen → (bei Aenderung) Backup → hochladen →
 * lokale DB angleichen → rev merken.
 *
 * @param {Object} konfig - { dateiname, store, keyFeld, spalten,
 *   zuCsvZeile, vonCsvZeile }
 */
async function syncRowDatei(konfig, metaMap, syncMeta) {
  const { dateiname, store, keyFeld, spalten, zuCsvZeile, vonCsvZeile } = konfig;
  const pfad = '/' + dateiname;
  const meta = metaMap.get(dateiname);
  const serverModifiedMs = meta ? (Date.parse(meta.server_modified) || 0) : 0;

  const lokaleListe = await dbAllesLesen(store);
  const lokaleMap = new Map(lokaleListe.map(z => [String(z[keyFeld]), z]));

  /* Download nur, wenn Datei existiert und ihre rev sich geaendert hat. */
  const revUnveraendert = meta && meta.rev === syncMeta.revs[dateiname];
  const dropboxMap = new Map();
  let heruntergeladen = false;
  if (meta && !revUnveraendert) {
    const inhalt = await dropboxDateiHerunterladen(pfad);
    heruntergeladen = true;
    for (const roh of csvParsen(inhalt)) {
      const norm = vonCsvZeile(roh, meta.server_modified);
      const schluessel = norm[keyFeld];
      if (schluessel !== undefined && schluessel !== '') {
        dropboxMap.set(String(schluessel), norm);
      }
    }
  }

  const ergebnis = zeilenMergen(lokaleMap, dropboxMap, serverModifiedMs);

  /* Kanonische CSV (deterministisch sortiert) — stabiler Vergleich. */
  const sortiert = Array.from(ergebnis.values())
    .sort((a, b) => String(a[keyFeld]).localeCompare(String(b[keyFeld])));
  const neueCsv = csvSchreiben(spalten, sortiert.map(zuCsvZeile));

  const lokaleAenderungen = lokaleListe.some(z =>
    z.sync_status === 'neu' || z.sync_status === 'geaendert');

  /* Upload-Entscheidung */
  let mussHochladen;
  if (!meta) {
    mussHochladen = ergebnis.size > 0;
  } else if (revUnveraendert) {
    mussHochladen = lokaleAenderungen;
  } else {
    const dropboxCsv = csvSchreiben(spalten,
      Array.from(dropboxMap.values())
        .sort((a, b) => String(a[keyFeld]).localeCompare(String(b[keyFeld])))
        .map(zuCsvZeile));
    mussHochladen = lokaleAenderungen || (neueCsv !== dropboxCsv);
  }

  let neueRev = meta ? meta.rev : null;
  if (mussHochladen) {
    /* SICHERHEIT: erst Backup, dann Ueberschreiben. */
    if (meta) await backupAnlegen(dateiname, pfad);
    const antwort = await dropboxDateiHochladen(pfad, neueCsv);
    neueRev = antwort.rev;
  }
  syncMeta.revs[dateiname] = neueRev;

  /* Lokale DB an das Merge-Ergebnis angleichen und als synchronisiert
     markieren (nur noetig, wenn etwas hoch- oder heruntergeladen wurde). */
  if (mussHochladen || heruntergeladen) {
    const neueSaetze = sortiert.map(z => ({ ...z, sync_status: 'synchronisiert' }));
    await dbMassenSchreiben(store, neueSaetze);
  }

  return { hochgeladen: mussHochladen, heruntergeladen };
}

/* -- Synchronisierung der Eigengerichte (02, denormalisiert) ---- */

/**
 * Sondersync fuer 02: Es propagieren NUR die gramm_pro_*-Werte (je
 * gericht_id). Die Zutaten-Inhalte gelten als von Dropbox autoritativ
 * und werden in der App nicht editiert (RQ-2). Die CSV wird aus den
 * lokalen Zutaten + den gemergten gramm_pro_* kanonisch neu gebaut;
 * die gramm_pro_* stehen nur auf der ersten Zutat-Zeile je Gericht.
 */
async function syncDateiEigengerichte(metaMap, syncMeta) {
  const dateiname = '02_Stammdaten_Eigengerichte.csv';
  const pfad = '/' + dateiname;
  const meta = metaMap.get(dateiname);
  const serverModifiedMs = meta ? (Date.parse(meta.server_modified) || 0) : 0;
  const einheitenFelder = Object.values(EINHEIT_ZU_FELD);

  const gerichte = await dbAllesLesen('eigengerichte');
  const zutaten  = await dbAllesLesen('zutaten');
  const gerichteMap = new Map(gerichte.map(g => [g.gericht_id, g]));

  /* gramm_pro_* je gericht_id aus der Dropbox-CSV einsammeln */
  const revUnveraendert = meta && meta.rev === syncMeta.revs[dateiname];
  const dropboxGramm = new Map();
  if (meta && !revUnveraendert) {
    const inhalt = await dropboxDateiHerunterladen(pfad);
    for (const roh of csvParsen(inhalt)) {
      const gid = roh.gericht_id;
      if (!gid) continue;
      if (!dropboxGramm.has(gid)) dropboxGramm.set(gid, {});
      const ziel = dropboxGramm.get(gid);
      for (const feld of einheitenFelder) {
        if (roh[feld] !== undefined && roh[feld] !== '' &&
            (ziel[feld] === undefined || ziel[feld] === '')) {
          ziel[feld] = roh[feld];
        }
      }
    }
  }

  /* gramm_pro_* mergen: Dropbox gewinnt nur, wenn die lokale Aenderung
     aelter ist als die Dropbox-Datei. Lokale Werte werden ggf. ueber-
     schrieben und im Store aktualisiert (kommt der Einheiten-Logik
     auf diesem Geraet zugute). */
  let lokalGeaendert = false;
  for (const gericht of gerichte) {
    const dGramm = dropboxGramm.get(gericht.gericht_id);
    const lZeit = gericht.geaendert_am ? (Date.parse(gericht.geaendert_am) || 0) : 0;
    if (dGramm && lZeit < serverModifiedMs) {
      let geaendert = false;
      for (const feld of einheitenFelder) {
        const neu = dGramm[feld] !== undefined ? dGramm[feld] : '';
        if ((gericht[feld] || '') !== neu) { gericht[feld] = neu; geaendert = true; }
      }
      if (geaendert) {
        gericht.sync_status = 'synchronisiert';
        await dbSchreiben('eigengerichte', gericht);
      }
    }
    if (gericht.sync_status === 'neu' || gericht.sync_status === 'geaendert') lokalGeaendert = true;
  }

  /* Zutaten je Gericht gruppieren und nach zutat_nr sortieren */
  const zutatenNachGericht = new Map();
  for (const z of zutaten) {
    if (!zutatenNachGericht.has(z.gericht_id)) zutatenNachGericht.set(z.gericht_id, []);
    zutatenNachGericht.get(z.gericht_id).push(z);
  }
  const alleIds = Array.from(gerichteMap.keys()).sort();

  /* Hilfsfunktion: baut die 02-Zeilen mit einer bestimmten Gramm-Quelle */
  const csvZeilenBauen = (grammQuelle) => {
    const zeilen = [];
    for (const gid of alleIds) {
      const gericht = gerichteMap.get(gid);
      const liste = (zutatenNachGericht.get(gid) || []).slice()
        .sort((a, b) => (parseInt(a.zutat_nr) || 0) - (parseInt(b.zutat_nr) || 0));
      liste.forEach((z, idx) => {
        const istErste = idx === 0;
        const gramm = grammQuelle(gid);
        const zeile = {
          gericht_id: gid,
          gericht_name: gericht.gericht_name || '',
          gericht_kategorie: gericht.gericht_kategorie || '',
          gericht_original_kategorie: gericht.gericht_original_kategorie || '',
          gericht_endgewicht_g: gericht.gericht_endgewicht_g || '',
          zutat_nr: z.zutat_nr,
          zutat_lebensmittel_id: z.zutat_lebensmittel_id || '',
          zutat_lebensmittel_name_original: z.zutat_lebensmittel_name_original || '',
          zutat_menge_g: z.zutat_menge_g || '',
        };
        for (const feld of einheitenFelder) {
          zeile[feld] = istErste ? (gramm[feld] || '') : '';
        }
        zeilen.push(zeile);
      });
    }
    return zeilen;
  };

  const neueCsv = csvSchreiben(CSV_SPALTEN_02, csvZeilenBauen(gid => gerichteMap.get(gid)));

  /* Upload-Entscheidung */
  let mussHochladen;
  if (!meta) {
    mussHochladen = alleIds.length > 0;
  } else if (revUnveraendert) {
    mussHochladen = lokalGeaendert;
  } else {
    const dropboxCsv = csvSchreiben(CSV_SPALTEN_02, csvZeilenBauen(gid => dropboxGramm.get(gid) || {}));
    mussHochladen = lokalGeaendert || (neueCsv !== dropboxCsv);
  }

  let neueRev = meta ? meta.rev : null;
  if (mussHochladen) {
    if (meta) await backupAnlegen(dateiname, pfad);
    const antwort = await dropboxDateiHochladen(pfad, neueCsv);
    neueRev = antwort.rev;
    for (const gericht of gerichte) {
      if (gericht.sync_status === 'neu' || gericht.sync_status === 'geaendert') {
        gericht.sync_status = 'synchronisiert';
        await dbSchreiben('eigengerichte', gericht);
      }
    }
  }
  syncMeta.revs[dateiname] = neueRev;
}

/* -- Voller Sync-Ablauf ----------------------------------------- */

/**
 * Fuehrt einen vollstaendigen Sync aller vier Datendateien aus.
 * Durch die Sperre syncLaeuftGerade laeuft nie mehr als ein Sync
 * gleichzeitig (App-Start, Debounce und manueller Knopf teilen sie).
 * @param {string} ausloeser - "appstart" | "erfassung" | "manuell"
 * @returns {Promise<Object>} - { status: 'ok'|'offline'|'uebersprungen'|'fehler' }
 */
async function vollSync(ausloeser) {
  if (syncLaeuftGerade) return { status: 'uebersprungen' };
  if (!navigator.onLine) { syncStatusSetzen('offline'); return { status: 'offline' }; }

  /* Ohne Anmeldung kein Sync. */
  const tokens = await tokensLaden();
  if (!tokens) return { status: 'keine-anmeldung' };

  syncLaeuftGerade = true;
  syncStatusSetzen('laeuft');
  try {
    const metaMap  = await dropboxOrdnerMetadaten('');
    const syncMeta = await syncMetaHolen();

    /* Reihenfolge: zuerst die Tagesdaten, dann die Stammdaten. */
    await syncRowDatei({
      dateiname: '03_Erfassung.csv', store: 'erfassung', keyFeld: 'erfassungs_id',
      spalten: CSV_SPALTEN_03, zuCsvZeile: erfassungZuCsvZeile, vonCsvZeile: csvZeileZuErfassung,
    }, metaMap, syncMeta);

    await syncRowDatei({
      dateiname: '04_Vitaldaten.csv', store: 'vitaldaten', keyFeld: 'datum',
      spalten: CSV_SPALTEN_04, zuCsvZeile: vitaldatenZuCsvZeile, vonCsvZeile: csvZeileZuVitaldaten,
    }, metaMap, syncMeta);

    await syncRowDatei({
      dateiname: '01_Stammdaten_Lebensmittel.csv', store: 'lebensmittel', keyFeld: 'lebensmittel_id',
      spalten: CSV_SPALTEN_01, zuCsvZeile: lebensmittelZuCsvZeile, vonCsvZeile: csvZeileZuLebensmittel,
    }, metaMap, syncMeta);

    await syncDateiEigengerichte(metaMap, syncMeta);

    /* Sync-Metadaten + Zeitstempel sichern */
    if (letzteSicherungMs) syncMeta.letzte_sicherung = letzteSicherungMs;
    await syncMetaSpeichern(syncMeta);

    const cfg = (await dbLesen('meta', 'config')) || { schluessel: 'config' };
    cfg.zuletzt_synchronisiert = Date.now();
    await dbSchreiben('meta', cfg);

    /* Caches verwerfen, damit die UI den gemergten Stand zeigt. */
    lebensmittelCache = null;
    gerichteCache = null;

    syncStatusSetzen('synchron');
    return { status: 'ok' };
  } catch (fehler) {
    /* Token endgueltig ungueltig → Anmeldung erforderlich */
    const text = String(fehler && fehler.message || fehler);
    if (/401|expired_access_token|invalid_access_token|Token-Erneuerung/i.test(text)) {
      syncStatusSetzen('anmeldung');
    } else {
      syncStatusSetzen('fehler');
    }
    return { status: 'fehler', fehler: text };
  } finally {
    syncLaeuftGerade = false;
  }
}

/* -- Sync-Ausloeser --------------------------------------------- */

/**
 * Stoesst nach einer Erfassung/Vitaldaten-Aenderung einen Upload-Sync
 * mit 60-s-Sammelverzoegerung an (debounce: erneute Erfassung setzt
 * den Timer zurueck).
 */
function syncAnstossenNachErfassung() {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    syncDebounceTimer = null;
    vollSync('erfassung').then(() => {
      /* Falls gerade die Einstellungen offen sind, Anzeige auffrischen. */
      if (document.getElementById('ansicht-einstellungen').classList.contains('aktiv')) {
        einstellungenLaden().catch(() => {});
      }
    }).catch(() => { /* Status zeigt den Fehler */ });
  }, SYNC_DEBOUNCE_MS);
}

/**
 * App-Start-Sync (download-orientiert): holt den aktuellen Stand,
 * merged, und laedt danach die aktive Ansicht neu. Laeuft im
 * Hintergrund (blockiert den Start nicht).
 */
async function appStartSyncAnstossen() {
  if (!navigator.onLine) { syncStatusSetzen('offline'); return; }
  const tokens = await tokensLaden();
  if (!tokens) return;
  if ((await dbZaehlen('lebensmittel')) === 0) return;   /* erst nach Erst-Import */
  const ergebnis = await vollSync('appstart');
  if (ergebnis.status === 'ok') {
    /* Aktive Ansicht mit dem gemergten Stand neu rendern. */
    routeVerarbeiten().catch(() => {});
  }
}

/* -- Sync-Status-Anzeige ---------------------------------------- */

/**
 * Setzt den aktuellen Sync-Status und aktualisiert die Anzeige.
 */
function syncStatusSetzen(status) {
  letzterSyncStatus = status;
  syncStatusAnzeigen();
}

/**
 * Aktualisiert die Status-Zeile in den Einstellungen anhand von
 * Online-Zustand und letztem Sync-Ergebnis.
 */
function syncStatusAnzeigen() {
  const el = document.getElementById('einst-online-status');
  if (!el) return;
  el.classList.remove('erfolg', 'warnung', 'gefahr');

  let text, klasse = null;
  if (!navigator.onLine) {
    text = '○ offline';
  } else {
    switch (letzterSyncStatus) {
      case 'synchron':  text = '● synchron';            klasse = 'erfolg';  break;
      case 'laeuft':    text = 'Synchronisiere …';                          break;
      case 'ausstehend': text = 'Änderungen ausstehend'; klasse = 'warnung'; break;
      case 'fehler':    text = 'Sync-Fehler';            klasse = 'gefahr';  break;
      case 'anmeldung': text = 'Anmeldung erforderlich'; klasse = 'gefahr';  break;
      default:          text = '○ bereit';
    }
  }
  el.textContent = text;
  if (klasse) el.classList.add(klasse);
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

  /* Untere Tab-Leiste: die vier normalen Tabs navigieren ueber ihr
     data-route-Ziel. */
  document.querySelectorAll('.tab-knopf').forEach(knopf => {
    knopf.addEventListener('click', () => navigieren(knopf.dataset.route));
  });

  /* Zentraler "+"-Knopf (Erfassen) — startet den Ablauf frisch. */
  document.getElementById('tab-erfassen').addEventListener('click', erfassenNeuStarten);

  /* Datenbank-Umschalter (Lebensmittel / Gerichte) auf beiden Listen. */
  document.querySelectorAll('.umschalter-knopf[data-route]').forEach(knopf => {
    knopf.addEventListener('click', () => navigieren(knopf.dataset.route));
  });

  /* --- Erfassen Schritt 1: Suche --- */
  document.getElementById('erfassen-schliessen').addEventListener('click', () => navigieren('heute'));
  document.getElementById('erfassen-suche').addEventListener('input', (e) => {
    erfassenSuchfilter = e.target.value;
    erfassenTrefferRendern();
  });
  document.querySelectorAll('#erfassen-segment .segment-knopf').forEach(knopf => {
    knopf.addEventListener('click', () => {
      erfassenModus = knopf.dataset.modus;
      document.querySelectorAll('#erfassen-segment .segment-knopf').forEach(k =>
        k.classList.toggle('aktiv', k === knopf));
      erfassenTrefferRendern();
    });
  });

  /* --- Erfassen Schritt 2: Menge + Einheit --- */
  document.getElementById('menge-zurueck').addEventListener('click', () => history.back());
  document.getElementById('menge-zahl').addEventListener('input', erfassenLiveBerechnen);
  document.getElementById('menge-einheit').addEventListener('change', erfassenEinheitGewechselt);
  document.getElementById('menge-hinzufuegen').addEventListener('click', () => {
    erfassenSpeichern().catch(fehler => fehlermeldungAnzeigen('Speichern fehlgeschlagen: ' + fehler.message));
  });
  document.getElementById('menge-loeschen').addEventListener('click', () => {
    erfassenEintragLoeschen().catch(fehler => fehlermeldungAnzeigen('Löschen fehlgeschlagen: ' + fehler.message));
  });

  /* --- Einheiten-Popup --- */
  document.getElementById('popup-einheit-speichern').addEventListener('click', () => {
    einheitPopupSpeichern().catch(fehler => fehlermeldungAnzeigen('Speichern fehlgeschlagen: ' + fehler.message));
  });
  document.getElementById('popup-einheit-abbrechen').addEventListener('click', einheitPopupAbbrechen);

  /* --- Vitalwerte-Formular --- */
  document.getElementById('vital-form').addEventListener('submit', (e) => {
    vitalwerteSpeichern(e).catch(fehler => fehlermeldungAnzeigen('Speichern fehlgeschlagen: ' + fehler.message));
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
    konfigCache = null;
    navigieren('');
  });

  /* Jetzt synchronisieren — voller Zwei-Wege-Sync (Phase F) */
  document.getElementById('knopf-synchronisieren').addEventListener('click', async () => {
    if (!navigator.onLine) {
      fehlermeldungAnzeigen('Keine Internetverbindung — Synchronisierung nicht möglich.');
      return;
    }
    const knopf = document.getElementById('knopf-synchronisieren');
    knopf.disabled = true;
    knopf.textContent = 'Synchronisiere…';
    try {
      const ergebnis = await vollSync('manuell');
      if (ergebnis.status === 'fehler') {
        fehlermeldungAnzeigen('Synchronisierung fehlgeschlagen: ' + (ergebnis.fehler || 'unbekannt'));
      } else if (ergebnis.status === 'offline') {
        fehlermeldungAnzeigen('Keine Internetverbindung — Synchronisierung nicht möglich.');
      }
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
      konfigCache = null;
      /* Harter Stammdaten-Neuaufbau (laedt 01/02/05 frisch und bewahrt
         lokale Einheiten-Werte). Danach normaler Sync, damit auch
         Erfassungen/Vitaldaten anderer Geraete wieder hereinkommen. */
      await allesDatenImportieren(null);
      await vollSync('manuell');
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
    const saubereUrl = window.location.pathname + '#/heute';
    window.history.replaceState({}, '', saubereUrl);
  }

  /* Aktuelle Route rendern */
  await routeVerarbeiten();

  /* Phase F: App-Start-Sync im Hintergrund (blockiert den Start nicht).
     Holt den aktuellen Dropbox-Stand, merged ihn ein und frischt die
     Ansicht auf. Fehler werden im Status angezeigt, nicht als Popup. */
  appStartSyncAnstossen().catch(() => {});
}

/* App starten sobald der DOM fertig ist */
document.addEventListener('DOMContentLoaded', appStarten);
