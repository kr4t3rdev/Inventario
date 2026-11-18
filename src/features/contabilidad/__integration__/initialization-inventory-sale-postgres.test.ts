/**
 * @description Venta posterior que consume inventario inicial y devolución que
 * lo restaura (tarea 3, tramo 2 — PostgreSQL aislado).
 *
 * Los primeros tests crean la venta a mano (como en devolucion-fifo.test.ts)
 * y la asignación FIFO se ejecuta con el allocator real `allocateFifoForSale`
 * (la misma función que llama `VentaMutationService.create`; el cableado está
 * cubierto por `venta-create-orquestacion.test.ts`). La devolución usa el
 * servicio real `DevolucionVentaService.registrar`.
 *
 * El último test cierra la brecha: crea la venta con el servicio real
 * `VentaMutationService.create` (descuento de stock del PV, asignación FIFO y
 * posteo formal del costo) y la devuelve con el servicio real. El traslado
 * almacén -> PV se siembra a mano porque ese flujo no es parte de la tarea 3.
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
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';
import { withTestTenant } from '@/lib/db/tenant-context';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
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

function inventoryRequest(tenantId: string, productoId: string, almacenId: string, costoUnitario = '25', cantidad = '4') {
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
      cantidad,
      costoUnitario,
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

/**
 * Venta real con el servicio de mutación: traslado almacén -> PV sembrado
 * (ese flujo no es parte de la tarea 3), turno abierto y cobro en efectivo
 * contra la cuenta creada por la init. Devuelve la venta y su contexto.
 */
