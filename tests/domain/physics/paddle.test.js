import { describe, it, expect } from 'vitest';
import { movePaddle }   from '../../../src/domain/physics/paddle.js';
import { makePaddle }   from '../../helpers/builders.js';
import { VIRTUAL_H }    from '../../../src/domain/constants.js';

const SPEED = 16;

describe('movePaddle', () => {
  it('moves up when moveY is "up"', () => {
    const p = makePaddle({ y: 100, moveY: 'up' });
    movePaddle(p, VIRTUAL_H, SPEED);
    expect(p.y).toBeLessThan(100);
  });

  it('moves down when moveY is "down"', () => {
    const p = makePaddle({ y: 100, moveY: 'down' });
    movePaddle(p, VIRTUAL_H, SPEED);
    expect(p.y).toBeGreaterThan(100);
  });

  it('does not move above y=0', () => {
    const p = makePaddle({ y: 0, moveY: 'up', velocity: -1 });
    movePaddle(p, VIRTUAL_H, SPEED);
    expect(p.y).toBeGreaterThanOrEqual(0);
  });

  it('does not move below canvas bottom', () => {
    const p = makePaddle({ y: VIRTUAL_H - 60, moveY: 'down', velocity: 1 });
    movePaddle(p, VIRTUAL_H, SPEED);
    expect(p.y + p.h).toBeLessThanOrEqual(VIRTUAL_H);
  });

  it('decelerates to zero when no key is held', () => {
    const p = makePaddle({ y: 100, moveY: null, velocity: 1 });
    // Run enough ticks to fully decelerate
    for (let i = 0; i < 10; i++) movePaddle(p, VIRTUAL_H, SPEED);
    expect(p.velocity).toBe(0);
  });

  it('sets vy to the actual pixels moved when moving', () => {
    const p = makePaddle({ y: 100, moveY: 'down', velocity: 0 });
    movePaddle(p, VIRTUAL_H, SPEED);
    expect(p.vy).toBeGreaterThan(0);
  });

  it('decays vy toward zero when idle', () => {
    const p = makePaddle({ y: 100, moveY: null, velocity: 0, vy: 5 });
    movePaddle(p, VIRTUAL_H, SPEED);
    expect(Math.abs(p.vy)).toBeLessThan(5);
  });

  it('clamps vy to 0 when very small', () => {
    const p = makePaddle({ y: 100, moveY: null, velocity: 0, vy: 0.05 });
    movePaddle(p, VIRTUAL_H, SPEED);
    expect(p.vy).toBe(0);
  });
});
