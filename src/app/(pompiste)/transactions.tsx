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

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { localDb, OfflineTransaction } from '@/services/local-db';
import { mobileAuth, MobileUserSession } from '@/services/auth';
import { syncOfflineLedger } from '@/services/sync-service';
import { API_BASE_URL } from '@/constants/api';

export default function PompisteTransactionsScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<MobileUserSession | null>(mobileAuth.getUser());
  const [stationName, setStationName] = useState<string>("Afric' Station");
  const [allTxns, setAllTxns] = useState<OfflineTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [periodFilter, setPeriodFilter] = useState<'today' | 'yesterday' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<'all' | 'synced' | 'pending'>('all');

  // Selected Transaction for receipt view
  const [selectedTx, setSelectedTx] = useState<OfflineTransaction | null>(null);

  useEffect(() => {
    const unsub = mobileAuth.subscribe((u) => setUser(u));
    return () => unsub();
  }, []);

  const loadTransactions = useCallback(async () => {
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

      // 2. Fetch local SQLite transactions
      const localTxns = await localDb.getTransactionsByAttendantAndStation(attendantId, stationId);

      // 3. Fetch remote transactions if online
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

      // 4. Merge transactions: local pending takes precedence over remote
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

      setAllTxns(combined);
    } catch (err) {
      console.warn('Error fetching attendant transactions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncOfflineLedger('POS-BZV-01', user?.stationId || undefined);
      if (res.acceptedCount > 0) {
        Alert.alert('Succès', `${res.acceptedCount} transaction(s) synchronisée(s).`);
      } else {
        Alert.alert('Information', 'Toutes les transactions sont déjà à jour.');
      }
      await loadTransactions();
    } catch {
      Alert.alert('Hors-ligne', 'Serveur central injoignable pour le moment.');
    } finally {
      setSyncing(false);
    }
  };

  // Filter transactions
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

  const filteredTxns = allTxns.filter((tx) => {
    const txDate = (tx.timestamp || '').split('T')[0];

    // Period filter
    if (periodFilter === 'today' && txDate !== todayStr) return false;
    if (periodFilter === 'yesterday' && txDate !== yesterdayStr) return false;

    // Status filter
    if (statusFilter === 'synced' && tx.isSynced !== 1) return false;
    if (statusFilter === 'pending' && tx.isSynced === 1) return false;

    return true;
  });

  // Aggregate metrics for filtered view
  const totalFilteredFcfa = filteredTxns.reduce((sum, t) => sum + (t.amountFcfa || 0), 0);
  const totalFilteredLiters = filteredTxns.reduce((sum, t) => sum + (t.liters || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentPrimary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <ThemedText style={[styles.headerCaption, { color: theme.textSecondary }]}>
              Journal de Ventes Forecourt
            </ThemedText>
            <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
              Mes Transactions d'Agence
            </ThemedText>
            <ThemedText style={[styles.headerSub, { color: theme.textMuted }]}>
              Ventes effectuées par vous à {stationName}
            </ThemedText>
          </View>

          <Pressable
            onPress={handleSync}
            disabled={syncing}
            style={[styles.syncBtn, { backgroundColor: theme.accentTranslucent }]}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={theme.accentPrimary} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={16} color={theme.accentPrimary} />
                <ThemedText style={[styles.syncBtnText, { color: theme.accentPrimary }]}>
                  Sync
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>

        {/* ======================================================= */}
        {/* AGGREGATE SUMMARY BANNER                                */}
        {/* ======================================================= */}
        <View style={[styles.summaryCard, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
          <View style={styles.summaryItem}>
            <ThemedText style={[styles.summaryLabel, { color: theme.textMuted }]}>Total Ventes</ThemedText>
            <ThemedText style={[styles.summaryAmount, { color: theme.accentPrimary }]}>
              {totalFilteredFcfa.toLocaleString('fr-FR')} FCFA
            </ThemedText>
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: dark ? '#262422' : '#EFECE7' }]} />

          <View style={styles.summaryItem}>
            <ThemedText style={[styles.summaryLabel, { color: theme.textMuted }]}>Volume Total</ThemedText>
            <ThemedText style={[styles.summarySubVal, { color: theme.text }]}>
              {totalFilteredLiters.toFixed(1)} L
            </ThemedText>
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: dark ? '#262422' : '#EFECE7' }]} />

          <View style={styles.summaryItem}>
            <ThemedText style={[styles.summaryLabel, { color: theme.textMuted }]}>Opérations</ThemedText>
            <ThemedText style={[styles.summarySubVal, { color: theme.text }]}>
              {filteredTxns.length}
            </ThemedText>
          </View>
        </View>

        {/* ======================================================= */}
        {/* FILTER CHIPS (PERIOD & SYNC STATUS)                     */}
        {/* ======================================================= */}
        <View style={styles.filtersGroup}>
          <View style={styles.chipsRow}>
            <Pressable
              onPress={() => setPeriodFilter('today')}
              style={[
                styles.chip,
                {
                  backgroundColor: periodFilter === 'today' ? theme.accentPrimary : dark ? '#1C1A18' : '#F0EBE4',
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.chipText,
                  { color: periodFilter === 'today' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                Aujourd'hui
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setPeriodFilter('yesterday')}
              style={[
                styles.chip,
                {
                  backgroundColor: periodFilter === 'yesterday' ? theme.accentPrimary : dark ? '#1C1A18' : '#F0EBE4',
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.chipText,
                  { color: periodFilter === 'yesterday' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                Hier
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setPeriodFilter('all')}
              style={[
                styles.chip,
                {
                  backgroundColor: periodFilter === 'all' ? theme.accentPrimary : dark ? '#1C1A18' : '#F0EBE4',
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.chipText,
                  { color: periodFilter === 'all' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                Toutes
              </ThemedText>
            </Pressable>
          </View>

          {/* Sync status filter */}
          <View style={[styles.chipsRow, { marginTop: 6 }]}>
            <Pressable
              onPress={() => setStatusFilter('all')}
              style={[
                styles.subChip,
                {
                  backgroundColor: statusFilter === 'all' ? theme.accentTranslucent : 'transparent',
                  borderColor: statusFilter === 'all' ? theme.accentPrimary : 'transparent',
                },
              ]}
            >
              <ThemedText style={[styles.subChipText, { color: theme.text }]}>Tous statuts</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setStatusFilter('pending')}
              style={[
                styles.subChip,
                {
                  backgroundColor: statusFilter === 'pending' ? theme.accentTranslucent : 'transparent',
                  borderColor: statusFilter === 'pending' ? theme.accentPrimary : 'transparent',
                },
              ]}
            >
              <ThemedText style={[styles.subChipText, { color: theme.text }]}>Hors-ligne</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setStatusFilter('synced')}
              style={[
                styles.subChip,
                {
                  backgroundColor: statusFilter === 'synced' ? theme.accentTranslucent : 'transparent',
                  borderColor: statusFilter === 'synced' ? theme.accentPrimary : 'transparent',
                },
              ]}
            >
              <ThemedText style={[styles.subChipText, { color: theme.text }]}>Synchronisés</ThemedText>
            </Pressable>
          </View>
        </View>

        {/* ======================================================= */}
        {/* TRANSACTIONS LIST                                       */}
        {/* ======================================================= */}
        {loading ? (
          <ActivityIndicator size="small" color={theme.accentPrimary} style={{ marginVertical: 30 }} />
        ) : filteredTxns.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
            <Ionicons name="receipt-outline" size={40} color={theme.textMuted} />
            <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
              Aucune vente trouvée pour ces critères de filtre.
            </ThemedText>
          </View>
        ) : (
          filteredTxns.map((tx) => {
            const date = new Date(tx.timestamp);
            const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
            const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

            return (
              <Pressable
                key={tx.id}
                style={({ pressed }) => [
                  styles.txCard,
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
                    size={22}
                    color={theme.accentPrimary}
                  />
                </View>

                <View style={styles.txMain}>
                  <View style={styles.txRowTop}>
                    <ThemedText style={[styles.txTitle, { color: theme.text }]}>
                      Plein {tx.fuelType} · {tx.liters.toFixed(1)} L
                    </ThemedText>
                    <ThemedText style={[styles.txAmount, { color: theme.text }]}>
                      {tx.amountFcfa.toLocaleString('fr-FR')} FCFA
                    </ThemedText>
                  </View>

                  <View style={styles.txRowBottom}>
                    <ThemedText style={[styles.txMeta, { color: theme.textMuted }]}>
                      Puce •••• {tx.cardUid ? tx.cardUid.slice(-4) : 'NFC'} · {dateStr} {timeStr}
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
                        {tx.isSynced === 1 ? 'Synchronisé' : 'En attente'}
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
                Reçu Numérique SoftPOS
              </ThemedText>
              <Pressable onPress={() => setSelectedTx(null)}>
                <Ionicons name="close-circle" size={26} color={theme.textMuted} />
              </Pressable>
            </View>

            {selectedTx && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={[styles.receiptPaper, { backgroundColor: dark ? '#0F0E0D' : '#F9F7F5' }]}>
                  <ThemedText style={[styles.receiptCenterHeader, { color: theme.text }]}>
                    AFRIC' STATIONS CONGO
                  </ThemedText>
                  <ThemedText style={[styles.receiptCenterSub, { color: theme.textMuted }]}>
                    Station Poto-Poto · Avenue de la Paix
                  </ThemedText>
                  <ThemedText style={[styles.receiptDivider, { color: theme.textMuted }]}>
                    ----------------------------------------
                  </ThemedText>

                  <View style={styles.receiptLine}>
                    <ThemedText style={[styles.receiptKey, { color: theme.textMuted }]}>Numéro Ticket :</ThemedText>
                    <ThemedText style={[styles.receiptVal, { color: theme.text }]}>{selectedTx.id}</ThemedText>
                  </View>
                  <View style={styles.receiptLine}>
                    <ThemedText style={[styles.receiptKey, { color: theme.textMuted }]}>Date & Heure :</ThemedText>
                    <ThemedText style={[styles.receiptVal, { color: theme.text }]}>
                      {new Date(selectedTx.timestamp).toLocaleString('fr-FR')}
                    </ThemedText>
                  </View>
                  <View style={styles.receiptLine}>
                    <ThemedText style={[styles.receiptKey, { color: theme.textMuted }]}>Pompiste :</ThemedText>
                    <ThemedText style={[styles.receiptVal, { color: theme.text }]}>
                      {user?.fullName || 'Jean-Paul Samba'}
                    </ThemedText>
                  </View>
                  <View style={styles.receiptLine}>
                    <ThemedText style={[styles.receiptKey, { color: theme.textMuted }]}>Carte NFC :</ThemedText>
                    <ThemedText style={[styles.receiptVal, { color: theme.text }]}>{selectedTx.cardUid}</ThemedText>
                  </View>
                  <View style={styles.receiptLine}>
                    <ThemedText style={[styles.receiptKey, { color: theme.textMuted }]}>Produit :</ThemedText>
                    <ThemedText style={[styles.receiptVal, { color: theme.text, fontWeight: '700' }]}>
                      {selectedTx.fuelType}
                    </ThemedText>
                  </View>
                  <View style={styles.receiptLine}>
                    <ThemedText style={[styles.receiptKey, { color: theme.textMuted }]}>Volume Délivré :</ThemedText>
                    <ThemedText style={[styles.receiptVal, { color: theme.text, fontWeight: '700' }]}>
                      {selectedTx.liters.toFixed(2)} L
                    </ThemedText>
                  </View>

                  <ThemedText style={[styles.receiptDivider, { color: theme.textMuted }]}>
                    ----------------------------------------
                  </ThemedText>

                  <View style={styles.receiptLine}>
                    <ThemedText style={[styles.receiptKey, { color: theme.text, fontWeight: '800' }]}>
                      MONTANT DÉBITÉ :
                    </ThemedText>
                    <ThemedText style={[styles.receiptVal, { color: theme.accentPrimary, fontSize: 16, fontWeight: '800' }]}>
                      {selectedTx.amountFcfa.toLocaleString('fr-FR')} FCFA
                    </ThemedText>
                  </View>

                  <ThemedText style={[styles.receiptDivider, { color: theme.textMuted }]}>
                    ----------------------------------------
                  </ThemedText>

                  <ThemedText style={[styles.receiptSig, { color: theme.textMuted }]}>
                    SIGNATURE CRYPTO : {selectedTx.signature ? selectedTx.signature.slice(0, 24) : 'SIGN-OFFLINE'}...
                  </ThemedText>
                  <ThemedText style={[styles.receiptStat, { color: selectedTx.isSynced === 1 ? theme.statusSuccess : theme.statusWarning }]}>
                    {selectedTx.isSynced === 1 ? '✓ Transaction synchronisée avec le serveur' : '⏳ Transaction enregistrée localement'}
                  </ThemedText>
                </View>

                <Pressable
                  style={[styles.closeBtn, { backgroundColor: theme.accentPrimary }]}
                  onPress={() => setSelectedTx(null)}
                >
                  <ThemedText style={styles.closeBtnText}>Fermer</ThemedText>
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
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 12,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  syncBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 30,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  summarySubVal: {
    fontSize: 15,
    fontWeight: '700',
  },
  filtersGroup: {
    marginBottom: Spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  subChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  subChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.md,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.card,
    marginBottom: Spacing.sm,
  },
  txIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  txMain: {
    flex: 1,
  },
  txRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  txRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txMeta: {
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
    backgroundColor: 'rgba(0,0,0,0.8)',
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
  receiptPaper: {
    padding: Spacing.md,
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: '#444444',
    marginBottom: Spacing.md,
  },
  receiptCenterHeader: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
  },
  receiptCenterSub: {
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
  receiptSig: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  receiptStat: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  closeBtn: {
    paddingVertical: 14,
    borderRadius: Radius.chip,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
