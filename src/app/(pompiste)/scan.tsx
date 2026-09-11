import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from '@/constants/api';
import { nfcService } from '@/services/nfc';

interface CardDetails {
  cardUid: string;
  status: string;
  balanceFcfa: number;
  offlineCounter: number;
  vehiclePlate?: string;
  assignedDriverName?: string;
  fuelTypeRestriction?: string;
  dailySpendLimitFcfa?: number;
  weeklySpendLimitFcfa?: number;
  companyId?: string;
}

// Demo cards for simulation & testing on Android emulator or physical device
const DEMO_CARDS: CardDetails[] = [
  {
    cardUid: '04A1B2C3D4E5F6',
    status: 'Active',
    balanceFcfa: 100000,
    offlineCounter: 14,
    vehiclePlate: '542-CG-04',
    assignedDriverName: 'Christian Okamba',
    fuelTypeRestriction: 'Gazole',
    dailySpendLimitFcfa: 50000,
    weeklySpendLimitFcfa: 200000,
  },
  {
    cardUid: '04B2C3D4E5F6A1',
    status: 'Active',
    balanceFcfa: 120000,
    offlineCounter: 6,
    vehiclePlate: '819-CG-04',
    assignedDriverName: 'Jean Makaya',
    fuelTypeRestriction: 'Super',
    dailySpendLimitFcfa: 60000,
    weeklySpendLimitFcfa: 250000,
  },
  {
    cardUid: '04C3D4E5F6A1B2',
    status: 'Suspended',
    balanceFcfa: 35000,
    offlineCounter: 10,
    vehiclePlate: '104-CG-04',
    assignedDriverName: 'Patrice Mabiala',
    fuelTypeRestriction: 'Super',
    dailySpendLimitFcfa: 50000,
    weeklySpendLimitFcfa: 200000,
  },
  {
    cardUid: '04D4E5F6A1B2C3',
    status: 'InStock',
    balanceFcfa: 0,
    offlineCounter: 0,
  },
];

