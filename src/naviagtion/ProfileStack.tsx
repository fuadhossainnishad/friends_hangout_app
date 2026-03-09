import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SettingsScreen from '../presentation/home/Settings.screen';
import ProfileScreen from '../presentation/home/Profile.screen';

export type ProfileStackParamList = {
    Profile: undefined;
    Settings: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
    );
}