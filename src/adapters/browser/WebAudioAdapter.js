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
    const buf = this.#buffers[name];
    if (!ctx || !buf) return;
    if (ctx.state === 'suspended') ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  }

  #decode(name) {
    const raw = this.#raw[name];
    if (!raw || !this.#ctx) return;
    this.#ctx.decodeAudioData(raw)
      .then(buf => { this.#buffers[name] = buf; })
      .catch(() => {});
  }
}
