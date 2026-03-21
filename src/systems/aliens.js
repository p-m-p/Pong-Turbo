import { Alien, ALIEN_W, ALIEN_H } from '../entities/alien.js';

const COLS      = 3;
const ROWS      = 6;
const H_GAP     = 16;  // horizontal gap between columns
const V_GAP     = 10;  // vertical gap between rows
const SPAWN_X   = 20;  // left edge of formation

// Formation height — used to clamp Y drift within the canvas
const FORM_H    = ROWS * ALIEN_H + (ROWS - 1) * V_GAP;  // 6*22 + 5*10 = 182

const ADVANCE_X = 0.22; // base rightward speed (virtual units × timeScale)
const DRIFT_Y   = 0.18; // vertical drift speed — bounces off top/bottom walls

const ALIEN_HP  = 2;

// Catppuccin Mocha accents — one per column
const COL_COLORS = ['#cba6f7', '#89dceb', '#a6e3a1'];

export class AlienSystem {
  #aliens      = [];
  #offsetX     = 0;
  #offsetY     = 0;
  #vy          = DRIFT_Y; // positive = moving down
  #startTime   = 0;
  #totalAliens = 0;

  get active() { return this.#aliens.length > 0; }

  spawn(canvasH = 400) {
    this.#aliens      = [];
    this.#offsetX     = 0;
    // Centre the formation vertically at spawn
    this.#offsetY     = (canvasH - FORM_H) / 2;
    this.#vy          = DRIFT_Y;
    this.#startTime   = performance.now();
    this.#totalAliens = COLS * ROWS;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x     = SPAWN_X + col * (ALIEN_W + H_GAP);
        const y     = row * (ALIEN_H + V_GAP);  // relative; offsetY shifts whole group
        const color = COL_COLORS[col % COL_COLORS.length];
        this.#aliens.push(new Alien(x, y, ALIEN_HP, color));
      }
    }
  }

  allDead() { return this.#aliens.length === 0; }

  /** True when the right edge of the formation has reached paddleX. */
  reachedX(paddleX) {
    if (this.#aliens.length === 0) return false;
    const formRight = SPAWN_X + COLS * (ALIEN_W + H_GAP) - H_GAP + this.#offsetX;
    return formRight >= paddleX;
  }

  move(canvasH, timeScale) {
    const alive     = this.#aliens.length;
    // Rightward speed ramps as aliens are killed
    const speedMult = 1 + (this.#totalAliens - alive) / this.#totalAliens;
    this.#offsetX  += ADVANCE_X * speedMult * timeScale;

    // Vertical drift with wall bounce (Space Invaders style)
    this.#offsetY  += this.#vy * timeScale;
    if (this.#offsetY <= 0)                        { this.#vy =  Math.abs(this.#vy); }
    if (this.#offsetY + FORM_H >= canvasH)         { this.#vy = -Math.abs(this.#vy); }
  }

  /**
   * Ball-blast style: ball bounces horizontally off aliens and damages them.
   * Returns total score earned this frame.
   */
  checkCollision(ball, level) {
    let score = 0;
    for (let i = this.#aliens.length - 1; i >= 0; i--) {
      const a  = this.#aliens[i];
      const ax = a.x + this.#offsetX;
      const ay = a.y + this.#offsetY;

      if (
        ball.x + ball.w > ax && ball.x < ax + a.w &&
        ball.y + ball.h > ay && ball.y < ay + a.h
      ) {
        ball.dx = -ball.dx;
        a.hit();
        if (a.dead) {
          score += 50 * level * a.maxHp;
          this.#aliens.splice(i, 1);
        }
      }
    }
    return score;
  }

  draw(ctx, drawScale) {
    if (this.#aliens.length === 0) return;
    ctx.save();
    ctx.translate(this.#offsetX, this.#offsetY);
    for (const a of this.#aliens) {
      a.draw(ctx, drawScale);
    }
    ctx.restore();
  }
}
