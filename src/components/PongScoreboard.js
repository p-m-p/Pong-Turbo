import { ScoreboardAdapter } from '../adapters/browser/ScoreboardAdapter.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      --base:      #1e1e2e;
      --mantle:    #181825;
      --crust:     #11111b;
      --surface-0: #313244;
      --surface-1: #45475a;
      --overlay-0: #6c7086;
      --subtext:   #a6adc8;
      --text:      #cdd6f4;
      --lavender:  #b4befe;
      --mauve:     #cba6f7;
      --green:     #a6e3a1;
      --red:       #f38ba8;

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
      background: rgba(17, 17, 27, 0.92);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      z-index: 20;
      padding: 1rem;
    }

    .panel {
      width: 100%;
      max-width: 360px;
      max-height: calc(100% - 2rem);
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }

    .panel-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding-bottom: 0.5rem;
      scrollbar-width: thin;
      scrollbar-color: var(--surface-1) transparent;
    }

    h2 {
      font-family: 'Play', helvetica, arial, sans-serif;
      font-size: clamp(1.25rem, 4vw, 1.75rem);
      font-weight: 700;
      letter-spacing: 0.1em;
      color: var(--mauve);
      margin: 0;
      text-align: center;
    }

    .score-display {
      font-family: 'Play', helvetica, arial, sans-serif;
      font-size: clamp(1rem, 3.5vw, 1.5rem);
      font-weight: 700;
      color: var(--text);
      text-align: center;
      line-height: 1.4;
    }
    .score-display .value { color: var(--green); }
    .score-display .rank  { color: var(--lavender); font-size: 0.85em; }

    /* ── Score table ──────────────────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Play', helvetica, arial, sans-serif;
      font-size: clamp(0.7rem, 2.5vw, 0.875rem);
    }

    th {
      color: var(--overlay-0);
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 0 0.25rem 0.5rem;
      border-bottom: 1px solid var(--surface-0);
    }

    td {
      padding: 0.35rem 0.25rem;
      color: var(--subtext);
      border-bottom: 1px solid var(--surface-0);
    }

    td.rank-col  { color: var(--overlay-0); text-align: right; width: 2.5em; }
    td.name-col  { color: var(--text); font-weight: 700; letter-spacing: 0.06em; padding-left: 0.75rem; }
    td.score-col { text-align: right; font-variant-numeric: tabular-nums; }

    tr.player td            { color: var(--mauve); }
    tr.player td.name-col   { color: var(--mauve); }
    tr.player td.rank-col   { color: var(--mauve); }
    tr.player td.score-col  { color: var(--mauve); }

    tr.player-pending td            { color: var(--lavender); }
    tr.player-pending td.name-col   { color: var(--lavender); }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.3; }
    }
    tr.player-pending { animation: blink 1.2s ease-in-out infinite; }

    .rank-marker { color: var(--mauve); margin-right: 0.25em; }

    /* ── Inline name input (sits inside the player-pending table row) ── */
    .name-input-inline {
      font-family: 'Play', helvetica, arial, sans-serif;
      font-size: inherit;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      width: 5.5ch;
      background: transparent;
      color: var(--lavender);
      border: none;
      border-bottom: 1.5px solid var(--lavender);
      outline: none;
      caret-color: var(--lavender);
      padding: 0;
      animation: none; /* don't inherit row blink */
    }
    .name-input-inline:focus {
      border-bottom-color: var(--mauve);
      color: var(--mauve);
    }

    /* ── Buttons ───────────────────────────────────────────────────── */
    button {
      font-family: 'Play', helvetica, arial, sans-serif;
      font-size: clamp(0.875rem, 3vw, 1.125rem);
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--base);
      background: var(--mauve);
      border: none;
      border-radius: 8px;
      padding: 0.6em 2.5em;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      flex-shrink: 0;
      align-self: center;
      margin-top: 1rem;
    }
    button:hover  { background: var(--lavender); transform: scale(1.03); }
    button:active { transform: scale(0.97); }
    button:disabled { background: var(--surface-1); color: var(--overlay-0); cursor: default; transform: none; }

    .status-msg {
      font-family: 'Play', helvetica, arial, sans-serif;
      font-size: 0.75rem;
      color: var(--overlay-0);
      text-align: center;
    }
    .status-msg.error { color: var(--red); }

    /* ── Compact landscape ─────────────────────────────────────────── */
    @media (max-height: 480px) {
      .panel-scroll { gap: 0.5rem; }
      h2     { font-size: 1rem; }
      td, th { padding-top: 0.2rem; padding-bottom: 0.2rem; }
    }
  </style>

  <div id="overlay">

    <!-- ── Start panel ───────────────────────────────────────── -->
    <div id="start-panel" class="panel">
      <div class="panel-scroll">
        <h2>HIGH SCORES</h2>
        <table>
          <thead>
            <tr>
              <th style="text-align:right">#</th>
              <th style="padding-left:0.75rem">NAME</th>
              <th style="text-align:right">SCORE</th>
            </tr>
          </thead>
          <tbody id="top-tbody"></tbody>
        </table>
        <p id="start-status" class="status-msg"></p>
      </div>
      <button id="play-btn">PLAY</button>
    </div>

    <!-- ── Result panel ──────────────────────────────────────── -->
    <div id="result-panel" class="panel" hidden>
      <div class="panel-scroll">
        <h2>GAME OVER</h2>
        <div class="score-display">
          <div>SCORE <span id="final-score" class="value"></span></div>
          <div id="rank-preview" class="rank"></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align:right">#</th>
              <th style="padding-left:0.75rem">NAME</th>
              <th style="text-align:right">SCORE</th>
            </tr>
          </thead>
          <tbody id="result-tbody"></tbody>
        </table>

        <p id="submit-status" class="status-msg"></p>
      </div>
      <button id="play-again-btn" hidden>PLAY AGAIN</button>
    </div>

  </div>
