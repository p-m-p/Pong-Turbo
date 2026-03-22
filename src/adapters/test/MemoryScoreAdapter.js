export class MemoryScoreAdapter {
  score   = 0;
  lives   = 0;
  history = [];

  updateScore(score) { this.score = score; this.history.push({ event: 'score', value: score }); }
  updateLives(lives) { this.lives = lives; this.history.push({ event: 'lives', value: lives }); }
  reset(lives)       { this.score = 0; this.lives = lives; this.history.push({ event: 'reset', value: lives }); }
}
