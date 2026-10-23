/**
 * Transport abstraction for the proUSB encoder.
 *
 * A transport only moves bytes: it knows how to open a device, send one report
 * and wait for one report back. Everything above it (frames, commands, card
 * codecs, domain logic) is transport-agnostic, so the same code runs over
 * WebHID, Android USB host, a local Windows agent, or the mock used in tests.
 *
 * Known hardware behaviour that the retry policy exists for:
 * - the reader re-enumerates intermittently (~1 probe in 3 misses);
 * - `cmd = 0xEC` (WriteCard) never sends a reply;
 * - some reads block for ~2 s and then return zeros.
 *
 * Reference: docs/re-proUSB/ENCODER.md §3 and CARD-API.md §5.
 */

import { type LockResponse, parseResponse } from './frames.ts';

/** The device could not be opened, was lost, or refused the transfer. */
export class TransportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TransportError';
  }
}

/** No complete response arrived before the deadline. */
export class LockTimeoutError extends TransportError {
  constructor(timeoutMs: number) {
    super(`no response from the encoder within ${timeoutMs} ms`);
    this.name = 'LockTimeoutError';
  }
}

/** The reader answered, but with a non-zero status byte. */
export class LockStatusError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`reader rejected the command with status 0x${status.toString(16).padStart(2, '0')}`);
    this.name = 'LockStatusError';
    this.status = status;
  }
}

/**
 * Minimal byte pipe to a card reader.
 *
 * Implementations must be safe to call `open()` twice and `close()` when not
 * open; the reader layer relies on that to recover from a lost device.
 */
export interface LockTransport {
  /** Stable identifier, useful in logs (`webhid`, `usb`, `agent`, `mock`). */
  readonly id: string;
  open(): Promise<void>;
  close(): Promise<void>;
  /** Send one host frame. May resolve before the device has processed it. */
  send(frame: Uint8Array): Promise<void>;
  /** Wait for one reader frame. Returns `null` on timeout instead of throwing. */
  receive(timeoutMs: number): Promise<Uint8Array | null>;
}

export interface TransactOptions {
  /** Deadline for a single response. Defaults to 2000 ms (hardware measured). */
  timeoutMs?: number;
  /** Total attempts on timeout or corruption. Defaults to 3. */
  attempts?: number;
  /** Delay between attempts. Defaults to 120 ms. */
  retryDelayMs?: number;
}

/**
 * Send a frame and decode the response, retrying the whole exchange.
 *
 * Retrying the exchange (not the receive) is deliberate: the reader only
 * answers the first read after a command, so a half-consumed response must be
 * flushed by issuing the command again.
 */
export async function transact(
  transport: LockTransport,
  frame: Uint8Array,
  options: TransactOptions = {},
): Promise<LockResponse> {
  const timeoutMs = options.timeoutMs ?? 2000;
  const attempts = Math.max(1, options.attempts ?? 3);
  const retryDelayMs = options.retryDelayMs ?? 120;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await transport.send(frame);
    const received = await transport.receive(timeoutMs);

    if (received) {
      try {
        return parseResponse(received);
      } catch (error) {
        lastError = error;
      }
    } else {
      lastError = new LockTimeoutError(timeoutMs);
    }

    if (attempt < attempts) await sleep(retryDelayMs);
  }

  throw lastError instanceof Error ? lastError : new TransportError('exchange failed');
}

/**
 * Scriptable in-memory transport.
 *
 * Used by the unit tests and by the UI when no encoder is plugged in, so every
 * screen can be exercised without hardware.
 */
export class MockTransport implements LockTransport {
  readonly id = 'mock';
  /** Every frame the caller sent, in order. Useful in tests. */
  readonly sent: Uint8Array[] = [];
  private opened = false;
  private responder: (frame: Uint8Array) => Uint8Array | null | Promise<Uint8Array | null>;

  constructor(responder: (frame: Uint8Array) => Uint8Array | null | Promise<Uint8Array | null>) {
    this.responder = responder;
  }

  /** Replace the behaviour without recreating the transport. */
  respondWith(responder: (frame: Uint8Array) => Uint8Array | null | Promise<Uint8Array | null>): void {
    this.responder = responder;
  }

  get isOpen(): boolean {
    return this.opened;
  }

  async open(): Promise<void> {
    this.opened = true;
  }

  async close(): Promise<void> {
    this.opened = false;
  }

  async send(frame: Uint8Array): Promise<void> {
    if (!this.opened) throw new TransportError('transport is not open');
    this.sent.push(frame.slice());
  }

  async receive(): Promise<Uint8Array | null> {
    const frame = this.sent[this.sent.length - 1];
    if (!frame) return null;
    return this.responder(frame);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
