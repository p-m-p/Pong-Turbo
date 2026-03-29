import { Alien } from '../entities/Alien.js';
import {
  ALIEN_COLS,
  ALIEN_ROWS,
  ALIEN_W,
  ALIEN_H,
  ALIEN_H_GAP,
  ALIEN_V_GAP,
  ALIEN_SPAWN_X,
  ALIEN_HP,
  ALIEN_VERT_SPEED,
  ALIEN_ADVANCE_X,
  ALIEN_FORM_H,
  VIRTUAL_H,
} from '../constants.js';

// Alien type and colour per column — mirrors Space Invaders' row distribution:
//   col 0     → squid  (cyan)   — 1 col, like SI's 1 squid row
//   cols 1-2  → crab   (yellow) — 2 cols, like SI's 2 crab rows
//   cols 3-4  → drone  (green)  — 2 cols, like SI's 2 octopus rows
const COL_TIERS = [
  { type: 'squid', color: '#00ffff' }, // col 0
  { type: 'crab',  color: '#ffff00' }, // col 1
  { type: 'crab',  color: '#ffff00' }, // col 2
  { type: 'drone', color: '#00ff00' }, // col 3
  { type: 'drone', color: '#00ff00' }, // col 4
];

export class AlienSystem {
  #aliens      = [];
  #offsetX     = 0;
  #offsetY     = 0;
  #vy          = ALIEN_VERT_SPEED;
  #totalAliens = 0;

  get active()  { return this.#aliens.length > 0; }
  get aliens()  { return this.#aliens; }
  get offsetX() { return this.#offsetX; }
  get offsetY() { return this.#offsetY; }

  spawn(canvasH = VIRTUAL_H) {
    this.#aliens      = [];
    this.#offsetX     = 0;
    this.#offsetY     = (canvasH - ALIEN_FORM_H) / 2;
    this.#vy          = ALIEN_VERT_SPEED;
    this.#totalAliens = ALIEN_COLS * ALIEN_ROWS;

    for (let row = 0; row < ALIEN_ROWS; row++) {
      for (let col = 0; col < ALIEN_COLS; col++) {
        const x     = ALIEN_SPAWN_X + col * (ALIEN_W + ALIEN_H_GAP);
        const y     = row * (ALIEN_H + ALIEN_V_GAP);
        const { type, color } = COL_TIERS[col];
        this.#aliens.push(new Alien(x, y, ALIEN_HP, color, type));
      }
    }
  }

  allDead() { return this.#aliens.length === 0; }

  /** True when the right edge of the formation has reached paddleX. */
  reachedX(paddleX) {
    if (this.#aliens.length === 0) return false;
    const formRight = ALIEN_SPAWN_X + ALIEN_COLS * (ALIEN_W + ALIEN_H_GAP) - ALIEN_H_GAP + this.#offsetX;
    return formRight >= paddleX;
  }

  move(canvasH, timeScale) {
    const alive     = this.#aliens.length;
    const speedMult = 1 + (this.#totalAliens - alive) / this.#totalAliens;

    // speedMult only on horizontal advance — vertical stays smooth
    this.#offsetX += ALIEN_ADVANCE_X * speedMult * timeScale;
    this.#offsetY += this.#vy * timeScale;

    // Reflect overshoot instead of hard-clamping (eliminates positional snap)
    if (this.#offsetY < 0) {
      this.#offsetY = -this.#offsetY;
      this.#vy      =  Math.abs(this.#vy);
    }
    if (this.#offsetY + ALIEN_FORM_H > canvasH) {
      this.#offsetY = 2 * (canvasH - ALIEN_FORM_H) - this.#offsetY;
      this.#vy      = -Math.abs(this.#vy);
    }
  }

  /**
   * Ball bounces horizontally off aliens and damages them.
   * Returns the number of aliens killed this frame (caller calculates score).
   * @param {{ x,y,w,h,dx,dy }} ball
   * @returns {number}
   */
  checkCollision(ball) {
    let killed = 0;
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
          this.#aliens.splice(i, 1);
          killed++;
        }
      }
    }
    return killed;
  }
}
