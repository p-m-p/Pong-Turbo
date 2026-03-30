import { BONUS_COMPLETION_SCORE, LEVEL_CLEAR_SCORE_MULT } from '../constants.js';

/**
 * Score awarded for a ball-hit rally.
 * @param {number} gameSpeed
 * @returns {number}
 */
export function rallyScore(gameSpeed) {
  return gameSpeed;
}

/**
 * Score awarded on normal level clear.
 * @param {number} level
 * @returns {number}
 */
export function levelClearScore(level) {
  return level * LEVEL_CLEAR_SCORE_MULT;
}

/**
 * Score awarded on bonus round clear.
 * @param {number} level
 * @returns {number}
 */
export function bonusClearScore(level) {
  return BONUS_COMPLETION_SCORE * level;
}

/**
 * Score awarded for a multi-kill ghost combo.
 * Formula: level × gameSpeed × count × 2^(count-1)
 *
 * @param {number} level
 * @param {number} gameSpeed
 * @param {number} count  - number of ghosts killed in one shot
 * @returns {number}
 */
export function ghostKillScore(level, gameSpeed, count) {
  return level * gameSpeed * count * Math.pow(2, count - 1);
}

/**
 * Score awarded for killing aliens in the bonus round.
 * Formula: level × gameSpeed × count × 2^(count-1)  (same exponential pattern)
 *
 * @param {number} level
 * @param {number} gameSpeed
 * @param {number} count
 * @returns {number}
 */
export function alienKillScore(level, gameSpeed, count) {
  return level * gameSpeed * count * Math.pow(2, count - 1);
}
