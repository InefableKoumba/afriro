/**
 * MMKV Key-Value Storage for AfriRo Mobile
 * Fast, synchronous key-value storage for settings, auth session, and flags
 */

import { createMMKV } from 'react-native-mmkv';

export const appStorage = createMMKV({
  id: 'afriro-storage',
});

export const StorageKeys = {
  HAS_SEEN_ONBOARDING: 'afriro_has_seen_onboarding',
  AUTH_SESSION: 'afriro_auth_session',
  LAST_ROLE: 'afriro_last_role',
} as const;

export const kvStorage = {
  getString(key: string): string | null {
    try {
      const val = appStorage.getString(key);
      return val ?? null;
    } catch {
      return null;
    }
  },

  setString(key: string, value: string): void {
    try {
      appStorage.set(key, value);
    } catch (err) {
      console.warn('Error saving to MMKV:', err);
    }
  },

  getBoolean(key: string, defaultValue = false): boolean {
    try {
      const val = appStorage.getBoolean(key);
      return val !== undefined ? val : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  setBoolean(key: string, value: boolean): void {
    try {
      appStorage.set(key, value);
    } catch (err) {
      console.warn('Error saving boolean to MMKV:', err);
    }
  },

  getObject<T>(key: string): T | null {
    try {
      const str = appStorage.getString(key);
      if (!str) return null;
      return JSON.parse(str) as T;
    } catch {
      return null;
    }
  },

  setObject<T>(key: string, value: T): void {
    try {
      appStorage.set(key, JSON.stringify(value));
    } catch (err) {
      console.warn('Error saving object to MMKV:', err);
    }
  },

  removeItem(key: string): void {
    try {
      appStorage.remove(key);
    } catch (err) {
      console.warn('Error removing from MMKV:', err);
    }
  },

  clearAll(): void {
    try {
      appStorage.clearAll();
    } catch (err) {
      console.warn('Error clearing MMKV:', err);
    }
  },
};
