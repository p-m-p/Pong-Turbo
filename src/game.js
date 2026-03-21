import { Ball } from './entities/ball.js';
import { Paddle } from './entities/paddle.js';
import { GhostSystem } from './systems/ghosts.js';
import { PowerUpSystem } from './systems/powerups.js';
import { AlienSystem } from './systems/aliens.js';
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

// ── Ball spin from paddle velocity ─────────────────────────────────────────
// Fraction of paddle.vy added to ball dy on hit; capped at ±60% of ballSpeed
const SPIN_FACTOR = 0.25;

// ── New-life serve animation ───────────────────────────────────────────────
const READY_PAUSE_MS = 600;   // brief stationary pulse before ball moves

// ── Per-rally ball speed ramp ───────────────────────────────────────────────
// Each paddle return nudges the ball a little faster; resets on each new rally
const RALLY_INCREMENT = 0.5;  // virtual units added per hit
const RALLY_CAP       = 6;    // max units above gameSpeed within a rally

// ── Power-up effects ───────────────────────────────────────────────────────
const WIDE_DURATION_MS = 8_000;
const WIDE_SCALE       = 1.75;  // paddle height multiplier
const PADDLE_BASE_H    = 60;    // must match startNewGame() paddle constructor

// ── Bonus round (every 3rd level) ─────────────────────────────────────────
const BONUS_COMPLETION_SCORE = 2000; // × level awarded on clearing all aliens

// ── Paddle stun (ghost contact) ────────────────────────────────────────────
const STUN_DURATION_MS         = 2500;
const STUN_PULSE_ANGULAR_FREQ  = 0.019;  // ~3 Hz — visible flicker
// Ball passes through the paddle when pulse alpha drops below this value
const STUN_PASSTHROUGH_ALPHA   = 0.4;

// ── Colours (Catppuccin Mocha) ─────────────────────────────────────────────
const CLR_BALL       = '#cba6f7'; // mauve
const CLR_PADDLE     = '#b4befe'; // lavender
const CLR_TEXT       = '#cdd6f4'; // text
const CLR_CANVAS_BG  = '#181825'; // mantle

