import { describe, it, expect, beforeEach } from 'vitest';
import { GhostSystem } from '../../../src/domain/systems/GhostSystem.js';
import { makeBall, makePaddle } from '../../helpers/builders.js';
import { VIRTUAL_H, VIRTUAL_W, GHOST_COUNT } from '../../../src/domain/constants.js';

const SPEED = 16;

let sys;
beforeEach(() => {
  sys = new GhostSystem();
  sys.spawn();
});

describe('GhostSystem spawn', () => {
  it('creates the default number of ghosts', () => {
    expect(sys.ghosts.length).toBe(GHOST_COUNT);
  });

  it('allDead returns false after spawn', () => {
    expect(sys.allDead()).toBe(false);
  });

  it('allDead returns true on an empty system', () => {
    const empty = new GhostSystem();
    expect(empty.allDead()).toBe(true);
  });
});

describe('GhostSystem move', () => {
  it('does not throw when called', () => {
    expect(() => sys.move(VIRTUAL_H, VIRTUAL_W, 585, SPEED)).not.toThrow();
  });

  it('ghosts stay within vertical bounds after many ticks', () => {
    for (let i = 0; i < 300; i++) sys.move(VIRTUAL_H, VIRTUAL_W, 585, SPEED);
    for (const g of sys.ghosts) {
      expect(g.y).toBeGreaterThanOrEqual(0);
      expect(g.y + g.h).toBeLessThanOrEqual(VIRTUAL_H);
    }
  });
});

describe('GhostSystem checkPaddleCollision', () => {
  it('returns false when no ghost overlaps the paddle', () => {
    const paddle = makePaddle({ x: 500, y: 300 });
    expect(sys.checkPaddleCollision(paddle)).toBe(false);
  });

  it('returns true when a ghost overlaps the paddle', () => {
    // Place first ghost directly on the paddle
    const paddle = makePaddle({ x: 500, y: 100 });
    sys.ghosts[0].x = paddle.x + 1;
    sys.ghosts[0].y = paddle.y + 1;
    expect(sys.checkPaddleCollision(paddle)).toBe(true);
  });
});

describe('GhostSystem checkCollision', () => {
  it('returns null when ball does not hit any ghost', () => {
    const ball = makeBall({ x: 550, y: 350 });
    expect(sys.checkCollision(ball)).toBeNull();
  });

  it('removes hit ghost and returns kill info', () => {
    const g    = sys.ghosts[0];
    const ball = makeBall({ x: g.x, y: g.y, w: g.w, h: g.h });
    const before = sys.ghosts.length;
    const result = sys.checkCollision(ball);
    expect(result).not.toBeNull();
    expect(result.count).toBe(1);
    expect(sys.ghosts.length).toBe(before - 1);
  });

  it('counts multi-kills', () => {
    // Place two ghosts on top of each other
    sys.ghosts[1].x = sys.ghosts[0].x;
    sys.ghosts[1].y = sys.ghosts[0].y;
    const g    = sys.ghosts[0];
    const ball = makeBall({ x: g.x, y: g.y, w: g.w, h: g.h });
    const result = sys.checkCollision(ball);
    expect(result.count).toBeGreaterThanOrEqual(2);
  });
});
