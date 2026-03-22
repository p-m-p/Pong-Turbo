import { describe, it, expect } from 'vitest';
import { moveBall, launchBall, checkPaddleHit, updateReadyBall } from '../../../src/domain/physics/ball.js';
import { makeBall, makePaddle, makeBallAtPaddle }                from '../../helpers/builders.js';
import { VIRTUAL_W, VIRTUAL_H, INITIAL_SPEED }                   from '../../../src/domain/constants.js';

describe('moveBall', () => {
  it('moves the ball by dx/dy × timeScale', () => {
    const ball = makeBall({ x: 100, y: 100, dx: 4, dy: 2 });
    moveBall(ball, 1);
    expect(ball.x).toBe(104);
    expect(ball.y).toBe(102);
  });

  it('applies timeScale to movement', () => {
    const ball = makeBall({ x: 100, y: 100, dx: 10, dy: 5 });
    moveBall(ball, 0.5);
    expect(ball.x).toBe(105);
    expect(ball.y).toBe(102.5);
  });

  it('bounces off the top wall', () => {
    const ball = makeBall({ x: 100, y: 0, dx: 0, dy: -5 });
    moveBall(ball, 1);
    expect(ball.dy).toBeGreaterThan(0);
  });

  it('bounces off the bottom wall', () => {
    const b = makeBall({ x: 100, y: VIRTUAL_H - 10, dx: 0, dy: 5 });
    moveBall(b, 1);
    expect(b.dy).toBeLessThan(0);
  });

  it('bounces off the left wall', () => {
    const ball = makeBall({ x: 0, dx: -5, dy: 0 });
    moveBall(ball, 1);
    expect(ball.dx).toBeGreaterThan(0);
  });

  it('returns "out" when ball exits the right edge', () => {
    const ball = makeBall({ x: VIRTUAL_W - 5, dx: 10, dy: 0 });
    const result = moveBall(ball, 1);
    expect(result).toBe('out');
  });

  it('returns "ok" for a normal move', () => {
    const ball = makeBall({ x: 100, y: 100, dx: 2, dy: 2 });
    expect(moveBall(ball, 1)).toBe('ok');
  });
});

describe('launchBall', () => {
  it('sets negative dx (moving toward ghosts / left)', () => {
    const ball = makeBall();
    launchBall(ball, INITIAL_SPEED);
    expect(ball.dx).toBeLessThan(0);
  });

  it('sets non-zero dy', () => {
    const ball = makeBall();
    launchBall(ball, INITIAL_SPEED);
    expect(ball.dy).not.toBe(0);
  });

  it('speeds scale with gameSpeed', () => {
    const ball = makeBall();
    launchBall(ball, 32);
    expect(Math.abs(ball.dx)).toBeGreaterThan(Math.abs(INITIAL_SPEED / 2));
  });
});

describe('checkPaddleHit', () => {
  it('returns null when ball does not overlap paddle', () => {
    const paddle = makePaddle();
    const ball   = makeBall({ x: 10, y: 10 });
    expect(checkPaddleHit(ball, paddle, INITIAL_SPEED, INITIAL_SPEED, 0, 0)).toBeNull();
  });

  it('returns new ballSpeed on hit', () => {
    const paddle = makePaddle();
    const ball   = makeBallAtPaddle(paddle);
    const result = checkPaddleHit(ball, paddle, INITIAL_SPEED, INITIAL_SPEED, 0, 0);
    expect(result).not.toBeNull();
    expect(result.ballSpeed).toBeGreaterThanOrEqual(INITIAL_SPEED);
  });

  it('reverses ball dx to negative on hit', () => {
    const paddle = makePaddle();
    const ball   = makeBallAtPaddle(paddle);
    checkPaddleHit(ball, paddle, INITIAL_SPEED, INITIAL_SPEED, 0, 0);
    expect(ball.dx).toBeLessThan(0);
  });

  it('ball passes through stunned paddle during low-alpha phase', () => {
    const paddle              = makePaddle();
    const ball                = makeBallAtPaddle(paddle);
    // Force a time where sin gives a low alpha value:
    // alpha = 0.55 + 0.45 * sin(t * 0.019). We need alpha < 0.4, i.e. sin < -1/3
    // sin(π + π/6) ≈ -0.5 → t ≈ (7π/6) / 0.019 ≈ 1152
    const now                 = Math.round((7 * Math.PI / 6) / 0.019);
    const paddleStunnedUntil  = now + 2000;
    const result = checkPaddleHit(ball, paddle, INITIAL_SPEED, INITIAL_SPEED, paddleStunnedUntil, now);
    expect(result).toBeNull();
  });
});

describe('updateReadyBall', () => {
  it('returns "drifting" before READY_PAUSE_MS has elapsed', () => {
    const ball   = makeBall({ x: 40 });
    const paddle = makePaddle();
    const now    = 500;
    const result = updateReadyBall(ball, paddle, INITIAL_SPEED, 0, now, 1);
    expect(result).toBe('drifting');
  });

  it('returns "launched" when ball reaches paddle horizontally', () => {
    const paddle = makePaddle();
    // Place ball just at paddle edge, overlapping vertically
    const ball   = makeBall({
      x:  paddle.x - 9,
      y:  paddle.y + paddle.h / 2,
      dx: 0,
      dy: 0,
    });
    const now       = 2000;
    const readySince = 0;
    const result = updateReadyBall(ball, paddle, INITIAL_SPEED, readySince, now, 1);
    expect(result).toBe('launched');
  });

  it('resets ball x and returns "reset" when ball misses paddle', () => {
    const paddle = makePaddle({ y: 0, h: 10 }); // paddle near top
    const ball   = makeBall({
      x: paddle.x - 9,
      y: VIRTUAL_H - 20, // ball is far below paddle
    });
    const result = updateReadyBall(ball, paddle, INITIAL_SPEED, 0, 2000, 1);
    expect(result).toBe('reset');
    expect(ball.x).toBe(40);
  });
});
