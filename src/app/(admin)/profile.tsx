import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { mobileAuth, MobileUserSession } from '@/services/auth';
import { API_BASE_URL, API_ENDPOINTS } from '@/constants/api';

export default function AdminProfileScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [user, setUser] = useState<MobileUserSession | null>(mobileAuth.getUser());
  const [health, setHealth] = useState<{ status: string; platform: string } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  useEffect(() => {
    const unsub = mobileAuth.subscribe((u) => setUser(u));
    return () => unsub();
  }, []);

  const checkServerHealth = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch(API_ENDPOINTS.HEALTH);
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setHealth(null);
      }
    } catch {
      setHealth(null);
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    checkServerHealth();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion Administrateur',
      'Voulez-vous fermer votre session d\'administration réseau ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Fermer la session',
          style: 'destructive',
          onPress: () => {
            mobileAuth.logout();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={[styles.headerCaption, { color: theme.textSecondary }]}>
            Administration & Sécurité Système
          </ThemedText>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
            Profil Directeur Réseau
          </ThemedText>
        </View>

        {/* Hero Admin Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
          <View style={styles.profileTopRow}>
            <View style={[styles.avatarRing, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Ionicons name="shield-checkmark" size={32} color="#EF4444" />
            </View>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <ThemedText style={[styles.adminName, { color: theme.text }]}>
                {user?.fullName || "Directeur Réseau Afric'"}
              </ThemedText>
              <ThemedText style={[styles.adminPhone, { color: theme.textMuted }]}>
                {user?.phoneNumber || '+242060000001'}
              </ThemedText>
              <View style={[styles.roleBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <ThemedText style={{ color: '#EF4444', fontSize: 11, fontWeight: '800' }}>
                  ADMINISTRATEUR SYSTÈME CENTRAL
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Server & Network Diagnostics Card */}
        <View style={[styles.diagnosticsCard, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
          <View style={styles.diagnosticsHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="server-outline" size={20} color={theme.accentPrimary} />
              <ThemedText style={[styles.cardSectionTitle, { color: theme.text }]}>
                État du Serveur Central
              </ThemedText>
            </View>

            <Pressable onPress={checkServerHealth} disabled={checkingHealth}>
              {checkingHealth ? (
                <ActivityIndicator size="small" color={theme.accentPrimary} />
              ) : (
                <Ionicons name="refresh" size={18} color={theme.accentPrimary} />
              )}
            </Pressable>
          </View>

          <View style={styles.diagItem}>
            <ThemedText style={{ color: theme.textMuted, fontSize: 12 }}>URL Backend :</ThemedText>
            <ThemedText style={[styles.diagVal, { color: theme.text }]}>{API_BASE_URL}</ThemedText>
          </View>

          <View style={styles.diagItem}>
            <ThemedText style={{ color: theme.textMuted, fontSize: 12 }}>Statut Santé :</ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: health?.status === 'healthy' ? theme.statusSuccess : theme.statusError,
                }}
              />
              <ThemedText
                style={{
                  color: health?.status === 'healthy' ? theme.statusSuccess : theme.statusError,
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {health?.status === 'healthy' ? 'OPÉRATIONNEL (HEALTHY)' : 'INACCESSIBLE'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.diagItem}>
            <ThemedText style={{ color: theme.textMuted, fontSize: 12 }}>Plateforme :</ThemedText>
            <ThemedText style={[styles.diagVal, { color: theme.text }]}>
              {health?.platform || 'AfriRo Fuel Platform'}
            </ThemedText>
          </View>
        </View>

        {/* Quick Access Menu */}
        <ThemedText style={[styles.cardSectionTitle, { color: theme.text, marginTop: Spacing.md, marginBottom: 8 }]}>
          Gestion et Raccourcis
        </ThemedText>

        <View style={[styles.menuCard, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
          <Pressable
            onPress={() => router.push('/(admin)/stations')}
            style={styles.menuItem}
          >
            <Ionicons name="business-outline" size={20} color={theme.textSecondary} />
            <ThemedText style={[styles.menuItemText, { color: theme.text }]}>
              Réseau Stations-Service & POS
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>

          <View style={styles.menuDivider} />

          <Pressable
            onPress={() => router.push('/(admin)/cards')}
            style={styles.menuItem}
          >
            <Ionicons name="card-outline" size={20} color={theme.textSecondary} />
            <ThemedText style={[styles.menuItemText, { color: theme.text }]}>
              Stock Cartes NFC & Flottes
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>

          <View style={styles.menuDivider} />

          <Pressable
            onPress={() => router.push('/(admin)/users')}
            style={styles.menuItem}
          >
            <Ionicons name="people-outline" size={20} color={theme.textSecondary} />
            <ThemedText style={[styles.menuItemText, { color: theme.text }]}>
              Comptes & Rôles Opérateurs
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>

          <View style={styles.menuDivider} />

          <Pressable
            onPress={() => router.push('/(admin)/clients')}
            style={styles.menuItem}
          >
            <Ionicons name="briefcase-outline" size={20} color={theme.textSecondary} />
            <ThemedText style={[styles.menuItemText, { color: theme.text }]}>
              Portefeuille & Comptes Clients
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>
        </View>

        {/* Logout Button */}
        <Pressable
          onPress={handleLogout}
          style={[styles.logoutBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.statusError} />
          <ThemedText style={[styles.logoutBtnText, { color: theme.statusError }]}>
            Déconnexion de l'Administration
          </ThemedText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
  },
  header: {
    marginBottom: Spacing.md,
  },
  headerCaption: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  profileCard: {
    borderRadius: Radius.chip,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminName: {
    fontSize: 16,
    fontWeight: '800',
  },
  adminPhone: {
    fontSize: 13,
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    marginTop: 6,
  },
  diagnosticsCard: {
    borderRadius: Radius.chip,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  diagnosticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  diagItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  diagVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  menuCard: {
    borderRadius: Radius.chip,
    paddingVertical: 4,
    marginBottom: Spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
  },
  menuItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 12,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: Spacing.md,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.chip,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
