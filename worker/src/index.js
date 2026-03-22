const ALLOWED_ORIGINS = [
  "https://philparsons.co.uk",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:4173",
];

// ── Game constants (must mirror src/domain/constants.js) ──────────────────────
const INITIAL_SPEED  = 16;
const GHOST_COUNT    = 5;
const ALIEN_COUNT    = 18;   // 3 cols × 6 rows
const TOKEN_TTL_MS   = 2 * 60 * 60 * 1000;   // 2 hours
const TOKEN_MAX_AGE  = 24 * 60 * 60 * 1000;  // clean up after 24 hours

function corsHeaders(origin) {
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
  };
}

// ── HMAC helpers ──────────────────────────────────────────────────────────────

async function importKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signToken(payload, secret) {
  const key        = await importKey(secret);
  const payloadStr = JSON.stringify(payload);
  const sig        = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadStr));
  const payloadB64 = btoa(payloadStr);
  const sigB64     = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${payloadB64}.${sigB64}`;
}

async function verifyToken(token, secret) {
  if (typeof token !== "string") return null;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;
  try {
    const payloadStr = atob(payloadB64);
    const key        = await importKey(secret);
    const sig        = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const valid      = await crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(payloadStr));
    if (!valid) return null;
    const payload = JSON.parse(payloadStr);
    if (Date.now() - payload.iat > TOKEN_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Score plausibility ────────────────────────────────────────────────────────

function gameSpeedAt(level) {
  return INITIAL_SPEED + (level - 1) * 2;
}

/**
 * Returns a generous theoretical-maximum score achievable within a single level.
 * We use 3× the hard maximum to avoid false positives on legitimate play.
 */
function maxScoreForLevel(level) {
  const g       = gameSpeedAt(level);
  const isBonus = level % 3 === 0;
  // rally: 300 hits × gameSpeed (very generous)
  const rallyMax = 300 * g;
  if (isBonus) {
    // max alien combo: all 18 at once → level × g × 18 × 2^17 (impossible, but we cap generously)
    // realistic generous cap: 9 combos of 2 → level × g × 2 × 2 × 9 = level × g × 36
    // we use ×32 per alien for extra headroom
    const killMax  = level * g * ALIEN_COUNT * 32;
    const clearMax = level * 2000;
    return (killMax + clearMax + rallyMax) * 3;
  } else {
    // max ghost combo: all 5 at once → level × g × 5 × 2^4 = level × g × 80
    const killMax  = level * g * GHOST_COUNT * 16;
    const clearMax = level * 1000;
    return (killMax + clearMax + rallyMax) * 3;
  }
}

/**
 * Validates that checkpoints and final score are plausible given the game's
 * scoring formulas. Returns an error string or null if valid.
 *
 * @param {Array<{level:number, score:number}>} checkpoints
 * @param {number} finalScore
 */
function validateCheckpoints(checkpoints, finalScore) {
  if (!Array.isArray(checkpoints)) return "invalid checkpoints";

  let prevScore = 0;
  let prevLevel = 0;

  for (const cp of checkpoints) {
    if (
      typeof cp.level !== "number" || !Number.isInteger(cp.level) || cp.level < 1 ||
      typeof cp.score !== "number" || !Number.isInteger(cp.score) || cp.score < 0
    ) return "malformed checkpoint";

    if (cp.level <= prevLevel)  return "checkpoints not ascending";
    if (cp.score  < prevScore)  return "score decreased";

    const increase = cp.score - prevScore;
    const maxAllowed = maxScoreForLevel(cp.level);
    if (increase > maxAllowed) return `implausible score at level ${cp.level}`;

    prevScore = cp.score;
    prevLevel = cp.level;
  }

  if (finalScore < prevScore) return "final score below last checkpoint";

  // Final score after last checkpoint: allow up to one more level's worth
  const finalIncrease = finalScore - prevScore;
  const lastLevel     = prevLevel || 1;
  if (finalIncrease > maxScoreForLevel(lastLevel + 1)) return "implausible final score";

  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";
    const cors   = corsHeaders(origin);
    const url    = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // ── GET /token ───────────────────────────────────────────────────────────
    if (request.method === "GET" && url.pathname === "/token") {
      if (!env.HMAC_SECRET) {
        return Response.json({ error: "server misconfigured" }, { status: 500, headers: cors });
      }

      // Periodic cleanup of expired tokens
      const cutoff = Date.now() - TOKEN_MAX_AGE;
      await env.DB.prepare("DELETE FROM tokens WHERE iat < ?").bind(cutoff).run();

      const nonce   = crypto.randomUUID();
      const payload = { iat: Date.now(), nonce };
      const token   = await signToken(payload, env.HMAC_SECRET);

      await env.DB.prepare("INSERT INTO tokens (nonce, iat) VALUES (?, ?)")
        .bind(nonce, payload.iat)
        .run();

      return Response.json({ token }, { headers: cors });
    }

    // ── GET /scores ──────────────────────────────────────────────────────────
    if (request.method === "GET" && url.pathname === "/scores") {
      const { results } = await env.DB.prepare(
        "SELECT name, score FROM scores ORDER BY score DESC, ts ASC LIMIT 10",
      ).all();

      const body = results.map((r, i) => ({ rank: i + 1, name: r.name, score: r.score }));
      return Response.json(body, { headers: cors });
    }

    // ── POST /scores ─────────────────────────────────────────────────────────
    if (request.method === "POST" && url.pathname === "/scores") {
      const body = await request.json().catch(() => null);
      if (!body) {
        return Response.json({ error: "invalid JSON" }, { status: 400, headers: cors });
      }

      const { name, score, token, checkpoints = [] } = body;

      // ── Token validation ──────────────────────────────────────────────────
      if (!env.HMAC_SECRET) {
        return Response.json({ error: "server misconfigured" }, { status: 500, headers: cors });
      }

      const payload = await verifyToken(token, env.HMAC_SECRET);
      if (!payload) {
        return Response.json({ error: "invalid or expired token" }, { status: 401, headers: cors });
      }

      const existing = await env.DB.prepare("SELECT used FROM tokens WHERE nonce = ?")
        .bind(payload.nonce)
        .first();
      if (!existing || existing.used) {
        return Response.json({ error: "token already used" }, { status: 401, headers: cors });
      }

      // ── Input validation ──────────────────────────────────────────────────
      const safeName = String(name ?? "")
        .replace(/[^A-Z0-9]/gi, "")
        .toUpperCase()
        .slice(0, 5);

      if (!safeName) {
        return Response.json({ error: "name required" }, { status: 400, headers: cors });
      }
      if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 9_999_999) {
        return Response.json({ error: "invalid score" }, { status: 400, headers: cors });
      }

      // ── Checkpoint plausibility ───────────────────────────────────────────
      const cpError = validateCheckpoints(checkpoints, score);
      if (cpError) {
        return Response.json({ error: cpError }, { status: 422, headers: cors });
      }

      // ── Mark token used ───────────────────────────────────────────────────
      await env.DB.prepare("UPDATE tokens SET used = 1 WHERE nonce = ?")
        .bind(payload.nonce)
        .run();

      // ── Insert score ──────────────────────────────────────────────────────
      const run = await env.DB.prepare(
        "INSERT INTO scores (name, score, ts) VALUES (?, ?, ?)",
      ).bind(safeName, score, Date.now()).run();
      const insertedId = run.meta.last_row_id;

      const { rank } = await env.DB.prepare(
        "SELECT COUNT(*) + 1 AS rank FROM scores WHERE score > ?",
      ).bind(score).first();

      const offset = Math.max(0, rank - 3);
      const { results: ctx } = await env.DB.prepare(
        "SELECT id, name, score FROM scores ORDER BY score DESC, ts ASC LIMIT 5 OFFSET ?",
      ).bind(offset).all();

      const context = ctx.map((r, i) => ({
        rank:     offset + i + 1,
        name:     r.name,
        score:    r.score,
        isPlayer: r.id === insertedId,
      }));

      return Response.json({ rank, context }, { headers: cors });
    }

    return new Response("Not Found", { status: 404, headers: cors });
  },
};
