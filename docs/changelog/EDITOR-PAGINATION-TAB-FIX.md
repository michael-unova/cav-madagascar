# Lesson editor fixes — 2026-10-18

Scope: lesson authoring UI only.

## Changes
- Fixed the `Insérer` ribbon tab so it switches to insertion controls instead of immediately opening the local image picker.
- Kept the image picker bound to the explicit image insertion actions.
- Added ribbon content for insertion, layout, and display tabs.
- Added an explicit page-break insertion control and a visible marker in the editable lesson.
- Added thin A4 page-end guides and a basic zoom control in the display tab.
- Preserved existing lesson value/onChange and save pathways; no Firebase, authentication, payment, publishing, or student workflow code was intentionally changed.

## Verification limits
- `npm ci --offline --ignore-scripts` could not complete because the local npm cache is missing `zod-validation-error@4.0.2`; no network installation was attempted.
- The TypeScript check could not run to completion because `vite/client` types are unavailable without installed dependencies.
- The current editor remains a single contenteditable surface. The page-end guides are visual guides, not full Word-grade automatic pagination/reflow. Explicit page breaks are inserted as markers and retained in lesson HTML. True automatic pagination that flows content into separate editable A4 page containers requires a dedicated pagination-capable editing engine and must be implemented/tested as a separate, larger change.
