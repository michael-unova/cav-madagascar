# CAV Madagascar — Library permission fix

This update addresses two related student-side Firebase permission failures:

- Published public library books can be read by signed-in users even when an older student profile is missing its `status: "active"` field. Draft books remain private; restricted books still require active enrollment.
- The library repository now handles enrollment/restricted-book query failures separately, so those failures do not hide public books that were already loaded.
- Published lesson counts now query published curriculum nodes instead of unfiltered collections that include drafts, which Firestore correctly denies to students.

## Required deployment

The Firestore rules change must be deployed to the Firebase project that serves CAV Madagascar. From this project folder, select the correct Firebase project/account first, then run:

```bash
firebase use cav-madagascar-b4beb
firebase deploy --only firestore:rules
```

Never deploy to the legacy project `e-learning-b2434`.

Then deploy the updated frontend to Cloudflare Pages. If Cloudflare is connected to Git, commit and push the changed files; otherwise build and upload the new `dist` folder.

## Validation note

The source changes and ZIP archive were checked. A production build could not be completed in this environment because dependency installation timed out, so run `npm ci` and `npm run build` locally before deploying.
