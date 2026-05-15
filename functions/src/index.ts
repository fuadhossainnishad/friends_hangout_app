/**
 * Firebase Cloud Functions — HORA
 *
 * Triggers:
 *   1. onUserOnline        — isOnline flips true  → notify non-ghosted friends
 *   2. onUserOffline       — isOnline flips false → notify online friends
 *   3. onMatchCreated      — new /matches doc     → notify both parties
 *   4. checkExpiredOnline  — runs every 15 min    → auto-offline expired sessions
 */

import { firestore as fsEvent, logger } from 'firebase-functions/v2';
import { scheduler } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { onDocumentUpdated } from 'firebase-functions/firestore';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

const REGION = 'us-central1';

// ─── Types ────────────────────────────────────────────────────────────────────

type FriendshipStatus = 'pending' | 'accepted';

interface Friendship {
  uid1: string;
  uid2: string;
  status: FriendshipStatus;
  requester_uid: string;
  ghosted_by: string[];
}

type UserDoc = {
  uid: string;
  username: string;
  isOnline: boolean;
  onlineUntil?: admin.firestore.Timestamp; // epoch ms when session expires
  fcmToken?: string;
  notificationsEnabled?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getUser(uid: string): Promise<UserDoc | null> {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return null;
  return snap.data() as UserDoc;
}

/** Absent notificationsEnabled field → treat as true (opted in by default). */
function notificationsEnabled(user: UserDoc): boolean {
  return user.notificationsEnabled !== false;
}

async function sendOne(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  try {
    const messageId = await messaging.send({
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
    logger.info('[FCM] sent', {
      messageId,
      type: data.type,
      token: token.slice(-8),
    });
  } catch (err: any) {
    // messaging/registration-token-not-registered → stale token, safe to ignore
    // messaging/invalid-argument → malformed token, safe to ignore
    logger.warn('[FCM] send failed', {
      code: err?.code,
      type: data.type,
      token: token.slice(-8),
    });
  }
}

async function sendMany(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  if (tokens.length === 0) return;
  await Promise.all(tokens.map(t => sendOne(t, title, body, data)));
}

async function sendPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (!token?.trim()) return;
  try {
    await messaging.send({
      token,
      notification: { title, body },
      data: data ?? {},
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      android: { priority: 'high', notification: { sound: 'default' } },
    });
  } catch (err: any) {
    const stale = [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
    ];
    if (stale.includes(err?.code)) {
      console.warn(`Stale FCM token, skipping: ${err.message}`);
    } else {
      console.error('FCM send error:', err);
    }
  }
}

/**
 * Gets all ACCEPTED friendships for a uid.
 */
async function getAcceptedFriendships(uid: string) {
  const [s1, s2] = await Promise.all([
    db
      .collection('friendships')
      .where('uid1', '==', uid)
      .where('status', '==', 'accepted')
      .get(),
    db
      .collection('friendships')
      .where('uid2', '==', uid)
      .where('status', '==', 'accepted')
      .get(),
  ]);
  return [...s1.docs, ...s2.docs].map(d => ({
    id: d.id,
    ...(d.data() as { uid1: string; uid2: string; ghosted_by: string[] }),
  }));
}

/**
 * Notify all accepted friends of a user, respecting ghost settings.
 *
 * @param uid         The user whose friends to notify
 * @param ghostCheck  'exclude_ghosted_by_friend' — skip friends who ghosted uid
 *                    'exclude_ghosted_by_me'     — skip friends uid has ghosted
 */
async function notifyFriends(
  uid: string,
  username: string,
  title: string,
  body: string,
  data: Record<string, string>,
  ghostCheck: 'exclude_ghosted_by_friend' | 'exclude_ghosted_by_me',
): Promise<void> {
  const friendships = await getAcceptedFriendships(uid);
  if (!friendships.length) return;

  await Promise.all(
    friendships.map(async f => {
      const friendUid = f.uid1 === uid ? f.uid2 : f.uid1;
      const ghostedBy: string[] = f.ghosted_by ?? [];

      // Respect ghost visibility:
      // going online  → skip friends who have ghosted uid (they don't want to see uid)
      // going offline → same rule
      if (
        ghostCheck === 'exclude_ghosted_by_friend' &&
        ghostedBy.includes(friendUid)
      )
        return;
      // If uid ghosted friendUid, friendUid can't see uid at all — skip
      if (ghostCheck === 'exclude_ghosted_by_me' && ghostedBy.includes(uid))
        return;

      const friendSnap = await db.collection('users').doc(friendUid).get();
      const friend = friendSnap.data() as UserDoc | undefined;
      if (!friend?.fcmToken) return;

      await sendPush(friend.fcmToken, title, body, data);
    }),
  );
}

export const onFriendshipCreated = onDocumentCreated(
  { document: 'friendships/{docId}', region: REGION },
  async event => {
    const friendship = event.data?.data() as Friendship | undefined;
    if (!friendship) return;
    if (friendship.status !== 'pending') return;

    const recipientUid =
      friendship.uid1 === friendship.requester_uid
        ? friendship.uid2
        : friendship.uid1;

    const [requester, recipient] = await Promise.all([
      getUser(friendship.requester_uid),
      getUser(recipientUid),
    ]);

    logger.info('[onFriendshipCreated]', {
      requesterUid: friendship.requester_uid,
      recipientUid,
      hasToken: !!recipient?.fcmToken,
      notifEnabled: recipient ? notificationsEnabled(recipient) : false,
    });

    if (!requester || !recipient?.fcmToken || !notificationsEnabled(recipient))
      return;

    await sendOne(
      recipient.fcmToken,
      'New friend request 👋',
      `@${requester.username} wants to connect with you.`,
      { type: 'friend_request', friendUid: requester.uid },
    );
  },
);

export const onFriendshipUpdated = onDocumentUpdated(
  { document: 'friendships/{docId}', region: REGION },
  async event => {
    const before = event.data?.before.data() as Friendship | undefined;
    const after = event.data?.after.data() as Friendship | undefined;
    if (!before || !after) return;

    // Only care about pending → accepted transition
    if (before.status !== 'pending' || after.status !== 'accepted') return;

    const accepterUid =
      after.uid1 === after.requester_uid ? after.uid2 : after.uid1;

    const [requester, accepter] = await Promise.all([
      getUser(after.requester_uid),
      getUser(accepterUid),
    ]);

    logger.info('[onFriendshipUpdated]', {
      requesterUid: after.requester_uid,
      accepterUid,
      hasToken: !!requester?.fcmToken,
      notifEnabled: requester ? notificationsEnabled(requester) : false,
    });

    if (!requester?.fcmToken || !notificationsEnabled(requester) || !accepter)
      return;

    await sendOne(
      requester.fcmToken,
      'Friend request accepted ✅',
      `@${accepter.username} accepted your friend request.`,
      { type: 'request_accepted', friendUid: accepter.uid },
    );
  },
);

// ─── Trigger 1: User goes ONLINE ─────────────────────────────────────────────

export const onUserOnline = fsEvent.onDocumentUpdated(
  'users/{uid}',
  async event => {
    const before = event.data?.before.data() as UserDoc | undefined;
    const after = event.data?.after.data() as UserDoc | undefined;

    // Only fire on false → true transition
    if (!after?.isOnline || before?.isOnline === true) return;

    const uid = event.params.uid;

    await notifyFriends(
      uid,
      after.username,
      '🟢 Friend is online!',
      `@${after.username} is online and available to match`,
      { type: 'friend_online', friendUid: uid },
      'exclude_ghosted_by_friend',
    );
  },
);

// ─── Trigger 2: User goes OFFLINE ────────────────────────────────────────────

export const onUserOffline = fsEvent.onDocumentUpdated(
  'users/{uid}',
  async event => {
    const before = event.data?.before.data() as UserDoc | undefined;
    const after = event.data?.after.data() as UserDoc | undefined;

    // Only fire on true → false transition
    if (before?.isOnline !== true || after?.isOnline !== false) return;

    const uid = event.params.uid;

    await notifyFriends(
      uid,
      after?.username ?? '',
      '⚫ Friend went offline',
      `@${after?.username} is no longer available`,
      { type: 'friend_offline', friendUid: uid },
      'exclude_ghosted_by_friend',
    );
  },
);

// ─── Trigger 3: Match created ─────────────────────────────────────────────────

export const onMatchCreated = fsEvent.onDocumentCreated(
  'matches/{matchId}',
  async event => {
    const match = event.data?.data() as
      | { initiator_uid: string; target_uid: string }
      | undefined;
    if (!match) return;

    const { initiator_uid, target_uid } = match;
    const matchId = event.params.matchId;

    const [initiatorSnap, targetSnap] = await Promise.all([
      db.collection('users').doc(initiator_uid).get(),
      db.collection('users').doc(target_uid).get(),
    ]);

    const initiator = initiatorSnap.data() as UserDoc | undefined;
    const target = targetSnap.data() as UserDoc | undefined;

    await Promise.all([
      target?.fcmToken
        ? sendPush(
            target.fcmToken,
            '🎉 You got a match!',
            `@${initiator?.username ?? 'Someone'} matched with you`,
            { type: 'matched', matchId, friendUid: initiator_uid },
          )
        : Promise.resolve(),

      initiator?.fcmToken
        ? sendPush(
            initiator.fcmToken,
            '✅ Match sent!',
            `You matched with @${target?.username ?? 'your friend'}`,
            { type: 'matched', matchId, friendUid: target_uid },
          )
        : Promise.resolve(),
    ]);
  },
);

export const onUserOnlineChanged = onDocumentUpdated(
  { document: 'users/{uid}', region: REGION },
  async event => {
    const before = event.data?.before.data() as UserDoc | undefined;
    const after = event.data?.after.data() as UserDoc | undefined;
    if (!before || !after) return;

    // Only fire when isOnline actually flipped
    if (before.isOnline === after.isOnline) return;

    const myUid = event.params.uid;
    const isOnline = after.isOnline === true;

    // Fetch all accepted friendships for this user (two queries — Firestore has no OR)
    const [snap1, snap2] = await Promise.all([
      db
        .collection('friendships')
        .where('uid1', '==', myUid)
        .where('status', '==', 'accepted')
        .get(),
      db
        .collection('friendships')
        .where('uid2', '==', myUid)
        .where('status', '==', 'accepted')
        .get(),
    ]);

    const friendships = [...snap1.docs, ...snap2.docs].map(
      d => d.data() as Friendship,
    );
    if (friendships.length === 0) return;

    // Ghost rule: if myUid is in a friendship's ghosted_by array,
    // that friend has chosen to hide me — don't notify them.
    const eligibleUids = friendships
      .filter(f => !(f.ghosted_by ?? []).includes(myUid))
      .map(f => (f.uid1 === myUid ? f.uid2 : f.uid1));

    if (eligibleUids.length === 0) return;

    // Batch-fetch user docs (Firestore 'in' limit is 30)
    const chunks: string[][] = [];
    for (let i = 0; i < eligibleUids.length; i += 30) {
      chunks.push(eligibleUids.slice(i, i + 30));
    }

    const friendDocs = (
      await Promise.all(
        chunks.map(chunk =>
          db.collection('users').where('uid', 'in', chunk).get(),
        ),
      )
    ).flatMap(s => s.docs.map(d => d.data() as UserDoc));

    const tokens = friendDocs
      .filter(u => notificationsEnabled(u))
      .map(u => u.fcmToken)
      .filter((t): t is string => Boolean(t));

    logger.info('[onUserOnlineChanged]', {
      myUid,
      isOnline,
      eligible: eligibleUids.length,
      tokens: tokens.length,
    });

    if (tokens.length === 0) return;

    const username = after.username ?? 'Someone';

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

// ─── Trigger 4: Scheduled — auto-offline expired sessions ────────────────────
/**
 * Runs every 15 minutes.
 * Finds users where isOnline=true AND onlineUntil <= now.
 * Sets them offline and notifies their friends.
 *
 * This handles two cases:
 *   a) User set a custom "later" time that has passed
 *   b) User's 12-hour default session has expired (app quit, never manually went offline)
 */
export const checkExpiredOnline = scheduler.onSchedule(
  'every 15 minutes',
  async () => {
    const now = admin.firestore.Timestamp.now();

    const expiredSnap = await db
      .collection('users')
      .where('isOnline', '==', true)
      .where('onlineUntil', '<=', now)
      .get();

    if (expiredSnap.empty) {
      console.log('checkExpiredOnline: no expired sessions found');
      return;
    }

    console.log(`checkExpiredOnline: expiring ${expiredSnap.size} session(s)`);

    // Process in parallel — each user goes offline independently
    await Promise.all(
      expiredSnap.docs.map(async doc => {
        const user = doc.data() as UserDoc;
        try {
          // Set offline atomically
          await doc.ref.update({
            isOnline: false,
            onlineUntil: admin.firestore.FieldValue.delete(),
          });

          // Notify their friends
          await notifyFriends(
            user.uid,
            user.username,
            '⚫ Friend went offline',
            `@${user.username} is no longer available`,
            { type: 'friend_offline', friendUid: user.uid },
            'exclude_ghosted_by_friend',
          );

          console.log(
            `Expired session for uid=${user.uid} (@${user.username})`,
          );
        } catch (err) {
          // Log per-user errors without killing the whole batch
          console.error(`Failed to expire session for uid=${user.uid}:`, err);
        }
      }),
    );
  },
);
