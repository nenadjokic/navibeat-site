/**
 * /api/roadmap - the public board behind navibeat.app/roadmap.
 *
 * WHERE THE TRUTH LIVES. Zammad, on the NAS, decides what an item is: its
 * title, which line it belongs to, whether it is a bug or a change request, and
 * how far along it is. None of that can be written from here. A Worker cannot
 * reach 192.168.0.110, so the NAS pushes into D1 through /api/roadmap/sync and
 * collects, in the same call, the two things that can only be born at the edge:
 * votes, and what visitors write in.
 *
 * WHAT VISITORS MAY WRITE. Anyone can vote, propose something, or say "I have
 * this too". None of that text is served back until a person has approved it,
 * which is why `comments.approved` starts at 0 and submissions never render at
 * all: they become Zammad tickets, go through the same classifier and the same
 * injection hardening as mail, and reach the board only if they come back
 * marked public.
 *
 * WHO A VOTER IS. A salted hash of address plus user agent. The raw address is
 * never written down. A household behind one address counts as one voter; for
 * a roadmap this is the right trade against making people create accounts.
 */

const MAX_TITLE = 120;
const MAX_BODY = 2000;
const MAX_AUTHOR = 60;
const SUBMIT_PER_DAY = 3;
const COMMENT_PER_DAY = 10;

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  // Vote counts are the point of the page, so nothing here may be cached by the
  // edge: a cached /api/roadmap freezes every number on the board.
  'cache-control': 'no-store, no-cache, must-revalidate',
};

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });

const now = () => new Date().toISOString();

/** Salted hash of who is asking. Never store, log or return the address itself. */
async function voterHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ua = request.headers.get('user-agent') || '';
  const salt = env.ROADMAP_SALT || 'navibeat-roadmap-unsalted';
  const data = new TextEncoder().encode(`${salt}|${ip}|${ua}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Length-independent comparison, so a wrong token cannot be found byte by byte. */
function secretsMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function clean(value, max) {
  if (typeof value !== 'string') return '';
  // Strip control characters, collapse runs of whitespace, then cut to length.
  return value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

async function countSince(db, table, voter, hours) {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE voter = ? AND created_at > ?`)
    .bind(voter, since)
    .first();
  return row ? row.n : 0;
}

// #501791: has this person already sent this exact title recently? Same shape as
// countSince above, and deliberately scoped by TITLE rather than by the whole
// body: the title is what the person retypes, and two genuinely different ideas
// from one person do not share one.
const DUPLICATE_WINDOW_HOURS = 24;

