/**
 * AfriRo Central Backend API Configuration
 * Supports environment overrides via EXPO_PUBLIC_API_URL.
 */
export const API_BASE_URL = "http://192.168.100.41:5204";

export const API_ENDPOINTS = {
  HEALTH: `${API_BASE_URL}/api/health`,
  CARDS: `${API_BASE_URL}/api/cards`,
  STATIONS: `${API_BASE_URL}/api/stations`,
  TRANSACTIONS: `${API_BASE_URL}/api/transactions`,
  TRANSACTIONS_SYNC: `${API_BASE_URL}/api/transactions/sync-batch`,
  CARD_STATUS: (cardUid: string) =>
    `${API_BASE_URL}/api/cards/${cardUid}/status`,
  CARD_OFFLINE_PAYLOAD: (cardUid: string) =>
    `${API_BASE_URL}/api/cards/${cardUid}/offline-payload`,
  FLEET_ALLOCATE: (companyId: string) =>
    `${API_BASE_URL}/api/fleet/${companyId}/allocate`,
} as const;
