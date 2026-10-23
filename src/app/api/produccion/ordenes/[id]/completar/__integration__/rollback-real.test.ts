import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';

vi.mock('@/lib/auth-middleware', () => ({
  withAuthPost: (handler: (...args: unknown[]) => unknown) => handler,
}));
import { POST as _POST } from '../route';
const POST: RawHandler = _POST as unknown as RawHandler;
import type { NextRequest } from 'next/server';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
type RawHandler = (request: NextRequest, context: any, user: AuthenticatedUser) => Promise<Response>;

const prefix = `cta-production-${crypto.randomUUID()}`;
const triggerName = `cta_prod_${crypto.randomUUID().replaceAll('-', '')}`;
let tenantId: string;
let ordenId: string;
let ordenSinPermisoId: string;
let ordenPositivaId: string;
let productoId: string;
let cuentaId: string;
let tipoPagoId: string;
let recetaId: string;
let insumoId: string;
let categoriaId: string;
let almacenId: string;
let planId: string;

/**
 * @description Captura filas completas afectadas por completar una orden.
 * @param {string} scope - Tenant sintético del escenario.
 * @returns {Promise<unknown[]>} Estado ordenado de producción, inventario y contabilidad.
 */
async function productionSnapshot(scope: string): Promise<unknown[]> {
  return Promise.all([
    prisma.ordenProduccion.findMany({ where: { tenantId: scope },
      orderBy: { ordenProduccionId: 'asc' } }),
    prisma.ordenProduccionHistorial.findMany({ where: { tenantId: scope },
      orderBy: { id: 'asc' } }),
    prisma.producto.findMany({ where: { tenantId: scope }, orderBy: { id: 'asc' } }),
    prisma.stockUbicacion.findMany({ where: { tenantId: scope }, orderBy: { id: 'asc' } }),
    prisma.reconciliacionGasto.findMany({ where: { tenantId: scope },
      orderBy: { reconciliacionId: 'asc' } }),
    prisma.cuentaBancaria.findMany({ where: { tenantId: scope }, orderBy: { cuentaId: 'asc' } }),
    prisma.asiento.findMany({ where: { tenantId: scope }, orderBy: { asientoId: 'asc' },
      include: { lineas: { orderBy: { lineaId: 'asc' } } } }),
    prisma.periodoCache.findMany({ where: { tenantId: scope }, orderBy: { cacheKey: 'asc' } }),
    prisma.shadowPosteoOutbox.findMany({ where: { tenantId: scope }, orderBy: { id: 'asc' } }),
  ]);
}

