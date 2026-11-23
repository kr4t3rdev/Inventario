import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/secrets', () => ({
  getJwtSecret: () => 'test-mobile-sync-cursor-secret',
}));

import {
  decodeChangesCursor,
  decodeSnapshotPageToken,
  encodeChangesCursor,
  encodeSnapshotPageToken,
} from '../product-sync-cursor';

describe('mobile product sync cursors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('round-trips tenant-bound snapshot pagination state', () => {
    const token = encodeSnapshotPageToken({
      tenantId: 'tenant-a',
      lastId: 'product-10',
      watermark: '9223372036854775807',
    });

    expect(decodeSnapshotPageToken(token, 'tenant-a')).toEqual({
      tenantId: 'tenant-a',
      lastId: 'product-10',
      watermark: '9223372036854775807',
    });
  });

  it('round-trips a bounded incremental pull window', () => {
    const token = encodeChangesCursor({
      tenantId: 'tenant-a',
      after: '12',
      upperBound: '20',
    });

    expect(decodeChangesCursor(token, 'tenant-a')).toEqual({
      tenantId: 'tenant-a',
      after: '12',
      upperBound: '20',
    });
  });

  it('rejects tampered or cross-tenant cursors', () => {
    const token = encodeChangesCursor({
      tenantId: 'tenant-a',
      after: '12',
      upperBound: null,
    });

    expect(() => decodeChangesCursor(`${token}x`, 'tenant-a')).toThrow();
    expect(() => decodeChangesCursor(token, 'tenant-b')).toThrow();
  });

  it('rejects malformed and oversized cursor input', () => {
    expect(() => decodeSnapshotPageToken('not-a-cursor', 'tenant-a')).toThrow();
    expect(() => decodeChangesCursor('x'.repeat(4097), 'tenant-a')).toThrow();
  });
});
