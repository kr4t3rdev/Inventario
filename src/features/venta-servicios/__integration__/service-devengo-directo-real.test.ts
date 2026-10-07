import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

assertDisposableDatabase(process.env);

let prisma!: typeof import('@/lib/prisma').prisma;
let PeriodoGuard!: typeof import('@/lib/services/periodo-contable-guard').PeriodoGuard;
let createVentaServicioAction!: typeof import('@/features/venta-servicios/actions').createVentaServicioAction;
let seedPlanContable!: typeof import('@/features/contabilidad-formal/services/seed-plan-contable').seedPlanContable;
let seedPlantillasGlobales!: typeof import('@/features/contabilidad-formal/services/seed-plan-contable').seedPlantillasGlobales;

vi.mock('@/lib/server-actions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server-actions')>();
  return {
    ...original,
    // Simula la inyección de identidad del wrapper real; no se debe ejecutar
    // el handler raw sin actor porque la validación de período lo necesita.
    withAction: (handler: (input: unknown, user: AuthenticatedUser) => unknown) =>
      async (input: unknown) => {
        const user = await getCurrentUser();
        if (!user) throw new Error('getCurrentUser mock no configurado');
        return handler(input, user);
      },
  };
});
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server-actions/get-current-user');

const prefix = `cta-serv-devengo-${crypto.randomUUID()}`;
const userId = 'actor-service-devengo';
let tenantId = '';
let serviceId = '';
let customerId = '';

const admin = (): AuthenticatedUser => ({
  userId,
  name: 'Actor Integracion',
  email: 'actor-integracion@test.local',
  role: 'admin',
  isActive: true,
  tenantId,
  tenantRole: 'manager',
  planFeatures: { servicios: true, 'contabilidad-formal': true },
});

/** @description Devengo directo de venta de servicio a crédito (sin anticipos) con posteo contable. */
describe('venta servicio a crédito — devengo directo', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    const [prismaModule, periodoModule, actionsModule, seedModule] = await Promise.all([
      import('@/lib/prisma'),
      import('@/lib/services/periodo-contable-guard'),
      import('@/features/venta-servicios/actions'),
      import('@/features/contabilidad-formal/services/seed-plan-contable'),
    ]);
    prisma = prismaModule.prisma;
    PeriodoGuard = periodoModule.PeriodoGuard;
    createVentaServicioAction = actionsModule.createVentaServicioAction;
    seedPlanContable = seedModule.seedPlanContable;
    seedPlantillasGlobales = seedModule.seedPlantillasGlobales;

    const target = new URL(process.env.DATABASE_URL ?? '');
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    expect(identity[0]).toMatchObject({
      db: target.pathname.slice(1),
      port: Number(target.port),
    });

    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';

    await prisma.moneda.upsert({
      where: { codigo: 'CUP' },
      create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
      update: {},
    });

    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365,
      features: { 'contabilidad-formal': true, servicios: true },
    } });
    await prisma.tenantLicense.create({ data: {
      tenantId, planId: plan.planId, expiracion: new Date('2099-01-01'),
    } });
    const service = await prisma.servicios.create({ data: {
      tenantId, nombre: prefix, descripcion: prefix, precio: 1250, moneda: 'CUP',
    } });
    serviceId = service.servicioId;
    customerId = (await prisma.cliente.create({ data: { tenantId, nombre: prefix } })).clienteId;
    await prisma.tenantAccountingPolicy.create({ data: {
      tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId,
    } });
    await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
    await prisma.$transaction((tx) => seedPlantillasGlobales(tx));
    const now = new Date();
    await prisma.periodoContable.create({ data: {
      tenantId,
      tipo: 'MENSUAL',
      estado: 'ABIERTO',
      fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
    } });
    await PeriodoGuard.assertWritable(now, tenantId, 'devengo', {
      actorId: userId,
      actorTipo: 'USUARIO',
      origen: { tipo: 'venta_servicio', id: prefix },
    });
  });

  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(admin());
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
    if (!prisma) return;
    // Limpieza best-effort: los prefijos únicos aíslan los datos; no se borra el
    // tenant por las FK del plan contable semillado.
    const ids = [tenantId].filter(Boolean);
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.ventaServicios.deleteMany({ where: { tenantId: { in: ids } } });
  });

  it('devengo directo crea venta, CxC y asiento VENTA_SERVICIO_CREDITO', async () => {
    const result = await createVentaServicioAction({
      servicioId: serviceId,
      cantidad: 2,
      condicionPago: 'CREDITO',
      clienteId: customerId,
    });

    // La action en modo legacy retorna { ventaServicio, allocationsResult }
    const venta = (result as any).ventaServicio;
    expect(venta).toBeTruthy();
    const ventaId = venta.ventaServicioId as string;

    // Venta registrada con el total correcto (2 × 1250)
    const ventaDb = await prisma.ventaServicios.findUnique({ where: { ventaServicioId: ventaId } });
    expect(ventaDb).toBeTruthy();
    expect(Number(ventaDb!.total)).toBe(2500);
    expect(ventaDb!.condicionPago).toBe('CREDITO');

    // CxC por el total, pendiente
    const cxc = await prisma.cuentaPorCobrar.findFirst({
      where: { tenantId, ventaServicioId: ventaId },
    });
    expect(cxc).toBeTruthy();
    expect(Number(cxc!.montoDeuda)).toBe(2500);
    expect(cxc!.estado).toBe('PENDIENTE');
    expect(cxc!.tipoCuenta).toBe('VENTA_SERVICIO');

    // Asiento del devengo (evento VENTA_SERVICIO_CREDITO) — exactamente uno
    const asientos = await prisma.asiento.findMany({
      where: { tenantId, origenId: ventaId },
    });
    expect(asientos.length).toBe(1);
    expect(asientos[0].origenTipo).toBe('venta_servicio');
  });

  it('fallo en el asiento revierte venta y CxC (rollback)', async () => {
    const trigger = `trg_asiento_fail_${prefix.replaceAll('-', '_')}`.slice(0, 50);
    const fn = `${trigger}_fn`;
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "${fn}"() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'asiento bloqueado' USING ERRCODE = '22012';
      END; $$ LANGUAGE plpgsql;
    `);
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "asientos";`);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${trigger}" BEFORE INSERT ON "asientos"
      FOR EACH ROW EXECUTE FUNCTION "${fn}"();
    `);
    try {
      const before = await Promise.all([
        prisma.ventaServicios.count({ where: { tenantId, servicioId: serviceId } }),
        prisma.cuentaPorCobrar.count({ where: { tenantId, tipoCuenta: 'VENTA_SERVICIO' } }),
        prisma.asiento.count({ where: { tenantId } }),
      ]);
      await expect(createVentaServicioAction({
        servicioId: serviceId,
        cantidad: 1,
        condicionPago: 'CREDITO',
        clienteId: customerId,
      })).rejects.toThrow('asiento bloqueado');

      const after = await Promise.all([
        prisma.ventaServicios.count({ where: { tenantId, servicioId: serviceId } }),
        prisma.cuentaPorCobrar.count({ where: { tenantId, tipoCuenta: 'VENTA_SERVICIO' } }),
        prisma.asiento.count({ where: { tenantId } }),
      ]);
      expect(after).toEqual(before);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "asientos"`).catch(() => undefined);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"() CASCADE`).catch(() => undefined);
    }
  });
});
