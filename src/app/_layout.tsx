import { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import OnboardingScreen from '@/components/onboarding-screen';
import AuthScreen from '@/components/auth-screen';
import { mobileAuth, MobileUserSession } from '@/services/auth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded, fontError] = useFonts({
    'ProximaNova-Regular': require('@/assets/fonts/ProximaNova-Regular.ttf'),
    'ProximaNova-Bold': require('@/assets/fonts/ProximaNova-Bold.ttf'),
  });

  const [user, setUser] = useState<MobileUserSession | null>(mobileAuth.getUser());
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean>(
    mobileAuth.hasSeenOnboarding()
  );

  useEffect(() => {
    const unsubAuth = mobileAuth.subscribe((u) => setUser(u));
    const unsubOnboard = mobileAuth.subscribeOnboarding((seen) => setHasSeenOnboarding(seen));

    return () => {
      unsubAuth();
      unsubOnboard();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const currentTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={currentTheme}>
        {!hasSeenOnboarding ? (
          <OnboardingScreen onFinish={() => setHasSeenOnboarding(true)} />
        ) : !user ? (
          <AuthScreen onOpenOnboarding={() => mobileAuth.resetOnboarding()} />
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
