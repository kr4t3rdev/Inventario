import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectActionFailure } from '@/test/action-response';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const suffix = crypto.randomUUID().replaceAll('-', '');
const tenantName = `basic_partial_advance_${suffix}`;
const email = `${tenantName}@test.local`;

let prisma!: typeof import('@/lib/prisma').prisma;
let createCompraServicioAction!: typeof import('../actions').createCompraServicioAction;
let tenantId = '';
let userId = '';
let servicioId = '';
let cuentaId = '';
let tipoPagoId = '';
let anticipoId = '';

function basicUser(): AuthenticatedUser {
  return {
    userId,
    name: 'Basic integration actor',
    email,
    role: 'regularUser',
    isActive: true,
    tenantId,
    tenantRole: 'manager',
    planFeatures: { servicios: true, 'cuentas-pagar': false },
    permissions: new Set(['compras.servicios.crear']),
  };
}

describe('Basic partial advance rollback — PostgreSQL', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    process.env.PERIODO_GUARD_ENABLED = 'false';
    process.env.PERIODO_GUARD_MODE = 'disabled';
    const [prismaModule, actionModule] = await Promise.all([
      import('@/lib/prisma'),
      import('../actions'),
    ]);
    prisma = prismaModule.prisma;
    createCompraServicioAction = actionModule.createCompraServicioAction;

    const identity = await prisma.$queryRaw<Array<{
      databaseName: string; roleName: string; serverPort: number;
    }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName",
        inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);

    const tenant = await prisma.tenant.create({ data: { nombre: tenantName, slug: tenantName } });
    tenantId = tenant.tenantId;
    const user = await prisma.user.create({
      data: { name: 'Basic integration actor', email, password: 'integration-only-placeholder' },
    });
    userId = user.userId;
    const servicio = await prisma.servicios.create({
      data: { tenantId, nombre: 'Servicio de prueba', precio: 100, descripcion: 'Fixture' },
    });
    servicioId = servicio.servicioId;
    const cuenta = await prisma.cuentaBancaria.create({
      data: { tenantId, nombreBanco: 'Fixture bank', numeroCuenta: suffix, tipoCuenta: 'CORRIENTE' },
    });
    cuentaId = cuenta.cuentaId;
    const tipoPago = await prisma.tipoPago.create({ data: { tenantId, nombre: 'Transferencia' } });
    tipoPagoId = tipoPago.tipoId;
    const anticipo = await prisma.anticipo.create({
      data: {
        tenantId,
        tipo: 'PAGO',
        estado: 'RESERVADO',
        montoOriginal: 100,
        saldoDisponible: 100,
        moneda: 'CUP',
        cuentaOrigenId: cuentaId,
        tipoPagoOrigenId: tipoPagoId,
        createdById: userId,
      },
    });
    anticipoId = anticipo.anticipoId;
    vi.mocked(getCurrentUser).mockImplementation(async () => basicUser());
  });

  afterAll(async () => {
    if (!prisma) return;
    if (tenantId) {
      await prisma.reconciliacionGasto.deleteMany({ where: { tenantId } });
      await prisma.anticipoMovimiento.deleteMany({ where: { anticipoId } });
      await prisma.compraServicio.deleteMany({ where: { tenantId } });
      await prisma.anticipo.deleteMany({ where: { tenantId } });
      await prisma.tipoPago.deleteMany({ where: { tenantId } });
      await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
      await prisma.servicios.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { tenantId } });
    }
    if (userId) await prisma.user.deleteMany({ where: { userId } });
    await prisma.$disconnect();
  });

  it('rolls back the service, reconciliation, and advance consumption when Basic cannot carry a balance', async () => {
    const beforeMovementCount = await prisma.anticipoMovimiento.count({ where: { anticipoId } });

    const result = await createCompraServicioAction({
      servicioId,
      costoUnitario: 200,
      cantidad: 1,
      formaPago: 'ANTICIPO_PAGO',
      estado: 'PAGADA',
      anticipos: [{ anticipoId, montoAplicado: 100 }],
    });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(await prisma.compraServicio.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.reconciliacionGasto.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.anticipoMovimiento.count({ where: { anticipoId } })).toBe(beforeMovementCount);
    const advance = await prisma.anticipo.findUniqueOrThrow({ where: { anticipoId } });
    expect(Number(advance.saldoDisponible)).toBe(100);
    expect(advance.estado).toBe('RESERVADO');
  });
});
