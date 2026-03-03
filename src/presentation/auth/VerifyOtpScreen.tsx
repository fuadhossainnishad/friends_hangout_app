import React, { useState, useRef, useCallback } from 'react';
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
import { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import LogoIcon from '../../assets/icons/Logo.svg';
import { AuthStackParamList } from '../../naviagtion/AuthStack';
import { getUserProfile, sendOTP, verifyOTP } from '../../domain/auth/auth.service';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyOTP'>;

const OTP_LENGTH = 6;

export default function VerifyOTPScreen({ navigation, route }: Props) {
    const { phoneNumber } = route.params;

    // Keep confirmation in state so resend can replace it
    const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult>(
        route.params.confirmation
    );
    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);

    const inputRefs = useRef<Array<TextInput | null>>([]);
    const isComplete = otp.every(Boolean);

    const handleChange = useCallback(
        (value: string, index: number) => {
            const digits = value.replace(/\D/g, '');

            // Handle paste: spread across boxes
            if (digits.length > 1) {
                const next = [...otp];
                digits.split('').forEach((d, i) => {
                    if (index + i < OTP_LENGTH) next[index + i] = d;
                });
                setOtp(next);
                const focusAt = Math.min(index + digits.length, OTP_LENGTH - 1);
                inputRefs.current[focusAt]?.focus();
                return;
            }

            const next = [...otp];
            next[index] = digits;
            setOtp(next);

            if (digits && index < OTP_LENGTH - 1) {
                inputRefs.current[index + 1]?.focus();
            }
        },
        [otp]
    );

    const handleKeyPress = useCallback(
        (key: string, index: number) => {
            if (key === 'Backspace' && !otp[index] && index > 0) {
                const next = [...otp];
                next[index - 1] = '';
                setOtp(next);
                inputRefs.current[index - 1]?.focus();
            }
        },
        [otp]
    );

    const resetOtp = () => {
        setOtp(Array(OTP_LENGTH).fill(''));
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
    };

    const handleVerify = async () => {
        if (!isComplete || isVerifying) return;

        setIsVerifying(true);
        try {
            const credential = await verifyOTP(confirmation, otp.join(''));
            const uid = credential.user.uid;

            // Returning user → onAuthStateChanged fires → goes to AppStack automatically
            // New user → navigate to SignUp to collect profile info
            const profile = await getUserProfile(uid);
            if (!profile) {
                navigation.navigate('SignUp', { phoneNumber });
            }
        } catch (error: any) {
            console.log('Incorrect Code', error?.message ?? 'Please try again.');
            Alert.alert('Incorrect Code', error?.message ?? 'Please try again.');
            resetOtp();
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        if (isResending) return;
        setIsResending(true);
        try {
            const newConfirmation = await sendOTP(phoneNumber);
            setConfirmation(newConfirmation);
            resetOtp();
        } catch (error: any) {
            Alert.alert('Could Not Resend', error?.message ?? 'Please try again.');
        } finally {
            setIsResending(false);
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
                    </View>

                    {/* Header */}
                    <View className="w-full gap-1">
                        <Text className="text-2xl font-bold text-black">Verify your number</Text>
                        <Text className="text-gray-500 text-sm">
                            Enter the 6-digit code sent to{' '}
                            <Text className="font-semibold text-black">{phoneNumber}</Text>
                        </Text>
                    </View>

                    {/* OTP boxes */}
                    <View className="flex-row w-full justify-between">
                        {otp.map((digit, index) => (
                            <TextInput
                                key={index}
                                ref={(r) => { inputRefs.current[index] = r; }}
                                className={`border rounded-xl text-center font-semibold text-black text-xl ${digit ? 'border-[#0052FF]' : 'border-gray-300'
                                    }`}
                                style={{ width: 48, height: 58 }}
                                value={digit}
                                onChangeText={(v) => handleChange(v, index)}
                                onKeyPress={(e) => handleKeyPress(e.nativeEvent.key, index)}
                                keyboardType="number-pad"
                                maxLength={OTP_LENGTH}
                                selectTextOnFocus
                            />
                        ))}
                    </View>

                    {/* Verify CTA */}
                    <TouchableOpacity
                        onPress={handleVerify}
                        disabled={!isComplete || isVerifying}
                        activeOpacity={0.85}
                        className={`w-full py-4 rounded-full items-center ${isComplete && !isVerifying ? 'bg-[#0052FF]' : 'bg-[#0052FF]/30'
                            }`}
                    >
                        <Text className="text-white font-semibold text-base">
                            {isVerifying ? 'Verifying…' : 'Verify'}
                        </Text>
                    </TouchableOpacity>

                    {/* Resend */}
                    <View className="flex-row gap-1 items-center">
                        <Text className="text-gray-500 text-sm">Didn't receive it?</Text>
                        <TouchableOpacity onPress={handleResend} disabled={isResending}>
                            <Text className="text-[#0052FF] text-sm font-semibold">
                                {isResending ? 'Sending…' : 'Resend'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text className="text-black text-sm font-medium">← Change Number</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}