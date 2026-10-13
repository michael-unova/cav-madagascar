# Firebase migration audit: e-learning-b2434 -> cav-madagascar-b4beb

Audit date: 2026-10-13. Scope: repository only (no Firebase, Google Cloud or Cloudflare console access).

## Verified in the repository
- `.firebaserc`: `default` and `cav-owner` both map to `cav-madagascar-b4beb`.
- `firebase.json`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`: no project IDs or bucket names.
- Client config (`src/lib/firebase/config.ts`) reads only `VITE_FIREBASE_*` env vars. Nothing hard-coded. Functions client uses region `africa-south1`.
- Cloud Functions read the project from the runtime (`GCLOUD_PROJECT`); no hard-coded project or bucket.
- Android workflow reads `vars.VITE_FIREBASE_*` from GitHub repository variables. No `google-services.json` is committed.
- No credentials, `.env` files or service-account keys are tracked.
- The Balancia payment sync (`syncVerifiedPaymentToBalancia`, project `balancia-51491`) was removed in commit 10032a1.

## Remaining references to the old project
- Billing export table `e-learning-b2434.cav_billing.gcp_billing_export_v1_01561A_D9650F_3E70A9` (docs, `functions/.env.example`). The real `functions/.env` is gitignored and not inspectable. If it still holds this value, the billing dashboard depends on the old project.
- Git history (earlier commits). Not rewritten.

## Manual steps required
1. Cloudflare Pages (Production and Preview): confirm all six `VITE_FIREBASE_*` values come from the `cav-madagascar-b4beb` web app; redeploy after any change.
2. GitHub repo variables (Settings > Secrets and variables > Actions > Variables): same six values for the Android build.
3. Firebase Auth (new project): authorized domains include the Cloudflare Pages domain and custom domain; enable the same sign-in providers; check OAuth clients/consent screen.
4. Deploy rules, indexes and functions to the new project (`firebase use cav-madagascar-b4beb`).
5. Billing: enable Cloud Billing export into a BigQuery dataset in the new project, update `BILLING_EXPORT_TABLE` and `BILLING_BIGQUERY_LOCATION` in `functions/.env`, grant the functions runtime service account `BigQuery Job User` and `BigQuery Data Viewer`. Keep the old project and billing history until finance no longer needs it.
6. Data: scan Firestore for `e-learning-b2434` (see below) and rewrite URLs in a reviewed script.
7. Decide whether the Balancia payment sync removal was intentional.
8. Do not delete the old project until every item above is confirmed.

## Firestore/Storage data scan (to run with admin access)
Image and cover URLs saved through `getDownloadURL` embed the bucket name. Check at least: lesson HTML (`contentBlocks.content.html`), `library*` (`coverUrl`, `resourceUrl`), user avatars, course thumbnails, payment proofs, broadcasts. Search for `e-learning-b2434` and `firebasestorage.googleapis.com/v0/b/e-learning`. Storage files must also exist in the new bucket.
