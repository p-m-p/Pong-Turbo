const SFX = ['paddle', 'ghost', 'roundEnd', 'levelUp'];

export class WebAudioAdapter {
  #ctx     = null;
  #buffers = {};
  #raw     = {}; // pre-fetched ArrayBuffers, decoded once ctx exists

  init() {
    // Fetch raw bytes now so they're ready to decode on first user gesture.
    // Do NOT create AudioContext here — iOS suspends any context created before
    // a user gesture and also blocks <audio> elements from playing.
    for (const name of SFX) {
      fetch(`sound/mp3/${name}.mp3`)
        .then(r => r.arrayBuffer())
        .then(ab => {
          this.#raw[name] = ab;
          if (this.#ctx) this.#decode(name);
        })
        .catch(() => {});
    }
  }

  /** Call from a user-gesture handler (e.g. button click) to create and resume the context. */
  unlock() {
    if (!this.#ctx) {
      try {
        this.#ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch { return; }
      for (const name of Object.keys(this.#raw)) this.#decode(name);
    }
    if (this.#ctx.state === 'suspended') this.#ctx.resume();
  }

  play(name) {
    const ctx = this.#ctx;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (name === 'mothership') return this.#playMothership(ctx);
    const buf = this.#buffers[name];
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  }

  /** Synthesised descending blip — Space Invaders UFO hit. */
  #playMothership(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.35);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  #decode(name) {
    const raw = this.#raw[name];
    if (!raw || !this.#ctx) return;
    this.#raw[name] = null; // ArrayBuffer is transferred on decode — prevent double-decode
    this.#ctx.decodeAudioData(raw)
      .then(buf => { this.#buffers[name] = buf; })
      .catch(() => {});
  }
}
