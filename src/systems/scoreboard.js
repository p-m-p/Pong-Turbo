export class Scoreboard {
  #scoreEl;
  #lifeEls;

  constructor() {
    this.#scoreEl = document.getElementById('playerscore');
    this.#lifeEls = document.querySelectorAll('.life');
  }

  updateScore(score) {
    this.#scoreEl.textContent = score.toLocaleString();
  }

  updateLives(lives) {
    this.#lifeEls.forEach((el, i) => {
      const active = i < lives;
      el.classList.toggle('active', active);
      el.setAttribute('aria-label', `Life ${i + 1}${active ? '' : ' (lost)'}`);
    });
  }

  reset(lives) {
    this.#scoreEl.textContent = '0';
    this.updateLives(lives);
  }
}
