/**
 * @description Venta posterior que consume inventario inicial y devolución que
 * lo restaura (tarea 3, tramo 2 — PostgreSQL aislado).
 *
 * La venta se crea a mano (como en devolucion-fifo.test.ts) y la asignación
 * FIFO se ejecuta con el allocator real `allocateFifoForSale` (la misma
 * función que llama `VentaMutationService.create`; el cableado está cubierto
 * por `venta-create-orquestacion.test.ts`). La devolución usa el servicio
 * real `DevolucionVentaService.registrar`.
 *
 * La venta es FACTURADA con factura + CxC (patrón del test DNC) para que la
 * cascada financiera de la devolución tenga qué aplicar; el stock de la
 * venta no se mueve a mano porque el allocator no lee StockUbicacion.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { allocateFifoForSale, getCostoFifoVentaValorado } from '@/lib/services/fifo-allocation';
import { DevolucionVentaService } from '@/features/ventas/services/devolucion-venta-service';
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
const tenants: string[] = [];
let initialize: typeof import('@/features/contabilidad/actions-cuentas-bancarias').initializeBankAccountsAction;
let cupCreated = false;
let usdCreated = false;

async function makeTenant() {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const user = {
    userId, name: 'QA venta inventario', email: `qa-venta-${tenantId.slice(0, 8)}@example.test`,
    role: 'admin' as const, isActive: true, tenantId, tenantRole: 'manager' as const,
  };
  auth.user = user as unknown as AuthenticatedUser;
  await prisma.tenant.create({ data: { tenantId, nombre: 'QA venta inventario', slug: randomUUID() } });
  await prisma.user.create({ data: { userId, name: user.name, email: user.email, password: 'integration-only-placeholder' } });
  await prisma.tenantAccountingPolicy.create({ data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId } });
  await prisma.$transaction((tx) => seedPlanContable(tx as never, tenantId));
  await seedPlantillasGlobales(prisma as never);
  await prisma.tenantLicense.create({
    data: { tenantId, activa: true, expiracion: new Date(Date.now() + 86_400_000), features: { 'contabilidad-formal': true } },
  });
  await prisma.tipoPago.create({ data: { tenantId, nombre: 'Efectivo QA', requiereCuenta: false } });
  tenants.push(tenantId);
  return { tenantId, user };
}

async function makeInventorySetup(tenantId: string) {
  const categoria = await prisma.categoria.create({
    data: { tenantId, nombre: `Categoría venta ${tenantId.slice(0, 8)}` },
  });
  const almacen = await prisma.almacen.create({
    data: { tenantId, nombre: `Almacén venta ${tenantId.slice(0, 8)}` },
  });
  const producto = await prisma.producto.create({
    data: {
      tenantId,
      nombre: `Producto venta ${tenantId.slice(0, 8)}`,
      precioCosto: 25,
      precioVenta: 500,
      stock: 0,
      categoriaId: categoria.catId,
      almacenId: almacen.almacenId,
    },
  });
  const pv = await prisma.puntoDeVenta.create({
    data: { tenantId, nombre: `PV venta ${tenantId.slice(0, 8)}`, tipoCaja: 'SECUNDARIA' },
  });
  const cliente = await prisma.cliente.create({
    data: { tenantId, nombre: `Cliente venta ${tenantId.slice(0, 8)}` },
  });
  return { categoria, almacen, producto, pv, cliente };
}

function inventoryRequest(tenantId: string, productoId: string, almacenId: string) {
  return {
    idempotencyKey: `inventory-sale-${tenantId.slice(0, 8)}`,
    fechaCorte: '2026-11-01',
    monedaFuncional: 'CUP',
    cuentas: [{
      nombreCuenta: 'Cuenta sin saldo',
      nombreBanco: 'Banco QA',
      numeroCuenta: `VTA-${tenantId.slice(0, 8)}`,
      tipoCuenta: 'CORRIENTE',
      moneda: 'CUP',
      saldoInicial: '0',
    }],
    inventario: [{
      referenciaFila: 'fila-inventario-1',
      productoId,
      almacenId,
      loteCodigo: 'LOTE-INICIAL-1',
      cantidad: '4',
      costoUnitario: '25',
      moneda: 'CUP',
    }],
  };
}

/**
 * @description Crea venta FACTURADA manual (2 unidades a 500) con factura y
 * CxC, siguiendo el patrón del test DNC. No crea allocations: las genera
 * el allocator real en el test.
 */
