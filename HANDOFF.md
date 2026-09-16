# HANDOFF

## Project

**Name:** E-Learning Platform  
**Repository:** `michael-unova/e-learning`  
**Repository visibility:** Private. Implementation sessions are granted access with a short-lived, scoped GitHub token supplied by the maintainer and revoked afterwards.  
**Frontend:** React + TypeScript + Vite  
**Backend:** Firebase  
**Deployment:** Cloudflare  
**Primary language:** French

## Current Status

**Milestone 1: Foundation and Architecture is complete**, merged into
`main`.
**Milestone 2: Authentication + Roles is complete**, merged into `main`,
deployed, and verified end to end by the maintainer.
**Milestone 3: Classes + Courses is complete**, merged into `main`. Its
Security Rules have been deployed by the maintainer.
**Milestone 4: Lessons + video + materials is complete** (on the branch
`milestone-4-lessons-video-materials`, not yet merged into `main`, and not
yet deployed; see Known Issues).

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

### Completed (Milestone 3)

- **Firestore `classes`, `courses`, and `enrollments` collections**, with
  typed accessors in `src/lib/firebase/` following the `users.ts` pattern,
  and Security Rules added to `firestore.rules` alongside Milestone 2's
  `users` rules (which were left untouched).
- **Teacher**: create, edit, and delete their own classes; create, edit,
  and delete courses inside a class they own; see the roster of students
  who joined each class and remove a student from it.
- **Student**: join a class with the code their teacher shares, see the
  classes they belong to and every course in them, and leave a class.
- **Administrator**: read-only visibility over all classes and courses,
  including their teacher and course counts.
- Real data replaces the placeholder sections on all three dashboards
  ("Mes classes" and "Mes cours" on the teacher and student dashboards,
  "Classes" and "Cours" on the admin dashboard). Sections whose data
  belongs to a later milestone still render an empty state, and their copy
  was reworded where it would otherwise have asserted something false (the
  teacher's "Mes étudiants" section now points at the per-class roster
  rather than claiming there are no students).

#### Key architecture decisions

**A class document's id is also its join code.** Class ids are not
Firestore auto-ids: they are 7-character codes generated by
`createClassCode()` from an alphabet with visually ambiguous characters
removed, using `crypto.getRandomValues`. Knowing the code is therefore the
same as knowing the class id, which is what makes a student's enrollment
write verifiable by Security Rules alone. The alternative, a separate
code-to-class lookup collection, would have added a persistent entity that
`PROJECT_RULES.md` section 8 asks not to introduce casually, and a
`where('joinCode', '==', ...)` query would have required giving
non-members read access to the `classes` collection, which is exactly what
the rules are meant to prevent. Consequences worth knowing:

- A code cannot be rotated. If a class code leaks, the class has to be
  recreated. Rotation would mean a new document id, so it only becomes
  practical if classes ever get a stable surrogate key.
- Knowing a code allows enrolling, and nothing else. Security Rules deny
  reads of a class to anyone who is not its teacher, an enrolled student,
  or an administrator, so a guessed or leaked code never exposes class
  content on its own.
- Codes are generated client side, so a collision is theoretically
  possible. It is not silently tolerated: writing to an id that already
  exists is an update rather than a create, which the rules reject for a
  teacher who does not own that class, and `createClass` retries with a
  fresh code.

**Membership lives in `enrollments`, not in an array on the class.** The
Milestone 1 `Class` type carried a `studentIds: string[]` placeholder. It
was removed in favour of an `enrollments` document per membership, with a
deterministic id of `{classId}_{studentId}`. That id is the reason the
rules stay simple and cheap: every "is this user in this class?" check is
a single `exists()` lookup with no query and no array scan, a class
document never has to be rewritten when somebody joins or leaves, and two
students joining at once cannot overwrite each other's membership.

**Some fields are deliberately denormalized.** `Class.teacherName` and
`Enrollment.studentName` / `studentEmail` are copied at write time because
Milestone 2's `users` rules (correctly) allow a user to read only their
own profile document. Without those copies, showing a teacher's name to a
student, or a roster to a teacher, would have required loosening the
`users` rules into a readable user directory. The trade-off is that a
later "edit my profile" feature will need to propagate a changed display
name, which is a job for a Cloud Function; it is listed under Technical
Debt.

