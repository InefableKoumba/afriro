import { Platform } from 'react-native';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';

export interface NfcNdefCardData {
  cardId?: string;
  app?: string;
  v?: number;
  uid?: string;
  userId?: string | null;
  userName?: string;
  userPhone?: string;
  companyId?: string | null;
  companyName?: string;
  fuelRestriction?: string;
  dailyLimitFcfa?: number | null;
  weeklyLimitFcfa?: number | null;
  vehiclePlate?: string;
  driverName?: string;
  issuedAt?: string;
  signature?: string;
  [key: string]: any;
}

export interface NfcScanResult {
  success: boolean;
  cardUid?: string;
  techType?: string;
  techTypes?: string[];
  error?: string;
}

export interface NfcReadResult {
  success: boolean;
  cardUid?: string;
  techType?: string;
  ndefData?: NfcNdefCardData | null;
  error?: string;
}

export interface NfcWriteResult {
  success: boolean;
  cardUid?: string;
  techUsed?: string;
  bytesWritten?: number;
  error?: string;
}

/**
 * Initializes the NFC Manager hardware module.
 */
export async function initNfc(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await NfcManager.start();
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if NFC is supported on the device hardware.
 */
export async function isNfcSupported(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await NfcManager.isSupported();
  } catch {
    return false;
  }
}

/**
 * Checks if NFC is currently enabled in device settings.
 */
export async function isNfcEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await NfcManager.isEnabled();
  } catch {
    return false;
  }
}

/**
 * Proven NFC writing function that handles both NDEF-formatted and NdefFormatable cards
 * (e.g. blank Mifare Classic, NfcA tags).
 */
export async function writeCardIdToNfc(cardId: string): Promise<boolean> {
  const jsonPayload = JSON.stringify({ cardId });
  const bytes = Ndef.encodeMessage([Ndef.textRecord(jsonPayload)]);
  if (!bytes) return false;

  try {
    const tech = await NfcManager.requestTechnology([
      NfcTech.Ndef,
      NfcTech.NdefFormatable,
    ]);

    console.log('[NFC Write] Tech discovered:', tech);
    const tag = await NfcManager.getTag();
    console.log('[NFC Write] Tag info:', JSON.stringify(tag));

    if (tech === NfcTech.Ndef) {
      if (!NfcManager.ndefHandler) {
        throw new Error('Ndef handler is null');
      }
      await NfcManager.ndefHandler.writeNdefMessage(bytes);
      return true;
    } else if (tech === NfcTech.NdefFormatable) {
      if (!NfcManager.ndefFormatableHandlerAndroid) {
        throw new Error('NdefFormatable handler is null');
      }
      await NfcManager.ndefFormatableHandlerAndroid.formatNdef(bytes);
      return true;
    }
    return false;
  } catch (error: any) {
    console.error('NFC write failed:', error);
    // Explicitly check for tech not supported or NPE
    if (error?.message?.includes('NullPointerException')) {
      console.warn('[NFC] Caught NPE, likely unsupported tag for this API');
    }
    throw error; // Rethrow to let UI handle the error mapping
  } finally {
    NfcManager.cancelTechnologyRequest();
  }
}

/**
 * Writes a full payload object (including cardId/uid) onto the card EEPROM.
 */
export async function writePayloadToNfc(payload: object | string): Promise<boolean> {
  let jsonPayload: string;
  if (typeof payload === 'string') {
    jsonPayload = payload;
  } else {
    const p = payload as any;
    const normalized = {
      ...p,
      cardId: p.cardId || p.uid,
    };
    jsonPayload = JSON.stringify(normalized);
  }

  const bytes = Ndef.encodeMessage([Ndef.textRecord(jsonPayload)]);
  if (!bytes) return false;

  try {
    const tech = await NfcManager.requestTechnology([
      NfcTech.Ndef,
      NfcTech.NdefFormatable,
    ]);

    console.log('[NFC Write Payload] Tech discovered:', tech);
    const tag = await NfcManager.getTag();
    console.log('[NFC Write Payload] Tag info:', JSON.stringify(tag));

    if (tech === NfcTech.Ndef) {
      if (!NfcManager.ndefHandler) {
        throw new Error('Ndef handler is null');
      }
      await NfcManager.ndefHandler.writeNdefMessage(bytes);
      return true;
    } else if (tech === NfcTech.NdefFormatable) {
      if (!NfcManager.ndefFormatableHandlerAndroid) {
        throw new Error('NdefFormatable handler is null');
      }
      await NfcManager.ndefFormatableHandlerAndroid.formatNdef(bytes);
      return true;
    }
    return false;
  } catch (error: any) {
    console.error('NFC payload write failed:', error);
    if (error?.message?.includes('NullPointerException')) {
      console.warn('[NFC] Caught NPE, likely unsupported tag for this API');
    }
    throw error;
  } finally {
    NfcManager.cancelTechnologyRequest();
  }
}

/**
 * Reads NDEF tag payload and extracts cardId or plain text data.
 */
