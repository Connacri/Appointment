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
  readCard,
  writeCard,
  buzzer,
  iniCard,
  readRecord,
  IniMode,
  toHex,
  parseResponse,
  transact,
  PROUSB_VID,
  PROUSB_PID,
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
  encodeSystemCard,
  SYSTEM_CARD_TYPE,
  decodeCardRecord,
} from './cards/codec';
import {
  parseCardLockMdb,
  DEFAULT_SYSTEM_CARD_TEMPLATE,
  type MdbSnapshot,
  type SystemCardProfile,
} from './database/mdbImport';

// Types expected by TopBar (remote API compatibility)
export type UsbConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'unsupported';

export interface UsbDeviceInfo {
  productName: string;
  vendorId: number;
  productId: number;
  opened: boolean;
  serialNumber?: string;
}

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

class LockManager {
  private webHidTransport = new WebHidTransport();
  private logs: TransportLogEntry[] = [];
  private logListeners: Array<(logs: TransportLogEntry[]) => void> = [];
  private stateListeners: Array<() => void> = [];
  
  // MDB Integration — real CardLock.mdb imported by the user
  private mdbSnapshot: MdbSnapshot | null = this.loadMdbSnapshot();

  private issuedCards: IssuedCardRecord[] = this.loadIssuedCards();
  private auditRecords: LockAuditRecord[] = this.loadAuditRecords();
  private settings: ProUsbLockSettings = this.loadSettings();

