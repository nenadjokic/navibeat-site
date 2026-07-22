/**
 * navibeat.app Worker entry.
 *
 * The site is deployed as a Worker with static assets (wrangler.jsonc
 * `assets.directory: "."`). Static assets are served before this script runs,
 * so this fetch handler only sees paths that match no file: it answers
 * /api/reviews (the Pages Functions convention in functions/ never executed on
 * Workers, which is why the route 404'd until 2026-07-22) and hands everything
 * else back to the asset handler for the normal 404.
 */
import { onRequestGet } from '../functions/api/reviews.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/reviews') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
      }
      return onRequestGet({ request, env });
    }
    return env.ASSETS.fetch(request);
  },
};