async function makeSale(tenantId: string, userId: string, pvId: string, clienteId: string, productoId: string, cantidad: number) {
  const total = cantidad * 500;
  const venta = await prisma.venta.create({
    data: {
      tenantId,
      cantidad,
      puntoDeVentaId: pvId,
      clienteId,
      total,
      estado: 'FACTURADA',
      metodoPago: 'CREDITO',
      esVentaUnica: true,
      items: { create: [{ productoId, cantidad, precioUnitario: 500, total }] },
    },
    include: { items: true },
  });
  const serie = await prisma.serieFacturacion.upsert({
    where: { tenantId_prefijo: { tenantId, prefijo: 'FV' } },
    create: { tenantId, prefijo: 'FV', descripcion: 'Ventas', consecutivo: 1, esPorDefecto: true },
    update: {},
  });
  const numeroConsecutivo = serie.consecutivo;
  await prisma.serieFacturacion.update({
    where: { serieId: serie.serieId },
    data: { consecutivo: { increment: 1 } },
  });
  const factura = await prisma.factura.create({
    data: {
      tenantId,
      serieId: serie.serieId,
      numeroConsecutivo,
      numeroFactura: `FV-${String(numeroConsecutivo).padStart(6, '0')}`,
      clienteId,
      ventaId: venta.ventaId,
      subtotal: total,
      total,
      tasaCambio: 1,
      estado: 'PENDIENTE',
      creadoPor: userId,
    },
  });
  const cxc = await prisma.cuentaPorCobrar.create({
    data: { tenantId, clienteId, facturaId: factura.idFactura, montoDeuda: total, montoPagado: 0, estado: 'PENDIENTE' },
  });
  return { venta, factura, cxc };
}

