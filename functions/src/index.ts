/**
 * functions/src/index.ts
 *
 * Firebase Cloud Functions v2 — HORA
 *
 * DEPLOY:
 *   cd functions && npm install && cd ..
 *   firebase deploy --only functions
 *
 * LOGS:
 *   firebase functions:log
 *
 * ─── Triggers ────────────────────────────────────────────────────────────────
 *
 *  onFriendshipCreated   /friendships/{id}  onCreate
 *    → friend_request FCM to the recipient
 *
 *  onFriendshipUpdated   /friendships/{id}  onUpdate
 *    → request_accepted FCM to the original requester (pending→accepted only)
 *
 *  onUserOnlineChanged   /users/{uid}       onUpdate
 *    → friend_online / friend_offline FCM fan-out to non-ghosted friends
 *      Ghost rule: if friendX has uid in their ghosted_by, skip friendX
 *
 *  onMatchCreated        /matches/{id}      onCreate
 *    → match_initiated FCM to target  ("@user wants to match!")
 *    → match_initiated FCM to initiator ("You sent a match request")
 *
 *  onMatchUpdated        /matches/{id}      onUpdate
 *    → matched FCM to both parties when status flips pending → accepted
 *    → also writes full contact details into the match doc so the client
 *      can display them without extra reads
 *
 *  checkExpiredOnline    schedule every 15 min
 *    → auto-offline users whose onlineUntil has passed
 *    → fan-out friend_offline to their non-ghosted friends
 *
 * ─── Firestore schema (relevant fields) ─────────────────────────────────────
 *
 *  /users/{uid}
 *    uid, username, fcmToken?, isOnline, onlineUntil?,
 *    notificationsEnabled?, phone?, instagram_username?, profile?
 *
 *  /friendships/{uid_uid}
 *    uid1, uid2, status, requester_uid, ghosted_by[]
 *
 *  /matches/{matchId}
 *    initiator_uid, target_uid, status ('pending'|'accepted')
 *    created_at
 *    — written by Cloud Function on status=accepted: —
 *    initiator_username, initiator_phone?, initiator_instagram?, initiator_profile?
 *    target_username,    target_phone?,    target_instagram?,    target_profile?
 */

import { initializeApp }    from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMessaging }     from 'firebase-admin/messaging';
import {
    onDocumentCreated,
    onDocumentUpdated,
} from 'firebase-functions/v2/firestore';
import { onSchedule }       from 'firebase-functions/v2/scheduler';
import { logger }           from 'firebase-functions/v2';

// ─── Init ─────────────────────────────────────────────────────────────────────

initializeApp();

const db  = getFirestore();
const fcm = getMessaging();

// ─── IMPORTANT: set this to your Firestore database region ───────────────────
// Find it: Firebase Console → Firestore → (default) → location label
// Common values: 'us-central1', 'europe-west1', 'asia-south1'
const REGION = 'us-central1';

// ─── Types ────────────────────────────────────────────────────────────────────

type FriendshipStatus = 'pending' | 'accepted';
type MatchStatus      = 'pending' | 'accepted';

interface Friendship {
    uid1:          string;
    uid2:          string;
    status:        FriendshipStatus;
    requester_uid: string;
    ghosted_by:    string[];
}

interface UserDoc {
    uid:                    string;
    username:               string;
    fcmToken?:              string;
    isOnline?:              boolean;
    onlineUntil?:           FirebaseFirestore.Timestamp;
    notificationsEnabled?:  boolean;  // absent = true (default on)
    phone?:                 string;
    instagram_username?:    string;
    profile?:               string;   // avatar URL or image key
}