**Queries avoid composite indexes.** Every query uses equality filters
only and sorts in memory, so no `firestore.indexes.json` has to be
deployed alongside the rules. At MVP volumes the difference is not
measurable. Ordering in Firestore becomes worth revisiting when a class
can hold enough courses to need pagination.

**A shared `useAsyncData` hook** (`src/hooks/useAsyncData.ts`) carries the
loading, error, and success states, so every data-backed view handles all
three rather than only the happy path, and results from a superseded
request are discarded instead of being shown against newer inputs. Note
that the repository's ESLint setup includes the newer
`react-hooks` rules (`refs`, `set-state-in-effect`): the hook derives its
loading state from a signature comparison rather than calling `setState`
inside an effect body, and writes its loader ref from an effect rather
than during render. Both were lint errors, not style preferences.

**French Firestore error messages** live in
`src/lib/firebase/firestoreErrors.ts` (`getFirestoreErrorMessage`),
mirroring `features/auth/authErrors.ts`, so raw SDK error text never
reaches the interface.

### Completed (Milestone 4)

- **Firestore `lessons` collection**, following the `courses.ts` pattern:
  typed accessors in `src/lib/firebase/lessons.ts`, with `courseId`,
  `classId`, and `teacherId` all denormalized onto each lesson so both the
  interface and Security Rules resolve ownership and enrollment without an
  extra read.
- **A `materials` subcollection under each lesson**
  (`lessons/{lessonId}/materials/{materialId}`), typed accessors in
  `src/lib/firebase/lessonMaterials.ts`. See "Key architecture decisions"
  below for why this is a subcollection rather than an array field on the
  lesson.
- **First use of Firebase Storage.** `src/lib/firebase/storage.ts` adds the
  Storage singleton; `src/lib/firebase/lessonStorage.ts` adds upload,
  download-URL, and delete helpers, plus the orchestration functions
  (`replaceLessonVideo`, `removeLessonVideo`, `addLessonMaterial`,
  `removeLessonMaterial`, `deleteLessonWithContent`) that keep a Storage
  file and its Firestore record from disagreeing with each other. A new
  `storage.rules` file at the repository root authorizes access to it; see
  "Key architecture decisions" for how it reuses the Firestore ownership
  model instead of re-implementing it.
- **Teacher**: create, edit, reorder (move up / move down), and delete
  lessons inside a course they own; upload, replace, and remove a lesson's
  video; upload and delete learning materials.
- **Student**: see the ordered lesson list of a course they are enrolled
  in, watch a lesson's video in the browser, and download its materials.
- `CourseDetailPage`'s previous "Aucune leçon pour le moment" placeholder
  is replaced with the real, ordered lesson list. A new
  `LessonDetailPage` (`/lessons/:lessonId`) hosts the video player and the
  materials list.

#### Key architecture decisions

**Materials live in a subcollection, not an array field on the lesson.**
An array of material objects on `Lesson` was considered and rejected:
Security Rules cannot validate the shape of individual array elements the
way `keys().hasOnly(...)` validates a document, so a malformed or
oversized entry could not be rejected on write, only on read (too late).
A subcollection keeps each material as its own document, validated the
same way every other document in this project is, and lets a single
material be deleted without rewriting the lesson document it belongs to
(and therefore without racing anything else editing that document at the
same time).

**Storage Security Rules reuse the Firestore ownership model through
cross-service rules, rather than re-implementing it.** The Milestone 3
handoff flagged this as an open question: "reading an enrollment from a
Storage rule is not possible the way it is from a Firestore rule." That
turned out to be solvable directly: Cloud Storage Security Rules can call
`firestore.get()` and `firestore.exists()` to read the default Firestore
database. `storage.rules` uses this to read the lesson document named by
each Storage path (`lessons/{lessonId}/...`) and apply the exact same
"owning teacher, or an enrolled student, or an admin" check already
written once in `firestore.rules`. The alternative, encoding enough
information directly into the Storage path to authorize without any
Firestore lookup, was rejected: it would have meant duplicating the
enrollment/ownership logic in a second place, with no mechanism to keep
the two in sync as the rules evolve.

**A lesson never has a video at creation.** `createLesson` only accepts a
title and description; `videoPath`, `videoName`, and `videoSizeBytes` are
always written as `null`. The video is uploaded afterward, from
`LessonDetailPage`, once the lesson document (and therefore its id, which
the Storage path is built from) already exists. This is also why
`firestore.rules`' `create` rule for `lessons` requires those three fields
to be `null`: a lesson is never created already pointing at a file that
could not yet have been uploaded.

