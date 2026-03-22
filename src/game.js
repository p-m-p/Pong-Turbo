import { GameLoop }             from './domain/GameLoop.js';
import { CanvasRenderAdapter }  from './adapters/browser/CanvasRenderAdapter.js';
import { WebAudioAdapter }      from './adapters/browser/WebAudioAdapter.js';
import { KeyboardInputAdapter } from './adapters/browser/KeyboardInputAdapter.js';
import { TouchInputAdapter }    from './adapters/browser/TouchInputAdapter.js';
import { DOMScoreAdapter }      from './adapters/browser/DOMScoreAdapter.js';
import { TARGET_FRAME_MS, MAX_FRAME_MS, PADDLE_BASE_H } from './domain/constants.js';

export function initGame() {
  // ── Adapters ────────────────────────────────────────────────────────────
  const render   = new CanvasRenderAdapter();
  const audio    = new WebAudioAdapter();
  const keyboard = new KeyboardInputAdapter();
  const touch    = new TouchInputAdapter(keyboard);
  const score    = new DOMScoreAdapter();

  render.init();
  audio.init();
  keyboard.init();
  score.init();

  // ── Game loop ───────────────────────────────────────────────────────────
  const loop = new GameLoop(render, audio, touch, score);

  let rafId         = null;
  let lastTimestamp = null;

  function startNewGame() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTimestamp = null;
    loop.startNewGame(performance.now());
    touch.init(PADDLE_BASE_H);
    rafId = requestAnimationFrame(gameLoop);
  }

  function gameLoop(timestamp) {
    const elapsed   = lastTimestamp
      ? Math.min(timestamp - lastTimestamp, MAX_FRAME_MS)
      : TARGET_FRAME_MS;
    lastTimestamp = timestamp;

    const timeScale = elapsed / TARGET_FRAME_MS;
    const result    = loop.tick(timestamp, timeScale);

    if (result === 'gameover') {
      render.drawGameOver();
      rafId = null;
      return;
    }

    rafId = requestAnimationFrame(gameLoop);
  }

  // ── Start screen ─────────────────────────────────────────────────────────
  function setupStartScreen() {
    document
      .getElementById('startGame')
      .addEventListener('click', onStartClick, { once: true });
  }

  function onStartClick() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('soundtrack').play().catch(() => {});
    startNewGame();
  }

  // ── Restart on Enter after game over ─────────────────────────────────────
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && rafId === null) startNewGame();
  });

  // ── Sound toggle ─────────────────────────────────────────────────────────
  function setupSoundToggle() {
    const soundtrack = document.getElementById('soundtrack');
    const btn        = document.getElementById('toggleSound');
    const STORAGE_KEY = 'pongTurbo.muted';

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'true') {
      soundtrack.muted = true;
      btn.classList.add('muted');
      btn.setAttribute('aria-label', 'Unmute sound');
    }

    btn.addEventListener('click', function () {
      soundtrack.muted = !soundtrack.muted;
      localStorage.setItem(STORAGE_KEY, soundtrack.muted);
      this.classList.toggle('muted', soundtrack.muted);
      this.setAttribute('aria-label', soundtrack.muted ? 'Unmute sound' : 'Mute sound');
      this.blur();
    });
  }

  setupSoundToggle();
  setupStartScreen();
}
