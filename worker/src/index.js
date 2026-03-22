const ALLOWED_ORIGINS = [
  'https://p-m-p.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];

function corsHeaders(origin) {
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin  = request.headers.get('Origin') ?? '';
    const cors    = corsHeaders(origin);
    const url     = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // ── GET /scores ─────────────────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/scores') {
      const { results } = await env.DB.prepare(
        'SELECT name, score FROM scores ORDER BY score DESC, ts ASC LIMIT 10'
      ).all();

      const body = results.map((r, i) => ({ rank: i + 1, name: r.name, score: r.score }));
      return Response.json(body, { headers: cors });
    }

    // ── POST /scores ─────────────────────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/scores') {
      const body = await request.json().catch(() => null);
      if (!body) {
        return Response.json({ error: 'invalid JSON' }, { status: 400, headers: cors });
      }

      const { name, score } = body;

      const safeName = String(name ?? '')
        .replace(/[^A-Z0-9]/gi, '')
        .toUpperCase()
        .slice(0, 5);

      if (!safeName) {
        return Response.json({ error: 'name required' }, { status: 400, headers: cors });
      }
      if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 9_999_999) {
        return Response.json({ error: 'invalid score' }, { status: 400, headers: cors });
      }

      // Insert and capture the row id
      const run = await env.DB.prepare(
        'INSERT INTO scores (name, score, ts) VALUES (?, ?, ?)'
      ).bind(safeName, score, Date.now()).run();
      const insertedId = run.meta.last_row_id;

      // Rank = number of strictly-higher scores + 1
      const { rank } = await env.DB.prepare(
        'SELECT COUNT(*) + 1 AS rank FROM scores WHERE score > ?'
      ).bind(score).first();

      // Context window: 5 entries centred on this rank
      const offset = Math.max(0, rank - 3);
      const { results: ctx } = await env.DB.prepare(
        'SELECT id, name, score FROM scores ORDER BY score DESC, ts ASC LIMIT 5 OFFSET ?'
      ).bind(offset).all();

      const context = ctx.map((r, i) => ({
        rank:     offset + i + 1,
        name:     r.name,
        score:    r.score,
        isPlayer: r.id === insertedId,
      }));

      return Response.json({ rank, context }, { headers: cors });
    }

    return new Response('Not Found', { status: 404, headers: cors });
  },
};
