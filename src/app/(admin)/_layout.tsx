import React from 'react';
import { useColorScheme } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

export default function AdminLayout() {
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
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Direction',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="speedometer-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stations"
        options={{
          title: 'Stations',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: 'Cartes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Opérateurs',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Système',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="write-card"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="card-detail"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
