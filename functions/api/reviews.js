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
 * The frontend (#reviews in index.html) stays hidden until count >= 5, so it is safe
 * to deploy this before any reviews exist. See docs/reviews-integration-setup.md.
 *
 * ASMG note: bodies are returned verbatim (only client-side trimmed with an ellipsis),
 * author and date travel with every review, and `average` is the true mean across ALL
 * fetched reviews (never just the featured ones).
 */

const APP_STORE_ID_DEFAULT = '6763518834';
const COUNTRIES = ['us', 'gb', 'de', 'rs'];
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
