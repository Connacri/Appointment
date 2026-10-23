/**
 * Public surface of the proUSB protocol layer.
 *
 * Upper layers import from `@/locks/protocol` and never from a concrete
 * transport, so swapping WebHID for Android USB or the mock requires no change.
 */

export {
  FRAME_START,
  RESPONSE_START,
  MAX_PAYLOAD,
  FrameError,
  ChecksumError,
  xorChecksum,
  buildFrame,
  parseResponse,
  tryParseResponse,
  isAccepted,
  toHex,
  fromHex,
} from './frames.ts';
export type { LockResponse } from './frames.ts';

export {
  Op,
  IniMode,
  CARD_AREA_BYTES,
  E2_CHUNK_BYTES,
  readCard,
  buzzer,
  writeCard,
  iniCard,
  readRecord,
  readE2,
} from './commands.ts';
export type { IniModeValue } from './commands.ts';

export {
  TransportError,
  LockTimeoutError,
  LockStatusError,
  MockTransport,
  transact,
} from './transport.ts';
export type { LockTransport, TransactOptions } from './transport.ts';
