/**
 * @description Aislamiento por tenant de la inicialización — PostgreSQL (tarea 8).
 *
 * Un usuario no puede liquidar saldos iniciales de otro tenant ni inyectar
 * un tenantId desde el cliente: el tenant siempre se deriva de la sesión.
 */
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
const tipoPagoByTenant = new Map<string, string>();
let initialize: typeof import('@/features/contabilidad/actions-cuentas-bancarias').initializeBankAccountsAction;
let settleReceivable: typeof import('@/features/contabilidad/actions-subledger-settlement').settleInitialReceivableAction;
let settlePayable: typeof import('@/features/contabilidad/actions-subledger-settlement').settleInitialPayableAction;
let cupCreated = false;
let usdCreated = false;

async function makeTenant() {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const user = {
    userId, name: 'QA seguridad init', email: `qa-sec-${tenantId.slice(0, 8)}@example.test`,
    role: 'admin' as const, isActive: true, tenantId, tenantRole: 'manager' as const,
  };
  auth.user = user as unknown as AuthenticatedUser;
  await prisma.tenant.create({ data: { tenantId, nombre: 'QA seguridad init', slug: randomUUID() } });
  await prisma.user.create({ data: { userId, name: user.name, email: user.email, password: 'integration-only-placeholder' } });
  await prisma.tenantAccountingPolicy.create({ data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId } });
  await prisma.$transaction((tx) => seedPlanContable(tx as never, tenantId));
  await seedPlantillasGlobales(prisma as never);
  await prisma.tenantLicense.create({
    data: { tenantId, activa: true, expiracion: new Date(Date.now() + 86_400_000), features: { 'contabilidad-formal': true } },
  });
  const clientId = (await prisma.cliente.create({ data: { tenantId, nombre: 'Cliente QA' } })).clienteId;
  const vendorId = (await prisma.vendor.create({ data: { tenantId, nombre: 'Proveedor QA' } })).vendorId;
  const tipoPago = await prisma.tipoPago.create({ data: { tenantId, nombre: 'Transferencia QA', requiereCuenta: false } });
  tipoPagoByTenant.set(tenantId, tipoPago.tipoId);
  tenants.push({ tenantId, userId });
  return { tenantId, user, clientId, vendorId };
}

async function makeInventorySetup(tenantId: string) {
  const categoria = await prisma.categoria.create({
    data: { tenantId, nombre: `Categoría sec ${tenantId.slice(0, 8)}` },
  });
  const almacen = await prisma.almacen.create({
    data: { tenantId, nombre: `Almacén sec ${tenantId.slice(0, 8)}` },
  });
  const producto = await prisma.producto.create({
    data: {
      tenantId,
      nombre: `Producto sec ${tenantId.slice(0, 8)}`,
      precioCosto: 25,
      precioVenta: 500,
      stock: 0,
      categoriaId: categoria.catId,
      almacenId: almacen.almacenId,
    },
  });
  return { categoria, almacen, producto };
}

function initRequest(tenantId: string, clientId: string, vendorId: string, productoId: string, almacenId: string) {
  return {
    idempotencyKey: `sec-init-${tenantId.slice(0, 8)}`,
    fechaCorte: '2026-11-01',
    monedaFuncional: 'CUP',
    cuentas: [{
      nombreCuenta: 'Cuenta CUP', nombreBanco: 'Banco QA',
      numeroCuenta: `SEC-C-${tenantId.slice(0, 8)}`, tipoCuenta: 'CORRIENTE',
      moneda: 'CUP', saldoInicial: '1000', origenNoDocumentado: true,
    }],
    inventario: [{
      referenciaFila: 'fila-1', productoId, almacenId,
      loteCodigo: 'LOTE-SEC-1', cantidad: '4', costoUnitario: '25', moneda: 'CUP',
    }],
    cuentasPorCobrar: [{ referenciaFila: 'cxc-1', clienteId: clientId, moneda: 'CUP', saldo: '500' }],
    cuentasPorPagar: [{ referenciaFila: 'cxp-1', proveedorId: vendorId, moneda: 'CUP', saldo: '300' }],
  };
}

