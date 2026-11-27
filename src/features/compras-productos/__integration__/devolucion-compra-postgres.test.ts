import { randomUUID } from 'node:crypto';
import { afterAll, expect, it, vi } from 'vitest';

import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { expectActionSuccess } from '@/test/action-response';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';
import { completarDevolucionCompraAction, crearDevolucionCompraAction } from '../devoluciones';

const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: async () => auth.user }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

assertDisposableDatabase(process.env);

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

it('registra y contabiliza una devolución parcial de una compra pagada', async () => {
  const [identity] = await prisma.$queryRaw<Array<{
    databaseName: string;
    roleName: string;
    serverPort: number;
  }>>`
    SELECT current_database() AS "databaseName",
      current_user AS "roleName", inet_server_port() AS "serverPort"
  `;
  assertDisposableDatabaseIdentity(identity, process.env);

  const suffix = randomUUID();
  const { tenantId } = await prisma.tenant.create({
    data: { nombre: `Devolución QA ${suffix}`, slug: `devolucion-qa-${suffix}` },
  });
  const { userId } = await prisma.user.create({
    data: { name: 'QA', email: `devolucion-${suffix}@test.local`, password: 'x' },
  });
  const { vendorId } = await prisma.vendor.create({ data: { tenantId, nombre: 'Proveedor QA' } });
  const { catId } = await prisma.categoria.create({ data: { tenantId, nombre: 'Categoría QA' } });
  const { almacenId } = await prisma.almacen.create({ data: { tenantId, nombre: 'Almacén QA' } });
  const { id: productoId } = await prisma.producto.create({
    data: {
      nombre: 'Producto QA', precioCosto: 10, precioVenta: 20, stock: 10,
      tenant: { connect: { tenantId } },
      categoria: { connect: { catId } },
      almacen: { connect: { almacenId } },
    },
  });
  const { id: stockId } = await prisma.stockUbicacion.create({
    data: {
      tenantId, productoId, tipoUbicacion: 'almacen', ubicacionId: almacenId,
      cantidad: 10, cantidadDisponible: 10,
    },
  });
  const { gastoCompraId } = await prisma.gastoCompra.create({
    data: { tenantId, productoId, vendorId, cantidad: 10, precioUnitario: 10, total: 100 },
  });
  const { cuentaPorPagarId } = await prisma.cuentaPorPagar.create({
    data: {
      tenantId, gastoCompraId, proveedorId: vendorId, tipo: 'compra', estado: 'PAGADA',
      numeroFactura: 'QA-F-001',
      montoDeuda: 100, montoPagado: 100, saldoPendiente: 0, moneda: 'CUP',
    },
  });
  const { compraDocumentoId } = await prisma.compraDocumento.create({
    data: {
      tenantId, gastoCompraId, proveedorId: vendorId, cuentaPorPagarId, numeroFactura: 'QA-F-001',
      formaPago: 'PARCIAL', estado: 'PAGADA', total: 100, moneda: 'CUP',
    },
  });
  const { compraDocumentoItemId } = await prisma.compraDocumentoItem.create({
    data: { tenantId, compraDocumentoId, productoId, cantidad: 10, precioUnitario: 10, totalLinea: 100 },
  });
  const now = new Date();
  await prisma.periodoContable.create({
    data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
    },
  });
  await prisma.moneda.upsert({
    where: { codigo: 'CUP' }, create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
    update: {},
  });
  await prisma.tenantAccountingPolicy.create({
    data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
  });
  await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
  await seedPlantillasGlobales(prisma);
  await prisma.tenantLicense.create({
    data: {
      tenantId, activa: true, expiracion: new Date(Date.now() + 86_400_000),
      features: { 'contabilidad-formal': true },
    },
  });

  auth.user = {
    userId, name: 'QA', email: `devolucion-${suffix}@test.local`, isActive: true,
    tenantId, role: 'regularUser', tenantRole: 'manager', planFeatures: { contabilidad: true },
  } as AuthenticatedUser;
  vi.stubEnv('CONTABILIDAD_FORMAL_MODE', 'enforce');

  const pending = expectActionSuccess(await crearDevolucionCompraAction({
    compraDocumentoId, formaImputacion: 'SALDO_FAVOR',
    items: [{ compraDocumentoItemId, cantidad: 1 }],
  })).data;
  expect(pending).toMatchObject({ estado: 'PENDIENTE', montoTotal: 10, moneda: 'CUP' });
  expect(await prisma.devolucionCompraItem.findMany({
    where: { tenantId, devolucionId: pending.devolucionId },
  })).toMatchObject([{ tenantId, compraDocumentoItemId, productoId, cantidad: 1 }]);
  expect(await prisma.stockUbicacion.findUniqueOrThrow({ where: { id: stockId } }))
    .toMatchObject({ cantidad: 10 });
  const movementFilter = {
    tenantId, tipoOrigen: 'DEVOLUCION_COMPRA' as const, origenId: pending.devolucionId,
  };
  const entryFilter = { tenantId, origenTipo: 'devolucion_compra', origenId: pending.devolucionId };
  expect(await prisma.stockMoveLine.count({ where: movementFilter })).toBe(0);
  expect(await prisma.asiento.count({ where: entryFilter })).toBe(0);

  const completed = expectActionSuccess(
    await completarDevolucionCompraAction(pending.devolucionId),
  ).data;
  expect(completed).toMatchObject({ estado: 'COMPLETADA', montoImputado: 0, saldoAFavor: 10 });
  expect(await prisma.stockUbicacion.findUniqueOrThrow({ where: { id: stockId } }))
    .toMatchObject({ cantidad: 9 });
  expect(await prisma.stockMoveLine.findMany({ where: movementFilter }))
    .toMatchObject([{ cantidad: -1, costoUnitario: 10 }]);
  const payable = await prisma.cuentaPorPagar.findUniqueOrThrow({ where: { cuentaPorPagarId } });
  expect(payable.estado).toBe('PAGADA');
  expect(payable.saldoPendiente.toNumber()).toBe(0);

  const entries = await prisma.asiento.findMany({
    where: entryFilter,
    include: { lineas: { include: { cuenta: { select: { codigo: true } } } } },
  });
  expect(entries).toHaveLength(1);
  expect(entries[0].lineas).toHaveLength(2);
  expect(entries[0].lineas.map((line) => [
    line.cuenta.codigo, line.debe.toNumber(), line.haber.toNumber(),
  ])).toEqual(expect.arrayContaining([['1.2.03', 10, 0], ['1.3.01', 0, 10]]));
});
