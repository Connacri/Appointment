/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * proUSB Lock Manager High-Level Coordinator
 * Orchestrates card issuing, lock commissioning, audit log streaming, and device communication.
 */

import {
  LockTransport,
  WebHidTransport,
  MockLockTransport,
  readCard,
  writeCard,
  buzzer,
  iniCard,
  readRecord,
  IniMode,
  toHex,
  parseResponse,
} from './protocol';
import {
  DecodedProUsbCard,
  LockAuditRecord,
  ProUsbLockSettings,
  ProUsbCardType,
} from './cards/types';
import {
  EncodeGuestCardParams,
  EncodeMasterCardParams,
  EncodeCommissioningCardParams,
  encodeGuestCard,
  encodeMasterCard,
  encodeCommissioningCard,
  decodeCardRecord,
} from './cards/codec';
import {
  MdbReader,
  MdbCardInfo,
  MdbRecordOpen,
  CardLockDatabase,
} from './database';

export interface TransportLogEntry {
  id: string;
  timestamp: string;
  direction: 'tx' | 'rx' | 'info' | 'error';
  message: string;
  dataHex?: string;
}

export interface IssuedCardRecord {
  id: string;
  rawHex: string;
  type: ProUsbCardType;
  cardIndex: number;
  roomNumber?: string;
  holderName: string;
  operator: string;
  issuedAt: string;
  status: 'active' | 'revoked' | 'checked_out' | 'expired';
  validUntil: string;
}

const initialSettings: ProUsbLockSettings = {
  companyName: 'OmniBook Luxury Hotel & Clinic',
  hotelName: 'Grand Hotel Oran',
  skin: 'mxskin20.skn',
  checkoutTime: '12:00:00',
  vipCheckoutTime: '14:00:00',
  guestAccessBolt: true,
  alarmForcedPin: true,
  remindCloseDoor: true,
  dontDisturbMode: true,
  lockAfterReleaseKnob: true,
  ignoreCoverFunction: false,
  defaultBuildingNo: 1,
};

const initialSampleAuditRecords: LockAuditRecord[] = [
  {
    orderFlag: 1,
    recDataHex: '12ED033BFCC409FF',
    openTime: '2026-10-23T14:22:10.000Z',
    eventType: 'guest_open',
    cardIdentifier: 'C912-GUEST-01',
    roomNo: '101',
  },
  {
    orderFlag: 2,
    recDataHex: 'FF8481018098FFFF',
    openTime: '2026-10-23T11:05:40.000Z',
    eventType: 'master_open',
    cardIdentifier: 'C912-MASTER-01',
    roomNo: '101',
  },
  {
    orderFlag: 3,
    recDataHex: '033B12EDFCC40900',
    openTime: '2026-10-22T19:40:15.000Z',
    eventType: 'guest_open',
    cardIdentifier: 'C912-GUEST-02',
    roomNo: '205',
  },
  {
    orderFlag: 4,
    recDataHex: 'A001991580981116',
    openTime: '2026-10-21T08:12:00.000Z',
    eventType: 'emergency_open',
    cardIdentifier: 'C912-EMERGENCY',
    roomNo: '104',
  },
];

class LockManager {
  private webHidTransport = new WebHidTransport();
  private mockTransport = new MockLockTransport();
  private useSimulator = true; // default to simulator so it works everywhere out of the box
  private logs: TransportLogEntry[] = [];
  private logListeners: Array<(logs: TransportLogEntry[]) => void> = [];
  private stateListeners: Array<() => void> = [];
  
  // MDB Integration
  private mdbReader = new MdbReader();
  private mdbLoaded = false;

  private issuedCards: IssuedCardRecord[] = this.loadIssuedCards();
  private auditRecords: LockAuditRecord[] = this.loadAuditRecords();
  private settings: ProUsbLockSettings = this.loadSettings();

  constructor() {
    this.setupTransportLogging(this.webHidTransport);
    this.setupTransportLogging(this.mockTransport);
    // Attempt to load MDB data on startup (async, non-blocking)
    this.loadMdbData();
  }

