import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabs from './MainTab';
import ActivateScreen from '../presentation/home/Activate.screen';
import MatchedScreen from '../presentation/home/Matched.screen';
import SettingsScreen from '../presentation/home/Settings.screen';

export type MainStackParamList = {
    MainTabs: undefined;
    Activate: undefined;
    Matched: { friendId: string; friendName: string; friendUsername: string };
    Settings: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainStack() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
                name="Activate"
                component={ActivateScreen}
                options={{
                    presentation: 'modal',
                }}
            />
            <Stack.Screen
                name="Matched"
                component={MatchedScreen}
                options={{
                    presentation: 'modal',
                }}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
    );
}