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
import LogoIcon from '../../assets/icons/Logo.svg';
import { AuthStackParamList } from '../../naviagtion/AuthStack';
import { sendOTP } from '../../domain/auth/auth.service';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneNumber'>;

// E.164 format: +[country code][number], 10–15 digits total
const PHONE_REGEX = /^\+[1-9]\d{9,14}$/;

export default function PhoneNumberScreen({ navigation }: Props) {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isValid = PHONE_REGEX.test(phoneNumber.trim());

    const handleContinue = async () => {
        if (!isValid || isLoading) return;

        setIsLoading(true);
        try {
            const confirmation = await sendOTP(phoneNumber.trim());
            navigation.navigate('VerifyOTP', {
                phoneNumber: phoneNumber.trim(),
                confirmation,
            });
        } catch (error: any) {
            Alert.alert(
                'Failed to Send Code',
                error?.message ?? 'Check the number and try again.'
            );
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
                <View className="flex-1 justify-center items-center px-[10%] gap-6">

                    {/* Brand */}
                    <View className="items-center gap-3">
                        <LogoIcon height={80} width={80} />
                        <Text className="text-3xl font-bold text-black">HORA</Text>
                        <Text className="text-gray-500 text-sm text-center">
                            Spontaneous hangouts with friends
                        </Text>
                    </View>

                    {/* Input */}
                    <View className="w-full gap-2">
                        <Text className="text-black font-medium text-sm">Phone Number</Text>
                        <TextInput
                            className="border border-gray-200 text-sm text-black p-4 rounded-full"
                            placeholder="+1 555 000 0000"
                            placeholderTextColor="#999"
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            keyboardType="phone-pad"
                            maxLength={16}
                            editable={!isLoading}
                            autoFocus
                        />
                        <Text className="text-gray-400 text-xs px-2">
                            Include your country code, e.g. +880 for BD, +1 for US
                        </Text>
                    </View>

                    {/* CTA */}
                    <TouchableOpacity
                        onPress={handleContinue}
                        disabled={!isValid || isLoading}
                        activeOpacity={0.85}
                        className={`w-full py-4 rounded-full items-center ${isValid && !isLoading ? 'bg-[#0052FF]' : 'bg-[#0052FF]/30'
                            }`}
                    >
                        <Text className="text-white font-semibold text-base">
                            {isLoading ? 'Sending Code…' : 'Continue'}
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