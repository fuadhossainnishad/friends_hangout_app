import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import LogoIcon from '../../assets/icons/Logo.svg';
import { AuthStackParamList } from '../../naviagtion/AuthStack';
import { useAuth } from '../../app/context/AuthProvider';
import { createUserProfile, isUsernameTaken } from '../../domain/auth/auth.service';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export default function SignUpScreen({ route }: Props) {
    const { phoneNumber } = route.params;
    const { refreshProfile } = useAuth();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Inline validation — only shown after the user has typed something
    const usernameError = username.length > 0
        ? username.length < 3
            ? 'At least 3 characters required'
            : !USERNAME_REGEX.test(username)
                ? 'Letters, numbers, and underscores only'
                : null
        : null;

    const emailError = email.length > 0 && !EMAIL_REGEX.test(email)
        ? 'Enter a valid email address'
        : null;

    const canSubmit =
        username.length >= 3 &&
        !usernameError &&
        EMAIL_REGEX.test(email) &&
        !isLoading;

    const handleCreateAccount = async () => {
        if (!canSubmit) return;

        setIsLoading(true);
        try {
            const taken = await isUsernameTaken(username);
            if (taken) {
                Alert.alert('Username Taken', 'Please choose a different username.');
                return;
            }

            const user = auth().currentUser;
            if (!user) {
                Alert.alert('Session Expired', 'Please go back and verify your number again.');
                return;
            }

            await createUserProfile(user.uid, {
                phone_number: phoneNumber,
                username,
                email,
            });

            // Tell AuthProvider to re-check Firestore.
            // It will find the new profile → set status to 'authenticated'
            // → RootNavigator renders MainTabs automatically.
            await refreshProfile();
            console.log('refreshProfile done — should be on home now');

        } catch (error: any) {
            Alert.alert('Error', error?.message ?? 'Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-white">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <View className="flex-1 justify-center items-center px-[10%] gap-7">

                    {/* Brand */}
                    <View className="items-center gap-3">
                        <LogoIcon height={80} width={80} />
                        <Text className="text-3xl font-bold text-black">HORA</Text>
                        <Text className="text-gray-500 text-sm text-center">
                            Almost there — set up your profile
                        </Text>
                    </View>

                    {/* Fields */}
                    <View className="w-full gap-4">

                        <View className="gap-1">
                            <Text className="text-black font-medium text-sm">Username</Text>
                            <TextInput
                                className={`border text-sm text-black p-4 rounded-full ${usernameError ? 'border-red-400' : 'border-gray-200'
                                    }`}
                                placeholder="your_handle"
                                placeholderTextColor="#999"
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading}
                            />
                            {usernameError ? (
                                <Text className="text-red-400 text-xs px-2">{usernameError}</Text>
                            ) : null}
                        </View>

                        <View className="gap-1">
                            <Text className="text-black font-medium text-sm">Email</Text>
                            <TextInput
                                className={`border text-sm text-black p-4 rounded-full ${emailError ? 'border-red-400' : 'border-gray-200'
                                    }`}
                                placeholder="you@example.com"
                                placeholderTextColor="#999"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading}
                            />
                            {emailError ? (
                                <Text className="text-red-400 text-xs px-2">{emailError}</Text>
                            ) : null}
                        </View>
                    </View>

                    {/* CTA */}
                    <TouchableOpacity
                        onPress={handleCreateAccount}
                        disabled={!canSubmit}
                        activeOpacity={0.85}
                        className={`w-full py-4 rounded-full items-center ${canSubmit ? 'bg-[#0052FF]' : 'bg-[#0052FF]/30'
                            }`}
                    >
                        <Text className="text-white font-semibold text-base">
                            {isLoading ? 'Creating Account…' : 'Create Account'}
                        </Text>
                    </TouchableOpacity>

                    <Text className="text-gray-400 text-xs text-center">
                        By continuing, you agree to our Terms & Privacy Policy
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}