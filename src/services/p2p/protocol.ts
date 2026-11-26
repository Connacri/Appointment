/**
 * Appointment P2P event protocol v1.
 *
 * This module is deliberately transport- and storage-independent. IndexedDB and
 * SQLite persist the same immutable event envelope; transports only exchange
 * validated envelopes. Concurrent business mutations are retained as conflicts,
 * never silently resolved with last-write-wins.
 */

export type P2pOperation = 'upsert' | 'delete';

/**
 * Entities whose immutable mutations may be exchanged between trusted peers.
 * This registry is intentionally broader than the cloud Outbox: a peer event
 * must not imply that Supabase has a table or dispatcher for that entity.
 */
export const P2P_SUPPORTED_ENTITIES = [
  'booking',
  'resource',
  'resource_group',
  'establishment',
  'task',
  'stock_item',
  'stock_movement',
  'supplier',
  'purchase_order',
  'invoice',
  'dynamic_rate',
  'staff_member',
  'establishment_profile',
] as const;
export type P2pEntity = typeof P2P_SUPPORTED_ENTITIES[number];

/** Entities with an implemented Supabase push dispatcher. Keep this allowlist narrow. */
export const SUPABASE_OUTBOX_ENTITIES = [
  'booking',
  'resource',
  'resource_group',
  'establishment',
  'task',
  'stock_item',
  'stock_movement',
  'supplier',
  'purchase_order',
  'staff_member',
  'establishment_profile',
] as const;
export type OutboxEntity = typeof SUPABASE_OUTBOX_ENTITIES[number];

const RFC3339_TIMESTAMP =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function isValidRfc3339Timestamp(value: string): boolean {
  if (!RFC3339_TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = month === 2
    ? (leapYear ? 29 : 28)
    : ([4, 6, 9, 11].includes(month) ? 30 : 31);
  return day >= 1 && day <= daysInMonth;
}

export const MAX_P2P_CLOCK_NODES = 256;
export const MAX_P2P_BATCH_EVENTS = 500;
export const MAX_P2P_BATCH_BYTES = 4 * 1024 * 1024;

export function validateP2pBatchSize(eventCount: number, totalBytes: number): boolean {
  return Number.isSafeInteger(eventCount)
    && Number.isSafeInteger(totalBytes)
    && eventCount >= 0
    && eventCount <= MAX_P2P_BATCH_EVENTS
    && totalBytes >= 0
    && totalBytes <= MAX_P2P_BATCH_BYTES;
}
export const MAX_P2P_NODE_ID_LENGTH = 128;
export const MAX_P2P_ENTITY_LENGTH = 128;
export const MAX_P2P_ENTITY_ID_LENGTH = 256;

/** Empty pages may not advance a durable cursor and skip unseen events. */
export function validateP2pAckAdvance(
  expectedCursor: number,
  offeredCursor: number,
  acknowledgedCursor: number,
): boolean {
  return Number.isSafeInteger(expectedCursor)
    && Number.isSafeInteger(offeredCursor)
    && Number.isSafeInteger(acknowledgedCursor)
    && expectedCursor >= 0
    && offeredCursor >= expectedCursor
    && acknowledgedCursor === offeredCursor;
}

export function validateP2pCursorAdvance(
  expectedCursor: number,
  nextCursor: number,
  eventCount: number,
): boolean {
  return Number.isSafeInteger(expectedCursor)
    && Number.isSafeInteger(nextCursor)
    && Number.isSafeInteger(eventCount)
    && expectedCursor >= 0
    && nextCursor >= expectedCursor
    && eventCount >= 0
    && (eventCount === 0 ? nextCursor === expectedCursor : nextCursor > expectedCursor);
}

export interface NewP2pEvent<TPayload = Record<string, unknown>> {
  nodeId: string;
  workspaceId: string;
  entity: P2pEntity;
  entityId: string;
  operation: P2pOperation;
  payload: TPayload | null;
  createdAt: string;
  observedClock: Readonly<Record<string, number>>;
}

/** Create a validated immutable event from the persisted causal frontier. */
export function createP2pEvent<TPayload = Record<string, unknown>>(
  draft: NewP2pEvent<TPayload>,
): P2pEvent<TPayload> {
  const { sequence, clock } = nextP2pClock(draft.observedClock, draft.nodeId);
  const event: P2pEvent<TPayload> = {
    protocolVersion: 1,
    eventId: `${draft.nodeId}:${sequence}`,
    nodeId: draft.nodeId,
    sequence,
    workspaceId: draft.workspaceId,
    entity: draft.entity,
    entityId: draft.entityId,
    operation: draft.operation,
    payload: draft.payload,
    clock,
    createdAt: draft.createdAt,
  };
  validateP2pEvent(event);
  if (new TextEncoder().encode(JSON.stringify(event)).byteLength > 1024 * 1024) {
    throw new Error('P2P event exceeds the 1 MiB persistence limit.');
  }
  return event;
}

export interface P2pEvent<TPayload = Record<string, unknown>> {
  protocolVersion: 1;
  eventId: string;
  nodeId: string;
  sequence: number;
  workspaceId: string;
  entity: P2pEntity;
  entityId: string;
  operation: P2pOperation;
  payload: TPayload | null;
  /** Per-node causal frontier observed when this event was authored. */
  clock: Record<string, number>;
  createdAt: string;
}

export type P2pRecordState<TPayload = Record<string, unknown>> =
  | { kind: 'missing' }
  | { kind: 'resolved'; event: P2pEvent<TPayload> }
  | { kind: 'conflict'; events: P2pEvent<TPayload>[] };

export function validateP2pEvent<TPayload>(event: P2pEvent<TPayload>): void {
  if (event.protocolVersion !== 1) throw new Error('Unsupported P2P protocol version.');
  if (!event.nodeId.trim() || !event.workspaceId.trim() || !event.entity.trim() || !event.entityId.trim()) {
    throw new Error('P2P event identity and scope fields are required.');
  }
  if (
    event.nodeId.length > MAX_P2P_NODE_ID_LENGTH
    || event.entity.length > MAX_P2P_ENTITY_LENGTH
    || event.entityId.length > MAX_P2P_ENTITY_ID_LENGTH
  ) {
    throw new Error('P2P event identity fields exceed their size limits.');
  }
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) {
    throw new Error('P2P event sequence must be a positive safe integer.');
  }
  if (event.eventId !== `${event.nodeId}:${event.sequence}`) {
    throw new Error('P2P event ID must match its node and sequence.');
  }
  if (!P2P_SUPPORTED_ENTITIES.includes(event.entity)) {
    throw new Error(`Unsupported P2P entity type: ${event.entity}`);
  }
  if (!isValidRfc3339Timestamp(event.createdAt)) {
    throw new Error('P2P event timestamp must be a valid RFC 3339 timestamp.');
  }
  switch (event.operation) {
    case 'upsert':
      if (
        event.payload === null
        || typeof event.payload !== 'object'
        || Array.isArray(event.payload)
      ) {
        throw new Error('P2P upsert events require a plain object payload.');
      }
      break;
    case 'delete':
      if (event.payload !== null) {
        throw new Error('P2P delete events must not contain a payload.');
      }
      break;
    default:
      throw new Error('Unsupported P2P event operation.');
  }
  const clockEntries = Object.entries(event.clock);
  if (clockEntries.length > MAX_P2P_CLOCK_NODES) {
    throw new Error('P2P event clock exceeds the supported 256-node limit.');
  }
  const ownSequence = event.clock[event.nodeId];
  if (ownSequence !== event.sequence) {
    throw new Error('P2P event clock must contain its own node sequence.');
  }
  for (const [nodeId, sequence] of clockEntries) {
    if (
      !nodeId.trim()
      || nodeId.length > MAX_P2P_NODE_ID_LENGTH
      || !Number.isSafeInteger(sequence)
      || sequence < 1
    ) {
      throw new Error('P2P event clock contains an invalid node or sequence.');
    }
  }
}

