import { createHash } from 'node:crypto';

/** Canonical digest format version embedded in every replay preflight hash. */
export const REPLAY_PREFLIGHT_DIGEST_VERSION = 'r5-preflight-v2';

/** Period identity and its exact UTC-normalized boundaries. */
export interface ReplayPreflightPeriodSnapshot {
	periodId: string;
	startsAt: Date | string;
	endsAt: Date | string;
}

/** Persisted source valuation evidence included in the approval digest. */
export interface ReplayPreflightValuationSnapshot {
	originalAmount: string | null;
	originalCurrency: string | null;
	functionalAmount: string | null;
	functionalCurrency: string | null;
	fxRate: string | null;
	fxEvidenceFingerprint: string | null;
}

/** One source classification in the canonical replay preflight snapshot. */
export interface ReplayPreflightSourceSnapshot {
	identity: { sourceType: string; sourceId: string };
	classification: string;
	omissionCause: string | null;
	semantics: {
		tipo: string;
		fecha: Date | string;
		descripcion: string;
		medioCobro: string | null;
		referencia: string | null;
		auxiliares: {
			costoFifo: string | null;
			intereses: string | null;
			montoPagado: string | null;
			diferenciaFx: string | null;
		};
	};
	valuation: ReplayPreflightValuationSnapshot;
}

/** Exact data bound to a replay approval; no database or runtime state is read. */
export interface ReplayPreflightDigestSnapshot {
	tenantId: string;
	period: ReplayPreflightPeriodSnapshot;
	sources: ReplayPreflightSourceSnapshot[];
}

interface CanonicalSource {
	identity: { sourceType: string; sourceId: string };
	classification: string;
	omissionCause: string | null;
	semantics: {
		tipo: string;
		fecha: string;
		descripcion: string;
		medioCobro: string | null;
		referencia: string | null;
		auxiliares: {
			costoFifo: string | null;
			intereses: string | null;
			montoPagado: string | null;
			diferenciaFx: string | null;
		};
	};
	valuation: {
		originalAmount: string | null;
		originalCurrency: string | null;
		functionalAmount: string | null;
		functionalCurrency: string | null;
		fxRate: string | null;
		fxEvidenceFingerprint: string | null;
	};
}

interface CanonicalSnapshot {
	digestVersion: string;
	tenantId: string;
	period: { periodId: string; startsAt: string; endsAt: string };
	sources: CanonicalSource[];
}

/**
 * @description Produces a SHA-256 digest of a canonical replay preflight snapshot.
 * @param {ReplayPreflightDigestSnapshot} snapshot - Tenant, period, valuation and classification data.
 * @param {string} version - Version tag included in the hashed payload.
 * @returns {string} Lowercase hexadecimal SHA-256 digest.
 */
export function computeReplayPreflightDigest(
	snapshot: ReplayPreflightDigestSnapshot,
	version = REPLAY_PREFLIGHT_DIGEST_VERSION,
): string {
	const canonical = canonicalizeSnapshot(snapshot, version);
	return createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex');
}

/**
 * @description Validates and orders snapshot fields before serialization.
 * @param {ReplayPreflightDigestSnapshot} snapshot - Untrusted snapshot value.
 * @param {string} version - Digest format version.
 * @returns {CanonicalSnapshot} Canonical JSON-compatible representation.
 */
function canonicalizeSnapshot(
	snapshot: ReplayPreflightDigestSnapshot,
	version: string,
): CanonicalSnapshot {
	if (!isRecord(snapshot)) throw new TypeError('Preflight snapshot must be an object');
	const digestVersion = requiredString(version, 'digest version');
	const tenantId = requiredString(snapshot.tenantId, 'tenantId');
	if (!isRecord(snapshot.period)) throw new TypeError('Preflight period must be an object');
	if (!Array.isArray(snapshot.sources)) throw new TypeError('Preflight sources must be an array');

	const sources = snapshot.sources.map(canonicalizeSource);
	sources.sort((left, right) => compareIdentity(left.identity, right.identity));
	for (let index = 1; index < sources.length; index += 1) {
		if (compareIdentity(sources[index - 1].identity, sources[index].identity) === 0) {
			throw new TypeError('Preflight source identities must be unique');
		}
	}

	return {
		digestVersion,
		tenantId,
		period: {
			periodId: requiredString(snapshot.period.periodId, 'period.periodId'),
			startsAt: canonicalDate(snapshot.period.startsAt, 'period.startsAt'),
			endsAt: canonicalDate(snapshot.period.endsAt, 'period.endsAt'),
		},
		sources,
	};
}

