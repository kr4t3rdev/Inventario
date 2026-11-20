/**
 * @description Primeros flujos tras el corte (tarea 7 — PostgreSQL aislado).
 *
 * Encadena sobre UNA inicialización: primera venta en efectivo (consume
 * inventario inicial por FIFO), cobro parcial y final de la CxC inicial,
 * pago de la CxP inicial y primera compra con pago completo (repone stock).
 * Al final el replay reconoce la apertura sin duplicar nada, el recolector
 * reconstruye las liquidaciones sin omisiones y la conciliación pura queda
 * limpia. Un segundo tenant inicializa aparte y no contamina al primero.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { recolectarCandidatos } from '@/features/contabilidad-formal/services/replay-source-collector';
import { reconcileInitialSubledgerSettlements } from '@/features/contabilidad/services/initial-subledger-settlement-reconciliation';
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';
import { withTestTenant } from '@/lib/db/tenant-context';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
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
let createCompra: typeof import('@/features/compras-productos/actions').createCompraProductoAction;
let cupCreated = false;
let usdCreated = false;

async function makeTenant() {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const user = {
    userId, name: 'QA primeros flujos', email: `qa-flows-${tenantId.slice(0, 8)}@example.test`,
    role: 'admin' as const, isActive: true, tenantId, tenantRole: 'manager' as const,
  };
  auth.user = user as unknown as AuthenticatedUser;
  await prisma.tenant.create({ data: { tenantId, nombre: 'QA primeros flujos', slug: randomUUID() } });
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
    data: { tenantId, nombre: `Categoría flujos ${tenantId.slice(0, 8)}` },
  });
  const almacen = await prisma.almacen.create({
    data: { tenantId, nombre: `Almacén flujos ${tenantId.slice(0, 8)}` },
  });
  const producto = await prisma.producto.create({
    data: {
      tenantId,
      nombre: `Producto flujos ${tenantId.slice(0, 8)}`,
      precioCosto: 25,
      precioVenta: 500,
      stock: 0,
      categoriaId: categoria.catId,
      almacenId: almacen.almacenId,
    },
  });
  const pv = await prisma.puntoDeVenta.create({
    data: { tenantId, nombre: `PV flujos ${tenantId.slice(0, 8)}`, tipoCaja: 'SECUNDARIA' },
  });
  return { categoria, almacen, producto, pv };
}

/**
 * @description Venta real en efectivo con el servicio de mutación: traslado
 * almacén -> PV, turno abierto y cobro contra la cuenta creada por la init.
 * (Patrón de initialization-inventory-sale-postgres.test.ts.)
 */