`;

export class PongScoreboard extends HTMLElement {
  #adapter     = new ScoreboardAdapter(null);
  #state       = 'hidden';   // 'hidden' | 'start' | 'result-pending' | 'result-confirmed'
  #score       = 0;
  #token       = null;
  #checkpoints = [];
  #topCache    = null;
  #nameInput   = null;       // persistent <input> element moved into table rows

  static get observedAttributes() { return ['api']; }

  attributeChangedCallback(name, _old, val) {
    if (name === 'api') this.#adapter = new ScoreboardAdapter(val || null);
  }

  connectedCallback() {
    if (this.shadowRoot) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.appendChild(template.content.cloneNode(true));

    // Create the persistent name input element once
    this.#nameInput = document.createElement('input');
    this.#nameInput.className    = 'name-input-inline';
    this.#nameInput.maxLength    = 5;
    this.#nameInput.autocomplete = 'off';
    this.#nameInput.spellcheck   = false;
    this.#nameInput.setAttribute('autocapitalize', 'characters');
    this.#nameInput.setAttribute('inputmode', 'text');
    this.#nameInput.setAttribute('enterkeyhint', 'done');
    this.#nameInput.setAttribute('placeholder', '_____');

    this.#wireEvents(shadow);
  }

  #wireEvents(shadow) {
    shadow.getElementById('play-btn').addEventListener('click', () => {
      this.#emitPlay();
    });

    shadow.getElementById('play-again-btn').addEventListener('click', () => {
      this.#emitPlay();
    });

    this.#nameInput.addEventListener('input', () => {
      this.#nameInput.value = this.#nameInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
    this.#nameInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') this.#handleSubmit();
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────

  showTopScores() {
    this.#state  = 'start';
    this.hidden  = false;
    const shadow = this.shadowRoot;
    shadow.getElementById('start-panel').hidden  = false;
    shadow.getElementById('result-panel').hidden = true;
    this.#fetchAndRenderTopScores();
  }

  showResult(score, token = null, checkpoints = []) {
    this.#score       = score;
    this.#token       = token;
    this.#checkpoints = checkpoints;
    this.#state = 'result-pending';
    this.hidden = false;
    const shadow = this.shadowRoot;
    shadow.getElementById('start-panel').hidden      = true;
    shadow.getElementById('result-panel').hidden     = false;
    shadow.getElementById('play-again-btn').hidden   = true;
    shadow.getElementById('submit-status').textContent = '';
    shadow.getElementById('submit-status').className   = 'status-msg';
    shadow.getElementById('final-score').textContent   = score.toLocaleString();

    this.#nameInput.value    = '';
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
    const status = shadow.getElementById('start-status');
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
    } catch { /* use cached or empty */ }
  }

  #renderTopTable(scores) {
    const tbody = this.shadowRoot.getElementById('top-tbody');
    if (scores.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--overlay-0);padding:1rem">No scores yet — be first!</td></tr>`;
      return;
    }
    tbody.innerHTML = scores.map(({ rank, name, score }) => `
      <tr>
        <td class="rank-col">${rank}</td>
        <td class="name-col">${this.#esc(name)}</td>
        <td class="score-col">${score.toLocaleString()}</td>
      </tr>
    `).join('');
  }

  #renderResultTable(topScores, context) {
    const shadow      = this.shadowRoot;
    const tbody       = shadow.getElementById('result-tbody');
    const rankPreview = shadow.getElementById('rank-preview');

    if (context) {
      // Post-submit: confirmed context window, no input
      tbody.innerHTML = context.map(({ rank, name, score, isPlayer }) => `
        <tr class="${isPlayer ? 'player' : ''}">
          <td class="rank-col">${isPlayer ? '<span class="rank-marker">▶</span>' : ''}${rank}</td>
          <td class="name-col">${this.#esc(name)}</td>
          <td class="score-col">${score.toLocaleString()}</td>
        </tr>
      `).join('');
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
      tr.querySelector('.name-col').appendChild(this.#nameInput);
      tbody.appendChild(tr);
      rankPreview.textContent = 'RANK #1';
      this.#nameInput.focus();
      return;
    }

    // Compute pending rank
    const playerScore = this.#score;
    const pendingRank = topScores.filter(s => s.score > playerScore).length + 1;

    rankPreview.textContent = pendingRank <= topScores.length || topScores.length < 10
      ? `RANK #${pendingRank} (EST.)`
      : `OUTSIDE TOP ${topScores.length}`;

    // Build merged list with pending row spliced in
    const allRows = topScores.map(s => ({ ...s, isPending: false }));
    const insertIdx = Math.min(pendingRank - 1, allRows.length);
    allRows.splice(insertIdx, 0, { rank: pendingRank, score: playerScore, isPending: true });
    for (let i = insertIdx + 1; i < allRows.length; i++) allRows[i].rank = i + 1;

    // Window of 5 centred on pending
    const start  = Math.max(0, insertIdx - 2);
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
        nameTd.appendChild(this.#nameInput);
      } else {
        nameTd.textContent = this.#esc(name);
      }

      const scoreTd = document.createElement('td');
      scoreTd.className = 'score-col';
      scoreTd.textContent = score.toLocaleString();

      tr.append(rankTd, nameTd, scoreTd);
      tbody.appendChild(tr);
    }

    this.#nameInput.focus();
  }

  async #handleSubmit() {
    if (this.#state !== 'result-pending') return;

    const shadow    = this.shadowRoot;
    const statusEl  = shadow.getElementById('submit-status');
    const rankPrev  = shadow.getElementById('rank-preview');

    const name = this.#nameInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (!name) {
      statusEl.textContent = 'Enter your name first.';
      statusEl.className   = 'status-msg error';
      this.#nameInput.focus();
      return;
    }

    this.#nameInput.disabled = true;
    statusEl.textContent     = 'Submitting…';
    statusEl.className       = 'status-msg';

    try {
      const result = this.#adapter.available
        ? await this.#adapter.submitScore(name, this.#score, this.#token, this.#checkpoints)
        : null;

      if (result) {
        rankPrev.textContent = `RANK #${result.rank}`;
        this.#renderResultTable(null, result.context);
      } else {
        rankPrev.textContent = rankPrev.textContent.replace(' (EST.)', '');
        // Replace pending row with confirmed name
        this.#renderResultTable(null, [{
          rank: parseInt(rankPrev.textContent.replace('RANK #', ''), 10) || 1,
          name,
          score: this.#score,
          isPlayer: true,
        }]);
      }

      statusEl.textContent = '';
      shadow.getElementById('play-again-btn').hidden = false;
      this.#state = 'result-confirmed';
    } catch {
      this.#nameInput.disabled = false;
      statusEl.textContent     = 'Could not submit — try again.';
      statusEl.className       = 'status-msg error';
    }
  }

  #esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

customElements.define('pong-scoreboard', PongScoreboard);