/**
 * @description Validates and canonicalizes one source record.
 * @param {ReplayPreflightSourceSnapshot} source - Source input.
 * @returns {CanonicalSource} Canonical source with normalized decimal strings.
 */
function canonicalizeSource(source: ReplayPreflightSourceSnapshot): CanonicalSource {
	if (!isRecord(source) || !isRecord(source.identity) || !isRecord(source.valuation)) {
		throw new TypeError('Preflight source, identity, and valuation must be objects');
	}
	const omissionCause = nullableString(source.omissionCause, 'source.omissionCause');
	return {
		identity: {
			sourceType: requiredString(source.identity.sourceType, 'source.identity.sourceType'),
			sourceId: requiredString(source.identity.sourceId, 'source.identity.sourceId'),
		},
		classification: requiredString(source.classification, 'source.classification'),
		omissionCause,
		semantics: {
			tipo: requiredString(source.semantics?.tipo, 'source.semantics.tipo'),
			fecha: canonicalDate(source.semantics?.fecha, 'source.semantics.fecha'),
			descripcion: requiredString(source.semantics?.descripcion, 'source.semantics.descripcion'),
			medioCobro: nullableString(source.semantics?.medioCobro, 'source.semantics.medioCobro'),
			referencia: nullableString(source.semantics?.referencia, 'source.semantics.referencia'),
			auxiliares: {
				costoFifo: nullableDecimal(source.semantics?.auxiliares?.costoFifo, 'costoFifo'),
				intereses: nullableDecimal(source.semantics?.auxiliares?.intereses, 'intereses'),
				montoPagado: nullableDecimal(source.semantics?.auxiliares?.montoPagado, 'montoPagado'),
				diferenciaFx: nullableDecimal(source.semantics?.auxiliares?.diferenciaFx, 'diferenciaFx'),
			},
		},
		valuation: {
			originalAmount: nullableDecimal(source.valuation.originalAmount, 'originalAmount'),
			originalCurrency: nullableRequiredString(
				source.valuation.originalCurrency,
				'originalCurrency',
			),
			functionalAmount: nullableDecimal(source.valuation.functionalAmount, 'functionalAmount'),
			functionalCurrency: nullableRequiredString(
				source.valuation.functionalCurrency,
				'functionalCurrency',
			),
			fxRate: source.valuation.fxRate === null
				? null
				: canonicalDecimal(source.valuation.fxRate, 'fxRate'),
			fxEvidenceFingerprint: nullableString(
				source.valuation.fxEvidenceFingerprint,
				'fxEvidenceFingerprint',
			),
		},
	};
}

/**
 * @description Converts a valid date representation to its canonical UTC ISO form.
 * @param {Date | string} value - Date object or parseable timestamp.
 * @param {string} field - Field label used in validation errors.
 * @returns {string} UTC timestamp with millisecond precision.
 */
function canonicalDate(value: Date | string, field: string): string {
	if (!(value instanceof Date) && typeof value !== 'string') {
		throw new TypeError(`${field} must be a Date or timestamp string`);
	}
	if (typeof value === 'string') {
		const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d+))?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
		if (!timestamp) throw new TypeError(`${field} must include an explicit timezone`);
		if ((timestamp[1]?.length ?? 0) > 3) {
			throw new TypeError(`${field} precision must not exceed milliseconds`);
		}
	}
	const date = value instanceof Date ? value : new Date(value);
	if (!Number.isFinite(date.getTime())) throw new TypeError(`${field} must be a valid date`);
	return date.toISOString();
}

