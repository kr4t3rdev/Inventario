import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

describe('historical ledger with a later reversal', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let getLedger: typeof import('../services/libro-mayor-service').obtenerLibroMayor;
  let tenantId: string;
  let accountId: string;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    ({ obtenerLibroMayor: getLedger } = await import('../services/libro-mayor-service'));
    const [identity] = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity, process.env);
    const tenant = await prisma.tenant.create({ data: { nombre: 'Ledger integration' } });
    tenantId = tenant.tenantId;
    const account = await prisma.cuentaContable.create({ data: {
      tenantId, codigo: '101', nombre: 'Caja', tipo: 'ACTIVO', naturaleza: 'DEUDORA',
    } });
    accountId = account.cuentaContableId;
    const contra = await prisma.cuentaContable.create({ data: {
      tenantId, codigo: '301', nombre: 'Capital', tipo: 'PATRIMONIO', naturaleza: 'ACREEDORA',
    } });
    const diary = await prisma.diario.create({ data: { tenantId, codigo: 'AP', nombre: 'Diario', tipo: 'APERTURA_CIERRE' } });
    const reverseId = `reverse-${crypto.randomUUID()}`;
    const january = await prisma.periodoContable.create({ data: { tenantId, tipo: 'MENSUAL', fechaInicio: new Date('2026-01-01T00:00:00Z'), fechaFin: new Date('2026-01-31T23:59:59Z') } });
    const february = await prisma.periodoContable.create({ data: { tenantId, tipo: 'MENSUAL', fechaInicio: new Date('2026-02-01T00:00:00Z'), fechaFin: new Date('2026-02-28T23:59:59Z') } });
    const original = await prisma.asiento.create({ data: {
      tenantId, diarioId: diary.diarioId, periodoId: january.periodoId, numero: 1,
      fecha: new Date('2026-01-15T12:00:00Z'), descripcion: 'Original', estado: 'ANULADO',
      origenTipo: 'test', origenId: 'original', hash: 'original', createdBy: 'test', revertidoPorId: reverseId,
    } });
    await prisma.asiento.create({ data: {
      asientoId: reverseId, tenantId, diarioId: diary.diarioId, periodoId: february.periodoId, numero: 1,
      fecha: new Date('2026-02-15T12:00:00Z'), descripcion: 'Reverse', origenTipo: 'REVERSO_ASIENTO',
      origenId: original.asientoId, hash: 'reverse', createdBy: 'test',
    } });
    await prisma.asientoLinea.createMany({ data: [
      { tenantId, asientoId: original.asientoId, cuentaId: accountId, orden: 1, debe: 100, haber: 0, monedaOriginal: 'CUP', montoOriginal: 100 },
      { tenantId, asientoId: original.asientoId, cuentaId: contra.cuentaContableId, orden: 2, debe: 0, haber: 100, monedaOriginal: 'CUP', montoOriginal: 100 },
      { tenantId, asientoId: reverseId, cuentaId: accountId, orden: 1, debe: 0, haber: 100, monedaOriginal: 'CUP', montoOriginal: 100 },
      { tenantId, asientoId: reverseId, cuentaId: contra.cuentaContableId, orden: 2, debe: 100, haber: 0, monedaOriginal: 'CUP', montoOriginal: 100 },
    ] });
  });

  afterAll(async () => { await prisma?.$disconnect(); });

  it('preserves the original at January cutoff and applies the reversal in February', async () => {
    const january = await getLedger(tenantId, { cuentaId: accountId, fechaDesde: '2026-01-01T00:00:00Z', fechaHasta: '2026-01-31T23:59:59Z' });
    const february = await getLedger(tenantId, { cuentaId: accountId, fechaDesde: '2026-02-01T00:00:00Z', fechaHasta: '2026-02-28T23:59:59Z' });
    expect(january.saldoFinal).toBe(100);
    expect(january.movimientos).toHaveLength(1);
    expect(february.saldoInicial).toBe(100);
    expect(february.saldoFinal).toBe(0);
    expect(february.movimientos).toHaveLength(1);
  });
});
