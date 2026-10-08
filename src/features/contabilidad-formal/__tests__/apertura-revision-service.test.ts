import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const tx = vi.hoisted(() => ({
	$queryRaw: vi.fn(), aperturaPeriodo: { findFirst: vi.fn() },
	aperturaRevision: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
	lineaAperturaPeriodo: { createMany: vi.fn() }, tenantMembership: { findFirst: vi.fn() },
	cuentaContable: { findMany: vi.fn() }, cuentaRolTenant: { findMany: vi.fn() }, diario: { findFirst: vi.fn() },
	asiento: { findUnique: vi.fn(), findFirst: vi.fn() }, tenantRole: { findFirst: vi.fn() }, periodoContable: { findFirst: vi.fn(), findMany: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/services/tenant-scope', () => ({
	requireTenant: (user: { tenantId?: string }) => {
		if (!user.tenantId) throw new Error('tenant required');
		return user.tenantId;
	},
	requirePermission: vi.fn(),
}));
const insertarAsientoMock = vi.hoisted(() => vi.fn());
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
	insertarAsientoConNumeracion: insertarAsientoMock,
}));

import { approveAperturaRevision, createAperturaRevisionDraft, submitAperturaRevision } from '@/features/contabilidad-formal/services/apertura-revision-service';
import { requirePermission } from '@/lib/services/tenant-scope';
import { computeAperturaEvidenceHash, computeAperturaPreflightDigest } from '@/features/contabilidad-formal/services/apertura-evidencia';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const actor: AuthenticatedUser = { userId: 'actor-1', tenantId: 'tenant-1', role: 'admin', isActive: true,
	name: 'A', email: 'a@example.test' };
const date = new Date('2026-01-01T00:00:00Z');
const lines = [
	{ fechaEfectiva: date, lado: 'DEBE' as const, rolCuenta: 'CASH', cuentaId: 'cash', monedaNativa: 'CUP',
		importeNativo: '10', importeFuncional: '10', fuenteTipo: 'MANUAL' as const, fuenteId: 'cash-source',
		evidenciaVersion: 1, fuenteSnapshot: { note: 'cash statement' } },
	{ fechaEfectiva: date, lado: 'HABER' as const, rolCuenta: 'EQUITY', cuentaId: 'equity', monedaNativa: 'CUP',
		importeNativo: '10', importeFuncional: '10', fuenteTipo: 'MANUAL' as const, fuenteId: 'equity-source',
		evidenciaVersion: 1, fuenteSnapshot: { note: 'equity statement' } },
];

function approvalRevision() {
	const approvalLines = [
		{ ...lines[0], rolCuenta: 'CAJA_PRINCIPAL' },
		{ ...lines[1], rolCuenta: 'CAPITAL_SOCIAL' },
	];
	const persisted = approvalLines.map((line) => {
		const source = { kind: 'MANUAL' as const, evidenceVersion: 1, sourceId: line.fuenteId,
			snapshot: line.fuenteSnapshot, hash: '' };
		source.hash = computeAperturaEvidenceHash(source);
		return { tenantId: 'tenant-1', effectiveDate: date, role: line.rolCuenta, accountId: line.cuentaId,
			currency: 'CUP', amount: line.importeNativo,
			debit: line.lado === 'DEBE' ? line.importeFuncional : '0',
			credit: line.lado === 'HABER' ? line.importeFuncional : '0', source };
	});
	const digest = computeAperturaPreflightDigest({ tenantId: 'tenant-1', periodId: 'p1', openingDate: date,
		functionalCurrency: 'CUP', lines: persisted });
	const evidenceDigest = createHash('sha256').update(persisted.map((line) => line.source.hash).sort().join(':'), 'utf8').digest('hex');
	return {
		revisionId: 'r-approval', aperturaId: 'a1', tenantId: 'tenant-1', periodoId: 'p1', version: 1,
		fechaCorte: date, estado: 'PRESENTADA', presentadaPor: 'preparer-1', presentadaAt: date,
		digestVersion: 1, digestSha256: digest, evidenciaVersion: 1, evidenciaSha256: evidenceDigest,
		apertura: { aperturaId: 'a1', monedaFuncional: 'CUP', origenPeriodoId: null as string | null },
		periodo: { fechaInicio: date, fechaFin: new Date('2026-12-31T00:00:00Z') },
		lineas: approvalLines.map((line, index) => ({
			lineaId: `line-${index}`, tenantId: 'tenant-1', aperturaId: 'a1', revisionId: 'r-approval', periodoId: 'p1',
			fechaEfectiva: date, lado: line.lado, rolCuenta: line.rolCuenta, cuentaId: line.cuentaId,
			monedaNativa: 'CUP', importeNativo: line.importeNativo, monedaFuncional: 'CUP',
			importeFuncional: line.importeFuncional, tasaCambio: null, fechaTasaCambio: null, fuenteTasaCambio: null,
			fuenteSnapshot: line.fuenteSnapshot, fxCatalogRateId: null, fxFingerprint: null,
			fuenteTipo: 'MANUAL', fuenteId: line.fuenteId, evidenciaVersion: 1,
			evidenciaSha256: persisted[index].source.hash,
		})),
	};
}

