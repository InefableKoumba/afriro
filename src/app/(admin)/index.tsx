import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { mobileAuth, MobileUserSession } from '@/services/auth';
import { API_BASE_URL, API_ENDPOINTS } from '@/constants/api';

interface NetworkMetrics {
  totalRevenueFcfa: number;
  totalLiters: number;
  stationsCount: number;
  cardsCount: number;
  activeCardsCount: number;
  usersCount: number;
  pendingVariancesCount: number;
}

export default function AdminDashboardScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [user, setUser] = useState<MobileUserSession | null>(mobileAuth.getUser());
  const [metrics, setMetrics] = useState<NetworkMetrics>({
    totalRevenueFcfa: 0,
    totalLiters: 0,
    stationsCount: 0,
    cardsCount: 0,
    activeCardsCount: 0,
    usersCount: 0,
    pendingVariancesCount: 0,
  });
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const unsub = mobileAuth.subscribe((u) => setUser(u));
    return () => unsub();
  }, []);

  const loadNetworkData = useCallback(async () => {
    try {
      const [txRes, stationsRes, cardsRes, usersRes, reconRes] = await Promise.all([
        fetch(API_ENDPOINTS.TRANSACTIONS).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(API_ENDPOINTS.STATIONS).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(API_ENDPOINTS.CARDS).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(API_ENDPOINTS.USERS).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(API_ENDPOINTS.RECONCILIATION).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);

      const txns = Array.isArray(txRes) ? txRes : [];
      const stations = Array.isArray(stationsRes) ? stationsRes : [];
      const cards = Array.isArray(cardsRes) ? cardsRes : [];
      const users = Array.isArray(usersRes) ? usersRes : [];
      const reconciliations = Array.isArray(reconRes) ? reconRes : [];

      let totalRevenue = 0;
      let totalLiters = 0;
      for (const t of txns) {
        totalRevenue += Number(t.amountFcfa) || 0;
        totalLiters += Number(t.liters) || 0;
      }

      const activeCards = cards.filter((c: any) => c.status === 'Active').length;
      const variances = reconciliations.filter((r: any) => r.status === 'DiscrepancyFlagged').length;

      setMetrics({
        totalRevenueFcfa: totalRevenue,
        totalLiters: Math.round(totalLiters * 100) / 100,
        stationsCount: stations.length,
        cardsCount: cards.length,
        activeCardsCount: activeCards,
        usersCount: users.length,
        pendingVariancesCount: variances,
      });

      setRecentTxns(txns.slice(0, 6));
    } catch (err) {
      console.warn('Error loading admin dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNetworkData();
  }, [loadNetworkData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNetworkData();
  };

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
          <View style={styles.headerTextGroup}>
            <View style={styles.badgeRow}>
              <View style={[styles.liveDot, { backgroundColor: theme.statusSuccess }]} />
              <ThemedText style={[styles.headerCaption, { color: theme.accentPrimary }]}>
                ADMINISTRATION CENTRALE RÉSEAU
              </ThemedText>
            </View>
            <ThemedText style={[styles.operatorName, { color: theme.text }]}>
              {user?.fullName || "Direction Générale Afric'"}
            </ThemedText>
            <ThemedText style={[styles.agencyText, { color: theme.textSecondary }]}>
              Plateforme Closed-Loop · Congo-Brazzaville
            </ThemedText>
          </View>

          <Pressable
            onPress={() => router.push('/(admin)/profile')}
            style={[styles.profileBtn, { backgroundColor: theme.accentTranslucent }]}
          >
            <Ionicons name="shield-checkmark" size={20} color={theme.accentPrimary} />
          </Pressable>
        </View>

        {/* Shift Discrepancy Alert Banner */}
        {metrics.pendingVariancesCount > 0 && (
          <Pressable
            onPress={() => router.push('/(admin)/stations')}
            style={[styles.alertCard, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
          >
            <Ionicons name="alert-circle" size={24} color={theme.statusError} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <ThemedText style={[styles.alertTitle, { color: theme.statusError }]}>
                {metrics.pendingVariancesCount} Clôture(s) en Écart Détectée(s)
              </ThemedText>
              <ThemedText style={[styles.alertSub, { color: theme.textSecondary }]}>
                Écart mécanique pompe vs SoftPOS supérieur au seuil de 5 L.
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.statusError} />
          </Pressable>
        )}

        {/* HERO NETWORK METRICS CARD */}
        <View style={[styles.heroCard, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTag}>
              <Ionicons name="trending-up" size={14} color={theme.accentPrimary} />
              <ThemedText style={[styles.heroTagText, { color: theme.textSecondary }]}>
                Volume d'Affaires Réseau
              </ThemedText>
            </View>
            <ThemedText style={[styles.heroDateText, { color: theme.textMuted }]}>
              En Temps Réel
            </ThemedText>
          </View>

          <View style={styles.revenueRow}>
            <ThemedText style={[styles.revenueAmount, { color: theme.text }]}>
              {metrics.totalRevenueFcfa.toLocaleString('fr-FR')}
            </ThemedText>
            <ThemedText style={[styles.revenueCurrency, { color: theme.accentPrimary }]}>
              FCFA
            </ThemedText>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <Ionicons name="water-outline" size={16} color={theme.accentPrimary} />
              <ThemedText style={[styles.heroStatValue, { color: theme.text }]}>
                {metrics.totalLiters.toLocaleString('fr-FR')} L
              </ThemedText>
              <ThemedText style={[styles.heroStatLabel, { color: theme.textMuted }]}>
                Carburant Servi
              </ThemedText>
            </View>

            <View style={styles.heroStatDivider} />

            <View style={styles.heroStatItem}>
              <Ionicons name="card-outline" size={16} color={theme.statusSuccess} />
              <ThemedText style={[styles.heroStatValue, { color: theme.text }]}>
                {metrics.activeCardsCount} / {metrics.cardsCount}
              </ThemedText>
              <ThemedText style={[styles.heroStatLabel, { color: theme.textMuted }]}>
                Cartes Actives
              </ThemedText>
            </View>

            <View style={styles.heroStatDivider} />

            <View style={styles.heroStatItem}>
              <Ionicons name="business-outline" size={16} color={theme.accentPrimary} />
              <ThemedText style={[styles.heroStatValue, { color: theme.text }]}>
                {metrics.stationsCount}
              </ThemedText>
              <ThemedText style={[styles.heroStatLabel, { color: theme.textMuted }]}>
                Stations
              </ThemedText>
            </View>
          </View>
        </View>

        {/* QUICK NAVIGATION SHORTCUTS */}
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          Gestion du Réseau
        </ThemedText>

        <View style={styles.shortcutsGrid}>
          <Pressable
            onPress={() => router.push('/(admin)/stations')}
            style={[styles.shortcutCard, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}
          >
            <View style={[styles.shortcutIconWrap, { backgroundColor: 'rgba(192, 106, 50, 0.12)' }]}>
              <Ionicons name="business" size={22} color={theme.accentPrimary} />
            </View>
            <ThemedText style={[styles.shortcutTitle, { color: theme.text }]}>
              Stations & POS
            </ThemedText>
            <ThemedText style={[styles.shortcutSub, { color: theme.textMuted }]}>
              {metrics.stationsCount} stations · Terminaux
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(admin)/cards')}
            style={[styles.shortcutCard, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}
          >
            <View style={[styles.shortcutIconWrap, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
              <Ionicons name="card" size={22} color={theme.statusSuccess} />
            </View>
            <ThemedText style={[styles.shortcutTitle, { color: theme.text }]}>
              Cartes NFC
            </ThemedText>
            <ThemedText style={[styles.shortcutSub, { color: theme.textMuted }]}>
              {metrics.cardsCount} cartes · Approvisionner
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(admin)/users')}
            style={[styles.shortcutCard, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}
          >
            <View style={[styles.shortcutIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
              <Ionicons name="people" size={22} color="#3B82F6" />
            </View>
            <ThemedText style={[styles.shortcutTitle, { color: theme.text }]}>
              Opérateurs
            </ThemedText>
            <ThemedText style={[styles.shortcutSub, { color: theme.textMuted }]}>
              {metrics.usersCount} utilisateurs · Rôles
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(admin)/clients')}
            style={[styles.shortcutCard, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}
          >
            <View style={[styles.shortcutIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
              <Ionicons name="briefcase" size={22} color="#3B82F6" />
            </View>
            <ThemedText style={[styles.shortcutTitle, { color: theme.text }]}>
              Clients & Flottes
            </ThemedText>
            <ThemedText style={[styles.shortcutSub, { color: theme.textMuted }]}>
              Comptes · Flottes B2B
            </ThemedText>
          </Pressable>
        </View>

        {/* RECENT NETWORK TRANSACTIONS */}
        <View style={styles.sectionHeaderRow}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            Flux Récent des Transactions
          </ThemedText>
          <Pressable onPress={() => router.push('/(admin)/cards')}>
            <ThemedText style={[styles.seeAllText, { color: theme.accentPrimary }]}>
              Voir les cartes
            </ThemedText>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={theme.accentPrimary} style={{ marginVertical: 20 }} />
        ) : recentTxns.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
            <Ionicons name="receipt-outline" size={32} color={theme.textMuted} />
            <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
              Aucune transaction enregistrée sur le réseau.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.txnList}>
            {recentTxns.map((tx) => (
              <View
                key={tx.id}
                style={[
                  styles.txnCard,
                  { backgroundColor: dark ? '#161514' : theme.backgroundElement },
                ]}
              >
                <View style={[styles.txnIconWrap, { backgroundColor: theme.accentTranslucent }]}>
                  <Ionicons name="water" size={18} color={theme.accentPrimary} />
                </View>

                <View style={styles.txnMeta}>
                  <ThemedText style={[styles.txnTitle, { color: theme.text }]}>
                    {tx.fuelType || 'Carburant'} · {Number(tx.liters || 0).toFixed(1)} L
                  </ThemedText>
                  <ThemedText style={[styles.txnSub, { color: theme.textMuted }]}>
                    Carte: •••• {(tx.cardUid || '').slice(-4)} · {tx.deviceId || 'POS'}
                  </ThemedText>
                </View>

                <View style={styles.txnAmountWrap}>
                  <ThemedText style={[styles.txnAmount, { color: theme.text }]}>
                    {Number(tx.amountFcfa || 0).toLocaleString('fr-FR')}
                  </ThemedText>
                  <ThemedText style={[styles.txnCurrency, { color: theme.accentPrimary }]}>
                    FCFA
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerCaption: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  operatorName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  agencyText: {
    fontSize: 12,
    marginTop: 2,
  },
  profileBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.chip,
    marginBottom: Spacing.md,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  alertSub: {
    fontSize: 11,
    marginTop: 2,
  },
  heroCard: {
    borderRadius: Radius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroDateText: {
    fontSize: 11,
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginVertical: Spacing.xs,
  },
  revenueAmount: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  revenueCurrency: {
    fontSize: 18,
    fontWeight: '700',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  heroStatLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: Spacing.lg,
  },
  shortcutCard: {
    width: '48%',
    borderRadius: Radius.chip,
    padding: Spacing.md,
  },
  shortcutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  shortcutSub: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  txnList: {
    gap: 8,
  },
  txnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.chip,
  },
  txnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txnMeta: {
    flex: 1,
  },
  txnTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  txnSub: {
    fontSize: 11,
    marginTop: 2,
  },
  txnAmountWrap: {
    alignItems: 'flex-end',
  },
  txnAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txnCurrency: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: Radius.chip,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    marginTop: 8,
  },
});
