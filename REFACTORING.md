# Pong Turbo — Refactoring Plan

Hexagonal architecture (ports & adapters) so every domain module is testable in isolation with Vitest, using real in-memory test adapters instead of mocks.

---

## The Problem

`src/game.js` is a ~600-line God Object. All game state, physics, collision detection, rendering, input handling, audio, and lifecycle live inside one closure. Specific problems:

- **Untestable**: all logic is trapped behind `initGame()` — no surface to call.
- **Entities mix concerns**: `Ghost`, `Alien`, `PowerUp` each contain canvas `draw()` code alongside their physics logic. You can't test movement without a canvas context.
- **Time is ambient**: `performance.now()` is called inline inside `isLive()`, `expired()`, pulse calculations. Tests cannot control time.
- **Scoreboard and audio are I/O**: `Scoreboard` manipulates the DOM directly; `audio.js` calls the Web Audio API. Both require a browser to run.
- **No defined interfaces**: systems communicate through the `game.js` closure. There is no contract to test against.

---

## Target Architecture

Three concentric rings:

```
┌─────────────────────────────────────────────────┐
│  Browser Adapters                               │
│  (Canvas, WebAudio, Keyboard, Touch, DOM)       │
│  ┌───────────────────────────────────────────┐  │
│  │  Ports (interfaces)                       │  │
│  │  RenderPort  AudioPort  InputPort         │  │
│  │  ScorePort                                │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  Domain Core (pure JS, no I/O)      │  │  │
│  │  │  entities · physics · systems       │  │  │
│  │  │  GameState · GameLoop               │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         ↕  (test adapters plug in here)
┌─────────────────────────────────────────────────┐
│  Test Adapters (in-memory, no mocks)            │
│  RecordingRenderAdapter  NullAudioAdapter       │
│  ScriptedInputAdapter    MemoryScoreAdapter     │
└─────────────────────────────────────────────────┘
```

The domain core has **zero I/O dependencies** — no canvas, no DOM, no Web Audio, no `performance.now()`. It can be imported in Node.js and exercised by Vitest with no setup.

---

## Proposed File Structure

```
src/
├── domain/                          ← pure logic, no I/O
│   ├── constants.js                 ← all tuning values from game.js
│   ├── GameState.js                 ← createGameState() factory
│   ├── GameLoop.js                  ← update(state, timeScale, now, input)
│   ├── entities/
│   │   ├── Ball.js             ← data only: {x,y,w,h,dx,dy}
│   │   ├── Paddle.js           ← data only: {x,y,w,h,moveY,velocity,vy}
│   │   ├── Ghost.js            ← state machine (no draw)
│   │   ├── Alien.js            ← hp logic (no draw)
│   │   └── PowerUp.js           ← isLive(now) / expired(now)
│   ├── physics/
│   │   ├── collision.js             ← aabb(), checkPaddleHit()
│   │   ├── ballPhysics.js           ← moveBall(), updateReadyBall(), launchBall()
│   │   └── paddlePhysics.js         ← movePaddle()
│   └── systems/
│       ├── GhostSystem.js           ← spawn/move/checkCollision (no draw)
│       ├── AlienSystem.js           ← spawn/move/checkCollision/reachedX (no draw)
│       ├── PowerUpSystem.js         ← trySpawn(cx,cy,count,now) / checkCollision
│       └── ScoringRules.js          ← pure scoring formula functions
│
├── ports/                           ← JSDoc @typedef contracts
│   ├── RenderPort.js
│   ├── AudioPort.js
│   ├── InputPort.js
│   └── ScorePort.js
│
├── adapters/
│   ├── browser/                     ← concrete browser implementations
│   │   ├── CanvasRenderAdapter.js   ← all ctx.* calls, extracted from game.js draw()
│   │   ├── WebAudioAdapter.js       ← wraps systems/audio.js
│   │   ├── KeyboardInputAdapter.js  ← extracts setupControls() from game.js
│   │   ├── TouchInputAdapter.js     ← extracts setupTouchControl() from game.js
│   │   └── DOMScoreAdapter.js       ← wraps systems/scoreboard.js
│   └── test/                        ← in-memory test adapters (no mocks needed)
│       ├── RecordingRenderAdapter.js
│       ├── NullAudioAdapter.js
│       ├── ScriptedInputAdapter.js
│       └── MemoryScoreAdapter.js
│
├── game.js                          ← shrinks to ~50 lines: wiring + rAF loop only
└── main.js                          ← unchanged

tests/
├── domain/
│   ├── collision.test.js
│   ├── ballPhysics.test.js
│   ├── paddlePhysics.test.js
│   ├── Ghost.test.js
│   ├── Alien.test.js
│   ├── PowerUp.test.js
│   ├── GhostSystem.test.js
│   ├── AlienSystem.test.js
│   ├── PowerUpSystem.test.js
│   └── ScoringRules.test.js
├── integration/
│   ├── gameLoop.test.js
│   └── powerUpLifecycle.test.js
└── helpers/
    └── builders.js                  ← makeBall(), makePaddle(), makeGhostSystem() etc.
```

