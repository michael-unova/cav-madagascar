# CAV Madagascar — Logged-out mobile navigation update

## Changes
- Replaced the multi-row logged-out mobile header with a compact header containing the official CAV logo and a hamburger toggle.
- The expandable menu contains Accueil, Concours, Comment ça marche, À propos, Se connecter, and Créer un compte.
- Selecting a menu item closes the menu before navigating.
- Desktop navigation remains unchanged.
- Changes are scoped to `PublicNavbar` (the logged-out public landing experience) and `.public-logged-out-nav` styles. The authenticated student dashboard/navigation and admin/content-manager views were not changed.

## Validation
- Inspected the actual app entry point (`src/main.tsx` imports `src/App.tsx`) and updated the active `PublicNavbar` in `src/App.tsx`.
- `npm run build` was attempted but cannot complete in this environment because dependency installation did not finish and TypeScript reports missing `vite/client` and `node` type definitions. Run `npm ci` locally, then `npm run build` before deploying.
