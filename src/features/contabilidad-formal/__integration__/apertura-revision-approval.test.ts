/**
 * @description Verifies manual CUP opening approval and rollback against disposable PostgreSQL.
 */
import { randomUUID } from 'node:crypto';
import { beforeEach, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';
import {
  approveAperturaRevision,
  createAperturaRevisionDraft,
  submitAperturaRevision,
} from '@/features/contabilidad-formal/services/apertura-revision-service';

const DB_URL = process.env.DATABASE_URL ?? '';
const date = new Date('2026-01-15T12:00:00.000Z');
const ids: { tenantId: string; users: string[]; periodoId: string } = {
  tenantId: '', users: [], periodoId: '',
};

function assertDisposableTarget(): void {
  expect(process.env.ALLOW_DISPOSABLE_TEST_DB).toBe('1');
  expect(DB_URL).not.toBe('');
  expect(process.env.DATABASE_URL_TEST).toBe(DB_URL);
  expect(process.env.DIRECT_URL).toBe(DB_URL);
  const url = new URL(DB_URL);
  expect(['postgres:', 'postgresql:']).toContain(url.protocol);
  expect(['127.0.0.1', 'localhost', '[::1]']).toContain(url.hostname);
  expect(url.pathname).toMatch(/^\/tcp_test_[a-z0-9_]+$/);
  expect(url.port).not.toBe('');
}

function user(userId: string, tenantId = ids.tenantId) {
  return {
    userId, name: userId, email: `${userId}@test.invalid`, role: 'user' as const,
    isActive: true, tenantId, tenantRole: 'manager' as const,
  } as never;
}

async function makeRevision(preparerId: string, aperturaId?: string) {
  const cash = await prisma.cuentaRolTenant.findUniqueOrThrow({
    where: { tenantId_rol: { tenantId: ids.tenantId, rol: 'CAJA_PRINCIPAL' } },
  });
  const equity = await prisma.cuentaRolTenant.findUniqueOrThrow({
    where: { tenantId_rol: { tenantId: ids.tenantId, rol: 'CAPITAL_SOCIAL' } },
  });
  const openingId = aperturaId ?? (await prisma.aperturaPeriodo.create({
    data: { tenantId: ids.tenantId, periodoId: ids.periodoId, monedaFuncional: 'CUP' },
  })).aperturaId;
  const draft = await createAperturaRevisionDraft(user(preparerId), {
    periodoId: ids.periodoId, aperturaId: openingId, fechaCorte: date,
    lines: [
      { fechaEfectiva: date, lado: 'DEBE', rolCuenta: 'CAJA_PRINCIPAL', cuentaId: cash.cuentaId,
        monedaNativa: 'CUP', importeNativo: '250', importeFuncional: '250', fuenteTipo: 'MANUAL',
        fuenteId: `opening-cash-${randomUUID()}`, evidenciaVersion: 1, fuenteSnapshot: { reference: 'cash count' } },
      { fechaEfectiva: date, lado: 'HABER', rolCuenta: 'CAPITAL_SOCIAL', cuentaId: equity.cuentaId,
        monedaNativa: 'CUP', importeNativo: '250', importeFuncional: '250', fuenteTipo: 'MANUAL',
        fuenteId: `opening-equity-${randomUUID()}`, evidenciaVersion: 1, fuenteSnapshot: { reference: 'capital record' } },
    ],
  });
  return submitAperturaRevision(user(preparerId), draft.revisionId);
}

describe('manual CUP opening approval — disposable PostgreSQL', { timeout: 60_000 }, () => {
  beforeAll(() => assertDisposableTarget());

  beforeEach(async () => {
    const suffix = randomUUID().replaceAll('-', '');
    const tenant = await prisma.tenant.create({ data: { nombre: 'Opening approval test', slug: `open-approval-${suffix}` } });
    ids.tenantId = tenant.tenantId;
    const preparer = await prisma.user.create({ data: { name: 'Preparer', email: `prep-${suffix}@test.invalid`, password: 'test-hash' } });
    const checker = await prisma.user.create({ data: { name: 'Checker', email: `check-${suffix}@test.invalid`, password: 'test-hash' } });
    const outsider = await prisma.user.create({ data: { name: 'Outsider', email: `out-${suffix}@test.invalid`, password: 'test-hash' } });
    ids.users = [preparer.userId, checker.userId, outsider.userId];
    await prisma.tenantMembership.createMany({ data: [
      { tenantId: ids.tenantId, userId: preparer.userId, tenantRole: 'manager' },
      { tenantId: ids.tenantId, userId: checker.userId, tenantRole: 'manager' },
    ] });
    const period = await prisma.periodoContable.create({ data: {
      tenantId: ids.tenantId, tipo: 'MENSUAL', estado: 'ABIERTO', codigo: `OPEN-${suffix}`,
      fechaInicio: new Date('2026-01-01T00:00:00Z'), fechaFin: new Date('2026-01-31T23:59:59.999Z'),
    } });
    ids.periodoId = period.periodoId;
    await prisma.$transaction((tx) => seedPlanContable(tx, ids.tenantId));
  });

  it('posts a balanced single journal with independent maker/checker and remains idempotent', async () => {
    const [preparerId, checkerId] = ids.users;
    const revision = await makeRevision(preparerId);
    await expect(approveAperturaRevision(user(ids.users[2]), revision!.revisionId)).rejects.toThrow();
    expect((await prisma.aperturaRevision.findUniqueOrThrow({ where: { revisionId: revision!.revisionId } })).estado).toBe('PRESENTADA');
    const first = await approveAperturaRevision(user(checkerId), revision!.revisionId);
    expect(first).toMatchObject({ estado: 'APROBADA', duplicado: false });
    const second = await approveAperturaRevision(user(checkerId), revision!.revisionId);
    expect(second).toMatchObject({ estado: 'APROBADA', asientoId: first.asientoId, duplicado: true });
    const persisted = await prisma.aperturaRevision.findUniqueOrThrow({ where: { revisionId: revision!.revisionId } });
    expect(persisted).toMatchObject({ estado: 'APROBADA', presentadaPor: preparerId, revisadaPor: checkerId });
    const journal = await prisma.asiento.findUniqueOrThrow({
      where: { tenantId_origenTipo_origenId: { tenantId: ids.tenantId, origenTipo: 'apertura_revision', origenId: revision!.revisionId } },
      include: { lineas: true },
    });
    expect(journal.lineas).toHaveLength(2);
    expect(journal.lineas.reduce((sum, line) => sum + Number(line.debe), 0)).toBe(250);
    expect(journal.lineas.reduce((sum, line) => sum + Number(line.haber), 0)).toBe(250);
    expect(await prisma.asiento.count({ where: { tenantId: ids.tenantId, origenTipo: 'apertura_revision', origenId: revision!.revisionId } })).toBe(1);
  });

  it('rolls back journal and approval together when PostgreSQL rejects the journal insert', async () => {
    const preparerId = ids.users[0];
    const checkerId = ids.users[1];
    const revision = await makeRevision(preparerId);
    const trigger = `opening_failure_${randomUUID().replaceAll('-', '')}`;
    const fn = `${trigger}_fn`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${fn}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected opening journal failure'; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "asientos" FOR EACH ROW WHEN (NEW."origenTipo" = 'apertura_revision') EXECUTE FUNCTION "${fn}"()`);
    try {
      await expect(approveAperturaRevision(user(checkerId), revision!.revisionId)).rejects.toThrow('injected opening journal failure');
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "asientos"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"()`);
    }
    expect((await prisma.aperturaRevision.findUniqueOrThrow({ where: { revisionId: revision!.revisionId } })).estado).toBe('PRESENTADA');
    expect(await prisma.asiento.count({ where: { tenantId: ids.tenantId, origenTipo: 'apertura_revision', origenId: revision!.revisionId } })).toBe(0);
    const retried = await approveAperturaRevision(user(checkerId), revision!.revisionId);
    expect(retried).toMatchObject({ estado: 'APROBADA', duplicado: false });
  });

  it('serializes competing approvals for two presented revisions of one opening', async () => {
    const [preparerId, checkerId] = ids.users;
    const opening = await prisma.aperturaPeriodo.create({
      data: { tenantId: ids.tenantId, periodoId: ids.periodoId, monedaFuncional: 'CUP' },
    });
    const first = await makeRevision(preparerId, opening.aperturaId);
    const second = await makeRevision(preparerId, opening.aperturaId);
    expect(first?.estado).toBe('PRESENTADA');
    expect(second?.estado).toBe('PRESENTADA');

    const attempts = await Promise.allSettled([
      approveAperturaRevision(user(checkerId), first!.revisionId),
      approveAperturaRevision(user(checkerId), second!.revisionId),
    ]);
    const winners = attempts.filter((attempt) => attempt.status === 'fulfilled');
    const losers = attempts.filter((attempt) => attempt.status === 'rejected');
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    const winner = winners[0];
    if (!winner || winner.status !== 'fulfilled') throw new Error('Expected one committed approval');
    const loser = losers[0];
    if (!loser || loser.status !== 'rejected') throw new Error('Expected one rejected approval');
    const failure = loser.reason;
    const failureMessage = failure instanceof Error ? failure.message : '';
    const failureCode = typeof failure === 'object' && failure !== null && 'code' in failure
      ? failure.code
      : undefined;
    const expectedConflictMessages = [
      'La apertura ya tiene otra revisión aprobada',
      'Ya existe un asiento formal de apertura para este período',
    ];
    expect(expectedConflictMessages.includes(failureMessage) || failureCode === 'P2034' || failureCode === '40001')
      .toBe(true);

    expect(await prisma.aperturaRevision.count({
      where: { tenantId: ids.tenantId, periodoId: ids.periodoId, aperturaId: opening.aperturaId, estado: 'APROBADA' },
    })).toBe(1);
    expect(await prisma.asiento.count({
      where: { tenantId: ids.tenantId, periodoId: ids.periodoId, origenTipo: 'apertura_revision' },
    })).toBe(1);
    const retry = await approveAperturaRevision(user(checkerId), winner.value.revisionId);
    expect(retry).toMatchObject({ estado: 'APROBADA', asientoId: winner.value.asientoId, duplicado: true });
  });

	it('freezes presented and approved revisions and lines at the database level', async () => {
		const [preparerId, checkerId] = ids.users;
		const revision = await makeRevision(preparerId);
		const revisionId = revision!.revisionId;

		// R3.7: una revisión PRESENTADA no admite UPDATE directo (tamper del revisor).
		await expect(
			prisma.aperturaRevision.update({
				where: { revisionId },
				data: { revisadaPor: 'tamperer' },
			}),
		).rejects.toThrow(/invalid opening revision lifecycle transition/);

		// R3.7 append-only: DELETE siempre rechazado.
		await expect(
			prisma.aperturaRevision.delete({ where: { revisionId } }),
		).rejects.toThrow(/opening revisions are append-only/);

		// R3.7: las líneas de evidencia de una revisión presentada son inmutables.
		const linea = await prisma.lineaAperturaPeriodo.findFirstOrThrow({
			where: { tenantId: ids.tenantId, periodoId: ids.periodoId, revisionId },
		});
		await expect(
			prisma.lineaAperturaPeriodo.update({
				where: { lineaId: linea.lineaId },
				data: { importeFuncional: '777' },
			}),
		).rejects.toThrow(/submitted opening revision evidence lines are immutable/);

		// La transición legitima al servicio sí es permitida por el trigger.
		await approveAperturaRevision(user(checkerId), revisionId);

		// Tras la aprobación, cualquier UPDATE (incluido un cambio de estado) falla.
		await expect(
			prisma.aperturaRevision.update({
				where: { revisionId },
				data: { estado: 'RETIRADA' },
			}),
		).rejects.toThrow(/invalid opening revision lifecycle transition/);

		// Una vez aprobada, el servicio también cierra la creación de borradores:
		// la corrección posterior se hace a nivel de asiento (reverso), no con
		// revisiones sustitutivas. Divergencia respecto al detalle de R3.7
		// ("revisión append-only que referencie la sustituida") registrada en
		// tasks.md pendiente de decisión; aquí se fija el comportamiento real.
		await expect(createAperturaRevisionDraft(user(preparerId), {
			periodoId: ids.periodoId,
			aperturaId: revision!.aperturaId,
			fechaCorte: date,
			lines: [
				{ fechaEfectiva: date, lado: 'DEBE', rolCuenta: 'CAJA_PRINCIPAL',
					cuentaId: (await prisma.cuentaRolTenant.findUniqueOrThrow({
						where: { tenantId_rol: { tenantId: ids.tenantId, rol: 'CAJA_PRINCIPAL' } },
					})).cuentaId,
					monedaNativa: 'CUP', importeNativo: '250', importeFuncional: '250',
					fuenteTipo: 'MANUAL', fuenteId: `opening-cash-fix-${randomUUID()}`,
					evidenciaVersion: 1, fuenteSnapshot: { reference: 'corrected cash count' } },
				{ fechaEfectiva: date, lado: 'HABER', rolCuenta: 'CAPITAL_SOCIAL',
					cuentaId: (await prisma.cuentaRolTenant.findUniqueOrThrow({
						where: { tenantId_rol: { tenantId: ids.tenantId, rol: 'CAPITAL_SOCIAL' } },
					})).cuentaId,
					monedaNativa: 'CUP', importeNativo: '250', importeFuncional: '250',
					fuenteTipo: 'MANUAL', fuenteId: `opening-equity-fix-${randomUUID()}`,
					evidenciaVersion: 1, fuenteSnapshot: { reference: 'corrected capital record' } },
			],
		})).rejects.toThrow('No se pueden crear revisiones después de aprobar la apertura');
	});
});
