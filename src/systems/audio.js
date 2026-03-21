const sounds = {};

const SFX = ['paddle', 'ghost', 'roundEnd', 'levelUp'];

export function initAudio() {
  const container = document.getElementById('gameSounds');
  for (const name of SFX) {
    const el = document.createElement('audio');
    el.src = `sound/mp3/${name}.mp3`;
    el.preload = 'auto';
    container.appendChild(el);
    sounds[name] = el;
  }
}

export function play(name) {
  const sound = sounds[name];
  if (!sound) return;
  sound.currentTime = 0;
  sound.play().catch(() => {});
}
