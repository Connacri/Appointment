// ============================================================================
// ProUSB WebHID Hardware Lock Manager & Encoder Protocol
// Real WebHID integration with navigator.hid.requestDevice and fallback emulation
// ============================================================================

export type UsbConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'unsupported';

export interface UsbDeviceInfo {
  productName: string;
  vendorId: number;
  productId: number;
  opened: boolean;
  serialNumber?: string;
}

export interface IssuedLockCard {
  id: string;
  cardNumber: string;
  cardType: 'guest' | 'staff' | 'master' | 'emergency';
  roomNumber: string;
  guestName?: string;
  bookingId?: string;
  validFrom: string;
  validUntil: string;
  issuedAt: string;
  issuedBy: string;
  rawHex: string;
  status: 'active' | 'revoked' | 'expired';
}

type ConnectionListener = (status: UsbConnectionStatus, device: UsbDeviceInfo | null) => void;
type CardListener = (cards: IssuedLockCard[]) => void;

class LockManager {
  private status: UsbConnectionStatus = 'disconnected';
  private hidDevice: any = null;
  private connectionListeners: Set<ConnectionListener> = new Set();
  private cardListeners: Set<CardListener> = new Set();
  private cards: IssuedLockCard[] = [];

  constructor() {
    this.loadCards();
    this.checkWebHidSupport();
    this.autoDetectPairedDevices();
  }

  private checkWebHidSupport(): boolean {
    if (typeof window === 'undefined') return false;
    const supported = 'hid' in navigator;
    if (!supported) {
      this.status = 'unsupported';
    }
    return supported;
  }

  private loadCards() {
    try {
      const stored = localStorage.getItem('omnibook_prousb_cards');
      if (stored) {
        this.cards = JSON.parse(stored);
      } else {
        // Seed default initial demo keycards
        this.cards = [
          {
            id: 'card_demo_1',
            cardNumber: '04A8B2F1',
            cardType: 'guest',
            roomNumber: 'CV-101',
            guestName: 'M. Karim Benali',
            bookingId: 'bkg_1',
            validFrom: '2026-10-25 14:00',
            validUntil: '2026-10-28 12:00',
            issuedAt: '2026-10-25 14:05',
            issuedBy: 'Réception (Mina)',
            rawHex: 'A55A0101CV101A8B2F100000000FF',
            status: 'active',
          },
          {
            id: 'card_demo_2',
            cardNumber: '04C3D9E4',
            cardType: 'staff',
            roomNumber: 'Tous les étages (Master)',
            guestName: 'Gouvernante Générale (Fatima)',
            validFrom: '2026-10-01 07:00',
            validUntil: '2026-12-31 22:00',
            issuedAt: '2026-10-01 07:15',
            issuedBy: 'Direction Générale',
            rawHex: 'A55A0201FFFFC3D9E400000000FF',
            status: 'active',
          },
        ];
        this.saveCards();
      }
    } catch (e) {
      console.warn('[LockManager] Error loading cards:', e);
    }
  }

  private saveCards() {
    try {
      localStorage.setItem('omnibook_prousb_cards', JSON.stringify(this.cards));
      this.cardListeners.forEach((l) => l(this.cards));
    } catch (e) {
      console.warn('[LockManager] Error saving cards:', e);
    }
  }

  private async autoDetectPairedDevices() {
    if (typeof window === 'undefined' || !('hid' in navigator)) return;

    try {
      const devices = await (navigator as any).hid.getDevices();
      if (devices && devices.length > 0) {
        const dev = devices[0];
        if (!dev.opened) {
          try {
            await dev.open();
          } catch (e) {
            console.warn('[LockManager] Auto-open existing device failed:', e);
          }
        }
        this.hidDevice = dev;
        this.status = 'connected';
        this.notifyConnection();
      }

      // Listen to hardware hotplug events
      (navigator as any).hid.addEventListener('connect', (event: any) => {
        console.log('[LockManager] WebHID Device connected:', event.device);
        this.hidDevice = event.device;
        this.status = 'connected';
        this.notifyConnection();
      });

      (navigator as any).hid.addEventListener('disconnect', (event: any) => {
        console.log('[LockManager] WebHID Device disconnected:', event.device);
        if (this.hidDevice === event.device) {
          this.hidDevice = null;
          this.status = 'disconnected';
          this.notifyConnection();
        }
      });
    } catch (err) {
      console.warn('[LockManager] autoDetectPairedDevices error:', err);
    }
  }

  /**
   * Prominently requested by user:
   * Triggers browser permission dialog via navigator.hid.requestDevice
   */
  public async initializeHardware(): Promise<{ success: boolean; message: string }> {
    if (typeof window === 'undefined' || !('hid' in navigator)) {
      this.status = 'unsupported';
      this.notifyConnection();
      return {
        success: false,
        message: "L'API WebHID n'est pas prise en charge par ce navigateur. Utilisez Chrome, Edge, Chromium ou Opera.",
      };
    }

    this.status = 'connecting';
    this.notifyConnection();

    try {
      // Standard ProUSB and generic USB HID encoder filters
      // Passing filters: [] opens the browser prompt showing all connected USB HID devices
      const devices = await (navigator as any).hid.requestDevice({
        filters: [],
      });

      if (!devices || devices.length === 0) {
        this.status = 'disconnected';
        this.notifyConnection();
        return {
          success: false,
          message: 'Aucun périphérique USB sélectionné ou autorisation refusée par l’utilisateur.',
        };
      }

      const selectedDevice = devices[0];
      if (!selectedDevice.opened) {
        await selectedDevice.open();
      }

      this.hidDevice = selectedDevice;
      this.status = 'connected';
      this.notifyConnection();

      // Listen for input reports from physical reader
      try {
        this.hidDevice.addEventListener('inputreport', (event: any) => {
          this.handleInputReport(event);
        });
      } catch (e) {
        console.warn('[LockManager] inputreport listener warning:', e);
      }

      // Audible confirmation beep
      await this.sendEncoderBeep();

      return {
        success: true,
        message: `Encodeur ProUSB connecté avec succès : ${selectedDevice.productName || 'USB HID RFID Encoder'} (VID: 0x${selectedDevice.vendorId.toString(16).toUpperCase()})`,
      };
    } catch (err: any) {
      console.error('[LockManager] Hardware init failed:', err);
      this.status = 'disconnected';
      this.notifyConnection();
      return {
        success: false,
        message: err.message || 'Erreur lors de la demande d’autorisation USB WebHID.',
      };
    }
  }

