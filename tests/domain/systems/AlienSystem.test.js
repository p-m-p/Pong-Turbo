import { describe, it, expect, beforeEach } from 'vitest';
import { AlienSystem } from '../../../src/domain/systems/AlienSystem.js';
import { makeBall } from '../../helpers/builders.js';
import { VIRTUAL_H, ALIEN_COLS, ALIEN_ROWS } from '../../../src/domain/constants.js';

let sys;
beforeEach(() => {
  sys = new AlienSystem();
  sys.spawn(VIRTUAL_H);
});

describe('AlienSystem spawn', () => {
  it('creates the full grid of aliens', () => {
    expect(sys.aliens.length).toBe(ALIEN_COLS * ALIEN_ROWS);
  });

  it('active is true after spawn', () => {
    expect(sys.active).toBe(true);
  });

  it('allDead is false after spawn', () => {
    expect(sys.allDead()).toBe(false);
  });

  it('active is false before spawn', () => {
    expect(new AlienSystem().active).toBe(false);
  });

  it('assigns types left-to-right by column (vertical stripes)', () => {
    const col0 = sys.aliens.filter((_, i) => i % ALIEN_COLS === 0);
    const col1 = sys.aliens.filter((_, i) => i % ALIEN_COLS === 1);
    const col3 = sys.aliens.filter((_, i) => i % ALIEN_COLS === 3);
    expect(col0.every((a) => a.type === 'squid')).toBe(true);
    expect(col1.every((a) => a.type === 'crab')).toBe(true);
    expect(col3.every((a) => a.type === 'drone')).toBe(true);
  });

  it('each alien has a type and color', () => {
    for (const a of sys.aliens) {
      expect(['drone', 'crab', 'squid']).toContain(a.type);
      expect(a.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('AlienSystem move', () => {
  it('does not throw when called', () => {
    expect(() => sys.move(VIRTUAL_H, 1)).not.toThrow();
  });

  it('offsetY stays within canvas bounds after many ticks', () => {
    for (let i = 0; i < 2000; i++) sys.move(VIRTUAL_H, 1);
    expect(sys.offsetY).toBeGreaterThanOrEqual(0);
    expect(sys.offsetY + 182).toBeLessThanOrEqual(VIRTUAL_H); // FORM_H = 182
  });

  it('offsetX advances rightward over time', () => {
    const before = sys.offsetX;
    for (let i = 0; i < 10; i++) sys.move(VIRTUAL_H, 1);
    expect(sys.offsetX).toBeGreaterThan(before);
  });
});

describe('AlienSystem reachedX', () => {
  it('returns false when formation has not yet reached paddleX', () => {
    expect(sys.reachedX(580)).toBe(false);
  });

  it('returns true when offsetX has advanced far enough', () => {
    // Manually push offsetX far right
    for (let i = 0; i < 10000; i++) sys.move(VIRTUAL_H, 1);
    // At some point it should have reached the paddle at x=580
    expect(sys.reachedX(100)).toBe(true);
  });
});

describe('AlienSystem checkCollision', () => {
  it('returns 0 when ball does not hit any alien', () => {
    const ball = makeBall({ x: 550, y: 350 });
    expect(sys.checkCollision(ball)).toBe(0);
  });

  it('returns 1 on a kill and removes the alien', () => {
    const a = sys.aliens[0];
    // Position ball directly on alien (account for offset)
    const ball = makeBall({
      x: a.x + sys.offsetX,
      y: a.y + sys.offsetY,
      w: a.w,
      h: a.h,
    });
    // Hit once (HP=2, need 2 hits)
    sys.checkCollision(ball);
    const before = sys.aliens.length;
    // Second hit kills it
    ball.x = a.x + sys.offsetX;
    ball.y = a.y + sys.offsetY;
    ball.dx = 5;
    const killed = sys.checkCollision(ball);
    expect(killed).toBe(1);
    expect(sys.aliens.length).toBe(before - 1);
  });

  it('reverses ball dx on hit', () => {
    const a = sys.aliens[0];
    const ball = makeBall({
      x: a.x + sys.offsetX,
      y: a.y + sys.offsetY,
      w: a.w,
      h: a.h,
      dx: 5,
    });
    const originalDx = ball.dx;
    sys.checkCollision(ball);
    expect(ball.dx).toBe(-originalDx);
  });
});
