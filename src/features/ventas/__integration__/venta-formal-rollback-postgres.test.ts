/**
 * @description Test de integración real del rollback físico formal de la venta
 * de productos (R6.1, familia comercial).
 *
 * La venta es la operación que más escrituras operativas abre a la vez: la
 * venta y sus líneas, el descuento de stock, el kardex, la factura, la cuenta
 * por cobrar (o la reconciliación y el cobro en efectivo) y el asiento formal.
 * El test comprueba, en modo `enforce`, que el fallo del insert del asiento
 * revierte **todas** esas escrituras juntas: no queda venta, ni factura, ni
 * cuenta por cobrar, ni saldo bancario, ni kardex, ni el asiento.
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
const tenantId = `formal_venta_${suffix}`;
const userId = `formal_user_${suffix}`;
const ledgerFailUserId = `formal_ledger_fail_${suffix}`;
const bancoId = `formal_venta_bank_${suffix}`;
const ledgerFailureFunction = `formal_venta_ledger_failure_${suffix}`;
const ledgerFailureTrigger = `formal_venta_ledger_trigger_${suffix}`;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

let pvId = '';
let productoId = '';
let clienteId = '';
let turnoId = '';

/**
 * @description Construye el actor autenticado de la prueba para el tenant aislado.
 * @param {string} actorId - Identificador del actor (marca el failpoint cuando hace falta).
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
 * @param {string} actorId - Actor que ejecuta la operación.
 * @returns {Promise<{ ventaId: string }>} Venta creada.
 */
function crearVenta(input: Record<string, unknown>, actorId = userId) {
  return withTestTenant(tenantId, () =>
    VentaMutationService.create({
      input: input as never,
      user: userFor(actorId),
    }),
  ) as Promise<{ ventaId: string }>;
}

/**
 * @description Captura el estado operativo y el libro mayor para comparar
 * antes/después del failpoint.
 * @returns {Promise<object>} Fotografía del estado persistido del tenant.
 */
async function readSnapshot() {
  const [
    ventas,
    items,
    facturas,
    cxcs,
    reconciliaciones,
    kardex,
    stock,
    banco,
    serie,
    asientos,
    lineas,
    allocations,
  ] = await Promise.all([
    prisma.venta.count({ where: { tenantId } }),
    prisma.ventaItem.count({ where: { venta: { tenantId } } }),
    prisma.factura.count({ where: { tenantId } }),
    prisma.cuentaPorCobrar.findMany({
      where: { tenantId },
      select: { id: true, montoDeuda: true, montoPagado: true, estado: true },
      orderBy: { id: 'asc' },
    }),
    prisma.reconciliacionVenta.count({ where: { tenantId } }),
    prisma.stockMoveLine.count({ where: { tenantId } }),
    prisma.stockUbicacion.findMany({
      where: { tenantId },
      select: { productoId: true, cantidad: true, cantidadDisponible: true },
      orderBy: { productoId: 'asc' },
    }),
    prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: bancoId },
      select: { saldo: true },
    }),
    prisma.serieFacturacion.findMany({
      where: { tenantId },
      select: { serieId: true, consecutivo: true },
      orderBy: { serieId: 'asc' },
    }),
    prisma.asiento.findMany({
      where: { tenantId },
      orderBy: { tenantSequence: 'asc' },
      select: {
        asientoId: true,
        origenTipo: true,
        origenId: true,
        estado: true,
        hash: true,
        hashAnterior: true,
      },
    }),
    prisma.asientoLinea.count({ where: { tenantId } }),
    prisma.purchaseAllocation.findMany({
      where: { tenantId },
      select: { id: true, cantidad: true, ventaItemId: true },
      orderBy: { id: 'asc' },
    }),
  ]);
  return {
    ventas,
    items,
    facturas,
    reconciliaciones,
    kardex,
    lineas,
    cxcs: cxcs.map((cxc) => ({
      id: cxc.id,
      montoDeuda: cxc.montoDeuda.toString(),
      montoPagado: cxc.montoPagado.toString(),
      estado: cxc.estado,
    })),
    stock: stock.map((row) => ({
      productoId: row.productoId,
      cantidad: row.cantidad,
      disponible: row.cantidadDisponible,
    })),
    banco: banco.saldo.toString(),
    serie: serie.map((row) => ({ serieId: row.serieId, consecutivo: row.consecutivo })),
    allocations: allocations.map((row) => ({
      id: row.id,
      cantidad: row.cantidad,
      ventaItemId: row.ventaItemId,
    })),
    ledger: asientos.map((row) => ({
      id: row.asientoId,
      origenTipo: row.origenTipo,
      origenId: row.origenId,
      estado: row.estado,
      hash: row.hash,
      hashAnterior: row.hashAnterior,
    })),
  };
}

