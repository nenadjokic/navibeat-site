/**
 * GET /api/reviews
 *
 * Serves NaviBeat's App Store customer reviews as JSON:
 *   { count, average, fetchedAt, reviews: [{ author, rating, title, body, version, date }] }
 *
 * Routing (2026-07-22): the site deploys as a Cloudflare WORKER with static
 * assets, where the Pages functions/ convention never runs. src/worker.js
 * imports this handler and answers /api/reviews with it.
 *
 * Data sources, in order:
 *   1. KV cache (binding REVIEWS_KV), fresh within TTL_SECONDS. The snapshot
 *      generator (NaviBeat repo, scripts/gen-reviews-snapshot.py) pushes every
 *      fresh App Store Connect pull straight into this KV key, so reviews
 *      update on the live site without a redeploy.
 *   2. Live sweep of Apple's per-territory customer-review RSS feeds.
 *      Measured 2026-07-22: itunes.apple.com answers 403 (empty body) to every
 *      request from Cloudflare Workers egress, regardless of headers, so this
 *      currently yields nothing. Kept because it costs one early-out attempt
 *      and recovers live aggregation the day Apple unblocks the range.
 *   3. Whichever is newer of the stale KV value and the committed
 *      /reviews.json asset (generated from the App Store Connect API).
 *
 * Transparency (2026-06-24, Nenad): bodies verbatim, author and date on every
 * review, critical ratings included (not just the 4-5 star ones).
 *
 * Headline metric (changed 2026-08-08): `count` and `average` are the RATINGS
 * aggregate, every star Apple holds including the majority that carry no
 * written review, matching what Apple's own product page shows so a visitor can
 * verify it by tapping through. They are NOT the mean of the `reviews` array:
 * people who write skew critical, so that mean runs lower and is carried
 * separately as `writtenAverage`. The site must say "ratings" in the headline.
 *
 * One content rule applies to the `reviews` array: a body that says nothing
 * about the app beyond restating its own star rating is left out, enforced
 * identically for 1-star and 5-star (see is_substantive in the NaviBeat repo,
 * scripts/gen-reviews-snapshot.py). It is not a rating filter, and every
 * substantive critical review is served.
 *
 * Append ?debug=1 to see per-territory probe results instead of the payload.
 */

const APP_STORE_ID_DEFAULT = '6763518834';
// Apple's RSS is per-territory, so a review only appears if that territory's
// feed is queried (e.g. 2-star reviews live in `pl` and `ch`). 33 storefronts
// covers all current review territories plus the major markets and stays under
// the Workers subrequest cap.
const COUNTRIES = [
  'us', 'gb', 'ca', 'au', 'ie', 'nz',
  'de', 'fr', 'nl', 'be', 'ch', 'at', 'it', 'es', 'pt',
  'se', 'no', 'dk', 'fi',
  'pl', 'cz', 'rs', 'hr', 'si', 'gr', 'hu', 'ro',
  'br', 'mx', 'tr', 'jp', 'kr', 'in',
];
const CACHE_KEY = 'reviews';
const TTL_SECONDS = 3600;

