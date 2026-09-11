import React, { useState, useEffect } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL, API_ENDPOINTS } from '@/constants/api';

interface StationItem {
  id: string;
  stationName: string;
  city: string;
  address: string;
  pumpCount: number;
  createdAt?: string;
}

interface PosTerminalItem {
  id: string;
  deviceId: string;
  stationId: string;
  pumpNumber: string;
  status: string;
  lastActiveAt?: string;
}

export default function AdminStationsScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [stations, setStations] = useState<StationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<'Tous' | 'Brazzaville' | 'Pointe-Noire'>('Tous');

  // Add Station Modal
  const [showAddStationModal, setShowAddStationModal] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationCity, setNewStationCity] = useState('Brazzaville');
  const [newStationAddress, setNewStationAddress] = useState('');
  const [newStationPumps, setNewStationPumps] = useState('6');
  const [creatingStation, setCreatingStation] = useState(false);

  // Station Detail & Terminals Modal
  const [selectedStation, setSelectedStation] = useState<StationItem | null>(null);
  const [terminals, setTerminals] = useState<PosTerminalItem[]>([]);
  const [loadingTerminals, setLoadingTerminals] = useState(false);

  // Add Terminal Modal
  const [showAddTerminalModal, setShowAddTerminalModal] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newPumpNumber, setNewPumpNumber] = useState('01');
  const [registeringTerminal, setRegisteringTerminal] = useState(false);

  const loadStations = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.STATIONS);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setStations(data);
        }
      }
    } catch (err) {
      console.warn('Error loading stations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStations();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadStations();
  };

  const handleCreateStation = async () => {
    if (!newStationName.trim() || !newStationAddress.trim()) {
      Alert.alert('Champs requis', 'Veuillez renseigner le nom et l\'adresse de la station.');
      return;
    }

    setCreatingStation(true);
    try {
      const res = await fetch(API_ENDPOINTS.STATIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationName: newStationName.trim(),
          city: newStationCity,
          address: newStationAddress.trim(),
          pumpCount: parseInt(newStationPumps, 10) || 4,
        }),
      });

      if (res.ok) {
        Alert.alert('Succès', `La station "${newStationName.trim()}" a été créée.`);
        setNewStationName('');
        setNewStationAddress('');
        setShowAddStationModal(false);
        await loadStations();
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Erreur', err.error || 'Impossible de créer la station.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de joindre le serveur central.');
    } finally {
      setCreatingStation(false);
    }
  };

  const handleOpenStationDetail = async (station: StationItem) => {
    setSelectedStation(station);
    setLoadingTerminals(true);
    setTerminals([]);

    try {
      const res = await fetch(`${API_BASE_URL}/api/stations/${station.id}/terminals`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTerminals(data);
        }
      }
    } catch {
      console.warn('Error fetching station terminals');
    } finally {
      setLoadingTerminals(false);
    }
  };

  const handleRegisterTerminal = async () => {
    if (!selectedStation) return;
    if (!newDeviceId.trim()) {
      Alert.alert('Champs requis', 'Veuillez saisir l\'identifiant du terminal POS.');
      return;
    }

    setRegisteringTerminal(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/stations/${selectedStation.id}/terminals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: newDeviceId.trim().toUpperCase(),
          pumpNumber: newPumpNumber.trim() || '01',
        }),
      });

      if (res.ok) {
        Alert.alert('Succès', `Terminal ${newDeviceId.trim().toUpperCase()} enregistré avec succès.`);
        setNewDeviceId('');
        setShowAddTerminalModal(false);
        // Refresh terminals
        const tRes = await fetch(`${API_BASE_URL}/api/stations/${selectedStation.id}/terminals`);
        if (tRes.ok) {
          const tData = await tRes.json();
          if (Array.isArray(tData)) setTerminals(tData);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Erreur', err.error || 'Impossible d\'enregistrer le terminal.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de contacter le serveur.');
    } finally {
      setRegisteringTerminal(false);
    }
  };

  const filteredStations = stations.filter((s) => {
    if (cityFilter !== 'Tous' && s.city.toLowerCase() !== cityFilter.toLowerCase()) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.stationName.toLowerCase().includes(q) || s.address.toLowerCase().includes(q);
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
              Réseau de Distribution
            </ThemedText>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              Stations-Service & POS
            </ThemedText>
          </View>

          <Pressable
            onPress={() => setShowAddStationModal(true)}
            style={[styles.addBtn, { backgroundColor: theme.accentPrimary }]}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <ThemedText style={styles.addBtnText}>Nouvelle Station</ThemedText>
          </Pressable>
        </View>

        {/* Search & City Filter Bar */}
        <View style={styles.filterSection}>
          <View style={[styles.searchBox, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}>
            <Ionicons name="search" size={18} color={theme.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher par nom ou quartier..."
              placeholderTextColor={theme.textMuted}
              style={[styles.searchInput, { color: theme.text }]}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </Pressable>
            )}
          </View>

          <View style={styles.cityFilterRow}>
            {(['Tous', 'Brazzaville', 'Pointe-Noire'] as const).map((city) => (
              <Pressable
                key={city}
                onPress={() => setCityFilter(city)}
                style={[
                  styles.cityChip,
                  {
                    backgroundColor:
                      cityFilter === city
                        ? theme.accentPrimary
                        : dark
                        ? '#181615'
                        : theme.backgroundElement,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.cityChipText,
                    { color: cityFilter === city ? '#FFFFFF' : theme.textSecondary },
                  ]}
                >
                  {city}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Stations List */}
        {loading ? (
          <ActivityIndicator size="small" color={theme.accentPrimary} style={{ marginVertical: 30 }} />
        ) : filteredStations.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
            <Ionicons name="business-outline" size={36} color={theme.textMuted} />
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              Aucune station trouvée
            </ThemedText>
            <ThemedText style={[styles.emptySub, { color: theme.textMuted }]}>
              Appuyez sur "Nouvelle Station" pour enregistrer une agence dans le réseau.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.stationsList}>
            {filteredStations.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => handleOpenStationDetail(s)}
                style={({ pressed }) => [
                  styles.stationCard,
                  {
                    backgroundColor: dark ? '#161514' : theme.backgroundElement,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={styles.stationTopRow}>
                  <View style={[styles.stationIconWrap, { backgroundColor: theme.accentTranslucent }]}>
                    <Ionicons name="business" size={22} color={theme.accentPrimary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <ThemedText style={[styles.stationName, { color: theme.text }]}>
                      {s.stationName}
                    </ThemedText>
                    <ThemedText style={[styles.stationAddress, { color: theme.textMuted }]}>
                      {s.address} · {s.city}
                    </ThemedText>
                  </View>
                  <View style={[styles.pumpBadge, { backgroundColor: 'rgba(192, 106, 50, 0.12)' }]}>
                    <Ionicons name="water-outline" size={13} color={theme.accentPrimary} />
                    <ThemedText style={[styles.pumpBadgeText, { color: theme.accentPrimary }]}>
                      {s.pumpCount} pompes
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.stationFooter}>
                  <ThemedText style={[styles.footerDetailText, { color: theme.textSecondary }]}>
                    Gérer les terminaux SoftPOS & pompes
                  </ThemedText>
                  <Ionicons name="chevron-forward" size={16} color={theme.accentPrimary} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ======================================================= */}
      {/* MODAL: NOUVELLE STATION                                 */}
      {/* ======================================================= */}
      <Modal visible={showAddStationModal} transparent animationType="slide">
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
                Nouvelle Station-Service
              </ThemedText>
              <Pressable onPress={() => setShowAddStationModal(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </Pressable>
            </View>

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Nom de la station
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { backgroundColor: dark ? '#24211E' : '#F4EFEA', color: theme.text }]}
              placeholder="Ex: Afric' Station Mpila"
              placeholderTextColor={theme.textMuted}
              value={newStationName}
              onChangeText={setNewStationName}
            />

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Ville
            </ThemedText>
            <View style={styles.citySelectRow}>
              {['Brazzaville', 'Pointe-Noire', 'Dolisie'].map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setNewStationCity(c)}
                  style={[
                    styles.citySelectChip,
                    {
                      backgroundColor:
                        newStationCity === c
                          ? theme.accentPrimary
                          : dark
                          ? '#24211E'
                          : '#F4EFEA',
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: newStationCity === c ? '#FFFFFF' : theme.text,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {c}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Adresse / Quartier
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { backgroundColor: dark ? '#24211E' : '#F4EFEA', color: theme.text }]}
              placeholder="Ex: Boulevard des Armées, Rond-Point..."
              placeholderTextColor={theme.textMuted}
              value={newStationAddress}
              onChangeText={setNewStationAddress}
            />

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Nombre de pompes mécaniques
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { backgroundColor: dark ? '#24211E' : '#F4EFEA', color: theme.text }]}
              placeholder="6"
              placeholderTextColor={theme.textMuted}
              value={newStationPumps}
              onChangeText={setNewStationPumps}
              keyboardType="number-pad"
            />

            <Pressable
              onPress={handleCreateStation}
              disabled={creatingStation}
              style={[styles.submitBtn, { backgroundColor: theme.accentPrimary }]}
            >
              {creatingStation ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.submitBtnText}>Enregistrer la Station</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ======================================================= */}
      {/* MODAL: DETAIL STATION & GESTION TERMINAUX               */}
      {/* ======================================================= */}
      <Modal visible={!!selectedStation} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: dark ? '#1A1816' : '#FFFFFF',
                maxHeight: '85%',
                paddingBottom: Math.max(insets.bottom, 20) + 16,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                  {selectedStation?.stationName}
                </ThemedText>
                <ThemedText style={[styles.stationAddress, { color: theme.textMuted }]}>
                  {selectedStation?.address} · {selectedStation?.city}
                </ThemedText>
              </View>
              <Pressable onPress={() => setSelectedStation(null)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </Pressable>
            </View>

            {/* Station stats */}
            <View style={styles.detailStatsRow}>
              <View style={[styles.detailStatBox, { backgroundColor: dark ? '#24211E' : '#F4EFEA' }]}>
                <Ionicons name="water" size={18} color={theme.accentPrimary} />
                <ThemedText style={[styles.detailStatVal, { color: theme.text }]}>
                  {selectedStation?.pumpCount}
                </ThemedText>
                <ThemedText style={[styles.detailStatLbl, { color: theme.textMuted }]}>
                  Pompes
                </ThemedText>
              </View>

              <View style={[styles.detailStatBox, { backgroundColor: dark ? '#24211E' : '#F4EFEA' }]}>
                <Ionicons name="hardware-chip-outline" size={18} color={theme.statusSuccess} />
                <ThemedText style={[styles.detailStatVal, { color: theme.text }]}>
                  {terminals.length}
                </ThemedText>
                <ThemedText style={[styles.detailStatLbl, { color: theme.textMuted }]}>
                  Terminaux POS
                </ThemedText>
              </View>
            </View>

            {/* Terminals list */}
            <View style={styles.terminalsHeaderRow}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
                Terminaux Handheld Enregistrés
              </ThemedText>
              <Pressable
                onPress={() => setShowAddTerminalModal(true)}
                style={[styles.smallAddBtn, { backgroundColor: theme.accentTranslucent }]}
              >
                <Ionicons name="add" size={16} color={theme.accentPrimary} />
                <ThemedText style={{ color: theme.accentPrimary, fontSize: 11, fontWeight: '700' }}>
                  Ajouter POS
                </ThemedText>
              </Pressable>
            </View>

            {loadingTerminals ? (
              <ActivityIndicator size="small" color={theme.accentPrimary} style={{ marginVertical: 20 }} />
            ) : terminals.length === 0 ? (
              <View style={[styles.emptyTerminalBox, { backgroundColor: dark ? '#24211E' : '#F4EFEA' }]}>
                <ThemedText style={{ color: theme.textMuted, fontSize: 12 }}>
                  Aucun terminal POS affecté à cette station.
                </ThemedText>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                {terminals.map((t) => (
                  <View
                    key={t.id}
                    style={[
                      styles.terminalRow,
                      { backgroundColor: dark ? '#24211E' : '#F4EFEA' },
                    ]}
                  >
                    <Ionicons name="phone-portrait-outline" size={20} color={theme.accentPrimary} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <ThemedText style={[styles.terminalId, { color: theme.text }]}>
                        {t.deviceId}
                      </ThemedText>
                      <ThemedText style={{ color: theme.textMuted, fontSize: 11 }}>
                        Pompe affectée : #{t.pumpNumber}
                      </ThemedText>
                    </View>
                    <View style={[styles.activeTag, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                      <ThemedText style={{ color: theme.statusSuccess, fontSize: 10, fontWeight: '700' }}>
                        ACTIF
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ======================================================= */}
      {/* MODAL: ENREGISTRER TERMINAL POS                         */}
      {/* ======================================================= */}
      <Modal visible={showAddTerminalModal} transparent animationType="fade">
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
                Nouveau Terminal POS
              </ThemedText>
              <Pressable onPress={() => setShowAddTerminalModal(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </Pressable>
            </View>

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Identifiant Device ID / Numéro de Série
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { backgroundColor: dark ? '#24211E' : '#F4EFEA', color: theme.text }]}
              placeholder="Ex: POS-BZV-03"
              placeholderTextColor={theme.textMuted}
              value={newDeviceId}
              onChangeText={setNewDeviceId}
              autoCapitalize="characters"
            />

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Numéro de Pompe assigné
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { backgroundColor: dark ? '#24211E' : '#F4EFEA', color: theme.text }]}
              placeholder="01"
              placeholderTextColor={theme.textMuted}
              value={newPumpNumber}
              onChangeText={setNewPumpNumber}
              keyboardType="number-pad"
            />

            <Pressable
              onPress={handleRegisterTerminal}
              disabled={registeringTerminal}
              style={[styles.submitBtn, { backgroundColor: theme.accentPrimary }]}
            >
              {registeringTerminal ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.submitBtnText}>Enregistrer le Terminal</ThemedText>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.chip,
  },
  addBtnText: {
    color: '#FFFFFF',
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
  cityFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  cityChipText: {
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
  stationsList: {
    gap: 10,
  },
  stationCard: {
    borderRadius: Radius.chip,
    padding: Spacing.md,
  },
  stationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stationName: {
    fontSize: 15,
    fontWeight: '700',
  },
  stationAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  pumpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  pumpBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerDetailText: {
    fontSize: 11,
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
  modalInput: {
    height: 46,
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
  },
  citySelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  citySelectChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.chip,
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
  detailStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.md,
  },
  detailStatBox: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.chip,
    alignItems: 'center',
  },
  detailStatVal: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  detailStatLbl: {
    fontSize: 11,
    marginTop: 2,
  },
  terminalsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  smallAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.chip,
  },
  emptyTerminalBox: {
    padding: Spacing.md,
    borderRadius: Radius.chip,
    alignItems: 'center',
  },
  terminalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.chip,
    marginBottom: 6,
  },
  terminalId: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
});
