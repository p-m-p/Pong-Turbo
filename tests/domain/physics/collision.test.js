import { describe, it, expect } from 'vitest';
import { aabb } from '../../../src/domain/physics/collision.js';

const box = (x, y, w = 10, h = 10) => ({ x, y, w, h });

describe('aabb', () => {
  it('returns true when boxes overlap', () => {
    expect(aabb(box(0, 0), box(5, 5))).toBe(true);
  });

  it('returns false when boxes are separated horizontally', () => {
    expect(aabb(box(0, 0), box(20, 0))).toBe(false);
  });

  it('returns false when boxes are separated vertically', () => {
    expect(aabb(box(0, 0), box(0, 20))).toBe(false);
  });

  it('returns false when edges merely touch (not overlap)', () => {
    // a ends at x=10, b starts at x=10 — touching is not an overlap
    expect(aabb(box(0, 0), box(10, 0))).toBe(false);
    expect(aabb(box(0, 0), box(0, 10))).toBe(false);
  });

  it('returns true for a 1-unit overlap', () => {
    expect(aabb(box(0, 0, 10, 10), box(9, 0, 10, 10))).toBe(true);
  });

  it('handles one box fully inside the other', () => {
    expect(aabb(box(0, 0, 100, 100), box(10, 10, 5, 5))).toBe(true);
  });
});