describe('aislamiento por tenant de la inicialización — PostgreSQL', { timeout: 180_000 }, () => {
  beforeAll(async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE = 'enforce';
    initialize = (await import('@/features/contabilidad/actions-cuentas-bancarias')).initializeBankAccountsAction;
    ({ settleInitialReceivableAction: settleReceivable, settleInitialPayableAction: settlePayable } =
      await import('@/features/contabilidad/actions-subledger-settlement'));
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
      await prisma.auditLog.deleteMany({ where: { usuarioId: userId } });
      await prisma.pagoCuentaPorPagar.deleteMany({ where: { tenantId } });
      await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
      await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
      await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
      await prisma.inventarioInicialFuente.deleteMany({ where: { tenantId } });
      await prisma.lote.deleteMany({ where: { tenantId } });
      await prisma.stockUbicacion.deleteMany({ where: { tenantId } });
      await prisma.proveedorProducto.deleteMany({ where: { tenantId } });
      await prisma.producto.deleteMany({ where: { tenantId } });
      await prisma.ubicacion.deleteMany({ where: { tenantId } });
      await prisma.almacen.deleteMany({ where: { tenantId } });
      await prisma.categoria.deleteMany({ where: { tenantId } });
      await prisma.cliente.deleteMany({ where: { tenantId } });
      await prisma.inicializacionContable.deleteMany({ where: { tenantId } });
      await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
      // El vendor se borra después de la CxP: un trigger protege el origen inicial.
      await prisma.vendor.deleteMany({ where: { tenantId } });
      await prisma.asientoLinea.deleteMany({ where: { tenantId } });
      await prisma.asiento.deleteMany({ where: { tenantId } });
      await prisma.aperturaPeriodo.deleteMany({ where: { tenantId } });
      await prisma.periodoContable.deleteMany({ where: { tenantId } });
      await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
      await prisma.diario.deleteMany({ where: { tenantId } });
      await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
      await prisma.cuentaContable.deleteMany({ where: { tenantId } });
      await prisma.tipoPago.deleteMany({ where: { tenantId } });
      await prisma.tenantLicense.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { userId } });
      await prisma.tenant.deleteMany({ where: { tenantId } });
    }
    if (cupCreated) await prisma.moneda.deleteMany({ where: { codigo: 'CUP' } });
    if (usdCreated) await prisma.moneda.deleteMany({ where: { codigo: 'USD' } });
    await prisma.$disconnect();
  });

  it('un tenant no puede liquidar saldos iniciales de otro tenant', async () => {
    const a = await makeTenant();
    const { producto, almacen } = await makeInventorySetup(a.tenantId);
    auth.user = a.user as unknown as AuthenticatedUser;
    const first = await initialize(initRequest(a.tenantId, a.clientId, a.vendorId, producto.id, almacen.almacenId));
    expect(first.success).toBe(true);
    if (!first.success) throw new Error(JSON.stringify(first));
    const bancoA = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId: a.tenantId } });
    const cxcA = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId: a.tenantId } });
    const cxpA = await prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId: a.tenantId } });

    const b = await makeTenant();
    const bancoB = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId: b.tenantId } }).catch(() => null);
    // B no tiene cuenta bancaria: usa la de A (también ajena) y luego la suya si existiera.
    const tipoPagoB = tipoPagoByTenant.get(b.tenantId)!;
    auth.user = b.user as unknown as AuthenticatedUser;

    // CxC de A + banco de A: nada de B; debe fallar.
    const cobroAjeno = await settleReceivable({
      cuentaPorCobrarId: cxcA.id, cuentaId: bancoA.cuentaId, tipoPagoId: tipoPagoB,
      monto: '100', fechaEfectiva: '2026-11-05', referencia: 'cobro-sec-1',
    });
    expect(cobroAjeno.success).toBe(false);
    // CxP de A + banco de A: debe fallar.
    const pagoAjeno = await settlePayable({
      cuentaPorPagarId: cxpA.cuentaPorPagarId, cuentaId: bancoA.cuentaId,
      monto: '100', fechaEfectiva: '2026-11-06', referencia: 'pago-sec-1',
    });
    expect(pagoAjeno.success).toBe(false);
    // Nada se movió en A.
    expect((await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxcA.id } })).estado).toBe('PENDIENTE');
    expect((await prisma.cuentaPorPagar.findUniqueOrThrow({ where: { cuentaPorPagarId: cxpA.cuentaPorPagarId } })).estado).toBe('PENDIENTE');
    expect(bancoB).toBeNull();
  });

  it('la inicialización rechaza un tenantId enviado por el cliente', async () => {
    const a = await makeTenant();
    const { producto, almacen } = await makeInventorySetup(a.tenantId);
    auth.user = a.user as unknown as AuthenticatedUser;
    const result = await initialize({
      ...initRequest(a.tenantId, a.clientId, a.vendorId, producto.id, almacen.almacenId),
      tenantId: 'tenant-ajeno',
    } as never);
    expect(result.success).toBe(false);
    expect(await prisma.inicializacionContable.count({ where: { tenantId: a.tenantId } })).toBe(0);
  });
});
