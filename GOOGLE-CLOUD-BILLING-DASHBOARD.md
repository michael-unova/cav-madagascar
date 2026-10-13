# Google Cloud Billing dashboard — CAV Madagascar

The administrator-only page is **Facturation Google Cloud**. It calls `adminGetGoogleBillingSummary` in Firebase Functions. Google access tokens and BigQuery queries stay on the server; no service-account key is stored in the frontend.

## Current BigQuery export configuration

The Standard usage cost export has been enabled and the table was visible in BigQuery. The Functions environment is preconfigured in `functions/.env` with:

- `BILLING_EXPORT_TABLE=e-learning-b2434.cav_billing.gcp_billing_export_v1_01561A_D9650F_3E70A9`
- `BILLING_BIGQUERY_LOCATION=EU`

Dataset: `e-learning-b2434.cav_billing` (location `EU`). If Google Cloud shows a different table ID in the future, update `BILLING_EXPORT_TABLE` in `functions/.env`. The table ID must be `project.dataset.table`.

## Required IAM permissions

Grant the **runtime service account used by this Firebase Functions deployment**:

1. `BigQuery Job User` on the query job project (`e-learning-b2434`, if this is also the Firebase Functions project).
2. `BigQuery Data Viewer` on the `cav_billing` dataset (least-privilege dataset access).

Do not grant Owner/Editor and do not create/download a service-account key. Also ensure the BigQuery API is enabled in the query project. The runtime service account and Firebase deployment project may differ from the billing export's project; grant access accordingly.

## Build and deploy (PowerShell)

From the project root, first confirm that Firebase CLI is targeting the correct CAV Firebase project (`firebase use`). The `functions/.env` file is consumed by Firebase Functions as runtime environment configuration.

```powershell
cd functions
npm ci
npm run build
cd ..
npm ci
npm run build
firebase deploy --only functions:adminGetGoogleBillingSummary
```

The callable function is deployed to `africa-south1`, consistent with the existing CAV functions. BigQuery's query location is independently configured as `EU`. Deploy the frontend to Cloudflare Pages using the existing project settings if frontend files have changed.

## Data and troubleshooting notes

- Standard export updates daily and may not immediately contain new billing data. Initial data can take several hours; historical backfill can take longer.
- The dashboard shows cost data, not a real-time meter or official tax invoice.
- If the page reports that billing data is unavailable, check (a) the exact table ID, (b) BigQuery API enabled, (c) the runtime service account's two roles above, and (d) that the function is deployed to the intended Firebase project.
- If the billing account exports more than one currency, totals should not be treated as one currency without standardization.
- Only the administrator profile accepted by the existing `requireAdmin` check can call the backend function.
- Do not commit Firebase client `.env` files or any private credentials. The billing values in `functions/.env` are resource identifiers, not secrets.
