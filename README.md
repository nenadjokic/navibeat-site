# navibeat-site

Marketing website for **NaviBeat** — the native Apple-ecosystem client for Navidrome, Airsonic, Gonic, and OpenSubsonic music servers.

Live site: [https://navibeat.app](https://navibeat.app)
Main product repo (private, Gitea): the NaviBeat Swift source lives elsewhere — this repository contains **only the static marketing site**.

## Stack

Pure static site. No build step.

- HTML5 + CSS3 (hand-written, no framework)
- Three typefaces loaded from Google Fonts: Fraunces (display), Inter Tight (body), JetBrains Mono (eyebrows)
- Schema.org JSON-LD on every page
- `sitemap.xml` + `robots.txt` for SEO
- `_redirects` file for Cloudflare Pages extensionless URLs

## Deploy

The site deploys automatically to **Cloudflare Pages** on every push to `main`.

**Cloudflare Pages build settings:**

| Setting | Value |
|---------|-------|
| Framework preset | None |
| Build command | *(leave empty)* |
| Build output directory | `/` |
| Root directory | `/` |

## Local preview

No server needed — just open `index.html` in a browser, or run a tiny static server:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Updating content

Images in `assets/screenshots/` use predictable names. To swap in fresh screenshots, drop a file with the same name in the same folder — no HTML changes required. See `assets/README.md` for the complete slot list and target dimensions.

## License

Content (text, screenshots, design) © 2026 Nenad Jokic. All rights reserved.
Navidrome, Subsonic, Airsonic, and Gonic are trademarks of their respective owners.