async function sentThisAlready(db, voter, title) {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 3600 * 1000).toISOString();
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM submissions
       WHERE voter = ? AND created_at > ? AND lower(trim(title)) = lower(trim(?))`
    )
    .bind(voter, since, title)
    .first();
  return !!(row && row.n > 0);
}

/* ---------------------------------------------------------------- board ---- */

async function board(request, env) {
  const db = env.ROADMAP_DB;
  const voter = await voterHash(request, env);

  const [items, comments, mine] = await Promise.all([
    db.prepare(
      `SELECT id, number, title, kind, section, status, votes, updated_at
         FROM items ORDER BY votes DESC, updated_at DESC`
    ).all(),
    db.prepare(
      `SELECT item_id, body, author, created_at
         FROM comments WHERE approved = 1 ORDER BY created_at ASC`
    ).all(),
    db.prepare(`SELECT item_id FROM votes WHERE voter = ?`).bind(voter).all(),
  ]);

  const byItem = new Map();
  for (const c of comments.results || []) {
    if (!byItem.has(c.item_id)) byItem.set(c.item_id, []);
    byItem.get(c.item_id).push({ body: c.body, author: c.author || null, created_at: c.created_at });
  }

  return json({
    items: (items.results || []).map((i) => ({ ...i, comments: byItem.get(i.id) || [] })),
    voted: (mine.results || []).map((r) => r.item_id),
    generated_at: now(),
  });
}

/* ----------------------------------------------------------------- vote ---- */

async function vote(request, env) {
  const body = await readJson(request);
  const id = Number(body && body.item_id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'item_id missing' }, 400);

  const db = env.ROADMAP_DB;
  const voter = await voterHash(request, env);

  const item = await db.prepare(`SELECT id FROM items WHERE id = ?`).bind(id).first();
  if (!item) return json({ error: 'no such item' }, 404);

  const existing = await db
    .prepare(`SELECT item_id FROM votes WHERE item_id = ? AND voter = ?`)
    .bind(id, voter)
    .first();

  // A second press takes the vote back. The count is always recomputed from the
  // votes table rather than incremented, so a retry or a double tap cannot
  // leave the number drifting away from the rows behind it.
  if (existing) {
    await db.prepare(`DELETE FROM votes WHERE item_id = ? AND voter = ?`).bind(id, voter).run();
  } else {
    await db
      .prepare(`INSERT OR IGNORE INTO votes (item_id, voter, created_at) VALUES (?, ?, ?)`)
      .bind(id, voter, now())
      .run();
  }

  const { n } = await db
    .prepare(`SELECT COUNT(*) AS n FROM votes WHERE item_id = ?`)
    .bind(id)
    .first();
  await db.prepare(`UPDATE items SET votes = ? WHERE id = ?`).bind(n, id).run();

  return json({ item_id: id, votes: n, voted: !existing });
}

/* ------------------------------------------------------------ turnstile ---- */

// Cloudflare Turnstile, on the "Ask for something" form only. Added 2026-09-06
// after #501973: a submission titled "Become Gay" with the body "Being lesbian"
// came through the public form, was filed automatically as a BUG on the Apple
// board, and had to be read and closed by hand.
//
// The form was never wide open. It already rate limits per voter hash per day,
// refuses the same title twice inside 24 hours, and holds minimum lengths. None
// of that can tell a well-formed nonsense submission from a real one, which is
// the gap this closes.
//
// Turnstile rather than reCAPTCHA, and the reason is on the site itself: the
// privacy page and llms.txt both say NaviBeat carries no third-party tracking.
// Google's widget would put a Google script and its cookie on the page of the
// site making that claim. Turnstile sets no cookie, and the verification below
// is a server call from the same Worker that already serves the page.
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * True when the submission may proceed.
 *
 * UNCONFIGURED IS OPEN, AND IT SAYS SO. With no TURNSTILE_SECRET bound, this
 * returns true and warns. Failing closed instead would take the form down the
 * moment this deploys and before the secret is set, and a form that answers
 * every visitor with an error is worse than the junk it would stop. The warning
 * is greppable in the Worker log, so "unguarded" is a state you can see rather
 * than one you have to remember.
 */
async function passesTurnstile(request, env, token) {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) {
    console.warn('[roadmap] TURNSTILE_SECRET is not set: submissions are UNGUARDED');
    return true;
  }
  if (typeof token !== 'string' || !token) return false;

  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  // Cloudflare hands the client address to the Worker, and Turnstile scores
  // better with it. Absent on a local dev request, hence the guard.
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body: form });
    const out = await res.json();
    if (!out.success) {
      console.warn(`[roadmap] turnstile refused: ${(out['error-codes'] || []).join(',')}`);
    }
    return !!out.success;
  } catch (err) {
    // A verification that cannot be reached must not silently admit everyone,
    // and must not eat a real person's suggestion either. Refuse, and the form
    // tells them to try again: the retry costs one tick of the box.
    console.error(`[roadmap] turnstile unreachable: ${err && err.message}`);
    return false;
  }
}

/* --------------------------------------------------------------- submit ---- */

async function submit(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: 'bad request' }, 400);

  const title = clean(body.title, MAX_TITLE);
  if (title.length < 6) return json({ error: 'Give it a title of at least 6 characters.' }, 400);

  // Before the database, on purpose: a refused submission costs no D1 read.
  if (!(await passesTurnstile(request, env, body.turnstileToken))) {
    return json({ error: 'That did not verify. Tick the box and send it again.' }, 400);
  }

  const db = env.ROADMAP_DB;
  const voter = await voterHash(request, env);

  const recent = await countSince(db, 'submissions', voter, 24);
  if (recent >= SUBMIT_PER_DAY) {
    return json({ error: `That is ${SUBMIT_PER_DAY} suggestions today. Try again tomorrow.` }, 429);
  }

  // #501791: the same suggestion twice files two support tickets, and it
  // happened on 2026-08-31: hanlane97 sent the same title and the same body at
  // 11:57 and 11:58, and both became tickets that then needed the same answer
  // written twice.
  //
  // The page is what invites it, and the page is right: a new suggestion appears
  // on the board only after it has been read and given a public description, so
  // a person who sends one sees nothing appear and reasonably tries again. The
  // form already disables its button for the duration of the POST, so this is
  // not a double click. The server is the only place that can tell a resend from
  // a second idea.
  //
  // ANSWER `ok`, NOT AN ERROR. Somebody resending because they were unsure has
  // done nothing wrong and must see the same reassurance, not a rejection that
  // reads as though their idea was refused.
  if (await sentThisAlready(db, voter, title)) {
    return json({ ok: true, duplicate: true });
  }

  const email = clean(body.email, 120);
  await db
    .prepare(
      `INSERT INTO submissions (title, body, email, kind, section, voter, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      title,
      clean(body.body, MAX_BODY) || null,
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null,
      body.kind === 'BUG' ? 'BUG' : 'CR',
      clean(body.section, 40) || null,
      voter,
      now()
    )
    .run();

  return json({ ok: true });
}

