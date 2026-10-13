# CAV Madagascar — migration to the owner’s Firebase project

Target project: `cav-madagascar-b4beb`
Previous project: `e-learning-b2434`

Current production project: `cav-madagascar-b4beb` (project number `341527930407`). Do not shut down the previous project until production verification and any required billing-export migration are complete.
Firestore configured location: `africa-south1`

## Prepared in this archive
- `.firebaserc` now selects `cav-madagascar-b4beb` as the default Firebase CLI project.
- `.env.example` contains the web app configuration supplied for the new project. Copy it to `.env` for local development.
- Firestore rules, indexes, Storage rules, and Cloud Functions source are retained.
- Old billing-export table references were removed from the deployment environment example. The owner must create a new billing export and set `BILLING_EXPORT_TABLE` to its actual table.

## Required owner-console setup
1. In Firebase Console for `cav-madagascar-b4beb`, enable Email/Password (and any other providers used by CAV) under Authentication.
2. Create the Firestore database in `africa-south1` if it does not already exist. Firestore location cannot be changed after database creation.
3. Enable Cloud Storage and select its location according to the owner’s requirements.
4. Link the owner’s billing account and enable the APIs needed by the app/functions.
5. Configure required Functions secrets, including `BALANCIA_CAV_INTEGRATION_SECRET`, if the Balancia integration is to remain active.
6. If the billing dashboard is used, enable Cloud Billing export to BigQuery in the new project, then set `BILLING_EXPORT_TABLE` and `BILLING_BIGQUERY_LOCATION` in `functions/.env`.

## Data migration — not performed by changing configuration
The project ID switch does **not** copy data. Before production cutover, migrate Firestore documents, Firebase Authentication users (preserving password hashes where possible), Storage objects, and any required scheduled jobs/secrets. Export/import requires authorized access to both old and new projects and a suitable Cloud Storage bucket.

## Deploy only after data and service setup
```bash
npm install
cp .env.example .env
firebase use cav-madagascar-b4beb
npm run build
cd functions && npm install && npm run build && cd ..
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

Then deploy the frontend to its hosting provider with the same `VITE_FIREBASE_*` values. Verify student/admin login, permissions, lessons, quizzes, payments, file uploads, and Functions before redirecting production traffic. Keep the old project until acceptance is complete.
