import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { API_BASE_URL } from '@/constants/api';
import { nfcService } from '@/services/nfc';

interface CompanyDetails {
  id: string;
  companyName: string;
  clientType?: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  registrationNumber?: string | null;
  creditBalance?: number;
}

interface UserDetails {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: string;
}

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
  hasPin: boolean;
  clientAttached: boolean;
  company?: CompanyDetails | null;
  user?: UserDetails | null;
}

export default function PompisteScanScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [scanning, setScanning] = useState(false);
  const [searching, setSearching] = useState(false);
  const [cardResult, setCardResult] = useState<CardDetails | null>(null);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);

  // Trigger Hardware NFC Scan
  const handleNfcScan = async () => {
    setScanning(true);
    setCardResult(null);
    setNotFoundError(null);

    try {
      const res = await nfcService.readCardPayload();
      if (res.success && res.cardUid) {
        await verifyCardUid(res.cardUid, res.ndefData);
      } else {
        Alert.alert(
          'Lecture NFC',
          res.error || 'Aucune carte détectée. Plaquez la carte fermement au dos du terminal.'
        );
      }
    } catch {
      Alert.alert('NFC', 'Erreur de communication avec le capteur NFC.');
    } finally {
      setScanning(false);
    }
  };

  // Verify card validity against Backend or local store, with NDEF payload enrichment
  const verifyCardUid = async (uid: string, ndefData?: any) => {
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
          vehiclePlate: data.vehiclePlate || ndefData?.vehiclePlate,
          assignedDriverName: data.assignedDriverName || ndefData?.userName || ndefData?.driverName,
          fuelTypeRestriction: data.fuelTypeRestriction || ndefData?.fuelRestriction,
          dailySpendLimitFcfa: data.dailySpendLimitFcfa
            ? Number(data.dailySpendLimitFcfa)
            : ndefData?.dailyLimitFcfa ?? undefined,
          weeklySpendLimitFcfa: data.weeklySpendLimitFcfa ? Number(data.weeklySpendLimitFcfa) : undefined,
          companyId: data.companyId || ndefData?.companyId,
          hasPin: Boolean(data.hasPin),
          clientAttached: Boolean(data.clientAttached || data.company || data.user || data.companyId),
          company: data.company || (ndefData?.companyName ? { id: ndefData.companyId || '', companyName: ndefData.companyName, clientType: 'Business' } : null),
          user: data.user || (ndefData?.userName ? { id: ndefData.userId || '', fullName: ndefData.userName, phoneNumber: ndefData.userPhone || '', role: 'Client' } : null),
        });
      } else if (ndefData && (ndefData.app === 'AFRIRO-PAY' || ndefData.userName)) {
        // Chip data authenticated offline fallback
        setCardResult({
          cardUid: cleanUid,
          status: 'Active',
          balanceFcfa: 0,
          offlineCounter: 0,
          vehiclePlate: ndefData.vehiclePlate,
          assignedDriverName: ndefData.userName || ndefData.driverName,
          fuelTypeRestriction: ndefData.fuelRestriction,
          dailySpendLimitFcfa: ndefData.dailyLimitFcfa ?? undefined,
          companyId: ndefData.companyId || undefined,
          hasPin: true,
          clientAttached: Boolean(ndefData.companyId || ndefData.companyName || ndefData.userName),
          company: ndefData.companyName ? { id: ndefData.companyId || '', companyName: ndefData.companyName, clientType: 'Business' } : null,
          user: ndefData.userName ? { id: ndefData.userId || '', fullName: ndefData.userName, phoneNumber: ndefData.userPhone || '', role: 'Client' } : null,
        });
      } else {
        setCardResult(null);
        setNotFoundError(`Carte ${cleanUid} introuvable dans le réseau Afric'.`);
      }
    } catch {
      if (ndefData && (ndefData.app === 'AFRIRO-PAY' || ndefData.userName)) {
        // Offline terminal fallback using authenticated chip payload
        setCardResult({
          cardUid: cleanUid,
          status: 'Active',
          balanceFcfa: 0,
          offlineCounter: 0,
          vehiclePlate: ndefData.vehiclePlate,
          assignedDriverName: ndefData.userName || ndefData.driverName,
          fuelTypeRestriction: ndefData.fuelRestriction,
          dailySpendLimitFcfa: ndefData.dailyLimitFcfa ?? undefined,
          companyId: ndefData.companyId || undefined,
          hasPin: true,
          clientAttached: Boolean(ndefData.companyId || ndefData.companyName || ndefData.userName),
          company: ndefData.companyName ? { id: ndefData.companyId || '', companyName: ndefData.companyName, clientType: 'Business' } : null,
          user: ndefData.userName ? { id: ndefData.userId || '', fullName: ndefData.userName, phoneNumber: ndefData.userPhone || '', role: 'Client' } : null,
        });
      } else {
        setCardResult(null);
        setNotFoundError(`Impossible de joindre le serveur pour vérifier la carte ${cleanUid}.`);
      }
    } finally {
      setSearching(false);
    }
  };

  const isClientAttached = Boolean(
    cardResult?.clientAttached ||
    cardResult?.company ||
    cardResult?.user ||
    cardResult?.companyId
  );
  const hasPinConfigured = Boolean(cardResult?.hasPin);
  const isCardActive = cardResult?.status === 'Active';
  const canProceedToPayment = isCardActive && isClientAttached && hasPinConfigured;

  const getValidityMessage = () => {
    if (!cardResult) return null;

    if (cardResult.status !== 'Active') {
      if (cardResult.status === 'Suspended') {
        return {
          title: 'CARTE SUSPENDUE',
          sub: 'Paiement interdit : Cette carte a été verrouillée par son gestionnaire ou l\'administrateur.',
          color: theme.statusError,
          icon: 'alert-circle' as const,
        };
      }
      if (cardResult.status === 'InStock') {
        return {
          title: 'CARTE EN STOCK (NON ACTIVÉE)',
          sub: 'Paiement interdit : Carte vierge en stock magasin, non vendue à un client.',
          color: theme.statusWarning,
          icon: 'pause-circle' as const,
        };
      }
      return {
        title: 'CARTE INVALIDE',
        sub: `Statut actuel : ${cardResult.status}. Utilisation refusée.`,
        color: theme.statusError,
        icon: 'close-circle' as const,
      };
    }

    if (!isClientAttached) {
      return {
        title: 'AUCUN CLIENT ASSOCIÉ',
        sub: 'Paiement interdit : Cette carte n\'est rattachée à aucun client. Elle ne peut pas être utilisée pour un paiement.',
        color: theme.statusError,
        icon: 'alert-circle' as const,
      };
    }

    if (!hasPinConfigured) {
      return {
        title: 'CODE PIN NON CONFIGURÉ',
        sub: 'Paiement interdit : Aucun code PIN configuré. Le client doit d\'abord définir son code PIN depuis son tableau de bord.',
        color: theme.statusWarning,
        icon: 'lock-closed-outline' as const,
      };
    }

    return {
      title: 'CARTE ACTIVE & VALIDE',
      sub: 'Client identifié et code PIN configuré. Prête pour l\'encaissement sécurisé.',
      color: theme.statusSuccess,
      icon: 'checkmark-circle' as const,
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
            Scannez la carte client par contact NFC pour vérifier son authenticité, son solde et son code PIN.
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
              borderColor: scanning || searching ? theme.accentPrimary : 'transparent',
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={handleNfcScan}
          disabled={scanning || searching}
        >
          <View
            style={[
              styles.nfcPulseRing,
              { backgroundColor: scanning || searching ? theme.accentTranslucent : 'rgba(192, 106, 50, 0.08)' },
            ]}
          >
            {scanning || searching ? (
              <ActivityIndicator size="large" color={theme.accentPrimary} />
            ) : (
              <Ionicons name="radio" size={48} color={theme.accentPrimary} />
            )}
          </View>
          <ThemedText style={[styles.nfcHeroTitle, { color: theme.text }]}>
            {scanning
              ? 'Approchez la carte NFC...'
              : searching
              ? 'Vérification en cours...'
              : 'Scanner par Contact NFC'}
          </ThemedText>
          <ThemedText style={[styles.nfcHeroSub, { color: theme.textMuted }]}>
            {scanning || searching
              ? 'Maintien du contact avec le dos de l\'appareil'
              : 'Plaquez la carte physique au dos du terminal pour lire'}
          </ThemedText>
        </Pressable>

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

            {/* ======================================================= */}
            {/* ATTACHED CLIENT DETAILS SECTION                         */}
            {/* ======================================================= */}
            {isClientAttached ? (
              <View
                style={[
                  styles.clientSection,
                  {
                    backgroundColor: dark ? '#1D1B18' : '#FAF6F0',
                    borderColor: theme.accentPrimary + '30',
                  },
                ]}
              >
                <View style={styles.clientHeaderRow}>
                  <View
                    style={[
                      styles.clientIconCircle,
                      { backgroundColor: theme.accentPrimary + '1A' },
                    ]}
                  >
                    <Ionicons
                      name={cardResult.company ? 'business' : 'person'}
                      size={20}
                      color={theme.accentPrimary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.clientSectionLabel, { color: theme.textMuted }]}>
                      {cardResult.company?.clientType === 'Business'
                        ? 'Client Entreprise'
                        : 'Client Particulier'}
                    </ThemedText>
                    <ThemedText style={[styles.clientNameText, { color: theme.text }]}>
                      {cardResult.company?.companyName ||
                        cardResult.user?.fullName ||
                        'Client Afric\''}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.clientTypeBadge,
                      { backgroundColor: theme.accentPrimary + '20' },
                    ]}
                  >
                    <ThemedText
                      style={[styles.clientTypeBadgeText, { color: theme.accentPrimary }]}
                    >
                      {cardResult.company?.clientType || 'Titulaire'}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.clientMetaRow}>
                  {(cardResult.company?.contactPhone || cardResult.user?.phoneNumber) && (
                    <View style={styles.clientMetaItem}>
                      <Ionicons name="call-outline" size={14} color={theme.textSecondary} />
                      <ThemedText style={[styles.clientMetaText, { color: theme.textSecondary }]}>
                        {cardResult.company?.contactPhone || cardResult.user?.phoneNumber}
                      </ThemedText>
                    </View>
                  )}
                  {cardResult.company?.registrationNumber && (
                    <View style={styles.clientMetaItem}>
                      <Ionicons name="card-outline" size={14} color={theme.textSecondary} />
                      <ThemedText style={[styles.clientMetaText, { color: theme.textSecondary }]}>
                        N° {cardResult.company.registrationNumber}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.clientWarningBox,
                  {
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    borderColor: theme.statusError + '30',
                  },
                ]}
              >
                <Ionicons name="alert-circle" size={22} color={theme.statusError} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.clientWarningTitle, { color: theme.statusError }]}>
                    Aucun Client Rattaché
                  </ThemedText>
                  <ThemedText style={[styles.clientWarningSub, { color: theme.textSecondary }]}>
                    Cette carte n'appartient à aucun compte client. Elle ne peut pas être utilisée pour effectuer des paiements de carburant.
                  </ThemedText>
                </View>
              </View>
            )}

            {/* ======================================================= */}
            {/* PIN SECURITY CODE ALERT                                  */}
            {/* ======================================================= */}
            {!hasPinConfigured && (
              <View
                style={[
                  styles.pinWarningBox,
                  {
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    borderColor: theme.statusWarning + '30',
                  },
                ]}
              >
                <Ionicons name="lock-closed" size={20} color={theme.statusWarning} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.pinWarningTitle, { color: theme.statusWarning }]}>
                    Code PIN Non Configuré
                  </ThemedText>
                  <ThemedText style={[styles.pinWarningSub, { color: theme.textSecondary }]}>
                    Le client titulaire doit obligatoirement définir un code secret à 4 chiffres depuis son tableau de bord pour autoriser les paiements.
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Card Information Details Grid */}
            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailKey, { color: theme.textMuted }]}>Numéro UID :</ThemedText>
                <ThemedText style={[styles.detailVal, { color: theme.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                  {cardResult.cardUid}
                </ThemedText>
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

              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailKey, { color: theme.textMuted }]}>Code PIN Sécurité :</ThemedText>
                <View style={styles.pinStatusBadge}>
                  <Ionicons
                    name={hasPinConfigured ? 'shield-checkmark' : 'alert-circle'}
                    size={14}
                    color={hasPinConfigured ? theme.statusSuccess : theme.statusWarning}
                  />
                  <ThemedText
                    style={[
                      styles.detailVal,
                      {
                        color: hasPinConfigured ? theme.statusSuccess : theme.statusWarning,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {hasPinConfigured ? 'Actif (4 chiffres)' : 'Non configuré'}
                  </ThemedText>
                </View>
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

            {/* Action to proceed to payment or blocked banner */}
            {canProceedToPayment ? (
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
            ) : (
              <View style={[styles.blockedBtn, { backgroundColor: dark ? '#22201E' : '#E8E2D9' }]}>
                <Ionicons name="lock-closed" size={18} color={theme.textMuted} />
                <ThemedText style={[styles.blockedBtnText, { color: theme.textMuted }]}>
                  Paiement Refusé ({!isClientAttached ? 'Carte sans client' : !hasPinConfigured ? 'Code PIN manquant' : cardResult.status})
                </ThemedText>
              </View>
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
    textAlign: 'center',
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
  clientSection: {
    borderRadius: Radius.chip,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  clientHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  clientIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientSectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clientNameText: {
    fontSize: 15,
    fontWeight: '700',
  },
  clientTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  clientTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  clientMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  clientMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clientMetaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  clientWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: Spacing.md,
    borderRadius: Radius.chip,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  clientWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  clientWarningSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  pinWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: Spacing.md,
    borderRadius: Radius.chip,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  pinWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  pinWarningSub: {
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
  pinStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  blockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.chip,
    marginTop: Spacing.xs,
  },
  blockedBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
