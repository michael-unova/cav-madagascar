# Cloud Functions deployment fix

The functions entrypoint now defers Firebase Admin initialization with `onInit()` so Firebase CLI discovery does not execute initialization during deployment.

Runtime is Node.js 22.

Recommended dependency refresh in `functions/`:

```powershell
npm install firebase-functions@latest firebase-admin@latest --save
npm run build
```

Then from the project root:

```powershell
firebase deploy --only firestore:rules,functions
```
