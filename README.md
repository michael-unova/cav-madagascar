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
