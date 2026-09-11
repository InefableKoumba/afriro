import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from '@/constants/api';
import { localDb } from '@/services/local-db';
import { signOfflineTransaction } from '@/services/crypto';
import { thermalPrinter } from '@/services/printer';
import { mobileAuth, MobileUserSession } from '@/services/auth';
import { syncOfflineLedger } from '@/services/sync-service';
import { nfcService } from '@/services/nfc';

interface CardItem {
  cardUid: string;
  status: string;
  balanceFcfa: number;
  offlineCounter: number;
  vehiclePlate?: string;
  assignedDriverName?: string;
  fuelTypeRestriction?: string;
  dailySpendLimitFcfa?: number;
  weeklySpendLimitFcfa?: number;
}

const DEMO_CARDS: CardItem[] = [
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
  },
];

const PRESET_AMOUNTS = [5000, 10000, 15000, 20000, 50000];

export default function PompistePaymentScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ cardUid?: string }>();

  const [user, setUser] = useState<MobileUserSession | null>(mobileAuth.getUser());
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);

  // Fuel options
  const [fuelType, setFuelType] = useState<'Super' | 'Gazole'>('Gazole');
  const [liters, setLiters] = useState('20');
  const [manualAmount, setManualAmount] = useState('13000');
  const [lastEdited, setLastEdited] = useState<'liters' | 'amount'>('liters');

  // Pricing
  const pricePerLiter = fuelType === 'Super' ? 775 : 650;

  // Processing & Receipt State
  const [processing, setProcessing] = useState(false);
  const [receiptSlip, setReceiptSlip] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = mobileAuth.subscribe((u) => setUser(u));
    return () => unsub();
  }, []);

  // Fetch or resolve card when cardUid is provided
  useEffect(() => {
    const targetUid = params.cardUid || DEMO_CARDS[0].cardUid;
    loadCardByUid(targetUid);
  }, [params.cardUid]);

  const loadCardByUid = async (uid: string) => {
    const cleanUid = uid.trim().toUpperCase();
    setLoadingCard(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cards/${cleanUid}`);
      if (res.ok) {
        const data = await res.json();
        const item: CardItem = {
          cardUid: data.cardUid,
          status: data.status,
          balanceFcfa: Number(data.balanceFcfa) || 0,
          offlineCounter: Number(data.offlineCounter) || 0,
          vehiclePlate: data.vehiclePlate,
          assignedDriverName: data.assignedDriverName,
          fuelTypeRestriction: data.fuelTypeRestriction,
          dailySpendLimitFcfa: data.dailySpendLimitFcfa ? Number(data.dailySpendLimitFcfa) : undefined,
          weeklySpendLimitFcfa: data.weeklySpendLimitFcfa ? Number(data.weeklySpendLimitFcfa) : undefined,
        };
        setSelectedCard(item);
        if (item.fuelTypeRestriction === 'Super' || item.fuelTypeRestriction === 'Gazole') {
          setFuelType(item.fuelTypeRestriction);
        }
        setLoadingCard(false);
        return;
      }
    } catch {}

    const fallback = DEMO_CARDS.find((c) => c.cardUid.toUpperCase() === cleanUid) || DEMO_CARDS[0];
    setSelectedCard(fallback);
    if (fallback.fuelTypeRestriction === 'Super' || fallback.fuelTypeRestriction === 'Gazole') {
      setFuelType(fallback.fuelTypeRestriction);
    }
    setLoadingCard(false);
  };

  // Quick NFC Scan
  const handleQuickNfcTap = async () => {
    try {
      const res = await nfcService.scanCardTag();
      if (res.success && res.cardUid) {
        await loadCardByUid(res.cardUid);
      } else {
        Alert.alert('NFC', res.error || 'Aucune carte détectée.');
      }
    } catch {
      Alert.alert('NFC', 'Erreur de lecture NFC.');
    }
  };

  // Handle Liters input change
  const handleLitersChange = (val: string) => {
    setLastEdited('liters');
    setLiters(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setManualAmount(Math.round(num * pricePerLiter).toString());
    } else {
      setManualAmount('0');
    }
  };

  // Handle Amount input change
  const handleAmountChange = (val: string) => {
    setLastEdited('amount');
    setManualAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setLiters((num / pricePerLiter).toFixed(2));
    } else {
      setLiters('0');
    }
  };

  // Switch Fuel Type
  const handleSelectFuel = (type: 'Super' | 'Gazole') => {
    setFuelType(type);
    const p = type === 'Super' ? 775 : 650;
    if (lastEdited === 'liters') {
      const numL = parseFloat(liters) || 0;
      setManualAmount(Math.round(numL * p).toString());
    } else {
      const numA = parseFloat(manualAmount) || 0;
      setLiters((numA / p).toFixed(2));
    }
  };

  const handleSelectPreset = (fcfa: number) => {
    setLastEdited('amount');
    setManualAmount(fcfa.toString());
    setLiters((fcfa / pricePerLiter).toFixed(2));
  };

  // Amount & Liters numeric calculations
  const totalAmountFcfa = parseFloat(manualAmount) || 0;
  const totalLitersDispensed = parseFloat(liters) || 0;

  // Execute Payment
  const handleExecutePayment = async () => {
    setPaymentError(null);

    if (!selectedCard) {
      Alert.alert('Erreur', 'Veuillez sélectionner ou scanner une carte NFC.');
      return;
    }

    if (selectedCard.status !== 'Active') {
      const msg = `Paiement rejeté : La carte est ${selectedCard.status}.`;
      setPaymentError(msg);
      Alert.alert('Paiement Rejeté', msg);
      return;
    }

    if (totalAmountFcfa <= 0 || totalLitersDispensed <= 0) {
      const msg = 'Veuillez saisir un volume ou un montant valide.';
      setPaymentError(msg);
      Alert.alert('Erreur', msg);
      return;
    }

    // Check fuel restriction
    if (
      selectedCard.fuelTypeRestriction &&
      selectedCard.fuelTypeRestriction !== 'Tous' &&
      selectedCard.fuelTypeRestriction.toLowerCase() !== fuelType.toLowerCase()
    ) {
      const msg = `Restriction carburant : cette carte autorise uniquement le ${selectedCard.fuelTypeRestriction}.`;
      setPaymentError(msg);
      Alert.alert('Carburant Incompatible', msg);
      return;
    }

    // Check spend limit
    if (
      selectedCard.dailySpendLimitFcfa &&
      totalAmountFcfa > selectedCard.dailySpendLimitFcfa
    ) {
      const msg = `Plafond journalier dépassé : ${selectedCard.dailySpendLimitFcfa.toLocaleString('fr-FR')} FCFA max autorisé.`;
      setPaymentError(msg);
      Alert.alert('Plafond Dépassé', msg);
      return;
    }

    // Check balance
    if (totalAmountFcfa > selectedCard.balanceFcfa) {
      const msg = `Solde insuffisant : ${selectedCard.balanceFcfa.toLocaleString('fr-FR')} FCFA disponible.`;
      setPaymentError(msg);
      Alert.alert('Solde Insuffisant', msg);
      return;
    }

    setProcessing(true);

    try {
      const nextCounter = (selectedCard.offlineCounter || 0) + 1;
      const deviceId = 'POS-BZV-01';
      const stationId = user?.stationId || '11111111-1111-1111-1111-111111111111';
      const attendantId = user?.userId || '55555555-5555-5555-5555-555555555555';
      const keyDeriv = 'KEY-DERIV-' + selectedCard.cardUid;

      // 1. Digital signature
      const signature = await signOfflineTransaction(
        selectedCard.cardUid,
        deviceId,
        totalAmountFcfa,
        nextCounter,
        keyDeriv
      );

      const txId = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const timestamp = new Date().toISOString();

      // 2. Queue into local DB
      await localDb.queueTransaction({
        id: txId,
        cardUid: selectedCard.cardUid,
        deviceId,
        stationId,
        attendantId,
        amountFcfa: totalAmountFcfa,
        liters: totalLitersDispensed,
        fuelType,
        offlineCounter: nextCounter,
        signature,
        timestamp,
      });

      // 3. Update local card balance
      const newBalance = selectedCard.balanceFcfa - totalAmountFcfa;
      setSelectedCard({
        ...selectedCard,
        balanceFcfa: newBalance,
        offlineCounter: nextCounter,
      });

      // 4. Generate formatted thermal receipt
      const slip = thermalPrinter.formatReceipt({
        stationName: "Afric' Station Poto-Poto",
        stationAddress: 'Avenue de la Paix, Brazzaville',
        pumpNumber: '03',
        terminalId: deviceId,
        attendantName: user?.fullName || 'Jean-Paul Samba',
        cardUid: selectedCard.cardUid,
        vehiclePlate: selectedCard.vehiclePlate,
        driverName: selectedCard.assignedDriverName,
        fuelType,
        liters: totalLitersDispensed,
        pricePerLiter,
        amountFcfa: totalAmountFcfa,
        remainingBalanceFcfa: newBalance,
        signature,
        timestamp,
      });

      setReceiptSlip(slip);
      setShowReceiptModal(true);

      // 5. Fire background sync
      syncOfflineLedger().catch(() => {});
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Échec du traitement du paiement');
    } finally {
      setProcessing(false);
    }
  };

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
            Terminal SoftPOS Forecourt
          </ThemedText>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
            Encaissement Carburant
          </ThemedText>
        </View>

        {/* ======================================================= */}
        {/* ACTIVE CLIENT CARD SUMMARY                              */}
        {/* ======================================================= */}
        <View style={[styles.cardHeaderBox, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
          <View style={styles.cardHeaderTop}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="card" size={24} color={theme.accentPrimary} />
            </View>
            <View style={styles.cardMeta}>
              <ThemedText style={[styles.cardUidText, { color: theme.text }]}>
                {selectedCard?.cardUid || 'Recherche carte...'}
              </ThemedText>
              <ThemedText style={[styles.cardSubText, { color: theme.textMuted }]}>
                {selectedCard?.vehiclePlate ? `Véhicule: ${selectedCard.vehiclePlate}` : 'Carte Carburant Standard'}
                {selectedCard?.assignedDriverName ? ` · ${selectedCard.assignedDriverName}` : ''}
              </ThemedText>
            </View>

            <Pressable
              onPress={handleQuickNfcTap}
              style={[styles.changeCardBtn, { backgroundColor: theme.accentTranslucent }]}
            >
              <Ionicons name="radio" size={16} color={theme.accentPrimary} />
              <ThemedText style={[styles.changeCardBtnText, { color: theme.accentPrimary }]}>
                NFC
              </ThemedText>
            </Pressable>
          </View>

          {/* Balance & Limits row */}
          {selectedCard && (
            <View style={styles.cardBalanceRow}>
              <View>
                <ThemedText style={[styles.balanceLabel, { color: theme.textMuted }]}>
                  Solde Carte Disponible :
                </ThemedText>
                <ThemedText
                  style={[
                    styles.balanceValue,
                    { color: selectedCard.balanceFcfa > 0 ? theme.statusSuccess : theme.statusError },
                  ]}
                >
                  {selectedCard.balanceFcfa.toLocaleString('fr-FR')} FCFA
                </ThemedText>
              </View>

              {selectedCard.status !== 'Active' && (
                <View style={[styles.suspendedBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <ThemedText style={[styles.suspendedText, { color: theme.statusError }]}>
                    {selectedCard.status.toUpperCase()}
                  </ThemedText>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Quick select demo card chips */}
        <View style={styles.demoChipsRow}>
          {DEMO_CARDS.map((c) => (
            <Pressable
              key={c.cardUid}
              onPress={() => setSelectedCard(c)}
              style={[
                styles.demoChip,
                {
                  backgroundColor:
                    selectedCard?.cardUid === c.cardUid
                      ? theme.accentTranslucent
                      : dark
                      ? '#201E1C'
                      : '#EFECE7',
                  borderColor: selectedCard?.cardUid === c.cardUid ? theme.accentPrimary : 'transparent',
                },
              ]}
            >
              <ThemedText style={[styles.demoChipText, { color: theme.text }]}>
                •••• {c.cardUid.slice(-4)} ({c.status})
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {/* ======================================================= */}
        {/* FUEL PRODUCT SELECTOR (GAZOLE vs SUPER)                 */}
        {/* ======================================================= */}
        <ThemedText style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.sm }]}>
          1. Produit Pétrolier
        </ThemedText>

        <View style={styles.fuelToggleRow}>
          <Pressable
            style={[
              styles.fuelOption,
              {
                backgroundColor: fuelType === 'Gazole' ? theme.accentPrimary : dark ? '#161514' : theme.backgroundElement,
                borderColor: fuelType === 'Gazole' ? theme.accentPrimary : 'transparent',
              },
            ]}
            onPress={() => handleSelectFuel('Gazole')}
          >
            <Ionicons
              name="speedometer"
              size={20}
              color={fuelType === 'Gazole' ? '#FFFFFF' : theme.textSecondary}
            />
            <ThemedText
              style={[
                styles.fuelOptionTitle,
                { color: fuelType === 'Gazole' ? '#FFFFFF' : theme.text },
              ]}
            >
              Gazole
            </ThemedText>
            <ThemedText
              style={[
                styles.fuelOptionPrice,
                { color: fuelType === 'Gazole' ? '#FFFFFF' : theme.textMuted },
              ]}
            >
              650 FCFA / L
            </ThemedText>
          </Pressable>

          <Pressable
            style={[
              styles.fuelOption,
              {
                backgroundColor: fuelType === 'Super' ? theme.accentPrimary : dark ? '#161514' : theme.backgroundElement,
                borderColor: fuelType === 'Super' ? theme.accentPrimary : 'transparent',
              },
            ]}
            onPress={() => handleSelectFuel('Super')}
          >
            <Ionicons
              name="flame"
              size={20}
              color={fuelType === 'Super' ? '#FFFFFF' : theme.textSecondary}
            />
            <ThemedText
              style={[
                styles.fuelOptionTitle,
                { color: fuelType === 'Super' ? '#FFFFFF' : theme.text },
              ]}
            >
              Super Essence
            </ThemedText>
            <ThemedText
              style={[
                styles.fuelOptionPrice,
                { color: fuelType === 'Super' ? '#FFFFFF' : theme.textMuted },
              ]}
            >
              775 FCFA / L
            </ThemedText>
          </Pressable>
        </View>

        {/* ======================================================= */}
        {/* VOLUME & AMOUNT CONVERTER INPUTS                        */}
        {/* ======================================================= */}
        <ThemedText style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.md }]}>
          2. Volume & Montant
        </ThemedText>

        <View style={styles.inputsGrid}>
          {/* Liters Input */}
          <View style={[styles.inputBox, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
            <ThemedText style={[styles.inputLabel, { color: theme.textMuted }]}>Volume (Litres)</ThemedText>
            <View style={styles.inputInnerRow}>
              <TextInput
                style={[styles.numericInput, { color: theme.text }]}
                keyboardType="numeric"
                value={liters}
                onChangeText={handleLitersChange}
                selectTextOnFocus
              />
              <ThemedText style={[styles.unitSuffix, { color: theme.accentPrimary }]}>L</ThemedText>
            </View>
          </View>

          {/* Amount FCFA Input */}
          <View style={[styles.inputBox, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
            <ThemedText style={[styles.inputLabel, { color: theme.textMuted }]}>Montant (FCFA)</ThemedText>
            <View style={styles.inputInnerRow}>
              <TextInput
                style={[styles.numericInput, { color: theme.text }]}
                keyboardType="numeric"
                value={manualAmount}
                onChangeText={handleAmountChange}
                selectTextOnFocus
              />
              <ThemedText style={[styles.unitSuffix, { color: theme.accentPrimary }]}>FCFA</ThemedText>
            </View>
          </View>
        </View>

        {/* Quick Amount Presets */}
        <View style={styles.presetsRow}>
          {PRESET_AMOUNTS.map((amt) => (
            <Pressable
              key={amt}
              onPress={() => handleSelectPreset(amt)}
              style={[
                styles.presetChip,
                {
                  backgroundColor:
                    totalAmountFcfa === amt ? theme.accentTranslucent : dark ? '#1C1A18' : '#F0EBE4',
                  borderColor: totalAmountFcfa === amt ? theme.accentPrimary : 'transparent',
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.presetChipText,
                  { color: totalAmountFcfa === amt ? theme.accentPrimary : theme.textSecondary },
                ]}
              >
                {amt >= 1000 ? `${amt / 1000}k` : amt}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {/* Error Alert Box */}
        {paymentError && (
          <View style={[styles.errorCard, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
            <Ionicons name="alert-circle" size={20} color={theme.statusError} />
            <ThemedText style={[styles.errorText, { color: theme.statusError }]}>
              {paymentError}
            </ThemedText>
          </View>
        )}

        {/* ======================================================= */}
        {/* EXECUTE PAYMENT ACTION BUTTON                           */}
        {/* ======================================================= */}
        <Pressable
          style={({ pressed }) => [
            styles.payBtn,
            {
              backgroundColor: theme.accentPrimary,
              opacity: processing || selectedCard?.status !== 'Active' ? 0.6 : pressed ? 0.9 : 1,
            },
          ]}
          onPress={handleExecutePayment}
          disabled={processing || selectedCard?.status !== 'Active'}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
              <ThemedText style={styles.payBtnText}>
                Valider & Débiter {totalAmountFcfa.toLocaleString('fr-FR')} FCFA
              </ThemedText>
            </>
          )}
        </Pressable>
      </ScrollView>

      {/* ======================================================= */}
      {/* THERMAL RECEIPT SLIP MODAL                              */}
      {/* ======================================================= */}
      <Modal visible={showReceiptModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: dark ? '#1A1817' : '#FFFFFF' }]}>
            <View style={styles.modalHandle} />

            <View style={styles.successHeader}>
              <Ionicons name="checkmark-circle" size={44} color={theme.statusSuccess} />
              <ThemedText style={[styles.successTitle, { color: theme.text }]}>
                Paiement Validé avec Succès !
              </ThemedText>
              <ThemedText style={[styles.successSub, { color: theme.textMuted }]}>
                La transaction a été signée cryptographiquement et débitée de la carte NFC.
              </ThemedText>
            </View>

            {receiptSlip && (
              <ScrollView style={styles.slipScroll} showsVerticalScrollIndicator={false}>
                <View style={[styles.slipPaper, { backgroundColor: dark ? '#0F0E0D' : '#F9F7F5' }]}>
                  <ThemedText style={[styles.slipContent, { color: theme.text }]}>
                    {receiptSlip}
                  </ThemedText>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.printBtn, { backgroundColor: theme.accentTranslucent }]}
                onPress={() => {
                  Alert.alert('Impression', 'Ticket transmis à l\'imprimante thermique Bluetooth.');
                }}
              >
                <Ionicons name="print-outline" size={18} color={theme.accentPrimary} />
                <ThemedText style={[styles.printBtnText, { color: theme.accentPrimary }]}>
                  Imprimer Ticket
                </ThemedText>
              </Pressable>

              <Pressable
                style={[styles.doneBtn, { backgroundColor: theme.accentPrimary }]}
                onPress={() => {
                  setShowReceiptModal(false);
                  router.replace('/(pompiste)');
                }}
              >
                <ThemedText style={styles.doneBtnText}>Terminé</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  cardHeaderBox: {
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(192, 106, 50, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  cardMeta: {
    flex: 1,
  },
  cardUidText: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubText: {
    fontSize: 12,
  },
  changeCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  changeCardBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
    paddingTop: Spacing.sm,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  suspendedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.chip,
  },
  suspendedText: {
    fontSize: 11,
    fontWeight: '800',
  },
  demoChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.md,
  },
  demoChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  demoChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  fuelToggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  fuelOption: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.card,
    alignItems: 'center',
    borderWidth: 1.5,
    gap: 4,
  },
  fuelOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  fuelOptionPrice: {
    fontSize: 11,
    fontWeight: '600',
  },
  inputsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  inputBox: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.card,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputInnerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  numericInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    padding: 0,
  },
  unitSuffix: {
    fontSize: 14,
    fontWeight: '700',
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
    borderRadius: Radius.chip,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  payBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: Radius.chip,
    marginTop: Spacing.sm,
    elevation: 3,
    shadowColor: '#C06A32',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: Radius.modal,
    borderTopRightRadius: Radius.modal,
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#888888',
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: Spacing.md,
  },
  slipScroll: {
    maxHeight: 280,
    marginBottom: Spacing.md,
  },
  slipPaper: {
    padding: Spacing.md,
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: '#444444',
  },
  slipContent: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  printBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: Radius.chip,
  },
  printBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  doneBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: Radius.chip,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
