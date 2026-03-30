export class ScriptedInputAdapter {
  #queue = [];
  #tick = 0;
  #current = { paddleDirection: null, paddleAbsoluteY: null, restartRequested: false };

  /** Schedule an input event to fire on a specific tick. Fluent. */
  at(tick, snapshot) {
    this.#queue.push({ tick, snapshot });
    return this;
  }

  read() {
    const event = this.#queue.find((e) => e.tick === this.#tick);
    if (event) this.#current = { ...this.#current, ...event.snapshot };
    this.#tick++;
    return this.#current;
  }

  reset() {
    this.#tick = 0;
    this.#queue = [];
    this.#current = { paddleDirection: null, paddleAbsoluteY: null, restartRequested: false };
  }
}
