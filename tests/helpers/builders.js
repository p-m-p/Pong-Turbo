import { createBall }   from '../../src/domain/entities/Ball.js';
import { createPaddle } from '../../src/domain/entities/Paddle.js';
import {
  VIRTUAL_W,
  VIRTUAL_H,
  BALL_SIZE,
  PADDLE_W,
  PADDLE_BASE_H,
  PADDLE_X,
  INITIAL_SPEED,
} from '../../src/domain/constants.js';

/**
 * Build a default ball at a specified position (defaults to left-centre).
 * @param {Partial<{x,y,w,h,dx,dy}>} overrides
 */
export function makeBall(overrides = {}) {
  return createBall(
    overrides.x  ?? 40,
    overrides.y  ?? VIRTUAL_H / 2,
    overrides.w  ?? BALL_SIZE,
    overrides.h  ?? BALL_SIZE,
    overrides.dx ?? 0,
    overrides.dy ?? 0,
  );
}

/**
 * Build a default paddle at the right edge, vertically centred.
 * @param {Partial<{x,y,w,h,moveY,velocity,vy}>} overrides
 */
export function makePaddle(overrides = {}) {
  const p = createPaddle(
    overrides.x ?? PADDLE_X,
    overrides.y ?? (VIRTUAL_H - PADDLE_BASE_H) / 2,
    overrides.w ?? PADDLE_W,
    overrides.h ?? PADDLE_BASE_H,
  );
  if (overrides.moveY    !== undefined) p.moveY    = overrides.moveY;
  if (overrides.velocity !== undefined) p.velocity = overrides.velocity;
  if (overrides.vy       !== undefined) p.vy       = overrides.vy;
  return p;
}

/**
 * Build a ball positioned just left of the paddle, moving right.
 * Ready to trigger a paddle hit on the next moveBall/checkPaddleHit tick.
 */
export function makeBallAtPaddle(paddle, overrides = {}) {
  return makeBall({
    // Overlap the paddle by 2px so aabb() returns true
    x: paddle.x - BALL_SIZE + 2,
    y: paddle.y + (paddle.h / 2) - (BALL_SIZE / 2),
    dx: INITIAL_SPEED,
    dy: 0,
    ...overrides,
  });
}
