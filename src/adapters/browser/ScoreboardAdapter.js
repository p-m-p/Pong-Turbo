export class ScoreboardAdapter {
  #api;

  constructor(apiUrl) {
    this.#api = apiUrl ?? null;
  }

  get available() { return this.#api !== null; }

  /** @returns {Promise<Array<{rank:number, name:string, score:number}>>} */
  async getTopScores() {
    if (!this.#api) return [];
    const res = await fetch(`${this.#api}/scores`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  /**
   * @param {string} name   up to 5 chars
   * @param {number} score  integer ≥ 0
   * @returns {Promise<{rank:number, context:Array<{rank,name,score,isPlayer}>}|null>}
   */
  async getToken() {
    if (!this.#api) return null;
    const res = await fetch(`${this.#api}/token`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { token } = await res.json();
    return token;
  }

  async submitScore(name, score, token, checkpoints = []) {
    if (!this.#api) return null;
    const res = await fetch(`${this.#api}/scores`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, score, token, checkpoints }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}
