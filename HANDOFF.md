# HANDOFF

## Project

**Name:** E-Learning Platform  
**Repository:** `michael-unova/e-learning`  
**Repository visibility:** Public (changed from private during Milestone 1 to allow implementation work; consider reverting to private once a secure access method for automated work is in place)  
**Frontend:** React + TypeScript + Vite  
**Backend:** Firebase  
**Deployment:** Cloudflare  
**Primary language:** French

## Current Status

**Milestone 1: Foundation and Architecture is complete.**
**Milestone 2: Authentication + Roles is complete.**

### Completed (previous baseline)

- React + TypeScript + Vite project created
- ESLint configured by Vite
- Git initialized, default branch `main`
- GitHub remote configured, initial commits pushed
- Cloudflare connected and deploying
- Firebase project created, web app registered, SDK installed

### Completed (Milestone 1)

- Feature-based application architecture under `src/` (components, layouts,
  pages, lib/firebase, hooks, types, routes, utils)
- Client-side routing with `react-router-dom` (the one new dependency added
  this milestone)
- `PublicLayout` (landing, login, register) and `AppLayout` (authenticated
  pages) with a responsive sidebar on desktop and a slide-in drawer nav on
  mobile/tablet
- Reusable UI components: `Button`, `Input`, `Card`, `Badge`, `Avatar`,
  `LoadingState`, `EmptyState`, `ErrorState`, `PageHeader`, `NavItem`,
  `Modal`, `Logo`
- Custom design system: CSS custom properties for color, type, radius, and
  shadow tokens in `src/index.css`; Fraunces (display) + Libre Franklin
  (body) loaded via Google Fonts in `index.html`; a hand-built SVG icon
  sprite at `public/icons.svg` (no icon library dependency added); a custom
  favicon and wordmark, replacing all default Vite scaffold assets
  (`react.svg`, `vite.svg`, `hero.png`, and the default `icons.svg` were
  removed)
- Polished French landing page: hero, "Comment ça marche" steps, feature
  grid, role explainer cards, closing call to action
- Login and register pages with client-side form fields; submission
  handlers are explicit placeholders (`preventDefault` only) pending
  Milestone 2's real Firebase Authentication wiring
- Placeholder dashboards for Student, Teacher, and Admin, each built from a
  shared `DashboardSectionCard` + `EmptyState` pattern, matching the
  sections requested in the brief
- Profile page placeholder (fields disabled, pending real account data)
- Firebase foundation at `src/lib/firebase/` (`config.ts`, `auth.ts`,
  `firestore.ts`): lazy-initialized singletons, values sourced only from
  `import.meta.env`, no hard-coded configuration
- `.env.example` documenting the required `VITE_FIREBASE_*` variables;
  `.gitignore` updated to exclude `.env` and `.env.*` (keeping
  `.env.example` tracked)
- Foundational TypeScript types: `User`, `UserRole`, `Class`, `Course`,
  `Lesson`
- `index.html` updated to `lang="fr"`, with a real title, meta description,
  and font loading
- `README.md` replaced with real project documentation (setup, scripts,
  structure)

### Files Changed (Milestone 1)

Modified: `.gitignore`, `README.md`, `index.html`, `package.json`,
`package-lock.json`, `public/favicon.svg`, `public/icons.svg`, `src/App.tsx`,
`src/index.css`, `src/main.tsx`

Removed: `src/App.css`, `src/assets/hero.png`, `src/assets/react.svg`,
`src/assets/vite.svg`

Added: `.env.example`, and everything under `src/components/`,
`src/layouts/`, `src/pages/`, `src/lib/firebase/`, `src/hooks/`,
`src/types/`, `src/routes/`, `src/utils/`

### Completed (Milestone 2)

- Real Firebase Authentication: email/password sign-up and sign-in, using
  the existing `getFirebaseAuth()` singleton. No new auth providers were
  added; the recommended scope was email/password "at minimum" and that is
  what shipped.
- A Firestore `users` collection: one document per account, id equal to
  the Firebase Authentication uid, storing `{ id, email, displayName,
  role, createdAt }`. Written once at sign-up (`createUserProfile`), read
  on every auth state change (`getUserProfile`) to resolve the signed-in
  user's role.
