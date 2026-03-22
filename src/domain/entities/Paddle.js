export function createPaddle(x, y, w, h) {
  return { x, y, w, h, moveY: null, velocity: 0, vy: 0 };
}
