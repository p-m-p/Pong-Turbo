import { describe, it, expect, beforeEach } from 'vitest';
import { PowerUpSystem } from '../../../src/domain/systems/PowerUpSystem.js';
import { makeBall }       from '../../helpers/builders.js';
import { POWERUP_GRACE_MS, POWERUP_LIFESPAN_MS, VIRTUAL_H } from '../../../src/domain/constants.js';

let sys;
beforeEach(() => { sys = new PowerUpSystem(); });

describe('PowerUpSystem trySpawn', () => {
  it('always spawns on 2+ kills', () => {
    sys.trySpawn(100, 100, 2, 0);
    expect(sys.powerUps.length).toBe(1);
  });

  it('spawns a power-up with the injected born time', () => {
    sys.trySpawn(100, 100, 2, 5000);
    expect(sys.powerUps[0].born).toBe(5000);
  });

  it('power-up is not live immediately after spawn', () => {
    sys.trySpawn(100, 100, 2, 0);
    expect(sys.powerUps[0].isLive(0)).toBe(false);
  });

  it('power-up becomes live after grace period', () => {
    sys.trySpawn(100, 100, 2, 0);
    expect(sys.powerUps[0].isLive(POWERUP_GRACE_MS)).toBe(true);
  });
});

describe('PowerUpSystem move', () => {
  it('removes expired power-ups', () => {
    sys.trySpawn(100, 100, 2, 0);
    sys.move(VIRTUAL_H, 1, POWERUP_LIFESPAN_MS); // now = lifespan → expired
    expect(sys.powerUps.length).toBe(0);
  });

  it('keeps live power-ups', () => {
    sys.trySpawn(100, 100, 2, 0);
    sys.move(VIRTUAL_H, 1, 500); // well within lifespan
    expect(sys.powerUps.length).toBe(1);
  });
});

describe('PowerUpSystem checkCollision', () => {
  it('returns null when no power-up is live', () => {
    sys.trySpawn(100, 100, 2, 0);
    const ball = makeBall({ x: 100, y: 100, w: 20, h: 20 });
    // now < grace period — not live yet
    expect(sys.checkCollision(ball, POWERUP_GRACE_MS - 1)).toBeNull();
  });

  it('returns the power-up type and removes it when collected', () => {
    sys.trySpawn(100, 100, 2, 0);
    const p    = sys.powerUps[0];
    const ball = makeBall({ x: p.x, y: p.y, w: p.w, h: p.h });
    const type = sys.checkCollision(ball, POWERUP_GRACE_MS + 1);
    expect(type).toMatch(/^(wide|shield)$/);
    expect(sys.powerUps.length).toBe(0);
  });

  it('returns null when ball does not overlap', () => {
    sys.trySpawn(100, 100, 2, 0);
    const ball = makeBall({ x: 500, y: 350 });
    expect(sys.checkCollision(ball, POWERUP_GRACE_MS + 1)).toBeNull();
  });
});

describe('PowerUpSystem clear', () => {
  it('removes all power-ups', () => {
    sys.trySpawn(50, 50, 2, 0);
    sys.trySpawn(100, 100, 2, 0);
    sys.clear();
    expect(sys.powerUps.length).toBe(0);
  });
});
