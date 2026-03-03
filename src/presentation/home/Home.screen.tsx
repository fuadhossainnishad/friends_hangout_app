import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../../app/context/AuthProvider';
import { getOnlineFriends, type OnlineFriendRecord } from '../../domain/friends/friends.service';
import { MainStackParamList } from '../../naviagtion/MainStack';
import { createMatch } from '../../domain/friends/match.service';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

// ─── Online friend card ───────────────────────────────────────────────────────

function OnlineFriendCard({
    record,
    onMatch,
    isMatching,
}: {
    record: OnlineFriendRecord;
    onMatch: (record: OnlineFriendRecord) => void;
    isMatching: boolean;
}) {
    const { user } = record;
    return (
        <View style={styles.friendCard}>
            <View style={styles.friendCardLeft}>
                <View style={styles.avatarWrapper}>
                    {user.profile ? (
                        <Image source={{ uri: user.profile }} style={styles.avatarImage} />
                    ) : (
                        <View style={styles.avatarFallback}>
                            <Text style={styles.avatarLetter}>
                                {user.username.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <View style={styles.onlineDot} />
                </View>
                <View style={styles.friendInfo}>
                    <Text style={styles.friendUsername}>@{user.username}</Text>
                    <Text style={styles.friendAvailability}>Available Now</Text>
                </View>
            </View>

            <TouchableOpacity
                style={[styles.matchButton, isMatching && styles.matchButtonDisabled]}
                onPress={() => onMatch(record)}
                disabled={isMatching}
                activeOpacity={0.8}
            >
                {isMatching
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.matchButtonText}>Match</Text>
                }
            </TouchableOpacity>
        </View>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
    const navigation = useNavigation<NavigationProp>();
    const { user, setOnlineStatus } = useAuth();

    const [onlineFriends, setOnlineFriends] = useState<OnlineFriendRecord[]>([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(false);
    // Track which friend is mid-match request to prevent double-taps
    const [matchingUid, setMatchingUid] = useState<string | null>(null);

    // ── Load online friends ───────────────────────────────────────────────────

    const loadOnlineFriends = useCallback(async () => {
        if (!user) return;
        setIsLoadingFriends(true);
        try {
            const friends = await getOnlineFriends(user.uid);
            setOnlineFriends(friends);
        } catch (error: any) {
            Alert.alert('Error', error?.message ?? 'Could not load online friends.');
        } finally {
            setIsLoadingFriends(false);
        }
    }, [user]);

    useEffect(() => {
        if (user?.isOnline) {
            loadOnlineFriends();
        } else {
            setOnlineFriends([]);
        }
    }, [user?.isOnline, loadOnlineFriends]);

    // ── Actions ───────────────────────────────────────────────────────────────

    const handleGoOnline = () => navigation.navigate('Activate');

    const handleGoOffline = async () => {
        try {
            await setOnlineStatus(false);
        } catch (error: any) {
            Alert.alert('Error', error?.message ?? 'Could not go offline.');
        }
    };

    /**
     * Match flow:
     *   1. Create /matches doc in Firestore
     *   2. Cloud Function fires → sends FCM push to the matched friend
     *   3. Navigate current user to MatchedScreen immediately
     *   4. Friend receives the push notification and taps it → also lands on MatchedScreen
     */
    const handleMatch = async (record: OnlineFriendRecord) => {
        if (!user || matchingUid) return;
        setMatchingUid(record.user.uid);
        try {
            await createMatch(user.uid, record.user.uid);
            navigation.navigate('Matched', {
                friendId: record.user.uid,
                friendName: record.user.username,
                friendUsername: record.user.username,
            });
        } catch (error: any) {
            Alert.alert('Error', error?.message ?? 'Could not create match.');
        } finally {
            setMatchingUid(null);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // ONLINE STATE
    // ─────────────────────────────────────────────────────────────────────────

    if (user?.isOnline) {
        return (
            <LinearGradient
                colors={['#0B1F3F', '#1A2F4F', '#0B1F3F']}
                locations={[0, 0.5, 1]}
                style={styles.flex}
            >
                <SafeAreaView edges={['top']} style={styles.flex}>
                    <ScrollView
                        contentContainerStyle={styles.onlineScroll}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Header */}
                        <View style={styles.onlineHeader}>
                            <View>
                                <Text style={styles.onlineTitle}>HORA</Text>
                                <Text style={styles.onlineSubtitle}>You're online</Text>
                            </View>
                            <View style={styles.onlineBadge}>
                                <View style={styles.onlineBadgeDot} />
                                <Text style={styles.onlineBadgeText}>Online</Text>
                            </View>
                        </View>

                        <Text style={styles.sectionTitle}>Friends Online Now</Text>
                        <Text style={styles.sectionSubtitle}>
                            {isLoadingFriends
                                ? 'Loading…'
                                : `${onlineFriends.length} friend${onlineFriends.length !== 1 ? 's' : ''} available`
                            }
                        </Text>

                        {isLoadingFriends ? (
                            <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
                        ) : onlineFriends.length === 0 ? (
                            <View style={styles.emptyOnline}>
                                <Text style={styles.emptyOnlineTitle}>No friends online</Text>
                                <Text style={styles.emptyOnlineSubtitle}>
                                    You'll get a notification when one comes online
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.friendsList}>
                                {onlineFriends.map(record => (
                                    <OnlineFriendCard
                                        key={record.friendshipId}
                                        record={record}
                                        onMatch={handleMatch}
                                        isMatching={matchingUid === record.user.uid}
                                    />
                                ))}
                            </View>
                        )}

                        {!isLoadingFriends && (
                            <TouchableOpacity style={styles.refreshButton} onPress={loadOnlineFriends}>
                                <Text style={styles.refreshText}>Refresh</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.goOfflineButton} onPress={handleGoOffline}>
                            <Text style={styles.goOfflineText}>Go Offline</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OFFLINE STATE
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <View style={styles.offlineContainer}>
            <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
                <View style={styles.offlineHeader}>
                    <View>
                        <Text style={styles.offlineTitle}>HORA</Text>
                        <Text style={styles.offlineSubtitle}>You're offline</Text>
                    </View>
                    <View style={styles.offlineBadge}>
                        <View style={styles.offlineBadgeDot} />
                        <Text style={styles.offlineBadgeText}>Offline</Text>
                    </View>
                </View>

                <View style={styles.offlineBody}>
                    <View style={styles.goOnlineWrapper}>
                        <LinearGradient
                            colors={['rgba(0,82,255,0.5)', 'rgba(0,82,255,0.2)', 'rgba(0,82,255,0)']}
                            style={styles.glowEffect}
                        />
                        <TouchableOpacity
                            style={styles.goOnlineButton}
                            onPress={handleGoOnline}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.goOnlineText}>ON</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.counterCard}>
                        <Text style={styles.counterLabel}>FRIENDS ONLINE RIGHT NOW</Text>
                        <OnlineFriendsCounter myUid={user?.uid} />
                    </View>

                    <Text style={styles.offlineHint}>
                        When you go online, your friends are notified and can match with you
                    </Text>
                </View>
            </SafeAreaView>
        </View>
    );
}

// ─── Counter (offline state) ──────────────────────────────────────────────────

function OnlineFriendsCounter({ myUid }: { myUid?: string }) {
    const [count, setCount] = useState<number | null>(null);
    useEffect(() => {
        if (!myUid) return;
        getOnlineFriends(myUid).then(f => setCount(f.length)).catch(() => setCount(0));
    }, [myUid]);
    if (count === null) return <ActivityIndicator color="#00FFB3" style={{ marginTop: 8 }} />;
    return <Text style={styles.counterValue}>{count}</Text>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 48;

const styles = StyleSheet.create({
    flex: { flex: 1 },
    onlineScroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
    onlineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
    onlineTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 2 },
    onlineSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
    onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(74,222,128,0.15)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50 },
    onlineBadgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
    onlineBadgeText: { fontSize: 12, fontWeight: '600', color: '#4ADE80' },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
    sectionSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20 },
    friendsList: { gap: 12 },
    friendCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,82,255,0.12)', borderWidth: 1, borderColor: 'rgba(0,82,255,0.2)', padding: 14, borderRadius: 16 },
    friendCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatarWrapper: { position: 'relative', width: AVATAR_SIZE, height: AVATAR_SIZE, marginRight: 12 },
    avatarImage: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
    avatarFallback: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: 'rgba(0,82,255,0.3)', justifyContent: 'center', alignItems: 'center' },
    avatarLetter: { fontSize: 20, fontWeight: '700', color: '#fff' },
    onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#4ADE80', borderWidth: 2, borderColor: '#1A2F4F' },
    friendInfo: { flex: 1 },
    friendUsername: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 2 },
    friendAvailability: { fontSize: 12, color: '#4ADE80' },
    matchButton: { backgroundColor: '#0052FF', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 50, minWidth: 72, alignItems: 'center', justifyContent: 'center', minHeight: 36 },
    matchButtonDisabled: { opacity: 0.5 },
    matchButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    emptyOnline: { alignItems: 'center', paddingVertical: 48, gap: 6 },
    emptyOnlineTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
    emptyOnlineSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
    refreshButton: { alignSelf: 'center', marginTop: 20, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    refreshText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
    goOfflineButton: { marginTop: 24, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
    goOfflineText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 15 },
    offlineContainer: { flex: 1, backgroundColor: '#0A1628' },
    offlineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
    offlineTitle: { fontSize: 28, fontWeight: '700', color: '#fff' },
    offlineSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
    offlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 50 },
    offlineBadgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
    offlineBadgeText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
    offlineBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: '18%', gap: 32 },
    goOnlineWrapper: { width: '100%', alignItems: 'center' },
    glowEffect: { position: 'absolute', width: '140%', height: '140%', borderRadius: 200, top: '-20%', alignSelf: 'center' },
    goOnlineButton: { width: '100%', backgroundColor: '#0052FF', paddingVertical: 40, borderRadius: 999, alignItems: 'center', shadowColor: '#0052FF', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.6, shadowRadius: 40, elevation: 14 },
    goOnlineText: { color: '#fff', fontSize: 22, fontWeight: '700' },
    counterCard: { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, paddingVertical: 28, alignItems: 'center', gap: 8 },
    counterLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.2 },
    counterValue: { fontSize: 64, fontWeight: '700', color: '#00FFB3', lineHeight: 72 },
    offlineHint: { color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});