---

## Domain Entities

### The key change: separate data/logic from rendering

Each entity splits into two responsibilities:

| Current file | Domain module (logic) | Render (moves to CanvasRenderAdapter) |
|---|---|---|
| `entities/ball.js` | `domain/entities/Ball.js` | `drawBall(ctx, ball)` |
| `entities/paddle.js` | `domain/entities/Paddle.js` | `drawPaddle(ctx, paddle)` |
| `entities/ghost.js` | `domain/entities/Ghost.js` | `drawGhost(ctx, ghost, drawScale)` |
| `entities/alien.js` | `domain/entities/Alien.js` | `drawAlien(ctx, alien, offset, drawScale)` |
| `entities/powerup.js` | `domain/entities/PowerUp.js` | `drawPowerUp(ctx, powerUp, now, drawScale)` |

### Fixing the time problem

`PowerUp.isLive()` and `PowerUp.expired()` currently call `performance.now()` internally. Change the signatures to accept `now`:

```js
// Before (untestable):
isLive()   { return performance.now() - this.#born >= GRACE_MS; }
expired()  { return performance.now() - this.#born >= LIFESPAN_MS; }

// After (deterministic):
isLive(now)   { return now - this.#born >= GRACE_MS; }
expired(now)  { return now - this.#born >= LIFESPAN_MS; }
```

The `born` timestamp is passed into the constructor from the caller rather than captured inline:

```js
// Before:
constructor(x, y, type) { this.#born = performance.now(); ... }

// After:
constructor(x, y, type, born) { this.#born = born; ... }
```

`PowerUpSystem.trySpawn()` passes `now` down from `GameLoop.update()`, which receives it as a parameter. No domain code calls `performance.now()` directly.

### Ghost color exposure

`Ghost` stores `#color` as a private field used only in `draw()`. Once `draw()` is removed, the adapter needs the color. Add a getter:

```js
get color() { return this.#color; }
```

---

## Port Definitions

Ports are defined as JSDoc `@typedef` in their own files with a runtime validator. The validator is called in tests to assert an adapter is complete.

### `src/ports/RenderPort.js`

```js
/**
 * @typedef {Object} RenderPort
 * @property {(state: import('../domain/GameState.js').GameState) => void} drawFrame
 */
export function assertRenderPort(adapter) {
  if (typeof adapter.drawFrame !== 'function')
    throw new Error('RenderPort: missing drawFrame(state)');
}
```

`drawFrame` receives the **entire GameState snapshot** rather than per-entity draw calls. This keeps the port surface to one method and lets each adapter decide what to render. The `RecordingRenderAdapter` stores snapshots; `CanvasRenderAdapter` paints the canvas.

### `src/ports/AudioPort.js`

```js
/**
 * @typedef {Object} AudioPort
 * @property {(name: 'paddle'|'ghost'|'roundEnd'|'levelUp') => void} play
 */
export function assertAudioPort(adapter) {
  if (typeof adapter.play !== 'function')
    throw new Error('AudioPort: missing play(name)');
}
```

### `src/ports/InputPort.js`

```js
/**
 * @typedef {Object} InputPort
 * @property {() => InputSnapshot} read
 *
 * @typedef {Object} InputSnapshot
 * @property {'up'|'down'|null} paddleDirection
 * @property {number|null}      paddleAbsoluteY   - touch: target Y in virtual units
 * @property {boolean}          restartRequested
 */
export function assertInputPort(adapter) {
  if (typeof adapter.read !== 'function')
    throw new Error('InputPort: missing read()');
}
```

