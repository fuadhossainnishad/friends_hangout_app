/**
 * match.service.ts
 *
 * Firestore schema: /matches/{matchId}
 *   initiator_uid    string   — who pressed "Match"
 *   target_uid       string   — the friend being matched
 *   status           'pending' | 'accepted'
 *   created_at       Timestamp
 *
 *   — written by Cloud Function onMatchUpdated when status → accepted: —
 *   initiator_username   string
 *   initiator_phone      string?
 *   initiator_instagram  string?
 *   initiator_profile    string?
 *   target_username      string
 *   target_phone         string?
 *   target_instagram     string?
 *   target_profile       string?
 *
 * Flow:
 *   1. UserA presses Match on UserB
 *        → createMatch(userA.uid, userB.uid)
 *        → writes status:'pending'
 *        → Cloud Function onMatchCreated fires:
 *            • notifies UserB "UserA wants to match"
 *            • notifies UserA "request sent"
 *
 *   2. UserB presses Match on UserA (they also go online)
 *        → createMatch(userB.uid, userA.uid)  — finds the existing doc
 *        → calls acceptMatch(existingDocId)
 *        → writes status:'accepted'
 *        → Cloud Function onMatchUpdated fires:
 *            • writes contact info into the doc
 *            • notifies both "It's a match!"
 *
 *   3. Both clients navigate to MatchedScreen with the matchId
 *        → MatchedScreen reads /matches/{matchId} to get contact details
 */

import firestore from '@react-native-firebase/firestore';

export type MatchStatus = 'pending' | 'accepted';

export type MatchDoc = {
  matchId: string;
  initiator_uid: string;
  target_uid: string;
  status: MatchStatus;
  // Present after Cloud Function writes them (status = accepted):
  initiator_username?: string;
  initiator_phone?: string;
  initiator_instagram?: string;
  initiator_profile?: string;
  target_username?: string;
  target_phone?: string;
  target_instagram?: string;
  target_profile?: string;
};

/**
 * Call this when the user presses "Match" on a friend.
 *
 * Behaviour:
 *   - If no match doc exists between the two users → creates one (status: pending)
 *   - If a pending match exists where the OTHER person is the initiator →
 *     accepts it (status: accepted) → mutual match
 *   - If a pending match exists where I am the initiator → throws (already sent)
 *   - If an accepted match already exists → throws (already matched)
 *
 * Returns the matchId and whether this action completed a mutual match.
 */
export async function createOrAcceptMatch(
  myUid: string,
  friendUid: string,
): Promise<{ matchId: string; isMutual: boolean }> {
  // Look for an existing match doc between these two users in either direction
  const [snap1, snap2] = await Promise.all([
    firestore()
      .collection('matches')
      .where('initiator_uid', '==', myUid)
      .where('target_uid', '==', friendUid)
      .limit(1)
      .get(),
    firestore()
      .collection('matches')
      .where('initiator_uid', '==', friendUid)
      .where('target_uid', '==', myUid)
      .limit(1)
      .get(),
  ]);

  const myRequest = snap1.docs[0]; // I already sent a request to them
  const theirRequest = snap2.docs[0]; // They already sent a request to me

  // ── Case 1: They sent me a request — accept it (mutual match) ────────────
  if (theirRequest) {
    const data = theirRequest.data() as MatchDoc;
    if (data.status === 'accepted') {
      throw new Error('You are already matched.');
    }
    await theirRequest.ref.update({ status: 'accepted' });
    // Cloud Function onMatchUpdated fires → writes contact info + notifies both
    return { matchId: theirRequest.id, isMutual: true };
  }

  // ── Case 2: I already sent a request — idempotent ────────────────────────
  if (myRequest) {
    const data = myRequest.data() as MatchDoc;
    if (data.status === 'accepted') {
      throw new Error('You are already matched.');
    }
    // Already pending — return the existing id, not a duplicate
    return { matchId: myRequest.id, isMutual: false };
  }

  // ── Case 3: No existing match — create a new pending request ─────────────
  const docRef = await firestore().collection('matches').add({
    initiator_uid: myUid,
    target_uid: friendUid,
    status: 'pending',
    created_at: firestore.Timestamp.now(),
  });
  // Cloud Function onMatchCreated fires → notifies both parties
  return { matchId: docRef.id, isMutual: false };
}

/**
 * Fetches a match document by id.
 * The MatchedScreen calls this to get both users' contact details
 * (written by the Cloud Function after status → accepted).
 */
export async function getMatch(matchId: string): Promise<MatchDoc | null> {
  const snap = await firestore().collection('matches').doc(matchId).get();
  const snapExists = snap.data();
  if (!snapExists) return null;

  return { matchId: snap.id, ...(snap.data() as Omit<MatchDoc, 'matchId'>) };
}

/**
 * Subscribes to a match document in real time.
 * Use this on the MatchedScreen so contact details appear the moment
 * the Cloud Function writes them (usually within 1-2 seconds).
 * Returns an unsubscribe function.
 */
export function subscribeToMatch(
  matchId: string,
  onUpdate: (match: MatchDoc) => void,
  onError?: (err: Error) => void,
): () => void {
  return firestore()
    .collection('matches')
    .doc(matchId)
    .onSnapshot(
      snap => {
        const snapExists = snap.data();
        if (snapExists) {
          onUpdate({
            matchId: snap.id,
            ...(snap.data() as Omit<MatchDoc, 'matchId'>),
          });
        }
      },
      err => onError?.(err),
    );
}
