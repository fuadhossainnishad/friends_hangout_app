import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MainStackParamList } from '../../naviagtion/MainStack';
import { useAuth } from '../../app/context/AuthProvider';
import { getFriends, toggleGhost, type FriendRecord } from '../../domain/friends/friends.service';
import Arrow from '../../assets/icons/arrow.svg';
import ViewIcon from '../../assets/icons/view.svg';
import ViewNotIcon from '../../assets/icons/view_not.svg';

type Props = NativeStackScreenProps<MainStackParamList, 'Activate'>;

function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Avatar color from username ───────────────────────────────────────────────

function avatarColor(username: string): string {
    const colors = ['#0052FF', '#00C6FF', '#7B2FF7', '#FF6B35', '#00D4AA'];
    return colors[username.charCodeAt(0) % colors.length];
}

// ─── Friend row ───────────────────────────────────────────────────────────────

function FriendRow({ record, onToggleGhost, isToggling }: {
    record: FriendRecord;
    onToggleGhost: (r: FriendRecord) => void;
    isToggling: boolean;
}) {
    return (
        <View style={styles.friendCard}>
            <View style={styles.friendInfo}>
                <View style={[styles.avatar, { backgroundColor: avatarColor(record.user.username) }]}>
                    <Text style={styles.avatarText}>
                        {record.user.username.charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.friendDetails}>
                    <Text style={styles.friendUsername}>@{record.user.username}</Text>
                    {record.isGhosted ? (
                        <Text style={styles.ghostedSubtext}>👻 Ghosted · Hidden from you</Text>
                    ) : (
                        <Text style={styles.visibleSubtext}>🟢 Will be notified</Text>
                    )}
                </View>
            </View>

            <TouchableOpacity
                style={[styles.ghostToggle, record.isGhosted && styles.ghostToggleActive]}
                onPress={() => onToggleGhost(record)}
                disabled={isToggling}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                {isToggling ? (
                    <ActivityIndicator size="small" color={record.isGhosted ? '#FF6B6B' : 'rgba(255,255,255,0.6)'} />
                ) : record.isGhosted ? (
                    <>
                        <ViewNotIcon width={13} height={13} />
                        <Text style={[styles.ghostToggleText, styles.ghostToggleTextActive]}>Ghosted</Text>
                    </>
                ) : (
                    <>
                        <ViewIcon width={13} height={13} />
                        <Text style={styles.ghostToggleText}>Ghost</Text>
                    </>
                )}
            </TouchableOpacity>
        </View>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ActivateScreen({ navigation }: Props) {
    const { user, setOnlineStatus } = useAuth();

    const [friends, setFriends] = useState<FriendRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGoingOnline, setIsGoingOnline] = useState(false);
    const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

    const [availableFrom, setAvailableFrom] = useState<'now' | 'later'>('now');
    const [laterTime, setLaterTime] = useState<Date>(() => {
        const d = new Date();
        d.setHours(d.getHours() + 1, 0, 0, 0);
        return d;
    });
    const [showTimePicker, setShowTimePicker] = useState(false);

    const loadFriends = useCallback(async () => {
        if (!user) return;
        try {
            const all = await getFriends(user.uid);
            setFriends(all.filter(f => f.status === 'accepted'));
        } catch (error: any) {
            Alert.alert('Error', error?.message ?? 'Failed to load friends.');
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => { loadFriends(); }, [loadFriends]);

    const handleToggleGhost = async (record: FriendRecord) => {
        if (!user) return;
        const nextGhosted = !record.isGhosted;
        setTogglingIds(prev => new Set(prev).add(record.friendshipId));
        setFriends(prev => prev.map(f =>
            f.friendshipId === record.friendshipId ? { ...f, isGhosted: nextGhosted } : f
        ));
        try {
            await toggleGhost(record.friendshipId, user.uid, nextGhosted);
        } catch (error: any) {
            setFriends(prev => prev.map(f =>
                f.friendshipId === record.friendshipId ? { ...f, isGhosted: record.isGhosted } : f
            ));
            Alert.alert('Error', error?.message ?? 'Could not update ghost setting.');
        } finally {
            setTogglingIds(prev => { const n = new Set(prev); n.delete(record.friendshipId); return n; });
        }
    };

    const visibleCount = friends.filter(f => !f.isGhosted).length;

    const goOnline = async () => {
        setIsGoingOnline(true);
        try {
            await setOnlineStatus(true);
            navigation.goBack();
        } catch (error: any) {
            Alert.alert('Error', error?.message ?? 'Could not go online. Please try again.');
        } finally {
            setIsGoingOnline(false);
        }
    };

    const handleGoOnline = () => {
        if (visibleCount === 0) {
            Alert.alert(
                'All friends ghosted',
                'No one will see you online. Continue anyway?',
                [{ text: 'Cancel', style: 'cancel' }, { text: 'Go Online', onPress: goOnline }]
            );
            return;
        }
        goOnline();
    };

    const handleTimeChange = (_: DateTimePickerEvent, selected?: Date) => {
        if (Platform.OS === 'android') setShowTimePicker(false);
        if (selected) setLaterTime(selected);
    };

    return (
        <View style={styles.root}>
            <LinearGradient colors={['#0B1F3F', '#0D2347', '#0A1628']} style={styles.root}>
                <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Arrow height={24} width={24} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Activate HORA</Text>
                        <View style={{ width: 24 }} />
                    </View>
                </SafeAreaView>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Description */}
                    <Text style={styles.description}>
                        Choose who can see you're online
                    </Text>

                    {/* Available from */}
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>AVAILABLE FROM</Text>
                        <View style={styles.timeOptions}>
                            <TouchableOpacity
                                style={[styles.timeOption, availableFrom === 'now' && styles.timeOptionActive]}
                                onPress={() => { setAvailableFrom('now'); setShowTimePicker(false); }}
                                activeOpacity={0.8}
                            >
                                {availableFrom === 'now' && (
                                    <LinearGradient colors={['#0052FF', '#0066FF']} style={StyleSheet.absoluteFill} />
                                )}
                                <Text style={[styles.timeOptionText, availableFrom === 'now' && styles.timeOptionTextActive]}>
                                    Now
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.timeOption, availableFrom === 'later' && styles.timeOptionActive]}
                                onPress={() => { setAvailableFrom('later'); setShowTimePicker(true); }}
                                activeOpacity={0.8}
                            >
                                {availableFrom === 'later' && (
                                    <LinearGradient colors={['#0052FF', '#0066FF']} style={StyleSheet.absoluteFill} />
                                )}
                                <Text style={[styles.timeOptionText, availableFrom === 'later' && styles.timeOptionTextActive]}>
                                    Later · {formatTime(laterTime)}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {showTimePicker && Platform.OS === 'ios' && (
                            <View style={styles.timePickerWrapper}>
                                <DateTimePicker
                                    value={laterTime}
                                    mode="time"
                                    display="spinner"
                                    onChange={handleTimeChange}
                                    minuteInterval={15}
                                    style={styles.timePicker}
                                    themeVariant="dark"
                                />
                            </View>
                        )}
                        {showTimePicker && Platform.OS === 'android' && (
                            <DateTimePicker
                                value={laterTime}
                                mode="time"
                                display="default"
                                onChange={handleTimeChange}
                                minuteInterval={15}
                            />
                        )}
                    </View>

                    {/* Friends list */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionLabel}>
                                FRIENDS
                            </Text>
                            <Text style={styles.sectionCount}>
                                {isLoading ? '…' : `${visibleCount} notified`}
                            </Text>
                        </View>

                        {isLoading ? (
                            <ActivityIndicator color="#4ADE80" style={styles.loader} />
                        ) : friends.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>👥</Text>
                                <Text style={styles.emptyTitle}>No friends yet</Text>
                                <Text style={styles.emptySubtitle}>
                                    Add friends first from the Friends tab
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.friendsList}>
                                {friends.map(f => (
                                    <FriendRow
                                        key={f.friendshipId}
                                        record={f}
                                        onToggleGhost={handleToggleGhost}
                                        isToggling={togglingIds.has(f.friendshipId)}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                </ScrollView>

                {/* Sticky footer */}
                <View style={[styles.footer, { paddingBottom: Platform.OS === 'ios' ? 34 : 20 }]}>
                    <TouchableOpacity
                        style={[styles.goOnlineButton, (isGoingOnline || isLoading) && styles.goOnlineButtonDisabled]}
                        onPress={handleGoOnline}
                        disabled={isGoingOnline || isLoading}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={isGoingOnline || isLoading ? ['#333', '#333'] : ['#0052FF', '#0066FF']}
                            style={styles.goOnlineGradient}
                        >
                            {isGoingOnline ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.goOnlineText}>
                                    Go Online · {visibleCount} friend{visibleCount !== 1 ? 's' : ''} notified
                                </Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },
    description: { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28, lineHeight: 20 },
    section: { marginBottom: 32 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionLabel: {
        fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
        letterSpacing: 1.4, marginBottom: 12,
    },
    sectionCount: { fontSize: 12, fontWeight: '600', color: '#4ADE80', marginBottom: 12 },
    timeOptions: { flexDirection: 'row', gap: 10 },
    timeOption: {
        flex: 1, paddingVertical: 13, paddingHorizontal: 16,
        borderRadius: 50, alignItems: 'center', overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    timeOptionActive: { borderColor: '#0052FF' },
    timeOptionText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
    timeOptionTextActive: { color: '#fff' },
    timePickerWrapper: {
        marginTop: 12, borderRadius: 16, overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    timePicker: { height: 150 },
    friendsList: { gap: 10 },
    friendCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        padding: 14, borderRadius: 16,
    },
    friendInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatar: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
    friendDetails: { flex: 1 },
    friendUsername: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 3 },
    visibleSubtext: { fontSize: 12, color: '#4ADE80' },
    ghostedSubtext: { fontSize: 12, color: '#FF6B6B' },
    ghostToggle: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        minWidth: 82, justifyContent: 'center',
    },
    ghostToggleActive: {
        backgroundColor: 'rgba(255,107,107,0.15)',
        borderColor: 'rgba(255,107,107,0.3)',
    },
    ghostToggleText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
    ghostToggleTextActive: { color: '#FF6B6B' },
    loader: { marginTop: 32 },
    emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
    emptyIcon: { fontSize: 44 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
    emptySubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingTop: 12,
        backgroundColor: 'rgba(10,22,40,0.95)',
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    },
    goOnlineButton: { borderRadius: 50, overflow: 'hidden' },
    goOnlineButtonDisabled: { opacity: 0.5 },
    goOnlineGradient: { paddingVertical: 16, alignItems: 'center', borderRadius: 50 },
    goOnlineText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});