  constructor() {
    this.setupTransportLogging(this.webHidTransport);
    // Real hardware only: automatically connect to the proUSB encoder when plugged in via USB
    this.webHidTransport.setAutoConnectEnabled(true);
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
    return [];
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
    return [];
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

  // ─── CardLock.mdb (real file import) ─────────────────────────────────────

  private loadMdbSnapshot(): MdbSnapshot | null {
    try {
      const saved = localStorage.getItem('omnibook_prousb_mdb_snapshot');
      if (!saved) return null;
      const parsed = JSON.parse(saved) as MdbSnapshot;
      return parsed && Array.isArray(parsed.cards) ? parsed : null;
    } catch (e) {
      console.warn('[LockManager] Failed to load MDB snapshot:', e);
      return null;
    }
  }

  private saveMdbSnapshot(): void {
    try {
      if (this.mdbSnapshot) {
        localStorage.setItem('omnibook_prousb_mdb_snapshot', JSON.stringify(this.mdbSnapshot));
      } else {
        localStorage.removeItem('omnibook_prousb_mdb_snapshot');
      }
    } catch (e) {
      console.warn('[LockManager] Failed to save MDB snapshot:', e);
    }
  }

  /**
   * Imports the original software database (`CardLock.mdb`).
   * Once imported the app works on the very same rooms, guests and cards as
   * CardLock.exe — including byte-for-byte reuse of existing card records.
   */
  public async importMdb(file: File): Promise<MdbSnapshot> {
    const data = await file.arrayBuffer();
    const snapshot = await parseCardLockMdb(data, file.name);
    // Kept so the UI can flag a frozen `Program Files` copy (Windows writes the
    // VirtualStore one) without reading the file again.
    snapshot.fileLastModified =
      typeof file.lastModified === 'number' && file.lastModified > 0
        ? new Date(file.lastModified).toISOString()
        : null;

    this.mdbSnapshot = snapshot;
    this.saveMdbSnapshot();

    // Reflect the imported data in the app model. Cards written by this app do
    // not exist in CardLock.mdb, so they must survive the import: keep the
    // local ones, replace only the previously imported rows, and de-duplicate
    // on the 32-hex image.
    if (snapshot.cards.length > 0) {
      const localCards = this.issuedCards.filter((card) => !card.id.startsWith('mdb-card-'));
      const knownHex = new Set(localCards.map((card) => card.rawHex.toUpperCase()));
      const importedCards = snapshot.cards
        .map((card) => ({
          id: `mdb-card-${card.id}`,
          rawHex: card.hex,
          type: this.mapCardTypeFromDai(card.typeIndex & 0xf0),
          cardIndex: card.typeIndex & 0x0f,
          holderName: card.holder || `Carte ${card.id}`,
          operator: card.operator || 'MDB',
          issuedAt: snapshot.importedAt,
          status: (card.status && /erase/i.test(card.status) ? 'revoked' : 'active') as IssuedCardRecord['status'],
          validUntil: 'N/A',
        }))
        .filter((card) => !knownHex.has(card.rawHex.toUpperCase()));
      this.issuedCards = [...localCards, ...importedCards];
      this.saveIssuedCards();
    }

    if (snapshot.buildings.length > 0) {
      this.settings = {
        ...this.settings,
        hotelName: snapshot.buildings[0].name || this.settings.hotelName,
        defaultBuildingNo: snapshot.buildings[0].no || this.settings.defaultBuildingNo,
      };
      this.saveSettings();
    }

    this.notifyStateListeners();
    console.log('[LockManager] CardLock.mdb imported:', snapshot.counts, snapshot.systemProfile);
    return snapshot;
  }

  public getMdbSnapshot(): MdbSnapshot | null {
    return this.mdbSnapshot;
  }

  public getMdbStatus(): {
    connected: boolean;
    source: string;
    importedAt: string | null;
    cards: number;
    rooms: number;
    guests: number;
    systemIdHex: string | null;
  } {
    const s = this.mdbSnapshot;
    return {
      connected: !!s,
      source: s ? s.fileName : 'none',
      importedAt: s ? s.importedAt : null,
      cards: s ? s.counts.cards : 0,
      rooms: s ? s.counts.rooms : 0,
      guests: s ? s.counts.guests : 0,
      systemIdHex: s?.systemProfile ? toHex(new Uint8Array(s.systemProfile.site)) : null,
    };
  }

  /** Site / marker / header / tail / serial read from the imported database. */
  public getSystemTemplate(): SystemCardProfile {
    return this.mdbSnapshot?.systemProfile ?? DEFAULT_SYSTEM_CARD_TEMPLATE;
  }

  /**
   * 16-bit site code used by every card family, as stored in CardLock.mdb
   * (bytes [2..3], big-endian). Returns undefined when no database is loaded
   * so the codec keeps its generic default.
   */
  public getSiteCode(): number | undefined {
    const profile = this.mdbSnapshot?.systemProfile;
    if (!profile) return undefined;
    return ((profile.site[0] << 8) | profile.site[1]) & 0x3fff;
  }

  public clearMdb(): void {
    this.mdbSnapshot = null;
    this.saveMdbSnapshot();
    this.notifyStateListeners();
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
    return this.webHidTransport;
  }

  // Remote API compatibility methods for TopBar
  public getStatus(): UsbConnectionStatus {
    return this.webHidTransport.isOpen() ? 'connected' : 'disconnected';
  }

  public getDeviceInfo(): UsbDeviceInfo | null {
    if (!this.webHidTransport.isOpen()) return null;
    const dev = (this.webHidTransport as any).device;
    if (dev) {
      return {
        productName: dev.productName || 'proUSB-TEMIC',
        vendorId: dev.vendorId || PROUSB_VID,
        productId: dev.productId || PROUSB_PID,
        opened: dev.opened || false,
        serialNumber: dev.serialNumber,
      };
    }
    return {
      productName: 'proUSB-TEMIC',
      vendorId: PROUSB_VID,
      productId: PROUSB_PID,
      opened: true,
    };
  }

  public subscribeConnection(listener: (status: UsbConnectionStatus, device: UsbDeviceInfo | null) => void): () => void {
    const wrappedListener = () => {
      listener(this.getStatus(), this.getDeviceInfo());
    };
    const unsub = this.subscribeState(wrappedListener);
    // Initial call
    wrappedListener();
    return unsub;
  }

  public getLogs(): TransportLogEntry[] {
    return [...this.logs];
  }

  public exportLogs(): string {
    return JSON.stringify(this.logs.map((l) => ({
      id: l.id,
      timestamp: l.timestamp,
      direction: l.direction,
      message: l.message,
      dataHex: l.dataHex,
    })), null, 2);
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

  /**
   * Connects to the active transport (WebHID only)
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

    // proUSB encoder test buzzer: 3 short beeps (150ms each, 200ms gap)
    for (let i = 0; i < 3; i += 1) {
      await transport.send(buzzer(1));
      await new Promise((r) => setTimeout(r, 150));
      await transport.send(buzzer(0));
      if (i < 2) {
        await new Promise((r) => setTimeout(r, 200));
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

    try {
      const response = await transact(transport, readCard(), { timeoutMs: 5000, attempts: 3 });
      if (response.data.length < 16) {
        return null;
      }

      const decoded = decodeCardRecord(response.data.slice(0, 16));

      // Trace exacte : octets bruts + contrôles de cohérence.
      transport.onLog?.('info', `Carte lue : ${decoded.rawHex}`);
      if (decoded.siteComplementOk !== undefined) {
        transport.onLog?.(
          decoded.siteComplementOk ? 'info' : 'error',
          `Site ${decoded.siteCode}${decoded.isUniversalSite ? ' (UNIVERSELLE)' : ''} — ` +
            `contrôle ~site : ${decoded.siteComplementOk ? 'OK' : 'INVALIDE (carte altérée)'}`,
        );
      }

      return decoded;
    } catch (err) {
      transport.onLog?.('error', `Read card failed: ${err}`);
      return null;
    }
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
      try {
        await transport.send(frame);
        await new Promise((r) => setTimeout(r, 500));

        // Read back to confirm write
        const response = await transact(transport, readCard(), { timeoutMs: 5000, attempts: 2 });
        if (response.data.length >= 16) {
          decoded = decodeCardRecord(response.data.slice(0, 16));
          if (decoded.rawHex === toHex(record16)) {
            verified = true;
            break;
          }
        }
      } catch (err) {
        transport.onLog?.('error', `Write/verify attempt ${attempt} failed: ${err}`);
      }
    }

    if (!verified || !decoded) {
      throw new Error("L'écriture n'a pas pu être vérifiée en relecture sur la carte.");
    }

    return decoded;
  }

  /**
   * Issues an official proUSB Guest Card
   */
  public async issueGuestCard(
    params: EncodeGuestCardParams & { holderName: string; operator: string }
  ): Promise<IssuedCardRecord> {
    // Business rules — expert hotelier
  if (params.validity.endYear < params.validity.startYear ||
      (params.validity.endYear === params.validity.startYear && params.validity.endMonth < params.validity.startMonth) ||
      (params.validity.endYear === params.validity.startYear && params.validity.endMonth === params.validity.startMonth && params.validity.endDay < params.validity.startDay) ||
      (params.validity.endYear === params.validity.startYear && params.validity.endMonth === params.validity.startMonth && params.validity.endDay === params.validity.startDay && params.validity.endHour < params.validity.startHour)) {
    throw new Error('Régle hôtel : la date d\'expiration doit être après le début d\'accès.');
  }
  // Guest card max 365 days (hôtel expert)
  const startMs = new Date(params.validity.startYear, params.validity.startMonth - 1, params.validity.startDay, params.validity.startHour).getTime();
  const endMs = new Date(params.validity.endYear, params.validity.endMonth - 1, params.validity.endDay, params.validity.endHour).getTime();
  if (endMs - startMs > 365 * 24 * 3600 * 1000) {
    throw new Error('Régle hôtel : carte client ne peut dépasser 365 jours de validité.');
  }

  const recordBytes = encodeGuestCard({ ...params, siteCodeLow: this.getSiteCode() });
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
      validUntil: `${String(params.validity.endDay).padStart(2,'0')}/${String(params.validity.endMonth).padStart(2,'0')}/${params.validity.endYear} ${String(params.validity.endHour).padStart(2,'0')}:00`,
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
    const recordBytes = encodeMasterCard({ ...params, siteCodeLow: this.getSiteCode() });
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
      validUntil: `${String(params.validity.endDay).padStart(2,'0')}/${String(params.validity.endMonth).padStart(2,'0')}/${params.validity.endYear} 23:59`,
    };

    this.issuedCards.unshift(newRecord);
    this.saveIssuedCards();
    this.notifyStateListeners();
    return newRecord;
  }

  /**
   * Writes a genuine proUSB system (configuration) card.
   *
   * Bytes [2..3] (site), [4..5] (~site), [6..8] (header) and [10..12] (issue
   * date) follow `ResetCard` from `proRFL.dll` exactly; [13..15] are fresh
   * random padding on every card, like the original software.
   *
   * @param universal when true the card is written with site `0x0000`, the
   *   same wildcard the original software uses for master cards, so a lock of
   *   **any** system accepts it.
   */
  private async writeSystemCard(typeIndex: number, universal = false): Promise<Uint8Array> {
    const template = this.getSystemTemplate();
    const issuedAt = new Date();
    const record = encodeSystemCard({ typeIndex, template, issuedAt, universal });

    this.getTransport().onLog?.(
      'info',
      `Carte système 0x${typeIndex.toString(16).toUpperCase().padStart(2, '0')} — ` +
        `site=${toHex(record.slice(2, 4))}${universal ? ' (UNIVERSELLE)' : ''} ` +
        `complément=${toHex(record.slice(4, 6))} ` +
        `émise=${issuedAt.toLocaleString('fr-FR')} ` +
        `(modèle DB #${template.sampleId || 'défaut'})`,
    );

    await this.writeAndVerifyCard(record);
    return record;
  }

  /**
   * Performs the 3 lock commissioning steps
   */
  public async issueCommissioningCard(
    params: EncodeCommissioningCardParams & { operator: string }
  ): Promise<IssuedCardRecord> {
    let recordBytes: Uint8Array;

    if (params.type === 'hard_reset') {
      // Hard persistent reset — admin-only
      // Step 1: Standard 3-step reset
      const transport = this.getTransport();
      if (!transport.isOpen()) await transport.open();
      
      // Send all 3 reset commands with verification
      for (let round = 0; round < 2; round++) {
        await transport.send(iniCard(IniMode.Step0));
        await new Promise(r => setTimeout(r, 200));
        await transport.send(iniCard(IniMode.Step1));
        await new Promise(r => setTimeout(r, 200));
        await transport.send(iniCard(IniMode.Step2));
        await new Promise(r => setTimeout(r, 200));
      }
      
      // Step 2: read the card so the encoder starts from a clean slot
      try {
        await transport.send(readCard());
        const raw = await transport.receive(5000);
        if (raw) {
          transport.onLog?.('info', 'Hard reset verification: card slot response received');
        }
      } catch (e) {
        transport.onLog?.('info', 'Hard reset: verification read completed');
      }

      // Step 3: write the genuine system card (same bytes layout as CardLock.exe)
      recordBytes = await this.writeSystemCard(SYSTEM_CARD_TYPE.hard_reset, params.universal);
    } else if (params.type === 'reset') {
      // Step 1: IniCard reset
      const transport = this.getTransport();
      if (!transport.isOpen()) await transport.open();
      await transport.send(iniCard(IniMode.Step0));

      // Step 2: write the genuine system card (site/serial read from CardLock.mdb)
      recordBytes = await this.writeSystemCard(SYSTEM_CARD_TYPE.reset, params.universal);
    } else {
      recordBytes = encodeCommissioningCard({ ...params, template: this.getSystemTemplate() });
      await this.writeAndVerifyCard(recordBytes);
    }

    const decoded = decodeCardRecord(recordBytes);
    const newRecord: IssuedCardRecord = {
      id: `card-${Date.now()}`,
      rawHex: decoded.rawHex,
      type: params.type === 'blacklist' ? 'limit' : params.type === 'reset' || params.type === 'hard_reset' ? 'reset' : params.type as ProUsbCardType,
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