/* -------------------------------------------------------------- comment ---- */

async function comment(request, env) {
  const body = await readJson(request);
  const id = Number(body && body.item_id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'item_id missing' }, 400);

  const text = clean(body.body, MAX_BODY);
  if (text.length < 3) return json({ error: 'Say a little more than that.' }, 400);

  const db = env.ROADMAP_DB;
  const voter = await voterHash(request, env);

  const item = await db.prepare(`SELECT id FROM items WHERE id = ?`).bind(id).first();
  if (!item) return json({ error: 'no such item' }, 404);

  const recent = await countSince(db, 'comments', voter, 24);
  if (recent >= COMMENT_PER_DAY) return json({ error: 'Too many comments today.' }, 429);

  await db
    .prepare(
      `INSERT INTO comments (item_id, body, author, voter, created_at) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, text, clean(body.author, MAX_AUTHOR) || null, voter, now())
    .run();

  // Deliberately honest: it is not on the page yet, and saying so beats letting
  // someone refresh looking for words that a person has not read.
  return json({ ok: true, pending: true });
}

/* ----------------------------------------------------------------- sync ---- */

/**
 * The NAS calls this. It sends the full set of public items and receives every
 * vote count, plus the submissions and comments it has not collected yet. One
 * request, one direction of trust: the edge never holds a Zammad credential and
 * the NAS never has to be reachable from outside.
 */
async function sync(request, env) {
  const token = request.headers.get('X-Roadmap-Token') || '';
  if (!env.ROADMAP_SYNC_TOKEN || !secretsMatch(token, env.ROADMAP_SYNC_TOKEN)) {
    return json({ error: 'unauthorized' }, 401);
  }

  const payload = await readJson(request);
  if (!payload || !Array.isArray(payload.items)) return json({ error: 'items missing' }, 400);

  const db = env.ROADMAP_DB;
  const stamp = now();
  const seen = [];
  const statements = [];

  for (const raw of payload.items) {
    const id = Number(raw && raw.id);
    const title = clean(raw && raw.title, MAX_TITLE);
    // A row without a public title is the one thing that must never reach the
    // board: the ticket subject may be the reporter's own words, or a migrated
    // backlog line nobody wrote for the public. The NAS filters these too; this
    // is the second lock on the same door.
    if (!Number.isInteger(id) || id <= 0 || !title) continue;
    seen.push(id);
    statements.push(
      db.prepare(
        `INSERT INTO items (id, number, title, kind, section, status, votes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT votes FROM items WHERE id = ?), 0), ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           number = excluded.number, title = excluded.title, kind = excluded.kind,
           section = excluded.section, status = excluded.status, updated_at = excluded.updated_at`
      ).bind(
        id,
        clean(raw.number, 20),
        title,
        clean(raw.kind, 10) || null,
        clean(raw.section, 40) || null,
        clean(raw.status, 20) || 'considering',
        id,
        stamp,
        stamp
      )
    );
  }

  // Anything the NAS no longer calls public goes, and its votes go with it. A
  // ticket that stops being public has been unpublished on purpose.
  if (seen.length) {
    const holes = seen.map(() => '?').join(',');
    statements.push(db.prepare(`DELETE FROM votes WHERE item_id NOT IN (${holes})`).bind(...seen));
    statements.push(db.prepare(`DELETE FROM comments WHERE item_id NOT IN (${holes})`).bind(...seen));
    statements.push(db.prepare(`DELETE FROM items WHERE id NOT IN (${holes})`).bind(...seen));
  } else {
    statements.push(db.prepare(`DELETE FROM votes`));
    statements.push(db.prepare(`DELETE FROM comments`));
    statements.push(db.prepare(`DELETE FROM items`));
  }

  if (statements.length) await db.batch(statements);

  // Recount from the votes table rather than trusting the stored number.
  await db
    .prepare(`UPDATE items SET votes = (SELECT COUNT(*) FROM votes WHERE votes.item_id = items.id)`)
    .run();

  const [counts, pendingSubs, pendingComments] = await Promise.all([
    db.prepare(`SELECT id, number, votes FROM items`).all(),
    db.prepare(
      `SELECT id, title, body, email, kind, section, created_at
         FROM submissions WHERE synced = 0 ORDER BY id ASC LIMIT 50`
    ).all(),
    db.prepare(
      `SELECT id, item_id, body, author, created_at
         FROM comments WHERE synced = 0 ORDER BY id ASC LIMIT 50`
    ).all(),
  ]);

  return json({
    ok: true,
    stored: seen.length,
    votes: counts.results || [],
    submissions: pendingSubs.results || [],
    comments: pendingComments.results || [],
  });
}

/**
 * Marks what the NAS has taken into Zammad, so the next sync does not hand it
 * over twice. Sent as a separate call ON PURPOSE: acknowledging in the same
 * request that delivers the rows would mark them done before the tickets exist,
 * and a crash in between would lose somebody's report silently.
 */
async function ack(request, env) {
  const token = request.headers.get('X-Roadmap-Token') || '';
  if (!env.ROADMAP_SYNC_TOKEN || !secretsMatch(token, env.ROADMAP_SYNC_TOKEN)) {
    return json({ error: 'unauthorized' }, 401);
  }
  const payload = await readJson(request);
  if (!payload) return json({ error: 'bad request' }, 400);

  const db = env.ROADMAP_DB;
  const statements = [];

  for (const row of payload.submissions || []) {
    const id = Number(row && row.id);
    if (!Number.isInteger(id)) continue;
    statements.push(
      db.prepare(`UPDATE submissions SET synced = 1, ticket_id = ? WHERE id = ?`)
        .bind(Number(row.ticket_id) || null, id)
    );
  }
  for (const id of payload.comment_ids || []) {
    if (Number.isInteger(Number(id))) {
      statements.push(db.prepare(`UPDATE comments SET synced = 1 WHERE id = ?`).bind(Number(id)));
    }
  }

  if (statements.length) await db.batch(statements);
  return json({ ok: true, acknowledged: statements.length });
}

/* ---------------------------------------------------------------- entry ---- */

export async function handle(request, env, pathname) {
  if (!env.ROADMAP_DB) return json({ error: 'roadmap database not bound' }, 503);

  if (pathname === '/api/roadmap') {
    if (request.method === 'GET' || request.method === 'HEAD') return board(request, env);
    return json({ error: 'Method Not Allowed' }, 405, { allow: 'GET, HEAD' });
  }

  const routes = {
    '/api/roadmap/vote': vote,
    '/api/roadmap/submit': submit,
    '/api/roadmap/comment': comment,
    '/api/roadmap/sync': sync,
    '/api/roadmap/ack': ack,
  };
  const fn = routes[pathname];
  if (!fn) return null;
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405, { allow: 'POST' });

  try {
    return await fn(request, env);
  } catch (err) {
    // The message can carry SQL and column names, so it is logged, not returned.
    console.error(`[roadmap] ${pathname}: ${err && err.message}`);
    return json({ error: 'Something broke on our side. Try again in a moment.' }, 500);
  }
}