- `src/features/auth/` (new `features/` subfolder, as anticipated in the
  Milestone 1 architecture note):
  - `authService.ts`: stateless `signUp`, `signIn`, `signOutUser`,
    `subscribeToAuthState` wrapping the Firebase SDK calls.
  - `authErrors.ts`: maps Firebase Authentication error codes to French,
    user-facing messages (`getAuthErrorMessage`), so raw Firebase error
    text is never shown in the interface.
  - `AuthContext.tsx` / `AuthProvider.tsx` / `useAuth.ts`: a context that
    subscribes to Firebase auth state once at the app root, resolves the
    matching Firestore profile, and exposes `{ user, isLoading }` to the
    rest of the app via `useAuth()`.
  - `ProtectedRoute.tsx`: redirects unauthenticated visitors to `/login`
    (preserving the attempted path via router state so login can return
    them there). Accepts an optional `allowedRoles` prop; a signed-in
    user whose role doesn't match is redirected to their own dashboard
    rather than shown an error, since this only guards navigation, not
    data.
  - `PublicOnlyRoute.tsx`: redirects an already-authenticated visitor away
    from `/login` and `/register` straight to their dashboard. This was
    not explicitly listed in the milestone's recommended scope, but is a
    small, natural consequence of having real auth state available, kept
    intentionally minimal (no new UI, just a routing guard).
- `src/lib/firebase/users.ts`: `createUserProfile` / `getUserProfile`
  Firestore helpers, next to the existing `config.ts` / `auth.ts` /
  `firestore.ts` singletons.
- `src/routes/paths.ts`: added a single `roleDashboardPaths` map shared by
  `DashboardRedirect`, `ProtectedRoute`, `PublicOnlyRoute`, and
  `AppLayout`, replacing what was previously a copy-pasted object in
  `AppLayout` alone.
- `DashboardRedirect` now redirects to the signed-in user's real,
  Firestore-resolved role instead of always defaulting to the student
  dashboard (this was the Milestone 1 "Known Issue", now resolved).
- `AppLayout` no longer takes a `role` prop: it reads the signed-in user
  from `useAuth()` directly (role label, avatar initials from
  `displayName`), and its sign-out link now actually calls
  `signOutUser()` and navigates home, instead of being a placeholder
  `Link`. The nav item previously rendered as an anchor is now a `button`
  (needed for the async click handler); `AppLayout.module.css`'s
  `.logoutLink` gained a small reset (`border: none`, `background:
  transparent`, `width: 100%`, `text-align: left`, `cursor: pointer`,
  `font: inherit`) so it looks identical to before.
- `LoginPage` and `RegisterPage`: forms now call `signIn` /
  `signUp` for real, with a submitting state (button text changes,
  button disabled) and a French error message shown via the existing
  `ErrorState` component on failure (wrong credentials, email already in
  use, weak password, network issues, etc). Field-level `Input
  errorText` was not needed in practice: Firebase's own validation errors
  (invalid email, weak password) are the same errors `ErrorState`
  already renders, so a single top-of-form error is clearer than
  duplicating it per field.
- `ProfilePage`: now shows the real signed-in user's `displayName` and
  `email` (still as disabled inputs). Editing remains out of scope for
  this milestone, per the existing "pending real account data" comment,
  which is now literally true instead of aspirational.
- `firestore.rules` added at the repository root: the `users` collection
  allows a user to read and create only their own document, with `create`
  restricted to `role in ['student', 'teacher']` (never `'admin'`, which
  matches `RegisterPage`'s `RegisterRole` type and must be provisioned
  manually). `update` and `delete` are both denied for now, since profile
  editing doesn't exist yet and this also prevents a user from
  self-escalating their role by overwriting their own document. A
  catch-all `match /{document=**} { allow read, write: if false }` denies
  every other collection by default until later milestones add their own
  rules.

### Files Changed (Milestone 2)

Modified: `src/App.tsx`, `src/main.tsx`, `src/routes/paths.ts`,
`src/layouts/AppLayout/AppLayout.tsx`,
`src/layouts/AppLayout/AppLayout.module.css`,
`src/pages/dashboards/DashboardRedirect.tsx`,
`src/pages/LoginPage/LoginPage.tsx`, `src/pages/RegisterPage/RegisterPage.tsx`,
`src/pages/ProfilePage/ProfilePage.tsx`

Added: `firestore.rules`, `src/lib/firebase/users.ts`, and everything
under `src/features/auth/` (`AuthContext.tsx`, `AuthProvider.tsx`,
`useAuth.ts`, `authService.ts`, `authErrors.ts`, `ProtectedRoute.tsx`,
`PublicOnlyRoute.tsx`)

### Architecture

The app is organized by concern rather than by feature at this stage, since
Milestone 1 has no feature-specific business logic yet:

