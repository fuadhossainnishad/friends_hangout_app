/**
 * friends.service.ts
 *
 * Firestore schema:  /friendships/{uid_uid}
 *   uid1, uid2       — sorted uids (deterministic doc ID)
 *   status           — 'pending' | 'accepted'
 *   requester_uid    — who sent the request
 *   ghosted_by       — string[] of uids who have ghosted the other person
 *   created_at       — Timestamp
 */
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { UserProfile } from '../auth/auth.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FriendshipStatus = 'pending' | 'accepted';

export type Friendship = {
    id: string;
    uid1: string;
    uid2: string;
    status: FriendshipStatus;
    requester_uid: string;
    ghosted_by: string[];
    created_at: FirebaseFirestoreTypes.Timestamp;
};

// Shape consumed by FriendsScreen and ActivateScreen
export type FriendRecord = {
    friendshipId: string;
    user: UserProfile;
    status: FriendshipStatus;
    isGhosted: boolean;   // I have ghosted this friend
    isPending: boolean;
    isSentByMe: boolean;
};

// Shape consumed by HomeScreen — FriendRecord + live online status
export type OnlineFriendRecord = FriendRecord & {
    isOnline: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function friendshipDocId(a: string, b: string): string {
    return [a, b].sort().join('_');
}

function orderedUids(a: string, b: string): { uid1: string; uid2: string } {
    const [uid1, uid2] = [a, b].sort();
    return { uid1, uid2 };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Fetches all friendships (pending + accepted) for a given user
 * and resolves each friend's UserProfile.
 */
export async function getFriends(myUid: string): Promise<FriendRecord[]> {
    const [snap1, snap2] = await Promise.all([
        firestore().collection('friendships').where('uid1', '==', myUid).get(),
        firestore().collection('friendships').where('uid2', '==', myUid).get(),
    ]);

    const docs = [...snap1.docs, ...snap2.docs];
    if (docs.length === 0) return [];

    const friendships = docs.map(d => ({ id: d.id, ...(d.data() as Omit<Friendship, 'id'>) }));
    const friendUids = friendships.map(f => (f.uid1 === myUid ? f.uid2 : f.uid1));

    const profiles = await batchGetUsers(friendUids);
    const profileMap = new Map(profiles.map(p => [p.uid, p]));

    return friendships
        .map((f): FriendRecord | null => {
            const friendUid = f.uid1 === myUid ? f.uid2 : f.uid1;
            const user = profileMap.get(friendUid);
            if (!user) return null;
            return {
                friendshipId: f.id,
                user,
                status: f.status,
                isGhosted: f.ghosted_by?.includes(myUid) ?? false,
                isPending: f.status === 'pending',
                isSentByMe: f.requester_uid === myUid,
            };
        })
        .filter((f): f is FriendRecord => f !== null);
}

/**
 * Returns accepted friends who are currently online AND have not ghosted myUid.
 *
 * Visibility rules:
 *   - Friend must have status 'accepted'
 *   - Friend's user doc must have isOnline === true
 *   - Friend must NOT have ghosted me (myUid not in ghosted_by)
 *
 * Note: myUid ghosting a friend is irrelevant here — that controls whether
 * THEY can see ME, not whether I can see them.
 */
export async function getOnlineFriends(myUid: string): Promise<OnlineFriendRecord[]> {
    const [snap1, snap2] = await Promise.all([
        firestore().collection('friendships').where('uid1', '==', myUid).get(),
        firestore().collection('friendships').where('uid2', '==', myUid).get(),
    ]);

    const docs = [...snap1.docs, ...snap2.docs];
    if (docs.length === 0) return [];

    const friendships = docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<Friendship, 'id'>) }))
        .filter(f => f.status === 'accepted');

    if (friendships.length === 0) return [];

    const friendUids = friendships.map(f => (f.uid1 === myUid ? f.uid2 : f.uid1));

    // Fresh user doc read — we need current isOnline value, not a cached one
    const profiles = await batchGetUsers(friendUids);
    const profileMap = new Map(profiles.map(p => [p.uid, p]));

    return friendships
        .map((f): OnlineFriendRecord | null => {
            const friendUid = f.uid1 === myUid ? f.uid2 : f.uid1;
            const user = profileMap.get(friendUid);
            if (!user) return null;

            const friendHasGhostedMe = f.ghosted_by?.includes(myUid) ?? false;
            const isOnline = (user as any).isOnline === true;

            // Only surface this friend if they're online AND haven't ghosted me
            if (!isOnline || friendHasGhostedMe) return null;

            return {
                friendshipId: f.id,
                user,
                status: 'accepted',
                isGhosted: f.ghosted_by?.includes(myUid) ?? false,
                isPending: false,
                isSentByMe: f.requester_uid === myUid,
                isOnline: true,
            };
        })
        .filter((f): f is OnlineFriendRecord => f !== null);
}

/**
 * Search users by username prefix.
 * Excludes the current user and existing friends/pending requests.
 */
export async function searchUsersByUsername(
    query: string,
    myUid: string,
    existingFriendUids: Set<string>
): Promise<UserProfile[]> {
    if (query.trim().length < 2) return [];
    const lower = query.toLowerCase().trim();
    const snap = await firestore()
        .collection('users')
        .where('username', '>=', lower)
        .where('username', '<', lower + '\uf8ff')
        .limit(20)
        .get();
    return snap.docs
        .map(d => d.data() as UserProfile)
        .filter(u => u.uid !== myUid && !existingFriendUids.has(u.uid));
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function sendFriendRequest(myUid: string, targetUid: string): Promise<void> {
    const { uid1, uid2 } = orderedUids(myUid, targetUid);
    const docId = friendshipDocId(myUid, targetUid);
    const docRef = firestore().collection('friendships').doc(docId);
    const existing = await docRef.get();
    if (existing.exists()) throw new Error('A friendship or pending request already exists.');
    await docRef.set({
        uid1,
        uid2,
        status: 'pending',
        requester_uid: myUid,
        ghosted_by: [],
        created_at: firestore.Timestamp.now(),
    });
}

export async function acceptFriendRequest(friendshipId: string, myUid: string): Promise<void> {
    const docRef = firestore().collection('friendships').doc(friendshipId);
    const snap = await docRef.get();
    if (!snap.exists()) throw new Error('Friendship not found.');
    const data = snap.data() as Friendship;
    if (data.requester_uid === myUid) throw new Error("You can't accept your own request.");
    if (data.status === 'accepted') return; // idempotent
    await docRef.update({ status: 'accepted' });
}

export async function removeFriend(friendshipId: string): Promise<void> {
    await firestore().collection('friendships').doc(friendshipId).delete();
}

export async function toggleGhost(
    friendshipId: string,
    myUid: string,
    ghost: boolean
): Promise<void> {
    await firestore()
        .collection('friendships')
        .doc(friendshipId)
        .update({
            ghosted_by: ghost
                ? firestore.FieldValue.arrayUnion(myUid)
                : firestore.FieldValue.arrayRemove(myUid),
        });
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function batchGetUsers(uids: string[]): Promise<UserProfile[]> {
    if (uids.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
    const results = await Promise.all(
        chunks.map(chunk =>
            firestore().collection('users').where('uid', 'in', chunk).get()
        )
    );
    return results.flatMap(snap => snap.docs.map(d => d.data() as UserProfile));
}