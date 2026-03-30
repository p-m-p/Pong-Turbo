import { ScoreboardAdapter } from '../adapters/browser/ScoreboardAdapter.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    :host([hidden]) { display: none !important; }

    /* Fix: ensure [hidden] inside shadow DOM is respected */
    [hidden] { display: none !important; }

    #overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.92);
      z-index: 20;
      padding: var(--space-4);
    }

    .panel {
      width: 100%;
      max-width: 360px;
      max-height: calc(100% - 2rem);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
    }

    .table-wrapper {
      width: 100%;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--border) transparent;
    }

    h2 {
      font-family: var(--font);
      font-size: clamp(0.875rem, 3vw, var(--fs-lg));
      letter-spacing: var(--tracking);
      color: var(--accent);
      margin: 0;
      text-align: center;
      text-transform: uppercase;
    }

    .score-display {
      font-family: var(--font);
      font-size: clamp(0.6rem, 2.5vw, var(--fs-sm));
      color: var(--text);
      text-align: center;
      line-height: 1.6;
      text-transform: uppercase;
    }
    .score-display .value { color: var(--positive); }
    .score-display .rank  { color: var(--interactive); font-size: 0.85em; }

    /* ── Score table ──────────────────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-family: var(--font);
      font-size: clamp(0.45rem, 1.8vw, var(--fs-xs));
    }

    th {
      color: var(--dim);
      letter-spacing: var(--tracking);
      padding: 0 var(--space-1) var(--space-2);
      border-bottom: 1px solid var(--border);
      text-transform: uppercase;
    }

    th.rank-col  { text-align: right; width: 2.5em; }
    th.name-col  { padding-left: var(--space-3); }
    th.score-col { text-align: right; }

    td {
      padding: 0.35rem var(--space-1);
      color: var(--text-dim);
      border-bottom: 1px solid var(--border);
    }

    td.rank-col  { color: var(--dim); text-align: right; width: 2.5em; }
    td.name-col  { color: var(--text); letter-spacing: 0.06em; padding-left: var(--space-3); }
    td.score-col { text-align: right; font-variant-numeric: tabular-nums; }

    tr.player td            { color: var(--accent); }
    tr.player td.name-col   { color: var(--accent); }
    tr.player td.rank-col   { color: var(--accent); }
    tr.player td.score-col  { color: var(--accent); }

    tr.player-pending td            { color: var(--interactive); }
    tr.player-pending td.name-col   { color: var(--interactive); }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.3; }
    }
    tr.player-pending { animation: blink 1.2s ease-in-out infinite; }

    .rank-marker { color: var(--accent); margin-right: 0.25em; }

    /* ── Inline name input (sits inside the player-pending table row) ── */
    .name-input-inline {
      font-family: var(--font);
      font-size: inherit;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      width: 5.5ch;
      background: transparent;
      color: var(--interactive);
      border: none;
      border-bottom: 2px solid var(--interactive);
      outline: none;
      caret-color: var(--interactive);
      padding: 0;
      animation: none; /* don't inherit row blink */
    }
    .name-input-inline:focus {
      border-bottom-color: var(--accent);
      color: var(--accent);
    }

    /* ── Buttons ───────────────────────────────────────────────────── */
    button {
      font-family: var(--font);
      font-size: clamp(0.6rem, 2.5vw, var(--fs-sm));
      letter-spacing: var(--tracking);
      text-transform: uppercase;
      color: var(--bg);
      background: var(--accent);
      border: 2px solid var(--text);
      border-radius: 0;
      padding: 0.6em 2.5em;
      cursor: pointer;
      transition: background 0.05s;
      flex-shrink: 0;
    }
    button:hover  { background: var(--text); }
    button:active { background: var(--accent-press); }
    button:disabled { background: var(--bg-mid); color: var(--dim); border-color: var(--border); cursor: default; }

    .status-msg {
      font-family: var(--font);
      font-size: var(--fs-2xs);
      color: var(--dim);
      text-align: center;
    }
    .status-msg.error { color: var(--error); }

    /* ── Compact landscape ─────────────────────────────────────────── */
    @media (max-height: 480px) {
      .panel { gap: 0.4rem; }
      h2     { font-size: var(--fs-sm); }
      td, th { padding-top: 0.2rem; padding-bottom: 0.2rem; }
    }
  </style>

  <div id="overlay">

    <!-- ── Start panel ───────────────────────────────────────── -->
    <div id="start-panel" class="panel">
      <h2>High scores</h2>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="rank-col">#</th>
              <th class="name-col">Name</th>
              <th class="score-col">Score</th>
            </tr>
          </thead>
          <tbody id="top-tbody"></tbody>
        </table>
      </div>
      <p id="start-status" class="status-msg"></p>
      <button id="play-btn">Play</button>
    </div>

    <!-- ── Result panel ──────────────────────────────────────── -->
    <div id="result-panel" class="panel" hidden>
      <h2>Game over</h2>
      <div class="score-display">
        <div>Score <span id="final-score" class="value"></span></div>
        <div id="rank-preview" class="rank"></div>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="rank-col">#</th>
              <th class="name-col">Name</th>
              <th class="score-col">Score</th>
            </tr>
          </thead>
          <tbody id="result-tbody"></tbody>
        </table>
      </div>

      <p id="submit-status" class="status-msg"></p>
      <button id="play-again-btn" hidden>Play again</button>
    </div>

  </div>