export function happensBefore<TPayload>(a: P2pEvent<TPayload>, b: P2pEvent<TPayload>): boolean {
  if (a.eventId === b.eventId) return false;

  let strictlyAfter = false;
  for (const [nodeId, aSequence] of Object.entries(a.clock)) {
    const bSequence = b.clock[nodeId] ?? 0;
    if (bSequence < aSequence) return false;
    if (bSequence > aSequence) strictlyAfter = true;
  }
  for (const [nodeId, bSequence] of Object.entries(b.clock)) {
    if (!Object.prototype.hasOwnProperty.call(a.clock, nodeId) && bSequence > 0) {
      strictlyAfter = true;
    }
  }
  return strictlyAfter;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Set-union merge. Reusing an event ID with different content is node equivocation. */
export function mergeP2pEvents<TPayload>(
  local: readonly P2pEvent<TPayload>[],
  incoming: readonly P2pEvent<TPayload>[],
): P2pEvent<TPayload>[] {
  const merged = new Map<string, P2pEvent<TPayload>>();
  for (const event of [...local, ...incoming]) {
    validateP2pEvent(event);
    const existing = merged.get(event.eventId);
    if (existing && stableJson(existing) !== stableJson(event)) {
      throw new Error(`P2P event ID collision or node equivocation: ${event.eventId}`);
    }
    merged.set(event.eventId, event);
  }
  return [...merged.values()].sort((a, b) =>
    a.nodeId.localeCompare(b.nodeId) || a.sequence - b.sequence || a.eventId.localeCompare(b.eventId),
  );
}

/** Returns causally maximal events for one entity; concurrent writes remain visible. */
export function maximalP2pEvents<TPayload>(
  events: readonly P2pEvent<TPayload>[],
): P2pEvent<TPayload>[] {
  const maximal = events.filter((candidate) =>
    !events.some((other) => happensBefore(candidate, other)),
  );
  return [...maximal].sort((a, b) =>
    a.nodeId.localeCompare(b.nodeId) || a.sequence - b.sequence || a.eventId.localeCompare(b.eventId),
  );
}

export function getP2pRecordState<TPayload>(
  events: readonly P2pEvent<TPayload>[],
): P2pRecordState<TPayload> {
  if (events.length === 0) return { kind: 'missing' };
  const frontier = maximalP2pEvents(events);
  if (frontier.length === 1) return { kind: 'resolved', event: frontier[0] };
  return { kind: 'conflict', events: frontier };
}

/** Build the next local causal clock without mutating the supplied frontier. */
export function nextP2pClock(
  observed: Readonly<Record<string, number>>,
  nodeId: string,
): { sequence: number; clock: Record<string, number> } {
  if (!nodeId.trim()) throw new Error('P2P node ID is required.');
  const clock = { ...observed };
  const sequence = (clock[nodeId] ?? 0) + 1;
  if (!Number.isSafeInteger(sequence)) throw new Error('P2P node sequence exhausted.');
  clock[nodeId] = sequence;
  return { sequence, clock };
}
