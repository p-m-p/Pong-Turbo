import { aabb } from '../physics/collision.js';
import {
  ALIEN_SPAWN_X,
  ALIEN_ROWS, ALIEN_H, ALIEN_V_GAP,
  MOTHERSHIP_W, MOTHERSHIP_H, MOTHERSHIP_HP,
  MOTHERSHIP_APPEAR_OFFSET, MOTHERSHIP_ROAM_MARGIN,
  MOTHERSHIP_ENTRY_SPEED, MOTHERSHIP_ROAM_SPEED,
  MOTHERSHIP_CHARGE_SPEED, MOTHERSHIP_RETREAT_SPEED,
  MOTHERSHIP_CHARGE_FRAC,
  MOTHERSHIP_FIRE_MS, MOTHERSHIP_RAPID_FIRE_MS,
  LASER_W, LASER_H, LASER_SPEED_MULT,
} from '../constants.js';

export class MotherShipSystem {
  // 'dormant' | 'entering' | 'roaming' | 'charging' | 'retreating'
  #state         = 'dormant';
  #x             = 0;
  #y             = 0;
  #vy            = MOTHERSHIP_ROAM_SPEED;  // vertical wander velocity
  #chargeVy      = 0;                      // vertical velocity during diagonal charge
  #chargeTargetX = 0;
  #hp            = MOTHERSHIP_HP;
  #lasers        = [];
  #lastFire      = 0;
  #laserSpeed    = 10;                     // updated each tick: gameSpeed * LASER_SPEED_MULT

