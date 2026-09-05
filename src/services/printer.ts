// ESC/POS Thermal Slip Formatter for Mobile Bluetooth/USB Pump Printers

export interface ReceiptData {
  stationName: string;
  stationAddress: string;
  pumpNumber: string;
  terminalId: string;
  attendantName: string;
  cardUid: string;
  vehiclePlate?: string;
  driverName?: string;
  fuelType: string;
  liters: number;
  pricePerLiter: number;
  amountFcfa: number;
  remainingBalanceFcfa: number;
  signature: string;
  timestamp: string;
}

export class ThermalPrinterService {
  // Generates ASCII ESC/POS formatted ticket
  formatReceipt(data: ReceiptData): string {
    const divider = '------------------------------------------\n';
    const date = new Date(data.timestamp);

    let slip = '';
    slip += '\n';
    slip += '         RESEAU STATIONS AFRIC\'\n';
    slip += '            CONGO-BRAZZAVILLE\n';
    slip += `        ${data.stationName.toUpperCase()}\n`;
    slip += `     ${data.stationAddress}\n`;
    slip += divider;
    slip += `DATE: ${date.toLocaleDateString('fr-FR')}    HEURE: ${date.toLocaleTimeString('fr-FR')}\n`;
    slip += `TERMINAL: ${data.terminalId}     POMPE: #${data.pumpNumber}\n`;
    slip += `POMPISTE: ${data.attendantName}\n`;
    slip += divider;
    slip += `CARTE NFC: ${data.cardUid}\n`;
    if (data.vehiclePlate) {
      slip += `VEHICULE: ${data.vehiclePlate} (${data.driverName || 'Chauffeur'})\n`;
    }
    slip += `PRODUIT:  ${data.fuelType.toUpperCase()}\n`;
    slip += `VOLUME:   ${data.liters.toFixed(2)} L @ ${data.pricePerLiter} FCFA/L\n`;
    slip += divider;
    slip += `TOTAL DEBITE:       ${Math.round(data.amountFcfa).toLocaleString('fr-FR')} FCFA\n`;
    slip += `SOLDE RESTANT:      ${Math.round(data.remainingBalanceFcfa).toLocaleString('fr-FR')} FCFA\n`;
    slip += divider;
    slip += `MAC: ${data.signature.substring(0, 24)}...\n`;
    slip += '  TRANSACTION SECURISEE HORS-LIGNE ISO-14443\n';
    slip += '     MERCI DE VOTRE VISITE CHEZ AFRIC\'\n\n\n';

    return slip;
  }

  // Raw ESC/POS byte sequence generation
  generateEscPosCommands(data: ReceiptData): Uint8Array {
    const text = this.formatReceipt(data);
    const enc = new TextEncoder();
    const textBytes = enc.encode(text);

    // ESC @ (Initialize) + textBytes + GS V 0 (Cut paper)
    const init = new Uint8Array([0x1B, 0x40]);
    const cut = new Uint8Array([0x1D, 0x56, 0x00]);

    const full = new Uint8Array(init.length + textBytes.length + cut.length);
    full.set(init, 0);
    full.set(textBytes, init.length);
    full.set(cut, init.length + textBytes.length);

    return full;
  }
}

export const thermalPrinter = new ThermalPrinterService();
