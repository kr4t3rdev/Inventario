import { createHash } from 'node:crypto';
import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';

export const APERTURA_PREFLIGHT_DIGEST_VERSION = 'accounting.opening.preflight.v1';
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface AperturaEvidenceLine {
	tenantId: string;
	effectiveDate?: Date | string;
	role: string;
	accountId: string;
	currency: string;
	amount: string;
	debit: string;
	credit: string;
	source: { kind: 'TRUSTED' | 'MANUAL'; evidenceVersion: number; sourceId: string; snapshot: JsonValue; hash: string };
	fx?: {
		functionalAmount: string; rate: string; rateDate: string; source: string;
		provenanceKind: 'MANUAL_GOVERNED' | 'CATALOG_RATE'; fingerprint: string;
	};
}

export interface AperturaEvidenceSnapshot {
	tenantId: string;
	periodId: string;
	openingDate: Date | string;
	functionalCurrency: string;
	lines: AperturaEvidenceLine[];
}

export interface AperturaValidationResult { valid: boolean; issues: string[] }

const SUPPORTED_CURRENCIES = new Set(['CUP', 'USD', 'EUR', 'MLC', 'CAD', 'GBP', 'MXN']);

/** @description Canonicalizes JSON recursively with stable object-key ordering. */
function stableJson(value: JsonValue): JsonValue {
	if (Array.isArray(value)) return value.map(stableJson);
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
	}
	return value;
}

/** @description Computes a versioned preflight fingerprint; it does not attest source authority. */
export function computeAperturaEvidenceHash(source: AperturaEvidenceLine['source']): string {
	return createHash('sha256').update(JSON.stringify({
		domain: 'accounting.opening.evidence', version: source.evidenceVersion,
		source: { kind: source.kind, sourceId: source.sourceId, snapshot: stableJson(source.snapshot) },
	}), 'utf8').digest('hex');
}

function canonicalDecimal(value: unknown, field: string, scale: number, positive = false): string {
	if (typeof value !== 'string') throw new TypeError(`${field}: decimal string required`);
	let decimal: Prisma.Decimal;
	try { decimal = new Prisma.Decimal(value); } catch { throw new TypeError(`${field}: invalid decimal`); }
	if (!decimal.isFinite() || decimal.lt(0) || (positive && !decimal.gt(0))) {
		throw new TypeError(`${field}: invalid or negative amount`);
	}
	const fixed = decimal.toFixed();
	const [whole, fraction = ''] = fixed.split('.');
	if (fraction.length > scale || whole.replace(/^0+/, '').length > 20 - scale) {
		throw new TypeError(`${field}: decimal precision or range exceeded`);
	}
	return fixed.replace(/(?:\.0+|(?<=\.[0-9]*)0+)$/, '').replace(/\.$/, '') || '0';
}

function canonicalDate(value: Date | string): string {
	const date = value instanceof Date ? value : new Date(value);
	if (!Number.isFinite(date.getTime())) throw new TypeError('openingDate: invalid date');
	return date.toISOString();
}