**Uploads are recorded only after they succeed, and in an order that
tolerates a failure partway through.** Both `replaceLessonVideo` and
`addLessonMaterial` upload to Storage first and only then write (or
update) the corresponding Firestore document; a failed Firestore write
after a successful material upload deletes the orphaned Storage file
rather than leaving it unreachable. Deletion runs in the opposite order,
for a reason specific to Storage Rules reading Firestore: `storage.rules`
authorizes a delete by reading the lesson's Firestore document, so that
document (and, for a material, its subcollection document) is always
deleted last, after the Storage objects it authorizes removing.
`deleteLessonWithContent` and the cascades that call it
(`deleteCourseWithContent` in `lessonStorage.ts`, and the extended
`deleteClassWithContent` in `classes.ts`) all follow this order.

**Deleting a course or a class now cascades into Storage, not just
Firestore.** Milestone 3's `deleteClassWithContent` already cascaded into
`courses` and `enrollments`, with a documented caveat that an interrupted
delete could leave orphaned Firestore documents behind, judged acceptable
because they would be unreachable through the interface. That reasoning
does not extend to Storage: an orphaned video or material file has no
Firestore document left pointing at it, and therefore no path through the
interface that could ever reach it again to clean it up, and it keeps
counting against Storage usage indefinitely. `deleteCourseWithContent` and
the updated `deleteClassWithContent` therefore cascade-delete every
lesson's video and materials before removing the Firestore documents that
contained them.

**Reordering swaps two `order` values in a batch, rather than
renumbering.** "Move up" / "move down" only ever touches the two adjacent
lessons, so `swapLessonOrder` is a two-document `writeBatch`, not a
rewrite of every lesson in the course. `order` is assigned automatically
on creation (one past the current highest in the course) rather than
typed by the teacher, so there is no manual numbering to get wrong or to
collide.

**Client-side upload validation (file type, file size) mirrors
`storage.rules` exactly**, in `isAllowedVideoType` / `isAllowedMaterialType`
/ `MAX_VIDEO_SIZE_BYTES` / `MAX_MATERIAL_SIZE_BYTES` (`lessonStorage.ts`).
This is a UX convenience, giving an immediate French error before a
transfer starts, not the actual enforcement: the Storage rule is what
actually enforces the limit, since a client-side check alone can always be
bypassed.

**French error messages for Storage** live in
`src/lib/firebase/storageErrors.ts` (`getStorageErrorMessage`), mirroring
`authErrors.ts` and `firestoreErrors.ts` from the previous milestones.

### Files Changed (Milestone 3)

Modified: `firestore.rules`, `src/App.tsx`, `src/routes/paths.ts`,
`src/components/index.ts`, `src/components/NavItem/NavItem.tsx`,
`src/layouts/AppLayout/AppLayout.tsx`, `src/types/index.ts`,
`src/types/class.ts`, `src/types/course.ts`,
`src/pages/dashboards/StudentDashboardPage.tsx`,
`src/pages/dashboards/TeacherDashboardPage.tsx`,
`src/pages/dashboards/AdminDashboardPage.tsx`,
`src/pages/dashboards/DashboardSectionCard.tsx`,
`src/pages/dashboards/DashboardSectionCard.module.css`

Added: `src/types/enrollment.ts`, `src/hooks/useAsyncData.ts`,
`src/utils/formatDate.ts`, `src/lib/firebase/classes.ts`,
`src/lib/firebase/courses.ts`, `src/lib/firebase/enrollments.ts`,
`src/lib/firebase/timestamps.ts`, `src/lib/firebase/firestoreErrors.ts`,
`src/components/Textarea/`, `src/components/ConfirmDialog/`,
`src/features/classes/` (`ClassCard`, `ClassCodePanel`, `ClassFormModal`,
`JoinClassModal`, `useClassesAndCourses`), `src/features/courses/`
(`CourseCard`, `CourseFormModal`), `src/pages/classes/` (`ClassesPage`,
`ClassDetailPage`), `src/pages/courses/` (`CoursesPage`,
`CourseDetailPage`), `src/pages/dashboards/DashboardItemList.tsx` and its
CSS module

Two shared components were added rather than written inline, since both
are now used by more than one feature: `Textarea` (multi-line counterpart
to `Input`, same label/helper/error handling) and `ConfirmDialog` (used
before deleting a class, deleting a course, and leaving a class).

