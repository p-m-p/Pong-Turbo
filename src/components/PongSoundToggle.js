const STORAGE_KEY = 'pongTurbo.muted';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; }
    button {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #111111;
      border: 2px solid #333333;
      border-radius: 0;
      padding: 6px;
      cursor: pointer;
      color: #888888;
      transition: color 0.05s, border-color 0.05s;
    }
    button svg  { display: block; width: 100%; height: 100%; }
    button:hover { color: #ffffff; border-color: #ffff00; }
    button.muted { color: #444444; }
    .mute-slash { display: none; }
    button.muted .mute-slash { display: block; }
    @media (max-height: 480px) and (orientation: landscape) {
      button { width: 26px; height: 26px; padding: 4px; }
    }
  </style>
  <button aria-label="Mute sound">
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path fill-rule="evenodd" d="M19.952 1.651a.75.75 0 01.298.599V16.303a3 3 0 01-2.176 2.884l-1.32.377a2.553 2.553 0 11-1.403-4.909l2.311-.66a1.5 1.5 0 001.088-1.442V6.994l-9 2.572v9.737a3 3 0 01-2.176 2.884l-1.32.377a2.553 2.553 0 11-1.402-4.909l2.31-.66a1.5 1.5 0 001.088-1.442V9.994a.75.75 0 01.544-.721l10.5-3a.75.75 0 01.658.096z" clip-rule="evenodd"/>
      <line class="mute-slash" x1="3" y1="21" x2="21" y2="3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
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
