// /**
//  * Firebase Cloud Functions — HORA Notifications
//  *
//  * Deploy: firebase deploy --only functions
//  *
//  * Triggers:
//  *   1. onUserOnline     — user.isOnline flips true  → notify non-ghosted friends
//  *   2. onUserOffline    — user.isOnline flips false → notify online friends
//  *   3. onMatchCreated   — new /matches doc created  → notify the other party
//  */

// import * as functions from 'firebase-functions/v2';
// import * as admin from 'firebase-admin';

// admin.initializeApp();
// const db = admin.firestore();
// const messaging = admin.messaging();

// // ─── Types ────────────────────────────────────────────────────────────────────

// type UserDoc = {
//     uid: string;
//     username: string;
//     isOnline: boolean;
//     fcmToken?: string;
// };

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// /**
//  * Sends a single FCM notification to a device token.
//  * Silently ignores invalid/expired tokens — don't crash the function over stale tokens.
//  */
// async function sendPush(
//     token: string,
//     title: string,
//     body: string,
//     data?: Record<string, string>
// ): Promise<void> {
//     if (!token) return;
//     try {
//         await messaging.send({
//             token,
//             notification: { title, body },
//             data: data ?? {},
//             apns: {
//                 payload: { aps: { sound: 'default', badge: 1 } },
//             },
//             android: {
//                 priority: 'high',
//                 notification: { sound: 'default' },
//             },
//         });
//     } catch (error: any) {
//         // Token expired or unregistered — log and move on
//         if (
//             error?.code === 'messaging/invalid-registration-token' ||
//             error?.code === 'messaging/registration-token-not-registered'
//         ) {
//             console.warn(`Stale FCM token for message: ${error.message}`);
//         } else {
//             console.error('FCM send error:', error);
//         }
//     }
// }

// /**
//  * Gets all accepted friendships for a uid.
//  * Returns friendship docs that include the other party's uid.
//  */
// async function getAcceptedFriendships(uid: string) {
//     const [snap1, snap2] = await Promise.all([
//         db.collection('friendships').where('uid1', '==', uid).where('status', '==', 'accepted').get(),
//         db.collection('friendships').where('uid2', '==', uid).where('status', '==', 'accepted').get(),
//     ]);
//     return [...snap1.docs, ...snap2.docs].map(d => ({
//         id: d.id,
//         ...(d.data() as {
//             uid1: string;
//             uid2: string;
//             ghosted_by: string[];
//             status: string;
//         }),
//     }));
// }

// // ─── Trigger 1: User goes online ──────────────────────────────────────────────

// export const onUserOnline = functions.firestore.onDocumentUpdated(
//     'users/{uid}',
//     async (event) => {
//         const before = event.data?.before.data() as UserDoc | undefined;
//         const after = event.data?.after.data() as UserDoc | undefined;

//         // Only fire when isOnline flips false → true
//         if (!after?.isOnline || before?.isOnline === true) return;

//         const uid = event.params.uid;
//         const username = after.username;

//         const friendships = await getAcceptedFriendships(uid);
//         if (friendships.length === 0) return;

//         // Notify friends who haven't ghosted this user
//         await Promise.all(
//             friendships.map(async (f) => {
//                 const friendUid = f.uid1 === uid ? f.uid2 : f.uid1;
//                 const ghostedBy: string[] = f.ghosted_by ?? [];

//                 // If this user is ghosted by friendUid, skip — they don't want to see them
//                 if (ghostedBy.includes(friendUid)) return;

//                 const friendDoc = await db.collection('users').doc(friendUid).get();
//                 const friend = friendDoc.data() as UserDoc | undefined;
//                 if (!friend?.fcmToken) return;

//                 await sendPush(
//                     friend.fcmToken,
//                     '🟢 Friend is online!',
//                     `@${username} is online and available to match`,
//                     { type: 'friend_online', friendUid: uid }
//                 );
//             })
//         );
//     }
// );

// // ─── Trigger 2: Match created ─────────────────────────────────────────────────
// /**
//  * Matches collection schema:  /matches/{matchId}
//  *   initiator_uid: string   — who pressed Match
//  *   target_uid: string      — who was matched
//  *   created_at: Timestamp
//  *   status: 'pending'
//  */
// export const onMatchCreated = functions.firestore.onDocumentCreated(
//     'matches/{matchId}',
//     async (event) => {
//         const match = event.data?.data() as {
//             initiator_uid: string;
//             target_uid: string;
//         } | undefined;

//         if (!match) return;

//         const { initiator_uid, target_uid } = match;

//         // Get both users in parallel
//         const [initiatorDoc, targetDoc] = await Promise.all([
//             db.collection('users').doc(initiator_uid).get(),
//             db.collection('users').doc(target_uid).get(),
//         ]);

//         const initiator = initiatorDoc.data() as UserDoc | undefined;
//         const target = targetDoc.data() as UserDoc | undefined;

//         // Notify the target: "@alex_chen matched with you!"
//         if (target?.fcmToken) {
//             await sendPush(
//                 target.fcmToken,
//                 '🎉 You got a match!',
//                 `@${initiator?.username ?? 'Someone'} matched with you`,
//                 {
//                     type: 'matched',
//                     matchId: event.params.matchId,
//                     friendUid: initiator_uid,
//                 }
//             );
//         }

//         // Also notify initiator with confirmation
//         if (initiator?.fcmToken) {
//             await sendPush(
//                 initiator.fcmToken,
//                 '✅ Match sent!',
//                 `You matched with @${target?.username ?? 'your friend'}`,
//                 {
//                     type: 'matched',
//                     matchId: event.params.matchId,
//                     friendUid: target_uid,
//                 }
//             );
//         }
//     }
// );