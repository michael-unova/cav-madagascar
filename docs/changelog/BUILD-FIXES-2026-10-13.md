# Build fixes — 13 October 2026

This update addresses the compile/lint blockers from the supplied build log:

- Explicitly types psychotechnical question IDs as `string[]` and the `Set` as `Set<string>` in `functions/src/index.ts`.
- Removes the unused `go` prop from `PublicFooter` and its call sites.
- Wraps `navigateStudentPage` in an event callback when passing it to `StudentDashboard`, avoiding the React refs lint false-positive at render time.
- Initializes the psychotechnical test start-time ref with `0`; the actual start timestamp is set when the test successfully loads.

After extracting this archive, run `npm ci`, `npm run build`, and `npm run lint` from the project root. Then run `npm ci` and `npm run build` inside `functions/`.

The dependency installation could not complete in the packaging environment, so the commands above still need to be run in the project environment to confirm the build result. Existing non-blocking lint warnings have not all been refactored.