export default function PompisteScanScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [scanning, setScanning] = useState(false);
  const [searching, setSearching] = useState(false);
  const [manualUid, setManualUid] = useState('');
  const [cardResult, setCardResult] = useState<CardDetails | null>(null);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);

  // Trigger Hardware NFC Scan
  const handleNfcScan = async () => {
    setScanning(true);
    setCardResult(null);
    setNotFoundError(null);

    try {
      const res = await nfcService.scanCardTag();
      if (res.success && res.cardUid) {
        await verifyCardUid(res.cardUid);
      } else {
        Alert.alert(
          'Lecture NFC',
          res.error || 'Aucune carte détectée. Vous pouvez saisir l\'identifiant manuellement.'
        );
      }
    } catch {
      Alert.alert('NFC', 'Erreur de capteur NFC.');
    } finally {
      setScanning(false);
    }
  };

  // Verify card validity against Backend or local store
  const verifyCardUid = async (uid: string) => {
    const cleanUid = uid.trim().toUpperCase();
    if (!cleanUid) return;

    setSearching(true);
    setNotFoundError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/cards/${cleanUid}`);
      if (res.ok) {
        const data = await res.json();
        setCardResult({
          cardUid: data.cardUid,
          status: data.status,
          balanceFcfa: Number(data.balanceFcfa) || 0,
          offlineCounter: Number(data.offlineCounter) || 0,
          vehiclePlate: data.vehiclePlate,
          assignedDriverName: data.assignedDriverName,
          fuelTypeRestriction: data.fuelTypeRestriction,
          dailySpendLimitFcfa: data.dailySpendLimitFcfa ? Number(data.dailySpendLimitFcfa) : undefined,
          weeklySpendLimitFcfa: data.weeklySpendLimitFcfa ? Number(data.weeklySpendLimitFcfa) : undefined,
          companyId: data.companyId,
        });
        return;
      }
    } catch {
      // Offline fallback: check local demo cards
    }

    const fallback = DEMO_CARDS.find((c) => c.cardUid.toUpperCase() === cleanUid);
    if (fallback) {
      setCardResult(fallback);
    } else {
      setCardResult(null);
      setNotFoundError(`Carte ${cleanUid} introuvable dans le système.`);
    }
    setSearching(false);
  };

  const handleManualSearch = () => {
    if (!manualUid.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un numéro UID.');
      return;
    }
    verifyCardUid(manualUid);
  };

  const handleSelectDemo = (card: CardDetails) => {
    setManualUid(card.cardUid);
    setCardResult(card);
    setNotFoundError(null);
  };

  const isValid = cardResult?.status === 'Active';

  const getValidityMessage = () => {
    if (!cardResult) return null;
    if (cardResult.status === 'Active') {
      return {
        title: 'CARTE ACTIVE & VALIDE',
        sub: 'La carte est autorisée pour le service à la pompe.',
        color: theme.statusSuccess,
        icon: 'checkmark-circle' as const,
      };
    }
    if (cardResult.status === 'Suspended') {
      return {
        title: 'CARTE SUSPENDUE',
        sub: 'Paiement refusé : cette carte a été bloquée par le gestionnaire ou l\'administrateur.',
        color: theme.statusError,
        icon: 'alert-circle' as const,
      };
    }
    if (cardResult.status === 'InStock') {
      return {
        title: 'CARTE NON ACTIVÉE (EN STOCK)',
        sub: 'Paiement refusé : cette carte est vierge en stock et n\'a pas encore été vendue/activée.',
        color: theme.statusWarning,
        icon: 'pause-circle' as const,
      };
    }
    return {
      title: 'CARTE INVALIDE',
      sub: `Statut actuel : ${cardResult.status}. Utilisation interdite à la pompe.`,
      color: theme.statusError,
      icon: 'close-circle' as const,
    };
  };

  const validityInfo = getValidityMessage();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={[styles.headerCaption, { color: theme.textSecondary }]}>
            Contrôle & Sécurité
          </ThemedText>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
            Vérification Carte NFC
          </ThemedText>
          <ThemedText style={[styles.headerSub, { color: theme.textMuted }]}>
            Vérifiez la validité, le solde et les plafonds d'une carte client avant le plein.
          </ThemedText>
        </View>

        {/* ======================================================= */}
        {/* NFC TAP SCAN BUTTON HERO                                */}
        {/* ======================================================= */}
        <Pressable
          style={({ pressed }) => [
            styles.nfcHeroCard,
            {
              backgroundColor: dark ? '#161514' : theme.backgroundElement,
              borderColor: scanning ? theme.accentPrimary : 'transparent',
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={handleNfcScan}
          disabled={scanning}
        >
          <View
            style={[
              styles.nfcPulseRing,
              { backgroundColor: scanning ? theme.accentTranslucent : 'rgba(192, 106, 50, 0.08)' },
            ]}
          >
            {scanning ? (
              <ActivityIndicator size="large" color={theme.accentPrimary} />
            ) : (
              <Ionicons name="radio" size={48} color={theme.accentPrimary} />
            )}
          </View>
          <ThemedText style={[styles.nfcHeroTitle, { color: theme.text }]}>
            {scanning ? 'Approchez la carte...' : 'Scanner par Contact NFC'}
          </ThemedText>
          <ThemedText style={[styles.nfcHeroSub, { color: theme.textMuted }]}>
            Plaquez la carte au dos de ce terminal
          </ThemedText>
        </Pressable>

        {/* ======================================================= */}
        {/* MANUAL INPUT OPTION                                     */}
        {/* ======================================================= */}
        <View style={[styles.manualBox, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
          <ThemedText style={[styles.manualLabel, { color: theme.textSecondary }]}>
            Ou saisie manuelle de l'UID
          </ThemedText>
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.uidInput,
                {
                  backgroundColor: dark ? '#22201E' : '#F5F0EB',
                  color: theme.text,
                },
              ]}
              placeholder="Ex: 04A1B2C3D4E5F6"
              placeholderTextColor={theme.textMuted}
              value={manualUid}
              onChangeText={setManualUid}
              autoCapitalize="characters"
            />
            <Pressable
              style={[styles.searchBtn, { backgroundColor: theme.accentPrimary }]}
              onPress={handleManualSearch}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="search" size={20} color="#FFFFFF" />
              )}
            </Pressable>
          </View>

          {/* Quick Demo Pickers for instant testing */}
          <ThemedText style={[styles.quickPickLabel, { color: theme.textMuted }]}>
            Cartes de démonstration rapide :
          </ThemedText>
          <View style={styles.quickPickRow}>
            {DEMO_CARDS.map((c) => (
              <Pressable
                key={c.cardUid}
                onPress={() => handleSelectDemo(c)}
                style={[
                  styles.quickChip,
                  {
                    backgroundColor:
                      manualUid === c.cardUid ? theme.accentTranslucent : dark ? '#22201E' : '#EFEAE4',
                    borderColor: manualUid === c.cardUid ? theme.accentPrimary : 'transparent',
                  },
                ]}
              >
                <ThemedText style={[styles.quickChipText, { color: theme.text }]}>
                  {c.cardUid.slice(0, 6)}... ({c.status})
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ======================================================= */}
        {/* NOT FOUND ERROR                                         */}
        {/* ======================================================= */}
        {notFoundError && (
          <View style={[styles.errorCard, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
            <Ionicons name="alert-circle" size={24} color={theme.statusError} />
            <ThemedText style={[styles.errorText, { color: theme.statusError }]}>
              {notFoundError}
            </ThemedText>
          </View>
        )}

        {/* ======================================================= */}
        {/* CARD VALIDATION RESULT CARD                             */}
        {/* ======================================================= */}
        {cardResult && validityInfo && (
          <View style={[styles.resultCard, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
            {/* Validity Banner */}
            <View style={[styles.validityBanner, { backgroundColor: validityInfo.color + '18' }]}>
              <Ionicons name={validityInfo.icon} size={28} color={validityInfo.color} />
              <View style={styles.validityTextGroup}>
                <ThemedText style={[styles.validityTitle, { color: validityInfo.color }]}>
                  {validityInfo.title}
                </ThemedText>
                <ThemedText style={[styles.validitySub, { color: theme.textSecondary }]}>
                  {validityInfo.sub}
                </ThemedText>
              </View>
            </View>

            {/* Card Information Details Grid */}
            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailKey, { color: theme.textMuted }]}>Numéro UID :</ThemedText>
                <ThemedText style={[styles.detailVal, { color: theme.text }]}>{cardResult.cardUid}</ThemedText>
              </View>

              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailKey, { color: theme.textMuted }]}>Solde Disponible :</ThemedText>
                <ThemedText
                  style={[
                    styles.detailVal,
                    {
                      color: cardResult.balanceFcfa > 0 ? theme.statusSuccess : theme.statusError,
                      fontSize: 16,
                      fontWeight: '800',
                    },
                  ]}
                >
                  {cardResult.balanceFcfa.toLocaleString('fr-FR')} FCFA
                </ThemedText>
              </View>

              {cardResult.vehiclePlate && (
                <View style={styles.detailRow}>
                  <ThemedText style={[styles.detailKey, { color: theme.textMuted }]}>Véhicule Assigné :</ThemedText>
                  <ThemedText style={[styles.detailVal, { color: theme.text }]}>
                    {cardResult.vehiclePlate} ({cardResult.assignedDriverName || 'Chauffeur'})
                  </ThemedText>
                </View>
              )}

              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailKey, { color: theme.textMuted }]}>Carburant Autorisé :</ThemedText>
                <ThemedText style={[styles.detailVal, { color: theme.accentPrimary, fontWeight: '700' }]}>
                  {cardResult.fuelTypeRestriction || 'Tous (Super & Gazole)'}
                </ThemedText>
              </View>

              {cardResult.dailySpendLimitFcfa && (
                <View style={styles.detailRow}>
                  <ThemedText style={[styles.detailKey, { color: theme.textMuted }]}>Plafond Journalier :</ThemedText>
                  <ThemedText style={[styles.detailVal, { color: theme.textSecondary }]}>
                    {cardResult.dailySpendLimitFcfa.toLocaleString('fr-FR')} FCFA
                  </ThemedText>
                </View>
              )}

              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailKey, { color: theme.textMuted }]}>Compteur Hors-ligne :</ThemedText>
                <ThemedText style={[styles.detailVal, { color: theme.textSecondary }]}>
                  #{cardResult.offlineCounter}
                </ThemedText>
              </View>
            </View>

            {/* Action to proceed to payment if valid */}
            {isValid && (
              <Pressable
                style={[styles.proceedBtn, { backgroundColor: theme.accentPrimary }]}
                onPress={() =>
                  router.push({
                    pathname: '/(pompiste)/payment',
                    params: { cardUid: cardResult.cardUid },
                  })
                }
              >
                <Ionicons name="flash" size={18} color="#FFFFFF" />
                <ThemedText style={styles.proceedBtnText}>
                  Encaisser avec cette Carte
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
  },
  header: {
    marginBottom: Spacing.md,
  },
  headerCaption: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  nfcHeroCard: {
    borderRadius: Radius.card,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 2,
  },
  nfcPulseRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  nfcHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  nfcHeroSub: {
    fontSize: 13,
  },
  manualBox: {
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  manualLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  uidInput: {
    flex: 1,
    height: 48,
    borderRadius: Radius.chip,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  searchBtn: {
    width: 48,
    height: 48,
    borderRadius: Radius.chip,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickPickLabel: {
    fontSize: 11,
    marginBottom: 6,
  },
  quickPickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.md,
    borderRadius: Radius.chip,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  resultCard: {
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  validityBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.chip,
    marginBottom: Spacing.md,
  },
  validityTextGroup: {
    flex: 1,
  },
  validityTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  validitySub: {
    fontSize: 12,
    lineHeight: 16,
  },
  detailsGrid: {
    gap: 10,
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailKey: {
    fontSize: 13,
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '600',
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.chip,
    marginTop: Spacing.xs,
  },
  proceedBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
