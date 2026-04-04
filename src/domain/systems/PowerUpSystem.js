import { PowerUp, TYPES } from '../entities/PowerUp.js';
import { aabb } from '../physics/collision.js';
import { POWERUP_SINGLE_CHANCE, POWERUP_LIFE_CHANCE } from '../constants.js';

export class PowerUpSystem {
  #powerUps = [];

  get powerUps() {
    return this.#powerUps;
  }

  /**
   * Conditionally spawn a power-up at (cx, cy).
   * Always spawns on 2+ simultaneous kills; SINGLE_CHANCE% on a single kill.
   * When lives ≤ 2 there is a LIFE_CHANCE probability the drop is 'life'.
   *
   * @param {number} cx
   * @param {number} cy
   * @param {number} killCount
   * @param {number} now    - current timestamp (injected so tests can control timing)
   * @param {number} lives  - current player lives (default Infinity — no life drops)
   */
  trySpawn(cx, cy, killCount, now, lives = Infinity) {
    if (killCount < 2 && Math.random() >= POWERUP_SINGLE_CHANCE) return;
    const type =
      lives <= 2 && Math.random() < POWERUP_LIFE_CHANCE
        ? 'life'
        : TYPES[Math.floor(Math.random() * TYPES.length)];
    this.#powerUps.push(new PowerUp(cx, cy, type, now));
  }

  /**
   * @param {number} canvasH
   * @param {number} timeScale
   * @param {number} now
   */
  move(canvasH, timeScale, now) {
    for (let i = this.#powerUps.length - 1; i >= 0; i--) {
      const p = this.#powerUps[i];
      p.move(canvasH, timeScale);
      if (p.expired(now)) this.#powerUps.splice(i, 1);
    }
  }

  /**
   * Returns the collected power-up type string, or null.
   * @param {{ x,y,w,h }} ball
   * @param {number}       now
   * @returns {string|null}
   */
  checkCollision(ball, now) {
    for (let i = 0; i < this.#powerUps.length; i++) {
      const p = this.#powerUps[i];
      if (p.isLive(now) && aabb(ball, p)) {
        this.#powerUps.splice(i, 1);
        return p.type;
      }
    }
    return null;
  }

  clear() {
    this.#powerUps = [];
  }
}