export async function readNfcTag(): Promise<string | null> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);

    const tag = await NfcManager.ndefHandler.getNdefMessage();

    if (!tag || !tag.ndefMessage || tag.ndefMessage.length === 0) {
      return null;
    }

    const record = tag.ndefMessage[0];
    const payload = Ndef.text.decodePayload(new Uint8Array(record.payload));

    try {
      const data = JSON.parse(payload);
      return data.cardId || data.uid || null;
    } catch {
      // Fallback: maybe it's just the cardId string
      return payload || null;
    }
  } catch (error) {
    console.error('NFC read failed:', error);
    throw error;
  } finally {
    NfcManager.cancelTechnologyRequest();
  }
}

/**
 * Cancels any active NFC technology request.
 */
export function cancelNfc() {
  NfcManager.cancelTechnologyRequest().catch(() => {});
}

/**
 * NfcHardwareService provides an integrated singleton service for app screens.
 */
class NfcHardwareService {
  private isInitialized = false;

  async init(): Promise<boolean> {
    if (this.isInitialized) return true;
    const ok = await initNfc();
    if (ok) this.isInitialized = true;
    return ok;
  }

  async isHardwareSupported(): Promise<boolean> {
    return await isNfcSupported();
  }

  async isNfcEnabled(): Promise<boolean> {
    return await isNfcEnabled();
  }

  /**
   * Scans for card tag UID. Tries Ndef/NdefFormatable first, falls back to NfcA / MifareClassic.
   */
  async scanCardTag(): Promise<NfcScanResult> {
    if (Platform.OS === 'web') {
      return { success: false, error: 'NFC non disponible sur le web.' };
    }
    try {
      let tag: any = null;
      let techName = 'Ndef';

      try {
        const tech = await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NdefFormatable]);
        tag = await NfcManager.getTag();
        techName = (tech as string) || 'Ndef';
      } catch {
        try {
          await NfcManager.cancelTechnologyRequest().catch(() => {});
          const tech = await NfcManager.requestTechnology(NfcTech.NfcA);
          tag = await NfcManager.getTag();
          techName = (tech as string) || 'NfcA';
        } catch {
          await NfcManager.cancelTechnologyRequest().catch(() => {});
          const tech = await NfcManager.requestTechnology(NfcTech.MifareClassic);
          tag = await NfcManager.getTag();
          techName = (tech as string) || 'MifareClassic';
        }
      }

      const cleanUid = tag?.id ? tag.id.replace(/[: -]/g, '').toUpperCase() : undefined;
      return {
        success: !!cleanUid,
        cardUid: cleanUid,
        techType: techName,
        techTypes: tag?.techTypes || [],
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Erreur lors de la détection de la puce NFC.',
      };
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  }

  /**
   * Reads card UID and decodes NDEF JSON payload stored on physical chip.
   */
  async readCardPayload(): Promise<NfcReadResult> {
    if (Platform.OS === 'web') {
      return { success: false, error: 'NFC non disponible sur le web.' };
    }

    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      const rawUid = tag?.id ? tag.id.replace(/[: -]/g, '').toUpperCase() : undefined;

      const ndefMsg = await NfcManager.ndefHandler.getNdefMessage();
      let ndefData: NfcNdefCardData | null = null;

      if (ndefMsg && ndefMsg.ndefMessage && ndefMsg.ndefMessage.length > 0) {
        for (const record of ndefMsg.ndefMessage) {
          try {
            if (record.payload) {
              const text = Ndef.text.decodePayload(new Uint8Array(record.payload));
              if (text) {
                const parsed = JSON.parse(text);
                if (parsed) {
                  ndefData = parsed;
                  break;
                }
              }
            }
          } catch {}
        }
      }

      const resolvedUid = rawUid || ndefData?.cardId || ndefData?.uid;
      return {
        success: !!resolvedUid,
        cardUid: resolvedUid,
        techType: 'Ndef',
        ndefData,
      };
    } catch (err: any) {
      // Fallback: simple tag scan
      try {
        const rawScan = await this.scanCardTag();
        if (rawScan.success && rawScan.cardUid) {
          return {
            success: true,
            cardUid: rawScan.cardUid,
            techType: rawScan.techType,
            ndefData: null,
          };
        }
      } catch {}

      return {
        success: false,
        error: err?.message || 'Erreur lors de la lecture NFC.',
      };
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  }

  /**
   * Writes card payload to physical chip using the proven write pipeline.
   */
  async writeCardPayload(payload: NfcNdefCardData | any): Promise<NfcWriteResult> {
    if (Platform.OS === 'web') {
      return { success: false, error: 'NFC non disponible sur le web.' };
    }

    try {
      const cleanUid = payload?.uid || payload?.cardId || '';
      await writePayloadToNfc(payload);
      return {
        success: true,
        cardUid: cleanUid,
        techUsed: 'Ndef / NdefFormatable',
        bytesWritten: JSON.stringify(payload).length,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Échec de l'écriture sur la puce NFC.",
      };
    }
  }

  async writeCardId(cardId: string): Promise<boolean> {
    return await writeCardIdToNfc(cardId);
  }

  async cancelScan(): Promise<void> {
    cancelNfc();
  }
}

export const nfcService = new NfcHardwareService();
