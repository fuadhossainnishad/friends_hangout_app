import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';
import { useAuth, type SharePreference } from '../../app/context/AuthProvider';
import { MainStackParamList } from '../../naviagtion/MainStack';
import ArrowIcon from '../../assets/icons/arrow.svg';
import CameraIcon from '../../assets/icons/camera.svg';
import PhoneIcon from '../../assets/icons/phone.svg';
import InstaIcon from '../../assets/icons/insta.svg';
import LogoutIcon from '../../assets/icons/logout.svg';
import { uploadFile } from '../../domain/profile/storage.service';
import SettingsIcon from '../../assets/icons/settings.svg';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const SHARE_OPTIONS: { value: SharePreference; label: string; desc: string; Icon: any }[] = [
    { value: 'phone', label: 'Phone only', desc: 'Share your number on match', Icon: PhoneIcon },
    { value: 'instagram', label: 'Instagram only', desc: 'Share your handle on match', Icon: InstaIcon },
    { value: 'both', label: 'Both', desc: 'Share phone & Instagram', Icon: null },
];

const AVATAR_SIZE = 100;

function AvatarBlock({ uri, letter, uploadProgress, onPress }: {
    uri: string | null; letter: string; uploadProgress: number | null; onPress: () => void;
}) {
    const isUploading = uploadProgress !== null;
    return (
        <View style={styles.avatarWrapper}>
            {uri ? (
                <Image source={{ uri }} style={styles.avatarImage} />
            ) : (
                <LinearGradient colors={['#0052FF', '#00C6FF']} style={styles.avatarFallback}>
                    <Text style={styles.avatarLetter}>{letter}</Text>
                </LinearGradient>
            )}
            {isUploading && (
                <View style={styles.avatarOverlay}>
                    <Text style={styles.avatarProgress}>{uploadProgress}%</Text>
                </View>
            )}
            <TouchableOpacity
                style={[styles.cameraBtn, isUploading && { opacity: 0.6 }]}
                onPress={onPress}
                disabled={isUploading}
            >
                {isUploading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <CameraIcon height={15} width={15} />
                }
            </TouchableOpacity>
        </View>
    );
}

