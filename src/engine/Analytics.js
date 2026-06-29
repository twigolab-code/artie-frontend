// =============================================================================
// Analytics — telemetria di gioco "fail-silent", ANONIMA (pseudonimo per-sessione).
//
// PRIVACY: la telemetria NON invia dati personali. NIENTE nickname, NIENTE id
// persistente di dispositivo. L'unico identificatore è `sessionId`, un UUID
// EFFIMERO generato a ogni caricamento pagina (per partita) e MAI salvato in
// localStorage → permette di correlare gli eventi di una singola partita ma non
// di ricondurli a una persona né di tracciare un dispositivo nel tempo. Le
// statistiche risultanti lato backend sono quindi aggregabili/anonime.
//
// Contratto col backend: il client apre un `sessionId` per partita, ottiene un
// token HMAC a breve scadenza dall'endpoint /session e POSTa UN batch ogni 30 s
// con gli eventi accumulati. Regole d'oro:
//  - MAI bloccare il gioco: ogni metodo pubblico è no-op senza env, avvolto in
//    try/catch, e flush() NON viene mai awaitato (gira come promise staccata).
//  - Ordine cronologico: gli eventi sono `push`ati nell'ordine di emissione (JS
//    single-thread) con `ts` stampato all'istante → buffer monotono in `ts`. In
//    caso di retry si rimettono in coda DAVANTI (unshift), mai dietro, così il
//    batch resta ordinato (il server scarta gli eventi fuori ordine nel batch).
//  - Senza VITE_ARTIE_SESSION_URL / VITE_ARTIE_INGEST_URL la telemetria è
//    completamente disattivata (nessuna rete, nessun log).
//
// Schema batch (esatto, NIENTE campi extra):
//   { schemaVersion:1, batchId, sessionId, clientSentAt, events:[…] }
// Eventi: session_start | level_select | level_start | death | level_clear | session_end.
// =============================================================================

const SCHEMA_VERSION = 1;
const FLUSH_INTERVAL_MS = 30_000; // un batch ogni 30 s
const MAX_BATCH = 200; // max eventi per POST (oltre → split in più batch)
const MAX_BUFFER = 1000; // tetto di sicurezza memoria se il backend è giù a lungo
const TOKEN_SKEW_S = 60; // refresh del token entro 60 s dalla scadenza
const BACKOFF_MS = [1000, 2000, 4000]; // ritardi base per i retry su 429/5xx (+jitter)