export async function onRequestGet(context) {
  const { env, request } = context;
  const appId = (env && env.APP_STORE_ID) || APP_STORE_ID_DEFAULT;
  const debug = request ? new URL(request.url).searchParams.has('debug') : false;
  const probes = [];

  // 1. Fresh KV cache.
  let kvCached = null;
  if (env && env.REVIEWS_KV) {
    kvCached = await env.REVIEWS_KV.get(CACHE_KEY, { type: 'json' });
    // An empty payload is never "fresh": it only means every source failed on a
    // previous run, and serving it for a whole TTL would hide real reviews.
    if (!debug && kvCached && kvCached.data && kvCached.data.count
        && Date.now() - kvCached.fetchedAt < TTL_SECONDS * 1000) {
      return json(kvCached.data);
    }
  }

  // 2. Live RSS sweep (see header: currently 403 from Workers egress).
  const feeds = await Promise.all(COUNTRIES.map(async (c) => {
    try {
      const res = await fetch(
        `https://itunes.apple.com/${c}/rss/customerreviews/id=${appId}/sortBy=mostRecent/json`,
        { cf: { cacheTtl: 1800 } }
      );
      if (!res.ok) {
        if (debug) probes.push({ c, status: res.status, body: (await res.text()).slice(0, 120) });
        return [];
      }
      const data = await res.json();
      const entries = (data.feed && data.feed.entry) || [];
      if (debug) probes.push({ c, status: res.status, entries: entries.length });
      return entries;
    } catch (e) {
      if (debug) probes.push({ c, error: String(e).slice(0, 160) });
      return [];
    }
  }));

  const seen = new Set();
  const reviews = feeds
    .flat()
    .filter((e) => e && e['im:rating']) // drop the leading app-info entry
    .map((e) => ({
      author: e.author && e.author.name ? e.author.name.label : 'App Store',
      rating: parseInt(e['im:rating'].label, 10) || 0,
      title: e.title ? e.title.label : '',
      body: e.content ? e.content.label : '',
      version: e['im:version'] ? e['im:version'].label : '',
      date: e.updated ? e.updated.label : '',
    }))
    .filter((r) => {
      const key = r.author + '|' + r.title + '|' + r.body;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const summary = {
    count: reviews.length,
    average: reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0,
    fetchedAt: Date.now(),
    reviews,
  };

  let result = summary;
  let source = 'live-rss';

  // 3. Pick the RICHEST payload we hold, not merely a non-empty one.
  //
  // BUG FIXED 2026-08-27, and it was visible to every visitor: the page painted
  // all 21 reviews from the snapshot and then dropped to a single card a second
  // later. The fallback below used to be gated on `!summary.count`, so ANY
  // non-empty live sweep won outright. On 2026-08-25 at 16:42 Apple answered
  // from exactly one territory, the sweep came back with one review, that
  // beat a 21-review snapshot on the strength of being non-empty, and it was
  // written into KV. From then on the bad payload also won every recency
  // comparison, because it genuinely was more recent.
  //
  // Recency alone cannot decide this: a sweep is newer by construction while
  // being a small sample of the same underlying data. Count of reviews is what
  // actually says which payload is more complete, so that leads, and recency
  // only breaks ties. Note `count` is the ratings aggregate and NOT comparable
  // across sources, so the comparison uses the length of `reviews`.
  const size = (d) => (d && Array.isArray(d.reviews) ? d.reviews.length : 0);
  const better = (candidate, current) => {
    if (!candidate || !candidate.count || !size(candidate)) return false;
    if (size(candidate) !== size(current)) return size(candidate) > size(current);
    return (candidate.fetchedAt || 0) > (current.fetchedAt || 0);
  };

  if (kvCached && kvCached.data && better(kvCached.data, result)) {
    result = kvCached.data;
    source = 'kv-stale';
  }
  if (env && env.ASSETS && request) {
    try {
      const snap = await env.ASSETS.fetch(new URL('/reviews.json', request.url));
      if (snap.ok) {
        const s = await snap.json();
        if (better(s, result)) {
          result = s;
          source = 'asset-snapshot';
        }
      }
    } catch (_e) { /* fall through with what we have */ }
  }

  // Only cache real data; never overwrite a good stale value with emptiness.
  //
  // BUG FIXED 2026-08-08, and it silently served a month-old snapshot. Two
  // separate mistakes compounded:
  //
  //   1. The outer stamp was `Date.now()`, i.e. WHEN WE WROTE, not how old the
  //      data is. Falling back to a stale snapshot therefore re-stamped it as
  //      fresh, so the TTL check at the top passed for another full hour, and
  //      re-stamped again on the next miss. Stale data stayed "fresh" forever.
  //   2. It rewrote even when `result` came straight out of KV, which can only
  //      ever re-stamp, never improve anything, and which is what clobbered the
  //      generator's authoritative push: gen-reviews-snapshot.py wrote the new
  //      snapshot, a request landed on an edge replica that had not caught up
  //      yet, and the worker wrote the old payload back over it.
  //
  // So: carry the DATA's own fetchedAt as the outer stamp, and never write back
  // a value that came out of KV in the first place. A snapshot pushed by the
  // generator now always wins on recency, because it genuinely is more recent.
  // Added 2026-08-27: never write a payload thinner than what KV already holds.
  // Without this the one-territory sweep overwrote a full snapshot, and the
  // damage outlived the request that caused it.
  const worseThanKV = kvCached && kvCached.data
    && (kvCached.data.reviews || []).length > (result.reviews || []).length;

  if (!debug && result.count && env && env.REVIEWS_KV && source !== 'kv-stale' && !worseThanKV) {
    await env.REVIEWS_KV.put(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: result.fetchedAt || Date.now(), data: result }),
      { expirationTtl: 30 * 24 * 3600 }
    );
  }

  if (debug) return json({ source, count: result.count, probes });
  return json(result);
}

function json(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // 2026-07-30 site audit: the cold Worker path measured 1.52s and, with
      // only max-age=600, roughly every visitor after 10 quiet minutes paid
      // it. s-maxage lets the edge keep serving the cached body and
      // stale-while-revalidate refreshes it in the background, so the cold
      // path almost never lands on a real visitor.
      'cache-control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
