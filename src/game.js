import { GameLoop } from './domain/GameLoop.js';
import { WebAudioAdapter } from './adapters/browser/WebAudioAdapter.js';
import { TARGET_FRAME_MS, MAX_FRAME_MS, PADDLE_BASE_H } from './domain/constants.js';
import './components/PongCanvas.js';
import './components/PongHud.js';
import './components/PongSoundToggle.js';
import './components/PongScoreboard.js';

// iOS Safari does not support requestFullscreen on arbitrary elements.
// On iOS, fullscreen is only available via "Add to Home Screen" (PWA mode).
const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);

function requestFullscreen() {
  if (!isIos) document.documentElement.requestFullscreen?.().catch(() => {});
}

function initFullscreenOnLandscape() {
  if (!('ontouchstart' in window || navigator.maxTouchPoints > 0)) return;

  const onOrientationChange = () => {
    const isLandscape = window.matchMedia('(orientation: landscape)').matches;
    if (isLandscape && !document.fullscreenElement) {
      requestFullscreen();
    } else if (!isLandscape && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  screen.orientation?.addEventListener('change', onOrientationChange);
  window.addEventListener('orientationchange', onOrientationChange);
}

export function initGame() {
  initFullscreenOnLandscape();
  const canvasEl = document.querySelector('pong-canvas');
  const hudEl = document.querySelector('pong-hud');
  const scoreboardEl = document.querySelector('pong-scoreboard');
  const audio = new WebAudioAdapter();
  audio.init();

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const loop = new GameLoop(canvasEl.renderAdapter, audio, canvasEl.inputAdapter, hudEl);

  let rafId = null;
  let lastTimestamp = null;
  let gameToken = null;
  let checkpoints = [];
  let trackedLevel = 1;

  async function fetchToken() {
    try {
      gameToken = (await scoreboardEl?.fetchToken()) ?? null;
    } catch {
      gameToken = null;
    }
  }

  function startNewGame() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTimestamp = null;
    gameToken = null;
    checkpoints = [];
    trackedLevel = 1;
    loop.setFieldW(canvasEl.renderAdapter.virtualW);
    loop.startNewGame(performance.now());
    canvasEl.initInput(PADDLE_BASE_H);
    canvasEl.setAttribute('playing', '');
    document.body.classList.remove('play-pending');
    document.body.classList.add('game-playing');
    document
      .querySelector('#soundtrack')
      ?.play()
      .catch(() => {});
    fetchToken();
    rafId = requestAnimationFrame(gameLoop);
  }

  // When a touch device rotates to landscape while play is pending, start the game
  if (isTouchDevice) {
    const onLandscapeForPending = () => {
      if (
        window.matchMedia('(orientation: landscape)').matches &&
        document.body.classList.contains('play-pending')
      ) {
        audio.unlock();
        requestFullscreen();
        scoreboardEl?.hide();
        startNewGame();
      }
    };
    screen.orientation?.addEventListener('change', onLandscapeForPending);
    window.addEventListener('orientationchange', onLandscapeForPending);
  }

  function gameLoop(timestamp) {
    // Pause while a touch device is in portrait (rotate overlay is showing)
    if (isTouchDevice && window.matchMedia('(orientation: portrait)').matches) {
      lastTimestamp = null;
      rafId = requestAnimationFrame(gameLoop);
      return;
    }

    const elapsed = lastTimestamp
      ? Math.min(timestamp - lastTimestamp, MAX_FRAME_MS)
      : TARGET_FRAME_MS;
    lastTimestamp = timestamp;

    const result = loop.tick(timestamp, elapsed / TARGET_FRAME_MS);

    // Record a checkpoint each time the level advances
    if (loop.level !== trackedLevel) {
      trackedLevel = loop.level;
      checkpoints.push({ level: trackedLevel, score: loop.scoreValue });
    }

    if (result === 'gameover') {
      canvasEl.renderAdapter.drawGameOver();
      canvasEl.removeAttribute('playing');
      document.body.classList.remove('game-playing');
      rafId = null;
      scoreboardEl?.showResult(loop.scoreValue, gameToken, checkpoints);
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
    audio.unlock();
    // On touch devices in portrait, show the rotate overlay and wait for the user
    // to rotate to landscape — the orientation change listener will start the game.
    if (isTouchDevice && window.matchMedia('(orientation: portrait)').matches) {
      document.body.classList.add('play-pending');
      return;
    }
    if (isTouchDevice) {
      requestFullscreen();
    }
    scoreboardEl?.hide();
    startNewGame();
  });

  // Pause music when the app is hidden (tab switch, home button, lock screen)
  document.addEventListener('visibilitychange', () => {
    const soundtrack = document.querySelector('#soundtrack');
    if (!soundtrack) return;
    if (document.hidden) {
      soundtrack.pause();
    } else if (rafId !== null) {
      soundtrack.play().catch(() => {});
    }
  });

  // Keyboard Enter — only when scoreboard is hidden (avoid firing during name entry)
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && rafId === null && scoreboardEl?.hidden) {
      startNewGame();
    }
  });
}
