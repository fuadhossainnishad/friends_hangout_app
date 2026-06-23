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
  initiator_username?: string;
  initiator_phone?: string;
  initiator_instagram?: string;
  initiator_profile?: string;
  target_username?: string;
  target_phone?: string;
  target_instagram?: string;
  target_profile?: string;
};

export async function createOrAcceptMatch(
  myUid: string,
  friendUid: string,
): Promise<{ matchId: string; isMutual: boolean }> {
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

  const myRequest = snap1.docs[0];
  const theirRequest = snap2.docs[0];

  if (theirRequest) {
    const data = theirRequest.data() as MatchDoc;
    if (data.status === 'accepted') throw new Error('Already matched.');
    await theirRequest.ref.update({ status: 'accepted' });
    return { matchId: theirRequest.id, isMutual: true };
  }

  if (myRequest) {
    const data = myRequest.data() as MatchDoc;
    if (data.status === 'accepted') throw new Error('Already matched.');
    return { matchId: myRequest.id, isMutual: false };
  }

  const docRef = await firestore().collection('matches').add({
    initiator_uid: myUid,
    target_uid: friendUid,
    status: 'pending',
    created_at: firestore.Timestamp.now(),
  });
  return { matchId: docRef.id, isMutual: false };
}

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
        if (snap.exists()) {
          onUpdate({
            matchId: snap.id,
            ...(snap.data() as Omit<MatchDoc, 'matchId'>),
          });
        }
      },
      err => onError?.(err),
    );
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


export type EnrichedMatch = {
  matchId: string;
  username: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  profile?: string;
};

export function subscribeToMyMatches(
  myUid: string,
  cb: (matches: EnrichedMatch[]) => void
) {
  return firestore()
    .collection('matches')
    .where('status', '==', 'accepted')
    .onSnapshot(
      snapshot => {
        try {
          if (!snapshot) {
            cb([]);
            return;
          }

          const size = snapshot.size ?? 0;
          console.log('📦 SIZE:', size);

          const results: EnrichedMatch[] = [];

          snapshot.forEach(doc => {
            const data = doc.data();
            if (!data?.initiator_uid || !data?.target_uid) return;

            const isInitiator = data.initiator_uid === myUid;

            const friend = isInitiator
              ? {
                  username: data.target_username,
                  phone: data.target_phone,
                  instagram: data.target_instagram,
                  profile: data.target_profile,
                }
              : {
                  username: data.initiator_username,
                  phone: data.initiator_phone,
                  instagram: data.initiator_instagram,
                  profile: data.initiator_profile,
                };

            results.push({
              matchId: doc.id,
              username: friend.username ?? 'Unknown',
              phone: friend.phone ?? '',
              whatsapp: friend.phone ?? '',
              instagram: friend.instagram ?? '',
              profile: friend.profile ?? '',
              email: (data as any)?.email ?? '',
            });
          });

          cb(results);
        } catch (e) {
          console.log('MATCH SUBSCRIBE ERROR:', e);
          cb([]);
        }
      },
      error => {
        console.log('🔥 SNAPSHOT ERROR:', error);
        cb([]);
      }
    );
}

/**
 * Subscribes to a match document in real time.
 * Use this on the MatchedScreen so contact details appear the moment
 * the Cloud Function writes them (usually within 1-2 seconds).
 * Returns an unsubscribe function.
 */
// export function subscribeToMatch(
//   matchId: string,
//   onUpdate: (match: MatchDoc) => void,
//   onError?: (err: Error) => void,
// ): () => void {
//   return firestore()
//     .collection('matches')
//     .doc(matchId)
//     .onSnapshot(
//       snap => {
//         const snapExists = snap.data();
//         if (snapExists) {
//           onUpdate({
//             matchId: snap.id,
//             ...(snap.data() as Omit<MatchDoc, 'matchId'>),
//           });
//         }
//       },
//       err => onError?.(err),
//       ``,
//     );
// }
