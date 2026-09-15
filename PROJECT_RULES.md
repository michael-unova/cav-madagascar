# PROJECT RULES

## 1. Project Identity

This project is a modern, French-language e-learning platform where teachers and students can interact, organize learning into classes and courses, watch video lessons, access learning materials, complete assignments, and communicate through announcements and discussions.

The current objective is a validation MVP. Do not implement future advanced functionality unless explicitly requested.

## 2. Technology Stack

- Frontend: React
- Language: TypeScript
- Build tool: Vite
- Authentication: Firebase Authentication
- Database: Cloud Firestore
- File storage: Firebase Storage
- Backend logic: Firebase Cloud Functions when needed
- Source control: Git + GitHub
- Frontend deployment: Cloudflare
- Package manager: npm

The project repository is private.

## 3. Product Language

All user-facing content MUST be in professional, natural French.

This includes:
- Navigation
- Buttons
- Forms
- Validation messages
- Error messages
- Empty states
- Loading states
- Notifications
- Dashboards
- Course interfaces
- Teacher interfaces
- Student interfaces
- Admin interfaces

Code remains in English:
- Variables
- Functions
- Components
- Types
- Hooks
- File names
- Database collection names
- Database field names

The architecture should be localization-ready for possible future support of English and Malagasy, but V1 is French only.

## 4. Writing Rule

NEVER use the em dash character `—` anywhere in the project.

Use commas, periods, colons, parentheses, or standard hyphens instead.

## 5. User Roles

The platform has three roles:

### Admin
- Manage platform users
- Manage teachers and students
- Manage courses/classes when appropriate
- View platform overview

### Teacher
- Create and manage their own classes
- Create and manage their own courses
- Create and manage lessons
- Upload videos and learning materials
- Create assignments
- View students in their classes
- Publish announcements
- Participate in discussions

### Student
- Access authorized classes and courses
- Watch lessons
- Access learning materials
- Complete assignments
- Submit work
- Track learning progress
- Participate in discussions
- Read announcements

Users must never be able to grant themselves permissions by manipulating client-side state.

## 6. Security Principles

Security is a first-class requirement.

- Never trust client-side role checks alone.
- Enforce authorization with Firebase Security Rules and trusted backend logic where required.
- Students can only access resources they are authorized to access.
- Teachers can only manage resources within their permitted scope.
- Admin permissions must be explicitly controlled.
- Never weaken security rules merely to make a feature work.
- Never expose service-account credentials in frontend code.
- Never commit `.env` files or secrets.
- Use `.env.example` for documenting required environment variables.
- Firebase client configuration may be used in frontend code through environment variables, but sensitive credentials must never be exposed.

## 7. MVP Scope

The MVP should focus on validating the product idea.

Included:
- Public landing page
- Authentication
- Role-aware application experience
- Teacher dashboard
- Student dashboard
- Admin dashboard
- Classes
- Courses
- Lessons
- Online video playback
- Learning materials
- Assignments and submissions
- Announcements
- Discussions/comments
- Basic progress tracking

Not included in V1 unless explicitly requested:
- Offline video downloads
- DRM
- Encrypted offline storage
- Payments
- Subscriptions
- Live video classes
- Video conferencing
- AI tutor
- Certificates
- Native mobile applications
- Complex examination engine

The architecture should allow these features to be added later without unnecessarily rewriting the application.

## 8. Firestore Model

Initial top-level collections:

- `users`
- `classes`
- `courses`
- `lessons`
- `enrollments`
- `assignments`
- `submissions`
- `comments`
- `announcements`

Do not introduce new collections casually. Explain architectural reasons before adding major new persistent entities.

## 9. React Architecture

Prefer a clean, scalable feature-oriented architecture.

Suggested structure:

```text
src/
├── components/
├── layouts/
├── pages/
├── features/
│   ├── auth/
│   ├── classes/
│   ├── courses/
│   ├── lessons/
│   ├── assignments/
│   └── discussions/
├── lib/
│   └── firebase/
├── hooks/
├── types/
├── routes/
├── utils/
├── App.tsx
└── main.tsx
```

The exact structure may evolve when there is a clear technical reason.

## 10. UI and UX

The interface should feel:
- Modern
- Clean
- Professional
- Educational
- Premium
- Responsive

Design for:
- Desktop
- Tablet
- Mobile

Avoid generic-looking CRUD interfaces where possible.

Use reusable components instead of duplicating UI.

Prioritize:
- Clear navigation
- Accessibility
- Good empty states
- Good loading states
- Good error states
- Consistent spacing and typography
- Clear calls to action

## 11. Development Workflow

Every milestone follows this process:

```text
Inspect
  ↓
Understand existing architecture
  ↓
Implement only the requested milestone
  ↓
Test
  ↓
Build
  ↓
Fix issues
  ↓
Update HANDOFF.md
  ↓
Commit
  ↓
Push to main
```

Never skip inspection of existing work.

Never assume that a feature is missing without checking the repository.

Never unnecessarily rewrite working code.

## 12. Claude Handoff Protocol

`HANDOFF.md` is the persistent continuity document between Claude sessions and Claude accounts.

At the end of every milestone, update it with:

- Current project state
- Completed work
- Files created or modified
- Architecture decisions
- Firebase configuration/status
- Firestore changes
- Security rules changes
- Tests performed
- Build status
- Known issues
- Technical debt
- Next milestone
- Recommended next actions

The next Claude session MUST read:
1. `PROJECT_RULES.md`
2. `HANDOFF.md`
3. Relevant existing source code

before making changes.

## 13. Git Rules

- Main branch: `main`
- Repository is private.
- Use clear, conventional commit messages.
- Do not commit secrets.
- Do not force-push.
- Do not rewrite Git history unless explicitly authorized.
- Before pushing, verify lint/build status.
- Keep commits logically organized around milestones or meaningful changes.

## 14. Cloudflare

The frontend is deployed through Cloudflare from the GitHub repository.

Do not change the existing Cloudflare deployment configuration unless necessary.

Expected production build:

```text
npm run build
```

Expected Vite output:

```text
dist
```

## 15. Firebase

Firebase project:

```text
e-learning
Project ID: e-learning-b2434
```

Firebase is used for application backend services.

Do not create production data or security rules that bypass authorization simply for development convenience.

## 16. Quality Standard

Do not optimize for the smallest amount of code.

Optimize for:
- Correctness
- Maintainability
- Security
- Simplicity
- Good UX
- Clear architecture

When uncertain, inspect the repository and document the decision in `HANDOFF.md`.

## 17. Milestone Discipline

Only implement the currently authorized milestone.

Do not silently continue into future milestones.

If a future feature is required as a dependency, implement the smallest clean foundation necessary and document it.

## 18. Final Verification

Before declaring a milestone complete:

- Run lint
- Run production build
- Run available tests
- Check for TypeScript errors
- Check responsive behavior where applicable
- Check that no secrets are committed
- Update `HANDOFF.md`
- Commit
- Push to `main`
