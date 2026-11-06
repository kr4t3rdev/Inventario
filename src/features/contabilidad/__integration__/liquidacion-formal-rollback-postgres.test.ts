/**
 * @description Test de integración real del rollback físico formal de las
 * liquidaciones (R6.1, familia de liquidaciones).
 *
 * El cobro de una venta a crédito (`COBRO_CXC`), el cobro de una venta de
 * servicio (`COBRO_SERVICIO`) y el pago de una compra (`PAGO_CXP`) mueven la
 * tesorería y emiten su asiento formal en la misma transacción que actualiza
 * la cuenta por cobrar o por pagar. Estos emisores son los "no Cash" y su
 * gate se enciende solo dentro del proceso de prueba. El test comprueba, en
 * modo `enforce`, que el fallo del insert del asiento revierte el conjunto
 * completo: ni la reconciliación, ni el saldo bancario, ni el estado de la
 * cuenta por cobrar o por pagar.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { withTestTenant } from '@/lib/db/tenant-context';
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

const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: async () => auth.user,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { reconciliarVentaAction, reconciliarServicioAction } = await import(
  '@/features/contabilidad/actions-reconciliacion'
);
const { AccountingReconciliationService } = await import(
  '@/features/contabilidad/services/accounting-reconciliation-service'
);
const { createVentaServicioAction } = await import('@/features/venta-servicios/actions');
const { createCompraProductoAction } = await import('@/features/compras-productos/actions');

const suffix = randomUUID().replaceAll('-', '');
const tenantId = `formal_liquidacion_${suffix}`;
const userId = `formal_user_${suffix}`;
const ledgerFailUserId = `formal_ledger_fail_${suffix}`;
const bancoId = `formal_liquidacion_bank_${suffix}`;
const ledgerFailureFunction = `formal_liquidacion_ledger_failure_${suffix}`;
const ledgerFailureTrigger = `formal_liquidacion_ledger_trigger_${suffix}`;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;
const previousNoCashMode = process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE;

let pvId = '';
let productoId = '';
let clienteId = '';
let proveedorId = '';
let servicioId = '';
let tipoPagoId = '';
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
      contabilidad: true,
      servicios: true,
      'cuentas-cobrar': true,
      'cuentas-pagar': true,
      facturacion: true,
    },
  } as unknown as AuthenticatedUser;
}

/**
 * @description Captura el estado operativo y el libro mayor para comparar
 * antes/despues del failpoint.
 * @returns {Promise<object>} Fotografia del estado persistido del tenant.
 */
