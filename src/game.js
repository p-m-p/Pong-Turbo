import { Ball } from './entities/ball.js';
import { Paddle } from './entities/paddle.js';
import { GhostSystem } from './systems/ghosts.js';
import { Scoreboard } from './systems/scoreboard.js';
import { initAudio, play } from './systems/audio.js';

// ── Virtual coordinate space ───────────────────────────────────────────────
// All game logic runs in this fixed space. drawScale maps it to physical pixels.
const VIRTUAL_W    = 600;
const VIRTUAL_H    = 400;
const ASPECT_RATIO = VIRTUAL_W / VIRTUAL_H;   // 3:2
const MAX_PHYS_W   = 1200;
const MAX_PHYS_H   = 800;

// ── Game tuning ────────────────────────────────────────────────────────────
const INITIAL_SPEED   = 16;
const TARGET_FRAME_MS = 1000 / 30; // normalise movement to original 30fps feel
const MAX_FRAME_MS    = 50;        // cap delta to avoid spiral-of-death on tab resume
const INITIAL_LIVES   = 5;

// ── Colours (Catppuccin Mocha) ─────────────────────────────────────────────
const CLR_BALL       = '#cba6f7'; // mauve
const CLR_PADDLE     = '#b4befe'; // lavender
const CLR_TEXT       = '#cdd6f4'; // text
const CLR_CANVAS_BG  = '#181825'; // mantle

