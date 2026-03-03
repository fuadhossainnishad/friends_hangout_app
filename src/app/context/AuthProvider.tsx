/**
 * app/context/AuthProvider.tsx
 */
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react';
import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { getUserProfile, type UserProfile } from '../../domain/auth/auth.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SharePreference = 'phone' | 'instagram' | 'both';

export type AppUser = UserProfile & {
    isOnline: boolean;
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
    setOnlineStatus: (isOnline: boolean) => Promise<void>;
    logout: () => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({ status: 'loading' });

    // Resolves a Firebase user into full app state by fetching Firestore profile
    const resolveUser = useCallback(async (firebaseUser: FirebaseAuthTypes.User | null) => {
        if (!firebaseUser) {
            setState({ status: 'unauthenticated' });
            return;
        }
        try {
            const profile = await getUserProfile(firebaseUser.uid);
            if (profile) {
                setState(prev => ({
                    status: 'authenticated',
                    firebaseUser,
                    user: {
                        ...profile,
                        isOnline: prev.status === 'authenticated' ? prev.user.isOnline : false,
                        sharePreference: (profile as any).sharePreference ?? 'both',
                    },
                }));
            } else {
                setState({ status: 'needs_profile', firebaseUser });
            }
        } catch {
            setState({ status: 'unauthenticated' });
        }
    }, []);

    useEffect(() => {
        // Runs once on mount. Fires immediately with persisted session or null.
        const unsubscribe = auth().onAuthStateChanged(resolveUser);
        return unsubscribe;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
    const setOnlineStatus = useCallback(async (isOnline: boolean) => {
        if (state.status !== 'authenticated') return;
        const { firebaseUser, user } = state;

        setState(prev =>
            prev.status === 'authenticated'
                ? { ...prev, user: { ...prev.user, isOnline } }
                : prev
        );

        try {
            await firestore().collection('users').doc(firebaseUser.uid).update({ isOnline });
        } catch {
            setState(prev =>
                prev.status === 'authenticated'
                    ? { ...prev, user: { ...prev.user, isOnline: user.isOnline } }
                    : prev
            );
        }
    }, [state]);

    const logout = useCallback(async () => {
        await auth().signOut();
        // onAuthStateChanged fires → setState({ status: 'unauthenticated' })
    }, []);

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