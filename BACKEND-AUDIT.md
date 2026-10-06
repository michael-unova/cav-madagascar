# CAV Madagascar backend and integration audit

Date: 2026-09-24

## Basis

This audit was performed against the uploaded current project archive and the manual tests already completed in the browser.

## Confirmed working

- Authentication and registration
- Protected student dashboard
- Admin authorization
- Public 404 handling
- Public concours catalogue
- Course details and enrollment UI
- Course publication and unpublication
- Subject creation
- Curriculum subject attachment and removal
- User listing
- Payment verification page
- Student enrollment UI

## Known backend blockers before deployment

The Firebase project currently has older deployed rules. The local `firestore.rules` in this archive is the intended consolidated ruleset, but it has not been deployed.

The previous browser tests therefore correctly exposed permission errors for:

- content node creation
- question creation
- payment submission

Do not bypass these permissions in the client.

## Changes made

### Firestore
- Added enrollment-aware access checks for paid content.
- Added ownership immutability for progress, bookmarks, notes, and exam attempts.
- Restricted payment creation to authenticated students with a published course and matching course price.
- Restricted payment approval to managers.
- Made enrollment IDs deterministic: `userId_courseId`.
- Restricted enrollment creation and updates to managers.
- Kept MVola verification manual: admin checks the transaction reference against the MVola SMS and approves or rejects it.

### Indexes
Added indexes for the known compound queries:
- courses: slug + status
- courseSubjects: courseId + status + order
- courseSubjects: courseId + order
- contentNodes: courseSubjectId + status + order
- contentNodes: courseSubjectId + order
- contentBlocks: nodeId + status + order
- contentBlocks: nodeId + order
- enrollments: userId + enrolledAt
- payments: status + submittedAt

### Storage
- Course thumbnails remain public.
- Educational content files require an active enrollment or manager access.
- Profile files remain user-owned.

### Admin UI
- Subjects can now be edited.
- Subjects can be published/unpublished.
- Courses can now be edited.
- Content nodes support optional parent selection.
- Content nodes can be published/unpublished.
- Content blocks can be published/unpublished.
- MVola approval and enrollment activation are committed atomically.

### Student UI
- Global authenticated navbar now shows the student/admin account state instead of `Se connecter` and `Créer un compte`.
- Learning content queries now request only published subjects, nodes, and blocks.

### Analytics
Analytics metrics are now loaded independently so one failed metric does not silently turn every metric into zero.

## Validation performed in the sandbox

- TypeScript/TSX syntax parsing: passed.
- JSON validation for package and Firestore indexes: passed.
- Full `npm run build`: not completed in the sandbox because the uploaded archive did not contain node_modules and the sandbox could not complete a network package installation. The local project should run `npm install` and then `npm run build` before deployment.

## Deployment order

1. Install dependencies in the local project.
2. Run `npm run build`.
3. Run the manual browser tests again.
4. Review Firestore rules and indexes.
5. Deploy Firestore rules and indexes.
6. Deploy Storage rules.
7. Repeat content creation, question creation, payment submission, admin approval, and learning access tests.
8. Only then move to production deployment.
