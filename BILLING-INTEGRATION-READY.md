# CAV Madagascar — billing integration handoff

The billing integration is preconfigured for the BigQuery table visible in the supplied screenshots.

- Table: `e-learning-b2434.cav_billing.gcp_billing_export_v1_01561A_D9650F_3E70A9`
- BigQuery location: `EU`
- Firebase callable function: `adminGetGoogleBillingSummary`
- Function region: `africa-south1`

## Before deployment

1. Restore your local frontend `.env` from your trusted local copy or copy `.env.example` to `.env` and fill in the Firebase Web app values. For security, the ZIP intentionally does not include the uploaded root `.env` file.
2. Confirm the Firebase CLI is targeting the CAV backend project with `firebase use`.
3. Grant the Functions runtime service account `BigQuery Job User` on the query project and `BigQuery Data Viewer` on the `cav_billing` dataset.
4. Ensure the BigQuery API is enabled in the query project.

## Build and deploy

```powershell
cd functions
npm ci
npm run build
cd ..
npm ci
npm run build
firebase deploy --only functions:adminGetGoogleBillingSummary
```

Deploy the frontend `dist` output through the existing Cloudflare Pages project if the frontend was changed. The billing export updates daily; newly enabled exports may not show costs immediately.

See `GOOGLE-CLOUD-BILLING-DASHBOARD.md` for more details.
