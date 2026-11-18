import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { ensureCutoffPeriod } from '@/features/contabilidad/services/initialization-period';

const tenantId = 'tenant-period-qa';

describe('período de corte (PostgreSQL)', () => {
  beforeAll(async () => {
    await prisma.tenant.create({ data: { tenantId, nombre: 'Periodo QA', slug: 'periodo-qa' } });
  });

  afterAll(async () => {
    await prisma.aperturaPeriodo.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { tenantId } });
  });

  it('crea el período mensual abierto de la fecha de corte', async () => {
    const periodo = await prisma.$transaction((tx) => ensureCutoffPeriod(tx, { tenantId, fechaCorte: '2026-11-01', actor: 'user-qa' }));
    expect(periodo.tipo).toBe('MENSUAL');
    expect(periodo.estado).toBe('ABIERTO');
    expect(periodo.fechaInicio.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(periodo.fechaFin.toISOString()).toBe('2026-11-30T00:00:00.000Z');
  });

  it('reutiliza el mismo período en la segunda llamada', async () => {
    const first = await prisma.$transaction((tx) => ensureCutoffPeriod(tx, { tenantId, fechaCorte: '2026-11-15', actor: 'user-qa' }));
    const second = await prisma.$transaction((tx) => ensureCutoffPeriod(tx, { tenantId, fechaCorte: '2026-11-20', actor: 'user-qa' }));
    expect(second.periodoId).toBe(first.periodoId);
    expect(await prisma.periodoContable.count({ where: { tenantId, tipo: 'MENSUAL' } })).toBe(1);
  });

  it('crea un período distinto para otro mes', async () => {
    const december = await prisma.$transaction((tx) => ensureCutoffPeriod(tx, { tenantId, fechaCorte: '2026-12-05', actor: 'user-qa' }));
    expect(december.fechaInicio.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(await prisma.periodoContable.count({ where: { tenantId, tipo: 'MENSUAL' } })).toBe(2);
  });

  it('rechaza un período cerrado', async () => {
    const january = await prisma.$transaction((tx) => ensureCutoffPeriod(tx, { tenantId, fechaCorte: '2027-01-10', actor: 'user-qa' }));
    await prisma.periodoContable.update({ where: { periodoId: january.periodoId }, data: { estado: 'CERRADO' } });
    await expect(prisma.$transaction((tx) => ensureCutoffPeriod(tx, { tenantId, fechaCorte: '2027-01-20', actor: 'user-qa' })))
      .rejects.toMatchObject({ code: 'PERIODO_CERRADO' });
  });

  it('rechaza un período que ya tiene apertura', async () => {
    const february = await prisma.$transaction((tx) => ensureCutoffPeriod(tx, { tenantId, fechaCorte: '2027-02-10', actor: 'user-qa' }));
    await prisma.aperturaPeriodo.create({ data: { periodoId: february.periodoId, tenantId, detalleJson: { version: 1 } } });
    await expect(prisma.$transaction((tx) => ensureCutoffPeriod(tx, { tenantId, fechaCorte: '2027-02-20', actor: 'user-qa' })))
      .rejects.toMatchObject({ code: 'PERIODO_YA_ABIERTO' });
  });
});
