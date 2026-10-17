# Custom password reset e-mail (Brevo)

Password reset e-mails are sent by the Cloud Function `sendPasswordResetEmail`
(functions/src/index.ts) through Brevo SMTP, using Firebase Admin
`generatePasswordResetLink`. The HTML template is in functions/src/passwordResetEmail.ts.

## One-time setup
1. Brevo: domain `cav.mg` authenticated, sender `no-reply@cav.mg` added, SMTP key generated (SMTP & API > SMTP).
2. Store the key as a secret (never in the repo or in chat):
   `firebase functions:secrets:set BREVO_SMTP_KEY`
3. Deploy: `firebase deploy --only functions:sendPasswordResetEmail`
   The first deploy asks for `BREVO_SMTP_LOGIN` (the SMTP login shown in Brevo, ends with `@smtp-brevo.com`).
   `MAIL_FROM` is optional (default `CAV Madagascar <no-reply@cav.mg>`).

## Behaviour
- Same response whether or not the account exists (no account discovery).
- Limits: 1 request per minute and 5 per hour per address, 20 per hour per IP (Firestore `passwordResetThrottle`, hashed keys).
- The link points to https://cav.mg/auth/action (the app's own page), valid 1 hour, single use.
