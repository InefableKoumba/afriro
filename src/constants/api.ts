/**
 * AfriRo Central Backend API Configuration
 * Supports environment overrides via EXPO_PUBLIC_API_URL.
 */
export const API_BASE_URL = "http://192.168.100.41:5150";

export const API_ENDPOINTS = {
  HEALTH: `${API_BASE_URL}/api/health`,
  CARDS: `${API_BASE_URL}/api/cards`,
  CARDS_PROVISION: `${API_BASE_URL}/api/cards/provision`,
  STATIONS: `${API_BASE_URL}/api/stations`,
  STATION: (stationId: string) => `${API_BASE_URL}/api/stations/${stationId}`,
  STATION_TERMINALS: (stationId: string) =>
    `${API_BASE_URL}/api/stations/${stationId}/terminals`,
  TRANSACTIONS: `${API_BASE_URL}/api/transactions`,
  TRANSACTIONS_SYNC: `${API_BASE_URL}/api/transactions/sync-batch`,
  TOPUPS: `${API_BASE_URL}/api/topups`,
  USERS: `${API_BASE_URL}/api/users`,
  USER: (userId: string) => `${API_BASE_URL}/api/users/${userId}`,
  COMPANIES: `${API_BASE_URL}/api/fleet/companies`,
  RECONCILIATION: `${API_BASE_URL}/api/reconciliation`,
  CARD_STATUS: (cardUid: string) =>
    `${API_BASE_URL}/api/cards/${cardUid}/status`,
  CARD_ASSIGN: (cardUid: string) =>
    `${API_BASE_URL}/api/cards/${cardUid}/assign`,
  CARD_OFFLINE_PAYLOAD: (cardUid: string) =>
    `${API_BASE_URL}/api/cards/${cardUid}/offline-payload`,
  FLEET_ALLOCATE: (companyId: string) =>
    `${API_BASE_URL}/api/fleet/${companyId}/allocate`,
} as const;

