import { VIRTUAL_W, VIRTUAL_H, TARGET_FRAME_MS } from '../../domain/constants.js';

// Catppuccin Mocha
const CLR_BALL      = '#cba6f7'; // mauve
const CLR_PADDLE    = '#b4befe'; // lavender
const CLR_TEXT      = '#cdd6f4'; // text
const CLR_SHIELD    = '#89dceb'; // sky

const MAX_PHYS_W    = 1200;
const MAX_PHYS_H    = 800;
const MAX_ASPECT    = 1.6;  // canvas width : height — prevents over-wide field on landscape phones

const FADE_DURATION_MS     = 500;   // ms to fade in new-level entities
const PARTICLE_DURATION_MS = 800;   // ms a particle lives
// Pre-compute per-ms equivalents of the original per-frame speeds
const PARTICLE_SPEED_MS    = 1 / TARGET_FRAME_MS;   // 1 virtual-unit/frame → per ms
const PARTICLE_GRAV_MS2    = 0.04 / (TARGET_FRAME_MS * TARGET_FRAME_MS); // gravity per ms²

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
  #prevGhosts      = [];   // [{ x, y, w, h, color }]
  #prevAlienCount  = 0;
  #prevAliens      = [];   // [{ x, y, color }]
  #prevMotherShip  = null; // { x, y, w, h } | null

  // ── Level-fade transition ──────────────────────────────────────────────
  #prevLevel    = 1;
  #fadeAlpha    = 1;  // alpha applied to new-wave entities (1 = fully visible)
  #fadeStartAt  = -1; // snapshot.now when fade-in began; -1 = waiting for ball to cross mid

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement}       wrap    - observed for resize (the pong-canvas host element)
   * @param {HTMLElement|null}  knob    - touch knob element (optional)
   * @param {HTMLElement|null}  zone    - touch zone element (optional)
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
      - parseFloat(style.paddingLeft)
      - parseFloat(style.paddingRight);
    const availH = wrap.clientHeight
      - parseFloat(style.paddingTop)
      - parseFloat(style.paddingBottom);

    const physH = Math.min(Math.max(availH, 1), MAX_PHYS_H);
    const physW = Math.min(Math.max(availW, 1), MAX_PHYS_W, physH * MAX_ASPECT);

    this.#dpr     = window.devicePixelRatio || 1;
    this.#scale   = physH / VIRTUAL_H;          // uniform, height-based
    this.#virtualW = physW / this.#scale;       // field width adapts to canvas

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

    this.#drawBall(ctx, snapshot, s, now);
    this.#drawPaddle(ctx, snapshot, s, now);
    this.#drawGhosts(ctx, snapshot, s);
    this.#drawPowerUps(ctx, snapshot, s, now);
    if (snapshot.isBonusRound) {
      this.#drawAliens(ctx, snapshot, s);
      if (snapshot.motherShip) this.#drawMotherShip(ctx, snapshot.motherShip, s);
      if (snapshot.motherShipLasers?.length) this.#drawLasers(ctx, snapshot.motherShipLasers, s);
    }
    if (snapshot.shieldActive) this.#drawShield(ctx, snapshot, s, now);

    this.#tickAndDrawParticles(ctx, s, now);

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
    ctx.fillStyle    = CLR_TEXT;
    ctx.font         = `bold 16px 'Play', sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur  = 8;
    ctx.shadowColor  = CLR_BALL;
    ctx.fillText('Game over  ·  press Enter to play again', this.#virtualW / 2, VIRTUAL_H / 2);
    ctx.restore();
  }

  // ── Draw helpers ───────────────────────────────────────────────────────

  #drawBall(ctx, { ball, ballState, ballReadySince }, s, now) {
    const alpha = ballState === 'ready'
      ? 0.25 + 0.75 * Math.abs(Math.sin((now - ballReadySince) * 0.005))
      : 1;
    ctx.globalAlpha = alpha;
    ctx.shadowBlur  = 8;
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
    ctx.shadowBlur  = 8;
    ctx.shadowColor = CLR_PADDLE;
    ctx.fillStyle   = CLR_PADDLE;
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  #drawGhosts(ctx, { ghosts }, s) {
    for (const g of ghosts) {
      ctx.save();
      ctx.globalAlpha = (g.state === 'retreating' ? 0.5 : 1) * this.#fadeAlpha;
      this.#drawGhostShape(ctx, g, s);
      ctx.restore();
    }
  }

  #drawGhostShape(ctx, { x, y, w, h, color, vx = 1, vy = 0 }, s) {
    const cx       = x + w / 2;
    const domeR    = w / 2;
    const domeBaseY = y + domeR;
    const skirtY   = y + h * 0.76;

    // Glow
    ctx.shadowBlur  = 8;
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

    // Pupils track travel direction — clamp offset inside iris
    const maxOffset = eyeR - pupilR;
    const mag       = Math.sqrt(vx * vx + vy * vy) || 1;
    const pdx = (vx / mag) * maxOffset;
    const pdy = (vy / mag) * maxOffset;

    ctx.fillStyle = '#0d0d1a';
    ctx.beginPath();
    ctx.arc(leftEX  + pdx, eyeY + pdy, pupilR, 0, Math.PI * 2);
    ctx.arc(rightEX + pdx, eyeY + pdy, pupilR, 0, Math.PI * 2);
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
      ctx.shadowBlur  = 8;
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

  #drawAliens(ctx, { aliens, alienOffsetX, alienOffsetY }, s) {
    ctx.save();
    ctx.translate(alienOffsetX, alienOffsetY);
    for (const a of aliens) {
      ctx.save();
      ctx.globalAlpha = (0.4 + 0.6 * (a.hp / a.maxHp)) * this.#fadeAlpha;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = a.color;
      ctx.fillStyle   = a.color;
      switch (a.type) {
        case 'drone': this.#drawDrone(ctx, a); break;
        case 'crab':  this.#drawCrab(ctx, a);  break;
        default:      this.#drawSquid(ctx, a); break;
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // ── Drone (rows 0-1): futuristic saucer — flat body, dome, antenna, thrusters ──

  #drawDrone(ctx, { x, y, w, h, color }) {
    const cx = x + w / 2;

    // Two thin antenna prongs
    ctx.fillRect(x + 8,  y,     2, 5);
    ctx.fillRect(x + 18, y,     2, 5);

    // Saucer body (trapezoid — wide top, narrower bottom)
    ctx.beginPath();
    ctx.moveTo(x + 2,  y + 6);
    ctx.lineTo(x + 26, y + 6);
    ctx.lineTo(x + 22, y + 15);
    ctx.lineTo(x + 6,  y + 15);
    ctx.closePath();
    ctx.fill();

    // Cockpit dome (upper half-ellipse above the saucer)
    ctx.beginPath();
    ctx.ellipse(cx, y + 6, 6, 4, 0, Math.PI, 0);
    ctx.fill();

    // 3 engine prongs at bottom
    ctx.fillRect(x + 5,  y + 15, 3, 5);
    ctx.fillRect(x + 13, y + 15, 3, 5);
    ctx.fillRect(x + 20, y + 15, 3, 5);

    // Dark cockpit window
    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#1e1e2e';
    ctx.beginPath();
    ctx.ellipse(cx, y + 7, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Crab (rows 2-3): wide body, raised claws, eye-stalks, legs ─────────────

  #drawCrab(ctx, { x, y, w, h, color }) {
    const cx = x + w / 2;

    // Eye stalks
    ctx.fillRect(x + 7,  y,     3, 5);
    ctx.fillRect(x + 18, y,     3, 5);

    // Main body
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 5, 20, 10, 3);
    ctx.fill();

    // Left claw (arrowhead pointing up-left)
    ctx.beginPath();
    ctx.moveTo(x + 4,  y + 6);
    ctx.lineTo(x,      y + 3);
    ctx.lineTo(x,      y + 9);
    ctx.lineTo(x + 4,  y + 12);
    ctx.closePath();
    ctx.fill();

    // Right claw (mirror)
    ctx.beginPath();
    ctx.moveTo(x + 24, y + 6);
    ctx.lineTo(x + 28, y + 3);
    ctx.lineTo(x + 28, y + 9);
    ctx.lineTo(x + 24, y + 12);
    ctx.closePath();
    ctx.fill();

    // 4 bottom legs
    ctx.fillRect(x + 5,  y + 15, 2, 6);
    ctx.fillRect(x + 10, y + 15, 2, 5);
    ctx.fillRect(x + 16, y + 15, 2, 5);
    ctx.fillRect(x + 21, y + 15, 2, 6);

    // Eyes
    ctx.shadowBlur = 0;
    ctx.fillStyle  = 'white';
    ctx.beginPath();
    ctx.arc(x + 9.5,  y + 9, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 18.5, y + 9, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1e2e';
    ctx.beginPath();
    ctx.arc(x + 10,   y + 9.5, 1.2, 0, Math.PI * 2);
    ctx.arc(x + 18,   y + 9.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Squid (rows 4-5): round head, two horns, tentacles, big eyes ────────────

  #drawSquid(ctx, { x, y, w, h, color }) {
    const cx = x + w / 2;

    // Two horns at top
    ctx.beginPath();
    ctx.moveTo(x + 8,  y + 5);
    ctx.lineTo(x + 6,  y);
    ctx.lineTo(x + 4,  y + 5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 5);
    ctx.lineTo(x + 22, y);
    ctx.lineTo(x + 24, y + 5);
    ctx.fill();

    // Round head — dome top + rectangular lower half
    ctx.beginPath();
    ctx.arc(cx, y + 9, 9, Math.PI, 0);
    ctx.lineTo(x + 23, y + 14);
    ctx.lineTo(x + 5,  y + 14);
    ctx.closePath();
    ctx.fill();

    // 4 tentacles (alternate lengths for organic look)
    ctx.fillRect(x + 5,  y + 14, 3, 7);
    ctx.fillRect(x + 10, y + 14, 3, 5);
    ctx.fillRect(x + 15, y + 14, 3, 5);
    ctx.fillRect(x + 20, y + 14, 3, 7);

    // Eyes
    ctx.shadowBlur = 0;
    ctx.fillStyle  = 'white';
    ctx.beginPath();
    ctx.arc(x + 10, y + 9, 3, 0, Math.PI * 2);
    ctx.arc(x + 18, y + 9, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1e2e';
    ctx.beginPath();
    ctx.arc(x + 10.5, y + 9.5, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 17.5, y + 9.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
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
        let bestIdx = 0;
        for (let i = 0; i < remaining.length; i++) {
          const g = remaining[i];
          const d = (g.x + g.w / 2 - bx) ** 2 + (g.y + g.h / 2 - by) ** 2;
          if (d < bestD) { bestD = d; closest = g; bestIdx = i; }
        }
        if (closest) {
          this.#spawnBurst(bx, by, closest.color, 8, now);
          remaining.splice(bestIdx, 1);
        }
      }
    }

    // Alien kills (bonus round — aliens use local coords; ball is in world space)
    if (isBonusRound) {
      const alienKills = this.#prevAlienCount - aliens.length;
      if (alienKills > 0) {
        const oX = snapshot.alienOffsetX;
        const oY = snapshot.alienOffsetY;
        const remaining = [...this.#prevAliens];
        for (let k = 0; k < alienKills; k++) {
          let closest = remaining[0];
          let bestD = Infinity;
          let bestIdx = 0;
          for (let i = 0; i < remaining.length; i++) {
            const a = remaining[i];
            const wx = a.x + oX + a.w / 2;
            const wy = a.y + oY + a.h / 2;
            const d  = (wx - bx) ** 2 + (wy - by) ** 2;
            if (d < bestD) { bestD = d; closest = a; bestIdx = i; }
          }
          if (closest) {
            this.#spawnBurst(bx, by, closest.color, 8, now);
            remaining.splice(bestIdx, 1);
          }
        }
      }
    }

    // Mothership kill
    if (this.#prevMotherShip && !motherShip) {
      const ms = this.#prevMotherShip;
      this.#spawnBurst(ms.x + ms.w / 2, ms.y + ms.h / 2, '#f38ba8', 20, now);
    }
  }

  #spawnBurst(cx, cy, color, count, now) {
    for (let i = 0; i < count; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const spdPxF = 1.5 + Math.random() * 2.5;   // virtual px per frame at 30fps
      const spd    = spdPxF * PARTICLE_SPEED_MS;   // convert to px per ms
      this.#particles.push({
        x0:      cx,
        y0:      cy,
        vx:      Math.cos(angle) * spd,
        vy:      Math.sin(angle) * spd,
        color,
        born:    now,
        size:    Math.random() < 0.5 ? 2 : 3,
      });
    }
  }

  #tickAndDrawParticles(ctx, s, now) {
    for (let i = this.#particles.length - 1; i >= 0; i--) {
      const p   = this.#particles[i];
      const age = now - p.born;
      if (age >= PARTICLE_DURATION_MS) { this.#particles.splice(i, 1); continue; }

      const x     = p.x0 + p.vx * age;
      const y     = p.y0 + p.vy * age + 0.5 * PARTICLE_GRAV_MS2 * age * age;
      const alpha = 1 - age / PARTICLE_DURATION_MS;

      ctx.globalAlpha = alpha;
      ctx.fillStyle   = p.color;
      ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
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

    if (this.#fadeStartAt < 0 && this.#fadeAlpha < 1) {
      if (ball.x > this.#virtualW / 2) this.#fadeStartAt = now;
    }

    if (this.#fadeStartAt >= 0 && this.#fadeAlpha < 1) {
      this.#fadeAlpha = Math.min(1, (now - this.#fadeStartAt) / FADE_DURATION_MS);
    }
  }

  #saveFrameState(snapshot) {
    this.#prevGhostCount = snapshot.ghosts.length;
    this.#prevGhosts     = snapshot.ghosts.map(g => ({ x: g.x, y: g.y, w: g.w, h: g.h, color: g.color }));
    this.#prevAlienCount = snapshot.aliens.length;
    this.#prevAliens     = snapshot.aliens.map(a => ({
      x: a.x, y: a.y, w: a.w, h: a.h, color: a.color,
    }));
    this.#prevMotherShip = snapshot.motherShip ? { ...snapshot.motherShip } : null;
  }

  #drawMotherShip(ctx, ms, s) {
    const CLR = '#f38ba8'; // Catppuccin red
    const { x, y, w, h } = ms;
    const cx = x + w / 2;

    ctx.save();
    ctx.shadowBlur  = 8;
    ctx.shadowColor = CLR;
    ctx.fillStyle   = CLR;

    // Wide flat saucer body
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.68, w / 2, h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dome (upper half-ellipse)
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.5, w * 0.26, h * 0.44, 0, Math.PI, 0);
    ctx.fill();

    // Dark cockpit window
    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#1e1e2e';
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.46, w * 0.12, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // HP bar (above mothership): green → yellow → red
    const barY    = y - 5;
    const hpFrac  = ms.hp / ms.maxHp;
    const barClr  = hpFrac > 2 / 3 ? '#a6e3a1'   // green
                  : hpFrac > 1 / 3 ? '#f9e2af'   // yellow
                  :                  '#f38ba8';   // red
    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#313244';
    ctx.fillRect(x, barY, w, 3);
    ctx.fillStyle  = barClr;
    ctx.fillRect(x, barY, w * hpFrac, 3);

    ctx.restore();
  }

  #drawLasers(ctx, lasers, s) {
    const CLR = '#f38ba8';
    ctx.save();
    ctx.shadowBlur  = 8;
    ctx.shadowColor = CLR;
    ctx.fillStyle   = CLR;
    for (const l of lasers) ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.restore();
  }

  #drawShield(ctx, { paddle }, s, now) {
    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(now * 0.004));
    ctx.shadowBlur  = 8;
    ctx.shadowColor = CLR_SHIELD;
    ctx.strokeStyle = CLR_SHIELD;
    ctx.lineWidth   = 2;
    ctx.strokeRect(paddle.x - 3, paddle.y - 3, paddle.w + 6, paddle.h + 6);
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  #updateTouchKnob({ paddle }) {
    const knob = this.#knob;
    const zone = this.#zone;
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
