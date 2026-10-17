import { createHash } from 'node:crypto';
export const SITE_URL = 'https://cav.mg';
/** Hash used as Firestore document id, so e-mail addresses are not stored in clear. */
export function throttleKey(kind, value) {
    return `${kind}_${createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 40)}`;
}
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/**
 * Decides whether a reset request is allowed, given the timestamps of earlier requests.
 * Rules: at most 1 per minute and at most `maxPerHour` per hour.
 */
export function decideThrottle(history, now, maxPerHour = 5) {
    const recent = history.filter(t => now - t < HOUR);
    const last = recent.length ? Math.max(...recent) : 0;
    const allowed = now - last >= MINUTE && recent.length < maxPerHour;
    return { allowed, history: allowed ? [...recent, now] : recent };
}
/**
 * Firebase returns a link on its own handler domain. We keep only the one-time code and
 * build a link to the app's own /auth/action page (the page that lets the student choose a new password).
 */
export function buildActionUrl(firebaseLink, siteUrl = SITE_URL) {
    const oobCode = new URL(firebaseLink).searchParams.get('oobCode');
    if (!oobCode)
        throw new Error('Lien Firebase sans oobCode.');
    const url = new URL('/auth/action', siteUrl);
    url.searchParams.set('mode', 'resetPassword');
    url.searchParams.set('oobCode', oobCode);
    url.searchParams.set('lang', 'fr');
    url.searchParams.set('continueUrl', `${siteUrl}/?auth=login`);
    return url.toString();
}
const escapeHtml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function renderPasswordResetEmail(actionUrl) {
    const subject = 'Réinitialisez votre mot de passe CAV';
    const href = escapeHtml(actionUrl);
    const text = [
        'Bonjour,',
        '',
        'Vous avez demandé à réinitialiser votre mot de passe sur CAV Madagascar.',
        'Ouvrez ce lien pour choisir un nouveau mot de passe :',
        actionUrl,
        '',
        'Ce lien est valable 1 heure et ne peut être utilisé qu’une fois.',
        'Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet e-mail : votre mot de passe ne changera pas.',
        '',
        'CAV Madagascar (Cours d’Appui Virtuel)',
        SITE_URL,
    ].join('\n');
    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f4f7fc;font-family:Arial,Helvetica,sans-serif;color:#0b1f3a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fc;padding:24px 12px;"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e1e8f5;">
    <tr><td style="background:#0b1f3a;padding:22px 28px;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:.5px;">CAV <span style="color:#7fb2ff;">Madagascar</span></td></tr>
    <tr><td style="padding:32px 28px 8px 28px;">
      <h1 style="margin:0 0 14px 0;font-size:22px;line-height:1.3;color:#0b1f3a;">Réinitialisez votre mot de passe</h1>
      <p style="margin:0 0 14px 0;font-size:16px;line-height:1.6;color:#33415c;">Bonjour,</p>
      <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;color:#33415c;">Vous avez demandé à réinitialiser votre mot de passe sur CAV Madagascar. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;"><tr><td style="background:#1769e0;border-radius:999px;">
        <a href="${href}" style="display:inline-block;padding:14px 30px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Choisir un nouveau mot de passe</a>
      </td></tr></table>
      <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:#5b6b86;">Ce lien est valable 1 heure et ne peut être utilisé qu’une fois.</p>
      <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#5b6b86;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${href}" style="color:#1769e0;word-break:break-all;">${href}</a></p>
    </td></tr>
    <tr><td style="padding:18px 28px 26px 28px;border-top:1px solid #e1e8f5;font-size:13px;line-height:1.6;color:#7a88a3;">Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet e-mail : votre mot de passe ne changera pas.<br><br>CAV Madagascar, Cours d’Appui Virtuel<br><a href="${SITE_URL}" style="color:#7a88a3;">cav.mg</a></td></tr>
  </table>
</td></tr></table>
</body></html>`;
    return { subject, text, html };
}
