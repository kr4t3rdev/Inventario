/**
 * @description Test de integración real de la valoración de venta CT-1: una
 * venta al contado cuyo costo FIFO tiene una fuente sin tasa publicada vigente
 * debe rechazarse identificando el emisor y el dato faltante (no con un
 * mensaje genérico), sin dejar efectos persistidos y sin inventar tasa ni
 * moneda. La venta con costo valorado continúa generando sus asientos.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { withTestTenant } from '@/lib/db/tenant-context';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const suffix = randomUUID().replaceAll('-', '');
const tenantId = `ct1_venta_val_${suffix}`;
const userId = `ct1_venta_user_${suffix}`;
const bancoId = `ct1_venta_bank_${suffix}`;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

let pvId = '';
let productoSinTasa = '';
let productoValorado = '';
let turnoId = '';

/**
 * @description Construye el actor autenticado de la prueba para el tenant aislado.
 * @param {string} actorId - Identificador del actor.
 * @returns {AuthenticatedUser} Actor con tenant y plan fijo.
 */
function userFor(actorId: string): AuthenticatedUser {
  return {
    userId: actorId,
    name: `Actor ${actorId}`,
    email: `${actorId}@test.local`,
    role: 'admin',
    isActive: true,
    tenantId,
    planFeatures: {
      facturacion: true,
      'ventas-pos': true,
      'ventas-factura': true,
      'cuentas-cobrar': true,
      'turnos-pos': true,
    },
  } as unknown as AuthenticatedUser;
}

/**
 * @description Registra la venta dentro del contexto del tenant.
 * @param {Record<string, unknown>} input - Payload de la venta.
 * @returns {Promise<{ ventaId: string }>} Venta creada.
 */
function crearVenta(input: Record<string, unknown>) {
  return withTestTenant(tenantId, () =>
    VentaMutationService.create({
      input: input as never,
      user: userFor(userId),
    }),
  ) as Promise<{ ventaId: string }>;
}

/**
 * @description Siembra un producto con stock y su lote de compra en la moneda dada.
 * @param {string} nombre - Nombre del producto.
 * @param {string} monedaCompra - Moneda de la compra que originó el stock.
 * @returns {Promise<string>} ID del producto creado.
 */
async function seedProductoConLote(nombre: string, monedaCompra: string): Promise<string> {
  const producto = await prisma.producto.create({
    data: {
      nombre,
      precioCosto: 100,
      precioVenta: 15,
      stock: 20,
      tenant: { connect: { tenantId } },
      categoria: { connect: { catId: categoriaId } },
      almacen: { connect: { almacenId: almacenId } },
    },
  });
  const vendor = await prisma.vendor.create({
    data: { nombre: `Prov ${monedaCompra} ${nombre}`, tenantId },
  });
  const compra = await prisma.compraDocumento.create({
    data: { tenantId, proveedorId: vendor.vendorId, formaPago: 'EFECTIVO', estado: 'RECIBIDA', moneda: monedaCompra },
  });
  await prisma.compraDocumentoItem.create({
    data: {
      compraDocumentoId: compra.compraDocumentoId,
      tenantId,
      productoId: producto.id,
      cantidad: 10,
      precioUnitario: 100,
      totalLinea: 1000,
      createdAt: new Date('2026-09-01T00:00:00Z'),
    },
  });
  await prisma.stockUbicacion.create({
    data: { tenantId, productoId: producto.id, tipoUbicacion: 'punto_venta', ubicacionId: pvId, cantidad: 20, cantidadDisponible: 20 },
  });
  return producto.id;
}

let categoriaId = '';
let almacenId = '';

