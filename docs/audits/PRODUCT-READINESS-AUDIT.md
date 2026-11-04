# CAV Madagascar — Product Readiness Audit
Date: 2026-09-28

## Scope
Static review of the supplied Phase 4 archive plus the browser tests already completed in this project.

## Hardened in this audit
- Paid lesson blocks are no longer intended to be directly readable from Firestore by students/public users.
- Added callable `getStudentLessonContent`, which checks active enrollment and the course/subject association before returning published lesson blocks.
- Published practice/quiz/question-important sets are no longer intended to be directly readable from Firestore by students/public users.
- Added callable `getStudentPracticeSets`, which checks active enrollment before returning published evaluation snapshots.
- Profile Storage reads are restricted to the owning user.
- Student scoring remains server-side through `submitPractice`.

## Remaining blockers before production
1. Deploy the updated Firestore rules, Storage rules, and Functions.
2. Deploy `setUserStatus` as well as the new student-content/evaluation functions.
3. Run `npm install`/`npm run build` locally. The audit environment could not complete dependency installation within the available execution window, so a clean production build is not independently verified here.
4. Re-run the already-passed student lesson and quiz flows after the security hardening deployment.

## Important follow-ups
- Payment transaction references are not currently enforced as globally unique at submission time; duplicate-reference protection should be added to the payment workflow before handling real-money volume.
- Contact form has no explicit anti-spam/rate-limit/App Check protection.
- Content-manager UI currently exposes some delete actions while Firestore deletion is restricted to super admins. This should be made consistent before assigning real content-manager staff.
- Native `window.confirm()` dialogs remain in some admin destructive actions; these should be replaced with the platform's styled confirmation UI for final UX polish.
- Node.js 20 and the current `firebase-functions` version are approaching/deprecated according to the deployment warning; upgrade after the current release is stable.
