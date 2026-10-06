# CAV Madagascar Premium UI

This version applies the approved premium visual direction across the existing application.

## UI-only contract
The redesign changes presentation only. It does not intentionally modify:
- Firebase/Auth/Firestore/Storage logic
- Cloud Functions
- security rules
- data models
- routes or workflows
- concours, matières, chapters, lessons
- quizzes, exercises, results, progress
- enrollment/payment flow
- users/roles/statuses
- contact/messages

## Visual direction
- Official CAV Madagascar logo retained from `public/assets/cav-logo.png`
- CAV Blue + Deep Navy + Warm White palette
- Premium cards and soft depth
- Refined navigation and active states
- Smooth hover/entrance transitions
- Responsive desktop/tablet/mobile styling
- Existing branded loading/splash preserved and visually aligned

## Important
The project dependencies were not reinstalled in this environment because `npm ci` exceeded the available execution time. Please run `npm install` (or `npm ci`) and `npm run build` locally before deployment.
