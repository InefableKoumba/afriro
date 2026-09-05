import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DEMO_PROFILES, DemoProfileItem, mobileAuth } from '@/services/auth';

interface AuthScreenProps {
  onSuccess?: () => void;
  onOpenOnboarding?: () => void;
}

export default function AuthScreen({ onSuccess, onOpenOnboarding }: AuthScreenProps) {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState('+242060000003'); // Default to Pompiste
  const [password, setPassword] = useState('Afriro2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quickLoadingRole, setQuickLoadingRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!phone || !password) {
      setError('Veuillez renseigner votre numéro et mot de passe.');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await mobileAuth.login(phone, password);
    setLoading(false);

    if (res.success) {
      onSuccess?.();
    } else {
      setError(res.error || 'Identifiants invalides');
    }
  };

  const handleQuickLogin = async (profile: DemoProfileItem) => {
    setQuickLoadingRole(profile.role);
    setError(null);
    setPhone(profile.phone);
    setPassword('Afriro2026!');

    const res = await mobileAuth.login(profile.phone, 'Afriro2026!');
    setQuickLoadingRole(null);

    if (res.success) {
      onSuccess?.();
    } else {
      setError(res.error || 'Connexion impossible au serveur central');
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Header */}
          <View style={styles.header}>
            <View style={styles.brandBadge}>
              <View style={[styles.logoDot, { backgroundColor: theme.accentPrimary }]} />
              <ThemedText
                type="caption"
                style={{ color: theme.accentPrimary, fontWeight: '500' }}
              >
                RÉSEAU STATIONS AFRIC' CONGO
              </ThemedText>
            </View>

            <ThemedText
              type="display"
              style={[styles.mainTitle, { color: theme.text }]}
            >
              AfriRo Fuel
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.subtitle, { color: theme.textSecondary }]}
            >
              Authentifiez-vous pour accéder à votre terminal de gestion et vos cartes carburant.
            </ThemedText>
          </View>

          {/* Form Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.borderHairline,
              },
            ]}
          >
            <ThemedText type="subtitle" style={{ color: theme.text }}>
              Connexion Professionnelle
            </ThemedText>

            {error && (
              <View style={[styles.errorBox, { borderColor: theme.statusError }]}>
                <Ionicons name="alert-circle-outline" size={16} color={theme.statusError} />
                <ThemedText
                  type="caption"
                  style={{ color: theme.statusError, flex: 1 }}
                >
                  {error}
                </ThemedText>
              </View>
            )}

            <View style={styles.formGroup}>
              {/* Phone Field */}
              <View>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginBottom: 6 }}
                >
                  Numéro de Téléphone
                </ThemedText>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: theme.backgroundSelected,
                      borderColor: theme.borderSubtle,
                    },
                  ]}
                >
                  <Ionicons
                    name="call-outline"
                    size={18}
                    color={theme.textMuted}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    value={phone}
                    onChangeText={(val) => {
                      setPhone(val);
                      if (error) setError(null);
                    }}
                    placeholder="+242060000000"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    style={[styles.input, { color: theme.text }]}
                  />
                </View>
              </View>

              {/* Password Field */}
              <View>
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginBottom: 6 }}
                >
                  Mot de Passe Sécurisé
                </ThemedText>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: theme.backgroundSelected,
                      borderColor: theme.borderSubtle,
                    },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={theme.textMuted}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    value={password}
                    onChangeText={(val) => {
                      setPassword(val);
                      if (error) setError(null);
                    }}
                    placeholder="••••••••••••"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry={!showPassword}
                    style={[styles.input, { color: theme.text }]}
                  />
                  <Pressable
                    onPress={() => setShowPassword((prev) => !prev)}
                    hitSlop={10}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={theme.textMuted}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Submit Button */}
              <Pressable
                onPress={handleLogin}
                disabled={loading || !!quickLoadingRole}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: theme.accentPrimary,
                    opacity: loading || !!quickLoadingRole ? 0.7 : pressed ? 0.9 : 1,
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>
                      Se Connecter
                    </ThemedText>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </>
                )}
              </Pressable>
            </View>
          </View>

          {/* Quick Login Profiles for Testing / Demoing */}
          <View style={styles.quickSection}>
            <View style={styles.quickHeader}>
              <ThemedText type="label" style={{ color: theme.text }}>
                Profils de Test Réels (1-Clic)
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textMuted }}>
                Base PostgreSQL Afric'
              </ThemedText>
            </View>

            <View style={styles.quickList}>
              {DEMO_PROFILES.map((prof) => {
                const isThisLoading = quickLoadingRole === prof.role;
                return (
                  <Pressable
                    key={prof.role}
                    onPress={() => handleQuickLogin(prof)}
                    disabled={loading || !!quickLoadingRole}
                    style={({ pressed }) => [
                      styles.quickCard,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor:
                          quickLoadingRole === prof.role
                            ? theme.accentPrimary
                            : theme.borderHairline,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View style={styles.quickCardHeader}>
                      <View style={styles.quickRoleBadge}>
                        <View
                          style={[
                            styles.quickIconCircle,
                            { backgroundColor: theme.accentTranslucent },
                          ]}
                        >
                          <Ionicons
                            name={prof.icon as any}
                            size={16}
                            color={theme.accentPrimary}
                          />
                        </View>
                        <View>
                          <ThemedText
                            type="smallBold"
                            style={{ color: theme.text }}
                          >
                            {prof.roleLabel}
                          </ThemedText>
                          <ThemedText
                            type="caption"
                            style={{ color: theme.textSecondary, fontSize: 11 }}
                          >
                            {prof.sublabel}
                          </ThemedText>
                        </View>
                      </View>

                      {isThisLoading ? (
                        <ActivityIndicator size="small" color={theme.accentPrimary} />
                      ) : (
                        <View
                          style={[
                            styles.loginChip,
                            {
                              backgroundColor: theme.backgroundSelected,
                              borderColor: theme.borderSubtle,
                            },
                          ]}
                        >
                          <ThemedText
                            type="caption"
                            style={{ color: theme.accentPrimary, fontSize: 11 }}
                          >
                            Tester
                          </ThemedText>
                          <Ionicons
                            name="chevron-forward"
                            size={12}
                            color={theme.accentPrimary}
                          />
                        </View>
                      )}
                    </View>

                    <ThemedText
                      type="caption"
                      style={{ color: theme.textMuted, marginTop: 6 }}
                    >
                      {prof.description}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Re-run Onboarding link */}
          {onOpenOnboarding && (
            <Pressable
              onPress={onOpenOnboarding}
              style={styles.onboardingLink}
            >
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={theme.accentPrimary}
              />
              <ThemedText
                type="label"
                style={{ color: theme.accentPrimary }}
              >
                Revoir la présentation du système (Guide)
              </ThemedText>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: Spacing.lg,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mainTitle: {
    fontSize: 28,
    lineHeight: 34,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderRadius: Radius.card,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: Radius.chip,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    marginTop: 10,
  },
  formGroup: {
    marginTop: Spacing.md,
    gap: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: Radius.chip,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  primaryButton: {
    height: 48,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  quickSection: {
    marginBottom: Spacing.lg,
  },
  quickHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  quickList: {
    gap: 8,
  },
  quickCard: {
    borderRadius: Radius.chip,
    borderWidth: 1,
    padding: 12,
  },
  quickCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  quickIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  onboardingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.md,
  },
});
