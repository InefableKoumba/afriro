import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
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
import { AttendantSalesMetrics, localDb, OfflineTransaction } from '@/services/local-db';
import { mobileAuth, MobileUserSession } from '@/services/auth';
import { syncOfflineLedger } from '@/services/sync-service';
import { API_BASE_URL } from '@/constants/api';

export default function PompisteDashboardScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [user, setUser] = useState<MobileUserSession | null>(mobileAuth.getUser());
  const [stationName, setStationName] = useState<string>("Afric' Station");
  const [metrics, setMetrics] = useState<AttendantSalesMetrics>({
    todayTotalFcfa: 0,
    todayLiters: 0,
    todayTxCount: 0,
    yesterdayTotalFcfa: 0,
    yesterdayLiters: 0,
    yesterdayTxCount: 0,
    deltaFcfa: 0,
    deltaPercentage: 0,
  });
  const [recentTxns, setRecentTxns] = useState<OfflineTransaction[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Receipt details modal
  const [selectedTx, setSelectedTx] = useState<OfflineTransaction | null>(null);

  useEffect(() => {
    const unsub = mobileAuth.subscribe((u) => setUser(u));
    return () => unsub();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const attendantId = user?.userId;
      const stationId = user?.stationId;

      // 1. Fetch station details if assigned
      if (stationId) {
        try {
          const sRes = await fetch(`${API_BASE_URL}/api/stations/${stationId}`);
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData.stationName) {
              setStationName(sData.stationName);
            }
          }
        } catch {}
      }

      // 2. Fetch local SQLite transactions & pending count
      const [localTxns, pending] = await Promise.all([
        localDb.getTransactionsByAttendantAndStation(attendantId, stationId),
        localDb.getPendingCount(),
      ]);
      setPendingCount(pending);

      // 3. Fetch remote transactions for this attendant & station if online
      let remoteTxns: OfflineTransaction[] = [];
      try {
        const queryParams = new URLSearchParams();
        if (attendantId) queryParams.append('attendantId', attendantId);
        if (stationId) queryParams.append('stationId', stationId);

        const rRes = await fetch(`${API_BASE_URL}/api/transactions?${queryParams.toString()}`);
        if (rRes.ok) {
          const rData = await rRes.json();
          if (Array.isArray(rData)) {
            remoteTxns = rData.map((t: any) => ({
              id: t.id,
              cardUid: t.cardUid,
              deviceId: t.deviceId,
              stationId: t.stationId,
              attendantId: t.attendantId,
              amountFcfa: Number(t.amountFcfa) || 0,
              liters: Number(t.liters) || 0,
              fuelType: t.fuelType,
              offlineCounter: Number(t.offlineCounter) || 0,
              signature: t.transactionSignature || '',
              timestamp: t.timestamp,
              isSynced: 1,
            }));
          }
        }
      } catch {}

      // 4. Merge transactions: local pending take precedence over synced
      const txnMap = new Map<string, OfflineTransaction>();
      for (const t of remoteTxns) {
        txnMap.set(t.id, t);
      }
      for (const t of localTxns) {
        txnMap.set(t.id, t);
      }

      const combined = Array.from(txnMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setRecentTxns(combined.slice(0, 5));

      // 5. Compute sales metrics (today vs yesterday)
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const yesterday = new Date(now.getTime() - 86400000);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let todayTotalFcfa = 0;
      let todayLiters = 0;
      let todayTxCount = 0;

      let yesterdayTotalFcfa = 0;
      let yesterdayLiters = 0;
      let yesterdayTxCount = 0;

      for (const t of combined) {
        const tDate = (t.timestamp || '').split('T')[0];
        if (tDate === todayStr) {
          todayTotalFcfa += t.amountFcfa || 0;
          todayLiters += t.liters || 0;
          todayTxCount += 1;
        } else if (tDate === yesterdayStr) {
          yesterdayTotalFcfa += t.amountFcfa || 0;
          yesterdayLiters += t.liters || 0;
          yesterdayTxCount += 1;
        }
      }

      const deltaFcfa = todayTotalFcfa - yesterdayTotalFcfa;
      const deltaPercentage =
        yesterdayTotalFcfa > 0
          ? Math.round(((todayTotalFcfa - yesterdayTotalFcfa) / yesterdayTotalFcfa) * 1000) / 10
          : 0;

      setMetrics({
        todayTotalFcfa,
        todayLiters: Math.round(todayLiters * 100) / 100,
        todayTxCount,
        yesterdayTotalFcfa,
        yesterdayLiters: Math.round(yesterdayLiters * 100) / 100,
        yesterdayTxCount,
        deltaFcfa,
        deltaPercentage,
      });
    } catch (err) {
      console.warn('Error loading pompiste dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncOfflineLedger('POS-BZV-01', user?.stationId || undefined);
      if (res.acceptedCount > 0) {
        Alert.alert('Synchronisation Réussie', `${res.acceptedCount} transaction(s) téléversée(s) au serveur central.`);
      } else {
        Alert.alert('À jour', 'Toutes les transactions sont déjà synchronisées.');
      }
      await loadData();
    } catch {
      Alert.alert('Hors-ligne', 'Impossible de joindre le serveur central. Les transactions restent en sécurité locale.');
    } finally {
      setSyncing(false);
    }
  };

  const isPositiveDelta = metrics.deltaFcfa >= 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentPrimary} />
        }
      >
        {/* ======================================================= */}
        {/* HEADER: OPERATOR & STATION STATUS                       */}
        {/* ======================================================= */}
        <View style={styles.header}>
          <View style={styles.headerTextGroup}>
            <ThemedText style={[styles.greeting, { color: theme.textSecondary }]}>
              Poste Pompiste · Terminal SoftPOS
            </ThemedText>
            <ThemedText style={[styles.operatorName, { color: theme.text }]}>
              {user?.fullName || 'Opérateur Pompiste'}
            </ThemedText>
            <View style={styles.agencyRow}>
              <Ionicons name="location-outline" size={14} color={theme.accentPrimary} />
              <ThemedText style={[styles.agencyText, { color: theme.textSecondary }]}>
                {stationName} · Pompe Active
              </ThemedText>
            </View>
          </View>

          {/* Sync status chip */}
          <Pressable
            onPress={handleSync}
            disabled={syncing}
            style={[
              styles.syncChip,
              {
                backgroundColor: pendingCount > 0 ? theme.accentTranslucent : 'rgba(34, 197, 94, 0.12)',
              },
            ]}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={theme.accentPrimary} />
            ) : (
              <>
                <Ionicons
                  name={pendingCount > 0 ? 'cloud-upload-outline' : 'cloud-done-outline'}
                  size={14}
                  color={pendingCount > 0 ? theme.accentPrimary : theme.statusSuccess}
                />
                <ThemedText
                  style={[
                    styles.syncText,
                    { color: pendingCount > 0 ? theme.accentPrimary : theme.statusSuccess },
                  ]}
                >
                  {pendingCount > 0 ? `${pendingCount} en attente` : 'En ligne'}
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>

        {/* ======================================================= */}
        {/* HERO SALES COMPARISON CARD (TODAY VS YESTERDAY)         */}
        {/* ======================================================= */}
        <View style={[styles.heroCard, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroBadge}>
              <View style={[styles.pulseDot, { backgroundColor: theme.statusSuccess }]} />
              <ThemedText style={[styles.heroBadgeText, { color: theme.textSecondary }]}>
                Chiffre d'Affaires du Jour
              </ThemedText>
            </View>
            <ThemedText style={[styles.todayDate, { color: theme.textMuted }]}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </ThemedText>
          </View>

          {/* Main Today Amount */}
          <View style={styles.mainAmountRow}>
            <ThemedText style={[styles.mainAmount, { color: theme.text }]}>
              {metrics.todayTotalFcfa.toLocaleString('fr-FR')}
            </ThemedText>
            <ThemedText style={[styles.mainCurrency, { color: theme.accentPrimary }]}>
              FCFA
            </ThemedText>
          </View>

          {/* Today Liters & Tx count */}
          <View style={styles.todayStatsRow}>
            <View style={styles.statPill}>
              <Ionicons name="water-outline" size={14} color={theme.accentPrimary} />
              <ThemedText style={[styles.statPillText, { color: theme.textSecondary }]}>
                {metrics.todayLiters.toFixed(1)} Litres servis
              </ThemedText>
            </View>
            <View style={styles.statPill}>
              <Ionicons name="receipt-outline" size={14} color={theme.accentPrimary} />
              <ThemedText style={[styles.statPillText, { color: theme.textSecondary }]}>
                {metrics.todayTxCount} ticket{metrics.todayTxCount > 1 ? 's' : ''}
              </ThemedText>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.cardDivider, { backgroundColor: dark ? '#262422' : '#F0EAE3' }]} />

          {/* Yesterday Comparison Section */}
          <View style={styles.comparisonRow}>
            <View style={styles.yesterdayInfo}>
              <ThemedText style={[styles.comparisonLabel, { color: theme.textMuted }]}>
                Ventes d'Hier
              </ThemedText>
              <ThemedText style={[styles.yesterdayAmount, { color: theme.textSecondary }]}>
                {metrics.yesterdayTotalFcfa.toLocaleString('fr-FR')} FCFA
                <ThemedText style={{ color: theme.textMuted, fontSize: 11 }}>
                  {' '}({metrics.yesterdayLiters.toFixed(0)} L)
                </ThemedText>
              </ThemedText>
            </View>

            {/* Trend Badge */}
            <View
              style={[
                styles.trendBadge,
                {
                  backgroundColor: isPositiveDelta
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                },
              ]}
            >
              <Ionicons
                name={isPositiveDelta ? 'arrow-up' : 'arrow-down'}
                size={14}
                color={isPositiveDelta ? theme.statusSuccess : theme.statusError}
              />
              <ThemedText
                style={[
                  styles.trendBadgeText,
                  { color: isPositiveDelta ? theme.statusSuccess : theme.statusError },
                ]}
              >
                {isPositiveDelta ? '+' : ''}
                {metrics.deltaPercentage}%
                {' vs hier'}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* ======================================================= */}
        {/* CORE POMPISTE ACTIONS                                   */}
        {/* ======================================================= */}
        <View style={styles.sectionHeader}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            Opérations Pompiste
          </ThemedText>
        </View>

        {/* Primary Action 1: Accept Payment */}
        <Pressable
          style={({ pressed }) => [
            styles.actionCardPrimary,
            { backgroundColor: theme.accentPrimary, opacity: pressed ? 0.92 : 1 },
          ]}
          onPress={() => router.push('/(pompiste)/payment')}
        >
          <View style={styles.actionIconPrimaryWrap}>
            <Ionicons name="card" size={26} color="#FFFFFF" />
          </View>
          <View style={styles.actionTextPrimaryGroup}>
            <ThemedText style={styles.actionTitlePrimary}>
              Accepter un Paiement
            </ThemedText>
            <ThemedText style={styles.actionSubPrimary}>
              Encaisser un client par carte NFC (Super ou Gazole)
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
        </Pressable>

        {/* Grid for Action 2 & Action 3 */}
        <View style={styles.actionsGrid}>
          {/* Action 2: Verify Card Validity */}
          <Pressable
            style={({ pressed }) => [
              styles.actionGridCard,
              {
                backgroundColor: dark ? '#161514' : theme.backgroundElement,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => router.push('/(pompiste)/scan')}
          >
            <View style={[styles.actionGridIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
              <Ionicons name="scan" size={22} color="#3B82F6" />
            </View>
            <ThemedText style={[styles.actionGridTitle, { color: theme.text }]}>
              Vérifier Validité
            </ThemedText>
            <ThemedText style={[styles.actionGridSub, { color: theme.textMuted }]}>
              Scanner la puce NFC du client
            </ThemedText>
          </Pressable>

          {/* Action 3: My Agency Transactions */}
          <Pressable
            style={({ pressed }) => [
              styles.actionGridCard,
              {
                backgroundColor: dark ? '#161514' : theme.backgroundElement,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => router.push('/(pompiste)/transactions')}
          >
            <View style={[styles.actionGridIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="receipt" size={22} color="#10B981" />
            </View>
            <ThemedText style={[styles.actionGridTitle, { color: theme.text }]}>
              Mes Ventes
            </ThemedText>
            <ThemedText style={[styles.actionGridSub, { color: theme.textMuted }]}>
              Historique des tickets de quart
            </ThemedText>
          </Pressable>
        </View>

        {/* ======================================================= */}
        {/* RECENT SALES AT THIS PUMP                               */}
        {/* ======================================================= */}
        <View style={styles.sectionHeaderRow}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            Dernières Ventes à la Station
          </ThemedText>
          <Pressable onPress={() => router.push('/(pompiste)/transactions')}>
            <ThemedText style={[styles.seeAllText, { color: theme.accentPrimary }]}>
              Tout voir
            </ThemedText>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={theme.accentPrimary} style={{ marginVertical: 20 }} />
        ) : recentTxns.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
            <Ionicons name="receipt-outline" size={36} color={theme.textMuted} />
            <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
              Aucune vente enregistrée pour ce quart.
            </ThemedText>
          </View>
        ) : (
          recentTxns.map((tx) => {
            const date = new Date(tx.timestamp);
            const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            return (
              <Pressable
                key={tx.id}
                style={({ pressed }) => [
                  styles.txItem,
                  {
                    backgroundColor: dark ? '#161514' : theme.backgroundElement,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => setSelectedTx(tx)}
              >
                <View style={[styles.txIconWrap, { backgroundColor: theme.accentTranslucent }]}>
                  <Ionicons
                    name={tx.fuelType === 'Super' ? 'flame-outline' : 'speedometer-outline'}
                    size={20}
                    color={theme.accentPrimary}
                  />
                </View>

                <View style={styles.txMainInfo}>
                  <View style={styles.txTopRow}>
                    <ThemedText style={[styles.txTitle, { color: theme.text }]}>
                      Plein {tx.fuelType} · {tx.liters.toFixed(1)} L
                    </ThemedText>
                    <ThemedText style={[styles.txAmount, { color: theme.text }]}>
                      {tx.amountFcfa.toLocaleString('fr-FR')} FCFA
                    </ThemedText>
                  </View>

                  <View style={styles.txBottomRow}>
                    <ThemedText style={[styles.txSub, { color: theme.textMuted }]}>
                      Carte •••• {tx.cardUid ? tx.cardUid.slice(-4) : 'NFC'} · {timeStr}
                    </ThemedText>

                    <View
                      style={[
                        styles.syncBadge,
                        {
                          backgroundColor:
                            tx.isSynced === 1 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.syncBadgeText,
                          { color: tx.isSynced === 1 ? theme.statusSuccess : theme.statusWarning },
                        ]}
                      >
                        {tx.isSynced === 1 ? 'Synchronisé' : 'Hors-ligne'}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* ======================================================= */}
      {/* TICKET DETAILS MODAL                                    */}
      {/* ======================================================= */}
      <Modal visible={!!selectedTx} transparent animationType="slide">
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

            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                Détail du Ticket Pompe
              </ThemedText>
              <Pressable onPress={() => setSelectedTx(null)}>
                <Ionicons name="close-circle" size={26} color={theme.textMuted} />
              </Pressable>
            </View>

            {selectedTx && (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                <View style={[styles.receiptPaper, { backgroundColor: dark ? '#0F0E0D' : '#F9F7F5' }]}>
                  <ThemedText style={[styles.receiptHeaderTitle, { color: theme.text }]}>
                    AFRIC' STATIONS CONGO
                  </ThemedText>
                  <ThemedText style={[styles.receiptSubTitle, { color: theme.textMuted }]}>
                    Station Poto-Poto · Brazzaville
                  </ThemedText>
                  <ThemedText style={[styles.receiptDivider, { color: theme.textMuted }]}>
                    ----------------------------------------
                  </ThemedText>

                  <View style={styles.receiptLine}>
                    <ThemedText style={[styles.receiptKey, { color: theme.textMuted }]}>ID Ticket:</ThemedText>
                    <ThemedText style={[styles.receiptVal, { color: theme.text }]}>{selectedTx.id}</ThemedText>
                  </View>
                  <View style={styles.receiptLine}>
                    <ThemedText style={[styles.receiptKey, { color: theme.textMuted }]}>Date & Heure:</ThemedText>
                    <ThemedText style={[styles.receiptVal, { color: theme.text }]}>
                      {new Date(selectedTx.timestamp).toLocaleString('fr-FR')}
                    </ThemedText>
                  </View>
                  <View style={styles.receiptLine}>
                    <ThemedText style={[styles.receiptKey, { color: theme.textMuted }]}>Pompiste:</ThemedText>
                    <ThemedText style={[styles.receiptVal, { color: theme.text }]}>
                      {user?.fullName || 'Jean-Paul Samba'}
                    </ThemedText>
                  </View>
                  <View style={styles.receiptLine}>
                    <ThemedText style={[styles.receiptKey, { color: theme.textMuted }]}>Carte NFC:</ThemedText>
                    <ThemedText style={[styles.receiptVal, { color: theme.text }]}>{selectedTx.cardUid}</ThemedText>
                  </View>
                  <View style={styles.receiptLine}>
                    <ThemedText style={[styles.receiptKey, { color: theme.textMuted }]}>Carburant:</ThemedText>
                    <ThemedText style={[styles.receiptVal, { color: theme.text, fontWeight: '700' }]}>
                      {selectedTx.fuelType}
                    </ThemedText>
                  </View>
                  <View style={styles.receiptLine}>
                    <ThemedText style={[styles.receiptKey, { color: theme.textMuted }]}>Volume Servi:</ThemedText>
                    <ThemedText style={[styles.receiptVal, { color: theme.text, fontWeight: '700' }]}>
                      {selectedTx.liters.toFixed(2)} Litres
                    </ThemedText>
                  </View>

                  <ThemedText style={[styles.receiptDivider, { color: theme.textMuted }]}>
                    ----------------------------------------
                  </ThemedText>

                  <View style={styles.receiptLineTotal}>
                    <ThemedText style={[styles.receiptTotalLabel, { color: theme.text }]}>TOTAL DÉBITÉ:</ThemedText>
                    <ThemedText style={[styles.receiptTotalAmount, { color: theme.accentPrimary }]}>
                      {selectedTx.amountFcfa.toLocaleString('fr-FR')} FCFA
                    </ThemedText>
                  </View>

                  <ThemedText style={[styles.receiptDivider, { color: theme.textMuted }]}>
                    ----------------------------------------
                  </ThemedText>

                  <ThemedText style={[styles.receiptSignature, { color: theme.textMuted }]}>
                    MAC SEC: {selectedTx.signature ? selectedTx.signature.slice(0, 24) : 'SIGN-OFFLINE'}...
                  </ThemedText>
                  <ThemedText style={[styles.receiptStatus, { color: selectedTx.isSynced === 1 ? theme.statusSuccess : theme.statusWarning }]}>
                    Statut: {selectedTx.isSynced === 1 ? 'Téléversé au serveur central' : 'Enregistré localement (Hors-ligne)'}
                  </ThemedText>
                </View>

                <Pressable
                  style={[styles.closeModalBtn, { backgroundColor: theme.accentPrimary }]}
                  onPress={() => setSelectedTx(null)}
                >
                  <ThemedText style={styles.closeModalBtnText}>Fermer</ThemedText>
                </Pressable>
              </ScrollView>
            )}
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
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  headerTextGroup: {
    flex: 1,
  },
  greeting: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  operatorName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  agencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  agencyText: {
    fontSize: 12,
    fontWeight: '500',
  },
  syncChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  syncText: {
    fontSize: 11,
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: Radius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  todayDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  mainAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  mainAmount: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  mainCurrency: {
    fontSize: 16,
    fontWeight: '700',
  },
  todayStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(192, 106, 50, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.chip,
  },
  statPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  yesterdayInfo: {
    flex: 1,
  },
  comparisonLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  yesterdayAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  trendBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    marginBottom: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionCardPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.card,
    marginBottom: Spacing.md,
    elevation: 3,
    shadowColor: '#C06A32',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  actionIconPrimaryWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  actionTextPrimaryGroup: {
    flex: 1,
  },
  actionTitlePrimary: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionSubPrimary: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actionGridCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.card,
    alignItems: 'flex-start',
  },
  actionGridIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  actionGridTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionGridSub: {
    fontSize: 11,
    lineHeight: 14,
  },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.card,
    marginBottom: Spacing.sm,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  txMainInfo: {
    flex: 1,
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txSub: {
    fontSize: 11,
  },
  syncBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  syncBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: Radius.modal,
    borderTopRightRadius: Radius.modal,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#888888',
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalScroll: {
    marginBottom: Spacing.md,
  },
  receiptPaper: {
    padding: Spacing.md,
    borderRadius: Radius.chip,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#444444',
    marginBottom: Spacing.md,
  },
  receiptHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
  },
  receiptSubTitle: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  receiptDivider: {
    fontSize: 10,
    textAlign: 'center',
    marginVertical: 4,
  },
  receiptLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  receiptKey: {
    fontSize: 12,
  },
  receiptVal: {
    fontSize: 12,
  },
  receiptLineTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  receiptTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  receiptTotalAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  receiptSignature: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  receiptStatus: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  closeModalBtn: {
    paddingVertical: 14,
    borderRadius: Radius.chip,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  closeModalBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
