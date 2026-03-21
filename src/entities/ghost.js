import { GameItem } from './gameItem.js';

export class Ghost extends GameItem {
  #color;

  constructor(x, y, size, color) {
    super(x, y, size, size);
    this.direction = 'down';
    this.#color = color;
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

  // drawScale is the virtual→physical pixel ratio, needed because shadowBlur
  // is always in physical pixels and is not affected by ctx.scale().
  draw(ctx, drawScale = 1) {
    const { x, y, w, h } = this;
    const cx = x + w / 2;
    const domeR = w / 2;
    const domeBaseY = y + domeR;
    const skirtY = y + h * 0.76;

    ctx.save();

    // ── Glow ──────────────────────────────────────────────────────────────
    ctx.shadowBlur = 14 * drawScale;
    ctx.shadowColor = this.#color;

    // ── Body ──────────────────────────────────────────────────────────────
    ctx.fillStyle = this.#color;
    ctx.beginPath();
    ctx.arc(cx, domeBaseY, domeR, Math.PI, 0);
    ctx.lineTo(x + w, skirtY);
    ctx.quadraticCurveTo(x + w * (5 / 6), y + h, x + w * (2 / 3), skirtY);
    ctx.quadraticCurveTo(x + w * (1 / 2), y + h, x + w * (1 / 3), skirtY);
    ctx.quadraticCurveTo(x + w * (1 / 6), y + h, x,                skirtY);
    ctx.lineTo(x, domeBaseY);
    ctx.closePath();
    ctx.fill();

    // ── Dome highlight ─────────────────────────────────────────────────────
    ctx.shadowBlur = 0;
    const highlight = ctx.createRadialGradient(
      cx - domeR * 0.2, y + domeR * 0.3, domeR * 0.05,
      cx,               y + domeR,        domeR,
    );
    highlight.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.arc(cx, domeBaseY, domeR, Math.PI, 0);
    ctx.lineTo(x + w, skirtY);
    ctx.quadraticCurveTo(x + w * (5 / 6), y + h, x + w * (2 / 3), skirtY);
    ctx.quadraticCurveTo(x + w * (1 / 2), y + h, x + w * (1 / 3), skirtY);
    ctx.quadraticCurveTo(x + w * (1 / 6), y + h, x,                skirtY);
    ctx.lineTo(x, domeBaseY);
    ctx.closePath();
    ctx.fill();

    // ── Eyes ──────────────────────────────────────────────────────────────
    const eyeY    = y + h * 0.40;
    const eyeR    = w * 0.11;
    const pupilR  = w * 0.060;
    const leftEX  = x + w * 0.30;
    const rightEX = x + w * 0.70;

    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(leftEX,  eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(rightEX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0d0d1a';
    ctx.beginPath();
    ctx.arc(leftEX  + w * 0.03, eyeY + eyeR * 0.2, pupilR, 0, Math.PI * 2);
    ctx.arc(rightEX - w * 0.03, eyeY + eyeR * 0.2, pupilR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
