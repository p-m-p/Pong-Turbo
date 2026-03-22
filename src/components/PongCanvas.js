import { CanvasRenderAdapter }  from '../adapters/browser/CanvasRenderAdapter.js';
import { KeyboardInputAdapter } from '../adapters/browser/KeyboardInputAdapter.js';
import { TouchInputAdapter }    from '../adapters/browser/TouchInputAdapter.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 0.75rem 0;
      overflow: hidden;
      min-height: 0;
    }
    #start-screen {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    #start-screen.hidden { display: none; }
    #startGame {
      font-family: 'Play', helvetica, arial, sans-serif;
      font-size: 1.375rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--base);
      background: var(--mauve);
      border: none;
      border-radius: 8px;
      padding: 0.75rem 3.5rem;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.1s ease;
    }
    #startGame:hover  { background: var(--lavender); transform: scale(1.03); }
    #startGame:active { transform: scale(0.97); }
    canvas {
      display: block;
      background: var(--mantle);
      border-radius: 6px;
      border: 1px solid var(--surface-0);
      box-shadow: 0 0 0 1px var(--surface-0), 0 0 40px rgba(180, 190, 254, 0.07);
      flex-shrink: 0;
    }
    #touch-control {
      display: none;
      position: fixed;
      right: 0; top: 0; bottom: 0;
      width: 64px;
      padding: 1.5rem 0;
      touch-action: none;
      user-select: none;
      cursor: ns-resize;
    }
    #touch-track {
      position: absolute;
      left: 50%; top: 1.5rem; bottom: 1.5rem;
      width: 2px;
      transform: translateX(-50%);
      background: var(--surface-1);
      border-radius: 2px;
    }
    #touch-knob {
      position: absolute;
      left: 50%; top: 0;
      width: 38px; height: 56px;
      transform: translateX(-50%);
      background: var(--surface-0);
      border: 1.5px solid var(--lavender);
      border-radius: 19px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 10px rgba(180, 190, 254, 0.2);
    }
    .knob-lines {
      display: block;
      width: 14px; height: 1.5px;
      background: var(--overlay-0);
      border-radius: 1px;
      box-shadow: 0 -5px 0 var(--overlay-0), 0 5px 0 var(--overlay-0);
    }
    @media (pointer: coarse) and (orientation: landscape) {
      :host          { padding: 0.75rem 64px; }
      #touch-control { display: block; }
    }
    @media (max-height: 480px) and (orientation: landscape) {
      :host { padding-top: 0.25rem; padding-bottom: 0.25rem; }
    }
  </style>
  <div id="start-screen">
    <button id="startGame">Play</button>
  </div>
  <canvas id="pongBoard">
    <p>Your browser does not support HTML5 Canvas. Please update to a modern browser.</p>
  </canvas>
  <div id="touch-control"
       role="slider"
       aria-label="Drag to move paddle"
       aria-orientation="vertical"
       aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
    <div id="touch-track"></div>
    <div id="touch-knob"><span class="knob-lines"></span></div>
  </div>
`;

export class PongCanvas extends HTMLElement {
  #render;
  #keyboard;
  #touch;

  connectedCallback() {
    if (this.shadowRoot) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.appendChild(template.content.cloneNode(true));

    const canvas = shadow.getElementById('pongBoard');
    const knob   = shadow.getElementById('touch-knob');
    const zone   = shadow.getElementById('touch-control');

    this.#keyboard = new KeyboardInputAdapter();
    this.#keyboard.init();

    this.#touch  = new TouchInputAdapter(this.#keyboard);
    this.#render = new CanvasRenderAdapter(canvas, this, knob, zone);
    this.#render.init();

    shadow.getElementById('startGame').addEventListener('click', () => {
      shadow.getElementById('start-screen').classList.add('hidden');
      document.getElementById('soundtrack')?.play().catch(() => {});
      this.dispatchEvent(new CustomEvent('game-start', { bubbles: true, composed: true }));
    }, { once: true });
  }

  get renderAdapter() { return this.#render; }
  get inputAdapter()  { return this.#touch; }

  hideStartScreen() {
    this.shadowRoot?.getElementById('start-screen')?.classList.add('hidden');
  }

  /** Wire touch zone events — call after startNewGame sets the paddle height. */
  initInput(paddleH) {
    this.#touch.init(
      this.shadowRoot.getElementById('touch-control'),
      paddleH,
    );
  }
}

customElements.define('pong-canvas', PongCanvas);
