import { GameItem } from './gameItem.js';

const ghostImage = new Image();
ghostImage.src = 'images/ghost.png';

export class Ghost extends GameItem {
  constructor(x, y, size) {
    super(x, y, size, size);
    this.direction = 'down';
  }

  move(canvasHeight, speed) {
    if (this.direction === 'down') {
      if (this.y + this.h + speed <= canvasHeight) {
        this.y += speed;
      } else {
        this.direction = 'up';
      }
    } else {
      if (this.y - speed >= 0) {
        this.y -= speed;
      } else {
        this.direction = 'down';
      }
    }
  }

  draw(ctx) {
    ctx.drawImage(ghostImage, this.x, this.y);
  }
}