### Files Changed (Milestone 4)

Modified: `firestore.rules`, `src/App.tsx`, `src/routes/paths.ts`,
`src/types/index.ts`, `src/types/lesson.ts` (rewritten from the Milestone 1
placeholder), `src/lib/firebase/classes.ts` (cascade delete extended into
Storage), `src/pages/courses/CourseDetailPage.tsx`,
`src/pages/courses/CourseDetailPage.module.css`, `public/icons.svg` (added
`icon-play`, `icon-upload`, `icon-download`, `icon-trash`)

Added: `storage.rules`, `src/types/lessonMaterial.ts`,
`src/lib/firebase/storage.ts`, `src/lib/firebase/storageErrors.ts`,
`src/lib/firebase/lessons.ts`, `src/lib/firebase/lessonMaterials.ts`,
`src/lib/firebase/lessonStorage.ts`, `src/utils/formatFileSize.ts`,
`src/features/lessons/` (`LessonFormModal`, `LessonListItem`,
`LessonVideoPanel`, `LessonMaterialsPanel`), `src/pages/lessons/`
(`LessonDetailPage`)

### Architecture

The app is organized by concern rather than by feature at this stage, since
Milestone 1 has no feature-specific business logic yet:

```text
src/
├── components/   Shared UI atoms (Button, Input, Card, etc.)
├── layouts/      PublicLayout, AppLayout
├── pages/        Route-level pages, including pages/dashboards/
├── features/
│   ├── auth/     Auth context/provider, route guards, Firebase auth calls,
│   │             French error messages (Milestone 2)
│   ├── classes/  Class cards, create/edit and join modals, code panel,
│   │             useClassesAndCourses (Milestone 3)
│   ├── courses/  Course cards, create/edit modal (Milestone 3)
│   └── lessons/  Lesson form modal, ordered list row, video panel,
│                 materials panel (Milestone 4)
├── lib/firebase/ Firebase singletons (app, auth, Firestore, Storage),
│                 users, classes, courses, enrollments, lessons, lesson
│                 materials, lesson Storage helpers, timestamp + error
│                 helpers (Firestore and Storage)
├── hooks/        useMediaQuery (responsive nav), useAsyncData
├── types/        User, UserRole, Class, Course, Lesson, LessonMaterial,
│                 Enrollment
├── routes/       Centralized path constants + role-to-dashboard map
└── utils/        cn() classnames helper, formatDate(), formatFileSize()
```

`features/auth` is the first folder under `features/`, as anticipated in
Milestone 1. `features/lessons` (Milestone 4) follows the same pattern
established by `features/classes` and `features/courses`.

Styling uses plain CSS Modules, no CSS framework was added, in line with
"do not unnecessarily add dependencies."

### Firebase

`src/lib/firebase/config.ts`, `auth.ts`, and `firestore.ts` provide lazily
initialized singleton accessors (`getFirebaseApp`, `getFirebaseAuth`,
`getFirebaseFirestore`), unchanged since Milestone 1. `storage.ts`
(Milestone 4) adds `getFirebaseStorage()` following the same pattern. No
credentials are hard-coded; all configuration comes from `VITE_FIREBASE_*`
environment variables documented in `.env.example`, including
`VITE_FIREBASE_STORAGE_BUCKET`, which was already present from Milestone 1
even though Storage went unused until now. No `.env` file was created or
committed.

As of Milestone 2, `src/lib/firebase/users.ts` adds real Firestore
read/write logic (`createUserProfile`, `getUserProfile`) on top of those
singletons, and `src/features/auth/authService.ts` adds real Firebase
Authentication sign-up, sign-in, sign-out, and auth-state subscription.

`firestore.rules` at the repository root covers the `users` collection
(Milestone 2), the `classes`, `courses`, and `enrollments` collections
(Milestone 3), and the `lessons` collection with its nested `materials`
subcollection (Milestone 4), followed by a catch-all rule that denies
everything else. Milestone 2's `users` block was not modified. Per the
maintainer, Milestone 2's rules and Milestone 3's rules (`classes`,
`courses`, `enrollments`) are both deployed to the live project, and the
Milestone 3 flows have been confirmed working. **The Milestone 4 additions
to `firestore.rules`, and the new `storage.rules` file, have not been
deployed**: this sandboxed working environment has no Firebase CLI
credentials and no network access to Firebase's own APIs (only GitHub,
npm, and a few package registries are reachable), and the maintainer has
said they will deploy both files themselves. Until that happens, the live
project's catch-all deny governs `lessons` and its `materials`
subcollection, and Storage has no rules deployed to it at all (an empty
Storage ruleset denies everything by default), so nothing in this
milestone will work against the live project until both files are
applied.

