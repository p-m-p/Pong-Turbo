import {
  VIRTUAL_W, VIRTUAL_H, TARGET_FRAME_MS,
  POWERUP_GRACE_MS, POWERUP_WARN_AT_MS, POWERUP_LIFESPAN_MS,
  STUN_PULSE_ANGULAR_FREQ,
} from '../../domain/constants.js';

// ── 8-bit colour palette ────────────────────────────────────────────────────
const CLR_BALL   = '#ffffff'; // white (original Pong)
const CLR_PADDLE = '#ffffff'; // white
const CLR_TEXT   = '#ffffff';
const CLR_SHIELD = '#00ffff'; // cyan

const MAX_PHYS_W  = 1200;
const MAX_PHYS_H  = 800;
const MAX_ASPECT  = 1.6;

const FADE_DURATION_MS     = 500;
const PARTICLE_DURATION_MS = 800;
const PARTICLE_SPEED_MS    = 1 / TARGET_FRAME_MS;
const PARTICLE_GRAV_MS2    = 0.04 / (TARGET_FRAME_MS * TARGET_FRAME_MS);

// ── Pixel-art bitmaps ───────────────────────────────────────────────────────
// Values: 0=transparent, 1=body colour, 2=white, 3=dark (black)

// Ghost — 8×8 grid, pixel = size/8 (4px at GHOST_SIZE=32)
// Rows 3-4 are the eyes; pupils (3) shift left/right based on travel direction.
const GHOST_TOP = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1],
];
const GHOST_BOT = [
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
  [1,0,1,1,0,1,1,0], // bumpy skirt
];

// Aliens — 9×7 grid, pixel = 3px (fits in 27×21, centred in 28×22)
// Drone — rightmost columns (green), octopus-like
const DRONE_ROWS = [
  [0,0,1,1,0,1,1,0,0],
  [0,1,1,1,1,1,1,1,0],
  [1,1,0,1,1,1,0,1,1],
  [1,1,1,1,1,1,1,1,1],
  [1,0,1,1,1,1,1,0,1],
  [0,1,0,0,0,0,0,1,0],
  [0,1,0,0,0,0,0,1,0],
];

// Crab — middle rows (yellow), crab-like
const CRAB_ROWS = [
  [1,0,1,0,0,0,1,0,1],
  [0,1,1,1,1,1,1,1,0],
  [1,1,0,1,0,1,0,1,1],
  [1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,0],
  [0,0,1,0,0,0,1,0,0],
  [0,1,0,0,0,0,0,1,0],
];

// Squid — bottom rows (green), squid-like
const SQUID_ROWS = [
  [0,0,0,1,1,1,0,0,0],
  [0,1,1,1,1,1,1,1,0],
  [1,1,0,1,1,1,0,1,1],
  [1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,0],
  [0,1,0,0,0,0,0,1,0],
  [1,0,0,0,0,0,0,0,1],
];

// Mothership — 13×5 grid, pixel = 4px (52×20 = MOTHERSHIP_W×MOTHERSHIP_H)
// 2 = dark window
const MOTHERSHIP_ROWS = [
  [0,0,0,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,2,1,2,1,2,1,2,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,0,1,0,1,0,1,0,1,0,1,0],
];

/** Draw a pixel-art bitmap at (x, y) with the given pixel size. */
function drawBitmap(ctx, rows, x, y, px, bodyColor, white = '#ffffff', dark = '#000000') {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (v === 0) continue;
      ctx.fillStyle = v === 1 ? bodyColor : v === 2 ? white : dark;
      ctx.fillRect(x + c * px, y + r * px, px, px);
    }
  }
}

export class CanvasRenderAdapter {
  #canvas;
  #wrap;
  #knob;
  #zone;
  #ctx;
  #scale    = 1;
  #virtualW = VIRTUAL_W;
  #dpr      = 1;

  // ── Particle system ────────────────────────────────────────────────────
  #particles    = [];

  // ── Kill-event detection ───────────────────────────────────────────────
  #prevGhostCount  = 0;
  #prevGhosts      = [];
  #prevAlienCount  = 0;
  #prevAliens      = [];
  #prevMotherShip  = null;

