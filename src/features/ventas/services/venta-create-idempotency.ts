import { createHash } from 'node:crypto';
import { Prisma } from '@/generated/prisma';
import type { Venta } from '@/generated/prisma';

/**
 * @description Generates a one-way hash for an idempotency key before storage.
 * @param {string} key - Client-provided idempotency key.
 * @returns {string} SHA-256 hex digest.
 */
export function hashVentaCreateKey(key: string): string {
	return createHash('sha256').update(key).digest('hex');
}

/**
 * @description Recognizes only the tenant+key receipt unique constraint error.
 * @param {unknown} error - Error raised by Prisma.
 * @returns {boolean} True only for the receipt's exact compound unique index.
 */
export function isVentaCreateReceiptUniqueViolation(error: unknown): boolean {
	if (
		!(error instanceof Prisma.PrismaClientKnownRequestError) ||
		error.code !== 'P2002'
	) {
		return false;
	}
	const target = error.meta?.target;
	if (Array.isArray(target)) {
		return target.length === 2 && target.includes('tenantId') && target.includes('keyHash');
	}
	return target === 'VentaCreateIdempotency_tenantId_keyHash_key' || target === 'tenantId_keyHash';
}

/**
 * @description Produces a stable fingerprint of the validated business payload.
 * @param {unknown} payload - Parsed create-sale payload without its request key.
 * @returns {string} SHA-256 hex digest of canonical JSON.
 */
export function fingerprintVentaCreatePayload(payload: unknown): string {
	return createHash('sha256').update(canonicalJson(normalizeVentaCreatePayload(payload))).digest('hex');
}

/**
 * @description Captures the original sale response in Prisma-compatible JSON.
 * @param {Record<string, unknown>} sale - Sale returned by Prisma create.
 * @returns {Prisma.InputJsonObject} Immutable response snapshot.
 */
export function snapshotVentaCreateResponse(
	sale: Record<string, unknown>,
): Prisma.InputJsonObject {
	return JSON.parse(JSON.stringify(sale)) as Prisma.InputJsonObject;
}

/**
 * @description Restores native Date fields from a persisted sale response snapshot.
 * @param {Prisma.JsonValue} snapshot - Stored immutable response snapshot.
 * @returns {T} Original scalar-only sale response shape.
 */
export function reviveVentaCreateResponse(snapshot: Prisma.JsonValue): Venta {
	if (snapshot === null || Array.isArray(snapshot) || typeof snapshot !== 'object') {
		throw new Error('Invalid product sale idempotency response snapshot');
	}
	const response: Record<string, unknown> = { ...snapshot };
	const scalarFields = [
		'ventaId', 'tenantId', 'productoId', 'cantidad', 'puntoDeVentaId', 'createdAt', 'updatedAt',
		'empleadoId', 'total', 'clienteId', 'ordenId', 'descuento', 'observaciones', 'esVentaUnica',
		'ofertaId', 'ventaPadreId', 'montoRecibidoEfectivo', 'cambioDevuelto', 'estado', 'metodoPago',
		'montoCredito', 'montoEfectivo', 'montoTarjeta', 'montoTransferencia', 'turnoId', 'deletedAt',
	] as const;
	if (
		Object.keys(response).length !== scalarFields.length ||
		scalarFields.some((field) => !Object.prototype.hasOwnProperty.call(response, field))
	) {
		throw new Error('Invalid product sale idempotency response snapshot');
	}
	for (const field of ['ventaId', 'tenantId', 'puntoDeVentaId', 'estado'] as const) {
		if (typeof response[field] !== 'string') {
			throw new Error('Invalid product sale idempotency response snapshot');
		}
	}
	for (const field of ['createdAt', 'updatedAt'] as const) {
		if (typeof response[field] !== 'string' || Number.isNaN(Date.parse(response[field]))) {
			throw new Error('Invalid product sale idempotency response snapshot');
		}
	}
	for (const field of ['cantidad', 'esVentaUnica'] as const) {
		if (typeof response[field] !== (field === 'cantidad' ? 'number' : 'boolean')) {
			throw new Error('Invalid product sale idempotency response snapshot');
		}
	}
	const numericFields = [
		'total', 'descuento', 'montoRecibidoEfectivo', 'cambioDevuelto', 'montoCredito',
		'montoEfectivo', 'montoTarjeta', 'montoTransferencia',
	] as const;
	for (const field of numericFields) {
		if (response[field] !== null && typeof response[field] !== 'number') {
			throw new Error('Invalid product sale idempotency response snapshot');
		}
	}
	const nullableStrings = [
		'productoId', 'empleadoId', 'clienteId', 'ordenId', 'observaciones', 'ofertaId',
		'ventaPadreId', 'metodoPago', 'turnoId',
	] as const;
	for (const field of nullableStrings) {
		if (response[field] !== null && typeof response[field] !== 'string') {
			throw new Error('Invalid product sale idempotency response snapshot');
		}
	}
	if (
		response.deletedAt !== null &&
		(typeof response.deletedAt !== 'string' || Number.isNaN(Date.parse(response.deletedAt)))
	) {
		throw new Error('Invalid product sale idempotency response snapshot');
	}
	for (const field of ['createdAt', 'updatedAt'] as const) {
		response[field] = new Date(response[field] as string);
	}
	if (typeof response.deletedAt === 'string') response.deletedAt = new Date(response.deletedAt);
	return response as unknown as Venta;
}

/**
 * @description Serializes JSON values deterministically while preserving array order.
 * @param {unknown} value - Parsed payload value.
 * @returns {string} Canonical JSON representation.
 */
function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	if (value !== null && typeof value === 'object') {
		const sortedEntries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
		return `{${sortedEntries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
	}
	const encoded = JSON.stringify(value);
	if (encoded === undefined) throw new Error('Sale payload contains a non-JSON value');
	return encoded;
}

/**
 * @description Normalizes absent/null/default options that have identical sale semantics.
 * @param {unknown} payload - Parsed sale payload.
 * @returns {unknown} Canonical sale payload with semantic defaults made explicit.
 */
function normalizeVentaCreatePayload(payload: unknown): unknown {
	if (payload === null || Array.isArray(payload) || typeof payload !== 'object') return payload;
	const normalized: Record<string, unknown> = { ...payload };
	const nullableFields = [
		'clienteId', 'empleadoId', 'observaciones', 'turnoId', 'metodoPago', 'montoEfectivo',
		'montoTarjeta', 'montoTransferencia', 'montoCredito', 'motivoCreditoOverride',
		'montoRecibidoEfectivo', 'cambioDevuelto', 'tipoVencimiento', 'fechaVencimiento',
		'cuentaBancariaId',
	] as const;
	for (const field of nullableFields) normalized[field] = normalized[field] ?? null;
	normalized.modoPedido = normalized.modoPedido === true;
	normalized.solicitarCreditoOverride = normalized.solicitarCreditoOverride === true;
	return normalized;
}