describe('venta posterior y devolución sobre inventario inicial — PostgreSQL', { timeout: 120_000 }, () => {
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
    for (const tenantId of tenants) {
      await prisma.purchaseAllocation.deleteMany({ where: { tenantId } });
      await prisma.devolucionVentaItem.deleteMany({ where: { devolucion: { tenantId } } });
      await prisma.devolucionVenta.deleteMany({ where: { tenantId } });
      // StockMoveLine es apendicular: el trigger stock_move_line_no_delete
      // prohíbe DELETE; la limpieza lo deshabilita y lo reactiva (patrón
      // de cierre-formal-rollback-postgres.test.ts).
      await prisma.$executeRawUnsafe('ALTER TABLE "StockMoveLine" DISABLE TRIGGER "stock_move_line_no_delete"');
      try {
        await prisma.stockMoveLine.deleteMany({ where: { tenantId } });
      } finally {
        await prisma.$executeRawUnsafe('ALTER TABLE "StockMoveLine" ENABLE TRIGGER "stock_move_line_no_delete"');
      }
      await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
      await prisma.factura.deleteMany({ where: { tenantId } });
      await prisma.serieFacturacion.deleteMany({ where: { tenantId } });
      await prisma.ventaItem.deleteMany({ where: { venta: { tenantId } } });
      await prisma.venta.deleteMany({ where: { tenantId } });
      await prisma.inventarioInicialFuente.deleteMany({ where: { tenantId } });
      await prisma.lote.deleteMany({ where: { tenantId } });
      await prisma.stockUbicacion.deleteMany({ where: { tenantId } });
      await prisma.producto.deleteMany({ where: { tenantId } });
      await prisma.ubicacion.deleteMany({ where: { tenantId } });
      await prisma.almacen.deleteMany({ where: { tenantId } });
      await prisma.categoria.deleteMany({ where: { tenantId } });
      await prisma.puntoDeVenta.deleteMany({ where: { tenantId } });
      await prisma.cliente.deleteMany({ where: { tenantId } });
      await prisma.inicializacionContable.deleteMany({ where: { tenantId } });
      await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
      const anticipos = await prisma.anticipo.findMany({ where: { tenantId }, select: { anticipoId: true } });
      await prisma.anticipoMovimiento.deleteMany({ where: { anticipoId: { in: anticipos.map((a) => a.anticipoId) } } });
      await prisma.anticipo.deleteMany({ where: { tenantId } });
      await prisma.inyeccionCapital.deleteMany({ where: { tenantId } });
      await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
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
      await prisma.tenant.deleteMany({ where: { tenantId } });
    }
    if (cupCreated) await prisma.moneda.deleteMany({ where: { codigo: 'CUP' } });
    if (usdCreated) await prisma.moneda.deleteMany({ where: { codigo: 'USD' } });
    await prisma.$disconnect();
  });

  it('una venta posterior consume la fuente inicial con su costo y no pasa de lo inicializado', async () => {
    const { tenantId, user } = await makeTenant();
    const { almacen, producto, pv, cliente } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId);

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });

    const fuente = await prisma.inventarioInicialFuente.findFirstOrThrow({ where: { tenantId } });
    const stock = await prisma.stockUbicacion.findFirstOrThrow({
      where: { tenantId, productoId: producto.id, ubicacionId: almacen.almacenId },
    });
    expect(stock.cantidadDisponible).toBe(4);

    // Venta 1: 2 de 4 unidades.
    const sale1 = await makeSale(tenantId, user.userId, pv.pvId, cliente.clienteId, producto.id, 2);
    await prisma.$transaction((tx) => allocateFifoForSale(tx, tenantId, sale1.venta.ventaId));
    const alloc1 = await prisma.purchaseAllocation.findMany({ where: { tenantId, ventaItemId: sale1.venta.items[0].id } });
    expect(alloc1).toHaveLength(1);
    expect(alloc1[0]).toMatchObject({
      inventarioInicialFuenteId: fuente.id,
      loteId: fuente.loteId,
      compraDocumentoItemId: null,
      cantidad: 2,
      costoUnitarioSnapshot: 25,
      fifoMonedaOrigen: 'CUP',
      fifoMonedaFuncional: 'CUP',
    });
    expect(Number(alloc1[0].fifoCostoFuncional)).toBe(50);
    expect(alloc1[0].fifoFechaFuente?.getTime()).toBe(fuente.fechaCorte.getTime());

    // Venta 2: las 2 restantes. Venta 3: ya no queda nada que asignar.
    const sale2 = await makeSale(tenantId, user.userId, pv.pvId, cliente.clienteId, producto.id, 2);
    await prisma.$transaction((tx) => allocateFifoForSale(tx, tenantId, sale2.venta.ventaId));
    const alloc2 = await prisma.purchaseAllocation.findMany({ where: { tenantId, ventaItemId: sale2.venta.items[0].id } });
    expect(alloc2).toHaveLength(1);
    expect(alloc2[0].inventarioInicialFuenteId).toBe(fuente.id);
    expect(alloc2[0].cantidad).toBe(2);

    const sale3 = await makeSale(tenantId, user.userId, pv.pvId, cliente.clienteId, producto.id, 1);
    await prisma.$transaction((tx) => allocateFifoForSale(tx, tenantId, sale3.venta.ventaId));
    const alloc3 = await prisma.purchaseAllocation.findMany({ where: { tenantId, ventaItemId: sale3.venta.items[0].id } });
    expect(alloc3).toHaveLength(0);

    // La venta no invalida el replay: el detalle sigue siendo la evidencia.
    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
  });

  it('una devolución parcial restaura la fuente inicial y la unidad vuelve a venderse', async () => {
    const { tenantId, user } = await makeTenant();
    const { almacen, producto, pv, cliente } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId);

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });
    const fuente = await prisma.inventarioInicialFuente.findFirstOrThrow({ where: { tenantId } });

    const sale = await makeSale(tenantId, user.userId, pv.pvId, cliente.clienteId, producto.id, 2);
    await prisma.$transaction((tx) => allocateFifoForSale(tx, tenantId, sale.venta.ventaId));
    const allocBefore = await prisma.purchaseAllocation.findMany({ where: { tenantId, ventaItemId: sale.venta.items[0].id } });
    expect(allocBefore).toHaveLength(1);
    expect(allocBefore[0].cantidad).toBe(2);

    const userCtx = {
      userId: user.userId, role: 'admin', tenantId, isActive: true,
    } as unknown as AuthenticatedUser;
    const result = await DevolucionVentaService.registrar({
      input: {
        ventaId: sale.venta.ventaId,
        items: [{ ventaItemId: sale.venta.items[0].id, cantidad: 1 }],
        motivo: 'Devolución parcial de prueba',
        preferenciaFinanciera: 'SALDO_FAVOR',
        idempotencyKey: randomUUID(),
      },
      user: userCtx,
    });
    expect(result.devolucionId).toBeTruthy();
    expect(result.notaCreditoId).toBeTruthy();
    expect(result.aplicadoCxc).toBe(500);
    expect(result.saldoFavor).toBe(0);
    expect(result.reembolso).toBe(0);

    // La asignación se reduce 2 -> 1 (la unidad vuelve a la fuente).
    const allocAfter = await prisma.purchaseAllocation.findMany({ where: { tenantId, ventaItemId: sale.venta.items[0].id } });
    expect(allocAfter).toHaveLength(1);
    expect(allocAfter[0].cantidad).toBe(1);
    expect(allocAfter[0].inventarioInicialFuenteId).toBe(fuente.id);

    // El ítem devuelto se valora al costo de la fuente (25) y la NC es por 500.
    const item = await prisma.devolucionVentaItem.findFirstOrThrow({ where: { devolucionId: result.devolucionId } });
    expect(item.costoUnitarioDevolucion).toBe(25);
    const devolucion = await prisma.devolucionVenta.findUniqueOrThrow({ where: { devolucionId: result.devolucionId } });
    expect(Number(devolucion.costoFifoFuncional)).toBe(25);
    const nc = await prisma.factura.findUniqueOrThrow({ where: { idFactura: result.notaCreditoId as string } });
    expect(nc.tipoDocumento).toBe('NOTA_CREDITO');
    expect(nc.numeroFactura).toBe('NC-000001');
    expect(Number(nc.total)).toBe(500);

    // El stock vuelve al punto de venta y la CxC se reduce.
    const stockPv = await prisma.stockUbicacion.findFirstOrThrow({
      where: { tenantId, productoId: producto.id, tipoUbicacion: 'punto_venta', ubicacionId: pv.pvId },
    });
    expect(stockPv.cantidadDisponible).toBe(1);
    const cxcAfter = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: sale.cxc.id } });
    expect(Number(cxcAfter.montoPagado)).toBe(500);
    expect(cxcAfter.estado).toBe('PARCIAL');

    // La unidad restaurada se vende de nuevo desde la misma fuente.
    const sale2 = await makeSale(tenantId, user.userId, pv.pvId, cliente.clienteId, producto.id, 1);
    await prisma.$transaction((tx) => allocateFifoForSale(tx, tenantId, sale2.venta.ventaId));
    const alloc2 = await prisma.purchaseAllocation.findMany({ where: { tenantId, ventaItemId: sale2.venta.items[0].id } });
    expect(alloc2).toHaveLength(1);
    expect(alloc2[0].inventarioInicialFuenteId).toBe(fuente.id);
    expect(alloc2[0].cantidad).toBe(1);

    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
  });

  it('tras una devolución parcial, la asignación restante sigue siendo valorable y devolvible', async () => {
    const { tenantId, user } = await makeTenant();
    const { almacen, producto, pv, cliente } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId);

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });

    const sale = await makeSale(tenantId, user.userId, pv.pvId, cliente.clienteId, producto.id, 2);
    await prisma.$transaction((tx) => allocateFifoForSale(tx, tenantId, sale.venta.ventaId));

    const userCtx = {
      userId: user.userId, role: 'admin', tenantId, isActive: true,
    } as unknown as AuthenticatedUser;
    const result1 = await DevolucionVentaService.registrar({
      input: {
        ventaId: sale.venta.ventaId,
        items: [{ ventaItemId: sale.venta.items[0].id, cantidad: 1 }],
        motivo: 'Primera devolución parcial',
        preferenciaFinanciera: 'SALDO_FAVOR',
        idempotencyKey: randomUUID(),
      },
      user: userCtx,
    });
    expect(result1.devolucionId).toBeTruthy();

    // La unidad restante (1 x 25) sigue valorándose al costo de la fuente.
    const valor = await prisma.$transaction((tx) =>
      getCostoFifoVentaValorado(tx, tenantId, sale.venta.ventaId),
    );
    expect(valor?.montoFuncional).toBe(25);
    expect(valor?.fuentesSinTasa).toEqual([]);

    // Y la segunda devolución de esa misma asignación también funciona.
    const result2 = await DevolucionVentaService.registrar({
      input: {
        ventaId: sale.venta.ventaId,
        items: [{ ventaItemId: sale.venta.items[0].id, cantidad: 1 }],
        motivo: 'Segunda devolución parcial',
        preferenciaFinanciera: 'SALDO_FAVOR',
        idempotencyKey: randomUUID(),
      },
      user: userCtx,
    });
    expect(result2.devolucionId).toBeTruthy();
    const allocAfter = await prisma.purchaseAllocation.findMany({ where: { tenantId, ventaItemId: sale.venta.items[0].id } });
    expect(allocAfter).toHaveLength(0);
    const devolucion2 = await prisma.devolucionVenta.findUniqueOrThrow({ where: { devolucionId: result2.devolucionId } });
    expect(Number(devolucion2.costoFifoFuncional)).toBe(25);
  });
});
