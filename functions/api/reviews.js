/**
 * GET /api/reviews
 *
 * Aggregates NaviBeat's public App Store customer-review RSS feeds across a few
 * storefronts, caches the result in KV (binding: REVIEWS_KV) for one hour, and
 * returns JSON:
 *   { count, average, fetchedAt, reviews: [{ author, rating, title, body, version, date }] }
 *
 * This is a Cloudflare Pages Function. In the deployed navibeat-site repo it lives
 * at functions/api/reviews.js, so it answers the /api/reviews route automatically.
 *
 * Bindings (set in Cloudflare dashboard: Pages project > Settings > Functions):
 *   - KV namespace binding  REVIEWS_KV    (optional: without it, no caching, just a live fetch)
 *   - Environment variable  APP_STORE_ID  (optional: defaults to NaviBeat's real id below)
 *
 * The frontend (#reviews in index.html) reveals as soon as there is at least one
 * review and shows EVERY rating (transparency, 2026-06-24), so critical reviews
 * are not hidden. See docs/reviews-integration-setup.md.
 *
 * ASMG note: bodies are returned verbatim, author and date travel with every
 * review, every rating is included, and `average` is the true mean across ALL
 * fetched reviews.
 */

const APP_STORE_ID_DEFAULT = '6763518834';
// Transparency (2026-06-24, Nenad): aggregate a broad set of storefronts so
// EVERY real review shows on the site, not just a few markets. Apple's RSS is
// per-territory, so a review only appears if we query that territory's feed
// (e.g. our 2-star reviews live in `pl` and `ch`, which the old us/gb/de/rs
// list missed entirely). 33 storefronts covers all current review territories
// plus the major markets; stays under the Pages-Function subrequest cap.
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
  const { env } = context;
  const appId = (env && env.APP_STORE_ID) || APP_STORE_ID_DEFAULT;

  if (env && env.REVIEWS_KV) {
    const cached = await env.REVIEWS_KV.get(CACHE_KEY, { type: 'json' });
    if (cached && Date.now() - cached.fetchedAt < TTL_SECONDS * 1000) {
      return json(cached.data);
    }
  }

  const feeds = await Promise.all(COUNTRIES.map(async (c) => {
    try {
      const res = await fetch(
        `https://itunes.apple.com/${c}/rss/customerreviews/id=${appId}/sortBy=mostRecent/json`,
        { cf: { cacheTtl: 1800 } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.feed && data.feed.entry) || [];
    } catch (_e) {
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

  if (env && env.REVIEWS_KV) {
    await env.REVIEWS_KV.put(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), data: summary }),
      { expirationTtl: TTL_SECONDS }
    );
  }

  return json(summary);
}

function json(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=600',
    },
  });
}
