/**
 * useNotificationSetup.ts
 *
 * Handles the full FCM permission + token lifecycle.
 *
 * PLACEMENT: Call this inside AuthProvider, passing `user?.uid ?? null`.
 *
 * WHY THE PREVIOUS VERSION BROKE:
 *   AuthProvider starts in `status: 'loading'` so uid is null on first render.
 *   The hook fired with null → null (no-op), then null → uid (ran the flow).
 *   BUT if _permissionFlowRan was already true from a previous Metro fast-refresh
 *   or a previous session in the same JS runtime, the guard silently skipped it.
 *
 * THIS VERSION fixes that with two changes:
 *   1. Module-level flag is keyed by uid, not a boolean.
 *      A fresh uid always gets a fresh flow — no stale guard blocks it.
 *   2. The flow is triggered purely by "uid just went from falsy → truthy",
 *      which is the only reliable signal that login just completed.
 */

import { useEffect, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import {
  registerFCMToken,
  unregisterFCMToken,
} from '../../domain/notifications/notifications.service';

// Track which uids have already had the permission flow run this JS runtime.
// Using a Set of uids (not a boolean) means a fresh login always triggers it,
// even after hot-reload or fast-refresh during development.
const _ranForUids = new Set<string>();

export function useNotificationSetup(uid: string | null): void {
  const prevUidRef = useRef<string | null>(null);

  useEffect(() => {
    const prevUid = prevUidRef.current;
    prevUidRef.current = uid;

    // ── Logout: uid went truthy → null ───────────────────────────────────
    if (prevUid && !uid) {
      _ranForUids.delete(prevUid); // allow re-trigger on next login
      unregisterFCMToken(prevUid).catch(console.warn);
      return;
    }

    // ── Not logged in yet ────────────────────────────────────────────────
    if (!uid) return;

    // ── Already ran for this uid this session ────────────────────────────
    if (_ranForUids.has(uid)) return;
    _ranForUids.add(uid);

    _runPermissionFlow(uid);
  }, [uid]);
}

// ─── Core permission flow ─────────────────────────────────────────────────────

async function _runPermissionFlow(uid: string): Promise<void> {
  try {
    const status = await messaging().hasPermission();

    switch (status) {
      case messaging.AuthorizationStatus.AUTHORIZED:
      case messaging.AuthorizationStatus.PROVISIONAL:
        // Already granted — just make sure the token is saved.
        await registerFCMToken(uid);
        return;

      case messaging.AuthorizationStatus.NOT_DETERMINED:
        // First time — show the native OS dialog.
        await _requestAndRegister(uid);
        return;

      case messaging.AuthorizationStatus.DENIED:
        if (Platform.OS === 'ios') {
          // iOS never re-shows the dialog once denied; offer Settings instead.
          _showSettingsAlert();
        }
        // Android: OS manages re-request timing; nothing to do here.
        return;
    }
  } catch (err) {
    // Remove from the set so the next render retry can try again.
    _ranForUids.delete(uid);
    console.warn('[FCM] Permission flow error:', err);
  }
}

// ─── Request and register ─────────────────────────────────────────────────────

async function _requestAndRegister(uid: string): Promise<void> {
  const result = await messaging().requestPermission({
    alert: true,
    badge: true,
    sound: true,
    announcement: false,
    carPlay: false,
    criticalAlert: false,
    provisional: false,
  });

  const granted =
    result === messaging.AuthorizationStatus.AUTHORIZED ||
    result === messaging.AuthorizationStatus.PROVISIONAL;

  if (granted) {
    await registerFCMToken(uid);
  }
}

// ─── iOS Settings redirect ────────────────────────────────────────────────────

function _showSettingsAlert(): void {
  Alert.alert(
    'Enable Notifications',
    'HORA needs notification permission to let you know when friends come online. Enable it in Settings.',
    [
      { text: 'Not Now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
    { cancelable: true },
  );
}
