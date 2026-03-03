import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, StyleSheet,
    TextInput, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { MainStackParamList } from '../../naviagtion/MainStack';
import { useAuth } from '../../app/context/AuthProvider';
import {
    getFriends, searchUsersByUsername, sendFriendRequest,
    acceptFriendRequest, removeFriend, toggleGhost, type FriendRecord,
} from '../../domain/friends/friends.service';
import { type UserProfile } from '../../domain/auth/auth.service';
import ArrowIcon from '../../assets/icons/arrow.svg';
import DeleteIcon from '../../assets/icons/delete.svg';
import ViewIcon from '../../assets/icons/view.svg';
import ViewNotIcon from '../../assets/icons/view_not.svg';
import AddFriendIcon from '../../assets/icons/add_friends.svg';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

function Avatar({ name, size = 46 }: { name: string; size?: number }) {
    const colors = ['#0052FF', '#00C6FF', '#7B2FF7', '#FF6B35', '#00D4AA'];
    const color = colors[name.charCodeAt(0) % colors.length];
    return (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
            <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{name.charAt(0).toUpperCase()}</Text>
        </View>
    );
}

function FriendCard({ record, onAccept, onGhostToggle, onRemove, isAccepting }: {
    record: FriendRecord;
    onAccept: (r: FriendRecord) => void;
    onGhostToggle: (r: FriendRecord) => void;
    onRemove: (r: FriendRecord) => void;
    isAccepting: boolean;
}) {
    const isPendingIncoming = record.isPending && !record.isSentByMe;
    const isPendingOutgoing = record.isPending && record.isSentByMe;

    return (
        <View style={styles.friendCard}>
            <View style={styles.friendCardInner}>
                <Avatar name={record.user.username} />
                <View style={styles.friendMeta}>
                    <Text style={styles.friendUsername}>@{record.user.username}</Text>
                    {isPendingOutgoing && <Text style={styles.pendingBadge}>Request sent</Text>}
                    {record.status === 'accepted' && record.isGhosted && (
                        <Text style={styles.ghostedBadge}>👻 Ghosted</Text>
                    )}
                    {isPendingIncoming && <Text style={styles.incomingBadge}>Wants to connect</Text>}
                </View>
            </View>

            <View style={styles.cardActions}>
                {isPendingIncoming && (
                    <>
                        <TouchableOpacity
                            style={[styles.acceptBtn, isAccepting && styles.btnDisabled]}
                            onPress={() => onAccept(record)}
                            disabled={isAccepting}
                        >
                            {isAccepting
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={styles.acceptBtnText}>Accept</Text>
                            }
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => onRemove(record)}>
                            <DeleteIcon width={18} height={18} />
                        </TouchableOpacity>
                    </>
                )}
                {record.status === 'accepted' && (
                    <>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => onGhostToggle(record)}>
                            {record.isGhosted ? <ViewNotIcon width={18} height={18} /> : <ViewIcon width={18} height={18} />}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => onRemove(record)}>
                            <DeleteIcon width={18} height={18} />
                        </TouchableOpacity>
                    </>
                )}
                {isPendingOutgoing && (
                    <TouchableOpacity style={styles.iconBtn} onPress={() => onRemove(record)}>
                        <DeleteIcon width={18} height={18} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

function SearchResult({ user, onAdd, isAdding }: { user: UserProfile; onAdd: (u: UserProfile) => void; isAdding: boolean }) {
    return (
        <View style={styles.searchResultRow}>
            <View style={styles.friendCardInner}>
                <Avatar name={user.username} />
                <Text style={styles.friendUsername}>@{user.username}</Text>
            </View>
            <TouchableOpacity style={[styles.acceptBtn, isAdding && styles.btnDisabled]} onPress={() => onAdd(user)} disabled={isAdding}>
                {isAdding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.acceptBtnText}>Add</Text>}
            </TouchableOpacity>
        </View>
    );
}

function ConfirmModal({ visible, title, message, confirmLabel, confirmDestructive, onConfirm, onCancel }: {
    visible: boolean; title: string; message: string; confirmLabel: string;
    confirmDestructive?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalBox}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <Text style={styles.modalMsg}>{message}</Text>
                    <View style={styles.modalBtns}>
                        <TouchableOpacity onPress={onCancel} style={styles.modalCancel}>
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onConfirm}
                            style={[styles.modalConfirm, confirmDestructive && styles.modalConfirmRed]}
                        >
                            <Text style={styles.modalConfirmText}>{confirmLabel}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export default function FriendsScreen() {
    const navigation = useNavigation<NavigationProp>();
    const { user } = useAuth();

    const [friends, setFriends] = useState<FriendRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());
    const [addingUids, setAddingUids] = useState<Set<string>>(new Set());
    const [removeTarget, setRemoveTarget] = useState<FriendRecord | null>(null);
    const [ghostTarget, setGhostTarget] = useState<FriendRecord | null>(null);

    const loadFriends = useCallback(async () => {
        if (!user) return;
        try {
            setFriends(await getFriends(user.uid));
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed to load friends.');
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => { loadFriends(); }, [loadFriends]);

    const existingUids = useMemo(() => new Set(friends.map(f => f.user.uid)), [friends]);

    useEffect(() => {
        if (!showSearch || searchQuery.trim().length < 2) { setSearchResults([]); return; }
        const t = setTimeout(async () => {
            if (!user) return;
            setIsSearching(true);
            try { setSearchResults(await searchUsersByUsername(searchQuery, user.uid, existingUids)); }
            catch { setSearchResults([]); }
            finally { setIsSearching(false); }
        }, 350);
        return () => clearTimeout(t);
    }, [searchQuery, showSearch, user, existingUids]);

    const handleAddFriend = async (target: UserProfile) => {
        if (!user) return;
        setAddingUids(prev => new Set(prev).add(target.uid));
        try {
            await sendFriendRequest(user.uid, target.uid);
            await loadFriends();
            setSearchResults(prev => prev.filter(u => u.uid !== target.uid));
        } catch (e: any) { Alert.alert('Error', e?.message); }
        finally { setAddingUids(prev => { const n = new Set(prev); n.delete(target.uid); return n; }); }
    };

    const handleAccept = async (record: FriendRecord) => {
        if (!user) return;
        setAcceptingIds(prev => new Set(prev).add(record.friendshipId));
        try {
            await acceptFriendRequest(record.friendshipId, user.uid);
            setFriends(prev => prev.map(f => f.friendshipId === record.friendshipId ? { ...f, status: 'accepted', isPending: false } : f));
        } catch (e: any) { Alert.alert('Error', e?.message); }
        finally { setAcceptingIds(prev => { const n = new Set(prev); n.delete(record.friendshipId); return n; }); }
    };

    const handleConfirmGhost = async () => {
        if (!ghostTarget || !user) return;
        const next = !ghostTarget.isGhosted;
        try {
            await toggleGhost(ghostTarget.friendshipId, user.uid, next);
            setFriends(prev => prev.map(f => f.friendshipId === ghostTarget.friendshipId ? { ...f, isGhosted: next } : f));
        } catch (e: any) { Alert.alert('Error', e?.message); }
        finally { setGhostTarget(null); }
    };

    const handleConfirmRemove = async () => {
        if (!removeTarget) return;
        try {
            await removeFriend(removeTarget.friendshipId);
            setFriends(prev => prev.filter(f => f.friendshipId !== removeTarget.friendshipId));
        } catch (e: any) { Alert.alert('Error', e?.message); }
        finally { setRemoveTarget(null); }
    };

    const pendingIncoming = friends.filter(f => f.isPending && !f.isSentByMe);
    const pendingOutgoing = friends.filter(f => f.isPending && f.isSentByMe);
    const accepted = friends.filter(f => f.status === 'accepted');

    return (
        <View style={styles.root}>
            <LinearGradient colors={['#0B1F3F', '#0D2347', '#0A1628']} style={styles.root}>
                <SafeAreaView edges={['top']} style={styles.safeTop}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <ArrowIcon width={24} height={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Friends</Text>
                        <View style={styles.headerRight}>
                            <TouchableOpacity
                                onPress={() => { setShowSearch(p => !p); setSearchQuery(''); setSearchResults([]); }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={styles.headerIconBtn}
                            >
                                <AddFriendIcon width={22} height={22} />
                            </TouchableOpacity>
                            
                        </View>
                    </View>

                    {/* Search */}
                    {showSearch && (
                        <View style={styles.searchBar}>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by username…"
                                placeholderTextColor="rgba(255,255,255,0.35)"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoFocus
                            />
                            {isSearching && <ActivityIndicator size="small" color="#4ADE80" />}
                        </View>
                    )}
                </SafeAreaView>

                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {showSearch && searchResults.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>PEOPLE</Text>
                            {searchResults.map(u => (
                                <SearchResult key={u.uid} user={u} onAdd={handleAddFriend} isAdding={addingUids.has(u.uid)} />
                            ))}
                        </View>
                    )}
                    {showSearch && !isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                        <Text style={styles.emptyText}>No users found for "{searchQuery}"</Text>
                    )}

                    {isLoading ? (
                        <ActivityIndicator color="#4ADE80" size="large" style={{ marginTop: 48 }} />
                    ) : (
                        <>
                            {pendingIncoming.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>REQUESTS · {pendingIncoming.length}</Text>
                                    {pendingIncoming.map(f => (
                                        <FriendCard key={f.friendshipId} record={f} onAccept={handleAccept}
                                            onGhostToggle={setGhostTarget} onRemove={setRemoveTarget}
                                            isAccepting={acceptingIds.has(f.friendshipId)} />
                                    ))}
                                </View>
                            )}
                            {accepted.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>{accepted.length} FRIEND{accepted.length !== 1 ? 'S' : ''}</Text>
                                    {accepted.map(f => (
                                        <FriendCard key={f.friendshipId} record={f} onAccept={handleAccept}
                                            onGhostToggle={setGhostTarget} onRemove={setRemoveTarget} isAccepting={false} />
                                    ))}
                                </View>
                            )}
                            {pendingOutgoing.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>SENT</Text>
                                    {pendingOutgoing.map(f => (
                                        <FriendCard key={f.friendshipId} record={f} onAccept={handleAccept}
                                            onGhostToggle={setGhostTarget} onRemove={setRemoveTarget} isAccepting={false} />
                                    ))}
                                </View>
                            )}
                            {friends.length === 0 && !showSearch && (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyStateIcon}>👥</Text>
                                    <Text style={styles.emptyStateTitle}>No friends yet</Text>
                                    <Text style={styles.emptyStateSubtitle}>Tap + to search and add people</Text>
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>

                <ConfirmModal
                    visible={removeTarget !== null}
                    title={removeTarget?.isPending && !removeTarget.isSentByMe ? 'Decline request?' : removeTarget?.isPending ? 'Cancel request?' : 'Remove friend?'}
                    message={removeTarget?.isPending && !removeTarget.isSentByMe ? `Decline from @${removeTarget?.user.username}?` : removeTarget?.isPending ? `Cancel request to @${removeTarget?.user.username}?` : `@${removeTarget?.user.username} will be removed.`}
                    confirmLabel={removeTarget?.isPending && !removeTarget.isSentByMe ? 'Decline' : removeTarget?.isPending ? 'Cancel' : 'Remove'}
                    confirmDestructive
                    onConfirm={handleConfirmRemove}
                    onCancel={() => setRemoveTarget(null)}
                />
                <ConfirmModal
                    visible={ghostTarget !== null}
                    title={ghostTarget?.isGhosted ? `Unghost @${ghostTarget?.user.username}?` : `Ghost @${ghostTarget?.user.username}?`}
                    message={ghostTarget?.isGhosted ? "They'll see you online again." : "They won't see you online."}
                    confirmLabel={ghostTarget?.isGhosted ? 'Unghost' : 'Ghost'}
                    onConfirm={handleConfirmGhost}
                    onCancel={() => setGhostTarget(null)}
                />
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    flex: { flex: 1 },
    safeTop: { backgroundColor: 'transparent' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerIconBtn: { padding: 6 },
    searchBar: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 16, marginTop: 12, marginBottom: 4,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 50, paddingHorizontal: 18,
    },
    searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#fff' },
    scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },
    section: { marginBottom: 28, gap: 10 },
    sectionLabel: {
        fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
        letterSpacing: 1.4, marginBottom: 6,
    },
    friendCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        padding: 14, borderRadius: 16,
    },
    friendCardInner: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatar: { justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { fontWeight: '700', color: '#fff' },
    friendMeta: { flex: 1, gap: 3 },
    friendUsername: { fontSize: 15, fontWeight: '600', color: '#fff' },
    pendingBadge: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
    ghostedBadge: { fontSize: 11, color: '#FF6B6B', fontWeight: '600' },
    incomingBadge: { fontSize: 11, color: '#4ADE80', fontWeight: '600' },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8 },
    acceptBtn: {
        backgroundColor: '#0052FF', paddingHorizontal: 16, paddingVertical: 7,
        borderRadius: 50, minWidth: 68, alignItems: 'center',
    },
    acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    btnDisabled: { opacity: 0.5 },
    searchResultRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    emptyState: { alignItems: 'center', paddingTop: 72, gap: 10 },
    emptyStateIcon: { fontSize: 48 },
    emptyStateTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    emptyStateSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
    emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', marginTop: 24 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalBox: { backgroundColor: '#0D2347', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 24, width: '100%', gap: 12 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    modalMsg: { fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 20 },
    modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
    modalCancel: { paddingVertical: 10, paddingHorizontal: 16 },
    modalCancelText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
    modalConfirm: { backgroundColor: '#0052FF', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 50 },
    modalConfirmRed: { backgroundColor: '#D32F2F' },
    modalConfirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});