async function readSnapshot() {
  const [reconciliacionesVentas, reconciliacionesServicios, reconciliacionesGastos, cxcs, cxps, banco, asientos, lineas] =
    await Promise.all([
      prisma.reconciliacionVenta.count({ where: { tenantId } }),
      prisma.reconciliacionServicio.count({ where: { tenantId } }),
      prisma.reconciliacionGasto.count({ where: { tenantId } }),
      prisma.cuentaPorCobrar.findMany({
        where: { tenantId },
        select: { id: true, montoDeuda: true, montoPagado: true, estado: true },
        orderBy: { id: 'asc' },
      }),
      prisma.cuentaPorPagar.findMany({
        where: { tenantId },
        select: { cuentaPorPagarId: true, montoDeuda: true, saldoPendiente: true, estado: true },
        orderBy: { cuentaPorPagarId: 'asc' },
      }),
      prisma.cuentaBancaria.findUniqueOrThrow({
        where: { cuentaId: bancoId },
        select: { saldo: true },
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
    ]);
  return {
    reconciliacionesVentas,
    reconciliacionesServicios,
    reconciliacionesGastos,
    banco: banco.saldo.toString(),
    lineas,
    cxcs: cxcs.map((row) => ({
      id: row.id,
      montoDeuda: row.montoDeuda.toString(),
      montoPagado: row.montoPagado.toString(),
      estado: row.estado,
    })),
    cxps: cxps.map((row) => ({
      id: row.cuentaPorPagarId,
      montoDeuda: row.montoDeuda.toString(),
      saldoPendiente: row.saldoPendiente.toString(),
      estado: row.estado,
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

/**
 * @description Registra una venta a credito con su factura y su cuenta por cobrar.
 * @param {number} cantidad - Cantidad vendida.
 * @param {string} actorId - Actor que ejecuta la operacion.
 * @returns {Promise<string>} Identificador de la venta creada.
 */
async function crearVentaCredito(cantidad: number, actorId = userId): Promise<string> {
  const venta = await withTestTenant(tenantId, () =>
    VentaMutationService.create({
      input: {
        puntoDeVentaId: pvId,
        clienteId,
        turnoId,
        metodoPago: 'CREDITO',
        montoCredito: cantidad * 500,
        tipoVencimiento: 'fecha',
        fechaVencimiento: new Date(Date.now() + 86_400_000).toISOString(),
        items: [{ productoId, cantidad, precioUnitario: 500 }],
      } as never,
      user: userFor(actorId),
    }),
  );
  return (venta as { ventaId: string }).ventaId;
}

/**
 * @description Cobra una venta de servicio por el writer formal de
 * liquidaciones (`reconcileService`) y captura el fallo sin propagarlo.
 * @param {string} ventaServicioId - Documento de servicio que se cobra.
 * @param {number} monto - Importe cobrado a la tesoreria.
 * @param {string} actorId - Actor que ejecuta la operacion.
 * @returns {Promise<{ success: boolean; error?: { message?: string } }>} Resultado del cobro.
 */
async function cobrarServicio(
  ventaServicioId: string,
  monto: number,
  actorId = userId,
): Promise<{ success: boolean; error?: { message?: string } }> {
  try {
    await AccountingReconciliationService.reconcileService({
      input: {
        ventaServicioId,
        distribuciones: [{ cuentaId: bancoId, tipoPagoId, monto }],
      },
      user: userFor(actorId),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: { message: (error as Error)?.message } };
  }
}

describe(
  'rollback fisico formal de las liquidaciones en PostgreSQL aislado',
  { timeout: 120_000 },
  () => {
    beforeAll(async () => {
      process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
      // El emisor formal no Cash (COBRO_CXC / COBRO_SERVICIO / PAGO_CXP) tiene
      // su propio gate: solo se enciende dentro del proceso de prueba.
      process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE = 'enforce';
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
          nombre: `formal-liquidacion-${suffix}`,
          slug: `formal-liquidacion-${suffix}`,
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
          features: { 'contabilidad-formal': true },
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
      const proveedor = await prisma.vendor.create({
        data: { nombre: `Proveedor ${suffix}`, tenantId },
      });
      proveedorId = proveedor.vendorId;
      const servicio = await prisma.servicios.create({
        data: {
          tenantId,
          nombre: `Servicio ${suffix}`,
          precio: 200,
          costo: 120,
          descripcion: `Servicio de prueba ${suffix}`,
          moneda: 'CUP',
        },
      });
      servicioId = servicio.servicioId;
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
      await prisma.cuentaBancaria.create({
        data: {
          cuentaId: bancoId,
          tenantId,
          nombreBanco: `formal-liquidacion-bank-${suffix}`,
          numeroCuenta: `liquidacion-${suffix}`,
          tipoCuenta: 'EFECTIVO',
          moneda: 'CUP',
          saldo: 5000,
        },
      });
      const tipoPago = await prisma.tipoPago.create({
        data: {
          tenantId,
          nombre: `Efectivo ${suffix}`,
          requiereCuenta: true,
          cuentaDefecto: bancoId,
        },
      });
      tipoPagoId = tipoPago.tipoId;
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
      if (previousNoCashMode === undefined) delete process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE;
      else process.env.CONTABILIDAD_FORMAL_NO_CASH_MODE = previousNoCashMode;
      auth.user = null;
    });

    it('contabiliza el cobro de la venta a credito', async () => {
      const ventaId = await crearVentaCredito(2);
      const before = await readSnapshot();

      auth.user = userFor(userId);
      const resultado = await reconciliarVentaAction({
        ventaId,
        cuentaId: bancoId,
        tipoPagoId,
        monto: 1000,
      });

      expect(resultado.success).toBe(true);
      const after = await readSnapshot();
      expect(after.reconciliacionesVentas).toBe(before.reconciliacionesVentas + 1);
      expect(Number(after.banco)).toBe(Number(before.banco) + 1000);
      expect(after.ledger).toHaveLength(before.ledger.length + 1);
      const cobro = after.ledger.at(-1);
      expect(cobro?.origenTipo).toBe('reconciliacion_venta');
      const cxc = after.cxcs.find((row) => row.estado === 'PAGADA');
      expect(cxc).toBeDefined();
    });

    it('revierte el cobro de la venta cuando falla el insert del asiento', async () => {
      const ventaId = await crearVentaCredito(1);
      const before = await readSnapshot();

      auth.user = userFor(ledgerFailUserId);
      const resultado = await reconciliarVentaAction({
        ventaId,
        cuentaId: bancoId,
        tipoPagoId,
        monto: 500,
      });

      expect(resultado.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
    });

    it('la action web de cobro de servicio tambien contabiliza el cobro', async () => {
      auth.user = userFor(userId);
      const venta = await createVentaServicioAction({
        servicioId,
        cantidad: 2,
        clienteId,
        condicionPago: 'CREDITO',
      });
      expect(venta.success).toBe(true);
      const ventaServicioId = (
        venta as { data?: { ventaServicio?: { ventaServicioId: string } } }
      ).data?.ventaServicio?.ventaServicioId as string;
      expect(typeof ventaServicioId).toBe('string');
      const before = await readSnapshot();

      const resultado = await reconciliarServicioAction({
        ventaServicioId,
        distribuciones: [{ cuentaId: bancoId, tipoPagoId, monto: 400 }],
      });

      expect(resultado.success, JSON.stringify(resultado)).toBe(true);
      const after = await readSnapshot();
      expect(after.reconciliacionesServicios).toBe(before.reconciliacionesServicios + 1);
      expect(Number(after.banco)).toBe(Number(before.banco) + 400);
      expect(after.ledger).toHaveLength(before.ledger.length + 1);
      const cobro = after.ledger.at(-1);
      expect(cobro?.origenTipo).toBe('reconciliacion_servicio');
    });

    it('revierte el cobro de la action web cuando falla el insert del asiento', async () => {
      auth.user = userFor(userId);
      const venta = await createVentaServicioAction({
        servicioId,
        cantidad: 1,
        clienteId,
        condicionPago: 'CREDITO',
      });
      expect(venta.success).toBe(true);
      const ventaServicioId = (
        venta as { data?: { ventaServicio?: { ventaServicioId: string } } }
      ).data?.ventaServicio?.ventaServicioId as string;
      expect(typeof ventaServicioId).toBe('string');
      const before = await readSnapshot();

      auth.user = userFor(ledgerFailUserId);
      const resultado = await reconciliarServicioAction({
        ventaServicioId,
        distribuciones: [{ cuentaId: bancoId, tipoPagoId, monto: 200 }],
      });

      expect(resultado.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
    });

    it('contabiliza el cobro de la venta de servicio', async () => {
      auth.user = userFor(userId);
      const venta = await createVentaServicioAction({
        servicioId,
        cantidad: 2,
        clienteId,
        condicionPago: 'CREDITO',
      });
      expect(venta.success).toBe(true);
      const ventaServicioId = (
        venta as { data?: { ventaServicio?: { ventaServicioId: string } } }
      ).data?.ventaServicio?.ventaServicioId as string;
      expect(typeof ventaServicioId).toBe('string');
      const before = await readSnapshot();

      const resultado = await cobrarServicio(ventaServicioId, 400);

      expect(resultado.success, JSON.stringify(resultado)).toBe(true);
      const after = await readSnapshot();
      expect(after.reconciliacionesServicios).toBe(before.reconciliacionesServicios + 1);
      expect(Number(after.banco)).toBe(Number(before.banco) + 400);
      expect(after.ledger).toHaveLength(before.ledger.length + 1);
      const cobro = after.ledger.at(-1);
      expect(cobro?.origenTipo).toBe('reconciliacion_servicio');
    });

    it('revierte el cobro del servicio cuando falla el insert del asiento', async () => {
      auth.user = userFor(userId);
      const venta = await createVentaServicioAction({
        servicioId,
        cantidad: 1,
        clienteId,
        condicionPago: 'CREDITO',
      });
      expect(venta.success).toBe(true);
      const ventaServicioId = (
        venta as { data?: { ventaServicio?: { ventaServicioId: string } } }
      ).data?.ventaServicio?.ventaServicioId as string;
      expect(typeof ventaServicioId).toBe('string');
      const before = await readSnapshot();

      const resultado = await cobrarServicio(ventaServicioId, 200, ledgerFailUserId);

      expect(resultado.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
    });

    it('contabiliza el pago de la compra con su asiento PAGO_CXP', async () => {
      auth.user = userFor(userId);
      const before = await readSnapshot();
      const resultado = await createCompraProductoAction({
        proveedorId,
        numeroFactura: `F-${suffix}-PAGO`,
        formaPago: 'PAGO_COMPLETO',
        estado: 'PAGADA',
        cuentaId: bancoId,
        tipoPagoId,
        items: [{ productoId, cantidad: 2, precioCosto: 100 }],
      });

      expect(resultado.success).toBe(true);
      const after = await readSnapshot();
      expect(after.reconciliacionesGastos).toBe(before.reconciliacionesGastos + 1);
      expect(Number(after.banco)).toBe(Number(before.banco) - 200);
      // El reconocimiento de la compra y el pago a la cuenta por pagar.
      expect(after.ledger).toHaveLength(before.ledger.length + 2);
      const pago = after.ledger.at(-1);
      expect(pago?.origenTipo).toBe('reconciliacion_gasto');
    });

    it('revierte el pago de la compra cuando falla el insert del asiento', async () => {
      auth.user = userFor(ledgerFailUserId);
      const before = await readSnapshot();
      const resultado = await createCompraProductoAction({
        proveedorId,
        numeroFactura: `F-${suffix}-PAGO-FAIL`,
        formaPago: 'PAGO_COMPLETO',
        estado: 'PAGADA',
        cuentaId: bancoId,
        tipoPagoId,
        items: [{ productoId, cantidad: 3, precioCosto: 100 }],
      });

      expect(resultado.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
    });
  },
);
