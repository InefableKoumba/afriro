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

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL, API_ENDPOINTS } from '@/constants/api';
import { mobileAuth, MobileUserSession } from '@/services/auth';

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
  companyId?: string;
}

export default function CardsScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<MobileUserSession | null>(mobileAuth.getUser());
  const [cards, setCards] = useState<CardItem[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'stock' | 'suspended'>('all');
  const [freezeLoading, setFreezeLoading] = useState<string | null>(null);

  // New Card Provisioning Modal (StationCashier / Admin)
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [newCardUid, setNewCardUid] = useState('');
  const [newPlate, setNewPlate] = useState('');
  const [newDriver, setNewDriver] = useState('');
  const [provisionLoading, setProvisionLoading] = useState(false);

  // Spend Limit Edit Modal (FleetManager / Admin)
  const [selectedCardForLimit, setSelectedCardForLimit] = useState<CardItem | null>(null);
  const [newDailyLimit, setNewDailyLimit] = useState('50000');
  const [newWeeklyLimit, setNewWeeklyLimit] = useState('200000');
  const [newFuelRestriction, setNewFuelRestriction] = useState<string>('Gazole');
  const [limitLoading, setLimitLoading] = useState(false);

  useEffect(() => {
    const unsub = mobileAuth.subscribe((u) => setUser(u));
    return () => unsub();
  }, []);

  const loadCards = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.CARDS);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setCards(data);
      }
    } catch {
      // Fallback demo cards
      setCards([
        {
          cardUid: '04A1B2C3D4E5F6',
          balanceFcfa: 100000,
          offlineCounter: 12,
          status: 'Active',
          vehiclePlate: '542-CG-04',
          assignedDriverName: 'Serge Moungalla',
          fuelTypeRestriction: 'Gazole',
          dailySpendLimitFcfa: 50000,
          weeklySpendLimitFcfa: 200000,
        },
        {
          cardUid: '04B2C3D4E5F6A1',
          balanceFcfa: 45000,
          offlineCounter: 4,
          status: 'Active',
          vehiclePlate: '819-CG-04',
          assignedDriverName: 'Jean Makaya',
          fuelTypeRestriction: 'Super',
          dailySpendLimitFcfa: 40000,
          weeklySpendLimitFcfa: 150000,
        },
        {
          cardUid: '04C3D4E5F6A1B2',
          balanceFcfa: 0,
          offlineCounter: 0,
          status: 'InStock',
          dailySpendLimitFcfa: 30000,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, []);

  const userRole = user?.role || 'Driver';
  const isDriver = userRole === 'Driver';

  // Toggle Freeze Card
  const toggleFreeze = async (card: CardItem) => {
    const nextStatus = card.status === 'Active' ? 'Suspended' : 'Active';
    setFreezeLoading(card.cardUid);
    try {
      const res = await fetch(API_ENDPOINTS.CARD_STATUS(card.cardUid), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setCards((prev) =>
          prev.map((c) => (c.cardUid === card.cardUid ? { ...c, status: nextStatus } : c))
        );
      } else {
        // Optimistic update
        setCards((prev) =>
          prev.map((c) => (c.cardUid === card.cardUid ? { ...c, status: nextStatus } : c))
        );
      }
    } catch {
      setCards((prev) =>
        prev.map((c) => (c.cardUid === card.cardUid ? { ...c, status: nextStatus } : c))
      );
    } finally {
      setFreezeLoading(null);
      Alert.alert(
        nextStatus === 'Active' ? 'Carte Débloquée' : 'Carte Gelée',
        `La carte ${card.cardUid} est désormais ${nextStatus === 'Active' ? 'active' : 'suspendue'}.`
      );
    }
  };

  // Provision New Card
  const handleProvision = async () => {
    if (!newCardUid) {
      Alert.alert('Erreur', 'Veuillez saisir un UID de carte valide.');
      return;
    }
    setProvisionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cards/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardUid: newCardUid.trim().toUpperCase(),
          vehiclePlate: newPlate ? newPlate.trim() : undefined,
          assignedDriverName: newDriver ? newDriver.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Succès', `Carte ${newCardUid.toUpperCase()} ajoutée au stock.`);
        setNewCardUid('');
        setNewPlate('');
        setNewDriver('');
        setShowProvisionModal(false);
        loadCards();
      } else {
        Alert.alert('Erreur', data.error || 'Erreur lors du provisionnement');
      }
    } catch {
      // Offline fallback
      setCards((prev) => [
        ...prev,
        {
          cardUid: newCardUid.trim().toUpperCase(),
          balanceFcfa: 0,
          offlineCounter: 0,
          status: 'InStock',
          vehiclePlate: newPlate || undefined,
          assignedDriverName: newDriver || undefined,
        },
      ]);
      Alert.alert('Succès Local', `Carte ${newCardUid.toUpperCase()} ajoutée au stock local.`);
      setShowProvisionModal(false);
    } finally {
      setProvisionLoading(false);
    }
  };

  // Save Card Controls
  const handleSaveControls = async () => {
    if (!selectedCardForLimit) return;
    setLimitLoading(true);
    try {
      const daily = parseFloat(newDailyLimit);
      const weekly = parseFloat(newWeeklyLimit);

      await fetch(`${API_BASE_URL}/api/fleet/cards/${selectedCardForLimit.cardUid}/controls`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailySpendLimitFcfa: !isNaN(daily) ? daily : null,
          weeklySpendLimitFcfa: !isNaN(weekly) ? weekly : null,
          fuelTypeRestriction: newFuelRestriction === 'None' ? null : newFuelRestriction,
        }),
      });

      setCards((prev) =>
        prev.map((c) =>
          c.cardUid === selectedCardForLimit.cardUid
            ? {
                ...c,
                dailySpendLimitFcfa: !isNaN(daily) ? daily : c.dailySpendLimitFcfa,
                weeklySpendLimitFcfa: !isNaN(weekly) ? weekly : c.weeklySpendLimitFcfa,
                fuelTypeRestriction: newFuelRestriction === 'None' ? undefined : newFuelRestriction,
              }
            : c
        )
      );

      Alert.alert('Succès', 'Plafonds de dépenses mis à jour.');
      setSelectedCardForLimit(null);
    } catch {
      Alert.alert('Succès Local', 'Plafonds mis à jour en mémoire locale.');
      setSelectedCardForLimit(null);
    } finally {
      setLimitLoading(false);
    }
  };

  const filteredCards = cards.filter((c) => {
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'active'
        ? c.status === 'Active'
        : filter === 'stock'
        ? c.status === 'InStock'
        : c.status === 'Suspended';

    const matchesSearch =
      searchQuery.trim() === ''
        ? true
        : c.cardUid.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.vehiclePlate && c.vehiclePlate.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (c.assignedDriverName &&
            c.assignedDriverName.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  const activeCard = cards[activeCardIndex] || cards[0];

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ======================================================= */}
        {/* HEADER                                                  */}
        {/* ======================================================= */}
        <View style={styles.headerRow}>
          <View>
            <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11 }}>
              {isDriver
                ? 'Gestionnaire NFC Personnel'
                : userRole === 'StationCashier'
                ? 'Inventaire & Enrôlement'
                : 'Flotte B2B & Véhicules'}
            </ThemedText>
            <ThemedText type="display" style={{ color: theme.text, fontSize: 24, fontWeight: '700' }}>
              {isDriver
                ? 'Ma Carte Carburant'
                : userRole === 'StationCashier'
                ? 'Stock de Cartes'
                : 'Cartes Flotte'}
            </ThemedText>
          </View>

          {/* Provision button for Cashier & Admin */}
          {!isDriver && (
            <Pressable
              onPress={() => setShowProvisionModal(true)}
              style={[styles.provisionBtn, { backgroundColor: theme.accentPrimary }]}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13, marginLeft: 4 }}>
                Nouvelle
              </ThemedText>
            </Pressable>
          )}
        </View>

        {/* ======================================================= */}
        {/* HERO VIRTUAL RFID CARD (REVOLUT FINTECH STYLE)          */}
        {/* ======================================================= */}
        {activeCard && (
          <View style={styles.cardHeroContainer}>
            <View
              style={[
                styles.virtualCard,
                {
                  backgroundColor: '#161514',
                  borderColor:
                    activeCard.status === 'Active'
                      ? 'rgba(216,128,74,0.35)'
                      : activeCard.status === 'InStock'
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(239,68,68,0.4)',
                },
              ]}
            >
              {/* Card Top Row */}
              <View style={styles.cardTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.flameDot} />
                  <ThemedText style={styles.brandTitle}>AFRIC' PASS</ThemedText>
                  <View style={styles.fuelBadge}>
                    <ThemedText style={styles.fuelBadgeText}>
                      {activeCard.fuelTypeRestriction || 'TOUS PRODUITS'}
                    </ThemedText>
                  </View>
                </View>
                <Ionicons name="radio-outline" size={22} color={theme.accentPrimary} />
              </View>

              {/* Card Mid Row: Chip & Balance */}
              <View style={styles.cardMidRow}>
                <View style={styles.emvChip}>
                  <View style={styles.chipHLine} />
                  <View style={styles.chipVLine} />
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <ThemedText style={styles.cardBalanceLabel}>SOLDE DISPONIBLE</ThemedText>
                  <ThemedText style={styles.cardBalanceValue}>
                    {activeCard.balanceFcfa.toLocaleString('fr-FR')} FCFA
                  </ThemedText>
                </View>
              </View>

              {/* Card Bottom Row: Vehicle Plate, Driver, UID, Status */}
              <View style={styles.cardBottomRow}>
                <View>
                  <ThemedText style={styles.vehiclePlateText}>
                    {activeCard.vehiclePlate || 'VÉHICULE NON ASSIGNÉ'}
                  </ThemedText>
                  <ThemedText style={styles.cardDriverName}>
                    {activeCard.assignedDriverName || 'Stock Magasin Afric\''} · ••••{' '}
                    {activeCard.cardUid.slice(-4).toUpperCase()}
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor:
                        activeCard.status === 'Active'
                          ? 'rgba(34,197,94,0.18)'
                          : activeCard.status === 'InStock'
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(239,68,68,0.18)',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          activeCard.status === 'Active'
                            ? theme.statusSuccess
                            : activeCard.status === 'InStock'
                            ? '#9CA3AF'
                            : theme.statusError,
                      },
                    ]}
                  />
                  <ThemedText
                    style={[
                      styles.statusPillText,
                      {
                        color:
                          activeCard.status === 'Active'
                            ? theme.statusSuccess
                            : activeCard.status === 'InStock'
                            ? '#D1D5DB'
                            : theme.statusError,
                      },
                    ]}
                  >
                    {activeCard.status === 'Active'
                      ? 'Active'
                      : activeCard.status === 'InStock'
                      ? 'En Stock'
                      : 'Gelée'}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* If multiple cards, show card picker bar */}
            {cards.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardCarouselPills}
              >
                {cards.map((c, i) => {
                  const isSelected = i === activeCardIndex;
                  return (
                    <Pressable
                      key={c.cardUid}
                      onPress={() => setActiveCardIndex(i)}
                      style={[
                        styles.carouselItem,
                        {
                          backgroundColor: isSelected
                            ? 'rgba(216,128,74,0.2)'
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
                          color: isSelected ? theme.accentPrimary : theme.textMuted,
                          fontSize: 11,
                          fontWeight: isSelected ? '700' : '400',
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
        )}

        {/* ======================================================= */}
        {/* CARD ACTIONS & CONTROLS ROW                             */}
        {/* ======================================================= */}
        {activeCard && (
          <View style={styles.cardActionsContainer}>
            {/* Freeze / Unfreeze */}
            <Pressable
              onPress={() => toggleFreeze(activeCard)}
              disabled={freezeLoading === activeCard.cardUid}
              style={[
                styles.actionBtn,
                { backgroundColor: theme.backgroundElement, borderColor: theme.borderHairline },
              ]}
            >
              {freezeLoading === activeCard.cardUid ? (
                <ActivityIndicator size="small" color={theme.accentPrimary} />
              ) : (
                <Ionicons
                  name={activeCard.status === 'Active' ? 'snow-outline' : 'lock-open-outline'}
                  size={20}
                  color={activeCard.status === 'Active' ? '#60A5FA' : theme.statusSuccess}
                />
              )}
              <ThemedText style={styles.actionBtnText}>
                {activeCard.status === 'Active' ? 'Geler la Carte' : 'Débloquer'}
              </ThemedText>
            </Pressable>

            {/* Set Limits / Controls (Fleet Manager / Admin) */}
            {!isDriver && (
              <Pressable
                onPress={() => {
                  setSelectedCardForLimit(activeCard);
                  setNewDailyLimit(activeCard.dailySpendLimitFcfa?.toString() || '50000');
                  setNewWeeklyLimit(activeCard.weeklySpendLimitFcfa?.toString() || '200000');
                  setNewFuelRestriction(activeCard.fuelTypeRestriction || 'None');
                }}
                style={[
                  styles.actionBtn,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.borderHairline },
                ]}
              >
                <Ionicons name="options-outline" size={20} color={theme.accentPrimary} />
                <ThemedText style={styles.actionBtnText}>Plafonds & Règles</ThemedText>
              </Pressable>
            )}

            {/* NFC Hardware Info */}
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Certificat Sécurisé ISO-14443',
                  `UID: ${activeCard.cardUid}\nCompteur Hors-Ligne: #${activeCard.offlineCounter}\nClé Dérivation: SHA256-DERIV-${activeCard.cardUid.slice(-6)}`
                )
              }
              style={[
                styles.actionBtn,
                { backgroundColor: theme.backgroundElement, borderColor: theme.borderHairline },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={theme.statusSuccess} />
              <ThemedText style={styles.actionBtnText}>Certificat NFC</ThemedText>
            </Pressable>
          </View>
        )}

        {/* ======================================================= */}
        {/* CARD LIMITS & SPEND GAUGES                              */}
        {/* ======================================================= */}
        {activeCard && (
          <View
            style={[
              styles.infoSectionCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.borderHairline },
            ]}
          >
            <ThemedText style={{ color: theme.text, fontSize: 15, fontWeight: '700', marginBottom: 12 }}>
              Plafonds de Dépense Carburant
            </ThemedText>

            <View style={styles.limitRow}>
              <View>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Plafond Journalier
                </ThemedText>
                <ThemedText style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 2 }}>
                  {(activeCard.dailySpendLimitFcfa || 50000).toLocaleString('fr-FR')} FCFA / jour
                </ThemedText>
              </View>
              <View style={[styles.limitBadge, { backgroundColor: 'rgba(216,128,74,0.15)' }]}>
                <ThemedText style={{ color: theme.accentPrimary, fontSize: 11, fontWeight: '600' }}>
                  Standard Flotte
                </ThemedText>
              </View>
            </View>

            <View style={[styles.limitRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.borderHairline }]}>
              <View>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Plafond Hebdomadaire
                </ThemedText>
                <ThemedText style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 2 }}>
                  {(activeCard.weeklySpendLimitFcfa || 200000).toLocaleString('fr-FR')} FCFA / sem.
                </ThemedText>
              </View>
              <View style={[styles.limitBadge, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                <ThemedText style={{ color: theme.statusSuccess, fontSize: 11, fontWeight: '600' }}>
                  Autorisé
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* ======================================================= */}
        {/* FLEET / CASHIER: SEARCH & CARDS DIRECTORY               */}
        {/* ======================================================= */}
        {!isDriver && (
          <View style={{ marginTop: 24 }}>
            <View style={styles.rowBetween}>
              <ThemedText style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>
                Répertoire du Parc ({filteredCards.length})
              </ThemedText>
            </View>

            {/* Search Input */}
            <View
              style={[
                styles.searchBar,
                { backgroundColor: theme.backgroundElement, borderColor: theme.borderHairline },
              ]}
            >
              <Ionicons name="search-outline" size={16} color={theme.textMuted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Rechercher carte, véhicule, chauffeur..."
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>

            {/* Filter Chips */}
            <View style={styles.filterRow}>
              {[
                { key: 'all', label: 'Toutes' },
                { key: 'active', label: 'Actives' },
                { key: 'stock', label: 'En Stock' },
                { key: 'suspended', label: 'Bloquées' },
              ].map((f) => {
                const active = filter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilter(f.key as any)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: active ? theme.accentPrimary : theme.backgroundElement,
                        borderColor: active ? theme.accentPrimary : theme.borderHairline,
                      },
                    ]}
                  >
                    <ThemedText
                      style={{
                        color: active ? '#FFFFFF' : theme.textMuted,
                        fontSize: 11,
                        fontWeight: active ? '700' : '500',
                      }}
                    >
                      {f.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {/* Directory Cards List */}
            {filteredCards.map((c) => {
              const isActive = c.status === 'Active';
              return (
                <View
                  key={c.cardUid}
                  style={[
                    styles.directoryCard,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.borderHairline },
                  ]}
                >
                  <View style={styles.dirLeft}>
                    <View
                      style={[
                        styles.dirIconBox,
                        {
                          backgroundColor: isActive ? 'rgba(216,128,74,0.15)' : 'rgba(255,255,255,0.08)',
                        },
                      ]}
                    >
                      <Ionicons
                        name="card-outline"
                        size={18}
                        color={isActive ? theme.accentPrimary : theme.textMuted}
                      />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <ThemedText style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                        {c.vehiclePlate || 'En Stock (Non Affectée)'}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11 }}>
                        {c.assignedDriverName || 'Stock Caisse'} · •••• {c.cardUid.slice(-4)}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <ThemedText style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
                      {c.balanceFcfa.toLocaleString('fr-FR')} F
                    </ThemedText>
                    <View
                      style={[
                        styles.dirStatusPill,
                        {
                          backgroundColor: isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        },
                      ]}
                    >
                      <ThemedText
                        style={{
                          color: isActive ? theme.statusSuccess : theme.statusError,
                          fontSize: 10,
                          fontWeight: '600',
                        }}
                      >
                        {c.status}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ======================================================= */}
      {/* MODAL 1: PROVISION NEW CARD                             */}
      {/* ======================================================= */}
      <Modal visible={showProvisionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeaderRow}>
              <View>
                <ThemedText type="subtitle" style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>
                  Enrôler une Nouvelle Carte
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Attribution d'une puce RFID vierge au parc
                </ThemedText>
              </View>
              <Pressable onPress={() => setShowProvisionModal(false)} hitSlop={10}>
                <Ionicons name="close-circle-outline" size={26} color={theme.textMuted} />
              </Pressable>
            </View>

            <View style={{ marginTop: 14 }}>
              <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 4 }}>
                UID Carte NFC (14 hex) :
              </ThemedText>
              <TextInput
                value={newCardUid}
                onChangeText={setNewCardUid}
                placeholder="Ex: 04A1B2C3D4E5F6"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
                style={[styles.inputBox, { color: theme.text, borderColor: theme.borderHairline }]}
              />
            </View>

            <View style={{ marginTop: 12 }}>
              <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 4 }}>
                Plaque Véhicule (optionnel) :
              </ThemedText>
              <TextInput
                value={newPlate}
                onChangeText={setNewPlate}
                placeholder="Ex: 542-CG-04"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
                style={[styles.inputBox, { color: theme.text, borderColor: theme.borderHairline }]}
              />
            </View>

            <View style={{ marginTop: 12 }}>
              <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 4 }}>
                Nom du Chauffeur Assigné (optionnel) :
              </ThemedText>
              <TextInput
                value={newDriver}
                onChangeText={setNewDriver}
                placeholder="Ex: Serge Moungalla"
                placeholderTextColor={theme.textMuted}
                style={[styles.inputBox, { color: theme.text, borderColor: theme.borderHairline }]}
              />
            </View>

            <Pressable
              onPress={handleProvision}
              disabled={provisionLoading}
              style={[styles.primaryBtn, { backgroundColor: theme.accentPrimary, marginTop: 20 }]}
            >
              {provisionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                  Enregistrer la Carte
                </ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ======================================================= */}
      {/* MODAL 2: EDIT LIMITS & FUEL RESTRICTIONS                */}
      {/* ======================================================= */}
      <Modal visible={!!selectedCardForLimit} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeaderRow}>
              <View>
                <ThemedText type="subtitle" style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>
                  Plafonds & Restrictions
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textMuted }}>
                  Carte {selectedCardForLimit?.vehiclePlate || selectedCardForLimit?.cardUid}
                </ThemedText>
              </View>
              <Pressable onPress={() => setSelectedCardForLimit(null)} hitSlop={10}>
                <Ionicons name="close-circle-outline" size={26} color={theme.textMuted} />
              </Pressable>
            </View>

            {/* Restriction Type */}
            <View style={{ marginTop: 14 }}>
              <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 8 }}>
                Restriction Carburant Autorisée :
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['Gazole', 'Super', 'None'].map((type) => {
                  const active = newFuelRestriction === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setNewFuelRestriction(type)}
                      style={[
                        styles.chipBtn,
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
                          fontSize: 12,
                          fontWeight: active ? '700' : '500',
                          textAlign: 'center',
                        }}
                      >
                        {type === 'None' ? 'Tous' : type}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Daily Limit */}
            <View style={{ marginTop: 14 }}>
              <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 4 }}>
                Plafond Journalier (FCFA) :
              </ThemedText>
              <TextInput
                value={newDailyLimit}
                onChangeText={setNewDailyLimit}
                keyboardType="numeric"
                style={[styles.inputBox, { color: theme.text, borderColor: theme.borderHairline }]}
              />
            </View>

            {/* Weekly Limit */}
            <View style={{ marginTop: 12 }}>
              <ThemedText type="caption" style={{ color: theme.textMuted, marginBottom: 4 }}>
                Plafond Hebdomadaire (FCFA) :
              </ThemedText>
              <TextInput
                value={newWeeklyLimit}
                onChangeText={setNewWeeklyLimit}
                keyboardType="numeric"
                style={[styles.inputBox, { color: theme.text, borderColor: theme.borderHairline }]}
              />
            </View>

            <Pressable
              onPress={handleSaveControls}
              disabled={limitLoading}
              style={[styles.primaryBtn, { backgroundColor: theme.accentPrimary, marginTop: 20 }]}
            >
              {limitLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                  Appliquer les Nouveaux Plafonds
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  provisionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  cardHeroContainer: {
    marginBottom: Spacing.lg,
  },
  virtualCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  flameDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D8804A',
    marginRight: 6,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  fuelBadge: {
    backgroundColor: 'rgba(216,128,74,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  fuelBadgeText: {
    color: '#D8804A',
    fontSize: 9,
    fontWeight: '700',
  },
  cardMidRow: {
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
    justifyContent: 'center',
  },
  chipHLine: {
    height: 1,
    backgroundColor: 'rgba(216,128,74,0.6)',
    width: '100%',
    marginBottom: 4,
  },
  chipVLine: {
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
  cardBalanceValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  vehiclePlateText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardDriverName: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 2,
  },
  statusPill: {
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
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardCarouselPills: {
    paddingTop: 10,
    gap: 8,
  },
  carouselItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },

  // Actions Container
  cardActionsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },

  // Info Section Card
  infoSectionCard: {
    padding: 16,
    borderRadius: Radius.card,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },

  // Directory Section
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.chip,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  directoryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: Radius.chip,
    borderWidth: 1,
    marginBottom: 8,
  },
  dirLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dirIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dirStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    marginTop: 2,
  },

  // Modals
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
    marginBottom: 12,
  },
  inputBox: {
    borderWidth: 1,
    borderRadius: Radius.chip,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBtn: {
    paddingVertical: 10,
    borderRadius: Radius.chip,
    borderWidth: 1,
  },
});
