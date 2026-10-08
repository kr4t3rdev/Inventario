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
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
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
    const plan = await prisma.plan.create({
      data: {
        nombre: `${prefix}-plan`,
        duracionDias: 365,
        features: {
          'contabilidad-formal': true,
          'prestamos-cash': true,
          'deudas-cash': true,
        },
      },
    });
    await prisma.tenantLicense.create({
      data: { tenantId, planId: plan.planId, activa: true, expiracion: new Date('2099-01-01') },
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
    delete process.env.CONTABILIDAD_FORMAL_MODE;
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

  it('registrarPagoPrestamoAction: replay idempotente conserva un pago parcial', async () => {
    const loan = await AccountingCashOperationsMutationService.createCashLoan({
      input: { clienteId, montoCapital: 500, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true } } as never,
    });
    const key = `loan-partial-${crypto.randomUUID()}`;
    const primera = await registrarPagoPrestamoAction({
      id: loan.id, monto: 0.0123, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey: key,
    });
    expect(primera.success).toBe(true);

    const segunda = await registrarPagoPrestamoAction({
      id: loan.id, monto: 0.0123, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey: key,
    });
    expect(segunda.success).toBe(true);

    const cxc = await prisma.cuentaPorCobrar.findUnique({
      where: { id: loan.cuentaPorCobrarId },
      select: { montoPagado: true },
    });
    expect(cxc?.montoPagado?.toString()).toBe('0.0123');
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, idempotencyKey: key, prestamoCashId: loan.id },
    })).toBe(1);

    const conflicto = await registrarPagoPrestamoAction({
      id: loan.id, monto: 0.0223, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey: key,
    });
    expect(conflicto.success).toBe(false);
    if (conflicto.success) expect.unreachable('Se esperaba conflicto de idempotencia');
    expect(conflicto.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('registrarPagoDeudaAction: replay idempotente conserva un pago parcial', async () => {
    const deuda = await AccountingCashOperationsMutationService.createCashDebt({
      input: { proveedorId, montoCapital: 500, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'deudas-cash': true } } as never,
    });
    const key = `debt-partial-${crypto.randomUUID()}`;
    const primera = await registrarPagoDeudaAction({
      id: deuda.id, monto: 0.0123, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey: key,
    });
    expect(primera.success).toBe(true);

    const segunda = await registrarPagoDeudaAction({
      id: deuda.id, monto: 0.0123, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey: key,
    });
    expect(segunda.success).toBe(true);

    const cxp = await prisma.cuentaPorPagar.findUnique({
      where: { cuentaPorPagarId: deuda.cuentaPorPagarId },
      select: { montoPagado: true },
    });
    expect(cxp?.montoPagado?.toString()).toBe('0.0123');
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, idempotencyKey: key, deudaCashId: deuda.id },
    })).toBe(1);

    const conflicto = await registrarPagoDeudaAction({
      id: deuda.id, monto: 0.0223, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey: key,
    });
    expect(conflicto.success).toBe(false);
    if (conflicto.success) expect.unreachable('Se esperaba conflicto de idempotencia');
    expect(conflicto.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('createCashLoan: replay idempotente no duplica saldo, CxC, reconciliación ni asiento', async () => {
    const key = `loan-create-${crypto.randomUUID()}`;
    const input = {
      clienteId,
      montoCapital: 275,
      moneda: 'CUP',
      cuentaBancariaId: cuentaOrigenId,
      idempotencyKey: key,
    };
    const saldoAntes = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });

    const primera = await AccountingCashOperationsMutationService.createCashLoan({
      input,
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true } } as never,
    });
    const replay = await AccountingCashOperationsMutationService.createCashLoan({
      input,
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true } } as never,
    });

    expect(replay.id).toBe(primera.id);
    expect(await prisma.prestamoCash.count({ where: { tenantId, id: primera.id } })).toBe(1);
    expect(await prisma.cuentaPorCobrar.count({
      where: { tenantId, id: primera.cuentaPorCobrarId },
    })).toBe(1);
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, idempotencyKey: key, prestamoCashId: primera.id },
    })).toBe(1);
    expect(await prisma.asiento.count({
      where: { tenantId, origenTipo: 'prestamo_cash', origenId: primera.id },
    })).toBe(1);

    const saldoDespues = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });
    expect(Number(saldoDespues.saldo)).toBe(Number(saldoAntes.saldo) - 275);

    await expect(AccountingCashOperationsMutationService.createCashLoan({
      input: { ...input, montoCapital: 276 },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'prestamos-cash': true } } as never,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('createCashDebt: replay idempotente no duplica saldo, CxP, reconciliación ni asiento', async () => {
    const key = `debt-create-${crypto.randomUUID()}`;
    const input = {
      proveedorId,
      montoCapital: 315,
      moneda: 'CUP',
      cuentaBancariaId: cuentaOrigenId,
      idempotencyKey: key,
    };
    const saldoAntes = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });

    const primera = await AccountingCashOperationsMutationService.createCashDebt({
      input,
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'deudas-cash': true } } as never,
    });
    const replay = await AccountingCashOperationsMutationService.createCashDebt({
      input,
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'deudas-cash': true } } as never,
    });

    expect(replay.id).toBe(primera.id);
    expect(await prisma.deudaCash.count({ where: { tenantId, id: primera.id } })).toBe(1);
    expect(await prisma.cuentaPorPagar.count({
      where: { tenantId, cuentaPorPagarId: primera.cuentaPorPagarId },
    })).toBe(1);
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, idempotencyKey: key, deudaCashId: primera.id },
    })).toBe(1);
    expect(await prisma.asiento.count({
      where: { tenantId, origenTipo: 'deuda_cash', origenId: primera.id },
    })).toBe(1);

    const saldoDespues = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });
    expect(Number(saldoDespues.saldo)).toBe(Number(saldoAntes.saldo) + 315);

    await expect(AccountingCashOperationsMutationService.createCashDebt({
      input: { ...input, montoCapital: 316 },
      user: { userId, tenantId, tenantRole: 'manager',
        planFeatures: { 'deudas-cash': true } } as never,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('createCashLoan: dos solicitudes concurrentes con la misma clave convergen en una entidad', async () => {
    const key = `loan-create-race-${crypto.randomUUID()}`;
    const input = {
      clienteId,
      montoCapital: 185,
      moneda: 'CUP',
      cuentaBancariaId: cuentaOrigenId,
      idempotencyKey: key,
    };
    const saldoAntes = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });

    const [primera, segunda] = await Promise.all([
      AccountingCashOperationsMutationService.createCashLoan({
        input,
        user: { userId, tenantId, tenantRole: 'manager',
          planFeatures: { 'prestamos-cash': true } } as never,
      }),
      AccountingCashOperationsMutationService.createCashLoan({
        input,
        user: { userId, tenantId, tenantRole: 'manager',
          planFeatures: { 'prestamos-cash': true } } as never,
      }),
    ]);

    expect(segunda.id).toBe(primera.id);
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, idempotencyKey: key, prestamoCashId: primera.id },
    })).toBe(1);
    expect(await prisma.asiento.count({
      where: { tenantId, origenTipo: 'prestamo_cash', origenId: primera.id },
    })).toBe(1);
    const saldoDespues = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });
    expect(Number(saldoDespues.saldo)).toBe(Number(saldoAntes.saldo) - 185);
  });

  it('createCashDebt: dos solicitudes concurrentes con la misma clave convergen en una entidad', async () => {
    const key = `debt-create-race-${crypto.randomUUID()}`;
    const input = {
      proveedorId,
      montoCapital: 195,
      moneda: 'CUP',
      cuentaBancariaId: cuentaOrigenId,
      idempotencyKey: key,
    };
    const saldoAntes = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });

    const [primera, segunda] = await Promise.all([
      AccountingCashOperationsMutationService.createCashDebt({
        input,
        user: { userId, tenantId, tenantRole: 'manager',
          planFeatures: { 'deudas-cash': true } } as never,
      }),
      AccountingCashOperationsMutationService.createCashDebt({
        input,
        user: { userId, tenantId, tenantRole: 'manager',
          planFeatures: { 'deudas-cash': true } } as never,
      }),
    ]);

    expect(segunda.id).toBe(primera.id);
    expect(await prisma.reconciliacionVenta.count({
      where: { tenantId, idempotencyKey: key, deudaCashId: primera.id },
    })).toBe(1);
    expect(await prisma.asiento.count({
      where: { tenantId, origenTipo: 'deuda_cash', origenId: primera.id },
    })).toBe(1);
    const saldoDespues = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuentaOrigenId },
      select: { saldo: true },
    });
    expect(Number(saldoDespues.saldo)).toBe(Number(saldoAntes.saldo) + 195);
  });
});
