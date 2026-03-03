/**
 * navigation/AuthStack.tsx
 *
 * The confirmation object from signInWithPhoneNumber() is passed directly
 * as a route param so it never needs to be stored in global state.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import PhoneNumberScreen from '../presentation/auth/PhoneNumberInputScreen';
import VerifyOTPScreen from '../presentation/auth/VerifyOtpScreen';
import SignUpScreen from '../presentation/auth/SignUpScreen';



export type AuthStackParamList = {
    PhoneNumber: undefined;
    VerifyOTP: {
        phoneNumber: string;
        confirmation: FirebaseAuthTypes.ConfirmationResult;
    };
    SignUp: {
        phoneNumber: string;
    };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="PhoneNumber" component={PhoneNumberScreen} />
            <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
        </Stack.Navigator>
    );
}