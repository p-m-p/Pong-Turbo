const SFX = ['paddle', 'ghost', 'roundEnd', 'levelUp'];

export class WebAudioAdapter {
  #ctx     = null;
  #buffers = {};

  init() {
    try {
      this.#ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return; }

    for (const name of SFX) {
      fetch(`sound/mp3/${name}.mp3`)
        .then(r => r.arrayBuffer())
        .then(ab => this.#ctx.decodeAudioData(ab))
        .then(buf => { this.#buffers[name] = buf; })
        .catch(() => {});
    }
  }

  /**
   * Resume the AudioContext from within a user-gesture handler.
   * Required on iOS, where the context starts suspended.
   */
  unlock() {
    this.#ctx?.resume();
  }

  play(name) {
    const ctx = this.#ctx;
    const buf = this.#buffers[name];
    if (!ctx || !buf) return;

    // Resume if the context was suspended (iOS background/focus changes)
    if (ctx.state === 'suspended') ctx.resume();

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  }
}
