# Library PDF reader fix

- Student PDF opening no longer uses `getBlob()` + `blob:` URLs.
- PDFs now resolve through Firebase Storage `getDownloadURL()` after the authenticated user opens the resource.
- The PDF is displayed in an in-app responsive reader using the browser's native PDF renderer.
- No Firebase Functions or Firestore changes are required.
- Existing Storage rules for `library/{bookId}/{fileName}` remain unchanged.
