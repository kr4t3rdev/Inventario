import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from '@/test/action-response';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

assertDisposableDatabase(process.env);

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server-actions/get-current-user');

let prisma!: typeof import('@/lib/prisma').prisma;
let createVentaServicioAction!: typeof import('@/features/venta-servicios/actions').createVentaServicioAction;
let tenantId = '';
let planId = '';
let tenantLicenseId = '';
let serviceId = '';
let periodoId = '';
let userId = '';
const prefix = `venta-servicio-idem-${crypto.randomUUID()}`;
const email = `${prefix}@test.local`;

function currentUser(): AuthenticatedUser {
  return {
    userId,
    name: 'Integration service sale actor',
    email,
    role: 'admin',
    isActive: true,
    tenantId,
    tenantRole: 'manager',
    planFeatures: { servicios: true },
  };
}

describe('service sale idempotency — PostgreSQL', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    process.env.PERIODO_GUARD_ENABLED = 'true';
    process.env.PERIODO_CONTABLE_MODE = 'enforce';
    const [prismaModule, actionModule] = await Promise.all([
      import('@/lib/prisma'),
      import('@/features/venta-servicios/actions'),
    ]);
    prisma = prismaModule.prisma;
    createVentaServicioAction = actionModule.createVentaServicioAction;

    const identity = await prisma.$queryRaw<Array<{
      databaseName: string; roleName: string; serverPort: number;
    }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName",
        inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);

    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const plan = await prisma.plan.create({
      data: { nombre: prefix, duracionDias: 365, features: { servicios: true } },
    });
    planId = plan.planId;
    const license = await prisma.tenantLicense.create({
      data: { tenantId, planId, expiracion: new Date('2099-01-01') },
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
    const user = await prisma.user.create({
      data: {
        name: 'Integration service sale actor',
        email,
        password: 'integration-only-placeholder',
      },
    });
    userId = user.userId;
    vi.mocked(getCurrentUser).mockImplementation(async () => currentUser());
  });

  afterAll(async () => {
    if (!prisma || !tenantId) return;
    if (userId) await prisma.auditLog.deleteMany({ where: { usuarioId: userId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.ventaServicios.deleteMany({ where: { tenantId } });
    if (serviceId) await prisma.servicios.deleteMany({ where: { servicioId: serviceId } });
    if (periodoId) await prisma.periodoContable.deleteMany({ where: { periodoId } });
    if (tenantLicenseId) await prisma.tenantLicense.deleteMany({ where: { tenantLicenseId } });
    await prisma.tenant.deleteMany({ where: { tenantId } });
    if (planId) await prisma.plan.deleteMany({ where: { planId } });
    if (userId) await prisma.user.deleteMany({ where: { userId } });
    await prisma.$disconnect();
  });

  it('serializes concurrent legacy requests and replays after the period closes', async () => {
    const input = {
      servicioId: serviceId,
      cantidad: 1,
      idempotencyKey: `legacy-${crypto.randomUUID()}`,
    };
    const results = await Promise.all([
      createVentaServicioAction(input),
      createVentaServicioAction(input),
    ]);
    expect(results.every((result) => result.success), JSON.stringify(results)).toBe(true);
    expect(results.map((result) => (expectActionSuccess(result).data as { replayed?: boolean }).replayed).sort())
      .toEqual([false, true]);
    const ventaId = (expectActionSuccess(results[0]).data as { ventaServicio: { ventaServicioId: string } })
      .ventaServicio.ventaServicioId;
    expect(expectActionSuccess(results[1]).data).toMatchObject({ ventaServicio: { ventaServicioId: ventaId } });
    expect(await prisma.ventaServicios.count({ where: { tenantId, idempotencyKey: { not: null } } }))
      .toBe(1);

    await prisma.periodoContable.update({ where: { periodoId }, data: { estado: 'CERRADO' } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    const replay = await createVentaServicioAction(input);
    expect(replay.success).toBe(true);
    expect((expectActionSuccess(replay).data as { ventaServicio: { ventaServicioId: string } })
      .ventaServicio.ventaServicioId).toBe(ventaId);

    const blocked = await createVentaServicioAction({
      ...input,
      idempotencyKey: `closed-${crypto.randomUUID()}`,
    });
    expect(blocked.success).toBe(false);
    expect(expectActionFailure(blocked).error.code).toBe('PERIODO_CERRADO');
    await prisma.periodoContable.update({ where: { periodoId }, data: { estado: 'ABIERTO' } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
  });

  it('replays ordered mixed lines and rejects a changed quantity without extra writes', async () => {
    const beforeCount = await prisma.ventaServicios.count({ where: { tenantId } });
    const key = `mixed-${crypto.randomUUID()}`;
    const input = {
      idempotencyKey: key,
      lineas: Array.from({ length: 11 }, () => ({
        tipoLinea: 'SERVICIO' as const,
        servicioId: serviceId,
        cantidad: 1,
      })),
    };
    const created = await createVentaServicioAction(input);
    expect(created.success).toBe(true);
    const createdLines = (expectActionSuccess(created).data as { ventasServicios: Array<{ ventaServicioId: string }> })
      .ventasServicios;
    expect(createdLines).toHaveLength(11);
    const replay = await createVentaServicioAction(input);
    expect(replay.success).toBe(true);
    expect(expectActionSuccess(replay).data).toMatchObject({ mode: 'MIXED_LINES', replayed: true });
    expect((expectActionSuccess(replay).data as { ventasServicios: Array<{ ventaServicioId: string }> })
      .ventasServicios.map((row) => row.ventaServicioId))
      .toEqual(createdLines.map((row) => row.ventaServicioId));

    const conflict = await createVentaServicioAction({
      ...input,
      lineas: input.lineas.map((line, index) => index === 2 ? { ...line, cantidad: 2 } : line),
    });
    expect(conflict.success).toBe(false);
    expect(expectActionFailure(conflict).error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await prisma.ventaServicios.count({ where: { tenantId } })).toBe(beforeCount + 11);
  });
});
