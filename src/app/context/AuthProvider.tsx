/**
 * app/context/AuthProvider.tsx
 */
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { getUserProfile, type UserProfile } from '../../domain/auth/auth.service';
import { AppState, type AppStateStatus } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

const ONLINE_DEFAULT_MS = 12 * 60 * 60 * 1000;

export type SharePreference = 'phone' | 'instagram' | 'both';

export type AppUser = UserProfile & {
    isOnline: boolean;
    onlineUntil: Date | null;
    sharePreference: SharePreference;
};

export type UpdateUserPayload = {
    bio?: string;
    instagram_username?: string;
    profile?: string;
    sharePreference?: SharePreference;
};

type AuthState =
    | { status: 'loading' }
    | { status: 'unauthenticated' }
    | { status: 'needs_profile'; firebaseUser: FirebaseAuthTypes.User }
    | { status: 'authenticated'; firebaseUser: FirebaseAuthTypes.User; user: AppUser };

type AuthContextValue = {
    state: AuthState;
    /** Null when not authenticated — screens should guard against this */
    user: AppUser | null;
    refreshProfile: () => Promise<void>;
    updateUser: (payload: UpdateUserPayload) => Promise<void>;
    setOnlineStatus: (isOnline: boolean, until?: Date) => Promise<void>;
    logout: () => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({ status: 'loading' });

    // Client-side expiry timer — fires when app is in foreground
    // Cloud Function scheduler handles background / killed state
    const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Expiry timer helpers ───────────────────────────────────────────────────

    const clearExpiryTimer = useCallback(() => {
        if (expiryTimer.current) {
            clearTimeout(expiryTimer.current);
            expiryTimer.current = null;
        }
    }, []);

    /**
     * Arms a setTimeout that fires when onlineUntil is reached.
     * On fire: sets the user offline in Firestore and local state.
     * The Cloud Function onUserOffline trigger will then notify friends.
     */
    const armExpiryTimer = useCallback((uid: string, until: Date) => {
        clearExpiryTimer();
        const msLeft = until.getTime() - Date.now();
        if (msLeft <= 0) return; // already expired — Cloud Function scheduler will catch it

        expiryTimer.current = setTimeout(async () => {
            try {
                await firestore().collection('users').doc(uid).update({
                    isOnline: false,
                    onlineUntil: firestore.FieldValue.delete(),
                });
                setState(prev =>
                    prev.status === 'authenticated'
                        ? { ...prev, user: { ...prev.user, isOnline: false, onlineUntil: null } }
                        : prev
                );
            } catch (err) {
                // Best-effort — the Cloud Function scheduler is the safety net
                console.warn('Client-side expiry write failed:', err);
            }
        }, msLeft);
    }, [clearExpiryTimer]);

    // Resolves a Firebase user into full app state by fetching Firestore profile
    const resolveUser = useCallback(async (firebaseUser: FirebaseAuthTypes.User | null) => {
        if (!firebaseUser) {
            setState({ status: 'unauthenticated' });
            return;
        }
        try {
            const profile = await getUserProfile(firebaseUser.uid);
            if (profile) {
                const raw = profile as any;
                const isOnline: boolean = raw.isOnline === true;
                const onlineUntil: Date | null = raw.onlineUntil?.toDate?.() ?? null;
                setState({
                    status: 'authenticated',
                    firebaseUser,
                    user: {
                        ...profile,
                        isOnline,
                        onlineUntil,
                        sharePreference: raw.sharePreference ?? 'both',
                    },
                });
                // Re-arm the expiry timer if there's an active session
                if (isOnline && onlineUntil && onlineUntil > new Date()) {
                    armExpiryTimer(firebaseUser.uid, onlineUntil);
                }
            } else {
                setState({ status: 'needs_profile', firebaseUser });
            }
        } catch {
            setState({ status: 'unauthenticated' });
        }
    }, [armExpiryTimer]);

    useEffect(() => {
        // Runs once on mount. Fires immediately with persisted session or null.
        const unsubscribe = auth().onAuthStateChanged(resolveUser);
        return unsubscribe;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleAppState = (nextAppState: AppStateStatus) => {
            if (nextAppState !== 'active') return;
            if (state.status !== 'authenticated') return;

            const { user, firebaseUser } = state;
            if (!user.isOnline || !user.onlineUntil) return;

            if (user.onlineUntil <= new Date()) {
                // Session expired while backgrounded — set offline immediately
                firestore()
                    .collection('users')
                    .doc(firebaseUser.uid)
                    .update({
                        isOnline: false,
                        onlineUntil: firestore.FieldValue.delete(),
                    })
                    .then(() => {
                        clearExpiryTimer();
                        setState(prev =>
                            prev.status === 'authenticated'
                                ? { ...prev, user: { ...prev.user, isOnline: false, onlineUntil: null } }
                                : prev
                        );
                    })
                    .catch(err => console.warn('AppState offline update failed:', err));
            } else {
                // Session still valid — re-arm timer with remaining time
                armExpiryTimer(firebaseUser.uid, user.onlineUntil);
            }
        };

        const sub = AppState.addEventListener('change', handleAppState);
        return () => sub.remove();
    }, [state, clearExpiryTimer, armExpiryTimer]);

    // ── Public API ────────────────────────────────────────────────────────────

    const refreshProfile = useCallback(async () => {
        await resolveUser(auth().currentUser);
    }, [resolveUser]);

    /**
     * Updates editable profile fields in Firestore, then applies them
     * optimistically to local state so the UI reflects changes instantly.
     */
    const updateUser = useCallback(async (payload: UpdateUserPayload) => {
        if (state.status !== 'authenticated') return;
        const { firebaseUser, user } = state;

        // Build only the fields we're actually changing
        const firestoreUpdate: Record<string, unknown> = {};
        if (payload.bio !== undefined) firestoreUpdate.bio = payload.bio;
        if (payload.instagram_username !== undefined) firestoreUpdate.instagram_username = payload.instagram_username;
        if (payload.profile !== undefined) firestoreUpdate.profile = payload.profile;
        if (payload.sharePreference !== undefined) firestoreUpdate.sharePreference = payload.sharePreference;

        // Optimistic local update
        setState(prev =>
            prev.status === 'authenticated'
                ? {
                    ...prev,
                    user: {
                        ...prev.user,
                        ...payload,
                    },
                }
                : prev
        );

        try {
            await firestore().collection('users').doc(firebaseUser.uid).update(firestoreUpdate);
        } catch (error) {
            // Rollback on failure
            setState(prev =>
                prev.status === 'authenticated'
                    ? { ...prev, user }
                    : prev
            );
            throw error;
        }
    }, [state]);

    /**
     * Flips online status locally and writes to Firestore.
     * Rolls back on failure.
     */
    const setOnlineStatus = useCallback(async (isOnline: boolean, until?: Date) => {
        if (state.status !== 'authenticated') return;
        const { firebaseUser, user } = state;

        let onlineUntil: Date | null = null;
        let firestoreUpdate: Record<string, unknown>;

        if (isOnline) {
            // Use the provided time or fall back to now + 12h
            onlineUntil = until ?? new Date(Date.now() + ONLINE_DEFAULT_MS);
            firestoreUpdate = {
                isOnline: true,
                onlineUntil: firestore.Timestamp.fromDate(onlineUntil),
            };
        } else {
            // Going offline — delete the expiry field entirely
            firestoreUpdate = {
                isOnline: false,
                onlineUntil: firestore.FieldValue.delete(),
            };
            clearExpiryTimer();
        }


        setState(prev =>
            prev.status === 'authenticated'
                ? { ...prev, user: { ...prev.user, isOnline } }
                : prev
        );

        try {

            await firestore().collection('users').doc(firebaseUser.uid).update(firestoreUpdate);

            // Arm client-side timer only after confirmed Firestore write
            if (isOnline && onlineUntil) {
                armExpiryTimer(firebaseUser.uid, onlineUntil);
            }
        } catch (err) {
            setState(prev =>
                prev.status === 'authenticated'
                    ? { ...prev, user: { ...prev.user, isOnline: user.isOnline, onlineUntil: user.onlineUntil } }
                    : prev
            );
            clearExpiryTimer();
            throw err;
        }
    }, [state, clearExpiryTimer, armExpiryTimer]);

    const logout = useCallback(async () => {
        clearExpiryTimer();
        if (state.status === 'authenticated' && state.user.isOnline) {
            try {
                await firestore()
                    .collection('users')
                    .doc(state.firebaseUser.uid)
                    .update({
                        isOnline: false,
                        onlineUntil: firestore.FieldValue.delete(),
                    });
            } catch {
                // Best-effort — sign out regardless
            }
        }

        await auth().signOut();
        // onAuthStateChanged fires → setState({ status: 'unauthenticated' })
    }, [state, clearExpiryTimer]);

    const user = state.status === 'authenticated' ? state.user : null;

    return (
        <AuthContext.Provider value={{ state, user, refreshProfile, updateUser, setOnlineStatus, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}