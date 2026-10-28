import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PrismaClient, type Prisma } from '@/generated/prisma';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../../scripts/ci/disposable-database.mjs';

const context = vi.hoisted(() => ({ tx: null as Prisma.TransactionClient | null, tenantId: '' }));

vi.mock('@/lib/prisma', () => ({
  prisma: new Proxy({}, { get: (_target, key) => Reflect.get(context.tx!, key) }),
}));
vi.mock('@/lib/server-actions', () => ({
  withAction: (handler: (input: unknown, user: unknown) => unknown) =>
    (input: unknown) => handler(input, { userId: 'test-user', tenantId: context.tenantId }),
  ActionError: class ActionError extends Error {},
}));
vi.mock('@/lib/services/tenant-scope', () => ({
  requireFeature: () => undefined,
  requireTenant: (user: { tenantId: string }) => user.tenantId,
}));

import { getGastosPendientesAction } from '../../actions-reconciliacion';

assertDisposableDatabase(process.env);

describe('gastos pendientes en PostgreSQL', () => {
  it('filtra cuentas activas, fechas y empresa en gastos y compras', async () => {
    const client = new PrismaClient();
    const tenantId = `recon-test-${randomUUID()}`;
    const rollback = new Error('rollback fixture');
    try {
      const [identity] = await client.$queryRawUnsafe<Array<{
        databaseName: string; roleName: string; serverPort: number;
      }>>('SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"');
      assertDisposableDatabaseIdentity(identity, process.env);
      await expect(client.$transaction(async (tx) => {
        context.tx = tx;
        context.tenantId = tenantId;
        await tx.tenant.create({ data: { tenantId, nombre: 'Prueba conciliación' } });
        const vendor = await tx.vendor.create({ data: { tenantId, nombre: 'Proveedor' } });
        const categoria = await tx.categoria.create({ data: { tenantId, nombre: 'Categoría' } });
        const almacen = await tx.almacen.create({ data: { tenantId, nombre: 'Almacén' } });
        const producto = await tx.producto.create({ data: {
          tenantId, nombre: 'Producto', precioCosto: 100, precioVenta: 120, stock: 0,
          categoriaId: categoria.catId, almacenId: almacen.almacenId,
        } });
        const fecha = new Date('2026-01-15T12:00:00Z');
        const estados = ['PENDIENTE', 'PARCIAL', 'PAGADA'] as const;
        for (const estado of estados) {
          const gasto = await tx.gastosDE.create({ data: {
            tenantId, proveedor: 'Proveedor', monto: 100, periodo: '2026-01', createdAt: fecha,
          } });
          const compra = await tx.gastoCompra.create({ data: {
            tenantId, vendorId: vendor.vendorId, productoId: producto.id, cantidad: 1,
            precioUnitario: 100, total: 100, fechaCompra: fecha, createdAt: fecha,
          } });
          for (const referencia of [{ gastosDEId: gasto.gastosDEId }, { gastoCompraId: compra.gastoCompraId }]) {
            await tx.cuentaPorPagar.create({ data: {
              tenantId, numeroFactura: randomUUID(), montoDeuda: 100, saldoPendiente: 100,
              tipo: 'compra', estado, ...referencia,
            } });
          }
        }
        await tx.gastosDE.create({ data: {
          tenantId, proveedor: 'Proveedor', monto: 100, periodo: '2026-02',
          createdAt: new Date('2026-02-01T00:00:00Z'),
        } });
        const otherTenantId = `other-${randomUUID()}`;
        await tx.tenant.create({ data: { tenantId: otherTenantId, nombre: 'Otra empresa' } });
        await tx.gastosDE.create({ data: {
          tenantId: otherTenantId, proveedor: 'Proveedor', monto: 100, periodo: '2026-01', createdAt: fecha,
        } });
        const result = await getGastosPendientesAction({
          fechaDesde: '2026-01-01', fechaHasta: '2026-01-31', soloNoReconciliados: true,
        }) as unknown as { gastos: Array<{ tipo: string }>; pagination: { total: number } };
        expect(result.pagination.total).toBe(2);
        expect(result.gastos.map((gasto) => gasto.tipo).sort()).toEqual(['compra', 'gastoDE']);
        throw rollback;
      })).rejects.toBe(rollback);
    } finally {
      context.tx = null;
      await client.$disconnect();
    }
  });
});
