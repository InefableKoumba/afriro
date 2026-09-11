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
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL, API_ENDPOINTS } from '@/constants/api';

interface ClientCompany {
  id: string;
  companyName: string;
  clientType?: string;
  registrationNumber?: string;
  contactPhone?: string;
  contactEmail?: string;
  creditBalance: number;
  createdAt: string;
}

interface ClientCard {
  cardUid: string;
  status: string;
  balanceFcfa: number;
  vehiclePlate?: string;
  assignedDriverName?: string;
  fuelTypeRestriction?: string;
  dailySpendLimitFcfa?: number;
}

export default function AdminClientsScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [clients, setClients] = useState<ClientCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Business' | 'Individual'>('All');

  // Selected Client Details State
  const [selectedClient, setSelectedClient] = useState<ClientCompany | null>(null);
  const [clientCards, setClientCards] = useState<ClientCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  // Client Master Recharge Modal State
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupPaymentMethod, setTopupPaymentMethod] = useState<'Cash' | 'Virement' | 'MobileMoney'>('Cash');
  const [topupLoading, setTopupLoading] = useState(false);

  const loadClients = useCallback(async () => {
    try {
      const res = await fetch(API_ENDPOINTS.COMPANIES);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setClients(data);
        }
      }
    } catch (err) {
      console.warn('Error loading clients list:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const onRefresh = () => {
    setRefreshing(true);
    loadClients();
  };

  const handleOpenClientDetails = async (client: ClientCompany) => {
    setSelectedClient(client);
    setLoadingCards(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fleet/${client.id}/cards`);
      if (res.ok) {
        const cardsData = await res.json();
        if (Array.isArray(cardsData)) {
          setClientCards(cardsData);
        } else {
          setClientCards([]);
        }
      } else {
        setClientCards([]);
      }
    } catch (err) {
      console.warn('Error loading client cards:', err);
      setClientCards([]);
    } finally {
      setLoadingCards(false);
    }
  };

  const handleTopupClientAccount = async () => {
    if (!selectedClient) return;
    const amountNum = parseFloat(topupAmount);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Montant invalide', 'Veuillez saisir un montant de rechargement valide.');
      return;
    }

    setTopupLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fleet/${selectedClient.id}/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountFcfa: amountNum,
          paymentMethod: topupPaymentMethod,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        Alert.alert(
          'Rechargement Réussi',
          `Le compte de ${selectedClient.companyName} a été crédité de ${amountNum.toLocaleString('fr-FR')} FCFA.\nNouveau solde : ${Number(result.newCreditBalance || 0).toLocaleString('fr-FR')} FCFA.`
        );
        setShowTopupModal(false);
        setTopupAmount('');
        // Update local client state
        setSelectedClient({
          ...selectedClient,
          creditBalance: (selectedClient.creditBalance || 0) + amountNum,
        });
        await loadClients();
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Erreur', err.error || 'Échec du rechargement du compte.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de contacter le serveur central.');
    } finally {
      setTopupLoading(false);
    }
  };

  const filteredClients = clients.filter((c) => {
    if (typeFilter !== 'All') {
      const isInd = c.clientType?.toLowerCase() === 'individual';
      if (typeFilter === 'Individual' && !isInd) return false;
      if (typeFilter === 'Business' && isInd) return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.companyName.toLowerCase().includes(q) ||
      (c.registrationNumber && c.registrationNumber.toLowerCase().includes(q)) ||
      (c.contactPhone && c.contactPhone.includes(q)) ||
      (c.contactEmail && c.contactEmail.toLowerCase().includes(q))
    );
  });

  const totalPoolBalance = clients.reduce((sum, c) => sum + (Number(c.creditBalance) || 0), 0);
  const businessCount = clients.filter((c) => c.clientType?.toLowerCase() !== 'individual').length;
  const individualCount = clients.filter((c) => c.clientType?.toLowerCase() === 'individual').length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <ThemedText style={[styles.caption, { color: theme.textSecondary }]}>
            Portefeuille & Flottes B2B
          </ThemedText>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Comptes Clients ({clients.length})
          </ThemedText>
        </View>

        <Pressable
          onPress={() => onRefresh()}
          style={[styles.refreshIconBtn, { backgroundColor: dark ? '#24211E' : '#EFE8E1' }]}
        >
          <Ionicons name="refresh" size={18} color={theme.accentPrimary} />
        </Pressable>
      </View>

      {/* KPI Overview Strip */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}>
          <ThemedText style={[styles.kpiLabel, { color: theme.textMuted }]}>SOLDE TOTAL POOL</ThemedText>
          <ThemedText style={[styles.kpiVal, { color: theme.accentPrimary }]}>
            {totalPoolBalance.toLocaleString('fr-FR')} F
          </ThemedText>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}>
          <ThemedText style={[styles.kpiLabel, { color: theme.textMuted }]}>ENTREPRISES B2B</ThemedText>
          <ThemedText style={[styles.kpiVal, { color: theme.text }]}>{businessCount}</ThemedText>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}>
          <ThemedText style={[styles.kpiLabel, { color: theme.textMuted }]}>PARTICULIERS</ThemedText>
          <ThemedText style={[styles.kpiVal, { color: theme.text }]}>{individualCount}</ThemedText>
        </View>
      </View>

      {/* Search and Filters */}
      <View style={styles.filterSection}>
        <View style={[styles.searchBox, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher par nom, téléphone, RCCM..."
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Filter Segmented Controls */}
        <View style={styles.typeFilterRow}>
          {[
            { key: 'All', label: 'Tous les Clients' },
            { key: 'Business', label: 'Entreprises B2B' },
            { key: 'Individual', label: 'Particuliers' },
          ].map((tf) => (
            <Pressable
              key={tf.key}
              onPress={() => setTypeFilter(tf.key as any)}
              style={[
                styles.typeFilterBtn,
                {
                  backgroundColor:
                    typeFilter === tf.key
                      ? theme.accentPrimary
                      : dark
                      ? '#181615'
                      : theme.backgroundElement,
                },
              ]}
            >
              <ThemedText
                style={{
                  fontSize: 12,
                  fontWeight: typeFilter === tf.key ? '700' : '500',
                  color: typeFilter === tf.key ? '#FFFFFF' : theme.textSecondary,
                }}
              >
                {tf.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Clients List */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.accentPrimary} />
          <ThemedText style={{ color: theme.textMuted, marginTop: 12 }}>
            Chargement des comptes clients...
          </ThemedText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentPrimary} />}
        >
          {filteredClients.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}>
              <Ionicons name="people-outline" size={40} color={theme.textMuted} />
              <ThemedText style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 12 }}>
                Aucun client trouvé
              </ThemedText>
              <ThemedText style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                Modifiez vos termes de recherche ou vos filtres.
              </ThemedText>
            </View>
          ) : (
            filteredClients.map((client) => {
              const isBusiness = client.clientType?.toLowerCase() !== 'individual';
              return (
                <Pressable
                  key={client.id}
                  onPress={() => handleOpenClientDetails(client)}
                  style={({ pressed }) => [
                    styles.clientCard,
                    {
                      backgroundColor: dark ? '#161514' : theme.backgroundElement,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <View style={styles.clientCardTop}>
                    <View style={styles.clientAvatarWrap}>
                      <View
                        style={[
                          styles.avatar,
                          { backgroundColor: isBusiness ? 'rgba(59, 130, 246, 0.15)' : 'rgba(34, 197, 94, 0.15)' },
                        ]}
                      >
                        <Ionicons
                          name={isBusiness ? 'business' : 'person'}
                          size={20}
                          color={isBusiness ? '#3B82F6' : theme.statusSuccess}
                        />
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <ThemedText style={[styles.clientName, { color: theme.text }]}>
                            {client.companyName}
                          </ThemedText>
                          <View
                            style={[
                              styles.typeBadge,
                              { backgroundColor: isBusiness ? 'rgba(59, 130, 246, 0.15)' : 'rgba(34, 197, 94, 0.15)' },
                            ]}
                          >
                            <ThemedText
                              style={{
                                fontSize: 9,
                                fontWeight: '700',
                                color: isBusiness ? '#3B82F6' : theme.statusSuccess,
                              }}
                            >
                              {isBusiness ? 'B2B Flotte' : 'Particulier'}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText style={[styles.clientSub, { color: theme.textMuted }]}>
                          {client.contactPhone || 'Aucun tél'}
                          {client.registrationNumber ? ` · ${client.registrationNumber}` : ''}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <ThemedText style={[styles.balanceAmount, { color: theme.text }]}>
                        {Number(client.creditBalance || 0).toLocaleString('fr-FR')} FCFA
                      </ThemedText>
                      <ThemedText style={{ fontSize: 10, color: theme.accentPrimary, fontWeight: '700', marginTop: 2 }}>
                        Solde Maître ▾
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ======================================================= */}
      {/* MODAL: FULL CLIENT DETAILS & ASSIGNED CARDS             */}
      {/* ======================================================= */}
      <Modal visible={!!selectedClient} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: dark ? '#1A1816' : '#FFFFFF',
                maxHeight: '92%',
                paddingBottom: Math.max(insets.bottom, 20) + 16,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                  {selectedClient?.companyName}
                </ThemedText>
                <ThemedText style={{ color: theme.textMuted, fontSize: 12 }}>
                  {selectedClient?.clientType === 'Individual' ? 'Compte Particulier' : 'Compte Flotte Entreprise'}
                  {selectedClient?.registrationNumber ? ` · RCCM: ${selectedClient.registrationNumber}` : ''}
                </ThemedText>
              </View>
              <Pressable onPress={() => setSelectedClient(null)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {/* Balance Hero */}
              <View style={[styles.detailsBalanceCard, { backgroundColor: dark ? '#24211E' : '#F4EFEA' }]}>
                <View>
                  <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5 }}>
                    SOLDE DU COMPTE PRINCIPAL
                  </ThemedText>
                  <ThemedText style={{ fontSize: 24, fontWeight: '900', color: theme.accentPrimary, marginTop: 4 }}>
                    {Number(selectedClient?.creditBalance || 0).toLocaleString('fr-FR')} FCFA
                  </ThemedText>
                  <ThemedText style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                    Téléphone : {selectedClient?.contactPhone || 'N/A'} · Email : {selectedClient?.contactEmail || 'N/A'}
                  </ThemedText>
                </View>

                <Pressable
                  onPress={() => setShowTopupModal(true)}
                  style={[styles.rechargeBtn, { backgroundColor: theme.accentPrimary }]}
                >
                  <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                  <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12, marginLeft: 4 }}>
                    Recharger
                  </ThemedText>
                </Pressable>
              </View>

              {/* Cards Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 }}>
                <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>
                  Cartes NFC Assignées ({clientCards.length})
                </ThemedText>
                <Pressable
                  onPress={() => {
                    setSelectedClient(null);
                    router.push('/(admin)/write-card');
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Ionicons name="add" size={16} color={theme.accentPrimary} />
                  <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.accentPrimary, marginLeft: 2 }}>
                    Assigner Carte
                  </ThemedText>
                </Pressable>
              </View>

              {/* Cards List */}
              {loadingCards ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.accentPrimary} />
                  <ThemedText style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
                    Chargement des cartes de la flotte...
                  </ThemedText>
                </View>
              ) : clientCards.length === 0 ? (
                <View style={[styles.emptyBoxMini, { backgroundColor: dark ? '#24211E' : '#F4EFEA' }]}>
                  <Ionicons name="card-outline" size={24} color={theme.textMuted} />
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 12, marginTop: 6 }}>
                    Aucune carte NFC n'est encore assignée à ce client.
                  </ThemedText>
                </View>
              ) : (
                clientCards.map((c) => (
                  <Pressable
                    key={c.cardUid}
                    onPress={() => {
                      setSelectedClient(null);
                      router.push({ pathname: '/(admin)/card-detail', params: { cardUid: c.cardUid } });
                    }}
                    style={[styles.miniCardRow, { backgroundColor: dark ? '#24211E' : '#F4EFEA' }]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text, fontFamily: 'monospace' }}>
                          {c.cardUid}
                        </ThemedText>
                        <View style={[styles.typeBadge, { backgroundColor: c.status === 'Active' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                          <ThemedText style={{ fontSize: 9, fontWeight: '700', color: c.status === 'Active' ? theme.statusSuccess : theme.statusError }}>
                            {c.status}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                        {c.assignedDriverName || 'Chauffeur non défini'}
                        {c.vehiclePlate ? ` · ${c.vehiclePlate}` : ''}
                      </ThemedText>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>
                        {Number(c.balanceFcfa || 0).toLocaleString('fr-FR')} F
                      </ThemedText>
                      <ThemedText style={{ fontSize: 10, color: theme.accentPrimary, fontWeight: '600' }}>
                        Détails ➔
                      </ThemedText>
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======================================================= */}
      {/* MODAL: MASTER TOP-UP CLIENT WALLET                     */}
      {/* ======================================================= */}
      <Modal visible={showTopupModal} transparent animationType="fade">
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
              <View>
                <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                  Recharger Compte Maître
                </ThemedText>
                <ThemedText style={{ color: theme.textMuted, fontSize: 12 }}>
                  {selectedClient?.companyName}
                </ThemedText>
              </View>
              <Pressable onPress={() => setShowTopupModal(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </Pressable>
            </View>

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Montant à créditer (FCFA)
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { backgroundColor: dark ? '#24211E' : '#F4EFEA', color: theme.text }]}
              placeholder="Ex: 500000"
              placeholderTextColor={theme.textMuted}
              value={topupAmount}
              onChangeText={setTopupAmount}
              keyboardType="numeric"
            />

            {/* Quick Amounts */}
            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 8 }}>
              {[100000, 250000, 500000, 1000000].map((amt) => (
                <Pressable
                  key={amt}
                  onPress={() => setTopupAmount(amt.toString())}
                  style={[styles.presetChip, { backgroundColor: dark ? '#24211E' : '#EFE8E1' }]}
                >
                  <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.text }}>
                    {amt >= 1000000 ? `${amt / 1000000}M` : `${amt / 1000}k`}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Mode de Règlement
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              {[
                { key: 'Cash', label: 'Espèces' },
                { key: 'Virement', label: 'Virement' },
                { key: 'MobileMoney', label: 'Airtel / MTN' },
              ].map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => setTopupPaymentMethod(m.key as any)}
                  style={[
                    styles.methodBtn,
                    {
                      backgroundColor:
                        topupPaymentMethod === m.key
                          ? theme.accentPrimary
                          : dark
                          ? '#24211E'
                          : '#EFE8E1',
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: topupPaymentMethod === m.key ? '#FFFFFF' : theme.text,
                    }}
                  >
                    {m.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={handleTopupClientAccount}
              disabled={topupLoading}
              style={[styles.confirmBtn, { backgroundColor: theme.accentPrimary }]}
            >
              {topupLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
                  Confirmer le Rechargement
                </ThemedText>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  caption: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  refreshIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.screenPadding,
    marginTop: 8,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: Radius.md,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  kpiVal: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  filterSection: {
    paddingHorizontal: Spacing.screenPadding,
    marginTop: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: Radius.md,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  typeFilterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: 12,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyBox: {
    padding: 32,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  clientCard: {
    padding: 14,
    borderRadius: Radius.md,
    marginBottom: 8,
  },
  clientCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientAvatarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientName: {
    fontSize: 14,
    fontWeight: '800',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  clientSub: {
    fontSize: 11,
    marginTop: 2,
  },
  balanceAmount: {
    fontSize: 14,
    fontWeight: '800',
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
    fontWeight: '800',
  },
  detailsBalanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: Radius.md,
  },
  rechargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  emptyBoxMini: {
    padding: 16,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  miniCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.sm,
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  modalInput: {
    height: 44,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: Radius.xs,
    alignItems: 'center',
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  confirmBtn: {
    height: 48,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
});
