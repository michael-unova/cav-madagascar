# Notification sounds

Soft notification chimes for administrators (`super_admin`, `content_manager`) and students.

## Behaviour
- Sound card in the **Paramètres** page (admin and student): **« Activer le son »** / **« Son activé »**, plus **« Tester le son »** when enabled. French confirmation message on every change. No floating button on the other pages.
- Sounds are generated with the Web Audio API (no audio file, no external URL). The AudioContext is created only inside the click that enables sound, and a test chime plays at that moment. After a reload the preference is restored and audio is re-unlocked on the first interaction.
- Preference is stored per account in `localStorage` (`cav_sound_enabled:<uid>`), default **off**.

## Events (existing collections, no new data model)
| Audience | Collection / query | Sound |
|---|---|---|
| Manager | `contactMessages` where `status == unread` | message |
| Manager | `lessonComments` where `unreadForAdmin == true` and `authorRole == student` | student question |
| Manager | `payments` where `status == pending` | payment to verify |
| Student | `notifications` where `userId == uid` and `read == false` (`broadcast`, `payment_verified`, comment replies) | announcement / payment / message |
| Student | own `payments`, `pending -> rejected` transition | payment |

## Safeguards
- First snapshot (backlog) is never announced; only later `added` changes are, and only if the timestamp is fresh.
- Local writes (`hasPendingWrites`) and own actions (`actorUserId == uid`) are ignored.
- Dedupe by `uid:type:docId` (remembered across listener restarts) and a 600 ms minimum gap between sounds.
- Listeners only run while sound is enabled and are removed on sign-out, account switch, mute and unmount.

## Limits
Sounds only play while the app is open in a browser tab/app. No push/background notification (FCM) is implemented. No Firebase configuration or deployment change is required.

## Code
`src/features/sound/` (engine, preference, listeners, provider, context, settings card, CSS), card rendered by `ProfilePage` in `src/App.tsx`, mounted in `src/main.tsx`.
