import { createBall }    from './entities/Ball.js';
import { createPaddle }  from './entities/Paddle.js';
import { GhostSystem }   from './systems/GhostSystem.js';
import { AlienSystem }   from './systems/AlienSystem.js';
import { PowerUpSystem } from './systems/PowerUpSystem.js';
import { moveBall, launchBall, checkPaddleHit, updateReadyBall } from './physics/ball.js';
import { movePaddle }    from './physics/paddle.js';
import {
  ghostKillScore,
  alienKillScore,
  rallyScore,
  levelClearScore,
  bonusClearScore,
} from './systems/ScoringRules.js';
import {
  VIRTUAL_W,
  VIRTUAL_H,
  INITIAL_SPEED,
  INITIAL_LIVES,
  TARGET_FRAME_MS,
  MAX_FRAME_MS,
  BALL_SIZE,
  PADDLE_X,
  PADDLE_BASE_H,
  PADDLE_W,
  STUN_DURATION_MS,
  WIDE_DURATION_MS,
  WIDE_SCALE,
} from './constants.js';

/**
 * Pure game-loop engine.  No DOM, no performance.now(), no requestAnimationFrame.
 * Accepts four port adapters (render, audio, input, score) at construction time.
 *
 * @param {import('../ports/RenderPort.js').RenderPort} render
 * @param {import('../ports/AudioPort.js').AudioPort}   audio
 * @param {import('../ports/InputPort.js').InputPort}   input
 * @param {import('../ports/ScorePort.js').ScorePort}   score
 */
export class GameLoop {
  // ── Adapters ────────────────────────────────────────────────────────────
  #render;
  #audio;
  #input;
  #scorePort;

  // ── Systems ─────────────────────────────────────────────────────────────
  #ghostSystem;
  #alienSystem;
  #powerUpSystem;

  // ── Field dimensions ────────────────────────────────────────────────────
  #fieldW = VIRTUAL_W;

  // ── Per-game state ──────────────────────────────────────────────────────
  #ball;
  #paddle;
  #score       = 0;
  #lives       = 0;
  #level       = 1;
  #gameSpeed   = INITIAL_SPEED;
  #ballSpeed   = INITIAL_SPEED;

  // ── Ball serve state ────────────────────────────────────────────────────
  #ballState      = 'live'; // 'ready' | 'live'
  #ballReadySince = 0;

  // ── Stun / power-up state ───────────────────────────────────────────────
  #paddleStunnedUntil = 0;
  #wideUntil          = 0;
  #shieldActive       = false;
  #isBonusRound       = false;

  constructor(render, audio, input, score) {
    this.#render       = render;
    this.#audio        = audio;
    this.#input        = input;
    this.#scorePort    = score;
    this.#ghostSystem  = new GhostSystem();
    this.#alienSystem  = new AlienSystem();
    this.#powerUpSystem = new PowerUpSystem();
  }

