/**
 * useNotificationSetup.ts
 *
 * Call this hook ONCE from AuthProvider (or your root component) immediately
 * after the authenticated user is available.
 *
 * What it does:
 *   1. On first mount with a logged-in user → requests OS notification permission
 *      (the system dialog appears automatically on iOS; on Android 13+ the
 *       dialog also appears; on older Android no dialog is needed).
 *   2. If permission is granted → registers the FCM token to Firestore.
 *   3. On logout (user becomes null) → removes the FCM token so this device
 *      stops receiving notifications.
 *
 * Permission is requested exactly once per app session (not on every render),
 * guarded by a ref so hot-reloads during development don't double-fire it.
 */

import { useEffect, useRef } from 'react';
import {
  registerFCMToken,
  requestNotificationPermission,
  unregisterFCMToken,
} from '../../domain/notifications/notifications.service';

export function useNotificationSetup(uid: string | null): void {
  const prevUidRef = useRef<string | null>(null);
  const permissionAskedRef = useRef(false);

  useEffect(() => {
    const prevUid = prevUidRef.current;
    prevUidRef.current = uid;

    // ── User just logged out ─────────────────────────────────────────────
    if (prevUid && !uid) {
      unregisterFCMToken(prevUid).catch(console.warn);
      permissionAskedRef.current = false; // reset so next login asks again
      return;
    }

    // ── User just logged in (or hook mounted with a session) ─────────────
    if (!uid || permissionAskedRef.current) return;
    permissionAskedRef.current = true;

    (async () => {
      const granted = await requestNotificationPermission();
      if (granted) {
        await registerFCMToken(uid);
      }
    })();
  }, [uid]);
}
