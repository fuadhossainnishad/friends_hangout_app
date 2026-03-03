import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Linking,
    ActivityIndicator,
    Image,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../naviagtion/MainStack';
import { getUserProfile, type UserProfile } from '../../domain/auth/auth.service';
import { useAuth } from '../../app/context/AuthProvider';

type Props = NativeStackScreenProps<MainStackParamList, 'Matched'>;

// ─── Contact actions ──────────────────────────────────────────────────────────

async function openWhatsApp(phoneNumber: string) {
    // Strip all non-digits — Firestore stores E.164 e.g. +8801711234567
    const digits = phoneNumber.replace(/\D/g, '');
    const url = `whatsapp://send?phone=${digits}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
        await Linking.openURL(url);
    } else {
        Alert.alert('WhatsApp not installed', 'Please install WhatsApp to message this friend.');
    }
}

async function openInstagram(username: string) {
    const clean = username.replace('@', '').trim();
    const appUrl = `instagram://user?username=${clean}`;
    const webUrl = `https://instagram.com/${clean}`;
    const canOpen = await Linking.canOpenURL(appUrl);
    await Linking.openURL(canOpen ? appUrl : webUrl);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MatchedScreen({ navigation, route }: Props) {
    const { friendId } = route.params;
    const { user: me } = useAuth();

    const [friend, setFriend] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getUserProfile(friendId)
            .then(setFriend)
            .catch(() => Alert.alert('Error', 'Could not load friend details.'))
            .finally(() => setIsLoading(false));
    }, [friendId]);

    const handleClose = () => navigation.navigate('MainTabs');

    // What contact details to show depends on the FRIEND's share preference
    const sharePreference = (friend as any)?.sharePreference ?? 'both';
    const showPhone = sharePreference === 'phone' || sharePreference === 'both';
    const showInstagram = sharePreference === 'instagram' || sharePreference === 'both';
    const hasInstagram = !!friend?.instagram_username?.trim();
    const hasPhone = !!friend?.phone_number?.trim();

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Close */}
            <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.logo}>HORA</Text>
                <Text style={styles.matchedLabel}>It's a match!</Text>
            </View>

            {/* Friend card */}
            {isLoading ? (
                <ActivityIndicator color="#fff" size="large" style={styles.loader} />
            ) : friend ? (
                <View style={styles.friendCard}>
                    {/* Avatar */}
                    {friend.profile ? (
                        <Image source={{ uri: friend.profile }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarFallback}>
                            <Text style={styles.avatarLetter}>
                                {friend.username.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <Text style={styles.friendUsername}>@{friend.username}</Text>

                    {/* Shared contact info */}
                    <View style={styles.contactInfo}>
                        {showPhone && hasPhone && (
                            <View style={styles.contactRow}>
                                <Text style={styles.contactLabel}>Phone</Text>
                                <Text style={styles.contactValue}>{friend.phone_number}</Text>
                            </View>
                        )}
                        {showInstagram && hasInstagram && (
                            <View style={styles.contactRow}>
                                <Text style={styles.contactLabel}>Instagram</Text>
                                <Text style={styles.contactValue}>@{friend.instagram_username}</Text>
                            </View>
                        )}
                        {!showPhone && !showInstagram && (
                            <Text style={styles.noContact}>No contact info shared</Text>
                        )}
                    </View>
                </View>
            ) : (
                <View style={styles.friendCard}>
                    <Text style={styles.noContact}>Could not load friend details</Text>
                </View>
            )}

            {/* Action buttons */}
            {friend && (
                <View style={styles.actions}>
                    {showPhone && hasPhone && (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => openWhatsApp(friend.phone_number)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.actionIcon}>💬</Text>
                            <Text style={styles.actionText}>Message on WhatsApp</Text>
                        </TouchableOpacity>
                    )}

                    {showInstagram && hasInstagram && (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => openInstagram(friend.instagram_username)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.actionIcon}>📷</Text>
                            <Text style={styles.actionText}>Open on Instagram</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Footer */}
            <TouchableOpacity
                style={styles.backButton}
                onPress={handleClose}
                activeOpacity={0.85}
            >
                <Text style={styles.backButtonText}>Back Online</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 88;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A1628',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 32,
    },
    closeButton: {
        alignSelf: 'flex-end',
        padding: 8,
    },
    closeIcon: {
        fontSize: 22,
        color: 'rgba(255,255,255,0.5)',
    },
    header: {
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 36,
        gap: 8,
    },
    logo: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 2,
    },
    matchedLabel: {
        fontSize: 36,
        fontWeight: '800',
        color: '#fff',
    },
    loader: {
        marginTop: 60,
    },
    friendCard: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        marginBottom: 4,
    },
    avatarFallback: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        backgroundColor: '#0052FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    avatarLetter: {
        fontSize: 36,
        fontWeight: '700',
        color: '#fff',
    },
    friendUsername: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    contactInfo: {
        width: '100%',
        marginTop: 8,
        gap: 10,
    },
    contactRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
    },
    contactLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.45)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    contactValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    noContact: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
    },
    actions: {
        gap: 12,
        marginTop: 24,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 14,
    },
    actionIcon: {
        fontSize: 22,
    },
    actionText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    backButton: {
        marginTop: 'auto',
        backgroundColor: '#fff',
        paddingVertical: 16,
        borderRadius: 50,
        alignItems: 'center',
    },
    backButtonText: {
        color: '#0A1628',
        fontSize: 16,
        fontWeight: '700',
    },
});