`;

export class PongScoreboard extends HTMLElement {
  #adapter = new ScoreboardAdapter(null);
  #state = 'hidden'; // 'hidden' | 'start' | 'result-pending' | 'result-confirmed'
  #score = 0;
  #token = null;
  #checkpoints = [];
  #topCache = null;
  #nameInput = null; // persistent <input> element moved into table rows

  static get observedAttributes() {
    return ['api'];
  }

  attributeChangedCallback(name, _old, value) {
    if (name === 'api') this.#adapter = new ScoreboardAdapter(value || null);
  }

  connectedCallback() {
    if (this.shadowRoot) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.append(template.content.cloneNode(true));

    // Create the persistent name input element once
    this.#nameInput = document.createElement('input');
    this.#nameInput.className = 'name-input-inline';
    this.#nameInput.maxLength = 5;
    this.#nameInput.autocomplete = 'off';
    this.#nameInput.spellcheck = false;
    this.#nameInput.setAttribute('autocapitalize', 'characters');
    this.#nameInput.setAttribute('inputmode', 'text');
    this.#nameInput.setAttribute('enterkeyhint', 'done');
    this.#nameInput.setAttribute('placeholder', '_____');

    this.#wireEvents(shadow);
  }

  #wireEvents(shadow) {
    shadow.querySelector('#play-btn').addEventListener('click', () => {
      this.#emitPlay();
    });

    shadow.querySelector('#play-again-btn').addEventListener('click', () => {
      this.#emitPlay();
    });

    this.#nameInput.addEventListener('input', () => {
      this.#nameInput.value = this.#nameInput.value.toUpperCase().replaceAll(/[^A-Z0-9]/g, '');
    });
    this.#nameInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') this.#handleSubmit();
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────

  showTopScores() {
    this.#state = 'start';
    this.hidden = false;
    const shadow = this.shadowRoot;
    shadow.querySelector('#start-panel').hidden = false;
    shadow.querySelector('#result-panel').hidden = true;
    this.#fetchAndRenderTopScores();
  }

  showResult(score, token = null, checkpoints = []) {
    this.#score = score;
    this.#token = token;
    this.#checkpoints = checkpoints;
    this.#state = 'result-pending';
    this.hidden = false;
    const shadow = this.shadowRoot;
    shadow.querySelector('#start-panel').hidden = true;
    shadow.querySelector('#result-panel').hidden = false;
    shadow.querySelector('#play-again-btn').hidden = true;
    shadow.querySelector('#submit-status').textContent = '';
    shadow.querySelector('#submit-status').className = 'status-msg';
    shadow.querySelector('#final-score').textContent = score.toLocaleString();

    this.#nameInput.value = '';
    this.#nameInput.disabled = false;

    this.#renderResultTable(this.#topCache, null);

    // Fetch fresh scores to show pending rank preview
    this.#fetchForResult();
  }

  hide() {
    this.hidden = true;
    this.#state = 'hidden';
  }

  /** Fetch a one-use game token from the worker (call at game start). */
  async fetchToken() {
    return this.#adapter.getToken();
  }

  // ── Private helpers ────────────────────────────────────────────────────

  #emitPlay() {
    this.dispatchEvent(new CustomEvent('play-requested', { bubbles: true, composed: true }));
  }

  async #fetchAndRenderTopScores() {
    const shadow = this.shadowRoot;
    const status = shadow.querySelector('#start-status');
    status.textContent = '';

    try {
      const scores = await this.#adapter.getTopScores();
      this.#topCache = scores;
      this.#renderTopTable(scores);
    } catch {
      if (this.#topCache) {
        this.#renderTopTable(this.#topCache);
      } else {
        status.textContent = 'Could not load scores.';
        this.#renderTopTable([]);
      }
    }
  }

  async #fetchForResult() {
    try {
      const scores = await this.#adapter.getTopScores();
      this.#topCache = scores;
      this.#renderResultTable(scores, null);
    } catch {
      /* use cached or empty */
    }
  }

  #renderTopTable(scores) {
    const tbody = this.shadowRoot.querySelector('#top-tbody');
    if (scores.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--dim);padding:var(--space-4)">No scores yet — be first!</td></tr>`;
      return;
    }
    tbody.innerHTML = scores
      .map(
        ({ rank, name, score }) => `
      <tr>
        <td class="rank-col">${rank}</td>
        <td class="name-col">${this.#esc(name)}</td>
        <td class="score-col">${score.toLocaleString()}</td>
      </tr>
    `,
      )
      .join('');
  }

  #renderResultTable(topScores, context) {
    const shadow = this.shadowRoot;
    const tbody = shadow.querySelector('#result-tbody');
    const rankPreview = shadow.querySelector('#rank-preview');

    if (context) {
      // Post-submit: confirmed context window, no input
      tbody.innerHTML = context
        .map(
          ({ rank, name, score, isPlayer }) => `
        <tr class="${isPlayer ? 'player' : ''}">
          <td class="rank-col">${isPlayer ? '<span class="rank-marker">▶</span>' : ''}${rank}</td>
          <td class="name-col">${this.#esc(name)}</td>
          <td class="score-col">${score.toLocaleString()}</td>
        </tr>
      `,
        )
        .join('');
      return;
    }

    if (!topScores || topScores.length === 0) {
      // No scores yet — show solo pending row
      tbody.innerHTML = '';
      const tr = document.createElement('tr');
      tr.className = 'player-pending';
      tr.innerHTML = `
        <td class="rank-col"><span class="rank-marker">▶</span>1</td>
        <td class="name-col"></td>
        <td class="score-col">${this.#score.toLocaleString()}</td>
      `;
      tr.querySelector('.name-col').append(this.#nameInput);
      tbody.append(tr);
      rankPreview.textContent = 'Rank #1';
      this.#nameInput.focus();
      return;
    }

    // Compute pending rank
    const playerScore = this.#score;
    const pendingRank = topScores.filter((s) => s.score > playerScore).length + 1;

    rankPreview.textContent =
      pendingRank <= topScores.length || topScores.length < 10
        ? `Rank #${pendingRank} (est.)`
        : `Outside top ${topScores.length}`;

    // Build merged list with pending row spliced in
    const allRows = topScores.map((s) => ({ ...s, isPending: false }));
    const insertIndex = Math.min(pendingRank - 1, allRows.length);
    allRows.splice(insertIndex, 0, { rank: pendingRank, score: playerScore, isPending: true });
    for (let i = insertIndex + 1; i < allRows.length; i++) allRows[i].rank = i + 1;

    // Window of 5 centred on pending
    const start = Math.max(0, insertIndex - 2);
    const window = allRows.slice(start, start + 5);

    // Build rows; pending row gets the live input element
    tbody.innerHTML = '';
    for (const { rank, name, score, isPending } of window) {
      const tr = document.createElement('tr');
      tr.className = isPending ? 'player-pending' : '';

      const rankTd = document.createElement('td');
      rankTd.className = 'rank-col';
      rankTd.innerHTML = isPending ? `<span class="rank-marker">▶</span>${rank}` : String(rank);

      const nameTd = document.createElement('td');
      nameTd.className = 'name-col';
      if (isPending) {
        nameTd.append(this.#nameInput);
      } else {
        nameTd.textContent = this.#esc(name);
      }

      const scoreTd = document.createElement('td');
      scoreTd.className = 'score-col';
      scoreTd.textContent = score.toLocaleString();

      tr.append(rankTd, nameTd, scoreTd);
      tbody.append(tr);
    }

    this.#nameInput.focus();
  }

  async #handleSubmit() {
    if (this.#state !== 'result-pending') return;

    const shadow = this.shadowRoot;
    const statusEl = shadow.querySelector('#submit-status');
    const rankPrev = shadow.querySelector('#rank-preview');

    const name = this.#nameInput.value
      .trim()
      .toUpperCase()
      .replaceAll(/[^A-Z0-9]/g, '')
      .slice(0, 5);
    if (!name) {
      statusEl.textContent = 'Enter your name first.';
      statusEl.className = 'status-msg error';
      this.#nameInput.focus();
      return;
    }

    this.#nameInput.disabled = true;
    statusEl.textContent = 'Submitting…';
    statusEl.className = 'status-msg';

    try {
      const result = this.#adapter.available
        ? await this.#adapter.submitScore(name, this.#score, this.#token, this.#checkpoints)
        : null;

      if (result) {
        rankPrev.textContent = `Rank #${result.rank}`;
        this.#renderResultTable(null, result.context);
      } else {
        rankPrev.textContent = rankPrev.textContent.replace(' (est.)', '');
        // Replace pending row with confirmed name
        this.#renderResultTable(null, [
          {
            rank: Number.parseInt(rankPrev.textContent.replace('Rank #', ''), 10) || 1,
            name,
            score: this.#score,
            isPlayer: true,
          },
        ]);
      }

      statusEl.textContent = '';
      shadow.querySelector('#play-again-btn').hidden = false;
      this.#state = 'result-confirmed';
    } catch {
      this.#nameInput.disabled = false;
      statusEl.textContent = 'Could not submit — try again.';
      statusEl.className = 'status-msg error';
    }
  }

  #esc(str) {
    return String(str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }
}

customElements.define('pong-scoreboard', PongScoreboard);
