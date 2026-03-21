import { PowerUp, TYPES } from '../entities/powerup.js';

const SINGLE_KILL_CHANCE = 0.15;

export class PowerUpSystem {
  #powerUps = [];

  /**
   * Conditionally spawn a power-up at (cx, cy).
   * Always spawns on 2+ simultaneous kills; 15% chance on a single kill.
   */
  trySpawn(cx, cy, killCount) {
    if (killCount < 2 && Math.random() >= SINGLE_KILL_CHANCE) return;
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    this.#powerUps.push(new PowerUp(cx, cy, type));
  }

  move(canvasH, timeScale) {
    for (let i = this.#powerUps.length - 1; i >= 0; i--) {
      const p = this.#powerUps[i];
      p.move(canvasH, timeScale);
      if (p.expired()) this.#powerUps.splice(i, 1);
    }
  }

  /** Returns the collected power-up type string, or null. */
  checkCollision(ball) {
    for (let i = 0; i < this.#powerUps.length; i++) {
      const p = this.#powerUps[i];
      if (
        ball.x + ball.w > p.x && ball.x < p.x + p.w &&
        ball.y + ball.h > p.y && ball.y < p.y + p.h
      ) {
        this.#powerUps.splice(i, 1);
        return p.type;
      }
    }
    return null;
  }

  draw(ctx, drawScale) {
    for (const p of this.#powerUps) p.draw(ctx, drawScale);
  }

  clear() {
    this.#powerUps = [];
  }
}
