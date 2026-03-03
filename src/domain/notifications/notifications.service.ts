/**
 * notifications.service.ts
 *
 * Responsibilities:
 *   1. Request permission + get FCM token on app start
 *   2. Save the token to Firestore on the user's doc
 *   3. Listen for foreground messages → return payload for in-app banner
 *   4. Handle background/killed notification taps → navigate to correct screen
 *
 * Install:
 *   yarn add @react-native-firebase/messaging
 *   iOS: cd ios && pod install
 *   Android: rebuild
 */

import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationPayload = {
    type: 'friend_online' | 'matched';
    friendUid?: string;
    matchId?: string;
    title: string;
    body: string;
};

// ─── Token registration ───────────────────────────────────────────────────────

/**
 * Requests permission, gets FCM token, saves to /users/{uid}.fcmToken.
 * Call once after authentication. Safe to call multiple times (idempotent).
 */
export async function registerFCMToken(uid: string): Promise<void> {
    const authStatus = await messaging().requestPermission();
    const granted =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!granted) return;

    const token = await messaging().getToken();
    if (!token) return;

    await firestore().collection('users').doc(uid).update({ fcmToken: token });

    // Auto-refresh when token rotates (OS can rotate tokens)
    messaging().onTokenRefresh(async (newToken) => {
        await firestore().collection('users').doc(uid).update({ fcmToken: newToken });
    });
}

// ─── Foreground listener ──────────────────────────────────────────────────────

/**
 * Listens for FCM messages while the app is in the foreground.
 * Returns an unsubscribe function — call it in useEffect cleanup.
 *
 * Example:
 *   useEffect(() => listenForeground(payload => showBanner(payload)), []);
 */
export function listenForeground(onMessage: (payload: NotificationPayload) => void): () => void {
    return messaging().onMessage((msg: FirebaseMessagingTypes.RemoteMessage) => {
        const data = msg.data ?? {};
        onMessage({
            type: (data.type as NotificationPayload['type']) ?? 'friend_online',
            friendUid: data.friendUid as string | undefined,
            matchId: data.matchId as string | undefined,
            title: msg.notification?.title ?? 'HORA',
            body: msg.notification?.body ?? '',
        });
    });
}

// ─── Background tap handler ───────────────────────────────────────────────────

type NavRef = {
    isReady: () => boolean;
    navigate: (screen: string, params?: object) => void;
};

/**
 * Wires up navigation for notification taps when the app is background/killed.
 * Call ONCE at root level (e.g. App.tsx), not inside remounting components.
 */
export function setupBackgroundNotificationHandler(navRef: NavRef): void {
    // Tapped while app in background
    messaging().onNotificationOpenedApp((msg) => {
        navigateFromNotification(msg, navRef);
    });

    // Tapped while app was fully killed
    messaging()
        .getInitialNotification()
        .then((msg) => {
            if (msg) setTimeout(() => navigateFromNotification(msg, navRef), 500);
        });
}

function navigateFromNotification(msg: FirebaseMessagingTypes.RemoteMessage, navRef: NavRef): void {
    if (!navRef.isReady()) return;
    const data = msg.data ?? {};

    if (data.type === 'matched' && data.friendUid) {
        navRef.navigate('Matched', {
            friendId: data.friendUid as string,
            friendName: '',
            friendUsername: '',
        });
    }
    // friend_online → just open the app to HomeScreen, no special nav needed
}