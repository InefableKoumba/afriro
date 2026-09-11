import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

import { isCashier, isFleetManager, isPompiste, mobileAuth, MobileUserSession } from '@/services/auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootIndexDispatcher() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? Colors.dark : Colors.light;

  const [user, setUser] = useState<MobileUserSession | null>(mobileAuth.getUser());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = mobileAuth.subscribe((u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.accentPrimary} />
      </View>
    );
  }

  const role = user?.role;

  if (isPompiste(role)) {
    return <Redirect href="/(pompiste)" />;
  }

  if (isCashier(role)) {
    return <Redirect href="/(cashier)" />;
  }

  if (isFleetManager(role)) {
    return <Redirect href="/(fleet)" />;
  }

  // Default fallback for forecourt attendants
  return <Redirect href="/(pompiste)" />;
}
