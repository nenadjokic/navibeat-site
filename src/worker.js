/**
 * navibeat.app Worker entry.
 *
 * The site is deployed as a Worker with static assets (wrangler.jsonc
 * `assets.directory: "."`). Static assets are served before this script runs,
 * so this fetch handler only sees paths that match no file: it answers
 * /api/reviews (the Pages Functions convention in functions/ never executed on
 * Workers, which is why the route 404'd until 2026-07-22) and hands everything
 * else back to the asset handler for the normal 404.
 *
 * 2026-07-26: added /api/linux-downloads plus a scheduled() handler. GitHub only
 * reports a CUMULATIVE download count per release asset, so a per-day series has
 * to be snapshotted by us. The cron takes the snapshots; the route serves them.
 */
import { onRequestGet } from '../functions/api/reviews.js';
import {
  onRequestGet as linuxDownloads,
  collect as collectLinuxDownloads,
} from '../functions/api/linux-downloads.js';
import { handle as roadmap } from '../functions/api/roadmap.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // 2026-09-03, Nenad: the NaviFin page on this site is gone, and its address
    // sends people to the real NaviFin site. The static page was deleted so this
    // handler actually sees the path (assets are served before the worker runs).
    if (url.pathname === '/navifin' || url.pathname === '/navifin/' || url.pathname === '/navifin.html') {
      return Response.redirect('https://navifin.app/', 301);
    }
    if (url.pathname === '/api/reviews') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
      }
      return onRequestGet({ request, env });
    }
    if (url.pathname === '/api/linux-downloads') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
      }
      return linuxDownloads({ request, env });
    }
    // The public roadmap board. One module owns every /api/roadmap* path and
    // answers null for anything it does not recognise, so an unknown path under
    // that prefix still falls through to the normal 404 instead of being
    // swallowed here.
    if (url.pathname === '/api/roadmap' || url.pathname.startsWith('/api/roadmap/')) {
      const res = await roadmap(request, env, url.pathname);
      if (res) return res;
    }
    return env.ASSETS.fetch(request);
  },

  // Four times a day. Once a day would give the same daily granularity, but four
  // means a missed run (GitHub answers 403 to unauthenticated bursts from shared
  // egress) still leaves the day with a value instead of a hole.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(collectLinuxDownloads(env, event.scheduledTime));
  },
};
