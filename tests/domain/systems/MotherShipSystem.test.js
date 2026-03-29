import { describe, it, expect, beforeEach } from 'vitest';
import { MotherShipSystem } from '../../../src/domain/systems/MotherShipSystem.js';
import { makeBall, makePaddle } from '../../helpers/builders.js';
import {
  VIRTUAL_H,
  MOTHERSHIP_HP, MOTHERSHIP_W, MOTHERSHIP_H,
  MOTHERSHIP_APPEAR_OFFSET, MOTHERSHIP_FIRE_MS,
} from '../../../src/domain/constants.js';

const FIELD_W    = 600;
const GAME_SPEED = 16;

/** All rows occupied — no gap for charge trigger. */
function makeAliens() {
  const ALIEN_H_LOCAL = 22, ALIEN_V_GAP_LOCAL = 10;
  return Array.from({ length: 6 }, (_, row) => ({
    y: row * (ALIEN_H_LOCAL + ALIEN_V_GAP_LOCAL),
  }));
}

/** Advance the system one tick with a given alienOffsetX. */
function tick(sys, now, alienOffsetX = MOTHERSHIP_APPEAR_OFFSET, aliens = makeAliens()) {
  sys.move(now, 1, alienOffsetX, 0, aliens, VIRTUAL_H, FIELD_W, GAME_SPEED);
}

/** Advance until the system reaches a given state; returns the final 'now'. */
function advanceTo(sys, targetState, maxTicks = 200) {
  let now = 0;
  for (let i = 0; i < maxTicks; i++) {
    tick(sys, now);
    now += 33;
    if (sys.state === targetState) return now;
  }
  throw new Error(`state '${targetState}' not reached within ${maxTicks} ticks`);
}

// ── Initial state ─────────────────────────────────────────────────────────────

describe('MotherShipSystem — initial state', () => {
  it('starts dormant', () => {
    expect(new MotherShipSystem().state).toBe('dormant');
  });

  it('is not active when dormant', () => {
    expect(new MotherShipSystem().active).toBe(false);
  });

  it('hp equals MOTHERSHIP_HP', () => {
    expect(new MotherShipSystem().hp).toBe(MOTHERSHIP_HP);
  });

  it('has no lasers', () => {
    expect(new MotherShipSystem().lasers.length).toBe(0);
  });
});

// ── reset() ───────────────────────────────────────────────────────────────────

describe('MotherShipSystem — reset()', () => {
  it('returns system to dormant', () => {
    const sys = new MotherShipSystem();
    advanceTo(sys, 'entering');
    sys.reset();
    expect(sys.state).toBe('dormant');
    expect(sys.active).toBe(false);
  });

  it('restores full HP', () => {
    const sys = new MotherShipSystem();
    advanceTo(sys, 'entering');
    const ball = makeBall({ x: sys.x + 5, y: sys.y + 5, dx: 5 });
    sys.checkBallCollision(ball);
    sys.reset();
    expect(sys.hp).toBe(MOTHERSHIP_HP);
  });

  it('clears lasers', () => {
    const sys = new MotherShipSystem();
    const nowAtRoaming = advanceTo(sys, 'roaming');
    tick(sys, nowAtRoaming + MOTHERSHIP_FIRE_MS + 100);
    sys.reset();
    expect(sys.lasers.length).toBe(0);
  });
});

// ── Spawn trigger ────────────────────────────────────────────────────────────

describe('MotherShipSystem — spawn trigger', () => {
  it('stays dormant below threshold', () => {
    const sys = new MotherShipSystem();
    sys.move(0, 1, MOTHERSHIP_APPEAR_OFFSET - 1, 0, makeAliens(), VIRTUAL_H, FIELD_W, GAME_SPEED);
    expect(sys.state).toBe('dormant');
    expect(sys.active).toBe(false);
  });

  it('transitions to entering at threshold', () => {
    const sys = new MotherShipSystem();
    sys.move(0, 1, MOTHERSHIP_APPEAR_OFFSET, 0, makeAliens(), VIRTUAL_H, FIELD_W, GAME_SPEED);
    expect(sys.state).toBe('entering');
    expect(sys.active).toBe(true);
  });

  it('starts off the left edge of the canvas', () => {
    const sys = new MotherShipSystem();
    sys.move(0, 1, MOTHERSHIP_APPEAR_OFFSET, 0, makeAliens(), VIRTUAL_H, FIELD_W, GAME_SPEED);
    expect(sys.x).toBeLessThan(0);
  });
});

// ── Entering state ────────────────────────────────────────────────────────────

describe('MotherShipSystem — entering', () => {
  it('moves rightward each tick', () => {
    const sys = new MotherShipSystem();
    tick(sys, 0); // trigger entering
    const x0 = sys.x;
    tick(sys, 33);
    expect(sys.x).toBeGreaterThan(x0);
  });

  it('transitions to roaming when it reaches the formation', () => {
    const sys = new MotherShipSystem();
    advanceTo(sys, 'roaming');
    expect(sys.state).toBe('roaming');
  });

  it('x is >= 0 once in roaming state', () => {
    const sys = new MotherShipSystem();
    advanceTo(sys, 'roaming');
    expect(sys.x).toBeGreaterThanOrEqual(0);
  });
});

// ── Ball collision ────────────────────────────────────────────────────────────

