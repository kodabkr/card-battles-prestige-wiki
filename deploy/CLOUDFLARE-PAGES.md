# Alternative: host on Cloudflare Pages

Cloudflare Pages hosts the same `dist/` folder for free, so your PC does not need
to stay on. The security headers come from `dist/_headers`, which the build copies
from `deploy/_headers`.

## Option A: upload in the dashboard (no tools needed)

1. Run `npm run build`.
2. In the Cloudflare dashboard, open **Workers & Pages → Create → Pages →
   Upload assets** (the wording may differ slightly; look for "Direct Upload").
3. Name the project, for example `cbp-wiki`.
4. Drag the **`dist`** folder in and click **Deploy**.
5. Your site is live at `https://cbp-wiki.pages.dev`.
6. Optional: **Custom domains → Set up a custom domain** to use `wiki.yourdomain.com`.

To update: build again, open the project, **Create new deployment**, and upload
`dist` again.

## Option B: deploy from the command line

```powershell
npm run build
npx wrangler login
npx wrangler pages deploy dist --project-name cbp-wiki
```

Run the last two lines again whenever you want to publish changes.

## Notes

- **Missing pages:** Pages serves `404.html` automatically.
- **File size limit:** each file must be under 25 MB. Keep route videos short and
  compressed (I will convert them for you).
- **Keep it script-free:** in the project's settings, leave **Web Analytics** off.
  The same Cloudflare features listed in `CLOUDFLARE-TUNNEL.md` step 5 (Rocket
  Loader, Email Obfuscation, Zaraz) should stay off on a custom domain.
- **Check headers:** `curl.exe -sI https://cbp-wiki.pages.dev`