export default function ProfileScreen() {
    const navigation = useNavigation<NavigationProp>();
    const { user, updateUser, logout } = useAuth();

    const [bio, setBio] = useState(user?.bio ?? '');
    const [instagram, setInstagram] = useState(user?.instagram_username ?? '');
    const [sharePreference, setSharePreference] = useState<SharePreference>(user?.sharePreference ?? 'both');
    const [localImageUri, setLocalImageUri] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    if (!user) return null;

    const displayUri = localImageUri ?? (user.profile || null);

    const handlePickImage = async () => {
        const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 512, maxHeight: 512, selectionLimit: 1 });
        if (result.didCancel || !result.assets?.length) return;
        const asset: Asset = result.assets[0];
        if (!asset.uri) return;
        setLocalImageUri(asset.uri);
        setUploadProgress(0);
        try {
            const url = await uploadFile(asset.uri, `avatars/${user.uid}.jpg`, setUploadProgress);
            await updateUser({ profile: url });
        } catch (e: any) {
            setLocalImageUri(null);
            Alert.alert('Upload Failed', e?.message ?? 'Try again.');
        } finally {
            setUploadProgress(null);
        }
    };

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await updateUser({ bio, instagram_username: instagram, sharePreference });
            Alert.alert('Saved ✓', 'Your profile has been updated.');
        } catch {
            Alert.alert('Error', 'Failed to save. Try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        Alert.alert('Log out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: logout },
        ]);
    };

    return (
        <View style={styles.root}>
            <LinearGradient colors={['#0B1F3F', '#0D2347', '#0A1628']} style={styles.root}>
                <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.navigate('MainTabs')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <ArrowIcon height={24} width={24} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Profile</Text>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Settings')}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <SettingsIcon height={24} width={24} />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Avatar section */}
                    <View style={styles.avatarSection}>
                        <AvatarBlock
                            uri={displayUri}
                            letter={user.username.charAt(0).toUpperCase()}
                            uploadProgress={uploadProgress}
                            onPress={handlePickImage}
                        />
                        <Text style={styles.username}>@{user.username}</Text>
                        <Text style={styles.phone}>{user.phone_number}</Text>
                    </View>

                    {/* Bio */}
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>BIO</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder="Tell your friends about yourself…"
                            placeholderTextColor="rgba(255,255,255,0.25)"
                            value={bio}
                            onChangeText={setBio}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            maxLength={200}
                        />
                        <Text style={styles.charCount}>{bio.length}/200</Text>
                    </View>

                    {/* Instagram */}
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>INSTAGRAM</Text>
                        <View style={styles.inputRow}>
                            <Text style={styles.inputPrefix}>@</Text>
                            <TextInput
                                style={styles.inlineInput}
                                placeholder="your_handle"
                                placeholderTextColor="rgba(255,255,255,0.25)"
                                value={instagram}
                                onChangeText={setInstagram}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>
                        <Text style={styles.cardHint}>Shared with friends when you match</Text>
                    </View>

                    {/* Share preference */}
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>SHARE ON MATCH</Text>
                        <View style={styles.shareOptions}>
                            {SHARE_OPTIONS.map(({ value, label, desc, Icon }) => (
                                <TouchableOpacity
                                    key={value}
                                    style={[styles.shareOption, sharePreference === value && styles.shareOptionActive]}
                                    onPress={() => setSharePreference(value)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.shareOptionLeft}>
                                        {Icon && <Icon height={16} width={16} />}
                                        <View>
                                            <Text style={[styles.shareLabel, sharePreference === value && styles.shareLabelActive]}>{label}</Text>
                                            <Text style={styles.shareDesc}>{desc}</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.radioOuter, sharePreference === value && styles.radioOuterActive]}>
                                        {sharePreference === value && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Save */}
                    <TouchableOpacity
                        style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
                        onPress={handleSave}
                        disabled={isSaving}
                        activeOpacity={0.85}
                    >
                        <LinearGradient colors={['#0052FF', '#0066FF']} style={styles.saveBtnGradient}>
                            {isSaving
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.saveBtnText}>Save Changes</Text>
                            }
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Logout */}
                    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
                        <LogoutIcon height={16} width={16} />
                        <Text style={styles.logoutText}>Log out</Text>
                    </TouchableOpacity>
                </ScrollView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    scrollContent: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 52, gap: 16 },
    avatarSection: { alignItems: 'center', gap: 8, marginBottom: 12 },
    avatarWrapper: { position: 'relative', width: AVATAR_SIZE, height: AVATAR_SIZE, marginBottom: 4 },
    avatarImage: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
    avatarFallback: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, justifyContent: 'center', alignItems: 'center' },
    avatarLetter: { fontSize: 38, fontWeight: '700', color: '#fff' },
    avatarOverlay: {
        ...StyleSheet.absoluteFillObject, borderRadius: AVATAR_SIZE / 2,
        backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
    },
    avatarProgress: { color: '#fff', fontSize: 14, fontWeight: '700' },
    cameraBtn: {
        position: 'absolute', bottom: 2, right: 2,
        backgroundColor: '#0052FF', borderRadius: 50, padding: 8,
        borderWidth: 2, borderColor: '#0B1F3F',
    },
    username: { fontSize: 20, fontWeight: '700', color: '#fff' },
    phone: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
    card: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 18, padding: 18, gap: 12,
    },
    cardLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.4 },
    textArea: { fontSize: 15, color: '#fff', minHeight: 80, lineHeight: 22 },
    charCount: { fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'right' },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    inputPrefix: { fontSize: 15, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
    inlineInput: { flex: 1, fontSize: 15, color: '#fff' },
    cardHint: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },
    shareOptions: { gap: 10 },
    shareOption: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        padding: 14, borderRadius: 12,
    },
    shareOptionActive: {
        backgroundColor: 'rgba(0,82,255,0.15)',
        borderColor: 'rgba(0,82,255,0.4)',
    },
    shareOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    shareLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
    shareLabelActive: { color: '#fff' },
    shareDesc: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
    radioOuter: {
        width: 20, height: 20, borderRadius: 10,
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center', alignItems: 'center',
    },
    radioOuterActive: { borderColor: '#0052FF' },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0052FF' },
    saveBtn: { borderRadius: 50, overflow: 'hidden', marginTop: 8 },
    saveBtnGradient: { paddingVertical: 16, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    logoutBtn: {
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        gap: 8, paddingVertical: 14, borderRadius: 50,
        borderWidth: 1, borderColor: 'rgba(211,47,47,0.3)',
    },
    logoutText: { color: '#FF6B6B', fontSize: 15, fontWeight: '600' },
});