import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

export interface CodecContext {
  backupLogId: string;
  tenantId: string;
  createdAt: string;
  storagePath: string;
  storageProfileId: string;
}
export interface CodecLimits {
  maxEnvelopeBytes: number;
  maxHeaderBytes: number;
  maxCompressedBytes: number;
  maxInflatedBytes: number;
  maxRows: number;
  maxRowsPerModel: number;
  maxModels: number;
}
export type KeyResolver = (keyId: string) => Uint8Array | undefined;
export type TypedCell = null | { type: 'string' | 'boolean'; value: string | boolean } |
  { type: 'decimal' | 'bigint' | 'datetime' | 'bytes' | 'json'; value: string };
export interface TenantPayload {
  tables: Array<{ model: string; rows: Array<Record<string, TypedCell>> }>;
}
export interface PersistedBackupMetadata extends CodecContext {
  formatVersion: 2;
  dataSchemaVersion: 1;
  backupType: 'tenant';
  integrityKeyId: string;
  payloadDigest: string;
  compressedBytes: number;
  uncompressedBytes: number;
  rowCount: number;
  tableCount: number;
}
export interface TenantBackupHeader extends PersistedBackupMetadata {
  format: 'tcp-tenant-backup';
  integrityAlgorithm: 'HMAC-SHA-256';
  payloadDigestAlgorithm: 'SHA-256';
  compression: 'gzip';
}
type Envelope = { header: string; payload: string; mac: string };
type SealInput = { context: CodecContext; payload: TenantPayload; keyId: string; key: Uint8Array; limits: CodecLimits };
type OpenInput = { envelope: Uint8Array; expected: PersistedBackupMetadata; resolveKey: KeyResolver; limits: CodecLimits };
type SealedArtifact = { envelope: Uint8Array; metadata: PersistedBackupMetadata };
const DOMAIN = Buffer.from('TCP-TENANT-BACKUP-V2\0', 'ascii');
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const HEX_256 = /^[a-f0-9]{64}$/;
const LIMIT_KEYS = ['maxCompressedBytes', 'maxEnvelopeBytes', 'maxHeaderBytes', 'maxInflatedBytes',
  'maxModels', 'maxRows', 'maxRowsPerModel'];
const METADATA_KEYS = ['backupLogId', 'backupType', 'compressedBytes', 'createdAt',
  'dataSchemaVersion', 'formatVersion', 'integrityKeyId', 'payloadDigest', 'rowCount',
  'storagePath', 'storageProfileId', 'tableCount', 'tenantId', 'uncompressedBytes'];
const HEADER_KEYS = [...METADATA_KEYS, 'compression', 'format', 'integrityAlgorithm',
  'payloadDigestAlgorithm'];
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const utf8 = new TextDecoder('utf-8', { fatal: true });

/**
 * @description Valida que el conjunto exacto de límites sea finito y coherente.
 * @param {CodecLimits} limits - Límites explícitos del proceso de codificación.
 * @returns {void} No retorna valor; lanza un error si la configuración no es segura.
 */
function assertLimits(limits: CodecLimits): void {
  if (!limits || typeof limits !== 'object' ||
      Object.keys(limits).sort().join(',') !== LIMIT_KEYS.join(',')) {
    throw new Error('Invalid codec limit keys');
  }
  const values = Object.values(limits);
  if (values.some((value) => !Number.isSafeInteger(value) || value < 1) ||
      limits.maxHeaderBytes >= limits.maxEnvelopeBytes ||
      limits.maxCompressedBytes >= limits.maxEnvelopeBytes || limits.maxRowsPerModel > limits.maxRows) {
    throw new Error('Invalid codec limits');
  }
}
/**
 * @description Valida la identidad, fecha y ruta canónica del respaldo.
 * @param {CodecContext} context - Contexto de respaldo generado por el servidor.
 * @returns {void} No retorna valor; lanza un error si el contexto no coincide con el formato.
 */
