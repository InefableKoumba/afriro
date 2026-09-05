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

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from '@/constants/api';
import { DEMO_PROFILES, DemoProfileItem, mobileAuth, MobileUserSession } from '@/services/auth';

export default function ProfileScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<MobileUserSession | null>(mobileAuth.getUser());
  const [switchingRole, setSwitchingRole] = useState<string | null>(null);
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);

  useEffect(() => {
    const unsub = mobileAuth.subscribe((u) => setUser(u));
    return () => unsub();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous certain de vouloir fermer la session sur ce terminal ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se Déconnecter', style: 'destructive', onPress: () => mobileAuth.logout() },
      ]
    );
  };

  const handleSwitchProfile = async (profile: DemoProfileItem) => {
    if (user?.role === profile.role) return;
    setSwitchingRole(profile.role);
    const res = await mobileAuth.quickLoginAsRole(profile.role);
    setSwitchingRole(null);
    if (!res.success) {
      Alert.alert('Erreur', res.error || 'Échec du changement de profil');
    }
  };

  const handleReplayOnboarding = () => {
    mobileAuth.resetOnboarding();
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'PumpAttendant':
        return 'Pompiste Terminal SoftPOS';
      case 'StationCashier':
        return 'Guichetier Caisse Station';
      case 'FleetManager':
        return 'Gestionnaire Flotte B2B (LEC)';
      case 'Driver':
        return 'Chauffeur Flotte & Porteur';
      case 'Admin':
        return 'Superviseur Réseau & Audit';
      default:
        return 'Opérateur Afric\'';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11 }}>
            Compte Opérateur & Sécurité
          </ThemedText>
          <ThemedText type="display" style={{ color: theme.text, fontSize: 24, fontWeight: '700' }}>
            Mon Compte
          </ThemedText>
        </View>

        {/* ======================================================= */}
        {/* HERO USER PROFILE CARD (REVOLUT FINTECH STYLE)          */}
        {/* ======================================================= */}
        {user && (
          <View
            style={[
              styles.heroProfileCard,
              { backgroundColor: '#161514', borderColor: 'rgba(216,128,74,0.3)' },
            ]}
          >
            <View style={styles.profileTopRow}>
              <View style={[styles.avatarRing, { borderColor: theme.accentPrimary }]}>
                <View style={[styles.avatarCore, { backgroundColor: theme.accentTranslucent }]}>
                  <ThemedText style={{ color: theme.accentPrimary, fontSize: 22, fontWeight: '800' }}>
                    {(user.fullName || 'JS')
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </ThemedText>
                </View>
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <ThemedText style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
                  {user.fullName}
                </ThemedText>
                <ThemedText style={{ color: theme.accentPrimary, fontSize: 12, fontWeight: '600', marginTop: 1 }}>
                  {getRoleLabel(user.role)}
                </ThemedText>
                <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>
                  {user.phoneNumber}
                </ThemedText>
              </View>
            </View>

            {/* Quick Status Badges */}
            <View style={[styles.profileMetaRow, { borderTopColor: 'rgba(255,255,255,0.08)' }]}>
              <View style={styles.metaItem}>
                <View style={[styles.metaDot, { backgroundColor: '#22C55E' }]} />
                <ThemedText style={styles.metaText}>Session JWT Valide</ThemedText>
              </View>

              <View style={styles.metaDivider} />

              <View style={styles.metaItem}>
                <Ionicons name="shield-checkmark" size={12} color={theme.accentPrimary} style={{ marginRight: 4 }} />
                <ThemedText style={styles.metaText}>NFC ISO-14443</ThemedText>
              </View>

              <View style={styles.metaDivider} />

              <View style={styles.metaItem}>
                <ThemedText style={styles.metaText}>ID •••• {user.userId.slice(-6)}</ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* ======================================================= */}
        {/* SECURITY & PREFERENCES SECTION                          */}
        {/* ======================================================= */}
        <View style={styles.sectionBlock}>
          <ThemedText style={styles.sectionTitle}>Sécurité & Terminal</ThemedText>

          <View
            style={[
              styles.settingsCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.borderHairline },
            ]}
          >
            {/* Biometric Toggle */}
            <Pressable
              onPress={() => setBiometricsEnabled(!biometricsEnabled)}
              style={[styles.settingRow, { borderBottomColor: theme.borderHairline }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.settingIconBox, { backgroundColor: 'rgba(216,128,74,0.15)' }]}>
                  <Ionicons name="finger-print-outline" size={18} color={theme.accentPrimary} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <ThemedText style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                    Authentification Biométrique
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11 }}>
                    Empreinte digitale / Face Unlock
                  </ThemedText>
                </View>
              </View>
              <Ionicons
                name={biometricsEnabled ? 'toggle' : 'toggle-outline'}
                size={30}
                color={biometricsEnabled ? theme.accentPrimary : theme.textMuted}
              />
            </Pressable>

            {/* Offline Cryptography */}
            <View style={[styles.settingRow, { borderBottomColor: theme.borderHairline }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.settingIconBox, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                  <Ionicons name="key-outline" size={18} color={theme.statusSuccess} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <ThemedText style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                    Signature HMAC Hors-Ligne
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11 }}>
                    SHA-256 avec clé maîtresse dérivée
                  </ThemedText>
                </View>
              </View>
              <View style={styles.chipActive}>
                <ThemedText style={styles.chipActiveText}>Actif</ThemedText>
              </View>
            </View>

            {/* Backend Connectivity Status */}
            <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                <View style={[styles.settingIconBox, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                  <Ionicons name="server-outline" size={18} color="#3B82F6" />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <ThemedText style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                    Serveur Central
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11 }} numberOfLines={1}>
                    {API_BASE_URL}
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.chipActive, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                <ThemedText style={[styles.chipActiveText, { color: theme.statusSuccess }]}>En ligne</ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* ======================================================= */}
        {/* FAST PERSONA / ROLE SWITCHER                           */}
        {/* ======================================================= */}
        <View style={styles.sectionBlock}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <ThemedText style={styles.sectionTitle}>Simulateur de Profils Métier</ThemedText>
            {switchingRole && <ActivityIndicator size="small" color={theme.accentPrimary} />}
          </View>
          <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11, marginBottom: 12 }}>
            Changez instantanément d'opérateur pour visualiser l'interface adaptée.
          </ThemedText>

          <View style={styles.personaGrid}>
            {DEMO_PROFILES.map((prof) => {
              const isCurrent = user?.role === prof.role;
              return (
                <Pressable
                  key={prof.role}
                  onPress={() => handleSwitchProfile(prof)}
                  disabled={!!switchingRole || isCurrent}
                  style={({ pressed }) => [
                    styles.personaCard,
                    {
                      backgroundColor: isCurrent ? 'rgba(216,128,74,0.18)' : theme.backgroundElement,
                      borderColor: isCurrent ? theme.accentPrimary : theme.borderHairline,
                      opacity: isCurrent ? 1 : pressed ? 0.85 : 0.95,
                    },
                  ]}
                >
                  <View style={styles.personaLeft}>
                    <View
                      style={[
                        styles.personaIconBox,
                        {
                          backgroundColor: isCurrent ? theme.accentPrimary : 'rgba(255,255,255,0.08)',
                        },
                      ]}
                    >
                      <Ionicons
                        name={prof.icon as any}
                        size={18}
                        color={isCurrent ? '#FFFFFF' : theme.textMuted}
                      />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <ThemedText
                        style={{
                          color: isCurrent ? theme.accentPrimary : theme.text,
                          fontSize: 14,
                          fontWeight: isCurrent ? '700' : '600',
                        }}
                      >
                        {prof.roleLabel}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11 }}>
                        {prof.sublabel}
                      </ThemedText>
                    </View>
                  </View>

                  {isCurrent ? (
                    <View style={styles.currentPill}>
                      <Ionicons name="checkmark-circle" size={14} color={theme.accentPrimary} />
                      <ThemedText style={styles.currentPillText}>Actif</ThemedText>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ======================================================= */}
        {/* ONBOARDING & GUIDES                                    */}
        {/* ======================================================= */}
        <View style={styles.sectionBlock}>
          <Pressable
            onPress={handleReplayOnboarding}
            style={({ pressed }) => [
              styles.guideButton,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.borderHairline,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.settingIconBox, { backgroundColor: 'rgba(216,128,74,0.15)' }]}>
                <Ionicons name="sparkles-outline" size={18} color={theme.accentPrimary} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <ThemedText style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                  Revoir le Guide d'Accueil
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11 }}>
                  Architecture & découverte d'AfriRo
                </ThemedText>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>
        </View>

        {/* ======================================================= */}
        {/* LOGOUT BUTTON                                          */}
        {/* ======================================================= */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutPill,
            { borderColor: theme.statusError, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color={theme.statusError} style={{ marginRight: 6 }} />
          <ThemedText style={{ color: theme.statusError, fontSize: 14, fontWeight: '700' }}>
            Fermer la Session
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: Spacing.lg,
  },
  heroProfileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCore: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  metaText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sectionBlock: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  settingsCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  settingIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  chipActiveText: {
    color: '#22C55E',
    fontSize: 10,
    fontWeight: '700',
  },
  personaGrid: {
    gap: 8,
  },
  personaCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: Radius.chip,
    borderWidth: 1,
  },
  personaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  personaIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currentPillText: {
    color: '#D8804A',
    fontSize: 11,
    fontWeight: '700',
  },
  guideButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: Radius.chip,
    borderWidth: 1,
  },
  logoutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 20,
  },
});