```text
src/
├── components/   Shared UI atoms (Button, Input, Card, etc.)
├── layouts/      PublicLayout, AppLayout
├── pages/        Route-level pages, including pages/dashboards/
├── features/
│   └── auth/     Auth context/provider, route guards, Firebase auth calls,
│                 French error messages (Milestone 2)
├── lib/firebase/ Firebase app, auth, firestore singletons, users.ts
├── hooks/        useMediaQuery (drives responsive nav)
├── types/        User, UserRole, Class, Course, Lesson
├── routes/       Centralized path constants + role-to-dashboard map
└── utils/        cn() classnames helper
```

`features/auth` is the first folder under `features/`, as anticipated in
Milestone 1. Future milestones are expected to add `features/classes`,
`features/courses`, etc. following the same pattern.

Styling uses plain CSS Modules, no CSS framework was added, in line with
"do not unnecessarily add dependencies."

### Firebase

`src/lib/firebase/config.ts`, `auth.ts`, and `firestore.ts` provide lazily
initialized singleton accessors (`getFirebaseApp`, `getFirebaseAuth`,
`getFirebaseFirestore`), unchanged since Milestone 1. No credentials are
hard-coded; all configuration comes from `VITE_FIREBASE_*` environment
variables documented in `.env.example`. No `.env` file was created or
committed.

As of Milestone 2, `src/lib/firebase/users.ts` adds real Firestore
read/write logic (`createUserProfile`, `getUserProfile`) on top of those
singletons, and `src/features/auth/authService.ts` adds real Firebase
Authentication sign-up, sign-in, sign-out, and auth-state subscription.

`firestore.rules` now exists at the repository root, covering the `users`
collection (see "Completed (Milestone 2)" above). **This file has not been
deployed**: this sandboxed working environment has no Firebase CLI
credentials and no network access to Firebase's own APIs (only GitHub, npm,
and a few package registries are reachable). The maintainer needs to either
run `firebase deploy --only firestore:rules` from a machine with the
Firebase CLI authenticated against the `e-learning-b2434` project, or paste
the contents of `firestore.rules` into the Firebase console's Firestore
Rules editor. Until that happens, whatever rules are currently live in the
Firebase console are still in effect, not the ones in this file.

### Routing

Public (wrapped in `PublicLayout`):
- `/` : Landing page
- `/login` : Login, wrapped in `PublicOnlyRoute` (redirects an already
  signed-in visitor to their dashboard)
- `/register` : Register, also wrapped in `PublicOnlyRoute`
- `*` : 404 (Not Found)

Authenticated (wrapped in `ProtectedRoute`, then `AppLayout`):
- `/dashboard` : `DashboardRedirect` sends the visitor to their real,
  Firestore-resolved role dashboard
- `/dashboard/student` : `ProtectedRoute allowedRoles={['student']}`,
  student dashboard placeholder
- `/dashboard/teacher` : `ProtectedRoute allowedRoles={['teacher']}`,
  teacher dashboard placeholder
- `/dashboard/admin` : `ProtectedRoute allowedRoles={['admin']}`, admin
  dashboard placeholder
- `/profile` : `ProtectedRoute` (any signed-in role), profile page

`ProtectedRoute` redirects unauthenticated visitors to `/login`, and a
signed-in user visiting a dashboard route for a different role is sent to
their own dashboard instead of seeing that role's placeholder content.

### UI

- `AppLayout` renders a fixed sidebar at `>= 960px` and a hamburger-triggered
  slide-in drawer below that, sharing the same nav markup.
- Dashboards use a common `DashboardSectionCard` (page-local, not a shared
  atom) built from `Card` + `EmptyState`, so every section clearly reads as
  "no data yet" rather than implying real content.
- `AppLayout` no longer takes a `role` prop; it reads the signed-in user
  from `useAuth()`. Client-side role checks (`ProtectedRoute`'s
  `allowedRoles`) now gate which dashboard route is reachable, but as
  always, this is a navigation convenience, not a substitute for
  Firestore Security Rules, which are the actual authorization boundary
  for data.

### Tests

**Milestone 1:**
- Lint: pass (`npm run lint`, 0 errors, 0 warnings)
- Build: pass (`npm run build`, `tsc -b && vite build` completed
  successfully)

**Milestone 2:**
- Lint: **pass** (`npm run lint`, 0 errors, 0 warnings)
- Build: **pass** (`npm run build`, `tsc -b && vite build` completed
  successfully). The production bundle now includes the Firebase
  Authentication and Firestore SDKs, so Vite emits a "chunk larger than
  500 kB" warning (`dist/assets/index-*.js` is ~826 kB unminified / ~249 kB
  gzipped). This is a warning, not an error, and is expected once a real
  SDK is bundled; see Technical Debt for a note on code-splitting.
