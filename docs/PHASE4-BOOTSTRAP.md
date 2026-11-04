# Phase 4 admin bootstrap

CAV uses the same Firebase Authentication system for students and administrators.

There is no separate password database for admins.

## Create the first super admin

1. Register a normal account at `/register`.
2. In Firebase Console, open Firestore Database → `users`.
3. Open that user's document.
4. Change only:
   - `role`: `student` → `super_admin`
5. Keep:
   - `status`: `active`
   - `uid`, `email`, `displayName`, timestamps unchanged.
6. Open `/admin/login`.
7. Sign in with the same email/password.

The Firestore Console is used only for this initial bootstrap because a client application must never be allowed to promote itself to an administrator.

After the first super admin exists, the admin management system can be expanded to manage content-manager accounts through a trusted backend.

## Important

Do not put a Firebase service-account JSON file, private key, or admin SDK credentials inside this repository or `.env` used by the browser.

The Phase 4 UI authorizes administrators using the protected `users/{uid}.role` field. Students cannot change their own role through the application rules.
