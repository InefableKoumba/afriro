import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
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
import { API_BASE_URL, API_ENDPOINTS } from '@/constants/api';

interface CardDetail {
  cardUid: string;
  status: string;
  balanceFcfa: number;
  offlineCounter: number;
  assignedDriverName?: string;
  vehiclePlate?: string;
  fuelTypeRestriction?: string;
  dailySpendLimitFcfa?: number;
  weeklySpendLimitFcfa?: number;
  userId?: string;
  companyId?: string;
  issuedAt?: string;
}

interface TransactionItem {
  id: string;
  cardUid: string;
  amountFcfa: number;
  liters: number;
  fuelType: string;
  stationId?: string;
  deviceId?: string;
  isOfflineFlag: boolean;
  timestamp: string;
}

export default function CardDetailScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cardUid } = useLocalSearchParams<{ cardUid: string }>();

  const [card, setCard] = useState<CardDetail | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  // Edit Restrictions Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPlate, setEditPlate] = useState('');
  const [editDriver, setEditDriver] = useState('');
  const [editDailyLimit, setEditDailyLimit] = useState('');
  const [editFuel, setEditFuel] = useState('Tous');

  const loadCardData = useCallback(async () => {
    if (!cardUid) return;
    try {
      const clean = cardUid.trim().toUpperCase();
      const [cardRes, txnRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/cards/${clean}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${API_BASE_URL}/api/transactions?cardUid=${clean}`).then((r) => (r.ok ? r.json() : [])),
      ]);

      if (cardRes) {
        setCard(cardRes);
        setEditPlate(cardRes.vehiclePlate || '');
        setEditDriver(cardRes.assignedDriverName || '');
        setEditDailyLimit(cardRes.dailySpendLimitFcfa ? cardRes.dailySpendLimitFcfa.toString() : '');
        setEditFuel(cardRes.fuelTypeRestriction || 'Tous');
      }

      if (Array.isArray(txnRes)) {
        setTransactions(txnRes);
      }
    } catch (err) {
      console.warn('Error loading card details:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cardUid]);

  useEffect(() => {
    loadCardData();
  }, [loadCardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCardData();
  };

  const handleToggleStatus = async () => {
    if (!card) return;
    const nextStatus = card.status === 'Active' ? 'Suspended' : 'Active';
    setActionLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.CARD_STATUS(card.cardUid), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        Alert.alert('Statut Modifié', `La carte ${card.cardUid} est maintenant ${nextStatus}.`);
        setCard({ ...card, status: nextStatus });
      } else {
        Alert.alert('Erreur', 'Impossible de modifier le statut de la carte.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de contacter le serveur.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveRestrictions = async () => {
    if (!card) return;
    setActionLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.CARD_ASSIGN(card.cardUid), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: card.userId || null,
          companyId: card.companyId || null,
          dailySpendLimitFcfa: editDailyLimit ? parseFloat(editDailyLimit) : null,
          weeklySpendLimitFcfa: null,
          fuelTypeRestriction: editFuel === 'Tous' ? null : editFuel,
          vehiclePlate: editPlate.trim() || null,
          assignedDriverName: editDriver.trim() || null,
        }),
      });

      if (res.ok) {
        Alert.alert('Succès', 'Plafonds et restrictions mis à jour.');
        setShowEditModal(false);
        await loadCardData();
      } else {
        Alert.alert('Erreur', 'Échec de la mise à jour des restrictions.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de contacter le serveur.');
    } finally {
      setActionLoading(false);
    }
  };

  // Aggregated Stats
  const totalSpentFcfa = transactions.reduce((sum, t) => sum + (Number(t.amountFcfa) || 0), 0);
  const totalLitersDispensed = transactions.reduce((sum, t) => sum + (Number(t.liters) || 0), 0);
  const totalTransactionsCount = transactions.length;

  const displayedTransactions = showAllTransactions
    ? transactions
    : transactions.slice(0, 5);

  const isActive = card?.status === 'Active';
  const isInStock = card?.status === 'InStock';

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.headerNav, { borderBottomColor: dark ? '#24211E' : '#EAE4DE' }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: dark ? '#201D1B' : '#EFEAE5' }]}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Pressable>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <ThemedText style={[styles.navTitle, { color: theme.text }]}>
            Fiche Détaillée Carte
          </ThemedText>
          <ThemedText style={[styles.navSubtitle, { color: theme.textSecondary }]}>
            {cardUid || 'Chargement...'}
          </ThemedText>
        </View>

        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: isActive
                ? 'rgba(34, 197, 94, 0.15)'
                : isInStock
                ? theme.accentTranslucent
                : 'rgba(239, 68, 68, 0.15)',
            },
          ]}
        >
          <Ionicons
            name={isActive ? 'checkmark-circle' : isInStock ? 'pause-circle' : 'alert-circle'}
            size={13}
            color={isActive ? theme.statusSuccess : isInStock ? theme.accentPrimary : theme.statusError}
          />
          <ThemedText
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: isActive ? theme.statusSuccess : isInStock ? theme.accentPrimary : theme.statusError,
              marginLeft: 4,
            }}
          >
            {card?.status || 'Inconnu'}
          </ThemedText>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.accentPrimary} />
          <ThemedText style={{ color: theme.textMuted, marginTop: 12 }}>
            Chargement des détails et transactions...
          </ThemedText>
        </View>
      ) : !card ? (
        <View style={styles.centerLoading}>
          <Ionicons name="card-outline" size={48} color={theme.textMuted} />
          <ThemedText style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 12 }}>
            Carte introuvable
          </ThemedText>
          <Pressable
            onPress={() => router.back()}
            style={[styles.actionBtn, { backgroundColor: theme.accentPrimary, marginTop: 16 }]}
          >
            <ThemedText style={{ color: '#FFFFFF', fontWeight: '700' }}>Retour aux Cartes</ThemedText>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentPrimary} />}
        >
          {/* Card Graphic */}
          <View style={[styles.cardHero, { backgroundColor: dark ? '#1C1917' : '#2D2824' }]}>
            <View style={styles.cardHeroTop}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="wifi" size={20} color={theme.accentPrimary} style={{ transform: [{ rotate: '90deg' }] }} />
                <ThemedText style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 }}>
                  AFRIRO FLEET
                </ThemedText>
              </View>
              <View
                style={[
                  styles.cardTechBadge,
                  { backgroundColor: 'rgba(255,255,255,0.12)' },
                ]}
              >
                <ThemedText style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                  {card.fuelTypeRestriction || 'Tous Carburants'}
                </ThemedText>
              </View>
            </View>

            <View style={{ marginVertical: 18 }}>
              <ThemedText style={styles.cardHeroUid}>{card.cardUid}</ThemedText>
              <ThemedText style={styles.cardHeroDriver}>
                {card.assignedDriverName || 'Titulaire non assigné'}
                {card.vehiclePlate ? ` · ${card.vehiclePlate}` : ''}
              </ThemedText>
            </View>

            <View style={styles.cardHeroBottom}>
              <View>
                <ThemedText style={styles.cardHeroBalanceLabel}>SOLDE DISPONIBLE</ThemedText>
                <ThemedText style={styles.cardHeroBalance}>
                  {Number(card.balanceFcfa || 0).toLocaleString('fr-FR')} FCFA
                </ThemedText>
              </View>
              {card.dailySpendLimitFcfa && (
                <View style={{ alignItems: 'flex-end' }}>
                  <ThemedText style={styles.cardHeroBalanceLabel}>PLAFOND / JOUR</ThemedText>
                  <ThemedText style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                    {Number(card.dailySpendLimitFcfa).toLocaleString('fr-FR')} F
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => setShowEditModal(true)}
              style={[styles.primaryActionBtn, { backgroundColor: theme.backgroundElement }]}
            >
              <Ionicons name="options-outline" size={18} color={theme.accentPrimary} />
              <ThemedText style={[styles.actionBtnText, { color: theme.text }]}>
                Plafonds & Véhicule
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handleToggleStatus}
              disabled={actionLoading}
              style={[
                styles.primaryActionBtn,
                { backgroundColor: isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)' },
              ]}
            >
              <Ionicons
                name={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                size={18}
                color={isActive ? theme.statusError : theme.statusSuccess}
              />
              <ThemedText
                style={[
                  styles.actionBtnText,
                  { color: isActive ? theme.statusError : theme.statusSuccess },
                ]}
              >
                {isActive ? 'Suspendre' : 'Activer'}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(admin)/write-card')}
              style={[styles.primaryActionBtn, { backgroundColor: theme.backgroundElement }]}
            >
              <Ionicons name="hardware-chip-outline" size={18} color={theme.accentPrimary} />
              <ThemedText style={[styles.actionBtnText, { color: theme.text }]}>
                Écrire NFC
              </ThemedText>
            </Pressable>
          </View>

          {/* Stats Section */}
          <ThemedText style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>
            Statistiques Consommation
          </ThemedText>
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}>
              <ThemedText style={[styles.statLabel, { color: theme.textMuted }]}>
                Total Dépensé
              </ThemedText>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {totalSpentFcfa.toLocaleString('fr-FR')} F
              </ThemedText>
              <ThemedText style={[styles.statSub, { color: theme.textSecondary }]}>
                Cumul carburant
              </ThemedText>
            </View>

            <View style={[styles.statBox, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}>
              <ThemedText style={[styles.statLabel, { color: theme.textMuted }]}>
                Volume Délivré
              </ThemedText>
              <ThemedText style={[styles.statValue, { color: theme.accentPrimary }]}>
                {totalLitersDispensed.toFixed(1)} L
              </ThemedText>
              <ThemedText style={[styles.statSub, { color: theme.textSecondary }]}>
                À la pompe
              </ThemedText>
            </View>

            <View style={[styles.statBox, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}>
              <ThemedText style={[styles.statLabel, { color: theme.textMuted }]}>
                Transactions
              </ThemedText>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                {totalTransactionsCount}
              </ThemedText>
              <ThemedText style={[styles.statSub, { color: theme.textSecondary }]}>
                Opérations
              </ThemedText>
            </View>

            <View style={[styles.statBox, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}>
              <ThemedText style={[styles.statLabel, { color: theme.textMuted }]}>
                Compteur Offline
              </ThemedText>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                #{card.offlineCounter || 0}
              </ThemedText>
              <ThemedText style={[styles.statSub, { color: theme.textSecondary }]}>
                Sécurité Replay
              </ThemedText>
            </View>
          </View>

          {/* Transactions Header */}
          <View style={styles.txHeaderRow}>
            <View>
              <ThemedText style={[styles.sectionTitle, { color: theme.text, marginTop: 0 }]}>
                {showAllTransactions ? `Toutes les Transactions (${transactions.length})` : '5 Dernières Transactions'}
              </ThemedText>
              <ThemedText style={[styles.txSubtitle, { color: theme.textMuted }]}>
                Historique certifié par le protocole sécurisé
              </ThemedText>
            </View>

            {transactions.length > 5 && (
              <Pressable
                onPress={() => setShowAllTransactions(!showAllTransactions)}
                style={[styles.toggleTxBtn, { backgroundColor: dark ? '#24211E' : '#EFE8E1' }]}
              >
                <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.accentPrimary }}>
                  {showAllTransactions ? 'Réduire à 5' : `Voir tout (${transactions.length})`}
                </ThemedText>
              </Pressable>
            )}
          </View>

          {/* Transactions List */}
          {displayedTransactions.length === 0 ? (
            <View style={[styles.emptyTxBox, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}>
              <Ionicons name="receipt-outline" size={32} color={theme.textMuted} />
              <ThemedText style={{ color: theme.textSecondary, marginTop: 8 }}>
                Aucune transaction enregistrée pour cette carte.
              </ThemedText>
            </View>
          ) : (
            displayedTransactions.map((t, idx) => (
              <View
                key={t.id || idx}
                style={[
                  styles.txCard,
                  { backgroundColor: dark ? '#181615' : theme.backgroundElement },
                ]}
              >
                <View style={styles.txLeft}>
                  <View style={[styles.txIconWrap, { backgroundColor: theme.accentTranslucent }]}>
                    <Ionicons name="water" size={18} color={theme.accentPrimary} />
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <ThemedText style={[styles.txTitle, { color: theme.text }]}>
                      {t.fuelType || 'Carburant'} · {Number(t.liters || 0).toFixed(2)} L
                    </ThemedText>
                    <ThemedText style={[styles.txMeta, { color: theme.textMuted }]}>
                      {new Date(t.timestamp).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {t.isOfflineFlag ? ' · Sync Offline' : ' · En ligne'}
                    </ThemedText>
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <ThemedText style={[styles.txAmount, { color: theme.text }]}>
                    -{Number(t.amountFcfa).toLocaleString('fr-FR')} F
                  </ThemedText>
                  <View style={styles.authBadge}>
                    <Ionicons name="shield-checkmark" size={11} color={theme.statusSuccess} />
                    <ThemedText style={{ fontSize: 10, color: theme.statusSuccess, marginLeft: 2, fontWeight: '600' }}>
                      Validé
                    </ThemedText>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Edit Restrictions Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: dark ? '#1A1816' : '#FFFFFF',
                paddingBottom: Math.max(insets.bottom, 20) + 16,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                Plafonds & Restrictions
              </ThemedText>
              <Pressable onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </Pressable>
            </View>

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Plaque Véhicule
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { backgroundColor: dark ? '#24211E' : '#F4EFEA', color: theme.text }]}
              placeholder="Ex: 542-CG-04"
              placeholderTextColor={theme.textMuted}
              value={editPlate}
              onChangeText={setEditPlate}
              autoCapitalize="characters"
            />

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Nom du Chauffeur
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { backgroundColor: dark ? '#24211E' : '#F4EFEA', color: theme.text }]}
              placeholder="Ex: Christian Okamba"
              placeholderTextColor={theme.textMuted}
              value={editDriver}
              onChangeText={setEditDriver}
            />

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Plafond Journalier (FCFA)
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { backgroundColor: dark ? '#24211E' : '#F4EFEA', color: theme.text }]}
              placeholder="Ex: 50000"
              placeholderTextColor={theme.textMuted}
              value={editDailyLimit}
              onChangeText={setEditDailyLimit}
              keyboardType="numeric"
            />

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Restriction Carburant
            </ThemedText>
            <View style={styles.fuelBtnRow}>
              {['Tous', 'Gazole', 'Super'].map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setEditFuel(f)}
                  style={[
                    styles.fuelChoiceBtn,
                    {
                      backgroundColor:
                        editFuel === f ? theme.accentPrimary : dark ? '#24211E' : '#EFE8E1',
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: editFuel === f ? '#FFFFFF' : theme.text,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    {f}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={handleSaveRestrictions}
              disabled={actionLoading}
              style={[styles.saveBtn, { backgroundColor: theme.accentPrimary }]}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.saveBtnText}>Enregistrer Modifications</ThemedText>
              )}
            </Pressable>
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
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  navSubtitle: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    padding: 16,
  },
  cardHero: {
    borderRadius: Radius.lg,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  cardHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTechBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  cardHeroUid: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  cardHeroDriver: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    fontWeight: '500',
  },
  cardHeroBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 12,
  },
  cardHeroBalanceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  cardHeroBalance: {
    fontSize: 18,
    fontWeight: '900',
    color: '#22C55E',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  statBox: {
    width: '48.5%',
    padding: 14,
    borderRadius: Radius.md,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 4,
  },
  statSub: {
    fontSize: 10,
  },
  txHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 12,
  },
  txSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  toggleTxBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  emptyTxBox: {
    padding: 24,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: Radius.md,
    marginBottom: 8,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  txIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  txMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  modalInput: {
    height: 44,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  fuelBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  fuelChoiceBtn: {
    flex: 1,
    height: 38,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    height: 48,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