- Manual verification: sign-up, sign-in, sign-out, and route guarding were
  not exercised against a live Firebase project in this environment. This
  sandboxed working environment has no Firebase CLI and no network access
  to Firebase's own APIs, so end-to-end testing (creating a real account,
  confirming the Firestore document is written and the correct dashboard
  is reached, confirming Security Rules actually block a cross-user read)
  needs to happen wherever the maintainer runs `npm run dev` against the
  real `e-learning-b2434` project with `.env` populated from
  `.env.example`, ideally before this branch is merged.
- Tests: still none exist in this repository (no test runner is
  configured). This milestone introduced the first real logic worth unit
  testing (auth state resolution, route guards, error-code mapping); see
  Technical Debt.

### Known Issues

- ~~`/dashboard` always redirects to the student dashboard~~ Resolved in
  Milestone 2: `DashboardRedirect` now uses the real, Firestore-resolved
  role.
- The repository's visibility was changed from private to public during
  Milestone 1 as the only available way to grant implementation access in
  this environment. As of Milestone 2 it appears to be a private repo
  again (a scoped, short-lived GitHub token was used for this session
  instead), so this may already be resolved; the maintainer should
  confirm current visibility in GitHub settings.
- `firestore.rules` exists in the repository but **has not been deployed**
  to the live Firebase project (see the Firebase section above). Until it
  is deployed, whatever rules are currently live in the Firebase console
  govern access, not this file.
- Sign-up, sign-in, sign-out, and the role-based route guards have not
  been exercised against a live Firebase project from this environment
  (see Tests above). They should be smoke-tested with real credentials
  before this branch is merged.
- `ProfilePage` shows the real signed-in user's name and email but has no
  edit functionality yet (inputs are disabled, as before). This is by
  design for this milestone's scope, not a bug.

### Not Implemented (by design, deferred to future milestones)

- Profile editing (name, email, password, avatar changes)
- Password reset / "forgot password" flow
- Email verification
- Provider sign-in (Google, etc.), beyond the email/password baseline
- Admin account provisioning tooling (currently: manual, via Firebase
  console or a trusted backend, never via the client)
- Deployment of `firestore.rules` to the live Firebase project (file
  exists, not yet applied, see Known Issues)
- Firestore reads/writes for classes, courses, or lessons
- Video upload or playback
- Assignments, submissions, discussions, announcements (real data)
- Progress tracking (real data)
- Offline video, DRM, payments, subscriptions, live classes, AI tutoring,
  certificates, native mobile apps (explicitly out of scope for the MVP)

## Important Project Rules

Read `PROJECT_RULES.md` before making changes.

Critical rules include:

- User-facing interface must be professional French.
- Code and database identifiers remain in English.
- NEVER use the em dash character.
- Do not commit secrets or `.env` files.
- Do not weaken Firebase security rules to bypass authorization.
- Do not unnecessarily rewrite existing working code.
- Work milestone by milestone.
- Test and build before committing.
- Update this file after every milestone.
- Commit and push completed milestone work to `main`.

## Product Vision

The platform allows groups of teachers and students to interact.

Teachers can:
- Create classes
- Create courses
- Create lessons
- Upload videos
- Upload learning materials
- Create assignments
- Publish announcements
- Interact with students

Students can:
- Access authorized classes and courses
- Watch videos online
- Access materials
- Complete assignments
- Submit work
- Track progress
- Participate in discussions

Admins manage the platform.

### Future Concept

A future version may provide authorized offline video viewing similar to a premium video platform.

That feature is NOT part of the current MVP.

The future architecture should allow secure offline video, potentially using encrypted storage and DRM/secure playback technologies, without requiring a complete application rewrite.

## Initial Firestore Model

Planned top-level collections:

```text
users
classes
courses
lessons
enrollments
assignments
submissions
comments
announcements
```

Detailed schema should be implemented carefully during the relevant milestone.

## Current Development Milestone

### Milestone 1: Foundation

**Status:** Complete.

Objectives (all met):

- Establish a clean scalable React architecture
- Create the initial application structure
- Configure routing
- Create public and authenticated layouts
- Establish role-aware dashboard placeholders
- Establish reusable UI components
- Prepare Firebase integration structure
- Prepare environment variable handling
- Establish clean TypeScript types
- Establish loading and error patterns
- Keep the interface in French
- Ensure responsive behavior

No course system, lessons, assignments, discussions, or authentication
logic beyond UI-level placeholders was implemented, per scope.

### Milestone 2: Authentication + Roles

**Status:** Complete (pending live smoke-testing and rules deployment;
see Known Issues).

Objectives (all met):

