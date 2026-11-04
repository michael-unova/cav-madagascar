# Styled confirmation modal update

Replaced the native browser confirmation prompt used when permanently deleting a curriculum topic or lesson with a CAV-branded React modal.

- Keeps the same delete handler and irreversible-action warning.
- Cancel closes the modal without deleting anything.
- Confirm invokes the existing deletion workflow.
- Topic deletion explicitly warns that all child lessons will also be deleted.
- Responsive mobile layout, keyboard-visible focus styles, reduced-motion support, and accessible `alertdialog` semantics are included.

The production build could not be verified in this environment because `npm ci` timed out.