/** @description Checks opening preflight shape and arithmetic, not persisted source/account authority. */
export function validateAperturaPreflight(snapshot: AperturaEvidenceSnapshot): AperturaValidationResult {
	const issues: string[] = [];
	try {
		if (!snapshot.tenantId?.trim() || !snapshot.periodId?.trim()) throw new TypeError('tenant and period are required');
		canonicalDate(snapshot.openingDate);
		if (snapshot.functionalCurrency !== 'CUP') throw new TypeError('functional currency must be CUP');
		if (!Array.isArray(snapshot.lines) || snapshot.lines.length === 0) throw new TypeError('opening lines are required');
		const identities = new Set<string>();
		let debits = new Prisma.Decimal(0);
		let credits = new Prisma.Decimal(0);
		for (const [index, line] of snapshot.lines.entries()) {
			const at = `lines[${index}]`;
			if (line.tenantId !== snapshot.tenantId) throw new TypeError(`${at}: cross-tenant line`);
			if (line.effectiveDate !== undefined) canonicalDate(line.effectiveDate);
			if (!line.role?.trim() || !line.accountId?.trim()) throw new TypeError(`${at}: role and account required`);
			const currency = line.currency.trim().toUpperCase();
			const identity = `${line.accountId.trim()}\0${currency}`;
			if (identities.has(identity)) throw new TypeError(`${at}: duplicate line`);
			identities.add(identity);
			if (!SUPPORTED_CURRENCIES.has(currency)) throw new TypeError(`${at}: unsupported currency`);
			const amount = canonicalDecimal(line.amount, `${at}.amount`, 4, true);
			const debit = canonicalDecimal(line.debit, `${at}.debit`, 4);
			const credit = canonicalDecimal(line.credit, `${at}.credit`, 4);
			if (new Prisma.Decimal(debit).gt(0) === new Prisma.Decimal(credit).gt(0)) {
				throw new TypeError(`${at}: exactly one side must be positive`);
			}
			if (!line.source?.sourceId?.trim() || !Number.isSafeInteger(line.source.evidenceVersion) ||
				line.source.evidenceVersion < 1 || !isNonEmptyEvidenceObject(line.source.snapshot) ||
				computeAperturaEvidenceHash(line.source) !== line.source.hash) {
				throw new TypeError(`${at}: source evidence missing or hash mismatch`);
			}
			if (currency === 'CUP') {
				if (line.fx) throw new TypeError(`${at}: CUP line must not claim foreign FX`);
				const functionalSide = new Prisma.Decimal(debit).gt(0) ? debit : credit;
				if (!new Prisma.Decimal(functionalSide).eq(amount)) {
					throw new TypeError(`${at}: CUP native amount must equal functional posting side`);
				}
				debits = debits.plus(debit); credits = credits.plus(credit);
			} else {
				if (!line.fx) throw new TypeError(`${at}: foreign functional valuation requires FX evidence`);
				const rate = canonicalDecimal(line.fx.rate, `${at}.fx.rate`, 10, true);
				const functionalAmount = canonicalDecimal(line.fx.functionalAmount, `${at}.fx.functionalAmount`, 4, true);
				const functionalSide = new Prisma.Decimal(debit).gt(0) ? debit : credit;
				if (!new Prisma.Decimal(functionalSide).eq(functionalAmount)) {
					throw new TypeError(`${at}: FX functional amount must equal functional posting side`);
				}
				const verified = buildAppliedFxEvidenceExact({
					originalAmount: line.amount, originalCurrency: currency, functionalCurrency: 'CUP',
					exchangeRate: rate, convertedAmount: functionalAmount,
					rateEffectiveAt: new Date(line.fx.rateDate), source: line.fx.source,
					fxProvenanceKind: line.fx.provenanceKind,
				});
				if (verified.evidence.fxEvidenceFingerprint !== line.fx.fingerprint) {
					throw new TypeError(`${at}: FX fingerprint does not match canonical evidence`);
				}
				const signed = new Prisma.Decimal(debit).gt(0) ? verified.montoConvertido : verified.montoConvertido.negated();
				if (signed.gt(0)) debits = debits.plus(signed); else credits = credits.plus(signed.abs());
			}
		}
		if (!debits.eq(credits)) throw new TypeError('functional debit and credit totals do not balance');
	} catch (error) { issues.push(error instanceof Error ? error.message : 'opening validation failed'); }
	return { valid: issues.length === 0, issues };
}

/** @description Produces a deterministic SHA-256 preflight digest; approval must re-resolve immutable
 * source records, tenant-scoped accounts, and period/date eligibility independently. */
export function computeAperturaPreflightDigest(snapshot: AperturaEvidenceSnapshot): string {
	const validation = validateAperturaPreflight(snapshot);
	if (!validation.valid) throw new TypeError(validation.issues.join('; '));
	const lines = snapshot.lines.map((line) => ({
		tenantId: line.tenantId, role: line.role, accountId: line.accountId,
		effectiveDate: line.effectiveDate === undefined ? null : canonicalDate(line.effectiveDate),
		currency: line.currency.trim().toUpperCase(), amount: canonicalDecimal(line.amount, 'amount', 4),
		debit: canonicalDecimal(line.debit, 'debit', 4), credit: canonicalDecimal(line.credit, 'credit', 4),
		source: { kind: line.source.kind, evidenceVersion: line.source.evidenceVersion, sourceId: line.source.sourceId,
			snapshot: stableJson(line.source.snapshot), hash: line.source.hash },
		fx: line.fx ? { ...line.fx, functionalAmount: canonicalDecimal(line.fx.functionalAmount, 'functionalAmount', 4),
			rate: canonicalDecimal(line.fx.rate, 'rate', 10, true), rateDate: canonicalDate(line.fx.rateDate) } : null,
	})).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
	return createHash('sha256').update(JSON.stringify({
		domain: 'accounting.opening.preflight.digest', version: APERTURA_PREFLIGHT_DIGEST_VERSION,
		tenantId: snapshot.tenantId, periodId: snapshot.periodId,
		openingDate: canonicalDate(snapshot.openingDate), functionalCurrency: 'CUP', lines,
	}), 'utf8').digest('hex');
}

/** @description Accepts only non-empty structured evidence snapshots, never scalar placeholders. */
function isNonEmptyEvidenceObject(value: JsonValue): value is { [key: string]: JsonValue } {
	return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}
