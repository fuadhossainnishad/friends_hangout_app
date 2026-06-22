/**
 * notifications.service.ts
 *
 * Responsibilities:
 *   • Register / refresh / remove the FCM token in Firestore
 *   • Foreground message listener (feeds InAppBanner)
 *   • Background / cold-start tap → navigation handler
 *
 * Permission flow lives in useNotificationSetup.ts (not here).
 * Cloud Functions handle all FCM fan-out sends.
 */

import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';

// ─── Public types ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'friend_request'
  | 'request_accepted'
  | 'friend_online'
  | 'friend_offline'
  | 'match_initiated'
  | 'matched';

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
 * Fetches the FCM token and persists it to /users/{uid}.fcmToken.
 * Sets up automatic token rotation via onTokenRefresh.
 * Only call this AFTER permission has been granted.
 */
export async function registerFCMToken(uid: string): Promise<void> {
  const token = await messaging().getToken();
  if (!token) return;

  await _saveToken(uid, token);

  // OS can rotate the token at any time; keep Firestore in sync.
  messaging().onTokenRefresh(newToken => {
    _saveToken(uid, newToken).catch(console.warn);
  });
}

/**
 * Deletes the FCM token from Firestore on logout so this device
 * stops receiving notifications.
 */
export async function unregisterFCMToken(uid: string): Promise<void> {
  await firestore()
    .collection('users')
    .doc(uid)
    .update({ fcmToken: firestore.FieldValue.delete() });
}

async function _saveToken(uid: string, token: string): Promise<void> {
  await firestore().collection('users').doc(uid).update({ fcmToken: token });
}

// ─── Foreground listener ──────────────────────────────────────────────────────

/**
 * Listens for FCM messages while the app is foregrounded.
 * Returns an unsubscribe function — wire into useEffect cleanup.
 */
export function listenForeground(
  onMessage: (payload: NotificationPayload) => void,
): () => void {
  return messaging().onMessage((msg: FirebaseMessagingTypes.RemoteMessage) => {
    const payload = _parseMessage(msg);
    if (payload) onMessage(payload);
  });
}

// ─── Background / killed tap handler ─────────────────────────────────────────

/**
 * Wires navigation for notification taps when the app is backgrounded or killed.
 * Call ONCE at app root — never inside a remounting component.
 */
export function setupBackgroundNotificationHandler(navRef: NavRef): void {
  messaging().onNotificationOpenedApp(msg => {
    _navigateFromMessage(msg, navRef);
  });

  messaging()
    .getInitialNotification()
    .then(msg => {
      if (msg) {
        // Brief delay — let the navigator finish mounting on cold start.
        setTimeout(() => _navigateFromMessage(msg, navRef), 500);
      }
    });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _parseMessage(
  msg: FirebaseMessagingTypes.RemoteMessage,
): NotificationPayload | null {
  const data = msg.data ?? {};
  const type = data.type as NotificationType | undefined;
  if (!type) return null;

  return {
    type,
    friendUid: data.friendUid as string | undefined,
    matchId: data.matchId as string | undefined,
    title: msg.notification?.title ?? 'HORA',
    body: msg.notification?.body ?? '',
  };
}

function _navigateFromMessage(
  msg: FirebaseMessagingTypes.RemoteMessage,
  navRef: NavRef,
): void {
  if (!navRef.isReady()) return;
  const data = msg.data ?? {};
  const type = data.type as NotificationType | undefined;

  switch (type) {
    case 'friend_request':
    case 'request_accepted':
      navRef.navigate('MainTabs', { screen: 'Friends' });
      break;

    case 'matched':
      if (data.matchId) {
        navRef.navigate('Matched', {
          friendId: data.matchId as string,
          friendName: '',
          friendUsername: '',
        });
      }
      break;

    case 'friend_online':
    case 'friend_offline':
      navRef.navigate('MainTabs');
      break;
  }
}
