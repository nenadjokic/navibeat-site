/**
 * GET /api/linux-downloads
 *
 * Download counters for the NaviBeat Linux release binaries, with history.
 *
 * WHY THIS EXISTS (2026-07-26): GitHub's release API only reports a CUMULATIVE
 * `download_count` per asset. There is no per-day series anywhere in the API, so
 * "how many yesterday" and "how many this week" can only come from snapshots we
 * take ourselves. This handler is both halves: the Worker's scheduled() calls
 * `collect()` to append a snapshot, and GET serves the history plus the deltas
 * computed from it.
 *
 * Storage (binding NAVIBEAT_STATS, key `linux-downloads`):
 *   {
 *     updated: ISO string,
 *     latest:  { total, assets: { name: count } },
 *     daily:   { "YYYY-MM-DD": { total, assets: { name: count } } }
 *   }
 *
 * One entry per UTC day, last write of the day wins. That is deliberately a map
 * and not an append-only log: the cron runs several times a day, and a day map
 * keeps the value small forever while giving exactly the daily granularity the
 * deltas need.
 *
 * A day's delta is `total(day) - total(previous day present in the map)`, so a
 * missed cron run does not invent a zero day: the gap is attributed to the next
 * day that has data, and `estimated` marks it.
 */

const REPO = 'nenadjokic/navibeat-linux';
const KEY = 'linux-downloads';
const UA = 'navibeat.app download-counter (+https://navibeat.app/linux)';

function today(now) {
  return new Date(now).toISOString().slice(0, 10);
}

async function readStore(env) {
  if (!env || !env.NAVIBEAT_STATS) return null;
  try {
    const raw = await env.NAVIBEAT_STATS.get(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/** Poll GitHub and fold the result into today's slot. Returns the store. */
export async function collect(env, nowMs) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const store = (await readStore(env)) || { daily: {} };

  let releases = null;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, {
      headers: { 'user-agent': UA, accept: 'application/vnd.github+json' },
    });
    if (res.ok) releases = await res.json();
  } catch (e) {
    releases = null;
  }
  // GitHub answers 403 to unauthenticated bursts from shared egress. On any
  // failure we keep whatever the store already holds rather than writing a zero.
  if (!Array.isArray(releases)) return store;

  const assets = {};
  const perRelease = {};
  let total = 0;
  for (const r of releases) {
    let sub = 0;
    for (const a of r.assets || []) {
      assets[a.name] = (assets[a.name] || 0) + a.download_count;
      sub += a.download_count;
    }
    perRelease[r.tag_name] = { downloads: sub, published: (r.published_at || '').slice(0, 10) };
    total += sub;
  }

  const stamp = new Date(now).toISOString();
  store.latest = { total, assets, releases: perRelease };
  store.updated = stamp;
  store.daily = store.daily || {};
  store.daily[today(now)] = { total, assets, at: stamp };

  if (env && env.NAVIBEAT_STATS) {
    await env.NAVIBEAT_STATS.put(KEY, JSON.stringify(store));
  }
  return store;
}

/** Turn the day map into an ordered series with per-day deltas. */
function series(store) {
  const days = Object.keys(store.daily || {}).sort();
  const out = [];
  let prevTotal = null;
  let prevDay = null;
  for (const d of days) {
    const t = store.daily[d].total;
    const gapDays = prevDay ? Math.round((Date.parse(d) - Date.parse(prevDay)) / 86400000) : 1;
    out.push({
      date: d,
      total: t,
      // First point has no predecessor, so it carries no delta rather than
      // pretending the whole cumulative count happened on that day.
      delta: prevTotal === null ? null : t - prevTotal,
      // True when the previous data point is more than a day old, so this delta
      // covers a span rather than a single day.
      spansDays: gapDays > 1 ? gapDays : 1,
    });
    prevTotal = t;
    prevDay = d;
  }
  return out;
}

function sumLast(rows, n) {
  const withDelta = rows.filter((r) => r.delta !== null);
  return withDelta.slice(-n).reduce((a, r) => a + r.delta, 0);
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = request ? new URL(request.url) : null;
  const force = url ? url.searchParams.has('collect') : false;

  let store = await readStore(env);
  const missingToday = !store || !store.daily || !store.daily[today(Date.now())];
  // Self-heal: the first ever hit, or a hit before the day's cron has run, takes
  // one snapshot itself. Gated on the day being absent so a busy page does not
  // hammer GitHub or KV.
  if (force || missingToday) {
    store = await collect(env);
  }
  if (!store) {
    return new Response(JSON.stringify({ error: 'no store' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const rows = series(store);
  const body = {
    repo: REPO,
    updated: store.updated || null,
    total: store.latest ? store.latest.total : null,
    assets: store.latest ? store.latest.assets : {},
    releases: store.latest ? store.latest.releases || {} : {},
    trackingSince: rows.length ? rows[0].date : null,
    last24h: rows.length > 1 ? rows[rows.length - 1].delta : null,
    last7Days: sumLast(rows, 7),
    last30Days: sumLast(rows, 30),
    days: rows,
  };
  return new Response(JSON.stringify(body, null, 1), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'access-control-allow-origin': '*',
    },
  });
}
