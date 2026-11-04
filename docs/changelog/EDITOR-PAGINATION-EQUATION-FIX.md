# CAV lesson editor: page-break and equation rendering fix

## Scope

This patch is limited to `src/components/RichLessonEditor.tsx` and `src/styles.css`. It does not change Firebase, authentication, payments, publishing, enrollment, or course-management flows.

## Changes

- The **Saut de page** command now measures the marker's position in the editable canvas and expands it to the next A4 page-content boundary, leaving the remainder of the current page blank and placing the continuation at the next visible page. The existing A4 guide uses 1122 CSS pixels per page at 96 DPI.
- The equation preview and inserted equation nodes now use native MathML generated from common LaTeX constructs (fractions, square/nth roots, powers, subscripts, common operators, Greek letters, sums, integrals, and common matrix environments). The original LaTeX remains in `data-latex` for later editing.
- Equation MathML is retained by the lesson HTML sanitizer so it can render in the editor and preview.
- The student reading view suppresses the editor-only blank-page filler so a computed editor height does not become a large blank gap in the reading layout.

## Known limitations

- This remains a contenteditable-based editor with visual A4 guides, not a full Word/ProseMirror pagination engine. Automatic content reflow, split-table behavior, and exact Word pagination are not guaranteed.
- The dependency-free LaTeX-to-MathML converter intentionally covers common school-level syntax; it is not a complete LaTeX implementation. Complex LaTeX commands and conversion of Word OMML equations still require further validation.
- The production build and browser interaction tests were not run here because this project copy has no installed `node_modules`. No dependency installation was performed to avoid consuming network data.
