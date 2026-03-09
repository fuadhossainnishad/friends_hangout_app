/**
 * notifications.service.ts
 */
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'friend_online' | 'friend_offline' | 'matched';

export type NotificationPayload = {
    type: NotificationType;
    friendUid?: string;
    matchId?: string;
    title: string;
    body: string;
};

type NavRef = {
    isReady: () => boolean;
    navigate: (screen: string, params?: object) => void;
};

// ─── Token registration ───────────────────────────────────────────────────────

/**
 * Requests permission, gets FCM token, saves to /users/{uid}.fcmToken.
 * Sets up onTokenRefresh so the token stays current if the OS rotates it.
 * Safe to call multiple times — idempotent.
 */
export async function registerFCMToken(uid: string): Promise<void> {
    const authStatus = await messaging().requestPermission();
    const granted =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!granted) {
        console.log('FCM permission not granted');
        return;
    }

    const token = await messaging().getToken();
    if (!token) return;

    await saveToken(uid, token);

    messaging().onTokenRefresh(newToken => {
        saveToken(uid, newToken).catch(console.warn);
    });
}

async function saveToken(uid: string, token: string): Promise<void> {
    await firestore().collection('users').doc(uid).update({ fcmToken: token });
}

// ─── Foreground listener ──────────────────────────────────────────────────────

/**
 * Listens for FCM messages while the app is foregrounded.
 * Returns an unsubscribe function — call it in useEffect cleanup.
 */
export function listenForeground(
    onMessage: (payload: NotificationPayload) => void
): () => void {
    return messaging().onMessage((msg: FirebaseMessagingTypes.RemoteMessage) => {
        const payload = parseMessage(msg);
        if (payload) onMessage(payload);
    });
}

// ─── Background / killed tap handler ─────────────────────────────────────────

/**
 * Wires navigation for notification taps when app is backgrounded or killed.
 * Call ONCE at root — not inside a remounting component.
 */
export function setupBackgroundNotificationHandler(navRef: NavRef): void {
    // App was backgrounded and user tapped the notification
    messaging().onNotificationOpenedApp(msg => {
        navigateFromMessage(msg, navRef);
    });

    // App was killed and user tapped the notification (cold start)
    messaging()
        .getInitialNotification()
        .then(msg => {
            if (msg) {
                // Small delay to let the navigator finish mounting
                setTimeout(() => navigateFromMessage(msg, navRef), 500);
            }
        });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseMessage(
    msg: FirebaseMessagingTypes.RemoteMessage
): NotificationPayload | null {
    const data = msg.data ?? {};
    const type = data.type as NotificationType | undefined;
    if (!type) return null;

    return {
        type,
        friendUid: data.friendUid as string | undefined,
        matchId:   data.matchId   as string | undefined,
        title: msg.notification?.title ?? 'HORA',
        body:  msg.notification?.body  ?? '',
    };
}

function navigateFromMessage(
    msg: FirebaseMessagingTypes.RemoteMessage,
    navRef: NavRef
): void {
    if (!navRef.isReady()) return;
    const data = msg.data ?? {};
    const type = data.type as NotificationType | undefined;

    switch (type) {
        case 'matched':
            if (data.friendUid) {
                navRef.navigate('Matched', {
                    friendId:       data.friendUid as string,
                    friendName:     '',
                    friendUsername: '',
                });
            }
            break;

        case 'friend_online':
        case 'friend_offline':
            // Both cases: bring the user to HomeScreen to see the current state
            navRef.navigate('MainTabs');
            break;
    }
}