interface MatchDoc {
    initiator_uid: string;
    target_uid:    string;
    status:        MatchStatus;
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

async function getUser(uid: string): Promise<UserDoc | null> {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    return snap.data() as UserDoc;
}

/**
 * notificationsEnabled is absent on existing users → default true.
 * Only false when the user has explicitly disabled it.
 */
function canNotify(user: UserDoc): boolean {
    return user.notificationsEnabled !== false;
}

/**
 * Sends one FCM message. Never throws — a stale/invalid token must
 * never crash the function or block other sends.
 */
async function sendOne(
    token: string,
    title: string,
    body:  string,
    data:  Record<string, string>,
): Promise<void> {
    try {
        const id = await fcm.send({
            token,
            notification: { title, body },
            data,
            apns: {
                payload: { aps: { sound: 'default', badge: 1 } },
            },
            android: {
                priority: 'high',
                notification: { sound: 'default' },
            },
        });
        logger.info('[FCM] sent', { id, type: data.type, token: token.slice(-8) });
    } catch (err: any) {
        logger.warn('[FCM] failed', { code: err?.code, type: data.type, token: token.slice(-8) });
    }
}

async function sendMany(
    tokens: string[],
    title:  string,
    body:   string,
    data:   Record<string, string>,
): Promise<void> {
    if (tokens.length === 0) return;
    await Promise.all(tokens.map(t => sendOne(t, title, body, data)));
}

/**
 * Returns the FCM tokens of all accepted friends of `uid` who should
 * receive an online/offline notification.
 *
 * Ghost rule (online/offline only):
 *   ghosted_by[] stores the uids of people who chose to ghost.
 *   "FriendX ghosted me" means myUid is in that friendship's ghosted_by[].
 *   If friendX put me in ghosted_by, they don't want to see me → skip them.
 */
async function getEligibleFriendTokens(myUid: string): Promise<string[]> {
    const [snap1, snap2] = await Promise.all([
        db.collection('friendships').where('uid1', '==', myUid).where('status', '==', 'accepted').get(),
        db.collection('friendships').where('uid2', '==', myUid).where('status', '==', 'accepted').get(),
    ]);

    const friendships = [...snap1.docs, ...snap2.docs].map(d => d.data() as Friendship);
    if (friendships.length === 0) return [];

    // A friend is eligible if they have NOT ghosted me.
    // ghosted_by contains the uid of whoever pressed "Ghost".
    // "FriendX ghosted me" ⟺ friendX's uid is in ghosted_by AND friendX is uid1 or uid2.
    // Simpler: if myUid appears in ghosted_by, the person who ghosted is whoever
    // is NOT myUid in that friendship — but actually ghosted_by stores the ghoster's uid.
    // toggleGhost(friendshipId, myUid, true) → arrayUnion(myUid) into ghosted_by.
    // So ghosted_by contains the uid of the person who CHOSE TO GHOST the other.
    // "FriendX ghosted me" means friendX.uid is in ghosted_by.
    // We want to skip friendX if friendX ghosted me → skip if friendXUid ∈ ghosted_by.
    const eligibleUids = friendships
        .filter(f => {
            const friendUid  = f.uid1 === myUid ? f.uid2 : f.uid1;
            const ghosted_by = f.ghosted_by ?? [];
            // Skip this friend if THEY ghosted me (their uid is in ghosted_by)
            return !ghosted_by.includes(friendUid);
        })
        .map(f => (f.uid1 === myUid ? f.uid2 : f.uid1));

    if (eligibleUids.length === 0) return [];

    // Batch-fetch user docs — Firestore 'in' limit is 30
    const chunks: string[][] = [];
    for (let i = 0; i < eligibleUids.length; i += 30) {
        chunks.push(eligibleUids.slice(i, i + 30));
    }

    const userDocs = (
        await Promise.all(chunks.map(c => db.collection('users').where('uid', 'in', c).get()))
    ).flatMap(s => s.docs.map(d => d.data() as UserDoc));

    return userDocs
        .filter(u => canNotify(u))
        .map(u => u.fcmToken)
        .filter((t): t is string => Boolean(t));
}

// ─── 1. Friend request ────────────────────────────────────────────────────────

export const onFriendshipCreated = onDocumentCreated(
    { document: 'friendships/{docId}', region: REGION },
    async event => {
        const f = event.data?.data() as Friendship | undefined;
        if (!f || f.status !== 'pending') return;

        const recipientUid = f.uid1 === f.requester_uid ? f.uid2 : f.uid1;

        const [requester, recipient] = await Promise.all([
            getUser(f.requester_uid),
            getUser(recipientUid),
        ]);

        logger.info('[onFriendshipCreated]', {
            requesterUid: f.requester_uid,
            recipientUid,
            hasToken:     !!recipient?.fcmToken,
            canNotify:    recipient ? canNotify(recipient) : false,
        });

        if (!requester || !recipient?.fcmToken || !canNotify(recipient)) return;

        await sendOne(
            recipient.fcmToken,
            'New friend request 👋',
            `@${requester.username} wants to connect with you.`,
            { type: 'friend_request', friendUid: requester.uid },
        );
    },
);

// ─── 2. Friend request accepted ───────────────────────────────────────────────

export const onFriendshipUpdated = onDocumentUpdated(
    { document: 'friendships/{docId}', region: REGION },
    async event => {
        const before = event.data?.before.data() as Friendship | undefined;
        const after  = event.data?.after.data()  as Friendship | undefined;
        if (!before || !after) return;

        // Only the pending → accepted transition
        if (before.status !== 'pending' || after.status !== 'accepted') return;

        const accepterUid = after.uid1 === after.requester_uid ? after.uid2 : after.uid1;

        const [requester, accepter] = await Promise.all([
            getUser(after.requester_uid),
            getUser(accepterUid),
        ]);

        logger.info('[onFriendshipUpdated]', {
            requesterUid: after.requester_uid,
            accepterUid,
            hasToken:     !!requester?.fcmToken,
            canNotify:    requester ? canNotify(requester) : false,
        });

        if (!requester?.fcmToken || !canNotify(requester) || !accepter) return;

        await sendOne(
            requester.fcmToken,
            'Friend request accepted ✅',
            `@${accepter.username} accepted your friend request.`,
            { type: 'request_accepted', friendUid: accepter.uid },
        );
    },
);

// ─── 3. Online / offline fan-out ──────────────────────────────────────────────

export const onUserOnlineChanged = onDocumentUpdated(
    { document: 'users/{uid}', region: REGION },
    async event => {
        const before = event.data?.before.data() as UserDoc | undefined;
        const after  = event.data?.after.data()  as UserDoc | undefined;
        if (!before || !after) return;

        // Only when isOnline actually flipped
        if (before.isOnline === after.isOnline) return;

        const myUid    = event.params.uid;
        const isOnline = after.isOnline === true;
        const username = after.username ?? 'Someone';

        const tokens = await getEligibleFriendTokens(myUid);

        logger.info('[onUserOnlineChanged]', { myUid, isOnline, tokens: tokens.length });

        if (tokens.length === 0) return;

        await sendMany(
            tokens,
            isOnline ? `${username} is online 🟢` : `${username} went offline`,
            isOnline
                ? `@${username} just came online. Say hi! 👋`
                : `@${username} is no longer available.`,
            { type: isOnline ? 'friend_online' : 'friend_offline', friendUid: myUid },
        );
    },
);

// ─── 4. Match initiated ───────────────────────────────────────────────────────
//
// Fires when a new /matches doc is created (status: 'pending').
// Notifies the TARGET that someone wants to match.
// Notifies the INITIATOR that their request was sent.

export const onMatchCreated = onDocumentCreated(
    { document: 'matches/{matchId}', region: REGION },
    async event => {
        const match = event.data?.data() as MatchDoc | undefined;
        if (!match || match.status !== 'pending') return;

        const matchId = event.params.matchId;

        const [initiator, target] = await Promise.all([
            getUser(match.initiator_uid),
            getUser(match.target_uid),
        ]);

        logger.info('[onMatchCreated]', {
            initiatorUid: match.initiator_uid,
            targetUid:    match.target_uid,
            matchId,
        });

        const sends: Promise<void>[] = [];

        // Notify target: "someone wants to match with you"
        if (target?.fcmToken && canNotify(target) && initiator) {
            sends.push(sendOne(
                target.fcmToken,
                '💌 Someone wants to match!',
                `@${initiator.username} sent you a match request.`,
                { type: 'match_initiated', matchId, friendUid: initiator.uid },
            ));
        }

        // Notify initiator: confirmation their request was sent
        if (initiator?.fcmToken && canNotify(initiator) && target) {
            sends.push(sendOne(
                initiator.fcmToken,
                '✅ Match request sent',
                `Your match request was sent to @${target.username}.`,
                { type: 'match_initiated', matchId, friendUid: target.uid },
            ));
        }

        await Promise.all(sends);
    },
);

// ─── 5. Match accepted (both matched) ────────────────────────────────────────
//
// Fires when the match doc flips status: pending → accepted.
// Writes full contact info into the match doc so the client can
// display it on the MatchedScreen without additional reads.
// Then notifies both parties.

export const onMatchUpdated = onDocumentUpdated(
    { document: 'matches/{matchId}', region: REGION },
    async event => {
        const before = event.data?.before.data() as MatchDoc | undefined;
        const after  = event.data?.after.data()  as MatchDoc | undefined;
        if (!before || !after) return;

        // Only the pending → accepted transition
        if (before.status !== 'pending' || after.status !== 'accepted') return;

        const matchId = event.params.matchId;

        const [initiator, target] = await Promise.all([
            getUser(after.initiator_uid),
            getUser(after.target_uid),
        ]);

        logger.info('[onMatchUpdated]', {
            initiatorUid: after.initiator_uid,
            targetUid:    after.target_uid,
            matchId,
        });

        if (!initiator || !target) return;

        // Write contact details into the match doc.
        // The MatchedScreen reads /matches/{matchId} and renders from these fields.
        // We write both sides so either party can read their counterpart's info.
        const contactUpdate: Record<string, string | null> = {
            initiator_username:  initiator.username,
            initiator_phone:     initiator.phone    ?? null,
            initiator_instagram: initiator.instagram_username ?? null,
            initiator_profile:   initiator.profile  ?? null,
            target_username:     target.username,
            target_phone:        target.phone        ?? null,
            target_instagram:    target.instagram_username    ?? null,
            target_profile:      target.profile      ?? null,
        };

        // Strip nulls — Firestore doesn't need null fields
        const cleanUpdate = Object.fromEntries(
            Object.entries(contactUpdate).filter(([, v]) => v !== null),
        );

        await event.data!.after.ref.update(cleanUpdate);

        // Notify both
        const sends: Promise<void>[] = [];

        if (initiator.fcmToken && canNotify(initiator)) {
            sends.push(sendOne(
                initiator.fcmToken,
                "It's a match! 🎉",
                `@${target.username} matched with you! Check their details.`,
                { type: 'matched', matchId, friendUid: target.uid },
            ));
        }

        if (target.fcmToken && canNotify(target)) {
            sends.push(sendOne(
                target.fcmToken,
                "It's a match! 🎉",
                `@${initiator.username} matched with you! Check their details.`,
                { type: 'matched', matchId, friendUid: initiator.uid },
            ));
        }

        await Promise.all(sends);
    },
);

// ─── 6. Scheduled: auto-expire online sessions ───────────────────────────────
//
// Runs every 15 minutes.
// Finds users where isOnline=true AND onlineUntil <= now.
// Sets them offline and fans out friend_offline to non-ghosted friends.
// Handles the case where the app was killed before the client-side timer fired.

export const checkExpiredOnline = onSchedule(
    { schedule: 'every 15 minutes', region: REGION },
    async () => {
            const expiredSnap = await db
            .collection('users')
            .where('isOnline', '==', true)
            .where('onlineUntil', '<=', Timestamp.now())
            .get();

        if (expiredSnap.empty) {
            logger.info('[checkExpiredOnline] no expired sessions');
            return;
        }

        logger.info('[checkExpiredOnline]', { count: expiredSnap.size });

        await Promise.all(
            expiredSnap.docs.map(async doc => {
                const user = doc.data() as UserDoc;
                try {
                    await doc.ref.update({
                        isOnline:    false,
                        onlineUntil: FieldValue.delete(),
                    });

                    const tokens = await getEligibleFriendTokens(user.uid);
                    if (tokens.length === 0) return;

                    await sendMany(
                        tokens,
                        `${user.username} went offline`,
                        `@${user.username} is no longer available.`,
                        { type: 'friend_offline', friendUid: user.uid },
                    );

                    logger.info('[checkExpiredOnline] expired', { uid: user.uid });
                } catch (err) {
                    logger.error('[checkExpiredOnline] failed for uid', { uid: user.uid, err });
                }
            }),
        );
    },
);