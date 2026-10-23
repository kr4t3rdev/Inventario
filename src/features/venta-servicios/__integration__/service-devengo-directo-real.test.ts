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

  const normalizeSnapshotValue = (value: unknown): unknown => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'bigint') return value.toString();
    if (Array.isArray(value)) return value.map(normalizeSnapshotValue);
    if (value && typeof value === 'object') {
      const decimal = value as { toFixed?: unknown; toString?: unknown };
      if (typeof decimal.toFixed === 'function' && typeof decimal.toString === 'function') {
        return decimal.toString();
      }
      return Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [key, normalizeSnapshotValue(nested)]),
      );
    }
    return value;
  };

  const readAccountingSnapshot = async () => {
    const [ventas, cuentasPorCobrar, asientos] = await Promise.all([
      prisma.ventaServicios.findMany({
        where: { tenantId },
        orderBy: { ventaServicioId: 'asc' },
      }),
      prisma.cuentaPorCobrar.findMany({
        where: { tenantId, tipoCuenta: 'VENTA_SERVICIO' },
        orderBy: { id: 'asc' },
      }),
      prisma.asiento.findMany({
        where: { tenantId },
        orderBy: { asientoId: 'asc' },
        include: {
          lineas: { orderBy: [{ orden: 'asc' }, { lineaId: 'asc' }] },
        },
      }),
    ]);

    return {
      rows: normalizeSnapshotValue({ ventas, cuentasPorCobrar, asientos }),
      asientoLineIds: asientos.flatMap((asiento) => asiento.lineas.map((linea) => linea.lineaId)),
    };
  };

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

  it.each(['legacy', 'mixto'] as const)(
    '%s deniega permiso sin crear venta, CxC o asiento', async (branch) => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        ...admin(), role: 'regularUser', permissions: new Set<string>(),
      });
      const before = await readAccountingSnapshot();
      const input = branch === 'legacy'
        ? { servicioId: serviceId, cantidad: 1, condicionPago: 'CREDITO' as const,
          clienteId: customerId }
        : { lineas: [{ tipoLinea: 'SERVICIO' as const, servicioId: serviceId, cantidad: 1 }],
          condicionPago: 'CREDITO' as const, clienteId: customerId };
      await expect(createVentaServicioAction(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(await readAccountingSnapshot()).toEqual(before);
    },
  );

  it.each(['legacy', 'mixto'] as const)(
    '%s rechaza referencias existentes de otro tenant sin efectos', async (branch) => {
      const foreign = await prisma.tenant.create({ data: {
        nombre: 'Tenant ajeno R6 servicios', slug: `r6-service-${crypto.randomUUID()}`,
      } });
      const now = new Date();
      await prisma.periodoContable.create({ data: {
        tenantId: foreign.tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
        fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
      } });
      await prisma.tenantAccountingPolicy.create({ data: {
        tenantId: foreign.tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId,
      } });
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin(), tenantId: foreign.tenantId });
      const before = await readAccountingSnapshot();
      const input = branch === 'legacy'
        ? { servicioId: serviceId, cantidad: 1, condicionPago: 'CREDITO' as const,
          clienteId: customerId }
        : { lineas: [{ tipoLinea: 'SERVICIO' as const, servicioId: serviceId, cantidad: 1 }],
          condicionPago: 'CREDITO' as const, clienteId: customerId };
      await expect(createVentaServicioAction(input)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(await readAccountingSnapshot()).toEqual(before);
      expect(await prisma.ventaServicios.count({ where: { tenantId: foreign.tenantId } })).toBe(0);
      expect(await prisma.cuentaPorCobrar.count({ where: { tenantId: foreign.tenantId } })).toBe(0);
      expect(await prisma.asiento.count({ where: { tenantId: foreign.tenantId } })).toBe(0);
    },
  );

  it('fallo en el asiento revierte venta y CxC (rollback)', async () => {
    const trigger = `trg_asiento_fail_${prefix.replaceAll('-', '_')}`.slice(0, 50);
    const fn = `${trigger}_fn`;
    try {
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

      const before = await readAccountingSnapshot();
      await expect(createVentaServicioAction({
        servicioId: serviceId,
        cantidad: 1,
        condicionPago: 'CREDITO',
        clienteId: customerId,
      })).rejects.toThrow('asiento bloqueado');

      const after = await readAccountingSnapshot();
      expect(after).toEqual(before);
    } finally {
      try {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "asientos"`);
      } finally {
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"() CASCADE`);
      }
    }
  });

  it('el flujo mixto revierte venta, CxC y asiento si falla el devengo SQL', async () => {
    const mixedInput = {
      lineas: [{ tipoLinea: 'SERVICIO' as const, servicioId: serviceId, cantidad: 1 }],
      condicionPago: 'CREDITO' as const,
      clienteId: customerId,
    };

    const successful = await createVentaServicioAction(mixedInput) as {
      mode?: string;
      replayed?: boolean;
      lineasProcesadas?: number;
      ventasServicios?: Array<{ ventaServicioId: string }>;
    };
    expect(successful).toMatchObject({
      mode: 'MIXED_LINES',
      replayed: false,
      lineasProcesadas: 1,
    });
    const firstSaleId = successful.ventasServicios?.[0]?.ventaServicioId;
    expect(firstSaleId).toBeTruthy();
    expect(await prisma.cuentaPorCobrar.count({
      where: { tenantId, ventaServicioId: firstSaleId },
    })).toBe(1);
    expect(await prisma.asiento.count({
      where: { tenantId, origenTipo: 'venta_servicio', origenId: firstSaleId },
    })).toBe(1);
    const successfulAsiento = await prisma.asiento.findFirst({
      where: { tenantId, origenTipo: 'venta_servicio', origenId: firstSaleId },
      include: { lineas: true },
    });
    expect(successfulAsiento?.lineas.length).toBeGreaterThan(0);

    const trigger = `trg_mixed_asiento_fail_${prefix.replaceAll('-', '_')}`.slice(0, 50);
    const fn = `${trigger}_fn`;
    try {
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION "${fn}"() RETURNS trigger AS $$
        BEGIN
          IF NEW."tenantId" = '${tenantId}' AND NEW."origenTipo" = 'venta_servicio' THEN
            RAISE EXCEPTION 'mixed service asiento blocked' USING ERRCODE = '22012';
          END IF;
          RETURN NEW;
        END; $$ LANGUAGE plpgsql;
      `);
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "asientos";`);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "${trigger}" BEFORE INSERT ON "asientos"
        FOR EACH ROW EXECUTE FUNCTION "${fn}"();
      `);

      const before = await readAccountingSnapshot();
      await expect(createVentaServicioAction(mixedInput))
        .rejects.toThrow('mixed service asiento blocked');
      const after = await readAccountingSnapshot();
      const priorLineIds = new Set(before.asientoLineIds);
      expect(after.rows).toEqual(before.rows);
      expect(after.asientoLineIds).toEqual(before.asientoLineIds);
      expect(after.asientoLineIds.filter((lineId) => !priorLineIds.has(lineId))).toEqual([]);
    } finally {
      try {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "asientos"`);
      } finally {
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"() CASCADE`);
      }
    }
  });

  it('mixto USD hereda valoración de catálogo y revierte todas las filas ante fallo SQL',
    async () => {
      await prisma.moneda.upsert({
        where: { codigo: 'USD' }, update: {},
        create: { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'USD' },
      });
      const usd = await prisma.servicios.create({ data: {
        tenantId, nombre: `Servicio USD ${prefix}`, precio: 10, moneda: 'USD',
      } });
      const rate = await prisma.tasaCambio.create({ data: {
        monedaOrigenId: 'USD', monedaDestino: 'CUP', tasa: 24, fechaVigencia: new Date(),
      } });
      const trigger = `r6_mixed_fx_${crypto.randomUUID().replaceAll('-', '')}`;
      const input = {
        lineas: [{ tipoLinea: 'SERVICIO' as const, servicioId: usd.servicioId, cantidad: 2 }],
        condicionPago: 'CREDITO' as const, clienteId: customerId,
      };
      try {
        const result = await createVentaServicioAction(input) as {
          mode: string; ventasServicios: Array<{ ventaServicioId: string }>;
        };
        expect(result.mode).toBe('MIXED_LINES');
        const saleId = result.ventasServicios[0].ventaServicioId;
        const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: {
          tenantId, ventaServicioId: saleId,
        } });
        expect(cxc.monedaOriginal).toBe('USD');
        expect(cxc.montoOriginal?.toString()).toBe('20');
        expect(cxc.montoDeudaFuncional?.toString()).toBe('480');
        expect(cxc.tasaCambio?.toString()).toBe('24');
        expect(cxc.fxEvidenceFingerprint).toBeTruthy();
        const asiento = await prisma.asiento.findFirstOrThrow({ where: {
          tenantId, origenTipo: 'venta_servicio', origenId: saleId,
        }, include: { lineas: true } });
        expect(asiento.createdBy).toBe(userId);
        expect(asiento.lineas.reduce((sum, line) => sum + Number(line.debe), 0)).toBe(480);
        expect(asiento.lineas.reduce((sum, line) => sum + Number(line.haber), 0)).toBe(480);
        expect(asiento.lineas.every((line) => line.monedaOriginal === 'USD'
          && line.tasaCambio?.toString() === '24'
          && line.fxEvidenceFingerprint === cxc.fxEvidenceFingerprint)).toBe(true);
        await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger
          LANGUAGE plpgsql AS $$ BEGIN
            IF NEW."tenantId" = '${tenantId}' AND NEW."origenTipo" = 'venta_servicio' THEN
              RAISE EXCEPTION 'R6_MIXED_USD_POSTING_FAILPOINT' USING ERRCODE = '22012';
            END IF;
            RETURN NEW;
          END $$`);
        await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}"
          BEFORE INSERT ON "asientos" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
        const before = await readAccountingSnapshot();
        await expect(createVentaServicioAction(input))
          .rejects.toThrow('R6_MIXED_USD_POSTING_FAILPOINT');
        expect(await readAccountingSnapshot()).toEqual(before);
      } finally {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "asientos"`);
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
        await prisma.tasaCambio.delete({ where: { tasaId: rate.tasaId } });
      }
    },
  );
});
