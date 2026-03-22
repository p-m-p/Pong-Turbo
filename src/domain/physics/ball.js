import {
  VIRTUAL_W,
  VIRTUAL_H,
  READY_PAUSE_MS,
  RALLY_INCREMENT,
  RALLY_CAP,
  SPIN_FACTOR,
  STUN_PASSTHROUGH_ALPHA,
  STUN_PULSE_ANGULAR_FREQ,
} from '../constants.js';
import { aabb } from './collision.js';

/**
 * Move the ball one tick and handle wall bounces.
 * Returns 'out' if the ball exits the right edge, 'ok' otherwise.
 * Does NOT handle paddle or ghost collisions — those are the caller's concern.
 *
 * @param {{ x,y,w,h,dx,dy }} ball
 * @param {number} timeScale
 * @returns {'ok'|'out'}
 */
export function moveBall(ball, timeScale, fieldW = VIRTUAL_W) {
  // Top / bottom wall bounce
  if (ball.y <= 0)                   ball.dy =  Math.abs(ball.dy);
  if (ball.y + ball.h >= VIRTUAL_H)  ball.dy = -Math.abs(ball.dy);

  // Left wall bounce
  if (ball.x <= 0) ball.dx = Math.abs(ball.dx);

  // Right edge exit
  if (ball.x + ball.w >= fieldW) return 'out';

  ball.x += ball.dx * timeScale;
  ball.y += ball.dy * timeScale;
  return 'ok';
}

/**
 * Advance the ball during the ready/serve state.
 * Returns 'launched' | 'reset' | 'drifting'.
 *
 * @param {{ x,y,w,h,dx,dy }} ball
 * @param {{ x,y,w,h }}        paddle
 * @param {number}             gameSpeed
 * @param {number}             readySince  - timestamp the ready state began
 * @param {number}             now         - current timestamp
 * @param {number}             timeScale
 * @returns {'launched'|'reset'|'drifting'}
 */
export function updateReadyBall(ball, paddle, gameSpeed, readySince, now, timeScale) {
  const age = now - readySince;

  if (age > READY_PAUSE_MS) {
    ball.x += (gameSpeed / 2) * timeScale;
  }

  if (ball.x + ball.w >= paddle.x) {
    const overlapsY = ball.y + ball.h > paddle.y && ball.y < paddle.y + paddle.h;
    if (overlapsY) {
      return 'launched';
    }
    // Missed — reset to left
    ball.x = 40;
    return 'reset';
  }

  return 'drifting';
}

/**
 * Apply launch velocity to a ball after a successful serve.
 * Mutates ball.dx and ball.dy.
 *
 * @param {{ dx, dy }} ball
 * @param {number}     gameSpeed
 */
export function launchBall(ball, gameSpeed) {
  ball.dx = -(gameSpeed / 2);
  ball.dy = (Math.random() > 0.5 ? 1 : -1) * (gameSpeed / 2);
}

/**
 * Check whether the ball has hit the paddle and apply the bounce.
 * Returns the new ballSpeed, or null if no hit occurred.
 *
 * @param {{ x,y,w,h,dx,dy }}  ball
 * @param {{ x,y,w,h,vy }}     paddle
 * @param {number}             gameSpeed
 * @param {number}             ballSpeed
 * @param {number}             paddleStunnedUntil  - timestamp; 0 = not stunned
 * @param {number}             now
 * @returns {{ ballSpeed: number }|null}
 */
export function checkPaddleHit(ball, paddle, gameSpeed, ballSpeed, paddleStunnedUntil, now) {
  if (!aabb(ball, paddle)) return null;

  // Stunned paddle: ball passes through during low-alpha phase
  if (paddleStunnedUntil > now) {
    const alpha = 0.55 + 0.45 * Math.sin(now * STUN_PULSE_ANGULAR_FREQ);
    if (alpha < STUN_PASSTHROUGH_ALPHA) return null;
  }

  const newBallSpeed = Math.min(gameSpeed + RALLY_CAP, ballSpeed + RALLY_INCREMENT);

  const x = Math.max(newBallSpeed / 2, Math.abs(Math.round(newBallSpeed * Math.random())));
  ball.dy  = ball.dy < 0 ? -(newBallSpeed - x) : (newBallSpeed - x);
  ball.dx  = -x;

  const spin  = Math.max(-newBallSpeed * 0.6, Math.min(newBallSpeed * 0.6, paddle.vy * SPIN_FACTOR));
  const maxDy = newBallSpeed * 1.5;
  ball.dy     = Math.max(-maxDy, Math.min(maxDy, ball.dy + spin));

  return { ballSpeed: newBallSpeed };
}
