import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
initializeApp();
const db = getFirestore();
function normalizeText(value) {
    return String(value ?? '').trim().toLocaleLowerCase('fr-FR').replace(/\s+/g, ' ');
}
function arraysEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b))
        return false;
    return [...a].map(String).sort().join('|') === [...b].map(String).sort().join('|');
}
function answerIsCorrect(type, answer, correct) {
    if (type === 'multiple_select')
        return arraysEqual(answer, correct);
    if (type === 'short_answer')
        return normalizeText(answer) === normalizeText(correct);
    if (type === 'numeric')
        return Number(answer) === Number(correct);
    if (type === 'true_false')
        return Boolean(answer) === Boolean(correct);
    return String(answer ?? '') === String(correct ?? '');
}
async function requireAdmin(uid) {
    const snapshot = await db.doc(`users/${uid}`).get();
    if (!snapshot.exists)
        throw new HttpsError('permission-denied', 'Profil administrateur introuvable.');
    const profile = snapshot.data() ?? {};
    if (profile.status !== 'active' || !['super_admin', 'content_manager'].includes(String(profile.role ?? ''))) {
        throw new HttpsError('permission-denied', 'Droits administrateur requis.');
    }
    return profile;
}
async function requireBroadcastManager(uid) {
    const snapshot = await db.doc(`users/${uid}`).get();
    if (!snapshot.exists)
        throw new HttpsError('permission-denied', 'Profil administrateur introuvable.');
    const profile = snapshot.data() ?? {};
    if (profile.status !== 'active' || !['super_admin', 'content_manager'].includes(String(profile.role ?? ''))) {
        throw new HttpsError('permission-denied', 'Droits de gestionnaire requis.');
    }
    return profile;
}
function isEnrollmentActive(data, now = new Date()) {
    if (String(data.status ?? '') !== 'active')
        return false;
    const expiresAt = data.expiresAt;
    if (expiresAt && typeof expiresAt.toDate === 'function')
        return expiresAt.toDate().getTime() > now.getTime();
    return true;
}
function chunk(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size)
        chunks.push(items.slice(i, i + size));
    return chunks;
}
async function deliverBroadcast(broadcastId) {
    const ref = db.doc(`broadcastMessages/${broadcastId}`);
    const snapshot = await ref.get();
    if (!snapshot.exists)
        return { recipientCount: 0 };
    const broadcast = snapshot.data() ?? {};
    if (broadcast.status === 'sent')
        return { recipientCount: Number(broadcast.recipientCount ?? 0) };
    const audienceType = String(broadcast.audienceType ?? 'all');
    let recipients = [];
    let studentNames = new Map();
    if (audienceType === 'student') {
        const targetUserId = String(broadcast.targetUserId ?? '');
        if (targetUserId) {
            const target = await db.doc(`users/${targetUserId}`).get();
            if (target.exists && target.data()?.role === 'student' && target.data()?.status === 'active') {
                recipients = [targetUserId];
                studentNames.set(targetUserId, String(target.data()?.displayName ?? 'Étudiant').trim() || 'Étudiant');
            }
        }
    }
    else if (audienceType === 'course') {
        const targetCourseId = String(broadcast.targetCourseId ?? '');
        if (targetCourseId) {
            const enrollmentSnapshot = await db.collection('enrollments')
                .where('courseId', '==', targetCourseId)
                .where('status', '==', 'active')
                .get();
            const activeUserIds = [...new Set(enrollmentSnapshot.docs
                    .filter(item => isEnrollmentActive(item.data()))
                    .map(item => String(item.data().userId ?? ''))
                    .filter(Boolean))];
            for (let i = 0; i < activeUserIds.length; i += 500) {
                const refs = activeUserIds.slice(i, i + 500).map(id => db.doc(`users/${id}`));
                const users = await db.getAll(...refs);
                users.forEach(user => {
                    const data = user.data() ?? {};
                    if (data.role === 'student' && data.status === 'active') {
                        recipients.push(user.id);
                        studentNames.set(user.id, String(data.displayName ?? 'Étudiant').trim() || 'Étudiant');
                    }
                });
            }
        }
    }
    else {
        const studentsSnapshot = await db.collection('users').where('role', '==', 'student').where('status', '==', 'active').get();
        recipients = studentsSnapshot.docs.map(item => item.id);
        studentNames = new Map(studentsSnapshot.docs.map(item => [item.id, String(item.data().displayName ?? 'Étudiant').trim() || 'Étudiant']));
    }
    const batches = chunk(recipients, 450);
    for (const ids of batches) {
        const batch = db.batch();
        ids.forEach(userId => {
            const notificationRef = db.collection(`notifications`).doc();
            batch.set(notificationRef, {
                userId,
                recipientName: studentNames.get(userId) ?? 'Étudiant',
                type: 'broadcast',
                senderName: 'CAV Madagascar',
                actorName: 'CAV Madagascar',
                title: String(broadcast.title ?? 'Annonce CAV'),
                message: String(broadcast.message ?? ''),
                category: String(broadcast.category ?? 'annonce'),
                broadcastId,
                read: false,
                createdAt: new Date(),
            });
        });
        if (ids.length)
            await batch.commit();
    }
    await ref.update({ status: 'sent', recipientCount: recipients.length, sentAt: new Date(), updatedAt: new Date() });
    return { recipientCount: recipients.length };
}
export const adminListBroadcastTargets = onCall({ region: 'africa-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    await requireBroadcastManager(uid);
    const [studentsSnapshot, coursesSnapshot] = await Promise.all([
        db.collection('users').where('role', '==', 'student').where('status', '==', 'active').limit(1000).get(),
        db.collection('courses').where('status', '==', 'published').get(),
    ]);
    return {
        students: studentsSnapshot.docs.map(item => ({ id: item.id, displayName: String(item.data().displayName ?? 'Étudiant'), email: String(item.data().email ?? '') })).sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr')),
        courses: coursesSnapshot.docs.map(item => ({ id: item.id, title: String(item.data().title ?? 'Concours') })).sort((a, b) => a.title.localeCompare(b.title, 'fr')),
    };
});
export const adminSendBroadcast = onCall({ region: 'africa-south1', timeoutSeconds: 540 }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    const profile = await requireBroadcastManager(uid);
    const title = String(request.data?.title ?? '').trim();
    const message = String(request.data?.message ?? '').trim();
    const category = String(request.data?.category ?? 'annonce').trim();
    const audienceType = ['all', 'course', 'student'].includes(String(request.data?.audienceType ?? 'all'))
        ? String(request.data?.audienceType ?? 'all')
        : 'all';
    const targetCourseId = typeof request.data?.targetCourseId === 'string' ? request.data.targetCourseId.trim() : '';
    const targetUserId = typeof request.data?.targetUserId === 'string' ? request.data.targetUserId.trim() : '';
    const sendAtValue = request.data?.sendAt;
    if (!title || !message)
        throw new HttpsError('invalid-argument', 'Titre et message obligatoires.');
    if (audienceType === 'course' && !targetCourseId)
        throw new HttpsError('invalid-argument', 'Concours cible obligatoire.');
    if (audienceType === 'student' && !targetUserId)
        throw new HttpsError('invalid-argument', 'Étudiant cible obligatoire.');
    if (title.length > 120 || message.length > 2000)
        throw new HttpsError('invalid-argument', 'Annonce trop longue.');
    const sendAt = typeof sendAtValue === 'string' && sendAtValue ? new Date(sendAtValue) : new Date();
    if (Number.isNaN(sendAt.getTime()))
        throw new HttpsError('invalid-argument', 'Date invalide.');
    const scheduled = sendAt.getTime() > Date.now() + 5000;
    if (request.data?.sendAt && !scheduled)
        throw new HttpsError('failed-precondition', 'La date programmée doit être dans le futur.');
    if (audienceType === 'course') {
        const course = await db.doc(`courses/${targetCourseId}`).get();
        if (!course.exists || course.data()?.status !== 'published')
            throw new HttpsError('failed-precondition', 'Le concours cible est introuvable ou non publié.');
    }
    if (audienceType === 'student') {
        const student = await db.doc(`users/${targetUserId}`).get();
        if (!student.exists || student.data()?.role !== 'student' || student.data()?.status !== 'active')
            throw new HttpsError('failed-precondition', 'L’étudiant cible est introuvable ou inactif.');
    }
    const ref = await db.collection('broadcastMessages').add({
        title, message, category, audienceType, targetCourseId: audienceType === 'course' ? targetCourseId : null, targetUserId: audienceType === 'student' ? targetUserId : null, status: scheduled ? 'scheduled' : 'sending',
        sendAt, createdAt: new Date(), updatedAt: new Date(),
        createdByUid: uid, createdByName: String(profile.displayName ?? 'Équipe CAV Madagascar'),
        senderName: 'CAV Madagascar', recipientCount: 0,
    });
    if (scheduled)
        return { success: true, status: 'scheduled', broadcastId: ref.id };
    const result = await deliverBroadcast(ref.id);
    return { success: true, status: 'sent', broadcastId: ref.id, recipientCount: result.recipientCount };
});
export const adminGetBroadcastReadStatus = onCall({ region: 'africa-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    await requireBroadcastManager(uid);
    const broadcastId = typeof request.data?.broadcastId === 'string' ? request.data.broadcastId.trim() : '';
    if (!broadcastId)
        throw new HttpsError('invalid-argument', 'Annonce invalide.');
    const broadcastSnapshot = await db.doc(`broadcastMessages/${broadcastId}`).get();
    if (!broadcastSnapshot.exists)
        throw new HttpsError('not-found', 'Annonce introuvable.');
    const snapshot = await db.collection('notifications').where('broadcastId', '==', broadcastId).get();
    const missingUserIds = new Set();
    const entries = snapshot.docs.map(item => {
        const data = item.data();
        const recipientName = typeof data.recipientName === 'string' && data.recipientName.trim()
            ? data.recipientName.trim()
            : '';
        if (!recipientName && typeof data.userId === 'string')
            missingUserIds.add(data.userId);
        const readAt = data.readAt && typeof data.readAt.toDate === 'function' ? data.readAt.toDate().toISOString() : undefined;
        return {
            userId: String(data.userId ?? ''),
            recipientName,
            read: data.read === true,
            readAt,
        };
    });
    if (missingUserIds.size) {
        const ids = [...missingUserIds];
        const userNames = new Map();
        for (let i = 0; i < ids.length; i += 500) {
            const refs = ids.slice(i, i + 500).map(id => db.doc(`users/${id}`));
            const users = await db.getAll(...refs);
            users.forEach(user => {
                const data = user.data() ?? {};
                userNames.set(user.id, String(data.displayName ?? 'Étudiant').trim() || 'Étudiant');
            });
        }
        entries.forEach(entry => {
            if (!entry.recipientName)
                entry.recipientName = userNames.get(entry.userId) ?? 'Étudiant';
        });
    }
    const readers = entries
        .filter(entry => entry.read)
        .sort((a, b) => (a.recipientName || '').localeCompare(b.recipientName || '', 'fr-FR', { sensitivity: 'base' }));
    return {
        broadcastId,
        recipientCount: entries.length,
        readCount: readers.length,
        unreadCount: Math.max(0, entries.length - readers.length),
        readers,
    };
});
export const adminListBroadcasts = onCall({ region: 'africa-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    await requireBroadcastManager(uid);
    const snapshot = await db.collection('broadcastMessages').orderBy('createdAt', 'desc').limit(50).get();
    return { items: snapshot.docs.map(item => {
            const data = item.data();
            const iso = (value) => value && typeof value.toDate === 'function' ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : undefined;
            return { id: item.id, title: String(data.title ?? ''), message: String(data.message ?? ''), category: String(data.category ?? 'annonce'), audienceType: String(data.audienceType ?? 'all'), targetCourseId: typeof data.targetCourseId === 'string' ? data.targetCourseId : undefined, targetUserId: typeof data.targetUserId === 'string' ? data.targetUserId : undefined, status: String(data.status ?? 'sent'), sendAt: iso(data.sendAt), createdAt: iso(data.createdAt), recipientCount: Number(data.recipientCount ?? 0), createdByName: String(data.createdByName ?? '') };
        }) };
});
export const processScheduledBroadcasts = onSchedule({ region: 'europe-west1', schedule: 'every 5 minutes', timeZone: 'Indian/Antananarivo' }, async () => {
    const snapshot = await db.collection('broadcastMessages').where('status', '==', 'scheduled').where('sendAt', '<=', new Date()).limit(10).get();
    for (const item of snapshot.docs) {
        try {
            await db.runTransaction(async (tx) => {
                const current = await tx.get(item.ref);
                if (!current.exists || current.data()?.status !== 'scheduled')
                    return;
                tx.update(item.ref, { status: 'sending', updatedAt: new Date() });
            });
            await deliverBroadcast(item.id);
        }
        catch (error) {
            console.error(`Broadcast ${item.id} failed`, error);
            await item.ref.update({ status: 'failed', updatedAt: new Date(), errorMessage: error instanceof Error ? error.message : 'Erreur inconnue' });
        }
    }
    // Refresh cached library access here instead of creating a second scheduler.
    // The scheduler for this function already runs in europe-west1, a valid
    // Cloud Scheduler location. This also removes the need for a separate
    // africa-south1 scheduled function.
    try {
        const enrollments = await db.collection('enrollments').get();
        const users = new Map();
        enrollments.docs.forEach(item => {
            const data = item.data();
            const userId = String(data.userId ?? '');
            const courseId = String(data.courseId ?? '');
            if (!userId || !courseId || !isEnrollmentActive(data))
                return;
            const current = users.get(userId) ?? [];
            if (!current.includes(courseId))
                current.push(courseId);
            users.set(userId, current);
        });
        const existingUsers = await db.collection('users').where('role', '==', 'student').get();
        for (let i = 0; i < existingUsers.docs.length; i += 450) {
            const batch = db.batch();
            existingUsers.docs.slice(i, i + 450).forEach(user => {
                batch.set(user.ref, { libraryCourseIds: users.get(user.id) ?? [], updatedAt: new Date() }, { merge: true });
            });
            await batch.commit();
        }
    }
    catch (error) {
        console.error('Library access refresh failed', error);
    }
});
export const setUserRole = onCall({ region: 'africa-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    await requireAdmin(uid);
    const targetUserId = typeof request.data?.userId === 'string' ? request.data.userId : '';
    const role = request.data?.role === 'student' || request.data?.role === 'content_manager'
        ? request.data.role
        : null;
    if (!targetUserId || !role)
        throw new HttpsError('invalid-argument', 'Rôle utilisateur invalide.');
    if (targetUserId === uid)
        throw new HttpsError('failed-precondition', 'Vous ne pouvez pas modifier votre propre rôle.');
    const targetRef = db.doc(`users/${targetUserId}`);
    const targetSnapshot = await targetRef.get();
    if (!targetSnapshot.exists)
        throw new HttpsError('not-found', 'Utilisateur introuvable.');
    const targetProfile = targetSnapshot.data() ?? {};
    if (targetProfile.role === 'super_admin') {
        throw new HttpsError('permission-denied', 'Le rôle d’un super administrateur ne peut pas être modifié ici.');
    }
    await targetRef.update({ role, updatedAt: new Date() });
    return { success: true, userId: targetUserId, role };
});
export const setUserStatus = onCall({ region: 'africa-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    await requireAdmin(uid);
    const targetUserId = typeof request.data?.userId === 'string' ? request.data.userId : '';
    const status = request.data?.status === 'active' || request.data?.status === 'suspended'
        ? request.data.status
        : null;
    if (!targetUserId || !status)
        throw new HttpsError('invalid-argument', 'Statut utilisateur invalide.');
    if (targetUserId === uid)
        throw new HttpsError('failed-precondition', 'Vous ne pouvez pas modifier votre propre statut.');
    const targetRef = db.doc(`users/${targetUserId}`);
    const targetSnapshot = await targetRef.get();
    if (!targetSnapshot.exists)
        throw new HttpsError('not-found', 'Utilisateur introuvable.');
    const targetProfile = targetSnapshot.data() ?? {};
    if (targetProfile.role === 'super_admin') {
        throw new HttpsError('permission-denied', 'Le statut d’un super administrateur ne peut pas être modifié ici.');
    }
    await getAuth().updateUser(targetUserId, { disabled: status === 'suspended' });
    await targetRef.update({ status, updatedAt: new Date() });
    return { success: true, userId: targetUserId, status };
});
export const deleteUserAccount = onCall({ region: 'africa-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    await requireAdmin(uid);
    const targetUserId = typeof request.data?.userId === 'string' ? request.data.userId : '';
    if (!targetUserId)
        throw new HttpsError('invalid-argument', 'Utilisateur invalide.');
    if (targetUserId === uid)
        throw new HttpsError('failed-precondition', 'Vous ne pouvez pas supprimer votre propre compte.');
    const targetRef = db.doc(`users/${targetUserId}`);
    const targetSnapshot = await targetRef.get();
    if (!targetSnapshot.exists)
        throw new HttpsError('not-found', 'Utilisateur introuvable.');
    const targetProfile = targetSnapshot.data() ?? {};
    if (targetProfile.role === 'super_admin') {
        throw new HttpsError('permission-denied', 'Le compte super administrateur ne peut pas être supprimé ici.');
    }
    if (targetProfile.role !== 'student') {
        throw new HttpsError('failed-precondition', 'Cette action est réservée aux comptes étudiants.');
    }
    await getAuth().deleteUser(targetUserId);
    await targetRef.delete();
    return { success: true, userId: targetUserId };
});
async function syncLibraryAccessForUser(userId) {
    if (!userId)
        return;
    const snapshot = await db.collection('enrollments').where('userId', '==', userId).get();
    const courseIds = [...new Set(snapshot.docs
            .filter(item => isEnrollmentActive(item.data()))
            .map(item => String(item.data().courseId ?? ''))
            .filter(Boolean))];
    await db.doc(`users/${userId}`).set({ libraryCourseIds: courseIds, updatedAt: new Date() }, { merge: true });
}
export const syncLibraryAccessOnEnrollmentChange = onDocumentWritten({
    region: 'africa-south1',
    document: 'enrollments/{enrollmentId}',
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const userIds = [...new Set([String(before?.userId ?? ''), String(after?.userId ?? '')].filter(Boolean))];
    await Promise.all(userIds.map(syncLibraryAccessForUser));
});
export const reviewPayment = onCall({ region: 'africa-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    // Content managers can process enrollments/payments; only super admins can manage roles/accounts.
    await requireBroadcastManager(uid);
    const paymentId = typeof request.data?.paymentId === 'string' ? request.data.paymentId : '';
    const approved = request.data?.approved === true;
    const rejectionReason = typeof request.data?.rejectionReason === 'string' ? request.data.rejectionReason.trim() : '';
    if (!paymentId)
        throw new HttpsError('invalid-argument', 'Paiement invalide.');
    if (!approved && !rejectionReason)
        throw new HttpsError('invalid-argument', 'Motif de rejet requis.');
    const paymentRef = db.doc(`payments/${paymentId}`);
    const paymentSnapshot = await paymentRef.get();
    if (!paymentSnapshot.exists)
        throw new HttpsError('not-found', 'Paiement introuvable.');
    const payment = paymentSnapshot.data() ?? {};
    if (payment.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'Ce paiement a déjà été traité.');
    }
    const userId = String(payment.userId ?? '');
    const courseId = String(payment.courseId ?? '');
    const amount = Number(payment.amount ?? -1);
    if (!userId || !courseId || amount < 0) {
        throw new HttpsError('failed-precondition', 'Les données du paiement sont invalides.');
    }
    const courseSnapshot = await db.doc(`courses/${courseId}`).get();
    if (!courseSnapshot.exists || courseSnapshot.data()?.status !== 'published') {
        throw new HttpsError('failed-precondition', 'Le concours associé n’est plus disponible.');
    }
    if (Number(courseSnapshot.data()?.price ?? -1) !== amount) {
        throw new HttpsError('failed-precondition', 'Le montant du paiement ne correspond plus au tarif du concours.');
    }
    const enrollmentId = `${userId}_${courseId}`;
    const enrollmentRef = db.doc(`enrollments/${enrollmentId}`);
    const historyRef = db.doc(`enrollmentHistory/${paymentId}`);
    const courseData = courseSnapshot.data() ?? {};
    const accessDurationDays = Math.max(1, Math.floor(Number(courseData.accessDurationDays ?? 30)));
    const courseTitle = String(courseData.title ?? 'Concours');
    let expiresAt = null;
    let expiresAtIso = null;
    await db.runTransaction(async (transaction) => {
        const freshPayment = await transaction.get(paymentRef);
        if (!freshPayment.exists || freshPayment.data()?.status !== 'pending') {
            throw new HttpsError('failed-precondition', 'Ce paiement a déjà été traité.');
        }
        const currentEnrollment = await transaction.get(enrollmentRef);
        const currentData = currentEnrollment.exists ? currentEnrollment.data() ?? {} : null;
        if (approved && currentData && isEnrollmentActive(currentData)) {
            throw new HttpsError('failed-precondition', 'Cet étudiant dispose déjà d’un accès actif à ce concours.');
        }
        if (approved) {
            const enrolledAt = new Date();
            expiresAt = new Date(enrolledAt.getTime() + accessDurationDays * 24 * 60 * 60 * 1000);
            expiresAtIso = expiresAt.toISOString();
            transaction.set(enrollmentRef, {
                id: enrollmentId,
                userId,
                courseId,
                paymentId,
                status: 'active',
                enrolledAt,
                expiresAt,
                accessDurationDays,
                approvedBy: uid,
                approvedAt: new Date(),
            }, { merge: true });
            transaction.set(historyRef, {
                id: paymentId, userId, courseId, courseTitle,
                status: 'active', enrolledAt, expiresAt, accessDurationDays,
                approvedBy: uid, approvedAt: new Date(),
                createdAt: new Date(),
            });
            const notificationRef = db.collection('notifications').doc();
            transaction.set(notificationRef, {
                userId, courseId, type: 'payment_verified',
                title: 'Paiement confirmé',
                message: `Votre accès à ${courseTitle} est activé pour ${accessDurationDays} jour${accessDurationDays > 1 ? 's' : ''}. Il expire le ${expiresAt.toLocaleDateString('fr-FR')}.`,
                senderName: 'CAV Madagascar', actorName: 'CAV Madagascar', read: false, createdAt: new Date(),
            });
        }
        transaction.update(paymentRef, {
            status: approved ? 'verified' : 'rejected',
            verifiedBy: uid,
            verifiedAt: new Date(),
            rejectionReason: approved ? '' : rejectionReason,
        });
    });
    return { success: true, paymentId, enrollmentId: approved ? enrollmentId : null, status: approved ? 'verified' : 'rejected', expiresAt: expiresAtIso, accessDurationDays };
});
// One active device per student account. `claimDeviceSession` is called by the app
// right after sign-in: it stores the new session id and puts it in the user's token
// as the `sid` claim. A token issued for any older device no longer matches, so the
// student functions below refuse it.
async function assertSingleSession(request) {
    const uid = request.auth?.uid;
    if (!uid)
        return;
    const snapshot = await db.doc(`userSessions/${uid}`).get();
    if (!snapshot.exists)
        return;
    const current = String(snapshot.data()?.sessionId ?? '');
    const tokenSid = String(request.auth?.token?.sid ?? '');
    if (current && tokenSid !== current) {
        throw new HttpsError('failed-precondition', 'Votre compte est connecté sur un autre appareil. Veuillez vous reconnecter.');
    }
}
export const claimDeviceSession = onCall({ region: 'africa-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    const sessionId = typeof request.data?.sessionId === 'string' ? request.data.sessionId : '';
    if (!/^[A-Za-z0-9._-]{16,100}$/.test(sessionId))
        throw new HttpsError('invalid-argument', 'Session invalide.');
    const profileSnapshot = await db.doc(`users/${uid}`).get();
    const profile = profileSnapshot.data() ?? {};
    if (profile.status !== 'active')
        throw new HttpsError('permission-denied', 'Votre compte n’est pas actif.');
    const sessionRef = db.doc(`userSessions/${uid}`);
    // Only student accounts are limited to one device; administrators are not.
    if (profile.role !== 'student') {
        await sessionRef.delete();
        return { enforced: false };
    }
    const auth = getAuth();
    const record = await auth.getUser(uid);
    await auth.setCustomUserClaims(uid, { ...(record.customClaims ?? {}), sid: sessionId });
    await sessionRef.set({
        sessionId,
        claimedAt: new Date(),
        userAgent: String(request.rawRequest?.headers?.['user-agent'] ?? '').slice(0, 300),
    });
    return { enforced: true };
});
// Anti-scraping: a student reading lessons opens a handful per minute. A script that
// copies a whole course opens hundreds. Limits are generous for real students and
// every breach is recorded in `securityEvents` for super admins to review.
const LESSON_LIMIT_PER_MINUTE = 20;
const LESSON_LIMIT_PER_DAY = 200;
async function enforceLessonAccessLimits(uid, courseId, nodeId) {
    const now = Date.now();
    // Day boundary follows Madagascar time (UTC+3).
    const dayKey = new Date(now + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const ref = db.doc(`lessonAccessCounters/${uid}`);
    const outcome = await db.runTransaction(async (tx) => {
        const data = (await tx.get(ref)).data() ?? {};
        const dayCount = (data.dayKey === dayKey ? Number(data.dayCount ?? 0) : 0) + 1;
        const windowStart = Number(data.windowStart ?? 0);
        const inWindow = now - windowStart < 60_000;
        const windowCount = (inWindow ? Number(data.windowCount ?? 0) : 0) + 1;
        const reason = windowCount > LESSON_LIMIT_PER_MINUTE ? 'minute' : dayCount > LESSON_LIMIT_PER_DAY ? 'day' : null;
        const firstBreach = reason === 'minute' ? windowCount === LESSON_LIMIT_PER_MINUTE + 1 : reason === 'day' ? dayCount === LESSON_LIMIT_PER_DAY + 1 : false;
        tx.set(ref, {
            dayKey,
            dayCount,
            windowStart: inWindow ? windowStart : now,
            windowCount,
            lastCourseId: courseId,
            lastNodeId: nodeId,
            lastAccessAt: new Date(now),
            ...(reason ? { flaggedAt: new Date(now), flagCount: FieldValue.increment(firstBreach ? 1 : 0) } : {}),
        }, { merge: true });
        return { reason, firstBreach, dayCount, windowCount };
    });
    if (outcome.firstBreach) {
        await db.collection('securityEvents').add({
            type: 'lesson_access_rate_limit',
            reason: outcome.reason,
            userId: uid,
            courseId,
            nodeId,
            dayCount: outcome.dayCount,
            windowCount: outcome.windowCount,
            createdAt: new Date(now),
        });
    }
    if (outcome.reason) {
        throw new HttpsError('resource-exhausted', 'Trop de leçons ouvertes en peu de temps. Veuillez patienter quelques instants.');
    }
}
export const getStudentLessonContent = onCall({ region: 'africa-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    await assertSingleSession(request);
    const courseId = typeof request.data?.courseId === 'string' ? request.data.courseId : '';
    const nodeId = typeof request.data?.nodeId === 'string' ? request.data.nodeId : '';
    if (!courseId || !nodeId)
        throw new HttpsError('invalid-argument', 'Préparation ou leçon invalide.');
    const profileSnapshot = await db.doc(`users/${uid}`).get();
    if (!profileSnapshot.exists || profileSnapshot.data()?.status !== 'active') {
        throw new HttpsError('permission-denied', 'Votre compte n’est pas actif.');
    }
    // Do not rely on the enrollment document ID. Older/manual enrollments may have
    // a different document ID even though the enrollment itself is valid.
    const enrollmentSnapshot = await db.collection('enrollments')
        .where('userId', '==', uid)
        .where('courseId', '==', courseId)
        .where('status', '==', 'active')
        .limit(1)
        .get();
    if (!enrollmentSnapshot.docs.some(item => isEnrollmentActive(item.data()))) {
        throw new HttpsError('permission-denied', 'Votre accès à ce concours n’est pas actif.');
    }
    await enforceLessonAccessLimits(uid, courseId, nodeId);
    const nodeSnapshot = await db.doc(`contentNodes/${nodeId}`).get();
    if (!nodeSnapshot.exists || nodeSnapshot.data()?.status !== 'published') {
        throw new HttpsError('not-found', 'Leçon introuvable.');
    }
    const node = nodeSnapshot.data() ?? {};
    const courseSubjectId = typeof node.courseSubjectId === 'string' ? node.courseSubjectId : '';
    const subjectId = typeof node.subjectId === 'string' ? node.subjectId : '';
    let allowed = false;
    if (courseSubjectId) {
        const associationSnapshot = await db.doc(`courseSubjects/${courseSubjectId}`).get();
        const association = associationSnapshot.data() ?? {};
        allowed = associationSnapshot.exists &&
            association.courseId === courseId &&
            association.status === 'published';
    }
    else if (subjectId) {
        const associationSnapshot = await db.collection('courseSubjects')
            .where('courseId', '==', courseId)
            .where('subjectId', '==', subjectId)
            .where('status', '==', 'published')
            .limit(1)
            .get();
        allowed = !associationSnapshot.empty;
    }
    if (!allowed)
        throw new HttpsError('permission-denied', 'Cette leçon n’appartient pas à votre préparation.');
    const blocksSnapshot = await db.collection('contentBlocks')
        .where('nodeId', '==', nodeId)
        .where('status', '==', 'published')
        .get();
    const blocks = blocksSnapshot.docs
        .map(snapshot => {
        const data = snapshot.data() ?? {};
        return {
            id: snapshot.id,
            nodeId,
            type: data.type ?? 'text',
            order: Number(data.order ?? 0),
            content: data.content ?? {},
            media: data.media ?? null,
            settings: data.settings ?? null,
        };
    })
        .sort((a, b) => a.order - b.order);
    return { nodeId, blocks };
});
export const getStudentPracticeSets = onCall({ region: 'africa-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    await assertSingleSession(request);
    const courseId = typeof request.data?.courseId === 'string' ? request.data.courseId : '';
    if (!courseId)
        throw new HttpsError('invalid-argument', 'Préparation invalide.');
    const profileSnapshot = await db.doc(`users/${uid}`).get();
    if (!profileSnapshot.exists || profileSnapshot.data()?.status !== 'active') {
        throw new HttpsError('permission-denied', 'Votre compte n’est pas actif.');
    }
    const enrollmentSnapshot = await db.doc(`enrollments/${uid}_${courseId}`).get();
    if (!enrollmentSnapshot.exists || !isEnrollmentActive(enrollmentSnapshot.data() ?? {})) {
        throw new HttpsError('permission-denied', 'Votre accès à ce concours n’est pas actif.');
    }
    const associationsSnapshot = await db.collection('courseSubjects')
        .where('courseId', '==', courseId)
        .where('status', '==', 'published')
        .get();
    const subjectIds = [...new Set(associationsSnapshot.docs
            .map(snapshot => String(snapshot.data().subjectId ?? ''))
            .filter(Boolean))];
    const groups = await Promise.all(subjectIds.map(async (subjectId) => {
        const snapshot = await db.collection('questionSets')
            .where('subjectId', '==', subjectId)
            .where('status', '==', 'published')
            .get();
        return snapshot.docs
            .map(item => {
            const data = item.data() ?? {};
            return {
                id: item.id,
                title: String(data.title ?? ''),
                description: String(data.description ?? ''),
                questions: Array.isArray(data.questions) ? data.questions : [],
                subjectId,
                type: String(data.type ?? 'practice'),
                settings: data.settings ?? null,
                status: 'published',
            };
        })
            .filter(item => ['practice', 'exercise', 'quiz', 'important_questions'].includes(item.type));
    }));
    return {
        sets: groups.flat().sort((a, b) => a.title.localeCompare(b.title, 'fr')),
    };
});
export const submitPsychotechnicalTest = onCall({ region: 'africa-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    await assertSingleSession(request);
    const profile = await db.doc(`users/${uid}`).get();
    if (!profile.exists || profile.data()?.status !== 'active')
        throw new HttpsError('permission-denied', 'Votre compte n’est pas actif.');
    const testId = typeof request.data?.testId === 'string' ? request.data.testId : '';
    const courseId = typeof request.data?.courseId === 'string' ? request.data.courseId : '';
    const rawAnswers = Array.isArray(request.data?.answers) ? request.data.answers : [];
    const durationSeconds = Math.max(0, Number(request.data?.durationSeconds ?? 0));
    if (!testId || !courseId)
        throw new HttpsError('invalid-argument', 'Test ou concours invalide.');
    const enrollment = await db.collection('enrollments').where('userId', '==', uid).where('courseId', '==', courseId).where('status', '==', 'active').limit(10).get();
    if (!enrollment.docs.some(item => isEnrollmentActive(item.data())))
        throw new HttpsError('permission-denied', 'Votre accès à ce concours n’est pas actif.');
    const testSnapshot = await db.doc(`psychotechnicalTests/${testId}`).get();
    if (!testSnapshot.exists || testSnapshot.data()?.status !== 'published')
        throw new HttpsError('not-found', 'Test introuvable.');
    const test = testSnapshot.data() ?? {};
    const assignedCourses = Array.isArray(test.courseIds) ? test.courseIds.map(String) : [];
    if (!assignedCourses.includes(courseId))
        throw new HttpsError('permission-denied', 'Ce test n’est pas associé à ce concours.');
    const allQuestionIds = Array.isArray(test.questionIds) ? test.questionIds.map(String) : [];
    if (!allQuestionIds.length)
        throw new HttpsError('failed-precondition', 'Ce test ne contient aucune question.');
    const requestedQuestionIds = Array.isArray(request.data?.questionIds)
        ? request.data.questionIds.map((id) => String(id))
        : allQuestionIds;
    const questionIds = [...new Set(requestedQuestionIds)].filter((id) => allQuestionIds.includes(id));
    if (!questionIds.length)
        throw new HttpsError('invalid-argument', 'Aucune question valide à corriger.');
    const answerMap = new Map();
    for (const item of rawAnswers)
        if (item && typeof item === 'object' && typeof item.questionId === 'string')
            answerMap.set(item.questionId, item.answer);
    const snapshots = await Promise.all(questionIds.map(id => db.doc(`psychotechnicalQuestions/${id}`).get()));
    let earnedPoints = 0, totalPoints = 0;
    const domainTotals = {};
    const results = {};
    const eq = (a, b, type) => {
        if (a === null || a === undefined || String(a).trim() === '')
            return false;
        if (type === 'numeric') {
            const actual = Number(a), expected = Number(b);
            return Number.isFinite(actual) && Number.isFinite(expected) && actual === expected;
        }
        if (type === 'true_false')
            return typeof b === 'boolean' ? a === b : String(a).toLowerCase() === String(b).toLowerCase();
        return String(a).trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
    };
    snapshots.forEach((snap, i) => { if (!snap.exists)
        return; const q = snap.data() ?? {}; const id = questionIds[i]; const points = Math.max(1, Number(q.points ?? 1)); const domain = String(q.domain ?? 'logic'); domainTotals[domain] ??= { earned: 0, total: 0 }; domainTotals[domain].total += points; totalPoints += points; const correct = eq(answerMap.get(id), q.correctAnswer, String(q.type ?? '')); results[id] = correct; if (correct) {
        earnedPoints += points;
        domainTotals[domain].earned += points;
    } });
    const percentage = totalPoints ? Math.round(earnedPoints / totalPoints * 100) : 0;
    const domainResults = Object.fromEntries(Object.entries(domainTotals).map(([d, v]) => [d, { ...v, percentage: v.total ? Math.round(v.earned / v.total * 100) : 0 }]));
    const attempt = await db.collection('psychotechnicalAttempts').add({ userId: uid, testId, courseId, answers: questionIds.map(questionId => ({ questionId, answer: answerMap.get(questionId) ?? null })), earnedPoints, totalPoints, percentage, domainResults, durationSeconds, submittedAt: new Date() });
    return { attemptId: attempt.id, earnedPoints, totalPoints, percentage, domainResults, results };
});
export const submitPractice = onCall({ region: 'africa-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    await assertSingleSession(request);
    const profileSnapshot = await db.doc(`users/${uid}`).get();
    if (!profileSnapshot.exists || profileSnapshot.data()?.status !== 'active') {
        throw new HttpsError('permission-denied', 'Votre compte n’est pas actif.');
    }
    const setId = typeof request.data?.setId === 'string' ? request.data.setId : '';
    const rawAnswers = Array.isArray(request.data?.answers) ? request.data.answers : [];
    if (!setId)
        throw new HttpsError('invalid-argument', 'Entraînement invalide.');
    const setSnapshot = await db.doc(`questionSets/${setId}`).get();
    if (!setSnapshot.exists)
        throw new HttpsError('not-found', 'Entraînement introuvable.');
    const set = setSnapshot.data() ?? {};
    if (set.status !== 'published' || !['practice', 'exercise', 'quiz'].includes(String(set.type ?? '')))
        throw new HttpsError('failed-precondition', 'Cette évaluation n’est pas disponible.');
    let courseId = String(set.courseId ?? '');
    if (courseId) {
        const enrollmentSnapshot = await db.collection('enrollments')
            .where('userId', '==', uid)
            .where('courseId', '==', courseId)
            .where('status', '==', 'active')
            .limit(1)
            .get();
        if (!enrollmentSnapshot.docs.some(item => isEnrollmentActive(item.data())))
            throw new HttpsError('permission-denied', 'Votre accès à ce concours n’est pas actif.');
    }
    else {
        const subjectId = String(set.subjectId ?? '');
        const enrollments = await db.collection('enrollments').where('userId', '==', uid).where('status', '==', 'active').get();
        let matchedCourseId = '';
        for (const enrollment of enrollments.docs) {
            if (!isEnrollmentActive(enrollment.data()))
                continue;
            const association = await db.collection('courseSubjects').where('courseId', '==', String(enrollment.data().courseId ?? '')).where('subjectId', '==', subjectId).where('status', '==', 'published').limit(1).get();
            if (!association.empty) {
                matchedCourseId = String(enrollment.data().courseId ?? '');
                break;
            }
        }
        if (!matchedCourseId)
            throw new HttpsError('permission-denied', 'Votre accès à cette Matière n’est pas actif.');
        courseId = matchedCourseId;
    }
    const questionIds = Array.isArray(set.questionIds) ? set.questionIds.map(String) : [];
    if (questionIds.length === 0)
        throw new HttpsError('failed-precondition', 'Cet entraînement ne contient aucune question.');
    const answerMap = new Map();
    for (const item of rawAnswers) {
        if (item && typeof item === 'object' && typeof item.questionId === 'string')
            answerMap.set(item.questionId, item.answer);
    }
    const questionSnapshots = await Promise.all(questionIds.map(id => db.doc(`questions/${id}`).get()));
    let earnedPoints = 0;
    let totalPoints = 0;
    let pendingManualCount = 0;
    const results = {};
    questionSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists)
            return;
        const question = snapshot.data() ?? {};
        const type = String(question.type ?? '');
        const points = Math.max(1, Number(question.points ?? 1));
        if (type === 'written') {
            pendingManualCount += 1;
            return;
        }
        totalPoints += points;
        const correct = answerIsCorrect(type, answerMap.get(questionIds[index]), question.correctAnswer);
        results[questionIds[index]] = correct;
        if (correct)
            earnedPoints += points;
    });
    const percentage = totalPoints === 0 ? 0 : Math.round((earnedPoints / totalPoints) * 100);
    const attemptRef = await db.collection('practiceAttempts').add({
        userId: uid,
        courseId,
        questionSetId: setId,
        answers: questionIds.map(questionId => ({ questionId, answer: answerMap.get(questionId) ?? null })),
        earnedPoints,
        totalPoints,
        percentage,
        pendingManualCount,
        submittedAt: new Date(),
    });
    return { attemptId: attemptRef.id, earnedPoints, totalPoints, percentage, pendingManualCount, results };
});
export const submitLessonQuestions = onCall({ region: 'africa-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    await assertSingleSession(request);
    const profileSnapshot = await db.doc(`users/${uid}`).get();
    if (!profileSnapshot.exists || profileSnapshot.data()?.status !== 'active') {
        throw new HttpsError('permission-denied', 'Votre compte n’est pas actif.');
    }
    const lessonId = typeof request.data?.lessonId === 'string' ? request.data.lessonId : '';
    const courseId = typeof request.data?.courseId === 'string' ? request.data.courseId : '';
    const rawAnswers = Array.isArray(request.data?.answers) ? request.data.answers : [];
    if (!lessonId || !courseId)
        throw new HttpsError('invalid-argument', 'Leçon invalide.');
    const enrollmentSnapshot = await db.collection('enrollments')
        .where('userId', '==', uid)
        .where('courseId', '==', courseId)
        .where('status', '==', 'active')
        .limit(1)
        .get();
    if (!enrollmentSnapshot.docs.some(item => isEnrollmentActive(item.data())))
        throw new HttpsError('permission-denied', 'Votre accès à ce concours n’est pas actif.');
    const lessonSnapshot = await db.doc(`contentNodes/${lessonId}`).get();
    if (!lessonSnapshot.exists || lessonSnapshot.data()?.status !== 'published') {
        throw new HttpsError('not-found', 'Cette leçon n’est pas disponible.');
    }
    const answerMap = new Map();
    for (const item of rawAnswers) {
        if (item && typeof item === 'object' && typeof item.questionId === 'string')
            answerMap.set(item.questionId, item.answer);
    }
    const questionSnapshot = await db.collection('questions')
        .where('contentNodeId', '==', lessonId)
        .where('status', '==', 'published')
        .get();
    let earnedPoints = 0;
    let totalPoints = 0;
    let pendingManualCount = 0;
    const results = {};
    const submittedAnswers = [];
    questionSnapshot.docs.forEach(snapshot => {
        const question = snapshot.data() ?? {};
        const type = String(question.type ?? '');
        const points = Math.max(1, Number(question.points ?? 1));
        const answer = answerMap.get(snapshot.id);
        submittedAnswers.push({ questionId: snapshot.id, answer: answer ?? null });
        if (type === 'written') {
            pendingManualCount += 1;
            return;
        }
        totalPoints += points;
        const correct = answerIsCorrect(type, answer, question.correctAnswer);
        results[snapshot.id] = correct;
        if (correct)
            earnedPoints += points;
    });
    const percentage = totalPoints === 0 ? 0 : Math.round((earnedPoints / totalPoints) * 100);
    const attemptRef = await db.collection('lessonAttempts').add({
        userId: uid,
        courseId,
        lessonId,
        answers: submittedAnswers,
        earnedPoints,
        totalPoints,
        percentage,
        pendingManualCount,
        submittedAt: new Date(),
    });
    return { attemptId: attemptRef.id, earnedPoints, totalPoints, percentage, pendingManualCount, results };
});
export const notifyLessonCommentParticipants = onDocumentCreated({ region: 'africa-south1', document: 'lessonComments/{commentId}' }, async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
    const comment = snapshot.data() ?? {};
    const authorId = String(comment.userId ?? '');
    const parentId = typeof comment.parentCommentId === 'string' ? comment.parentCommentId : '';
    if (!authorId || !parentId)
        return;
    const parentSnapshot = await db.doc(`lessonComments/${parentId}`).get();
    if (!parentSnapshot.exists)
        return;
    const parent = parentSnapshot.data() ?? {};
    const recipientId = String(parent.userId ?? '');
    if (!recipientId || recipientId === authorId)
        return;
    const actorName = String(comment.studentName ?? 'Un étudiant');
    const lessonTitle = String(comment.lessonTitle ?? 'cette leçon');
    await db.collection('notifications').add({
        userId: recipientId,
        type: 'lesson_comment_reply',
        message: `${actorName} a répondu à votre commentaire dans « ${lessonTitle} »`,
        actorUserId: authorId,
        actorName,
        lessonId: String(comment.lessonId ?? ''),
        courseId: String(comment.courseId ?? ''),
        commentId: snapshot.id,
        read: false,
        createdAt: new Date(),
    });
});
// Google Cloud billing data is queried server-side only. The export table must be
// configured by the project owner; no billing credentials are exposed to the client.
export const adminGetGoogleBillingSummary = onCall({ region: 'africa-south1', timeoutSeconds: 60 }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Connexion requise.');
    await requireBroadcastManager(uid);
    const table = String(process.env.BILLING_EXPORT_TABLE ?? '').trim();
    const month = new Date().toISOString().slice(0, 7);
    if (!table)
        return { configured: false, month, message: 'Export de facturation BigQuery non configuré.' };
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_]+$/.test(table)) {
        throw new HttpsError('failed-precondition', 'BILLING_EXPORT_TABLE doit être au format projet.dataset.table.');
    }
    try {
        const tokenResponse = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', { headers: { 'Metadata-Flavor': 'Google' } });
        if (!tokenResponse.ok)
            throw new Error('Could not obtain runtime service account token');
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
        if (!projectId)
            throw new Error('Google Cloud project ID is not available');
        const location = process.env.BILLING_BIGQUERY_LOCATION || 'US';
        const runQuery = async (query, params) => {
            const response = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`, {
                method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, useLegacySql: false, location, parameterMode: 'NAMED', queryParameters: Object.entries(params ?? {}).map(([name, value]) => ({ name, parameterType: { type: 'STRING' }, parameterValue: { value } })) }),
            });
            if (!response.ok)
                throw new Error(`BigQuery API returned HTTP ${response.status}`);
            let result = await response.json();
            while (!result.jobComplete && result.jobReference?.jobId) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const poll = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries/${result.jobReference.jobId}?location=${encodeURIComponent(result.jobReference.location || location)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
                if (!poll.ok)
                    throw new Error(`BigQuery query polling returned HTTP ${poll.status}`);
                result = await poll.json();
            }
            const fields = result.schema?.fields?.map(field => field.name) ?? [];
            return (result.rows ?? []).map(row => Object.fromEntries(fields.map((field, index) => [field, row.f[index]?.v ?? null])));
        };
        const sql = `
      SELECT FORMAT_DATE('%Y-%m', DATE(usage_start_time)) AS month,
        COALESCE(currency, 'USD') AS currency,
        SUM(cost + IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) AS credit), 0)) AS amount
      FROM \`${table}\`
      WHERE DATE(usage_start_time) >= DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 1 MONTH)
        AND DATE(usage_start_time) < DATE_ADD(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 1 MONTH)
      GROUP BY month, currency
    `;
        const rows = await runQuery(sql);
        const currency = String(rows[0]?.currency ?? 'USD');
        const currentMonth = rows.filter(r => r.month === month).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
        const previousMonthDate = new Date();
        previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth() - 1);
        const previousMonthKey = previousMonthDate.toISOString().slice(0, 7);
        const previousMonth = rows.filter(r => r.month === previousMonthKey).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
        const serviceSql = `
      SELECT service.description AS service, COALESCE(currency, 'USD') AS currency,
        SUM(cost + IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) AS credit), 0)) AS amount
      FROM \`${table}\`
      WHERE FORMAT_DATE('%Y-%m', DATE(usage_start_time)) = @month
      GROUP BY service, currency ORDER BY amount DESC LIMIT 10
    `;
        const serviceRows = await runQuery(serviceSql, { month });
        const dailySql = `
      SELECT FORMAT_DATE('%Y-%m-%d', DATE(usage_start_time)) AS day,
        COALESCE(currency, 'USD') AS currency,
        SUM(cost + IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) AS credit), 0)) AS amount
      FROM \`${table}\`
      WHERE FORMAT_DATE('%Y-%m', DATE(usage_start_time)) = @month
      GROUP BY day, currency ORDER BY day
    `;
        const dailyRows = await runQuery(dailySql, { month });
        return {
            configured: true, month, currency, currentMonth, previousMonth,
            services: serviceRows.map(r => ({ service: String(r.service ?? 'Autre service'), amount: Number(r.amount ?? 0), currency: String(r.currency ?? currency) })),
            daily: dailyRows.map(r => ({ date: String(r.day ?? ''), amount: Number(r.amount ?? 0) })),
            lastUpdated: new Date().toISOString(),
        };
    }
    catch (error) {
        console.error('Google billing query failed', error);
        throw new HttpsError('failed-precondition', 'Les données de facturation ne sont pas accessibles. Vérifiez l’export BigQuery et les autorisations du compte de service.');
    }
});