  // ── Level-fade transition ──────────────────────────────────────────────
  #prevLevel    = 1;
  #fadeAlpha    = 1;
  #fadeStartAt  = -1;

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement}       wrap
   * @param {HTMLElement|null}  knob
   * @param {HTMLElement|null}  zone
   */
  constructor(canvas, wrap, knob = null, zone = null) {
    this.#canvas = canvas;
    this.#wrap   = wrap;
    this.#knob   = knob;
    this.#zone   = zone;
  }

  init() {
    this.#ctx = this.#canvas.getContext('2d');
    this.#dpr = window.devicePixelRatio || 1;

    const ro = new ResizeObserver(() => this.#resize());
    ro.observe(this.#wrap);
    this.#resize();
  }

  get drawScale() { return this.#scale; }
  get virtualW()  { return this.#virtualW; }

  #resize() {
    const wrap  = this.#wrap;
    const style = getComputedStyle(wrap);

    const availW = wrap.clientWidth
      - Number.parseFloat(style.paddingLeft)
      - Number.parseFloat(style.paddingRight);
    const availH = wrap.clientHeight
      - Number.parseFloat(style.paddingTop)
      - Number.parseFloat(style.paddingBottom);

    const physH = Math.min(Math.max(availH, 1), MAX_PHYS_H);
    const physW = Math.min(Math.max(availW, 1), MAX_PHYS_W, physH * MAX_ASPECT);

    this.#dpr     = window.devicePixelRatio || 1;
    this.#scale   = physH / VIRTUAL_H;
    this.#virtualW = physW / this.#scale;

    this.#canvas.width  = Math.round(physW * this.#dpr);
    this.#canvas.height = Math.round(physH * this.#dpr);
    this.#canvas.style.width  = `${physW}px`;
    this.#canvas.style.height = `${physH}px`;
  }

  /**
   * @param {import('../../domain/GameLoop.js')} snapshot
   */
  drawFrame(snapshot) {
    const ctx = this.#ctx;
    const s   = this.#scale;
    const dpr = this.#dpr;
    const now = snapshot.now;

    this.#detectKillsAndSpawnParticles(snapshot);
    this.#tickLevelFade(snapshot);

    ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    ctx.save();
    ctx.scale(s * dpr, s * dpr);
    ctx.imageSmoothingEnabled = false;

    // Black fill (belt-and-braces behind CSS background)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.#virtualW, VIRTUAL_H);

    this.#drawBall(ctx, snapshot, now);
    this.#drawPaddle(ctx, snapshot, now);
    this.#drawGhosts(ctx, snapshot);
    this.#drawPowerUps(ctx, snapshot, now);
    if (snapshot.isBonusRound) {
      this.#drawAliens(ctx, snapshot);
      if (snapshot.motherShip) this.#drawMotherShip(ctx, snapshot.motherShip);
      if (snapshot.motherShipLasers?.length) this.#drawLasers(ctx, snapshot.motherShipLasers);
    }
    if (snapshot.shieldActive) this.#drawShield(ctx, snapshot, now);

    this.#tickAndDrawParticles(ctx, now);

    ctx.restore();

    this.#saveFrameState(snapshot);
    this.#updateTouchKnob(snapshot);
  }

  drawGameOver() {
    const ctx = this.#ctx;
    const s   = this.#scale;
    const dpr = this.#dpr;

    ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    ctx.save();
    ctx.scale(s * dpr, s * dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.#virtualW, VIRTUAL_H);
    ctx.fillStyle    = CLR_TEXT;
    ctx.font         = `11px 'Press Start 2P', monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', this.#virtualW / 2, VIRTUAL_H / 2 - 10);
    ctx.font = `7px 'Press Start 2P', monospace`;
    ctx.fillStyle = '#888888';
    ctx.fillText('PRESS ENTER TO PLAY AGAIN', this.#virtualW / 2, VIRTUAL_H / 2 + 10);
    ctx.restore();
  }

  // ── Draw helpers ───────────────────────────────────────────────────────

  #drawBall(ctx, { ball, ballState, ballReadySince }, now) {
    const alpha = ballState === 'ready'
      ? 0.25 + 0.75 * Math.abs(Math.sin((now - ballReadySince) * 0.005))
      : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = CLR_BALL;
    ctx.fillRect(ball.x, ball.y, ball.w, ball.h);
    ctx.globalAlpha = 1;
  }

  #drawPaddle(ctx, { paddle, paddleStunnedUntil }, now) {
    const stunned = paddleStunnedUntil > now;
    const alpha   = stunned
      ? 0.55 + 0.45 * Math.sin(now * STUN_PULSE_ANGULAR_FREQ)
      : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = CLR_PADDLE;
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.globalAlpha = 1;
  }

  #drawGhosts(ctx, { ghosts }) {
    for (const g of ghosts) {
      ctx.globalAlpha = (g.state === 'retreating' ? 0.5 : 1) * this.#fadeAlpha;
      this.#drawPixelGhost(ctx, g);
      ctx.globalAlpha = 1;
    }
  }

  #drawPixelGhost(ctx, { x, y, w, color, vx = 1, vy = 0 }) {
    const px = Math.max(1, Math.floor(w / 8));
    const gx = Math.round(x);
    const gy = Math.round(y);

    // Top dome + body
    drawBitmap(ctx, GHOST_TOP, gx, gy, px, color);

    // Eye rows — each eye occupies cols 2-3 (left) and 6-7 (right).
    // Pupils sit in the corner of the 2×2 eye that points toward travel direction:
    //   vy < 0 → top row of eye;  vy >= 0 → bottom row
    //   vx < 0 → left col of eye; vx >= 0 → right col
    const pupilRow = vy < 0 ? 0 : 1;   // 0 = top eye-row, 1 = bottom eye-row
    const pupilCol = vx < 0 ? 0 : 1;   // 0 = left eye-col, 1 = right eye-col

    const eyeRow1 = [1,1,2,2,1,1,2,2]; // both eyes white
    const eyeRow2 = [1,1,2,2,1,1,2,2];
    const targetRow = pupilRow === 0 ? eyeRow1 : eyeRow2;
    targetRow[2 + pupilCol] = 3; // left eye pupil
    targetRow[6 + pupilCol] = 3; // right eye pupil

    const eyeY = gy + GHOST_TOP.length * px;
    drawBitmap(ctx, [eyeRow1], gx, eyeY,          px, color);
    drawBitmap(ctx, [eyeRow2], gx, eyeY + px,     px, color);

    // Lower body + skirt
    drawBitmap(ctx, GHOST_BOT, gx, eyeY + 2 * px, px, color);
  }

  #drawPowerUps(ctx, { powerUps }, now) {
    for (const p of powerUps) {
      const age = now - p.born;

      let alpha;
      if (age < POWERUP_GRACE_MS) {
        const t = age / POWERUP_GRACE_MS;
        alpha = t * (0.4 + 0.6 * Math.abs(Math.sin(age * 0.012)));
      } else if (age > POWERUP_WARN_AT_MS) {
        const t = (age - POWERUP_WARN_AT_MS) / (POWERUP_LIFESPAN_MS - POWERUP_WARN_AT_MS);
        alpha = 0.3 + 0.7 * Math.abs(Math.sin(age * (0.008 + t * 0.016)));
      } else {
        alpha = 1;
      }

      const color = p.type === 'wide'   ? '#00ff00'
                  : p.type === 'shield' ? '#00ffff'
                  : p.type === 'life'   ? '#ff00ff'
                  :                       '#ffff00';

      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const r  = p.w / 2;

      ctx.save();
      ctx.globalAlpha = alpha;

      // 8-bit style: draw as a diamond (rotated square)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx,     cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx,     cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();

      // Symbol — hard lines, no shadow
      ctx.strokeStyle = '#000000';
      ctx.lineWidth   = 1.5;
      ctx.lineCap     = 'square';
      ctx.lineJoin    = 'miter';

      switch (p.type) {
        case 'wide': {
          ctx.beginPath(); ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx - 3, cy - 2.5); ctx.lineTo(cx - 6, cy); ctx.lineTo(cx - 3, cy + 2.5); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx + 3, cy - 2.5); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx + 3, cy + 2.5); ctx.stroke();
          break;
        }
        case 'shield': {
          ctx.beginPath();
          ctx.moveTo(cx,     cy - 5);
          ctx.lineTo(cx + 4, cy);
          ctx.lineTo(cx,     cy + 5);
          ctx.lineTo(cx - 4, cy);
          ctx.closePath();
          ctx.stroke();
          break;
        }
        case 'life': {
          // "+" symbol — classic retro health pickup
          ctx.beginPath(); ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy); ctx.stroke();
          break;
        }
      }

      ctx.restore();
    }
  }

  #drawAliens(ctx, { aliens, alienOffsetX, alienOffsetY }) {
    ctx.save();
    ctx.translate(alienOffsetX, alienOffsetY);
    for (const a of aliens) {
      ctx.globalAlpha = (0.4 + 0.6 * (a.hp / a.maxHp)) * this.#fadeAlpha;
      const rows = a.type === 'drone' ? DRONE_ROWS
                 : a.type === 'crab'  ? CRAB_ROWS
                 :                      SQUID_ROWS;
      const px   = 3;
      const offX = Math.round((a.w - rows[0].length * px) / 2);
      const offY = Math.round((a.h - rows.length * px) / 2);
      drawBitmap(ctx, rows, a.x + offX, a.y + offY, px, a.color);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  #drawMotherShip(ctx, ms) {
    const CLR  = '#ff0000';
    const { x, y } = ms;
    const px   = 4;                        // 13×4=52=MOTHERSHIP_W, 5×4=20=MOTHERSHIP_H
    const alpha = this.#fadeAlpha;

    ctx.save();
    ctx.globalAlpha = alpha;
    drawBitmap(ctx, MOTHERSHIP_ROWS, x, y, px, CLR, CLR, '#000000');

    // HP bar above mothership
    const barY   = y - 5;
    const hpFrac = ms.hp / ms.maxHp;
    const barClr = hpFrac > 2 / 3 ? '#00ff00'
                 : hpFrac > 1 / 3 ? '#ffff00'
                 :                  '#ff0000';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#333333';
    ctx.fillRect(x, barY, ms.w, 3);
    ctx.fillStyle = barClr;
    ctx.fillRect(x, barY, ms.w * hpFrac, 3);

    ctx.restore();
  }

  #drawLasers(ctx, lasers) {
    ctx.fillStyle = '#ff0000';
    for (const l of lasers) ctx.fillRect(l.x, l.y, l.w, l.h);
  }

  #drawShield(ctx, { paddle }, now) {
    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(now * 0.004));
    ctx.strokeStyle = CLR_SHIELD;
    ctx.lineWidth   = 2;
    ctx.strokeRect(paddle.x - 3, paddle.y - 3, paddle.w + 6, paddle.h + 6);
    ctx.globalAlpha = 1;
  }

  // ── Particle & transition helpers ─────────────────────────────────────

  #detectKillsAndSpawnParticles(snapshot) {
    const { ghosts, aliens, ball, motherShip, isBonusRound, now } = snapshot;
    const bx = ball.x + ball.w / 2;
    const by = ball.y + ball.h / 2;

    // Ghost kills
    const ghostKills = this.#prevGhostCount - ghosts.length;
    if (ghostKills > 0) {
      const remaining = [...this.#prevGhosts];
      for (let k = 0; k < ghostKills; k++) {
        let closest = remaining[0];
        let bestD = Infinity;
        let bestIndex = 0;
        for (let i = 0; i < remaining.length; i++) {
          const g = remaining[i];
          const d = (g.x + g.w / 2 - bx) ** 2 + (g.y + g.h / 2 - by) ** 2;
          if (d < bestD) { bestD = d; closest = g; bestIndex = i; }
        }
        if (closest) {
          this.#spawnBurst(bx, by, closest.color, 8, now);
          remaining.splice(bestIndex, 1);
        }
      }
    }

    // Alien kills
    if (isBonusRound) {
      const alienKills = this.#prevAlienCount - aliens.length;
      if (alienKills > 0) {
        const oX = snapshot.alienOffsetX;
        const oY = snapshot.alienOffsetY;
        const remaining = [...this.#prevAliens];
        for (let k = 0; k < alienKills; k++) {
          let closest = remaining[0];
          let bestD = Infinity;
          let bestIndex = 0;
          for (let i = 0; i < remaining.length; i++) {
            const a = remaining[i];
            const wx = a.x + oX + a.w / 2;
            const wy = a.y + oY + a.h / 2;
            const d  = (wx - bx) ** 2 + (wy - by) ** 2;
            if (d < bestD) { bestD = d; closest = a; bestIndex = i; }
          }
          if (closest) {
            this.#spawnBurst(bx, by, closest.color, 8, now);
            remaining.splice(bestIndex, 1);
          }
        }
      }
    }

    // Mothership kill
    if (this.#prevMotherShip && !motherShip) {
      const ms = this.#prevMotherShip;
      this.#spawnBurst(ms.x + ms.w / 2, ms.y + ms.h / 2, '#ff0000', 20, now);
    }
  }

  #spawnBurst(cx, cy, color, count, now) {
    for (let i = 0; i < count; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const spdPxF = 1.5 + Math.random() * 2.5;
      const spd    = spdPxF * PARTICLE_SPEED_MS;
      this.#particles.push({
        x0:   cx,
        y0:   cy,
        vx:   Math.cos(angle) * spd,
        vy:   Math.sin(angle) * spd,
        color,
        born: now,
        size: Math.random() < 0.5 ? 2 : 3,
      });
    }
  }

  #tickAndDrawParticles(ctx, now) {
    for (let i = this.#particles.length - 1; i >= 0; i--) {
      const p   = this.#particles[i];
      const age = now - p.born;
      if (age >= PARTICLE_DURATION_MS) { this.#particles.splice(i, 1); continue; }

      const x     = p.x0 + p.vx * age;
      const y     = p.y0 + p.vy * age + 0.5 * PARTICLE_GRAV_MS2 * age * age;
      const alpha = 1 - age / PARTICLE_DURATION_MS;

      ctx.globalAlpha = alpha;
      ctx.fillStyle   = p.color;
      ctx.fillRect(Math.round(x) - p.size / 2, Math.round(y) - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  #tickLevelFade(snapshot) {
    const { level, ball, now } = snapshot;

    if (level > this.#prevLevel) {
      this.#fadeAlpha   = 0;
      this.#fadeStartAt = ball.x > this.#virtualW / 2 ? now : -1;
      this.#prevLevel   = level;
    }

    if (this.#fadeStartAt < 0 && this.#fadeAlpha < 1 && ball.x > this.#virtualW / 2) this.#fadeStartAt = now;

    if (this.#fadeStartAt >= 0 && this.#fadeAlpha < 1) {
      this.#fadeAlpha = Math.min(1, (now - this.#fadeStartAt) / FADE_DURATION_MS);
    }
  }

  #saveFrameState(snapshot) {
    this.#prevGhostCount = snapshot.ghosts.length;
    this.#prevGhosts     = snapshot.ghosts.map(g => ({ x: g.x, y: g.y, w: g.w, h: g.h, color: g.color }));
    this.#prevAlienCount = snapshot.aliens.length;
    this.#prevAliens     = snapshot.aliens.map(a => ({ x: a.x, y: a.y, w: a.w, h: a.h, color: a.color }));
    this.#prevMotherShip = snapshot.motherShip ? { ...snapshot.motherShip } : null;
  }

  #updateTouchKnob({ paddle }) {
    const knob = this.#knob;
    const zone = this.#zone;
    if (!knob || !zone || !paddle) return;
    if (getComputedStyle(zone).display === 'none') return;

    const zoneStyle = getComputedStyle(zone);
    const padTop    = Number.parseFloat(zoneStyle.paddingTop);
    const padBot    = Number.parseFloat(zoneStyle.paddingBottom);
    const knobH     = knob.offsetHeight;
    const trackH    = zone.offsetHeight - padTop - padBot;
    const relativeY = paddle.y / (VIRTUAL_H - paddle.h);
    knob.style.top  = `${padTop + relativeY * (trackH - knobH)}px`;
    zone.setAttribute('aria-valuenow', Math.round(relativeY * 100));
  }
}
