/**
 * InAppBanner.tsx
 *
 * A slide-down banner that appears when a foreground FCM notification arrives.
 * Mounts at the root of the app (inside AuthProvider, outside any navigator).
 * Auto-dismisses after 4 seconds. Tap to navigate.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../naviagtion/MainStack';
import { listenForeground, type NotificationPayload } from './notifications.service';

const BANNER_DURATION = 4000; // ms before auto-dismiss
const SLIDE_DURATION = 300;   // ms for slide animation

type NavProp = NativeStackNavigationProp<MainStackParamList>;

export default function InAppBanner() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<NavProp>();

    const [current, setCurrent] = useState<NotificationPayload | null>(null);
    const translateY = useRef(new Animated.Value(-120)).current;
    const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Show / hide animation ─────────────────────────────────────────────────

    const show = (payload: NotificationPayload) => {
        // Clear any existing timer so back-to-back notifications reset properly
        if (dismissTimer.current) clearTimeout(dismissTimer.current);

        setCurrent(payload);

        Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
        }).start();

        dismissTimer.current = setTimeout(hide, BANNER_DURATION);
    };

    const hide = () => {
        Animated.timing(translateY, {
            toValue: -120,
            duration: SLIDE_DURATION,
            useNativeDriver: true,
        }).start(() => setCurrent(null));
    };

    // ── Subscribe to foreground notifications ─────────────────────────────────

    useEffect(() => {
        const unsubscribe = listenForeground(show);
        return () => {
            unsubscribe();
            if (dismissTimer.current) clearTimeout(dismissTimer.current);
        };
    }, []);

    // ── Tap handler ───────────────────────────────────────────────────────────

    const handleTap = () => {
        if (!current) return;
        hide();

        if (current.type === 'matched' && current.friendUid) {
            navigation.navigate('Matched', {
                friendId: current.friendUid,
                friendName: '',
                friendUsername: '',
            });
        }
        // friend_online → no nav, banner is enough
    };

    if (!current) return null;

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <Animated.View
            style={[
                styles.banner,
                { top: insets.top + 8, transform: [{ translateY }] },
            ]}
            pointerEvents="box-none"
        >
            <TouchableOpacity
                style={styles.inner}
                onPress={handleTap}
                activeOpacity={0.92}
            >
                <View style={styles.icon}>
                    <Text style={styles.iconText}>
                        {current.type === 'matched' ? '🎉' : '🟢'}
                    </Text>
                </View>
                <View style={styles.textBlock}>
                    <Text style={styles.title} numberOfLines={1}>{current.title}</Text>
                    <Text style={styles.body} numberOfLines={2}>{current.body}</Text>
                </View>
                <TouchableOpacity onPress={hide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.dismiss}>✕</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    banner: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 9999,
        elevation: 20,
    },
    inner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A2E',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    icon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
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
        color: 'rgba(255,255,255,0.6)',
        lineHeight: 16,
    },
    dismiss: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.4)',
        paddingLeft: 4,
    },
});