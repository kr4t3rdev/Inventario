import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: async () => auth.user }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn(), logStrict: vi.fn().mockResolvedValue({}) },
}));

const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;
const previousNonCashMode = process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE;
const tenants: Array<{ tenantId: string; userId: string }> = [];
let initialize: typeof import('@/features/contabilidad/actions-cuentas-bancarias').initializeBankAccountsAction;
let cupCreated = false;
let usdCreated = false;

async function makeTenant() {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const user = {
    userId, name: 'QA submayor', email: `qa-sub-${tenantId.slice(0, 8)}@example.test`,
    role: 'admin' as const, isActive: true, tenantId, tenantRole: 'manager' as const,
  };
  auth.user = user as unknown as AuthenticatedUser;
  await prisma.tenant.create({ data: { tenantId, nombre: 'QA submayor', slug: randomUUID() } });
  await prisma.user.create({ data: { userId, name: user.name, email: user.email, password: 'integration-only-placeholder' } });
  await prisma.tenantAccountingPolicy.create({ data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId } });
  await prisma.$transaction((tx) => seedPlanContable(tx as never, tenantId));
  await seedPlantillasGlobales(prisma as never);
  await prisma.tenantLicense.create({
    data: { tenantId, activa: true, expiracion: new Date(Date.now() + 86_400_000), features: { 'contabilidad-formal': true } },
  });
  const clientId = (await prisma.cliente.create({ data: { tenantId, nombre: 'Cliente QA' } })).clienteId;
  const vendorId = (await prisma.vendor.create({ data: { tenantId, nombre: 'Proveedor QA' } })).vendorId;
  tenants.push({ tenantId, userId });
  return { tenantId, user, clientId, vendorId };
}

