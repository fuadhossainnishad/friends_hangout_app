/**
 * MatchedScreen.tsx
 *
 * Shown to both parties when status → 'accepted'.
 * Subscribes to /matches/{matchId} in real time so contact details
 * appear the moment the Cloud Function writes them (1-2 s after match).
 *
 * Navigation params:
 *   matchId   string  — Firestore match document id
 *   myUid     string  — the current user's uid (to know which side to show)
 *
 * What it shows:
 *   • The matched friend's username + avatar
 *   • Phone number (if shared)
 *   • Instagram handle (if shared)
 *   • Profile image (if set)
 */

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { MainStackParamList } from '../../naviagtion/MainStack';
import { useAuth } from '../../app/context/AuthProvider';
import { MatchDoc, subscribeToMatch } from '../../domain/friends/match.service';

type Props = NativeStackScreenProps<MainStackParamList, 'Matched'>;

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 80 }: { name: string; size?: number }) {
    const colors = ['#0052FF', '#00C6FF', '#7B2FF7', '#FF6B35', '#00D4AA'];
    const bg = colors[name.charCodeAt(0) % colors.length];
    return (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
            <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
                {name.charAt(0).toUpperCase()}
            </Text>
        </View>
    );
}

// ─── Contact row ──────────────────────────────────────────────────────────────

function ContactRow({ icon, label, value, onPress }: {
    icon: string;
    label: string;
    value: string;
    onPress?: () => void;
}) {
    const inner = (
        <View style={styles.contactRow}>
            <View style={styles.contactIcon}>
                <Text style={styles.contactIconText}>{icon}</Text>
            </View>
            <View style={styles.contactText}>
                <Text style={styles.contactLabel}>{label}</Text>
                <Text style={styles.contactValue}>{value}</Text>
            </View>
            {onPress && <Text style={styles.contactChevron}>›</Text>}
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
                {inner}
            </TouchableOpacity>
        );
    }
    return inner;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MatchedScreen({ route, navigation }: Props) {
    const { matchId } = route.params;
    const { user } = useAuth();

    const [match, setMatch] = useState<MatchDoc | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Subscribe to real-time updates — contact info arrives 1-2 s after match
    useEffect(() => {
        const unsub = subscribeToMatch(
            matchId,
            doc => {
                setMatch(doc);
                setIsLoading(false);
            },
            () => setIsLoading(false),
        );
        return unsub;
    }, [matchId]);

    // Determine which side of the match we are on
    const isInitiator = match?.initiator_uid === user?.uid;

    const friendUsername = isInitiator ? match?.target_username : match?.initiator_username;
    const friendPhone = isInitiator ? match?.target_phone : match?.initiator_phone;
    const friendInsta = isInitiator ? match?.target_instagram : match?.initiator_instagram;

    const hasContactInfo = Boolean(friendPhone || friendInsta);

    // Contact details may not be written yet — poll briefly with the loader
    const contactReady = match?.status === 'accepted' && (
        isInitiator
            ? match?.target_username !== undefined
            : match?.initiator_username !== undefined
    );

    return (
        <View style={styles.root}>
            <LinearGradient colors={['#0B1F3F', '#0D2347', '#0A1628']} style={styles.root}>
                <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Celebration header */}
                        <Text style={styles.emoji}>🎉</Text>
                        <Text style={styles.heading}>It's a Match!</Text>
                        <Text style={styles.subheading}>
                            You and{' '}
                            <Text style={styles.subheadingBold}>
                                @{friendUsername ?? '...'}
                            </Text>{' '}
                            matched each other.
                        </Text>

                        {/* Avatar */}
                        {friendUsername ? (
                            <View style={styles.avatarWrapper}>
                                <Avatar name={friendUsername} size={88} />
                                <Text style={styles.friendName}>@{friendUsername}</Text>
                            </View>
                        ) : null}

                        {/* Contact info section */}
                        {isLoading || !contactReady ? (
                            <View style={styles.loadingBlock}>
                                <ActivityIndicator color="#4ADE80" />
                                <Text style={styles.loadingText}>Loading contact details…</Text>
                            </View>
                        ) : !hasContactInfo ? (
                            <View style={styles.noContactBlock}>
                                <Text style={styles.noContactIcon}>🤷</Text>
                                <Text style={styles.noContactText}>
                                    @{friendUsername} hasn't shared any contact info yet.
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.contactCard}>
                                <Text style={styles.contactCardLabel}>CONTACT INFO</Text>

                                {friendPhone ? (
                                    <ContactRow
                                        icon="📱"
                                        label="Phone"
                                        value={friendPhone}
                                        onPress={() => Linking.openURL(`tel:${friendPhone}`)}
                                    />
                                ) : null}

                                {friendPhone && friendInsta ? (
                                    <View style={styles.contactDivider} />
                                ) : null}

                                {friendInsta ? (
                                    <ContactRow
                                        icon="📸"
                                        label="Instagram"
                                        value={`@${friendInsta}`}
                                        onPress={() =>
                                            Linking.openURL(`https://instagram.com/${friendInsta}`)
                                        }
                                    />
                                ) : null}
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.doneBtn}
                            onPress={() => navigation.navigate('MainTabs')}
                            activeOpacity={0.85}
                        >
                            <LinearGradient colors={['#0052FF', '#0066FF']} style={styles.doneBtnGradient}>
                                <Text style={styles.doneBtnText}>Done</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: { flex: 1 },
    scrollContent: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 120, alignItems: 'center', gap: 20 },
    emoji: { fontSize: 56 },
    heading: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    subheading: { fontSize: 16, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 24 },
    subheadingBold: { color: '#fff', fontWeight: '700' },
    avatarWrapper: { alignItems: 'center', gap: 12, marginTop: 8 },
    avatar: { justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontWeight: '800', color: '#fff' },
    friendName: { fontSize: 18, fontWeight: '700', color: '#fff' },
    loadingBlock: { alignItems: 'center', gap: 12, marginTop: 16 },
    loadingText: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
    noContactBlock: { alignItems: 'center', gap: 10, marginTop: 16 },
    noContactIcon: { fontSize: 36 },
    noContactText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
    contactCard: {
        width: '100%', marginTop: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 18, overflow: 'hidden',
    },
    contactCardLabel: {
        fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
        letterSpacing: 1.4, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
    },
    contactRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
    contactIcon: {
        width: 42, height: 42, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.07)',
        justifyContent: 'center', alignItems: 'center',
    },
    contactIconText: { fontSize: 20 },
    contactText: { flex: 1 },
    contactLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
    contactValue: { fontSize: 16, fontWeight: '600', color: '#fff' },
    contactChevron: { fontSize: 24, color: 'rgba(255,255,255,0.22)', fontWeight: '300' },
    contactDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 },
    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 24, paddingTop: 12, paddingBottom: 34,
        backgroundColor: 'rgba(10,22,40,0.95)',
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    },
    doneBtn: { borderRadius: 50, overflow: 'hidden' },
    doneBtnGradient: { paddingVertical: 16, alignItems: 'center', borderRadius: 50 },
    doneBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});