# Host on Cloudflare Pages from a private GitHub repo (free)

Cloudflare Pages builds the site straight from the GitHub repo, and the repo can
be **private**. Every push to `main` rebuilds and republishes the site, just
like GitHub Pages, and the full security headers in `deploy/_headers` apply.

The site address will be `https://<project-name>.pages.dev`.

## One-time setup (about 5 minutes)

1. Make a free account at https://dash.cloudflare.com/sign-up (skip adding a
   domain if it asks).
2. Go to **Workers & Pages → Create → Pages → Connect to Git**.
3. Choose **GitHub**, then authorize Cloudflare. When GitHub asks which
   repositories to allow, pick **Only select repositories →
   `card-battles-prestige-wiki`**.
4. Select the repo and use these build settings:
   - Project name: `card-battles-wiki` (this becomes the address)
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Leave root directory empty. Node 22 is picked up from `.nvmrc`.
5. Click **Save and Deploy**. The first build takes 1–2 minutes.
6. Open `https://card-battles-wiki.pages.dev` to check it.

## Then make the repo private

Once the Cloudflare site works:

1. GitHub repo → **Settings → General → Danger Zone → Change visibility →
   Make private**.
2. GitHub Pages stops (free accounts can't serve Pages from private repos), so
   delete `.github/workflows/deploy.yml` from the repo, otherwise every push
   reports a failed run.

Cloudflare keeps building from the private repo.

## Updating

Push to `main` (or edit a file on github.com). Cloudflare rebuilds in about a
minute. Each build's log is under **Workers & Pages → card-battles-wiki →
Deployments**.

## Notes

- **File size limit:** each file must be under 25 MB. Keep route videos short
  and compressed (I will convert them for you).
- **Keep it script-free:** leave **Web Analytics** off in the project settings.
  Cloudflare features like Rocket Loader, Email Obfuscation and Zaraz inject
  scripts the site's security policy blocks, so leave them off too.
- **Check headers:** `curl.exe -sI https://card-battles-wiki.pages.dev`

## Alternative: upload by hand (no Git connection)

Run `npm run build`, then **Workers & Pages → Create → Pages → Upload assets**
and drag in the `dist` folder. Repeat for each update.