async function makeRealSale(
  tenantId: string,
  user: { userId: string },
  producto: { id: string },
  almacen: { almacenId: string },
  pv: { pvId: string },
  cantidad: number,
  banco: { cuentaId: string },
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

async function stockAlmacen(tenantId: string, productoId: string, almacenId: string) {
  return prisma.stockUbicacion.findUniqueOrThrow({
    where: { productoId_tipoUbicacion_ubicacionId: { productoId, tipoUbicacion: 'almacen', ubicacionId: almacenId } },
  });
}

async function saldoBanco(cuentaId: string) {
  return String((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo);
}

describe('primeros flujos tras el corte — PostgreSQL', { timeout: 180_000 }, () => {
  beforeAll(async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE = 'enforce';
    initialize = (await import('@/features/contabilidad/actions-cuentas-bancarias')).initializeBankAccountsAction;
    ({ settleInitialReceivableAction: settleReceivable, settleInitialPayableAction: settlePayable } =
      await import('@/features/contabilidad/actions-subledger-settlement'));
    createCompra = (await import('@/features/compras-productos/actions')).createCompraProductoAction;
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
      await prisma.purchaseAllocation.deleteMany({ where: { tenantId } });
      await prisma.pagoCuentaPorPagar.deleteMany({ where: { tenantId } });
      await prisma.gastoCompra.deleteMany({ where: { tenantId } });
      await prisma.reconciliacionGasto.deleteMany({ where: { tenantId } });
      // La compra crea un Lote que referencia el item: borrarlo antes.
      await prisma.lote.deleteMany({ where: { tenantId, compraItemId: { not: null } } });
      await prisma.compraDocumentoItem.deleteMany({ where: { compraDocumento: { tenantId } } });
      // La compra deja el documento como última compra del producto del proveedor.
      await prisma.proveedorProducto.updateMany({
        where: { tenantId, ultimaCompraDocumentoId: { not: null } },
        data: { ultimaCompraDocumentoId: null },
      });
      await prisma.compraDocumento.deleteMany({ where: { tenantId } });
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
      await prisma.proveedorProducto.deleteMany({ where: { tenantId } });
      await prisma.producto.deleteMany({ where: { tenantId } });
      await prisma.ubicacion.deleteMany({ where: { tenantId } });
      await prisma.almacen.deleteMany({ where: { tenantId } });
      await prisma.categoria.deleteMany({ where: { tenantId } });
      await prisma.turnoPuntoVenta.deleteMany({ where: { tenantId } });
      await prisma.puntoDeVenta.deleteMany({ where: { tenantId } });
      await prisma.cliente.deleteMany({ where: { tenantId } });
      await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
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

  it('encadena venta, cobro, pago y compra sobre la apertura; replay y conciliación intactos', async () => {
    const { tenantId, user, clientId, vendorId } = await makeTenant();
    const { producto, almacen, pv } = await makeInventorySetup(tenantId);
    const tipoPagoId = tipoPagoByTenant.get(tenantId)!;
    const key = `first-flows-${tenantId.slice(0, 8)}`;
    const request = {
      idempotencyKey: key,
      fechaCorte: '2026-11-01',
      monedaFuncional: 'CUP',
      cuentas: [{
        nombreCuenta: 'Cuenta CUP', nombreBanco: 'Banco QA',
        numeroCuenta: `FF-C-${tenantId.slice(0, 8)}`, tipoCuenta: 'CORRIENTE',
        moneda: 'CUP', saldoInicial: '1000', origenNoDocumentado: true,
      }],
      inventario: [{
        referenciaFila: 'fila-1', productoId: producto.id, almacenId: almacen.almacenId,
        loteCodigo: 'LOTE-INICIAL-1', cantidad: '4', costoUnitario: '25', moneda: 'CUP',
      }],
      cuentasPorCobrar: [{ referenciaFila: 'cxc-1', clienteId: clientId, moneda: 'CUP', saldo: '500' }],
      cuentasPorPagar: [{ referenciaFila: 'cxp-1', proveedorId: vendorId, moneda: 'CUP', saldo: '300' }],
    };

    const first = await initialize(request);
    if (!first.success) throw new Error(JSON.stringify(first));
    expect(first.success).toBe(true);
    const apertura = await prisma.inicializacionContable.findFirstOrThrow({ where: { tenantId } });
    expect(apertura.estado).toBe('COMPLETADA');
    const banco = await prisma.cuentaBancaria.findFirstOrThrow({ where: { tenantId, moneda: 'CUP' } });
    expect(String(banco.saldo)).toBe('1000');
    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } });
    const cxp = await prisma.cuentaPorPagar.findFirstOrThrow({ where: { tenantId } });

    // 1. Primera venta: 2 de 4 unidades en efectivo, desde la fuente inicial.
    const { ventaCreada } = await makeRealSale(tenantId, user, producto, almacen, pv, 2, banco);
    expect(ventaCreada.estado).toBe('ENTREGADA');
    expect(String(ventaCreada.total)).toBe('1000');
    expect(ventaCreada.items).toHaveLength(1);
    expect((await stockAlmacen(tenantId, producto.id, almacen.almacenId)).cantidadDisponible).toBe(2);
    const fuente = await prisma.inventarioInicialFuente.findFirstOrThrow({ where: { tenantId } });
    const alloc = await prisma.purchaseAllocation.findMany({ where: { tenantId, ventaItemId: ventaCreada.items[0].id } });
    expect(alloc).toHaveLength(1);
    expect(alloc[0].inventarioInicialFuenteId).toBe(fuente.id);
    expect(Number(alloc[0].costoUnitarioSnapshot)).toBe(25);
    expect(Number(alloc[0].fifoCostoFuncional)).toBe(50);

    // 2. Cobro de la CxC inicial: parcial 200 y final 300.
    const cobro1 = await settleReceivable({
      cuentaPorCobrarId: cxc.id, cuentaId: banco.cuentaId, tipoPagoId,
      monto: '200', fechaEfectiva: '2026-11-05', referencia: 'cobro-ff-1',
    });
    expect(cobro1.success).toBe(true);
    if (!cobro1.success) throw new Error(JSON.stringify(cobro1));
    const cxcParcial = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxc.id } });
    expect(cxcParcial.estado).toBe('PARCIAL');
    expect(String(cxcParcial.montoPagado)).toBe('200');
    const cobro2 = await settleReceivable({
      cuentaPorCobrarId: cxc.id, cuentaId: banco.cuentaId, tipoPagoId,
      monto: '300', fechaEfectiva: '2026-11-06', referencia: 'cobro-ff-2',
    });
    expect(cobro2.success).toBe(true);
    if (!cobro2.success) throw new Error(JSON.stringify(cobro2));
    const cxcPagada = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxc.id } });
    expect(cxcPagada.estado).toBe('PAGADA');
    expect(await saldoBanco(banco.cuentaId)).toBe('1500');

    // 3. Pago de la CxP inicial: 300.
    const pago = await settlePayable({
      cuentaPorPagarId: cxp.cuentaPorPagarId, cuentaId: banco.cuentaId,
      monto: '300', fechaEfectiva: '2026-11-06', referencia: 'pago-ff-1',
    });
    expect(pago.success).toBe(true);
    if (!pago.success) throw new Error(JSON.stringify(pago));
    const cxpPagada = await prisma.cuentaPorPagar.findUniqueOrThrow({ where: { cuentaPorPagarId: cxp.cuentaPorPagarId } });
    expect(cxpPagada.estado).toBe('PAGADA');
    expect(String(cxpPagada.saldoPendiente)).toBe('0');
    expect(await saldoBanco(banco.cuentaId)).toBe('1200');

    // 4. Primera compra: 3 unidades a 30 con pago completo; repone el stock.
    const compra = await createCompra({
      proveedorId: vendorId,
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      moneda: 'CUP',
      cuentaId: banco.cuentaId,
      tipoPagoId,
      claveIdempotencia: `compra-ff-${tenantId.slice(0, 8)}`,
      items: [{ productoId: producto.id, precioCosto: 30, cantidad: 3, codigoLote: 'LOTE-COMPRA-1' }],
    });
    expect(compra.success).toBe(true);
    if (!compra.success) throw new Error(JSON.stringify(compra));
    const documento = await prisma.compraDocumento.findFirstOrThrow({ where: { tenantId } });
    expect(documento.estado).toBe('PAGADA');
    expect((await stockAlmacen(tenantId, producto.id, almacen.almacenId)).cantidadDisponible).toBe(5);

    // 5. Replay: la misma clave no duplica nada.
    const replay = await initialize(request);
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
    expect(await prisma.inicializacionContable.count({ where: { tenantId } })).toBe(1);
    // La compra crea su propia CxP (pagada); las iniciales siguen siendo una de cada.
    expect(await prisma.cuentaPorCobrar.count({ where: { tenantId, inicializacionId: apertura.inicializacionId } })).toBe(1);
    expect(await prisma.cuentaPorPagar.count({ where: { tenantId, inicializacionId: apertura.inicializacionId } })).toBe(1);

    // 6. Recolector sin omisiones y conciliación pura limpia.
    const candidatos = await recolectarCandidatos(tenantId);
    for (const origenTipo of ['cobro_cxc_externo', 'pago_cxp_externo']) {
      const candidato = candidatos.find((c) => c.origenTipo === origenTipo);
      expect(candidato).toBeDefined();
      expect(candidato?.causaOmision).toBeUndefined();
    }
    const cobros = await prisma.reconciliacionVenta.findMany({ where: { tenantId, cuentaPorCobrarId: cxc.id } });
    const pagos = await prisma.pagoCuentaPorPagar.findMany({ where: { tenantId, cuentaPorPagarId: cxp.cuentaPorPagarId } });
    const cxcFinal = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxc.id } });
    const cxpFinal = await prisma.cuentaPorPagar.findUniqueOrThrow({ where: { cuentaPorPagarId: cxp.cuentaPorPagarId } });
    const conciliacion = reconcileInitialSubledgerSettlements({
      cuentas: [
        {
          tipo: 'CXC', id: cxcFinal.id,
          monedaOriginal: cxcFinal.monedaOriginal ?? 'CUP',
          monedaFuncional: cxcFinal.monedaFuncional ?? 'CUP',
          montoDeuda: String(cxcFinal.montoDeuda),
          montoDeudaFuncional: String(cxcFinal.montoDeudaFuncional),
          montoPagado: String(cxcFinal.montoPagado),
          montoPagadoFuncional: String(cxcFinal.montoPagadoFuncional),
          estado: cxcFinal.estado,
        },
        {
          tipo: 'CXP', id: cxpFinal.cuentaPorPagarId,
          monedaOriginal: cxpFinal.moneda ?? 'CUP',
          monedaFuncional: cxpFinal.monedaFuncional ?? 'CUP',
          montoDeuda: String(cxpFinal.montoDeuda),
          montoDeudaFuncional: String(cxpFinal.montoDeudaFuncional),
          montoPagado: String(cxpFinal.montoPagado ?? 0),
          montoPagadoFuncional: String(cxpFinal.montoPagadoFuncional ?? 0),
          saldoPendiente: String(cxpFinal.saldoPendiente),
          estado: cxpFinal.estado,
        },
      ],
      liquidaciones: [
        ...cobros.map((r) => ({
          id: r.reconciliacionId, cuentaId: r.cuentaPorCobrarId ?? cxcFinal.id, tipo: 'CXC' as const,
          moneda: r.moneda, montoOriginal: String(r.monto), montoFuncional: String(r.montoConvertido),
          fecha: r.fechaReconciliacion, creadoEn: r.createdAt,
          tasaCambio: r.tasaCambio === null ? null : Number(r.tasaCambio),
          rateEffectiveAt: r.rateEffectiveAt, fxProvenanceKind: r.fxProvenanceKind,
          fxProvenanceSource: r.fxProvenanceSource, fxCatalogRateId: r.fxCatalogRateId,
          fxEvidenceFingerprint: r.fxEvidenceFingerprint, fxEvidenceVersion: r.fxEvidenceVersion,
        })),
        ...pagos.map((p) => ({
          id: p.pagoCuentaPorPagarId, cuentaId: p.cuentaPorPagarId, tipo: 'CXP' as const,
          moneda: p.moneda, montoOriginal: String(p.monto), montoFuncional: String(p.montoFuncional),
          fecha: p.fechaPago, creadoEn: p.createdAt,
          tasaCambio: p.tasaCambio === null ? null : Number(p.tasaCambio),
          rateEffectiveAt: p.rateEffectiveAt, fxProvenanceKind: p.fxProvenanceKind,
          fxProvenanceSource: p.fxProvenanceSource, fxCatalogRateId: p.fxCatalogRateId,
          fxEvidenceFingerprint: p.fxEvidenceFingerprint, fxEvidenceVersion: p.fxEvidenceVersion,
        })),
      ],
    });
    expect(conciliacion).toEqual({ conciliado: true, discrepancias: [] });
  });

  it('el segundo tenant inicializa aparte sin contaminar al primero', async () => {
    const primero = await makeTenant();
    const segundo = await makeTenant();
    const { producto, almacen } = await makeInventorySetup(primero.tenantId);
    const { producto: producto2, almacen: almacen2 } = await makeInventorySetup(segundo.tenantId);
    // La action deriva el tenant del usuario autenticado: fijar el mock
    // antes de cada inicialización.
    auth.user = primero.user as unknown as AuthenticatedUser;
    const base = (tenantId: string, productoId: string, almacenId: string, sufijo: string) => ({
      idempotencyKey: `aislamiento-${sufijo}-${tenantId.slice(0, 8)}`,
      fechaCorte: '2026-11-01',
      monedaFuncional: 'CUP',
      cuentas: [{
        nombreCuenta: 'Cuenta CUP', nombreBanco: 'Banco QA',
        numeroCuenta: `AIS-C-${tenantId.slice(0, 8)}`, tipoCuenta: 'CORRIENTE',
        moneda: 'CUP', saldoInicial: '100', origenNoDocumentado: true,
      }],
      inventario: [{
        referenciaFila: 'fila-1', productoId, almacenId,
        loteCodigo: 'LOTE-AIS-1', cantidad: '1', costoUnitario: '10', moneda: 'CUP',
      }],
    });
    const r1 = await initialize(base(primero.tenantId, producto.id, almacen.almacenId, 'a'));
    if (!r1.success) throw new Error(JSON.stringify(r1));
    expect(r1.success).toBe(true);
    // La action deriva el tenant del usuario autenticado: cambiar el mock.
    auth.user = segundo.user as unknown as AuthenticatedUser;
    const r2 = await initialize(base(segundo.tenantId, producto2.id, almacen2.almacenId, 'b'));
    if (!r2.success) throw new Error(JSON.stringify(r2));
    expect(r2.success).toBe(true);
    expect(await prisma.inicializacionContable.count({ where: { tenantId: primero.tenantId } })).toBe(1);
    expect(await prisma.inicializacionContable.count({ where: { tenantId: segundo.tenantId } })).toBe(1);
    expect(await prisma.inventarioInicialFuente.count({ where: { tenantId: primero.tenantId } })).toBe(1);
    expect(await prisma.inventarioInicialFuente.count({ where: { tenantId: segundo.tenantId } })).toBe(1);
    // El replay del primero no ve las filas del segundo.
    auth.user = primero.user as unknown as AuthenticatedUser;
    const replay = await initialize(base(primero.tenantId, producto.id, almacen.almacenId, 'a'));
    expect(replay).toMatchObject({ success: true, data: { replayed: true } });
  });
});
