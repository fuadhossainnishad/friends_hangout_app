/**
 * match.service.ts
 *
 * Creates a match document in Firestore which triggers the Cloud Function
 * to send FCM push notifications to both parties.
 */

import firestore from '@react-native-firebase/firestore';

/**
 * Call this when the user presses "Match" on a friend.
 * Creates /matches/{matchId} — the Cloud Function onMatchCreated handles the rest.
 */
export async function createMatch(initiatorUid: string, targetUid: string): Promise<string> {
    const docRef = await firestore().collection('matches').add({
        initiator_uid: initiatorUid,
        target_uid: targetUid,
        status: 'pending',
        created_at: firestore.Timestamp.now(),
    });
    return docRef.id;
}