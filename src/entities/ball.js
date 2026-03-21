import { GameItem } from './gameItem.js';

export class Ball extends GameItem {
  constructor(x, y, w, h, dx, dy) {
    super(x, y, w, h);
    this.dx = dx;
    this.dy = dy;
  }
}
