# CAV Madagascar v70 - Loading UX

## Loading architecture
- Initial splash remains for the first application/authentication initialization.
- Authenticated navigation uses a lightweight CAV-branded loader instead of the splash screen.
- The loader appears for section changes from the sidebar, mobile navigation, dashboard navigation, course navigation, practice navigation, and notification-driven navigation.
- Loader duration is intentionally short (320 ms) so navigation feels responsive while still providing visual feedback.
- Existing page entrance animation remains in place.
- No Firebase function or backend deployment is required for this UX change.

## Validation
`npm run build` could not be completed in this environment because the dependency installation was unavailable/time-limited and the local dependency cache did not contain the required `vite/client` and Node type definitions. The source change was made without modifying backend code.