- Real Firebase Authentication (email/password sign-up and sign-in)
- Persist and resolve the signed-in user's role via a Firestore `users`
  document keyed by uid, written at sign-up
- Replace `DashboardRedirect` with real role-based redirection
- Protect authenticated routes, redirecting unauthenticated visitors to
  `/login`
- Wire up login/register forms to real sign-in/sign-up calls, with error
  states
- Wire up the sign-out link to a real sign-out call
- Add initial Firestore Security Rules covering the `users` collection

Not implemented, by design: profile editing, password reset, email
verification, provider sign-in, admin provisioning tooling. See "Not
Implemented" above.

## Milestone Roadmap

```text
Milestone 1
Foundation + architecture (complete)

Milestone 2
Authentication + roles (complete)

Milestone 3
Classes + courses

Milestone 4
Lessons + video + materials

Milestone 5
Assignments + submissions + discussions

Milestone 6
Dashboards + progress + announcements

Milestone 7
Security review + testing + MVP polish
```

Future milestones may be adjusted if architectural discoveries require it.

### Next Milestone: Milestone 3 (Classes + Courses)

Recommended scope (adjust after inspecting the repository, per the
Working Protocol below; this is a starting point, not a locked spec):

- Firestore collections for `classes` and `courses`, following the
  `users` collection's pattern (typed accessors in `src/lib/firebase/`,
  Security Rules added to `firestore.rules` alongside them)
- Teacher: create/manage their own classes and courses
- Student: see the classes/courses they are enrolled in (an `enrollments`
  document, per `PROJECT_RULES.md`'s Firestore model, is likely needed
  here to determine "authorized" access; design this deliberately rather
  than assuming a shape)
- Replace the `StudentDashboardPage`, `TeacherDashboardPage`, and
  `AdminDashboardPage` "Mes cours" / equivalent sections with real data
  instead of `EmptyState` placeholders, once there is real data to show
- Security Rules: teachers can only manage classes/courses they own;
  students can only read classes/courses they are enrolled in; this
  cannot be a client-side check alone, per `PROJECT_RULES.md` section 6
- Firebase Storage is not yet used by anything; it likely stays untouched
  until Milestone 4 (lessons + video + materials)

Before starting, deploy `firestore.rules` (Milestone 2's `users` rules)
to the live Firebase project if that has not already happened, and
smoke-test sign-up/sign-in/sign-out against real Firebase credentials:
building Milestone 3 on top of an unverified Milestone 2 would make it
harder to tell which milestone introduced a given bug.

## Working Protocol for the Next Claude Session

Before coding:

1. Read `PROJECT_RULES.md`.
2. Read this `HANDOFF.md`.
3. Inspect the repository.
4. Verify the current Git state.
5. Verify the existing package configuration.
6. Do not assume anything that can be inspected.

During coding:

- Keep changes limited to the authorized milestone.
- Preserve the existing GitHub and Cloudflare setup.
- Follow the existing architecture.
- Avoid unnecessary dependencies.
- Keep the UI in French.
- Never use the em dash character.

Before completion:

1. Run lint.
2. Run production build.
3. Run available tests.
4. Fix errors.
5. Update this HANDOFF.
6. Commit the milestone.
7. Push to `main`.
8. Clearly report what was changed and what remains.

## Technical Debt

- No automated tests exist yet (no test runner configured). Milestone 2
  introduced the first logic that would genuinely benefit from unit tests:
  `getAuthErrorMessage`'s code-to-message mapping, `ProtectedRoute`'s
  redirect logic, and `AuthProvider`'s state resolution. Consider adding
  Vitest + React Testing Library starting with Milestone 3, rather than
  letting untested auth/authorization logic accumulate further.
- The production JS bundle is now ~826 kB unminified (~249 kB gzipped),
  triggering Vite's chunk-size warning, because the Firebase Authentication
  and Firestore SDKs are bundled into the single main chunk. Not addressed
  in Milestone 2 since it is a build-tuning concern, not a functional one,
  but worth revisiting (e.g. dynamic `import()` for Firebase, or adjusting
  `build.chunkSizeWarningLimit`) once more Firebase-backed features land
  and the bundle grows further.
- `firestore.rules` is not deployed to the live Firebase project from this
  environment (no Firebase CLI, no network access to Firebase's APIs
  here). This is tracked in Known Issues, repeated here because it blocks
  verifying that the Milestone 2 security model actually holds.

## Next Action

Deploy `firestore.rules` to the live Firebase project and smoke-test
sign-up/sign-in/sign-out with real credentials (see Known Issues), then
begin **Milestone 3: Classes + courses** after explicit authorization.
