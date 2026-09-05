import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Linking,
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
import { API_ENDPOINTS } from '@/constants/api';

interface StationItem {
  id: string;
  stationName: string;
  city: string;
  address: string;
  pumpCount: number;
  phone?: string;
  gazoleLevelPct?: number;
  superLevelPct?: number;
  distanceKm?: string;
}

const DEFAULT_STATIONS: StationItem[] = [
  {
    id: 'STN-BZV-01',
    stationName: "Afric' Station Poto-Poto",
    city: 'Brazzaville',
    address: 'Avenue de la Paix, Poto-Poto',
    pumpCount: 8,
    phone: '+242065000001',
    gazoleLevelPct: 92,
    superLevelPct: 88,
    distanceKm: '1.2 km',
  },
  {
    id: 'STN-BZV-02',
    stationName: "Afric' Station Bacongo",
    city: 'Brazzaville',
    address: 'Boulevard des Armées, Bacongo',
    pumpCount: 6,
    phone: '+242065000002',
    gazoleLevelPct: 85,
    superLevelPct: 79,
    distanceKm: '3.4 km',
  },
  {
    id: 'STN-BZV-03',
    stationName: "Afric' Station Moungali",
    city: 'Brazzaville',
    address: 'Rond-Point Moungali',
    pumpCount: 6,
    phone: '+242065000003',
    gazoleLevelPct: 70,
    superLevelPct: 94,
    distanceKm: '4.8 km',
  },
  {
    id: 'STN-PNR-01',
    stationName: "Afric' Station Zone Portuaire",
    city: 'Pointe-Noire',
    address: 'Boulevard Maritime, Port Autonome',
    pumpCount: 10,
    phone: '+242065000004',
    gazoleLevelPct: 96,
    superLevelPct: 90,
    distanceKm: 'Pointe-Noire',
  },
];

