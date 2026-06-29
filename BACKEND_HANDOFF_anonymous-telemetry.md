# Backend handoff — Telemetria OG DASH resa ANONIMA (breaking change al contratto)

> **Per:** team che gestisce il backend telemetria Artie (AWS Lambda eu-central-1: `/session` + `/ingest`).
> **Da:** OG DASH frontend (repo `og-dash`/georush).
> **Data:** 2026-06-29 · **Motivo:** privacy/GDPR — la telemetria non deve più trasmettere dati personali.

## TL;DR
Il frontend NON invia più `userId` (id persistente di dispositivo) né `nickname`. L'unico identificatore
rimasto è `sessionId`, un UUID **effimero per partita** (mai persistito sul client). Il backend va
adeguato su validazione, storage e metriche, altrimenti **la telemetria smette di funzionare** (handshake
o ingest rifiutati → nessun dato).

---

## 1. `/session` (handshake) — body POST cambiato

| | Prima | Ora |
|---|---|---|
| Body | `{ "userId": "<uuid persistente>", "sessionId": "<uuid>" }` | `{ "sessionId": "<uuid>" }` |

- **Azione BE:** rendere `userId` **opzionale o rimuoverlo** dallo schema di validazione del body.
- **Rischio se non fatto:** se `userId` è un campo richiesto, l'handshake risponde 4xx → il client non
  ottiene il token → **ogni `/ingest` va in 401** → telemetria completamente non funzionante (fail-silent
  lato client, quindi nessun errore visibile: i dati semplicemente non arrivano).
- Risposta attesa invariata: `{ "token": "<hmac>", "exp": <epoch_seconds> }`.

## 2. `/ingest` (batch) — schema payload cambiato

**Prima:**
```json
{ "schemaVersion": 1, "batchId": "<uuid>", "sessionId": "<uuid>",
  "userId": "<uuid>", "nickname": "<testo>", "clientSentAt": 1719600000000, "events": [ … ] }
```

**Ora (campi `userId` e `nickname` RIMOSSI):**
```json
{ "schemaVersion": 1, "batchId": "<uuid>", "sessionId": "<uuid>",
  "clientSentAt": 1719600000000, "events": [ … ] }
```

- **Azione BE:** rendere `userId` e `nickname` **opzionali/assenti** nello schema di validazione del batch.
- **Rischio se non fatto:** validazione stretta (campi richiesti) → 400 → il client **scarta** il batch
  silenziosamente (vedi gestione `400`/`403` = drop). Dati persi senza segnale.
- Header e auth invariati: `Authorization: Bearer <token>`. Per il `sendBeacon` di chiusura il token
  resta nel body come `_t` (il beacon non può settare header).

### Eventi (invariati nel contenuto)
Nessun campo evento è cambiato. Ognuno ha `ts` (epoch ms, stampato all'emissione):

| `type` | Campi extra |
|---|---|
| `session_start` | — |
| `level_select` | `level` (int ≥1) |
| `level_start` | `level`, `attempt` |
| `death` | `level`, `attempt`, `elapsedMs`, `progressPct` (0–100) |
| `level_clear` | `level`, `attempt`, `elapsedMs` |
| `session_end` | — |

## 3. Storage & metriche — impatto da decidere

- **`sessionId` è ora l'unico identificatore, ed è effimero** (nuovo a ogni caricamento pagina, mai salvato
  in localStorage). Non identifica una persona né un dispositivo nel tempo.
- Colonne `user_id` / `nickname` in DB: possono **restare nullable** (saranno sempre null) o essere rimosse.
- **Metriche che NON sono più calcolabili** così come prima:
  - "Utenti unici" / "device unici" / retention per-utente cross-sessione → **non più possibili**
    (non c'è più un id persistente). Al massimo: **sessioni uniche** (per `sessionId`) — ma due partite
    dello stesso giocatore = due `sessionId` diversi e non collegabili.
  - Qualsiasi join/aggregazione per `nickname` → rimuovere.
- **Metriche che restano valide:** tutto ciò che è per-sessione o aggregato sugli eventi (tentativi medi,
  `progressPct` per livello, tassi di completamento, tempi `elapsedMs`, imbuto di abbandono per livello).
- La deduplica per `batchId` resta invariata.

## 4. Versionamento dello schema (da decidere col BE)

`schemaVersion` è ancora **`1`** nel client (non l'ho bumpato). Se il backend è già in produzione con dati
v1 e deve distinguere il vecchio formato (con `userId`/`nickname`) dal nuovo, valutare di passare il client
a `schemaVersion: 2`. **Ditemi se serve** e lo aggiorno lato FE — è una riga in `Analytics.js`
(`const SCHEMA_VERSION`).

## 5. Config / CSP (TODO indipendente, ma da chiudere insieme)

Non legato all'anonimizzazione, ma va finalizzato quando il BE è pronto:
- Gli URL telemetria nel FE sono ancora i **placeholder** `https://session.artie.example` /
  `https://ingest.artie.example` (in `.env*` e nella CSP `connect-src` di `public/_headers`). Vanno
  sostituiti con i **sottodomini reali proxati da Cloudflare** (NON i `*.lambda-url.…on.aws` diretti, che
  sono origin-locked → 403). Aggiornare **insieme** `.env*` (build-time, richiede rebuild su Cloudflare
  Pages) e `public/_headers` (host identico, stesso schema, niente path/trailing slash) o la CSP blocca
  silenziosamente le richieste.

---

## Riferimenti FE
- Implementazione: `src/engine/Analytics.js` (schema in `_buildBatch()`, handshake in `_getToken()`).
- Contratto documentato: `CLAUDE.md` §12 (e §4 telemetry-wiring).
