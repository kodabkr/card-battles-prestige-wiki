# Host on GitHub Pages (free)

The site publishes itself: every push to `main` runs
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), which builds
the wiki and puts it live at:

**https://kodabkr.github.io/card-battles-prestige-wiki/**

## One-time setup

1. Create an empty **public** repository named `card-battles-prestige-wiki` on
   github.com (no README, no .gitignore, no license):
   https://github.com/new?name=card-battles-prestige-wiki&visibility=public
2. Push this folder (already set up locally with the right remote):
   ```powershell
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Open the **Actions** tab. If the first run failed because Pages was not on yet,
   click **Deploy wiki → Run workflow**.

## Updating the site

Either:

- Edit files on your PC, then `git add -A`, `git commit -m "..."`, `git push`; or
- Edit a file directly on github.com (pencil icon) and commit. The site rebuilds
  in about a minute.

## How the sub-path works

GitHub serves project sites under `/card-battles-prestige-wiki/`. The workflow
passes that path to the build as `BASE_PATH`, and every link, image, font and
search result is prefixed with it. Local builds (`npm run dev`) use no prefix.

## Security notes

GitHub Pages does not allow custom HTTP headers. The Content-Security-Policy and
referrer policy still apply because every page carries them in `<meta>` tags
(no inline scripts, no eval, no third-party requests). Two protections that only
work as real headers are not available on GitHub Pages: `frame-ancestors`
(blocking other sites from embedding the wiki in a frame) and
`Permissions-Policy`. The site never uses the camera, microphone or location, so
the practical risk is very low. Use the Caddy or Cloudflare setups if you want
every header.
