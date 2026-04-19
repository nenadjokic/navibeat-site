# NaviBeat marketing assets

All image slots are referenced by filename. To swap in real renders/screenshots later, drop a file with the same name into the same folder — nothing else needs to change.

## `assets/devices/` — hero + lozenge device renders

Used by: home page hero lineup (`index.html`) and per-platform hero shots (`macos.html`, `appletv.html`, coming-soon pages).

| File | Slot | Target size | Notes |
|------|------|-------------|-------|
| `appletv.svg`   | Apple TV device render | ~1400×900  | 16:9 stage, device + room vignette |
| `macbook.svg`   | MacBook device render  | ~1400×900  | Open lid 3/4 angle |
| `ipad.svg`      | iPad device render     | ~1400×900  | Portrait or landscape, both work |
| `iphone.svg`    | iPhone device render   | ~600×1200  | Portrait 1:2 |
| `applewatch.svg`| Apple Watch render     | ~600×800   | 3:4 portrait |
| `carplay.svg`   | CarPlay render         | ~1400×900  | Dashboard context |

**Swap format:** Replace the `.svg` with `.png` / `.webp` at the target dimensions and update `<img src>` in the HTML to match the new extension. All `<img>` tags use `width: 100%; height: auto` so any reasonable aspect ratio is honoured.

## `assets/placeholders/` — deep-dive screenshot slots

Used by: inline "deep" blocks inside platform pages.

| File | Page | Purpose |
|------|------|---------|
| `mac-drawer-lyrics.svg`      | macos.html   | Drawer + lyrics craft shot |
| `mac-sidebar-full.svg`       | macos.html   | Full sidebar layout shot |
| `appletv-focus-detail.svg`   | appletv.html | Focus halo detail |
| `appletv-grid.svg`           | appletv.html | Home grid shelf layout |
| `hero-mac-miniplayer.svg`    | (reserved)   | Future Mini Player hero |
| `iphone-nowplaying.svg`      | (reserved)   | Future iPhone Now Playing |
| `ipad-sidebar.svg`           | (reserved)   | Future iPad sidebar |
| `watch-nowplaying.svg`       | (reserved)   | Future Watch face |
| `universal-purchase-diagram.svg` | (reserved) | Future UP flow diagram |

Target aspect ratio for all screenshot slots: **3:2** (1800×1200 renders well on HiDPI; the `<img>` tag constrains to CSS width).

## `assets/icon.svg`

Brand mark used in the nav + footer. Keep this one as SVG for crisp rendering at any size.

## Swap workflow

1. Export the real render at the target size.
2. Save to the same path with the same filename (or update the single `<img src>` reference if you change extension).
3. Push to Gitea → Cloudflare Pages auto-builds.

No layout changes required — the container CSS handles sizing.
