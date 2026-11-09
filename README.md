# Card Battles: Prestige Wiki

An unofficial, fan-made wiki for the Roblox game **Card Battles: Prestige**.
It builds to a plain static site (HTML, CSS, JS, images, audio, video): no server
code, no database, no cookies, no tracking, no third-party requests.

## Run it on your PC

You need [Node.js](https://nodejs.org) 20 or newer (you have it).

```powershell
npm install
npm run dev
```

Then open **http://localhost:4321**. While `npm run dev` runs, saving any content,
image or code file rebuilds the site and reloads the browser.

| Command | What it does |
|---|---|
| `npm run dev` | Build, serve at http://localhost:4321, rebuild on every change |
| `npm run build` | Build the finished site into `dist/` |
| `npm run preview` | Build, then serve `dist/` (no auto-reload) |
| `npm run sounds` | Regenerate the UI sound files |

The build prints warnings for broken links, missing sections or bad data, and
writes **`IMAGES.md`**: the checklist of every image the site uses and whether it
has been provided.

## Putting it online

- **GitHub Pages** (free, auto-publishes on every push): [`deploy/GITHUB-PAGES.md`](deploy/GITHUB-PAGES.md)
- **Your PC + Cloudflare Tunnel** (no open ports): [`deploy/CLOUDFLARE-TUNNEL.md`](deploy/CLOUDFLARE-TUNNEL.md)
- **Cloudflare Pages** (free, works with a private repo): [`deploy/CLOUDFLARE-PAGES.md`](deploy/CLOUDFLARE-PAGES.md)
- Caddy config: [`deploy/Caddyfile`](deploy/Caddyfile). Pages headers: [`deploy/_headers`](deploy/_headers)

## Where things live

```
content/
  site.json          site name, current update, sidebar order
  home.json          home page: quick links, Start here, New in Update N
  pages/**.md        one Markdown file per page (folder = URL)
  data/*.json        all game data: cards, potions, charms, relics, materials...
images/<type>/       drop original images here (any format)
media/videos/        route videos (MP4/WebM)
src/                 build code, design (src/assets/css/site.css) and scripts
deploy/              Caddyfile, Cloudflare headers and guides
dist/                the built site (generated; do not edit)
IMAGES.md            image checklist (generated)
```

## Adding or changing game info

All game facts are in `content/data/*.json`. Layout code never needs touching.

- Each entry needs an `id` (lowercase-with-dashes) and a `name`.
- Write **`"TODO"`** (or `"TODO(what is missing)"`) for anything unknown. The site
  shows a "Details coming soon" marker.
- `"unconfirmed": true` marks a name whose spelling is not confirmed.
- `"eternal": true` / `false` shows "Eternal" or "Resets on prestige".
- `"tier"` sets the colour: `"1"`–`"8"`, or `"rare"`, `"mythic"`, `"exalted"`, `"admin"`.
- Links between things use `"kind:id"`, for example `"material:orb-fragments"`.
  These build cross-links automatically: a material listed in a charm's `recipe`
  shows "Used to craft" on the material, a card's `source` shows on its weather
  or pack, and so on.

Common fields: `summary`, `facts` ({label: value}), `stats` ({label: value}),
`effect`, `duration`, `recipe` / `cost` ([{ref, qty}]), `dropsFrom`, `sources`,
`earnedFrom`, `soldAt`, `spentAt`, `foundIn`, `aliases`, `image` (override path).

Cards: `type` (`battle`/`support`), `rarity` (the N in "1 in N", a number), `hp`,
`dmg`, `ability` ({name, text}), `border`, `source`.

## Writing pages

Pages are Markdown with a few extras:

```markdown
---
title: Potions
description: One-line summary shown under the title and in search.
updatedFor: 3
---

[[charm:orb-of-transcendence]]     link to anything (or [[Orb Fragments]] by name)
[[potion:luck-1|Tier 1 Luck]]      ...with your own label
TODO(missing detail)               "Details coming soon" marker

:::tip                             callouts: tip, warning, resets, eternal, note, soon
Text here.
:::

{{items kind="charm"}}             item stat cards
{{potion-table type="luck"}}       sortable potion table
{{compare kind="relic"}}           side-by-side stat comparison
{{cards source="weather:cataclysm"}}  flip-able card displays
{{card-table}}                     sortable card database
{{panels kind="weather"}}          big info panels (weathers, bosses, packs...)
{{panel ref="place:scrap-shop"}}   one panel
{{ladder src="victory-road.rewards"}}  animated tier ladder from data
{{progress label="Shards" value=5 max=15}}
{{gallery images="routes/x-1|Step 1;routes/x-2|Step 2"}}
{{video src="routes/x" poster="routes/x-poster" title="Route video"}}
{{image src="screenshots/x" alt="..." caption="..."}}
{{soon "what is missing"}}
```

All tables are sortable. Every heading gets a copy-link button and appears in
"On this page".

## Images

Drop originals into `images/<folder>/<name>.<ext>`. The exact names wanted are in
`IMAGES.md`. Any format works (PNG, JPG, WebP, AVIF, GIF, TIFF). The build makes
AVIF and WebP versions in several sizes and never changes your originals.

## Security

- Content-Security-Policy `default-src 'self'`: no inline scripts, styles or `eval`.
- Every page also carries the policy in a `<meta>` tag, so local previews enforce it.
- Fonts (Inter and Geist Mono; SIL Open Font License) and icons are self-hosted.
- Sounds are generated by `src/tools/make-sounds.mjs`, off by default, and remembered
  in the browser's local storage (no cookies).
