import { describe, it, expect } from 'vitest';
import {
  rallyScore,
  levelClearScore,
  bonusClearScore,
  ghostKillScore,
  alienKillScore,
} from '../../../src/domain/systems/ScoringRules.js';

describe('rallyScore', () => {
  it('returns gameSpeed', () => {
    expect(rallyScore(16)).toBe(16);
    expect(rallyScore(22.5)).toBe(22.5);
  });
});

describe('levelClearScore', () => {
  it('returns level × 1000', () => {
    expect(levelClearScore(1)).toBe(1000);
    expect(levelClearScore(3)).toBe(3000);
  });
});

describe('bonusClearScore', () => {
  it('returns 2000 × level', () => {
    expect(bonusClearScore(1)).toBe(2000);
    expect(bonusClearScore(4)).toBe(8000);
  });
});

describe('ghostKillScore', () => {
  it('single ghost kill: level × gameSpeed × 1 × 1', () => {
    expect(ghostKillScore(1, 16, 1)).toBe(16);
  });

  it('double kill is worth 4× a single at same level/speed', () => {
    const single = ghostKillScore(1, 16, 1);
    const double = ghostKillScore(1, 16, 2);
    expect(double).toBe(single * 4);
  });

  it('triple kill is exponentially larger', () => {
    // level=1, speed=16, count=3 → 1 × 16 × 3 × 4 = 192
    expect(ghostKillScore(1, 16, 3)).toBe(1 * 16 * 3 * 4);
  });

  it('scales with level', () => {
    expect(ghostKillScore(3, 16, 1)).toBe(ghostKillScore(1, 16, 1) * 3);
  });
});

describe('alienKillScore', () => {
  it('follows same exponential formula as ghostKillScore', () => {
    expect(alienKillScore(2, 20, 3)).toBe(ghostKillScore(2, 20, 3));
  });
});
