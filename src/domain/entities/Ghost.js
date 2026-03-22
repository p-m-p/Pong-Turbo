import {
  GHOST_ROAM_RATIO,
  GHOST_CHARGE_PROB,
  GHOST_CHARGE_SPEED,
  GHOST_RETREAT_SPEED,
  GHOST_H_SPEED_RATIO,
} from '../constants.js';

export class Ghost {
  #color;
  #vx;
  #vy;
  #state;
  #chargeX;

  constructor(x, y, size, color) {
    this.x       = x;
    this.y       = y;
    this.w       = size;
    this.h       = size;
    this.#color  = color;
    this.#vx     = 1;
    this.#vy     = Math.random() > 0.5 ? 1 : -1;
    this.#state  = 'roaming';
    this.#chargeX = 0;
  }

  get color()      { return this.#color; }
  get state()      { return this.#state; }
  get isCharging() { return this.#state === 'charging'; }

  retreat() {
    this.#state = 'retreating';
    this.#vx    = -1;
  }

  move(canvasH, canvasW, paddleX, speed, suppressCharge = false) {
    const roamBound = canvasW * GHOST_ROAM_RATIO;

    if (this.y <= 0)               this.#vy =  Math.abs(this.#vy);
    if (this.y + this.h >= canvasH) this.#vy = -Math.abs(this.#vy);

    if (this.#state === 'roaming') {
      this.#stepRoaming(canvasH, roamBound, paddleX, speed, suppressCharge);
    } else if (this.#state === 'charging') {
      this.#stepCharging(canvasH, speed);
    } else {
      this.#stepRetreating(canvasH, roamBound, speed);
    }
  }

  #stepRoaming(canvasH, roamBound, paddleX, speed, suppressCharge) {
    if (this.x <= 0)                  this.#vx = 1;
    if (this.x + this.w >= roamBound) this.#vx = -1;

    if (this.x + this.w >= roamBound) {
      this.#vy += (Math.random() - 0.5) * 0.6;
      this.#vy  = Math.max(-1.2, Math.min(1.2, this.#vy));
      if (Math.abs(this.#vy) < 0.25) this.#vy = this.#vy >= 0 ? 0.25 : -0.25;
    }

    this.x += this.#vx * speed * GHOST_H_SPEED_RATIO;
    this.y += this.#vy * speed;
    this.x  = Math.max(0, Math.min(roamBound - this.w, this.x));
    this.y  = Math.max(0, Math.min(canvasH - this.h, this.y));

    if (!suppressCharge && Math.random() < GHOST_CHARGE_PROB) {
      this.#state   = 'charging';
      this.#vx      = 1;
      this.#chargeX = paddleX - this.w + 4;
    }
  }

  #stepCharging(canvasH, speed) {
    this.x += speed * GHOST_CHARGE_SPEED;
    this.y += this.#vy * speed;
    this.y  = Math.max(0, Math.min(canvasH - this.h, this.y));

    if (this.x >= this.#chargeX) {
      this.x = this.#chargeX;
      this.retreat();
    }
  }

  #stepRetreating(canvasH, roamBound, speed) {
    this.x -= speed * GHOST_RETREAT_SPEED;
    this.y += this.#vy * speed;
    this.y  = Math.max(0, Math.min(canvasH - this.h, this.y));

    if (this.x + this.w <= roamBound) {
      this.#state = 'roaming';
      this.#vx    = Math.random() > 0.5 ? 1 : -1;
    }
  }
}
