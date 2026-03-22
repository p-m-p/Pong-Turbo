const SFX = ['paddle', 'ghost', 'roundEnd', 'levelUp'];

export class WebAudioAdapter {
  #sounds = {};

  init() {
    const container = document.getElementById('gameSounds');
    for (const name of SFX) {
      const el = document.createElement('audio');
      el.src     = `sound/mp3/${name}.mp3`;
      el.preload = 'auto';
      container.appendChild(el);
      this.#sounds[name] = el;
    }
  }

  play(name) {
    const sound = this.#sounds[name];
    if (!sound) return;
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }
}
