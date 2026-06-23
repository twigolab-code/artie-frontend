import { BPM, MUSIC_VOLUME, SFX_VOLUME, MUSIC_TRACKS } from '../config.js';

// =============================================================================
// Audio — musica di sottofondo + effetti sonori (Web Audio API).
//
// MUSICA: carichiamo i brani definiti in `MUSIC_TRACKS` (public/), ognuno come
// HTMLAudioElement in loop instradato sul nodo `music` (così slider e mute
// funzionano). `setTrack(name)` sceglie quale suona: 'home' nei menu, 'game'
// durante un livello. Se i file mancano / danno errore, fallback a un beat
// ritmico sintetizzato (kick + hi-hat) a BPM costante.
// In OGNI caso il clock dei beat continua a girare per esporre `beatPhase()` per
// la sincronizzazione visiva (pulse dello sfondo / barra): coi brani da file il
// pulse non è necessariamente a tempo con la musica.
//
// Catena audio: tutte le sorgenti -> nodo `music` o `sfx` (volumi separati) ->
// `master` (mute globale) -> destination. Gli SFX sono anch'essi sintetizzati.
//
// Per le policy dei browser l'audio parte solo dopo un'interazione utente:
// chiama unlock() dal primo input. I volumi/mute possono essere impostati anche
// PRIMA dell'unlock: vengono memorizzati e applicati alla creazione dei nodi.
// =============================================================================
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null; // mute globale
    this.music = null; // volume musica
    this.sfx = null; // volume effetti
    this.enabled = false;

    // Brani di sottofondo da file (nome → HTMLAudioElement). _musicFileOk diventa
    // true se almeno un file carica: in tal caso NON si suona il beat sintetizzato.
    // _currentTrack è il brano desiderato (memorizzato anche prima dell'unlock):
    // 'home' di default così i menu suonano appena l'audio si sblocca.
    this._tracks = {};
    this._currentTrack = 'home';
    this._musicFileOk = false;

    // Valori correnti (persistono anche prima dell'unlock).
    this._musicVol = MUSIC_VOLUME;
    this._sfxVol = SFX_VOLUME;
    this._muted = false;

    this.secondsPerBeat = 60 / BPM;
    this._nextBeatTime = 0;
    this._beatIndex = 0;
    this._startTime = 0;
  }

  // Da chiamare al primo gesto utente (click/tasto/touch).
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // ambiente senza Web Audio: silenzioso, nessun crash
    this.ctx = new AC();
    // master (mute) -> destination
    this.master = this.ctx.createGain();
    this.master.gain.value = this._muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    // music e sfx come figli del master, con i propri volumi.
    this.music = this.ctx.createGain();
    this.music.gain.value = this._musicVol;
    this.music.connect(this.master);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = this._sfxVol;
    this.sfx.connect(this.master);

    this._startTime = this.ctx.currentTime;
    this._nextBeatTime = this.ctx.currentTime + 0.05;
    this._beatIndex = 0;
    this.enabled = true;

    // Prova a caricare i brani da file e instradarli sul nodo `music`. Siamo
    // dentro un gesto utente, quindi play() è consentito dalle policy browser.
    this._initMusicFiles();
  }

  // Carica i brani di MUSIC_TRACKS come HTMLAudioElement in loop, collegati al
  // grafo audio. Se mancano / danno errore, _musicFileOk resta false per quel
  // brano → si usa il beat sintetizzato finché nessun file ha caricato.
  _initMusicFiles() {
    for (const [name, src] of Object.entries(MUSIC_TRACKS)) {
      if (this._tracks[name]) continue;
      try {
        const el = new window.Audio(src);
        el.loop = true;
        el.crossOrigin = 'anonymous';
        let connected = false;
        el.addEventListener('canplay', () => {
          if (!connected) {
            connected = true;
            this.ctx.createMediaElementSource(el).connect(this.music);
          }
          this._musicFileOk = true;
          // Avvia subito solo se è il brano correntemente desiderato.
          if (name === this._currentTrack) el.play().catch(() => {});
        });
        el.addEventListener('error', () => {
          // file mancante: questo brano non è disponibile (fallback al beat)
        });
        this._tracks[name] = el;
      } catch {
        // ambiente senza HTMLAudioElement: nessun brano, resta il beat
      }
    }
  }

  // Sceglie il brano di sottofondo: 'home' (menu) o 'game' (livello). Memorizza
  // la scelta anche prima dell'unlock. Con { restart: true } riparte da capo
  // (usato su morte/tentativo per ricominciare game.mp3). Senza restart, se è già
  // il brano corrente in riproduzione non fa nulla (evita riavvii nei menu).
  setTrack(name, { restart = false } = {}) {
    this._currentTrack = name;
    const el = this._tracks[name];
    if (!el) return; // non ancora caricato / file mancante
    if (!restart && !el.paused) return;
    // Ferma gli altri brani.
    for (const [n, other] of Object.entries(this._tracks)) {
      if (n !== name && !other.paused) other.pause();
    }
    if (restart) el.currentTime = 0;
    el.play().catch(() => {});
  }

  // --- Volumi / mute (memorizzati, applicabili anche prima dell'unlock) ------
  setMusicVolume(v) {
    this._musicVol = Math.max(0, Math.min(1, v));
    if (this.music) this.music.gain.value = this._musicVol;
  }
  setSfxVolume(v) {
    this._sfxVol = Math.max(0, Math.min(1, v));
    if (this.sfx) this.sfx.gain.value = this._sfxVol;
  }
  setMuted(b) {
    this._muted = !!b;
    if (this.master) this.master.gain.value = this._muted ? 0 : 1;
  }
  get musicVolume() {
    return this._musicVol;
  }
  get sfxVolume() {
    return this._sfxVol;
  }
  get muted() {
    return this._muted;
  }

  // Va chiamata regolarmente (dal game loop): schedula i beat imminenti.
  update() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    // Finché l'AudioContext non è davvero attivo (policy autoplay: serve un gesto
    // utente), NON generare suoni — emetterebbero warning in console. Avanza solo
    // il clock dei beat così al risveglio non c'è un buco ritmico.
    const running = this.ctx.state === 'running';
    while (this._nextBeatTime < now + 0.1) {
      if (running) this._scheduleBeat(this._nextBeatTime, this._beatIndex);
      this._nextBeatTime += this.secondsPerBeat;
      this._beatIndex++;
    }
  }

  // Fase del beat corrente: 0 sul battito, ->1 appena prima del successivo.
  beatPhase() {
    if (!this.enabled) return 0;
    const t = (this.ctx.currentTime - this._startTime) % this.secondsPerBeat;
    return t / this.secondsPerBeat;
  }

  // Un kick su ogni beat, un hi-hat sui contrattempi. Il clock avanza sempre
  // (serve a beatPhase()), ma il SUONO si emette solo come fallback quando non
  // c'è un brano da file (per evitare doppia musica).
  _scheduleBeat(time, index) {
    if (this._musicFileOk) return;
    this._kick(time);
    this._hat(time + this.secondsPerBeat / 2);
  }

  _kick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.12);
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(gain).connect(this.music);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  _hat(time) {
    // Rumore breve filtrato passa-alto = hi-hat.
    const buffer = this._noiseBuffer();
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    src.connect(hp).connect(gain).connect(this.music);
    src.start(time);
    src.stop(time + 0.06);
  }

  // Buffer di rumore bianco riusato per gli hi-hat (generato una volta).
  _noiseBuffer() {
    if (this._noise) return this._noise;
    const len = Math.floor(this.ctx.sampleRate * 0.06);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Rumore pseudo-casuale deterministico (LCG) per non usare Math.random.
    let s = 12345;
    for (let i = 0; i < len; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (s / 0x3fffffff) - 1;
    }
    this._noise = buf;
    return buf;
  }

  // --- Effetti sonori (sintetizzati, instradati su `sfx`) --------------------
  // Tono singolo: oscillatore con inviluppo, sweep di frequenza opzionale.
  _tone(f0, f1, dur, type = 'square', peak = 0.5, delay = 0) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  playCoin() {
    // Due note brevi ascendenti (classico "ding").
    this._tone(880, 880, 0.07, 'square', 0.4);
    this._tone(1320, 1320, 0.12, 'square', 0.4, 0.07);
  }
  playDeath() {
    // Scivolata discendente + tono grave.
    this._tone(400, 80, 0.35, 'sawtooth', 0.5);
  }
}
