/**
 * @typedef {Object} ScorePort
 * @property {(score: number) => void} updateScore
 * @property {(lives: number) => void} updateLives
 * @property {(lives: number) => void} reset
 */
export function assertScorePort(adapter) {
  for (const m of ['updateScore', 'updateLives', 'reset']) {
    if (typeof adapter[m] !== 'function')
      throw new Error(`ScorePort: missing ${m}()`);
  }
}
