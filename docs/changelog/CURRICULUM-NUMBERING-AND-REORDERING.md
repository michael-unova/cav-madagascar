# Curriculum numbering and reordering update

- Added persisted numbering styles on curriculum nodes: alphabetical (`a), b), c)`), numeric (`1, 2, 3`), hierarchical (`1.1, 1.2`), and Roman numerals (`I, II, III`).
- The administrator/content manager can select a numbering style for themes and for lessons within each theme. The selected style is stored in Firestore on sibling nodes so it follows the curriculum across sessions/devices.
- Newly created themes/lessons inherit the numbering style of their sibling level, with numeric themes and alphabetical lessons as defaults.
- Added drag-and-drop reordering for themes and lessons. Updated order is persisted through the existing shared-content repository and displayed numbering is recalculated from order.
- No Cloud Functions or new backend deployment is required. Existing Firestore rules already allow authorized content managers/admins to update `contentNodes`.

## Validation

ZIP archive integrity can be checked with `unzip -t`. A production build could not be completed in the authoring environment because the installed dependency tree is incomplete (`vite/client` and `@types/node` are missing); run `npm ci` followed by `npm run build` locally before deployment.