async function makeRealSale(
  tenantId: string,
  user: { userId: string },
  producto: { id: string },
  almacen: { almacenId: string },
  pv: { pvId: string },
  cantidad: number,
) {
  await prisma.$transaction((tx) => Promise.all([
    upsertStockUbicacion(tx, {
      tenantId, productoId: producto.id, tipoUbicacion: 'almacen',
      ubicacionId: almacen.almacenId, modo: 'increment', delta: -cantidad,
    }),
    upsertStockUbicacion(tx, {
      tenantId, productoId: producto.id, tipoUbicacion: 'punto_venta',
      ubicacionId: pv.pvId, modo: 'increment', delta: cantidad,
    }),
  ]));
  const banco = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId } });
  await prisma.tipoPago.create({
    data: { tenantId, nombre: 'Efectivo PV', requiereCuenta: true, cuentaDefecto: banco.cuentaId },
  });
  const turno = await prisma.turnoPuntoVenta.create({
    data: {
      tenantId, puntoDeVentaId: pv.pvId, fondoInicialCup: 0, fondoInicialUsd: 0,
      estado: 'ABIERTO', tipo: 'NORMAL',
    },
  });
  const userCtx = {
    userId: user.userId, role: 'admin', tenantId, isActive: true,
    planFeatures: {
      'ventas-pos': true, 'ventas-factura': true, facturacion: true,
      'cuentas-cobrar': true, 'turnos-pos': true,
    },
  } as unknown as AuthenticatedUser;
  const venta = await withTestTenant(tenantId, () =>
    VentaMutationService.create({
      input: {
        puntoDeVentaId: pv.pvId,
        turnoId: turno.id,
        metodoPago: 'EFECTIVO',
        montoEfectivo: cantidad * 500,
        montoRecibidoEfectivo: cantidad * 500,
        cuentaBancariaId: banco.cuentaId,
        items: [{ productoId: producto.id, cantidad, precioUnitario: 500 }],
      } as never,
      user: userCtx,
    }),
  ) as { ventaId: string };
  const ventaCreada = await prisma.venta.findUniqueOrThrow({ where: { ventaId: venta.ventaId }, include: { items: true } });
  return { venta, ventaCreada, userCtx };
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
      await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
      await prisma.venta.deleteMany({ where: { tenantId } });
      await prisma.inventarioInicialFuente.deleteMany({ where: { tenantId } });
      await prisma.lote.deleteMany({ where: { tenantId } });
      await prisma.stockUbicacion.deleteMany({ where: { tenantId } });
      await prisma.producto.deleteMany({ where: { tenantId } });
      await prisma.ubicacion.deleteMany({ where: { tenantId } });
      await prisma.almacen.deleteMany({ where: { tenantId } });
      await prisma.categoria.deleteMany({ where: { tenantId } });
      await prisma.turnoPuntoVenta.deleteMany({ where: { tenantId } });
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
      fifoMonedaOrigen: 'CUP',
      fifoMonedaFuncional: 'CUP',
    });
    expect(Number(alloc1[0].costoUnitarioSnapshot)).toBe(25);
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
    expect(Number(item.costoUnitarioDevolucion)).toBe(25);
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

  it('una venta consume una fuente inicial de costo decimal sin perder los centavos', async () => {
    const { tenantId, user } = await makeTenant();
    const { almacen, producto, pv, cliente } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId, '25.50');

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });
    const fuente = await prisma.inventarioInicialFuente.findFirstOrThrow({ where: { tenantId } });
    expect(Number(fuente.costoUnitario)).toBe(25.5);

    const sale = await makeSale(tenantId, user.userId, pv.pvId, cliente.clienteId, producto.id, 2);
    await prisma.$transaction((tx) => allocateFifoForSale(tx, tenantId, sale.venta.ventaId));
    const alloc = await prisma.purchaseAllocation.findMany({ where: { tenantId, ventaItemId: sale.venta.items[0].id } });
    expect(alloc).toHaveLength(1);
    expect(alloc[0].inventarioInicialFuenteId).toBe(fuente.id);
    expect(Number(alloc[0].costoUnitarioSnapshot)).toBe(25.5);
    expect(Number(alloc[0].fifoCostoFuncional)).toBe(51);
  });

  it('la devolución de una fuente decimal conserva los centavos en el costo auditado', async () => {
    const { tenantId, user } = await makeTenant();
    const { almacen, producto, pv, cliente } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId, '25.50');

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });

    const sale = await makeSale(tenantId, user.userId, pv.pvId, cliente.clienteId, producto.id, 2);
    await prisma.$transaction((tx) => allocateFifoForSale(tx, tenantId, sale.venta.ventaId));

    const userCtx = {
      userId: user.userId, role: 'admin', tenantId, isActive: true,
    } as unknown as AuthenticatedUser;
    const result = await DevolucionVentaService.registrar({
      input: {
        ventaId: sale.venta.ventaId,
        items: [{ ventaItemId: sale.venta.items[0].id, cantidad: 1 }],
        motivo: 'Devolución decimal',
        preferenciaFinanciera: 'SALDO_FAVOR',
        idempotencyKey: randomUUID(),
      },
      user: userCtx,
    });
    expect(result.devolucionId).toBeTruthy();
    const item = await prisma.devolucionVentaItem.findFirstOrThrow({ where: { devolucionId: result.devolucionId } });
    // 25.50, no 26: el redondeo a entero falseaba el costo auditado.
    expect(Number(item.costoUnitarioDevolucion)).toBe(25.5);
  });

  it('una fila de costo cero en moneda extranjera sin tasa no exige FX', async () => {
    const { tenantId } = await makeTenant();
    const { almacen, producto } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId);
    request.inventario.push({
      referenciaFila: 'fila-inventario-2',
      productoId: producto.id,
      almacenId: almacen.almacenId,
      loteCodigo: 'LOTE-INICIAL-2',
      cantidad: '2',
      costoUnitario: '0',
      moneda: 'USD',
    });

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });
    const fuentes = await prisma.inventarioInicialFuente.findMany({ where: { tenantId } });
    expect(fuentes).toHaveLength(2);
    expect(Number(fuentes.find((f) => f.moneda === 'USD')?.montoFuncional)).toBe(0);
    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
  });

  it('una fuente USD de costo cero sin tasa se vende y se devuelve con snapshot verificable', async () => {
    const { tenantId, user } = await makeTenant();
    const { almacen, producto, pv, cliente } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId, '0');
    request.inventario[0].moneda = 'USD';

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });
    const fuente = await prisma.inventarioInicialFuente.findFirstOrThrow({ where: { tenantId } });
    expect(fuente.moneda).toBe('USD');
    expect(Number(fuente.montoFuncional)).toBe(0);

    const sale = await makeSale(tenantId, user.userId, pv.pvId, cliente.clienteId, producto.id, 1);
    await prisma.$transaction((tx) => allocateFifoForSale(tx, tenantId, sale.venta.ventaId));
    const alloc = await prisma.purchaseAllocation.findMany({ where: { tenantId, ventaItemId: sale.venta.items[0].id } });
    expect(alloc).toHaveLength(1);
    expect(alloc[0].inventarioInicialFuenteId).toBe(fuente.id);
    // Sin tasa no hay conversión que verificar, pero el snapshot existe:
    // 0 en cualquier tasa es 0, y la valoración y la devolución lo exigen.
    expect(alloc[0].fifoEvidenciaFx).toBeTruthy();
    expect(Number(alloc[0].fifoCostoFuncional)).toBe(0);

    const valor = await prisma.$transaction((tx) =>
      getCostoFifoVentaValorado(tx, tenantId, sale.venta.ventaId),
    );
    expect(valor?.montoFuncional).toBe(0);
    expect(valor?.fuentesSinTasa).toEqual([]);

    const userCtx = {
      userId: user.userId, role: 'admin', tenantId, isActive: true,
    } as unknown as AuthenticatedUser;
    const result = await DevolucionVentaService.registrar({
      input: {
        ventaId: sale.venta.ventaId,
        items: [{ ventaItemId: sale.venta.items[0].id, cantidad: 1 }],
        motivo: 'Devolución de fuente USD en cero',
        preferenciaFinanciera: 'SALDO_FAVOR',
        idempotencyKey: randomUUID(),
      },
      user: userCtx,
    });
    expect(result.devolucionId).toBeTruthy();
    const devolucion = await prisma.devolucionVenta.findUniqueOrThrow({ where: { devolucionId: result.devolucionId } });
    expect(Number(devolucion.costoFifoFuncional)).toBe(0);
  });

  it('una inicialización con todo el inventario en costo cero se confirma', async () => {
    const { tenantId } = await makeTenant();
    const { almacen, producto } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId, '0');

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });
    expect(first.data?.resultado?.inventario).toMatchObject({ count: 1, totalFuncional: '0.0000' });
    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
  });

  it('una fuente de costo cero se vende y se devuelve con su costo cero', async () => {
    const { tenantId, user } = await makeTenant();
    const { almacen, producto, pv, cliente } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId, '0');

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });

    const sale = await makeSale(tenantId, user.userId, pv.pvId, cliente.clienteId, producto.id, 2);
    await prisma.$transaction((tx) => allocateFifoForSale(tx, tenantId, sale.venta.ventaId));
    const alloc = await prisma.purchaseAllocation.findMany({ where: { tenantId, ventaItemId: sale.venta.items[0].id } });
    expect(alloc).toHaveLength(1);
    expect(Number(alloc[0].costoUnitarioSnapshot)).toBe(0);
    expect(alloc[0].fifoEvidenciaFx).toBeTruthy();
    expect(Number(alloc[0].fifoCostoFuncional)).toBe(0);

    const valor = await prisma.$transaction((tx) =>
      getCostoFifoVentaValorado(tx, tenantId, sale.venta.ventaId),
    );
    expect(valor?.montoFuncional).toBe(0);
    expect(valor?.fuentesSinTasa).toEqual([]);

    const userCtx = {
      userId: user.userId, role: 'admin', tenantId, isActive: true,
    } as unknown as AuthenticatedUser;
    const result = await DevolucionVentaService.registrar({
      input: {
        ventaId: sale.venta.ventaId,
        items: [{ ventaItemId: sale.venta.items[0].id, cantidad: 1 }],
        motivo: 'Devolución de costo cero',
        preferenciaFinanciera: 'SALDO_FAVOR',
        idempotencyKey: randomUUID(),
      },
      user: userCtx,
    });
    expect(result.devolucionId).toBeTruthy();
    const devolucion = await prisma.devolucionVenta.findUniqueOrThrow({ where: { devolucionId: result.devolucionId } });
    expect(Number(devolucion.costoFifoFuncional)).toBe(0);
  });

  it('una cantidad con ceros iniciales se normaliza y la fuente se vende con snapshot válido', async () => {
    const { tenantId, user } = await makeTenant();
    const { almacen, producto, pv, cliente } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId, '25', '04');

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });
    const fuente = await prisma.inventarioInicialFuente.findFirstOrThrow({ where: { tenantId } });
    expect((fuente.evidencia as Record<string, unknown>).cantidad).toBe('4');

    const sale = await makeSale(tenantId, user.userId, pv.pvId, cliente.clienteId, producto.id, 1);
    await prisma.$transaction((tx) => allocateFifoForSale(tx, tenantId, sale.venta.ventaId));
    const alloc = await prisma.purchaseAllocation.findFirstOrThrow({ where: { tenantId, ventaItemId: sale.venta.items[0].id } });
    expect(alloc.inventarioInicialFuenteId).toBe(fuente.id);
    expect(alloc.fifoEvidenciaFx).not.toBeNull();
    const valorado = await prisma.$transaction((tx) =>
      getCostoFifoVentaValorado(tx, tenantId, sale.venta.ventaId),
    );
    expect(valorado?.montoFuncional).toBe(25);
    expect(valorado?.fuentesSinTasa).toEqual([]);
  });

  it('el recorrido real: la venta del servicio de mutación descuenta stock, asigna FIFO y se devuelve', async () => {
    const { tenantId, user } = await makeTenant();
    const { almacen, producto, pv } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId);

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });

    // Traslado almacén -> PV (el flujo de traslado no es parte de la tarea 3;
    // se siembra el movimiento que haría): 2 de las 4 unidades.
    await prisma.$transaction((tx) => Promise.all([
      upsertStockUbicacion(tx, {
        tenantId, productoId: producto.id, tipoUbicacion: 'almacen',
        ubicacionId: almacen.almacenId, modo: 'increment', delta: -2,
      }),
      upsertStockUbicacion(tx, {
        tenantId, productoId: producto.id, tipoUbicacion: 'punto_venta',
        ubicacionId: pv.pvId, modo: 'increment', delta: 2,
      }),
    ]));
    const stockAlmacen = await prisma.stockUbicacion.findUniqueOrThrow({
      where: { productoId_tipoUbicacion_ubicacionId: { productoId: producto.id, tipoUbicacion: 'almacen', ubicacionId: almacen.almacenId } },
    });
    expect(stockAlmacen.cantidadDisponible).toBe(2);

    // Turno abierto y cobro en efectivo contra la cuenta creada por la init
    // (patrón de venta-formal-rollback-postgres.test.ts).
    const banco = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId } });
    await prisma.tipoPago.create({
      data: { tenantId, nombre: 'Efectivo PV', requiereCuenta: true, cuentaDefecto: banco.cuentaId },
    });
    const turno = await prisma.turnoPuntoVenta.create({
      data: {
        tenantId, puntoDeVentaId: pv.pvId, fondoInicialCup: 0, fondoInicialUsd: 0,
        estado: 'ABIERTO', tipo: 'NORMAL',
      },
    });
    const userCtx = {
      userId: user.userId, role: 'admin', tenantId, isActive: true,
      planFeatures: {
        'ventas-pos': true, 'ventas-factura': true, facturacion: true,
        'cuentas-cobrar': true, 'turnos-pos': true,
      },
    } as unknown as AuthenticatedUser;

    const venta = await withTestTenant(tenantId, () =>
      VentaMutationService.create({
        input: {
          puntoDeVentaId: pv.pvId,
          turnoId: turno.id,
          metodoPago: 'EFECTIVO',
          montoEfectivo: 1000,
          montoRecibidoEfectivo: 1000,
          cuentaBancariaId: banco.cuentaId,
          items: [{ productoId: producto.id, cantidad: 2, precioUnitario: 500 }],
        } as never,
        user: userCtx,
      }),
    ) as { ventaId: string };
    expect(venta.ventaId).toBeTruthy();

    const ventaCreada = await prisma.venta.findUniqueOrThrow({ where: { ventaId: venta.ventaId }, include: { items: true } });
    expect(ventaCreada.estado).toBe('ENTREGADA');
    expect(ventaCreada.items).toHaveLength(1);
    const stockPv = await prisma.stockUbicacion.findUniqueOrThrow({
      where: { productoId_tipoUbicacion_ubicacionId: { productoId: producto.id, tipoUbicacion: 'punto_venta', ubicacionId: pv.pvId } },
    });
    expect(stockPv.cantidadDisponible).toBe(0);
    const alloc = await prisma.purchaseAllocation.findMany({ where: { tenantId, ventaItemId: ventaCreada.items[0].id } });
    expect(alloc).toHaveLength(1);
    expect(Number(alloc[0].costoUnitarioSnapshot)).toBe(25);
    expect(Number(alloc[0].fifoCostoFuncional)).toBe(50);
    const asientoCosto = await prisma.asiento.findFirst({
      where: { tenantId, origenId: venta.ventaId, estado: 'CONTABILIZADO' },
    });
    expect(asientoCosto).not.toBeNull();

    // Devolución real de 1 unidad: restaura la asignación y el stock del PV.
    // Sin cliente no hay saldo a favor: el excedente sale como reembolso.
    const result = await DevolucionVentaService.registrar({
      input: {
        ventaId: venta.ventaId,
        items: [{ ventaItemId: ventaCreada.items[0].id, cantidad: 1 }],
        motivo: 'Devolución del recorrido real',
        preferenciaFinanciera: 'REEMBOLSO_EFECTIVO',
        idempotencyKey: randomUUID(),
      },
      user: userCtx,
    });
    expect(result.devolucionId).toBeTruthy();
    const allocAfter = await prisma.purchaseAllocation.findMany({ where: { tenantId, ventaItemId: ventaCreada.items[0].id } });
    expect(allocAfter).toHaveLength(1);
    expect(allocAfter[0].cantidad).toBe(1);
    const stockPvAfter = await prisma.stockUbicacion.findUniqueOrThrow({
      where: { productoId_tipoUbicacion_ubicacionId: { productoId: producto.id, tipoUbicacion: 'punto_venta', ubicacionId: pv.pvId } },
    });
    expect(stockPvAfter.cantidadDisponible).toBe(1);
    const devolucion = await prisma.devolucionVenta.findUniqueOrThrow({ where: { devolucionId: result.devolucionId } });
    expect(Number(devolucion.costoFifoFuncional)).toBe(25);

    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
  });

  it('el recorrido real de una fuente de costo cero no revierte en enforce ni postea costo', async () => {
    const { tenantId, user } = await makeTenant();
    const { almacen, producto, pv } = await makeInventorySetup(tenantId);
    const request = inventoryRequest(tenantId, producto.id, almacen.almacenId, '0');

    const first = await initialize(request);
    expect(first).toMatchObject({ success: true, data: { replayed: false } });

    // Una venta sin costo no tiene nada que devengar: el motor formal
    // rechaza montos cero, así que la mutación no debe intentar postearlo.
    const { venta, ventaCreada, userCtx } = await makeRealSale(tenantId, user, producto, almacen, pv, 2);
    expect(ventaCreada.estado).toBe('ENTREGADA');
    const stockPv = await prisma.stockUbicacion.findUniqueOrThrow({
      where: { productoId_tipoUbicacion_ubicacionId: { productoId: producto.id, tipoUbicacion: 'punto_venta', ubicacionId: pv.pvId } },
    });
    expect(stockPv.cantidadDisponible).toBe(0);
    const alloc = await prisma.purchaseAllocation.findMany({ where: { tenantId, ventaItemId: ventaCreada.items[0].id } });
    expect(alloc).toHaveLength(1);
    expect(Number(alloc[0].costoUnitarioSnapshot)).toBe(0);
    expect(alloc[0].fifoEvidenciaFx).toBeTruthy();
    const asientoCosto = await prisma.asiento.findFirst({
      where: { tenantId, origenTipo: 'venta_costo', origenId: venta.ventaId, estado: 'CONTABILIZADO' },
    });
    expect(asientoCosto).toBeNull();

    const result = await DevolucionVentaService.registrar({
      input: {
        ventaId: venta.ventaId,
        items: [{ ventaItemId: ventaCreada.items[0].id, cantidad: 1 }],
        motivo: 'Devolución de venta en cero',
        preferenciaFinanciera: 'REEMBOLSO_EFECTIVO',
        idempotencyKey: randomUUID(),
      },
      user: userCtx,
    });
    expect(result.devolucionId).toBeTruthy();
    const devolucion = await prisma.devolucionVenta.findUniqueOrThrow({ where: { devolucionId: result.devolucionId } });
    expect(Number(devolucion.costoFifoFuncional)).toBe(0);

    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
  });
});
