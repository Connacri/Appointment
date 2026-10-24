/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * proUSB Transport Abstraction
 * - WebHID Transport: Direct browser/WebView USB HID connection (VID 0x9915, PID 0x1116)
 * - Mock Transport: High-fidelity simulator with Web Audio buzzer, realistic responses, and test logging
 */

import { parseResponse, LockResponse, toHex } from './frames';

export const PROUSB_VID = 0x9915;
export const PROUSB_PID = 0x1116;

export class TransportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TransportError';
  }
}

export class LockTimeoutError extends TransportError {
  constructor(timeoutMs: number) {
    super(`No response from encoder within ${timeoutMs}ms`);
    this.name = 'LockTimeoutError';
  }
}

export interface LockTransport {
  readonly id: string;
  readonly name: string;
  readonly isPhysical: boolean;
  isOpen(): boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  send(frame: Uint8Array): Promise<void>;
  receive(timeoutMs?: number): Promise<Uint8Array | null>;
  onLog?: (direction: 'tx' | 'rx' | 'info' | 'error', message: string, data?: Uint8Array) => void;
}

export interface TransactOptions {
  timeoutMs?: number;
  attempts?: number;
  retryDelayMs?: number;
}

export async function transact(
  transport: LockTransport,
  frame: Uint8Array,
  options: TransactOptions = {}
): Promise<LockResponse> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const attempts = Math.max(1, options.attempts ?? 3);
  const retryDelayMs = options.retryDelayMs ?? 300;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      // Ensure transport is open
      if (!transport.isOpen()) {
        await transport.open();
      }

      await transport.send(frame);
      const received = await transport.receive(timeoutMs);

      if (received) {
        try {
          return parseResponse(received);
        } catch (err) {
          lastError = err;
          transport.onLog?.('error', `Parse error on attempt ${attempt}: ${err}`);
        }
      } else {
        lastError = new LockTimeoutError(timeoutMs);
        transport.onLog?.('error', `Timeout on attempt ${attempt} (${timeoutMs}ms)`);
      }
    } catch (err) {
      lastError = err;
      transport.onLog?.('error', `Transport error on attempt ${attempt}: ${err}`);
    }

    if (attempt < attempts) {
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new TransportError('Exchange failed');
}

/**
 * WebHID Transport for real hardware in Chrome / Edge / WebView2
 */
export class WebHidTransport implements LockTransport {
  readonly id = 'webhid';
  readonly name = 'proUSB Encoder (USB HID)';
  readonly isPhysical = true;
  public onLog?: (direction: 'tx' | 'rx' | 'info' | 'error', message: string, data?: Uint8Array) => void;

  private device: any = null;
  private pendingResolvers: Array<(value: Uint8Array | null) => void> = [];
  private inputQueue: Uint8Array[] = [];

  isOpen(): boolean {
    return this.device !== null && this.device.opened;
  }

  // Add diagnostic method to list all HID devices
  async listAllDevices(): Promise<any[]> {
    if (typeof navigator === 'undefined' || !('hid' in navigator)) {
      return [];
    }
    try {
      const devices = await (navigator as any).hid.getDevices();
      return devices;
    } catch {
      return [];
    }
  }

