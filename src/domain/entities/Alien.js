import { ALIEN_W, ALIEN_H } from '../constants.js';

export class Alien {
  #maxHp;
  #hp;
  #color;

  constructor(x, y, hp, color) {
    this.x      = x;
    this.y      = y;
    this.w      = ALIEN_W;
    this.h      = ALIEN_H;
    this.#maxHp = hp;
    this.#hp    = hp;
    this.#color = color;
  }

  get hp()    { return this.#hp; }
  get maxHp() { return this.#maxHp; }
  get dead()  { return this.#hp <= 0; }
  get color() { return this.#color; }

  hit() { this.#hp = Math.max(0, this.#hp - 1); }
}
