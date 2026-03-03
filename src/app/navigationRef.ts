/**
 * src/app/navigationRef.ts
 *
 * Shared navigation ref — created once, passed to both:
 *   1. Root App.tsx  →  <NavigationContainer ref={navigationRef}>
 *   2. notifications.service  →  background tap handler
 *
 * This avoids needing a second NavigationContainer anywhere.
 */
import { createNavigationContainerRef } from '@react-navigation/native';
import { MainStackParamList } from '../naviagtion/MainStack';

export const navigationRef = createNavigationContainerRef<MainStackParamList>();