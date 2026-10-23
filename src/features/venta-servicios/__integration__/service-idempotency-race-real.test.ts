/**
 * @description Evidencia PostgreSQL de que la clave original de una venta de
 * servicios serializa payloads concurrentes, aunque la columna persistida
 * incluya la huella del payload.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

assertDisposableDatabase(process.env);

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/lib/server-actions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server-actions')>();
  return {
    ...original,
    withAction: (handler: (input: unknown, user: AuthenticatedUser) => unknown) =>
      async (input: unknown) => {
        const user = await getCurrentUser();
        if (!user) throw new Error('getCurrentUser mock no configurado');
        return handler(input, user);
      },
  };
});

let prisma!: typeof import('@/lib/prisma').prisma;
type CreateVentaServicioAction = typeof import('@/features/venta-servicios/actions').createVentaServicioAction;
type RawVentaServicioResult = {
  ventaServicio: { ventaServicioId: string };
  replayed: boolean;
};
type RawMixedVentaServicioResult = {
  mode: 'MIXED_LINES';
  ventasServicios: Array<{ ventaServicioId: string }>;
  replayed: boolean;
};

let createVentaServicioAction!: (input: Parameters<CreateVentaServicioAction>[0]) => Promise<unknown>;
let tenantId = '';
let serviceId = '';
let planId = '';
let tenantLicenseId = '';
let periodoId = '';
let userCreatedById = '';
const createdVentaServicioIds = new Set<string>();
const createdClienteIds = new Set<string>();
const createdAnticipoIds = new Set<string>();
const createdAuditLogIds = new Set<string>();
const prefix = `venta-servicio-idem-race-${crypto.randomUUID()}`;
const userId = 'actor-venta-servicio-idem-race';

const user = (): AuthenticatedUser => ({
  userId,
  name: 'Actor idempotencia',
  email: `${prefix}@test.local`,
  role: 'admin',
  isActive: true,
  tenantId,
  tenantRole: 'manager',
  planFeatures: { servicios: true },
});

function requireRawVentaServicioResult(value: unknown): RawVentaServicioResult {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Expected the integration action wrapper to return a raw service-sale result');
  }
  const record = value as Record<string, unknown>;
  const ventaServicio = record.ventaServicio;
  if (typeof ventaServicio !== 'object' || ventaServicio === null ||
    typeof (ventaServicio as Record<string, unknown>).ventaServicioId !== 'string' ||
    typeof record.replayed !== 'boolean') {
    throw new Error('Invalid raw service-sale result returned by the integration wrapper');
  }
  return value as RawVentaServicioResult;
}

function requireRawMixedVentaServicioResult(value: unknown): RawMixedVentaServicioResult {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Expected the integration action wrapper to return a raw mixed-sale result');
  }
  const record = value as Record<string, unknown>;
  if (record.mode !== 'MIXED_LINES' || !Array.isArray(record.ventasServicios) ||
    typeof record.replayed !== 'boolean') {
    throw new Error('Invalid raw mixed-sale result returned by the integration wrapper');
  }
  return value as RawMixedVentaServicioResult;
}

describe('venta de servicios — carrera idempotente en PostgreSQL', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    const [prismaModule, actionsModule] = await Promise.all([
      import('@/lib/prisma'),
      import('@/features/venta-servicios/actions'),
    ]);
    prisma = prismaModule.prisma;
    createVentaServicioAction = actionsModule.createVentaServicioAction;

    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    const target = new URL(process.env.DATABASE_URL ?? '');
    expect(identity[0]).toMatchObject({
      db: target.pathname.slice(1),
      port: Number(target.port),
    });

    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const plan = await prisma.plan.create({
      data: { nombre: prefix, duracionDias: 365, features: { servicios: true } },
    });
    planId = plan.planId;
    const license = await prisma.tenantLicense.create({
      data: { tenantId, planId: plan.planId, expiracion: new Date('2099-01-01') },
    });
    tenantLicenseId = license.tenantLicenseId;
    const service = await prisma.servicios.create({
      data: { tenantId, nombre: prefix, descripcion: prefix, precio: 1250, moneda: 'CUP' },
    });
    serviceId = service.servicioId;

    const now = new Date();
    const period = await prisma.periodoContable.create({
      data: {
        tenantId,
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
      },
    });
    periodoId = period.periodoId;
    const actor = await prisma.user.create({
      data: {
        userId,
        name: 'Actor idempotencia',
        email: `${prefix}@test.local`,
        password: 'integration-only-placeholder',
      },
    });
    userCreatedById = actor.userId;
    vi.mocked(getCurrentUser).mockResolvedValue(user());
  });

  afterAll(async () => {
    if (!prisma || !tenantId) return;
    const saleIds = [...createdVentaServicioIds];
    if (saleIds.length > 0) {
      await prisma.anticipoMovimiento.deleteMany({
        where: { documentoDestinoId: { in: saleIds } },
      });
      await prisma.auditLog.deleteMany({ where: { id: { in: [...createdAuditLogIds] } } });
      await prisma.cuentaPorCobrar.deleteMany({
        where: { tenantId, ventaServicioId: { in: saleIds } },
      });
      await prisma.ventaServicios.deleteMany({
        where: { tenantId, ventaServicioId: { in: saleIds } },
      });
    }
    if (createdAnticipoIds.size > 0) {
      await prisma.anticipo.deleteMany({ where: { anticipoId: { in: [...createdAnticipoIds] } } });
    }
    if (createdClienteIds.size > 0) {
      await prisma.cliente.deleteMany({ where: { clienteId: { in: [...createdClienteIds] } } });
    }
    if (serviceId) await prisma.servicios.deleteMany({ where: { tenantId, servicioId: serviceId } });
    if (periodoId) await prisma.periodoContable.deleteMany({ where: { periodoId } });
    if (tenantLicenseId) await prisma.tenantLicense.deleteMany({ where: { tenantLicenseId } });
    if (tenantId) await prisma.tenant.deleteMany({ where: { tenantId } });
    if (planId) await prisma.plan.deleteMany({ where: { planId } });
    if (userCreatedById) await prisma.user.deleteMany({ where: { userId: userCreatedById } });
  });

  it('rechaza el payload divergente y conserva una sola venta y sus efectos', async () => {
    const idempotencyKey = `race-${crypto.randomUUID()}`;
    const responses = await Promise.allSettled([
      createVentaServicioAction({ servicioId: serviceId, cantidad: 1, idempotencyKey }),
      createVentaServicioAction({ servicioId: serviceId, cantidad: 2, idempotencyKey }),
    ]);

    expect(responses.filter((response) => response.status === 'fulfilled')).toHaveLength(1);
    const conflict = responses.find((response) => response.status === 'rejected');
    expect(conflict?.status === 'rejected' ? conflict.reason?.code : null)
      .toBe('IDEMPOTENCY_CONFLICT');
    const created = responses.find((response) => response.status === 'fulfilled');
    if (created?.status === 'fulfilled') {
      createdVentaServicioIds.add(requireRawVentaServicioResult(created.value).ventaServicio.ventaServicioId);
    }

    const rows = await prisma.ventaServicios.findMany({
      where: { tenantId, ventaServicioId: { in: [...createdVentaServicioIds] } },
    });
    expect(rows).toHaveLength(1);
    expect(await prisma.cuentaPorCobrar.count({ where: { tenantId, ventaServicioId: rows[0].ventaServicioId } })).toBe(0);
  });

  it('reproduce el resultado cuando dos requests concurrentes comparten payload y clave', async () => {
    const idempotencyKey = `race-same-${crypto.randomUUID()}`;
    const before = await prisma.ventaServicios.count({ where: { tenantId, servicioId: serviceId } });
    const responses = await Promise.all([
      createVentaServicioAction({ servicioId: serviceId, cantidad: 1, idempotencyKey }),
      createVentaServicioAction({ servicioId: serviceId, cantidad: 1, idempotencyKey }),
    ]);

    expect(responses).toHaveLength(2);
    const results = responses.map(requireRawVentaServicioResult);
    createdVentaServicioIds.add(results[0].ventaServicio.ventaServicioId);
    expect(results[0].ventaServicio.ventaServicioId)
      .toBe(results[1].ventaServicio.ventaServicioId);
    expect(results.map((response) => response.replayed).sort()).toEqual([false, true]);

    const after = await prisma.ventaServicios.count({ where: { tenantId, servicioId: serviceId } });
    expect(after).toBe(before + 1);
  });

  it('no confunde una clave raw con una fila legacy histórica y mantiene el replay exacto', async () => {
    const historicalKey = 'v1:YQA';
    const original = requireRawVentaServicioResult(await createVentaServicioAction({
      servicioId: serviceId,
      cantidad: 1,
      idempotencyKey: historicalKey,
    }));
    const originalId = original.ventaServicio.ventaServicioId;
    createdVentaServicioIds.add(originalId);

    const stored = await prisma.ventaServicios.findUniqueOrThrow({
      where: { ventaServicioId: originalId },
      select: { idempotencyKey: true },
    });
    const payloadHash = stored.idempotencyKey?.slice(-64);
    expect(payloadHash).toMatch(/^[0-9a-f]{64}$/);

    // This is a valid pre-namespace persisted key: raw key (7 chars), colon, and
    // the canonical payload SHA-256 (64 chars), well within the legacy 140-char cap.
    const historicalPersistedKey = `${historicalKey}:${payloadHash}`;
    expect(historicalPersistedKey.length).toBeLessThanOrEqual(140);
    await prisma.ventaServicios.update({
      where: { ventaServicioId: originalId },
      data: { idempotencyKey: historicalPersistedKey },
    });

    const distinctIntent = requireRawVentaServicioResult(await createVentaServicioAction({
      servicioId: serviceId,
      cantidad: 1,
      idempotencyKey: 'a',
    }));
    const distinctIntentId = distinctIntent.ventaServicio.ventaServicioId;
    createdVentaServicioIds.add(distinctIntentId);
    expect(distinctIntent.replayed).toBe(false);
    expect(distinctIntentId).not.toBe(originalId);

    const sameIntentReplay = requireRawVentaServicioResult(await createVentaServicioAction({
      servicioId: serviceId,
      cantidad: 1,
      idempotencyKey: historicalKey,
    }));
    expect(sameIntentReplay.replayed).toBe(true);
    expect(sameIntentReplay.ventaServicio.ventaServicioId).toBe(originalId);

    await expect(createVentaServicioAction({
      servicioId: serviceId,
      cantidad: 2,
      idempotencyKey: historicalKey,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    const rows = await prisma.ventaServicios.findMany({
      where: { tenantId, ventaServicioId: { in: [originalId, distinctIntentId] } },
      orderBy: { ventaServicioId: 'asc' },
      select: { ventaServicioId: true, cantidad: true, idempotencyKey: true },
    });
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.ventaServicioId === originalId)?.cantidad).toBe(1);
    expect(rows.find((row) => row.ventaServicioId === distinctIntentId)?.cantidad).toBe(1);
  });

  it('rechaza un payload histórico si cambia la fecha de vencimiento persistida', async () => {
    const idempotencyKey = `legacy-${crypto.randomUUID()}`;
    const cliente = await prisma.cliente.create({ data: { tenantId, nombre: `${prefix}-legacy-client` } });
    createdClienteIds.add(cliente.clienteId);
    const venta = await prisma.ventaServicios.create({
      data: {
        tenantId,
        servicioId: serviceId,
        cantidad: 1,
        costo: 0,
        total: 1250,
        moneda: 'CUP',
        precioUnitario: 1250,
        clienteId: cliente.clienteId,
        condicionPago: 'CREDITO',
        idempotencyKey,
      },
    });
    createdVentaServicioIds.add(venta.ventaServicioId);
    const cxc = await prisma.cuentaPorCobrar.create({
      data: {
        tenantId,
        clienteId: cliente.clienteId,
        ventaServicioId: venta.ventaServicioId,
        montoDeuda: 1250,
        estado: 'PENDIENTE',
        tipoCuenta: 'VENTA_SERVICIO',
        fechaVencimiento: new Date('2026-11-01T00:00:00.000Z'),
      },
    });
    const anticipo = await prisma.anticipo.create({
      data: {
        tenantId,
        tipo: 'COBRO',
        estado: 'EJECUTADO',
        clienteId: cliente.clienteId,
        montoOriginal: 1000,
        saldoDisponible: 900,
        moneda: 'CUP',
        createdById: userCreatedById,
      },
    });
    createdAnticipoIds.add(anticipo.anticipoId);
    await prisma.anticipoMovimiento.create({
      data: {
        anticipoId: anticipo.anticipoId,
        tipoMovimiento: 'EJECUCION',
        contexto: 'FACTURA_DIRECTA',
        documentoDestinoId: venta.ventaServicioId,
        monto: 100,
        moneda: 'CUP',
        saldoAntes: 1000,
        saldoDespues: 900,
        usuarioId: userCreatedById,
      },
    });
    const overrideAudit = await prisma.auditLog.create({
      data: {
        accion: 'EXECUTE',
        entidad: 'CUENTA_POR_COBRAR',
        entidadId: cxc.id,
        usuarioId: userCreatedById,
        detalles: {
          tipo: 'CREDITO_OVERRIDE',
          tenantId,
          clienteId: cliente.clienteId,
          origen: 'VENTA_SERVICIO',
          motivo: 'Excepción aprobada',
          montoNuevo: 1150,
        },
      },
    });
    createdAuditLogIds.add(overrideAudit.id);

    const samePayloadReplay = requireRawVentaServicioResult(await createVentaServicioAction({
      servicioId: serviceId,
      cantidad: 1,
      condicionPago: 'CREDITO',
      clienteId: cliente.clienteId,
      fechaVencimiento: '2026-11-01T00:00:00.000Z',
      anticipos: [{ anticipoId: anticipo.anticipoId, montoAplicado: 100 }],
      solicitarCreditoOverride: true,
      motivoCreditoOverride: '  Excepción aprobada  ',
      idempotencyKey,
    }));
    expect(samePayloadReplay.replayed).toBe(true);

    await expect(createVentaServicioAction({
      servicioId: serviceId,
      cantidad: 1,
      condicionPago: 'CREDITO',
      clienteId: cliente.clienteId,
      fechaVencimiento: '2026-11-01T00:00:00.000Z',
      anticipos: [{ anticipoId: anticipo.anticipoId, montoAplicado: 90 }],
      solicitarCreditoOverride: true,
      motivoCreditoOverride: 'Excepción aprobada',
      idempotencyKey,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    await expect(createVentaServicioAction({
      servicioId: serviceId,
      cantidad: 1,
      condicionPago: 'CREDITO',
      clienteId: cliente.clienteId,
      fechaVencimiento: '2026-11-01T00:00:00.000Z',
      anticipos: [{ anticipoId: anticipo.anticipoId, montoAplicado: 100 }],
      solicitarCreditoOverride: true,
      motivoCreditoOverride: 'Motivo distinto',
      idempotencyKey,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    await expect(createVentaServicioAction({
      servicioId: serviceId,
      cantidad: 1,
      condicionPago: 'CREDITO',
      clienteId: cliente.clienteId,
      fechaVencimiento: '2026-11-02T00:00:00.000Z',
      anticipos: [{ anticipoId: anticipo.anticipoId, montoAplicado: 100 }],
      solicitarCreditoOverride: true,
      motivoCreditoOverride: 'Excepción aprobada',
      idempotencyKey,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('reproduce replay mixto histórico con fecha y override persistidos idénticos', async () => {
    const idempotencyKey = `legacy-mixed-${crypto.randomUUID()}`;
    const cliente = await prisma.cliente.create({
      data: { tenantId, nombre: `${prefix}-mixed-client` },
    });
    createdClienteIds.add(cliente.clienteId);
    const venta = await prisma.ventaServicios.create({
      data: {
        tenantId,
        servicioId: serviceId,
        cantidad: 1,
        costo: 0,
        total: 1250,
        moneda: 'CUP',
        precioUnitario: 1250,
        clienteId: cliente.clienteId,
        condicionPago: 'CREDITO',
        idempotencyKey,
      },
    });
    createdVentaServicioIds.add(venta.ventaServicioId);
    const cxc = await prisma.cuentaPorCobrar.create({
      data: {
        tenantId,
        clienteId: cliente.clienteId,
        ventaServicioId: venta.ventaServicioId,
        montoDeuda: 1250,
        estado: 'PENDIENTE',
        tipoCuenta: 'VENTA_SERVICIO',
        fechaVencimiento: new Date('2026-11-01T00:00:00.000Z'),
      },
    });
    const overrideAudit = await prisma.auditLog.create({
      data: {
        accion: 'EXECUTE',
        entidad: 'CUENTA_POR_COBRAR',
        entidadId: venta.ventaServicioId,
        usuarioId: userCreatedById,
        detalles: {
          tipo: 'CREDITO_OVERRIDE',
          tenantId,
          clienteId: cliente.clienteId,
          origen: 'VENTA_SERVICIO',
          motivo: 'Excepción aprobada',
          montoNuevo: 1250,
        },
      },
    });
    createdAuditLogIds.add(overrideAudit.id);

    const replay = requireRawMixedVentaServicioResult(await createVentaServicioAction({
      lineas: [{ tipoLinea: 'SERVICIO', servicioId: serviceId, cantidad: 1 }],
      condicionPago: 'CREDITO',
      clienteId: cliente.clienteId,
      fechaVencimiento: '2026-11-01T00:00:00.000Z',
      solicitarCreditoOverride: true,
      motivoCreditoOverride: '  Excepción aprobada  ',
      idempotencyKey,
    }));

    expect(cxc.ventaServicioId).toBe(venta.ventaServicioId);
    expect(replay.replayed).toBe(true);
    expect(replay.ventasServicios.map((row) => row.ventaServicioId)).toEqual([venta.ventaServicioId]);
  });
});
