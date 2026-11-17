import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({ AuditLogService: { log: vi.fn().mockResolvedValue(undefined) } }));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { acquireAccountingTenantLock } from '@/features/contabilidad/services/accounting-tenant-lock-service';
import { devolverFondosAnticipo, registrarMovimientoEfectivoAnticipo } from '@/lib/services/anticipos-workflow';

describe('bloqueo de cuentas operativas — PostgreSQL', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let createPayable: typeof import('@/features/contabilidad/actions-cuentas').createCuentaPorPagarAction;
  let createReceivable: typeof import('@/features/contabilidad/actions-cuentas').createCuentaPorCobrarAction;
  let createProduct: typeof import('@/features/productos/actions-crud').createProductoAction;
  let tenantId = '';
  let vendorId = '';
  let planId = '';
  let categoryId = '';
  let warehouseId = '';
  const suffix = crypto.randomUUID();

  beforeAll(async () => {
    prisma = (await import('@/lib/prisma')).prisma;
    const actions = await import('@/features/contabilidad/actions-cuentas');
    createPayable = actions.createCuentaPorPagarAction;
    createReceivable = actions.createCuentaPorCobrarAction;
    const productActions = await import('@/features/productos/actions-crud');
    createProduct = productActions.createProductoAction;
    const [identity] = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"`;
    assertDisposableDatabaseIdentity(identity, process.env);
    const tenant = await prisma.tenant.create({ data: { nombre: suffix, slug: suffix } });
    tenantId = tenant.tenantId;
    const vendor = await prisma.vendor.create({ data: { tenantId, nombre: 'Proveedor prueba' } });
    vendorId = vendor.vendorId;
    const plan = await prisma.plan.create({ data: { nombre: suffix, duracionDias: 30, features: { productos: true } } });
    planId = plan.planId;
    await prisma.tenantLicense.create({ data: { tenantId, planId, expiracion: new Date('2099-01-01') } });
    categoryId = (await prisma.categoria.create({ data: { tenantId, nombre: 'Prueba' } })).catId;
    warehouseId = (await prisma.almacen.create({ data: { tenantId, nombre: 'Prueba' } })).almacenId;
    vi.mocked(getCurrentUser).mockResolvedValue({ userId: 'test-user', tenantId, name: 'Prueba',
      email: 'test@example.test', role: 'user', isActive: true, tenantRole: 'manager',
      planFeatures: { 'cuentas-cobrar': true, 'cuentas-pagar': true, productos: true },
      permissions: new Set(['inventario.productos.crear', 'inventario.productos.editar']) });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
    await prisma.stockUbicacion.deleteMany({ where: { producto: { tenantId } } });
    await prisma.producto.deleteMany({ where: { tenantId } });
    await prisma.categoria.deleteMany({ where: { tenantId } });
    await prisma.ubicacion.deleteMany({ where: { tenantId } });
    await prisma.almacen.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.vendor.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { tenantId } });
    await prisma.plan.deleteMany({ where: { planId } });
    await prisma.$disconnect();
  });

  it('espera el bloqueo antes de crear CxP o consultar la venta para CxC', async () => {
    let unlock!: () => void;
    let locked!: () => void;
    const acquired = new Promise<void>((resolve) => { locked = resolve; });
    const release = new Promise<void>((resolve) => { unlock = resolve; });
    const holding = prisma.$transaction(async (tx) => {
      await acquireAccountingTenantLock(tx, tenantId);
      locked();
      await release;
    }, { timeout: 10000 });
    await acquired;
    let payableDone = false;
    let receivableDone = false;
    const payable = createPayable({ numeroFactura: 'F-1', tipo: 'compra', proveedorId: vendorId,
      montoDeuda: 100 }).then((result) => { payableDone = true; return result; });
    const receivable = createReceivable({ ventaId: 'inexistente', clienteId: 'inexistente', monto: 100,
      moneda: 'CUP' }).then((result) => { receivableDone = true; return result; });
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(payableDone).toBe(false);
      expect(receivableDone).toBe(false);
      expect(await prisma.cuentaPorPagar.count({ where: { tenantId } })).toBe(0);
    } finally {
      unlock();
    }
    await holding;
    expect((await payable).success).toBe(true);
    expect((await receivable).success).toBe(false);
    expect(await prisma.cuentaPorPagar.count({ where: { tenantId } })).toBe(1);
  });

  it('espera el bloqueo antes de crear producto y existencias', async () => {
    let unlock!: () => void;
    let locked!: () => void;
    const acquired = new Promise<void>((resolve) => { locked = resolve; });
    const release = new Promise<void>((resolve) => { unlock = resolve; });
    const holding = prisma.$transaction(async (tx) => {
      await acquireAccountingTenantLock(tx, tenantId);
      locked();
      await release;
    }, { timeout: 10000 });
    await acquired;
    let done = false;
    const product = createProduct({ nombre: 'Producto prueba', precioCosto: 10, precioVenta: 20,
      stock: 5, stockMinimo: 0, categoriaId: categoryId, almacenId: warehouseId, fotos: [] })
      .then((result) => { done = true; return result; });
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(done).toBe(false);
      expect(await prisma.producto.count({ where: { tenantId } })).toBe(0);
    } finally {
      unlock();
    }
    await holding;
    expect((await product).success).toBe(true);
    expect(await prisma.producto.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.stockUbicacion.count({ where: { producto: { tenantId } } })).toBe(1);

  });

  it.each([registrarMovimientoEfectivoAnticipo, devolverFondosAnticipo])(
    'espera el bloqueo antes de acceder a un anticipo', async (workflow) => {
      let unlock!: () => void;
      let locked!: () => void;
      const acquired = new Promise<void>((resolve) => { locked = resolve; });
      const release = new Promise<void>((resolve) => { unlock = resolve; });
      const holding = prisma.$transaction(async (tx) => {
        await acquireAccountingTenantLock(tx, tenantId);
        locked();
        await release;
      }, { timeout: 10000 });
      await acquired;
      let done = false;
      const operation = prisma.$transaction((tx) => workflow(tx, { anticipoId: 'inexistente',
        tenantId, cuentaId: 'inexistente', tipoPagoId: 'inexistente', monto: 1,
        idempotencyKey: 'key', usuarioId: 'test-user' }))
        .then(() => { done = true; return null; }, (error: unknown) => { done = true; return error; });
      try {
        await new Promise((resolve) => setTimeout(resolve, 250));
        expect(done).toBe(false);
      } finally {
        unlock();
      }
      await holding;
      expect(await operation).toBeInstanceOf(Error);
    },
  );
});
