export class Scoreboard {
  #scoreEl;
  #lifeEls;

  constructor() {
    this.#scoreEl = document.getElementById('playerscore');
    this.#lifeEls = document.querySelectorAll('.ball');
  }

  updateScore(score) {
    this.#scoreEl.textContent = score;
  }

  updateLives(lives) {
    this.#lifeEls.forEach((el, i) => {
      el.className = i < lives ? 'ball' : 'ball dead';
    });
  }

  reset(lives) {
    this.#scoreEl.textContent = '0';
    this.updateLives(lives);
  }
}
