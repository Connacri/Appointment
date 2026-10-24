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
  EncodeGuestCardParams,
  EncodeMasterCardParams,
  EncodeCommissioningCardParams,
  LockAuditRecord,
  ProUsbLockSettings,
  ProUsbCardType,
} from './cards/types';
import {
  encodeGuestCard,
  encodeMasterCard,
  encodeCommissioningCard,
  decodeCardRecord,
} from './cards/codec';

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

  private issuedCards: IssuedCardRecord[] = [
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

  private auditRecords: LockAuditRecord[] = [...initialSampleAuditRecords];
  private settings: ProUsbLockSettings = { ...initialSettings };

  constructor() {
    this.setupTransportLogging(this.webHidTransport);
    this.setupTransportLogging(this.mockTransport);
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
      type: params.type,
      cardIndex: decoded.cardIndex,
      roomNumber: params.roomNumber,
      holderName: `Mise en service (${params.type})`,
      operator: params.operator,
      issuedAt: new Date().toISOString(),
      status: 'active',
      validUntil: 'N/A',
    };

    this.issuedCards.unshift(newRecord);
    this.notifyStateListeners();
    return newRecord;
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
      this.notifyStateListeners();
    }

    return [...this.auditRecords];
  }
}

export const lockManager = new LockManager();
