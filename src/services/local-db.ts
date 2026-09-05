import { Platform } from 'react-native';

export interface OfflineTransaction {
  id: string;
  cardUid: string;
  deviceId: string;
  stationId: string;
  attendantId?: string;
  amountFcfa: number;
  liters: number;
  fuelType: string;
  offlineCounter: number;
  signature: string;
  timestamp: string;
  isSynced: number;
}

// In-memory / storage fallback for web, native SQLite for Android/iOS
class LocalDatabaseService {
  private inMemoryQueue: OfflineTransaction[] = [];
  private db: any = null;
  private initialized = false;

  async init() {
    if (this.initialized) return;

    if (Platform.OS !== 'web') {
      try {
        const SQLite = await import('expo-sqlite');
        this.db = await SQLite.openDatabaseAsync('afriro_offline.db');
        await this.db.execAsync(`
          CREATE TABLE IF NOT EXISTS offline_transactions (
            id TEXT PRIMARY KEY NOT NULL,
            card_uid TEXT NOT NULL,
            device_id TEXT NOT NULL,
            station_id TEXT NOT NULL,
            attendant_id TEXT,
            amount_fcfa REAL NOT NULL,
            liters REAL NOT NULL,
            fuel_type TEXT NOT NULL,
            offline_counter INTEGER NOT NULL,
            signature TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            is_synced INTEGER DEFAULT 0
          );
        `);
      } catch (err) {
        console.warn('SQLite init fallback to in-memory store:', err);
      }
    }
    this.initialized = true;
  }

  async queueTransaction(tx: Omit<OfflineTransaction, 'isSynced'>): Promise<void> {
    await this.init();
    const item: OfflineTransaction = { ...tx, isSynced: 0 };

    if (this.db) {
      try {
        await this.db.runAsync(
          `INSERT INTO offline_transactions (id, card_uid, device_id, station_id, attendant_id, amount_fcfa, liters, fuel_type, offline_counter, signature, timestamp, is_synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
          item.id,
          item.cardUid,
          item.deviceId,
          item.stationId,
          item.attendantId ?? null,
          item.amountFcfa,
          item.liters,
          item.fuelType,
          item.offlineCounter,
          item.signature,
          item.timestamp
        );
        return;
      } catch (err) {
        console.warn('SQLite insert error, falling back to memory queue:', err);
      }
    }

    this.inMemoryQueue.push(item);
  }

  async getPendingTransactions(): Promise<OfflineTransaction[]> {
    await this.init();

    if (this.db) {
      try {
        const rows = await this.db.getAllAsync(
          `SELECT id, card_uid as cardUid, device_id as deviceId, station_id as stationId, attendant_id as attendantId, amount_fcfa as amountFcfa, liters, fuel_type as fuelType, offline_counter as offlineCounter, signature, timestamp, is_synced as isSynced
           FROM offline_transactions WHERE is_synced = 0 ORDER BY timestamp ASC;`
        );
        return rows as OfflineTransaction[];
      } catch (err) {
        console.warn('SQLite read error:', err);
      }
    }

    return this.inMemoryQueue.filter((t) => t.isSynced === 0);
  }

  async getAllTransactions(): Promise<OfflineTransaction[]> {
    await this.init();

    if (this.db) {
      try {
        const rows = await this.db.getAllAsync(
          `SELECT id, card_uid as cardUid, device_id as deviceId, station_id as stationId, attendant_id as attendantId, amount_fcfa as amountFcfa, liters, fuel_type as fuelType, offline_counter as offlineCounter, signature, timestamp, is_synced as isSynced
           FROM offline_transactions ORDER BY timestamp DESC;`
        );
        return rows as OfflineTransaction[];
      } catch (err) {
        console.warn('SQLite read error:', err);
      }
    }

    return [...this.inMemoryQueue].reverse();
  }

  async markTransactionsSynced(ids: string[]): Promise<void> {
    await this.init();
    if (ids.length === 0) return;

    if (this.db) {
      try {
        const placeholders = ids.map(() => '?').join(',');
        await this.db.runAsync(
          `UPDATE offline_transactions SET is_synced = 1 WHERE id IN (${placeholders});`,
          ...ids
        );
        return;
      } catch (err) {
        console.warn('SQLite update error:', err);
      }
    }

    this.inMemoryQueue = this.inMemoryQueue.map((t) =>
      ids.includes(t.id) ? { ...t, isSynced: 1 } : t
    );
  }

  async getPendingCount(): Promise<number> {
    const list = await this.getPendingTransactions();
    return list.length;
  }
}

export const localDb = new LocalDatabaseService();
