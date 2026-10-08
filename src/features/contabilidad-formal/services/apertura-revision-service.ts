import { createHash } from 'node:crypto';
import { Prisma, type LineaAperturaPeriodo } from '@/generated/prisma';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { normalizeTenantRole } from '@/lib/auth/roles';
import { getDefaultPermissionsForRole } from '@/lib/auth/permission-registry';
import {
	computeAperturaEvidenceHash,
	computeAperturaPreflightDigest,
	validateAperturaPreflight,
	type AperturaEvidenceLine,
	type AperturaEvidenceSnapshot,
} from './apertura-evidencia';
import { insertarAsientoConNumeracion, type LineaAsientoResuelta } from './posting-engine';

const PRESENT_PERMISSION = 'financiero.apertura.presentar';
const APPROVE_PERMISSION = 'financiero.apertura.aprobar';
const DIGEST_VERSION = 1;
const APPROVAL_ORIGIN = 'apertura_revision';

export interface AperturaRevisionLineInput {
	fechaEfectiva: Date;
	lado: 'DEBE' | 'HABER';
	rolCuenta: string;
	cuentaId: string;
	monedaNativa: string;
	importeNativo: string;
	importeFuncional: string;
	tasaCambio?: string;
	fechaTasaCambio?: Date;
	fuenteTasaCambio?: string;
	fxCatalogRateId?: string;
	fxFingerprint?: string;
	fxProvenanceKind?: 'MANUAL_GOVERNED' | 'CATALOG_RATE';
	fuenteTipo: 'TRUSTED' | 'MANUAL';
	fuenteId: string;
	evidenciaVersion: number;
	fuenteSnapshot: Record<string, Prisma.InputJsonValue>;
}

export interface CreateAperturaRevisionInput {
	periodoId: string;
	aperturaId: string;
	fechaCorte: Date;
	lines: AperturaRevisionLineInput[];
}

function toJson(value: Record<string, Prisma.InputJsonValue>): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function makeEvidenceLine(tenantId: string, line: AperturaRevisionLineInput): AperturaEvidenceLine {
	const currency = line.monedaNativa.trim().toUpperCase();
	const functional = line.importeFuncional;
	const source: AperturaEvidenceLine['source'] = {
		kind: line.fuenteTipo,
		evidenceVersion: line.evidenciaVersion,
		sourceId: line.fuenteId,
		snapshot: toJson(line.fuenteSnapshot) as AperturaEvidenceLine['source']['snapshot'],
		hash: '',
	};
	source.hash = computeAperturaEvidenceHash(source);
	return {
		tenantId,
		effectiveDate: line.fechaEfectiva,
		role: line.rolCuenta,
		accountId: line.cuentaId,
		currency,
		amount: line.importeNativo,
		debit: line.lado === 'DEBE' ? functional : '0',
		credit: line.lado === 'HABER' ? functional : '0',
		source,
		...(currency === 'CUP' ? {} : {
			fx: {
				functionalAmount: functional,
				rate: line.tasaCambio ?? '',
				rateDate: line.fechaTasaCambio?.toISOString() ?? '',
				source: line.fuenteTasaCambio ?? '',
				provenanceKind: line.fxProvenanceKind ?? 'MANUAL_GOVERNED',
				fingerprint: line.fxFingerprint ?? '',
			},
		}),
	};
}

