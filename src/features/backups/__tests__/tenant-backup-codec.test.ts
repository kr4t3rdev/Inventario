import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
const compressionSpies = vi.hoisted(() => ({ gzip: vi.fn(), gunzip: vi.fn() }));
vi.mock('node:zlib', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:zlib')>();
  return {
    ...original,
    gzipSync: (...args: Parameters<typeof original.gzipSync>) => {
      compressionSpies.gzip(...args);
      return original.gzipSync(...args);
    },
    gunzipSync: (...args: Parameters<typeof original.gunzipSync>) => {
      compressionSpies.gunzip(...args);
      return original.gunzipSync(...args);
    },
  };
});
import { decodeTenantBackup, encodeTenantBackup } from '../tenant-backup/codec';
import type { CodecContext, CodecLimits, KeyResolver, PersistedBackupMetadata, TenantPayload } from '../tenant-backup/codec';

const context: CodecContext = {
  backupLogId: 'backup-123',
  tenantId: 'tenant-456',
  createdAt: '2026-10-22T12:00:00.000Z',
  storagePath: 'tenant-backups/v2/backup-123.tbk',
  storageProfileId: 'private-store-a',
};
const limits: CodecLimits = {
  maxEnvelopeBytes: 65536,
  maxHeaderBytes: 4096,
  maxCompressedBytes: 32768,
  maxInflatedBytes: 32768,
  maxRows: 20,
  maxRowsPerModel: 20,
  maxModels: 10,
};
const key = Buffer.alloc(32, 9);
const resolveKey: KeyResolver = (id) => id === 'key-a' ? key : undefined;
const payload: TenantPayload = {
  tables: [{ model: 'Producto', rows: [{ id: { type: 'string', value: 'p-1' },
    costo: { type: 'decimal', value: '12345678901234567890.00100' },
    sequence: { type: 'bigint', value: '9007199254740993' },
    createdAt: { type: 'datetime', value: '2026-10-22T11:59:00.000Z' },
    image: { type: 'bytes', value: 'AAEC/w==' },
    jsonNull: { type: 'json', value: 'null' },
    jsonLexemes: { type: 'json', value: '[0.25,1.0,1e-3,9007199254740993]' } }] }],
};

/**
 * @description Modifica el sobre de prueba sin alterar la forma JSON exterior.
 * @param {Uint8Array} envelope - Sobre serializado original.
 * @param {(outer: Record<string, string>) => void} update - Cambio adversarial de prueba.
 * @returns {Buffer} Sobre modificado y serializado.
 */
function editEnvelope(envelope: Uint8Array, update: (outer: Record<string, string>) => void) {
  const outer = JSON.parse(Buffer.from(envelope).toString('utf8')) as Record<string, string>;
  update(outer);
  return Buffer.from(JSON.stringify(outer));
}

async function sealed() {
  return encodeTenantBackup({ context, payload, keyId: 'key-a', key, limits });
}
/**
 * @description Firma bytes de prueba para ejercitar encabezados autenticados adversariales.
 * @param {Buffer} header - Bytes de encabezado de prueba.
 * @param {Buffer} payload - Bytes comprimidos de prueba.
 * @returns {Buffer} Sobre de prueba firmado con la clave fija del fixture.
 */
function signedEnvelope(header: Buffer, payload: Buffer) {
  const lengths = Buffer.alloc(8);
  lengths.writeUInt32BE(header.length, 0);
  lengths.writeUInt32BE(payload.length, 4);
  const framed = Buffer.concat([Buffer.from('TCP-TENANT-BACKUP-V2\0'), lengths, header, payload]);
  const mac = createHmac('sha256', key).update(framed).digest();
  return Buffer.from(JSON.stringify({ header: header.toString('base64'),
    payload: payload.toString('base64'), mac: mac.toString('base64') }));
}
/**
 * @description Cambia un campo de metadatos confiables para verificar el rechazo.
 * @param {PersistedBackupMetadata} metadata - Metadatos del artefacto válido.
 * @param {keyof PersistedBackupMetadata} key - Campo que se alterará.
 * @returns {PersistedBackupMetadata} Copia alterada usada solo por la prueba.
 */