  async open(): Promise<void> {
    if (typeof navigator === 'undefined' || !('hid' in navigator)) {
      throw new TransportError('WebHID API is not supported in this browser. Please use Chrome or Edge.');
    }

    try {
      this.onLog?.('info', `Requesting WebHID device with VID 0x${PROUSB_VID.toString(16)} PID 0x${PROUSB_PID.toString(16)}...`);
      
      // Try to get already paired devices first
      let devices = await (navigator as any).hid.getDevices();
      const matchingDevices = devices.filter((d: any) => d.vendorId === PROUSB_VID && d.productId === PROUSB_PID);
      
      if (matchingDevices.length === 0) {
        // No paired device, request new one
        devices = await (navigator as any).hid.requestDevice({
          filters: [{ vendorId: PROUSB_VID, productId: PROUSB_PID }],
        });
      } else {
        devices = matchingDevices;
      }

      if (!devices || devices.length === 0) {
        throw new TransportError('No proUSB encoder device selected.');
      }

      this.device = devices[0];
      if (!this.device.opened) {
        await this.device.open();
      }

      // Set up input report handler
      this.device.addEventListener('inputreport', (event: any) => {
        const { data, reportId } = event;
        const array = new Uint8Array(data.byteLength + 1);
        array[0] = reportId || 0x00;
        array.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), 1);

        this.onLog?.('rx', `Report 0x${reportId?.toString(16).padStart(2, '0') || '00'} received (${array.length} bytes)`, array);

        if (this.pendingResolvers.length > 0) {
          const resolver = this.pendingResolvers.shift()!;
          resolver(array);
        } else {
          this.inputQueue.push(array);
        }
      });

      // Handle device disconnection
      this.device.addEventListener('disconnect', () => {
        this.onLog?.('error', 'Device disconnected unexpectedly.');
        this.device = null;
        // Reject all pending resolvers
        for (const resolver of this.pendingResolvers) {
          resolver(null);
        }
        this.pendingResolvers = [];
      });

      this.onLog?.('info', `Connected to ${this.device.productName || 'proUSB-TEMIC'} (Serial: ${this.device.serialNumber || 'Reader_0000016'})`);
    } catch (err: any) {
      this.onLog?.('error', `Connection error: ${err.message}`);
      throw new TransportError(err.message, { cause: err });
    }
  }

  async close(): Promise<void> {
    if (this.device && this.device.opened) {
      await this.device.close();
      this.device = null;
      this.onLog?.('info', 'WebHID device closed.');
    }
  }

  async send(frame: Uint8Array): Promise<void> {
    if (!this.isOpen()) {
      throw new TransportError('Encoder is not connected. Open the device first.');
    }

    try {
      const reportId = 0x40; // Verified proUSB Output Report ID
      const payload = new Uint8Array(64); // 64 bytes report body
      payload.set(frame.slice(0, 64));

      this.onLog?.('tx', `Sending report 0x40 (${payload.length + 1} bytes)`, payload);
      await this.device.sendReport(reportId, payload);
      
      // Small delay to let the hardware process the command
      await new Promise(r => setTimeout(r, 50));
    } catch (err: any) {
      this.onLog?.('error', `Send error: ${err.message}`);
      // If device disconnected, mark as closed
      if (err.message?.includes('disconnected') || err.message?.includes('closed')) {
        this.device = null;
      }
      throw new TransportError(err.message, { cause: err });
    }
  }

  async receive(timeoutMs = 5000): Promise<Uint8Array | null> {
    if (this.inputQueue.length > 0) {
      return this.inputQueue.shift()!;
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.pendingResolvers.indexOf(resolver);
        if (idx !== -1) {
          this.pendingResolvers.splice(idx, 1);
        }
        resolve(null);
      }, timeoutMs);

      const resolver = (val: Uint8Array | null) => {
        clearTimeout(timer);
        resolve(val);
      };

      this.pendingResolvers.push(resolver);
    });
  }
}

/**
 * Mock Transport for interactive simulation, demonstrations and automated testing
 */
export class MockLockTransport implements LockTransport {
  readonly id = 'mock';
  readonly name = 'proUSB Simulator (High-Fidelity Virtual Encoder)';
  readonly isPhysical = false;
  public onLog?: (direction: 'tx' | 'rx' | 'info' | 'error', message: string, data?: Uint8Array) => void;

  private opened = false;
  private currentCard: Uint8Array | null = null;
  private inputQueue: Uint8Array[] = [];

  constructor() {
    // Seed with initial master card observed on hardware
    this.currentCard = new Uint8Array([
      0xc9, 0x12, 0x17, 0x22, 0xff, 0x00, 0x29, 0x80,
      0x00, 0xb9, 0x19, 0xd2, 0xc0, 0x29, 0xd5, 0xfb
    ]);
  }

