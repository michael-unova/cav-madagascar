# Administrator-equivalent Content Manager access

## Intended behavior
- Active `content_manager` accounts use the full administrator navigation and can open the same operational pages as `super_admin` accounts.
- The only dashboard display exception is the **Total encaissé** cumulative accepted-payment amount, which remains visible only to `super_admin`.
- Content Managers can manage contests, subjects, learning content, enrollments/payments, users (within guarded account-role rules), student questions, announcements, library, psychotechnical tests, contact messages, Google Cloud billing, and platform settings. Analytics/statistics are restricted to super admins only.
- On mobile, the admin navigation shortcuts are horizontally scrollable so every page remains reachable.
- Security-sensitive account role changes cannot grant `super_admin`; callable functions validate roles on the server, and a manager cannot modify or delete a super-admin account.

## Security behavior
- Frontend: only `super_admin` renders the **Total encaissé** card.
- Backend: payment and enrollment operational writes are permitted to active managers; user management callables accept both roles while protecting super-admin accounts and restricting assignable roles.
- Google Cloud billing remains queried server-side through `adminGetGoogleBillingSummary`.

## Files updated
- `src/App.tsx`
- `src/pages/AdminMessagesPage.tsx`
- `functions/src/index.ts`
- `functions/lib/index.js`
- `firestore.rules`

## Verification
The ZIP is packaged from the project. `npm run build` could not complete in this environment because the local dependency installation is missing the `vite/client` and Node type definitions. Run `npm ci` before verifying the build and deploy.
