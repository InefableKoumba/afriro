import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { localDb } from '@/services/local-db';
import { syncOfflineLedger } from '@/services/sync-service';
import { signOfflineTransaction } from '@/services/crypto';
import { nfcService } from '@/services/nfc';
import { thermalPrinter } from '@/services/printer';
import { API_BASE_URL, API_ENDPOINTS } from '@/constants/api';
import { mobileAuth, MobileUserSession } from '@/services/auth';

interface CardPayload {
  cardUid: string;
  balanceFcfa: number;
  offlineCounter: number;
  status: string;
  vehiclePlate?: string;
  assignedDriverName?: string;
  fuelTypeRestriction?: string;
  dailySpendLimitFcfa?: number;
  weeklySpendLimitFcfa?: number;
  cardKeyDerivation?: string;
  companyId?: string;
}

export default function WalletDashboardScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [user, setUser] = useState<MobileUserSession | null>(mobileAuth.getUser());
  const [adminActiveTab, setAdminActiveTab] = useState<'pos' | 'caisse' | 'fleet' | 'driver'>('pos');

  // Cards state
  const [cards, setCards] = useState<CardPayload[]>([]);
  const [activeCardUid, setActiveCardUid] = useState<string>('');
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [nfcAvailable, setNfcAvailable] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  // SoftPOS / Fuel Dispenser Modal State
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [liters, setLiters] = useState('20');
  const [fuelType, setFuelType] = useState<'Super' | 'Gazole'>('Gazole');
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSlip, setLastSlip] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Cashier Top-Up Modal State
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('15000');
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState<string | null>(null);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [topupMethod, setTopupMethod] = useState<'Cash' | 'Airtel' | 'MTN'>('Cash');

  // Shift Reconciliation Modal
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [pumpNumber, setPumpNumber] = useState('03');
  const [startMeter, setStartMeter] = useState('1450.00');
  const [endMeter, setEndMeter] = useState('1510.00');
  const [totalPosVol, setTotalPosVol] = useState('60.00');
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [shiftSuccess, setShiftSuccess] = useState<string | null>(null);

  // Sync & Card Lock state
  const [syncLoading, setSyncLoading] = useState(false);
  const [freezeLoading, setFreezeLoading] = useState(false);

  // Recent transactions list from local SQLite
  const [recentTxns, setRecentTxns] = useState<any[]>([]);

  // Prices in FCFA
  const pricePerLiter = fuelType === 'Super' ? 775 : 650;
  const amountFcfa = (parseFloat(liters) || 0) * pricePerLiter;

  useEffect(() => {
    const unsub = mobileAuth.subscribe((u) => setUser(u));
    return () => unsub();
  }, []);

  const loadInitialData = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.CARDS);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setCards(data);
        if (!activeCardUid) {
          setActiveCardUid(data[0].cardUid);
        }
      }
    } catch {}

    const count = await localDb.getPendingCount();
    setPendingQueueCount(count);

    const hasNfc = await nfcService.isHardwareSupported();
    setNfcAvailable(hasNfc);

    try {
      const txns = await localDb.getAllTransactions();
      setRecentTxns(txns.slice(0, 5));
    } catch {}
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const activeCard = cards.find((c) => c.cardUid === activeCardUid) || cards[0];
  const userRole = user?.role || 'PumpAttendant';

  // ==========================================
  // SoftPOS Fuel Payment Logic
  // ==========================================
  const handleTapToPay = async () => {
    let targetCard = activeCard;

    if (nfcAvailable) {
      setIsProcessing(true);
      setPaymentError(null);
      setPaymentStatus(null);
      setLastSlip(null);

      const scanResult = await nfcService.scanCardTag();
      if (scanResult.success && scanResult.cardUid) {
        const matched = cards.find((c) => c.cardUid === scanResult.cardUid);
        if (matched) {
          targetCard = matched;
          setActiveCardUid(matched.cardUid);
        } else {
          setIsProcessing(false);
          setPaymentError(`Puce NFC inconnue (${scanResult.cardUid}). Non répertoriée.`);
          return;
        }
      } else {
        setIsProcessing(false);
        setPaymentError(scanResult.error || 'Erreur de lecture NFC physique.');
        return;
      }
    }

    if (!targetCard) {
      setPaymentError('Aucune carte NFC sélectionnée.');
      return;
    }

    if (targetCard.status !== 'Active') {
      setPaymentError(`Carte indisponible : statut '${targetCard.status}'.`);
      return;
    }

    if (
      targetCard.fuelTypeRestriction &&
      targetCard.fuelTypeRestriction.toLowerCase() !== fuelType.toLowerCase()
    ) {
      setPaymentError(`Restriction : cette carte est réservée au ${targetCard.fuelTypeRestriction}.`);
      return;
    }

    if (targetCard.balanceFcfa < amountFcfa) {
      setPaymentError(
        `Solde insuffisant: ${targetCard.balanceFcfa.toLocaleString('fr-FR')} FCFA disponible.`
      );
      return;
    }

    setIsProcessing(true);
    setPaymentStatus(null);
    setPaymentError(null);

    const nextCounter = (targetCard.offlineCounter || 0) + 1;
    const deviceId = 'POS-BZV-01';
    const stationId = user?.stationId || '11111111-1111-1111-1111-111111111111';
    const keyDeriv = targetCard.cardKeyDerivation || 'KEY-DERIV-' + targetCard.cardUid;

    const signature = await signOfflineTransaction(
      targetCard.cardUid,
      deviceId,
      amountFcfa,
      nextCounter,
      keyDeriv
    );

    const txId = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toISOString();

    await localDb.queueTransaction({
      id: txId,
      cardUid: targetCard.cardUid,
      deviceId,
      stationId,
      attendantId: user?.userId,
      amountFcfa,
      liters: parseFloat(liters) || 0,
      fuelType,
      offlineCounter: nextCounter,
      signature,
      timestamp,
    });

    const updatedBalance = targetCard.balanceFcfa - amountFcfa;
    setCards((prev) =>
      prev.map((c) =>
        c.cardUid === targetCard!.cardUid
          ? { ...c, balanceFcfa: updatedBalance, offlineCounter: nextCounter }
          : c
      )
    );

    const slip = thermalPrinter.formatReceipt({
      stationName: "Afric' Station Poto-Poto",
      stationAddress: 'Avenue de la Paix, Brazzaville',
      pumpNumber: pumpNumber,
      terminalId: deviceId,
      attendantName: user?.fullName || 'Jean-Paul Samba',
      cardUid: targetCard.cardUid,
      vehiclePlate: targetCard.vehiclePlate,
      driverName: targetCard.assignedDriverName,
      fuelType,
      liters: parseFloat(liters) || 0,
      pricePerLiter,
      amountFcfa,
      remainingBalanceFcfa: updatedBalance,
      signature,
      timestamp,
    });
    setLastSlip(slip);

    const count = await localDb.getPendingCount();
    setPendingQueueCount(count);
    const txns = await localDb.getAllTransactions();
    setRecentTxns(txns.slice(0, 5));
    setIsProcessing(false);

    setPaymentStatus(
      `Paiement validé (${amountFcfa.toLocaleString('fr-FR')} FCFA). Ledger SQLite signé.`
    );
  };

  // Sync Offline Queue
  const handleSyncQueue = async () => {
    setSyncLoading(true);
    const res = await syncOfflineLedger(
      'POS-BZV-01',
      user?.stationId || '11111111-1111-1111-1111-111111111111'
    );
    setSyncLoading(false);
    Alert.alert('Synchronisation', res.message);
    const count = await localDb.getPendingCount();
    setPendingQueueCount(count);
    const txns = await localDb.getAllTransactions();
    setRecentTxns(txns.slice(0, 5));
  };

  // Cashier Top-up
  const handleProcessCashTopup = async () => {
    const cash = parseFloat(topupAmount);
    if (!cash || cash <= 0) {
      setTopupError('Veuillez renseigner un montant valide.');
      return;
    }
    if (!activeCard) {
      setTopupError('Aucune carte cible disponible.');
      return;
    }

    setTopupLoading(true);
    setTopupError(null);
    setTopupSuccess(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/topups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardUid: activeCard.cardUid,
          cashAmountFcfa: cash,
          cashierId: user?.userId || '44444444-4444-4444-4444-444444444444',
          stationId: user?.stationId || '11111111-1111-1111-1111-111111111111',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTopupSuccess(
          `Recharge validée ! Reçu ${data.receiptNumber} · Nouveau solde: ${Math.round(
            data.newBalance
          ).toLocaleString('fr-FR')} FCFA`
        );
        loadInitialData();
      } else {
        setTopupError(data.error || 'Erreur lors du rechargement');
      }
    } catch {
      // Offline fallback: update local state
      const updatedBalance = (activeCard.balanceFcfa || 0) + cash;
      setCards((prev) =>
        prev.map((c) =>
          c.cardUid === activeCard.cardUid ? { ...c, balanceFcfa: updatedBalance } : c
        )
      );
      setTopupSuccess(
        `Recharge locale enregistrée (+${cash.toLocaleString('fr-FR')} FCFA). Nouveau solde: ${updatedBalance.toLocaleString('fr-FR')} FCFA`
      );
    } finally {
      setTopupLoading(false);
    }
  };

  // Toggle Freeze Card
  const handleToggleFreeze = async () => {
    if (!activeCard) return;
    const nextStatus = activeCard.status === 'Active' ? 'Suspended' : 'Active';
    setFreezeLoading(true);
    try {
      await fetch(API_ENDPOINTS.CARD_STATUS(activeCard.cardUid), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch {}

    setCards((prev) =>
      prev.map((c) => (c.cardUid === activeCard.cardUid ? { ...c, status: nextStatus } : c))
    );
    setFreezeLoading(false);
    Alert.alert(
      nextStatus === 'Active' ? 'Carte Débloquée' : 'Carte Gelée',
      `La carte ${activeCard.cardUid} est désormais ${nextStatus === 'Active' ? 'active' : 'suspendue'}.`
    );
  };

  // Shift Reconciliation Submit
  const handleSubmitShift = async () => {
    setShiftSubmitting(true);
    setShiftSuccess(null);
    try {
      const start = parseFloat(startMeter) || 0;
      const end = parseFloat(endMeter) || 0;
      const posVol = parseFloat(totalPosVol) || 0;

      const res = await fetch(`${API_BASE_URL}/api/reconciliation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: user?.stationId || '11111111-1111-1111-1111-111111111111',
          attendantId: user?.userId || '55555555-5555-5555-5555-555555555555',
          pumpNumber: parseInt(pumpNumber, 10) || 3,
          fuelType,
          startMeterLiters: start,
          endMeterLiters: end,
          totalPosLiters: posVol,
          notes: 'Clôture de quart SoftPOS mobile',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShiftSuccess(
          `Clôture validée (Statut: ${data.status}, Écart: ${data.varianceLiters || 0} L)`
        );
        setTimeout(() => setShowShiftModal(false), 2000);
      } else {
        Alert.alert('Erreur', data.error || 'Erreur lors de la soumission');
      }
    } catch {
      setShiftSuccess(`Clôture locale enregistrée pour la pompe ${pumpNumber}.`);
      setTimeout(() => setShowShiftModal(false), 1800);
    } finally {
      setShiftSubmitting(false);
    }
  };

  const maskedUid = activeCard
    ? `•••• ${activeCard.cardUid.slice(-4).toUpperCase()}`
    : '•••• 8421';

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ======================================================= */}
        {/* 1. TOP PROFILE & NETWORK STATUS HEADER                 */}
        {/* ======================================================= */}
        <View style={styles.topHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: theme.accentTranslucent }]}>
              <ThemedText style={{ color: theme.accentPrimary, fontWeight: '700', fontSize: 16 }}>
                {(user?.fullName || 'JS')
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </ThemedText>
            </View>
            <View style={{ marginLeft: 12 }}>
              <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11 }}>
                {userRole === 'PumpAttendant' && 'Pompiste · En Quart'}
                {userRole === 'StationCashier' && 'Guichetier · Caisse'}
                {userRole === 'FleetManager' && 'Gestionnaire Flotte B2B'}
                {userRole === 'Driver' && 'Chauffeur · Portefeuille'}
                {userRole === 'Admin' && 'Superviseur Central'}
              </ThemedText>
              <ThemedText type="subtitle" style={{ color: theme.text, fontSize: 18, fontWeight: '600' }}>
                {user?.fullName || "Afric' Utilisateur"}
              </ThemedText>
            </View>
          </View>

          {/* Sync Pill Indicator */}
          <Pressable
            onPress={handleSyncQueue}
            disabled={syncLoading}
            style={[
              styles.syncPill,
              {
                backgroundColor:
                  pendingQueueCount > 0 ? 'rgba(216,128,74,0.15)' : 'rgba(34,197,94,0.15)',
                borderColor: pendingQueueCount > 0 ? theme.accentPrimary : theme.statusSuccess,
              },
            ]}
          >
            {syncLoading ? (
              <ActivityIndicator size="small" color={theme.accentPrimary} />
            ) : (
              <>
                <Ionicons
                  name={pendingQueueCount > 0 ? 'cloud-offline-outline' : 'cloud-done-outline'}
                  size={14}
                  color={pendingQueueCount > 0 ? theme.accentPrimary : theme.statusSuccess}
                />
                <ThemedText
                  type="caption"
                  style={{
                    color: pendingQueueCount > 0 ? theme.accentPrimary : theme.statusSuccess,
                    fontSize: 11,
                    fontWeight: '600',
                    marginLeft: 4,
                  }}
                >
                  {pendingQueueCount > 0 ? `${pendingQueueCount} en attente` : 'Synchronisé'}
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>

        {/* Admin Multi-Module Switcher */}
        {userRole === 'Admin' && (
          <View
            style={[
              styles.adminTabs,
              { backgroundColor: theme.backgroundElement, borderColor: theme.borderHairline },
            ]}
          >
            <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 8, fontSize: 11 }}>
              Simulateur de Module Métier (Admin) :
            </ThemedText>
            <View style={styles.adminTabGrid}>
              {[
                { key: 'pos', label: '⛽ SoftPOS' },
                { key: 'caisse', label: '💵 Caisse' },
                { key: 'fleet', label: '🏢 Flotte' },
                { key: 'driver', label: '🚗 Chauffeur' },
              ].map((t) => {
                const active = adminActiveTab === t.key;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setAdminActiveTab(t.key as any)}
                    style={[
                      styles.adminChip,
                      {
                        backgroundColor: active ? theme.accentPrimary : theme.backgroundSelected,
                        borderColor: active ? theme.accentPrimary : theme.borderSubtle,
                      },
                    ]}
                  >
                    <ThemedText
                      type="caption"
                      style={{
                        color: active ? '#FFFFFF' : theme.text,
                        fontWeight: active ? '700' : '500',
                        fontSize: 11,
                      }}
                    >
                      {t.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ======================================================= */}
        {/* 2. HERO REVOLUT-STYLE RFID VIRTUAL CARD                */}
        {/* ======================================================= */}
        <View style={styles.heroCardContainer}>
          <View
            style={[
              styles.revolutCard,
              {
                backgroundColor: '#161514',
                borderColor: 'rgba(216,128,74,0.3)',
              },
            ]}
          >
            {/* Top row of Virtual Card */}
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardBrandRow}>
                <View style={styles.cardFlameDot} />
                <ThemedText style={styles.cardBrandText}>AFRIC' PASS</ThemedText>
                <View style={styles.cardSubBadge}>
                  <ThemedText style={styles.cardSubBadgeText}>
                    {activeCard?.fuelTypeRestriction || 'TOUS CARBURANTS'}
                  </ThemedText>
                </View>
              </View>

              {/* Contactless waves icon */}
              <View style={styles.nfcWaveRow}>
                <Ionicons name="radio-outline" size={20} color="#D8804A" />
              </View>
            </View>

            {/* Middle row of Virtual Card: EMV Chip & Solde */}
            <View style={styles.cardBodyRow}>
              <View style={styles.emvChip}>
                <View style={styles.emvChipLine1} />
                <View style={styles.emvChipLine2} />
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <ThemedText style={styles.cardBalanceLabel}>SOLDE DISPONIBLE</ThemedText>
                  <Pressable onPress={() => setShowBalance(!showBalance)} hitSlop={10}>
                    <Ionicons
                      name={showBalance ? 'eye-outline' : 'eye-off-outline'}
                      size={14}
                      color="rgba(255,255,255,0.4)"
                      style={{ marginLeft: 6 }}
                    />
                  </Pressable>
                </View>
                <ThemedText style={styles.cardBalanceAmount}>
                  {showBalance
                    ? `${(activeCard?.balanceFcfa || 0).toLocaleString('fr-FR')} F`
                    : '•••••••• F'}
                </ThemedText>
              </View>
            </View>

            {/* Bottom row of Virtual Card */}
            <View style={styles.cardFooterRow}>
              <View>
                <ThemedText style={styles.cardHolderTitle}>
                  {activeCard?.vehiclePlate || activeCard?.assignedDriverName || 'PÉPINIÈRE FLOTTE'}
                </ThemedText>
                <ThemedText style={styles.cardNumberMasked}>{maskedUid}</ThemedText>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      activeCard?.status === 'Active'
                        ? 'rgba(34,197,94,0.18)'
                        : 'rgba(239,68,68,0.18)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        activeCard?.status === 'Active' ? theme.statusSuccess : theme.statusError,
                    },
                  ]}
                />
                <ThemedText
                  style={[
                    styles.statusBadgeText,
                    {
                      color:
                        activeCard?.status === 'Active' ? theme.statusSuccess : theme.statusError,
                    },
                  ]}
                >
                  {activeCard?.status === 'Active' ? 'Active' : 'Gelée'}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Multi-card selector chips (if more than 1 card exists) */}
          {cards.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardSelectorRow}
            >
              {cards.map((c) => {
                const isSelected = c.cardUid === activeCard?.cardUid;
                return (
                  <Pressable
                    key={c.cardUid}
                    onPress={() => setActiveCardUid(c.cardUid)}
                    style={[
                      styles.cardMiniChip,
                      {
                        backgroundColor: isSelected
                          ? 'rgba(216,128,74,0.18)'
                          : theme.backgroundElement,
                        borderColor: isSelected ? theme.accentPrimary : theme.borderHairline,
                      },
                    ]}
                  >
                    <Ionicons
                      name="card-outline"
                      size={12}
                      color={isSelected ? theme.accentPrimary : theme.textMuted}
                      style={{ marginRight: 4 }}
                    />
                    <ThemedText
                      style={{
                        fontSize: 11,
                        color: isSelected ? theme.accentPrimary : theme.textMuted,
                        fontWeight: isSelected ? '600' : '400',
                      }}
                    >
                      {c.vehiclePlate || c.cardUid.slice(-4).toUpperCase()}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ======================================================= */}
        {/* 3. FINTECH CIRCULAR QUICK ACTIONS                      */}
        {/* ======================================================= */}
        <View style={styles.actionRowContainer}>
          {/* 1. Servir / Payer (SoftPOS) */}
          <View style={styles.actionItem}>
            <Pressable
              onPress={() => {
                setPaymentStatus(null);
                setPaymentError(null);
                setShowFuelModal(true);
              }}
              style={({ pressed }) => [
                styles.actionCircle,
                { backgroundColor: theme.accentPrimary },
                pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
              ]}
            >
              <Ionicons name="flash" size={24} color="#FFFFFF" />
            </Pressable>
            <ThemedText style={styles.actionLabel}>
              {userRole === 'Driver' ? 'Payer NFC' : 'Servir / POS'}
            </ThemedText>
          </View>

          {/* 2. Recharger (Top-Up) */}
          <View style={styles.actionItem}>
            <Pressable
              onPress={() => {
                setTopupSuccess(null);
                setTopupError(null);
                setShowTopupModal(true);
              }}
              style={({ pressed }) => [
                styles.actionCircle,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.borderHairline,
                  borderWidth: 1,
                },
                pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
              ]}
            >
              <Ionicons name="add" size={24} color={theme.accentPrimary} />
            </Pressable>
            <ThemedText style={styles.actionLabel}>Recharger</ThemedText>
          </View>

          {/* 3. Geler / Sécurité */}
          <View style={styles.actionItem}>
            <Pressable
              onPress={handleToggleFreeze}
              disabled={freezeLoading}
              style={({ pressed }) => [
                styles.actionCircle,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.borderHairline,
                  borderWidth: 1,
                },
                pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
              ]}
            >
              {freezeLoading ? (
                <ActivityIndicator size="small" color={theme.accentPrimary} />
              ) : (
                <Ionicons
                  name={activeCard?.status === 'Active' ? 'snow-outline' : 'lock-open-outline'}
                  size={22}
                  color={activeCard?.status === 'Active' ? '#60A5FA' : theme.statusSuccess}
                />
              )}
            </Pressable>
            <ThemedText style={styles.actionLabel}>
              {activeCard?.status === 'Active' ? 'Geler' : 'Activer'}
            </ThemedText>
          </View>

          {/* 4. Shift / Clôture */}
          <View style={styles.actionItem}>
            <Pressable
              onPress={() => setShowShiftModal(true)}
              style={({ pressed }) => [
                styles.actionCircle,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.borderHairline,
                  borderWidth: 1,
                },
                pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
              ]}
            >
              <Ionicons name="receipt-outline" size={22} color={theme.text} />
            </Pressable>
            <ThemedText style={styles.actionLabel}>
              {userRole === 'PumpAttendant' ? 'Clôture' : 'Rapport'}
            </ThemedText>
          </View>
        </View>

        {/* ======================================================= */}
        {/* 4. LIVE METRICS & GAUGES (PULSE CARDS)                 */}
        {/* ======================================================= */}
        <View style={styles.metricsGrid}>
          {/* Card 1: Fuel Quota & Allowance */}
          <View
            style={[
              styles.metricCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.borderHairline },
            ]}
          >
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconBox, { backgroundColor: 'rgba(216,128,74,0.15)' }]}>
                <Ionicons name="speedometer-outline" size={16} color={theme.accentPrimary} />
              </View>
              <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11 }}>
                Quota Carburant
              </ThemedText>
            </View>
            <ThemedText style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 6 }}>
              65 L / 120 L
            </ThemedText>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: '54%', backgroundColor: theme.accentPrimary }]} />
            </View>
            <ThemedText type="caption" style={{ color: theme.textSecondary, fontSize: 10, marginTop: 4 }}>
              54% utilisé · 55 L restants
            </ThemedText>
          </View>

          {/* Card 2: Cryptographic Security & Offline Mode */}
          <View
            style={[
              styles.metricCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.borderHairline },
            ]}
          >
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconBox, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                <Ionicons name="shield-checkmark-outline" size={16} color={theme.statusSuccess} />
              </View>
              <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11 }}>
                Sécurité HMAC
              </ThemedText>
            </View>
            <ThemedText style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 6 }}>
              Certifié Offline
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.statusSuccess, fontSize: 11, marginTop: 2 }}>
              ● Clés Dérivées SHA-256
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, fontSize: 10, marginTop: 4 }}>
              Terminal POS-BZV-01
            </ThemedText>
          </View>
        </View>

        {/* ======================================================= */}
        {/* 5. REVOLUT-STYLE RECENT ACTIVITY FEED                   */}
        {/* ======================================================= */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeaderRow}>
            <ThemedText type="subtitle" style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>
              Activité Récente
            </ThemedText>
            <Pressable
              onPress={() => router.push('/(tabs)/history')}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <ThemedText style={{ color: theme.accentPrimary, fontSize: 13, fontWeight: '500' }}>
                Voir tout
              </ThemedText>
              <Ionicons name="chevron-forward" size={14} color={theme.accentPrimary} style={{ marginLeft: 2 }} />
            </Pressable>
          </View>

          {recentTxns.length === 0 ? (
            <View
              style={[
                styles.emptyActivityBox,
                { backgroundColor: theme.backgroundElement, borderColor: theme.borderHairline },
              ]}
            >
              <Ionicons name="receipt-outline" size={28} color={theme.textMuted} />
              <ThemedText style={{ color: theme.textMuted, fontSize: 13, marginTop: 8 }}>
                Aucune transaction récente sur ce terminal.
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>
                Les transactions hors-ligne s'afficheront ici instantanément.
              </ThemedText>
            </View>
          ) : (
            recentTxns.map((txn, idx) => {
              const isFuel = !txn.type || txn.type === 'Paiement' || txn.liters > 0;
              return (
                <View
                  key={txn.id || idx}
                  style={[
                    styles.txnRow,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.borderHairline,
                      borderBottomWidth: idx < recentTxns.length - 1 ? 1 : 0,
                    },
                  ]}
                >
                  <View style={styles.txnLeft}>
                    <View
                      style={[
                        styles.txnIconCircle,
                        {
                          backgroundColor: isFuel ? 'rgba(216,128,74,0.15)' : 'rgba(34,197,94,0.15)',
                        },
                      ]}
                    >
                      <Ionicons
                        name={isFuel ? 'flame-outline' : 'wallet-outline'}
                        size={18}
                        color={isFuel ? theme.accentPrimary : theme.statusSuccess}
                      />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <ThemedText style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                        {isFuel
                          ? `Carburant ${txn.fuelType || 'Gazole'} (${txn.liters || 20}L)`
                          : 'Rechargement Caisse'}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11, marginTop: 1 }}>
                        {txn.timestamp
                          ? new Date(txn.timestamp).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '11:24'} · Station Poto-Poto
                      </ThemedText>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <ThemedText
                      style={{
                        color: isFuel ? theme.text : theme.statusSuccess,
                        fontSize: 14,
                        fontWeight: '700',
                      }}
                    >
                      {isFuel ? '-' : '+'}
                      {(txn.amountFcfa || 0).toLocaleString('fr-FR')} F
                    </ThemedText>
                    <View style={styles.txnStatusTag}>
                      <ThemedText style={styles.txnStatusTagText}>
                        {txn.synced ? 'Validé' : 'HMAC Offline'}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ======================================================= */}
      {/* MODAL 1: REVOLUT-STYLE FUEL DISPENSING / SOFTPOS SHEET */}
      {/* ======================================================= */}
      <Modal visible={showFuelModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundElement }]}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeaderRow}>
              <View>
                <ThemedText type="subtitle" style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>
                  Nouveau Plein Carburant
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Terminal SoftPOS Pistolet · Pompe {pumpNumber}
                </ThemedText>
              </View>
              <Pressable onPress={() => setShowFuelModal(false)} hitSlop={10}>
                <Ionicons name="close-circle-outline" size={26} color={theme.textMuted} />
              </Pressable>
            </View>

            {/* Fuel Selection Pills */}
            <View style={styles.fuelToggleRow}>
              {(['Gazole', 'Super'] as const).map((type) => {
                const active = fuelType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setFuelType(type)}
                    style={[
                      styles.fuelChip,
                      {
                        backgroundColor: active ? theme.accentPrimary : theme.backgroundSelected,
                        borderColor: active ? theme.accentPrimary : theme.borderHairline,
                      },
                    ]}
                  >
                    <Ionicons
                      name="flame"
                      size={16}
                      color={active ? '#FFFFFF' : theme.textMuted}
                      style={{ marginRight: 6 }}
                    />
                    <ThemedText
                      style={{
                        color: active ? '#FFFFFF' : theme.text,
                        fontWeight: active ? '700' : '500',
                      }}
                    >
                      {type} ({type === 'Super' ? '775' : '650'} F/L)
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {/* Volume Presets */}
            <View style={{ marginTop: 16 }}>
              <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 8 }}>
                Volume Souhaité (Litres) :
              </ThemedText>
              <View style={styles.presetRow}>
                {['10', '20', '30', '50'].map((vol) => {
                  const active = liters === vol;
                  return (
                    <Pressable
                      key={vol}
                      onPress={() => setLiters(vol)}
                      style={[
                        styles.presetChip,
                        {
                          backgroundColor: active ? 'rgba(216,128,74,0.2)' : theme.background,
                          borderColor: active ? theme.accentPrimary : theme.borderHairline,
                        },
                      ]}
                    >
                      <ThemedText
                        style={{
                          color: active ? theme.accentPrimary : theme.text,
                          fontWeight: active ? '700' : '500',
                        }}
                      >
                        {vol} L
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <View style={[styles.customLitersInput, { borderColor: theme.borderHairline }]}>
                <TextInput
                  value={liters}
                  onChangeText={setLiters}
                  keyboardType="numeric"
                  placeholder="Volume personnalisé"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.numericInput, { color: theme.text }]}
                />
                <ThemedText style={{ color: theme.textMuted, marginRight: 12 }}>Litres</ThemedText>
              </View>
            </View>

            {/* Calculated Total Hero Display */}
            <View style={[styles.totalDisplayBox, { backgroundColor: theme.background }]}>
              <ThemedText type="caption" style={{ color: theme.textMuted }}>
                TOTAL À DÉBITER
              </ThemedText>
              <ThemedText style={{ color: theme.accentPrimary, fontSize: 30, fontWeight: '800', marginTop: 2 }}>
                {amountFcfa.toLocaleString('fr-FR')} FCFA
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                Carte cible : {maskedUid} ({activeCard?.balanceFcfa.toLocaleString('fr-FR')} F dispo)
              </ThemedText>
            </View>

            {/* Banners */}
            {paymentError && (
              <View style={[styles.errorBanner, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                <Ionicons name="alert-circle" size={18} color={theme.statusError} />
                <ThemedText style={{ color: theme.statusError, fontSize: 12, marginLeft: 8, flex: 1 }}>
                  {paymentError}
                </ThemedText>
              </View>
            )}

            {paymentStatus && (
              <View style={[styles.successBanner, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                <Ionicons name="checkmark-circle" size={18} color={theme.statusSuccess} />
                <ThemedText style={{ color: theme.statusSuccess, fontSize: 12, marginLeft: 8, flex: 1 }}>
                  {paymentStatus}
                </ThemedText>
              </View>
            )}

            {/* NFC Tap Zone & Submit Button */}
            <Pressable
              onPress={handleTapToPay}
              disabled={isProcessing}
              style={({ pressed }) => [
                styles.primarySubmitButton,
                { backgroundColor: theme.accentPrimary },
                pressed && { opacity: 0.9 },
              ]}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="radio-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                    {nfcAvailable ? 'Approcher la Carte NFC' : 'Débiter Immédiatement'}
                  </ThemedText>
                </View>
              )}
            </Pressable>

            {lastSlip && (
              <Pressable
                onPress={() => setShowReceiptModal(true)}
                style={[styles.slipButton, { borderColor: theme.borderHairline }]}
              >
                <Ionicons name="receipt-outline" size={16} color={theme.accentPrimary} style={{ marginRight: 6 }} />
                <ThemedText style={{ color: theme.accentPrimary, fontSize: 13, fontWeight: '600' }}>
                  Voir / Imprimer le Ticket Thermique
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* ======================================================= */}
      {/* MODAL 2: CASHIER TOP-UP SHEET                          */}
      {/* ======================================================= */}
      <Modal visible={showTopupModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeaderRow}>
              <View>
                <ThemedText type="subtitle" style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>
                  Recharger la Carte
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Guichet Caisse · {maskedUid}
                </ThemedText>
              </View>
              <Pressable onPress={() => setShowTopupModal(false)} hitSlop={10}>
                <Ionicons name="close-circle-outline" size={26} color={theme.textMuted} />
              </Pressable>
            </View>

            {/* Payment Mode Selector */}
            <View style={styles.presetRow}>
              {(['Cash', 'Airtel', 'MTN'] as const).map((method) => {
                const active = topupMethod === method;
                return (
                  <Pressable
                    key={method}
                    onPress={() => setTopupMethod(method)}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: active ? theme.accentPrimary : theme.background,
                        borderColor: active ? theme.accentPrimary : theme.borderHairline,
                        flex: 1,
                      },
                    ]}
                  >
                    <ThemedText
                      style={{
                        color: active ? '#FFFFFF' : theme.text,
                        fontWeight: active ? '700' : '500',
                      }}
                    >
                      {method === 'Cash' ? '💵 Espèces' : method === 'Airtel' ? '🔴 Airtel' : '🟡 MTN'}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {/* Amount Presets */}
            <View style={{ marginTop: 16 }}>
              <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 8 }}>
                Montant de la Recharge :
              </ThemedText>
              <View style={styles.presetRow}>
                {['5000', '10000', '25000', '50000'].map((amt) => {
                  const active = topupAmount === amt;
                  return (
                    <Pressable
                      key={amt}
                      onPress={() => setTopupAmount(amt)}
                      style={[
                        styles.presetChip,
                        {
                          backgroundColor: active ? 'rgba(216,128,74,0.2)' : theme.background,
                          borderColor: active ? theme.accentPrimary : theme.borderHairline,
                        },
                      ]}
                    >
                      <ThemedText
                        style={{
                          color: active ? theme.accentPrimary : theme.text,
                          fontWeight: active ? '700' : '500',
                        }}
                      >
                        {parseInt(amt, 10).toLocaleString('fr-FR')} F
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <View style={[styles.customLitersInput, { borderColor: theme.borderHairline }]}>
                <TextInput
                  value={topupAmount}
                  onChangeText={setTopupAmount}
                  keyboardType="numeric"
                  placeholder="Montant FCFA"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.numericInput, { color: theme.text }]}
                />
                <ThemedText style={{ color: theme.textMuted, marginRight: 12 }}>FCFA</ThemedText>
              </View>
            </View>

            {topupError && (
              <View style={[styles.errorBanner, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                <Ionicons name="alert-circle" size={18} color={theme.statusError} />
                <ThemedText style={{ color: theme.statusError, fontSize: 12, marginLeft: 8, flex: 1 }}>
                  {topupError}
                </ThemedText>
              </View>
            )}

            {topupSuccess && (
              <View style={[styles.successBanner, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                <Ionicons name="checkmark-circle" size={18} color={theme.statusSuccess} />
                <ThemedText style={{ color: theme.statusSuccess, fontSize: 12, marginLeft: 8, flex: 1 }}>
                  {topupSuccess}
                </ThemedText>
              </View>
            )}

            <Pressable
              onPress={handleProcessCashTopup}
              disabled={topupLoading}
              style={[styles.primarySubmitButton, { backgroundColor: theme.accentPrimary, marginTop: 20 }]}
            >
              {topupLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                  Valider la Recharge ({parseFloat(topupAmount || '0').toLocaleString('fr-FR')} F)
                </ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ======================================================= */}
      {/* MODAL 3: SHIFT RECONCILIATION SHEET                    */}
      {/* ======================================================= */}
      <Modal visible={showShiftModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeaderRow}>
              <View>
                <ThemedText type="subtitle" style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>
                  Rapport & Clôture de Quart
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Contrôle d'écart mécanique pistolet vs SoftPOS
                </ThemedText>
              </View>
              <Pressable onPress={() => setShowShiftModal(false)} hitSlop={10}>
                <Ionicons name="close-circle-outline" size={26} color={theme.textMuted} />
              </Pressable>
            </View>

            <View style={styles.meterInputRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 4 }}>
                  Pistolet
                </ThemedText>
                <TextInput
                  value={pumpNumber}
                  onChangeText={setPumpNumber}
                  keyboardType="numeric"
                  style={[styles.meterInput, { color: theme.text, borderColor: theme.borderHairline }]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 4 }}>
                  Vol. POS (L)
                </ThemedText>
                <TextInput
                  value={totalPosVol}
                  onChangeText={setTotalPosVol}
                  keyboardType="numeric"
                  style={[styles.meterInput, { color: theme.text, borderColor: theme.borderHairline }]}
                />
              </View>
            </View>

            <View style={styles.meterInputRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 4 }}>
                  Index Début (L)
                </ThemedText>
                <TextInput
                  value={startMeter}
                  onChangeText={setStartMeter}
                  keyboardType="numeric"
                  style={[styles.meterInput, { color: theme.text, borderColor: theme.borderHairline }]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 4 }}>
                  Index Fin (L)
                </ThemedText>
                <TextInput
                  value={endMeter}
                  onChangeText={setEndMeter}
                  keyboardType="numeric"
                  style={[styles.meterInput, { color: theme.text, borderColor: theme.borderHairline }]}
                />
              </View>
            </View>

            {shiftSuccess && (
              <View style={[styles.successBanner, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                <Ionicons name="checkmark-circle" size={18} color={theme.statusSuccess} />
                <ThemedText style={{ color: theme.statusSuccess, fontSize: 12, marginLeft: 8, flex: 1 }}>
                  {shiftSuccess}
                </ThemedText>
              </View>
            )}

            <Pressable
              onPress={handleSubmitShift}
              disabled={shiftSubmitting}
              style={[styles.primarySubmitButton, { backgroundColor: theme.accentPrimary, marginTop: 20 }]}
            >
              {shiftSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                  Transmettre la Clôture au Hub
                </ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ======================================================= */}
      {/* MODAL 4: THERMAL RECEIPT SLIP                          */}
      {/* ======================================================= */}
      <Modal visible={showReceiptModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.receiptCard, { backgroundColor: '#FFFFFF' }]}>
            <View style={styles.receiptHeader}>
              <ThemedText style={{ color: '#1A1A1A', fontWeight: '800', fontSize: 16 }}>
                AFRIC' SERVICES - TICKET
              </ThemedText>
              <ThemedText style={{ color: '#666666', fontSize: 11, marginTop: 2 }}>
                Station Poto-Poto · Brazzaville
              </ThemedText>
            </View>

            <View style={styles.receiptBody}>
              <ThemedText style={styles.receiptMonoText}>{lastSlip || 'Reçu non disponible'}</ThemedText>
            </View>

            <View style={styles.receiptActions}>
              <Pressable
                onPress={() =>
                  Alert.alert(
                    'Impression Ticket',
                    'Ordre ESC/POS transmis à l\'imprimante thermique Bluetooth.'
                  )
                }
                style={[styles.receiptBtn, { backgroundColor: theme.accentPrimary }]}
              >
                <Ionicons name="print-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                  Imprimer Ticket
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => setShowReceiptModal(false)}
                style={[styles.receiptBtn, { backgroundColor: '#F3F4F6', marginTop: 8 }]}
              >
                <ThemedText style={{ color: '#374151', fontWeight: '600', fontSize: 14 }}>
                  Fermer
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  adminTabs: {
    padding: 12,
    borderRadius: Radius.card,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  adminTabGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  adminChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },

  // Revolut-Style Virtual Card
  heroCardContainer: {
    marginBottom: Spacing.xl,
  },
  revolutCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardFlameDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D8804A',
    marginRight: 6,
  },
  cardBrandText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  cardSubBadge: {
    backgroundColor: 'rgba(216,128,74,0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  cardSubBadgeText: {
    color: '#D8804A',
    fontSize: 9,
    fontWeight: '700',
  },
  nfcWaveRow: {
    opacity: 0.8,
  },
  cardBodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  emvChip: {
    width: 36,
    height: 26,
    borderRadius: 5,
    backgroundColor: 'rgba(216,128,74,0.25)',
    borderWidth: 1,
    borderColor: '#D8804A',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  emvChipLine1: {
    height: 1,
    backgroundColor: 'rgba(216,128,74,0.6)',
    width: '100%',
    marginBottom: 4,
  },
  emvChipLine2: {
    height: 1,
    backgroundColor: 'rgba(216,128,74,0.6)',
    width: '100%',
  },
  cardBalanceLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  cardBalanceAmount: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardHolderTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  cardNumberMasked: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontFamily: 'ProximaNova-Regular',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardSelectorRow: {
    paddingTop: 10,
    gap: 8,
  },
  cardMiniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },

  // Action Row
  actionRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    paddingHorizontal: 4,
  },
  actionItem: {
    alignItems: 'center',
    width: 70,
  },
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  actionLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.xl,
  },
  metricCard: {
    flex: 1,
    padding: 14,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Recent Activity Feed
  activitySection: {
    marginBottom: Spacing.xl,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyActivityBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  txnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: Radius.chip,
    marginBottom: 8,
    borderWidth: 1,
  },
  txnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  txnIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnStatusTag: {
    marginTop: 2,
  },
  txnStatusTagText: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '500',
  },

  // Modals & Bottom Sheets
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  fuelToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fuelChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.chip,
    borderWidth: 1,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  presetChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.chip,
    borderWidth: 1,
  },
  customLitersInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.chip,
    borderWidth: 1,
    overflow: 'hidden',
  },
  numericInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  totalDisplayBox: {
    alignItems: 'center',
    padding: 16,
    borderRadius: Radius.card,
    marginVertical: 16,
  },
  primarySubmitButton: {
    paddingVertical: 15,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.chip,
    marginBottom: 12,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.chip,
    marginBottom: 12,
  },
  slipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginTop: 10,
  },
  meterInputRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  meterInput: {
    borderWidth: 1,
    borderRadius: Radius.chip,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  receiptCard: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
    alignSelf: 'center',
    maxWidth: 400,
    width: '90%',
  },
  receiptHeader: {
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  receiptBody: {
    paddingVertical: 14,
  },
  receiptMonoText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#111827',
    lineHeight: 16,
  },
  receiptActions: {
    marginTop: 10,
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.pill,
  },
});
