import { CanvasRenderAdapter }  from '../adapters/browser/CanvasRenderAdapter.js';
import { KeyboardInputAdapter } from '../adapters/browser/KeyboardInputAdapter.js';
import { TouchInputAdapter }    from '../adapters/browser/TouchInputAdapter.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: flex;
      flex-direction: row;
      align-items: stretch;
      overflow: hidden;
      min-height: 0;
    }
    #canvas-wrap {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      min-height: 0;
      padding: 8px;
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
      font-family: 'Press Start 2P', monospace;
      font-size: 1rem;
      letter-spacing: 0.08em;
      color: #000000;
      background: #ffff00;
      border: 3px solid #ffffff;
      border-radius: 0;
      padding: 0.75rem 3rem;
      cursor: pointer;
      transition: background 0.05s;
    }
    #startGame:hover  { background: #ffffff; }
    #startGame:active { background: #cccc00; }
    canvas {
      display: block;
      background: #000000;
      border: 2px solid #333333;
      flex-shrink: 0;
    }
    #touch-control {
      display: none;
      width: 64px;
      flex-shrink: 0;
      position: relative;
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
      background: #333333;
    }
    #touch-knob {
      position: absolute;
      left: 50%; top: 0;
      width: 38px; height: 56px;
      transform: translateX(-50%);
      background: #111111;
      border: 2px solid #ffff00;
      border-radius: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .knob-lines {
      display: block;
      width: 14px; height: 2px;
      background: #ffff00;
      box-shadow: 0 -5px 0 #ffff00, 0 5px 0 #ffff00;
    }
    @media (pointer: coarse) and (orientation: landscape) {
      #touch-control           { display: flex; flex-direction: column; justify-content: center; visibility: hidden; }
      :host([playing]) #touch-control { visibility: visible; }
    }
  </style>
  <div id="canvas-wrap">
    <div id="start-screen">
      <button id="startGame">PLAY</button>
    </div>
    <canvas id="pongBoard">
      <p>Your browser does not support HTML5 Canvas. Please update to a modern browser.</p>
    </canvas>
  </div>
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

    const canvas     = shadow.getElementById('pongBoard');
    const canvasWrap = shadow.getElementById('canvas-wrap');
    const knob       = shadow.getElementById('touch-knob');
    const zone       = shadow.getElementById('touch-control');

    this.#keyboard = new KeyboardInputAdapter();
    this.#keyboard.init();

    this.#touch  = new TouchInputAdapter(this.#keyboard);
    this.#render = new CanvasRenderAdapter(canvas, canvasWrap, knob, zone);
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
