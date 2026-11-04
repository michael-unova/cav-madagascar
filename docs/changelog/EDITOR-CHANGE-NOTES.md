# CAV Madagascar lesson editor changes

Scope: `src/components/RichLessonEditor.tsx` and editor-specific styles appended to `src/styles.css` only.

Changes in this pass:
- Reworked the content editor presentation into a Word-inspired ribbon and workspace.
- Added a heading-based, searchable lesson outline.
- Added font family, font size, text color, highlight, superscript/subscript, paragraph styles, lists, alignment, table insertion, and equation source controls.
- Added a right-side properties/equation panel.
- Added detection messaging for Word OMML equation structures in DOCX imports.
- Kept existing image, Vimeo, link, preview, paste, sanitization, and callback flows in place.

Limitations requiring a follow-up implementation:
- This pass does not introduce a full structured editor engine; it retains the existing contentEditable implementation to avoid broad dependency changes.
- A4 page size and page count remain approximate. This is not true flowing pagination with stable page boundaries.
- LaTeX is stored as source text in an equation token; it is not yet typeset by KaTeX/MathJax.
- DOCX OMML equations are detected and warned about but not converted to editable LaTeX yet.
- The original DOCX is not yet archived with a persisted reference; users should keep their source file.

Validation:
- No npm dependencies were installed (to avoid the user's data cost).
- Full TypeScript/Vite build could not be run because this extracted workspace has no node_modules. A TypeScript check was attempted and stopped on missing project dependencies/types, not on a reported syntax error in the modified file.
