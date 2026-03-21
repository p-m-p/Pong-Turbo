import { Ghost } from '../entities/ghost.js';

const GHOST_SIZE = 32;
const DEFAULT_COUNT = 5;

export class GhostSystem {
  #ghosts = [];

  spawn(count = DEFAULT_COUNT) {
    this.#ghosts = [];
    for (let i = 0; i < count; i++) {
      this.#ghosts.push(new Ghost(30, i * 80, GHOST_SIZE));
    }
  }

  allDead() {
    return this.#ghosts.length === 0;
  }

  move(canvasHeight, speed) {
    for (const ghost of this.#ghosts) {
      ghost.move(canvasHeight, speed);
    }
  }

  draw(ctx) {
    for (const ghost of this.#ghosts) {
      ghost.draw(ctx);
    }
  }

  // Returns true and removes ghost on AABB hit, false otherwise
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
