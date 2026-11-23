import { createHmac, timingSafeEqual } from 'node:crypto';

import { getJwtSecret } from '@/lib/secrets';

const MAX_CURSOR_LENGTH = 4096;
const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;
const TOKEN_PATTERN = /^([A-Za-z0-9_-]+)\.([A-Fa-f0-9]{64})$/;

interface CursorPayloadBase {
  v: 1;
  tenantId: string;
}

interface SnapshotPagePayload extends CursorPayloadBase {
  kind: 'snapshot';
  lastId: string | null;
  watermark: string;
}

interface ChangesCursorPayload extends CursorPayloadBase {
  kind: 'changes';
  after: string;
  upperBound: string | null;
}

export interface SnapshotPageState {
  tenantId: string;
  lastId: string | null;
  watermark: string;
}

export interface ChangesCursorState {
  tenantId: string;
  after: string;
  upperBound: string | null;
}

export class InvalidProductSyncCursorError extends Error {
  constructor() {
    super('El cursor de sincronización no es válido.');
    this.name = 'InvalidProductSyncCursorError';
  }
}

function isSequence(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) {
    return false;
  }

  try {
    return BigInt(value) <= MAX_POSTGRES_BIGINT;
  } catch {
    return false;
  }
}

function signature(encodedPayload: string): Buffer {
  return createHmac('sha256', getJwtSecret())
    .update('mobile-product-sync-cursor:v1\0')
    .update(encodedPayload)
    .digest();
}

function encode(payload: SnapshotPagePayload | ChangesCursorPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${signature(encodedPayload).toString('hex')}`;
}

function decode<T extends SnapshotPagePayload | ChangesCursorPayload>(
  token: string,
  kind: T['kind'],
  tenantId: string,
): T {
  if (
    typeof token !== 'string'
    || token.length > MAX_CURSOR_LENGTH
    || typeof tenantId !== 'string'
    || tenantId.length === 0
  ) {
    throw new InvalidProductSyncCursorError();
  }

  const match = TOKEN_PATTERN.exec(token);
  if (!match) {
    throw new InvalidProductSyncCursorError();
  }

  const [, encodedPayload, encodedSignature] = match;
  const providedSignature = Buffer.from(encodedSignature, 'hex');
  const expectedSignature = signature(encodedPayload);
  if (
    providedSignature.length !== expectedSignature.length
    || !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw new InvalidProductSyncCursorError();
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidProductSyncCursorError();
  }

  if (
    !payload
    || typeof payload !== 'object'
    || !('v' in payload)
    || payload.v !== 1
    || !('kind' in payload)
    || payload.kind !== kind
    || !('tenantId' in payload)
    || payload.tenantId !== tenantId
  ) {
    throw new InvalidProductSyncCursorError();
  }

  if (kind === 'snapshot') {
    if (
      !('lastId' in payload)
      || (payload.lastId !== null && (typeof payload.lastId !== 'string' || payload.lastId.length > 255))
      || !('watermark' in payload)
      || !isSequence(payload.watermark)
    ) {
      throw new InvalidProductSyncCursorError();
    }
  } else if (
    !('after' in payload)
    || !isSequence(payload.after)
    || !('upperBound' in payload)
    || (payload.upperBound !== null && !isSequence(payload.upperBound))
    || (payload.upperBound !== null && BigInt(payload.upperBound) < BigInt(payload.after))
  ) {
    throw new InvalidProductSyncCursorError();
  }

  return payload as T;
}

export function encodeSnapshotPageToken(state: SnapshotPageState): string {
  if (
    !state.tenantId
    || state.tenantId.length > 255
    || (state.lastId !== null && state.lastId.length > 255)
    || !isSequence(state.watermark)
  ) {
    throw new InvalidProductSyncCursorError();
  }

  return encode({
    v: 1,
    kind: 'snapshot',
    tenantId: state.tenantId,
    lastId: state.lastId,
    watermark: state.watermark,
  });
}

export function decodeSnapshotPageToken(token: string, tenantId: string): SnapshotPageState {
  const payload = decode<SnapshotPagePayload>(token, 'snapshot', tenantId);
  return {
    tenantId: payload.tenantId,
    lastId: payload.lastId,
    watermark: payload.watermark,
  };
}

export function encodeChangesCursor(state: ChangesCursorState): string {
  if (
    !state.tenantId
    || state.tenantId.length > 255
    || !isSequence(state.after)
    || (state.upperBound !== null && !isSequence(state.upperBound))
    || (state.upperBound !== null && BigInt(state.upperBound) < BigInt(state.after))
  ) {
    throw new InvalidProductSyncCursorError();
  }

  return encode({
    v: 1,
    kind: 'changes',
    tenantId: state.tenantId,
    after: state.after,
    upperBound: state.upperBound,
  });
}

export function decodeChangesCursor(token: string, tenantId: string): ChangesCursorState {
  const payload = decode<ChangesCursorPayload>(token, 'changes', tenantId);
  return {
    tenantId: payload.tenantId,
    after: payload.after,
    upperBound: payload.upperBound,
  };
}
