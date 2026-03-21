import { Ball } from './entities/ball.js';
import { Paddle } from './entities/paddle.js';
import { GhostSystem } from './systems/ghosts.js';
import { Scoreboard } from './systems/scoreboard.js';
import { initAudio, play } from './systems/audio.js';

const CANVAS_W = 600;
const CANVAS_H = 400;
const INITIAL_SPEED = 16;
const TARGET_FRAME_MS = 1000 / 30; // normalise movement to original 30fps feel
const MAX_FRAME_MS = 50;           // cap delta to avoid spiral of death on tab resume
const INITIAL_LIVES = 5;

export function initGame() {
  const canvas = document.getElementById('pongBoard');
  const ctx = canvas.getContext('2d');
  const scoreboard = new Scoreboard();
  const ghostSystem = new GhostSystem();

  // ── Private game state ───────────────────────────────────────────────────
  // Nothing below is accessible from the console or external code.
  let ball;
  let paddle;
  let score;
  let lives;
  let level;
  let gameSpeed;
  let rafId = null;
  let lastTimestamp = null;

  initAudio();
  setupControls();
  setupSoundToggle();
  waitForAudio();

  // ── Boot sequence ─────────────────────────────────────────────────────────

  function waitForAudio() {
    const soundtrack = document.getElementById('soundtrack');
    const check = () => {
      if (soundtrack.readyState >= 3) {
        showStartScreen();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  }

  function showStartScreen() {
    document.getElementById('loadingMessage').style.display = 'none';
    const btn = document.getElementById('startGame');
    btn.style.display = 'block';
    btn.disabled = false;
    btn.addEventListener('click', onStartClick, { once: true });
    btn.focus();
  }

  function onStartClick() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    document.getElementById('soundtrack').play().catch(() => {});
    startNewGame();
  }

  // ── Input ─────────────────────────────────────────────────────────────────

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

  function setupSoundToggle() {
    const soundtrack = document.getElementById('soundtrack');
    document.getElementById('toggleSound').addEventListener('click', function () {
      soundtrack.muted = !soundtrack.muted;
      this.className = soundtrack.muted ? 'muted' : '';
      this.blur();
    });
  }

  // ── Game lifecycle ────────────────────────────────────────────────────────

  function startNewGame() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    score = 0;
    lives = INITIAL_LIVES;
    level = 1;
    gameSpeed = INITIAL_SPEED;
    lastTimestamp = null;

    clearCanvas();

    paddle = new Paddle(
      canvas.width - 15,
      canvas.height / 2 - 20,
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

  // ── Game loop ─────────────────────────────────────────────────────────────

  function gameLoop(timestamp) {
    const elapsed = lastTimestamp
      ? Math.min(timestamp - lastTimestamp, MAX_FRAME_MS)
      : TARGET_FRAME_MS;
    lastTimestamp = timestamp;

    // Scale factor normalises movement to the original 30fps speed
    const scale = elapsed / TARGET_FRAME_MS;

    update(scale);

    if (rafId !== null) {
      rafId = requestAnimationFrame(gameLoop);
    }
  }

  function update(scale) {
    const ballResult = moveBall(scale);

    if (ballResult === 'out') {
      handleBallOut();
      return;
    }

    paddle.move(canvas.height, 1.2 * gameSpeed * scale);

    if (ghostSystem.allDead()) {
      level++;
      gameSpeed += 2;
      score += level * 1000;
      scoreboard.updateScore(score);
      play('levelUp');
      ghostSystem.spawn();
    } else {
      ghostSystem.move(canvas.height, (gameSpeed / 4) * scale);
    }

    draw();
  }

  // ── Ball movement & collisions ────────────────────────────────────────────

  function moveBall(scale) {
    const b = ball;

    // Top/bottom wall bounce — use Math.abs to force direction and avoid
    // double-reflecting when the ball clips multiple pixels past the boundary.
    if (b.y <= 0) {
      b.dy = Math.abs(b.dy);
      if (b.x - b.w / 2 <= 0) b.dx = Math.abs(b.dx); // corner clanger guard
    } else if (b.y + b.h >= canvas.height) {
      b.dy = -Math.abs(b.dy);
      if (b.x - b.w / 2 <= 0) b.dx = Math.abs(b.dx);
    }

    // Left wall
    if (b.x <= 0) {
      b.dx = Math.abs(b.dx);
    }

    // Right edge — ball lost
    if (b.x + b.w >= canvas.width) {
      return 'out';
    }

    // Paddle collision (only meaningful when ball is moving right)
    if (b.dx > 0 && checkPaddleHit()) {
      play('paddle');
    } else if (ghostSystem.checkCollision(b)) {
      score += level * gameSpeed;
      scoreboard.updateScore(score);
      play('ghost');
    }

    b.x += b.dx * scale;
    b.y += b.dy * scale;

    return 'ok';
  }

  function checkPaddleHit() {
    const b = ball;
    const p = paddle;

    const overlapsX = b.x + b.w >= p.x && b.x < p.x + p.w;
    const overlapsY = b.y + b.h > p.y && b.y < p.y + p.h;

    if (!overlapsX || !overlapsY) return false;

    // Randomise the return angle, but keep it within playable bounds
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

  // ── Life / game-over handling ─────────────────────────────────────────────

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
    ball.x = 60;
    ball.y = Math.floor((canvas.height - ball.h * 2) * Math.random());
    ball.dx = gameSpeed / 2;
    ball.dy = gameSpeed / 2;
  }

  function gameOver() {
    cancelAnimationFrame(rafId);
    rafId = null;
    clearCanvas();
    ctx.fillStyle = 'orange';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(
      'Game over! Hit enter to play again',
      canvas.width / 2 - 110,
      canvas.height / 2 - 7,
    );
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  function clearCanvas() {
    // Reassigning width is the canonical way to clear and reset canvas state
    canvas.width = canvas.width;
  }

  function draw() {
    clearCanvas();
    ctx.fillStyle = 'orange';
    ball.draw(ctx);
    paddle.draw(ctx);
    ghostSystem.draw(ctx);
  }
}
