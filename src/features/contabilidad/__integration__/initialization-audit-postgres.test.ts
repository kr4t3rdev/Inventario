/**
 * @description Auditoría de la inicialización — PostgreSQL aislado (tarea 8).
 *
 * Afirma filas REALES de AuditLog (sin mockear el servicio) tras inicializar,
 * tras cobrar/pagar saldos iniciales y tras guardar el borrador; y que el
 * replay con la misma clave no duplica ninguna fila de auditoría.
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

const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;
const previousNonCashMode = process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE;
const tenants: Array<{ tenantId: string; userId: string }> = [];
const tipoPagoByTenant = new Map<string, string>();
let initialize: typeof import('@/features/contabilidad/actions-cuentas-bancarias').initializeBankAccountsAction;
let settleReceivable: typeof import('@/features/contabilidad/actions-subledger-settlement').settleInitialReceivableAction;
let settlePayable: typeof import('@/features/contabilidad/actions-subledger-settlement').settleInitialPayableAction;
let guardar: typeof import('@/features/contabilidad/actions-inicializacion-borrador').guardarBorradorInicializacionAction;
let cupCreated = false;
let usdCreated = false;

async function makeTenant() {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const user = {
    userId, name: 'QA auditoría init', email: `qa-audit-${tenantId.slice(0, 8)}@example.test`,
    role: 'admin' as const, isActive: true, tenantId, tenantRole: 'manager' as const,
  };
  auth.user = user as unknown as AuthenticatedUser;
  await prisma.tenant.create({ data: { tenantId, nombre: 'QA auditoría init', slug: randomUUID() } });
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
    data: { tenantId, nombre: `Categoría audit ${tenantId.slice(0, 8)}` },
  });
  const almacen = await prisma.almacen.create({
    data: { tenantId, nombre: `Almacén audit ${tenantId.slice(0, 8)}` },
  });
  const producto = await prisma.producto.create({
    data: {
      tenantId,
      nombre: `Producto audit ${tenantId.slice(0, 8)}`,
      precioCosto: 25,
      precioVenta: 500,
      stock: 0,
      categoriaId: categoria.catId,
      almacenId: almacen.almacenId,
    },
  });
  const pv = await prisma.puntoDeVenta.create({
    data: { tenantId, nombre: `PV audit ${tenantId.slice(0, 8)}`, tipoCaja: 'SECUNDARIA' },
  });
  return { categoria, almacen, producto, pv };
}

function initRequest(tenantId: string, clientId: string, vendorId: string, productoId: string, almacenId: string) {
  return {
    idempotencyKey: `audit-init-${tenantId.slice(0, 8)}`,
    fechaCorte: '2026-11-01',
    monedaFuncional: 'CUP',
    cuentas: [{
      nombreCuenta: 'Cuenta CUP', nombreBanco: 'Banco QA',
      numeroCuenta: `AUD-C-${tenantId.slice(0, 8)}`, tipoCuenta: 'CORRIENTE',
      moneda: 'CUP', saldoInicial: '1000', origenNoDocumentado: true,
    }],
    inventario: [{
      referenciaFila: 'fila-1', productoId, almacenId,
      loteCodigo: 'LOTE-AUDIT-1', cantidad: '4', costoUnitario: '25', moneda: 'CUP',
    }],
    cuentasPorCobrar: [{ referenciaFila: 'cxc-1', clienteId: clientId, moneda: 'CUP', saldo: '500' }],
    cuentasPorPagar: [{ referenciaFila: 'cxp-1', proveedorId: vendorId, moneda: 'CUP', saldo: '300' }],
  };
}

const draftPayload = {
  fechaCorte: '2026-11-01',
  monedaFuncional: 'CUP',
  cuentas: [{ numeroCuenta: 'QA-DRAFT-01', nombreCuenta: 'Caja', nombreBanco: 'Banco QA', tipoCuenta: 'Ahorros', moneda: 'CUP', saldoInicial: '100000' }],
};

async function auditRows(userId: string) {
  return prisma.auditLog.findMany({ where: { usuarioId: userId }, orderBy: { createdAt: 'asc' } });
}

describe('auditoría de la inicialización — PostgreSQL', { timeout: 180_000 }, () => {
  beforeAll(async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE = 'enforce';
    initialize = (await import('@/features/contabilidad/actions-cuentas-bancarias')).initializeBankAccountsAction;
    ({ settleInitialReceivableAction: settleReceivable, settleInitialPayableAction: settlePayable } =
      await import('@/features/contabilidad/actions-subledger-settlement'));
    guardar = (await import('@/features/contabilidad/actions-inicializacion-borrador')).guardarBorradorInicializacionAction;
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
      await prisma.puntoDeVenta.deleteMany({ where: { tenantId } });
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

  it('audita cada pata de la apertura: banco, inventario, CxC y CxP', async () => {
    const { tenantId, user, clientId, vendorId } = await makeTenant();
    const { producto, almacen } = await makeInventorySetup(tenantId);
    const first = await initialize(initRequest(tenantId, clientId, vendorId, producto.id, almacen.almacenId));
    expect(first.success).toBe(true);
    if (!first.success) throw new Error(JSON.stringify(first));
    const banco = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId, moneda: 'CUP' } });
    const fuente = await prisma.inventarioInicialFuente.findFirstOrThrow({ where: { tenantId } });
    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } });
    const cxp = await prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId } });

    const rows = await auditRows(user.userId);
    const byEntity = (entidad: string) => rows.filter((r) => r.entidad === entidad);
    expect(byEntity('CUENTA_BANCARIA')).toHaveLength(1);
    expect(byEntity('CUENTA_BANCARIA')[0]).toMatchObject({
      accion: 'CREATE', entidadId: banco.cuentaId, usuarioId: user.userId,
    });
    expect((byEntity('CUENTA_BANCARIA')[0].detalles as Record<string, unknown>).origen).toBe('INICIALIZACION_CONTABLE');
    expect(byEntity('INVENTARIO_INICIAL')).toHaveLength(1);
    expect(byEntity('INVENTARIO_INICIAL')[0]).toMatchObject({
      accion: 'CREATE', entidadId: fuente.id, usuarioId: user.userId,
    });
    expect(byEntity('CUENTA_POR_COBRAR')).toHaveLength(1);
    expect(byEntity('CUENTA_POR_COBRAR')[0]).toMatchObject({
      accion: 'CREATE', entidadId: cxc.id, usuarioId: user.userId,
    });
    expect(byEntity('CUENTA_POR_PAGAR')).toHaveLength(1);
    expect(byEntity('CUENTA_POR_PAGAR')[0]).toMatchObject({
      accion: 'CREATE', entidadId: cxp.cuentaPorPagarId, usuarioId: user.userId,
    });
    expect(rows).toHaveLength(4);
  });

  it('audita el cobro y el pago externos de saldos iniciales', async () => {
    const { tenantId, user, clientId, vendorId } = await makeTenant();
    const { producto, almacen } = await makeInventorySetup(tenantId);
    const tipoPagoId = tipoPagoByTenant.get(tenantId)!;
    const first = await initialize(initRequest(tenantId, clientId, vendorId, producto.id, almacen.almacenId));
    expect(first.success).toBe(true);
    if (!first.success) throw new Error(JSON.stringify(first));
    const banco = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId, moneda: 'CUP' } });
    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } });
    const cxp = await prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId } });

    const cobro = await settleReceivable({
      cuentaPorCobrarId: cxc.id, cuentaId: banco.cuentaId, tipoPagoId,
      monto: '500', fechaEfectiva: '2026-11-05', referencia: 'cobro-audit-1',
    });
    expect(cobro.success).toBe(true);
    if (!cobro.success) throw new Error(JSON.stringify(cobro));
    const pago = await settlePayable({
      cuentaPorPagarId: cxp.cuentaPorPagarId, cuentaId: banco.cuentaId,
      monto: '300', fechaEfectiva: '2026-11-06', referencia: 'pago-audit-1',
    });
    expect(pago.success).toBe(true);
    if (!pago.success) throw new Error(JSON.stringify(pago));

    const rows = await auditRows(user.userId);
    const byEntity = (entidad: string) => rows.filter((r) => r.entidad === entidad);
    expect(byEntity('RECONCILIACION')).toHaveLength(1);
    expect(byEntity('RECONCILIACION')[0]).toMatchObject({
      accion: 'CREATE', entidadId: (cobro.data as { reconciliacionId: string }).reconciliacionId,
    });
    expect((byEntity('RECONCILIACION')[0].detalles as Record<string, unknown>).origen).toBe('INICIALIZACION_CONTABLE');
    expect(byEntity('PAGO_CUENTA_POR_PAGAR')).toHaveLength(1);
    expect(byEntity('PAGO_CUENTA_POR_PAGAR')[0]).toMatchObject({
      accion: 'CREATE', entidadId: (pago.data as { pagoCuentaPorPagarId: string }).pagoCuentaPorPagarId,
    });
    expect((byEntity('PAGO_CUENTA_POR_PAGAR')[0].detalles as Record<string, unknown>).origen).toBe('INICIALIZACION_CONTABLE');
  });

  it('audita el guardado del borrador (crear y actualizar)', async () => {
    const { user } = await makeTenant();
    const key = `audit-draft-${user.userId.slice(0, 8)}`;
    const saved = await guardar({ idempotencyKey: key, borrador: draftPayload });
    expect(saved.success).toBe(true);
    if (!saved.success) throw new Error(JSON.stringify(saved.error));
    const updated = await guardar({ idempotencyKey: key, borrador: { ...draftPayload, monedaFuncional: 'USD' } });
    expect(updated.success).toBe(true);
    if (!updated.success) throw new Error(JSON.stringify(updated.error));

    const rows = await auditRows(user.userId);
    const draftRows = rows.filter((r) => r.entidad === 'INICIALIZACION_CONTABLE');
    expect(draftRows).toHaveLength(2);
    expect(draftRows[0]).toMatchObject({ accion: 'CREATE', usuarioId: user.userId });
    expect(draftRows[1]).toMatchObject({ accion: 'UPDATE', usuarioId: user.userId });
    expect((draftRows[0].detalles as Record<string, unknown>).idempotencyKey).toBe(key);
  });

  it('el replay no duplica la auditoría', async () => {
    const { tenantId, user, clientId, vendorId } = await makeTenant();
    const { producto, almacen } = await makeInventorySetup(tenantId);
    const request = initRequest(tenantId, clientId, vendorId, producto.id, almacen.almacenId);
    const first = await initialize(request);
    expect(first.success).toBe(true);
    if (!first.success) throw new Error(JSON.stringify(first));
    const before = await auditRows(user.userId);
    expect(before.length).toBeGreaterThan(0);
    const replay = await initialize(request);
    expect(replay.success).toBe(true);
    const after = await auditRows(user.userId);
    expect(after).toHaveLength(before.length);
  });
});
