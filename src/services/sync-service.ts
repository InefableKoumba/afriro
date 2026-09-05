import { localDb } from './local-db';
import { API_ENDPOINTS } from '@/constants/api';

export interface SyncResult {
  success: boolean;
  acceptedCount: number;
  rejectedCount: number;
  message: string;
}

export async function syncOfflineLedger(deviceId: string, stationId: string): Promise<SyncResult> {
  try {
    const pending = await localDb.getPendingTransactions();
    if (pending.length === 0) {
      return {
        success: true,
        acceptedCount: 0,
        rejectedCount: 0,
        message: "File hors-ligne vide (Aucune transaction en attente)",
      };
    }

    const payload = {
      deviceId,
      stationId,
      transactions: pending.map((p) => ({
        cardUid: p.cardUid,
        amountFcfa: p.amountFcfa,
        liters: p.liters,
        fuelType: p.fuelType,
        offlineCounter: p.offlineCounter,
        signature: p.signature,
        attendantId: p.attendantId || null,
        timestamp: p.timestamp,
      })),
    };

    const res = await fetch(API_ENDPOINTS.TRANSACTIONS_SYNC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok) {
      // Find IDs of accepted items to mark synced in SQLite
      const acceptedUids = new Set(
        (data.results || [])
          .filter((r: any) => r.success)
          .map((r: any) => `${r.cardUid}:${r.offlineCounter}`)
      );

      const idsToMark = pending
        .filter((p) => acceptedUids.has(`${p.cardUid}:${p.offlineCounter}`))
        .map((p) => p.id);

      await localDb.markTransactionsSynced(idsToMark);

      return {
        success: true,
        acceptedCount: data.acceptedCount,
        rejectedCount: data.rejectedCount,
        message: `${data.acceptedCount} transaction(s) synchronisée(s) avec succès sur le serveur central.`,
      };
    } else {
      return {
        success: false,
        acceptedCount: 0,
        rejectedCount: pending.length,
        message: data.error || "Erreur de rejet lors de la synchronisation par le serveur",
      };
    }
  } catch (err: any) {
    return {
      success: false,
      acceptedCount: 0,
      rejectedCount: 0,
      message: "Serveur central injoignable (Réseau hors-ligne). Les données restent en sécurité dans SQLite.",
    };
  }
}
