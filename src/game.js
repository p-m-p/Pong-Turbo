import { GameLoop }        from './domain/GameLoop.js';
import { WebAudioAdapter } from './adapters/browser/WebAudioAdapter.js';
import { TARGET_FRAME_MS, MAX_FRAME_MS, PADDLE_BASE_H } from './domain/constants.js';
import './components/PongCanvas.js';
import './components/PongHud.js';
import './components/PongSoundToggle.js';

export function initGame() {
  const canvasEl = document.querySelector('pong-canvas');
  const hudEl    = document.querySelector('pong-hud');
  const audio    = new WebAudioAdapter();
  audio.init();

  const loop = new GameLoop(canvasEl.renderAdapter, audio, canvasEl.inputAdapter, hudEl);

  let rafId         = null;
  let lastTimestamp = null;

  function startNewGame() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTimestamp = null;
    loop.startNewGame(performance.now());
    canvasEl.initInput(PADDLE_BASE_H);
    rafId = requestAnimationFrame(gameLoop);
  }

  function gameLoop(timestamp) {
    const elapsed   = lastTimestamp
      ? Math.min(timestamp - lastTimestamp, MAX_FRAME_MS)
      : TARGET_FRAME_MS;
    lastTimestamp = timestamp;

    const result = loop.tick(timestamp, elapsed / TARGET_FRAME_MS);

    if (result === 'gameover') {
      canvasEl.renderAdapter.drawGameOver();
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(gameLoop);
  }

  canvasEl.addEventListener('game-start', () => startNewGame());
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && rafId === null) startNewGame();
  });
}
