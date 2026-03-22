import { ALIEN_W, ALIEN_H } from '../constants.js';

export class Alien {
  #maxHp;
  #hp;
  #color;
  #type;

  constructor(x, y, hp, color, type) {
    this.x      = x;
    this.y      = y;
    this.w      = ALIEN_W;
    this.h      = ALIEN_H;
    this.#maxHp = hp;
    this.#hp    = hp;
    this.#color = color;
    this.#type  = type;
  }

  get hp()    { return this.#hp; }
  get maxHp() { return this.#maxHp; }
  get dead()  { return this.#hp <= 0; }
  get color() { return this.#color; }
  get type()  { return this.#type; }

  hit() { this.#hp = Math.max(0, this.#hp - 1); }
}