describe('apertura revision service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		prismaMock.$transaction.mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx));
		tx.periodoContable.findFirst.mockResolvedValue({ periodoId: 'p1', tenantId: 'tenant-1', fechaInicio: date,
			fechaFin: new Date('2026-12-31T00:00:00Z') });
		tx.aperturaPeriodo.findFirst.mockResolvedValue({ aperturaId: 'a1', periodoId: 'p1', tenantId: 'tenant-1', monedaFuncional: 'CUP' });
		tx.aperturaRevision.findFirst.mockResolvedValue(null);
		tx.aperturaRevision.findMany.mockResolvedValue([]);
		tx.aperturaRevision.create.mockResolvedValue({ revisionId: 'r1', version: 1, estado: 'BORRADOR' });
		tx.lineaAperturaPeriodo.createMany.mockResolvedValue({ count: 2 });
		tx.tenantMembership.findFirst.mockResolvedValue({ membershipId: 'm1', tenantRole: 'manager',
			customRoleId: null, user: { isActive: true } });
		tx.tenantRole.findFirst.mockResolvedValue(null);
		tx.periodoContable.findMany.mockResolvedValue([]);
		tx.cuentaContable.findMany.mockResolvedValue([
			{ cuentaContableId: 'cash', tenantId: 'tenant-1', activa: true, aceptaMovimiento: true },
			{ cuentaContableId: 'equity', tenantId: 'tenant-1', activa: true, aceptaMovimiento: true },
		]);
		tx.cuentaRolTenant.findMany.mockResolvedValue([
			{ rol: 'CAJA_PRINCIPAL', cuentaId: 'cash', cuenta: { cuentaContableId: 'cash', tenantId: 'tenant-1', activa: true, aceptaMovimiento: true } },
			{ rol: 'CAPITAL_SOCIAL', cuentaId: 'equity', cuenta: { cuentaContableId: 'equity', tenantId: 'tenant-1', activa: true, aceptaMovimiento: true } },
		]);
		tx.diario.findFirst.mockResolvedValue({ diarioId: 'diario-open', tenantId: 'tenant-1', activo: true });
		tx.asiento.findUnique.mockResolvedValue(null);
		tx.asiento.findFirst.mockResolvedValue(null);
		insertarAsientoMock.mockResolvedValue({ asientoId: 'seat-1', duplicado: false });
	});

	it('requires tenant context before requesting permission, including global admins', async () => {
		await expect(createAperturaRevisionDraft({ ...actor, tenantId: undefined } as never,
			{ periodoId: 'p1', aperturaId: 'a1', fechaCorte: date, lines })).rejects.toThrow('tenant required');
		expect(requirePermission).not.toHaveBeenCalled();
	});

	it('requires an active actor and active tenant membership to create drafts', async () => {
		await expect(createAperturaRevisionDraft({ ...actor, isActive: false } as never,
			{ periodoId: 'p1', aperturaId: 'a1', fechaCorte: date, lines })).rejects.toThrow();
		tx.tenantMembership.findFirst.mockResolvedValueOnce(null);
		await expect(createAperturaRevisionDraft(actor,
			{ periodoId: 'p1', aperturaId: 'a1', fechaCorte: date, lines })).rejects.toThrow();
		expect(tx.aperturaRevision.create).not.toHaveBeenCalled();
	});

	it('rejects unverified TRUSTED source evidence when creating a draft', async () => {
		const trustedLines = lines.map((line) => ({ ...line, fuenteTipo: 'TRUSTED' as const }));
		await expect(createAperturaRevisionDraft(actor,
			{ periodoId: 'p1', aperturaId: 'a1', fechaCorte: date, lines: trustedLines })).rejects.toThrow();
		expect(tx.aperturaRevision.create).not.toHaveBeenCalled();
	});

	it('rejects cross-tenant headers and empty line sets', async () => {
		tx.aperturaPeriodo.findFirst.mockResolvedValueOnce(null);
		await expect(createAperturaRevisionDraft(actor, { periodoId: 'p1', aperturaId: 'foreign', fechaCorte: date, lines })).rejects.toThrow();
		await expect(createAperturaRevisionDraft(actor, { periodoId: 'p1', aperturaId: 'a1', fechaCorte: date, lines: [] })).rejects.toThrow();
	});

	it('creates a numbered draft and persists complete evidence lines under a serialized lock', async () => {
		const result = await createAperturaRevisionDraft(actor, { periodoId: 'p1', aperturaId: 'a1', fechaCorte: date, lines });
		expect(result).toMatchObject({ estado: 'BORRADOR', version: 1 });
		expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
		expect(tx.lineaAperturaPeriodo.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.arrayContaining([
			expect.objectContaining({ lado: 'DEBE', fuenteSnapshot: expect.any(Object), evidenciaSha256: expect.any(String) }),
		]) }));
		expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: expect.anything() });
	});

	it('starts a legacy header at revision one and allocates later correction versions monotonically', async () => {
		tx.aperturaRevision.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
			.mockResolvedValueOnce(null).mockResolvedValueOnce({ version: 3 });
		await createAperturaRevisionDraft(actor, { periodoId: 'p1', aperturaId: 'a1', fechaCorte: date, lines });
		await createAperturaRevisionDraft(actor, { periodoId: 'p1', aperturaId: 'a1', fechaCorte: date, lines });
		expect(tx.aperturaRevision.create.mock.calls.map(([args]) => args.data.version)).toEqual([1, 4]);
	});

	it('does not create a new draft after an opening revision was approved', async () => {
		tx.aperturaRevision.findFirst.mockResolvedValueOnce({ revisionId: 'already-approved' });
		await expect(createAperturaRevisionDraft(actor, {
			periodoId: 'p1', aperturaId: 'a1', fechaCorte: date, lines,
		})).rejects.toThrow();
		expect(tx.aperturaRevision.create).not.toHaveBeenCalled();
	});

	it('rejects a cutoff outside the tenant-owned period before creating a revision', async () => {
		await expect(createAperturaRevisionDraft(actor, {
			periodoId: 'p1', aperturaId: 'a1', fechaCorte: new Date('2027-01-01T00:00:00Z'), lines,
		})).rejects.toThrow('fecha de corte');
		expect(tx.aperturaRevision.create).not.toHaveBeenCalled();
	});

	it('requires stored lines and an active actor membership before submission', async () => {
		tx.tenantMembership.findFirst.mockResolvedValue(null);
		await expect(submitAperturaRevision(actor, 'r1')).rejects.toThrow();
		expect(tx.aperturaRevision.updateMany).not.toHaveBeenCalled();
	});

	it('submits only a valid recomputed persisted revision and stores the presenter', async () => {
		const evidenceLines = lines.map((line) => {
			const source = { kind: line.fuenteTipo, evidenceVersion: line.evidenciaVersion,
				sourceId: line.fuenteId, snapshot: line.fuenteSnapshot, hash: '' };
			source.hash = computeAperturaEvidenceHash(source);
			return { tenantId: 'tenant-1', effectiveDate: line.fechaEfectiva, role: line.rolCuenta, accountId: line.cuentaId, currency: 'CUP',
				amount: line.importeNativo, debit: line.lado === 'DEBE' ? line.importeFuncional : '0',
				credit: line.lado === 'HABER' ? line.importeFuncional : '0', source };
		});
		const storedLines = lines.map((line, index) => ({ ...line, tenantId: 'tenant-1', aperturaId: 'a1', revisionId: 'r1',
			periodoId: 'p1', monedaFuncional: 'CUP', cuentaId: line.cuentaId, monedaNativa: 'CUP',
			importeNativo: line.importeNativo, importeFuncional: line.importeFuncional, tasaCambio: null,
			fechaTasaCambio: null, fuenteTasaCambio: null, fuenteSnapshot: line.fuenteSnapshot,
			fxCatalogRateId: null, fxFingerprint: null, fuenteId: line.fuenteId,
			evidenciaSha256: evidenceLines[index].source.hash }));
		const digest = computeAperturaPreflightDigest({ tenantId: 'tenant-1', periodId: 'p1', openingDate: date,
			functionalCurrency: 'CUP', lines: evidenceLines });
		const evidenceDigest = createHash('sha256').update(evidenceLines.map((line) => line.source.hash).sort().join(':'), 'utf8').digest('hex');
		tx.tenantMembership.findFirst.mockResolvedValue({ membershipId: 'm1' });
		tx.aperturaRevision.findFirst.mockResolvedValue({ revisionId: 'r1', tenantId: 'tenant-1', periodoId: 'p1',
			fechaCorte: date, estado: 'BORRADOR', digestVersion: 1, digestSha256: digest,
			evidenciaVersion: 1, evidenciaSha256: evidenceDigest,
			apertura: { monedaFuncional: 'CUP' }, periodo: { fechaInicio: date, fechaFin: new Date('2026-12-31T00:00:00Z') },
			lineas: storedLines });
		storedLines[0].fechaEfectiva = new Date('2026-02-01T00:00:00Z');
		await expect(submitAperturaRevision(actor, 'r1')).rejects.toThrow('digest');
		expect(tx.aperturaRevision.updateMany).not.toHaveBeenCalled();
		storedLines[0].fechaEfectiva = date;
		tx.aperturaRevision.updateMany.mockResolvedValue({ count: 1 });
		tx.aperturaRevision.findUnique.mockResolvedValue({ estado: 'PRESENTADA', presentadaPor: actor.userId });
		await expect(submitAperturaRevision(actor, 'r1')).resolves.toMatchObject({ estado: 'PRESENTADA' });
		expect(tx.aperturaRevision.updateMany).toHaveBeenCalledWith(expect.objectContaining({
			where: { revisionId: 'r1', tenantId: 'tenant-1', estado: 'BORRADOR' },
			data: expect.objectContaining({ presentadaPor: actor.userId }),
		}));
	});

	it('rejects tampered source evidence and does not transition state', async () => {
		tx.tenantMembership.findFirst.mockResolvedValue({ membershipId: 'm1' });
		tx.aperturaRevision.findFirst.mockResolvedValue({ revisionId: 'r1', tenantId: 'tenant-1', periodoId: 'p1',
			fechaCorte: date, estado: 'BORRADOR', digestVersion: 1, digestSha256: 'f'.repeat(64),
			apertura: { monedaFuncional: 'CUP' }, periodo: { fechaInicio: date, fechaFin: new Date('2026-12-31T00:00:00Z') },
			lineas: [{ tenantId: 'tenant-1', lado: 'DEBE', rolCuenta: 'CASH', cuentaId: 'cash', monedaNativa: 'CUP',
				importeNativo: '10', importeFuncional: '10', fuenteTipo: 'MANUAL', fuenteId: 'source', evidenciaVersion: 1,
				fuenteSnapshot: { note: 'x' }, evidenciaSha256: 'a'.repeat(64) }] });
		await expect(submitAperturaRevision(actor, 'r1')).rejects.toThrow();
		expect(tx.aperturaRevision.updateMany).not.toHaveBeenCalled();
	});

	it('rejects unverified TRUSTED source lines during presentation', async () => {
		tx.aperturaRevision.findFirst.mockResolvedValue({ revisionId: 'r1', tenantId: 'tenant-1', periodoId: 'p1',
			fechaCorte: date, estado: 'BORRADOR', digestVersion: 1, digestSha256: 'f'.repeat(64),
			evidenciaVersion: 1, evidenciaSha256: 'f'.repeat(64),
			apertura: { monedaFuncional: 'CUP' }, periodo: { fechaInicio: date, fechaFin: new Date('2026-12-31T00:00:00Z') },
			lineas: [{ tenantId: 'tenant-1', fechaEfectiva: date, lado: 'DEBE', rolCuenta: 'CASH', cuentaId: 'cash', monedaNativa: 'CUP',
				importeNativo: '10', importeFuncional: '10', fuenteTipo: 'TRUSTED', fuenteId: 'source', evidenciaVersion: 1,
				fuenteSnapshot: { note: 'x' }, evidenciaSha256: 'a'.repeat(64) }] });
		await expect(submitAperturaRevision(actor, 'r1')).rejects.toThrow();
		expect(tx.aperturaRevision.updateMany).not.toHaveBeenCalled();
	});

	it('does not permit submitted revisions to be submitted or mutated again', async () => {
		tx.tenantMembership.findFirst.mockResolvedValue({ membershipId: 'm1' });
		tx.aperturaRevision.findFirst.mockResolvedValue({ estado: 'PRESENTADA' });
		await expect(submitAperturaRevision(actor, 'r1')).rejects.toThrow();
		expect(tx.aperturaRevision.updateMany).not.toHaveBeenCalled();
	});

	it('atomically posts and approves a valid initial CUP manual opening', async () => {
		const revision = approvalRevision();
		tx.aperturaRevision.findFirst.mockResolvedValue(revision);
		tx.aperturaRevision.updateMany.mockResolvedValue({ count: 1 });
		tx.aperturaRevision.findUnique.mockResolvedValue({ ...revision, estado: 'APROBADA' });
		await expect(approveAperturaRevision(actor, revision.revisionId)).resolves.toMatchObject({
			estado: 'APROBADA', asientoId: 'seat-1',
		});
		expect(insertarAsientoMock).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: 'tenant-1', userId: actor.userId }),
			expect.objectContaining({ origenTipo: 'apertura_revision', origenId: revision.revisionId,
				lineas: expect.arrayContaining([expect.objectContaining({ monedaOriginal: 'CUP' })]) }));
		expect(requirePermission).toHaveBeenCalledWith(actor, 'financiero.apertura.aprobar', 'aprobar la apertura contable');
		expect(tx.aperturaRevision.updateMany).toHaveBeenCalledWith(expect.objectContaining({
			where: { revisionId: revision.revisionId, tenantId: 'tenant-1', estado: 'PRESENTADA' },
			data: expect.objectContaining({ estado: 'APROBADA', revisadaPor: actor.userId }),
		}));
	});

	it('rejects self-approval and rollover openings', async () => {
		const sameActor = approvalRevision();
		sameActor.presentadaPor = actor.userId;
		tx.aperturaRevision.findFirst.mockResolvedValueOnce(sameActor);
		await expect(approveAperturaRevision(actor, sameActor.revisionId)).rejects.toThrow();
		const rollover = approvalRevision();
		rollover.apertura.origenPeriodoId = 'previous-period';
		tx.aperturaRevision.findFirst.mockResolvedValueOnce(rollover);
		await expect(approveAperturaRevision(actor, rollover.revisionId)).rejects.toThrow();
		expect(insertarAsientoMock).not.toHaveBeenCalled();
	});

	it('rejects foreign-currency openings, missing tenant role mappings, and header-only legacy openings', async () => {
		const foreign = approvalRevision();
		foreign.lineas[0].monedaNativa = 'USD';
		tx.aperturaRevision.findFirst.mockResolvedValueOnce(foreign);
		await expect(approveAperturaRevision(actor, foreign.revisionId)).rejects.toThrow();
		const roleMismatch = approvalRevision();
		tx.cuentaRolTenant.findMany.mockResolvedValueOnce([]);
		tx.aperturaRevision.findFirst.mockResolvedValueOnce(roleMismatch);
		await expect(approveAperturaRevision(actor, roleMismatch.revisionId)).rejects.toThrow();
		tx.aperturaRevision.findFirst.mockResolvedValueOnce(null);
		await expect(approveAperturaRevision(actor, 'legacy-header-only')).rejects.toThrow();
		expect(insertarAsientoMock).not.toHaveBeenCalled();
	});

	it('returns an existing matching approval safely on retry', async () => {
		const approved = approvalRevision();
		approved.estado = 'APROBADA';
		(approved as Record<string, unknown>).revisadaPor = 'reviewer-1';
		(approved as Record<string, unknown>).revisadaAt = date;
		tx.aperturaRevision.findFirst.mockResolvedValue(approved);
		tx.asiento.findUnique.mockResolvedValue({ asientoId: 'seat-existing', tenantId: 'tenant-1',
			origenTipo: 'apertura_revision', origenId: approved.revisionId });
		await expect(approveAperturaRevision(actor, approved.revisionId)).resolves.toMatchObject({
			estado: 'APROBADA', asientoId: 'seat-existing', duplicado: true,
		});
		expect(insertarAsientoMock).not.toHaveBeenCalled();
	});

	it('revalidates active presenter membership and current tenant permission in the approval transaction', async () => {
		const revision = approvalRevision();
		tx.aperturaRevision.findFirst.mockResolvedValue(revision);
		tx.tenantMembership.findFirst.mockImplementation(async ({ where }: { where: { userId: string } }) => {
			if (where.userId === 'preparer-1') return null;
			return { membershipId: 'm-reviewer', tenantRole: 'manager', customRoleId: null, user: { isActive: true } };
		});
		await expect(approveAperturaRevision(actor, revision.revisionId)).rejects.toThrow();
		expect(insertarAsientoMock).not.toHaveBeenCalled();
	});

	it('rejects an inactive presenter user even if the old membership remains active', async () => {
		const revision = approvalRevision();
		tx.aperturaRevision.findFirst.mockResolvedValue(revision);
		tx.tenantMembership.findFirst.mockImplementation(async ({ where }: { where: { userId: string } }) => ({
			membershipId: `m-${where.userId}`, tenantRole: 'manager', customRoleId: null,
			user: { isActive: where.userId !== 'preparer-1' },
		}));
		await expect(approveAperturaRevision(actor, revision.revisionId)).rejects.toThrow();
		expect(insertarAsientoMock).not.toHaveBeenCalled();
	});

	it('rejects a presenter whose active custom role no longer grants presentation', async () => {
		const revision = approvalRevision();
		tx.aperturaRevision.findFirst.mockResolvedValue(revision);
		tx.tenantMembership.findFirst.mockImplementation(async ({ where }: { where: { userId: string } }) => ({
			membershipId: `m-${where.userId}`, tenantRole: 'manager',
			customRoleId: where.userId === 'preparer-1' ? 'role-preparer' : null, user: { isActive: true },
		}));
		tx.tenantRole.findFirst.mockResolvedValue({ permissions: [] });
		await expect(approveAperturaRevision(actor, revision.revisionId)).rejects.toThrow();
		expect(insertarAsientoMock).not.toHaveBeenCalled();
	});

	it('rejects an approver whose current custom role no longer grants approval', async () => {
		const revision = approvalRevision();
		tx.aperturaRevision.findFirst.mockResolvedValue(revision);
		tx.tenantMembership.findFirst.mockResolvedValue({ membershipId: 'm-reviewer', tenantRole: 'manager',
			customRoleId: 'role-reviewer', user: { isActive: true } });
		tx.tenantRole.findFirst.mockResolvedValue({ permissions: [] });
		await expect(approveAperturaRevision(actor, revision.revisionId)).rejects.toThrow();
		expect(insertarAsientoMock).not.toHaveBeenCalled();
	});

	it('rejects an unlinked opening period when an earlier tenant period exists', async () => {
		const revision = approvalRevision();
		tx.aperturaRevision.findFirst.mockResolvedValue(revision);
		tx.periodoContable.findMany.mockResolvedValue([{ periodoId: 'older-period' }]);
		await expect(approveAperturaRevision(actor, revision.revisionId)).rejects.toThrow();
		expect(insertarAsientoMock).not.toHaveBeenCalled();
	});

	it('rejects approval when another revision or opening journal already exists for this period', async () => {
		const revision = approvalRevision();
		tx.aperturaRevision.findFirst.mockResolvedValue(revision);
		tx.aperturaRevision.findMany.mockResolvedValueOnce([{ revisionId: 'prior-approved' }]);
		await expect(approveAperturaRevision(actor, revision.revisionId)).rejects.toThrow();
		expect(insertarAsientoMock).not.toHaveBeenCalled();

		tx.aperturaRevision.findMany.mockResolvedValueOnce([]);
		tx.asiento.findFirst.mockResolvedValueOnce({ asientoId: 'opening-seat-existing' });
		await expect(approveAperturaRevision(actor, revision.revisionId)).rejects.toThrow();
		expect(insertarAsientoMock).not.toHaveBeenCalled();
	});
});
