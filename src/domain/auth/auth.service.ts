/**
 * auth.service.ts
 */
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserProfile = {
    uid: string;
    phone_number: string;
    username: string;
    email: string;
    profile: string
    bio: string
    instagram_username: string
    created_at: FirebaseFirestoreTypes.Timestamp;
};

// ─── Phone Auth ───────────────────────────────────────────────────────────────

export function sendOTP(
    phoneNumber: string
): Promise<FirebaseAuthTypes.ConfirmationResult> {
    return auth().signInWithPhoneNumber(phoneNumber);
}

export async function verifyOTP(
    confirmation: FirebaseAuthTypes.ConfirmationResult,
    code: string
): Promise<FirebaseAuthTypes.UserCredential> {
    const credential = await confirmation.confirm(code);
    if (!credential) {
        throw new Error('Verification failed. Please try again.');
    }
    return credential;
}

// ─── Firestore ────────────────────────────────────────────────────────────────

/**
 * Fetches user profile with retry + exponential backoff.
 * Handles the brief window where Firestore is unavailable right after
 * OTP verification while the auth token propagates.
 */
export async function getUserProfile(uid: string, retries = 3): Promise<UserProfile | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const snap = await firestore().collection('users').doc(uid).get();
            // exists() is a method (not a property) in this version of @react-native-firebase
            return snap.exists() ? (snap.data() as UserProfile) : null;
        } catch (error: any) {
            const isUnavailable = error?.code === 'firestore/unavailable';
            const isLastAttempt = attempt === retries;

            if (isUnavailable && !isLastAttempt) {
                // Exponential backoff: 500ms → 1000ms → 2000ms
                await new Promise<void>((resolve) => {
                    setTimeout(() => resolve(), 500 * attempt);
                }); continue;
            }
            throw error;
        }
    }
    return null;
}

export async function createUserProfile(
    uid: string,
    data: Pick<UserProfile, 'phone_number' | 'username' | 'email'>
): Promise<void> {
    await firestore()
        .collection('users')
        .doc(uid)
        .set({
            uid,
            phone_number: data.phone_number,
            username: data.username.toLowerCase(),
            email: data.email.toLowerCase(),
            profile: "",
            bio: "",
            instagram_username: "",
            created_at: firestore.Timestamp.now(),
        });
}

export async function isUsernameTaken(username: string): Promise<boolean> {
    const snap = await firestore()
        .collection('users')
        .where('username', '==', username.toLowerCase())
        .limit(1)
        .get();
    return !snap.empty;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export function signOut(): Promise<void> {
    return auth().signOut();
}

export function getCurrentUser(): FirebaseAuthTypes.User | null {
    return auth().currentUser;
}