/**
 * Drumcello Design System Tokens for AfriRo Fuel Mobile
 * Conforming strictly to DESIGN_GUIDE.md
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Backgrounds (warm off-white, never pure #FFFFFF for base)
    background: '#FAF7F4',
    backgroundDeep: '#F0EBE4',
    backgroundElement: '#FFFFFF', // surface
    backgroundSelected: '#F5F0EB', // surface raised
    backgroundHighlight: '#EDE8E2',
    backgroundElevated: '#E8E1DA',

    // Accents (Copper)
    accentPrimary: '#C06A32',
    accentBright: '#D8804A',
    accentDim: '#8A4820',
    accentTranslucent: 'rgba(192,106,50,0.10)',
    accentGlow: 'rgba(192,106,50,0.25)',
    accentSecondary: '#287A6C', // Teal for Gazole/operations
    accentSecondaryDim: '#1A5549',

    // Typography (Warm near-blacks)
    text: '#1A1612',
    textSecondary: '#5C5046',
    textMuted: '#9C8E82',
    textSubtle: '#C0B4A8',

    // Borders & Hairlines
    borderHairline: 'rgba(26,22,18,0.08)',
    borderSubtle: 'rgba(26,22,18,0.12)',
    borderMedium: 'rgba(26,22,18,0.18)',
    borderStrong: '#D8D0C8',

    // Status
    statusSuccess: '#15803D',
    statusError: '#DC2626',
    statusWarning: '#D97706',
    statusInfo: '#2563EB',
  },
  dark: {
    // Backgrounds (warm near-black, never pure #000000 for base)
    background: '#0A0A0A',
    backgroundDeep: '#000000',
    backgroundElement: '#121212', // surface
    backgroundSelected: '#181818', // surface raised
    backgroundHighlight: '#242424',
    backgroundElevated: '#2A2A2A',

    // Accents (Copper)
    accentPrimary: '#D8804A',
    accentBright: '#F0A46E',
    accentDim: '#A85A28',
    accentTranslucent: 'rgba(216,128,74,0.15)',
    accentGlow: 'rgba(216,128,74,0.35)',
    accentSecondary: '#3FA894', // Teal for Gazole/operations
    accentSecondaryDim: '#1C6E62',

    // Typography
    text: '#FFFFFF',
    textSecondary: '#B3B3B3',
    textMuted: '#717171',
    textSubtle: '#525252',

    // Borders & Hairlines
    borderHairline: 'rgba(255,255,255,0.08)',
    borderSubtle: 'rgba(255,255,255,0.12)',
    borderMedium: 'rgba(255,255,255,0.18)',
    borderStrong: '#282828',

    // Status
    statusSuccess: '#22C55E',
    statusError: '#EF4444',
    statusWarning: '#F59E0B',
    statusInfo: '#3B82F6',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    display: 'ProximaNova-Bold',
    ui: 'ProximaNova-Regular',
    bold: 'ProximaNova-Bold',
    sans: 'ProximaNova-Regular',
    serif: 'serif',
    mono: 'ui-monospace',
  },
  android: {
    display: 'ProximaNova-Bold',
    ui: 'ProximaNova-Regular',
    bold: 'ProximaNova-Bold',
    sans: 'ProximaNova-Regular',
    serif: 'serif',
    mono: 'monospace',
  },
  default: {
    display: 'ProximaNova-Bold',
    ui: 'ProximaNova-Regular',
    bold: 'ProximaNova-Bold',
    sans: 'ProximaNova-Regular',
    serif: 'serif',
    mono: 'monospace',
  },
  web: {
    display: 'var(--font-proxima, "Proxima Nova", sans-serif)',
    ui: 'var(--font-proxima, "Proxima Nova", sans-serif)',
    bold: 'var(--font-proxima, "Proxima Nova", sans-serif)',
    sans: 'var(--font-proxima, "Proxima Nova", sans-serif)',
    serif: 'serif',
    mono: 'monospace',
  },
});

export const Radius = {
  sm: 6,
  chip: 10,
  card: 16,
  modal: 24,
  pill: 9999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  // backwards compatibility tokens
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
