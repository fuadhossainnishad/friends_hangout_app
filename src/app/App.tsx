/**
 * src/app/App.tsx  (RootApp)
 *
 * Sits inside the NavigationContainer that lives in the root App.tsx.
 * Owns: AuthProvider, FCM token registration, background notification
 * handler, and the in-app banner for foreground notifications.
 */
import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthProvider';
import RootNavigator from '../naviagtion/Rootnavigation';

import { navigationRef } from './navigationRef';
import { registerFCMToken, setupBackgroundNotificationHandler } from '../domain/notifications/notifications.service';
import InAppBanner from '../domain/notifications/InAppBanner';

// ── Inner — has access to AuthContext ─────────────────────────────────────────

function AppInner() {
    const { user } = useAuth();

    // Register / refresh FCM token whenever the authed user changes
    useEffect(() => {
        if (user?.uid) {
            registerFCMToken(user.uid).catch(console.warn);
        }
    }, [user?.uid]);

    return (
        <>
            <RootNavigator />
            {/* Foreground push banner — only mount when logged in */}
            {user && <InAppBanner />}
        </>
    );
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function RootApp() {
    // Wire background/killed notification taps once at mount.
    // Uses the shared navigationRef so we don't need a second NavigationContainer.
    useEffect(() => {
        setupBackgroundNotificationHandler({
            isReady: () => navigationRef.isReady(),
            navigate: (screen, params) => navigationRef.navigate(screen, params),
        });
    }, []);

    return (
        <AuthProvider>
            <AppInner />
        </AuthProvider>
    );
}