# PONG _Turbo_

> First there was Space Invaders...
> Then there was Pac-Man...
> Then there was Pong...
> Now, I bring you PONG _Turbo_

A browser-based arcade game that mashes Pong, Space Invaders and Ball Blast into one. Bounce the ball to destroy ghosts, collect power-ups, and survive bonus alien rounds every three levels.

---

## How to Play

| Control             | Keyboard   | Mobile                    |
| ------------------- | ---------- | ------------------------- |
| Move paddle up      | `↑` or `8` | Drag the right-edge strip |
| Move paddle down    | `↓` or `2` | Drag the right-edge strip |
| Restart (game over) | `Enter`    | —                         |

The paddle is on the **right** side. The ball bounces off the left wall, top wall, and bottom wall, and off your paddle. Let it exit the right edge and you lose a life.

---

## Game Loop

### Starting a life

When a new life begins (or the game starts) the ball appears on the left side of the screen and **pulses**. After a short pause it drifts rightward at game speed. Position your paddle to intercept it — the first successful hit launches the ball into play. If you miss, the ball resets to the left and tries again; no life is lost until the ball exits the right edge during live play.

### Levels

Each level contains five ghosts roaming the left 45 % of the canvas. Destroy all five to advance to the next level. On each level-up:

- Ball base speed increases by 2 units.
- A level-clear bonus is added to your score.
- Every **3rd level** triggers a **bonus round** instead of spawning more ghosts.

### Ghosts

Ghosts patrol the left section of the canvas, bouncing diagonally. Occasionally one will **charge** — lunging across the full canvas toward your paddle. Only one ghost charges at a time.

**If a charging ghost touches your paddle** it becomes **stunned**: the paddle flickers at ~3 Hz for 2.5 seconds. While the paddle is in a low-opacity flicker phase, the ball passes straight through it, exiting the right edge and costing you a life.

### Bonus Round (every 3rd level)

A 3 × 6 formation of Space Invader-style aliens enters from the left. The formation marches vertically — bouncing between the top and bottom walls — while slowly advancing rightward toward your paddle. Speed increases as aliens are killed.

- The ball **bounces off** aliens (Ball Blast style) without losing a life.
- Each alien takes **2 hits** to destroy, dimming after the first hit.
- **Lives are still lost** if the ball exits the right edge during a bonus round.
- If the formation reaches the paddle before all aliens are cleared, the round ends — the level advances but no completion bonus is awarded.
- Clearing all aliens earns the full completion bonus and continues normal play.

---

## Scoring

| Event                   | Points                                                         |
| ----------------------- | -------------------------------------------------------------- |
| Paddle hit              | `gameSpeed`                                                    |
| Ghost kill (single)     | `level × gameSpeed`                                            |
| Ghost kill (multi-kill) | `level × gameSpeed × n × 2^(n−1)` where n = simultaneous kills |
| Level clear             | `level × 1000`                                                 |
| Alien kill              | `50 × level × 2` (maxHp per alien = 2)                         |
| Bonus round clear       | `2000 × level`                                                 |

### Multi-kill multiplier examples

| Simultaneous kills | Multiplier vs single kill |
| ------------------ | ------------------------- |
| 1                  | ×1                        |
| 2                  | ×4                        |
| 3                  | ×12                       |
| 4                  | ×32                       |

Ball speed ramps up by **0.5 units per paddle return** within a rally (capped at `gameSpeed + 6`), rewarding long rallies. Speed resets to `gameSpeed` on each new rally.

---

## Power-Ups

Power-ups drop when ghosts are killed: **always** on a simultaneous multi-kill, and with **15 % probability** on a single kill. They appear as glowing orbs near the kill location and bounce within the ghost zone for 10 seconds before expiring.

The orb **pulses for 2 seconds** after spawning — it cannot be collected during this grace period. After that it is live; intercept it with the ball to collect it. The orb begins a faster warning pulse in the final 3 seconds before expiry.

| Orb colour | Type       | Effect                                               |
| ---------- | ---------- | ---------------------------------------------------- |
| Green      | **Wide**   | Paddle height grows to 1.75× for 8 seconds           |
| Sky blue   | **Shield** | Absorbs the next ghost stun (consumed on contact)    |
| Yellow     | **Slow**   | Resets the rally speed ramp back to base `gameSpeed` |

When the shield is active a pulsing cyan outline appears around the paddle.

---

## Technical Notes

- All game logic runs in a **600 × 400 virtual coordinate space**; a `drawScale` value maps this to physical pixels at any screen size.
- The canvas is responsive and centred, capped at 1200 × 800 physical pixels.
- On touch devices a fixed drag strip sits at the right edge of the screen; the canvas is padded to remain centred.
- Sound preference (muted/unmuted) is persisted in `localStorage` under the key `pongTurbo.muted`.
- The game loop normalises movement to a 30 fps baseline using a `timeScale` multiplier so physics feel identical at any frame rate.

---

## Development

```bash
pnpm install
pnpm dev      # Vite dev server
pnpm build    # production build
pnpm preview  # preview the build
```