export default function StationsScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [stations, setStations] = useState<StationItem[]>(DEFAULT_STATIONS);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<'Tous' | 'Brazzaville' | 'Pointe-Noire'>('Tous');

  const loadStations = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.STATIONS);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setStations(
          data.map((s, idx) => ({
            ...s,
            phone: s.phone || `+24206500000${idx + 1}`,
            gazoleLevelPct: s.gazoleLevelPct || 85 + (idx % 12),
            superLevelPct: s.superLevelPct || 80 + (idx % 15),
            distanceKm: `${(idx * 1.5 + 1.2).toFixed(1)} km`,
          }))
        );
      }
    } catch {
      // Keep defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStations();
  }, []);

  const openNavigation = (station: StationItem) => {
    const query = encodeURIComponent(`${station.stationName}, ${station.city}, Congo`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  const callStation = (phone?: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const filteredStations = stations.filter((s) => {
    const matchesCity = cityFilter === 'Tous' || s.city.toLowerCase() === cityFilter.toLowerCase();
    const matchesSearch =
      searchQuery.trim() === '' ||
      s.stationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCity && matchesSearch;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11 }}>
            Réseau National & Points de Vente
          </ThemedText>
          <ThemedText type="display" style={{ color: theme.text, fontSize: 24, fontWeight: '700' }}>
            Stations Afric'
          </ThemedText>
        </View>

        {/* ======================================================= */}
        {/* LIVE FUEL PRICE TICKER CARD                            */}
        {/* ======================================================= */}
        <View
          style={[
            styles.priceBannerCard,
            { backgroundColor: '#161514', borderColor: 'rgba(216,128,74,0.3)' },
          ]}
        >
          <View style={styles.priceCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.pulseLiveDot} />
              <ThemedText style={styles.priceCardLabel}>PRIX OFFICIELS RÉGLEMENTÉS</ThemedText>
            </View>
            <ThemedText type="caption" style={{ color: '#22C55E', fontSize: 10, fontWeight: '700' }}>
              ● 100% APPROVISIONNÉ
            </ThemedText>
          </View>

          <View style={styles.priceItemsRow}>
            {/* Super Essence */}
            <View style={styles.priceItemBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <View style={[styles.fuelMiniDot, { backgroundColor: theme.accentPrimary }]} />
                <ThemedText style={styles.fuelTypeName}>Super (Essence)</ThemedText>
              </View>
              <ThemedText style={styles.fuelPriceVal}>775 F</ThemedText>
              <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
                Par Litre (FCFA)
              </ThemedText>
            </View>

            <View style={styles.priceDivider} />

            {/* Gazole Diesel */}
            <View style={styles.priceItemBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <View style={[styles.fuelMiniDot, { backgroundColor: '#3FA894' }]} />
                <ThemedText style={styles.fuelTypeName}>Gazole (Diesel)</ThemedText>
              </View>
              <ThemedText style={[styles.fuelPriceVal, { color: '#3FA894' }]}>650 F</ThemedText>
              <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
                Par Litre (FCFA)
              </ThemedText>
            </View>
          </View>
        </View>

        {/* ======================================================= */}
        {/* SEARCH & CITY FILTER PILLS                             */}
        {/* ======================================================= */}
        <View
          style={[
            styles.searchBox,
            { backgroundColor: theme.backgroundElement, borderColor: theme.borderHairline },
          ]}
        >
          <Ionicons name="search-outline" size={16} color={theme.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Trouver une station ou un quartier..."
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <View style={styles.cityPillRow}>
          {(['Tous', 'Brazzaville', 'Pointe-Noire'] as const).map((city) => {
            const active = cityFilter === city;
            return (
              <Pressable
                key={city}
                onPress={() => setCityFilter(city)}
                style={[
                  styles.cityChip,
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
                  {city}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* ======================================================= */}
        {/* STATIONS LIST WITH RICH CARDS                          */}
        {/* ======================================================= */}
        {loading ? (
          <ActivityIndicator size="large" color={theme.accentPrimary} style={{ marginTop: 40 }} />
        ) : filteredStations.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              { backgroundColor: theme.backgroundElement, borderColor: theme.borderHairline },
            ]}
          >
            <Ionicons name="location-outline" size={40} color={theme.textMuted} />
            <ThemedText style={{ color: theme.textMuted, fontSize: 13, marginTop: 8 }}>
              Aucune station trouvée pour cette recherche.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.stationsList}>
            {filteredStations.map((station) => (
              <View
                key={station.id}
                style={[
                  styles.stationCard,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.borderHairline },
                ]}
              >
                {/* Station Card Header */}
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <ThemedText style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
                      {station.stationName}
                    </ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                      <Ionicons name="location-sharp" size={13} color={theme.accentPrimary} />
                      <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 11, marginLeft: 3 }}>
                        {station.address} · {station.city}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.openBadge}>
                    <View style={styles.openDot} />
                    <ThemedText style={styles.openBadgeText}>Ouvert 24h</ThemedText>
                  </View>
                </View>

                {/* Tank Level Gauges */}
                <View style={[styles.tanksContainer, { backgroundColor: theme.background }]}>
                  {/* Gazole Tank */}
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 10 }}>
                        Cuve Gazole
                      </ThemedText>
                      <ThemedText style={{ color: '#3FA894', fontSize: 10, fontWeight: '700' }}>
                        {station.gazoleLevelPct}%
                      </ThemedText>
                    </View>
                    <View style={styles.tankTrack}>
                      <View
                        style={[
                          styles.tankFill,
                          { width: `${station.gazoleLevelPct ?? 80}%`, backgroundColor: '#3FA894' },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Super Tank */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <ThemedText type="caption" style={{ color: theme.textMuted, fontSize: 10 }}>
                        Cuve Super
                      </ThemedText>
                      <ThemedText style={{ color: theme.accentPrimary, fontSize: 10, fontWeight: '700' }}>
                        {station.superLevelPct}%
                      </ThemedText>
                    </View>
                    <View style={styles.tankTrack}>
                      <View
                        style={[
                          styles.tankFill,
                          { width: `${station.superLevelPct ?? 85}%`, backgroundColor: theme.accentPrimary },
                        ]}
                      />
                    </View>
                  </View>
                </View>

                {/* Services Tags */}
                <View style={styles.servicesRow}>
                  <View style={[styles.serviceChip, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                    <Ionicons name="speedometer-outline" size={11} color={theme.textMuted} style={{ marginRight: 4 }} />
                    <ThemedText style={{ color: theme.textMuted, fontSize: 10 }}>
                      {station.pumpCount} Pistolets SoftPOS
                    </ThemedText>
                  </View>
                  <View style={[styles.serviceChip, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                    <Ionicons name="radio-outline" size={11} color={theme.accentPrimary} style={{ marginRight: 4 }} />
                    <ThemedText style={{ color: theme.accentPrimary, fontSize: 10 }}>
                      NFC Contactless
                    </ThemedText>
                  </View>
                  <View style={[styles.serviceChip, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                    <Ionicons name="cash-outline" size={11} color="#22C55E" style={{ marginRight: 4 }} />
                    <ThemedText style={{ color: '#22C55E', fontSize: 10 }}>
                      Guichet Caisse
                    </ThemedText>
                  </View>
                </View>

                {/* Actions Row */}
                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => openNavigation(station)}
                    style={[styles.primaryActionBtn, { backgroundColor: theme.accentPrimary }]}
                  >
                    <Ionicons name="navigate-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                      Itinéraire GPS
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => callStation(station.phone)}
                    style={[
                      styles.secondaryActionBtn,
                      { borderColor: theme.borderHairline, backgroundColor: theme.background },
                    ]}
                  >
                    <Ionicons name="call-outline" size={15} color={theme.text} />
                  </Pressable>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: Spacing.lg,
  },
  priceBannerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  priceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  pulseLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D8804A',
    marginRight: 6,
  },
  priceCardLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  priceItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceItemBox: {
    flex: 1,
  },
  fuelMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  fuelTypeName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  fuelPriceVal: {
    color: '#D8804A',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  priceDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.chip,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  cityPillRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  stationsList: {
    gap: 12,
  },
  stationCard: {
    padding: 16,
    borderRadius: Radius.card,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    gap: 4,
  },
  openDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#22C55E',
  },
  openBadgeText: {
    color: '#22C55E',
    fontSize: 10,
    fontWeight: '700',
  },
  tanksContainer: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: Radius.chip,
    marginBottom: 12,
  },
  tankTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  tankFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  servicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.pill,
  },
  secondaryActionBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
  },
});
