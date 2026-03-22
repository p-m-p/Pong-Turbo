import { describe, it, expect } from 'vitest';
import { Alien } from '../../../src/domain/entities/Alien.js';

function makeAlien(hp = 2) {
  return new Alien(50, 50, hp, '#0f0');
}

describe('Alien', () => {
  it('starts with full hp', () => {
    const a = makeAlien(3);
    expect(a.hp).toBe(3);
    expect(a.maxHp).toBe(3);
  });

  it('is not dead at full hp', () => {
    expect(makeAlien().dead).toBe(false);
  });

  it('reduces hp on hit', () => {
    const a = makeAlien(2);
    a.hit();
    expect(a.hp).toBe(1);
  });

  it('is dead when hp reaches 0', () => {
    const a = makeAlien(1);
    a.hit();
    expect(a.dead).toBe(true);
  });

  it('hp does not go below 0', () => {
    const a = makeAlien(1);
    a.hit();
    a.hit();
    expect(a.hp).toBe(0);
  });

  it('exposes color', () => {
    const a = new Alien(0, 0, 1, '#abc');
    expect(a.color).toBe('#abc');
  });
});
