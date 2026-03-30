import {
  POWERUP_LIFESPAN_MS,
  POWERUP_GRACE_MS,
  POWERUP_ORB_RADIUS,
  POWERUP_ROAM_RIGHT,
} from '../constants.js';

export const TYPES = ['wide', 'shield'];

export class PowerUp {
  #type;
  #born;
  #vx;
  #vy;

  /**
   * @param {number} x     - centre x of the spawn point
   * @param {number} y     - centre y of the spawn point
   * @param {string} type  - 'wide' | 'shield' | 'slow'
   * @param {number} born  - timestamp (caller passes performance.now() or test value)
   */
  constructor(x, y, type, born) {
    this.x = x - POWERUP_ORB_RADIUS;
    this.y = y - POWERUP_ORB_RADIUS;
    this.w = POWERUP_ORB_RADIUS * 2;
    this.h = POWERUP_ORB_RADIUS * 2;
    this.#type = type;
    this.#born = born;
    this.#vx = (Math.random() - 0.5) * 0.6;
    this.#vy = (Math.random() - 0.5) * 0.8;
  }

  get type() {
    return this.#type;
  }
  get born() {
    return this.#born;
  }

  /** Collectable once the 2s grace window has passed. */
  isLive(now) {
    return now - this.#born >= POWERUP_GRACE_MS;
  }

  /** True when the 10s lifespan has elapsed. */
  expired(now) {
    return now - this.#born >= POWERUP_LIFESPAN_MS;
  }

  move(canvasH, timeScale) {
    this.x += this.#vx * timeScale;
    this.y += this.#vy * timeScale;
    if (this.x <= 0) {
      this.#vx = Math.abs(this.#vx);
    }
    if (this.x + this.w >= POWERUP_ROAM_RIGHT) {
      this.#vx = -Math.abs(this.#vx);
    }
    if (this.y <= 0) {
      this.#vy = Math.abs(this.#vy);
    }
    if (this.y + this.h >= canvasH) {
      this.#vy = -Math.abs(this.#vy);
    }
  }
}