  /** Set the virtual field width before starting a new game. */
  setFieldW(w) { this.#fieldW = w; }

  /** Getters expose state to tests without mutation risk */
  get lives()       { return this.#lives; }
  get scoreValue()  { return this.#score; }
  get level()       { return this.#level; }
  get gameSpeed()   { return this.#gameSpeed; }
  get ballState()   { return this.#ballState; }
  get isBonusRound(){ return this.#isBonusRound; }
  get ball()        { return this.#ball; }
  get paddle()      { return this.#paddle; }

  // ── Game lifecycle ───────────────────────────────────────────────────────

  startNewGame(now) {
    this.#score              = 0;
    this.#lives              = INITIAL_LIVES;
    this.#level              = 1;
    this.#gameSpeed          = INITIAL_SPEED;
    this.#ballSpeed          = INITIAL_SPEED;
    this.#paddleStunnedUntil = 0;
    this.#wideUntil          = 0;
    this.#shieldActive       = false;
    this.#isBonusRound       = false;
    this.#powerUpSystem.clear();

    this.#paddle = createPaddle(
      this.#fieldW - 15,
      VIRTUAL_H / 2 - PADDLE_BASE_H / 2,
      PADDLE_W,
      PADDLE_BASE_H,
    );

    this.#ball    = createBall(40, VIRTUAL_H / 2, BALL_SIZE, BALL_SIZE, 0, 0);
    this.#ballState = 'live'; // resetBall sets 'ready'
    this.#resetBall(now);

    this.#scorePort.reset(INITIAL_LIVES);
    this.#ghostSystem.spawn();
  }

  /**
   * Process one game tick.
   * @param {number} now        - current time (ms, monotonic, caller-controlled)
   * @param {number} timeScale  - elapsed / TARGET_FRAME_MS (1.0 = normal 30fps)
   * @returns {'playing'|'gameover'}
   */
  tick(now, timeScale, input) {
    input = input ?? this.#input.read();

    // ── Apply input to paddle ──────────────────────────────────────────────
    this.#applyInput(input, now);

    // ── Ball movement ─────────────────────────────────────────────────────
    if (this.#ballState === 'ready') {
      const readyResult = updateReadyBall(
        this.#ball,
        this.#paddle,
        this.#gameSpeed,
        this.#ballReadySince,
        now,
        timeScale,
      );
      if (readyResult === 'launched') {
        this.#ballState  = 'live';
        this.#ballSpeed  = this.#gameSpeed;
        launchBall(this.#ball, this.#gameSpeed);
        this.#audio.play('paddle');
      } else if (readyResult === 'reset') {
        this.#ballReadySince = now;
      }
    } else {
      const moveResult = moveBall(this.#ball, timeScale, this.#fieldW);
      if (moveResult === 'out') {
        return this.#handleBallOut(now);
      }
      this.#handleLiveBallCollisions(now, timeScale);
    }

    // ── Power-up movement & expiry ────────────────────────────────────────
    if (this.#ballState === 'live') {
      const collected = this.#powerUpSystem.checkCollision(this.#ball, now);
      if (collected) this.#applyPowerUp(collected, now);
    }
    this.#powerUpSystem.move(VIRTUAL_H, timeScale, now);

    // Expire wide paddle
    if (this.#wideUntil > 0 && now > this.#wideUntil) {
      this.#wideUntil  = 0;
      this.#paddle.h   = PADDLE_BASE_H;
    }

    // ── Paddle movement ───────────────────────────────────────────────────
    movePaddle(this.#paddle, VIRTUAL_H, 1.2 * this.#gameSpeed * timeScale);

    // ── Bonus / normal round logic ────────────────────────────────────────
    if (this.#isBonusRound) {
      this.#tickBonusRound(now, timeScale);
    } else if (this.#ghostSystem.allDead()) {
      this.#onLevelClear(now);
    } else {
      this.#tickNormalRound(now, timeScale);
    }

    // ── Render ────────────────────────────────────────────────────────────
    this.#render.drawFrame(this.#buildSnapshot(now));

    return 'playing';
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  #applyInput(input, now) {
    if (input.paddleAbsoluteY !== null) {
      const newY     = Math.max(0, Math.min(VIRTUAL_H - this.#paddle.h, input.paddleAbsoluteY));
      this.#paddle.vy = Math.max(-this.#gameSpeed * 2, Math.min(this.#gameSpeed * 2, newY - this.#paddle.y));
      this.#paddle.y  = newY;
    } else {
      this.#paddle.moveY = input.paddleDirection;
    }
  }

  #handleLiveBallCollisions(now, timeScale) {
    // Paddle hit
    const hitResult = checkPaddleHit(
      this.#ball,
      this.#paddle,
      this.#gameSpeed,
      this.#ballSpeed,
      this.#paddleStunnedUntil,
      now,
    );
    if (hitResult) {
      this.#ballSpeed = hitResult.ballSpeed;
      this.#score    += rallyScore(this.#gameSpeed);
      this.#score_update();
      this.#audio.play('paddle');
      return;
    }

    // Ghost kills
    const killResult = this.#ghostSystem.checkCollision(this.#ball);
    if (killResult) {
      const { count, cx, cy } = killResult;
      this.#score += ghostKillScore(this.#level, this.#gameSpeed, count);
      this.#score_update();
      this.#audio.play('ghost');
      this.#powerUpSystem.trySpawn(cx, cy, count, now);
    }
  }

  #tickNormalRound(now, timeScale) {
    this.#ghostSystem.move(VIRTUAL_H, this.#fieldW, this.#paddle.x, (this.#gameSpeed / 4) * timeScale);

    if (this.#ghostSystem.checkPaddleCollision(this.#paddle)) {
      if (this.#shieldActive) {
        this.#shieldActive = false;
      } else if (this.#paddleStunnedUntil < now) {
        this.#paddleStunnedUntil = now + STUN_DURATION_MS;
      }
    }
  }

  #tickBonusRound(now, timeScale) {
    this.#alienSystem.move(VIRTUAL_H, timeScale);
    if (this.#ballState === 'live') {
      const killed = this.#alienSystem.checkCollision(this.#ball);
      if (killed > 0) {
        this.#score += alienKillScore(this.#level, this.#gameSpeed, killed);
        this.#score_update();
        this.#audio.play('ghost');
      }
    }

    if (this.#alienSystem.allDead() || this.#alienSystem.reachedX(this.#paddle.x)) {
      if (this.#alienSystem.allDead()) {
        this.#score += bonusClearScore(this.#level);
        this.#score_update();
      }
      this.#isBonusRound = false;
      this.#advanceLevel();
    }
  }

  #onLevelClear(now) {
    this.#score += levelClearScore(this.#level);
    this.#score_update();
    this.#audio.play('levelUp');
    this.#level++;
    this.#gameSpeed += 2;
    this.#ballSpeed  = this.#gameSpeed;

    if (this.#level % 3 === 0) {
      this.#isBonusRound = true;
      this.#powerUpSystem.clear();
      this.#alienSystem.spawn(VIRTUAL_H);
    } else {
      this.#ghostSystem.spawn();
    }
  }

  #advanceLevel() {
    this.#audio.play('levelUp');
    this.#level++;
    this.#gameSpeed += 2;
    this.#ballSpeed  = this.#gameSpeed;
    this.#ghostSystem.spawn();
  }

  #applyPowerUp(type, now) {
    switch (type) {
      case 'wide':
        this.#wideUntil = now + WIDE_DURATION_MS;
        this.#paddle.h  = PADDLE_BASE_H * WIDE_SCALE;
        break;
      case 'shield':
        this.#shieldActive = true;
        break;
      case 'slow':
        this.#ballSpeed = this.#gameSpeed;
        break;
    }
  }

  #handleBallOut(now) {
    this.#lives--;
    this.#scorePort.updateLives(this.#lives);
    if (this.#lives <= 0) {
      this.#render.drawFrame(this.#buildSnapshot(now));
      return 'gameover';
    }
    this.#audio.play('roundEnd');
    this.#resetBall(now);
    return 'playing';
  }

  #resetBall(now) {
    this.#ball.x         = 40;
    this.#ball.y         = VIRTUAL_H / 2 - this.#ball.h / 2;
    this.#ball.dx        = 0;
    this.#ball.dy        = 0;
    this.#ballSpeed      = this.#gameSpeed;
    this.#ballState      = 'ready';
    this.#ballReadySince = now;
  }

  #score_update() {
    this.#scorePort.updateScore(this.#score);
  }

  /** Build a plain snapshot passed to the render adapter. */
  #buildSnapshot(now) {
    return {
      ball:          { ...this.#ball },
      paddle:        { ...this.#paddle },
      ghosts:        this.#ghostSystem.ghosts.map(g => ({
        x: g.x, y: g.y, w: g.w, h: g.h, color: g.color, state: g.state, vx: g.vx, vy: g.vy,
      })),
      powerUps:      this.#powerUpSystem.powerUps.map(p => ({
        x: p.x, y: p.y, w: p.w, h: p.h, type: p.type, born: p.born,
      })),
      aliens:        this.#alienSystem.aliens.map(a => ({
        x: a.x, y: a.y, w: a.w, h: a.h, color: a.color, type: a.type, hp: a.hp, maxHp: a.maxHp,
      })),
      alienOffsetX:  this.#alienSystem.offsetX,
      alienOffsetY:  this.#alienSystem.offsetY,
      ballState:     this.#ballState,
      ballReadySince: this.#ballReadySince,
      paddleStunnedUntil: this.#paddleStunnedUntil,
      shieldActive:  this.#shieldActive,
      isBonusRound:  this.#isBonusRound,
      now,
    };
  }
}
