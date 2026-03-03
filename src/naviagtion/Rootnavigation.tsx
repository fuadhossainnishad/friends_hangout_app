/**
 * RootNavigator.tsx
 *
 * IMPORTANT: NavigationContainer lives in App.tsx (root index).
 * Do NOT add another NavigationContainer here — nested containers
 * break React Navigation and prevent stack switches from rendering.
 *
 * Auth flow:
 *   loading         → Splash spinner
 *   unauthenticated → AuthStack (phone → otp → signup)
 *   needs_profile   → AuthStack (VerifyOTP navigates to SignUp manually)
 *   authenticated   → MainStack (tabs + modals)
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../app/context/AuthProvider';
import AuthStack from './AuthStack';
import MainStack from './MainStack';

export default function RootNavigator() {
    const { state } = useAuth();

    if (state.status === 'loading') {
        return (
            <View style={styles.loader}>
                <ActivityIndicator size="large" color="#0052FF" />
            </View>
        );
    }

    return state.status === 'authenticated' ? <MainStack /> : <AuthStack />;
}

const styles = StyleSheet.create({
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0A1628',
    },
});