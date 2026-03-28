import { aabb } from '../physics/collision.js';
import {
  ALIEN_SPAWN_X,
  ALIEN_ROWS, ALIEN_H, ALIEN_V_GAP,
  MOTHERSHIP_W, MOTHERSHIP_H, MOTHERSHIP_HP,
  MOTHERSHIP_APPEAR_OFFSET, MOTHERSHIP_ROAM_MARGIN,
  MOTHERSHIP_ROAM_SPEED, MOTHERSHIP_CHARGE_SPEED,
  MOTHERSHIP_RETREAT_SPEED, MOTHERSHIP_CHARGE_FRAC,
  MOTHERSHIP_FIRE_MS, MOTHERSHIP_RAPID_FIRE_MS,
  LASER_W, LASER_H, LASER_SPEED,
} from '../constants.js';

export class MotherShipSystem {
  #state          = 'dormant'; // 'dormant' | 'roaming' | 'charging' | 'retreating'
  #x              = 0;
  #y              = 0;
  #vy             = MOTHERSHIP_ROAM_SPEED;
  #hp             = MOTHERSHIP_HP;
  #lasers         = [];
  #lastFire       = 0;
  #chargeTargetX  = 0;
  #chargeTargetY  = 0;

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
   * Advance mothership and its lasers one tick.
   * @param {number} now          - current timestamp ms
   * @param {number} timeScale    - elapsed / TARGET_FRAME_MS
   * @param {number} alienOffsetX
   * @param {number} alienOffsetY
   * @param {Array}  aliens       - live alien objects (local y coords)
   * @param {number} fieldH       - virtual field height
   * @param {number} fieldW       - virtual field width
   */
  move(now, timeScale, alienOffsetX, alienOffsetY, aliens, fieldH, fieldW) {
    // Dormant → roaming when formation has advanced enough
    if (this.#state === 'dormant') {
      if (alienOffsetX < MOTHERSHIP_APPEAR_OFFSET) return;
      this.#state    = 'roaming';
      this.#x        = this.#roamX(alienOffsetX);
      this.#y        = fieldH / 2 - MOTHERSHIP_H / 2;
      this.#vy       = MOTHERSHIP_ROAM_SPEED;
      this.#lastFire = now;
    }

    // Advance lasers; cull those off-screen
    for (const l of this.#lasers) l.x += LASER_SPEED * timeScale;
    this.#lasers = this.#lasers.filter(l => l.x < fieldW);

    switch (this.#state) {
      case 'roaming':    this.#stepRoaming(now, timeScale, alienOffsetX, alienOffsetY, aliens, fieldH, fieldW); break;
      case 'charging':   this.#stepCharging(now, timeScale, fieldH);                                         break;
      case 'retreating': this.#stepRetreating(now, timeScale, alienOffsetX, fieldH);                    break;
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

    ball.dx = -Math.abs(ball.dx); // always bounce ball back left
    this.#hp--;
    if (this.#hp <= 0) {
      this.#state  = 'dormant';
      this.#lasers = [];
      return 'killed';
    }
    return 'hit';
  }

  /**
   * Test all lasers vs paddle. Removes lasers that hit.
   * @returns {boolean} true if at least one laser struck the paddle
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

  // ── Private helpers ───────────────────────────────────────────────────────

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

  #wanderVertical(timeScale, fieldH) {
    if (Math.random() < 0.012) this.#vy = -this.#vy;
    this.#y += this.#vy * timeScale;
    if (this.#y < 0) {
      this.#y  = -this.#y;
      this.#vy =  Math.abs(this.#vy);
    }
    if (this.#y + MOTHERSHIP_H > fieldH) {
      this.#y  = 2 * (fieldH - MOTHERSHIP_H) - this.#y;
      this.#vy = -Math.abs(this.#vy);
    }
  }

  /** Returns world-Y centre of the first clear alien row, or null. */
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

  #stepRoaming(now, timeScale, alienOffsetX, alienOffsetY, aliens, fieldH, fieldW) {
    // Track formation left edge
    this.#x = this.#roamX(alienOffsetX);
    this.#wanderVertical(timeScale, fieldH);

    if (now - this.#lastFire >= MOTHERSHIP_FIRE_MS) this.#fireLaser(now);

    // Trigger charge when a row gap exists
    const gapCY = this.#findGapCentreY(aliens, alienOffsetY);
    if (gapCY !== null && Math.random() < 0.004) {
      this.#state         = 'charging';
      this.#chargeTargetY = gapCY - MOTHERSHIP_H / 2;
      this.#chargeTargetX = fieldW * MOTHERSHIP_CHARGE_FRAC;
    }
  }

  #stepCharging(now, timeScale, fieldH) {
    // Slide toward gap row Y
    const dy = this.#chargeTargetY - this.#y;
    if (Math.abs(dy) > 1) this.#y += Math.sign(dy) * MOTHERSHIP_CHARGE_SPEED * timeScale;
    this.#y = Math.max(0, Math.min(fieldH - MOTHERSHIP_H, this.#y));

    this.#x += MOTHERSHIP_CHARGE_SPEED * timeScale;

    if (now - this.#lastFire >= MOTHERSHIP_RAPID_FIRE_MS) this.#fireLaser(now);

    if (this.#x >= this.#chargeTargetX) {
      this.#x     = this.#chargeTargetX;
      this.#state  = 'retreating';
      this.#vy     = MOTHERSHIP_ROAM_SPEED * (Math.random() < 0.5 ? 1 : -1);
    }
  }

  #stepRetreating(now, timeScale, alienOffsetX, fieldH) {
    const targetX = this.#roamX(alienOffsetX);
    this.#x -= MOTHERSHIP_RETREAT_SPEED * timeScale;
    this.#wanderVertical(timeScale, fieldH);

    if (this.#x <= targetX) {
      this.#x        = targetX;
      this.#state     = 'roaming';
      this.#lastFire  = now; // brief pause before firing again
    }
  }
}
