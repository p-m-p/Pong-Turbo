import { Ghost }         from '../entities/Ghost.js';
import { aabb }          from '../physics/collision.js';
import {
  GHOST_SIZE,
  GHOST_COUNT,
  VIRTUAL_H,
  VIRTUAL_W,
} from '../constants.js';

// Pac-Man ghost colours
const GHOST_COLOURS = [
  '#ff0000', // Blinky  — red
  '#ffb8ff', // Pinky   — pink
  '#00ffff', // Inky    — cyan
  '#ffb827', // Clyde   — orange
  '#ffffff', // bonus   — white
];

export class GhostSystem {
  #ghosts = [];

  spawn(count = GHOST_COUNT) {
    this.#ghosts = [];
    for (let i = 0; i < count; i++) {
      const colour = GHOST_COLOURS[i % GHOST_COLOURS.length];
      this.#ghosts.push(new Ghost(30, i * 80, GHOST_SIZE, colour));
    }
  }

  get ghosts() { return this.#ghosts; }

  allDead() { return this.#ghosts.length === 0; }

  /**
   * @param {number} canvasH  - virtual height
   * @param {number} canvasW  - virtual width
   * @param {number} paddleX  - paddle's left edge X
   * @param {number} speed    - pre-scaled speed (timeScale already applied)
   */
  move(canvasH, canvasW, paddleX, speed) {
    let chargingCount = this.#ghosts.filter(g => g.isCharging).length;

    for (const ghost of this.#ghosts) {
      const wasCharging = ghost.isCharging;
      ghost.move(canvasH, canvasW, paddleX, speed, chargingCount > 0);
      if (!wasCharging && ghost.isCharging) chargingCount++;
    }
  }

  /**
   * Returns true if any ghost overlaps the paddle; retreats that ghost.
   * @param {{ x,y,w,h }} paddle
   * @returns {boolean}
   */
  checkPaddleCollision(paddle) {
    for (const ghost of this.#ghosts) {
      if (aabb(ghost, paddle)) {
        ghost.retreat();
        return true;
      }
    }
    return false;
  }

  /**
   * Checks all ghosts for AABB hits with the ball.
   * Removes killed ghosts and returns { count, cx, cy }, or null if no hit.
   * @param {{ x,y,w,h }} ball
   * @returns {{ count: number, cx: number, cy: number }|null}
   */
  checkCollision(ball) {
    const killed = [];
    for (let i = this.#ghosts.length - 1; i >= 0; i--) {
      if (aabb(ball, this.#ghosts[i])) {
        killed.push(this.#ghosts[i]);
        this.#ghosts.splice(i, 1);
      }
    }
    if (killed.length === 0) return null;
    const cx = killed.reduce((s, g) => s + g.x + g.w / 2, 0) / killed.length;
    const cy = killed.reduce((s, g) => s + g.y + g.h / 2, 0) / killed.length;
    return { count: killed.length, cx, cy };
  }
}
