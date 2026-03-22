const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: flex;
      align-items: flex-start;
      gap: 1.25rem;
    }
    #score-display {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.375rem;
    }
    #score {
      font-family: 'Play', helvetica, arial, sans-serif;
      font-weight: 700;
      font-size: clamp(1.5rem, 4vw, 2.75rem);
      line-height: 1;
      color: var(--mauve);
      letter-spacing: -0.02em;
      min-width: 5ch;
      text-align: right;
    }
    #lives {
      display: flex;
      gap: 5px;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .life {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid var(--green);
      transition: background 0.2s ease;
    }
    .life.active {
      background: var(--green);
    }
    @media (max-height: 480px) and (orientation: landscape) {
      :host          { align-items: center; gap: 0.5rem; }
      #score-display { flex-direction: row; align-items: center; gap: 0.5rem; }
      #score         { font-size: 1rem; min-width: auto; }
      #lives         { gap: 3px; }
      .life          { width: 6px; height: 6px; border-width: 1.5px; }
    }
  </style>
  <div id="score-display">
    <span id="score">0</span>
    <ul id="lives" role="list" aria-label="Lives remaining"></ul>
  </div>
`;

export class PongHud extends HTMLElement {
  #scoreEl;
  #livesEl;

  connectedCallback() {
    if (this.shadowRoot) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.appendChild(template.content.cloneNode(true));
    this.#scoreEl = shadow.getElementById('score');
    this.#livesEl = shadow.getElementById('lives');
    this.#buildLives(parseInt(this.getAttribute('lives') ?? 5));
  }

  #buildLives(count) {
    this.#livesEl.innerHTML = Array.from({ length: count }, (_, i) =>
      `<li class="life active" aria-label="Life ${i + 1}"></li>`
    ).join('');
  }

  /** @param {number} score */
  updateScore(score) {
    if (this.#scoreEl) this.#scoreEl.textContent = score.toLocaleString();
  }

  /** @param {number} lives */
  updateLives(lives) {
    this.shadowRoot?.querySelectorAll('.life').forEach((el, i) => {
      const active = i < lives;
      el.classList.toggle('active', active);
      el.setAttribute('aria-label', `Life ${i + 1}${active ? '' : ' (lost)'}`);
    });
  }

  /** @param {number} lives */
  reset(lives) {
    if (this.#scoreEl) this.#scoreEl.textContent = '0';
    this.#buildLives(lives);
  }
}

customElements.define('pong-hud', PongHud);
