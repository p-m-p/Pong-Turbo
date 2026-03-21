export const TYPES = ['wide', 'shield', 'slow'];

const LIFESPAN_MS = 10_000;
const WARN_AT_MS  = 7_000;   // pulse warning starts 3s before expiry
const ORB_RADIUS  = 10;      // virtual units
const ROAM_RIGHT  = 280;     // right boundary — keeps orbs in the ghost zone

const COLOR = {
  wide:   '#a6e3a1', // green
  shield: '#89dceb', // sky
  slow:   '#f9e2af', // yellow
};

export class PowerUp {
  #type;
  #born;
  #vx;
  #vy;

  constructor(x, y, type) {
    this.x     = x - ORB_RADIUS;
    this.y     = y - ORB_RADIUS;
    this.w     = ORB_RADIUS * 2;
    this.h     = ORB_RADIUS * 2;
    this.#type = type;
    this.#born = performance.now();
    this.#vx   = (Math.random() - 0.5) * 0.6; // gentle random horizontal drift
    this.#vy   = (Math.random() - 0.5) * 0.8;
  }

  get type()  { return this.#type; }
  expired()   { return performance.now() - this.#born >= LIFESPAN_MS; }

  move(canvasH, timeScale) {
    this.x += this.#vx * timeScale;
    this.y += this.#vy * timeScale;
    // Bounce inside the ghost roam zone so orbs stay visible and collectable
    if (this.x <= 0)                    { this.#vx =  Math.abs(this.#vx); }
    if (this.x + this.w >= ROAM_RIGHT)  { this.#vx = -Math.abs(this.#vx); }
    if (this.y <= 0)                    { this.#vy =  Math.abs(this.#vy); }
    if (this.y + this.h >= canvasH)     { this.#vy = -Math.abs(this.#vy); }
  }

  draw(ctx, drawScale) {
    const age   = performance.now() - this.#born;
    let   alpha = 1;
    if (age > WARN_AT_MS) {
      const t = (age - WARN_AT_MS) / (LIFESPAN_MS - WARN_AT_MS); // 0→1
      alpha = 0.3 + 0.7 * Math.abs(Math.sin(age * (0.008 + t * 0.016)));
    }

    const cx    = this.x + this.w / 2;
    const cy    = this.y + this.h / 2;
    const color = COLOR[this.#type];

    ctx.save();
    ctx.globalAlpha = alpha;

    // Glow + orb
    ctx.shadowBlur  = 12 * drawScale;
    ctx.shadowColor = color;
    ctx.fillStyle   = color;
    ctx.beginPath();
    ctx.arc(cx, cy, ORB_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Symbol drawn dark against the orb
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth   = 1.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    switch (this.#type) {
      case 'wide': {
        // ↔ horizontal bar with outward arrowheads
        ctx.beginPath(); ctx.moveTo(cx - 5.5, cy); ctx.lineTo(cx + 5.5, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 3, cy - 2.5); ctx.lineTo(cx - 6, cy); ctx.lineTo(cx - 3, cy + 2.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 3, cy - 2.5); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx + 3, cy + 2.5); ctx.stroke();
        break;
      }
      case 'shield': {
        // Diamond
        ctx.beginPath();
        ctx.moveTo(cx,     cy - 5.5);
        ctx.lineTo(cx + 4, cy);
        ctx.lineTo(cx,     cy + 5.5);
        ctx.lineTo(cx - 4, cy);
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'slow': {
        // Clock face
        ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 3); ctx.stroke(); // minute
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 2.2, cy); ctx.stroke(); // hour
        break;
      }
    }

    ctx.restore();
  }
}
