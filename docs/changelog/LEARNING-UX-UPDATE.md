# CAV Madagascar — Learning UX Update

## Student lesson experience
- Removed the fixed A4/page-by-page lesson reader from the student lesson view.
- Lesson HTML remains sanitized and is rendered as the original Word/HTML content without rewriting the educational content.
- Responsive reading layout for desktop, tablet and mobile.
- Images, tables, links and embedded lesson media remain inside the content flow.
- Lesson questions are loaded after the lesson content so they do not block initial reading.

## Comments
- Redesigned discussion entry point with clearer hierarchy.
- Desktop comments remain inline.
- Mobile comments open as a bottom sheet with a backdrop and safe-area support.
- Reply/composer controls are touch-friendly and responsive.

## Scope
- No Firestore rules or Cloud Functions changes.
- No change to the Word import/content preservation pipeline.
