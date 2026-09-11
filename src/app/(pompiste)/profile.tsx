import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
import { localDb, AttendantSalesMetrics } from '@/services/local-db';
import { syncOfflineLedger } from '@/services/sync-service';

export default function PompisteProfileScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [user, setUser] = useState<MobileUserSession | null>(mobileAuth.getUser());
  const [metrics, setMetrics] = useState<AttendantSalesMetrics | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const unsub = mobileAuth.subscribe((u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const attendantId = user?.userId || '55555555-5555-5555-5555-555555555555';
        const stationId = user?.stationId || '11111111-1111-1111-1111-111111111111';
        const [m, p] = await Promise.all([
          localDb.getAttendantSalesMetrics(attendantId, stationId),
          localDb.getPendingCount(),
        ]);
        setMetrics(m);
        setPendingCount(p);
      } catch {}
    };
    loadStats();
  }, [user]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncOfflineLedger();
      if (res.acceptedCount > 0) {
        Alert.alert('Succès', `${res.acceptedCount} transaction(s) téléversée(s).`);
      } else {
        Alert.alert('Information', 'Le terminal est déjà synchronisé avec le serveur central.');
      }
      const p = await localDb.getPendingCount();
      setPendingCount(p);
    } catch {
      Alert.alert('Hors-ligne', 'Serveur injoignable. Vos transactions restent enregistrées en sécurité.');
    } finally {
      setSyncing(false);
    }
  };


  const handleLogout = () => {
    Alert.alert(
      'Déconnexion du Terminal',
      'Voulez-vous fermer votre session pompiste sur ce terminal ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Fermer la session',
          style: 'destructive',
          onPress: () => {
            mobileAuth.logout();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={[styles.headerCaption, { color: theme.textSecondary }]}>
            Profil & Terminal Pompiste
          </ThemedText>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
            Mon Compte Pompiste
          </ThemedText>
        </View>

        {/* ======================================================= */}
        {/* OPERATOR IDENTITY CARD                                  */}
        {/* ======================================================= */}
        <View style={[styles.profileCard, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
          <View style={styles.profileRowTop}>
            <View style={[styles.avatarWrap, { backgroundColor: theme.accentTranslucent }]}>
              <Ionicons name="person" size={28} color={theme.accentPrimary} />
            </View>
            <View style={styles.profileInfo}>
              <ThemedText style={[styles.operatorName, { color: theme.text }]}>
                {user?.fullName || 'Jean-Paul Samba'}
              </ThemedText>
              <ThemedText style={[styles.roleBadge, { color: theme.accentPrimary }]}>
                Pompiste (Forecourt Operator)
              </ThemedText>
              <ThemedText style={[styles.operatorSub, { color: theme.textMuted }]}>
                {user?.phoneNumber || '+242060000003'}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: dark ? '#262422' : '#EFECE7' }]} />

          <View style={styles.stationDetailsGrid}>
            <View style={styles.stationDetailRow}>
              <Ionicons name="business-outline" size={16} color={theme.textMuted} />
              <ThemedText style={[styles.stationDetailText, { color: theme.textSecondary }]}>
                Afric' Station Poto-Poto (Brazzaville)
              </ThemedText>
            </View>
            <View style={styles.stationDetailRow}>
              <Ionicons name="hardware-chip-outline" size={16} color={theme.textMuted} />
              <ThemedText style={[styles.stationDetailText, { color: theme.textSecondary }]}>
                Terminal SoftPOS : POS-BZV-01 (Pompe #03)
              </ThemedText>
            </View>
          </View>
        </View>

        {/* ======================================================= */}
        {/* SHIFT PERFORMANCE METRICS                               */}
        {/* ======================================================= */}
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          Bilan de Quart Aujourd'hui
        </ThemedText>

        <View style={[styles.statsBox, { backgroundColor: dark ? '#161514' : theme.backgroundElement }]}>
          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <ThemedText style={[styles.statCellLabel, { color: theme.textMuted }]}>Total Vendu</ThemedText>
              <ThemedText style={[styles.statCellVal, { color: theme.accentPrimary }]}>
                {(metrics?.todayTotalFcfa || 0).toLocaleString('fr-FR')} FCFA
              </ThemedText>
            </View>

            <View style={styles.statCell}>
              <ThemedText style={[styles.statCellLabel, { color: theme.textMuted }]}>Carburant Pompé</ThemedText>
              <ThemedText style={[styles.statCellVal, { color: theme.text }]}>
                {(metrics?.todayLiters || 0).toFixed(1)} L
              </ThemedText>
            </View>
          </View>

          <View style={[styles.statsRow, { marginTop: Spacing.sm }]}>
            <View style={styles.statCell}>
              <ThemedText style={[styles.statCellLabel, { color: theme.textMuted }]}>Tickets Servis</ThemedText>
              <ThemedText style={[styles.statCellVal, { color: theme.text }]}>
                {metrics?.todayTxCount || 0}
              </ThemedText>
            </View>

            <View style={styles.statCell}>
              <ThemedText style={[styles.statCellLabel, { color: theme.textMuted }]}>File Hors-ligne</ThemedText>
              <ThemedText
                style={[
                  styles.statCellVal,
                  { color: pendingCount > 0 ? theme.statusWarning : theme.statusSuccess },
                ]}
              >
                {pendingCount > 0 ? `${pendingCount} en attente` : 'Synchronisé'}
              </ThemedText>
            </View>
          </View>

          {/* Sync Button */}
          <Pressable
            style={[styles.syncActionBtn, { backgroundColor: theme.accentTranslucent }]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={theme.accentPrimary} />
            ) : (
              <>
                <Ionicons name="sync" size={16} color={theme.accentPrimary} />
                <ThemedText style={[styles.syncActionBtnText, { color: theme.accentPrimary }]}>
                  Synchroniser la File Hors-ligne
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>

        {/* ======================================================= */}
        {/* LOGOUT BUTTON                                           */}
        {/* ======================================================= */}
        <Pressable
          style={[styles.logoutBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.statusError} />
          <ThemedText style={[styles.logoutBtnText, { color: theme.statusError }]}>
            Fermer la Session Terminal
          </ThemedText>
        </Pressable>
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
    paddingTop: Spacing.md,
  },
  header: {
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
  },
  profileCard: {
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  profileRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  operatorName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  roleBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  operatorSub: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  stationDetailsGrid: {
    gap: 6,
  },
  stationDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stationDetailText: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  statsBox: {
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCell: {
    flex: 1,
    padding: Spacing.sm,
  },
  statCellLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  statCellVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  syncActionBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.chip,
    marginTop: Spacing.sm,
  },
  syncActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  profilesList: {
    gap: 8,
    marginBottom: Spacing.lg,
  },
  profileSwitchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: 1.5,
  },
  roleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  roleInfo: {
    flex: 1,
  },
  roleTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  roleTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  roleSub: {
    fontSize: 11,
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.chip,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
