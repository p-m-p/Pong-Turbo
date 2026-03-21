import { GameItem } from './gameItem.js';

// Keyboard feel: reach full speed in ~5 frames, stop in ~3.5 frames
const ACCEL = 0.18;
const DECEL = 0.28;

export class Paddle extends GameItem {
  constructor(x, y, w, h) {
    super(x, y, w, h);
    this.moveY    = null;
    this.velocity = 0;  // keyboard throttle: −1 (full up) to +1 (full down)
    this.vy       = 0;  // actual virtual-unit movement last frame (used for ball spin)
  }

  move(canvasHeight, baseSpeed) {
    const prevY = this.y;

    if (this.moveY === 'up' || this.moveY === 'down') {
      // Ramp velocity toward the held direction
      const dir     = this.moveY === 'up' ? -1 : 1;
      this.velocity = Math.max(-1, Math.min(1, this.velocity + dir * ACCEL));
      this.y        = Math.max(0, Math.min(canvasHeight - this.h, this.y + this.velocity * baseSpeed));
      this.vy       = this.y - prevY;
    } else {
      // Decelerate — also handles residual momentum after key release
      const abs     = Math.abs(this.velocity);
      this.velocity = abs <= DECEL ? 0 : this.velocity - Math.sign(this.velocity) * DECEL;

      if (this.velocity !== 0) {
        this.y  = Math.max(0, Math.min(canvasHeight - this.h, this.y + this.velocity * baseSpeed));
      }

      // Decay vy: covers key-release residual and touch settling between events
      this.vy *= 0.7;
      if (Math.abs(this.vy) < 0.1) this.vy = 0;
    }
  }
}
