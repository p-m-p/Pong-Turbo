import { describe, it, expect } from 'vitest';
import { PowerUp } from '../../../src/domain/entities/PowerUp.js';
import { POWERUP_GRACE_MS, POWERUP_LIFESPAN_MS, VIRTUAL_H } from '../../../src/domain/constants.js';

function makePowerUp(type = 'wide', born = 0) {
  return new PowerUp(100, 100, type, born);
}

describe('PowerUp', () => {
  it('exposes type', () => {
    expect(makePowerUp('shield').type).toBe('shield');
  });

  it('exposes born timestamp', () => {
    expect(makePowerUp('slow', 12345).born).toBe(12345);
  });

  it('is not live before grace period', () => {
    const p = makePowerUp('wide', 0);
    expect(p.isLive(POWERUP_GRACE_MS - 1)).toBe(false);
  });

  it('becomes live after grace period', () => {
    const p = makePowerUp('wide', 0);
    expect(p.isLive(POWERUP_GRACE_MS)).toBe(true);
  });

  it('is not expired before lifespan', () => {
    const p = makePowerUp('wide', 0);
    expect(p.expired(POWERUP_LIFESPAN_MS - 1)).toBe(false);
  });

  it('expires after lifespan', () => {
    const p = makePowerUp('wide', 0);
    expect(p.expired(POWERUP_LIFESPAN_MS)).toBe(true);
  });

  it('stays within canvas bounds after many move ticks', () => {
    const p = makePowerUp('wide', 0);
    for (let i = 0; i < 500; i++) p.move(VIRTUAL_H, 1);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y + p.h).toBeLessThanOrEqual(VIRTUAL_H);
  });
});
