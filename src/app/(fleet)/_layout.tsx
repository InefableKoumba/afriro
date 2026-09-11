import React from 'react';
import { useColorScheme } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

export default function FleetLayout() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accentPrimary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 58 + Math.max(insets.bottom, 12),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Flotte B2B',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: 'Véhicules',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-sport-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Conso',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stations"
        options={{
          title: 'Réseau',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size || 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
