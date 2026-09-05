import React, { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { mobileAuth } from '@/services/auth';

interface Slide {
  id: string;
  badge: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  features: string[];
}

const SLIDES: Slide[] = [
  {
    id: 's1',
    badge: "Réseau Afric' Congo",
    title: 'Paiement carburant souverain',
    description:
      'AfriRo numérise le carburant pour les stations Afric’ au Congo-Brazzaville grâce à des cartes NFC sécurisées.',
    icon: 'card-outline',
    features: [
      'Puce NFC ISO 14443 chiffrée',
      'Fonctionne sans compte bancaire externe',
      'Zéro frais de transaction intermédiaire',
    ],
  },
  {
    id: 's2',
    badge: 'Architecture Déconnectée',
    title: 'SoftPOS 100% hors-ligne',
    description:
      'Les pompistes valident les paiements en moins de 1.5s même en zone blanche ou lors des coupures Internet.',
    icon: 'speedometer-outline',
    features: [
      'Validation cryptographique locale HMAC-SHA256',
      'Stockage SQLite chiffré sur smartphone POS',
      'Synchronisation automatique dès retour réseau',
    ],
  },
  {
    id: 's3',
    badge: 'Recharge en Espèces',
    title: 'Dépôt direct au guichet',
    description:
      'Les usagers et entreprises rechargent leurs cartes avec du cash physique auprès des caissières Afric’.',
    icon: 'cash-outline',
    features: [
      'Crédit immédiat sur le solde de la carte',
      'Ticket de caisse officiel numéroté',
      'Traçabilité intégrale caissière & station',
    ],
  },
  {
    id: 's4',
    badge: 'Supervision & Flottes',
    title: 'Contrôle B2B et sécurité chauffeur',
    description:
      'Pilotez les véhicules de société, allouez les crédits et bloquez instantanément une carte égarée.',
    icon: 'business-outline',
    features: [
      'Plafonds de dépenses journaliers et hebdomadaires',
      'Verrouillage par carburant (Super ou Gazole)',
      'Gel à distance en 1 clic en cas de perte',
    ],
  },
];

export default function OnboardingScreen({ onFinish }: { onFinish?: () => void }) {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const pagerRef = useRef<PagerView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isLast = currentIndex === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      mobileAuth.completeOnboarding();
      onFinish?.();
    } else {
      pagerRef.current?.setPage(currentIndex + 1);
    }
  };

  const handleSkip = () => {
    mobileAuth.completeOnboarding();
    onFinish?.();
  };

  const handlePageSelect = (pageIndex: number) => {
    pagerRef.current?.setPage(pageIndex);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* Top Bar: Logo branding and Skip */}
      <View style={styles.topBar}>
        <View style={styles.brandGroup}>
          <View style={[styles.logoDot, { backgroundColor: theme.accentPrimary }]} />
          <ThemedText type="smallBold" style={{ color: theme.text }}>
            AfriRo Fuel
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            · Afric' Congo
          </ThemedText>
        </View>

        {!isLast && (
          <Pressable onPress={handleSkip} hitSlop={12} style={styles.skipButton}>
            <ThemedText type="label" style={{ color: theme.textSecondary }}>
              Passer
            </ThemedText>
          </Pressable>
        )}
      </View>

      {/* PagerView Swiper Container */}
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={(e) => setCurrentIndex(e.nativeEvent.position)}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={styles.slidePage}>
            {/* Visual Badge & Hero Icon */}
            <View style={styles.heroSection}>
              <View
                style={[
                  styles.iconOuterRing,
                  {
                    borderColor: theme.borderSubtle,
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconInnerCircle,
                    { backgroundColor: theme.accentTranslucent },
                  ]}
                >
                  <Ionicons name={slide.icon} size={48} color={theme.accentPrimary} />
                </View>
              </View>

              <View
                style={[
                  styles.badgePill,
                  {
                    backgroundColor: theme.accentTranslucent,
                    borderColor: theme.borderHairline,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: theme.accentPrimary, fontWeight: '500' }}
                >
                  {slide.badge}
                </ThemedText>
              </View>
            </View>

            {/* Text Section */}
            <View style={styles.textSection}>
              <ThemedText
                type="display"
                style={[styles.title, { color: theme.text }]}
              >
                {slide.title}
              </ThemedText>
              <ThemedText
                type="body"
                style={[styles.description, { color: theme.textSecondary }]}
              >
                {slide.description}
              </ThemedText>

              {/* Feature List */}
              <View style={styles.featureList}>
                {slide.features.map((feat, idx) => (
                  <View key={idx} style={styles.featureRow}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={16}
                      color={theme.accentPrimary}
                      style={{ marginTop: 2 }}
                    />
                    <ThemedText
                      type="label"
                      style={{ color: theme.text, flex: 1 }}
                    >
                      {feat}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </PagerView>

      {/* Bottom Controls: Stepper Dots + Primary CTA */}
      <View style={styles.bottomBar}>
        {/* Stepper Dots */}
        <View style={styles.stepperContainer}>
          {SLIDES.map((_, idx) => {
            const active = idx === currentIndex;
            return (
              <Pressable
                key={idx}
                onPress={() => handlePageSelect(idx)}
                hitSlop={8}
              >
                <View
                  style={[
                    styles.dot,
                    active
                      ? [styles.activeDot, { backgroundColor: theme.accentPrimary }]
                      : { backgroundColor: theme.borderMedium },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        {/* Action Button */}
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: theme.accentPrimary,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>
            {isLast ? 'Commencer' : 'Suivant'}
          </ThemedText>
          <Ionicons
            name={isLast ? 'arrow-forward-outline' : 'chevron-forward-outline'}
            size={18}
            color="#FFFFFF"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  pagerView: {
    flex: 1,
  },
  slidePage: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconOuterRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  iconInnerCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  textSection: {
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  featureList: {
    width: '100%',
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bottomBar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.lg,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 24,
  },
  primaryButton: {
    height: 52,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