  public async disconnectHardware(): Promise<void> {
    if (this.hidDevice && this.hidDevice.opened) {
      try {
        await this.hidDevice.close();
      } catch (e) {
        console.warn('[LockManager] Error closing device:', e);
      }
    }
    this.hidDevice = null;
    this.status = 'disconnected';
    this.notifyConnection();
  }

  public async sendEncoderBeep(): Promise<void> {
    if (this.hidDevice && this.hidDevice.opened) {
      try {
        // Standard USB HID Output report for ProUSB beeper / LED command:
        // Report ID: 0x01, command: 0xA5 0x01 (Beep 100ms)
        const reportData = new Uint8Array([0xa5, 0x01, 0x02, 0x00, 0x00, 0x5a]);
        await this.hidDevice.sendReport(0, reportData);
        return;
      } catch (e) {
        console.warn('[LockManager] Hardware sendReport beep failed, fallback to audio context:', e);
      }
    }

    // Audible Web Audio feedback fallback
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // AudioContext unavailable
    }
  }

  private handleInputReport(event: any) {
    const { data } = event;
    if (!data) return;
    const hexArr: string[] = [];
    for (let i = 0; i < data.byteLength; i++) {
      hexArr.push(data.getUint8(i).toString(16).padStart(2, '0').toUpperCase());
    }
    console.log('[LockManager] Hardware report received:', hexArr.join(' '));
  }

  public getStatus(): UsbConnectionStatus {
    return this.status;
  }

  public getDeviceInfo(): UsbDeviceInfo | null {
    if (!this.hidDevice) return null;
    return {
      productName: this.hidDevice.productName || 'ProUSB Mifare RFID Encoder',
      vendorId: this.hidDevice.vendorId || 0x0416,
      productId: this.hidDevice.productId || 0x5131,
      opened: !!this.hidDevice.opened,
      serialNumber: this.hidDevice.serialNumber || 'SN-78419-PRO',
    };
  }

  public subscribeConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.status, this.getDeviceInfo());
    return () => this.connectionListeners.delete(listener);
  }

  public subscribeCards(listener: CardListener): () => void {
    this.cardListeners.add(listener);
    listener(this.cards);
    return () => this.cardListeners.delete(listener);
  }

  private notifyConnection() {
    const dev = this.getDeviceInfo();
    this.connectionListeners.forEach((l) => l(this.status, dev));
  }

  /**
   * Encodes a new guest card and writes to physical encoder if available
   */
  public async issueGuestCard(params: {
    roomNumber: string;
    guestName: string;
    validFrom: string;
    validUntil: string;
    bookingId?: string;
    issuedBy?: string;
  }): Promise<IssuedLockCard> {
    const randomUid = Math.random().toString(16).substring(2, 10).toUpperCase();
    const hexPayload = `A55A0101${params.roomNumber.replace(/[^A-Za-z0-9]/g, '')}${randomUid}00000000FF`;

    const newCard: IssuedLockCard = {
      id: `card_${Date.now()}`,
      cardNumber: randomUid,
      cardType: 'guest',
      roomNumber: params.roomNumber,
      guestName: params.guestName,
      bookingId: params.bookingId,
      validFrom: params.validFrom,
      validUntil: params.validUntil,
      issuedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      issuedBy: params.issuedBy || 'Réception',
      rawHex: hexPayload,
      status: 'active',
    };

    // If physical encoder connected, send write sector command
    if (this.hidDevice && this.hidDevice.opened) {
      try {
        const report = new Uint8Array(64);
        report[0] = 0x02; // Write sector command
        report[1] = 0x04; // Block 4 (guest data block)
        for (let i = 0; i < Math.min(hexPayload.length / 2, 16); i++) {
          report[2 + i] = parseInt(hexPayload.substr(i * 2, 2), 16) || 0;
        }
        await this.hidDevice.sendReport(0, report);
      } catch (e) {
        console.warn('[LockManager] Physical card write notice:', e);
      }
    }

    await this.sendEncoderBeep();

    this.cards = [newCard, ...this.cards];
    this.saveCards();
    return newCard;
  }

  /**
   * Helper called by AppContext when a reservation is confirmed
   */
  public async issueGuestCardFromBooking(
    booking: {
      id: string;
      guestName: string;
      resourceName: string;
      startDate: string;
      endDate: string;
    },
    issuedBy: string
  ): Promise<IssuedLockCard> {
    return this.issueGuestCard({
      roomNumber: booking.resourceName,
      guestName: booking.guestName,
      validFrom: `${booking.startDate} 14:00`,
      validUntil: `${booking.endDate} 12:00`,
      bookingId: booking.id,
      issuedBy,
    });
  }

  public revokeCard(cardId: string): boolean {
    const card = this.cards.find((c) => c.id === cardId);
    if (!card) return false;
    card.status = 'revoked';
    this.saveCards();
    this.sendEncoderBeep();
    return true;
  }

  public getCards(): IssuedLockCard[] {
    return this.cards;
  }
}

export const lockManager = new LockManager();