describe('MotherShipSystem — checkBallCollision()', () => {
  it('returns null when dormant', () => {
    const sys = new MotherShipSystem();
    expect(sys.checkBallCollision(makeBall())).toBeNull();
  });

  it('returns null when ball does not overlap', () => {
    const sys = new MotherShipSystem();
    advanceTo(sys, 'entering');
    expect(sys.checkBallCollision(makeBall({ x: FIELD_W - 20, y: 0 }))).toBeNull();
  });

  it('returns "hit" and decrements HP on overlap', () => {
    const sys = new MotherShipSystem();
    advanceTo(sys, 'entering');
    const ball = makeBall({ x: sys.x + 5, y: sys.y + 5, dx: 5 });
    expect(sys.checkBallCollision(ball)).toBe('hit');
    expect(sys.hp).toBe(MOTHERSHIP_HP - 1);
  });

  it('bounces ball left when approaching from the left (dx positive)', () => {
    const sys = new MotherShipSystem();
    advanceTo(sys, 'entering');
    const ball = makeBall({ x: sys.x + 5, y: sys.y + 5, dx: 8 });
    sys.checkBallCollision(ball);
    expect(ball.dx).toBe(-8);
  });

  it('bounces ball right when approaching from the right (dx negative)', () => {
    const sys = new MotherShipSystem();
    advanceTo(sys, 'entering');
    const ball = makeBall({ x: sys.x + 5, y: sys.y + 5, dx: -8 });
    sys.checkBallCollision(ball);
    expect(ball.dx).toBeGreaterThan(0);
  });

  it('pushes ball clear of the mothership after a hit', () => {
    const sys = new MotherShipSystem();
    advanceTo(sys, 'entering');
    const ball = makeBall({ x: sys.x + 5, y: sys.y + 5, dx: -8 });
    sys.checkBallCollision(ball);
    // Ball must no longer overlap the mothership bbox
    expect(ball.x + ball.w).toBeLessThanOrEqual(sys.x + MOTHERSHIP_W + ball.w + 1);
    expect(ball.x).toBeGreaterThanOrEqual(sys.x + MOTHERSHIP_W);
  });

  it('returns "killed" after MOTHERSHIP_HP hits and goes dormant', () => {
    const sys = new MotherShipSystem();
    advanceTo(sys, 'entering');
    let result;
    for (let i = 0; i < MOTHERSHIP_HP; i++) {
      const ball = makeBall({ x: sys.x + 5, y: sys.y + 5, dx: 5 });
      result = sys.checkBallCollision(ball);
    }
    expect(result).toBe('killed');
    expect(sys.state).toBe('dormant');
    expect(sys.active).toBe(false);
  });

  it('clears all lasers when killed', () => {
    const sys = new MotherShipSystem();
    const roamingNow = advanceTo(sys, 'roaming');
    tick(sys, roamingNow + MOTHERSHIP_FIRE_MS + 100); // fire one laser
    for (let i = 0; i < MOTHERSHIP_HP; i++) {
      const ball = makeBall({ x: sys.x + 5, y: sys.y + 5, dx: 5 });
      sys.checkBallCollision(ball);
    }
    expect(sys.lasers.length).toBe(0);
  });
});

// ── Lasers ────────────────────────────────────────────────────────────────────

describe('MotherShipSystem — lasers', () => {
  it('fires a laser after MOTHERSHIP_FIRE_MS has elapsed in roaming state', () => {
    const sys = new MotherShipSystem();
    const roamingNow = advanceTo(sys, 'roaming');
    tick(sys, roamingNow + MOTHERSHIP_FIRE_MS + 1);
    expect(sys.lasers.length).toBeGreaterThan(0);
  });

  it('lasers move rightward each tick', () => {
    const sys = new MotherShipSystem();
    const roamingNow = advanceTo(sys, 'roaming');
    tick(sys, roamingNow + MOTHERSHIP_FIRE_MS + 1); // fire
    expect(sys.lasers.length).toBeGreaterThan(0);
    const x0 = sys.lasers[0].x;
    tick(sys, roamingNow + MOTHERSHIP_FIRE_MS + 34); // next tick
    expect(sys.lasers[0]?.x ?? x0 + 1).toBeGreaterThan(x0);
  });

  it('checkLaserPaddleCollision returns false with no lasers', () => {
    const sys = new MotherShipSystem();
    expect(sys.checkLaserPaddleCollision(makePaddle())).toBe(false);
  });

  it('checkLaserPaddleCollision returns true and removes laser on overlap', () => {
    const sys = new MotherShipSystem();
    const roamingNow = advanceTo(sys, 'roaming');
    tick(sys, roamingNow + MOTHERSHIP_FIRE_MS + 1);
    expect(sys.lasers.length).toBeGreaterThan(0);

    const paddle = makePaddle({ x: 580, y: 200, w: 10, h: 60 });
    // Move the laser directly onto the paddle
    sys.lasers[0].x = paddle.x;
    sys.lasers[0].y = paddle.y;

    expect(sys.checkLaserPaddleCollision(paddle)).toBe(true);
    expect(sys.lasers.length).toBe(0);
  });
});

// ── Vertical bounds ───────────────────────────────────────────────────────────

describe('MotherShipSystem — vertical bounds', () => {
  it('y stays within field bounds over many ticks', () => {
    const sys = new MotherShipSystem();
    let now = 0;
    for (let i = 0; i < 2000; i++) {
      sys.move(now, 1, MOTHERSHIP_APPEAR_OFFSET, 0, makeAliens(), VIRTUAL_H, FIELD_W, GAME_SPEED);
      now += 33;
    }
    if (sys.active) {
      expect(sys.y).toBeGreaterThanOrEqual(0);
      expect(sys.y + MOTHERSHIP_H).toBeLessThanOrEqual(VIRTUAL_H);
    }
  });
});
