import { GameLoop }        from './domain/GameLoop.js';
import { WebAudioAdapter } from './adapters/browser/WebAudioAdapter.js';
import { TARGET_FRAME_MS, MAX_FRAME_MS, PADDLE_BASE_H } from './domain/constants.js';
import './components/PongCanvas.js';
import './components/PongHud.js';
import './components/PongSoundToggle.js';
import './components/PongScoreboard.js';

export function initGame() {
  const canvasEl     = document.querySelector('pong-canvas');
  const hudEl        = document.querySelector('pong-hud');
  const scoreboardEl = document.querySelector('pong-scoreboard');
  const audio        = new WebAudioAdapter();
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
    const elapsed = lastTimestamp
      ? Math.min(timestamp - lastTimestamp, MAX_FRAME_MS)
      : TARGET_FRAME_MS;
    lastTimestamp = timestamp;

    const result = loop.tick(timestamp, elapsed / TARGET_FRAME_MS);

    if (result === 'gameover') {
      canvasEl.renderAdapter.drawGameOver();
      rafId = null;
      scoreboardEl?.showResult(loop.scoreValue);
      return;
    }
    rafId = requestAnimationFrame(gameLoop);
  }

  if (scoreboardEl) {
    // Scoreboard owns the Play button — hide the canvas start screen
    canvasEl.hideStartScreen();
    scoreboardEl.showTopScores();
  } else {
    // Fallback: use canvas start screen directly
    canvasEl.addEventListener('game-start', () => startNewGame(), { once: true });
  }

  // Scoreboard Play / Play Again button
  document.addEventListener('play-requested', () => {
    scoreboardEl?.hide();
    startNewGame();
  });

  // Keyboard Enter — only when scoreboard is hidden (avoid firing during name entry)
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && rafId === null && scoreboardEl?.hidden) {
      startNewGame();
    }
  });
}
