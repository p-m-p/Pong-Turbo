import { Ghost } from '../entities/ghost.js';

const GHOST_SIZE    = 32;
const DEFAULT_COUNT = 5;

// Catppuccin Mocha accent colours — all read well against the dark base
const GHOST_COLOURS = [
  '#cba6f7', // mauve
  '#f5c2e7', // pink
  '#89dceb', // sky
  '#a6e3a1', // green
  '#f9e2af', // yellow
];

export class GhostSystem {
  #ghosts = [];

  spawn(count = DEFAULT_COUNT) {
    this.#ghosts = [];
    for (let i = 0; i < count; i++) {
      const colour = GHOST_COLOURS[i % GHOST_COLOURS.length];
      this.#ghosts.push(new Ghost(30, i * 80, GHOST_SIZE, colour));
    }
  }

  allDead() {
    return this.#ghosts.length === 0;
  }

  /**
   * @param {number} canvasH  - VIRTUAL_H
   * @param {number} canvasW  - VIRTUAL_W
   * @param {number} paddleX  - paddle's left edge X (virtual units)
   * @param {number} speed    - pre-scaled speed (timeScale already applied)
   */
  move(canvasH, canvasW, paddleX, speed) {
    // Only allow one ghost to charge at a time so the player isn't overwhelmed
    let chargingCount = this.#ghosts.filter(g => g.isCharging).length;

    for (const ghost of this.#ghosts) {
      const wasCharging = ghost.isCharging;
      ghost.move(canvasH, canvasW, paddleX, speed, chargingCount > 0);
      // If this ghost just started charging, count it so later ghosts in
      // the loop are suppressed this frame too
      if (!wasCharging && ghost.isCharging) chargingCount++;
    }
  }

  draw(ctx, drawScale) {
    for (const ghost of this.#ghosts) {
      ghost.draw(ctx, drawScale);
    }
  }

  /**
   * Checks whether any ghost overlaps the paddle (AABB).
   * If so, forces that ghost to retreat and returns true.
   * Game code should apply a paddle stun on true.
   */
  checkPaddleCollision(paddle) {
    for (const ghost of this.#ghosts) {
      const overlapsX = ghost.x + ghost.w > paddle.x && ghost.x < paddle.x + paddle.w;
      const overlapsY = ghost.y + ghost.h > paddle.y && ghost.y < paddle.y + paddle.h;
      if (overlapsX && overlapsY) {
        ghost.retreat();
        return true;
      }
    }
    return false;
  }

  // Returns true and removes ghost on AABB hit with the ball, false otherwise
  checkCollision(ball) {
    for (let i = 0; i < this.#ghosts.length; i++) {
      const g = this.#ghosts[i];
      if (
        ball.x + ball.w > g.x &&
        ball.x < g.x + g.w &&
        ball.y + ball.h > g.y &&
        ball.y < g.y + g.h
      ) {
        this.#ghosts.splice(i, 1);
        return true;
      }
    }
    return false;
  }
}