### `src/ports/ScorePort.js`

```js
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
```

---

## GameState

Replaces the closure variables in `game.js`. The complete snapshot of all game state:

```js
// src/domain/GameState.js
export function createGameState() {
  return {
    ball:    null,     // Ball
    paddle:  null,     // Paddle

    score:      0,
    lives:      5,
    level:      1,
    gameSpeed:  16,
    ballSpeed:  16,

    ballState:      'live',  // 'ready' | 'live'
    ballReadySince: 0,

    paddleStunnedUntil: 0,
    wideUntil:    0,
    shieldActive: false,
    isBonusRound: false,

    // System snapshots (populated by systems, read by render adapter)
    ghosts:   [],
    aliens:   [],
    powerUps: [],
  };
}
```

---

## GameLoop

The heart of the refactor. `update()` is a pure function over `GameState`:

```js
// src/domain/GameLoop.js
export class GameLoop {
  #ghostSystem;
  #alienSystem;
  #powerUpSystem;
  #audio;
  #score;

  constructor({ ghostSystem, alienSystem, powerUpSystem, audio, score }) {
    this.#ghostSystem   = ghostSystem;
    this.#alienSystem   = alienSystem;
    this.#powerUpSystem = powerUpSystem;
    this.#audio         = audio;   // AudioPort
    this.#score         = score;   // ScorePort
  }

  /**
   * @param {GameState}     state
   * @param {number}        timeScale  - elapsed / TARGET_FRAME_MS
   * @param {number}        now        - substitute for performance.now()
   * @param {InputSnapshot} input
   * @returns {'ok' | 'gameover'}
   */
  update(state, timeScale, now, input) { ... }
}
```

`requestAnimationFrame` stays in `game.js` (composition root). The integration tests drive the loop by calling `update()` directly N times with controlled `now` values — no async, no timers.

---

## Test Adapters

These replace mocks. Each is a real, working implementation of a port that captures its interactions in memory.

### `RecordingRenderAdapter`

```js
export class RecordingRenderAdapter {
  frames = [];

  drawFrame(state) {
    this.frames.push(structuredClone(state));
  }

  lastFrame()           { return this.frames.at(-1); }
  frameCount()          { return this.frames.length; }
  ballPositions()       { return this.frames.map(f => ({ x: f.ball.x, y: f.ball.y })); }
  findFrameWhere(pred)  { return this.frames.find(pred); }
}
```

### `NullAudioAdapter`

```js
export class NullAudioAdapter {
  calls = [];
  play(name)          { this.calls.push(name); }
  played(name)        { return this.calls.includes(name); }
  callCount(name)     { return this.calls.filter(n => n === name).length; }
}
```

### `ScriptedInputAdapter`

```js
export class ScriptedInputAdapter {
  #queue   = [];
  #tick    = 0;
  #current = { paddleDirection: null, paddleAbsoluteY: null, restartRequested: false };

  at(tick, snapshot) {
    this.#queue.push({ tick, snapshot });
    return this;  // fluent
  }

  read() {
    const event = this.#queue.find(e => e.tick === this.#tick);
    if (event) this.#current = event.snapshot;
    this.#tick++;
    return this.#current;
  }
}
```

### `MemoryScoreAdapter`

```js
export class MemoryScoreAdapter {
  score   = 0;
  lives   = 5;
  history = [];

  updateScore(score) { this.score = score; this.history.push({ event: 'score', value: score }); }
  updateLives(lives) { this.lives = lives; this.history.push({ event: 'lives', value: lives }); }
  reset(lives)       { this.score = 0; this.lives = lives; }
}
```

---

## ScoringRules

All scoring formulae extracted into one pure module:

```js
// src/domain/systems/ScoringRules.js

// Paddle return
export const paddleHitScore  = (gameSpeed)           => gameSpeed;

// Ghost kill — exponential multi-kill multiplier
export const ghostKillScore  = (level, gameSpeed, n) => level * gameSpeed * n * 2 ** (n - 1);

// Bonus round
export const alienKillScore  = (level, maxHp)        => 50 * level * maxHp;
export const bonusClearScore = (level)               => 2000 * level;

// Level clear
export const levelClearScore = (level)               => level * 1000;
```

---

## Vitest Configuration

