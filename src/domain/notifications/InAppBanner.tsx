/**
 * InAppBanner.tsx
 *
 * Slide-down banner for foreground FCM notifications.
 * Mount once at app root (inside NavigationContainer, outside screen stack).
 * Auto-dismisses after 4 s. Tappable for navigation.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../naviagtion/MainStack';
import { listenForeground, type NotificationPayload, type NotificationType } from './notifications.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 4000;
const SLIDE_MS = 300;
const BANNER_HEIGHT = 120; // safe offscreen translate value

// ─── Icon / accent config per notification type ───────────────────────────────

const TYPE_CONFIG: Record<NotificationType, { icon: string; accent: string }> = {
    friend_online: { icon: '🟢', accent: 'rgba(74,222,128,0.12)' },
    friend_offline: { icon: '⚫', accent: 'rgba(255,255,255,0.06)' },
    matched: { icon: '🎉', accent: 'rgba(0,82,255,0.18)' },
};

// ─── Component ────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<MainStackParamList>;

export default function InAppBanner() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<NavProp>();

    const [payload, setPayload] = useState<NotificationPayload | null>(null);
    const translateY = useRef(new Animated.Value(-BANNER_HEIGHT)).current;
    const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Track whether banner is currently visible to avoid animating on stale state
    const isVisible = useRef(false);

    // ── Animation helpers ─────────────────────────────────────────────────────

    const slideIn = useCallback(() => {
        isVisible.current = true;
        Animated.spring(translateY, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: true,
        }).start();
    }, [translateY]);

    const slideOut = useCallback((onDone?: () => void) => {
        isVisible.current = false;
        Animated.timing(translateY, {
            toValue: -BANNER_HEIGHT,
            duration: SLIDE_MS,
            useNativeDriver: true,
        }).start(() => {
            setPayload(null);
            onDone?.();
        });
    }, [translateY]);

    // ── Show ──────────────────────────────────────────────────────────────────

    const show = useCallback((incoming: NotificationPayload) => {
        // Cancel any pending auto-dismiss
        if (dismissTimer.current) clearTimeout(dismissTimer.current);

        if (isVisible.current) {
            // Already showing — slide out first, then immediately show new one
            slideOut(() => {
                setPayload(incoming);
                slideIn();
                dismissTimer.current = setTimeout(() => slideOut(), AUTO_DISMISS_MS);
            });
        } else {
            setPayload(incoming);
            slideIn();
            dismissTimer.current = setTimeout(() => slideOut(), AUTO_DISMISS_MS);
        }
    }, [slideIn, slideOut]);

    // ── Subscribe ─────────────────────────────────────────────────────────────

    useEffect(() => {
        const unsubscribe = listenForeground(show);
        return () => {
            unsubscribe();
            if (dismissTimer.current) clearTimeout(dismissTimer.current);
        };
    }, [show]);

    // ── Tap ───────────────────────────────────────────────────────────────────

    const handleTap = useCallback(() => {
        if (!payload) return;
        slideOut();

        switch (payload.type) {
            case 'matched':
                if (payload.friendUid) {
                    navigation.navigate('Matched', {
                        friendId: payload.friendUid,
                        friendName: '',
                        friendUsername: '',
                    });
                }
                break;

            case 'friend_online':
            case 'friend_offline':
                navigation.navigate('MainTabs');
                break;
        }
    }, [payload, slideOut, navigation]);

    // ── Render ────────────────────────────────────────────────────────────────

    if (!payload) return null;

    const config = TYPE_CONFIG[payload.type];

    return (
        <Animated.View
            style={[
                styles.root,
                { top: insets.top + 8, transform: [{ translateY }] },
            ]}
            pointerEvents="box-none"
        >
            <TouchableOpacity
                style={[styles.card, { backgroundColor: '#111827', borderColor: config.accent }]}
                onPress={handleTap}
                activeOpacity={0.9}
            >
                {/* Icon bubble */}
                <View style={[styles.iconBubble, { backgroundColor: config.accent }]}>
                    <Text style={styles.iconText}>{config.icon}</Text>
                </View>

                {/* Text */}
                <View style={styles.textBlock}>
                    <Text style={styles.title} numberOfLines={1}>{payload.title}</Text>
                    <Text style={styles.body} numberOfLines={2}>{payload.body}</Text>
                </View>

                {/* Dismiss */}
                <TouchableOpacity
                    onPress={() => slideOut()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Text style={styles.dismissIcon}>✕</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 9999,
        elevation: 20,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        paddingVertical: 14,
        paddingHorizontal: 14,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
    },
    iconBubble: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconText: {
        fontSize: 20,
    },
    textBlock: {
        flex: 1,
        gap: 2,
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    body: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.55)',
        lineHeight: 17,
    },
    dismissIcon: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.35)',
        padding: 2,
    },
});