export function initGame() {
  const canvas = document.getElementById('pongBoard');
  const ctx    = canvas.getContext('2d');
  const scoreboard   = new Scoreboard();
  const ghostSystem  = new GhostSystem();
  const powerUpSystem = new PowerUpSystem();
  const alienSystem  = new AlienSystem();

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
  let ballSpeed;             // current rally speed — ramps up per hit, resets each rally
  let rafId              = null;
  let lastTimestamp      = null;
  let paddleStunnedUntil = 0; // performance.now() timestamp; 0 = not stunned

  // ── Power-up effect state ───────────────────────────────────────────────
  let wideUntil    = 0;    // timestamp when wide-paddle expires; 0 = inactive
  let shieldActive = false; // absorbs the next stun
  // 'slow' is instantaneous (resets ballSpeed) so needs no persistent state

  // ── Bonus round state ───────────────────────────────────────────────────
  let isBonusRound = false;

  // ── Serve / ready state ─────────────────────────────────────────────────
  // 'ready': ball pulses at left end then drifts right; first paddle hit launches it
  // 'live' : normal play
  let ballState      = 'live';
  let ballReadySince = 0;

  initAudio();
  setupResizeObserver();
  setupControls();
  setupTouchControl();
  setupSoundToggle();
  setupStartScreen();

  // ── Responsive canvas ──────────────────────────────────────────────────

  function resizeCanvas() {
    const wrap  = document.getElementById('canvas-wrap');
    const style = getComputedStyle(wrap);

    // Use CSS padding to determine usable space — the touch control is fixed
    // and the canvas-wrap uses symmetric horizontal padding to centre the canvas.
    const availW = wrap.clientWidth
      - parseFloat(style.paddingLeft)
      - parseFloat(style.paddingRight);
    const availH = wrap.clientHeight
      - parseFloat(style.paddingTop)
      - parseFloat(style.paddingBottom);

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
      const relY  = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
      const newY  = relY * (VIRTUAL_H - paddle.h);
      // Capture swipe velocity (clamped) so fast swipes impart spin on the ball
      paddle.vy = Math.max(-gameSpeed * 2, Math.min(gameSpeed * 2, newY - paddle.y));
      paddle.y  = newY;
    }

    zone.addEventListener('touchstart', onTouch, { passive: true });
    zone.addEventListener('touchmove',  onTouch, { passive: true });
  }

  function updateTouchKnob() {
    const knob = document.getElementById('touch-knob');
    const zone = document.getElementById('touch-control');
    if (!knob || !zone || !paddle) return;
    if (getComputedStyle(zone).display === 'none') return;

    const zoneStyle = getComputedStyle(zone);
    const padTop    = parseFloat(zoneStyle.paddingTop);
    const padBot    = parseFloat(zoneStyle.paddingBottom);
    const knobH     = knob.offsetHeight;
    const trackH    = zone.offsetHeight - padTop - padBot;
    const relY      = paddle.y / (VIRTUAL_H - paddle.h);
    knob.style.top  = `${padTop + relY * (trackH - knobH)}px`;

    // Update ARIA value for assistive technology
    zone.setAttribute('aria-valuenow', Math.round(relY * 100));
  }

  function setupSoundToggle() {
    const soundtrack = document.getElementById('soundtrack');
    const btn        = document.getElementById('toggleSound');
    const STORAGE_KEY = 'pongTurbo.muted';

    // Restore saved preference before first user interaction
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

  // ── Game lifecycle ─────────────────────────────────────────────────────

  function startNewGame() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    score              = 0;
    lives              = INITIAL_LIVES;
    level              = 1;
    gameSpeed          = INITIAL_SPEED;
    ballSpeed          = INITIAL_SPEED;
    lastTimestamp      = null;
    paddleStunnedUntil = 0;
    wideUntil          = 0;
    shieldActive       = false;
    isBonusRound       = false;
    powerUpSystem.clear();

    paddle = new Paddle(
      VIRTUAL_W - 15,
      VIRTUAL_H / 2 - 20,
      10,
      60,
    );

    // Ball is created at a placeholder position; resetBall() sets the real state
    ball = new Ball(40, VIRTUAL_H / 2, 10, 10, 0, 0);
    ballState = 'live'; // resetBall will set to 'ready'
    resetBall();

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
    if (ballState === 'ready') {
      updateReadyBall(timeScale);
    } else {
      const ballResult = moveBall(timeScale);
      if (ballResult === 'out') {
        handleBallOut();
        return;
      }
    }

    // ── Power-up collection & movement (live ball only) ───────────────────
    if (ballState === 'live') {
      const collected = powerUpSystem.checkCollision(ball);
      if (collected) applyPowerUp(collected);
    }
    powerUpSystem.move(VIRTUAL_H, timeScale);

    // Expire wide paddle
    if (wideUntil > 0 && performance.now() > wideUntil) {
      wideUntil = 0;
      paddle.h  = PADDLE_BASE_H;
    }

    paddle.move(VIRTUAL_H, 1.2 * gameSpeed * timeScale);

    // ── Bonus round ───────────────────────────────────────────────────────
    if (isBonusRound) {
      alienSystem.move(VIRTUAL_H, timeScale);
      const alienScore = ballState === 'live' ? alienSystem.checkCollision(ball, level) : 0;
      if (alienScore > 0) {
        score += alienScore;
        scoreboard.updateScore(score);
        play('ghost');
      }
      // Formation reached the paddle — end round, no bonus, no life lost
      const aliensBreach = alienSystem.reachedX(paddle.x);
      if (alienSystem.allDead() || aliensBreach) {
        isBonusRound = false;
        level++;
        gameSpeed += 2;
        ballSpeed  = gameSpeed;
        if (alienSystem.allDead()) {
          score += BONUS_COMPLETION_SCORE * level;
          scoreboard.updateScore(score);
        }
        play('levelUp');
        ghostSystem.spawn();
      }
    } else if (ghostSystem.allDead()) {
      // ── Level complete ────────────────────────────────────────────────
      level++;
      gameSpeed += 2;
      ballSpeed  = gameSpeed;
      score     += level * 1000;
      scoreboard.updateScore(score);
      play('levelUp');
      if (level % 3 === 0) {
        isBonusRound = true;
        powerUpSystem.clear();
        alienSystem.spawn(VIRTUAL_H);
      } else {
        ghostSystem.spawn();
      }
    } else {
      ghostSystem.move(VIRTUAL_H, VIRTUAL_W, paddle.x, (gameSpeed / 4) * timeScale);

      // Ghost touching the paddle stuns it; shield absorbs the first stun
      if (ghostSystem.checkPaddleCollision(paddle)) {
        if (shieldActive) {
          shieldActive = false; // shield consumed
        } else if (paddleStunnedUntil < performance.now()) {
          paddleStunnedUntil = performance.now() + STUN_DURATION_MS;
        }
      }
    }

    draw();
  }

  function applyPowerUp(type) {
    switch (type) {
      case 'wide':
        wideUntil = performance.now() + WIDE_DURATION_MS;
        paddle.h  = PADDLE_BASE_H * WIDE_SCALE;
        break;
      case 'shield':
        shieldActive = true;
        break;
      case 'slow':
        ballSpeed = gameSpeed; // reset rally ramp to base level speed
        break;
    }
  }

  // ── Ball movement & collisions ─────────────────────────────────────────

  // ── Ready / serve state ────────────────────────────────────────────────

  function updateReadyBall(timeScale) {
    const age = performance.now() - ballReadySince;
    if (age > READY_PAUSE_MS) {
      ball.x += (gameSpeed / 2) * timeScale;
    }

    // Ball reached paddle zone — if player has it lined up, launch; otherwise
    // reset to the left so they can try again (no life lost).
    if (ball.x + ball.w >= paddle.x) {
      const overlapsY = ball.y + ball.h > paddle.y && ball.y < paddle.y + paddle.h;
      if (overlapsY) {
        launchBall();
      } else {
        ball.x         = 40;
        ballReadySince = performance.now();
      }
    }
  }

  function launchBall() {
    ballState = 'live';
    ball.dx   = -(gameSpeed / 2);
    ball.dy   = (Math.random() > 0.5 ? 1 : -1) * (gameSpeed / 2);
    ballSpeed = gameSpeed;
    play('paddle');
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
    } else {
      const killResult = ghostSystem.checkCollision(b);
      if (killResult) {
        const { count, cx, cy } = killResult;
        // Exponential multi-kill score: level × gameSpeed × count × 2^(count-1)
        score += level * gameSpeed * count * Math.pow(2, count - 1);
        scoreboard.updateScore(score);
        play('ghost');
        powerUpSystem.trySpawn(cx, cy, count);
      }
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

    // Stunned paddle: if currently in the low-opacity phase the ball passes
    // through — moveBall will then see the ball exit the right edge and call
    // handleBallOut() to lose a life.
    if (paddleStunnedUntil > performance.now()) {
      if (getPaddlePulseAlpha() < STUN_PASSTHROUGH_ALPHA) return false;
    }

    // Ramp ball speed each hit, capped RALLY_CAP units above the base level speed
    ballSpeed = Math.min(gameSpeed + RALLY_CAP, ballSpeed + RALLY_INCREMENT);

    const x = Math.max(
      ballSpeed / 2,
      Math.abs(Math.round(ballSpeed * Math.random())),
    );
    b.dy = b.dy < 0 ? -(ballSpeed - x) : (ballSpeed - x);
    b.dx = -x;

    // Paddle velocity imparts spin: moving paddle adds/subtracts from dy,
    // capped so the ball can't go faster than 1.5× the current rally speed.
    const spin  = Math.max(-ballSpeed * 0.6, Math.min(ballSpeed * 0.6, paddle.vy * SPIN_FACTOR));
    const maxDy = ballSpeed * 1.5;
    b.dy = Math.max(-maxDy, Math.min(maxDy, b.dy + spin));

    score += gameSpeed;
    scoreboard.updateScore(score);
    return true;
  }

  /** Returns 0…1 pulse alpha for the paddle while it is stunned (~3 Hz). */
  function getPaddlePulseAlpha() {
    return 0.55 + 0.45 * Math.sin(performance.now() * STUN_PULSE_ANGULAR_FREQ);
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
    ball.x         = 40;
    ball.y         = VIRTUAL_H / 2 - ball.h / 2;
    ball.dx        = 0;
    ball.dy        = 0;
    ballSpeed      = gameSpeed;
    ballState      = 'ready';
    ballReadySince = performance.now();
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

    // Ball — mauve with glow; pulses during ready/serve state
    const ballAlpha = ballState === 'ready'
      ? 0.25 + 0.75 * Math.abs(Math.sin((performance.now() - ballReadySince) * 0.005))
      : 1;
    ctx.globalAlpha = ballAlpha;
    ctx.shadowBlur  = 10 * drawScale;
    ctx.shadowColor = CLR_BALL;
    ctx.fillStyle   = CLR_BALL;
    ball.draw(ctx);
    ctx.globalAlpha = 1;

    // Paddle — lavender with glow; pulses when stunned by a ghost touch
    const paddleAlpha = paddleStunnedUntil > performance.now()
      ? getPaddlePulseAlpha()
      : 1;
    ctx.globalAlpha = paddleAlpha;
    ctx.shadowColor = CLR_PADDLE;
    ctx.fillStyle   = CLR_PADDLE;
    paddle.draw(ctx);
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 0;
    ghostSystem.draw(ctx, drawScale);

    // Power-ups
    powerUpSystem.draw(ctx, drawScale);

    // Bonus round aliens
    if (isBonusRound) {
      alienSystem.draw(ctx, drawScale);
    }

    // Shield glow around paddle when active
    if (shieldActive) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(performance.now() * 0.004));
      ctx.shadowBlur  = 16 * drawScale;
      ctx.shadowColor = '#89dceb';
      ctx.strokeStyle = '#89dceb';
      ctx.lineWidth   = 2;
      ctx.strokeRect(paddle.x - 3, paddle.y - 3, paddle.w + 6, paddle.h + 6);
      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;
    }

    ctx.restore();
  }
}