describe(
  'rollback fisico formal de la venta de productos en PostgreSQL aislado',
  { timeout: 120_000 },
  () => {
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

      await prisma.tenant.create({
        data: {
          tenantId,
          nombre: `formal-venta-${suffix}`,
          slug: `formal-venta-${suffix}`,
        },
      });
      // Los actores existen como usuarios reales: el kardex los referencia por
      // clave foranea y el trigger los distingue por su identificador.
      for (const actorId of [userId, ledgerFailUserId]) {
        await prisma.user.create({
          data: {
            userId: actorId,
            name: `Actor ${actorId}`,
            email: `${actorId}@test.local`,
            password: 'x',
          },
        });
      }
      const now = new Date();
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

      const categoria = await prisma.categoria.create({
        data: { nombre: `Cat ${suffix}`, tenantId },
      });
      const almacen = await prisma.almacen.create({
        data: { nombre: `Alm ${suffix}`, tenantId },
      });
      const pv = await prisma.puntoDeVenta.create({
        data: { nombre: `PV ${suffix}`, tenantId, tipoCaja: 'SECUNDARIA' },
      });
      pvId = pv.pvId;
      const producto = await prisma.producto.create({
        data: {
          nombre: `Prod ${suffix}`,
          precioCosto: 100,
          precioVenta: 500,
          stock: 20,
          tenant: { connect: { tenantId } },
          categoria: { connect: { catId: categoria.catId } },
          almacen: { connect: { almacenId: almacen.almacenId } },
        },
      });
      productoId = producto.id;
      const cliente = await prisma.cliente.create({
        data: { nombre: `Cliente ${suffix}`, tenantId },
      });
      clienteId = cliente.clienteId;
      // Lote de compra: da origen al costo FIFO que la venta devenga.
      const vendor = await prisma.vendor.create({
        data: { nombre: `Proveedor ${suffix}`, tenantId },
      });
      const compra = await prisma.compraDocumento.create({
        data: {
          tenantId,
          proveedorId: vendor.vendorId,
          formaPago: 'EFECTIVO',
          estado: 'RECIBIDA',
        },
      });
      await prisma.compraDocumentoItem.create({
        data: {
          compraDocumentoId: compra.compraDocumentoId,
          tenantId,
          productoId,
          cantidad: 10,
          precioUnitario: 100,
          totalLinea: 1000,
          createdAt: new Date('2026-09-01T00:00:00Z'),
        },
      });
      await prisma.stockUbicacion.create({
        data: {
          tenantId,
          productoId,
          tipoUbicacion: 'punto_venta',
          ubicacionId: pvId,
          cantidad: 20,
          cantidadDisponible: 20,
        },
      });

      const banco = await prisma.cuentaBancaria.create({
        data: {
          cuentaId: bancoId,
          tenantId,
          nombreBanco: `formal-venta-bank-${suffix}`,
          numeroCuenta: `venta-${suffix}`,
          tipoCuenta: 'EFECTIVO',
          moneda: 'CUP',
          saldo: 0,
        },
      });
      expect(banco.cuentaId).toBe(bancoId);
      await prisma.tipoPago.create({
        data: {
          tenantId,
          nombre: `Efectivo ${suffix}`,
          requiereCuenta: true,
          cuentaDefecto: bancoId,
        },
      });
      const turno = await prisma.turnoPuntoVenta.create({
        data: {
          tenantId,
          puntoDeVentaId: pvId,
          fondoInicialCup: 0,
          fondoInicialUsd: 0,
          estado: 'ABIERTO',
          tipo: 'NORMAL',
        },
      });
      turnoId = turno.id;

      await prisma.$executeRawUnsafe(
        `CREATE FUNCTION public."${ledgerFailureFunction}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."tenantId" = '${tenantId}' AND NEW."createdBy" LIKE 'formal_ledger_fail_%' THEN RAISE EXCEPTION 'forced asiento failure' USING ERRCODE = '23514'; END IF; RETURN NEW; END $$`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER "${ledgerFailureTrigger}" BEFORE INSERT ON public."asientos" FOR EACH ROW EXECUTE FUNCTION public."${ledgerFailureFunction}"()`,
      );
    });

    afterAll(async () => {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${ledgerFailureTrigger}" ON public."asientos"`,
      );
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${ledgerFailureFunction}"()`);
      if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
    });

    it('contabiliza la venta a credito con su factura y su cuenta por cobrar', async () => {
      const before = await readSnapshot();
      const venta = await crearVenta({
        puntoDeVentaId: pvId,
        clienteId,
        turnoId,
        metodoPago: 'CREDITO',
        montoCredito: 1000,
        tipoVencimiento: 'fecha',
        fechaVencimiento: new Date(Date.now() + 86_400_000).toISOString(),
        items: [{ productoId, cantidad: 2, precioUnitario: 500 }],
      });

      const after = await readSnapshot();
      expect(after.ventas).toBe(before.ventas + 1);
      expect(after.items).toBe(before.items + 1);
      expect(after.facturas).toBe(before.facturas + 1);
      expect(after.cxcs).toHaveLength(before.cxcs.length + 1);
      expect(after.kardex).toBe(before.kardex + 1);
      // El costo FIFO (200) se devenga con su propio asiento, ademas del
      // asiento de la venta a credito.
      expect(after.ledger).toHaveLength(before.ledger.length + 2);
      expect(after.allocations).toHaveLength(before.allocations.length + 1);
      const allocation = await prisma.purchaseAllocation.findFirstOrThrow({
        where: { tenantId, ventaItem: { ventaId: venta.ventaId } },
        include: { compraDocumentoItem: { include: { compraDocumento: true } } },
      });
      expect(allocation.costoUnitarioSnapshot).toBe(100);
      expect(allocation.fifoMonedaOrigen).toBe(allocation.compraDocumentoItem?.compraDocumento.moneda);
      expect(allocation.fifoFechaFuente).toEqual(allocation.compraDocumentoItem?.compraDocumento.fechaCompra);
      expect(allocation.fifoMonedaFuncional).toBe('CUP');
      expect(Number(allocation.fifoCostoFuncional)).toBe(200);
      const fifoEvidence = JSON.parse(allocation.fifoEvidenciaFx ?? '{}') as {
        functionalCurrency?: string;
        fxEvidenceFingerprint?: string;
        rawConvertedAmount?: number;
      };
      expect(fifoEvidence.functionalCurrency).toBe('CUP');
      expect(fifoEvidence.fxEvidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(fifoEvidence.rawConvertedAmount).toBe(200);

      const costo = await prisma.asiento.findUniqueOrThrow({
        where: {
          tenantId_origenTipo_origenId: {
            tenantId,
            origenTipo: 'venta_costo',
            origenId: venta.ventaId,
          },
        },
        include: { lineas: { orderBy: { orden: 'asc' } } },
      });
      expect(costo.estado).toBe('CONTABILIZADO');
      expect(costo.lineas).toHaveLength(2);
      const costoDebe = costo.lineas.reduce(
        (sum, linea) => sum.add(linea.debe),
        costo.lineas[0].debe.mul(0),
      );
      expect(costoDebe.toString()).toBe('200');

      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: {
          tenantId_origenTipo_origenId: {
            tenantId,
            origenTipo: 'factura',
            origenId: (await prisma.factura.findFirstOrThrow({
              where: { tenantId, ventaId: venta.ventaId },
              select: { idFactura: true },
            })).idFactura,
          },
        },
        include: { lineas: { orderBy: { orden: 'asc' } } },
      });
      expect(asiento.estado).toBe('CONTABILIZADO');
      expect(asiento.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(asiento.lineas).toHaveLength(2);
      const debe = asiento.lineas.reduce(
        (sum, linea) => sum.add(linea.debe),
        asiento.lineas[0].debe.mul(0),
      );
      const haber = asiento.lineas.reduce(
        (sum, linea) => sum.add(linea.haber),
        asiento.lineas[0].haber.mul(0),
      );
      expect(debe.toString()).toBe('1000');
      expect(haber.toString()).toBe('1000');
    });

    it('contabiliza la venta al contado con su reconciliacion y su cobro', async () => {
      const before = await readSnapshot();
      const venta = await crearVenta({
        puntoDeVentaId: pvId,
        clienteId,
        turnoId,
        metodoPago: 'EFECTIVO',
        montoEfectivo: 500,
        tipoVencimiento: 'contra_pago',
        cuentaBancariaId: bancoId,
        items: [{ productoId, cantidad: 1, precioUnitario: 500 }],
      });

      const after = await readSnapshot();
      expect(after.ventas).toBe(before.ventas + 1);
      expect(after.facturas).toBe(before.facturas + 1);
      expect(after.reconciliaciones).toBe(before.reconciliaciones + 1);
      expect(Number(after.banco)).toBe(Number(before.banco) + 500);
      // El asiento de la venta al contado y el devengo de su costo FIFO.
      expect(after.ledger).toHaveLength(before.ledger.length + 2);

      const reconciliacion = await prisma.reconciliacionVenta.findFirstOrThrow({
        where: { tenantId, ventaId: venta.ventaId },
        select: { reconciliacionId: true },
      });
      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: {
          tenantId_origenTipo_origenId: {
            tenantId,
            origenTipo: 'reconciliacion_venta',
            origenId: reconciliacion.reconciliacionId,
          },
        },
        include: { lineas: { orderBy: { orden: 'asc' } } },
      });
      expect(asiento.estado).toBe('CONTABILIZADO');
      expect(asiento.lineas).toHaveLength(2);
    });

    it('revierte la escritura operativa y el libro mayor cuando falla el insert del asiento', async () => {
      const before = await readSnapshot();
      await expect(
        crearVenta(
          {
            puntoDeVentaId: pvId,
            clienteId,
            turnoId,
            metodoPago: 'CREDITO',
            montoCredito: 1500,
            tipoVencimiento: 'fecha',
            fechaVencimiento: new Date(Date.now() + 86_400_000).toISOString(),
            items: [{ productoId, cantidad: 3, precioUnitario: 500 }],
          },
          ledgerFailUserId,
        ),
      ).rejects.toThrow('forced asiento failure');

      const after = await readSnapshot();
      expect(after).toEqual(before);
    });
  },
);