```js
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',   // domain has zero DOM dependencies
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include:  ['src/domain/**', 'src/adapters/test/**'],
      exclude:  ['src/adapters/browser/**'],
      thresholds: { lines: 85, functions: 85 },
    },
  },
});
```

`environment: 'node'` is intentional. The domain tests don't need a DOM and shouldn't have to pretend they do. Browser adapters (`CanvasRenderAdapter`, etc.) are verified by running the game — they are not unit tested.

```json
// package.json additions
"devDependencies": {
  "vitest": "^2.0.0",
  "@vitest/coverage-v8": "^2.0.0"
},
"scripts": {
  "test":       "vitest run",
  "test:watch": "vitest",
  "coverage":   "vitest run --coverage"
}
```

---

## Test Examples

### `collision.js` — unit

```js
import { aabb } from '../../src/domain/physics/collision.js';

it('returns true when boxes overlap', () => {
  expect(aabb({ x:0, y:0, w:10, h:10 }, { x:5, y:5, w:10, h:10 })).toBe(true);
});

it('returns false for adjacent boxes (touching edge is not overlap)', () => {
  expect(aabb({ x:0, y:0, w:10, h:10 }, { x:10, y:0, w:10, h:10 })).toBe(false);
});
```

### `ScoringRules.js` — unit

```js
import { ghostKillScore } from '../../src/domain/systems/ScoringRules.js';

it('single kill = level × gameSpeed', () => {
  expect(ghostKillScore(1, 16, 1)).toBe(16);
});

it('double kill is 4× not 2× a single kill', () => {
  expect(ghostKillScore(1, 16, 2)).toBe(64);  // 1 × 16 × 2 × 2¹
});
```

### `domain/entities/PowerUp.js` — deterministic time

```js
import { PowerUp } from '../../src/domain/entities/PowerUp.js';

it('is not collectable during 2s grace period', () => {
  const pu = new PowerUp(100, 200, 'wide', /* born= */ 0);
  expect(pu.isLive(1000)).toBe(false);  // 1 s < 2 s grace
  expect(pu.isLive(2001)).toBe(true);
});

it('expires after 10 s', () => {
  const pu = new PowerUp(100, 200, 'slow', 0);
  expect(pu.expired(9999)).toBe(false);
  expect(pu.expired(10001)).toBe(true);
});
```

### `GhostSystem` — no canvas

```js
import { GhostSystem } from '../../src/domain/systems/GhostSystem.js';

it('spawns 5 ghosts', () => {
  const gs = new GhostSystem();
  gs.spawn();
  expect(gs.ghostCount()).toBe(5);
});

it('removes ghost and returns centroid on ball hit', () => {
  const gs = new GhostSystem();
  gs.spawn();
  // Ghost 0 spawns at x=30, y=0, size=32
  const ball = { x:30, y:0, w:10, h:10 };
  const result = gs.checkCollision(ball);
  expect(result.count).toBe(1);
  expect(gs.ghostCount()).toBe(4);
});
```

### `ballPhysics` — serve state machine

```js
import { updateReadyBall } from '../../src/domain/physics/ballPhysics.js';

it('does not move ball during pause window', () => {
  const ball   = { x:40, y:195, w:10, h:10, dx:0, dy:0 };
  const paddle = { x:585, y:170, w:10, h:60 };
  const result = updateReadyBall(ball, paddle, 16, /*readySince=*/0, /*now=*/100, 1);
  expect(result).toBe('drifting');
  expect(ball.x).toBe(40);
});

it('launches when ball arrives at paddle with Y overlap', () => {
  const ball   = { x:580, y:175, w:10, h:10, dx:0, dy:0 };
  const paddle = { x:585, y:170, w:10, h:60 };
  const result = updateReadyBall(ball, paddle, 16, 0, 700, 1);
  expect(result).toBe('launched');
});
```

### Integration — life loss with full harness

