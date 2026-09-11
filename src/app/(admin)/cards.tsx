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
import { nfcService } from '@/services/nfc';

interface CardItem {
  cardUid: string;
  balanceFcfa: number;
  offlineCounter: number;
  status: string;
  vehiclePlate?: string;
  assignedDriverName?: string;
  fuelTypeRestriction?: string;
  dailySpendLimitFcfa?: number;
  weeklySpendLimitFcfa?: number;
  userId?: string;
  companyId?: string;
  issuedAt?: string;
}

interface CompanyItem {
  id: string;
  companyName: string;
  creditBalance: number;
}

export default function AdminCardsScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [cards, setCards] = useState<CardItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Tous' | 'Active' | 'InStock' | 'Suspended'>('Tous');

  // Stock Provisioning Modal State
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisionUid, setProvisionUid] = useState('');
  const [provisionCompanyId, setProvisionCompanyId] = useState('');
  const [provisioning, setProvisioning] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [cRes, compRes] = await Promise.all([
        fetch(API_ENDPOINTS.CARDS).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(API_ENDPOINTS.COMPANIES).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);

      if (Array.isArray(cRes)) setCards(cRes);
      if (Array.isArray(compRes)) setCompanies(compRes);
    } catch (err) {
      console.warn('Error loading cards data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Quick NFC Scan for Stock Provisioning
  const handleNfcScanProvision = async () => {
    try {
      const res = await nfcService.scanCardTag();
      if (res.success && res.cardUid) {
        setProvisionUid(res.cardUid);
      } else {
        Alert.alert('NFC', res.error || 'Aucun tag NFC détecté.');
      }
    } catch {
      Alert.alert('Erreur', 'Capteur NFC indisponible.');
    }
  };

  const handleProvisionCard = async () => {
    const cleanUid = provisionUid.trim().toUpperCase();
    if (!cleanUid) {
      Alert.alert('Champs requis', 'Veuillez saisir ou scanner un UID NFC.');
      return;
    }

    setProvisioning(true);
    try {
      const res = await fetch(API_ENDPOINTS.CARDS_PROVISION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardUid: cleanUid,
          companyId: provisionCompanyId ? provisionCompanyId : null,
        }),
      });

      if (res.ok) {
        Alert.alert('Succès', `La carte ${cleanUid} a été enregistrée dans le stock.`);
        setProvisionUid('');
        setProvisionCompanyId('');
        setShowProvisionModal(false);
        await loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Erreur', err.error || "Échec de l'enregistrement de la carte.");
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de contacter le serveur central.');
    } finally {
      setProvisioning(false);
    }
  };

  const filteredCards = cards.filter((c) => {
    if (statusFilter !== 'Tous' && c.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.cardUid.toLowerCase().includes(q) ||
      (c.vehiclePlate || '').toLowerCase().includes(q) ||
      (c.assignedDriverName || '').toLowerCase().includes(q)
    );
  });

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
        <View style={styles.headerRow}>
          <View>
            <ThemedText style={[styles.caption, { color: theme.textSecondary }]}>
              Inventaire & Sécurité
            </ThemedText>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              Gestion des Cartes NFC
            </ThemedText>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Primary Action Button: Navigates to Dedicated Write Card Screen */}
            <Pressable
              onPress={() => router.push('/(admin)/write-card')}
              style={[styles.actionBtn, { backgroundColor: theme.accentPrimary }]}
            >
              <Ionicons name="hardware-chip" size={16} color="#FFFFFF" />
              <ThemedText style={styles.actionBtnText}>Écrire Carte</ThemedText>
            </Pressable>

            {/* Secondary Action: Stock Provisioning */}
            <Pressable
              onPress={() => setShowProvisionModal(true)}
              style={[styles.actionBtnSecondary, { backgroundColor: dark ? '#24211E' : '#F0EAE4' }]}
            >
              <Ionicons name="add" size={16} color={theme.text} />
              <ThemedText style={[styles.actionBtnSecondaryText, { color: theme.text }]}>
                En Stock
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Search & Status Filter */}
        <View style={styles.filterSection}>
          <View style={[styles.searchBox, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}>
            <Ionicons name="search" size={18} color={theme.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="UID, Immatriculation ou Titulaire..."
              placeholderTextColor={theme.textMuted}
              style={[styles.searchInput, { color: theme.text }]}
              autoCapitalize="characters"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </Pressable>
            )}
          </View>

          <View style={styles.statusFilterRow}>
            {(['Tous', 'Active', 'InStock', 'Suspended'] as const).map((st) => (
              <Pressable
                key={st}
                onPress={() => setStatusFilter(st)}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor:
                      statusFilter === st
                        ? theme.accentPrimary
                        : dark
                        ? '#181615'
                        : theme.backgroundElement,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.statusChipText,
                    { color: statusFilter === st ? '#FFFFFF' : theme.textSecondary },
                  ]}
                >
                  {st === 'Tous'
                    ? 'Toutes'
                    : st === 'Active'
                    ? 'Actives'
                    : st === 'InStock'
                    ? 'En Stock'
                    : 'Suspendues'}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Cards List */}
        {loading ? (
          <ActivityIndicator size="small" color={theme.accentPrimary} style={{ marginVertical: 30 }} />
        ) : filteredCards.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
            <Ionicons name="card-outline" size={36} color={theme.textMuted} />
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              Aucune carte trouvée
            </ThemedText>
            <ThemedText style={[styles.emptySub, { color: theme.textMuted }]}>
              Appuyez sur "Écrire Carte" pour ouvrir l'assistant de programmation de puce NFC.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.cardsList}>
            {filteredCards.map((c) => {
              const isActive = c.status === 'Active';
              const isInStock = c.status === 'InStock';

              return (
                <Pressable
                  key={c.cardUid}
                  onPress={() => router.push({ pathname: '/(admin)/card-detail', params: { cardUid: c.cardUid } })}
                  style={({ pressed }) => [
                    styles.cardRow,
                    {
                      backgroundColor: dark ? '#161514' : theme.backgroundElement,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <View style={styles.cardLeft}>
                    <View
                      style={[
                        styles.cardIconWrap,
                        {
                          backgroundColor: isActive
                            ? 'rgba(34, 197, 94, 0.12)'
                            : isInStock
                            ? theme.accentTranslucent
                            : 'rgba(239, 68, 68, 0.12)',
                        },
                      ]}
                    >
                      <Ionicons
                        name={isActive ? 'checkmark-circle' : isInStock ? 'pause-circle' : 'alert-circle'}
                        size={22}
                        color={isActive ? theme.statusSuccess : isInStock ? theme.accentPrimary : theme.statusError}
                      />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ThemedText style={[styles.cardUid, { color: theme.text }]}>
                          {c.cardUid}
                        </ThemedText>
                        {c.fuelTypeRestriction && (
                          <View
                            style={{
                              backgroundColor: dark ? '#24211E' : '#EFE8E1',
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                              borderRadius: 4,
                            }}
                          >
                            <ThemedText style={{ fontSize: 9, fontWeight: '700', color: theme.textSecondary }}>
                              {c.fuelTypeRestriction}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                      <ThemedText style={[styles.cardDetails, { color: theme.textMuted }]}>
                        {c.assignedDriverName ? c.assignedDriverName : 'Non assignée'}
                        {c.vehiclePlate ? ` · ${c.vehiclePlate}` : ''}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.cardRight}>
                    <ThemedText style={[styles.cardBalance, { color: theme.text }]}>
                      {Number(c.balanceFcfa || 0).toLocaleString('fr-FR')} FCFA
                    </ThemedText>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: isActive
                            ? 'rgba(34, 197, 94, 0.15)'
                            : isInStock
                            ? 'rgba(234, 179, 8, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        },
                      ]}
                    >
                      <ThemedText
                        style={{
                          color: isActive
                            ? theme.statusSuccess
                            : isInStock
                            ? '#EAB308'
                            : theme.statusError,
                          fontSize: 10,
                          fontWeight: '700',
                        }}
                      >
                        {c.status.toUpperCase()}
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ======================================================= */}
      {/* MODAL: APPROVISIONNER UNE CARTE NFC DANS LE STOCK       */}
      {/* ======================================================= */}
      <Modal visible={showProvisionModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
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
                Enregistrer Puce NFC
              </ThemedText>
              <Pressable onPress={() => setShowProvisionModal(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </Pressable>
            </View>

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Identifiant UID de la Carte
            </ThemedText>
            <View style={styles.nfcInputRow}>
              <TextInput
                style={[
                  styles.modalInput,
                  { flex: 1, backgroundColor: dark ? '#24211E' : '#F4EFEA', color: theme.text },
                ]}
                placeholder="Ex: 04B3E2A1F9C800"
                placeholderTextColor={theme.textMuted}
                value={provisionUid}
                onChangeText={setProvisionUid}
                autoCapitalize="characters"
              />
              <Pressable
                onPress={handleNfcScanProvision}
                style={[styles.nfcScanBtn, { backgroundColor: theme.accentPrimary }]}
              >
                <Ionicons name="hardware-chip-outline" size={18} color="#FFFFFF" />
                <ThemedText style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                  Scanner
                </ThemedText>
              </Pressable>
            </View>

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Entreprise / Flotte (Optionnel)
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
              <Pressable
                onPress={() => setProvisionCompanyId('')}
                style={[
                  styles.companyChip,
                  {
                    backgroundColor:
                      provisionCompanyId === ''
                        ? theme.accentPrimary
                        : dark
                        ? '#24211E'
                        : '#F4EFEA',
                  },
                ]}
              >
                <ThemedText
                  style={{
                    color: provisionCompanyId === '' ? '#FFFFFF' : theme.text,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  Aucune (Stock Neutre)
                </ThemedText>
              </Pressable>
              {companies.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setProvisionCompanyId(c.id)}
                  style={[
                    styles.companyChip,
                    {
                      backgroundColor:
                        provisionCompanyId === c.id
                          ? theme.accentPrimary
                          : dark
                          ? '#24211E'
                          : '#F4EFEA',
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: provisionCompanyId === c.id ? '#FFFFFF' : theme.text,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {c.companyName}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              onPress={handleProvisionCard}
              disabled={provisioning}
              style={[styles.submitBtn, { backgroundColor: theme.accentPrimary }]}
            >
              {provisioning ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.submitBtnText}>Enregistrer dans le Stock</ThemedText>
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
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  caption: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.chip,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.chip,
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterSection: {
    gap: 8,
    marginBottom: Spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: Radius.chip,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  statusFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyBox: {
    borderRadius: Radius.chip,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  cardsList: {
    gap: 10,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.chip,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardUid: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardDetails: {
    fontSize: 11,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  cardBalance: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  nfcInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalInput: {
    height: 46,
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
  },
  nfcScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: Radius.chip,
  },
  companyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.chip,
    marginRight: 8,
  },
  submitBtn: {
    height: 48,
    borderRadius: Radius.chip,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radius.chip,
    marginVertical: Spacing.xs,
  },
  citySelectChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.chip,
  },
});
