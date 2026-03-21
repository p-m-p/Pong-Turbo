import { GameItem } from './gameItem.js';

// Ghosts roam freely in the left 45% of the canvas
const ROAM_BOUNDARY_RATIO = 0.45;
// Probability per frame that a roaming ghost starts a charge run
const CHARGE_PROB         = 0.001; // ~1 charge per ghost per ~33s; GhostSystem limits to 1 at a time
const CHARGE_SPEED_MULT   = 1.6;
const RETREAT_SPEED_MULT  = 1.4;
// Horizontal drift is a fraction of vertical speed so diagonals feel natural
const H_SPEED_RATIO       = 0.7;

export class Ghost extends GameItem {
  #color;
  #vx;      // horizontal direction: −1 left, +1 right
  #vy;      // vertical direction magnitude (−1…+1.2 for slight variation)
  #state;   // 'roaming' | 'charging' | 'retreating'
  #chargeX; // target left-edge X when charging (just in front of paddle)

  constructor(x, y, size, color) {
    super(x, y, size, size);
    this.#color   = color;
    this.#vx      = 1; // start moving right so ghosts spread out from spawn
    this.#vy      = Math.random() > 0.5 ? 1 : -1;
    this.#state   = 'roaming';
    this.#chargeX = 0;
  }

  get isCharging() {
    return this.#state === 'charging';
  }

  /** Called by GhostSystem when this ghost overlaps the paddle. */
  retreat() {
    this.#state = 'retreating';
    this.#vx    = -1;
  }

  /**
   * @param {number}  canvasH        - VIRTUAL_H
   * @param {number}  canvasW        - VIRTUAL_W
   * @param {number}  paddleX        - paddle's left edge X (virtual units)
   * @param {number}  speed          - pre-scaled speed (timeScale already applied)
   * @param {boolean} suppressCharge - true when another ghost is already charging
   */
  move(canvasH, canvasW, paddleX, speed, suppressCharge = false) {
    const roamBound = canvasW * ROAM_BOUNDARY_RATIO;

    // Top / bottom wall bounce applies in every state
    if (this.y <= 0)                    this.#vy = Math.abs(this.#vy);
    if (this.y + this.h >= canvasH)     this.#vy = -Math.abs(this.#vy);

    if (this.#state === 'roaming') {
      this.#stepRoaming(canvasH, roamBound, paddleX, speed, suppressCharge);
    } else if (this.#state === 'charging') {
      this.#stepCharging(canvasH, speed);
    } else {
      this.#stepRetreating(canvasH, roamBound, speed);
    }
  }

  #stepRoaming(canvasH, roamBound, paddleX, speed, suppressCharge) {
    // Bounce off left wall and roam boundary
    if (this.x <= 0)                          this.#vx = 1;
    if (this.x + this.w >= roamBound)         this.#vx = -1;

    // Small random nudge to vertical direction when bouncing off right limit,
    // keeping the movement from feeling mechanical
    if (this.x + this.w >= roamBound) {
      this.#vy += (Math.random() - 0.5) * 0.6;
      // Keep vy in a sensible range and never exactly zero
      this.#vy = Math.max(-1.2, Math.min(1.2, this.#vy));
      if (Math.abs(this.#vy) < 0.25) this.#vy = this.#vy >= 0 ? 0.25 : -0.25;
    }

    this.x += this.#vx * speed * H_SPEED_RATIO;
    this.y += this.#vy * speed;

    // Clamp within roam zone
    this.x = Math.max(0, Math.min(roamBound - this.w, this.x));
    this.y = Math.max(0, Math.min(canvasH - this.h, this.y));

    // Random lunge toward the paddle (one ghost at a time)
    if (!suppressCharge && Math.random() < CHARGE_PROB) {
      this.#state   = 'charging';
      this.#vx      = 1;
      // Stop with right edge just touching paddle's left face
      this.#chargeX = paddleX - this.w;
    }
  }

  #stepCharging(canvasH, speed) {
    this.x += speed * CHARGE_SPEED_MULT;
    this.y += this.#vy * speed;
    this.y   = Math.max(0, Math.min(canvasH - this.h, this.y));

    // Reached (or overshot) the paddle edge — begin retreat
    if (this.x >= this.#chargeX) {
      this.x = this.#chargeX;
      this.retreat();
    }
  }

  #stepRetreating(canvasH, roamBound, speed) {
    this.x -= speed * RETREAT_SPEED_MULT;
    this.y += this.#vy * speed;
    this.y   = Math.max(0, Math.min(canvasH - this.h, this.y));

    // Back inside the roam zone — resume normal diagonal movement
    if (this.x + this.w <= roamBound) {
      this.#state = 'roaming';
      // Randomise horizontal direction so re-entry feels natural
      this.#vx = Math.random() > 0.5 ? 1 : -1;
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
