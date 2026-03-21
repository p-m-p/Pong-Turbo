export const ALIEN_W = 28;
export const ALIEN_H = 22;

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

  hit() { this.#hp = Math.max(0, this.#hp - 1); }

  draw(ctx, drawScale) {
    const { x, y, w, h } = this;
    const cx    = x + w / 2;
    const alpha = 0.4 + 0.6 * (this.#hp / this.#maxHp);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur  = 8 * drawScale;
    ctx.shadowColor = this.#color;
    ctx.fillStyle   = this.#color;

    // All body shapes in one path — one shadow-blur fill instead of eight
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.32, w * 0.26, Math.PI, 0);           // dome
    ctx.rect(x + w * 0.2,  y + h * 0.3,  w * 0.6,  h * 0.45); // body
    ctx.rect(x + w * 0.14, y + h * 0.04, w * 0.09, h * 0.26);  // left antenna
    ctx.rect(x + w * 0.77, y + h * 0.04, w * 0.09, h * 0.26);  // right antenna
    ctx.rect(x + w * 0.08, y + h * 0.74, w * 0.16, h * 0.22);  // leg L1
    ctx.rect(x + w * 0.30, y + h * 0.78, w * 0.13, h * 0.22);  // leg L2
    ctx.rect(x + w * 0.57, y + h * 0.78, w * 0.13, h * 0.22);  // leg R1
    ctx.rect(x + w * 0.76, y + h * 0.74, w * 0.16, h * 0.22);  // leg R2
    ctx.fill();

    // Eyes — separate path, no shadow
    ctx.shadowBlur = 0;
    ctx.fillStyle  = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(cx - w * 0.1, y + h * 0.27, w * 0.065, 0, Math.PI * 2);
    ctx.arc(cx + w * 0.1, y + h * 0.27, w * 0.065, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