**`storage.rules` is a new file, alongside `firestore.rules`.** No
`firebase.json` exists in this repository (rule deployment has evidently
been done outside version control so far, since none was needed for
`firestore.rules` either), so nothing was added to wire the two files
together for a single `firebase deploy`; the maintainer will need to apply
`storage.rules` however they already apply `firestore.rules` (Firebase
console, or `firebase deploy --only storage` / `firestore:rules` with an
ad hoc `firebase.json`, whichever that is). Cloud Storage rules default to
denying all access when none are deployed, so this is not a case where an
open-by-default fallback is silently in effect in the meantime.

No Firestore composite indexes are required (see the Milestone 3
architecture decisions; Milestone 4's lesson list is sorted in memory the
same way). No Storage indexes exist as a concept. There is nothing to
deploy beyond the two rules files themselves.

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
- `/classes` : `ProtectedRoute` (any signed-in role), class list. The page
  is role-aware rather than split into three routes: a teacher sees the
  classes they own with a "Créer une classe" action, a student sees the
  classes they joined with a "Rejoindre une classe" action, and an
  administrator sees every class, read only.
- `/classes/:classId` : class detail (courses, roster, class code, and the
  owner's edit/delete actions). What is visible is decided per role, and
  backed by Security Rules rather than by the route.
- `/courses` : every course the signed-in user may see, across classes
- `/courses/:courseId` : course detail (description, and the ordered
  lesson list with the owner's create/reorder/edit/delete controls)
- `/lessons/:lessonId` : lesson detail (video player, materials list, and
  the owner's edit/delete actions), added in Milestone 4
- `/profile` : `ProtectedRoute` (any signed-in role), profile page

The class, course, and lesson routes are all guarded by `ProtectedRoute`
without `allowedRoles`, because all three roles legitimately reach them;
the difference between roles is in what the page renders and, more
importantly, in what Firestore and Storage will return.

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
- Milestone 4 follows the same empty-state discipline: no video shows a
  distinct "Aucune vidéo pour le moment" (teacher) / "Vidéo indisponible"
  (student) state instead of an empty player, no materials shows an
  `EmptyState` with an upload action for the teacher, and every upload
  shows a percentage-based progress state on its own button rather than a
  bare spinner.

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

**Milestone 3:**
- Lint: **pass** (`npm run lint`, 0 errors, 0 warnings). Two errors from
  the newer `react-hooks` rules (`refs`, `set-state-in-effect`) were found
  in the first draft of `useAsyncData` and fixed properly rather than
  suppressed; see the Milestone 3 architecture decisions.
- Build: **pass** (`npm run build`, `tsc -b && vite build`). The bundle is
  now ~868 kB unminified / ~259 kB gzipped, so Vite's "chunk larger than
  500 kB" warning still fires. That warning predates this milestone (it
  appeared once the Firebase SDK was bundled in Milestone 2) and remains
  a warning, not an error.
- Tests: still none. No test runner is configured.
- Manual verification: **not performed**. This environment has no network
  access to Firebase, so no class was created, no code was redeemed, and
  no rule was exercised against the live project. Everything in this
  milestone is verified only by the type checker, the linter, and the
  build. See Known Issues for what to smoke-test first.

**Milestone 4:**
- Lint: **pass** (`npm run lint`, 0 errors, 0 warnings).
- Build: **pass** (`npm run build`, `tsc -b && vite build`). The bundle is
  now ~918 kB unminified / ~274 kB gzipped (the `firebase/storage` module
  adds to what Milestone 2 already bundled), so Vite's "chunk larger than
  500 kB" warning still fires. See Technical Debt.
- Tests: still none. No test runner is configured.
- Manual verification: **not performed**, for the same reason as Milestone
  3: no network access to Firebase in this environment, and per the
  Firebase section above, `storage.rules` and the Milestone 4 additions to
  `firestore.rules` are not deployed yet, so nothing in this milestone
  could be exercised against the live project even if the network were
  reachable. See Known Issues for what to smoke-test first once both rules
  files are deployed.

### Known Issues

- ~~`/dashboard` always redirects to the student dashboard~~ Resolved in
  Milestone 2: `DashboardRedirect` now uses the real, Firestore-resolved
  role.
- ~~The repository's visibility was changed from private to public during
  Milestone 1~~ Resolved: the repository is private, and sessions are
  granted access with a short-lived scoped token instead.
- ~~Sign-up, sign-in, sign-out, and the role-based route guards have not
  been exercised against a live Firebase project~~ Resolved: the
  maintainer has deployed Milestone 2's `users` rules and tested
  authentication end to end.
- ~~The Milestone 3 Security Rules are not deployed~~ Resolved: the
  maintainer has deployed the `classes`, `courses`, and `enrollments`
  rules, and the Milestone 3 flows work against the live project.
- **The Milestone 4 additions to `firestore.rules`, and the new
  `storage.rules`, are not deployed.** The live project's catch-all rule
  denies all access to `lessons` and `materials`, and Storage has no rules
  deployed to it at all, so this milestone's features cannot work against
  it until the maintainer applies both files. Once they are, the sequence
  worth smoke-testing first: a teacher creates a lesson, uploads a video
  and a material to it, and reorders it against a sibling lesson; a
  student enrolled in that class can watch the video and download the
  material; a student in a different class cannot reach the lesson
  directly by URL; the teacher deletes the lesson and both the video and
  the material become unreachable (confirm in the Storage console, since
  the interface itself cannot prove a negative); deleting the course, and
  separately deleting the whole class, both take the lesson's video and
  materials with them.
- Nothing in Milestone 3 has been exercised against live Firebase from
  this session (the maintainer's own testing is separate from what this
  sandboxed environment can verify; see Tests above). The sequence worth
  smoke-testing, if not already covered by the maintainer: a teacher
  creates a class and a course; a second account, signed up as a student,
  joins with the code and sees that course; the student cannot reach a
  class they have not joined (try `/classes/<another code>` directly,
  which should show the permission error rather than the class); the
  teacher removes the student and the class disappears from the student's
  list; deleting the class removes its courses and enrollments too.
- Class codes cannot be rotated, since the code is the class document id
  (see the Milestone 3 architecture decisions). A leaked code means
  recreating the class.
- A student's display name on a roster is the name they set at sign-up and
  is not verifiable by Security Rules. A student cannot forge another
  student's identity (the id and the email are both checked against the
  authentication token), but they can present an arbitrary display name.
- Deleting a class or a course cascades from the client. As of Milestone 4
  this cascade also removes every lesson's video and materials from
  Storage (see the Milestone 4 architecture decisions), which meaningfully
  narrows the original concern here (an interrupted delete used to be able
  to leave orphaned, unreachable-but-billable documents behind); an
  interruption partway through a cascade can still leave some documents or
  files deleted and others not, though nothing left behind is reachable
  through the interface. Full atomicity belongs in a Cloud Function once
  assignments and submissions hang off a class too.
- Two lessons created concurrently in the same course (two browser tabs,
  or two teachers with access to the same account) can be assigned the
  same `order`, since `createLesson` computes "one past the current
  highest" from a read that is not part of a transaction. At the volumes
  one teacher creating lessons for their own course implies, this is a
  theoretical race rather than a practical one; `swapLessonOrder` still
  works correctly afterward (it operates on whichever two lessons are
  adjacent, regardless of whether their `order` values happen to collide
  with a third).
- A lesson's video and each material are played or downloaded through a
  Firebase Storage download URL, which embeds a long-lived access token in
  the URL itself rather than expiring shortly after being issued. Only a
  user Security Rules already allowed to read the file can obtain that URL
  in the first place, but once obtained, the URL itself is not further
  access-controlled: anyone who has it (a student who shared it, a link
  pasted somewhere public) can use it until the token is manually revoked
  in the Firebase console. This is standard behaviour for Firebase Storage
  download URLs, not a bug specific to this implementation, and is the
  same trade-off `PROJECT_RULES.md` already anticipates for DRM ("not
  included in V1 unless explicitly requested").
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
- Deployment of the Milestone 4 additions to `firestore.rules`, and of
  `storage.rules` (files exist, not yet applied, see Known Issues)
- ~~Firestore reads/writes for classes and courses~~ Implemented in
  Milestone 3.
- ~~Firestore reads/writes for lessons; Firebase Storage for video and
  materials~~ Implemented in Milestone 4.
- Class codes that can be regenerated or revoked
- Teacher-initiated invitations (a teacher cannot add a student by email;
  students join with the code). Adding one would need a readable user
  directory or a trusted backend, neither of which is in scope yet.
- Archiving a class; classes are either present or deleted
- Pagination anywhere. Every list loads in full
- Video captions, thumbnails, transcoding, or adaptive-bitrate streaming;
  a lesson's video is played back exactly as uploaded
- Assignments, submissions, discussions, announcements (real data)
- Progress tracking (real data)
- Offline video, DRM, payments, subscriptions, live classes, AI tutoring,
  certificates, native mobile apps (explicitly out of scope for the MVP)

## Important Project Rules

Read `PROJECT_RULES.md` before making changes.

Critical rules include:

Note on the last point below: `PROJECT_RULES.md` says to push completed
milestone work to `main`, but recent sessions have been asked to push to a
feature branch for review instead. The maintainer's instruction for the
session wins.

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

**Status:** Complete, deployed, and verified end to end by the maintainer.

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

### Milestone 3: Classes + Courses

**Status:** Complete, merged into `main`, and deployed: the maintainer has
applied the Milestone 3 `firestore.rules` and confirmed the class, course,
and enrollment flows work against the live project.

Objectives (all met):

- Firestore `classes` and `courses` collections with typed accessors in
  `src/lib/firebase/`, following the `users.ts` pattern
- Teachers create and manage their own classes and courses
- Students access the classes and courses they are enrolled in, through an
  `enrollments` collection designed for this purpose
- Dashboard placeholder sections replaced with real data
- Security Rules confining teachers to the classes and courses they own
  and students to the classes they joined, enforced server side rather
  than by client-side role checks

Deliberately out of scope, as future-milestone work: lessons, video,
materials, and anything touching Firebase Storage, which is still unused.

### Milestone 4: Lessons + video + materials

**Status:** Complete on the branch `milestone-4-lessons-video-materials`,
not yet merged, and not yet verified against live Firebase: `storage.rules`
and the Milestone 4 additions to `firestore.rules` still need deploying
(see Known Issues).

Objectives (all met):

- Firestore `lessons` collection, and a `materials` subcollection under
  each lesson, with typed accessors in `src/lib/firebase/`, following the
  `courses.ts` pattern
- Teachers create, edit, reorder, and delete lessons inside a course they
  own; upload, replace, and remove a lesson's video; upload and delete its
  learning materials
- Students see the ordered lesson list of a course they are enrolled in,
  watch a lesson's video, and download its materials
- First use of Firebase Storage, with `storage.rules` authorizing access
  by reading the matching Firestore lesson document (the enrollment
  question flagged as open in the Milestone 3 handoff; see the Milestone 4
  architecture decisions for how it was resolved)
- Deleting a course or a class now also removes every lesson's video and
  materials from Storage, extending Milestone 3's Firestore cascade

Deliberately out of scope, as future-milestone work: assignments,
submissions, discussions, announcements, and progress tracking.

## Milestone Roadmap

```text
Milestone 1
Foundation + architecture (complete)

Milestone 2
Authentication + roles (complete)

Milestone 3
Classes + courses (complete)

Milestone 4
Lessons + video + materials (complete)

Milestone 5
Assignments + submissions + discussions

Milestone 6
Dashboards + progress + announcements

Milestone 7
Security review + testing + MVP polish
```

Future milestones may be adjusted if architectural discoveries require it.

### Next Milestone: Milestone 5 (Assignments + submissions + discussions)

Recommended scope (adjust after inspecting the repository, per the
Working Protocol below; this is a starting point, not a locked spec):

- `assignments` and `submissions` collections, following the `lessons.ts` /
  `lessonMaterials.ts` pattern from this milestone: ownership and
  enrollment denormalized onto each document, Security Rules added
  alongside the existing blocks. `submissions` will likely need the same
  subcollection-versus-array reasoning worked through in Milestone 4
  (a submission per student per assignment, with its own attached files
  reusing the Storage-authorization approach from `storage.rules`).
- Submitted work is very likely to include file uploads again (a student
  attaching a document or image to their submission). The
  `lessonStorage.ts` upload/delete/orchestration helpers, and the
  cross-service `firestore.get()` approach in `storage.rules`, should
  generalize rather than being reinvented per feature; consider whether
  they need to move to a more general location if this milestone confirms
  the pattern is reused a third time.
- `comments` (discussions) is the collection PROJECT_RULES.md's Firestore
  model lists for this scope; scoping a comment to a lesson, an
  assignment, or a course is a design decision to make explicit before
  writing its rules, since it changes what "does this user have access to
  the parent" means.
- A grade or "reviewed" state on a submission is implied by "assignments"
  as a concept but not detailed anywhere yet; confirm scope with the
  maintainer before assuming a full grading workflow versus a simpler
  submitted/not-submitted status for the MVP.

Before starting, confirm with the maintainer that `storage.rules` and the
Milestone 4 additions to `firestore.rules` have been deployed and that the
lesson, video, and materials flows actually work against the live project.
Building Milestone 5 on top of an unverified Milestone 4 would make it
hard to tell which milestone introduced a given bug.

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
7. Push. `PROJECT_RULES.md` sections 11 and 18 say "push to `main`", but
   from Milestone 2 onwards the maintainer has asked for a feature branch
   and a pull request instead, which is what Milestones 2 and 3 did. Ask
   rather than assuming, and follow the maintainer's instruction for the
   session over the written default.
8. Clearly report what was changed and what remains.

## Technical Debt

- No automated tests exist yet (no test runner configured), and the case
  for them is stronger after every milestone that adds Security Rules.
  Worth testing first: `getAuthErrorMessage`, `getFirestoreErrorMessage`,
  and `getStorageErrorMessage`'s code-to-message mappings,
  `ProtectedRoute`'s redirect logic, `AuthProvider`'s state resolution,
  `useAsyncData`'s stale-result handling, `createClassCode`'s alphabet and
  length, and `swapLessonOrder` / the lesson `order` assignment race noted
  in Known Issues. Separately, the Firestore and Storage Security Rules
  are now the single most security-critical artifact in the repository and
  are the one thing here that can be tested exhaustively and offline, with
  `@firebase/rules-unit-testing` against the Firestore and Storage
  emulators. That is the highest-value testing work available, and now
  covers two rule files instead of one.
- The production JS bundle keeps growing: ~918 kB unminified / ~274 kB
  gzipped as of Milestone 4 (`firebase/storage` added to what Milestone 2
  already bundled), still triggering Vite's chunk-size warning. Not
  addressed in any milestone so far since it is a build-tuning concern,
  not a functional one, but worth revisiting (e.g. dynamic `import()` for
  Firebase, or adjusting `build.chunkSizeWarningLimit`) once more
  Firebase-backed features land.
- `storage.rules` and the Milestone 4 additions to `firestore.rules` are
  written but not deployed (the maintainer deploys them, and no
  `firebase.json` exists to script the two together; see the Firebase
  section). Repeated here because nothing in this milestone is verified
  against a live project until that happens.
- Denormalized names (`Class.teacherName`, `Enrollment.studentName` /
  `studentEmail`) will go stale once profile editing exists. Propagating a
  changed display name across classes and enrollments is Cloud Function
  work, not client work.
- Deleting a class or a course cascades from the client and can leave
  documents or Storage files behind if interrupted partway through (see
  Known Issues for how Milestone 4 narrowed, but did not eliminate, this).
- Every list loads in full, with no pagination and no query cursors. Fine
  at MVP volumes; the lesson list is the first one with real potential to
  grow past what that comfortably covers.
- A lesson's `order` can collide under concurrent creation (see Known
  Issues). Worth revisiting with a Firestore transaction if lessons ever
  need to be created from more than one place at once.
- Lesson video download URLs do not expire (see Known Issues); this is
  the same trade-off as the DRM/offline-video items `PROJECT_RULES.md`
  already defers, not new debt introduced by an implementation choice.

## Next Action

1. Review and merge the `milestone-4-lessons-video-materials` branch.
2. Deploy the Milestone 4 additions to `firestore.rules`, and the new
   `storage.rules` file. Until then the live project denies all access to
   `lessons`, `materials`, and every Storage object, so the Milestone 4
   interface will not work against it. No indexes need deploying, for
   either service.
3. Smoke-test the flows listed in Known Issues: lesson CRUD and reordering,
   video upload/playback, material upload/download, and that a student in
   a different class cannot reach a lesson directly by URL. Also confirm
   that deleting a lesson, a course, and a class each remove the expected
   video and material files from the Storage console, since the interface
   itself cannot prove a file is gone.
4. Then begin **Milestone 5: Assignments + submissions + discussions**
   after explicit authorization.
