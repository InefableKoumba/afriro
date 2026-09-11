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
  hasPin: boolean;
  clientAttached: boolean;
  companyName?: string;
  clientType?: string;
  clientPhone?: string;
}

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

  // Processing, PIN & Receipt State
  const [processing, setProcessing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [receiptSlip, setReceiptSlip] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [stationInfo, setStationInfo] = useState<{ stationName: string; address: string } | null>(null);

  useEffect(() => {
    const unsub = mobileAuth.subscribe((u) => setUser(u));
    return () => unsub();
  }, []);

  // Fetch station details
  useEffect(() => {
    if (user?.stationId) {
      fetch(`${API_BASE_URL}/api/stations/${user.stationId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setStationInfo({
              stationName: data.stationName || "Afric' Station",
              address: data.address || data.city || 'Congo',
            });
          }
        })
        .catch(() => {});
    }
  }, [user?.stationId]);

  // Fetch or resolve card when cardUid is provided
  useEffect(() => {
    if (params.cardUid) {
      loadCardByUid(params.cardUid);
    }
  }, [params.cardUid]);

  const loadCardByUid = async (uid: string, ndefData?: any) => {
    const cleanUid = uid.trim().toUpperCase();
    if (!cleanUid) return;
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
          vehiclePlate: data.vehiclePlate || ndefData?.vehiclePlate,
          assignedDriverName: data.assignedDriverName || ndefData?.userName || ndefData?.driverName,
          fuelTypeRestriction: data.fuelTypeRestriction || ndefData?.fuelRestriction,
          dailySpendLimitFcfa: data.dailySpendLimitFcfa
            ? Number(data.dailySpendLimitFcfa)
            : ndefData?.dailyLimitFcfa ?? undefined,
          weeklySpendLimitFcfa: data.weeklySpendLimitFcfa ? Number(data.weeklySpendLimitFcfa) : undefined,
          hasPin: Boolean(data.hasPin),
          clientAttached: Boolean(data.clientAttached || data.company || data.user || data.companyId),
          companyName: data.company?.companyName || data.user?.fullName,
          clientType: data.company?.clientType || (data.user ? 'Particulier' : undefined),
          clientPhone: data.company?.contactPhone || data.user?.phoneNumber,
        };
        setSelectedCard(item);
        if (item.fuelTypeRestriction === 'Super' || item.fuelTypeRestriction === 'Gazole') {
          setFuelType(item.fuelTypeRestriction);
        }
      } else if (ndefData && (ndefData.app === 'AFRIRO-PAY' || ndefData.userName)) {
        // Fallback using data stored directly on the physical NFC chip
        const item: CardItem = {
          cardUid: cleanUid,
          status: 'Active',
          balanceFcfa: 0,
          offlineCounter: 0,
          vehiclePlate: ndefData.vehiclePlate,
          assignedDriverName: ndefData.userName || ndefData.driverName,
          fuelTypeRestriction: ndefData.fuelRestriction,
          dailySpendLimitFcfa: ndefData.dailyLimitFcfa ?? undefined,
          hasPin: true,
          clientAttached: Boolean(ndefData.companyId || ndefData.companyName || ndefData.userName),
          companyName: ndefData.companyName || ndefData.userName,
          clientType: 'Entreprise',
          clientPhone: ndefData.userPhone,
        };
        setSelectedCard(item);
        if (item.fuelTypeRestriction === 'Super' || item.fuelTypeRestriction === 'Gazole') {
          setFuelType(item.fuelTypeRestriction);
        }
      } else {
        setSelectedCard(null);
        Alert.alert('Carte Introuvable', `La carte ${cleanUid} n'a pas été trouvée dans le système.`);
      }
    } catch {
      if (ndefData && (ndefData.app === 'AFRIRO-PAY' || ndefData.userName)) {
        // Offline pump attendant payment using data directly on the card
        const item: CardItem = {
          cardUid: cleanUid,
          status: 'Active',
          balanceFcfa: 0,
          offlineCounter: 0,
          vehiclePlate: ndefData.vehiclePlate,
          assignedDriverName: ndefData.userName || ndefData.driverName,
          fuelTypeRestriction: ndefData.fuelRestriction,
          dailySpendLimitFcfa: ndefData.dailyLimitFcfa ?? undefined,
          hasPin: true,
          clientAttached: Boolean(ndefData.companyId || ndefData.companyName || ndefData.userName),
          companyName: ndefData.companyName || ndefData.userName,
          clientType: 'Entreprise',
          clientPhone: ndefData.userPhone,
        };
        setSelectedCard(item);
        if (item.fuelTypeRestriction === 'Super' || item.fuelTypeRestriction === 'Gazole') {
          setFuelType(item.fuelTypeRestriction);
        }
      } else {
        setSelectedCard(null);
        Alert.alert('Erreur', `Impossible de contacter le serveur pour vérifier la carte ${cleanUid}.`);
      }
    } finally {
      setLoadingCard(false);
    }
  };

  // Quick NFC Scan
  const handleQuickNfcTap = async () => {
    try {
      const res = await nfcService.readCardPayload();
      if (res.success && res.cardUid) {
        await loadCardByUid(res.cardUid, res.ndefData);
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

  // Step 1: Pre-validation before triggering PIN modal
  const handleInitiatePayment = () => {
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

    if (!selectedCard.clientAttached) {
      const msg = "Paiement impossible : Cette carte n'est rattachée à aucun client.";
      setPaymentError(msg);
      Alert.alert('Client Requis', msg);
      return;
    }

    if (!selectedCard.hasPin) {
      const msg = "Paiement impossible : Cette carte ne possède aucun code PIN configuré. Le client doit d'abord configurer son code PIN depuis son tableau de bord.";
      setPaymentError(msg);
      Alert.alert('Code PIN Requis', msg);
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

    // Open PIN Entry Modal
    setEnteredPin('');
    setPinError(null);
    setShowPinModal(true);
  };

  // Step 2: Confirm Payment with 4-digit PIN
  const handleConfirmPaymentWithPin = async (pinToSubmit?: string) => {
    const pin = (pinToSubmit || enteredPin).trim();
    if (pin.length !== 4) {
      setPinError('Veuillez saisir les 4 chiffres du code PIN.');
      return;
    }

    setProcessing(true);
    setPinError(null);

    const deviceId = 'POS-BZV-01';
    const stationId = user?.stationId || '11111111-1111-1111-1111-111111111111';
    const attendantId = user?.userId;

    try {
      // 1. Online transaction to server with PIN
      const onlineRes = await fetch(`${API_BASE_URL}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardUid: selectedCard!.cardUid,
          deviceId,
          stationId,
          attendantId,
          amountFcfa: totalAmountFcfa,
          liters: totalLitersDispensed,
          fuelType,
          pinCode: pin,
        }),
      });

      if (!onlineRes.ok) {
        const errData = await onlineRes.json().catch(() => ({}));
        const errorMsg = errData.error || errData.detail || 'Erreur lors du paiement';
        if (errData.isFrozen && selectedCard) {
          setSelectedCard({ ...selectedCard, status: 'Suspended' });
        }
        setPinError(errorMsg);
        setEnteredPin('');
        setProcessing(false);
        return;
      }

      const serverTx = await onlineRes.json();

      // Successful online payment!
      setShowPinModal(false);
      setEnteredPin('');

      const nextCounter = (selectedCard!.offlineCounter || 0) + 1;
      const keyDeriv = 'KEY-DERIV-' + selectedCard!.cardUid;
      const signature = await signOfflineTransaction(
        selectedCard!.cardUid,
        deviceId,
        totalAmountFcfa,
        nextCounter,
        keyDeriv
      );

      // Record in localDb as synced (isSynced: 1)
      await localDb.queueTransaction({
        id: serverTx.id || `TXN-${Date.now()}`,
        cardUid: selectedCard!.cardUid,
        deviceId,
        stationId,
        attendantId,
        amountFcfa: totalAmountFcfa,
        liters: totalLitersDispensed,
        fuelType,
        offlineCounter: nextCounter,
        signature,
        timestamp: serverTx.timestamp || new Date().toISOString(),
      });

      // Update card balance in state
      const newBalance = serverTx.remainingBalance ?? (selectedCard!.balanceFcfa - totalAmountFcfa);
      setSelectedCard({
        ...selectedCard!,
        balanceFcfa: newBalance,
        offlineCounter: nextCounter,
      });

      // Generate formatted thermal receipt
      const slip = thermalPrinter.formatReceipt({
        stationName: stationInfo?.stationName || "Afric' Station Poto-Poto",
        stationAddress: stationInfo?.address || 'Avenue de la Paix, Brazzaville',
        pumpNumber: '03',
        terminalId: deviceId,
        attendantName: user?.fullName || 'Jean-Paul Samba',
        cardUid: selectedCard!.cardUid,
        vehiclePlate: selectedCard!.vehiclePlate,
        driverName: selectedCard!.assignedDriverName || selectedCard!.companyName,
        fuelType,
        liters: totalLitersDispensed,
        pricePerLiter,
        amountFcfa: totalAmountFcfa,
        remainingBalanceFcfa: newBalance,
        signature,
        timestamp: serverTx.timestamp || new Date().toISOString(),
      });

      setReceiptSlip(slip);
      setShowReceiptModal(true);
    } catch (networkErr: any) {
      // Offline fallback: if network error, queue locally and alert
      try {
        const nextCounter = (selectedCard!.offlineCounter || 0) + 1;
        const keyDeriv = 'KEY-DERIV-' + selectedCard!.cardUid;
        const signature = await signOfflineTransaction(
          selectedCard!.cardUid,
          deviceId,
          totalAmountFcfa,
          nextCounter,
          keyDeriv
        );

        const txId = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const timestamp = new Date().toISOString();

        await localDb.queueTransaction({
          id: txId,
          cardUid: selectedCard!.cardUid,
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

        const newBalance = selectedCard!.balanceFcfa - totalAmountFcfa;
        setSelectedCard({
          ...selectedCard!,
          balanceFcfa: newBalance,
          offlineCounter: nextCounter,
        });

        setShowPinModal(false);
        setEnteredPin('');

        const slip = thermalPrinter.formatReceipt({
          stationName: stationInfo?.stationName || "Afric' Station Poto-Poto",
          stationAddress: stationInfo?.address || 'Avenue de la Paix, Brazzaville',
          pumpNumber: '03',
          terminalId: deviceId,
          attendantName: user?.fullName || 'Jean-Paul Samba',
          cardUid: selectedCard!.cardUid,
          vehiclePlate: selectedCard!.vehiclePlate,
          driverName: selectedCard!.assignedDriverName || selectedCard!.companyName,
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
        syncOfflineLedger().catch(() => {});
      } catch (e: any) {
        Alert.alert('Erreur', e?.message || 'Échec du traitement du paiement');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (processing) return;
    setPinError(null);
    if (enteredPin.length < 4) {
      const next = enteredPin + digit;
      setEnteredPin(next);
      if (next.length === 4) {
        handleConfirmPaymentWithPin(next);
      }
    }
  };

  const handleKeypadBackspace = () => {
    if (processing) return;
    setPinError(null);
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    if (processing) return;
    setPinError(null);
    setEnteredPin('');
  };

  const isCardUsable =
    selectedCard?.status === 'Active' &&
    Boolean(selectedCard?.clientAttached) &&
    Boolean(selectedCard?.hasPin);

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
                {selectedCard?.companyName
                  ? `${selectedCard.companyName} (${selectedCard.clientType || 'Client'})`
                  : selectedCard?.vehiclePlate
                  ? `Véhicule: ${selectedCard.vehiclePlate}`
                  : 'Carte Carburant Standard'}
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

          {/* Balance & Security Status Row */}
          {selectedCard && (
            <View style={styles.cardBalanceRow}>
              <View>
                <ThemedText style={[styles.balanceLabel, { color: theme.textMuted }]}>
                  Solde Disponible :
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

              <View style={styles.cardBadgesGroup}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        selectedCard.hasPin
                          ? 'rgba(34, 197, 94, 0.15)'
                          : 'rgba(245, 158, 11, 0.15)',
                    },
                  ]}
                >
                  <Ionicons
                    name={selectedCard.hasPin ? 'shield-checkmark' : 'alert-circle'}
                    size={12}
                    color={selectedCard.hasPin ? theme.statusSuccess : theme.statusWarning}
                  />
                  <ThemedText
                    style={[
                      styles.statusBadgeText,
                      { color: selectedCard.hasPin ? theme.statusSuccess : theme.statusWarning },
                    ]}
                  >
                    {selectedCard.hasPin ? 'PIN ACTIF' : 'SANS PIN'}
                  </ThemedText>
                </View>

                {selectedCard.status !== 'Active' && (
                  <View style={[styles.statusBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <ThemedText style={[styles.statusBadgeText, { color: theme.statusError }]}>
                      {selectedCard.status.toUpperCase()}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Blocking alerts inside card summary */}
          {selectedCard && !selectedCard.clientAttached && (
            <View style={[styles.inlineAlert, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Ionicons name="alert-circle" size={16} color={theme.statusError} />
              <ThemedText style={[styles.inlineAlertText, { color: theme.statusError }]}>
                Carte non rattachée à un client : paiement impossible.
              </ThemedText>
            </View>
          )}

          {selectedCard && selectedCard.clientAttached && !selectedCard.hasPin && (
            <View style={[styles.inlineAlert, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Ionicons name="lock-closed" size={16} color={theme.statusWarning} />
              <ThemedText style={[styles.inlineAlertText, { color: theme.statusWarning }]}>
                Code PIN non configuré : le client doit définir son code PIN sur son dashboard.
              </ThemedText>
            </View>
          )}
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
        {/* QUANTITY & AMOUNT CALCULATION                           */}
        {/* ======================================================= */}
        <ThemedText style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.md }]}>
          2. Volume (L) ou Montant (FCFA)
        </ThemedText>

        <View style={styles.calcRow}>
          <View style={[styles.calcBox, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
            <ThemedText style={[styles.calcBoxLabel, { color: theme.textMuted }]}>
              Volume Servi (Litres)
            </ThemedText>
            <View style={styles.calcInputWrap}>
              <TextInput
                style={[styles.calcInput, { color: theme.text }]}
                keyboardType="decimal-pad"
                value={liters}
                onChangeText={handleLitersChange}
                selectTextOnFocus
              />
              <ThemedText style={[styles.calcInputUnit, { color: theme.textMuted }]}>L</ThemedText>
            </View>
          </View>

          <View style={[styles.calcBox, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
            <ThemedText style={[styles.calcBoxLabel, { color: theme.textMuted }]}>
              Montant Total (FCFA)
            </ThemedText>
            <View style={styles.calcInputWrap}>
              <TextInput
                style={[styles.calcInput, { color: theme.accentPrimary, fontWeight: '800' }]}
                keyboardType="number-pad"
                value={manualAmount}
                onChangeText={handleAmountChange}
                selectTextOnFocus
              />
              <ThemedText style={[styles.calcInputUnit, { color: theme.textMuted }]}>FCFA</ThemedText>
            </View>
          </View>
        </View>

        {/* Presets */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
          {PRESET_AMOUNTS.map((fcfa) => (
            <Pressable
              key={fcfa}
              style={[
                styles.presetChip,
                {
                  backgroundColor: dark ? '#22201E' : '#EBE5DE',
                  borderColor: manualAmount === fcfa.toString() ? theme.accentPrimary : 'transparent',
                },
              ]}
              onPress={() => handleSelectPreset(fcfa)}
            >
              <ThemedText
                style={[
                  styles.presetChipText,
                  {
                    color: manualAmount === fcfa.toString() ? theme.accentPrimary : theme.text,
                    fontWeight: manualAmount === fcfa.toString() ? '700' : '500',
                  },
                ]}
              >
                {fcfa.toLocaleString('fr-FR')} F
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {/* Error Alert Box */}
        {paymentError && (
          <View style={[styles.errorCard, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
            <Ionicons name="alert-circle" size={20} color={theme.statusError} />
            <ThemedText style={[styles.errorText, { color: theme.statusError }]}>
              {paymentError}
            </ThemedText>
          </View>
        )}

        {/* Pay Action Button */}
        <Pressable
          style={({ pressed }) => [
            styles.payBtn,
            {
              backgroundColor: isCardUsable ? theme.accentPrimary : dark ? '#2A2725' : '#D1CBC4',
              opacity: !isCardUsable ? 0.6 : pressed ? 0.9 : 1,
            },
          ]}
          onPress={handleInitiatePayment}
          disabled={!isCardUsable}
        >
          <Ionicons name="lock-closed" size={20} color={isCardUsable ? '#FFFFFF' : theme.textMuted} />
          <ThemedText
            style={[
              styles.payBtnText,
              { color: isCardUsable ? '#FFFFFF' : theme.textMuted },
            ]}
          >
            {isCardUsable
              ? `Valider & Saisir Code PIN (${totalAmountFcfa.toLocaleString('fr-FR')} FCFA)`
              : !selectedCard?.clientAttached
              ? 'Carte non rattachée à un client'
              : !selectedCard?.hasPin
              ? 'Code PIN non configuré'
              : 'Carte Invalide'}
          </ThemedText>
        </Pressable>
      </ScrollView>

      {/* ======================================================= */}
      {/* 4-DIGIT PIN ENTRY MODAL (SECURE FORECOURT AUTH)          */}
      {/* ======================================================= */}
      <Modal visible={showPinModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.pinSheet,
              {
                backgroundColor: dark ? '#1A1817' : '#FFFFFF',
                paddingBottom: Math.max(insets.bottom, 16) + 16,
              },
            ]}
          >
            <View style={styles.modalHandle} />

            <View style={styles.pinHeader}>
              <View style={[styles.pinIconCircle, { backgroundColor: theme.accentPrimary + '1A' }]}>
                <Ionicons name="shield-checkmark" size={28} color={theme.accentPrimary} />
              </View>
              <ThemedText style={[styles.pinTitle, { color: theme.text }]}>
                Code PIN Client
              </ThemedText>
              <ThemedText style={[styles.pinAmountSubtitle, { color: theme.accentPrimary }]}>
                {totalAmountFcfa.toLocaleString('fr-FR')} FCFA · {totalLitersDispensed} L {fuelType}
              </ThemedText>
              <ThemedText style={[styles.pinInstruction, { color: theme.textMuted }]}>
                Demandez au client de composer son code secret à 4 chiffres sur ce terminal.
              </ThemedText>
            </View>

            {/* PIN Dots (Masked) */}
            <View style={styles.pinDotsRow}>
              {[0, 1, 2, 3].map((index) => {
                const isFilled = enteredPin.length > index;
                const isCurrent = enteredPin.length === index;
                return (
                  <View
                    key={index}
                    style={[
                      styles.pinDot,
                      {
                        borderColor: isCurrent ? theme.accentPrimary : dark ? '#444' : '#CCC',
                        backgroundColor: isFilled
                          ? theme.accentPrimary
                          : dark
                          ? '#22201E'
                          : '#F5F0EB',
                      },
                    ]}
                  >
                    {isFilled && <View style={styles.pinDotInner} />}
                  </View>
                );
              })}
            </View>

            {/* PIN Error Message */}
            {pinError && (
              <View style={[styles.pinErrorBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <Ionicons name="alert-circle" size={16} color={theme.statusError} />
                <ThemedText style={[styles.pinErrorText, { color: theme.statusError }]}>
                  {pinError}
                </ThemedText>
              </View>
            )}

            {/* Virtual Numeric Keypad */}
            <View style={styles.keypadContainer}>
              <View style={styles.keypadRow}>
                {['1', '2', '3'].map((digit) => (
                  <Pressable
                    key={digit}
                    style={({ pressed }) => [
                      styles.keypadBtn,
                      {
                        backgroundColor: pressed
                          ? theme.accentTranslucent
                          : dark
                          ? '#252321'
                          : '#F3EFEA',
                      },
                    ]}
                    onPress={() => handleKeypadPress(digit)}
                    disabled={processing}
                  >
                    <ThemedText style={[styles.keypadDigit, { color: theme.text }]}>
                      {digit}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.keypadRow}>
                {['4', '5', '6'].map((digit) => (
                  <Pressable
                    key={digit}
                    style={({ pressed }) => [
                      styles.keypadBtn,
                      {
                        backgroundColor: pressed
                          ? theme.accentTranslucent
                          : dark
                          ? '#252321'
                          : '#F3EFEA',
                      },
                    ]}
                    onPress={() => handleKeypadPress(digit)}
                    disabled={processing}
                  >
                    <ThemedText style={[styles.keypadDigit, { color: theme.text }]}>
                      {digit}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.keypadRow}>
                {['7', '8', '9'].map((digit) => (
                  <Pressable
                    key={digit}
                    style={({ pressed }) => [
                      styles.keypadBtn,
                      {
                        backgroundColor: pressed
                          ? theme.accentTranslucent
                          : dark
                          ? '#252321'
                          : '#F3EFEA',
                      },
                    ]}
                    onPress={() => handleKeypadPress(digit)}
                    disabled={processing}
                  >
                    <ThemedText style={[styles.keypadDigit, { color: theme.text }]}>
                      {digit}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.keypadRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.keypadBtn,
                    styles.keypadActionBtn,
                    {
                      backgroundColor: pressed ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    setShowPinModal(false);
                    setEnteredPin('');
                    setPinError(null);
                  }}
                  disabled={processing}
                >
                  <ThemedText style={[styles.keypadCancelText, { color: theme.statusError }]}>
                    Annuler
                  </ThemedText>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.keypadBtn,
                    {
                      backgroundColor: pressed
                        ? theme.accentTranslucent
                        : dark
                        ? '#252321'
                        : '#F3EFEA',
                    },
                  ]}
                  onPress={() => handleKeypadPress('0')}
                  disabled={processing}
                >
                  <ThemedText style={[styles.keypadDigit, { color: theme.text }]}>0</ThemedText>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.keypadBtn,
                    styles.keypadActionBtn,
                    {
                      backgroundColor: pressed ? theme.accentTranslucent : 'transparent',
                    },
                  ]}
                  onPress={handleKeypadBackspace}
                  disabled={processing}
                >
                  <Ionicons name="backspace-outline" size={24} color={theme.text} />
                </Pressable>
              </View>
            </View>

            {/* Manual confirm button if already entered 4 digits */}
            {enteredPin.length === 4 && (
              <Pressable
                style={[styles.pinConfirmBtn, { backgroundColor: theme.accentPrimary }]}
                onPress={() => handleConfirmPaymentWithPin()}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.pinConfirmBtnText}>Valider le Paiement</ThemedText>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* ======================================================= */}
      {/* THERMAL RECEIPT SLIP MODAL                              */}
      {/* ======================================================= */}
      <Modal visible={showReceiptModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: dark ? '#1A1817' : '#FFFFFF',
                paddingBottom: Math.max(insets.bottom, 20) + 16,
              },
            ]}
          >
            <View style={styles.modalHandle} />

            <View style={styles.successHeader}>
              <Ionicons name="checkmark-circle" size={44} color={theme.statusSuccess} />
              <ThemedText style={[styles.successTitle, { color: theme.text }]}>
                Paiement Validé avec Succès !
              </ThemedText>
              <ThemedText style={[styles.successSub, { color: theme.textMuted }]}>
                Code PIN validé. La transaction a été enregistrée et débitée de la carte client.
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
    borderRadius: Radius.chip,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    backgroundColor: 'rgba(192, 106, 50, 0.1)',
  },
  cardMeta: {
    flex: 1,
  },
  cardUidText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardSubText: {
    fontSize: 12,
    marginTop: 2,
  },
  changeCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
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
    alignItems: 'center',
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  balanceLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardBadgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  inlineAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: Radius.xs,
    marginTop: 8,
  },
  inlineAlertText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  fuelToggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  fuelOption: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 4,
  },
  fuelOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  fuelOptionPrice: {
    fontSize: 12,
  },
  calcRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  calcBox: {
    flex: 1,
    borderRadius: Radius.card,
    padding: Spacing.md,
  },
  calcBoxLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  calcInputWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  calcInput: {
    fontSize: 22,
    fontWeight: '700',
    padding: 0,
    minWidth: 50,
  },
  calcInputUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  presetScroll: {
    marginBottom: Spacing.md,
    paddingVertical: 4,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginRight: 8,
  },
  presetChipText: {
    fontSize: 13,
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
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  pinSheet: {
    borderTopLeftRadius: Radius.modal,
    borderTopRightRadius: Radius.modal,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  pinHeader: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  pinIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  pinTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  pinAmountSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  pinInstruction: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: Spacing.md,
  },
  pinDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginVertical: Spacing.md,
  },
  pinDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  pinErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: Radius.xs,
    marginBottom: Spacing.sm,
  },
  pinErrorText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  keypadContainer: {
    gap: 10,
    marginVertical: Spacing.xs,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  keypadBtn: {
    flex: 1,
    height: 56,
    borderRadius: Radius.chip,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadActionBtn: {
    backgroundColor: 'transparent',
  },
  keypadDigit: {
    fontSize: 22,
    fontWeight: '700',
  },
  keypadCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pinConfirmBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.chip,
    marginTop: Spacing.md,
  },
  pinConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
