import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { mobileAuth, MobileUserSession } from '@/services/auth';

export default function TabLayout() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<MobileUserSession | null>(mobileAuth.getUser());

  useEffect(() => {
    const unsub = mobileAuth.subscribe((u) => setUser(u));
    return () => unsub();
  }, []);

  const role = user?.role || 'PumpAttendant';

  const getTabConfig = () => {
    switch (role) {
      case 'StationCashier':
        return {
          indexTitle: 'Caisse',
          indexIcon: 'cash-outline' as const,
          cardsTitle: 'Stock Cartes',
          cardsIcon: 'card-outline' as const,
          historyTitle: 'Journal',
          historyIcon: 'receipt-outline' as const,
          stationsTitle: 'Station',
          stationsIcon: 'business-outline' as const,
          profileTitle: 'Profil',
          profileIcon: 'person-outline' as const,
        };
      case 'FleetManager':
        return {
          indexTitle: 'Flotte B2B',
          indexIcon: 'business-outline' as const,
          cardsTitle: 'Véhicules',
          cardsIcon: 'car-sport-outline' as const,
          historyTitle: 'Conso',
          historyIcon: 'analytics-outline' as const,
          stationsTitle: 'Réseau',
          stationsIcon: 'location-outline' as const,
          profileTitle: 'Profil',
          profileIcon: 'person-outline' as const,
        };
      case 'Driver':
        return {
          indexTitle: 'Portefeuille',
          indexIcon: 'wallet-outline' as const,
          cardsTitle: 'Ma Carte',
          cardsIcon: 'card-outline' as const,
          historyTitle: 'Mes Pleins',
          historyIcon: 'receipt-outline' as const,
          stationsTitle: 'Stations',
          stationsIcon: 'location-outline' as const,
          profileTitle: 'Mon Compte',
          profileIcon: 'person-outline' as const,
        };
      case 'Admin':
        return {
          indexTitle: 'Hub Wallet',
          indexIcon: 'wallet-outline' as const,
          cardsTitle: 'Cartes',
          cardsIcon: 'card-outline' as const,
          historyTitle: 'Audit',
          historyIcon: 'receipt-outline' as const,
          stationsTitle: 'Stations',
          stationsIcon: 'business-outline' as const,
          profileTitle: 'Admin',
          profileIcon: 'shield-checkmark-outline' as const,
        };
      case 'PumpAttendant':
      default:
        return {
          indexTitle: 'SoftPOS',
          indexIcon: 'speedometer-outline' as const,
          cardsTitle: 'Vérif Carte',
          cardsIcon: 'card-outline' as const,
          historyTitle: 'Historique',
          historyIcon: 'receipt-outline' as const,
          stationsTitle: 'Ma Station',
          stationsIcon: 'business-outline' as const,
          profileTitle: 'Profil',
          profileIcon: 'person-outline' as const,
        };
    }
  };

  const config = getTabConfig();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accentPrimary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.borderHairline,
          height: 56 + Math.max(insets.bottom, 12),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: config.indexTitle,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={config.indexIcon} size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: config.cardsTitle,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={config.cardsIcon} size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: config.historyTitle,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={config.historyIcon} size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stations"
        options={{
          title: config.stationsTitle,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={config.stationsIcon} size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: config.profileTitle,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={config.profileIcon} size={size || 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