export function initGame() {
  const canvas = document.getElementById('pongBoard');
  const ctx    = canvas.getContext('2d');
  const scoreboard  = new Scoreboard();
  const ghostSystem = new GhostSystem();

  // ── Rendering state ────────────────────────────────────────────────────
  let drawScale = 1;
  let dpr       = window.devicePixelRatio || 1;

  // ── Private game state ─────────────────────────────────────────────────
  // Nothing below is accessible from the console or external code.
  let ball;
  let paddle;
  let score;
  let lives;
  let level;
  let gameSpeed;
  let rafId         = null;
  let lastTimestamp = null;

  initAudio();
  setupResizeObserver();
  setupControls();
  setupTouchControl();
  setupSoundToggle();
  setupStartScreen();

  // ── Responsive canvas ──────────────────────────────────────────────────

  function resizeCanvas() {
    const wrap      = document.getElementById('canvas-wrap');
    const touchZone = document.getElementById('touch-control');

    // Subtract touch control width when it's visible so the canvas fits cleanly
    const touchZoneW = touchZone && getComputedStyle(touchZone).display !== 'none'
      ? touchZone.offsetWidth
      : 0;

    const availW = wrap.clientWidth - touchZoneW;
    const availH = wrap.clientHeight;

    // Fit inside available space at ASPECT_RATIO, capped at MAX_PHYS dimensions
    let physW, physH;
    if (availW / availH > ASPECT_RATIO) {
      physH = Math.min(availH, MAX_PHYS_H);
      physW = physH * ASPECT_RATIO;
    } else {
      physW = Math.min(availW, MAX_PHYS_W);
      physH = physW / ASPECT_RATIO;
    }

    dpr = window.devicePixelRatio || 1;

    canvas.width  = Math.round(physW * dpr);
    canvas.height = Math.round(physH * dpr);
    canvas.style.width  = `${physW}px`;
    canvas.style.height = `${physH}px`;

    // Size the touch zone to exactly match the canvas height
    if (touchZone) {
      touchZone.style.height = `${physH}px`;
    }

    drawScale = physW / VIRTUAL_W;
  }

  function setupResizeObserver() {
    const wrap = document.getElementById('canvas-wrap');
    const ro   = new ResizeObserver(resizeCanvas);
    ro.observe(wrap);
  }

  // ── Start screen ───────────────────────────────────────────────────────

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

  // ── Input ──────────────────────────────────────────────────────────────

  function setupControls() {
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowUp' || ev.key === '8') {
        if (paddle) paddle.moveY = 'up';
      } else if (ev.key === 'ArrowDown' || ev.key === '2') {
        if (paddle) paddle.moveY = 'down';
      } else if (ev.key === 'Enter' && rafId === null) {
        startNewGame();
      }
    });
    window.addEventListener('keyup', () => {
      if (paddle) paddle.moveY = null;
    });
  }

  // ── Touch control ──────────────────────────────────────────────────────

  function setupTouchControl() {
    const zone = document.getElementById('touch-control');
    if (!zone) return;

    function onTouch(ev) {
      if (!paddle) return;
      const touch = ev.touches[0];
      const rect  = zone.getBoundingClientRect();
      // Clamp to zone bounds, map directly to virtual paddle Y
      const relY  = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
      paddle.y    = relY * (VIRTUAL_H - paddle.h);
    }

    zone.addEventListener('touchstart', onTouch, { passive: true });
    zone.addEventListener('touchmove',  onTouch, { passive: true });
  }

  function updateTouchKnob() {
    const knob = document.getElementById('touch-knob');
    const zone = document.getElementById('touch-control');
    if (!knob || !zone || !paddle) return;
    if (getComputedStyle(zone).display === 'none') return;

    const knobH  = knob.offsetHeight;
    const zoneH  = zone.offsetHeight;
    const relY   = paddle.y / (VIRTUAL_H - paddle.h);
    knob.style.top = `${relY * (zoneH - knobH)}px`;

    // Update ARIA value for assistive technology
    const pct = Math.round(relY * 100);
    zone.setAttribute('aria-valuenow', pct);
  }

  function setupSoundToggle() {
    const soundtrack = document.getElementById('soundtrack');
    document.getElementById('toggleSound').addEventListener('click', function () {
      soundtrack.muted    = !soundtrack.muted;
      this.classList.toggle('muted', soundtrack.muted);
      this.setAttribute('aria-label', soundtrack.muted ? 'Unmute sound' : 'Mute sound');
      this.blur();
    });
  }

  // ── Game lifecycle ─────────────────────────────────────────────────────

  function startNewGame() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    score         = 0;
    lives         = INITIAL_LIVES;
    level         = 1;
    gameSpeed     = INITIAL_SPEED;
    lastTimestamp = null;

    paddle = new Paddle(
      VIRTUAL_W - 15,
      VIRTUAL_H / 2 - 20,
      10,
      60,
    );

    ball = new Ball(
      60,
      20,
      10,
      10,
      gameSpeed / 2,
      gameSpeed / 2,
    );

    scoreboard.reset(lives);
    ghostSystem.spawn();

    rafId = requestAnimationFrame(gameLoop);
  }

  // ── Game loop ──────────────────────────────────────────────────────────

  function gameLoop(timestamp) {
    const elapsed = lastTimestamp
      ? Math.min(timestamp - lastTimestamp, MAX_FRAME_MS)
      : TARGET_FRAME_MS;
    lastTimestamp = timestamp;

    // timeScale normalises movement so the game feels the same at any frame rate
    const timeScale = elapsed / TARGET_FRAME_MS;

    update(timeScale);

    if (rafId !== null) {
      rafId = requestAnimationFrame(gameLoop);
    }
  }

  function update(timeScale) {
    const ballResult = moveBall(timeScale);

    if (ballResult === 'out') {
      handleBallOut();
      return;
    }

    paddle.move(VIRTUAL_H, 1.2 * gameSpeed * timeScale);

    if (ghostSystem.allDead()) {
      level++;
      gameSpeed += 2;
      score += level * 1000;
      scoreboard.updateScore(score);
      play('levelUp');
      ghostSystem.spawn();
    } else {
      ghostSystem.move(VIRTUAL_H, (gameSpeed / 4) * timeScale);
    }

    draw();
  }

  // ── Ball movement & collisions ─────────────────────────────────────────

  function moveBall(timeScale) {
    const b = ball;

    if (b.y <= 0) {
      b.dy = Math.abs(b.dy);
      if (b.x - b.w / 2 <= 0) b.dx = Math.abs(b.dx);
    } else if (b.y + b.h >= VIRTUAL_H) {
      b.dy = -Math.abs(b.dy);
      if (b.x - b.w / 2 <= 0) b.dx = Math.abs(b.dx);
    }

    if (b.x <= 0) {
      b.dx = Math.abs(b.dx);
    }

    if (b.x + b.w >= VIRTUAL_W) {
      return 'out';
    }

    if (b.dx > 0 && checkPaddleHit()) {
      play('paddle');
    } else if (ghostSystem.checkCollision(b)) {
      score += level * gameSpeed;
      scoreboard.updateScore(score);
      play('ghost');
    }

    b.x += b.dx * timeScale;
    b.y += b.dy * timeScale;

    return 'ok';
  }

  function checkPaddleHit() {
    const b = ball;
    const p = paddle;

    const overlapsX = b.x + b.w >= p.x && b.x < p.x + p.w;
    const overlapsY = b.y + b.h > p.y  && b.y < p.y + p.h;

    if (!overlapsX || !overlapsY) return false;

    const x = Math.max(
      gameSpeed / 2,
      Math.abs(Math.round(gameSpeed * Math.random())),
    );
    b.dy = b.dy < 0 ? -(gameSpeed - x) : (gameSpeed - x);
    b.dx = -x;

    score += gameSpeed;
    scoreboard.updateScore(score);
    return true;
  }

  // ── Life / game-over handling ──────────────────────────────────────────

  function handleBallOut() {
    lives--;
    scoreboard.updateLives(lives);

    if (lives <= 0) {
      gameOver();
    } else {
      play('roundEnd');
      resetBall();
    }
  }

  function resetBall() {
    ball.x  = 60;
    ball.y  = Math.floor((VIRTUAL_H - ball.h * 2) * Math.random());
    ball.dx = gameSpeed / 2;
    ball.dy = gameSpeed / 2;
  }

  function gameOver() {
    cancelAnimationFrame(rafId);
    rafId = null;

    // Draw game-over message in virtual coordinate space
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(drawScale * dpr, drawScale * dpr);
    ctx.fillStyle  = CLR_TEXT;
    ctx.font       = `bold 16px 'Play', sans-serif`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur  = 12 * drawScale;
    ctx.shadowColor = CLR_BALL;
    ctx.fillText('Game over  ·  press Enter to play again', VIRTUAL_W / 2, VIRTUAL_H / 2);
    ctx.restore();
  }

  // ── Rendering ──────────────────────────────────────────────────────────

  function draw() {
    updateTouchKnob();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(drawScale * dpr, drawScale * dpr);

    // Ball — mauve with glow
    ctx.shadowBlur  = 10 * drawScale;
    ctx.shadowColor = CLR_BALL;
    ctx.fillStyle   = CLR_BALL;
    ball.draw(ctx);

    // Paddle — lavender with glow
    ctx.shadowColor = CLR_PADDLE;
    ctx.fillStyle   = CLR_PADDLE;
    paddle.draw(ctx);

    ctx.shadowBlur = 0;
    ghostSystem.draw(ctx, drawScale);

    ctx.restore();
  }
}