// UUID v4 (solo per `sessionId`/`batchId` effimeri — NON persistiti): primario
// `crypto.randomUUID()` (richiede secure context: HTTPS in prod, localhost in dev →
// sempre ok). Fallback RFC-4122 via getRandomValues per Safari iOS molto vecchi /
// contesti non sicuri.
function uuid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // versione 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export class Analytics {
  constructor() {
    // Lettura env (Vite inietta i VITE_* a build time). Senza entrambe → disattivata.
    const sessionUrl = import.meta.env.VITE_ARTIE_SESSION_URL;
    const ingestUrl = import.meta.env.VITE_ARTIE_INGEST_URL;
    this.enabled = !!(sessionUrl && ingestUrl);
    this.sessionUrl = sessionUrl;
    this.ingestUrl = ingestUrl;

    // Identità pseudonima: SOLO un id di sessione effimero, mai persistito e non
    // riconducibile a una persona o a un dispositivo. Niente userId, niente nickname.
    this.sessionId = uuid(); // fresco a ogni caricamento pagina = per partita

    // Stato runtime.
    this.buffer = []; // eventi accumulati, cronologici
    this.token = null;
    this.tokenExp = 0; // epoch secondi
    this.tokenPromise = null; // handshake /session in corso (dedup chiamate concorrenti)
    this.flushTimer = null;
    this.started = false;
    this.flushing = false; // evita due cicli di drain sovrapposti
    this.attemptStartMs = 0; // inizio del tentativo corrente (per elapsedMs)
    this.beaconSent = false; // guardia contro il doppio fire visibilitychange/pagehide
    this._warned = false; // un solo console.warn su drop permanente
  }

  // --- Ciclo di vita sessione -------------------------------------------------
  // Avvio sessione: chiamato quando il giocatore entra (click su GIOCA). Emette
  // session_start, avvia il timer di flush e lancia (fire-and-forget) l'handshake.
  // NON riceve né invia il nickname: la telemetria è anonima.
  start() {
    if (!this.enabled || this.started) return;
    try {
      this.started = true;
      this._push({ type: 'session_start' });
      this._getToken(); // non awaitato: di solito pronto prima del primo flush
      this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    } catch {}
  }

  // --- Eventi di gioco --------------------------------------------------------
  trackLevelSelect(level) {
    if (!this.enabled) return;
    try {
      this._push({ type: 'level_select', level });
    } catch {}
  }

  // Inizio tentativo: cattura il timestamp d'avvio (per elapsedMs) ed emette level_start.
  trackLevelStart(level, attempt) {
    if (!this.enabled) return;
    try {
      this.attemptStartMs = Date.now();
      this._push({ type: 'level_start', level, attempt });
    } catch {}
  }

  trackDeath(level, attempt, progressPct) {
    if (!this.enabled) return;
    try {
      this._push({ type: 'death', level, attempt, elapsedMs: this._elapsed(), progressPct });
    } catch {}
  }

  trackLevelClear(level, attempt) {
    if (!this.enabled) return;
    try {
      this._push({ type: 'level_clear', level, attempt, elapsedMs: this._elapsed() });
    } catch {}
  }

  trackSessionEnd() {
    if (!this.enabled) return;
    try {
      this._push({ type: 'session_end' });
    } catch {}
  }

  // --- Flush "normale" (timer) ------------------------------------------------
  // Ritorna SUBITO: il drain gira come promise staccata, mai sul percorso critico.
  flush() {
    if (!this.enabled || this.flushing || !this.buffer.length) return;
    this.flushing = true;
    this._drain()
      .catch(() => {})
      .finally(() => {
        this.flushing = false;
      });
  }

  // --- Flush di chiusura (unload) ---------------------------------------------
  // Spinge session_end e invia il buffer via sendBeacon (token nel body `_t`, perché
  // il beacon non può impostare l'header Authorization). Best-effort, niente retry.
  flushBeacon() {
    if (!this.enabled || this.beaconSent) return;
    try {
      this.beaconSent = true;
      this.trackSessionEnd();
      while (this.buffer.length) {
        const chunk = this.buffer.splice(0, MAX_BATCH);
        const body = JSON.stringify({ ...this._buildBatch(chunk), _t: this.token });
        navigator.sendBeacon(this.ingestUrl, new Blob([body], { type: 'application/json' }));
      }
    } catch {}
  }

  // --- Interni ----------------------------------------------------------------
  _elapsed() {
    return Math.max(0, Math.floor(Date.now() - this.attemptStartMs));
  }

  // Stampa `ts` all'emissione (cronologia) e accoda. Tetto di sicurezza sulla memoria.
  _push(ev) {
    ev.ts = Date.now();
    this.buffer.push(ev);
    if (this.buffer.length > MAX_BUFFER) this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
  }

  _buildBatch(events) {
    return {
      schemaVersion: SCHEMA_VERSION,
      batchId: uuid(),
      sessionId: this.sessionId,
      clientSentAt: Date.now(),
      events,
    };
  }

  _tokenValid() {
    return !!this.token && this.tokenExp - Date.now() / 1000 > TOKEN_SKEW_S;
  }

  // Handshake /session → { token, exp }. Dedup via tokenPromise.
  _getToken() {
    if (this.tokenPromise) return this.tokenPromise;
    this.tokenPromise = (async () => {
      try {
        const res = await fetch(this.sessionUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId: this.sessionId }),
        });
        if (res.ok) {
          const data = await res.json();
          this.token = data.token;
          this.tokenExp = data.exp || 0;
        }
      } catch {
      } finally {
        this.tokenPromise = null;
      }
      return this.token;
    })();
    return this.tokenPromise;
  }

  // Svuota il buffer in POST sequenziali da ≤cap. Gestisce split (413) e retry (429/5xx).
  async _drain() {
    let cap = MAX_BATCH;
    while (this.buffer.length) {
      const chunk = this.buffer.splice(0, cap);
      const result = await this._postBatch(chunk);
      if (result === 'ok' || result === 'drop') {
        // 'ok': consegnato. 'drop' (400/403/retry esauriti non recuperabili): scartato.
        continue;
      }
      if (result === 'too_big') {
        // 413: rimetti davanti e riprova con batch più piccoli (200→100→50…).
        this.buffer.unshift(...chunk);
        cap = Math.max(1, Math.floor(cap / 2));
        continue;
      }
      if (result === 'retry_later') {
        // 429/5xx con backoff esaurito: rimetti davanti per la prossima finestra 30 s.
        this.buffer.unshift(...chunk);
        return;
      }
    }
  }

  // Invia un singolo batch. Ritorna 'ok' | 'drop' | 'too_big' | 'retry_later'.
  async _postBatch(events) {
    const payload = JSON.stringify(this._buildBatch(events));
    let retried401 = false;
    for (let attempt = 0; ; attempt++) {
      if (!this._tokenValid()) await this._getToken();
      let res;
      try {
        res = await fetch(this.ingestUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.token || ''}`,
          },
          body: payload,
        });
      } catch {
        // Errore di rete: trattalo come transitorio.
        if (attempt >= BACKOFF_MS.length) return 'retry_later';
        await this._sleep(this._backoff(attempt));
        continue;
      }
      if (res.ok) return 'ok'; // 200 {ok:true} o {ok:true,dedup:true}
      if (res.status === 401 && !retried401) {
        // Token scaduto/mancante: rinnova e riprova UNA volta.
        retried401 = true;
        this.token = null;
        this.tokenExp = 0;
        await this._getToken();
        continue;
      }
      if (res.status === 400 || res.status === 403 || res.status === 401) {
        if (!this._warned) {
          this._warned = true;
          try {
            console.warn('[analytics] batch scartato (HTTP ' + res.status + ')');
          } catch {}
        }
        return 'drop';
      }
      if (res.status === 413) return 'too_big';
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= BACKOFF_MS.length) return 'retry_later';
        await this._sleep(this._backoff(attempt));
        continue;
      }
      // Altri codici inattesi: scarta per non ciclare.
      return 'drop';
    }
  }

  _backoff(attempt) {
    const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
    return base + Math.random() * base; // jitter
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
