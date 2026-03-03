/**
 * SettingsScreen.tsx
 *
 * Shows 3 items: Privacy Policy, Terms & Conditions, About Us
 * Content is fetched live from Firestore /settings/{docId}
 * Admin edits directly from Firebase Console — changes reflect instantly.
 *
 * Firestore schema:
 *   /settings/privacy_policy   → { title: string, content: string }
 *   /settings/terms            → { title: string, content: string }
 *   /settings/about_us         → { title: string, content: string }
 */
import React, { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import firestore from '@react-native-firebase/firestore';
import ArrowIcon from '../../assets/icons/arrow.svg';

type SettingDoc = { title: string; content: string };
type SettingKey = 'privacy_policy' | 'terms' | 'about_us';

const ITEMS: { key: SettingKey; label: string; icon: string }[] = [
    { key: 'privacy_policy', label: 'Privacy Policy', icon: '🔒' },
    { key: 'terms', label: 'Terms & Conditions', icon: '📋' },
    { key: 'about_us', label: 'About Us', icon: '💙' },
];

// ─── Content Modal ────────────────────────────────────────────────────────────

function ContentModal({ visible, docKey, onClose }: {
    visible: boolean; docKey: SettingKey | null; onClose: () => void;
}) {
    const [doc, setDoc] = useState<SettingDoc | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!visible || !docKey) return;
        setDoc(null); setError(false); setIsLoading(true);
        firestore().collection('settings').doc(docKey).get()
            .then(snap => snap.exists() ? setDoc(snap.data() as SettingDoc) : setError(true))
            .catch(() => setError(true))
            .finally(() => setIsLoading(false));
    }, [visible, docKey]);

    const item = ITEMS.find(i => i.key === docKey);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={mStyles.root}>
                <LinearGradient colors={['#0B1F3F', '#0A1628']} style={mStyles.root}>
                    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
                        <View style={mStyles.header}>
                            <View style={mStyles.headerLeft}>
                                <Text style={mStyles.headerIcon}>{item?.icon}</Text>
                                <Text style={mStyles.headerTitle}>{item?.label}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={mStyles.closeBtn}>
                                <Text style={mStyles.closeBtnText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {isLoading ? (
                            <ActivityIndicator color="#4ADE80" size="large" style={{ marginTop: 60 }} />
                        ) : error ? (
                            <View style={mStyles.errorState}>
                                <Text style={mStyles.errorIcon}>⚠️</Text>
                                <Text style={mStyles.errorTitle}>Content unavailable</Text>
                                <Text style={mStyles.errorSub}>Please try again later</Text>
                            </View>
                        ) : (
                            <ScrollView contentContainerStyle={mStyles.scrollContent} showsVerticalScrollIndicator={false}>
                                {doc?.title ? <Text style={mStyles.docTitle}>{doc.title}</Text> : null}
                                <Text style={mStyles.docBody}>{doc?.content}</Text>
                            </ScrollView>
                        )}
                    </SafeAreaView>
                </LinearGradient>
            </View>
        </Modal>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
    const navigation = useNavigation();
    const [openKey, setOpenKey] = useState<SettingKey | null>(null);

    return (
        <View style={styles.root}>
            <LinearGradient colors={['#0B1F3F', '#0D2347', '#0A1628']} style={styles.root}>
                <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <ArrowIcon height={24} width={24} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Settings</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.appInfo}>
                            <LinearGradient colors={['#0052FF', '#00C6FF']} style={styles.appLogo}>
                                <Text style={styles.appLogoText}>H</Text>
                            </LinearGradient>
                            <Text style={styles.appName}>HORA</Text>
                            <Text style={styles.appVersion}>Version 1.0.0</Text>
                        </View>

                        <View style={styles.menuGroup}>
                            <Text style={styles.groupLabel}>LEGAL & INFO</Text>
                            <View style={styles.menuCard}>
                                {ITEMS.map((item, i) => (
                                    <React.Fragment key={item.key}>
                                        <TouchableOpacity style={styles.menuRow} onPress={() => setOpenKey(item.key)} activeOpacity={0.7}>
                                            <View style={styles.menuLeft}>
                                                <View style={styles.menuIconBox}>
                                                    <Text style={styles.menuIconText}>{item.icon}</Text>
                                                </View>
                                                <Text style={styles.menuLabel}>{item.label}</Text>
                                            </View>
                                            <Text style={styles.chevron}>›</Text>
                                        </TouchableOpacity>
                                        {i < ITEMS.length - 1 && <View style={styles.divider} />}
                                    </React.Fragment>
                                ))}
                            </View>
                        </View>

                        <Text style={styles.footerText}>Made with 💙 by HORA Team</Text>
                    </ScrollView>
                </SafeAreaView>
            </LinearGradient>

            <ContentModal visible={openKey !== null} docKey={openKey} onClose={() => setOpenKey(null)} />
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
    scrollContent: { paddingHorizontal: 20, paddingTop: 36, paddingBottom: 48, gap: 32 },
    appInfo: { alignItems: 'center', gap: 10 },
    appLogo: { width: 76, height: 76, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    appLogoText: { fontSize: 38, fontWeight: '800', color: '#fff' },
    appName: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: 4 },
    appVersion: { fontSize: 13, color: 'rgba(255,255,255,0.3)' },
    menuGroup: { gap: 10 },
    groupLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.4, marginLeft: 4 },
    menuCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden' },
    menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16 },
    menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    menuIconBox: { width: 40, height: 40, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.07)', justifyContent: 'center', alignItems: 'center' },
    menuIconText: { fontSize: 18 },
    menuLabel: { fontSize: 16, fontWeight: '500', color: '#fff' },
    chevron: { fontSize: 24, color: 'rgba(255,255,255,0.22)', fontWeight: '300', marginRight: 4 },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 },
    footerText: { textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.2)' },
});

const mStyles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerIcon: { fontSize: 22 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    closeBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 50 },
    closeBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '600', paddingHorizontal: 4 },
    scrollContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48, gap: 16 },
    docTitle: { fontSize: 22, fontWeight: '700', color: '#fff', lineHeight: 30 },
    docBody: { fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 26 },
    errorState: { alignItems: 'center', paddingTop: 80, gap: 12 },
    errorIcon: { fontSize: 48 },
    errorTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    errorSub: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
});