/** @description Verifica rollback físico ante un fallo SQL dentro de postEvento en enforce. */
describe('completar producción — rollback PostgreSQL real', { timeout: 60_000 }, () => {
  beforeAll(async () => {
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    const target = new URL(process.env.DATABASE_URL ?? '');
    expect(identity[0]).toMatchObject({
      db: target.pathname.slice(1), port: Number(target.port),
    });
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365, features: { 'contabilidad-formal': true },
    } });
    planId = plan.planId;
    await prisma.tenantLicense.create({ data: {
      tenantId, planId, expiracion: new Date('2099-01-01'),
    } });
    await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
    await prisma.moneda.upsert({
      where: { codigo: 'USD' },
      update: {},
      create: { codigo: 'USD', nombre: 'Dólar', simbolo: '$', esPrincipal: false },
    });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'USD', updatedBy: 'actor-real' },
    });
    const now = new Date();
    await prisma.periodoContable.create({ data: {
      tenantId,
      tipo: 'MENSUAL',
      estado: 'ABIERTO',
      fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
    } });
    await PeriodoGuard.assertWritable(now, tenantId, 'asiento', {
      actorId: 'actor-real', actorTipo: 'USUARIO',
      origen: { tipo: 'orden_produccion', id: prefix },
    });
    const almacen = await prisma.almacen.create({ data: { tenantId, nombre: prefix } });
    almacenId = almacen.almacenId;
    const categoria = await prisma.categoria.create({ data: { tenantId, nombre: prefix } });
    categoriaId = categoria.catId;
    const producto = await prisma.producto.create({ data: {
      tenantId, nombre: `${prefix}-final`, categoriaId, almacenId,
      precioCosto: 0, precioVenta: 20, stock: 2,
    } });
    productoId = producto.id;
    const insumo = await prisma.producto.create({ data: {
      tenantId, nombre: `${prefix}-insumo`, categoriaId, almacenId,
      precioCosto: 10, precioVenta: 20, stock: 4,
    } });
    insumoId = insumo.id;
    const receta = await prisma.receta.create({ data: {
      recetaId: `${prefix}-receta`, tenantId, nombre: prefix, productoId, updatedAt: new Date(),
    } });
    recetaId = receta.recetaId;
    await prisma.recetaIngrediente.create({ data: {
      id: `${prefix}-ingrediente`, tenantId, recetaId, productoId: insumoId,
      cantidad: 1, unidadSimbolo: 'u', updatedAt: new Date(),
    } });
    const orden = await prisma.ordenProduccion.create({ data: {
      ordenProduccionId: `${prefix}-orden`, tenantId, recetaId, cantidad: 1,
      estado: 'EN_PROCESO', updatedAt: new Date(),
    } });
    ordenId = orden.ordenProduccionId;
    ordenSinPermisoId = (await prisma.ordenProduccion.create({ data: {
      ordenProduccionId: `${prefix}-orden-auth`, tenantId, recetaId, cantidad: 1,
      estado: 'EN_PROCESO', updatedAt: new Date(),
    } })).ordenProduccionId;
    ordenPositivaId = (await prisma.ordenProduccion.create({ data: {
      ordenProduccionId: `${prefix}-orden-success`, tenantId, recetaId, cantidad: 1,
      estado: 'EN_PROCESO', updatedAt: new Date(),
    } })).ordenProduccionId;
    const cuenta = await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: prefix, tipoCuenta: 'CORRIENTE', moneda: 'USD',
    } });
    cuentaId = cuenta.cuentaId;
    const tipo = await prisma.tipoPago.create({ data: { tenantId, tipoId: `${prefix}-pago`, nombre: prefix } });
    tipoPagoId = tipo.tipoId;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${triggerName}() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'posteo SQL rechazado' USING ERRCODE = '22012';
        RETURN NEW;
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON "asientos"
      FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}') EXECUTE FUNCTION ${triggerName}()`);
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON "asientos"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${triggerName}()`);
    if (!tenantId) return;
    await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionGasto.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.deleteMany({ where: { tenantId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.ordenProduccion.deleteMany({ where: { tenantId } });
    await prisma.recetaIngrediente.deleteMany({ where: { tenantId } });
    await prisma.receta.deleteMany({ where: { tenantId } });
    await prisma.producto.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.categoria.deleteMany({ where: { tenantId } });
    await prisma.almacen.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { tenantId } });
    await prisma.plan.deleteMany({ where: { planId } });
  });

  it('revierte stock, orden, historial y reconciliación al fallar el INSERT', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await POST(new Request(`http://localhost/api/produccion/ordenes/${ordenId}/completar`, {
      method: 'POST', body: JSON.stringify({ cuentaId, tipoPagoId }),
    }) as never, { params: Promise.resolve({ id: ordenId }) },
    { userId: 'actor-real', tenantId, tenantRole: 'manager',
      planFeatures: { produccion: true } } as never);
    expect(response.status).toBe(500);
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stock).toBe(2);
    expect((await prisma.ordenProduccion.findUniqueOrThrow({ where: { ordenProduccionId: ordenId } })).estado)
      .toBe('EN_PROCESO');
    expect(await prisma.ordenProduccionHistorial.count({ where: { ordenProduccionId: ordenId } })).toBe(0);
    expect(await prisma.reconciliacionGasto.count({ where: { tenantId, referenciaId: ordenId } })).toBe(0);
    expect(await prisma.asiento.count({ where: { tenantId, origenTipo: 'orden_produccion', origenId: ordenId } }))
      .toBe(0);
    expect(errorSpy.mock.calls.map((call) => String(call[1]))).toEqual(
      expect.arrayContaining([expect.stringContaining('posteo SQL rechazado')]),
    );
    errorSpy.mockRestore();
  });

  it('deniega dependiente sin permiso antes de cambiar la orden o el stock', async () => {
    const response = await POST(new Request(
      `http://localhost/api/produccion/ordenes/${ordenSinPermisoId}/completar`, {
        method: 'POST', body: JSON.stringify({ cuentaId, tipoPagoId }),
      }) as never,
      { params: Promise.resolve({ id: ordenSinPermisoId }) },
      { userId: 'actor-dependent', tenantId, tenantRole: 'dependiente',
        planFeatures: { produccion: true } } as never,
    );

    expect(response.status).toBe(403);
    expect((await prisma.ordenProduccion.findUniqueOrThrow({
      where: { ordenProduccionId: ordenSinPermisoId },
    })).estado).toBe('EN_PROCESO');
    expect(await prisma.ordenProduccionHistorial.count({
      where: { ordenProduccionId: ordenSinPermisoId },
    })).toBe(0);
  });

  it('registra costo de producción en la moneda funcional y deja el asiento cuadrado', async () => {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON "asientos"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${triggerName}()`);

    const response = await POST(new Request(
      `http://localhost/api/produccion/ordenes/${ordenPositivaId}/completar`, {
        method: 'POST', body: JSON.stringify({ cuentaId, tipoPagoId }),
      }) as never,
      { params: Promise.resolve({ id: ordenPositivaId }) },
      { userId: 'actor-real', tenantId, tenantRole: 'manager',
        planFeatures: { produccion: true } } as never,
    );

    expect(response.status).toBe(200);
    const reconciliacion = await prisma.reconciliacionGasto.findFirstOrThrow({
      where: { tenantId, referenciaId: ordenPositivaId, tipoGasto: 'produccion' },
    });
    expect(reconciliacion).toMatchObject({ moneda: 'USD', functionalCurrency: 'USD' });
    expect(reconciliacion.monto.toString()).toBe('10');
    expect(reconciliacion.montoConvertido?.toString()).toBe('10');
    const asiento = await prisma.asiento.findFirstOrThrow({
      where: { tenantId, origenTipo: 'orden_produccion', origenId: ordenPositivaId },
      include: { lineas: true },
    });
    expect(asiento.lineas.reduce((sum, line) => sum + Number(line.debe), 0)).toBe(10);
    expect(asiento.lineas.reduce((sum, line) => sum + Number(line.haber), 0)).toBe(10);
    expect(asiento.lineas.every((line) => line.monedaOriginal === 'USD')).toBe(true);
  });

  it('rechaza la orden existente de otro tenant sin efectos físicos en ninguno', async () => {
    const foreign = await prisma.tenant.create({ data: {
      nombre: 'Actor ajeno R6 producción', slug: `r6-production-${crypto.randomUUID()}`,
    } });
    try {
      const before = await productionSnapshot(tenantId);
      const foreignBefore = await productionSnapshot(foreign.tenantId);
      const response = await POST(new Request(
        `http://localhost/api/produccion/ordenes/${ordenId}/completar`, {
          method: 'POST', body: JSON.stringify({ cuentaId, tipoPagoId }),
        }) as NextRequest,
        { params: Promise.resolve({ id: ordenId }) },
        { userId: 'actor-real', name: prefix, email: `${prefix}@test.invalid`,
          role: 'regularUser', isActive: true, tenantId: foreign.tenantId,
          tenantRole: 'manager', planFeatures: { produccion: true },
          permissions: new Set(['produccion.recetas.gestionar']) },
      );
      expect(response.status).toBe(404);
      expect(await productionSnapshot(tenantId)).toEqual(before);
      expect(await productionSnapshot(foreign.tenantId)).toEqual(foreignBefore);
    } finally {
      await prisma.tenant.delete({ where: { tenantId: foreign.tenantId } });
    }
  });

  it('rechaza el reintento de completar una orden ya completada (idempotencia por estado)', async () => {
    const ordenRetryId = `${prefix}-orden-retry`;
    await prisma.ordenProduccion.create({ data: {
      ordenProduccionId: ordenRetryId, tenantId, recetaId, cantidad: 1,
      estado: 'EN_PROCESO', updatedAt: new Date(),
    } });
    const user = { userId: 'actor-real', tenantId, tenantRole: 'manager',
      planFeatures: { produccion: true } } as never;

    const primera = await POST(new Request(
      `http://localhost/api/produccion/ordenes/${ordenRetryId}/completar`, {
        method: 'POST', body: JSON.stringify({ cuentaId, tipoPagoId }),
      }) as never, { params: Promise.resolve({ id: ordenRetryId }) }, user);
    expect(primera.status).toBe(200);
    expect((await prisma.ordenProduccion.findUniqueOrThrow({
      where: { ordenProduccionId: ordenRetryId },
    })).estado).toBe('COMPLETADA');

    const reintento = await POST(new Request(
      `http://localhost/api/produccion/ordenes/${ordenRetryId}/completar`, {
        method: 'POST', body: JSON.stringify({ cuentaId, tipoPagoId }),
      }) as never, { params: Promise.resolve({ id: ordenRetryId }) }, user);
    expect(reintento.status).not.toBe(200);

    // Sin duplicados: un solo historial de completado y una sola reconciliacion.
    expect(await prisma.ordenProduccionHistorial.count({
      where: { ordenProduccionId: ordenRetryId, estadoNuevo: 'COMPLETADA' },
    })).toBe(1);
    expect(await prisma.reconciliacionGasto.count({
      where: { tenantId, referenciaId: ordenRetryId },
    })).toBe(1);
  });
});
