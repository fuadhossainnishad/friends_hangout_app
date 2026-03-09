// navigation/MainTab.tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, Platform } from 'react-native';
import FriendsScreen from '../presentation/home/Friends.screen';
import HomeScreen from '../presentation/home/Home.screen';

// Import your SVG icons
import FriendsActiveIcon from '../assets/icons/friend-active.svg';
import FriendsInactiveIcon from '../assets/icons/friend-inactive.svg';
import HomeActiveIcon from '../assets/icons/home-active.svg';
import HomeInactiveIcon from '../assets/icons/home-inactive.svg';
import ProfileActiveIcon from '../assets/icons/profile-active.svg';
import ProfileInactiveIcon from '../assets/icons/profile-inactive.svg';
import ProfileStack from './ProfileStack';

export type MainTabParamList = {
    Home: undefined;
    Friends: undefined;
    Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// Tab Icon with Active/Inactive States
const TabIconSVG = ({
    ActiveIcon,
    InactiveIcon,
    focused,
}: {
    ActiveIcon: any;
    InactiveIcon: any;
    focused: boolean;
}) => {
    if (focused) {
        return (
            <View style={styles.activeContainer}>
                <View style={styles.glowLayer} />
                <View

                    style={styles.activeTabBackground}
                >
                    <ActiveIcon width={24} height={24} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.inactiveContainer}>
            <InactiveIcon width={22} height={22} />
        </View>
    );
};

export default function MainTabs() {
    return (
        <Tab.Navigator
            initialRouteName='Home'
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#FFFFFF',
                tabBarInactiveTintColor: '#64748B',
                tabBarStyle: styles.tabBar,
                tabBarLabelStyle: styles.tabBarLabel,
                tabBarItemStyle: styles.tabBarItem,
            }}
        >
            <Tab.Screen
                name="Friends"
                component={FriendsScreen}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIconSVG
                            ActiveIcon={FriendsActiveIcon}
                            InactiveIcon={FriendsInactiveIcon}
                            focused={focused}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIconSVG
                            ActiveIcon={HomeActiveIcon}
                            InactiveIcon={HomeInactiveIcon}
                            focused={focused}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileStack}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIconSVG
                            ActiveIcon={ProfileActiveIcon}
                            InactiveIcon={ProfileInactiveIcon}
                            focused={focused}
                        />
                    ),
                }}
            />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: '#0A1628',
        borderTopWidth: 0,
        height: 110,
        paddingBottom: 10,
        paddingTop: 25,
        elevation: 0,
        shadowOpacity: 0,
    },
    tabBarLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
    tabBarItem: {
        paddingVertical: 5,
    },
    activeContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowLayer: {
        position: 'absolute',
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#0052FF',
        opacity: 0.3,
        ...Platform.select({
            ios: {
                shadowColor: '#0052FF',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.5,
                shadowRadius: 16,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    activeTabBackground: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 2,
        ...Platform.select({
            ios: {
                shadowColor: '#0052FF',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.6,
                shadowRadius: 12,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    inactiveContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
});