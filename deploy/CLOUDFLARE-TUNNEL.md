# Put the wiki online with Caddy + Cloudflare Tunnel

This serves the wiki from your PC **without opening any ports**. Caddy listens only
on `127.0.0.1:8080` (your PC itself). `cloudflared` makes an outbound connection to
Cloudflare, and Cloudflare sends visitors down that connection. Your router and
Windows Firewall need no inbound rules.

```
visitor ──HTTPS──▶ Cloudflare ◀──outbound tunnel── cloudflared (your PC) ──▶ Caddy 127.0.0.1:8080 ──▶ dist/
```

## What you need

- A domain whose DNS is managed by Cloudflare (free plan is fine).
- This project built at least once: `npm run build` (creates `dist/`).

## 1. Install Caddy and cloudflared

In PowerShell:

```powershell
winget install --id CaddyServer.Caddy
winget install --id Cloudflare.cloudflared
```

If winget can't find Caddy, download `caddy.exe` for Windows from
https://caddyserver.com/download and put it in `C:\caddy\`.

Close and reopen PowerShell, then check both work:

```powershell
caddy version
cloudflared --version
```

## 2. Start Caddy and test it locally

From the project folder:

```powershell
npm run build
caddy run --config deploy\Caddyfile
```

Open http://127.0.0.1:8080 in your browser. You should see the wiki.
Press **Ctrl+C** to stop Caddy.

> The Caddyfile points at `C:/Users/austi/Desktop/CardBattlesPrestigeWiki/dist`.
> If you move the project, update the `root` line in `deploy/Caddyfile`.

## 3. Create the tunnel (Cloudflare dashboard, easiest)

1. Go to https://one.dash.cloudflare.com (Cloudflare Zero Trust). Create the free
   team account if asked.
2. Open **Networks → Tunnels** (some dashboards call it **Connectors**), then
   **Create a tunnel**.
3. Choose **Cloudflared**, name it `cbp-wiki`, and save.
4. Pick **Windows**. Cloudflare shows a command like
   `cloudflared.exe service install eyJh...`. Open **PowerShell as administrator**
   and run that exact command. This installs cloudflared as a Windows service, so
   the tunnel starts with your PC.
5. Back in the dashboard, add a **Public hostname**:
   - Subdomain: `wiki` (or leave empty to use the bare domain)
   - Domain: your domain
   - Service type: `HTTP`
   - URL: `127.0.0.1:8080`
6. Save. Cloudflare creates the DNS record for you.

Visit `https://wiki.yourdomain.com`. Cloudflare provides the HTTPS certificate.

<details>
<summary>Prefer the command line? (alternative to step 3)</summary>

```powershell
cloudflared tunnel login
cloudflared tunnel create cbp-wiki
cloudflared tunnel route dns cbp-wiki wiki.yourdomain.com
```

Create `C:\Users\austi\.cloudflared\config.yml`:

```yaml
tunnel: cbp-wiki
credentials-file: C:\Users\austi\.cloudflared\<TUNNEL-ID>.json
ingress:
  - hostname: wiki.yourdomain.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

Test with `cloudflared tunnel run cbp-wiki`, then install it as a service
(admin PowerShell): `cloudflared service install`.
</details>

## 4. Run Caddy in the background on startup

In **PowerShell as administrator** (adjust the `caddy.exe` path to where it is
installed; `(Get-Command caddy).Source` shows it):

```powershell
sc.exe create caddy start= auto binPath= "C:\caddy\caddy.exe run --config C:\Users\austi\Desktop\CardBattlesPrestigeWiki\deploy\Caddyfile"
sc.exe start caddy
```

To stop or remove it later: `sc.exe stop caddy` and `sc.exe delete caddy`.

## 5. Cloudflare settings that keep the strict security policy working

The site allows **only its own files** (Content-Security-Policy `default-src 'self'`).
Some Cloudflare features inject their own scripts, which the browser will block.
In the Cloudflare dashboard for your domain, turn these **off**:

- **Speed → Optimization → Rocket Loader**
- **Scrape Shield → Email Address Obfuscation**
- **Web Analytics / Browser Insights** (automatic setup)
- **Zaraz**

And turn this **on**: **SSL/TLS → Edge Certificates → Always Use HTTPS**.

## 6. Updating the site

Edit content, then run `npm run build`. Caddy serves the new files immediately;
no restart needed. File names of CSS, JS and images change whenever their content
changes, so visitors never see stale cached files.

## Check your headers

```powershell
curl.exe -sI https://wiki.yourdomain.com
```

You should see `content-security-policy`, `x-content-type-options: nosniff`,
`referrer-policy: no-referrer`, and `permissions-policy` in the output.
