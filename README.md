# Nova Études : E-learning platform

A French-language e-learning platform where teachers and students interact
around classes, courses, lessons, and progress tracking.

This repository currently contains **Milestone 1: Foundation and
Architecture**: the application shell, routing, layouts, UI components, and
Firebase foundation that later milestones build on. See `HANDOFF.md` for a
full record of what has been implemented and what comes next, and
`PROJECT_RULES.md` for the rules that govern this project.

## Stack

- React + TypeScript + Vite
- React Router for client-side routing
- CSS Modules for component styling (no CSS framework)
- Firebase SDK (Authentication and Firestore foundations only at this stage)
- ESLint

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your Firebase project's values
npm run dev
```

## Scripts

- `npm run dev`: start the local dev server
- `npm run build`: type-check and build for production
- `npm run lint`: run ESLint
- `npm run preview`: preview the production build locally

## Environment variables

Firebase configuration is read from environment variables (see
`.env.example`). Never commit a real `.env` file.

## Project structure

```text
src/
├── components/    Shared, reusable UI components
├── layouts/       PublicLayout and AppLayout
├── pages/         Route-level pages, including role dashboards
├── features/      Feature-specific code (grows with future milestones)
├── lib/firebase/  Firebase app, auth, and firestore foundations
├── hooks/         Shared React hooks
├── types/         Shared TypeScript types
├── routes/        Route path constants
└── utils/         Small shared utilities
```

## Language

All user-facing text is in French. Code (variables, functions, components,
file names, Firestore field names) stays in English.

## CAV Madagascar product scope

The current product scope is:

- public concours catalogue
- student accounts and protected learning access
- MVola reference submission and manual admin validation
- reusable subjects and course-specific curriculum
- Word-to-lesson rich-text paste with student preview
- publish/unpublish lesson content
- learning progress, resume position, video timestamp, bookmarks and personal notes
- question bank
- practice/entraînement sets
- automatic practice scoring for objective questions
- per-concours mock exam papers ("Sujets types") that combine questions from all the matières of a concours
- admin analytics and user management

Each concours has its own **Sujets types**, managed by admins in the concours editor
(title, description, optional time limit, scoring options and the questions drawn from
every matière of the concours). Enrolled students can open a published Sujet type at any
time, whether or not they have finished the lessons. Scoring goes through `submitPractice`
and is reported per matière.

There is intentionally no full exam-day simulation beyond these papers (no proctoring or
fixed exam sessions).

### Practice scoring backend

Practice scoring is handled by the Firebase callable function `submitPractice` so the answer key is not exposed to students through the published question-set document.

After installing the dependencies in `functions/`, deploy it with:

```powershell
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

