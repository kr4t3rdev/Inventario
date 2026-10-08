import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { registrarResultadoShadow, consumirResultadosShadow, consultarMetricasShadow } from '@/features/contabilidad-formal/services/shadow-outbox';
import { intentarPosteoShadow } from '@/features/contabilidad-formal/services/shadow-savepoint';

const origen = `shadow-${crypto.randomUUID()}`;

afterAll(async () => {
  await prisma.shadowPosteoOutbox.deleteMany({ where: { origenId: { startsWith: origen } } });
});

describe('outbox shadow ligada al commit', () => {
  it('reporta únicamente commits por tenant y evento, sin duplicar al reintentar', async () => {
    const tenantId = `tenant-${crypto.randomUUID()}`;
    const otroTenantId = `tenant-${crypto.randomUUID()}`;
    const base = { tenantId, tipoEvento: 'VENTA_CONTADO', origenTipo: 'venta' };
    await expect(prisma.$transaction(async (tx) => {
      await registrarResultadoShadow(tx, { ...base, origenId: `${origen}-metric-rollback`,
        estado: 'ERROR_SHADOW', causa: 'SQL_ERROR', duracionMs: 99 });
      throw new Error('rollback');
    })).rejects.toThrow('rollback');
    const filas = [
      { ...base, origenId: `${origen}-metric-sql-1`, estado: 'ERROR_SHADOW' as const,
        causa: 'SQL_ERROR', duracionMs: 5 },
      { ...base, origenId: `${origen}-metric-sql-2`, estado: 'ERROR_SHADOW' as const,
        causa: 'SQL_ERROR', duracionMs: 10 },
      { ...base, origenId: `${origen}-metric-sql-3`, estado: 'ERROR_SHADOW' as const,
        causa: 'SQL_ERROR', duracionMs: 20 },
      { ...base, origenId: `${origen}-metric-sql-4`, estado: 'ERROR_SHADOW' as const,
        causa: 'SQL_ERROR', duracionMs: 40 },
      { ...base, origenId: `${origen}-metric-simulated`, estado: 'SIMULADO' as const,
        duracionMs: 11 },
      { ...base, tipoEvento: 'COMPRA', origenId: `${origen}-metric-purchase`,
        estado: 'ERROR_SHADOW' as const, causa: 'SQL_ERROR', duracionMs: 7 },
      { ...base, origenId: `${origen}-metric-omitted`, estado: 'OMITIDO' as const,
        causa: 'REGLA_AUSENTE', duracionMs: 9 },
      { ...base, tenantId: otroTenantId, origenId: `${origen}-metric-other-tenant`,
        estado: 'ERROR_SHADOW' as const, causa: 'SQL_ERROR', duracionMs: 999 },
    ];
    for (const fila of filas) {
      await prisma.$transaction((tx) => registrarResultadoShadow(tx, fila));
    }
    await prisma.$transaction(async (tx) => {
      await registrarResultadoShadow(tx, { ...base, origenId: `${origen}-metric-commit`,
        estado: 'SIMULADO', duracionMs: 500 });
    });
    expect(await consultarMetricasShadow(prisma, tenantId)).toEqual([{
      tipoEvento: 'COMPRA', estado: 'ERROR_SHADOW', causa: 'SQL_ERROR',
      cantidad: 1, latenciaP95Ms: 7,
    }, {
      tipoEvento: 'VENTA_CONTADO', estado: 'ERROR_SHADOW', causa: 'SQL_ERROR',
      cantidad: 4, latenciaP95Ms: 40,
    }, {
      tipoEvento: 'VENTA_CONTADO', estado: 'OMITIDO', causa: 'REGLA_AUSENTE',
      cantidad: 1, latenciaP95Ms: 9,
    }, {
      tipoEvento: 'VENTA_CONTADO', estado: 'SIMULADO', causa: null,
      cantidad: 2, latenciaP95Ms: 500,
    }]);
    expect(await consultarMetricasShadow(prisma, 'otro-tenant')).toEqual([]);
    expect(await consultarMetricasShadow(prisma, otroTenantId)).toEqual([{
      tipoEvento: 'VENTA_CONTADO', estado: 'ERROR_SHADOW', causa: 'SQL_ERROR',
      cantidad: 1, latenciaP95Ms: 999,
    }]);
  });
  it('solo entrega eventos confirmados y no duplica al consumir de nuevo', async () => {
    await expect(prisma.$transaction(async (tx) => {
      await registrarResultadoShadow(tx, {
        tenantId: 'tenant-probe', tipoEvento: 'VENTA_CONTADO', origenTipo: 'venta',
        origenId: `${origen}-rollback`, estado: 'SIMULADO', duracionMs: 3,
      });
      throw new Error('rollback writer');
    })).rejects.toThrow('rollback writer');

    expect(await prisma.shadowPosteoOutbox.count({ where: { origenId: `${origen}-rollback` } })).toBe(0);

    await prisma.$transaction(async (tx) => {
      await registrarResultadoShadow(tx, {
        tenantId: 'tenant-probe', tipoEvento: 'VENTA_CONTADO', origenTipo: 'venta',
        origenId: `${origen}-commit`, estado: 'ERROR_SHADOW', causa: 'SQL_ERROR', duracionMs: 5,
      });
    });
    const entregar = async () => {};
    const first = await consumirResultadosShadow(prisma, entregar, 20, 'tenant-probe');
    const second = await consumirResultadosShadow(prisma, entregar, 20, 'tenant-probe');
    expect(first.filter((item) => item.origenId === `${origen}-commit`)).toHaveLength(1);
    expect(second.find((item) => item.origenId === `${origen}-commit`)).toBeUndefined();
    expect(await prisma.shadowPosteoOutbox.count({
      where: { origenId: `${origen}-commit`, entregadoAt: { not: null } },
    })).toBe(1);
  });

  it('recupera un error SQL real tras inserción parcial y confirma writer más causa', async () => {
    const id = `${origen}-sql`;
    await prisma.$transaction(async (tx) => {
      const intento = await intentarPosteoShadow(tx, async () => {
        await tx.$executeRaw`INSERT INTO "plantillas_asiento"
          ("plantillaId", "evento", "orden", "lado", "rolCuenta", "montoRegla", "version", "activa")
          VALUES (${id}, 'VENTA_CONTADO', 1, 'DEBE', 'CAJA_PRINCIPAL', 'TOTAL', 1, true)`;
        await tx.$queryRawUnsafe('SELECT 1 / 0');
      });
      expect(intento.ok).toBe(false);
      expect(await tx.plantillaAsiento.count({ where: { plantillaId: id } })).toBe(0);
      await registrarResultadoShadow(tx, {
        tenantId: 'tenant-probe', tipoEvento: 'VENTA_CONTADO', origenTipo: 'venta',
        origenId: id, estado: 'ERROR_SHADOW', causa: 'SQL_ERROR', duracionMs: 7,
      });
    });
    expect(await prisma.plantillaAsiento.count({ where: { plantillaId: id } })).toBe(0);
    expect(await prisma.shadowPosteoOutbox.findFirst({ where: { origenId: id } }))
      .toMatchObject({ estado: 'ERROR_SHADOW', causa: 'SQL_ERROR', entregadoAt: null });
  });
});
