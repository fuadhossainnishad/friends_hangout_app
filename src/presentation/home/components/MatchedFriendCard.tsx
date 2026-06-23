import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Linking,
  Alert,
  Image
} from 'react-native';

import { EnrichedMatch } from '../../../domain/friends/match.service';

export default function MatchedFriendCard({
  match,
}: {
  match: EnrichedMatch;
}) {
  const openPhone = async () => {
    if (!match.phone) {
      Alert.alert('Phone unavailable', 'This user did not share a phone number.');
      return;
    }

    await Linking.openURL(`tel:${match.phone}`);
  };

  const openWhatsapp = async () => {
    if (!match.whatsapp) {
      Alert.alert('WhatsApp unavailable', 'This user did not share a WhatsApp number.');
      return;
    }

    await Linking.openURL(
      `https://wa.me/${match.whatsapp.replace(/\D/g, '')}`,
    );
  };

  const openEmail = async () => {
    if (!match.email) {
      Alert.alert('Email unavailable', 'This user did not share an email address.');
      return;
    }

    await Linking.openURL(`mailto:${match.email}`);
  };

  const openInstagram = async () => {
    if (!match.instagram) {
      Alert.alert('Instagram unavailable', 'This user did not share an Instagram account.');
      return;
    }

    await Linking.openURL(
      `https://instagram.com/${match.instagram}`,
    );
  };

  return (
    <View style={styles.matchCard}>
      <View style={styles.matchHeader}>
  <View style={styles.userSection}>
    {match.profile ? (
      <Image
        source={{ uri: match.profile }}
        style={styles.avatar}
      />
    ) : (
      <View style={styles.avatarFallback}>
        <Text style={styles.avatarLetter}>
          {match.username?.charAt(0)?.toUpperCase()}
        </Text>
      </View>
    )}

    <View>
      <Text style={styles.matchUsername}>
        @{match.username}
      </Text>

      <Text style={styles.matchSubtitle}>
        New Connection
      </Text>
    </View>
  </View>

  <View style={styles.matchBadge}>
    <Text style={styles.matchBadgeText}>
      💚 Matched
    </Text>
  </View>
</View>

    <View style={styles.actionsContainer}>
  <TouchableOpacity
    style={styles.actionButton}
    activeOpacity={0.8}
    onPress={openPhone}
  >
    <Text style={styles.actionIcon}>📞</Text>

    <View style={styles.actionContent}>
      <Text style={styles.actionTitle}>Call</Text>
      <Text style={styles.actionSubtitle}>
        {match.phone || 'Phone not shared'}
      </Text>
    </View>

    <Text style={styles.actionArrow}>›</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.actionButton}
    activeOpacity={0.8}
    onPress={openWhatsapp}
  >
    <Text style={styles.actionIcon}>💬</Text>

    <View style={styles.actionContent}>
      <Text style={styles.actionTitle}>WhatsApp</Text>
      <Text style={styles.actionSubtitle}>
        {match.whatsapp || 'WhatsApp unavailable'}
      </Text>
    </View>

    <Text style={styles.actionArrow}>›</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.actionButton}
    activeOpacity={0.8}
    onPress={openInstagram}
  >
    <Text style={styles.actionIcon}>📸</Text>

    <View style={styles.actionContent}>
      <Text style={styles.actionTitle}>Instagram</Text>
      <Text style={styles.actionSubtitle}>
        {match.instagram
          ? `@${match.instagram}`
          : 'Instagram not shared'}
      </Text>
    </View>

    <Text style={styles.actionArrow}>›</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.actionButton}
    activeOpacity={0.8}
    onPress={openEmail}
  >
    <Text style={styles.actionIcon}>📧</Text>

    <View style={styles.actionContent}>
      <Text style={styles.actionTitle}>Email</Text>
      <Text style={styles.actionSubtitle}>
        {match.email || 'Email not shared'}
      </Text>
    </View>

    <Text style={styles.actionArrow}>›</Text>
  </TouchableOpacity>
</View>
    </View>
  );
}

const styles = StyleSheet.create({
    matchCard: {
         backgroundColor: '#111827',

  borderWidth: 1,
  borderColor: 'rgba(0,255,179,0.15)',

  borderRadius: 22,
  padding: 18,

  marginBottom: 14,
    },

    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },

    matchUsername: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },

    matchBadge: {
        backgroundColor: 'rgba(0,255,179,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 50,
    },

    matchBadgeText: {
        color: '#00FFB3',
        fontSize: 11,
        fontWeight: '700',
    },

    matchDetails: {
        gap: 6,
    },

    matchText: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 13,
    },
    userSection: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},

avatar: {
  width: 56,
  height: 56,
  borderRadius: 28,
  marginRight: 12,
},

avatarFallback: {
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: 'rgba(255,255,255,0.12)',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
},

avatarLetter: {
  color: '#fff',
  fontSize: 22,
  fontWeight: '700',
},

matchSubtitle: {
  color: 'rgba(255,255,255,0.5)',
  fontSize: 12,
  marginTop: 2,
},
actionsContainer: {
  marginTop: 18,
  gap: 10,
},

actionButton: {
  flexDirection: 'row',
  alignItems: 'center',

  backgroundColor: 'rgba(255,255,255,0.05)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',

  paddingVertical: 14,
  paddingHorizontal: 14,

  borderRadius: 14,
},

actionIcon: {
  fontSize: 22,
  marginRight: 12,
},

actionContent: {
  flex: 1,
},

actionTitle: {
  color: '#FFFFFF',
  fontSize: 14,
  fontWeight: '700',
},

actionSubtitle: {
  color: 'rgba(255,255,255,0.55)',
  fontSize: 12,
  marginTop: 2,
},

actionArrow: {
  color: '#00FFB3',
  fontSize: 26,
  fontWeight: '300',
},
})