function assertContext(context: CodecContext): void {
  if (!IDENTIFIER.test(context.backupLogId) || !IDENTIFIER.test(context.tenantId) ||
      !IDENTIFIER.test(context.storageProfileId) ||
      context.storagePath !== `tenant-backups/v2/${context.backupLogId}.tbk` ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(context.createdAt) ||
      new Date(context.createdAt).toISOString() !== context.createdAt) {
    throw new Error('Invalid backup context');
  }
}
/**
 * @description Decodifica base64 estándar y exige su representación canónica.
 * @param {unknown} value - Texto base64 no confiable.
 * @returns {Buffer} Bytes decodificados.
 */
function strictBase64(value: unknown): Buffer {
  if (typeof value !== 'string' || value.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Invalid base64');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) throw new Error('Noncanonical base64');
  return decoded;
}
/**
 * @description Enmarca sin ambigüedad el encabezado y la carga para la MAC.
 * @param {Buffer} header - Bytes exactos del encabezado autenticado.
 * @param {Buffer} payload - Bytes comprimidos autenticados.
 * @returns {Buffer} Dominio, longitudes y contenido concatenados.
 */
function frame(header: Buffer, payload: Buffer): Buffer {
  const lengths = Buffer.alloc(8);
  lengths.writeUInt32BE(header.length, 0);
  lengths.writeUInt32BE(payload.length, 4);
  return Buffer.concat([DOMAIN, lengths, header, payload]);
}
/**
 * @description Calcula la HMAC SHA-256 con separación de dominio.
 * @param {Uint8Array} key - Clave de integridad inyectada.
 * @param {Buffer} header - Bytes exactos del encabezado.
 * @param {Buffer} payload - Bytes comprimidos exactos.
 * @returns {Buffer} Firma HMAC del artefacto.
 */
function macFor(key: Uint8Array, header: Buffer, payload: Buffer): Buffer {
  return createHmac('sha256', key).update(frame(header, payload)).digest();
}
/**
 * @description Comprueba que un objeto tenga exactamente las claves permitidas.
 * @param {object} value - Objeto que se está validando.
 * @param {string[]} keys - Claves obligatorias, sin claves adicionales.
 * @returns {boolean} Indica si el conjunto de claves coincide exactamente.
 */
function exactKeys(value: object, keys: string[]): boolean {
  return Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}
/**
 * @description Identifica objetos planos sin prototipos personalizados.
 * @param {unknown} value - Valor no confiable que se está validando.
 * @returns {boolean} Indica si el valor es un objeto plano.
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}
/**
 * @description Decodifica UTF-8 en modo estricto y rechaza secuencias inválidas.
 * @param {Buffer} value - Bytes codificados en UTF-8.
 * @returns {string} Texto decodificado sin reemplazos silenciosos.
 */
function parseUtf8(value: Buffer): string { return utf8.decode(value); }
/**
 * @description Compara cada campo firmado con los metadatos persistidos confiables.
 * @param {TenantBackupHeader} header - Encabezado autenticado del artefacto.
 * @param {PersistedBackupMetadata} expected - Metadatos obtenidos del registro autorizado.
 * @returns {void} No retorna valor; lanza un error ante cualquier diferencia.
 */
function bindingMatches(header: TenantBackupHeader, expected: PersistedBackupMetadata): void {
  assertContext(expected);
  for (const key of METADATA_KEYS as Array<keyof PersistedBackupMetadata>) {
    if (header[key] !== expected[key]) throw new Error('Backup metadata mismatch');
  }
}
/**
 * @description Valida forma, límites y celdas tipadas sin aplicar política de propiedad.
 * @param {unknown} value - Carga estructurada no confiable.
 * @param {CodecLimits} limits - Límites validados para esta operación.
 * @returns {void} No retorna valor; afirma el tipo o lanza un error de validación.
 */
function validatePayload(value: unknown, limits: CodecLimits): asserts value is TenantPayload {
  if (!isPlainRecord(value) || !exactKeys(value, ['tables']) || !Array.isArray(value.tables) ||
      value.tables.length < 1 || value.tables.length > limits.maxModels) throw new Error('Invalid payload');
  let count = 0;
  const models = new Set<string>();
  for (const table of value.tables) {
    if (!isPlainRecord(table) || !exactKeys(table, ['model', 'rows']) ||
        typeof table.model !== 'string' || !IDENTIFIER.test(table.model) ||
        !Array.isArray(table.rows) || models.has(table.model) ||
        table.rows.length > limits.maxRowsPerModel) throw new Error('Invalid table');
    models.add(table.model);
    count += table.rows.length;
    if (count > limits.maxRows) throw new Error('Row limit exceeded');
    for (const row of table.rows) {
      if (!isPlainRecord(row)) throw new Error('Invalid row');
      for (const [name, cell] of Object.entries(row)) {
        if (DANGEROUS_KEYS.has(name)) throw new Error('Unsafe field name');
        if (cell === null) continue;
        if (!isPlainRecord(cell) || !exactKeys(cell, ['type', 'value']) ||
            typeof cell.type !== 'string' || !('value' in cell)) throw new Error('Invalid typed cell');
        if (cell.type === 'string' && typeof cell.value === 'string') continue;
        if (cell.type === 'boolean' && typeof cell.value === 'boolean') continue;
        if (typeof cell.value !== 'string') throw new Error('Invalid typed scalar');
        if (cell.type === 'decimal' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(cell.value)) continue;
        if (cell.type === 'bigint' && /^-?(?:0|[1-9]\d*)$/.test(cell.value)) continue;
        if (cell.type === 'datetime' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(cell.value) &&
            new Date(cell.value).toISOString() === cell.value) continue;
        if (cell.type === 'bytes' && strictBase64(cell.value).toString('base64') === cell.value) continue;
        if (cell.type === 'json') { JSON.parse(cell.value); continue; }
        throw new Error('Unsupported or invalid typed scalar');
      }
    }
  }
}
/**
 * @description Valida el esquema exacto y los límites declarados del encabezado.
 * @param {unknown} header - Encabezado decodificado pero aún no confiable.
 * @param {CodecLimits} limits - Límites validados para esta operación.
 * @returns {void} No retorna valor; afirma el tipo o lanza un error de validación.
 */
function validateHeader(header: unknown, limits: CodecLimits): asserts header is TenantBackupHeader {
  if (!isPlainRecord(header) || !exactKeys(header, HEADER_KEYS)) throw new Error('Invalid header shape');
  const candidate = header as unknown as TenantBackupHeader;
  if (candidate.format !== 'tcp-tenant-backup' || candidate.formatVersion !== 2 ||
      candidate.dataSchemaVersion !== 1 || candidate.backupType !== 'tenant' ||
      candidate.compression !== 'gzip' || candidate.integrityAlgorithm !== 'HMAC-SHA-256' ||
      candidate.payloadDigestAlgorithm !== 'SHA-256' || !IDENTIFIER.test(candidate.integrityKeyId) ||
      !HEX_256.test(candidate.payloadDigest) || !Number.isSafeInteger(candidate.uncompressedBytes) ||
      candidate.uncompressedBytes < 0 || candidate.uncompressedBytes > limits.maxInflatedBytes ||
      !Number.isSafeInteger(candidate.compressedBytes) || candidate.compressedBytes < 1 ||
      candidate.compressedBytes > limits.maxCompressedBytes || !Number.isSafeInteger(candidate.tableCount) ||
      candidate.tableCount < 1 || candidate.tableCount > limits.maxModels ||
      !Number.isSafeInteger(candidate.rowCount) || candidate.rowCount < 0 ||
      candidate.rowCount > limits.maxRows) throw new Error('Unsupported or invalid header');
}

/**
 * @description Serializa, comprime y autentica una carga tenant sin acceso a servicios externos.
 * @param {SealInput} input - Contexto, carga, clave y límites inyectados.
 * @returns {Promise<SealedArtifact>} Bytes del sobre y metadatos para persistencia confiable.
 */
export async function encodeTenantBackup(input: SealInput): Promise<SealedArtifact> {
  assertLimits(input.limits);
  assertContext(input.context);
  if (input.key.length !== 32 || !IDENTIFIER.test(input.keyId)) throw new Error('Invalid key configuration');
  validatePayload(input.payload, input.limits);
  const raw = Buffer.from(JSON.stringify(input.payload), 'utf8');
  if (raw.length > input.limits.maxInflatedBytes) throw new Error('Payload limit exceeded');
  const compressed = gzipSync(raw);
  if (compressed.length > input.limits.maxCompressedBytes) throw new Error('Compressed limit exceeded');
  const rowCount = input.payload.tables.reduce((sum, table) => sum + table.rows.length, 0);
  const metadata: PersistedBackupMetadata = {
    ...input.context, formatVersion: 2, dataSchemaVersion: 1, backupType: 'tenant',
    integrityKeyId: input.keyId, payloadDigest: createHash('sha256').update(compressed).digest('hex'),
    compressedBytes: compressed.length, uncompressedBytes: raw.length,
    rowCount, tableCount: input.payload.tables.length,
  };
  const header: TenantBackupHeader = {
    ...metadata, format: 'tcp-tenant-backup', integrityAlgorithm: 'HMAC-SHA-256',
    payloadDigestAlgorithm: 'SHA-256', compression: 'gzip',
  };
  const headerBytes = Buffer.from(JSON.stringify(header), 'utf8');
  if (headerBytes.length > input.limits.maxHeaderBytes) throw new Error('Header limit exceeded');
  const envelope = Buffer.from(JSON.stringify({ header: headerBytes.toString('base64'),
    payload: compressed.toString('base64'), mac: macFor(input.key, headerBytes, compressed).toString('base64') } satisfies Envelope));
  if (envelope.length > input.limits.maxEnvelopeBytes) throw new Error('Envelope limit exceeded');
  return { envelope, metadata };
}

/**
 * @description Verifica metadatos persistidos y autenticidad antes de inflar la carga.
 * @param {OpenInput} input - Artefacto, metadatos persistidos, resolvedor de claves y límites.
 * @returns {Promise<{header: TenantBackupHeader; payload: TenantPayload}>} Encabezado y datos validados.
 */
export async function decodeTenantBackup(input: OpenInput): Promise<{header: TenantBackupHeader; payload: TenantPayload}> {
  assertLimits(input.limits);
  if (input.envelope.length > input.limits.maxEnvelopeBytes) throw new Error('Envelope limit exceeded');
  const outer = JSON.parse(parseUtf8(Buffer.from(input.envelope))) as Partial<Envelope>;
  if (!isPlainRecord(outer) || !exactKeys(outer, ['header', 'payload', 'mac'])) throw new Error('Invalid envelope');
  const headerBytes = strictBase64(outer.header);
  const compressed = strictBase64(outer.payload);
  const signature = strictBase64(outer.mac);
  if (headerBytes.length > input.limits.maxHeaderBytes || compressed.length > input.limits.maxCompressedBytes ||
      signature.length !== 32) throw new Error('Envelope component limit exceeded');
  const header = JSON.parse(parseUtf8(headerBytes)) as unknown;
  validateHeader(header, input.limits);
  bindingMatches(header, input.expected);
  if (header.compressedBytes !== compressed.length) throw new Error('Compressed size mismatch');
  const key = input.resolveKey(header.integrityKeyId);
  if (!key || key.length !== 32) throw new Error('Unknown integrity key');
  if (createHash('sha256').update(compressed).digest('hex') !== header.payloadDigest) {
    throw new Error('Payload digest mismatch');
  }
  if (!timingSafeEqual(signature, macFor(key, headerBytes, compressed))) {
    throw new Error('Artifact authentication failed');
  }
  const raw = gunzipSync(compressed, { maxOutputLength: input.limits.maxInflatedBytes });
  if (raw.length !== header.uncompressedBytes) throw new Error('Inflated size mismatch');
  const payload = JSON.parse(parseUtf8(raw)) as unknown;
  validatePayload(payload, input.limits);
  const rowCount = payload.tables.reduce((sum, table) => sum + table.rows.length, 0);
  if (payload.tables.length !== header.tableCount || rowCount !== header.rowCount) {
    throw new Error('Payload count mismatch');
  }
  return { header, payload };
}
