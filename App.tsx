/**
 * Root App.tsx  (your existing file at the project root)
 *
 * ONLY CHANGE: add `ref={navigationRef}` to NavigationContainer.
 * Everything else stays exactly as you have it.
 */
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootApp from './src/app/App';
import './global.css';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './src/app/navigationRef'; // ← ADD THIS IMPORT

function App() {
  return (
    <GestureHandlerRootView style={styles.gesturestyle}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}> {/* ← ADD ref= */}
          <View className='flex-1'>
            <RootApp />
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gesturestyle: { flex: 1 },
});

export default App;