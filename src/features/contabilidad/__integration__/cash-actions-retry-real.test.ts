/**
 * @description Reintento en Server Actions de cash (G5): `registrarPagoPrestamoAction`
 * y `registrarPagoDeudaAction` delegan al servicio canónico; el reintento de un pago
 * ya completado no duplica la reconciliación.
 *
 * Los actions son wrappers delgados (auth + validación + servicio). Se mockea
 * `getCurrentUser` para proveer el usuario de prueba; el resto del flujo
 * (servicio, Prisma, asientos) corre contra PostgreSQL real.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: async () => undefined, logStrict: async () => undefined },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const prefix = `cta-actions-retry-${crypto.randomUUID()}`;
let tenantId = '';
let userId = '';
let clienteId = '';
let proveedorId = '';
let cuentaOrigenId = '';
let cuentaPagoId = '';
let tipoPagoId = '';

const mockAuth = vi.hoisted(() => ({ userId: '', tenantId: '' }));
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: async () => ({
    userId: mockAuth.userId, tenantId: mockAuth.tenantId, tenantRole: 'manager',
    planFeatures: { 'prestamos-cash': true, 'deudas-cash': true },
  }),
}));

const { registrarPagoPrestamoAction } = await import('@/features/contabilidad/actions-prestamos-cash');
const { registrarPagoDeudaAction } = await import('@/features/contabilidad/actions-deudas-cash');

describe('server actions cash — reintento no duplica (G5)', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    expect(identity[0]).toMatchObject({
      db: process.env.DATABASE_URL_TEST?.split('/').pop(),
    });

    const tenant = await prisma.tenant.create({
      data: { nombre: `${prefix}-t`, slug: `${prefix}-t` },
    });
    tenantId = tenant.tenantId;
    const user = await prisma.user.create({
      data: { name: `${prefix}-user`, email: `${prefix}@test.cu`, password: 'x' },
    });
    userId = user.userId;
    mockAuth.userId = userId;
    mockAuth.tenantId = tenantId;
    await prisma.tenantMembership.create({
      data: { tenantId, userId, tenantRole: 'manager' },
    });
    const cliente = await prisma.cliente.create({
      data: { tenantId, nombre: `${prefix}-cli` },
    });
    clienteId = cliente.clienteId;
    proveedorId = (await prisma.vendor.create({
      data: { tenantId, nombre: `${prefix}-prov` },
    })).vendorId;
    cuentaOrigenId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: `${prefix}-origen`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 5000,
    } })).cuentaId;
    cuentaPagoId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: `${prefix}-pago`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 0,
    } })).cuentaId;
    tipoPagoId = (await prisma.tipoPago.create({
      data: { tenantId, nombre: 'Transferencia' },
    })).tipoId;

    await prisma.$transaction(async (tx) => {
      await seedPlanContable(tx, tenantId);
      await seedPlantillasGlobales(tx);
    });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
    });
    const hoy = new Date();
    const mesInicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const mesFin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0, 23, 59, 59));
    await prisma.periodoContable.create({
      data: { tenantId, tipo: 'MENSUAL', estado: 'ABIERTO', fechaInicio: mesInicio, fechaFin: mesFin },
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS dummy ON "asientos"`,
    ).catch(() => undefined);
  });

  it('registrarPagoPrestamoAction: reintento tras pago total no duplica', async () => {
    const loan = await AccountingCashOperationsMutationService.createCashLoan({
      input: { clienteId, montoCapital: 500, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true } } as never,
    });
    const recsAntes = await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'PRESTAMO_CASH', prestamoCashId: loan.id },
    });

    const primera = await registrarPagoPrestamoAction({
      id: loan.id, monto: 500, cuentaId: cuentaPagoId, tipoPagoId,
    });
    expect(primera.success).toBe(true);

    const reintento = await registrarPagoPrestamoAction({
      id: loan.id, monto: 500, cuentaId: cuentaPagoId, tipoPagoId,
    });
    expect(reintento.success).toBe(false);

    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'PRESTAMO_CASH', prestamoCashId: loan.id },
    })).toBe(recsAntes + 1);
  });

  it('registrarPagoDeudaAction: reintento tras pago total no duplica', async () => {
    const deuda = await AccountingCashOperationsMutationService.createCashDebt({
      input: { proveedorId, montoCapital: 500, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'deudas-cash': true } } as never,
    });
    const recsAntes = await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'DEUDA_CASH', deudaCashId: deuda.id },
    });

    const primera = await registrarPagoDeudaAction({
      id: deuda.id, monto: 500, cuentaId: cuentaPagoId, tipoPagoId,
    });
    expect(primera.success).toBe(true);

    const reintento = await registrarPagoDeudaAction({
      id: deuda.id, monto: 500, cuentaId: cuentaPagoId, tipoPagoId,
    });
    expect(reintento.success).toBe(false);

    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, tipoReconciliacion: 'DEUDA_CASH', deudaCashId: deuda.id },
    })).toBe(recsAntes + 1);
  });
});