  get active()  { return this.#state !== 'dormant'; }
  get state()   { return this.#state; }
  get x()       { return this.#x; }
  get y()       { return this.#y; }
  get w()       { return MOTHERSHIP_W; }
  get h()       { return MOTHERSHIP_H; }
  get hp()      { return this.#hp; }
  get maxHp()   { return MOTHERSHIP_HP; }
  get lasers()  { return this.#lasers; }

  reset() {
    this.#state    = 'dormant';
    this.#hp       = MOTHERSHIP_HP;
    this.#lasers   = [];
    this.#lastFire = 0;
    this.#vy       = MOTHERSHIP_ROAM_SPEED;
  }

  /**
   * @param {number} now
   * @param {number} timeScale
   * @param {number} alienOffsetX
   * @param {number} alienOffsetY
   * @param {Array}  aliens       - live alien objects (local y coords)
   * @param {number} fieldH
   * @param {number} fieldW
   * @param {number} gameSpeed    - current game speed (lasers = gameSpeed * LASER_SPEED_MULT)
   */
  move(now, timeScale, alienOffsetX, alienOffsetY, aliens, fieldH, fieldW, gameSpeed) {
    // Spawn: slide in from off the left edge
    if (this.#state === 'dormant') {
      if (alienOffsetX < MOTHERSHIP_APPEAR_OFFSET) return;
      this.#state    = 'entering';
      this.#x        = -(MOTHERSHIP_W + 20);
      this.#y        = fieldH / 2 - MOTHERSHIP_H / 2;
      this.#vy       = MOTHERSHIP_ROAM_SPEED;
      this.#lastFire = now;
    }

    // Laser speed scales with game speed
    this.#laserSpeed = gameSpeed * LASER_SPEED_MULT;

    // Advance lasers; cull off-screen
    for (const l of this.#lasers) l.x += this.#laserSpeed * timeScale;
    this.#lasers = this.#lasers.filter(l => l.x < fieldW);

    switch (this.#state) {
      case 'entering':   this.#stepEntering(now, timeScale, alienOffsetX, fieldH);                         break;
      case 'roaming':    this.#stepRoaming(now, timeScale, alienOffsetX, alienOffsetY, aliens, fieldH, fieldW); break;
      case 'charging':   this.#stepCharging(now, timeScale, fieldH);                                       break;
      case 'retreating': this.#stepRetreating(now, timeScale, alienOffsetX, fieldH);                       break;
    }
  }

  /**
   * Test ball vs mothership. Bounces ball left; decrements HP.
   * @returns {'killed'|'hit'|null}
   */
  checkBallCollision(ball) {
    if (this.#state === 'dormant') return null;
    const ms = { x: this.#x, y: this.#y, w: MOTHERSHIP_W, h: MOTHERSHIP_H };
    if (!aabb(ball, ms)) return null;

    // Bounce ball away and push it clear so it can't register multiple hits
    if (ball.dx <= 0) {
      // Approaching from right — bounce right
      ball.dx = Math.abs(ball.dx);
      ball.x  = this.#x + MOTHERSHIP_W;
    } else {
      // Approaching from left — bounce left
      ball.dx = -Math.abs(ball.dx);
      ball.x  = this.#x - ball.w;
    }
    this.#hp--;
    if (this.#hp <= 0) {
      this.#state  = 'dormant';
      this.#lasers = [];
      return 'killed';
    }
    return 'hit';
  }

  /**
   * Test all lasers vs paddle. Removes hitting lasers.
   * @returns {boolean}
   */
  checkLaserPaddleCollision(paddle) {
    let hit = false;
    for (let i = this.#lasers.length - 1; i >= 0; i--) {
      if (aabb(this.#lasers[i], paddle)) {
        this.#lasers.splice(i, 1);
        hit = true;
      }
    }
    return hit;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  #roamX(alienOffsetX) {
    return ALIEN_SPAWN_X + alienOffsetX - MOTHERSHIP_W - MOTHERSHIP_ROAM_MARGIN;
  }

  #fireLaser(now) {
    this.#lasers.push({
      x: this.#x + MOTHERSHIP_W,
      y: this.#y + MOTHERSHIP_H / 2 - LASER_H / 2,
      w: LASER_W,
      h: LASER_H,
    });
    this.#lastFire = now;
  }

  #bounceVertical(fieldH) {
    if (this.#y < 0) {
      this.#y  = -this.#y;
      this.#vy =  Math.abs(this.#vy);
    }
    if (this.#y + MOTHERSHIP_H > fieldH) {
      this.#y  = 2 * (fieldH - MOTHERSHIP_H) - this.#y;
      this.#vy = -Math.abs(this.#vy);
    }
  }

  #bounceChargeVertical(fieldH) {
    if (this.#y < 0) {
      this.#y       = -this.#y;
      this.#chargeVy = Math.abs(this.#chargeVy);
    }
    if (this.#y + MOTHERSHIP_H > fieldH) {
      this.#y       = 2 * (fieldH - MOTHERSHIP_H) - this.#y;
      this.#chargeVy = -Math.abs(this.#chargeVy);
    }
  }

  #findGapCentreY(aliens, alienOffsetY) {
    const occupiedRows = new Set(aliens.map(a => a.y));
    for (let row = 0; row < ALIEN_ROWS; row++) {
      const localY = row * (ALIEN_H + ALIEN_V_GAP);
      if (!occupiedRows.has(localY)) {
        return alienOffsetY + localY + ALIEN_H / 2;
      }
    }
    return null;
  }

  #stepEntering(now, timeScale, alienOffsetX, fieldH) {
    this.#x += MOTHERSHIP_ENTRY_SPEED * timeScale;
    // Gentle vertical wander during entry
    this.#y += this.#vy * timeScale;
    this.#bounceVertical(fieldH);

    if (this.#x >= this.#roamX(alienOffsetX)) {
      this.#x        = this.#roamX(alienOffsetX);
      this.#state    = 'roaming';
      this.#lastFire = now;
    }
  }

  #stepRoaming(now, timeScale, alienOffsetX, alienOffsetY, aliens, fieldH, fieldW) {
    this.#x = this.#roamX(alienOffsetX);
    if (Math.random() < 0.012) this.#vy = -this.#vy;
    this.#y += this.#vy * timeScale;
    this.#bounceVertical(fieldH);

    if (now - this.#lastFire >= MOTHERSHIP_FIRE_MS) this.#fireLaser(now);

    const gapCY = this.#findGapCentreY(aliens, alienOffsetY);
    if (gapCY !== null && Math.random() < 0.004) {
      // Set initial diagonal direction toward the gap row, then bounce
      const gapY = gapCY - MOTHERSHIP_H / 2;
      this.#chargeVy     = MOTHERSHIP_CHARGE_SPEED * (gapY < this.#y ? -1 : 1);
      this.#chargeTargetX = fieldW * MOTHERSHIP_CHARGE_FRAC;
      this.#state        = 'charging';
    }
  }

  #stepCharging(now, timeScale, fieldH) {
    // Diagonal movement: horizontal advance + vertical bounce
    this.#x += MOTHERSHIP_CHARGE_SPEED * timeScale;
    this.#y += this.#chargeVy * timeScale;
    this.#bounceChargeVertical(fieldH);

    if (now - this.#lastFire >= MOTHERSHIP_RAPID_FIRE_MS) this.#fireLaser(now);

    if (this.#x >= this.#chargeTargetX) {
      this.#x    = this.#chargeTargetX;
      this.#state = 'retreating';
      this.#vy   = MOTHERSHIP_ROAM_SPEED * (Math.random() < 0.5 ? 1 : -1);
    }
  }

  #stepRetreating(now, timeScale, alienOffsetX, fieldH) {
    const targetX = this.#roamX(alienOffsetX);
    this.#x -= MOTHERSHIP_RETREAT_SPEED * timeScale;
    if (Math.random() < 0.012) this.#vy = -this.#vy;
    this.#y += this.#vy * timeScale;
    this.#bounceVertical(fieldH);

    if (this.#x <= targetX) {
      this.#x       = targetX;
      this.#state   = 'roaming';
      this.#lastFire = now;
    }
  }
}