```js
import { GameLoop }             from '../../src/domain/GameLoop.js';
import { createGameState }      from '../../src/domain/GameState.js';
import { NullAudioAdapter }     from '../../src/adapters/test/NullAudioAdapter.js';
import { MemoryScoreAdapter }   from '../../src/adapters/test/MemoryScoreAdapter.js';

function makeHarness() {
  const audio  = new NullAudioAdapter();
  const score  = new MemoryScoreAdapter();
  const loop   = new GameLoop({ ghostSystem: new GhostSystem(), alienSystem: new AlienSystem(),
                                 powerUpSystem: new PowerUpSystem(), audio, score });
  const state  = createGameState();
  return { loop, state, audio, score };
}

it('decrements lives and plays roundEnd when ball exits right edge', () => {
  const { loop, state, audio, score } = makeHarness();
  state.ball      = { x:595, y:195, w:10, h:10, dx:8, dy:0 };
  state.ballState = 'live';
  state.lives     = 3;

  loop.update(state, 1, 1000, { paddleDirection: null, paddleAbsoluteY: null, restartRequested: false });

  expect(state.lives).toBe(2);
  expect(score.lives).toBe(2);
  expect(audio.played('roundEnd')).toBe(true);
});
```

---

## Migration Phases

Each phase leaves the browser game **fully working**. Tests grow throughout.

### Phase 1 — Infrastructure (no game changes)

- Install `vitest` + `@vitest/coverage-v8`
- Create `vitest.config.js`
- Create `src/ports/*.js` (JSDoc only)
- Create all four test adapters in `src/adapters/test/`
- Extract `src/domain/constants.js` from `game.js` (copy only, no deletion yet)
- Create `tests/helpers/builders.js` with factory functions
- **Deliverable:** `pnpm test` runs 0 tests, passes. `pnpm dev` unchanged.

### Phase 2 — Domain entities and physics

- Create `src/domain/entities/` — all five entity classes, `born` injected in `PowerUp`
- Create `src/domain/physics/collision.js`, `ballPhysics.js`, `paddlePhysics.js`
- Create `src/domain/systems/ScoringRules.js`
- Write unit tests for all of the above
- Old `src/entities/` files untouched
- **Deliverable:** domain tests pass. Game unchanged.

### Phase 3 — Domain systems and GameLoop

- Create `src/domain/systems/GhostSystem.js`, `AlienSystem.js`, `PowerUpSystem.js` (no `draw()`)
- Add `ghostCount()` to `GhostSystem`
- Create `src/domain/GameState.js`
- Create `src/domain/GameLoop.js` — logic extracted from `game.js`, uses domain systems
- Write integration tests
- Old `src/systems/` files untouched
- **Deliverable:** integration tests pass. Game unchanged.

### Phase 4 — Wire domain into browser

- Create `src/adapters/browser/` — `CanvasRenderAdapter`, `WebAudioAdapter`, `KeyboardInputAdapter`, `TouchInputAdapter`, `DOMScoreAdapter`
- Rewrite `game.js`: instantiate `GameLoop` + domain systems + browser adapters. The rAF loop calls `loop.update(state, timeScale, now, input.read())` then `renderer.drawFrame(state)`
- Old `src/entities/` and `src/systems/` are now unused but not deleted yet
- **Deliverable:** all tests pass. Game identical to before visually.

### Phase 5 — Cleanup

- Delete `src/entities/` and `src/systems/`
- `game.js` is now ~50 lines (composition root only)
- Add coverage thresholds to CI
- **Deliverable:** clean tree, >85 % domain coverage, game unchanged.

---

## Key Design Decisions

**`now` as a parameter, not an injected clock object**
A clock service (`{ now: () => number }`) is cleaner in large codebases. Here it would add a parameter to every function with little readability gain. Since the only caller is `GameLoop.update()`, a scalar `now` is sufficient. Switching to an injected clock later is a single-file change.

**Full `GameState` snapshot to `drawFrame` instead of per-entity draw calls**
Per-entity methods would mean updating the port every time a new visual element is added. A single `drawFrame(state)` keeps the domain/adapter boundary stable indefinitely. The `RecordingRenderAdapter` stores snapshots and tests query any field they need.

**`environment: 'node'` not `jsdom`**
`jsdom` doesn't implement `HTMLCanvasElement.getContext('2d')` — canvas tests would still need a shim. The cleaner boundary: domain logic in Node, browser adapters verified by running the game. If canvas unit tests become valuable later, add a separate `tests/browser/` folder with `jsdom` + `canvas`.

**`requestAnimationFrame` stays in `game.js`**
`rAF` is a browser API. Putting it in `GameLoop` would make `GameLoop` untestable in Node. The loop driver lives at the composition root where browser I/O belongs. Integration tests drive the loop by calling `update()` N times directly.