  isOpen(): boolean {
    return this.opened;
  }

  async open(): Promise<void> {
    this.opened = true;
    this.onLog?.('info', 'Virtual proUSB-TEMIC Encoder connected (Simulation Mode).');
  }

  async close(): Promise<void> {
    this.opened = false;
    this.onLog?.('info', 'Virtual Encoder disconnected.');
  }

  setCardInSlot(card16: Uint8Array | null) {
    this.currentCard = card16 ? new Uint8Array(card16) : null;
    this.onLog?.('info', card16 ? `Card inserted into slot: ${toHex(card16)}` : 'Card removed from slot.');
  }

  getCardInSlot(): Uint8Array | null {
    return this.currentCard;
  }

  private playWebAudioBeep() {
    try {
      if (typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(2400, ctx.currentTime); // 2.4 kHz high pitch lock buzzer
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        }
      }
    } catch {
      // Audio might be blocked by browser autoplay policy
    }
  }

  async send(frame: Uint8Array): Promise<void> {
    if (!this.opened) {
      throw new TransportError('Simulator is not open.');
    }

    this.onLog?.('tx', `Simulated TX: ${toHex(frame)}`, frame);

    // Command Dispatching
    const cmd = frame[2];

    if (cmd === 0x80) {
      // Buzzer command
      this.playWebAudioBeep();
      this.onLog?.('info', '🔊 [Buzzer] Reader emitted audible beep confirmation.');
      return;
    }

    if (cmd === 0xec) {
      // WriteCard command: writes 16 bytes payload to current card
      const payload = frame.slice(3, 19);
      this.currentCard = new Uint8Array(16);
      this.currentCard.set(payload);
      this.playWebAudioBeep();
      this.onLog?.('info', `Card memory updated on slot: ${toHex(this.currentCard)}`);
      // Note: WriteCard produces no reply by design in proUSB
      return;
    }

    if (cmd === 0xe4) {
      // ReadCard command: returns 55 15 01 <20 bytes> <xor>
      if (!this.currentCard) {
        this.onLog?.('info', 'Slot is empty. No card detected.');
        return;
      }

      // Generate response frame (20 bytes: 16 bytes record + 4 bytes trailer)
      const data = new Uint8Array(20);
      data.set(this.currentCard);
      // Reader trailer (e.g. 50 50 00 83)
      data[16] = 0x50;
      data[17] = 0x50;
      data[18] = 0x00;
      data[19] = 0x83;

      const body = [0x55, 0x15, 0x01, ...Array.from(data)];
      let xor = 0;
      for (const b of body) xor ^= b & 0xff;
      const fullResponse = new Uint8Array([...body, xor, 0xff, 0xff, 0xff]);

      this.inputQueue.push(fullResponse);
      return;
    }

    if (cmd === 0x82) {
      // ReadRecord command: returns 37-byte audit packets
      const packet = new Uint8Array(65);
      packet[0] = 0x55;
      packet[1] = 0x25; // 37 bytes
      packet[2] = 0x01; // status ok
      // Simulated opening log: 12 ED 03 3B FC C4 09 FF
      packet.set([0x12, 0xed, 0x03, 0x3b, 0xfc, 0xc4, 0x09, 0xff], 3);
      packet[36] = 0x00; // Sequence 0
      this.inputQueue.push(packet);
      return;
    }
  }

  async receive(timeoutMs = 5000): Promise<Uint8Array | null> {
    if (this.inputQueue.length > 0) {
      const resp = this.inputQueue.shift()!;
      this.onLog?.('rx', `Simulated RX: ${toHex(resp)}`, resp);
      return resp;
    }

    // Small delay to simulate USB latency
    await new Promise((r) => setTimeout(r, 60));

    if (this.inputQueue.length > 0) {
      const resp = this.inputQueue.shift()!;
      this.onLog?.('rx', `Simulated RX: ${toHex(resp)}`, resp);
      return resp;
    }

    return null;
  }
}