describe('inicialización de CxC/CxP externas — PostgreSQL', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE = 'enforce';
    initialize = (await import('@/features/contabilidad/actions-cuentas-bancarias')).initializeBankAccountsAction;
    const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);
    if (!(await prisma.moneda.findUnique({ where: { codigo: 'CUP' } }))) {
      await prisma.moneda.create({ data: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' } });
      cupCreated = true;
    }
    if (!(await prisma.moneda.findUnique({ where: { codigo: 'USD' } }))) {
      await prisma.moneda.create({ data: { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'USD' } });
      usdCreated = true;
    }
  });

  afterAll(async () => {
    if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
    else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
    if (previousNonCashMode === undefined) delete process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE;
    else process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE = previousNonCashMode;
    for (const { tenantId, userId } of tenants) {
      await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
      await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
      await prisma.inicializacionContable.deleteMany({ where: { tenantId } });
      await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
      await prisma.asientoLinea.deleteMany({ where: { tenantId } });
      await prisma.asiento.deleteMany({ where: { tenantId } });
      await prisma.aperturaPeriodo.deleteMany({ where: { tenantId } });
      await prisma.periodoContable.deleteMany({ where: { tenantId } });
      await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
      await prisma.diario.deleteMany({ where: { tenantId } });
      await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
      await prisma.cuentaContable.deleteMany({ where: { tenantId } });
      await prisma.cliente.deleteMany({ where: { tenantId } });
      await prisma.vendor.deleteMany({ where: { tenantId } });
      await prisma.tenantLicense.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { userId } });
      await prisma.tenant.deleteMany({ where: { tenantId } });
    }
    if (cupCreated) await prisma.moneda.delete({ where: { codigo: 'CUP' } });
    if (usdCreated) await prisma.moneda.delete({ where: { codigo: 'USD' } });
    await prisma.$disconnect();
  });

  it('carga CxC en divisa y CxP en funcional con asiento, detalle y replay', async () => {
    const { tenantId, clientId, vendorId } = await makeTenant();
    const request = {
      idempotencyKey: `subledger-${tenantId.slice(0, 8)}`,
      fechaCorte: '2026-11-01',
      monedaFuncional: 'CUP',
      tasas: { USD: '24' },
      cuentas: [{
        nombreCuenta: 'Cuenta sin saldo', nombreBanco: 'Banco QA',
        numeroCuenta: `SUB-${tenantId.slice(0, 8)}`, tipoCuenta: 'CORRIENTE',
        moneda: 'CUP', saldoInicial: '0',
      }],
      cuentasPorCobrar: [{ referenciaFila: 'cxc-usd', clienteId: clientId, moneda: 'USD', saldo: '100' }],
      cuentasPorPagar: [{ referenciaFila: 'cxp-cup', proveedorId: vendorId, moneda: 'CUP', saldo: '500' }],
    };
    const first = await initialize(request);
    expect(first.success).toBe(true);
    if (!first.success) throw new Error(JSON.stringify(first));
    expect(first.data.replayed).toBe(false);
    expect(first.data.resultado.totalDebeFuncional).toBe('2900');
    expect(first.data.resultado.totalHaberFuncional).toBe('2900');

    const receivable = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } });
    expect(receivable).toMatchObject({
      referenciaInicial: 'cxc-usd', tipoCuenta: 'APERTURA_EXTERNA',
      monedaOriginal: 'USD', monedaFuncional: 'CUP', estado: 'PENDIENTE',
    });
    expect(receivable.montoDeuda.toString()).toBe('100');
    expect(receivable.montoDeudaFuncional?.toString()).toBe('2400');
    expect(receivable.tasaCambio?.toString()).toBe('24');
    expect(receivable.fxProvenanceKind).toBe('MANUAL_GOVERNED');
    expect(receivable.fxEvidenceFingerprint).toMatch(/^[0-9a-f]{64}$/);

    const payable = await prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId } });
    expect(payable).toMatchObject({
      referenciaInicial: 'cxp-cup', tipo: 'inicial_externa',
      monedaOriginal: 'CUP', monedaFuncional: 'CUP', estado: 'PENDIENTE',
    });
    expect(payable.montoDeuda.toString()).toBe('500');
    expect(payable.montoDeudaFuncional?.toString()).toBe('500');
    expect(payable.tasaCambio?.toString()).toBe('1');
    expect(payable.fxProvenanceKind).toBe('SAME_CURRENCY');

    const cxcAccountId = (await prisma.cuentaRolTenant.findUniqueOrThrow({
      where: { tenantId_rol: { tenantId, rol: 'CXC_CLIENTES' } },
    })).cuentaId;
    const cxpAccountId = (await prisma.cuentaRolTenant.findUniqueOrThrow({
      where: { tenantId_rol: { tenantId, rol: 'CXP_PROVEEDORES' } },
    })).cuentaId;
    const asiento = await prisma.asiento.findFirstOrThrow({
      where: { tenantId, origenTipo: 'inicializacion_contable' },
      include: { lineas: { orderBy: { orden: 'asc' } } },
    });
    expect(asiento.lineas).toHaveLength(4);
    expect(asiento.lineas.map((line) => ({
      cuentaId: line.cuentaId,
      debe: line.debe.toString(),
      haber: line.haber.toString(),
      monedaOriginal: line.monedaOriginal,
      montoOriginal: line.montoOriginal.toString(),
    }))).toEqual([
      { cuentaId: cxcAccountId, debe: '2400', haber: '0', monedaOriginal: 'USD', montoOriginal: '100' },
      { cuentaId: (await prisma.cuentaRolTenant.findUniqueOrThrow({
        where: { tenantId_rol: { tenantId, rol: 'RESULTADOS_ACUMULADOS' } },
      })).cuentaId, debe: '0', haber: '2400', monedaOriginal: 'USD', montoOriginal: '100' },
      { cuentaId: (await prisma.cuentaRolTenant.findUniqueOrThrow({
        where: { tenantId_rol: { tenantId, rol: 'RESULTADOS_ACUMULADOS' } },
      })).cuentaId, debe: '500', haber: '0', monedaOriginal: 'CUP', montoOriginal: '500' },
      { cuentaId: cxpAccountId, debe: '0', haber: '500', monedaOriginal: 'CUP', montoOriginal: '500' },
    ]);

    const apertura = await prisma.aperturaPeriodo.findFirstOrThrow({ where: { tenantId } });
    const detalle = apertura.detalleJson as Record<string, unknown>;
    const subledger = detalle.subledger as Record<string, unknown>;
    expect(subledger.cuentasPorCobrar).toMatchObject({ count: 1, totalFuncional: '2400' });
    expect(subledger.cuentasPorPagar).toMatchObject({ count: 1, totalFuncional: '500' });

    expect(await prisma.venta.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.factura.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.compraDocumento.count({ where: { tenantId } })).toBe(0);

    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
    if (!replay.success) throw new Error(JSON.stringify(replay));
    expect(replay.data.resultado).toEqual(first.data.resultado);
    expect(await prisma.cuentaPorCobrar.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.cuentaPorPagar.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(1);
  });

  it('valora CxC con la tasa de la fila sin tabla de tasas', async () => {
    const { tenantId, clientId } = await makeTenant();
    const first = await initialize({
      idempotencyKey: `sub-row-${tenantId.slice(0, 8)}`,
      fechaCorte: '2026-11-01',
      monedaFuncional: 'CUP',
      cuentas: [{
        nombreCuenta: 'Cuenta sin saldo', nombreBanco: 'Banco QA',
        numeroCuenta: `SUBR-${tenantId.slice(0, 8)}`, tipoCuenta: 'CORRIENTE',
        moneda: 'CUP', saldoInicial: '0',
      }],
      cuentasPorCobrar: [{ referenciaFila: 'cxc-row', clienteId: clientId, moneda: 'USD', saldo: '100', tasaCambio: '25' }],
    });
    expect(first.success).toBe(true);
    const receivable = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } });
    expect(receivable.montoDeudaFuncional?.toString()).toBe('2500');
    expect(receivable.tasaCambio?.toString()).toBe('25');
  });

  it('rechaza CxC en divisa sin tasa declarada', async () => {
    const { tenantId, clientId } = await makeTenant();
    const result = await initialize({
      idempotencyKey: `sub-notasa-${tenantId.slice(0, 8)}`,
      fechaCorte: '2026-11-01',
      monedaFuncional: 'CUP',
      cuentas: [{
        nombreCuenta: 'Cuenta sin saldo', nombreBanco: 'Banco QA',
        numeroCuenta: `SUBN-${tenantId.slice(0, 8)}`, tipoCuenta: 'CORRIENTE',
        moneda: 'CUP', saldoInicial: '0',
      }],
      cuentasPorCobrar: [{ referenciaFila: 'cxc-notasa', clienteId: clientId, moneda: 'USD', saldo: '100' }],
    });
    expect(result.success).toBe(false);
    expect(await prisma.cuentaPorCobrar.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.inicializacionContable.count({ where: { tenantId } })).toBe(0);
  });
});