async function lockTenantPeriod(tx: Prisma.TransactionClient, tenantId: string, periodoId: string): Promise<void> {
	await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId} || ':' || ${periodoId}, 0))::text AS locked`;
}

async function requireCurrentTenantPermission(
	tx: Prisma.TransactionClient,
	tenantId: string,
	userId: string,
	permission: string,
	action: string,
): Promise<void> {
	const membership = await tx.tenantMembership.findFirst({
		where: { tenantId, userId, isActive: true },
		select: { tenantRole: true, customRoleId: true, user: { select: { isActive: true } } },
	});
	if (!membership?.user?.isActive) throw new Error(`Se requiere un usuario y membresía activos para ${action}`);
	let permissions: string[] | null = null;
	if (membership.customRoleId) {
		const customRole = await tx.tenantRole.findFirst({
			where: { roleId: membership.customRoleId, tenantId, isActive: true }, select: { permissions: true },
		});
		permissions = Array.isArray(customRole?.permissions)
			? customRole.permissions.filter((key): key is string => typeof key === 'string')
			: null;
	}
	if (permissions === null) {
		const role = normalizeTenantRole(membership.tenantRole);
		permissions = role ? [...getDefaultPermissionsForRole(role)] : [];
	}
	if (!permissions.includes(permission)) throw new Error(`Permiso vigente requerido para ${action}`);
}

function validateCutoff(fechaCorte: Date, periodo: { fechaInicio: Date; fechaFin: Date }): void {
	if (!Number.isFinite(fechaCorte.getTime()) || fechaCorte < periodo.fechaInicio || fechaCorte > periodo.fechaFin) {
		throw new Error('La fecha de corte debe estar dentro del período contable');
	}
}

function makeSnapshot(
	tenantId: string,
	periodoId: string,
	fechaCorte: Date,
	functionalCurrency: string,
	lines: AperturaEvidenceLine[],
): AperturaEvidenceSnapshot {
	return { tenantId, periodId: periodoId, openingDate: fechaCorte, functionalCurrency, lines };
}

function sourceSnapshot(value: unknown): AperturaEvidenceLine['source']['snapshot'] {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new TypeError('La evidencia persistida debe ser un objeto JSON');
	}
	return value as AperturaEvidenceLine['source']['snapshot'];
}

/** @description Creates a complete immutable BORRADOR revision under a tenant-period lock. */
export async function createAperturaRevisionDraft(
	user: AuthenticatedUser,
	input: CreateAperturaRevisionInput,
) {
	const tenantId = requireTenant(user);
	if (!user.isActive) throw new Error('El actor autenticado está inactivo');
	requirePermission(user, PRESENT_PERMISSION, 'presentar la apertura contable');
	if (!input.lines.length) throw new Error('La apertura requiere al menos una línea');
	if (input.lines.some((line) => line.fuenteTipo !== 'MANUAL')) {
		throw new Error('Las fuentes TRUSTED requieren un resolvedor server-side autorizado');
	}
	return prisma.$transaction(async (tx) => {
		const membership = await tx.tenantMembership.findFirst({
			where: { tenantId, userId: user.userId, isActive: true }, select: { membershipId: true },
		});
		if (!membership) throw new Error('Se requiere una membresía activa para crear la apertura');
		await lockTenantPeriod(tx, tenantId, input.periodoId);
		const periodo = await tx.periodoContable.findFirst({
			where: { periodoId: input.periodoId, tenantId },
			select: { periodoId: true, tenantId: true, fechaInicio: true, fechaFin: true },
		});
		if (!periodo) throw new Error('Período contable no encontrado');
		validateCutoff(input.fechaCorte, periodo);
		const apertura = await tx.aperturaPeriodo.findFirst({
			where: { aperturaId: input.aperturaId, periodoId: input.periodoId, tenantId },
			select: { aperturaId: true, periodoId: true, tenantId: true, monedaFuncional: true },
		});
		if (!apertura) throw new Error('Apertura contable no encontrada');
		const approvedRevision = await tx.aperturaRevision.findFirst({
			where: { tenantId, periodoId: input.periodoId, aperturaId: input.aperturaId, estado: 'APROBADA' },
			select: { revisionId: true },
		});
		if (approvedRevision) throw new Error('No se pueden crear revisiones después de aprobar la apertura');
		for (const line of input.lines) validateCutoff(line.fechaEfectiva, periodo);
		const lines = input.lines.map((line) => makeEvidenceLine(tenantId, line));
		const snapshot = makeSnapshot(tenantId, input.periodoId, input.fechaCorte, apertura.monedaFuncional, lines);
		const result = validateAperturaPreflight(snapshot);
		if (!result.valid) throw new Error(result.issues.join('; '));
		const digest = computeAperturaPreflightDigest(snapshot);
		const evidenceDigest = createHash('sha256')
			.update(lines.map((line) => line.source.hash).sort().join(':'), 'utf8').digest('hex');
		const latest = await tx.aperturaRevision.findFirst({
			where: { aperturaId: input.aperturaId, tenantId, periodoId: input.periodoId },
			orderBy: { version: 'desc' }, select: { version: true },
		});
		const revision = await tx.aperturaRevision.create({ data: {
			aperturaId: input.aperturaId,
			tenantId,
			periodoId: input.periodoId,
			version: (latest?.version ?? 0) + 1,
			fechaCorte: input.fechaCorte,
			estado: 'BORRADOR',
			digestVersion: DIGEST_VERSION,
			digestSha256: digest,
			evidenciaVersion: 1,
			evidenciaSha256: evidenceDigest,
		} });
		await tx.lineaAperturaPeriodo.createMany({ data: input.lines.map((line, index) => ({
			aperturaId: input.aperturaId,
			revisionId: revision.revisionId,
			tenantId,
			periodoId: input.periodoId,
			fechaEfectiva: line.fechaEfectiva,
			lado: line.lado,
			rolCuenta: line.rolCuenta,
			cuentaId: line.cuentaId,
			monedaNativa: line.monedaNativa.trim().toUpperCase(),
			importeNativo: new Prisma.Decimal(line.importeNativo),
			monedaFuncional: apertura.monedaFuncional,
			importeFuncional: new Prisma.Decimal(line.importeFuncional),
			tasaCambio: line.tasaCambio == null ? null : new Prisma.Decimal(line.tasaCambio),
			fechaTasaCambio: line.fechaTasaCambio ?? null,
			fuenteTasaCambio: line.fuenteTasaCambio ?? null,
			fuenteSnapshot: toJson(line.fuenteSnapshot),
			fxCatalogRateId: line.fxCatalogRateId ?? null,
			fxFingerprint: line.fxFingerprint ?? null,
			fuenteTipo: line.fuenteTipo,
			fuenteId: line.fuenteId,
			evidenciaVersion: line.evidenciaVersion,
			evidenciaSha256: lines[index].source.hash,
		})) });
		return revision;
	}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function snapshotFromPersisted(
	revision: { tenantId: string; periodoId: string; fechaCorte: Date; apertura: { monedaFuncional: string } },
	lines: LineaAperturaPeriodo[],
): AperturaEvidenceSnapshot {
	return makeSnapshot(revision.tenantId, revision.periodoId, revision.fechaCorte,
		revision.apertura.monedaFuncional, lines.map((line) => {
			const currency = line.monedaNativa.toUpperCase();
			const source: AperturaEvidenceLine['source'] = {
				kind: line.fuenteTipo === 'MANUAL' ? 'MANUAL' : 'TRUSTED',
				evidenceVersion: line.evidenciaVersion,
				sourceId: line.fuenteId ?? '',
				snapshot: sourceSnapshot(line.fuenteSnapshot),
				hash: line.evidenciaSha256,
			};
			const functional = line.importeFuncional?.toString() ?? '';
			return {
				tenantId: line.tenantId,
				effectiveDate: line.fechaEfectiva,
				role: line.rolCuenta,
				accountId: line.cuentaId ?? '',
				currency,
				amount: line.importeNativo.toString(),
				debit: line.lado === 'DEBE' ? functional : '0',
				credit: line.lado === 'HABER' ? functional : '0',
				source,
				...(currency === 'CUP' ? {} : {
					fx: {
						functionalAmount: functional,
						rate: line.tasaCambio?.toString() ?? '',
						rateDate: line.fechaTasaCambio?.toISOString() ?? '',
						source: line.fuenteTasaCambio ?? '',
						provenanceKind: line.fxCatalogRateId ? 'CATALOG_RATE' : 'MANUAL_GOVERNED',
						fingerprint: line.fxFingerprint ?? '',
					},
				}),
			};
		}));
}

/** @description Revalidates the exact stored lines and atomically transitions BORRADOR to PRESENTADA. */
export async function submitAperturaRevision(user: AuthenticatedUser, revisionId: string) {
	const tenantId = requireTenant(user);
	requirePermission(user, PRESENT_PERMISSION, 'presentar la apertura contable');
	if (!user.isActive) throw new Error('El actor autenticado está inactivo');
	return prisma.$transaction(async (tx) => {
		const membership = await tx.tenantMembership.findFirst({
			where: { tenantId, userId: user.userId, isActive: true }, select: { membershipId: true },
		});
		if (!membership) throw new Error('Se requiere una membresía activa para presentar la apertura');
		const revision = await tx.aperturaRevision.findFirst({
			where: { revisionId, tenantId },
			include: { lineas: true, apertura: true, periodo: { select: { fechaInicio: true, fechaFin: true } } },
		});
		if (!revision) throw new Error('Revisión de apertura no encontrada');
		if (revision.estado !== 'BORRADOR') throw new Error('Solo se pueden presentar revisiones en borrador');
		await lockTenantPeriod(tx, tenantId, revision.periodoId);
		validateCutoff(revision.fechaCorte, revision.periodo);
		if (!revision.lineas.length) throw new Error('La revisión no contiene líneas');
		if (revision.lineas.some((line) => line.fuenteTipo !== 'MANUAL')) {
			throw new Error('Las fuentes TRUSTED requieren un resolvedor server-side autorizado');
		}
		for (const line of revision.lineas) validateCutoff(line.fechaEfectiva, revision.periodo);
		const snapshot = snapshotFromPersisted(revision, revision.lineas);
		const validation = validateAperturaPreflight(snapshot);
		if (!validation.valid) throw new Error(validation.issues.join('; '));
		const digest = computeAperturaPreflightDigest(snapshot);
		if (revision.digestVersion !== DIGEST_VERSION || revision.digestSha256 !== digest) {
			throw new Error('El contenido persistido no coincide con el digest de la revisión');
		}
		const evidenceDigest = createHash('sha256')
			.update(revision.lineas.map((line) => line.evidenciaSha256).sort().join(':'), 'utf8').digest('hex');
		if (revision.evidenciaVersion !== 1 || revision.evidenciaSha256 !== evidenceDigest) {
			throw new Error('La evidencia persistida no coincide con el resumen de la revisión');
		}
		const updated = await tx.aperturaRevision.updateMany({
			where: { revisionId, tenantId, estado: 'BORRADOR' },
			data: { estado: 'PRESENTADA', presentadaPor: user.userId, presentadaAt: new Date() },
		});
		if (updated.count !== 1) throw new Error('La revisión ya no está disponible para presentación');
		return tx.aperturaRevision.findUnique({ where: { revisionId } });
	}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** @description Independently approves and posts an initial, manual CUP opening in one transaction. */
export async function approveAperturaRevision(user: AuthenticatedUser, revisionId: string) {
	const tenantId = requireTenant(user);
	if (!user.isActive) throw new Error('El aprobador autenticado está inactivo');
	requirePermission(user, APPROVE_PERMISSION, 'aprobar la apertura contable');
	return prisma.$transaction(async (tx) => {
		await requireCurrentTenantPermission(tx, tenantId, user.userId, APPROVE_PERMISSION, 'aprobar la apertura');
		const identity = await tx.aperturaRevision.findFirst({
			where: { revisionId, tenantId }, select: { periodoId: true },
		});
		if (!identity) throw new Error('Revisión de apertura no encontrada');
		await lockTenantPeriod(tx, tenantId, identity.periodoId);
		const revision = await tx.aperturaRevision.findFirst({
			where: { revisionId, tenantId },
			include: { lineas: true, apertura: true, periodo: true },
		});
		if (!revision) throw new Error('Revisión de apertura no encontrada');
		if (revision.estado !== 'PRESENTADA' && revision.estado !== 'APROBADA') {
			throw new Error('Solo se pueden aprobar revisiones presentadas');
		}
		validateCutoff(revision.fechaCorte, revision.periodo);
		if (revision.apertura.origenPeriodoId !== null) {
			throw new Error('La aprobación acotada solo admite aperturas iniciales, no rollover');
		}
		const previousPeriods = await tx.periodoContable.findMany({
			where: { tenantId, fechaFin: { lt: revision.periodo.fechaInicio } },
			select: { periodoId: true }, take: 1,
		});
		if (previousPeriods.length) {
			throw new Error('Una apertura inicial sin período origen no se admite si el tenant ya tuvo períodos anteriores');
		}
		if (revision.apertura.monedaFuncional !== 'CUP' || !revision.lineas.length) {
			throw new Error('La aprobación acotada requiere líneas CUP de apertura');
		}
		if (revision.lineas.some((line) => line.fuenteTipo !== 'MANUAL')) {
			throw new Error('Las fuentes TRUSTED requieren un resolvedor server-side autorizado');
		}
		if (!revision.presentadaPor) throw new Error('La revisión no identifica a quien la presentó');
		await requireCurrentTenantPermission(
			tx, tenantId, revision.presentadaPor, PRESENT_PERMISSION, 'mantener la presentación de la apertura',
		);
		if (revision.lineas.some((line) => line.monedaNativa !== 'CUP' || line.importeFuncional === null ||
			line.tasaCambio !== null || line.fechaTasaCambio !== null || line.fuenteTasaCambio !== null ||
			line.fxCatalogRateId !== null || line.fxFingerprint !== null ||
			line.fechaEfectiva.getTime() !== revision.fechaCorte.getTime())) {
			throw new Error('Solo se admiten líneas manuales CUP sin FX y con fecha efectiva igual al corte');
		}
		const snapshot = snapshotFromPersisted(revision, revision.lineas);
		const validation = validateAperturaPreflight(snapshot);
		if (!validation.valid) throw new Error(validation.issues.join('; '));
		const digest = computeAperturaPreflightDigest(snapshot);
		if (revision.digestVersion !== DIGEST_VERSION || revision.digestSha256 !== digest) {
			throw new Error('El contenido persistido no coincide con el digest de la revisión');
		}
		const evidenceDigest = createHash('sha256')
			.update(revision.lineas.map((line) => line.evidenciaSha256).sort().join(':'), 'utf8').digest('hex');
		if (revision.evidenciaVersion !== 1 || revision.evidenciaSha256 !== evidenceDigest) {
			throw new Error('La evidencia persistida no coincide con el resumen de la revisión');
		}
		const source = { tenantId, origenTipo: APPROVAL_ORIGIN, origenId: revision.revisionId };
		if (revision.estado === 'APROBADA') {
			if (!revision.revisadaPor || !revision.revisadaAt || revision.revisadaPor === revision.presentadaPor) {
				throw new Error('Los metadatos de aprobación son incompletos o inválidos');
			}
			const existing = await tx.asiento.findUnique({
				where: { tenantId_origenTipo_origenId: source }, select: { asientoId: true },
			});
			if (!existing) throw new Error('La revisión aprobada no tiene su asiento formal asociado');
			return { estado: 'APROBADA' as const, revisionId, asientoId: existing.asientoId, duplicado: true };
		}
		const anotherApprovedRevision = await tx.aperturaRevision.findMany({
			where: { tenantId, periodoId: revision.periodoId, aperturaId: revision.aperturaId,
				estado: 'APROBADA', revisionId: { not: revision.revisionId } },
			select: { revisionId: true }, take: 1,
		});
		if (anotherApprovedRevision.length) throw new Error('La apertura ya tiene otra revisión aprobada');
		const existingOpeningJournal = await tx.asiento.findFirst({
			where: { tenantId, periodoId: revision.periodoId, origenTipo: APPROVAL_ORIGIN },
			select: { asientoId: true },
		});
		if (existingOpeningJournal) throw new Error('Ya existe un asiento formal de apertura para este período');
		if (!revision.presentadaPor || revision.presentadaPor === user.userId) {
			throw new Error('La aprobación requiere un actor distinto de quien presentó la revisión');
		}
		const existing = await tx.asiento.findUnique({
			where: { tenantId_origenTipo_origenId: source }, select: { asientoId: true },
		});
		if (existing) throw new Error('Existe un asiento para la revisión aún no aprobada; requiere conciliación');
		const diario = await tx.diario.findFirst({
			where: { tenantId, tipo: 'APERTURA_CIERRE', activo: true }, select: { diarioId: true },
		});
		if (!diario) throw new Error('No existe un diario de apertura y cierre activo');
		const accountIds = [...new Set(revision.lineas.map((line) => line.cuentaId).filter((id): id is string => Boolean(id)))];
		if (accountIds.length !== revision.lineas.length) throw new Error('La revisión contiene cuentas incompletas');
		const accounts = await tx.cuentaContable.findMany({
			where: { tenantId, cuentaContableId: { in: accountIds }, activa: true, aceptaMovimiento: true },
			select: { cuentaContableId: true },
		});
		if (accounts.length !== accountIds.length) throw new Error('Una o más cuentas no están activas en este tenant');
		const roles = await tx.cuentaRolTenant.findMany({
			where: { tenantId }, select: { rol: true, cuentaId: true },
		});
		const roleMap = new Map<string, string>(roles.map((role) => [String(role.rol), role.cuentaId]));
		if (revision.lineas.some((line) => !line.rolCuenta || roleMap.get(line.rolCuenta) !== line.cuentaId)) {
			throw new Error('Una o más líneas no coinciden con el rol contable configurado para el tenant');
		}
		const postingLines: LineaAsientoResuelta[] = revision.lineas.map((line, orden) => {
			const amount = new Prisma.Decimal(line.importeFuncional!);
			return {
				orden: orden + 1,
				cuentaId: line.cuentaId!,
				debe: line.lado === 'DEBE' ? amount : new Prisma.Decimal(0),
				haber: line.lado === 'HABER' ? amount : new Prisma.Decimal(0),
				monedaOriginal: 'CUP',
				montoOriginal: new Prisma.Decimal(line.importeNativo),
				tasaCambio: null,
				fxEvidenceFingerprint: null,
				referencia: `Apertura ${line.rolCuenta} · ${line.fuenteId ?? line.lineaId}`,
			};
		});
		const inserted = await insertarAsientoConNumeracion(tx, { tenantId, userId: user.userId }, {
			diarioId: diario.diarioId,
			periodoId: revision.periodoId,
			fecha: revision.fechaCorte,
			descripcion: `Apertura contable inicial · revisión ${revision.version}`,
			origenTipo: APPROVAL_ORIGIN,
			origenId: revision.revisionId,
			lineas: postingLines,
			createdBy: user.userId,
		});
		if (inserted.duplicado) throw new Error('El asiento ya existe para una revisión aún no aprobada');
		const updated = await tx.aperturaRevision.updateMany({
			where: { revisionId, tenantId, estado: 'PRESENTADA' },
			data: { estado: 'APROBADA', revisadaPor: user.userId, revisadaAt: new Date() },
		});
		if (updated.count !== 1) throw new Error('La revisión ya no está disponible para aprobación');
		return { estado: 'APROBADA' as const, revisionId, asientoId: inserted.asientoId, duplicado: false };
	}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
