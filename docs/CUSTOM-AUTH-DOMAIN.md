# Using cav.mg instead of `cav-madagascar-b4beb.firebaseapp.com`

Firebase exposes the default domain in three places. Each has a different fix:

| Where users see it | Fix | Where |
|---|---|---|
| Google sign-in popup / redirect (`/__/auth/handler`) | `authDomain = cav.mg` **+** proxy `/__/auth/*` | code + Cloudflare Worker + Google Cloud |
| Password-reset link in the email | Custom **Action URL** `https://cav.mg/auth/action` | Firebase Console |
| Sender address `noreply@...firebaseapp.com` | Custom sender domain (optional) | Firebase Console + Cloudflare DNS |

> Firebase Hosting is not used (the site is on Cloudflare Pages), so the proxy is the supported way to serve the auth helper from your own domain.

## What the code does
- `VITE_FIREBASE_AUTH_DOMAIN=cav.mg` (set in Cloudflare Pages + GitHub Actions variables; see `.env.example`).
- `public/_worker.js` + `public/_routes.json`: a Cloudflare Pages worker, deployed automatically with the site, that serves `/__/auth/*` and `/__/firebase/init.json` from Firebase. Without a proxy, Cloudflare Pages answers `/__/auth/handler` with the website's home page and the Google sign-in popup shows the site instead of Google. `_routes.json` limits the worker to `/__/*`, so every other request is served as static files as before.
- `cloudflare/firebase-auth-proxy/` (alternative, optional if the Pages worker above is active): Worker bound only to `cav.mg/__/auth/*` and `cav.mg/__/firebase/init.json`; forwards to the Firebase-hosted originals. Nothing else on cav.mg is touched.
- Password reset `continueUrl` now always uses `https://cav.mg/?auth=login` (`src/lib/siteUrl.ts`); the action page only follows same-site `continueUrl` values.

## Deployment order (do not skip; the order avoids an outage)
1. **Deploy the Worker first** (`cd cloudflare/firebase-auth-proxy && npx wrangler deploy`). The zone `cav.mg` must be on this Cloudflare account and the `cav.mg` record proxied (orange cloud).
   Check: `curl -sI https://cav.mg/__/auth/handler` returns 200 and `curl -s https://cav.mg/__/firebase/init.json` returns the Firebase config JSON.
2. **Firebase Console → Authentication → Settings → Authorized domains**: add `cav.mg` (and `www.cav.mg` if used). Keep `cav-madagascar-b4beb.firebaseapp.com` and `localhost`.
3. **Google Cloud Console → APIs & Services → Credentials** (project `cav-madagascar-b4beb`) → the **Web client** used by Firebase Google sign-in (`Web client (auto created by Google Service)`):
   - Authorized JavaScript origins: add `https://cav.mg`
   - Authorized redirect URIs: add `https://cav.mg/__/auth/handler` (**keep** the existing `https://cav-madagascar-b4beb.firebaseapp.com/__/auth/handler` until everything is verified)
   - Wait a few minutes for propagation.
4. **Google Cloud → OAuth consent screen / Branding**: set the Application home page to `https://cav.mg` and add `cav.mg` under Authorized domains (requires the domain verified in Google Search Console). This controls what Google's consent screen displays.
5. **Firebase Console → Authentication → Templates → Password reset → edit (pencil) → Customize action URL** → `https://cav.mg/auth/action`. Set the template language to French if desired.
6. **Set the build variable** `VITE_FIREBASE_AUTH_DOMAIN=cav.mg` in Cloudflare Pages (Production, and Preview if you test there with `*.pages.dev` set it back to the firebaseapp.com value) and, for the Android build, in GitHub → Settings → Variables (`VITE_FIREBASE_AUTH_DOMAIN`, optionally `VITE_PUBLIC_SITE_URL=https://cav.mg`). Redeploy.
7. Verify (below), then optionally remove the old firebaseapp.com redirect URI.

## Optional: hide the sender domain of the reset email
Firebase Console → Authentication → Templates → Password reset → **Customize sender email / domain**. Firebase will show the exact DNS records to add. In Cloudflare DNS add **only** those new records (typically `firebase1._domainkey` / `firebase2._domainkey` CNAMEs and a verification TXT), set them to **DNS only** (grey cloud). Do **not** edit or replace existing MX records. If you already have an SPF TXT record (`v=spf1 ...`), merge any new `include:` into that single record, since two SPF records break delivery. Leave DKIM/DMARC records of your existing mail provider as-is.

## Verification checklist
- Google sign-in on https://cav.mg: popup address bar shows `cav.mg`, login succeeds (also test an in-app browser/Safari, where redirect flow is used).
- Forgot password: email link starts with `https://cav.mg/auth/action?mode=resetPassword...`, reset works, "Se connecter" returns to `https://cav.mg/?auth=login`.
- Email delivery to/from your cav.mg mailboxes unchanged (`dig MX cav.mg`, `dig TXT cav.mg` before/after).
- `npm run test:auth-proxy` passes.

## Limits
- Android (Capacitor) uses `https://localhost` as its origin; popup Google sign-in there is unchanged by this work.
- `*.pages.dev` previews: Firebase redirect sign-in stores state on the auth domain, so use the firebaseapp.com value for previews or test on cav.mg.
- The URL `cav-madagascar-b4beb.firebaseapp.com` remains reachable on the internet; it just stops being used/shown by the app.

## Rollback
Set `VITE_FIREBASE_AUTH_DOMAIN=cav-madagascar-b4beb.firebaseapp.com` and redeploy; reset the Action URL to default in Firebase Console.
