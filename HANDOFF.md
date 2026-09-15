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

### Files Changed

Modified: `.gitignore`, `README.md`, `index.html`, `package.json`,
`package-lock.json`, `public/favicon.svg`, `public/icons.svg`, `src/App.tsx`,
`src/index.css`, `src/main.tsx`

Removed: `src/App.css`, `src/assets/hero.png`, `src/assets/react.svg`,
`src/assets/vite.svg`

Added: `.env.example`, and everything under `src/components/`,
`src/layouts/`, `src/pages/`, `src/lib/firebase/`, `src/hooks/`,
`src/types/`, `src/routes/`, `src/utils/`

### Architecture

The app is organized by concern rather than by feature at this stage, since
Milestone 1 has no feature-specific business logic yet:

```text
src/
├── components/   Shared UI atoms (Button, Input, Card, etc.)
├── layouts/      PublicLayout, AppLayout
├── pages/        Route-level pages, including pages/dashboards/
├── lib/firebase/ Firebase app, auth, firestore singletons
├── hooks/        useMediaQuery (drives responsive nav)
├── types/        User, UserRole, Class, Course, Lesson
├── routes/       Centralized path constants
└── utils/        cn() classnames helper
```

`features/` was intentionally left empty this milestone (Git does not track
empty directories, so it does not appear in the diff). It will start
filling in from Milestone 2 (`features/auth`) onward.

Styling uses plain CSS Modules, no CSS framework was added, in line with
"do not unnecessarily add dependencies."

### Firebase

`src/lib/firebase/config.ts`, `auth.ts`, and `firestore.ts` provide lazily
initialized singleton accessors (`getFirebaseApp`, `getFirebaseAuth`,
`getFirebaseFirestore`). No sign-in, session, or Firestore read/write logic
exists yet, that is Milestone 2 and later. No credentials are hard-coded;
all configuration comes from `VITE_FIREBASE_*` environment variables
documented in `.env.example`. No `.env` file was created or committed.

Firestore Security Rules are not yet present in this repository. They
should be added starting with Milestone 2, alongside real authentication.

### Routing

Public (wrapped in `PublicLayout`):
- `/` : Landing page
- `/login` : Login
- `/register` : Register
- `*` : 404 (Not Found)

Authenticated (wrapped in `AppLayout`):
- `/dashboard` : Redirects to `/dashboard/student` (temporary default; see
  Known Issues)
- `/dashboard/student` : Student dashboard placeholder
- `/dashboard/teacher` : Teacher dashboard placeholder
- `/dashboard/admin` : Admin dashboard placeholder
- `/profile` : Profile placeholder

### UI

- `AppLayout` renders a fixed sidebar at `>= 960px` and a hamburger-triggered
  slide-in drawer below that, sharing the same nav markup.
- Dashboards use a common `DashboardSectionCard` (page-local, not a shared
  atom) built from `Card` + `EmptyState`, so every section clearly reads as
  "no data yet" rather than implying real content.
- No client-side authorization exists: the `role` prop on `AppLayout` only
  labels which placeholder dashboard is being viewed, it does not gate
  access to anything.

### Tests

- Lint: **pass** (`npm run lint`, 0 errors, 0 warnings)
- Build: **pass** (`npm run build`, `tsc -b && vite build` completed
  successfully)
- Tests: none exist in this repository yet, none were added this milestone
  (no test runner is configured)

### Known Issues

- `/dashboard` always redirects to the student dashboard regardless of who
  is signed in, since there is no real session yet. This is intentional and
  temporary; Milestone 2 should replace `DashboardRedirect` with a real
  role-based redirect once authentication resolves the signed-in user's
  role.
- The repository's visibility was changed from private to public during
  this milestone as the only available way to grant implementation access
  in this environment. No secrets were ever present in the repository, but
  the maintainer should decide whether to restore private visibility and
  set up a proper credential flow (e.g. an authenticated CLI tool or a
  scoped deploy key) for future automated work.

### Not Implemented (by design, deferred to future milestones)

- Real Firebase Authentication (sign in, sign up, session persistence,
  sign out)
- Real role resolution and any server-enforced authorization
- Firestore Security Rules
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

## Milestone Roadmap

```text
Milestone 1
Foundation + architecture (complete)

Milestone 2
Authentication + roles

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

### Next Milestone: Milestone 2 (Authentication + Roles)

Recommended scope:

- Implement real Firebase Authentication (email/password at minimum;
  consider adding provider sign-in later)
- Persist and resolve the signed-in user's role (e.g. a `users` Firestore
  document keyed by UID, written at sign-up)
- Replace `DashboardRedirect` with real role-based redirection
- Protect authenticated routes (redirect unauthenticated visitors to
  `/login`)
- Wire up the login/register forms' existing fields to real sign-in/sign-up
  calls, including error states using the existing `ErrorState` component
  and `Input` `errorText` prop
- Wire up the `AppLayout` sign-out link to a real sign-out call
- Add initial Firestore Security Rules covering the `users` collection

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

- No automated tests exist yet (no test runner configured). Consider adding
  one (e.g. Vitest + React Testing Library) when Milestone 2 introduces
  logic worth testing (auth state, role resolution).

## Next Action

Begin **Milestone 2: Authentication + roles** after explicit authorization.