/**
 * @description Normalizes a decimal string without converting through JavaScript number.
 * @param {string} value - Exact decimal literal.
 * @param {string} field - Field label used in validation errors.
 * @returns {string} Non-exponent decimal string with insignificant zeros removed.
 */
function canonicalDecimal(value: unknown, field: string): string {
	if (typeof value !== 'string') throw new TypeError(`${field} must be a decimal string`);
	const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(value);
	if (!match) throw new TypeError(`${field} must be a valid decimal string`);
	const exponent = Number(match[4] ?? '0');
	if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) {
		throw new TypeError(`${field} exponent is out of range`);
	}

	const integerPart = match[2];
	const fractionalPart = match[3] ?? '';
	const rawDigits = `${integerPart}${fractionalPart}`;
	const leadingZeros = rawDigits.length - rawDigits.replace(/^0+/, '').length;
	const digits = rawDigits.slice(leadingZeros) || '0';
	const decimalPosition = integerPart.length + exponent - leadingZeros;
	let normalized: string;
	if (digits === '0') {
		normalized = '0';
	} else if (decimalPosition <= 0) {
		normalized = `0.${'0'.repeat(-decimalPosition)}${digits}`;
	} else if (decimalPosition >= digits.length) {
		normalized = `${digits}${'0'.repeat(decimalPosition - digits.length)}`;
	} else {
		normalized = `${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
	}
	if (normalized.includes('.')) normalized = normalized.replace(/0+$/, '').replace(/\.$/, '');
	return match[1] === '-' && normalized !== '0' ? `-${normalized}` : normalized;
}

/**
 * @description Canonicalizes a decimal value while preserving unknown values as null.
 * @param {unknown} value - Decimal string or null.
 * @param {string} field - Field label used in validation errors.
 * @returns {string | null} Canonical decimal or null when the source value is unknown.
 */
function nullableDecimal(value: unknown, field: string): string | null {
	return value === null ? null : canonicalDecimal(value, field);
}

/**
 * @description Validates a required non-empty string.
 * @param {unknown} value - Value to check.
 * @param {string} field - Field label used in validation errors.
 * @returns {string} Validated string.
 */
function requiredString(value: unknown, field: string): string {
	if (typeof value !== 'string' || value.length === 0) {
		throw new TypeError(`${field} must be a non-empty string`);
	}
	return value;
}

/**
 * @description Validates a required non-empty string while preserving null for unknown data.
 * @param {unknown} value - String or null.
 * @param {string} field - Field label used in validation errors.
 * @returns {string | null} Valid string or null when unavailable.
 */
function nullableRequiredString(value: unknown, field: string): string | null {
	return value === null ? null : requiredString(value, field);
}

/**
 * @description Validates a nullable string field.
 * @param {unknown} value - Value to check.
 * @param {string} field - Field label used in validation errors.
 * @returns {string | null} Validated nullable string.
 */
function nullableString(value: unknown, field: string): string | null {
	if (value === null) return null;
	if (typeof value !== 'string') throw new TypeError(`${field} must be a string or null`);
	return value;
}

/**
 * @description Narrows non-null, non-array values to records.
 * @param {unknown} value - Value to inspect.
 * @returns {value is Record<string, unknown>} Whether the value is a plain record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @description Compares source identities using locale-independent code-unit order.
 * @param {{ sourceType: string; sourceId: string }} left - First source identity.
 * @param {{ sourceType: string; sourceId: string }} right - Second source identity.
 * @returns {number} Negative, zero, or positive sort result.
 */
function compareIdentity(
	left: { sourceType: string; sourceId: string },
	right: { sourceType: string; sourceId: string },
): number {
	return compareString(left.sourceType, right.sourceType) || compareString(left.sourceId, right.sourceId);
}

/**
 * @description Compares strings without locale-dependent collation.
 * @param {string} left - First string.
 * @param {string} right - Second string.
 * @returns {number} Negative, zero, or positive sort result.
 */
function compareString(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}