  private loadIssuedCards(): IssuedCardRecord[] {
    try {
      const saved = localStorage.getItem('omnibook_prousb_issued_cards');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[LockManager] Failed to load issued cards from localStorage:', e);
    }
    return [
      {
        id: 'card-1',
        rawHex: 'C91224B6E3818101016265DB1565E300',
        type: 'guest',
        cardIndex: 2,
        roomNumber: '101',
        holderName: 'Karim Mansouri',
        operator: 'Admin',
        issuedAt: '2026-10-23T10:00:00Z',
        status: 'active',
        validUntil: '2026-10-27 12:00',
      },
      {
        id: 'card-2',
        rawHex: 'C9121722FF00298000B919D2C029D5FB',
        type: 'master',
        cardIndex: 9,
        holderName: 'Direction Générale (Passe)',
        operator: 'SuperAdmin',
        issuedAt: '2026-10-20T08:00:00Z',
        status: 'active',
        validUntil: '2026-12-31 23:59',
      },
      {
        id: 'card-3',
        rawHex: 'C912033BE38582010169E25BC1E26300',
        type: 'guest',
        cardIndex: 9,
        roomNumber: '205',
        holderName: 'Sophie Benali',
        operator: 'Admin',
        issuedAt: '2026-10-22T14:30:00Z',
        status: 'active',
        validUntil: '2026-10-25 12:00',
      },
    ];
  }

  private saveIssuedCards(): void {
    try {
      localStorage.setItem('omnibook_prousb_issued_cards', JSON.stringify(this.issuedCards));
    } catch (e) {
      console.warn('[LockManager] Failed to save issued cards:', e);
    }
  }

  private loadAuditRecords(): LockAuditRecord[] {
    try {
      const saved = localStorage.getItem('omnibook_prousb_audit_records');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[LockManager] Failed to load audit records from localStorage:', e);
    }
    return [...initialSampleAuditRecords];
  }

  private saveAuditRecords(): void {
    try {
      localStorage.setItem('omnibook_prousb_audit_records', JSON.stringify(this.auditRecords));
    } catch (e) {
      console.warn('[LockManager] Failed to save audit records:', e);
    }
  }

  private loadSettings(): ProUsbLockSettings {
    try {
      const saved = localStorage.getItem('omnibook_prousb_settings');
      if (saved) {
        return { ...initialSettings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('[LockManager] Failed to load settings from localStorage:', e);
    }
    return { ...initialSettings };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('omnibook_prousb_settings', JSON.stringify(this.settings));
    } catch (e) {
      console.warn('[LockManager] Failed to save settings:', e);
    }
  }

  private async loadMdbData(): Promise<void> {
    try {
      const connected = await this.mdbReader.connect();
      if (!connected) {
        console.warn('[LockManager] MDB connection not available (browser environment), using mock data');
        return;
      }

      const db = await this.mdbReader.readAll();
      this.mdbLoaded = true;

      // Convert MDB CardInfo to IssuedCardRecord
      this.issuedCards = db.cardInfo.map((card, idx) => ({
        id: `mdb-card-${card.ID}`,
        rawHex: card.CardData,
        type: this.mapCardTypeFromDai(card.CardType),
        cardIndex: card.CardData ? parseInt(card.CardData.slice(18, 20), 16) & 0x0f : 1,
        roomNumber: card.RoomNo,
        holderName: card.Holder || `Client ${card.ID}`,
        operator: 'MDB Import',
        issuedAt: card.IssueDate ? new Date(card.IssueDate).toISOString() : new Date().toISOString(),
        status: card.Status === 1 ? 'active' : card.Status === 2 ? 'checked_out' : 'expired',
        validUntil: card.ExpiryDate || 'N/A',
      }));

      // Convert MDB RecordOpen to LockAuditRecord
      this.auditRecords = db.recordOpen.map((rec) => ({
        orderFlag: rec.OrderFlag,
        recDataHex: rec.RecData,
        openTime: rec.OpenTime,
        eventType: this.mapEventType(rec.CardType),
        cardIdentifier: rec.CardNo || `CARD-${rec.CardType.toString(16).toUpperCase()}`,
        roomNo: rec.RoomNo || '101',
      }));

      // Update settings from MDB SystemInfo
      if (db.systemInfo) {
        this.settings = {
          ...this.settings,
          companyName: db.systemInfo.CompanyName,
          hotelName: db.systemInfo.HotelName,
          skin: db.systemInfo.Skin,
          checkoutTime: db.systemInfo.CheckoutTime,
          vipCheckoutTime: db.systemInfo.VIPCheckoutTime,
          guestAccessBolt: db.systemInfo.GuestLLock === 1,
          alarmForcedPin: db.systemInfo.BaoJing === 128,
          remindCloseDoor: db.systemInfo.TiShi === 152,
        };
      }

      this.notifyStateListeners();
      console.log('[LockManager] MDB data loaded successfully:', {
        cards: this.issuedCards.length,
        auditRecords: this.auditRecords.length,
        settings: this.settings,
      });
    } catch (error) {
      console.warn('[LockManager] Failed to load MDB data, using mock data:', error);
    }
  }

  private mapCardTypeFromDai(cardType: number): ProUsbCardType {
    switch (cardType) {
      case 0x00: return 'reset';
      case 0x10: return 'record';
      case 0x20: return 'room_set';
      case 0x30: return 'time_set';
      case 0x40: return 'limit';
      case 0x50: return 'group_set';
      case 0x60: return 'guest';
      case 0x70: return 'checkout';
      case 0x80: return 'group';
      case 0xA0: return 'emergency';
      case 0xB0: return 'master';
      case 0xC0: return 'building';
      case 0xD0: return 'floor';
      default: return 'guest';
    }
  }

  private mapEventType(cardType: number): LockAuditRecord['eventType'] {
    switch (cardType) {
      case 0x60: return 'guest_open';
      case 0xB0: return 'master_open';
      case 0xA0: return 'emergency_open';
      case 0x10: return 'key_open';
      default: return 'guest_open';
    }
  }

  private setupTransportLogging(transport: LockTransport) {
    transport.onLog = (direction, message, data) => {
      const entry: TransportLogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour12: false }) + '.' + String(Date.now() % 1000).padStart(3, '0'),
        direction,
        message,
        dataHex: data ? toHex(data) : undefined,
      };

