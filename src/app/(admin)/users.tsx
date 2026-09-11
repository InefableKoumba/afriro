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

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_ENDPOINTS } from '@/constants/api';

interface UserItem {
  id: string;
  phoneNumber: string;
  fullName: string;
  role: string;
  stationId?: string | null;
  companyId?: string | null;
  createdAt: string;
}

interface StationOption {
  id: string;
  stationName: string;
}

export default function AdminUsersScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [roleFilter, setRoleFilter] = useState<'All' | 'PumpAttendant' | 'StationCashier' | 'Admin'>('All');
  const [stationFilter, setStationFilter] = useState<string>('All');
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const [showStationSheet, setShowStationSheet] = useState(false);

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPhone, setNewPhone] = useState('+24206');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'PumpAttendant' | 'StationCashier' | 'Admin'>('PumpAttendant');
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [uRes, sRes] = await Promise.all([
        fetch(API_ENDPOINTS.USERS).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(API_ENDPOINTS.STATIONS).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);

      if (Array.isArray(uRes)) setUsers(uRes);
      if (Array.isArray(sRes)) {
        setStations(sRes.map((s: any) => ({ id: s.id, stationName: s.stationName })));
        if (sRes.length > 0 && !selectedStationId) {
          setSelectedStationId(sRes[0].id);
        }
      }
    } catch (err) {
      console.warn('Error loading users:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateUser = async () => {
    if (!newPhone.trim() || !newName.trim() || !newPassword.trim()) {
      Alert.alert('Champs requis', 'Veuillez renseigner le téléphone, le nom et le mot de passe.');
      return;
    }

    setCreating(true);
    try {
      const payload: any = {
        phoneNumber: newPhone.trim(),
        fullName: newName.trim(),
        password: newPassword.trim(),
        role: newRole,
      };

      if ((newRole === 'PumpAttendant' || newRole === 'StationCashier') && selectedStationId) {
        payload.stationId = selectedStationId;
      }

      const res = await fetch(API_ENDPOINTS.USERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        Alert.alert('Opérateur Créé', `Le compte ${newName.trim()} (${newRole}) a été créé avec succès.`);
        setNewPhone('+24206');
        setNewName('');
        setNewPassword('');
        setShowCreateModal(false);
        await loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Erreur', err.error || 'Échec de la création du compte.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de joindre le serveur central.');
    } finally {
      setCreating(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Admin':
        return { label: 'Direction / Admin', color: '#EF4444', icon: 'shield-checkmark' as const };
      case 'StationCashier':
        return { label: 'Guichet Caisse', color: theme.accentPrimary, icon: 'cash' as const };
      case 'PumpAttendant':
        return { label: 'Pompiste SoftPOS', color: theme.statusSuccess, icon: 'water' as const };
      default:
        return { label: role, color: theme.textMuted, icon: 'person' as const };
    }
  };

  const getRoleFilterLabel = () => {
    switch (roleFilter) {
      case 'PumpAttendant':
        return 'Rôle: Pompistes';
      case 'StationCashier':
        return 'Rôle: Caissières';
      case 'Admin':
        return 'Rôle: Admins';
      default:
        return 'Tous les rôles';
    }
  };

  const getStationFilterLabel = () => {
    if (stationFilter === 'All') return 'Toutes les stations';
    const match = stations.find((s) => s.id === stationFilter);
    return match ? `Station: ${match.stationName}` : 'Station: Toutes';
  };

  // Exclude clients and apply role, station and search queries
  const filteredUsers = users.filter((u) => {
    // 1. Exclude clients completely
    if (u.role === 'Client') return false;

    // 2. Role filter
    if (roleFilter !== 'All' && u.role !== roleFilter) return false;

    // 3. Station filter
    if (stationFilter !== 'All' && u.stationId !== stationFilter) return false;

    // 4. Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.fullName.toLowerCase().includes(q) || u.phoneNumber.includes(q);
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
              Personnel & Stations-Service
            </ThemedText>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              Équipes Opérateurs ({filteredUsers.length})
            </ThemedText>
          </View>

          <Pressable
            onPress={() => setShowCreateModal(true)}
            style={[styles.addBtn, { backgroundColor: theme.accentPrimary }]}
          >
            <Ionicons name="person-add" size={18} color="#FFFFFF" />
            <ThemedText style={styles.addBtnText}>Nouvel Opérateur</ThemedText>
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.filterSection}>
          <View style={[styles.searchBox, { backgroundColor: dark ? '#181615' : theme.backgroundElement }]}>
            <Ionicons name="search" size={18} color={theme.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher par nom ou téléphone..."
              placeholderTextColor={theme.textMuted}
              style={[styles.searchInput, { color: theme.text }]}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Filter Trigger Buttons for Bottom Sheets */}
          <View style={styles.filterBtnsRow}>
            <Pressable
              onPress={() => setShowRoleSheet(true)}
              style={[
                styles.filterTriggerBtn,
                {
                  backgroundColor: dark ? '#181615' : theme.backgroundElement,
                  borderColor: roleFilter !== 'All' ? theme.accentPrimary : dark ? '#24211E' : '#EFE8E1',
                },
              ]}
            >
              <View style={styles.filterBtnContent}>
                <Ionicons
                  name="shield-outline"
                  size={15}
                  color={roleFilter !== 'All' ? theme.accentPrimary : theme.textMuted}
                />
                <ThemedText
                  style={[
                    styles.filterBtnText,
                    { color: roleFilter !== 'All' ? theme.accentPrimary : theme.text },
                  ]}
                  numberOfLines={1}
                >
                  {getRoleFilterLabel()}
                </ThemedText>
              </View>
              <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => setShowStationSheet(true)}
              style={[
                styles.filterTriggerBtn,
                {
                  backgroundColor: dark ? '#181615' : theme.backgroundElement,
                  borderColor: stationFilter !== 'All' ? theme.accentPrimary : dark ? '#24211E' : '#EFE8E1',
                },
              ]}
            >
              <View style={styles.filterBtnContent}>
                <Ionicons
                  name="business-outline"
                  size={15}
                  color={stationFilter !== 'All' ? theme.accentPrimary : theme.textMuted}
                />
                <ThemedText
                  style={[
                    styles.filterBtnText,
                    { color: stationFilter !== 'All' ? theme.accentPrimary : theme.text },
                  ]}
                  numberOfLines={1}
                >
                  {getStationFilterLabel()}
                </ThemedText>
              </View>
              <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Users List */}
        {loading ? (
          <ActivityIndicator size="small" color={theme.accentPrimary} style={{ marginVertical: 30 }} />
        ) : filteredUsers.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
            <Ionicons name="people-outline" size={36} color={theme.textMuted} />
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              Aucun opérateur trouvé
            </ThemedText>
            <ThemedText style={[styles.emptySub, { color: theme.textMuted }]}>
              Aucun membre du personnel ne correspond aux critères de filtre sélectionnés.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.usersList}>
            {filteredUsers.map((u) => {
              const badge = getRoleBadge(u.role);
              const assignedStation = stations.find((s) => s.id === u.stationId);

              return (
                <View
                  key={u.id}
                  style={[
                    styles.userCard,
                    { backgroundColor: dark ? '#161514' : theme.backgroundElement },
                  ]}
                >
                  <View style={[styles.avatarWrap, { backgroundColor: badge.color + '18' }]}>
                    <Ionicons name={badge.icon} size={20} color={badge.color} />
                  </View>

                  <View style={styles.userMeta}>
                    <ThemedText style={[styles.userName, { color: theme.text }]}>
                      {u.fullName}
                    </ThemedText>
                    <ThemedText style={[styles.userPhone, { color: theme.textMuted }]}>
                      {u.phoneNumber}
                      {assignedStation ? ` · ${assignedStation.stationName}` : ''}
                    </ThemedText>
                  </View>

                  <View style={[styles.badgePill, { backgroundColor: badge.color + '18' }]}>
                    <ThemedText style={[styles.badgeText, { color: badge.color }]}>
                      {badge.label}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ======================================================= */}
      {/* BOTTOM SHEET 1: ROLE FILTER SELECTION                   */}
      {/* ======================================================= */}
      <Modal visible={showRoleSheet} transparent animationType="slide">
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
                Filtrer par Rôle Opérateur
              </ThemedText>
              <Pressable onPress={() => setShowRoleSheet(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </Pressable>
            </View>

            {[
              { key: 'All', label: 'Tous les rôles', icon: 'apps-outline' as const },
              { key: 'PumpAttendant', label: 'Pompistes SoftPOS', icon: 'water-outline' as const },
              { key: 'StationCashier', label: 'Caissières Guichet', icon: 'cash-outline' as const },
              { key: 'Admin', label: 'Direction & Admins', icon: 'shield-checkmark-outline' as const },
            ].map((item) => {
              const selected = roleFilter === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    setRoleFilter(item.key as any);
                    setShowRoleSheet(false);
                  }}
                  style={[
                    styles.bottomSheetItem,
                    {
                      backgroundColor: selected
                        ? theme.accentTranslucent
                        : dark
                        ? '#24211E'
                        : '#F6F2EE',
                    },
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={selected ? theme.accentPrimary : theme.textSecondary}
                  />
                  <ThemedText
                    style={{
                      flex: 1,
                      marginLeft: 12,
                      fontSize: 14,
                      fontWeight: selected ? '800' : '600',
                      color: selected ? theme.accentPrimary : theme.text,
                    }}
                  >
                    {item.label}
                  </ThemedText>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={theme.accentPrimary} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* ======================================================= */}
      {/* BOTTOM SHEET 2: STATION FILTER SELECTION                */}
      {/* ======================================================= */}
      <Modal visible={showStationSheet} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: dark ? '#1A1816' : '#FFFFFF',
                maxHeight: '80%',
                paddingBottom: Math.max(insets.bottom, 20) + 16,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                Filtrer par Station Affectée
              </ThemedText>
              <Pressable onPress={() => setShowStationSheet(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* All Stations Option */}
              <Pressable
                onPress={() => {
                  setStationFilter('All');
                  setShowStationSheet(false);
                }}
                style={[
                  styles.bottomSheetItem,
                  {
                    backgroundColor:
                      stationFilter === 'All'
                        ? theme.accentTranslucent
                        : dark
                        ? '#24211E'
                        : '#F6F2EE',
                  },
                ]}
              >
                <Ionicons
                  name="business-outline"
                  size={20}
                  color={stationFilter === 'All' ? theme.accentPrimary : theme.textSecondary}
                />
                <ThemedText
                  style={{
                    flex: 1,
                    marginLeft: 12,
                    fontSize: 14,
                    fontWeight: stationFilter === 'All' ? '800' : '600',
                    color: stationFilter === 'All' ? theme.accentPrimary : theme.text,
                  }}
                >
                  Toutes les stations-service
                </ThemedText>
                {stationFilter === 'All' && (
                  <Ionicons name="checkmark-circle" size={20} color={theme.accentPrimary} />
                )}
              </Pressable>

              {/* Station List */}
              {stations.map((st) => {
                const selected = stationFilter === st.id;
                return (
                  <Pressable
                    key={st.id}
                    onPress={() => {
                      setStationFilter(st.id);
                      setShowStationSheet(false);
                    }}
                    style={[
                      styles.bottomSheetItem,
                      {
                        backgroundColor: selected
                          ? theme.accentTranslucent
                          : dark
                          ? '#24211E'
                          : '#F6F2EE',
                      },
                    ]}
                  >
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color={selected ? theme.accentPrimary : theme.textSecondary}
                    />
                    <ThemedText
                      style={{
                        flex: 1,
                        marginLeft: 12,
                        fontSize: 14,
                        fontWeight: selected ? '800' : '600',
                        color: selected ? theme.accentPrimary : theme.text,
                      }}
                    >
                      {st.stationName}
                    </ThemedText>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.accentPrimary} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======================================================= */}
      {/* MODAL: NOUVEAU COMPTE UTILISATEUR                       */}
      {/* ======================================================= */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: dark ? '#1A1816' : '#FFFFFF',
                maxHeight: '90%',
                paddingBottom: Math.max(insets.bottom, 20) + 16,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                Créer un Compte Opérateur
              </ThemedText>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </Pressable>
            </View>

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Numéro de Téléphone (Identifiant POS)
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { backgroundColor: dark ? '#24211E' : '#F4EFEA', color: theme.text }]}
              placeholder="+24206XXXXXXX"
              placeholderTextColor={theme.textMuted}
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
            />

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Nom Complet du Collaborateur
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { backgroundColor: dark ? '#24211E' : '#F4EFEA', color: theme.text }]}
              placeholder="Ex: Christian Okamba"
              placeholderTextColor={theme.textMuted}
              value={newName}
              onChangeText={setNewName}
            />

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Mot de Passe Initial
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { backgroundColor: dark ? '#24211E' : '#F4EFEA', color: theme.text }]}
              placeholder="••••••••••••"
              placeholderTextColor={theme.textMuted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Rôle Opérateur
            </ThemedText>
            <View style={styles.rolePickerRow}>
              {[
                { id: 'PumpAttendant', label: 'Pompiste' },
                { id: 'StationCashier', label: 'Caissière' },
                { id: 'Admin', label: 'Admin' },
              ].map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setNewRole(r.id as any)}
                  style={[
                    styles.rolePickChip,
                    {
                      backgroundColor:
                        newRole === r.id ? theme.accentPrimary : dark ? '#24211E' : '#F4EFEA',
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: newRole === r.id ? '#FFFFFF' : theme.text,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {r.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Station selector for station staff */}
            {(newRole === 'PumpAttendant' || newRole === 'StationCashier') && (
              <>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Station Affectée
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                  {stations.map((st) => (
                    <Pressable
                      key={st.id}
                      onPress={() => setSelectedStationId(st.id)}
                      style={[
                        styles.stationSelectChip,
                        {
                          backgroundColor:
                            selectedStationId === st.id
                              ? theme.accentPrimary
                              : dark
                              ? '#24211E'
                              : '#F4EFEA',
                        },
                      ]}
                    >
                      <ThemedText
                        style={{
                          color: selectedStationId === st.id ? '#FFFFFF' : theme.text,
                          fontSize: 12,
                          fontWeight: '600',
                        }}
                      >
                        {st.stationName}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            <Pressable
              onPress={handleCreateUser}
              disabled={creating}
              style={[styles.submitBtn, { backgroundColor: theme.accentPrimary }]}
            >
              {creating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.submitBtnText}>Enregistrer le Compte</ThemedText>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  filterSection: {
    marginBottom: Spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: Radius.chip,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  filterBtnsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  filterTriggerBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  filterBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '700',
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
  usersList: {
    gap: 10,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.chip,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMeta: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
  },
  userPhone: {
    fontSize: 12,
    marginTop: 2,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
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
  bottomSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: Radius.md,
    marginBottom: 8,
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
  rolePickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  rolePickChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.chip,
  },
  stationSelectChip: {
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
});
