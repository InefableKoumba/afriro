import { Platform } from 'react-native';

export interface NfcScanResult {
  success: boolean;
  cardUid?: string;
  error?: string;
}

class NfcHardwareService {
  private nfcModule: any = null;
  private isInitialized = false;

  async init(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (Platform.OS === 'web') return false;

    try {
      const nfc = await import('react-native-nfc-manager');
      this.nfcModule = nfc.default;
      const supported = await this.nfcModule.isSupported();
      if (supported) {
        await this.nfcModule.start();
        this.isInitialized = true;
        return true;
      }
      return false;
    } catch (err) {
      console.warn('NFC hardware initialization error (simulator/web):', err);
      return false;
    }
  }

  async isHardwareSupported(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      await this.init();
      return this.nfcModule ? await this.nfcModule.isSupported() : false;
    } catch {
      return false;
    }
  }

  async isNfcEnabled(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      await this.init();
      return this.nfcModule ? await this.nfcModule.isEnabled() : false;
    } catch {
      return false;
    }
  }

  async scanCardTag(): Promise<NfcScanResult> {
    const supported = await this.isHardwareSupported();
    if (!supported || !this.nfcModule) {
      return {
        success: false,
        error: 'NFC matériel non disponible sur cet appareil (mode simulation actif).',
      };
    }

    try {
      const NfcTech = (await import('react-native-nfc-manager')).NfcTech;
      await this.nfcModule.requestTechnology(NfcTech.NfcA, {
        alertMessage: 'Approchez la carte carburant NFC du dos de votre smartphone',
      });

      const tag = await this.nfcModule.getTag();
      if (tag && tag.id) {
        // Standardize UID formatting (uppercase hex)
        const cleanUid = tag.id.replace(/[: -]/g, '').toUpperCase();
        await this.nfcModule.cancelTechnologyRequest();
        return {
          success: true,
          cardUid: cleanUid,
        };
      }

      await this.nfcModule.cancelTechnologyRequest();
      return {
        success: false,
        error: 'Aucun identifiant UID détecté sur la puce.',
      };
    } catch (err: any) {
      try {
        await this.nfcModule.cancelTechnologyRequest();
      } catch {}
      return {
        success: false,
        error: err?.message || 'Erreur de lecture NFC',
      };
    }
  }

  async cancelScan(): Promise<void> {
    try {
      if (this.nfcModule) {
        await this.nfcModule.cancelTechnologyRequest();
      }
    } catch {}
  }
}

export const nfcService = new NfcHardwareService();
