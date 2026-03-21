import { GameItem } from './gameItem.js';

export class Paddle extends GameItem {
  constructor(x, y, w, h) {
    super(x, y, w, h);
    this.moveY = null;
  }

  move(canvasHeight, speed) {
    if (this.moveY === 'up') {
      this.y = Math.max(0, this.y - speed);
    } else if (this.moveY === 'down') {
      this.y = Math.min(canvasHeight - this.h, this.y + speed);
    }
  }
}
