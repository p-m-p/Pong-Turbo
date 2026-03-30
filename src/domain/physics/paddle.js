import { PADDLE_ACCEL, PADDLE_DECEL } from '../constants.js';

/**
 * Move the paddle one tick.
 * Mutates paddle.y, paddle.velocity, and paddle.vy.
 *
 * @param {{ y, h, moveY: 'up'|'down'|null, velocity: number, vy: number }} paddle
 * @param {number} canvasH    - virtual canvas height
 * @param {number} baseSpeed  - current game speed
 */
export function movePaddle(paddle, canvasH, baseSpeed) {
  const prevY = paddle.y;

  if (paddle.moveY === 'up' || paddle.moveY === 'down') {
    const direction = paddle.moveY === 'up' ? -1 : 1;
    paddle.velocity = Math.max(-1, Math.min(1, paddle.velocity + direction * PADDLE_ACCEL));
    paddle.y = Math.max(0, Math.min(canvasH - paddle.h, paddle.y + paddle.velocity * baseSpeed));
    paddle.vy = paddle.y - prevY;
  } else {
    const abs = Math.abs(paddle.velocity);
    paddle.velocity =
      abs <= PADDLE_DECEL ? 0 : paddle.velocity - Math.sign(paddle.velocity) * PADDLE_DECEL;

    if (paddle.velocity !== 0) {
      paddle.y = Math.max(0, Math.min(canvasH - paddle.h, paddle.y + paddle.velocity * baseSpeed));
    }

    paddle.vy *= 0.7;
    if (Math.abs(paddle.vy) < 0.1) paddle.vy = 0;
  }
}
