import { VIRTUAL_W, VIRTUAL_H } from '../../domain/constants.js';

// Catppuccin Mocha
const CLR_BALL      = '#cba6f7'; // mauve
const CLR_PADDLE    = '#b4befe'; // lavender
const CLR_TEXT      = '#cdd6f4'; // text
const CLR_SHIELD    = '#89dceb'; // sky

const ASPECT_RATIO = VIRTUAL_W / VIRTUAL_H; // 3:2
const MAX_PHYS_W   = 1200;
const MAX_PHYS_H   = 800;

export class CanvasRenderAdapter {
  #canvas;
  #ctx;
  #drawScale = 1;
  #dpr       = 1;

  init() {
    this.#canvas = document.getElementById('pongBoard');
    this.#ctx    = this.#canvas.getContext('2d');
    this.#dpr    = window.devicePixelRatio || 1;

    const wrap = document.getElementById('canvas-wrap');
    const ro   = new ResizeObserver(() => this.#resize());
    ro.observe(wrap);
    this.#resize();
  }

  get drawScale() { return this.#drawScale; }

  #resize() {
    const wrap  = document.getElementById('canvas-wrap');
    const style = getComputedStyle(wrap);

    const availW = wrap.clientWidth
      - parseFloat(style.paddingLeft)
      - parseFloat(style.paddingRight);
    const availH = wrap.clientHeight
      - parseFloat(style.paddingTop)
      - parseFloat(style.paddingBottom);

    let physW, physH;
    if (availW / availH > ASPECT_RATIO) {
      physH = Math.min(availH, MAX_PHYS_H);
      physW = physH * ASPECT_RATIO;
    } else {
      physW = Math.min(availW, MAX_PHYS_W);
      physH = physW / ASPECT_RATIO;
    }

    this.#dpr = window.devicePixelRatio || 1;
    this.#canvas.width  = Math.round(physW * this.#dpr);
    this.#canvas.height = Math.round(physH * this.#dpr);
    this.#canvas.style.width  = `${physW}px`;
    this.#canvas.style.height = `${physH}px`;
    this.#drawScale = physW / VIRTUAL_W;
  }

  /**
   * @param {import('../../domain/GameLoop.js')} snapshot
   */
  drawFrame(snapshot) {
    const ctx = this.#ctx;
    const s   = this.#drawScale;
    const dpr = this.#dpr;
    const now = snapshot.now;

    ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    ctx.save();
    ctx.scale(s * dpr, s * dpr);

    this.#drawBall(ctx, snapshot, s, now);
    this.#drawPaddle(ctx, snapshot, s, now);
    this.#drawGhosts(ctx, snapshot, s);
    this.#drawPowerUps(ctx, snapshot, s, now);
    if (snapshot.isBonusRound) this.#drawAliens(ctx, snapshot);
    if (snapshot.shieldActive) this.#drawShield(ctx, snapshot, s, now);

    ctx.restore();

    this.#updateTouchKnob(snapshot);
  }

  drawGameOver() {
    const ctx = this.#ctx;
    const s   = this.#drawScale;
    const dpr = this.#dpr;

    ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    ctx.save();
    ctx.scale(s * dpr, s * dpr);
    ctx.fillStyle    = CLR_TEXT;
    ctx.font         = `bold 16px 'Play', sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur   = 12 * s;
    ctx.shadowColor  = CLR_BALL;
    ctx.fillText('Game over  ·  press Enter to play again', VIRTUAL_W / 2, VIRTUAL_H / 2);
    ctx.restore();
  }

  // ── Draw helpers ───────────────────────────────────────────────────────

  #drawBall(ctx, { ball, ballState, ballReadySince }, s, now) {
    const alpha = ballState === 'ready'
      ? 0.25 + 0.75 * Math.abs(Math.sin((now - ballReadySince) * 0.005))
      : 1;
    ctx.globalAlpha = alpha;
    ctx.shadowBlur  = 10 * s;
    ctx.shadowColor = CLR_BALL;
    ctx.fillStyle   = CLR_BALL;
    ctx.fillRect(ball.x, ball.y, ball.w, ball.h);
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  #drawPaddle(ctx, { paddle, paddleStunnedUntil }, s, now) {
    const stunned = paddleStunnedUntil > now;
    const alpha   = stunned
      ? 0.55 + 0.45 * Math.sin(now * 0.019)
      : 1;
    ctx.globalAlpha = alpha;
    ctx.shadowBlur  = 10 * s;
    ctx.shadowColor = CLR_PADDLE;
    ctx.fillStyle   = CLR_PADDLE;
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  #drawGhosts(ctx, { ghosts }, s) {
    for (const g of ghosts) {
      ctx.save();
      ctx.globalAlpha = g.state === 'retreating' ? 0.5 : 1;
      this.#drawGhostShape(ctx, g, s);
      ctx.restore();
    }
  }

  #drawGhostShape(ctx, { x, y, w, h, color }, s) {
    const cx       = x + w / 2;
    const domeR    = w / 2;
    const domeBaseY = y + domeR;
    const skirtY   = y + h * 0.76;

    // Glow
    ctx.shadowBlur  = 14 * s;
    ctx.shadowColor = color;

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, domeBaseY, domeR, Math.PI, 0);
    ctx.lineTo(x + w, skirtY);
    ctx.quadraticCurveTo(x + w * (5 / 6), y + h, x + w * (2 / 3), skirtY);
    ctx.quadraticCurveTo(x + w * (1 / 2), y + h, x + w * (1 / 3), skirtY);
    ctx.quadraticCurveTo(x + w * (1 / 6), y + h, x,                skirtY);
    ctx.lineTo(x, domeBaseY);
    ctx.closePath();
    ctx.fill();

    // Dome highlight
    ctx.shadowBlur = 0;
    const hl = ctx.createRadialGradient(
      cx - domeR * 0.2, y + domeR * 0.3, domeR * 0.05,
      cx,               y + domeR,        domeR,
    );
    hl.addColorStop(0, 'rgba(255,255,255,0.28)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.beginPath();
    ctx.arc(cx, domeBaseY, domeR, Math.PI, 0);
    ctx.lineTo(x + w, skirtY);
    ctx.quadraticCurveTo(x + w * (5 / 6), y + h, x + w * (2 / 3), skirtY);
    ctx.quadraticCurveTo(x + w * (1 / 2), y + h, x + w * (1 / 3), skirtY);
    ctx.quadraticCurveTo(x + w * (1 / 6), y + h, x,                skirtY);
    ctx.lineTo(x, domeBaseY);
    ctx.closePath();
    ctx.fill();

    // Eyes
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
  }

  #drawPowerUps(ctx, { powerUps }, s, now) {
    for (const p of powerUps) {
      const age     = now - p.born;
      const grace   = 2000;
      const warning = 7000;

      let alpha;
      if (age < grace) {
        const t = age / grace;
        alpha = t * (0.4 + 0.6 * Math.abs(Math.sin(age * 0.012)));
      } else if (age > warning) {
        const t = (age - warning) / (10000 - warning);
        alpha = 0.3 + 0.7 * Math.abs(Math.sin(age * (0.008 + t * 0.016)));
      } else {
        alpha = 1;
      }

      const color = p.type === 'wide'   ? '#a6e3a1'
                  : p.type === 'shield' ? '#89dceb'
                  :                       '#f9e2af';

      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur  = 12 * s;
      ctx.shadowColor = color;
      ctx.fillStyle   = color;
      ctx.beginPath();
      ctx.arc(cx, cy, p.w / 2, 0, Math.PI * 2);
      ctx.fill();

      // Symbol
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = '#1e1e2e';
      ctx.lineWidth   = 1.5;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';

      switch (p.type) {
        case 'wide':
          ctx.beginPath(); ctx.moveTo(cx - 5.5, cy); ctx.lineTo(cx + 5.5, cy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx - 3, cy - 2.5); ctx.lineTo(cx - 6, cy); ctx.lineTo(cx - 3, cy + 2.5); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx + 3, cy - 2.5); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx + 3, cy + 2.5); ctx.stroke();
          break;
        case 'shield':
          ctx.beginPath();
          ctx.moveTo(cx,     cy - 5.5);
          ctx.lineTo(cx + 4, cy);
          ctx.lineTo(cx,     cy + 5.5);
          ctx.lineTo(cx - 4, cy);
          ctx.closePath();
          ctx.stroke();
          break;
        case 'slow':
          ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 3); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 2.2, cy); ctx.stroke();
          break;
      }

      ctx.restore();
    }
  }

  #drawAliens(ctx, { aliens, alienOffsetX, alienOffsetY }) {
    ctx.save();
    ctx.translate(alienOffsetX, alienOffsetY);
    for (const a of aliens) {
      const t = a.hp / a.maxHp;
      ctx.globalAlpha = 0.4 + 0.6 * t;
      ctx.fillStyle   = a.color;
      ctx.fillRect(a.x, a.y, a.w, a.h);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  #drawShield(ctx, { paddle }, s, now) {
    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(now * 0.004));
    ctx.shadowBlur  = 16 * s;
    ctx.shadowColor = CLR_SHIELD;
    ctx.strokeStyle = CLR_SHIELD;
    ctx.lineWidth   = 2;
    ctx.strokeRect(paddle.x - 3, paddle.y - 3, paddle.w + 6, paddle.h + 6);
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  #updateTouchKnob({ paddle }) {
    const knob = document.getElementById('touch-knob');
    const zone = document.getElementById('touch-control');
    if (!knob || !zone || !paddle) return;
    if (getComputedStyle(zone).display === 'none') return;

    const zoneStyle = getComputedStyle(zone);
    const padTop    = parseFloat(zoneStyle.paddingTop);
    const padBot    = parseFloat(zoneStyle.paddingBottom);
    const knobH     = knob.offsetHeight;
    const trackH    = zone.offsetHeight - padTop - padBot;
    const relY      = paddle.y / (VIRTUAL_H - paddle.h);
    knob.style.top  = `${padTop + relY * (trackH - knobH)}px`;
    zone.setAttribute('aria-valuenow', Math.round(relY * 100));
  }
}
