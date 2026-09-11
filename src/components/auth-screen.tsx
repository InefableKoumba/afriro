import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { mobileAuth } from "@/services/auth";

interface AuthScreenProps {
  onSuccess?: () => void;
  onOpenOnboarding?: () => void;
}

export default function AuthScreen({
  onSuccess,
  onOpenOnboarding,
}: AuthScreenProps) {
  const scheme = useColorScheme();
  const dark = scheme !== "light";
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!phone || !password) {
      setError("Veuillez renseigner votre numéro et mot de passe.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await mobileAuth.login(phone, password);
    setLoading(false);

    if (res.success) {
      onSuccess?.();
    } else {
      setError(res.error || "Identifiants invalides");
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
              <View
                style={[
                  styles.logoDot,
                  { backgroundColor: theme.accentPrimary },
                ]}
              />
              <ThemedText
                type="caption"
                style={{ color: theme.accentPrimary, fontWeight: "500" }}
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
              Authentifiez-vous pour accéder à votre terminal de gestion et vos
              cartes carburant.
            </ThemedText>
          </View>

          {/* Form Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.backgroundElement,
              },
            ]}
          >
            <ThemedText type="subtitle" style={{ color: theme.text }}>
              Connexion Professionnelle
            </ThemedText>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color={theme.statusError}
                />
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
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={theme.textMuted}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Submit Button */}
              <Pressable
                onPress={handleLogin}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: theme.accentPrimary,
                    opacity: loading ? 0.7 : pressed ? 0.9 : 1,
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <ThemedText type="smallBold" style={{ color: "#FFFFFF" }}>
                      Se Connecter
                    </ThemedText>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </>
                )}
              </Pressable>
            </View>
          </View>

          {/* Re-run Onboarding link */}
          {onOpenOnboarding && (
            <Pressable onPress={onOpenOnboarding} style={styles.onboardingLink}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={theme.accentPrimary}
              />
              <ThemedText type="label" style={{ color: theme.accentPrimary }}>
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
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: Spacing.lg,
    maxWidth: 500,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    marginBottom: Spacing.lg,
  },
  brandBadge: {
    flexDirection: "row",
    alignItems: "center",
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
    marginBottom: Spacing.lg,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: Radius.chip,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    marginTop: 10,
  },
  formGroup: {
    marginTop: Spacing.md,
    gap: 14,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  primaryButton: {
    height: 48,
    borderRadius: Radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  quickSection: {
    marginBottom: Spacing.lg,
  },
  quickHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  quickList: {
    gap: 8,
  },
  quickCard: {
    borderRadius: Radius.card,
    padding: 14,
  },
  quickCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quickRoleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  quickIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  loginChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
  },
  onboardingLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: Spacing.md,
  },
});