describe('valoración de venta con costo FIFO sin tasa en PostgreSQL aislado', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';

    const identity = await prisma.$queryRaw<Array<{
      databaseName: string;
      roleName: string;
      serverPort: number;
    }>>`
      SELECT current_database() AS "databaseName",
        current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    expect(identity).toHaveLength(1);
    assertDisposableDatabaseIdentity(identity[0], process.env);

    const now = new Date();
    await prisma.tenant.create({ data: { tenantId, nombre: tenantId, slug: tenantId } });
    await prisma.user.create({
      data: { userId, name: `Actor ${userId}`, email: `${userId}@test.local`, password: 'x' },
    });
    await prisma.periodoContable.create({
      data: {
        tenantId,
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
      },
    });
    await prisma.moneda.upsert({
      where: { codigo: 'CUP' },
      create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
      update: {},
    });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
    });
    await prisma.$transaction((tx) => seedPlanContable(tx as never, tenantId));
    await seedPlantillasGlobales(prisma as never);
    await prisma.tenantLicense.create({
      data: {
        tenantId,
        activa: true,
        expiracion: new Date(Date.now() + 86_400_000),
        features: { 'contabilidad-formal': true, 'ventas-pos': true, facturacion: true },
      },
    });

    const categoria = await prisma.categoria.create({ data: { nombre: `Cat ${suffix}`, tenantId } });
    categoriaId = categoria.catId;
    const almacen = await prisma.almacen.create({ data: { nombre: `Alm ${suffix}`, tenantId } });
    almacenId = almacen.almacenId;
    const pv = await prisma.puntoDeVenta.create({
      data: { nombre: `PV ${suffix}`, tenantId, tipoCaja: 'SECUNDARIA' },
    });
    pvId = pv.pvId;
    productoSinTasa = await seedProductoConLote(`Prod USD ${suffix}`, 'USD');
    productoValorado = await seedProductoConLote(`Prod CUP ${suffix}`, 'CUP');
    await prisma.cuentaBancaria.create({
      data: {
        cuentaId: bancoId, tenantId, nombreBanco: `ct1-venta-bank-${suffix}`,
        numeroCuenta: `venta-${suffix}`, tipoCuenta: 'EFECTIVO', moneda: 'CUP', saldo: 0,
      },
    });
    const turno = await prisma.turnoPuntoVenta.create({
      data: { tenantId, puntoDeVentaId: pvId, fondoInicialCup: 0, fondoInicialUsd: 0, estado: 'ABIERTO', tipo: 'NORMAL' },
    });
    turnoId = turno.id;
  });

  it('rechaza la venta identificando emisor y dato, y no deja efectos persistidos', async () => {
    const venta = crearVenta({
      puntoDeVentaId: pvId,
      turnoId,
      metodoPago: 'EFECTIVO',
      montoEfectivo: 15,
      cuentaBancariaId: bancoId,
      items: [{ productoId: productoSinTasa, cantidad: 1, precioUnitario: 15 }],
    });

    // Causa demostrada: la fuente FIFO está en USD sin tasa publicada, así que
    // el costo no tiene monto funcional; el rechazo identifica emisor y dato.
    await expect(venta).rejects.toThrow(/COSTO_VENTA_DEVENGADO/);
    await expect(venta).rejects.toThrow(/monto funcional/);

    const [ventas, stock, asientos] = await Promise.all([
      prisma.venta.count({ where: { tenantId } }),
      prisma.stockUbicacion.findFirstOrThrow({
        where: { tenantId, productoId: productoSinTasa },
        select: { cantidad: true, cantidadDisponible: true },
      }),
      prisma.asiento.count({ where: { tenantId } }),
    ]);
    // Operación rechazada: sin venta, sin movimiento de stock, sin asientos.
    expect(ventas).toBe(0);
    expect(stock.cantidad).toBe(20);
    expect(stock.cantidadDisponible).toBe(20);
    expect(asientos).toBe(0);
  });

  it('contabiliza la venta con costo valorado y su asiento de costo', async () => {
    const venta = await crearVenta({
      puntoDeVentaId: pvId,
      turnoId,
      metodoPago: 'EFECTIVO',
      montoEfectivo: 15,
      cuentaBancariaId: bancoId,
      items: [{ productoId: productoValorado, cantidad: 1, precioUnitario: 15 }],
    });
    expect(venta.ventaId).toBeTruthy();

    const costo = await prisma.asiento.findUniqueOrThrow({
      where: {
        tenantId_origenTipo_origenId: {
          tenantId,
          origenTipo: 'venta_costo',
          origenId: venta.ventaId,
        },
      },
      include: { lineas: true },
    });
    expect(costo.estado).toBe('CONTABILIZADO');
    const totalCosto = costo.lineas.reduce((sum, linea) => sum.add(linea.debe), costo.lineas[0].debe.mul(0));
    // Costo FIFO real de la fuente CUP: 1 unidad × 100.
    expect(totalCosto.toString()).toBe('100');
  });

  afterAll(async () => {
    if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
    else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
  });
});
