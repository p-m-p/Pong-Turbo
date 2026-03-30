const STORAGE_KEY = 'pongTurbo.muted';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; }
    button {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      background: transparent;
      border: none;
      padding: 4px 0;
      cursor: pointer;
      color: var(--text-dim);
      transition: color 0.05s;
    }
    button svg { display: block; width: 32px; height: 32px; flex-shrink: 0; }
    button:hover { color: var(--accent); }
    button.muted { color: var(--dim); }
    .sound-waves { display: block; }
    .mute-x { display: none; }
    button.muted .sound-waves { display: none; }
    button.muted .mute-x { display: block; }
    @media (max-height: 480px) and (orientation: landscape) {
      button svg { width: 22px; height: 22px; }
    }
  </style>
  <button aria-label="Mute sound">
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <!-- Speaker body -->
      <rect x="1" y="8" width="5" height="8" rx="0"/>
      <!-- Cone -->
      <polygon points="6,8 13,3 13,21 6,16"/>
      <!-- Sound waves -->
      <path class="sound-waves" d="M16 8.5 Q19.5 12 16 15.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path class="sound-waves" d="M18.5 5.5 Q23.5 12 18.5 18.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- Muted X -->
      <line class="mute-x" x1="15" y1="9" x2="22" y2="16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <line class="mute-x" x1="22" y1="9" x2="15" y2="16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  </button>
`;

export class PongSoundToggle extends HTMLElement {
  #btn;
  #soundtrack;

  connectedCallback() {
    if (this.shadowRoot) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.append(template.content.cloneNode(true));
    this.#btn = shadow.querySelector('button');
    this.#soundtrack = document.querySelector(
      `#${this.getAttribute('soundtrack') ?? 'soundtrack'}`,
    );

    if (localStorage.getItem(STORAGE_KEY) === 'true') {
      if (this.#soundtrack) this.#soundtrack.muted = true;
      this.#btn.classList.add('muted');
      this.#btn.setAttribute('aria-label', 'Unmute sound');
    }

    this.#btn.addEventListener('click', () => {
      if (!this.#soundtrack) return;
      this.#soundtrack.muted = !this.#soundtrack.muted;
      localStorage.setItem(STORAGE_KEY, this.#soundtrack.muted);
      this.#btn.classList.toggle('muted', this.#soundtrack.muted);
      this.#btn.setAttribute('aria-label', this.#soundtrack.muted ? 'Unmute sound' : 'Mute sound');
      this.#btn.blur();
    });
  }
}

customElements.define('pong-sound-toggle', PongSoundToggle);