      this.logs.unshift(entry);
      if (this.logs.length > 100) this.logs.pop();
      this.notifyLogListeners();
    };
  }

  public getTransport(): LockTransport {
    return this.useSimulator ? this.mockTransport : this.webHidTransport;
  }

  public isUsingSimulator(): boolean {
    return this.useSimulator;
  }

  public setUseSimulator(value: boolean) {
    this.useSimulator = value;
    this.notifyStateListeners();
  }

  public getLogs(): TransportLogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    this.notifyLogListeners();
  }

  public subscribeLogs(listener: (logs: TransportLogEntry[]) => void): () => void {
    this.logListeners.push(listener);
    return () => {
      this.logListeners = this.logListeners.filter((l) => l !== listener);
    };
  }

  private notifyLogListeners() {
    for (const listener of this.logListeners) {
      listener([...this.logs]);
    }
  }

  public subscribeState(listener: () => void): () => void {
    this.stateListeners.push(listener);
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== listener);
    };
  }

  private notifyStateListeners() {
    for (const listener of this.stateListeners) {
      listener();
    }
  }

  public getIssuedCards(): IssuedCardRecord[] {
    return [...this.issuedCards];
  }

  public getAuditRecords(): LockAuditRecord[] {
    return [...this.auditRecords];
  }

  public getSettings(): ProUsbLockSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<ProUsbLockSettings>) {
    this.settings = { ...this.settings, ...partial };
    this.saveSettings();
    this.notifyStateListeners();
  }

  public getMockTransport(): MockLockTransport {
    return this.mockTransport;
  }

  /**
   * Connects to the active transport (WebHID or Simulator)
   */
  public async connect(): Promise<void> {
    const transport = this.getTransport();
    if (!transport.isOpen()) {
      await transport.open();
    }
    this.notifyStateListeners();
  }

  public async disconnect(): Promise<void> {
    const transport = this.getTransport();
    if (transport.isOpen()) {
      await transport.close();
    }
    this.notifyStateListeners();
  }

  /**
   * Plays the physical 3-beep confirmation test on the encoder
   */
  public async testBuzzer(): Promise<void> {
    const transport = this.getTransport();
    if (!transport.isOpen()) {
      await transport.open();
    }

    // Send 3 distinct beeps (600ms on, 200ms pause)
    for (let i = 0; i < 3; i += 1) {
      await transport.send(buzzer(1));
      await new Promise((r) => setTimeout(r, 200));
      await transport.send(buzzer(0));
      if (i < 2) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }

  /**
   * Reads and decodes the card currently in the encoder slot
   */
  public async readCurrentCard(): Promise<DecodedProUsbCard | null> {
    const transport = this.getTransport();
    if (!transport.isOpen()) {
      await transport.open();
    }

    await transport.send(readCard());
    const rawResp = await transport.receive(2500);
    if (!rawResp) {
      return null;
    }

    const parsed = parseResponse(rawResp);
    if (parsed.data.length < 16) {
      return null;
    }

    const decoded = decodeCardRecord(parsed.data.slice(0, 16));
    return decoded;
  }

  /**
   * Writes a verified 16-byte proUSB record to the card and verifies by reading it back
   */
  public async writeAndVerifyCard(record16: Uint8Array): Promise<DecodedProUsbCard> {
    const transport = this.getTransport();
    if (!transport.isOpen()) {
      await transport.open();
    }

    const frame = writeCard(record16);

    // Replay write up to 3 times with verification (idempotent protection against USB jitter)
    let verified = false;
    let decoded: DecodedProUsbCard | null = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await transport.send(frame);
      await new Promise((r) => setTimeout(r, 500));

      // Read back to confirm write
      await transport.send(readCard());
      const rawResp = await transport.receive(2500);
      if (rawResp) {
        const parsed = parseResponse(rawResp);
        if (parsed.data.length >= 16) {
          decoded = decodeCardRecord(parsed.data.slice(0, 16));
          if (decoded.rawHex === toHex(record16)) {
            verified = true;
            break;
          }
        }
      }
    }

    if (!verified || !decoded) {
      // In simulator, ensure it succeeds directly
      if (!this.isUsingSimulator()) {
        throw new Error("L'écriture n'a pas pu être vérifiée en relecture sur la carte.");
      }
      decoded = decodeCardRecord(record16);
    }

    return decoded;
  }

  /**
   * Issues an official proUSB Guest Card
   */
  public async issueGuestCard(
    params: EncodeGuestCardParams & { holderName: string; operator: string }
  ): Promise<IssuedCardRecord> {
    const recordBytes = encodeGuestCard(params);
    const decoded = await this.writeAndVerifyCard(recordBytes);

    const newRecord: IssuedCardRecord = {
      id: `card-${Date.now()}`,
      rawHex: decoded.rawHex,
      type: 'guest',
      cardIndex: decoded.cardIndex,
      roomNumber: params.roomNumber,
      holderName: params.holderName,
      operator: params.operator,
      issuedAt: new Date().toISOString(),
      status: 'active',
      validUntil: `${params.validity.endYear}-${String(params.validity.endMonth).padStart(2, '0')}-${String(params.validity.endDay).padStart(2, '0')} ${String(params.validity.endHour).padStart(2, '0')}:00`,
    };

    this.issuedCards.unshift(newRecord);
    this.saveIssuedCards();
    this.notifyStateListeners();
    return newRecord;
  }

  /**
   * Issues a Master, Floor, Building or Emergency Card
   */
  public async issueMasterCard(
    params: EncodeMasterCardParams & { holderName: string; operator: string }
  ): Promise<IssuedCardRecord> {
    const recordBytes = encodeMasterCard(params);
    const decoded = await this.writeAndVerifyCard(recordBytes);

    const newRecord: IssuedCardRecord = {
      id: `card-${Date.now()}`,
      rawHex: decoded.rawHex,
      type: params.cardType || 'master',
      cardIndex: decoded.cardIndex,
      holderName: params.holderName,
      operator: params.operator,
      issuedAt: new Date().toISOString(),
      status: 'active',
      validUntil: `${params.validity.endYear}-${String(params.validity.endMonth).padStart(2, '0')}-${String(params.validity.endDay).padStart(2, '0')} 23:59`,
    };

    this.issuedCards.unshift(newRecord);
    this.saveIssuedCards();
    this.notifyStateListeners();
    return newRecord;
  }

  /**
   * Performs the 3 lock commissioning steps
   */
  public async issueCommissioningCard(
    params: EncodeCommissioningCardParams & { operator: string }
  ): Promise<IssuedCardRecord> {
    let recordBytes: Uint8Array;

    if (params.type === 'reset') {
      // Step 1: IniCard reset
      const transport = this.getTransport();
      if (!transport.isOpen()) await transport.open();
      await transport.send(iniCard(IniMode.Step0));
      recordBytes = new Uint8Array(16);
      recordBytes[0] = 0xc9;
      recordBytes[9] = 0x00; // Reset card marker
    } else {
      recordBytes = encodeCommissioningCard(params);
      await this.writeAndVerifyCard(recordBytes);
    }

    const decoded = decodeCardRecord(recordBytes);
    const newRecord: IssuedCardRecord = {
      id: `card-${Date.now()}`,
      rawHex: decoded.rawHex,
      type: params.type === 'blacklist' ? 'limit' : params.type === 'reset' ? 'reset' : params.type as ProUsbCardType,
      cardIndex: decoded.cardIndex,
      roomNumber: params.roomNumber,
      holderName: `Mise en service (${params.type})`,
      operator: params.operator,
      issuedAt: new Date().toISOString(),
      status: 'active',
      validUntil: 'N/A',
    };

    this.issuedCards.unshift(newRecord);
    this.saveIssuedCards();
    this.notifyStateListeners();
    return newRecord;
  }

  /**
   * Issues a Guest Card from a booking (auto-integration with planning)
   */
  public async issueGuestCardFromBooking(
    booking: { id: string; guestName: string; unitName?: string; resourceName?: string; startDate: string; endDate: string },
    operator: string = 'Admin'
  ): Promise<IssuedCardRecord> {
    const roomNumber = (booking.unitName || booking.resourceName || '101').replace(/\D/g, '') || '101';
    const startParts = booking.startDate.split('-').map(Number);
    const endParts = booking.endDate.split('-').map(Number);

    return this.issueGuestCard({
      roomNumber,
      cardIndex: 1,
      holderName: booking.guestName,
      operator,
      validity: {
        startYear: startParts[0],
        startMonth: startParts[1],
        startDay: startParts[2],
        startHour: 14,
        endYear: endParts[0],
        endMonth: endParts[1],
        endDay: endParts[2],
        endHour: 12,
        endMinute: 0,
      },
      options: {
        allowDeadbolt: true,
        coverCardsBefore: true,
        openPublicDoor: false,
      },
    });
  }

  /**
   * Clears all persisted proUSB data (for reset)
   */
  public clearPersistedData(): void {
    localStorage.removeItem('omnibook_prousb_issued_cards');
    localStorage.removeItem('omnibook_prousb_audit_records');
    localStorage.removeItem('omnibook_prousb_settings');
    this.issuedCards = [];
    this.auditRecords = [];
    this.settings = { ...initialSettings };
    this.saveIssuedCards();
    this.saveAuditRecords();
    this.saveSettings();
    this.notifyStateListeners();
  }

  /**
   * Reads lock opening audit records using ReadRecord
   */
  public async readAuditLogFromCard(): Promise<LockAuditRecord[]> {
    const transport = this.getTransport();
    if (!transport.isOpen()) {
      await transport.open();
    }

    await transport.send(readRecord());
    const raw = await transport.receive(2500);

    if (raw && raw.length >= 12) {
      // Packet received from lock audit trail
      const auditEntry: LockAuditRecord = {
        orderFlag: this.auditRecords.length + 1,
        recDataHex: toHex(raw.slice(3, 11)),
        openTime: new Date().toISOString(),
        eventType: 'guest_open',
        cardIdentifier: `CARD-${toHex(raw.slice(3, 6))}`,
        roomNo: '101',
      };
      this.auditRecords.unshift(auditEntry);
      this.saveAuditRecords();
      this.notifyStateListeners();
    }

    return [...this.auditRecords];
  }
}

export const lockManager = new LockManager();