function alteredMetadata(metadata: PersistedBackupMetadata, key: keyof PersistedBackupMetadata) {
  const next = { ...metadata } as Record<string, unknown>;
  const current = next[key];
  next[key] = typeof current === 'number' ? current + 1 : `${String(current)}-other`;
  return next as unknown as PersistedBackupMetadata;
}

describe('tenant backup codec', () => {
  it('round-trips exact tagged scalar representations bound to log and storage context', async () => {
    const artifact = await sealed();
    const decoded = await decodeTenantBackup({ envelope: artifact.envelope, expected: artifact.metadata,
      resolveKey, limits });
    expect(decoded.payload).toEqual(payload);
    expect(decoded.header.storagePath).toBe(context.storagePath);
    expect(decoded.header.storageProfileId).toBe(context.storageProfileId);
    expect(decoded.payload.tables[0].rows[0].jsonNull).toEqual({ type: 'json', value: 'null' });
    expect(decoded.payload.tables[0].rows[0].jsonLexemes).toEqual({
      type: 'json', value: '[0.25,1.0,1e-3,9007199254740993]',
    });
  });

  it.each([
    ['header bytes', (outer: Record<string, string>) => { outer.header = outer.header.slice(0, -4) + 'AAAA'; }],
    ['payload bytes', (outer: Record<string, string>) => { outer.payload = outer.payload.slice(0, -4) + 'AAAA'; }],
    ['MAC', (outer: Record<string, string>) => { outer.mac = outer.mac.slice(0, -4) + 'AAAA'; }],
  ])('rejects tampered %s before returning data', async (_name, update) => {
    const artifact = await sealed();
    await expect(decodeTenantBackup({ envelope: editEnvelope(artifact.envelope, update),
      expected: artifact.metadata, resolveKey, limits })).rejects.toThrow();
  });

  it.each([
    ['log', { ...context, backupLogId: 'backup-other' }],
    ['tenant', { ...context, tenantId: 'tenant-other' }],
    ['path', { ...context, storagePath: 'tenant-backups/v2/other.tbk' }],
    ['profile', { ...context, storageProfileId: 'other-store' }],
  ])('rejects mismatched expected %s context', async (_name, expected) => {
    const artifact = await sealed();
    await expect(decodeTenantBackup({ envelope: artifact.envelope,
      expected: { ...artifact.metadata, ...expected }, resolveKey, limits })).rejects.toThrow();
  });

  it('rejects unknown key IDs and unsupported envelope schemas', async () => {
    const artifact = await sealed();
    await expect(decodeTenantBackup({ envelope: artifact.envelope, expected: artifact.metadata,
      resolveKey: () => undefined, limits })).rejects.toThrow();
    const bad = editEnvelope(artifact.envelope, (outer) => { outer.header = Buffer.from(JSON.stringify({
      format: 'tcp-tenant-backup', formatVersion: 99,
    })).toString('base64'); });
    await expect(decodeTenantBackup({ envelope: bad, expected: artifact.metadata,
      resolveKey, limits })).rejects.toThrow();
  });

  it('rejects noncanonical base64 and outer-envelope overflow', async () => {
    const artifact = await sealed();
    const envelope = editEnvelope(artifact.envelope, (outer) => { outer.payload += '\n'; });
    await expect(decodeTenantBackup({ envelope, expected: artifact.metadata, resolveKey, limits }))
      .rejects.toThrow();
    await expect(decodeTenantBackup({ envelope: Buffer.alloc(limits.maxEnvelopeBytes + 1),
      expected: (await sealed()).metadata, resolveKey, limits })).rejects.toThrow();
  });

  it('rejects unsafe raw numbers and enforces the configured model/row and inflate limits', async () => {
    const unsafe = { tables: [{ model: 'Producto', rows: [{ id: 9007199254740993 }] }] };
    await expect(encodeTenantBackup({ context, payload: unsafe as unknown as TenantPayload,
      keyId: 'key-a', key, limits })).rejects.toThrow();
    const tiny = { ...limits, maxInflatedBytes: 32 };
    const artifact = await sealed();
    await expect(decodeTenantBackup({ envelope: artifact.envelope, expected: artifact.metadata,
      resolveKey, limits: tiny })).rejects.toThrow();
    const noModels = { ...limits, maxModels: 0 };
    await expect(encodeTenantBackup({ context, payload, keyId: 'key-a', key,
      limits: noModels })).rejects.toThrow();
    const noCompressed = { ...limits, maxCompressedBytes: 1 };
    await expect(encodeTenantBackup({ context, payload, keyId: 'key-a', key,
      limits: noCompressed })).rejects.toThrow();
    const invalidLimits = { ...limits, maxEnvelopeBytes: Number.NaN };
    await expect(encodeTenantBackup({ context, payload, keyId: 'key-a', key,
      limits: invalidLimits })).rejects.toThrow();
    const noRows = { ...limits, maxRows: 0 };
    await expect(encodeTenantBackup({ context, payload, keyId: 'key-a', key,
      limits: noRows })).rejects.toThrow();
  });

  it('binds every persisted header field to trusted metadata before inflate', async () => {
    const artifact = await sealed();
    const fields: Array<keyof PersistedBackupMetadata> = [
      'formatVersion', 'dataSchemaVersion', 'integrityKeyId', 'payloadDigest',
      'compressedBytes', 'uncompressedBytes', 'rowCount', 'tableCount',
      'backupLogId', 'tenantId', 'createdAt', 'storagePath', 'storageProfileId',
    ];
    for (const field of fields) {
      await expect(decodeTenantBackup({ envelope: artifact.envelope,
        expected: alteredMetadata(artifact.metadata, field), resolveKey, limits })).rejects.toThrow();
    }
    const oversizedLimits = { ...limits, maxInflatedBytes: artifact.metadata.uncompressedBytes - 1 };
    compressionSpies.gunzip.mockClear();
    await expect(decodeTenantBackup({ envelope: artifact.envelope, expected: artifact.metadata,
      resolveKey, limits: oversizedLimits })).rejects.toThrow('Unsupported or invalid header');
    expect(compressionSpies.gunzip).not.toHaveBeenCalled();
  });

  it('rejects missing, extra, and non-finite limit configuration before compression', async () => {
    const invalid = [
      ...Object.keys(limits).map((key) => Object.fromEntries(
        Object.entries(limits).filter(([name]) => name !== key),
      )),
      { ...limits, unrecognizedLimit: 1 },
      { ...limits, maxInflatedBytes: Number.POSITIVE_INFINITY },
    ];
    compressionSpies.gzip.mockClear();
    for (const badLimits of invalid) {
      await expect(encodeTenantBackup({ context, payload, keyId: 'key-a', key,
        limits: badLimits as unknown as CodecLimits })).rejects.toThrow();
    }
    expect(compressionSpies.gzip).not.toHaveBeenCalled();
    const artifact = await sealed();
    compressionSpies.gunzip.mockClear();
    for (const badLimits of invalid) {
      await expect(decodeTenantBackup({ envelope: artifact.envelope, expected: artifact.metadata,
        resolveKey, limits: badLimits as unknown as CodecLimits })).rejects.toThrow();
    }
    expect(compressionSpies.gunzip).not.toHaveBeenCalled();
  });

  it('rejects malformed object shapes, dangerous field names, and non-plain rows', async () => {
    const extraTable = { tables: [{ model: 'Producto', rows: [], extra: true }] };
    const extraCell = { tables: [{ model: 'Producto', rows: [{ id: { type: 'string', value: '1', extra: true } }] }] };
    await expect(encodeTenantBackup({ context, payload: extraTable as unknown as TenantPayload,
      keyId: 'key-a', key, limits })).rejects.toThrow();
    await expect(encodeTenantBackup({ context, payload: extraCell as unknown as TenantPayload,
      keyId: 'key-a', key, limits })).rejects.toThrow();
    for (const name of ['__proto__', 'constructor', 'prototype']) {
      const row = Object.fromEntries([[name, { type: 'string', value: 'x' }]]);
      await expect(encodeTenantBackup({ context, payload: { tables: [{ model: 'Producto', rows: [row] }] },
        keyId: 'key-a', key, limits })).rejects.toThrow();
    }
    await expect(encodeTenantBackup({ context, payload: null as unknown as TenantPayload,
      keyId: 'key-a', key, limits })).rejects.toThrow();
    await expect(encodeTenantBackup({ context, payload: { tables: [null] } as unknown as TenantPayload,
      keyId: 'key-a', key, limits })).rejects.toThrow();
    await expect(encodeTenantBackup({ context, payload: { tables: [{ model: 'Producto', rows: [null] }] } as unknown as TenantPayload,
      keyId: 'key-a', key, limits })).rejects.toThrow();
    const row = Object.assign(new Date(), { id: { type: 'string', value: '1' } });
    await expect(encodeTenantBackup({ context, payload: { tables: [{ model: 'Producto', rows: [row] }] },
      keyId: 'key-a', key, limits })).rejects.toThrow();
  });

  it('rejects unknown signed header and outer keys before inflation', async () => {
    const artifact = await sealed();
    const outer = JSON.parse(Buffer.from(artifact.envelope).toString('utf8')) as Record<string, string>;
    const headerBytes = Buffer.from(outer.header, 'base64');
    const header = JSON.parse(headerBytes.toString('utf8')) as Record<string, unknown>;
    header.extra = 'not allowed';
    const payloadBytes = Buffer.from(outer.payload, 'base64');
    const badHeader = signedEnvelope(Buffer.from(JSON.stringify(header)), payloadBytes);
    compressionSpies.gunzip.mockClear();
    await expect(decodeTenantBackup({ envelope: badHeader, expected: artifact.metadata, resolveKey, limits }))
      .rejects.toThrow('Invalid header shape');
    expect(compressionSpies.gunzip).not.toHaveBeenCalled();
    const badOuter = editEnvelope(artifact.envelope, (value) => { value.extra = 'x'; });
    await expect(decodeTenantBackup({ envelope: badOuter, expected: artifact.metadata, resolveKey, limits }))
      .rejects.toThrow('Invalid envelope');
  });

  it('rejects malformed JSON cells and signed count mismatches', async () => {
    const malformedJson = { tables: [{ model: 'Producto', rows: [{
      value: { type: 'json', value: '{"broken":' },
    }] }] };
    await expect(encodeTenantBackup({ context, payload: malformedJson as unknown as TenantPayload,
      keyId: 'key-a', key, limits })).rejects.toThrow();
    const artifact = await sealed();
    const outer = JSON.parse(Buffer.from(artifact.envelope).toString('utf8')) as Record<string, string>;
    const header = JSON.parse(Buffer.from(outer.header, 'base64').toString('utf8')) as Record<string, unknown>;
    header.rowCount = artifact.metadata.rowCount + 1;
    const updated = { ...artifact.metadata, rowCount: artifact.metadata.rowCount + 1 };
    await expect(decodeTenantBackup({ envelope: signedEnvelope(Buffer.from(JSON.stringify(header)),
      Buffer.from(outer.payload, 'base64')), expected: updated, resolveKey, limits }))
      .rejects.toThrow('Payload count mismatch');
  });

  it('rejects malformed UTF-8 in the authenticated header and inflated payload', async () => {
    const artifact = await sealed();
    const outer = JSON.parse(Buffer.from(artifact.envelope).toString('utf8')) as Record<string, string>;
    const payloadBytes = Buffer.from(outer.payload, 'base64');
    await expect(decodeTenantBackup({ envelope: signedEnvelope(Buffer.from([0xff]), payloadBytes),
      expected: artifact.metadata, resolveKey, limits })).rejects.toThrow();
    const { gzipSync } = await import('node:zlib');
    const invalidRaw = gzipSync(Buffer.from([0xff]));
    const header = { ...JSON.parse(Buffer.from(outer.header, 'base64').toString('utf8')) as Record<string, unknown>,
      compressedBytes: invalidRaw.length, uncompressedBytes: 1,
      payloadDigest: createHash('sha256').update(invalidRaw).digest('hex') };
    const metadata = { ...artifact.metadata, compressedBytes: invalidRaw.length,
      uncompressedBytes: 1, payloadDigest: header.payloadDigest as string };
    await expect(decodeTenantBackup({ envelope: signedEnvelope(Buffer.from(JSON.stringify(header)), invalidRaw),
      expected: metadata, resolveKey, limits })).rejects.toThrow();
  });

  it('rejects malformed UTF-8 at the envelope boundary', async () => {
    await expect(decodeTenantBackup({ envelope: Buffer.from([0xff, 0xfe]),
      expected: (await sealed()).metadata, resolveKey, limits })).rejects.toThrow();
  });

});
