# New Firebase project deployment checklist

Production Firebase project: `cav-madagascar-b4beb`
Project number: `341527930407`
Firestore location: `africa-south1`

## Frontend configuration

The source reads `VITE_FIREBASE_*` environment variables. Set the same values from `.env.example` in local `.env` and in Cloudflare Pages **Settings → Environment variables** for every deployment environment, then trigger a fresh build/deploy. Do not commit `.env`.

## Backend deployment status

The migration handover reported that the following were already deployed to `cav-madagascar-b4beb`: Cloud Functions (18 functions), Firestore rules and indexes, and Storage rules. Firestore data, Authentication users, and Storage objects were also migrated. This ZIP itself does not prove the live cloud state; verify before deploying again.

To deploy after reviewing the project and confirming the correct Google account/project:

```bash
firebase use cav-madagascar-b4beb
firebase deploy --only functions,firestore:rules,firestore:indexes,storage
```

Deploying these again is normally unnecessary if no backend source/rules/indexes changed since the successful migration deployment. Re-deploy if you changed those files, if verification shows a missing/outdated resource, or if you want to ensure the deployed backend matches this exact checkout. Check function secrets and environment configuration separately; do not put secrets in this ZIP or commit them.

## Billing dashboard caveat

The billing dashboard is a separate setup: create/enable Cloud Billing export to BigQuery for the correct billing account, grant the deployed function's runtime service account the minimum required BigQuery permissions, then set `BILLING_EXPORT_TABLE` and `BILLING_BIGQUERY_LOCATION` in the Functions environment and redeploy `adminGetGoogleBillingSummary`. The old export table belonged to `e-learning-b2434`; do not expect it to work after the old project is disabled.

## Before disabling the old project

1. Verify sign-in, password reset, student enrollment/payment review, lesson content, quizzes, file downloads, admin actions, scheduled broadcasts, and Cloudflare production deployment.
2. Confirm Cloudflare Pages environment variables point to `cav-madagascar-b4beb`.
3. Verify all 18 expected functions and rules/indexes in the new project.
4. Complete or intentionally defer billing export migration.
5. Keep the old project intact until the client approves cutover and rollback is no longer needed.
