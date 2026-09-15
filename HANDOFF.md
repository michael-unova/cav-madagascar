# HANDOFF

## Project

**Name:** E-Learning Platform  
**Repository:** `michael-unova/e-learning`  
**Repository visibility:** Private  
**Frontend:** React + TypeScript + Vite  
**Backend:** Firebase  
**Deployment:** Cloudflare  
**Primary language:** French

## Current Status

The project is at the initial technical baseline.

### Completed

- React + TypeScript + Vite project created
- ESLint configured by Vite
- Git initialized
- Default branch renamed to `main`
- Initial project commit created
- GitHub remote configured
- Initial project pushed to GitHub
- GitHub repository is private
- Cloudflare is connected to the GitHub repository
- Cloudflare production deployment has succeeded
- Firebase project created
- Firebase web application registered
- Firebase SDK installed in the React project
- Firebase SDK dependency committed and pushed

### Current Infrastructure

```text
Local project
C:\Projects\e-learning
        |
        | git push
        v
Private GitHub repository
michael-unova/e-learning
        |
        | automatic deployment
        v
Cloudflare
        |
        v
Live React frontend
```

Firebase:

```text
Firebase project: e-learning
Project ID: e-learning-b2434
```

Intended Firebase services:
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Cloud Functions when required later

## Important Project Rules

Read `PROJECT_RULES.md` before making changes.

Critical rules include:

- User-facing interface must be professional French.
- Code and database identifiers remain in English.
- NEVER use the em dash character `—`.
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

**Status:** Not started.

Objectives:

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

Do NOT implement the full course system, lessons, assignments, discussions, or advanced authentication functionality during this milestone unless required as a minimal architectural dependency.

## Milestone Roadmap

```text
Milestone 1
Foundation + architecture

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

## Known Issues

None currently known.

## Technical Debt

None currently identified.

## Next Action

Begin **Milestone 1: Foundation + architecture** after explicit authorization.
