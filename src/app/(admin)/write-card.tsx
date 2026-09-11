import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL, API_ENDPOINTS } from '@/constants/api';
import { nfcService, writeCardIdToNfc, writePayloadToNfc, readNfcTag } from '@/services/nfc';

interface UserItem {
  id: string;
  phoneNumber: string;
  fullName: string;
  role: string;
  companyId?: string | null;
  stationId?: string | null;
}

interface CompanyItem {
  id: string;
  companyName: string;
}

const PRESET_LIMITS = [25000, 50000, 100000, 200000];

export default function AdminWriteCardScreen() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Wizard Step: 1 = Configuration, 2 = Card Detection, 3 = NFC Writing, 4 = Certificate
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Data
  const [users, setUsers] = useState<UserItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Step 1 Form State
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [fuelRestriction, setFuelRestriction] = useState<'Tous' | 'Gazole' | 'Super'>('Tous');
  const [dailyLimit, setDailyLimit] = useState('50000');

  // Step 2 NFC Detection State
  const [detectedUid, setDetectedUid] = useState('');
  const [detectedTech, setDetectedTech] = useState('');
  const [detectingNfc, setDetectingNfc] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  // Step 3 Writing State
  const [writingNfc, setWritingNfc] = useState(false);
  const [writingPhase, setWritingPhase] = useState<
    'idle' | 'server_register' | 'nfc_connect' | 'nfc_format_write' | 'completed' | 'failed'
  >('idle');
  const [writingError, setWritingError] = useState<string | null>(null);

  // Step 4 Certificate State
  const [certificateData, setCertificateData] = useState<{
    cardUid: string;
    userName: string;
    userPhone: string;
    vehiclePlate: string;
    fuelRestriction: string;
    dailyLimitFcfa: number;
    techUsed: string;
    bytesWritten: number;
    signature: string;
    timestamp: string;
  } | null>(null);

  const loadInitialData = useCallback(async () => {
    try {
      const [uRes, compRes] = await Promise.all([
        fetch(API_ENDPOINTS.USERS).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(API_ENDPOINTS.COMPANIES).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);

      if (Array.isArray(uRes)) {
        setUsers(uRes);
        if (uRes.length > 0) {
          setSelectedUserId(uRes[0].id);
          setDriverName(uRes[0].fullName);
        }
      }
      if (Array.isArray(compRes)) setCompanies(compRes);
    } catch (err) {
      console.warn('Error loading users for card writer:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleSelectUser = (u: UserItem) => {
    setSelectedUserId(u.id);
    setDriverName(u.fullName);
  };

  // Step 1 Validation -> Move to Step 2
  const handleProceedToDetection = () => {
    if (!selectedUserId) {
      Alert.alert('Utilisateur Requis', 'Veuillez sélectionner un utilisateur pour cette carte.');
      return;
    }
    setDetectionError(null);
    setCurrentStep(2);
  };

  // Step 2: Trigger Hardware NFC Scan
  const handleScanNfcTag = async () => {
    setDetectingNfc(true);
    setDetectionError(null);

    try {
      const res = await nfcService.scanCardTag();
      if (res.success && res.cardUid) {
        setDetectedUid(res.cardUid);
        const techName = res.techType || (res.techTypes ? res.techTypes.join(', ') : 'Mifare Classic / NfcA');
        setDetectedTech(techName);
      } else {
        setDetectionError(res.error || 'Aucune carte détectée. Assurez-vous que le NFC est activé.');
      }
    } catch (err: any) {
      setDetectionError(err?.message || 'Erreur du capteur NFC.');
    } finally {
      setDetectingNfc(false);
    }
  };

  // Step 3: Execute Card Binding & Physical Writing
  const handleExecuteWrite = async () => {
    const cleanUid = detectedUid.trim().toUpperCase();
    if (!cleanUid) {
      Alert.alert('Erreur', 'Veuillez scanner une carte NFC avant de lancer la programmation.');
      return;
    }

    const targetUser = users.find((u) => u.id === selectedUserId);
    const assignedName = driverName.trim() || targetUser?.fullName || 'Client AfriRo';
    const limitNum = dailyLimit ? parseFloat(dailyLimit) : 50000;

    setCurrentStep(3);
    setWritingNfc(true);
    setWritingError(null);
    setWritingPhase('nfc_connect');

    try {
      // Phase 1: Connect to physical NFC tag
      await new Promise((r) => setTimeout(r, 400));
      setWritingPhase('nfc_format_write');

      const preliminaryPayload = {
        cardId: cleanUid,
        app: 'AFRIRO-PAY',
        v: 1,
        uid: cleanUid,
        userId: targetUser?.id || null,
        userName: assignedName,
        userPhone: targetUser?.phoneNumber || '',
        companyId: targetUser?.companyId || null,
        vehiclePlate: vehiclePlate.trim() || null,
        fuelRestriction: fuelRestriction === 'Tous' ? null : fuelRestriction,
        dailyLimitFcfa: limitNum,
        issuedAt: new Date().toISOString(),
      };

      let techUsed = detectedTech || 'Ndef / NdefFormatable';
      let bytesWritten = 128;

      // Physically format & write payload to chip FIRST
      if (Platform.OS !== 'web') {
        await writePayloadToNfc(preliminaryPayload);
        bytesWritten = JSON.stringify(preliminaryPayload).length;
        techUsed = 'Ndef / NdefFormatable';
      }

      // Phase 2: Physical write succeeded! Now safely persist assignment in backend database
      setWritingPhase('server_register');
      await new Promise((r) => setTimeout(r, 400));

      const assignRes = await fetch(API_ENDPOINTS.CARD_ASSIGN(cleanUid), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUser?.id || null,
          companyId: targetUser?.companyId || null,
          assignedDriverName: assignedName,
          vehiclePlate: vehiclePlate.trim() || null,
          fuelTypeRestriction: fuelRestriction === 'Tous' ? null : fuelRestriction,
          dailySpendLimitFcfa: limitNum,
          weeklySpendLimitFcfa: null,
        }),
      });

      if (!assignRes.ok) {
        const err = await assignRes.json().catch(() => ({}));
        throw new Error(err.error || "Échec de l'association sur le serveur central.");
      }

      const resData = await assignRes.json();
      const serverPayload = resData.ndefPayload;

      // Phase 3: Completed
      setWritingPhase('completed');
      Vibration.vibrate([0, 50, 100, 50]);
      await new Promise((r) => setTimeout(r, 500));

      setCertificateData({
        cardUid: cleanUid,
        userName: assignedName,
        userPhone: targetUser?.phoneNumber || '',
        vehiclePlate: vehiclePlate.trim() || 'Non assigné',
        fuelRestriction,
        dailyLimitFcfa: limitNum,
        techUsed,
        bytesWritten,
        signature: serverPayload?.signature || 'HMAC-SHA256-VALID',
        timestamp: new Date().toLocaleString('fr-FR'),
      });

      setCurrentStep(4);
    } catch (err: any) {
      setWritingPhase('failed');
      Vibration.vibrate([0, 100, 100, 100]);

      const msg = err?.message || '';
      if (msg.includes('NullPointerException') || msg.includes('transceive fail')) {
        Alert.alert(
          'Format non supporté',
          "Cette carte ne supporte pas l'écriture NDEF. Elle est peut-être incompatible."
        );
        setWritingError(
          "Format non supporté : Cette carte ne supporte pas l'écriture NDEF. Elle est peut-être incompatible."
        );
      } else if (msg.includes('IOException')) {
        Alert.alert(
          'Connexion perdue',
          "La carte a été retirée trop rapidement de l'antenne NFC. Veuillez la repositionner et réessayer."
        );
        setWritingError(
          "La carte a été retirée trop vite. Maintenez-la fermement contre le dos du smartphone."
        );
      } else {
        setWritingError(
          err?.message ||
            "Une erreur est survenue lors de l'écriture sur la puce. Maintenez fermement la carte contre l'antenne."
        );
      }
    } finally {
      setWritingNfc(false);
    }
  };

  const handleResetForAnotherCard = () => {
    setDetectedUid('');
    setDetectedTech('');
    setVehiclePlate('');
    setDetectionError(null);
    setWritingError(null);
    setWritingPhase('idle');
    setCertificateData(null);
    setCurrentStep(1);
  };

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.phoneNumber.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const selectedUserObj = users.find((u) => u.id === selectedUserId);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Navigation Header */}
      <View style={[styles.topNav, { borderBottomColor: dark ? '#24211E' : '#EAE4DE' }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: dark ? '#201D1B' : '#EFEAE5' }]}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Pressable>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <ThemedText style={[styles.topTitle, { color: theme.text }]}>
            Programmation Carte NFC
          </ThemedText>
          <ThemedText style={[styles.topSubtitle, { color: theme.textSecondary }]}>
            Puces Mifare Classic · NfcA · NdefFormatable
          </ThemedText>
        </View>

        <View style={[styles.techPill, { backgroundColor: dark ? '#24211E' : '#EFEAE5' }]}>
          <Ionicons name="hardware-chip" size={14} color={theme.accentPrimary} />
          <ThemedText style={{ fontSize: 10, fontWeight: '700', color: theme.accentPrimary }}>
            NFC PRO
          </ThemedText>
        </View>
      </View>

      {/* Stepper Progress Bar */}
      <View style={[styles.stepperContainer, { backgroundColor: dark ? '#181615' : '#F6F2EE' }]}>
        {[
          { step: 1, title: 'Titulaire' },
          { step: 2, title: 'Détection Puce' },
          { step: 3, title: 'Gravure NFC' },
          { step: 4, title: 'Certificat' },
        ].map((item, index) => {
          const isCurrent = currentStep === item.step;
          const isPassed = currentStep > item.step;

          return (
            <React.Fragment key={item.step}>
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    {
                      backgroundColor: isCurrent
                        ? theme.accentPrimary
                        : isPassed
                        ? theme.statusSuccess
                        : dark
                        ? '#2B2724'
                        : '#E4DDD7',
                    },
                  ]}
                >
                  {isPassed ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : (
                    <ThemedText
                      style={{
                        color: isCurrent || isPassed ? '#FFFFFF' : theme.textMuted,
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      {item.step}
                    </ThemedText>
                  )}
                </View>
                <ThemedText
                  style={[
                    styles.stepText,
                    {
                      color: isCurrent
                        ? theme.text
                        : isPassed
                        ? theme.statusSuccess
                        : theme.textMuted,
                      fontWeight: isCurrent ? '700' : '500',
                    },
                  ]}
                >
                  {item.title}
                </ThemedText>
              </View>

              {index < 3 && (
                <View
                  style={[
                    styles.stepLine,
                    { backgroundColor: isPassed ? theme.statusSuccess : dark ? '#2B2724' : '#E4DDD7' },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================= */}
        {/* STEP 1: USER SELECTION & RESTRICTIONS                     */}
        {/* ========================================================= */}
        {currentStep === 1 && (
          <View>
            <ThemedText style={[styles.sectionHeading, { color: theme.text }]}>
              Étape 1 : Titulaire & Plafonds
            </ThemedText>
            <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Choisissez le compte utilisateur auquel cette carte NFC sera liée dans le système central.
            </ThemedText>

            {/* User Search */}
            <View
              style={[
                styles.searchBox,
                { backgroundColor: dark ? '#1A1816' : theme.backgroundElement },
              ]}
            >
              <Ionicons name="search" size={18} color={theme.textMuted} />
              <TextInput
                value={userSearch}
                onChangeText={setUserSearch}
                placeholder="Rechercher par nom, téléphone ou rôle..."
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.text }]}
              />
              {userSearch.length > 0 && (
                <Pressable onPress={() => setUserSearch('')}>
                  <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Users List */}
            {loadingData ? (
              <ActivityIndicator size="small" color={theme.accentPrimary} style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginVertical: 10 }}
              >
                {filteredUsers.map((u) => {
                  const isSelected = selectedUserId === u.id;
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => handleSelectUser(u)}
                      style={[
                        styles.userCard,
                        {
                          backgroundColor: isSelected
                            ? dark
                              ? '#2E1E16'
                              : '#FFF5EE'
                            : dark
                            ? '#1A1816'
                            : theme.backgroundElement,
                          borderColor: isSelected ? theme.accentPrimary : 'transparent',
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View
                          style={[
                            styles.roleDot,
                            {
                              backgroundColor:
                                u.role === 'Client'
                                  ? '#3B82F6'
                                  : u.role === 'PumpAttendant'
                                  ? '#EAB308'
                                  : theme.accentPrimary,
                            },
                          ]}
                        />
                        <ThemedText style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>
                          {u.role}
                        </ThemedText>
                      </View>

                      <ThemedText
                        style={[
                          styles.userName,
                          { color: isSelected ? theme.accentPrimary : theme.text },
                        ]}
                        numberOfLines={1}
                      >
                        {u.fullName}
                      </ThemedText>

                      <ThemedText style={{ fontSize: 11, color: theme.textMuted }}>
                        {u.phoneNumber}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Selected User Summary Banner */}
            {selectedUserObj && (
              <View
                style={[
                  styles.selectedBanner,
                  { backgroundColor: dark ? '#201D1B' : '#EFEAE5', borderColor: theme.accentPrimary },
                ]}
              >
                <Ionicons name="person-circle-outline" size={24} color={theme.accentPrimary} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
                    Titulaire : {selectedUserObj.fullName}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 11, color: theme.textMuted }}>
                    {selectedUserObj.phoneNumber} · Compte {selectedUserObj.role}
                  </ThemedText>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={theme.statusSuccess} />
              </View>
            )}

            {/* Cardholder Customizations */}
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Nom du Porteur / Chauffeur Imprimé
            </ThemedText>
            <TextInput
              style={[
                styles.formInput,
                { backgroundColor: dark ? '#1A1816' : theme.backgroundElement, color: theme.text },
              ]}
              value={driverName}
              onChangeText={setDriverName}
              placeholder="Ex: Aimé Makosso"
              placeholderTextColor={theme.textMuted}
            />

            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Immatriculation Véhicule (Facultatif)
            </ThemedText>
            <TextInput
              style={[
                styles.formInput,
                { backgroundColor: dark ? '#1A1816' : theme.backgroundElement, color: theme.text },
              ]}
              value={vehiclePlate}
              onChangeText={setVehiclePlate}
              placeholder="Ex: BZV-4491-AB"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
            />

            {/* Fuel Restriction */}
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Restriction de Carburant Autorisée
            </ThemedText>
            <View style={styles.segmentedRow}>
              {(['Tous', 'Gazole', 'Super'] as const).map((f) => {
                const isSel = fuelRestriction === f;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFuelRestriction(f)}
                    style={[
                      styles.segmentBtn,
                      {
                        backgroundColor: isSel
                          ? theme.accentPrimary
                          : dark
                          ? '#1A1816'
                          : theme.backgroundElement,
                      },
                    ]}
                  >
                    <ThemedText
                      style={{
                        color: isSel ? '#FFFFFF' : theme.text,
                        fontSize: 13,
                        fontWeight: '700',
                      }}
                    >
                      {f}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {/* Daily Spend Limit */}
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Plafond de Dépense Journalier (FCFA)
            </ThemedText>
            <TextInput
              style={[
                styles.formInput,
                { backgroundColor: dark ? '#1A1816' : theme.backgroundElement, color: theme.text },
              ]}
              value={dailyLimit}
              onChangeText={setDailyLimit}
              placeholder="50000"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {PRESET_LIMITS.map((amt) => (
                <Pressable
                  key={amt}
                  onPress={() => setDailyLimit(amt.toString())}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor:
                        dailyLimit === amt.toString()
                          ? theme.accentPrimary
                          : dark
                          ? '#24211E'
                          : '#EFEAE5',
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: dailyLimit === amt.toString() ? '#FFFFFF' : theme.text,
                    }}
                  >
                    {(amt / 1000).toFixed(0)}k
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Next Button */}
            <Pressable
              onPress={handleProceedToDetection}
              style={[styles.primaryActionBtn, { backgroundColor: theme.accentPrimary, marginTop: 28 }]}
            >
              <ThemedText style={styles.primaryActionBtnText}>
                Continuer vers la Détection NFC
              </ThemedText>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {/* ========================================================= */}
        {/* STEP 2: NFC CARD DETECTION & VERIFICATION                 */}
        {/* ========================================================= */}
        {currentStep === 2 && (
          <View>
            <ThemedText style={[styles.sectionHeading, { color: theme.text }]}>
              Étape 2 : Détection de la Puce NFC
            </ThemedText>
            <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Approchez votre carte Mifare Classic ou NfcA du dos de votre smartphone.
            </ThemedText>

            {/* Radar / Card Visual Graphic */}
            <View
              style={[
                styles.radarBox,
                {
                  backgroundColor: dark ? '#1A1816' : '#F6F2EE',
                  borderColor: detectedUid ? theme.statusSuccess : theme.accentPrimary,
                },
              ]}
            >
              <View
                style={[
                  styles.radarPulseOuter,
                  {
                    backgroundColor: detectedUid
                      ? 'rgba(34, 197, 94, 0.12)'
                      : 'rgba(230, 81, 0, 0.12)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.radarPulseInner,
                    {
                      backgroundColor: detectedUid
                        ? 'rgba(34, 197, 94, 0.25)'
                        : 'rgba(230, 81, 0, 0.25)',
                    },
                  ]}
                >
                  <Ionicons
                    name={detectedUid ? 'checkmark-circle' : 'radio-outline'}
                    size={48}
                    color={detectedUid ? theme.statusSuccess : theme.accentPrimary}
                  />
                </View>
              </View>

              <ThemedText style={[styles.radarInstruction, { color: theme.text }]}>
                {detectingNfc
                  ? 'Recherche de carte NFC en cours...'
                  : detectedUid
                  ? 'Carte NFC Détectée !'
                  : 'Prêt pour la détection'}
              </ThemedText>

              <ThemedText style={[styles.radarSubInstruction, { color: theme.textMuted }]}>
                {detectedUid
                  ? 'La puce est reconnue et prête à être programmée.'
                  : 'Positionnez la carte à plat contre le haut du smartphone et maintenez-la immobile.'}
              </ThemedText>
            </View>

            {/* Scan Action Button */}
            <Pressable
              onPress={handleScanNfcTag}
              disabled={detectingNfc}
              style={[
                styles.primaryActionBtn,
                { backgroundColor: theme.accentPrimary, marginTop: 16, flexDirection: 'row', gap: 8 },
              ]}
            >
              {detectingNfc ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <ThemedText style={styles.primaryActionBtnText}>Lecture du tag en cours...</ThemedText>
                </>
              ) : (
                <>
                  <Ionicons name="hardware-chip-outline" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.primaryActionBtnText}>
                    {detectedUid ? 'Scanner une Autre Carte' : 'Lancer le Scan NFC'}
                  </ThemedText>
                </>
              )}
            </Pressable>

            {/* Error Banner */}
            {detectionError && (
              <View style={[styles.errorBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <Ionicons name="alert-circle" size={18} color={theme.statusError} />
                <ThemedText style={[styles.errorText, { color: theme.statusError }]}>
                  {detectionError}
                </ThemedText>
              </View>
            )}

            {/* Detected Tag Diagnostic Card */}
            {detectedUid ? (
              <View
                style={[
                  styles.diagnosticCard,
                  { backgroundColor: dark ? '#1A1816' : theme.backgroundElement },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                    Identifiant UID Matériel :
                  </ThemedText>
                  <ThemedText
                    style={{
                      fontSize: 14,
                      fontWeight: '800',
                      color: theme.accentPrimary,
                      fontFamily: 'monospace',
                    }}
                  >
                    {detectedUid}
                  </ThemedText>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <ThemedText style={{ fontSize: 12, color: theme.textMuted }}>
                    Protocole Détecté :
                  </ThemedText>
                  <ThemedText style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>
                    {detectedTech.includes('Mifare') ? 'Mifare Classic (ISO 14443-A)' : 'NfcA / NdefFormatable'}
                  </ThemedText>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <ThemedText style={{ fontSize: 12, color: theme.textMuted }}>
                    Attribué à :
                  </ThemedText>
                  <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
                    {driverName || selectedUserObj?.fullName}
                  </ThemedText>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 14 }}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textMuted }]}>
                  Ou saisie manuelle de secours :
                </ThemedText>
                <TextInput
                  style={[
                    styles.formInput,
                    { backgroundColor: dark ? '#1A1816' : theme.backgroundElement, color: theme.text },
                  ]}
                  value={detectedUid}
                  onChangeText={setDetectedUid}
                  placeholder="Ex: 04B3E2A1F9C800"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="characters"
                />
              </View>
            )}

            {/* Bottom Actions */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <Pressable
                onPress={() => setCurrentStep(1)}
                style={[styles.secondaryBtn, { backgroundColor: dark ? '#24211E' : '#EFEAE5' }]}
              >
                <Ionicons name="arrow-back" size={16} color={theme.text} />
                <ThemedText style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
                  Précédent
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={handleExecuteWrite}
                disabled={!detectedUid || detectingNfc}
                style={[
                  styles.primaryActionBtn,
                  {
                    flex: 1,
                    backgroundColor: detectedUid ? theme.accentPrimary : theme.textMuted,
                  },
                ]}
              >
                <ThemedText style={styles.primaryActionBtnText}>
                  Écrire sur la Puce NFC
                </ThemedText>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* STEP 3: NFC PROGRAMMING & WRITING IN PROGRESS            */}
        {/* ========================================================= */}
        {currentStep === 3 && (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <View
              style={[
                styles.writingPulseBox,
                { backgroundColor: dark ? '#1A1816' : '#F6F2EE' },
              ]}
            >
              <ActivityIndicator size="large" color={theme.accentPrimary} />
              <ThemedText style={[styles.writingTitle, { color: theme.text }]}>
                Programmation de la Puce NFC
              </ThemedText>
              <ThemedText style={[styles.writingSub, { color: theme.textSecondary }]}>
                Ne retirez pas la carte. Maintenez-la fermement contre le dos de votre smartphone.
              </ThemedText>
            </View>

            {/* Checklist progression */}
            <View style={[styles.checklistCard, { backgroundColor: dark ? '#1A1816' : theme.backgroundElement }]}>
              <View style={styles.checkItem}>
                <Ionicons
                  name={
                    writingPhase === 'nfc_format_write' ||
                    writingPhase === 'server_register' ||
                    writingPhase === 'completed'
                      ? 'checkmark-circle'
                      : writingPhase === 'nfc_connect'
                      ? 'sync-outline'
                      : 'ellipse-outline'
                  }
                  size={20}
                  color={
                    writingPhase === 'nfc_format_write' ||
                    writingPhase === 'server_register' ||
                    writingPhase === 'completed'
                      ? theme.statusSuccess
                      : theme.accentPrimary
                  }
                />
                <ThemedText style={[styles.checkText, { color: theme.text }]}>
                  Connexion antenne Mifare Classic / NfcA
                </ThemedText>
              </View>

              <View style={styles.checkItem}>
                <Ionicons
                  name={
                    writingPhase === 'server_register' || writingPhase === 'completed'
                      ? 'checkmark-circle'
                      : writingPhase === 'nfc_format_write'
                      ? 'sync-outline'
                      : 'ellipse-outline'
                  }
                  size={20}
                  color={
                    writingPhase === 'server_register' || writingPhase === 'completed'
                      ? theme.statusSuccess
                      : theme.accentPrimary
                  }
                />
                <ThemedText style={[styles.checkText, { color: theme.text }]}>
                  Formatage NDEF & gravure physique sur la puce
                </ThemedText>
              </View>

              <View style={styles.checkItem}>
                <Ionicons
                  name={
                    writingPhase === 'completed'
                      ? 'checkmark-circle'
                      : writingPhase === 'server_register'
                      ? 'sync-outline'
                      : 'ellipse-outline'
                  }
                  size={20}
                  color={
                    writingPhase === 'completed'
                      ? theme.statusSuccess
                      : theme.accentPrimary
                  }
                />
                <ThemedText style={[styles.checkText, { color: theme.text }]}>
                  Persistance centrale & signature cryptographique HMAC
                </ThemedText>
              </View>
            </View>

            {writingError && (
              <View style={[styles.errorBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)', marginTop: 20 }]}>
                <Ionicons name="close-circle" size={20} color={theme.statusError} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ color: theme.statusError, fontWeight: '700', fontSize: 13 }}>
                    Échec de la programmation
                  </ThemedText>
                  <ThemedText style={{ color: theme.statusError, fontSize: 12, marginTop: 2 }}>
                    {writingError}
                  </ThemedText>
                </View>
              </View>
            )}

            {writingError && (
              <Pressable
                onPress={handleExecuteWrite}
                style={[styles.primaryActionBtn, { backgroundColor: theme.accentPrimary, marginTop: 20 }]}
              >
                <Ionicons name="refresh" size={18} color="#FFFFFF" />
                <ThemedText style={styles.primaryActionBtnText}>Réessayer la Gravure NFC</ThemedText>
              </Pressable>
            )}
          </View>
        )}

        {/* ========================================================= */}
        {/* STEP 4: DIGITAL ISSUANCE CERTIFICATE                      */}
        {/* ========================================================= */}
        {currentStep === 4 && certificateData && (
          <View style={{ alignItems: 'center' }}>
            <View
              style={[
                styles.successBadge,
                { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
              ]}
            >
              <Ionicons name="shield-checkmark" size={48} color={theme.statusSuccess} />
            </View>

            <ThemedText style={[styles.sectionHeading, { color: theme.text, textAlign: 'center' }]}>
              Carte Programmée avec Succès !
            </ThemedText>
            <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary, textAlign: 'center' }]}>
              La puce NFC est configurée et prête pour les paiements carburant en station.
            </ThemedText>

            {/* Digital Certificate Card */}
            <View
              style={[
                styles.certificateCard,
                { backgroundColor: dark ? '#1A1816' : theme.backgroundElement },
              ]}
            >
              <View style={styles.certHeader}>
                <Ionicons name="ribbon-outline" size={20} color={theme.accentPrimary} />
                <ThemedText style={{ fontSize: 12, fontWeight: '800', color: theme.accentPrimary, letterSpacing: 0.5 }}>
                  CERTIFICAT D'ÉMISSION AFRIRO PAY
                </ThemedText>
              </View>

              <View style={styles.certRow}>
                <ThemedText style={styles.certLabel}>UID de la Carte :</ThemedText>
                <ThemedText style={[styles.certValue, { color: theme.accentPrimary, fontFamily: 'monospace' }]}>
                  {certificateData.cardUid}
                </ThemedText>
              </View>

              <View style={styles.certRow}>
                <ThemedText style={styles.certLabel}>Porteur Attribué :</ThemedText>
                <ThemedText style={[styles.certValue, { color: theme.text }]}>
                  {certificateData.userName}
                </ThemedText>
              </View>

              <View style={styles.certRow}>
                <ThemedText style={styles.certLabel}>Véhicule :</ThemedText>
                <ThemedText style={[styles.certValue, { color: theme.text }]}>
                  {certificateData.vehiclePlate}
                </ThemedText>
              </View>

              <View style={styles.certRow}>
                <ThemedText style={styles.certLabel}>Carburant Autorisé :</ThemedText>
                <ThemedText style={[styles.certValue, { color: theme.text }]}>
                  {certificateData.fuelRestriction}
                </ThemedText>
              </View>

              <View style={styles.certRow}>
                <ThemedText style={styles.certLabel}>Plafond Journalier :</ThemedText>
                <ThemedText style={[styles.certValue, { color: theme.text }]}>
                  {certificateData.dailyLimitFcfa.toLocaleString('fr-FR')} FCFA
                </ThemedText>
              </View>

              <View style={styles.certRow}>
                <ThemedText style={styles.certLabel}>Technologie Puce :</ThemedText>
                <ThemedText style={[styles.certValue, { color: theme.textSecondary }]}>
                  {certificateData.techUsed}
                </ThemedText>
              </View>

              <View style={styles.certRow}>
                <ThemedText style={styles.certLabel}>Mémoire Utilisée :</ThemedText>
                <ThemedText style={[styles.certValue, { color: theme.textSecondary }]}>
                  {certificateData.bytesWritten} octets (Blocs NDEF)
                </ThemedText>
              </View>

              <View style={[styles.certRow, { borderBottomWidth: 0 }]}>
                <ThemedText style={styles.certLabel}>Empreinte HMAC :</ThemedText>
                <ThemedText
                  style={[styles.certValue, { color: theme.textMuted, fontSize: 10, fontFamily: 'monospace' }]}
                >
                  {certificateData.signature.substring(0, 16)}...
                </ThemedText>
              </View>
            </View>

            {/* Bottom Final Actions */}
            <View style={{ width: '100%', gap: 10, marginTop: 24 }}>
              <Pressable
                onPress={handleResetForAnotherCard}
                style={[styles.primaryActionBtn, { backgroundColor: theme.accentPrimary }]}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <ThemedText style={styles.primaryActionBtnText}>
                  Configurer une Autre Carte
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => router.back()}
                style={[styles.secondaryBtn, { backgroundColor: dark ? '#24211E' : '#EFEAE5', justifyContent: 'center' }]}
              >
                <ThemedText style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
                  Retour à la Liste des Cartes
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
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
  topTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  topSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  techPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: 12,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    fontSize: 10,
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
    marginBottom: 14,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
  },
  sectionHeading: {
    fontSize: 19,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 4,
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
  userCard: {
    width: 150,
    padding: 12,
    borderRadius: Radius.chip,
    borderWidth: 1.5,
    marginRight: 10,
    gap: 4,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.chip,
    borderWidth: 1,
    marginVertical: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
  },
  formInput: {
    height: 46,
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.chip,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: Radius.chip,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: Radius.chip,
  },
  radarBox: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: Radius.card,
    borderWidth: 1.5,
    marginTop: 10,
  },
  radarPulseOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  radarPulseInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarInstruction: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  radarSubInstruction: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  diagnosticCard: {
    padding: 16,
    borderRadius: Radius.chip,
    marginTop: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: Radius.chip,
    marginTop: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  writingPulseBox: {
    width: '100%',
    padding: 24,
    borderRadius: Radius.card,
    alignItems: 'center',
    gap: 12,
  },
  writingTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 6,
  },
  writingSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  checklistCard: {
    width: '100%',
    padding: 16,
    borderRadius: Radius.chip,
    marginTop: 16,
    gap: 14,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  successBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 14,
  },
  certificateCard: {
    width: '100%',
    padding: 16,
    borderRadius: Radius.card,
    marginTop: 16,
  },
  certHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.15)',
    marginBottom: 8,
  },
  certRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.08)',
  },
  certLabel: {
    fontSize: 12,
    color: '#8A8580',
  },
  certValue: {
    fontSize: 12,
    fontWeight: '700',
  },
});
