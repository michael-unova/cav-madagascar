# CAV Madagascar — Performance Optimization v1

This update improves loading and reduces unnecessary Firestore reads without redesigning the interface or changing the existing student navigation.

## Changes

- Lazy-load secondary screens (library, admin messages, broadcasts, lesson questions, psychotechnical, analytics, billing, and the authentication action screen). These modules are requested only when needed.
- Load the DOCX/Mammoth parser only when a content manager imports a Word document in the lesson editor.
- Load student export utilities only when an administrator requests an Excel, Word, or PDF export.
- Replace the admin sidebar's full `users` collection listener with a query restricted to documents created after the last-seen timestamp. This avoids downloading every user document just to display a notification badge.
- Add a lightweight suspense fallback while lazy screens load.

## Verification

- TypeScript transpilation syntax checks passed for the modified TSX files.
- A full production build could not be verified in this environment because the ZIP's installed dependencies are incomplete (`vite/client` is missing), and dependency installation did not complete before timeout.
- Run `npm ci` and `npm run build` locally before deploying. If Firestore rules or indexes were changed separately, deploy those only after review; this update does not change rules.

## Follow-up opportunities

- Profile the largest remaining initial bundle after a clean production build.
- Consider paginating Admin Users when the UI and expected data volume are confirmed.
- Continue optimizing per-course restricted Library reads only if it can be done without weakening Firestore access control.
