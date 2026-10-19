# CAV lesson editor — dedicated workspace refinement

## Scope
Only the lesson-editor integration and editor styles were changed. The Programme/lesson-management page remains unchanged when the editor is not open.

## Changes
- Clicking **Éditer le contenu** now opens the lesson editor immediately in a dedicated, viewport-sized workspace, so the Programme sidebar and surrounding management layout are covered while editing.
- Added the lesson title and a compact A4/page-count indicator to the editor header.
- Added a visible **Enregistrer** action in the dedicated workspace, wired to the existing lesson save callback and saving state.
- Added **Quitter l’éditeur**, which returns to the lesson preview rather than collapsing back into the cramped embedded layout.
- Preview displays the current in-memory draft first, so leaving the editor does not hide unsaved edits from the preview. Saving remains explicit; previewing does not publish content.
- Improved workspace spacing, panel sizing, page canvas, header actions, and narrow-screen behavior.
- Existing content editing callbacks, Word import, image/video/link/table tools, lesson save operation, publishing controls, and other application workflows remain in place.

## Validation and limitations
- Confirmed the source changes and ZIP contents locally.
- Attempted `npm ci --offline --ignore-scripts --no-audit --no-fund`; it could not complete because `zod-validation-error@4.0.2` is not present in the local npm cache (`ENOTCACHED`). No network install was attempted.
- Production build and browser interaction tests therefore remain unverified.
- This is a focused layout/integration refinement. It does not claim true Word pagination or complete OMML equation conversion.
