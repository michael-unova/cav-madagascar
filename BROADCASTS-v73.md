# CAV Madagascar v73 - Broadcast Messages

## Added
- Official CAV broadcast center for administrators/content managers.
- Immediate or scheduled announcements.
- Categories: Actualité, Annonce, Rappel, Événement, Maintenance.
- Student notifications are authored as **CAV Madagascar**, never as the admin/content manager.
- Student notification detail modal.
- Admin history of sent/scheduled broadcasts.
- Server-side fan-out through Firebase Admin SDK.
- Scheduled delivery every 5 minutes using Cloud Scheduler.
- Server-side authorization and validation.
- Firestore indexes for broadcast history/scheduling.

## Backend deployment
After installing dependencies and running builds:

```powershell
npm run build
cd functions
npm run build
cd ..
firebase deploy --only functions,firestore:indexes
```

The new backend functions are:
- `adminSendBroadcast`
- `adminListBroadcasts`
- `processScheduledBroadcasts`

The existing `broadcastMessages` Firestore collection remains server-only.
